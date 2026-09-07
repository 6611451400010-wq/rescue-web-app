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
  requiredSpecialty: string;
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
  issueType: string;
  // ปลายทางอู่ที่ระบบจับคู่ให้ตอนสร้างงาน — เดิมส่งเข้า create_job_priced() แล้วแต่ไม่เคย map
  // กลับออกมาให้ฝั่งช่างเห็นเลย (worker-page.tsx เลยส่ง garagePos={null} เข้าแผนที่ตลอด)
  nearestGarage: string;
  garageLat: number | null;
  garageLng: number | null;
  // เพิ่มสำหรับระบบเสนองานให้ช่างใกล้สุดก่อน (ดู 0012_nearest_tech_offer_dispatch.sql)
  // offeredTechId: ช่างที่ระบบกำลังเสนองานนี้ให้อยู่ตอนนี้ (null = ยังไม่มี/fallback broadcast
  // ให้ทุกคนที่ specialty ตรงเห็น) offerExpiresAt: เวลาที่ offer นี้จะหมดอายุ ถ้าช่างไม่ตอบ
  // ภายในเวลานี้ ระบบจะเสนอให้ช่างใกล้สุดคนถัดไปอัตโนมัติ
  offeredTechId: string | null;
  offerExpiresAt: number | null;
}

export interface TechnicianProfile {
  id: string;
  name: string;
  phone: string;
  plateNumber: string;
  rating: number;
  jobsDone: number;
  status: TechStatus;
  /** ประเภทงานที่ช่างคนนี้รับได้ เช่น ['tow', 'jump_start', 'tire_change'] —
   *  ใช้แมทช์กับ requiredSpecialty ของงาน (ดู accept_job RPC) */
  specialties: string[];
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
    requiredSpecialty: row.required_specialty ?? 'tow',
    price: row.price ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    assignedTechId: row.assigned_tech_id ?? null,
    assignedTechName: row.assigned_tech_name ?? null,
    assignedTechPhone: row.assigned_tech_phone ?? null,
    assignedTechPlate: row.assigned_tech_plate ?? null,
    assignedTechRating: row.assigned_tech_rating ?? null,
    assignedTechJobs: row.assigned_tech_jobs ?? null,
    issueType: row.issue_type ?? '',
    nearestGarage: row.nearest_garage ?? '',
    garageLat: row.garage_lat ?? null,
    garageLng: row.garage_lng ?? null,
    offeredTechId: row.offered_tech_id ?? null,
    offerExpiresAt: row.offer_expires_at ? new Date(row.offer_expires_at).getTime() : null,
  };
}

// ----------------------------- Routing --------------------------------------

/** จุดเลี้ยว/maneuver หนึ่งจุดตามเส้นทาง (มาจาก OSRM steps หรือ ORS steps ที่ Edge Function
 *  compute-route แปลงให้เป็นรูปแบบกลางนี้แล้ว) ใช้ทำป้ายบอกเลี้ยวสไตล์ Google Maps ฝั่ง
 *  worker.tsx (FullScreenNav) — ดูฟังก์ชัน maneuverPhrase()/ManeuverArrow ที่นั่น
 *
 *  หมายเหตุความแม่นยำ: ฝั่ง ORS ใช้รหัสตัวเลข (type: 0-13) แทนชื่อ maneuver ที่ Edge
 *  Function map มาเป็น modifier พวกนี้ตามตารางในเอกสาร ORS — ยังไม่ได้ verify กับ response
 *  จริง 100% ต่างจากฝั่ง OSRM ที่ maneuver.type/modifier เป็น string ตรงตาม spec ชัดเจนกว่า
 *  ถ้าเจอป้ายเลี้ยวผิดทิศบ่อยๆ ให้สงสัย mapping ฝั่ง ORS ก่อน */
export interface RouteStep {
  /** ระยะทาง (เมตร) ของช่วงถนนนี้ ณ ตอนคำนวณเส้นทาง — ใช้เป็นค่าเริ่มต้นก่อนช่างขยับ
   *  ฝั่ง UI ควรคำนวณระยะสดจากตำแหน่งช่างจริงไปยัง location แทนถ้าเป็นไปได้ (แม่นกว่า) */
  distanceMeters: number;
  /** ชื่อถนน/ทางที่ step นี้วิ่งอยู่ อาจเป็นค่าว่างถ้า OSRM/ORS ไม่มีชื่อให้ (เช่น ถนนไม่มีชื่อ) */
  name: string;
  maneuverType:
    | 'depart'
    | 'turn'
    | 'continue'
    | 'merge'
    | 'roundabout'
    | 'arrive'
    | 'fork'
    | 'ramp'
    | 'end_of_road'
    | 'other';
  modifier:
    | 'left'
    | 'right'
    | 'slight_left'
    | 'slight_right'
    | 'sharp_left'
    | 'sharp_right'
    | 'straight'
    | 'uturn'
    | null;
  /** พิกัดจุดที่ต้องทำ maneuver นี้ (จุดเลี้ยว/เข้าวงเวียน/ถึงจุดหมาย ฯลฯ) */
  location: { lat: number; lng: number };
}

