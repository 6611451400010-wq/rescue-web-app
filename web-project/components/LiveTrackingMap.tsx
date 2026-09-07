'use client';

// ============================================================================
// components/LiveTrackingMap.tsx
// ----------------------------------------------------------------------------
// จากฝั่ง page.tsx/worker.tsx เท่านั้น เพราะ maplibre-gl อ่านค่า window/document ตอน
// import ซึ่งจะพังถ้าโดน Next.js เรียกรันฝั่ง server (SSR)
//
// Tile source: ใช้ MapTiler vector style (streets-v2) ถ้ามี NEXT_PUBLIC_MAPTILER_KEY
// (สมัครคีย์ฟรีได้ที่ https://cloud.maptiler.com/account/keys/ — free tier พอสำหรับ
// แอปเริ่มต้น) ถ้ายังไม่ตั้งค่าไว้ (เช่นตอน dev เครื่องตัวเอง) จะ fallback ไปใช้
// raster tiles จาก OpenStreetMap ตรงๆ แทนอัตโนมัติ (คุณภาพหมุนแผนที่จะด้อยกว่า vector
// เล็กน้อยแต่ยังใช้งานได้ ไม่ต้องมีคีย์)
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// แก้: maplibre-gl v3+ ไม่มี default export แล้ว ต้อง import แบบ namespace
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Truck, MapPin, Navigation } from 'lucide-react';

export interface LatLng {
  lat: number;
  lng: number;
  /** ทิศทาง (course-over-ground) จาก GPS โดยตรง หน่วยองศา 0-360 — ใช้เฉพาะกับ techPos
   *  เพื่อหมุนแผนที่แบบ heading-up ได้ทันทีที่ GPS รายงานมา แทนที่จะรอคำนวณจากจุดสองจุด
   *  ที่ผ่านมา (ซึ่งจะหมุนตามหลังทิศจริงเห็นชัดตอนรถเลี้ยวที่สี่แยก เพราะต้องรอให้ขยับเกิน
   *  threshold ก่อนถึงจะรู้ทิศใหม่) null/undefined = อุปกรณ์ไม่ได้รายงานมา หรือรถจอดนิ่งจน
   *  ค่านี้ไม่น่าเชื่อถือ (browser/OS มักคืน null ตอนความเร็วต่ำมากหรือจอดอยู่) — กรณีนี้จะ
   *  fallback ไปคำนวณ bearing จากการขยับแทนเหมือนโค้ดเดิม */
  heading?: number | null;
}

interface LiveTrackingMapProps {
  /** ตำแหน่งจริงของช่าง จาก Supabase Realtime (technicians.current_lat/lng) — null = ยังไม่มี GPS ping เข้ามาเลย */
  techPos: LatLng | null;
  /** จุดเกิดเหตุ (ตำแหน่งที่ลูกค้ากดขอความช่วยเหลือ) */
  pickupPos: LatLng | null;
  /** อู่ปลายทางที่ระบบจับคู่ให้ */
  garagePos: LatLng | null;
  /** ซ่อนหมุดจุดเกิดเหตุตอนงานเข้าสถานะนำส่งอู่แล้ว (พฤติกรรมเดิมจากแผนที่แบบ overlay) */
  showPickupMarker: boolean;
  showGarageMarker: boolean;
  /** ข้อความสถานะที่โชว์บนป้ายมุมซ้ายบน เช่น "ช่างกำลังเดินทางไปจุดเกิดเหตุ" */
  statusLabel: string;
  /** พิกัดเส้นทางจริงตามถนนจาก OSRM (compute-route Edge Function) — ลำดับจุดที่ต่อกัน
   *  จะกลายเป็นเส้นทึบบนแผนที่ ถ้าเป็น null/[] จะไม่วาดเส้นเลย (fallback เงียบๆ เผื่อ OSRM
   *  เรียกไม่สำเร็จ ไม่ทำให้แผนที่ทั้งอันพัง) */
  routeGeometry?: LatLng[] | null;
  /** true = routeGeometry เป็นเส้นตรงสำรอง (compute-route/OSRM คำนวณเส้นตามถนนจริงไม่สำเร็จ)
   *  ไม่ใช่เส้นทางจริง — วาดเป็นเส้นประสีอำพันแทนเส้นทึบสีส้ม จะได้แยกออกว่าเป็นแค่เส้นประมาณ
   *  ทิศทางคร่าวๆ ไม่ใช่เส้นทางตามถนนจริงที่คำนวณได้ ไม่ระบุ = ถือว่าเป็นเส้นทางจริง (false) */
  routeIsEstimated?: boolean;
  /** ความสูงของกรอบแผนที่ (tailwind class เช่น 'h-64', 'h-36') ปรับได้ตามที่ที่ใช้แสดง ไม่ระบุ = h-64 */
  heightClassName?: string;
  /** true = แผนที่เต็มจอแบบแอปนำทาง (Google Maps) — เอากรอบ/เส้นขอบ/มุมมน/เงาออกให้ภาพเต็ม
   *  ขอบจอสนิท เพราะจอนั้นแสดงแค่แผนที่อย่างเดียวไม่มีอะไรอื่นรอบๆ ให้ต้องแยกเป็นกรอบการ์ด
   *  ไม่ระบุ = false (พฤติกรรมเดิม มีกรอบมนใช้ตอนฝังอยู่ในการ์ดปกติ) */
  fullBleed?: boolean;
  /** ป้ายชื่อบนหมุดช่าง — เดิม hardcode ว่า "ช่างสไลด์" ตายตัว ทั้งที่ตอนนี้ช่างเลือกได้ทั้ง
   *  รถสไลด์/รถยกซ้อนล้อ/รถซ่อมเคลื่อนที่ (ดู ServiceTruckType ใน worker.tsx) จึงเปิดเป็น prop
   *  ให้ผู้เรียกกำหนดเอง — ไม่ระบุ = ใช้คำกลางๆ ว่า "ช่าง" แทน */
  techLabel?: string;
}

