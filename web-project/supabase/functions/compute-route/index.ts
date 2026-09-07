// supabase/functions/compute-route/index.ts
// ----------------------------------------------------------------------------
// เรียกบริการคำนวณเส้นทาง (routing) เพื่อเอาระยะทาง/เวลาเดินทางจริงตามถนน + พิกัดเส้นทาง
// (geometry) + ป้ายเลี้ยว (steps) ให้ฝั่ง client (lib/dtc-api.ts -> components/LiveTrackingMap.tsx
// / worker.tsx FullScreenNav) เอาไปวาดเป็นเส้นบนแผนที่แบบเลี้ยวตามถนนจริง + โชว์ป้ายเลี้ยวสไตล์
// Google Maps แทนเส้นตรง/ไม่มีป้ายเลย
//
// แก้บั๊ก #1 (เส้นประตรงขึ้นตลอด แม้โค้ดเรียก OSRM ถูกต้องแล้ว): ของเดิมชี้ไปที่ OSRM public
// demo server (router.project-osrm.org) เพียงอย่างเดียว ซึ่ง demo server ตัวนี้ไม่มี SLA
// และในทางปฏิบัติมักบล็อก/rate-limit request ที่มาจาก IP ของผู้ให้บริการ cloud/serverless
// (เช่น Supabase Edge Functions ที่รันบน Deno Deploy) แบบเงียบๆ — บาง request ได้ 403/429
// บางที connection ค้างจนไทม์เอาต์ ทำให้ compute-route คืน error เกือบทุกครั้งในทางปฏิบัติ
// ทางแก้: เพิ่ม OpenRouteService (ORS) เป็นผู้ให้บริการหลัก (ถ้าตั้งค่า ORS_API_KEY ไว้) —
// ถ้ายังไม่ตั้งค่า ORS_API_KEY จะ fallback ไปใช้ OSRM demo server แบบเดิมให้อัตโนมัติ
//
// แก้บั๊ก #2 (ป้ายเลี้ยวไม่เคยขึ้นเลย แม้ deploy เวอร์ชันแก้บั๊ก #1 ไปแล้วก็ตาม): เวอร์ชันก่อนหน้า
// (ที่แก้แค่บั๊ก #1) ไม่เคยมีโค้ดส่วนขอ/แปลง turn-by-turn steps จากผู้ให้บริการเลยสักบรรทัด —
// routeViaORS()/routeViaOSRM() คืนแค่ distanceKm/durationMinutes/geometry เท่านั้น ทำให้ฝั่ง
// client (lib/dtc-api.ts computeRoute()) ได้ data.steps เป็น undefined เสมอ แล้ว fallback เป็น
// steps=[] ตามที่ตั้งใจไว้ไม่ให้แอปพัง (ไม่ใช่เพราะยัง deploy ไม่ทัน) — เพิ่มโค้ดในไฟล์นี้ให้ทั้ง
// OSRM (steps=true ในพารามิเตอร์ + แปลง maneuver.type/modifier ตรงตาม spec) และ ORS (แปลงรหัส
// ตัวเลข instruction type 0-13 ตามเอกสารทางการของ ORS) ให้เป็นรูปแบบ RouteStep กลางแบบเดียวกัน
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const OSRM_BASE_URL = Deno.env.get('OSRM_BASE_URL') ?? 'https://router.project-osrm.org';
const ORS_API_KEY = Deno.env.get('ORS_API_KEY') ?? '';
// กันแต่ละ request ค้างนานเกินไปตอนผู้ให้บริการ routing เน็ตหลุด/ตอบช้าผิดปกติ — ให้ตัด
// แล้วลอง provider ถัดไป (หรือคืน error ให้ client fallback เป็นเส้นตรงเอง) ดีกว่าปล่อยค้าง
// จน Edge Function ตัวเองโดน platform ตัดเพราะเกิน execution time limit
const FETCH_TIMEOUT_MS = 8000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LatLng {
  lat: number;
  lng: number;
}

// ต้องหน้าตาตรงกับ RouteStep ใน lib/dtc-api.ts เป๊ะ (ทั้งชื่อ field และค่าที่เป็นไปได้ของ
// maneuverType/modifier) เพราะฝั่ง client แปลง JSON ตรงๆ ไม่มี validation เพิ่มเติม
interface RouteStep {
  distanceMeters: number;
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
  location: LatLng;
}

interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: LatLng[];
  steps: RouteStep[];
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------- ORS: แปลงรหัส instruction type -----------------------
// อ้างอิงตารางทางการของ ORS (Routing Response > Instruction Types):
// 0 Left, 1 Right, 2 Sharp left, 3 Sharp right, 4 Slight left, 5 Slight right,
// 6 Straight, 7 Enter roundabout, 8 Exit roundabout, 9 U-turn, 10 Goal, 11 Depart,
// 12 Keep left, 13 Keep right
function mapOrsStepType(type: number): { maneuverType: RouteStep['maneuverType']; modifier: RouteStep['modifier'] } {
  switch (type) {
    case 0: return { maneuverType: 'turn', modifier: 'left' };
    case 1: return { maneuverType: 'turn', modifier: 'right' };
    case 2: return { maneuverType: 'turn', modifier: 'sharp_left' };
    case 3: return { maneuverType: 'turn', modifier: 'sharp_right' };
    case 4: return { maneuverType: 'turn', modifier: 'slight_left' };
    case 5: return { maneuverType: 'turn', modifier: 'slight_right' };
    case 6: return { maneuverType: 'continue', modifier: 'straight' };
    case 7: return { maneuverType: 'roundabout', modifier: null };
    case 8: return { maneuverType: 'roundabout', modifier: null };
    case 9: return { maneuverType: 'turn', modifier: 'uturn' };
    case 10: return { maneuverType: 'arrive', modifier: null };
    case 11: return { maneuverType: 'depart', modifier: null };
    case 12: return { maneuverType: 'fork', modifier: 'slight_left' };
    case 13: return { maneuverType: 'fork', modifier: 'slight_right' };
    default: return { maneuverType: 'other', modifier: null };
  }
}

// ------------------------- OSRM: แปลง maneuver.type/modifier -------------------
// อ้างอิง OSRM API spec (route step maneuver): type เป็นสตริงตรงตัว เช่น 'turn',
// 'new name', 'depart', 'arrive', 'merge', 'on ramp', 'off ramp', 'fork',
// 'end of road', 'continue', 'roundabout', 'rotary', 'roundabout turn',
// 'exit rotary', 'exit roundabout', 'notification'
function mapOsrmManeuverType(type: string): RouteStep['maneuverType'] {
  switch (type) {
    case 'depart': return 'depart';
    case 'arrive': return 'arrive';
    case 'turn': return 'turn';
    case 'new name': return 'continue';
    case 'continue': return 'continue';
    case 'merge': return 'merge';
    case 'on ramp':
    case 'off ramp': return 'ramp';
    case 'fork': return 'fork';
    case 'end of road': return 'end_of_road';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
    case 'exit rotary':
    case 'exit roundabout': return 'roundabout';
    default: return 'other';
  }
}

function mapOsrmModifier(modifier: string | undefined): RouteStep['modifier'] {
  switch (modifier) {
    case 'uturn': return 'uturn';
    case 'sharp right': return 'sharp_right';
    case 'right': return 'right';
    case 'slight right': return 'slight_right';
    case 'straight': return 'straight';
    case 'slight left': return 'slight_left';
    case 'left': return 'left';
    case 'sharp left': return 'sharp_left';
    default: return null;
  }
}

/** ผู้ให้บริการหลัก (ถ้ามีคีย์): OpenRouteService — ใช้ endpoint GET แบบพิกัดเดี่ยว (จุดเดียว
 *  ไป-กลับ ไม่ใช่ multi-waypoint) พอสำหรับ origin->destination ของแอปนี้
 *  instructions เปิดเป็นค่าเริ่มต้นอยู่แล้วฝั่ง ORS (ไม่ต้องส่งพารามิเตอร์เพิ่ม) — segments[].steps[]
 *  จะมีมาให้เสมอถ้าเส้นทางหาเจอ */
