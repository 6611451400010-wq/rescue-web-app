// ============================================================================
// lib/dtc-api.ts
// ----------------------------------------------------------------------------
// แทนที่ dtc-shared.txt เดิม (ซึ่งเก็บข้อมูลใน localStorage และไม่มีแอปไหน
// ใช้งานจริงเป็นแหล่งข้อมูลหลัก) ไฟล์นี้คือ shared layer จริง — ทั้ง n3
// (ลูกค้า) และ t3 (ช่าง) import จากไฟล์นี้ไฟล์เดียว แทนที่จะเขียน
// supabase.from('jobs')... กระจายกันคนละที่เหมือนเดิม
//
// ทุกฟังก์ชันเขียนข้อมูล (create/accept/advance/cancel) เรียกผ่าน RPC ที่อยู่ใน
// supabase/migrations/0002-0004*.sql เท่านั้น ไม่มีการ .insert()/.update() ตรง
// เข้าตารางอีกต่อไป เพราะ RLS ปิดสิทธิ์เขียนตรงไว้แล้ว (ดู 0001_lock_down_rls.sql)
//
// วิธี migrate จากของเดิม:
//  - n3.txt: handleConfirmTowingBooking() เปลี่ยนจาก supabase.from('jobs').insert
//    เป็น createJob({...}) ด้านล่าง
//  - t3.txt: acceptJob() เปลี่ยนเป็น acceptJob(jobId, techId), advanceJob()
//    เปลี่ยนเป็น advanceJobStatus(jobId, nextStatus), setTechStatus/upsertTech
//    เปลี่ยนเป็น setTechStatus() / upsertTechProfile() ด้านล่าง (ชื่อคงเดิม
//    เจตนาให้ diff ฝั่ง UI น้อยที่สุด)
// ============================================================================

import { supabase } from '@/lib/supabaseClient';

export type TechStatus = 'online' | 'offline' | 'break' | 'working';

export type JobStatus =
  | 'pending'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'loading'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export interface TowJob {
  id: string;
  status: JobStatus;
  techId: string | null;
  customerName: string;
  customerPhone: string;
  carBrand: string;
  carModel: string;
  plateNumber: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  distanceKm: number;
  towType: string;
  price: number;
  createdAt: number;
  updatedAt: number;
  // ข้อมูล snapshot ของช่างที่รับงาน (server เขียนให้ตอน accept_job() — ดู 0003_accept_job_rpc.sql)
  assignedTechId: string | null;
  assignedTechName: string | null;
  assignedTechPhone: string | null;
  assignedTechPlate: string | null;
  assignedTechRating: number | null;
  assignedTechJobs: number | null;
}

export interface TechnicianProfile {
  id: string;
  name: string;
  phone: string;
  plateNumber: string;
  rating: number;
  jobsDone: number;
  status: TechStatus;
}

// เดิมไฟล์นี้เคยเป็นชื่อ mapDbRowToTowJob ในเฉพาะ t3.txt — ย้ายมาไว้กลาง
// เพื่อให้ n3 และ t3 map ข้อมูลจากแถวเดียวกันให้หน้าตาตรงกันเป๊ะ
function mapDbRowToTowJob(row: any): TowJob {
  return {
    id: row.id,
    status: row.status,
    techId: row.assigned_tech_id ?? null,
    customerName: row.customer_name ?? '',
    customerPhone: row.customer_phone ?? '',
    carBrand: row.car_brand ?? '',
    carModel: row.car_model ?? '',
    plateNumber: row.car_plate ?? '',
    pickupAddress: row.location_text ?? '',
    pickupLat: row.location_lat ?? null,
    pickupLng: row.location_lng ?? null,
    distanceKm: row.distance_km ?? 0,
    towType: row.tow_type ?? '',
    price: row.price ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    assignedTechId: row.assigned_tech_id ?? null,
    assignedTechName: row.assigned_tech_name ?? null,
    assignedTechPhone: row.assigned_tech_phone ?? null,
    assignedTechPlate: row.assigned_tech_plate ?? null,
    assignedTechRating: row.assigned_tech_rating ?? null,
    assignedTechJobs: row.assigned_tech_jobs ?? null,
  };
}

// ------------------------------- Jobs --------------------------------------

