'use client';

// ============================================================================
// components/LiveTrackingMap.tsx
// ----------------------------------------------------------------------------
// แผนที่ติดตามงานแบบ real-time จริง ใช้ Leaflet + OpenStreetMap tiles (ฟรี ไม่ต้อง
// มี API key) แทนของเดิมที่เป็น OpenStreetMap iframe แบบลาก/ซูมไม่ได้ + คำนวณตำแหน่ง
// หมุดเป็น % เทียบกับ bbox เอง (ซึ่งไม่แม่นเพราะ iframe ไม่ได้ render ตาม bbox ตรงเป๊ะ)
//
// อยู่แยกไฟล์ต่างหากโดยตั้งใจ — ต้อง import ไฟล์นี้แบบ dynamic({ ssr: false }) จากฝั่ง
// page.tsx เท่านั้น เพราะไลบรารี leaflet อ่านค่า window/document ตอน import ซึ่งจะพัง
// ถ้าโดน Next.js เรียกรันฝั่ง server (SSR) ไปด้วย การแยกไฟล์ทำให้ webpack ไม่ต้อง evaluate
// โค้ด leaflet ฝั่ง server เลย
//
// หมายเหตุ: เดิม tile server ใช้ tile.openstreetmap.org ตรง ๆ ซึ่งมี usage policy จำกัด
// ปริมาณ request ไม่เหมาะกับโปรดักชันที่มีผู้ใช้เยอะ — เปลี่ยนมาใช้ MapTiler (มี free tier
// ~100,000 tile loads/เดือน พอสำหรับแอปเริ่มต้น) ผ่านตัวแปรแวดล้อม
// NEXT_PUBLIC_MAPTILER_KEY แทน สมัครคีย์ฟรีได้ที่ https://cloud.maptiler.com/account/keys/
// ถ้ายังไม่ตั้งค่า NEXT_PUBLIC_MAPTILER_KEY (เช่นตอน dev เครื่องตัวเอง) โค้ดจะ fallback
// กลับไปใช้ tile.openstreetmap.org แบบเดิมให้อัตโนมัติ เพื่อไม่ให้แผนที่พังตอนยังไม่มีคีย์
// ============================================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, Navigation } from 'lucide-react';

export interface LatLng {
  lat: number;
  lng: number;
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
  /** ความสูงของกรอบแผนที่ (tailwind class เช่น 'h-64', 'h-36') ปรับได้ตามที่ที่ใช้แสดง ไม่ระบุ = h-64 */
  heightClassName?: string;
}

const makeDivIcon = (html: string, size: number) =>
  L.divIcon({
    html,
    className: '', // ล้าง class เริ่มต้นของ Leaflet (กรอบขาว/เงาเหลี่ยม) ออก ให้เหลือแค่ดีไซน์ของเราเอง
    iconSize: [size, size],
    // หมายเหตุ: anchor นี้เป็นค่าประมาณให้จุดกึ่งกลาง "วงกลม/หมุด" ตรงกับพิกัดจริง ไม่ใช่กึ่งกลาง
    // ของกล่องป้ายชื่อด้านบน ถ้าเปิดแอปจริงแล้วเห็นหมุดเยื้องจากตำแหน่งเล็กน้อย ปรับตัวเลขที่สองได้เลย
    iconAnchor: [size / 2, size - 14],
  });

