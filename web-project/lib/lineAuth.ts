// lib/lineAuth.ts
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { supabase } from './supabaseClient';

const LINE_CHANNEL_ID = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const LINE_CALLBACK_URL = `${SUPABASE_URL}/functions/v1/line-auth-callback`;

export type AppType = 'customer' | 'worker';

const APP_SCHEMES: Record<AppType, string> = {
  customer: 'com.dtc.rescueapp://auth/callback',
  worker: 'com.dtc.rescueapp.worker://auth/callback',
};

/** เปิดหน้า LINE consent ในเบราว์เซอร์ระบบ — ยิง authorize URL ของ LINE ตรงๆ
 *  (ไม่ผ่าน Supabase custom:line provider แล้ว เพราะ LINE ส่วนใหญ่ไม่มีอีเมล ทำให้
 *  provider เดิม fail แบบ server_error/unexpected_failure ทุกครั้ง) */
export async function signInWithLine(appType: AppType): Promise<void> {
  const state = `${appType}:${crypto.randomUUID()}`;
  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set('redirect_uri', LINE_CALLBACK_URL);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'openid profile email');

  await Browser.open({ url: authorizeUrl.toString(), presentationStyle: 'popover' });
}

let listenerHandle: PluginListenerHandle | null = null;

/** ดักฟัง deep link ที่ line-auth-callback (Edge Function) เด้งกลับมาหลัง LINE login
 *  สำเร็จ แล้วเอา handoff_code ไปแลกเป็น Supabase session จริงผ่าน line-auth-exchange
 *
 *  onSuccess(userId, claims) — เรียกเมื่อได้ session จริงแล้ว ส่ง auth user id + ข้อมูล
 *  จาก LINE (ชื่อ/รูป/อีเมลถ้ามี) ให้ผู้เรียกไปเช็คต่อว่ามีโปรไฟล์ในตาราง customers/technicians
 *  แล้วหรือยัง
 *  onError(message) — เรียกเมื่อแลก session ล้มเหลว (ผู้ใช้กดยกเลิกกลางคัน, code หมดอายุ,
 *  code ถูกใช้ไปแล้ว ฯลฯ) */
export function registerLineAuthListener(
  appType: AppType,
  onSuccess: (userId: string, claims: { name?: string; email?: string; picture?: string }) => void,
  onError: (message: string) => void
): () => void {
  let cancelled = false;
  const scheme = APP_SCHEMES[appType];

  App.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.startsWith(scheme)) return; // deep link อื่นที่ไม่เกี่ยวกับ LINE login ให้ปล่อยผ่าน

    try {
      await Browser.close();
    } catch {
      // เบราว์เซอร์อาจถูกปิดไปแล้วเองโดยระบบ ไม่เป็นปัญหา ข้ามไปได้เลย
    }

    try {
      const parsedUrl = new URL(url);
      const handoffCode = parsedUrl.searchParams.get('handoff_code');
      const oauthError = parsedUrl.searchParams.get('error');
      if (oauthError) throw new Error(oauthError);
      if (!handoffCode) throw new Error('ไม่พบรหัสเข้าสู่ระบบจาก LINE ใน URL ที่ได้รับ กรุณาลองใหม่อีกครั้ง');

      // แลก handoff_code เป็น access/refresh token จริงผ่าน Edge Function line-auth-exchange
      const { data, error } = await supabase.functions.invoke('line-auth-exchange', {
        body: { code: handoffCode },
      });
      if (error) throw error;
      if (!data?.access_token || !data?.refresh_token) {
        throw new Error(data?.error || 'แลกรหัสเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }

      // ตั้งค่า session จริงให้ supabase-js client ของแอป (เทียบเท่ากับ exchangeCodeForSession เดิม)
      const { data: sessionData, error: setSessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setSessionErr || !sessionData.session) {
        throw new Error(setSessionErr?.message || 'ตั้งค่า session ไม่สำเร็จ');
      }
      if (cancelled) return;

      onSuccess(sessionData.session.user.id, {
        name: data.claims?.name,
        email: data.claims?.email,
        picture: data.claims?.picture,
      });
    } catch (err: any) {
      if (!cancelled) onError(err?.message || 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ');
    }
  }).then((handle) => {
    if (cancelled) {
      handle.remove();
    } else {
      listenerHandle = handle;
    }
  });

  return () => {
    cancelled = true;
    if (listenerHandle) {
      listenerHandle.remove();
      listenerHandle = null;
    }
  };
}