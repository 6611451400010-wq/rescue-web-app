import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// เพิ่ม auth options สำหรับรองรับ LINE Login (OAuth) ในแอป Capacitor:
// - flowType: 'pkce'        → จำเป็นสำหรับแอปมือถือที่ไม่มี server-side secret
//                             (implicit flow แบบเดิมไม่ปลอดภัยพอและ Supabase แนะนำ
//                             PKCE สำหรับ native app โดยเฉพาะ)
// - detectSessionInUrl: false → ปิดการพยายาม parse session จาก URL อัตโนมัติ เพราะใน
//                             WebView ของ Capacitor ไม่มี URL bar แบบเบราว์เซอร์ปกติ
//                             เราจะจัดการ callback เองผ่าน deep link ใน lib/lineAuth.ts
//                             (exchangeCodeForSession) แทน — ถ้าเปิดค่านี้ไว้จะชนกันได้
// - persistSession / autoRefreshToken → คงพฤติกรรมเดิม (ล็อกอินอีเมล/รหัสผ่านที่ทำงาน
//                             อยู่แล้วไม่ได้รับผลกระทบจากการเพิ่ม option พวกนี้)
//
// หมายเหตุ (แก้บั๊ก): เดิม config ชุดนี้เขียนไว้ถูกที่คอมเมนต์ แต่ดันอยู่คนละไฟล์กับ
// client ตัวที่ทุกไฟล์ import จริง (@/lib/supabaseClient) ทำให้ flow LINE Login ผ่าน
// Capacitor ใช้ client ที่ไม่มี PKCE/detectSessionInUrl มาตลอด — ย้ายมารวมไว้ที่นี่แล้ว
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});