// URL + attribution ของ tile server — ใช้ MapTiler ถ้ามีคีย์ (NEXT_PUBLIC_MAPTILER_KEY)
// ไม่งั้น fallback กลับไปใช้ OpenStreetMap tile server ตรง ๆ เหมือนเดิม (สำหรับ dev/ทดสอบ)
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const TILE_CONFIG = MAPTILER_KEY
  ? {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      attribution:
        '\u00a9 <a href="https://www.maptiler.com/copyright/">MapTiler</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }
  : {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    };

const techIcon = makeDivIcon(
  renderToStaticMarkup(
    <div className="flex flex-col items-center">
      <div className="mb-0.5 flex items-center gap-1 whitespace-nowrap rounded-md border border-white bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
        <Truck className="h-3 w-3" />
        <span>ช่างสไลด์</span>
      </div>
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-7 w-7 animate-ping rounded-full bg-orange-400 opacity-75" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-white shadow-lg">
          <Truck className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  ),
  56
);

const pickupIcon = makeDivIcon(
  renderToStaticMarkup(
    <div className="flex flex-col items-center">
      <div className="mb-0.5 whitespace-nowrap rounded-md border border-white bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
        จุดเกิดเหตุ
      </div>
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-red-400 opacity-75" />
        <MapPin className="relative h-7 w-7 fill-red-500 text-red-600 drop-shadow-md" />
      </div>
    </div>
  ),
  56
);

const garageIcon = makeDivIcon(
  renderToStaticMarkup(
    <div className="flex flex-col items-center">
      <div className="mb-0.5 whitespace-nowrap rounded-md border border-white bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
        จุดหมาย (อู่)
      </div>
      <MapPin className="h-7 w-7 fill-emerald-500 text-emerald-600 drop-shadow-md" />
    </div>
  ),
  48
);

/** fit bounds ให้เห็นทุกจุดพอดี — ทำแค่ตอนที่ "จำนวน" จุดที่มีพิกัดจริงเปลี่ยน (เช่น เพิ่งได้
 *  GPS ช่างเข้ามาเป็นครั้งแรก) ไม่ fit ซ้ำทุก tick ที่ตำแหน่งช่างขยับ เพราะจะไปแย่งการลาก/ซูม
 *  ที่ผู้ใช้กำลังทำเองอยู่ — ถ้าอยากจัดกึ่งกลางใหม่เองใช้ปุ่ม RecenterButton ด้านล่างแทน */
function FitBoundsOnce({ points, resetKey }: { points: LatLng[]; resetKey: number }) {
  const map = useMap();
  const firstFitDoneRef = useRef<number | null>(null);

  useEffect(() => {
    if (points.length === 0 || firstFitDoneRef.current === resetKey) return;
    firstFitDoneRef.current = resetKey;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      map.fitBounds(
        points.map((p) => [p.lat, p.lng] as [number, number]),
        { padding: [40, 40] }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return null;
}

/** ปุ่มลอยมุมขวาล่าง ให้ผู้ใช้สั่ง fit bounds ใหม่เองได้ทุกเมื่อ หลังจากลาก/ซูมเล่นเอง */
function RecenterButton({ points }: { points: LatLng[] }) {
  const map = useMap();
  if (points.length === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (points.length === 1) {
          map.setView([points[0].lat, points[0].lng], 15);
        } else {
          map.fitBounds(
            points.map((p) => [p.lat, p.lng] as [number, number]),
            { padding: [40, 40] }
          );
        }
      }}
      className="absolute bottom-16 right-2.5 z-[1000] flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all active:scale-95"
      aria-label="จัดกึ่งกลางแผนที่"
    >
      <Navigation className="h-4 w-4" />
    </button>
  );
}

export default function LiveTrackingMap({
  techPos,
  pickupPos,
  garagePos,
  showPickupMarker,
  showGarageMarker,
  statusLabel,
  heightClassName = 'h-64',
}: LiveTrackingMapProps) {
  const boundsPoints = useMemo(() => {
    const pts: LatLng[] = [];
    if (techPos) pts.push(techPos);
    if (showPickupMarker && pickupPos) pts.push(pickupPos);
    if (showGarageMarker && garagePos) pts.push(garagePos);
    return pts;
  }, [techPos, pickupPos, garagePos, showPickupMarker, showGarageMarker]);

  // resetKey เปลี่ยนทุกครั้งที่ "จำนวน" จุดที่มีพิกัดจริงเปลี่ยนไป ใช้เป็นตัวสั่ง fit bounds ใหม่
  const resetKey = boundsPoints.length;

  const defaultCenter: [number, number] = pickupPos
    ? [pickupPos.lat, pickupPos.lng]
    : garagePos
    ? [garagePos.lat, garagePos.lng]
    : [13.7563, 100.5018]; // fallback ใจกลางกรุงเทพฯ เผื่อยังไม่มีพิกัดอะไรเลยจริง ๆ

  return (
    <div className={`relative isolate w-full overflow-hidden rounded-2xl border border-slate-300/80 shadow-md ${heightClassName}`}>
      <MapContainer center={defaultCenter} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution={TILE_CONFIG.attribution}
          url={TILE_CONFIG.url}
        />
        <FitBoundsOnce points={boundsPoints} resetKey={resetKey} />
        <RecenterButton points={boundsPoints} />
        {techPos && <Marker position={[techPos.lat, techPos.lng]} icon={techIcon} />}
        {showPickupMarker && pickupPos && <Marker position={[pickupPos.lat, pickupPos.lng]} icon={pickupIcon} />}
        {showGarageMarker && garagePos && <Marker position={[garagePos.lat, garagePos.lng]} icon={garageIcon} />}
      </MapContainer>

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
    </div>
  );
}
