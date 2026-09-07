-- ตารางเก็บ session ชั่วคราว (one-time code) สำหรับส่งมอบ token จาก
-- line-auth-callback Edge Function ไปยังแอป โดยไม่ส่ง access/refresh token
-- ผ่าน URL โดยตรง (ป้องกันหลุดผ่าน browser history / deep link log)
--
-- อายุสั้นมาก (ตั้งใจ 2 นาที) และใช้ได้ครั้งเดียว (used = true หลังแลกสำเร็จ)
create table if not exists public.line_auth_handoff (
  code text primary key,
  access_token text not null,
  refresh_token text not null,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes')
);

-- เปิด RLS แต่ "ไม่สร้าง policy ใด ๆ" เลย — ผลคือ anon/authenticated
-- (ผ่าน PostgREST/Supabase client ปกติ) จะเข้าถึงตารางนี้ไม่ได้เด็ดขาด
-- มีแต่ service role (ที่ Edge Function ใช้) เท่านั้นที่ bypass RLS ได้
alter table public.line_auth_handoff enable row level security;

-- index ช่วยให้ query/cleanup แถวที่หมดอายุเร็วขึ้น
create index if not exists idx_line_auth_handoff_expires_at
  on public.line_auth_handoff (expires_at);