// ============================================================================
// DTC Shared Realtime Contract
// ----------------------------------------------------------------------------
// ไฟล์นี้คือ "จุดเชื่อมต่อกลาง" ระหว่างแอปฝั่งลูกค้า (customer app, n3.txt)
// กับแอปฝั่งช่าง (technician-dashboard.tsx) เพื่อให้ทีม Dev 2 คนแยกกันทำงานได้
// โดยไม่ต้องรอกัน แค่ทั้งคู่ import จากไฟล์นี้ไฟล์เดียว
//
// ตอนนี้ (โหมด mock/demo): ข้อมูลเก็บใน localStorage ของเบราว์เซอร์ เพื่อให้เดโมได้
// ทันทีโดยยังไม่ต้องมี backend จริง เปิด 2 แท็บ (แท็บลูกค้า + แท็บช่าง) จะเห็นงาน
// วิ่งถึงกันแบบเรียลไทม์
//
// ตอน Production: ให้เอา implementation ข้างในของแต่ละฟังก์ชันไปเปลี่ยนเป็นเรียก
// REST API / WebSocket (Socket.io, Pusher, Firebase Realtime, ฯลฯ) จริง โดยที่
// "ชื่อฟังก์ชันและ type" ยังคงเดิมทุกอย่าง ฝั่ง UI ของทั้ง 2 แอปจะไม่ต้องแก้โค้ดเลย
// นี่คือเหตุผลที่ควรแยกไฟล์นี้ออกมาเป็น shared package/lib กลางตั้งแต่แรก
// ============================================================================

export type TechStatus = 'online' | 'offline' | 'break' | 'working';

export type JobStatus =
  | 'pending'    // ลูกค้าส่งคำขอแล้ว รอช่างรับงาน
  | 'accepted'   // ช่างกดรับงานแล้ว
  | 'en_route'   // ช่างกำลังเดินทางไปหาลูกค้า
  | 'arrived'    // ช่างถึงจุดเกิดเหตุแล้ว
  | 'loading'    // กำลังยกรถขึ้นรถสไลด์/รถลาก
  | 'delivering' // กำลังนำรถส่งอู่ปลายทาง
  | 'completed'  // จบงานแล้ว
  | 'cancelled'; // ยกเลิกงาน

export interface TowJob {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  carBrand: string;
  carModel: string;
  plateNumber: string;
  towType: string;         // เช่น 'รถสไลด์ (Slide Tow)'
  carCategory: string;     // เช่น 'รถเก๋ง / Sedan'
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  destinationGarage: string;
  distanceKm: number;
  price: number;
  status: JobStatus;
  techId: string | null;
  createdAt: number;
  updatedAt: number;
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

// ----------------------------------------------------------------------------
// Payments — ต่างจาก jobs/techs ด้านบน: payments ไม่ได้เก็บใน localStorage mock
// แต่ผูกกับตาราง `payments` จริงใน Supabase อยู่แล้ว (ฝั่งช่างอ่าน/อัปเดตตรงผ่าน
// supabase client) type ตรงนี้มีไว้ให้ทั้งแอปลูกค้าและแอปช่าง import ใช้ร่วมกัน
// เพื่อให้ชื่อ field ตรงกันเป๊ะ ๆ ทั้งสองฝั่ง (โดยเฉพาะตอนลูกค้าเลือกวิธีชำระเงิน)
// ----------------------------------------------------------------------------

/** วิธีชำระเงินที่ลูกค้าเลือกตอนจอง — ต้องเขียนค่านี้ลง payments.payment_method
 *  ทุกครั้งที่สร้าง payment row ใหม่ ไม่งั้นฝั่งช่างจะไม่รู้ว่าลูกค้าเลือกเงินสดหรือโอน */
export type PaymentMethod = 'transfer' | 'cash' | 'credit';

export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Payment {
  id: string;
  job_id: string;
  payment_method: PaymentMethod;
  /** เฉพาะ payment_method === 'transfer' เท่านั้นที่จะมีสลิป ถ้าเป็น 'cash' ค่านี้จะเป็น null เสมอ
   *  และฝั่ง UI ต้องไม่ขึ้นข้อความ "ยังไม่ได้แนบสลิป" ในกรณีเงินสด */
  slip_url: string | null;
  amount: number | null;
  status: PaymentStatus;
  created_at?: string;
  verified_by?: string | null;
  verified_at?: string | null;
}

const JOBS_KEY = 'dtc_shared_jobs_v1';
const TECHS_KEY = 'dtc_shared_techs_v1';
const EVENT_NAME = 'dtc-shared-store-changed';

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  // storage event ของเบราว์เซอร์ทำงานแค่ "ข้ามแท็บ" เท่านั้น ไม่ยิงในแท็บตัวเอง
  // เลยต้อง dispatch custom event เพิ่ม เพื่อให้ component ในแท็บเดียวกัน re-render ด้วย
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { key } }));
}

