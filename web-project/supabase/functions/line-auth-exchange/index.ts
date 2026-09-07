import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

export default {
  // แอปเรียกด้วย publishable key (ปกติของ supabase-js ฝั่ง client) — ยอมรับทั้งสองแบบเผื่อ config
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const { code } = await req.json();
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "missing_code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = ctx.supabaseAdmin;
      const { data: row, error } = await admin
        .from("line_auth_handoff")
        .select("access_token, refresh_token, used, expires_at, claims")
        .eq("code", code)
        .maybeSingle();

      if (error || !row) {
        return new Response(JSON.stringify({ error: "invalid_code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (row.used) {
        return new Response(JSON.stringify({ error: "code_already_used" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ error: "code_expired" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("line_auth_handoff").update({ used: true }).eq("code", code);

      return new Response(
        JSON.stringify({
          access_token: row.access_token,
          refresh_token: row.refresh_token,
          claims: row.claims,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unexpected_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }),
};