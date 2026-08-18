import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client สำหรับเรียกใช้จากหน้า Frontend (ทั้งฝั่ง N3 และ T3)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);