/** เรียก Edge Function compute-route (OSRM) เพื่อเอาระยะทาง/เวลาเดินทางจริงตามถนน
 *  แทนการคำนวณเส้นตรง (Haversine) — ใช้ทั้งตอนคิดราคา (จุดเกิดเหตุ -> อู่) และตอนคำนวณ
 *  ETA แบบสด (ตำแหน่งช่าง -> จุดเกิดเหตุ) คืนค่า null ถ้าเรียกไม่สำเร็จ (เช่น OSRM ล่ม/
 *  เน็ตหลุด) ให้ผู้เรียกไป fallback เป็น Haversine เดิมเอง จะได้ไม่ทำให้ทั้งแอปพังเพราะ
 *  Edge Function เดียว */
export async function computeRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{
  distanceKm: number;
  durationMinutes: number;
  geometry: { lat: number; lng: number }[];
  steps: RouteStep[];
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke('compute-route', {
      body: { origin, destination },
    });
    if (error || data?.distanceKm == null || data?.durationMinutes == null) {
      console.error('[computeRoute] compute-route คืนค่าผิดปกติ:', error || data);
      return null;
    }
    // geometry อาจไม่มีถ้า Edge Function เวอร์ชันเก่ายังไม่รองรับ (deploy ไม่ทัน) — fallback
    // เป็น array ว่างแทนที่จะ throw เพื่อไม่ให้ ETA/ระยะทางที่ยังใช้งานได้อยู่พังไปด้วย
    const geometry = Array.isArray(data.geometry)
      ? data.geometry.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      : [];
    // steps เช่นกัน — ฟิลด์ใหม่กว่า geometry อีก อาจไม่มีเลยถ้า Edge Function ที่ deploy อยู่
    // ยังเป็นเวอร์ชันก่อนรองรับ turn-by-turn เลย fallback เป็น [] แทนการ throw เหมือนกัน
    // ฝั่ง UI (worker.tsx) ต้องรองรับ steps=[] แล้วโชว์แค่ป้ายระยะทางรวมแบบเดิมได้เสมอ
    const steps: RouteStep[] = Array.isArray(data.steps)
      ? data.steps
          .filter((s: any) => s?.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number')
          .map((s: any) => ({
            distanceMeters: Number(s.distanceMeters) || 0,
            name: typeof s.name === 'string' ? s.name : '',
            maneuverType: s.maneuverType ?? 'other',
            modifier: s.modifier ?? null,
            location: { lat: Number(s.location.lat), lng: Number(s.location.lng) },
          }))
      : [];
    return {
      distanceKm: Number(data.distanceKm),
      durationMinutes: Number(data.durationMinutes),
      geometry,
      steps,
    };
  } catch (err) {
    console.error('[computeRoute] เรียก compute-route ไม่สำเร็จ:', err);
    return null;
  }
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
  /** 'tow' = งานต้องใช้รถลาก/สไลด์ตาม towType, มิฉะนั้นเป็นรหัสช่างเฉพาะทาง เช่น
   *  'jump_start' / 'tire_change' — server ใช้ค่านี้แมทช์ช่างที่ specialties ตรงกัน
   *  (ดู accept_job RPC — ต้องเช็ค specialty ก่อนให้ช่างกดรับงานได้) */
  requiredSpecialty: string;
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
    p_required_specialty: input.requiredSpecialty,
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

  // กันเคส RPC ไม่ throw error แต่ data ที่ได้กลับมาหน้าตาไม่ตรงกับที่คาดไว้ (เช่น ไม่มี
  // id จริง หรือรูปร่างผิดจากที่ mapDbRowToTowJob คาดไว้) — เดิมโค้ดจุดนี้ยัด data เข้า
  // mapDbRowToTowJob ตรงๆ เลย ถ้า data ผิดรูปจะได้ TowJob ที่ id เป็น undefined แบบเงียบๆ
  // ไม่มี error ใดๆ โผล่มาเตือนทั้งที่จริงๆ อาจมีปัญหาอยู่ — log ค่าดิบไว้เพื่อ debug ครั้งหน้า
  // ถ้าเกิดอีก แล้ว throw error จริงแทนที่จะปล่อยผ่านให้ผู้เรียกไปเจอ id ว่างเอาเอง
  if (!data || typeof (data as any).id !== 'string') {
    console.error('[createJob] RPC create_job_priced คืนค่าที่ไม่มี id จริง — raw data:', data);
    throw new Error('create_job_priced ไม่ได้คืนงานที่มี id จริงกลับมา (ดู console สำหรับ raw response)');
  }

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

/** เรียกจาก worker-page.tsx — ทางออกฉุกเฉินให้ช่างยกเลิกงานของตัวเองตอนติดค้าง (เช่น
 *  ลูกค้าไม่แนบสลิปใหม่เลยหลังช่างปฏิเสธสลิปไปแล้ว) ใช้ได้เฉพาะก่อนขั้นยกรถ/นำส่งอู่
 *  (accepted/en_route/arrived) — RPC ฝั่ง server จะเช็คสถานะซ้ำอีกชั้นและปลดสถานะช่าง
 *  กลับเป็น 'online' ให้อัตโนมัติในทรานแซคชันเดียวกัน ดู
 *  0011_cancel_job_by_tech_rpc.sql */
export async function cancelJobByTech(jobId: string, techId: string, reason?: string): Promise<TowJob> {
  const { data, error } = await supabase.rpc('cancel_job_by_tech', {
    p_job_id: jobId,
    p_tech_id: techId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return mapDbRowToTowJob(data);
}

export async function getJob(jobId: string): Promise<TowJob | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  if (error) throw error;
  return data ? mapDbRowToTowJob(data) : null;
}

/** techSpecialties: ประเภทงานที่ช่างคนนี้รับได้ — งาน pending ที่ required_specialty ไม่ตรงจะถูกกรองออก
 *  ไม่กรองงานที่ตัวเองรับไปแล้ว (assigned_tech_id ตรงกับ techId) ให้เห็นเสมอไม่ว่า specialty จะตรงหรือไม่ */
export async function listPendingAndOwnJobs(techId: string, techSpecialties: string[] = []): Promise<TowJob[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .or(`status.eq.pending,assigned_tech_id.eq.${techId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const jobs = (data ?? []).map(mapDbRowToTowJob);
  const bySpecialty =
    techSpecialties.length === 0
      ? jobs
      : jobs.filter((j) => j.assignedTechId === techId || techSpecialties.includes(j.requiredSpecialty));

  // ซ่อนงานที่ trigger เสนอให้ช่างคนอื่นอยู่ (offer ยังไม่หมดอายุ) ออกจากลิสต์ของช่างคนนี้
  // ไปเลย — ทำให้ "เสนอทีละคนตามระยะทาง" เป็นจริง ไม่ใช่แค่ UI countdown ลวงตาเหมือนเดิม
  // (ดูคอมเมนต์หัวไฟล์ 0012_nearest_tech_offer_dispatch.sql) งานที่ offeredTechId เป็น
  // null (fallback, หาช่างใกล้สุดไม่เจอ) หรือ offer หมดอายุแล้ว ยังคงเห็นได้ตามปกติ
  const now = Date.now();
  return bySpecialty.filter((j) => {
    if (j.assignedTechId === techId) return true; // งานของตัวเองเห็นได้เสมอไม่ว่าจะ offer ให้ใคร
    if (!j.offeredTechId) return true; // fallback broadcast — ใครก็เห็นได้
    if (j.offeredTechId === techId) return true; // offer เป็นของช่างคนนี้พอดี
    if (j.offerExpiresAt && j.offerExpiresAt < now) return true; // offer หมดอายุ (รอ trigger/expire RPC มา sync)
    return false;
  });
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
  specialties: string[];
}): Promise<TechnicianProfile> {
  const { data, error } = await supabase.rpc('upsert_tech_profile', {
    p_tech_id: input.id,
    p_name: input.name,
    p_phone: input.phone,
    p_plate_number: input.plateNumber,
    p_specialties: input.specialties,
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
    specialties: data.specialties ?? [],
  };
}

/** เรียกจาก t3.txt ตอนช่างติ๊ก/ถอนติ๊กความสามารถของตัวเอง (พ่วงแบต/เปลี่ยนยาง/รถลาก ฯลฯ) */
export async function setTechSpecialties(techId: string, specialties: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_tech_specialties', {
    p_tech_id: techId,
    p_specialties: specialties,
  });
  if (error) throw error;
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

// ------------------------- Technician Registration --------------------------
// เรียกจาก worker/page.tsx ตอนช่างกรอกฟอร์มสมัครสมาชิก (หน้า t3+t4 — ชื่อ, รหัสพนักงาน,
// เบอร์โทร, อีเมล, รหัสผ่าน, เอกสารยืนยันตัวตน, เอกสารยืนยันบริษัท, OTP เบอร์โทร)
// ต้องรัน supabase/migrations/0005_tech_documents.sql ก่อน (เพิ่มคอลัมน์ employee_id /
// id_card_url / business_doc_url ในตาราง technicians, สร้าง bucket 'tech-documents',
// และสร้าง RPC register_tech_documents)

const TECH_DOCS_BUCKET = 'tech-documents';

export interface TechDocumentUploadResult {
  path: string;
  publicUrl: string;
}

/** อัปโหลดเอกสาร (บัตรประชาชน/ใบขับขี่ หรือ ใบอนุญาตธุรกิจ) ขึ้น Supabase Storage
 *  เก็บที่ path `${techId}/${docType}-${timestamp}.${ext}` กันไฟล์ทับกันเวลาอัปโหลดซ้ำ */
export async function uploadTechDocument(
  techId: string,
  file: File,
  docType: 'id_card' | 'business_doc'
): Promise<TechDocumentUploadResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${techId}/${docType}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(TECH_DOCS_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(TECH_DOCS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/** เรียกตอนกด "NEXT" ในหน้าสมัครสมาชิก — สร้างบัญชี Supabase Auth ด้วยอีเมล/รหัสผ่าน
 *  คืนค่า techId (= auth user id) ไว้ใช้ตั้ง path ไฟล์เอกสารและเรียก saveTechRegistrationDetails ต่อ */
export async function registerTechnician(input: {
  email: string;
  password: string;
}): Promise<{ techId: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  const techId = data.user?.id;
  if (!techId) throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง');
  return { techId };
}

/** บันทึกโปรไฟล์ + URL เอกสารยืนยันตัวตน/บริษัท ของช่างหลังอัปโหลดเสร็จ — เขียนผ่าน RPC เท่านั้น
 *  (ดู 0005_tech_documents.sql) สถานะบัญชีเริ่มต้นเป็น "รอตรวจสอบเอกสาร" ฝั่งแอดมิน */
export async function saveTechRegistrationDetails(input: {
  techId: string;
  fullName: string;
  employeeId: string;
  phone: string;
  idCardUrl: string;
  businessDocUrl: string;
}): Promise<void> {
  const { error } = await supabase.rpc('register_tech_documents', {
    p_tech_id: input.techId,
    p_name: input.fullName,
    p_employee_id: input.employeeId,
    p_phone: input.phone,
    p_id_card_url: input.idCardUrl,
    p_business_doc_url: input.businessDocUrl,
  });
  if (error) throw error;
}

export interface TechAuthProfile extends TechnicianProfile {
  employeeId: string | null;
  verificationStatus: 'pending' | 'approved' | 'rejected';
}

function mapDbRowToTechProfile(row: any): TechAuthProfile {
  return {
    id: row.id,
    name: row.name ?? '',
    phone: row.phone ?? '',
    plateNumber: row.plate_number ?? '',
    rating: row.rating ?? 5,
    jobsDone: row.jobs_done ?? 0,
    status: row.status ?? 'offline',
    specialties: row.specialties ?? [],
    employeeId: row.employee_id ?? null,
    verificationStatus: row.verification_status ?? 'pending',
  };
}

/** เข้าสู่ระบบด้วยอีเมล/รหัสผ่านจริงผ่าน Supabase Auth (ไม่ใช่แค่เช็คว่ากรอกครบ) แล้วดึง
 *  โปรไฟล์ช่างตัวจริงจากตาราง technicians มาคืนด้วย — ถ้าอีเมล/รหัสผ่านผิด หรือยังไม่เคย
 *  สมัครสมาชิกให้เสร็จ (ไม่มีแถวใน technicians) ฟังก์ชันนี้จะ throw ให้ฝั่ง UI ดักไปแสดง error
 *  แทนที่จะปล่อยให้เข้าระบบได้เฉย ๆ เหมือนโค้ดเดิม */
export async function signInTechnician(email: string, password: string): Promise<TechAuthProfile> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const techId = authData.user?.id;
  if (!techId) throw new Error('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');

  const { data: profileRow, error: profileError } = await supabase
    .from('technicians')
    .select('*')
    .eq('id', techId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profileRow) {
    // บัญชี auth มีจริง แต่ยังไม่มีแถวโปรไฟล์ช่าง (เช่น สมัครไม่จบ อัปโหลดเอกสารไม่สำเร็จ)
    throw new Error('ไม่พบข้อมูลโปรไฟล์ช่าง กรุณาสมัครสมาชิกให้เสร็จสมบูรณ์ก่อนเข้าสู่ระบบ');
  }
  return mapDbRowToTechProfile(profileRow);
}

/** ออกจากระบบ — เคลียร์ session ของ Supabase Auth จริง ไม่ใช่แค่ซ่อนหน้าจอฝั่ง client */
export async function signOutTechnician(): Promise<void> {
  const { error } = await supabase.auth.signOut();
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

// ------------------------------- Chat & Reviews -------------------------------
// เดิม user-page.tsx และ worker-page.tsx ทั้งคู่ insert เข้า chat_messages ตรง ๆ และ
// user-page.tsx ยัง .update() ตาราง technicians (คะแนน) + .insert() ตาราง reviews ตรง ๆ
// ด้วย — ฝั่งลูกค้าเป็น anon role ล้วน (ไม่มี Supabase Auth session) ปัญหาเดียวกับที่
// payments เจอมาก่อน: ถูก RLS บล็อกเงียบ ๆ (error แค่ console.error ไม่ throw ไม่ขึ้น
// toast) แชทฝั่งลูกค้าและรีวิว/คะแนนช่างจึงมีโอกาสสูงที่ไม่เคยถูกบันทึกจริงเลย
// ย้ายมาเป็น RPC (SECURITY DEFINER) ทั้งคู่ ให้ทั้งฝั่งลูกค้าและฝั่งช่างเรียกผ่านฟังก์ชัน
// เดียวกันนี้เสมอ แทนการ insert/update ตรงเข้าตาราง — ดู
// supabase/migrations/0009_chat_review_rpc_and_customer_auth.sql

export type ChatSender = 'customer' | 'tech';

export interface ChatMessageRow {
  id: string;
  jobId: string;
  sender: ChatSender;
  text: string;
  createdAt: number;
}

function mapDbRowToChatMessage(row: any): ChatMessageRow {
  return {
    id: row.id,
    jobId: row.job_id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

/** ส่งข้อความแชท — เรียกจากทั้ง user-page.tsx (sender: 'customer') และ worker-page.tsx
 *  (sender: 'tech', รวมถึงข้อความระบบอัตโนมัติ) แทนการ .insert() ตรงเข้า chat_messages */
export async function sendChatMessage(input: {
  jobId: string;
  sender: ChatSender;
  text: string;
}): Promise<ChatMessageRow> {
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_job_id: input.jobId,
    p_sender: input.sender,
    p_text: input.text,
  });
  if (error) throw error;
  return mapDbRowToChatMessage(data);
}

/** ให้คะแนน + รีวิวช่างหลังจบงาน — server คำนวณ weighted average rating เองและอัปเดต
 *  technicians.rating + บันทึก reviews ในทรานแซคชันเดียว แทนที่ client จะคำนวณเองแล้ว
 *  ยิง .update()/.insert() ตรงสองครั้งเหมือนเดิม (ซึ่งฝั่งลูกค้าโดน RLS บล็อกอยู่แล้ว) */
export async function submitJobReview(input: {
  jobId: string;
  techId: string;
  rating: number;
  text: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_job_review', {
    p_job_id: input.jobId,
    p_tech_id: input.techId,
    p_rating: input.rating,
    p_text: input.text,
  });
  if (error) throw error;
}

// --------------------------- Customer Registration ----------------------------
// เดิม user-page.tsx เก็บบัญชีลูกค้า (email+password เป็น plaintext) ไว้ใน
// localStorage ('dtc_customer_accounts') ล้วน ๆ ไม่มี session จริงฝั่งเซิร์ฟเวอร์เลย —
// เปลี่ยนมาใช้ Supabase Auth แบบเดียวกับฝั่งช่าง (registerTechnician/signInTechnician
// ด้านล่าง) รหัสผ่านจะไม่ถูกเก็บเป็น plaintext อีกต่อไป และลูกค้าจะมี session จริง

export interface CustomerProfile {
  id: string;
  name: string;
  surname: string;
  phone: string;
  email: string;
}

function mapDbRowToCustomerProfile(row: any): CustomerProfile {
  return {
    id: row.id,
    name: row.name ?? '',
    surname: row.surname ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
  };
}

/** สมัครสมาชิกลูกค้า — สร้างบัญชี Supabase Auth ด้วยอีเมล/รหัสผ่านจริง แล้วบันทึกโปรไฟล์
 *  (ชื่อ/นามสกุล/เบอร์โทร) ผ่าน RPC เช่นเดียวกับ saveTechRegistrationDetails() ของฝั่งช่าง */
export async function registerCustomer(input: {
  name: string;
  surname: string;
  phone: string;
  email: string;
  password: string;
}): Promise<CustomerProfile> {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (authError) throw authError;
  const customerId = authData.user?.id;
  if (!customerId) throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง');

  const { data, error } = await supabase.rpc('register_customer_profile', {
    p_customer_id: customerId,
    p_name: input.name,
    p_surname: input.surname,
    p_phone: input.phone,
    p_email: input.email,
  });
  if (error) throw error;
  return mapDbRowToCustomerProfile(data);
}

/** เข้าสู่ระบบลูกค้าด้วยอีเมล/รหัสผ่านจริงผ่าน Supabase Auth แทนการเทียบ
 *  email/password กับ localStorage เหมือนเดิม */
export async function signInCustomer(email: string, password: string): Promise<CustomerProfile> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const customerId = authData.user?.id;
  if (!customerId) throw new Error('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');

  const { data: profileRow, error: profileError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profileRow) {
    throw new Error('ไม่พบข้อมูลโปรไฟล์ลูกค้า กรุณาสมัครสมาชิกให้เสร็จสมบูรณ์ก่อนเข้าสู่ระบบ');
  }
  return mapDbRowToCustomerProfile(profileRow);
}

/** ออกจากระบบลูกค้า — เคลียร์ session ของ Supabase Auth จริง */
export async function signOutCustomer(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ------------------------------- Payments ------------------------------------
// ฝั่งลูกค้า (user-page.tsx) ไม่ได้ล็อกอินผ่าน Supabase Auth เลย (เป็น anon role ล้วน)
// การ .insert() ตรงเข้าตาราง payments เลยโดน RLS บล็อกเงียบ ๆ ต้อง insert ผ่าน RPC
// (SECURITY DEFINER) แทน เหมือนแพทเทิร์นเดียวกับ createJob() ด้านบน
// ดู supabase/migrations/0008_payments_rpc_and_tech_status_counts.sql

export type PaymentMethod = 'cash' | 'credit' | 'promptpay';

/** บันทึกวิธีชำระเงินของงาน — เรียกได้ทั้งตอนเลือกวิธีจ่ายตอนจอง (ไม่มีสลิป) และตอน
 *  แนบสลิปโอนเงิน (มี slipUrl) ใช้ RPC เดียวกันทั้งสองกรณี */
export async function recordJobPayment(input: {
  jobId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  slipUrl?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('record_job_payment', {
    p_job_id: input.jobId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_slip_url: input.slipUrl ?? null,
  });
  if (error) throw error;
}

/** เรียกจาก worker-page.tsx ตอนช่างกดยืนยันว่าเช็คสลิป/ได้รับเงินแล้ว — เดิม .update()
 *  ตรงเข้าตาราง payments ซึ่งขัดกับที่คอมเมนต์หัวไฟล์นี้บอกไว้เองว่า RLS ปิดสิทธิ์เขียน
 *  ตรงหมดแล้ว (ต้องผ่าน RPC เท่านั้น) แม้ช่างจะ login จริงแล้วก็ตาม เปลี่ยนเป็น RPC ให้
 *  สอดคล้องกับ record_job_payment() ด้านบน — ดู 0009_chat_review_rpc_and_customer_auth.sql
 *  (ต้องเพิ่ม verify_job_payment RPC ในไฟล์นั้น หรือ migration ถัดไป) */
export async function verifyJobPayment(paymentId: string, verifiedByName: string): Promise<void> {
  const { error } = await supabase.rpc('verify_job_payment', {
    p_payment_id: paymentId,
    p_verified_by: verifiedByName,
  });
  if (error) throw error;
}

/** เรียกจาก worker-page.tsx ตอนช่างกดปฏิเสธสลิป/การชำระเงิน — เดิม worker-page.tsx เขียน
 *  .update() ตรงเข้าตาราง payments ซึ่งโดน RLS บล็อกเงียบๆ (0 rows affected ไม่มี error)
 *  ทำให้ status ไม่เคยเปลี่ยนเป็น 'rejected' จริงในฐานข้อมูล แบนเนอร์แนบสลิปใหม่ฝั่งลูกค้าเลย
 *  ไม่เคยขึ้น (เงื่อนไข status==='rejected' ไม่เคยเป็นจริง) เปลี่ยนเป็น RPC ให้สอดคล้องกับ
 *  verifyJobPayment() ด้านบน — ดู 0010_verify_reject_job_payment_rpc.sql */
export async function rejectJobPayment(paymentId: string, verifiedByName: string): Promise<void> {
  const { error } = await supabase.rpc('reject_job_payment', {
    p_payment_id: paymentId,
    p_verified_by: verifiedByName,
  });
  if (error) throw error;
}

// --------------------------- Technician Earnings Summary ----------------------
// สำหรับการ์ด "ยอดรายได้ของฉัน" ในหน้าโปรไฟล์ช่าง — เรียก RPC get_tech_earnings_summary ที่
// เพิ่งสร้างใหม่ (คำนวณยอดรวมจากตาราง jobs/payments จริงฝั่ง server เดียวกับที่ระบบใช้จริง
// ไม่ต้องมานับซ้ำเองฝั่ง client ให้เสี่ยงตัวเลขไม่ตรงกับฝั่งแอดมิน)

export interface TechEarningsSummary {
  totalEarnings: number;
  todayEarnings: number;
  monthEarnings: number;
  completedJobs: number;
}

export async function getMyEarnings(techId: string): Promise<TechEarningsSummary> {
  const { data, error } = await supabase.rpc('get_tech_earnings_summary', {
    p_tech_id: techId,
  });
  if (error) throw error;

  // RPC อาจคืนค่ามาเป็น array (RETURNS TABLE ได้แถวเดียว) หรือ object เดี่ยวๆ (RETURNS
  // composite type เดี่ยว) ก็ได้ขึ้นกับนิยามฝั่ง SQL — รองรับไว้ทั้งสองแบบกันเหนียว
  const row: any = Array.isArray(data) ? data[0] : data;

  return {
    totalEarnings: Number(row?.total_earnings) || 0,
    todayEarnings: Number(row?.today_earnings) || 0,
    monthEarnings: Number(row?.month_earnings) || 0,
    completedJobs: Number(row?.completed_jobs) || 0,
  };
}

// --------------------------- Technician Status Counts -------------------------
// สำหรับแดชบอร์ดหน้าแรกฝั่งลูกค้า ("ช่างออนไลน์ X คน" ฯลฯ) — เดิมเป็นเลขปลอมคงที่
// (useState({ online: 18, ... }) ไม่เคยมี setter เรียกเลย) เปลี่ยนมาดึงของจริงผ่าน RPC
// นี้แทน (คืนแค่ตัวเลขสรุป ไม่หลุดข้อมูลส่วนตัวช่างรายคนออกไปให้ฝั่งลูกค้าเห็น)

export interface TechStatusCounts {
  online: number;
  working: number;
  breakTime: number;
  offline: number;
}

export async function getTechStatusCounts(): Promise<TechStatusCounts> {
  const { data, error } = await supabase.rpc('get_tech_status_counts');
  if (error) throw error;
  const counts: TechStatusCounts = { online: 0, working: 0, breakTime: 0, offline: 0 };
  (data ?? []).forEach((row: any) => {
    if (row.status === 'online') counts.online = Number(row.tech_count) || 0;
    else if (row.status === 'working') counts.working = Number(row.tech_count) || 0;
    else if (row.status === 'break') counts.breakTime = Number(row.tech_count) || 0;
    else if (row.status === 'offline') counts.offline = Number(row.tech_count) || 0;
  });
  return counts;
}

/** ดักฟังการเปลี่ยนสถานะของช่างคนไหนก็ได้ (ทั้งตาราง) แล้วสั่งให้ผู้เรียกไป refetch ตัวเลขสรุปใหม่
 *  ไม่ได้ push ตัวเลขมาให้ตรง ๆ เพราะ Realtime payload เป็นแค่ 1 แถวที่เปลี่ยน คำนวณผลรวมใหม่
 *  ทั้งหมดฝั่ง client เองไม่แม่นเท่าให้ DB นับใหม่ให้ */
export function subscribeTechStatusCounts(onChange: () => void): () => void {
  const channel = supabase
    .channel('tech_status_counts_watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, () => onChange())
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ------------------------------- LINE OAuth (Supabase custom:line) -----------
// เพิ่มสำหรับฟีเจอร์ล็อกอินด้วย LINE — ใช้ Supabase custom OIDC provider (custom:line)
// ที่ตั้งค่าไว้แล้วในหน้า Auth Providers ของ Supabase Dashboard สร้าง auth.users ให้
// อัตโนมัติตอน OAuth สำเร็จ (ผ่าน lib/lineAuth.ts) ฟังก์ชันด้านล่างนี้ใช้ "หลัง" จากที่มี
// session ของ Supabase Auth แล้วเท่านั้น เพื่อเช็คว่าผู้ใช้คนนี้เคยกรอกโปรไฟล์ (ตาราง
// customers / technicians) ไว้หรือยัง — ถ้ายัง ต้องพาไปหน้า "กรอกข้อมูลให้ครบ" ก่อน เพราะ
// LINE ID token ให้แค่ชื่อ/รูป/อีเมล(ถ้าเปิดสิทธิ์) ไม่มีเบอร์โทร/ทะเบียนรถ/เอกสารยืนยันตัวตน

/** เช็คว่า auth user (จาก LINE OAuth) นี้เคยมีแถวโปรไฟล์ลูกค้าอยู่แล้วหรือยัง
 *  คืน null ถ้ายังไม่เคยกรอกโปรไฟล์ (ต้องพาไปหน้ากรอกข้อมูลเพิ่ม) */
export async function getCustomerProfileIfExists(customerId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbRowToCustomerProfile(data) : null;
}

/** บันทึกโปรไฟล์ลูกค้าหลังล็อกอิน LINE สำเร็จครั้งแรก — ต่างจาก registerCustomer() ตรงที่
 *  "ไม่" เรียก supabase.auth.signUp() ซ้ำ เพราะมี auth session จาก LINE OAuth อยู่แล้ว
 *  เรียก RPC เดียวกัน (register_customer_profile) ตรงๆ ด้วย customerId ของ session ปัจจุบัน */
export async function completeCustomerProfileAfterOAuth(input: {
  customerId: string;
  name: string;
  surname: string;
  phone: string;
  email: string;
}): Promise<CustomerProfile> {
  const { data, error } = await supabase.rpc('register_customer_profile', {
    p_customer_id: input.customerId,
    p_name: input.name,
    p_surname: input.surname,
    p_phone: input.phone,
    p_email: input.email,
  });
  if (error) throw error;
  return mapDbRowToCustomerProfile(data);
}

/** เช็คว่า auth user (จาก LINE OAuth) นี้เคยมีแถวโปรไฟล์ช่างอยู่แล้วหรือยัง
 *  คืน null ถ้ายังไม่เคยสมัคร (ต้องพาไปหน้าสมัครสมาชิกช่าง — กรอกเบอร์/ทะเบียนรถ/แนบเอกสาร) */
export async function getTechProfileIfExists(techId: string): Promise<TechAuthProfile | null> {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('id', techId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDbRowToTechProfile(data) : null;
}

// ------------------------------- Garages -------------------------------------
// เดิมรายชื่ออู่ hardcode อยู่ในฟังก์ชัน findNearestGarage() ของ user-page.tsx ตรงๆ
// (3 แห่งคงที่ แก้ต้อง deploy โค้ดใหม่) ย้ายมาเก็บในตาราง garages + RPC นี้แทน
// ดู supabase/migrations/0011_garages_table_and_nearest_garage_rpc.sql

export interface NearestGarage {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

/** หาอู่ที่ใกล้ที่สุดจากพิกัดที่ส่งมา (ระยะเส้นตรง Haversine คำนวณฝั่ง DB) คืน null ถ้าเรียก
 *  RPC ไม่สำเร็จ (เช่น เน็ตหลุด/ตาราง garages ว่างเปล่า) — ผู้เรียกควร fallback เป็นรายชื่อ
 *  อู่สำรองในเครื่องเอง เพื่อไม่ให้ลูกค้าเรียกช่างไม่ได้เลยถ้า RPC มีปัญหาชั่วคราว */
export async function getNearestGarage(coords: { lat: number; lng: number }): Promise<NearestGarage | null> {
  try {
    const { data, error } = await supabase.rpc('get_nearest_garage', {
      p_lat: coords.lat,
      p_lng: coords.lng,
    });
    if (error) {
      console.error('[getNearestGarage] get_nearest_garage คืนค่าผิดปกติ:', error);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      lat: Number(row.lat),
      lng: Number(row.lng),
      distanceKm: Number(row.distance_km),
    };
  } catch (err) {
    console.error('[getNearestGarage] เรียก get_nearest_garage ไม่สำเร็จ:', err);
    return null;
  }
}

// --------------------------- Nearest-tech offer dispatch ---------------------
// ดู supabase/migrations/0012_nearest_tech_offer_dispatch.sql — งานใหม่จะถูกเสนอให้
// ช่าง online ที่ specialty ตรงและอยู่ใกล้จุดเกิดเหตุที่สุดก่อนโดยอัตโนมัติ (ผ่าน DB
// trigger ตอน insert) ฟังก์ชันด้านล่างนี้คือฝั่ง client ที่ต้องเรียกเพิ่มเพื่อให้ flow
// ทำงานครบวงจร (ปฏิเสธ/หมดเวลา -> ส่งต่อช่างคนถัดไป, และ preview ฝั่งลูกค้า)

/** เรียกจาก worker/page.tsx ตอนช่างกดปุ่ม "ปฏิเสธงาน" (declineJob) — ต่างจากเดิมที่แค่
 *  setDismissedJobIds ซ่อนจากเครื่องตัวเอง อันนี้แจ้ง server จริงว่าคนนี้ไม่รับ เพื่อให้ระบบ
 *  ส่งต่อให้ช่างที่ใกล้จุดเกิดเหตุที่สุดคนถัดไปทันที ไม่ต้องรอครบเวลา offer หมดอายุเอง
 *  ทำ fire-and-forget ได้ (ไม่ throw ต่อ) เพราะฝั่ง UI ซ่อนงานจากเครื่องตัวเองไปแล้วไม่ว่า
 *  call นี้จะสำเร็จหรือไม่ ผู้เรียกไม่จำเป็นต้อง await ผลลัพธ์ก่อนอัปเดต UI */
export async function declineJobOffer(jobId: string, techId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_job_offer', {
    p_job_id: jobId,
    p_tech_id: techId,
  });
  if (error) {
    console.error('[declineJobOffer] decline_job_offer คืนค่าผิดปกติ:', error);
    throw error;
  }
}

/** เรียกตอน countdown ฝั่งช่างหมดเวลาแล้วยังไม่กดรับ/ปฏิเสธ (เช่น ปิดแอปหนีเฉยๆ) — server
 *  จะเช็ค offer_expires_at จริงอีกชั้นเอง (ไม่เชื่อเวลาจาก client ตรงๆ) ก่อนส่งต่อคนถัดไป
 *  เรียกจากฝั่งไหนก็ได้ที่กำลัง watch งานนี้อยู่ (ช่างที่ถือ offer เอง หรือลูกค้าที่รอผลอยู่)
 *  เผื่อกรณีช่างที่ถือ offer ปิดแอปไปแล้วไม่มีใครเรียกให้ */
export async function expireStaleJobOffer(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('expire_stale_job_offer', { p_job_id: jobId });
  if (error) {
    console.error('[expireStaleJobOffer] expire_stale_job_offer คืนค่าผิดปกติ:', error);
    throw error;
  }
}

export interface NearbyTechPreview {
  nearbyCount: number;
  /** null ถ้าไม่มีช่างว่างในรัศมี preview เลย (ดู _nearby_preview_radius_km ในไฟล์ migration) */
  nearestDistanceKm: number | null;
}

/** เรียกจาก user/page.tsx ก่อนลูกค้ากดยืนยันเรียกช่าง — โชว์ "มีช่างว่างใกล้คุณกี่คน ใกล้สุด
 *  กี่กม." ให้อุ่นใจก่อนกด ไม่ใช่กดแล้วรอเงียบๆ ไม่รู้ว่ามีช่างแถวนั้นจริงไหม คืนค่า nearbyCount:0
 *  เสมอถ้าเรียก RPC ไม่สำเร็จ (เช่น เน็ตหลุด) แทนที่จะ throw เพราะเป็นแค่ preview ไม่ควรบล็อก
 *  การเรียกช่างจริงถ้า preview พังชั่วคราว */
export async function getNearbyTechPreview(
  coords: { lat: number; lng: number },
  specialty: string
): Promise<NearbyTechPreview> {
  try {
    const { data, error } = await supabase.rpc('get_nearby_tech_preview', {
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_specialty: specialty,
    });
    if (error) {
      console.error('[getNearbyTechPreview] get_nearby_tech_preview คืนค่าผิดปกติ:', error);
      return { nearbyCount: 0, nearestDistanceKm: null };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      nearbyCount: Number(row?.nearby_count) || 0,
      nearestDistanceKm: row?.nearest_distance_km != null ? Number(row.nearest_distance_km) : null,
    };
  } catch (err) {
    console.error('[getNearbyTechPreview] เรียก get_nearby_tech_preview ไม่สำเร็จ:', err);
    return { nearbyCount: 0, nearestDistanceKm: null };
  }
}