async function routeViaORS(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const url =
    `https://api.openrouteservice.org/v2/directions/driving-car` +
    `?api_key=${encodeURIComponent(ORS_API_KEY)}` +
    `&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;

  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, FETCH_TIMEOUT_MS);
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`ORS คืนสถานะผิดปกติ: ${res.status} ${bodyText.slice(0, 300)}`);
  }

  const data = JSON.parse(bodyText);
  const feature = data?.features?.[0];
  const coords: [number, number][] | undefined = feature?.geometry?.coordinates;
  const summary = feature?.properties?.summary;
  if (!feature || !coords || !summary) {
    throw new Error(`ORS ไม่พบเส้นทาง: ${bodyText.slice(0, 300)}`);
  }

  // segments[].steps[] — แต่ละ step มี way_points: [startIdx, endIdx] ชี้ไปยัง index ใน
  // coords (raw [lng,lat][] ก่อนแปลง) ใช้ startIdx เป็นตำแหน่งที่ต้องทำ maneuver นี้
  const rawSteps: any[] = (feature?.properties?.segments ?? []).flatMap((seg: any) => seg?.steps ?? []);
  const steps: RouteStep[] = rawSteps
    .map((s: any) => {
      const pointIdx = Array.isArray(s?.way_points) ? s.way_points[0] : undefined;
      const point = typeof pointIdx === 'number' ? coords[pointIdx] : undefined;
      if (!point) return null;
      const { maneuverType, modifier } = mapOrsStepType(Number(s?.type));
      const step: RouteStep = {
        distanceMeters: Number(s?.distance) || 0,
        name: typeof s?.name === 'string' && s.name !== '-' ? s.name : '',
        maneuverType,
        modifier,
        location: { lat: point[1], lng: point[0] },
      };
      return step;
    })
    .filter((s): s is RouteStep => s !== null);

  return {
    distanceKm: summary.distance / 1000,
    durationMinutes: summary.duration / 60,
    // ORS คืนพิกัดเป็น [lng, lat][] เหมือน OSRM (มาตรฐาน GeoJSON) — แปลงกลับเป็น {lat, lng}[]
    geometry: coords.map(([lng, lat]) => ({ lat, lng })),
    steps,
  };
}

/** ผู้ให้บริการสำรอง (หรือหลักถ้าไม่ได้ตั้งค่า ORS_API_KEY): OSRM — เดิมเรียกตรงๆ ไม่มี
 *  User-Agent/timeout เพิ่ม header ระบุตัวตนแอปตามธรรมเนียมการใช้ OSRM demo server (ลด
 *  โอกาสโดนบล็อกเงียบๆ ว่าเป็น traffic ผิดปกติ) และ timeout กันค้างนาน
 *  เพิ่ม &steps=true เพื่อให้ OSRM คืน turn-by-turn maneuver มาด้วย (ของเดิมไม่มีพารามิเตอร์
 *  นี้เลย OSRM จึงไม่เคยส่ง steps กลับมาให้แปลง) */
async function routeViaOSRM(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  // OSRM ใช้ลำดับ lng,lat (ไม่ใช่ lat,lng) ในพารามิเตอร์ coordinates
  const coordsPath = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsPath}?overview=full&geometries=geojson&steps=true`;

  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': 'DTC-Rescue-App/1.0 (compute-route Edge Function)' } },
    FETCH_TIMEOUT_MS
  );
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`OSRM คืนสถานะผิดปกติ: ${res.status} ${bodyText.slice(0, 300)}`);
  }

  const osrmData = JSON.parse(bodyText);
  const route = osrmData?.routes?.[0];
  if (!route) {
    throw new Error(`ไม่พบเส้นทางจาก OSRM: ${bodyText.slice(0, 300)}`);
  }

  // geometry.coordinates จาก OSRM (geojson) เป็น [lng, lat][] — แปลงกลับเป็น
  // {lat, lng}[] ให้ตรงกับ LatLng ที่ฝั่ง client (LiveTrackingMap) ใช้อยู่แล้ว
  const geometry: LatLng[] = (route.geometry?.coordinates ?? []).map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  // legs[].steps[] — แต่ละ leg คือช่วงระหว่าง waypoint สองจุด (ที่นี่มีแค่ 1 leg เพราะมีแค่
  // origin->destination) รวม steps ทุก leg เข้าด้วยกันตามลำดับ
  const rawSteps: any[] = (route.legs ?? []).flatMap((leg: any) => leg?.steps ?? []);
  const steps: RouteStep[] = rawSteps
    .map((s: any) => {
      const loc = s?.maneuver?.location; // [lng, lat]
      if (!Array.isArray(loc) || loc.length < 2) return null;
      const step: RouteStep = {
        distanceMeters: Number(s?.distance) || 0,
        name: typeof s?.name === 'string' ? s.name : '',
        maneuverType: mapOsrmManeuverType(s?.maneuver?.type ?? ''),
        modifier: mapOsrmModifier(s?.maneuver?.modifier),
        location: { lat: loc[1], lng: loc[0] },
      };
      return step;
    })
    .filter((s): s is RouteStep => s !== null);

  return {
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
    geometry,
    steps,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { origin, destination } = (await req.json()) as {
      origin: LatLng;
      destination: LatLng;
    };

    if (
      !origin || !destination ||
      typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
      typeof destination.lat !== 'number' || typeof destination.lng !== 'number'
    ) {
      return new Response(JSON.stringify({ error: 'origin/destination ไม่ถูกต้อง' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ลอง provider ตามลำดับ: ORS ก่อน (ถ้ามีคีย์ตั้งไว้ เชื่อถือได้กว่าสำหรับเซิร์ฟเวอร์เรียก
    // เซิร์ฟเวอร์) แล้วค่อย fallback ไป OSRM demo server ถ้า ORS ล้มเหลวหรือไม่ได้ตั้งค่าไว้
    // เก็บ error message ของแต่ละ provider ที่ลองไว้ด้วย เผื่อทั้งคู่ล้มเหลว จะได้ debug ง่าย
    const attempts: string[] = [];
    let result: RouteResult | null = null;

    if (ORS_API_KEY) {
      try {
        result = await routeViaORS(origin, destination);
      } catch (err) {
        attempts.push(`ORS: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!result) {
      try {
        result = await routeViaOSRM(origin, destination);
      } catch (err) {
        attempts.push(`OSRM: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!result) {
      // provider ที่ตั้งค่าไว้ (หรือทั้งคู่) ล้มเหลวหมด — คืน error พร้อมรายละเอียดทุกความ
      // พยายามที่ลอง ให้ client เห็นสาเหตุจริงใน console.error (เดิมเห็นแค่ "คืนค่าผิดปกติ"
      // เฉยๆ ไม่รู้ว่าจริงๆ แล้ว provider ไหนพังเพราะอะไร)
      return new Response(JSON.stringify({ error: `เรียกบริการคำนวณเส้นทางไม่สำเร็จ: ${attempts.join(' | ')}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
