-- ตารางแมป LINE user (sub จาก ID token) ↔ Supabase auth user แบบถาวร
-- จำเป็นเพราะผู้ใช้ LINE ส่วนใหญ่ไม่มีอีเมล (LINE Login ยัง Unapplied สำหรับ
-- Email address permission) จึงใช้อีเมลเป็นตัวระบุตัวตนไม่ได้ ต้องผูกกับ line_sub แทน
create table if not exists public.line_users (
  line_sub text primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_line_users_auth_user_id
  on public.line_users (auth_user_id);

alter table public.line_users enable row level security;
-- ไม่สร้าง policy ใด ๆ — เข้าถึงได้เฉพาะ service role (Edge Function) เท่านั้น

-- เพิ่มคอลัมน์เก็บ claims (name/email/picture) ลงใน line_auth_handoff ที่มีอยู่แล้ว
-- เพื่อให้ line-auth-exchange ส่งข้อมูลนี้กลับไปให้แอปพร้อมกับ token ในการแลกครั้งเดียว
-- โดยไม่ต้องให้แอปยิง query แยกไปถามอีกรอบ
alter table public.line_auth_handoff
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists claims jsonb not null default '{}'::jsonb;