// ------------------------------- Jobs --------------------------------------

export function listJobs(): TowJob[] {
  return readStore<TowJob[]>(JOBS_KEY, []);
}

export function getJob(id: string): TowJob | undefined {
  return listJobs().find((j) => j.id === id);
}

/** เรียกจากฝั่งลูกค้า ตอนกด "ยืนยันเรียกช่างทันที" */
export function createJob(
  input: Omit<TowJob, 'id' | 'status' | 'techId' | 'createdAt' | 'updatedAt'>
): TowJob {
  const job: TowJob = {
    ...input,
    id: `JOB-${Date.now().toString().slice(-8)}`,
    status: 'pending',
    techId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writeStore(JOBS_KEY, [job, ...listJobs()]);
  return job;
}

/** เรียกจากฝั่งช่าง ตอนรับงาน / เปลี่ยนสถานะงาน / ฝั่งลูกค้าตอนยกเลิก */
export function updateJob(id: string, patch: Partial<TowJob>) {
  const jobs = listJobs().map((j) =>
    j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j
  );
  writeStore(JOBS_KEY, jobs);
}

/** subscribe รายการงานทั้งหมด — ใช้ได้ทั้งฝั่งลูกค้า (ดูงานของตัวเอง) และฝั่งช่าง (ดูงานที่เข้ามาใหม่) */
export function subscribeJobs(callback: (jobs: TowJob[]) => void): () => void {
  const handler = () => callback(listJobs());
  window.addEventListener(EVENT_NAME, handler as EventListener);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler as EventListener);
    window.removeEventListener('storage', handler);
  };
}

// --------------------------- Technicians ------------------------------------

export function listTechs(): TechnicianProfile[] {
  return readStore<TechnicianProfile[]>(TECHS_KEY, []);
}

export function upsertTech(tech: TechnicianProfile) {
  const techs = listTechs();
  const idx = techs.findIndex((t) => t.id === tech.id);
  if (idx >= 0) techs[idx] = tech;
  else techs.push(tech);
  writeStore(TECHS_KEY, techs);
}

/** เรียกจากฝั่งช่าง ตอนกดปุ่มสถานะ ออนไลน์ / ออฟไลน์ / พัก / กำลังทำงาน */
export function setTechStatus(id: string, status: TechStatus) {
  const techs = listTechs();
  const idx = techs.findIndex((t) => t.id === id);
  if (idx >= 0) {
    techs[idx] = { ...techs[idx], status };
    writeStore(TECHS_KEY, techs);
  }
}

/** subscribe รายชื่อช่างทั้งหมด — ฝั่งลูกค้าใช้แสดง "แดชบอร์ดสถานะช่างบริการ" (ออนไลน์/ออฟไลน์/พัก/กำลังทำงาน) */
export function subscribeTechs(callback: (techs: TechnicianProfile[]) => void): () => void {
  const handler = () => callback(listTechs());
  window.addEventListener(EVENT_NAME, handler as EventListener);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler as EventListener);
    window.removeEventListener('storage', handler);
  };
}

// --------------------------- Derived stats ----------------------------------

export function getTechStatusCounts(techs: TechnicianProfile[]) {
  return {
    online: techs.filter((t) => t.status === 'online').length,
    working: techs.filter((t) => t.status === 'working').length,
    breakTime: techs.filter((t) => t.status === 'break').length,
    offline: techs.filter((t) => t.status === 'offline').length,
  };
}