/** เรียกจาก n3.txt ตอนกด "ยืนยันเรียกช่างทันที" — ราคาคำนวณฝั่ง server เสมอ */
export async function createJob(input: {
  customerName: string;
  customerPhone: string;
  carBrand: string;
  carModel: string;
  carPlate: string;
  issueType: string;
  towType: string;
  carCategory: string;
  locationLat: number;
  locationLng: number;
  locationText: string;
  nearestGarage: string;
  garageLat: number;
  garageLng: number;
  distanceKm: number;
}): Promise<TowJob> {
  const { data, error } = await supabase.rpc('create_job_priced', {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_car_brand: input.carBrand,
    p_car_model: input.carModel,
    p_car_plate: input.carPlate,
    p_issue_type: input.issueType,
    p_tow_type: input.towType,
    p_car_category: input.carCategory,
    p_location_lat: input.locationLat,
    p_location_lng: input.locationLng,
    p_location_text: input.locationText,
    p_nearest_garage: input.nearestGarage,
    p_garage_lat: input.garageLat,
    p_garage_lng: input.garageLng,
    p_distance_km: input.distanceKm,
  });
  if (error) throw error;
  return mapDbRowToTowJob(data);
}

/** เรียกจาก t3.txt ตอนช่างกดรับงาน — ไม่ต้องส่งข้อมูลช่างเอง RPC ไปดึงจากตาราง technicians ให้ */
export async function acceptJob(jobId: string, techId: string): Promise<TowJob> {
  const { data, error } = await supabase.rpc('accept_job', {
    p_job_id: jobId,
    p_tech_id: techId,
  });
  if (error) throw error;
  return mapDbRowToTowJob(data);
}

/** เรียกจาก t3.txt ตอนกดปุ่มเปลี่ยนสถานะงาน (ออกเดินทาง/ถึงจุดหมาย/ฯลฯ) */
export async function advanceJobStatus(jobId: string, newStatus: JobStatus): Promise<TowJob> {
  const { data, error } = await supabase.rpc('advance_job_status', {
    p_job_id: jobId,
    p_new_status: newStatus,
  });
  if (error) throw error;
  return mapDbRowToTowJob(data);
}

/** เรียกจาก n3.txt ตอนลูกค้ายกเลิก (ทำได้เฉพาะตอนยังไม่มีช่างเริ่มงาน) */
export async function cancelJob(jobId: string): Promise<TowJob> {
  const { data, error } = await supabase.rpc('advance_job_status', {
    p_job_id: jobId,
    p_new_status: 'cancelled',
  });
  if (error) throw error;
  return mapDbRowToTowJob(data);
}

export async function getJob(jobId: string): Promise<TowJob | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw error;
  return data ? mapDbRowToTowJob(data) : null;
}

export async function listPendingAndOwnJobs(techId: string): Promise<TowJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .or(`status.eq.pending,assigned_tech_id.eq.${techId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapDbRowToTowJob);
}

/** subscribe งานเดี่ยว (ใช้ฝั่งลูกค้า ดูงานของตัวเอง) */
export function subscribeJob(jobId: string, callback: (job: TowJob) => void): () => void {
  const channel = supabase
    .channel(`job_${jobId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
      (payload) => callback(mapDbRowToTowJob(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** subscribe งานทั้งหมด (ใช้ฝั่งช่าง ดูงานใหม่ที่เข้ามา) */
export function subscribeAllJobs(callback: (job: TowJob, event: 'INSERT' | 'UPDATE') => void): () => void {
  const channel = supabase
    .channel('realtime_jobs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (p) =>
      callback(mapDbRowToTowJob(p.new), 'INSERT')
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, (p) =>
      callback(mapDbRowToTowJob(p.new), 'UPDATE')
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// --------------------------- Technicians ------------------------------------

/** เรียกจาก t3.txt ตอนโหลด/บันทึกโปรไฟล์ช่าง — jobs_done และ rating ไม่รับค่าจาก client อีกต่อไป */
export async function upsertTechProfile(input: {
  id: string;
  name: string;
  phone: string;
  plateNumber: string;
}): Promise<TechnicianProfile> {
  const { data, error } = await supabase.rpc('upsert_tech_profile', {
    p_tech_id: input.id,
    p_name: input.name,
    p_phone: input.phone,
    p_plate_number: input.plateNumber,
  });
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    plateNumber: data.plate_number,
    rating: data.rating,
    jobsDone: data.jobs_done,
    status: data.status,
  };
}

export async function setTechStatus(techId: string, status: TechStatus): Promise<void> {
  const { error } = await supabase.rpc('set_tech_status', { p_tech_id: techId, p_status: status });
  if (error) throw error;
}

export async function updateTechLocation(techId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.rpc('update_tech_location', {
    p_tech_id: techId,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
}

export function subscribeTechStatus(techId: string, callback: (tech: Partial<TechnicianProfile>) => void): () => void {
  const channel = supabase
    .channel(`tech_status_${techId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'technicians', filter: `id=eq.${techId}` },
      (payload) => {
        const row: any = payload.new;
        callback({
          id: row.id,
          name: row.name,
          phone: row.phone,
          plateNumber: row.plate_number,
          rating: row.rating,
          jobsDone: row.jobs_done,
          status: row.status,
        });
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