// URL ของ style — ใช้ MapTiler vector style ถ้ามีคีย์ (NEXT_PUBLIC_MAPTILER_KEY) ไม่งั้น
// fallback เป็น raster style ห่อ OpenStreetMap tiles ตรงๆ (MapLibre รองรับ raster-only
// style ได้ปกติ แค่หมุน/เอียงจะไม่สวยเท่า vector แต่ยังใช้งานได้)
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const MAP_STYLE: string | maplibregl.StyleSpecification = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`
  : {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
    };

const ROUTE_SOURCE_ID = 'dtc-route';
const ROUTE_CASING_LAYER_ID = 'dtc-route-casing';
const ROUTE_LINE_LAYER_ID = 'dtc-route-line';
// ชั้นลูกศรบอกทิศทางวิ่งเรียงตามแนวเส้นทาง (symbol-placement: 'line') — เพิ่มเข้ามาให้เส้นทาง
// อ่านทิศทาง/จุดเลี้ยวได้จากตัวเส้นเองเลย เหมือนเส้นนำทางของ Google Maps ที่มีลูกศรขาวจางๆ
// เรียงยาวไปตามเส้น ไม่ต้องพึ่งแค่ป้ายเลี้ยวด้านบนอย่างเดียว
const ROUTE_ARROW_LAYER_ID = 'dtc-route-arrows';
const ROUTE_ARROW_ICON_ID = 'dtc-route-arrow-icon';


// เดิมเป็น const ตายตัวสร้างครั้งเดียวตอน module โหลด (label "ช่างสไลด์" hardcode) —
// เปลี่ยนเป็นฟังก์ชันสร้าง element ตาม label ที่ส่งเข้ามา เรียกใหม่เฉพาะตอน label เปลี่ยน
// (ดู useMemo ใน component ด้านล่าง) ไอคอนรูปแบบยังเหมือนเดิมทุกอย่าง เปลี่ยนแค่ป้ายข้อความ
// หมายเหตุ: ไม่ใส่ลูกศรบอกทิศทางบนตัวไอคอนเอง เพราะโหมด heading-up หมุน "แผนที่" รอบตัวรถ
// แทน (ทิศทางที่รถวิ่งจะชี้ขึ้นบนจอเสมอโดยตัวรถอยู่กับที่) ถ้าใส่ลูกศรหมุนไอคอนเพิ่มเข้าไปอีก
// ชั้นจะกลายเป็นหมุนซ้อนกันสองรอบและดูสับสน
function buildIconElement(html: string, size: number): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  return el;
}

function makeTechIconHtml(label: string): string {
  return renderToStaticMarkup(
    <div className="flex flex-col items-center">
      <div className="mb-0.5 flex items-center gap-1 whitespace-nowrap rounded-md border border-white bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
        <Truck className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-orange-400 opacity-75" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-lg">
          <Truck className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

const pickupIconHtml = renderToStaticMarkup(
  <div className="flex flex-col items-center">
    <div className="mb-0.5 whitespace-nowrap rounded-md border border-white bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
      จุดเกิดเหตุ
    </div>
    <div className="relative flex items-center justify-center">
      <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-red-400 opacity-75" />
      <MapPin className="relative h-7 w-7 fill-red-500 text-red-600 drop-shadow-md" />
    </div>
  </div>
);

const garageIconHtml = renderToStaticMarkup(
  <div className="flex flex-col items-center">
    <div className="mb-0.5 whitespace-nowrap rounded-md border border-white bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
      จุดหมาย (อู่)
    </div>
    <MapPin className="h-7 w-7 fill-emerald-500 text-emerald-600 drop-shadow-md" />
  </div>
);

/** สร้างไอคอนลูกศรสามเหลี่ยมง่ายๆ ด้วย canvas สำหรับใช้เป็น SDF icon บนเส้นทาง — วาดเป็น
 *  ขาวดำ (สีจริงกำหนดทีหลังผ่าน paint 'icon-color' ของ MapLibre เพราะเป็น SDF) หัวลูกศร
 *  ชี้ขึ้นด้านบนของรูปภาพเสมอ แล้ว MapLibre จะหมุนให้เองตามทิศทางของเส้น ณ จุดนั้น (layout
 *  'symbol-placement': 'line' + 'icon-rotation-alignment': 'map') ไม่ต้องคำนวณ bearing เอง */
function createArrowIconData(size: number): { width: number; height: number; data: Uint8Array } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.12);
  ctx.lineTo(size * 0.82, size * 0.82);
  ctx.lineTo(size * 0.5, size * 0.62);
  ctx.lineTo(size * 0.18, size * 0.82);
  ctx.closePath();
  ctx.fill();
  const imageData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imageData.data.buffer) };
}

/** ระยะทางโดยประมาณระหว่างสองพิกัด (เมตร) — ใช้ Haversine แบบง่าย พอสำหรับเช็คว่าช่าง
 *  ขยับจริงหรือแค่ GPS สั่นๆ อยู่กับที่ ไม่ต้องแม่นระดับเซนติเมตร */
function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** ทิศทาง (bearing) จากจุด a ไปจุด b เป็นองศา 0-360 (0 = เหนือ, 90 = ตะวันออก) — ใช้เป็น
 *  ค่า bearing ของแผนที่ในโหมดตามติดรถ ให้ทิศที่รถกำลังวิ่งชี้ขึ้นบนจอเสมอ */
function computeBearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** จัดกรอบแผนที่ให้เห็นจุดที่ส่งมาทั้งหมดพอดี (เหนือขึ้นบนเสมอ bearing=0) — ใช้ทั้งตอน
 *  จัดกรอบครั้งแรก (ยังไม่มี GPS ช่าง) และตอนกดปุ่ม recenter ตอนไม่มี techPos ให้ตามติด */
function fitMapToPoints(map: maplibregl.Map, points: LatLng[]) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 15, bearing: 0, duration: 500 });
    return;
  }
  const bounds = points.reduce(
    (b, p) => b.extend([p.lng, p.lat] as [number, number]),
    new maplibregl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
  );
  map.fitBounds(bounds, { padding: 48, bearing: 0, duration: 500 });
}

export default function LiveTrackingMap({
  techPos,
  pickupPos,
  garagePos,
  showPickupMarker,
  showGarageMarker,
  statusLabel,
  routeGeometry,
  routeIsEstimated = false,
  heightClassName = 'h-64',
  fullBleed = false,
  techLabel = 'ช่าง',
}: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const techMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const garageMarkerRef = useRef<maplibregl.Marker | null>(null);

  const prevTechPosRef = useRef<LatLng | null>(null);
  const headingRef = useRef<number>(0);
  const hasCenteredOnTechRef = useRef(false);
  const initialFrameDoneRef = useRef(false);

  // โหมดตามติดรถแบบ Google Maps nav — เริ่มต้นเป็น true (ตามติดทันทีที่มี GPS ช่างเข้ามา)
  // ผู้ใช้ลากแผนที่เอง (dragstart) จะปิดโหมดนี้ กดปุ่ม RecenterButton เพื่อเปิดกลับมา
  const [isFollowing, setIsFollowing] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);

  const boundsPoints = useMemo(() => {
    const pts: LatLng[] = [];
    if (techPos) pts.push(techPos);
    if (showPickupMarker && pickupPos) pts.push(pickupPos);
    if (showGarageMarker && garagePos) pts.push(garagePos);
    return pts;
  }, [techPos, pickupPos, garagePos, showPickupMarker, showGarageMarker]);

  const defaultCenter: [number, number] = pickupPos
    ? [pickupPos.lng, pickupPos.lat]
    : garagePos
    ? [garagePos.lng, garagePos.lat]
    : [100.5018, 13.7563]; // fallback ใจกลางกรุงเทพฯ เผื่อยังไม่มีพิกัดอะไรเลยจริง ๆ

  // ------------------------------------------------------------------------
  // สร้างแผนที่ครั้งเดียวตอน mount
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: defaultCenter,
      zoom: 14,
      bearing: 0,
      pitch: 0,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // ดัก error ของ MapLibre ไว้เสมอ — ถ้าไม่มี listener ตัวนี้ ตัว event 'error' ภายในบางกรณี
    // (เช่น เรียก setPaintProperty/setLayoutProperty ผิด, style/tile โหลดพลาด) จะถูก throw
    // ออกมาแบบ uncaught exception กลางฟังก์ชันที่เรียกมันได้ แค่ log ไว้เฉยๆ ไม่ทำให้แอปพัง
    map.on('error', (e) => {
      console.error('MapLibre error:', e.error);
    });

    // ปิดการหมุน/เอียงมุมมองด้วยมือของผู้ใช้ — bearing ในแอปนี้ควบคุมโดยโค้ด (ตามทิศทาง
    // รถ) เท่านั้น ถ้าปล่อยให้ผู้ใช้หมุนเองได้จะขัดกับโหมดตามติดรถและงงว่าทิศไหนเป็นไหน
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();

    // ผู้ใช้ลากแผนที่เอง (pan) — ปิดโหมดตามติดรถอัตโนมัติ ไม่งั้นแผนที่จะกระตุกกลับไปที่
    // ตำแหน่งรถทุกครั้งที่ GPS อัปเดต ทำให้ลากดูจุดอื่นไม่ได้เลย
    map.on('dragstart', () => setIsFollowing(false));

    map.on('load', () => {
      // แก้บั๊กสำคัญ (เส้นทางไม่ขึ้นเลยแม้ routeGeometry มีข้อมูลครบ): เดิมโค้ดทั้งก้อนนี้
      // (เพิ่ม source + casing layer + route line layer + ไอคอนลูกศร + arrow layer +
      // setIsMapReady(true)) รันเรียงเป็นบล็อกเดียวไม่มี try/catch — ถ้าขั้นตอนไหนกลางบล็อก
      // throw exception (เช่น ตอนเพิ่ม SDF icon ของลูกศรบน MapLibre บางเวอร์ชัน/บางอุปกรณ์)
      // โค้ดจะหยุดทำงานตรงนั้นทันที แล้ว "setIsMapReady(true)" ซึ่งอยู่บรรทัดสุดท้ายจะไม่ถูก
      // เรียกเลย ผลคือ isMapReady ค้างเป็น false ตลอดไป → useEffect ที่วาดเส้นทาง (เช็ค
      // isMapReady ก่อนเสมอ) จะ return ออกทุกครั้งไม่เคยเรียก source.setData() เลย แม้
      // routeGeometry ฝั่ง props จะมีพิกัดมาครบ 88 จุดก็ตาม — อาการภายนอกคือ "มีข้อมูลแต่เส้น
      // ไม่ขึ้นสักเส้น" ตรงกับที่เจอ
      //
      // แก้โดยแยกเป็น 2 ส่วนอิสระจากกัน: (1) ส่วนวิกฤต — source + casing + route line +
      // setIsMapReady(true) ต้องสำเร็จเพื่อให้เส้นทางหลักทำงานได้ ห่อด้วย try/catch ของตัวเอง
      // พร้อม log ให้เห็นชัดถ้าพัง (2) ส่วนเสริม — ไอคอนลูกศรตามแนวเส้น แยก try/catch อีกก้อน
      // ต่างหาก ถ้าพังก็แค่ไม่มีลูกศร ไม่กระทบเส้นทางหลักที่วาดไปก่อนหน้าแล้วเลย
      try {
        // แก้บั๊ก (เส้นทางไม่ขึ้นแม้ setData() รายงานสำเร็จ ไม่มี error เลย): เดิม initial data
        // ตอน addSource เป็น Feature/LineString ที่มี coordinates: [] ซึ่งผิด GeoJSON spec
        // (LineString ต้องมีอย่างน้อย 2 จุด) ทำให้ MapLibre ยิง event 'error' แบบ async ออกมา
        // จาก worker ตอน index geometry นี้ — try/catch รอบนี้ดักไม่ได้เพราะ error เกิดทีหลัง
        // แบบ async (ไปเข้า map.on('error', ...) ที่แค่ log เฉยๆ) ผลคือ source ถูก mark
        // invalid ตั้งแต่ตอนสร้าง แล้ว setData() ทีหลังด้วย geometry ที่ถูกต้อง (88 จุด) ไม่
        // trigger การ re-index tile ให้เอง เห็นผลลัพธ์คือ log บอกสำเร็จแต่เส้นไม่ขึ้นจริง
        // แก้โดยเริ่มต้นด้วย FeatureCollection ว่าง (features: []) แทน ซึ่งถูก spec เสมอ
        // ไม่ว่าจะว่างแค่ไหนก็ตาม — ตอน setData() ทีหลังค่อยส่งเป็น Feature/LineString จริง
        // (ตอนนั้นมี coords ≥ 2 จุดแล้ว ถูก spec อยู่แล้ว ไม่ต้องแก้จุดนั้น)
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        // เส้น "casing" สีขาวหนากว่าเดิม วาดไว้ใต้เส้นสี — ให้เส้นทางอ่านง่ายขึ้นบนพื้นหลัง
        // tile ที่มีสีสันหลากหลาย เหมือนสไตล์เส้นทาง Google Maps nav จริง
        //
        // สีเส้นทาง: raster fallback ของ OSM (ตอนไม่มี NEXT_PUBLIC_MAPTILER_KEY) เรนเดอร์
        // ถนนสายหลัก/ทางด่วนเป็นสีชมพู/ส้มอมชมพูอยู่แล้ว ใช้สีฟ้าแบบ Google Maps (#2563eb)
        // ตัดกับพื้นถนนสีชมพูชัดกว่าสีส้มเดิมมาก และเพิ่มความหนาตามระดับซูม (interpolate)
        // ให้ยังเห็นชัดตอนซูมเข้าใกล้ถนนกว้างๆ
        map.addLayer({
          id: ROUTE_CASING_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 10, 19, 14],
            'line-opacity': 0.95,
          },
        });
        map.addLayer({
          id: ROUTE_LINE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            // สีเริ่มต้น: ฟ้าแบบ Google Maps (เส้นทางจริงจาก OSRM) — ตอนมี routeIsEstimated
            // จริงจะถูกเปลี่ยนเป็นสีอำพันผ่าน setPaintProperty ใน route effect ด้านล่างอีกที
            'line-color': '#2563eb',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 5, 16, 8, 19, 11],
            'line-opacity': 1,
          },
        });
        setIsMapReady(true);
      } catch (err) {
        console.error('[MAP] FAILED to add route source/layers — route line จะไม่ขึ้นเลย:', err);
      }

      // ส่วนเสริม (ไม่วิกฤต): ลูกศรบอกทิศทางตามแนวเส้น — พังได้โดยไม่กระทบเส้นทางหลักด้านบน
      try {
        if (!map.hasImage(ROUTE_ARROW_ICON_ID)) {
          map.addImage(ROUTE_ARROW_ICON_ID, createArrowIconData(24), { sdf: true });
        }
        map.addLayer({
          id: ROUTE_ARROW_LAYER_ID,
          type: 'symbol',
          source: ROUTE_SOURCE_ID,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 60,
            'icon-image': ROUTE_ARROW_ICON_ID,
            'icon-size': 0.6,
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-color': '#ffffff',
            'icon-opacity': 0.9,
          },
        });
      } catch (err) {
        console.error('[MAP] FAILED to add route arrow layer (ไม่กระทบเส้นทางหลัก):', err);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------------
  // อัปเดตเส้นทาง (route) เส้น casing/สี ทุกครั้งที่ routeGeometry หรือ routeIsEstimated เปลี่ยน
  // ------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    const source = map.getSource(ROUTE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // แก้บั๊กที่เป็นไปได้ (เส้นทางไม่ขึ้นเลยทั้งที่ setData รายงานสำเร็จ): ถ้า routeGeometry
    // มีจุดใดจุดหนึ่งเป็นค่าที่ไม่ถูกต้อง (NaN, เกินช่วง lat/lng ที่เป็นไปได้จริง — เช่น
    // compute-route/OSRM ส่งพิกัดพังมาสักจุดจากทั้ง 88 จุด) MapLibre มักจะไม่วาด LineString
    // feature นั้นทั้งเส้นเลย (ไม่ throw error ให้เห็นด้วย) แทนที่จะข้ามแค่จุดที่พัง — กรองจุด
    // ที่ไม่ถูกต้องออกก่อนส่งเข้า setData() กันไว้ก่อน แม้ตอนนี้ยังไม่ยืนยันว่านี่คือสาเหตุจริง
    const rawPoints = routeGeometry ?? [];
    const validPoints = rawPoints.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
    );
    if (validPoints.length !== rawPoints.length) {
      console.warn(
        `[MAP] routeGeometry มีจุดพิกัดไม่ถูกต้อง ${rawPoints.length - validPoints.length} จุดจากทั้งหมด ${rawPoints.length} จุด — ถูกกรองออกก่อนวาดเส้น`
      );
    }
    const coords = validPoints.length > 1 ? validPoints.map((p) => [p.lng, p.lat]) : [];

    // แก้บั๊กเสริม: เดิม source.setData(...) กับ setPaintProperty ทั้งสองบรรทัดด้านล่างอยู่ใน
    // โค้ดบล็อกเดียวกันไม่มี try/catch ของตัวเอง (ต่างจากบล็อกตอน map.on('load') ที่แก้ไปแล้ว)
    // ถ้า setPaintProperty พังกลางทาง (เช่น MapLibre บางเวอร์ชัน/บางอุปกรณ์ validate ค่า
    // 'line-dasharray' เป็น undefined ไม่ผ่าน) exception จะหลุดออกมาจาก useEffect นี้ทั้งอัน —
    // แม้ setData() ด้านบนจะรันไปก่อนแล้วก็ตาม (เส้น casing สีขาวควรขึ้นอยู่ดี) แต่ React จะ log
    // "Uncaught exception" ใน error boundary ของ dev mode และเอฟเฟกต์ถัดไปในคิวอาจไม่ทำงานต่อ
    // ห่อ try/catch แยกไว้ให้ชัวร์ว่าไม่ว่าจะพังตรงไหน อย่างน้อย setData() จะสำเร็จเสมอ
    try {
      source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
      // บังคับให้ MapLibre วาดเฟรมใหม่ทันที — เผื่อกรณี edge case บน GPU/driver บางรุ่นที่
      // ไม่ trigger repaint เองทันทีหลัง setData() (พบเป็นบั๊กประปรายใน MapLibre บน
      // Android WebView บางเวอร์ชัน) ปกติไม่จำเป็นเพราะ setData() ควร repaint ให้เองอยู่แล้ว
      // แต่ใส่กันเหนียวไว้เพราะต้นทุนแทบเป็นศูนย์
      map.triggerRepaint();
    } catch (err) {
      console.error('[MAP] FAILED to setData on route source:', err);
    }

    // เส้นทางจริงจาก OSRM = เส้นทึบสีฟ้า, เส้นสำรอง (ตอน OSRM ล้มเหลว) = เส้นประสีอำพัน
    // ให้ดูออกชัดเจนว่านี่แค่ทิศทางคร่าวๆ ไม่ใช่เส้นทางตามถนนจริง
    //
    // แก้บั๊ก (เก่า): เดิมเรียก map.setLayoutProperty(...) ทั้งคู่ ทั้งที่ 'line-dasharray' เป็น
    // paint property (ตาม MapLibre style spec) ไม่ใช่ layout property — พอเรียกผิดฟังก์ชัน
    // MapLibre validate ไม่ผ่านแล้วยิง event 'error' ออกมา ถ้าไม่มี listener จับ event นี้ไว้
    // ระบบ Evented ของ MapLibre จะ throw exception ออกมากลาง useEffect ทำให้ทั้งเอฟเฟกต์พังและ
    // เส้นทางไม่ขึ้นเลย ไม่ใช่แค่เส้นประไม่ขึ้น — แก้แล้วโดยเปลี่ยนเป็น setPaintProperty ให้ถูก
    //
    // เปิดใช้งานจริงแล้ว (เดิมปิดไว้ด้วย `if (false && ...)` ตอนช่วง debug สีแดง 40px ด้านบน
    // เพื่อไม่ให้ทับสีทดสอบ ตอนนี้เลิกใช้สีทดสอบแล้วจึงเปิดกลับมาทำงานปกติ) ห่อ try/catch แยก
    // จาก setData() ด้านบน — ถ้าสองบรรทัดนี้พัง (เปลี่ยนสี/เส้นประไม่ได้) อย่างน้อยตัวเส้นทางหลัก
    // (setData ด้านบน) จะยังวาดขึ้นมาให้เห็นเป็นเส้นทึบสีฟ้าเริ่มต้นเสมอ (ค่า default จาก
    // addLayer ตอน map.on('load')) ไม่ใช่ไม่ขึ้นเลยทั้งเส้น
    if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
      try {
        map.setPaintProperty(ROUTE_LINE_LAYER_ID, 'line-color', routeIsEstimated ? '#f59e0b' : '#2563eb');
        map.setPaintProperty(
          ROUTE_LINE_LAYER_ID,
          'line-dasharray',
          routeIsEstimated ? [2, 2] : undefined
        );
      } catch (err) {
        console.error('[MAP] FAILED to update route line paint (สี/เส้นประ) — เส้นทางหลักควรยังขึ้นอยู่:', err);
      }
    }
  }, [routeGeometry, routeIsEstimated, isMapReady]);

  // ------------------------------------------------------------------------
  // หมุด: สร้าง/อัปเดต/ลบ ตามตำแหน่งที่ได้รับเข้ามา
  // ------------------------------------------------------------------------
  const techIconHtml = useMemo(() => makeTechIconHtml(techLabel), [techLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (techPos) {
      if (!techMarkerRef.current) {
        const el = buildIconElement(techIconHtml, 56);
        techMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([techPos.lng, techPos.lat])
          .addTo(map);
      } else {
        techMarkerRef.current.setLngLat([techPos.lng, techPos.lat]);
      }
    } else if (techMarkerRef.current) {
      techMarkerRef.current.remove();
      techMarkerRef.current = null;
    }
  }, [techPos, isMapReady, techIconHtml]);

  // ไอคอนช่างเปลี่ยนป้ายชื่อ (techLabel เปลี่ยน) — อัปเดต HTML ข้างในตัว element เดิม
  useEffect(() => {
    if (!techMarkerRef.current) return;
    techMarkerRef.current.getElement().innerHTML = techIconHtml;
  }, [techIconHtml]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (showPickupMarker && pickupPos) {
      if (!pickupMarkerRef.current) {
        const el = buildIconElement(pickupIconHtml, 56);
        pickupMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pickupPos.lng, pickupPos.lat])
          .addTo(map);
      } else {
        pickupMarkerRef.current.setLngLat([pickupPos.lng, pickupPos.lat]);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }
  }, [pickupPos, showPickupMarker, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (showGarageMarker && garagePos) {
      if (!garageMarkerRef.current) {
        const el = buildIconElement(garageIconHtml, 48);
        garageMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([garagePos.lng, garagePos.lat])
          .addTo(map);
      } else {
        garageMarkerRef.current.setLngLat([garagePos.lng, garagePos.lat]);
      }
    } else if (garageMarkerRef.current) {
      garageMarkerRef.current.remove();
      garageMarkerRef.current = null;
    }
  }, [garagePos, showGarageMarker, isMapReady]);

  // ------------------------------------------------------------------------
  // กล้อง: โหมดตามติดรถ (heading-up) + จัดกรอบครั้งแรกตอนยังไม่มี GPS ช่าง
  // ------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (techPos && isFollowing) {
      // อันดับแรก: ถ้า GPS รายงาน heading (course-over-ground) มาให้โดยตรงและดูน่าเชื่อถือ
      // (ไม่ null/NaN) ใช้ค่านี้ก่อนเลย เพราะแม่นยำและตอบสนองไวกว่าการคำนวณจากจุดสองจุดที่
      // ผ่านมามาก — เคสที่ต่างกันชัดคือตอนรถเลี้ยวที่สี่แยก: ถ้ารอคำนวณจากการขยับ แผนที่จะ
      // หมุนตามหลังทิศจริงจนกว่าจะขยับเกิน threshold ด้านล่างก่อน ดูเหมือน "ไม่หมุนตามรถ"
      // ทั้งที่จริงๆ กำลังจะหมุนอยู่แต่ช้า
      //
      // Fallback: ถ้าไม่มี heading จาก GPS (บาง device/บราวเซอร์ไม่รายงาน หรือรายงาน null
      // ตอนความเร็วต่ำ) ค่อยคำนวณทิศทางใหม่จากจุดสองจุดที่ผ่านมาเฉพาะตอนช่างขยับจริง (ระยะ
      // เกิน ~3 เมตร) กัน GPS สั่นตอนจอดนิ่งๆ ทำให้แผนที่หมุนกระตุกไปมาโดยไม่มีเหตุผล
      const prev = prevTechPosRef.current;
      const hasReliableHeading = techPos.heading != null && !Number.isNaN(techPos.heading);
      if (hasReliableHeading) {
        headingRef.current = techPos.heading as number;
      } else if (prev && distanceMeters(prev, techPos) > 3) {
        headingRef.current = computeBearing(prev, techPos);
      }
      prevTechPosRef.current = techPos;

      const isFirstFix = !hasCenteredOnTechRef.current;
      map.easeTo({
        center: [techPos.lng, techPos.lat],
        zoom: isFirstFix ? Math.max(map.getZoom(), 16) : map.getZoom(),
        bearing: headingRef.current,
        duration: isFirstFix ? 0 : 800,
      });
      hasCenteredOnTechRef.current = true;
      initialFrameDoneRef.current = true;
    } else if (!initialFrameDoneRef.current && boundsPoints.length > 0) {
      // ยังไม่มี GPS ช่างเข้ามาเลย แต่มีจุดอื่น (จุดเกิดเหตุ/อู่) ให้จัดกรอบแสดงให้เห็นก่อน
      fitMapToPoints(map, boundsPoints);
      initialFrameDoneRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techPos?.lat, techPos?.lng, isFollowing, isMapReady]);

  // ปิดโหมดตามติด (ผู้ใช้ลากเอง) → รีเซ็ต ref ไว้ เผื่อกดปุ่ม recenter กลับมาใหม่จะได้บังคับ
  // zoom ขั้นต่ำ 16 อีกครั้งเหมือนตอนเข้าโหมดครั้งแรก
  useEffect(() => {
    if (!isFollowing) hasCenteredOnTechRef.current = false;
  }, [isFollowing]);

  /** ปุ่มลอยมุมขวาล่าง — ถ้ามีตำแหน่งรถ (techPos) จะจัดกึ่งกลางที่ตัวรถโดยเฉพาะ หมุนกลับไป
   *  ตามทิศทางล่าสุด และเปิดโหมดตามติดกลับมา ถ้ายังไม่มีตำแหน่งรถ fallback เป็นจัดกรอบให้
   *  เห็นทุกจุดที่มีพิกัดแทน (เหนือขึ้นบน) */
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (techPos) {
      map.easeTo({
        center: [techPos.lng, techPos.lat],
        zoom: Math.max(map.getZoom(), 16),
        bearing: headingRef.current,
        duration: 500,
      });
      setIsFollowing(true);
    } else {
      fitMapToPoints(map, boundsPoints);
    }
  };

  return (
    <div
      className={`relative isolate w-full overflow-hidden ${
        fullBleed ? '' : 'rounded-2xl border border-slate-200 shadow-md'
      } ${heightClassName}`}
    >
      <div ref={containerRef} className="h-full w-full" />

      {boundsPoints.length > 0 && (
        <button
          type="button"
          onClick={handleRecenter}
          // fullBleed (โหมดนำทางเต็มจอ): ขยับปุ่มขึ้นให้พ้นการ์ดข้อมูลลูกค้าที่ลอยทับด้านล่างสุด
          // ของจอ (ฝั่งเรียกใช้ FullScreenNav ใน worker.tsx) ไม่งั้นปุ่มจะโดนการ์ดนั้นบังจนกดไม่ได้
          //
          // ไฮไลต์สีส้มตอนโหมดตามติดถูกปิดอยู่ (ผู้ใช้ลากแผนที่เอง) ให้ดูออกชัดว่ากดเพื่อกลับไป
          // ตามติดรถได้ — ตอนโหมดตามติดเปิดอยู่ปกติ (หรือไม่มี techPos ให้ตามติด) ใช้สีเทาเดิม
          className={`absolute ${
            fullBleed ? 'bottom-48' : 'bottom-16'
          } right-2.5 z-[1000] flex h-8 w-8 items-center justify-center rounded-full border shadow-md transition-all active:scale-95 ${
            techPos && !isFollowing
              ? 'border-orange-300 bg-orange-500 text-white'
              : 'border-slate-200 bg-white text-slate-600'
          }`}
          aria-label="จัดกึ่งกลางแผนที่"
        >
          <Navigation className="h-4 w-4" />
        </button>
      )}

      {/* Status Tag, ป้ายรอ GPS, และ Legend ทั้งสามอันนี้ซ่อนตอน fullBleed (โหมดนำทางเต็มจอ)
          เพราะฝั่งเรียกใช้ (FullScreenNav ใน worker.tsx) มีแถบสถานะ/ป้ายของตัวเองลอยทับอยู่แล้ว
          ตรงบริเวณเดียวกัน — โชว์ซ้ำสองชั้นจะรกจอโดยไม่จำเป็น */}
      {!fullBleed && (
        <>
          {/* Status Tag บนสุด */}
          <div className="absolute left-2.5 top-2.5 z-[1000] flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1 shadow-xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold text-slate-700">{statusLabel}</span>
          </div>

          {/* ยังไม่มี GPS จริงของช่างเข้ามาเลย — บอกตามตรงว่ากำลังรอสัญญาณ แทนที่จะแกล้งโชว์ตำแหน่งจำลอง */}
          {!techPos && (
            <div className="absolute left-2.5 top-11 z-[1000] flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/95 px-2.5 py-1 shadow-xs backdrop-blur-md">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-[9px] font-bold text-amber-700">กำลังรอสัญญาณ GPS จากช่าง...</span>
            </div>
          )}

          {/* Legend สรุปหมุดด้านล่างแผนที่ */}
          <div className="absolute bottom-2 left-2 right-2 z-[1000] flex items-center justify-around rounded-xl border border-slate-200/80 bg-white/95 p-1.5 text-[9px] font-bold text-slate-700 shadow-md backdrop-blur-md">
            <div className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border border-white bg-orange-500 shadow-xs" />
              <span>ช่างสีส้ม</span>
            </div>
            {showPickupMarker && (
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-white bg-red-500 shadow-xs" />
                <span>เกิดเหตุสีแดง</span>
              </div>
            )}
            {showGarageMarker && (
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 shadow-xs" />
                <span>จุดหมายสีเขียว</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
