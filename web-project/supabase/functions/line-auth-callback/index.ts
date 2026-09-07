import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const LINE_CHANNEL_ID = Deno.env.get("LINE_CHANNEL_ID")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/line-auth-callback`;

// อ่านคีย์แบบใหม่ก่อน (SUPABASE_SECRET_KEYS) ถ้าไม่มีค่อย fallback เป็นแบบเก่า
// กันโปรเจกต์ที่ยังไม่ได้ migrate ไปคีย์ใหม่เต็มรูปแบบ
function getSecretApiKey(): string {
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (parsed.default) return parsed.default;
  } catch { /* ignore */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const APP_SCHEMES: Record<string, string> = {
  customer: "com.dtc.rescueapp://auth/callback",
  worker: "com.dtc.rescueapp.worker://auth/callback",
};

function redirectFail(appType: string, message: string): Response {
  const scheme = APP_SCHEMES[appType] || APP_SCHEMES.customer;
  return new Response(null, {
    status: 302,
    headers: { Location: `${scheme}?error=${encodeURIComponent(message)}` },
  });
}

export default {
  // "none" เพราะ LINE เรียก endpoint นี้ตรงๆ ตอน redirect กลับ (browser GET เปล่าๆ ไม่มี apikey แนบมา)
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const url = new URL(req.url);
    const lineCode = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    const lineError = url.searchParams.get("error_description") || url.searchParams.get("error");
    const appType = state.split(":")[0] === "worker" ? "worker" : "customer";

    if (lineError) return redirectFail(appType, lineError);
    if (!lineCode) return redirectFail(appType, "missing_code");

    try {
      // 1) แลก code -> token กับ LINE
      const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: lineCode,
          redirect_uri: CALLBACK_URL,
          client_id: LINE_CHANNEL_ID,
          client_secret: LINE_CHANNEL_SECRET,
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok || !tokenJson.id_token) {
        return redirectFail(appType, tokenJson.error_description || "line_token_exchange_failed");
      }

      // 2) verify id_token กับ LINE เอา claims จริงมาด้วย
      const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: tokenJson.id_token, client_id: LINE_CHANNEL_ID }),
      });
      const claims = await verifyRes.json();
      if (!verifyRes.ok || !claims.sub) return redirectFail(appType, "line_id_token_verify_failed");

      const lineSub: string = claims.sub;
      const displayName: string | undefined = claims.name;
      const picture: string | undefined = claims.picture;
      const realEmail: string | undefined = claims.email; // มักไม่มี เพราะ permission ยัง unapplied

      const admin = ctx.supabaseAdmin;

      // 3) หา auth_user_id ที่ผูกกับ line_sub นี้ไว้แล้ว ถ้ายังไม่มีให้สร้างใหม่
      const { data: existingLink } = await admin
        .from("line_users")
        .select("auth_user_id")
        .eq("line_sub", lineSub)
        .maybeSingle();

      let authUserId: string;
      let userEmail: string;

      if (existingLink?.auth_user_id) {
        authUserId = existingLink.auth_user_id;
        const { data: u } = await admin.auth.admin.getUserById(authUserId);
        userEmail = u.user!.email!;
      } else {
        userEmail = `line-${lineSub}@line.dtc.internal`; // ใช้เป็น identifier ภายในเท่านั้น
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true,
          user_metadata: { provider: "line", line_sub: lineSub, name: displayName, picture },
        });
        if (createErr || !created?.user) return redirectFail(appType, createErr?.message || "create_auth_user_failed");
        authUserId = created.user.id;

        const { error: linkErr } = await admin.from("line_users").insert({ line_sub: lineSub, auth_user_id: authUserId });
        if (linkErr) return redirectFail(appType, "line_users_insert_failed");
      }

      // 4) mint session จริงเอง
      const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });
      if (linkGenErr || !linkData?.properties?.hashed_token) {
        return redirectFail(appType, linkGenErr?.message || "generate_link_failed");
      }

      const verifyOtpRes = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: getSecretApiKey() },
        body: JSON.stringify({ type: "magiclink", token_hash: linkData.properties.hashed_token }),
      });
      const session = await verifyOtpRes.json();
      if (!verifyOtpRes.ok || !session.access_token || !session.refresh_token) {
        return redirectFail(appType, "session_mint_failed");
      }

      // 5) เก็บ session ไว้ให้แอปมาแลกทีหลัง
      const handoffCode = crypto.randomUUID();
      const { error: handoffErr } = await admin.from("line_auth_handoff").insert({
        code: handoffCode,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        auth_user_id: authUserId,
        claims: { name: displayName, email: realEmail, picture },
      });
      if (handoffErr) return redirectFail(appType, "handoff_insert_failed");

      // 6) เด้งกลับเข้าแอป
      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_SCHEMES[appType]}?handoff_code=${handoffCode}` },
      });
    } catch (err) {
      return redirectFail(appType, err instanceof Error ? err.message : "unexpected_error");
    }
  }),
};