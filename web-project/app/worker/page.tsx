'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Geolocation } from '@capacitor/geolocation';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { supabase } from '@/lib/supabaseClient';

// แผนที่ติดตามงาน real-time จริงด้วย Leaflet (ใช้ไฟล์เดียวกับฝั่งลูกค้า) — ต้อง dynamic
// import แบบ ssr:false เพราะไลบรารี leaflet อ่านค่า window ตอน import ซึ่งจะพังถ้า
// Next.js เรียกรันฝั่ง server (ดูหมายเหตุเต็มในไฟล์ components/LiveTrackingMap.tsx)
const LiveTrackingMap = dynamic(() => import('@/components/LiveTrackingMap'), {
  ssr: false,
  // Skeleton แทนกล่องข้อความ "Loading..." เดิม — จำลองหน้าตาแผนที่คร่าวๆ (เส้นถนน + หมุด)
  // ด้วย CSS gradient/animate-pulse ล้วน ไม่ต้องพึ่งรูปภาพเพิ่ม ให้ความรู้สึกว่ากำลังโหลด
  // เนื้อหาจริงแทนกล่องว่างเฉยๆ
  loading: () => (
    <div className="relative h-36 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-800/40">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700/40 via-slate-600/20 to-slate-700/40" />
      <div className="absolute left-1/3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 animate-pulse rounded-full bg-slate-400/50" />
      <div className="absolute left-2/3 top-1/3 h-2.5 w-2.5 animate-pulse rounded-full bg-slate-400/40" />
    </div>
  ),
});

import {
  Wifi,
  WifiOff,
  Coffee,
  Zap,
  MapPin,
  Phone,
  AlertTriangle,
  PhoneCall,
  Navigation,
  Clock,
  DollarSign,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Home,
  History,
  User,
  LogOut,
  Truck,
  Car,
  X,
  Settings,
  Bell,
  BellOff,
  Vibrate,
  Battery,
  BatteryCharging,
  Moon,
  Sun,
  MessageSquare,
  Send,
  Menu,
  KeyRound,
  Edit3,
  Save,
  ArrowLeft,
  ShieldCheck,
  Check,
  BarChart3,
  Calendar,
  TrendingUp,
  Award,
  CircleDot,
  Wrench,
  Wallet,
  Headset,
  Shield,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Mail,
  ArrowRight,
  UserPlus,
  Upload,
  Building2,
  CreditCard,
  Banknote,
  Loader2,
  XCircle,
  ArrowUp,
  RefreshCw,
  GitFork,
  GitMerge,
  Flag,
} from 'lucide-react';
import {
  TowJob,
  TechStatus,
  TechnicianProfile,
  acceptJob as acceptJobApi,
  advanceJobStatus,
  upsertTechProfile,
  setTechStatus as setTechStatusApi,
  updateTechLocation,
  subscribeAllJobs,
  sendChatMessage,
  listPendingAndOwnJobs,
  registerTechnician,
  uploadTechDocument,
  saveTechRegistrationDetails,
  signInTechnician,
  signOutTechnician,
  getTechProfileIfExists,
  verifyJobPayment,
  rejectJobPayment,
  cancelJobByTech,
  computeRoute,
  declineJobOffer,
  expireStaleJobOffer,
  type RouteStep,
} from '@/lib/dtc-api';
import { signInWithLine, registerLineAuthListener } from '@/lib/lineAuth';
// ลบ import จาก '@/lib/dtc-shared' เดิมทิ้งแล้ว (ไฟล์นั้นเป็น localStorage mock
// ที่ไม่มีผลกับข้อมูลจริง) เปลี่ยนมาใช้ '@/lib/dtc-api' ที่คุยกับ Supabase จริงแทน

// ============================================================================
// Multi-language Translations (TH, EN, CN)
// ============================================================================
type Lang = 'TH' | 'EN' | 'CN';

// แปลง Lang ของแอปเป็น BCP-47 locale tag สำหรับ Intl API — module-level เพื่อให้
// component ย่อยๆ (PendingJobRow, ActiveJobCard ฯลฯ) ที่ประกาศแยกนอก component หลัก
// เรียกใช้ได้ด้วย ไม่ผูกกับ closure ของ component หลักเพียงอย่างเดียว
const LOCALE_MAP: Record<Lang, string> = {
  TH: 'th-TH',
  EN: 'en-US',
  CN: 'zh-Hans-CN',
};

// แก้บั๊ก: เดิมพึ่ง Intl numbering-system extension (-u-nu-hanidec) ให้ Intl.NumberFormat
// แปลงเป็นเลขจีนให้เอง แต่ extension นี้ fail แบบเงียบๆ (ไม่ throw error, แค่ fallback ไปเลข
// อาราบิกปกติ) บน runtime ที่ ICU data ไม่มี numbering system 'hanidec' ครบ ซึ่งพบได้บ่อยใน
// mobile WebView (แอปนี้รันผ่าน Capacitor) ต่างจาก Node.js/เบราว์เซอร์ desktop ที่มัก ICU เต็ม
// เลยเทสต์ผ่านตอน dev บนเครื่อง แต่พอรันจริงบนมือถือเลขไม่เปลี่ยน — แก้โดยแปลงเลขอาราบิก
// เป็นเลขจีนเองด้วย string replace แทน ไม่พึ่ง ICU numbering system เลย รับประกันได้ทุก runtime
const CN_DIGIT_MAP: Record<string, string> = {
  '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
};
const toChineseDigits = (str: string) => str.replace(/[0-9]/g, (d) => CN_DIGIT_MAP[d]);

// เบอร์โทรศูนย์/สำนักงานใหญ่ DTC — ใช้กับปุ่มโลโก้กลางแถบล่าง (ดูปุ่มใน Bottom Navigation)
// เดิมปุ่มนี้ตั้งใจไว้สำหรับฟีเจอร์สแกน QR ที่ยังไม่ได้ทำ เลยโชว์แค่ toast "เร็วๆ นี้" ลอยๆ
// เปลี่ยนให้กดแล้วโทรหาศูนย์ได้จริงทันที มีประโยชน์กว่าเวลาช่างเจอปัญหาเร่งด่วน/มีข้อพิพาท
// กับลูกค้า ไม่ต้องเข้าเมนู ☰ > ศูนย์ช่วยเหลือ ให้เสียเวลา
// ** TODO: ใส่เบอร์จริงของศูนย์/สำนักงานตรงนี้ก่อน deploy ใช้งานจริง **
const COMPANY_HOTLINE_NUMBER = '020000000';

// ระยะทางเส้นตรง (เมตร) ระหว่าง 2 พิกัด GPS — ใช้เช็คว่าช่างเบี่ยงออกนอกเส้นทางที่คำนวณไว้
// ล่าสุดไปไกลแค่ไหน (ดู useEffect คำนวณ routeGeometry) ไม่ต้องแม่นระดับถนนจริง แค่พอบอกว่า
// "ไกลจากจุดเดิมพอที่ควรรีรูทใหม่รึยัง" ก็พอ เลยใช้สูตร haversine ธรรมดาไม่ต้องพึ่ง API ภายนอก
const haversineDistanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ============================================================================
// Turn-by-turn (FullScreenNav): แปลง RouteStep (จาก compute-route) เป็นข้อความ/ไอคอน
// ลูกศรบอกทาง — steps อาจไม่มีเลยถ้า Edge Function เวอร์ชันเก่ายังไม่รองรับ ฝั่งเรียกใช้
// (FullScreenNav) ต้องเช็ค routeSteps.length === 0 แล้ว fallback เป็นป้ายระยะทางรวมแบบเดิม
// เอง ฟังก์ชันพวกนี้ไม่ได้ป้องกันกรณีนั้น (สมมติว่ามี step ส่งเข้ามาจริงเสมอ)
// ============================================================================

/** ประกอบข้อความบอกเลี้ยวจาก RouteStep เป็นภาษาที่เลือกไว้ (t = TRANSLATIONS[lang]) —
 *  ไม่ใช้ข้อความสำเร็จรูปจาก OSRM/ORS ตรงๆ เพราะ OSRM ไม่มีข้อความในตัวเลย และ ORS ไม่รองรับ
 *  ภาษาไทย จึงประกอบเองจาก maneuverType/modifier + ชื่อถนน (step.name) แทน */
function maneuverPhrase(step: RouteStep, t: Record<string, string>): string {
  if (step.maneuverType === 'arrive') return t.navArrive;

  let base: string;
  switch (step.maneuverType) {
    case 'depart':
      base = t.navDepart;
      break;
    case 'roundabout':
      base = t.navRoundabout;
      break;
    case 'merge':
      base = t.navMerge;
      break;
    case 'ramp':
      base = t.navRamp;
      break;
    case 'end_of_road':
      base = t.navEndOfRoad;
      break;
    case 'fork':
      base = t.navFork;
      break;
    default:
      // 'turn' / 'continue' / 'other' — ใช้ modifier เป็นตัวตัดสินทิศทางหลัก
      switch (step.modifier) {
        case 'left':
          base = t.navTurnLeft;
          break;
        case 'right':
          base = t.navTurnRight;
          break;
        case 'slight_left':
          base = t.navSlightLeft;
          break;
        case 'slight_right':
          base = t.navSlightRight;
          break;
        case 'sharp_left':
          base = t.navSharpLeft;
          break;
        case 'sharp_right':
          base = t.navSharpRight;
          break;
        case 'uturn':
          base = t.navUturn;
          break;
        default:
          base = t.navContinue;
      }
  }
  return step.name ? `${base} ${t.navOnto} ${step.name}` : base;
}

/** มุมหมุน (องศา) ของลูกศรทิศทางแบบ turn/continue — ลูกศรฐานชี้ขึ้น (0°) แล้วหมุนตามทิศ
 *  โดยประมาณ ไม่ใช่มุมจริงจาก bearing (แอปนี้ไม่ได้คำนวณ bearing ต่อ step) แค่พอสื่อทิศ
 *  คร่าวๆ ให้ตาดูออกว่าเลี้ยวไปทางไหนเหมือนไอคอนแอปนำทางทั่วไป */
const MODIFIER_ROTATION_DEG: Record<string, number> = {
  straight: 0,
  slight_right: 30,
  right: 60,
  sharp_right: 120,
  uturn: 180,
  sharp_left: -120,
  left: -60,
  slight_left: -30,
};

/** ไอคอนลูกศร/สัญลักษณ์บอกเลี้ยว — maneuverType บางแบบ (วงเวียน/รวมเลน/แยกทาง/ถึงจุดหมาย)
 *  มีไอคอนเฉพาะของตัวเองแทนลูกศรหมุน เพราะหมุนลูกศรธรรมดาแล้วดูไม่สื่อความหมาย */
function ManeuverArrow({ step, className }: { step: RouteStep; className?: string }) {
  switch (step.maneuverType) {
    case 'arrive':
      return <Flag className={className} />;
    case 'roundabout':
      return <RefreshCw className={className} />;
    case 'merge':
      return <GitMerge className={className} />;
    case 'ramp':
      return <GitMerge className={className} />;
    case 'fork':
      return <GitFork className={className} />;
    default: {
      const deg = step.modifier ? MODIFIER_ROTATION_DEG[step.modifier] ?? 0 : 0;
      return <ArrowUp className={className} style={{ transform: `rotate(${deg}deg)` }} />;
    }
  }
}

/** ระยะทางถึงจุดเลี้ยวถัดไป — เมตรถ้าใกล้ (อ่านง่ายกว่าทศนิยม กม.) กม.ถ้าไกล เหมือนแอปนำทาง
 *  ทั่วไป (ปัดเป็นเลขกลมๆ ทุก 10 เมตรตอนใกล้ ไม่ต้องละเอียดระดับเมตรเป๊ะ เพราะ GPS มือถือ
 *  เองก็ไม่แม่นระดับนั้นอยู่แล้ว) */
function formatManeuverDistance(meters: number, lang: Lang, t: Record<string, string>): string {
  if (meters < 1000) {
    const rounded = Math.max(0, Math.round(meters / 10) * 10);
    return `${formatNumberFor(rounded, lang)} ${t.unitM}`;
  }
  return `${formatNumberFor(Math.round((meters / 1000) * 10) / 10, lang)} ${t.unitKm}`;
}

const getLocaleTag = (lang: Lang) => LOCALE_MAP[lang];

// ใช้แปลงตัวเลข (ราคา, จำนวนงาน, คะแนน ฯลฯ) ให้ตรงกับภาษาที่เลือกอยู่ (lang) แทนการเรียก
// .toLocaleString() เปล่าๆ หรือแสดงตัวเลขดิบ ซึ่งจะได้เลขอาราบิกเสมอไม่ว่าจะเลือกภาษาจีนหรือไม่
const formatNumberFor = (value: number, lang: Lang, options?: Intl.NumberFormatOptions) => {
  const formatted = new Intl.NumberFormat(getLocaleTag(lang), options).format(value);
  return lang === 'CN' ? toChineseDigits(formatted) : formatted;
};

const LANG_FLAG: Record<Lang, string> = {
  TH: '🇹🇭',
  EN: '🇬🇧',
  CN: '🇨🇳',
};

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  TH: {
    appTitle: 'DTC ช่างบริการ',
    appSubTitle: 'ระบบรับงานยกรถ / รถสไลด์ฉุกเฉิน',
    login: 'เข้าสู่ระบบช่าง',
    forgotPassword: 'ลืมรหัสผ่าน?',
    email: 'อีเมล',
    signIn: 'เข้าสู่ระบบ',
    newAccountTab: 'สมัครสมาชิก',
    signUpWithEmail: 'สมัครด้วยอีเมล',
    signUpWithLine: 'สมัครด้วย Line',
    termsAgreePrefix: 'การเข้าสู่ระบบถือว่าคุณยอมรับ',
    termsOfService: 'ข้อกำหนดการใช้งาน',
    and: 'และ',
    privacyPolicy: 'นโยบายความเป็นส่วนตัว',
    welcomeTitle: 'ยินดีต้อนรับ',
    welcomeSubtitle: 'เครื่องมืออัจฉริยะ อัปเดตแบบเรียลไทม์ บริการลากรถที่ดียิ่งขึ้นไปด้วยกัน',
    navSupportTitle: 'นำทางและช่วยเหลือ',
    navSupportDesc: 'เส้นทางที่ดีที่สุดพร้อมทีมซัพพอร์ต 24 ชั่วโมง',
    jobMgmtTitle: 'จัดการงานอัจฉริยะ',
    jobMgmtDesc: 'รับงาน ตอบรับ และจัดการงานได้อย่างง่ายดาย',
    btnLogin: 'เข้าสู่ระบบ',
    btnCreateAccount: 'สร้างบัญชีใหม่',
    phone: 'เบอร์โทรศัพท์',
    password: 'รหัสผ่าน',
    resetPasswordTitle: 'รีเซ็ตรหัสผ่าน',
    resetPasswordDesc: 'กรอกเบอร์โทรศัพท์เพื่อรับรหัส OTP สำหรับตั้งรหัสผ่านใหม่',
    sendOtp: 'ส่งรหัส OTP',
    backToLogin: 'กลับไปหน้าเข้าสู่ระบบ',
    verifyOtpTitle: 'ยืนยันรหัส OTP',
    verifyOtpDesc: 'กรอกรหัส OTP ที่ได้รับทางเบอร์โทรศัพท์',
    verify: 'ยืนยัน',
    createNewPasswordTitle: 'ตั้งรหัสผ่านใหม่',
    newPasswordLabel: 'รหัสผ่านใหม่',
    confirmPasswordLabel: 'ยืนยันรหัสผ่านใหม่',
    resetSuccessTitle: 'ตั้งรหัสผ่านสำเร็จ',
    resetSuccessSub: 'คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที',
    backToLoginBtn: 'กลับไปเข้าสู่ระบบ',
    statusOnline: 'ออนไลน์',
    statusWorking: 'กำลังทำงาน',
    statusBreak: 'พัก',
    statusOffline: 'ออฟไลน์',
    todayEarnings: 'รายได้วันนี้',
    todayCompleted: 'งานที่เสร็จวันนี้',
    cashCollected: 'เงินสดวันนี้',
    transferCollected: 'โอนวันนี้',
    newJobs: 'งานเข้าใหม่',
    noJobs: 'ยังไม่มีงานเข้ามา รอสักครู่นะ',
    noActiveJob: 'ยังไม่มีงานที่กำลังทำอยู่ตอนนี้',
    goToMyJobsHint: 'แตะเพื่อดูรายละเอียดงานและแผนที่นำทาง',
    errRouteFallback: 'คำนวณเส้นทางตามถนนไม่ได้ตอนนี้ กำลังแสดงเส้นตรงชั่วคราวแทน',
    breakState: 'คุณกำลังพักอยู่',
    offlineState: 'คุณกำลังออฟไลน์อยู่ (ปิดรับงาน)',
    onlineInstruction: 'กด "ออนไลน์" ด้านบนเพื่อเริ่มรับงาน',
    tabHome: 'หน้าแรก',
    tabHistory: 'ประวัติงาน',
    tabMyJobs: 'งานของฉัน',
    tabScan: 'สแกน',
    tabCallOffice: 'โทรหาศูนย์',
    darkModeLabel: 'โหมดมืด',
    tabEarning: 'รายได้',
    newJobAlertTitle: 'เคสใหม่! กำลังรอคุณ',
    ratingAvgLabel: 'คะแนนเฉลี่ย',
    scanComingSoon: 'ฟีเจอร์สแกน QR อยู่ระหว่างพัฒนา',
    tabProfile: 'โปรไฟล์ช่าง',
    historyTitle: 'ประวัติงานที่เสร็จแล้ว',
    noHistory: 'ยังไม่มีประวัติงาน',
    editProfile: 'แก้ไขโปรไฟล์',
    saveProfile: 'บันทึกข้อมูล',
    cancel: 'ยกเลิก',
    name: 'ชื่อ-นามสกุล',
    plateNumber: 'ทะเบียนรถ',
    rating: 'คะแนนรีวิว',
    jobsDone: 'งานสะสม',
    unitJobs: 'งาน',
    unitKm: 'กม.',
    notifications: 'การแจ้งเตือน',
    soundNoti: 'เสียงแจ้งเตือนงานใหม่',
    vibrateNoti: 'สั่นเมื่อมีงานใหม่',
    logout: 'ออกจากระบบ (Log Out)',
    langSelect: 'เลือกภาษา',
    acceptJob: 'รับงานนี้',
    declineJob: 'ปฏิเสธงาน',
    callCustomer: 'โทร',
    chatCustomer: 'แชท',
    navigate: 'นำทาง',
    fullScreenNavBtn: 'โหมดนำทางเต็มจอ',
    stdPrice: 'ค่าบริการมาตรฐาน',
    activeJobTitle: 'งานปัจจุบัน',
    startRoute: 'เริ่มเดินทาง',
    arrivedLocation: 'ถึงจุดเกิดเหตุแล้ว',
    startLoading: 'เริ่มยกรถขึ้น',
    deliveringToGarage: 'นำส่งอู่ปลายทาง',
    finishJob: 'จบงาน / ถึงอู่แล้ว',
    jobAccepted: 'รับงานแล้ว',
    jobEnRoute: 'กำลังเดินทาง',
    jobArrived: 'ถึงจุดเกิดเหตุแล้ว',
    jobLoading: 'กำลังยกรถ',
    jobDelivering: 'กำลังนำส่งอู่',
    unitM: 'ม.',
    navTurnLeft: 'เลี้ยวซ้าย',
    navTurnRight: 'เลี้ยวขวา',
    navSlightLeft: 'เบี่ยงซ้ายเล็กน้อย',
    navSlightRight: 'เบี่ยงขวาเล็กน้อย',
    navSharpLeft: 'เลี้ยวซ้ายกะทันหัน',
    navSharpRight: 'เลี้ยวขวากะทันหัน',
    navUturn: 'กลับรถ',
    navContinue: 'ตรงไป',
    navRoundabout: 'เข้าวงเวียน',
    navMerge: 'เข้ารวมเส้นทาง',
    navRamp: 'เข้าทางลาด',
    navEndOfRoad: 'สุดถนน เลี้ยว',
    navFork: 'ชิดทางแยก',
    navDepart: 'เริ่มเดินทาง',
    navArrive: 'ถึงจุดหมายแล้ว',
    navOnto: 'เข้าสู่',
    dailySummary: 'สรุปรายวัน',
    monthlySummary: 'สรุปรายเดือน',
    totalIncome: 'รายได้รวม',
    totalJobsCount: 'จำนวนงานทั้งหมด',
    vehicleType: 'ประเภทรถบริการ',
    slideTruck: 'รถสไลด์ (Slide Tow Truck)',
    wheelLiftTruck: 'รถยกซ้อนล้อ (Wheel-Lift)',
    dashMenu: 'รายได้และกระเป๋าเงิน',
    menuWorkSection: 'การทำงาน',
    menuSystemSection: 'ระบบและการช่วยเหลือ',
    menuHome: 'หน้าแรก (รับงาน)',
    menuHistory: 'ประวัติการวิ่งงาน',
    menuVehicle: 'ข้อมูลรถและอุปกรณ์',
    menuProfile: 'โปรไฟล์และเอกสาร',
    menuNoti: 'ตั้งค่าการแจ้งเตือน',
    menuHelp: 'ศูนย์ช่วยเหลือ / ติดต่อคอลเซ็นเตอร์',
    menuSafety: 'นโยบายความปลอดภัย',
    menuSettings: 'ตั้งค่าแอปพลิเคชัน',
    joinIntro: 'เข้าร่วม Intelligent Towing และทำงานได้ง่ายขึ้น',
    fullNameLabel: 'ชื่อ-นามสกุล',
    fullNamePlaceholder: 'กรอกชื่อ-นามสกุล',
    employeeIdLabel: 'รหัสพนักงาน',
    employeeIdPlaceholder: 'กรอกรหัสพนักงาน',
    phonePlaceholder: 'กรอกเบอร์โทรศัพท์',
    emailPlaceholder: 'กรอกอีเมล',
    createPasswordPlaceholder: 'ตั้งรหัสผ่าน',
    confirmPasswordPlaceholder: 'ยืนยันรหัสผ่าน',
    passwordMustContain: 'รหัสผ่านต้องมี:',
    pwdReqLength: 'อย่างน้อย 8 ตัวอักษร',
    pwdReqUppercase: 'มีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว',
    pwdReqNumberSpecial: 'มีตัวเลขและอักขระพิเศษอย่างน้อย 1 ตัว',
    identityVerificationTitle: 'ยืนยันตัวตน',
    identityVerificationDesc: 'กรุณาอัปโหลดรูปถ่ายบัตรประชาชน/พาสปอร์ต/ใบขับขี่ที่ชัดเจน',
    uploadIdCard: 'อัปโหลดบัตรประชาชน / พาสปอร์ต / ใบขับขี่',
    companyVerificationTitle: 'ยืนยันบริษัท',
    uploadBusinessDoc: 'อัปโหลดใบอนุญาตธุรกิจ / ทะเบียนบริษัท (JPG, PNG หรือ PDF)',
    verifyPhoneTitle: 'ยืนยันเบอร์โทรศัพท์',
    verifyPhoneDesc: 'เราจะส่งรหัสยืนยัน 6 หลักไปยังเบอร์มือถือของคุณ',
    changePhone: 'เปลี่ยนเบอร์',
    verified: 'ยืนยันแล้ว',
    next: 'ถัดไป',
    submitting: 'กำลังดำเนินการ...',
    greetingMsg: 'สวัสดีครับ ผม{name} รับงานของคุณเรียบร้อยแล้วนะครับ กำลังเตรียมตัวออกเดินทางไปยังจุดเกิดเหตุ 🚚 มีอะไรสอบถามทักแชทหรือโทรหาผมได้เลยครับ',
    defaultTechName: 'ช่างบริการ',
    statusMsgEnRoute: 'ผมออกเดินทางแล้วนะครับ กำลังมุ่งหน้าไปยังจุดเกิดเหตุ 🚚',
    statusMsgArrivedTow: 'ถึงจุดเกิดเหตุแล้วครับ กำลังตรวจสอบสภาพรถและเตรียมอุปกรณ์ยกรถ',
    statusMsgArrivedOnSite: 'ถึงจุดเกิดเหตุแล้วครับ กำลังตรวจสอบสภาพรถและเตรียมอุปกรณ์',
    statusMsgLoading: 'กำลังยกรถขึ้นรถสไลด์ให้เรียบร้อยครับ รอสักครู่นะครับ',
    statusMsgDelivering: 'ยกรถเสร็จเรียบร้อยแล้ว กำลังนำรถไปส่งที่อู่ปลายทางครับ',
    statusMsgCompletedTow: 'ถึงอู่ปลายทางเรียบร้อยแล้วครับ งานเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการนะครับ 🙏',
    statusMsgCompletedOnSite: 'ซ่อมให้เรียบร้อยแล้วครับ งานเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการนะครับ 🙏',
    reportPromptTech: 'อธิบายปัญหาที่พบกับงานนี้สั้นๆ (เช่น ลูกค้าไม่จ่ายเงิน, เบี้ยวนัด):',
    reportPrefixTech: '[REPORT] ช่างรายงานปัญหา: ',
    reportSentSuccessTech: 'ส่งรายงานปัญหาแล้ว ทีมงานจะตรวจสอบให้',
    rejectPaymentCashMsg: 'ช่างแจ้งว่าจำนวนเงินสดที่ได้รับไม่ถูกต้อง กรุณาตรวจสอบและชำระใหม่ให้ตรงยอด',
    rejectPaymentSlipMsg: 'ช่างแจ้งว่าสลิปโอนเงินไม่ถูกต้องหรือยอดไม่ตรง กรุณาแนบสลิปใหม่อีกครั้งในหน้าแชตหรือหน้ารายละเอียดงาน',
    toastPaymentVerifyFail: 'ยืนยันการรับเงินไม่สำเร็จ ลองใหม่อีกครั้ง',
    toastPaymentVerified: 'ยืนยันรับเงินแล้ว',
    toastPaymentRejectFail: 'ปฏิเสธการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง',
    toastPaymentRejected: 'ปฏิเสธสลิป/การชำระเงินแล้ว',
    toastJobCancelled: 'ยกเลิกงาน {id} แล้ว',
    toastJobCancelFail: 'ยกเลิกงานไม่สำเร็จ: {reason}',
    genericRetry: 'ลองใหม่อีกครั้ง',
    toastFillEmailPassword: 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ',
    toastLoginSuccess: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ{name}',
    errInvalidCredentials: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    errLoginFailedGeneric: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    errLineLoginOpenFail: 'ไม่สามารถเปิดหน้าล็อกอิน LINE ได้ กรุณาลองใหม่อีกครั้ง',
    toastLineSignupNeeded: 'เข้าสู่ระบบด้วย LINE สำเร็จ กรุณากรอกข้อมูลให้ครบเพื่อสมัครสมาชิก',
    errLineLoginFailed: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    toastOtpSentToPhone: 'ส่งรหัส OTP ไปยังเบอร์ {phone} แล้ว',
    errNewPasswordRequired: 'กรุณากรอกรหัสผ่านใหม่',
    errPasswordMinLength: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
    errConfirmPasswordRequired: 'กรุณายืนยันรหัสผ่านใหม่',
    errPasswordMismatch: 'รหัสผ่านไม่ตรงกัน',
    errPhoneRequired: 'กรุณากรอกเบอร์โทรศัพท์ก่อน',
    toastOtpSentWithTest: 'ส่งรหัส OTP ไปยังเบอร์ {phone} แล้ว (รหัสทดสอบ: {otp})',
    errOtpInvalid: 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่',
    errFillAllFields: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
    errVerifyPhoneOtpFirst: 'กรุณายืนยันรหัส OTP ของเบอร์โทรศัพท์ก่อน',
    errPasswordRequirementsNotMet: 'รหัสผ่านไม่ตรงตามเงื่อนไขที่กำหนด',
    errPasswordConfirmMismatch: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน',
    errAttachIdDoc: 'กรุณาแนบเอกสารยืนยันตัวตน',
    errAttachBusinessDoc: 'กรุณาแนบเอกสารยืนยันบริษัท',
    toastSignupSuccess: 'สมัครสมาชิกสำเร็จ กรุณารอการตรวจสอบเอกสารจากทีมงาน',
    errSignupFailed: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่',
    errFillCompleteInfo: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    toastProfileSaved: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว',
    errActiveJobBlockStatus: 'มีงานค้างอยู่ ต้องทำงานปัจจุบันให้เสร็จก่อนเปลี่ยนสถานะ',
    toastJobAccepted: 'รับงาน {id} เรียบร้อย กำลังไปหาลูกค้า',
    errAcceptJobFailed: 'เกิดข้อผิดพลาดในการกดรับงาน',
    toastJobDeclined: 'ปฏิเสธงาน {id} แล้ว ระบบจะหาช่างคนถัดไป',
    errConfirmPaymentBeforeFinish: 'กรุณากดยืนยันการรับเงิน (เงินสด/สลิป) ก่อนกดจบงาน',
    errUpdateStatusFailed: 'อัปเดตสถานะงานไม่สำเร็จ กรุณาลองใหม่',
    toastJobCompleted: 'งาน {id} เสร็จสมบูรณ์! ได้รับ ฿{amount}',
    avatarFallback: 'ช',
    lineAuthOpening: 'กำลังเปิดหน้า LINE...',
    lineIdentityVerifiedNote: 'ยืนยันตัวตนด้วย LINE แล้ว ไม่ต้องตั้งอีเมล/รหัสผ่าน',
    otpNotConnectedNote: 'ยังไม่ได้เชื่อมระบบส่ง SMS จริง — รหัสทดสอบของคุณคือ',
    newPasswordPlaceholder: 'กรอกรหัสผ่านใหม่',
    confirmNewPasswordPlaceholder: 'กรอกรหัสผ่านใหม่อีกครั้ง',
    appVersionFooter: 'เวอร์ชัน 1.0.4 (Mechanic Edition)',
    dashSubtitle: 'ภาพรวมสถิติการทำงานและรายได้',
    last7Days: '7 วันล่าสุด',
    last6Months: '6 เดือนล่าสุด',
    closeWindow: 'ปิดหน้าต่าง',
    closeThisWindow: 'ปิดหน้าต่างนี้',
    noCustomerName: 'ไม่ระบุชื่อลูกค้า',
    noCustomerPhone: 'ไม่ระบุเบอร์โทร',
    noIssueType: 'ไม่ระบุอาการเสีย',
    noPickupAddress: 'ไม่ระบุตำแหน่ง',
    vsYesterday: 'จากเมื่อวาน',
    reportIssueBtn: 'รายงานปัญหา',
    slideTruckLabel: 'รถสไลด์',
    wheelLiftTruckLabel: 'รถยกซ้อนล้อ',
    personalVehicleLabel: 'รถซ่อมเคลื่อนที่',
    onSiteServiceTitle: 'บริการซ่อมหน้างาน (ไม่ลากรถ)',
    onSiteServiceDesc: 'เลือกเฉพาะบริการที่มีอุปกรณ์พร้อมจริง ระบบจะส่งเคสประเภทนี้มาให้ทันทีที่ติ๊ก',
    jumpStartLabel: 'พ่วงแบตเตอรี่',
    jumpStartSubLabel: 'Jump Start / เปลี่ยนแบต',
    tireChangeLabel: 'เปลี่ยน/ปะยาง',
    receiptCompletedTitle: 'จบงานเรียบร้อย!',
    receiptJobDoneMsg: 'งาน {id} เสร็จสมบูรณ์แล้ว',
    receiptSummaryTitle: 'สรุปค่าบริการ',
    customerLabel: 'ลูกค้า',
    serviceFeeLabel: 'ค่าบริการ',
    paymentMethodLabel: 'วิธีชำระเงิน',
    paymentMethodCash: 'เงินสด',
    paymentMethodCreditCard: 'บัตรเครดิต/เดบิต',
    paymentMethodTransfer: 'PromptPay / โอนเงิน',
    paymentStatusLabel: 'สถานะการรับเงิน',
    paymentStatusAutoCard: 'ตัดบัตรอัตโนมัติ',
    paymentConfirmedText: 'ยืนยันรับเงินแล้ว',
    paymentStatusNoInfo: 'ไม่มีข้อมูลการชำระเงิน',
    navigateConfirmTitle: 'ยืนยันก่อนนำทาง',
    navigateConfirmDesc: 'เช็คข้อมูลงานนี้ให้ตรงก่อนออกไปจริง',
    openMapsNav: 'เปิด Maps นำทาง',
    callCustomerBeforeDeparture: 'โทรหาลูกค้าก่อนออกเดินทาง',
    chatCustomerJobLabel: 'ลูกค้า · งาน {id}',
    noMessagesYet: 'ยังไม่มีข้อความ เริ่มทักทายลูกค้าได้เลย',
    typeMessagePlaceholder: 'พิมพ์ข้อความ...',
    outgoingCallLabel: 'กำลังโทรออกหาลูกค้า',
    openPhoneAppToCall: 'เปิดแอปโทรศัพท์เพื่อโทรออก',
    incomingCallLabel: 'สายเรียกเข้าจากลูกค้า',
    declineBtn: 'ปฏิเสธ',
    answerCallBtn: 'รับสาย',
    cancelStuckTitle: 'ยกเลิกงานนี้?',
    cancelStuckDesc: 'ใช้เมื่อติดปัญหาไปต่อไม่ได้จริงๆ เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ ระบบจะแจ้งลูกค้าอัตโนมัติและปลดสถานะให้คุณรับงานใหม่ได้ทันที',
    cancelStuckReasonPlaceholder: 'เหตุผล (ไม่บังคับ) เช่น ลูกค้าไม่แนบสลิปใหม่เกิน 15 นาที',
    dontCancelBtn: 'ไม่ยกเลิก',
    confirmCancelBtn: 'ยืนยันยกเลิก',
    techLabelWheelLift: 'ช่างยกซ้อนล้อ',
    techLabelPersonal: 'ช่างซ่อมเคลื่อนที่',
    techLabelSlide: 'ช่างสไลด์',
    techLabelGeneric: 'ช่าง',
    noGpsCoords: 'ไม่มีพิกัด GPS ของจุดรับงาน',
    cashReceivedDone: 'รับเงินสดแล้ว',
    cashPendingOnSite: 'รอรับเงินสดหน้างาน',
    cardChargedDone: 'ตัดบัตรแล้ว',
    cardChargePending: 'รอระบบตัดบัตร',
    customerPaidCash: 'ลูกค้าเลือกชำระเป็นเงินสด',
    customerPaidCard: 'ลูกค้าเลือกชำระผ่านบัตรเครดิต/เดบิต',
    amountShort: 'เงินไม่ครบ',
    confirmCashReceived: 'ยืนยันรับเงินสดแล้ว',
    paymentRejectedWaitingNewCash: 'ปฏิเสธแล้ว รอลูกค้าชำระใหม่',
    transferSlipLabel: 'สลิปโอนเงิน',
    paymentStatusRejected: 'ถูกปฏิเสธ',
    paymentStatusPendingReview: 'รอตรวจสอบ',
    customerNoSlipYet: 'ลูกค้ายังไม่ได้แนบสลิป',
    slipInvalidFake: 'สลิปผิด/ปลอม',
    paymentRejectedWaitingNewSlip: 'ปฏิเสธแล้ว รอลูกค้าแนบสลิปใหม่',
    noPaymentInfoFromCustomer: 'ยังไม่มีข้อมูลการชำระเงินจากลูกค้า',
    confirmPaymentBeforeFinishNote: 'กรุณายืนยันการรับเงินด้านบนก่อน จึงจะกดจบงานได้',
    cancelStuckJobBtn: 'ยกเลิกงานนี้ (ติดปัญหา ไปต่อไม่ได้)',
    mapLoadingText: 'กำลังโหลดแผนที่...',
    offlineWarningBanner: 'ขาดการเชื่อมต่ออินเทอร์เน็ต — ตำแหน่ง GPS และข้อมูลงานอาจไม่อัปเดต',
    notificationsTitle: 'การแจ้งเตือน',
    markAllReadBtn: 'ทำเครื่องหมายว่าอ่านทั้งหมด',
    noNotificationsYet: 'ยังไม่มีการแจ้งเตือน',
    profilePersonalInfo: 'ข้อมูลส่วนตัว',
    profilePersonalInfoSub: 'ชื่อ, อีเมล, ...',
    profileAccountInfoTitle: 'ข้อมูลบัญชี',
    profileAccountInfoSub: 'ข้อมูลส่วนตัว, บัญชีธนาคาร, ช่วยเหลือ, เอกสาร',
    profileBankDetails: 'บัญชีธนาคาร & การชำระเงิน',
    profileBankDetailsSub: 'ตั้งค่าบัญชีรับเงินและข้อมูลการชำระเงิน',
    profileNotiSub: 'แจ้งเตือนและอัปเดตของคุณ',
    profileSettingsSub: 'ธีมแอป และอื่นๆ',
    profileHelpSupport: 'ศูนย์ช่วยเหลือ',
    profileHelpSupportSub: 'ติดต่อฝ่ายสนับสนุน',
    profileDocuments: 'เอกสาร',
    profileDocumentsVerified: 'ยืนยันแล้ว',
    profileStatusOnline: 'ออนไลน์',
    profileStatusOffline: 'ออฟไลน์',
    myPerformance: 'สรุปผลงานของฉัน',
    viewDetails: 'ดูรายละเอียด',
    completionRate: 'อัตราจบงานสำเร็จ',
    rankLabel: 'อันดับ',
    daysActive: 'วันที่ใช้งาน',
    featureComingSoon: 'ฟีเจอร์นี้อยู่ระหว่างการพัฒนา เร็วๆ นี้',
    collectVehicleLabel: 'จุดรับรถ',
    vehicleDestinationLabel: 'จุดหมายปลายทาง',
    estimatedCostLabel: 'ราคาประเมิน',
    moreJobsWaitingLabel: 'มีงานรอคิวถัดไปอีก',
    confirmDeclineTitle: 'ต้องการปฏิเสธเคสนี้จริงหรือไม่?',
    confirmDeclineDesc: 'เคสนี้จะถูกส่งต่อให้ช่างคนอื่นทันที และจะไม่แสดงในหน้าจอของคุณอีก',
    dontDeclineBtn: 'ไม่ปฏิเสธ',
    confirmDeclineBtn: 'ยืนยันปฏิเสธ',
  },
  EN: {
    appTitle: 'DTC Service Tech',
    appSubTitle: 'Towing & Slide Truck Service App',
    login: 'Technician Login',
    forgotPassword: 'Forgot Password?',
    email: 'Email',
    signIn: 'Sign In',
    newAccountTab: 'New Account',
    signUpWithEmail: 'Sign up with Email',
    signUpWithLine: 'Sign up with Line',
    termsAgreePrefix: 'By signing in, you agree to our',
    termsOfService: 'Terms of Service',
    and: 'and',
    privacyPolicy: 'Privacy Policy',
    welcomeTitle: 'Welcome',
    welcomeSubtitle: 'Smart tools. Real-time updates. Better towing services, together.',
    navSupportTitle: 'Navigation & Support',
    navSupportDesc: 'Get the best routes and 24/7 support anytime.',
    jobMgmtTitle: 'Smart Job Management',
    jobMgmtDesc: 'Receive, accept and manage works with ease.',
    btnLogin: 'Log in',
    btnCreateAccount: 'Create New Account',
    phone: 'Phone Number',
    password: 'Password',
    resetPasswordTitle: 'Reset Password',
    resetPasswordDesc: 'Enter your phone number to receive an OTP code',
    sendOtp: 'Send OTP',
    backToLogin: 'Back to Login',
    verifyOtpTitle: 'Verify OTP',
    verifyOtpDesc: 'Enter the OTP code sent to your phone number',
    verify: 'Verify',
    createNewPasswordTitle: 'Create New Password',
    newPasswordLabel: 'New Password',
    confirmPasswordLabel: 'Confirm New Password',
    resetSuccessTitle: 'Password Reset Successful',
    resetSuccessSub: 'You can now log in with your new password',
    backToLoginBtn: 'Back to Login',
    statusOnline: 'Online',
    statusWorking: 'Working',
    statusBreak: 'Break',
    statusOffline: 'Offline',
    todayEarnings: "Today's Earnings",
    todayCompleted: "Today's Completed",
    cashCollected: 'Cash Today',
    transferCollected: 'Transfer Today',
    newJobs: 'Incoming Jobs',
    noJobs: 'No active job requests',
    noActiveJob: 'No active job right now',
    goToMyJobsHint: 'Tap to view job details and route',
    errRouteFallback: 'Could not calculate a road route right now — showing a straight line instead.',
    breakState: 'You are currently on break',
    offlineState: 'You are Offline (Not receiving jobs)',
    onlineInstruction: 'Switch to "Online" above to start receiving jobs',
    tabHome: 'Home',
    tabHistory: 'Job History',
    tabMyJobs: 'My Jobs',
    tabScan: 'Scan',
    tabCallOffice: 'Call Office',
    darkModeLabel: 'Dark Mode',
    tabEarning: 'Earning',
    newJobAlertTitle: 'New Case! Waiting for you',
    ratingAvgLabel: 'Average Rating',
    scanComingSoon: 'QR Scan feature is coming soon',
    tabProfile: 'Tech Profile',
    historyTitle: 'Completed Job History',
    noHistory: 'No job history found',
    editProfile: 'Edit Profile',
    saveProfile: 'Save Changes',
    cancel: 'Cancel',
    name: 'Full Name',
    plateNumber: 'License Plate',
    rating: 'Rating',
    jobsDone: 'Jobs Completed',
    unitJobs: 'jobs',
    unitKm: 'km',
    notifications: 'Notifications',
    soundNoti: 'New job sound alert',
    vibrateNoti: 'New job vibration',
    logout: 'Log Out',
    langSelect: 'Select Language',
    acceptJob: 'Accept Job',
    declineJob: 'Decline',
    callCustomer: 'Call',
    chatCustomer: 'Chat',
    navigate: 'Navigate',
    fullScreenNavBtn: 'Full-screen navigation',
    stdPrice: 'Standard Fee',
    activeJobTitle: 'Active Job',
    startRoute: 'Start Route',
    arrivedLocation: 'Arrived at Site',
    startLoading: 'Start Towing/Loading',
    deliveringToGarage: 'Deliver to Garage',
    finishJob: 'Complete Job',
    jobAccepted: 'Accepted',
    jobEnRoute: 'En Route',
    jobArrived: 'Arrived',
    jobLoading: 'Loading Car',
    jobDelivering: 'Delivering',
    unitM: 'm',
    navTurnLeft: 'Turn left',
    navTurnRight: 'Turn right',
    navSlightLeft: 'Slight left',
    navSlightRight: 'Slight right',
    navSharpLeft: 'Sharp left',
    navSharpRight: 'Sharp right',
    navUturn: 'Make a U-turn',
    navContinue: 'Continue straight',
    navRoundabout: 'Enter the roundabout',
    navMerge: 'Merge',
    navRamp: 'Take the ramp',
    navEndOfRoad: 'At the end of the road, turn',
    navFork: 'Keep at the fork',
    navDepart: 'Head out',
    navArrive: 'You have arrived',
    navOnto: 'onto',
    dailySummary: 'Daily Report',
    monthlySummary: 'Monthly Report',
    totalIncome: 'Total Earnings',
    totalJobsCount: 'Total Jobs',
    vehicleType: 'Vehicle Type',
    slideTruck: 'Slide Tow Truck',
    wheelLiftTruck: 'Wheel-Lift Tow Truck',
    dashMenu: 'Earnings & Wallet',
    menuWorkSection: 'Work Features',
    menuSystemSection: 'System & Support',
    menuHome: 'Home (Accept Jobs)',
    menuHistory: 'Job History',
    menuVehicle: 'Vehicle & Equipment',
    menuProfile: 'Profile & Documents',
    menuNoti: 'Notification Settings',
    menuHelp: 'Help Center / Call Center',
    menuSafety: 'Safety Policy',
    menuSettings: 'App Settings',
    joinIntro: 'Join Intelligent Towing and simplify your work.',
    fullNameLabel: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    employeeIdLabel: 'Employee ID',
    employeeIdPlaceholder: 'Enter Employee ID',
    phonePlaceholder: 'Enter phone number',
    emailPlaceholder: 'Enter Email Address',
    createPasswordPlaceholder: 'Create a password',
    confirmPasswordPlaceholder: 'Confirm your password',
    passwordMustContain: 'Password must contain:',
    pwdReqLength: 'At least 8 characters',
    pwdReqUppercase: 'One uppercase letter',
    pwdReqNumberSpecial: 'One number & special character',
    identityVerificationTitle: 'Identity Verification',
    identityVerificationDesc: 'Please upload a clear photo of your Government ID.',
    uploadIdCard: "Upload ID Card / Passport / Driver's License",
    companyVerificationTitle: 'Company Verification',
    uploadBusinessDoc: 'Upload Business License / Company Registration (JPG, PNG or PDF)',
    verifyPhoneTitle: 'Verify your phone number',
    verifyPhoneDesc: 'We will send a 6-digits verification code to your mobile number.',
    changePhone: 'Change',
    verified: 'Verified',
    next: 'NEXT',
    submitting: 'Submitting...',
    greetingMsg: "Hi, this is {name}. I've accepted your job and I'm getting ready to head to your location 🚚 Feel free to message or call me if you have any questions.",
    defaultTechName: 'your technician',
    statusMsgEnRoute: "I'm on my way to your location now 🚚",
    statusMsgArrivedTow: "I've arrived at the location. Checking the vehicle and preparing the towing equipment.",
    statusMsgArrivedOnSite: "I've arrived at the location. Checking the vehicle and preparing the equipment.",
    statusMsgLoading: 'Loading the vehicle onto the slide truck now, please wait a moment.',
    statusMsgDelivering: 'Vehicle loaded. On the way to the destination garage now.',
    statusMsgCompletedTow: "Arrived at the destination garage. Job complete — thank you for using our service! 🙏",
    statusMsgCompletedOnSite: 'Repair completed on-site. Job complete — thank you for using our service! 🙏',
    reportPromptTech: 'Briefly describe the issue with this job (e.g. customer did not pay, no-show):',
    reportPrefixTech: '[REPORT] Technician reported an issue: ',
    reportSentSuccessTech: 'Report sent. Our team will review it.',
    rejectPaymentCashMsg: 'The technician reports the cash amount received was incorrect. Please check and pay the correct amount.',
    rejectPaymentSlipMsg: 'The technician reports the payment slip is invalid or the amount does not match. Please attach a new slip in the chat or job details screen.',
    toastPaymentVerifyFail: 'Payment confirmation failed. Please try again.',
    toastPaymentVerified: 'Payment confirmed',
    toastPaymentRejectFail: 'Failed to reject payment. Please try again.',
    toastPaymentRejected: 'Payment/slip rejected',
    toastJobCancelled: 'Job {id} cancelled',
    toastJobCancelFail: 'Failed to cancel job: {reason}',
    genericRetry: 'Please try again',
    toastFillEmailPassword: 'Please fill in both email and password',
    toastLoginSuccess: 'Login successful. Welcome, {name}',
    errInvalidCredentials: 'Incorrect email or password',
    errLoginFailedGeneric: 'Login failed. Please try again.',
    errLineLoginOpenFail: 'Unable to open the LINE login page. Please try again.',
    toastLineSignupNeeded: 'LINE login successful. Please complete your registration.',
    errLineLoginFailed: 'LINE login failed. Please try again.',
    toastOtpSentToPhone: 'OTP sent to {phone}',
    errNewPasswordRequired: 'Please enter a new password',
    errPasswordMinLength: 'Password must be at least 6 characters',
    errConfirmPasswordRequired: 'Please confirm your new password',
    errPasswordMismatch: 'Passwords do not match',
    errPhoneRequired: 'Please enter your phone number first',
    toastOtpSentWithTest: 'OTP sent to {phone} (test code: {otp})',
    errOtpInvalid: 'Invalid OTP. Please try again.',
    errFillAllFields: 'Please fill in all fields',
    errVerifyPhoneOtpFirst: 'Please verify your phone OTP first',
    errPasswordRequirementsNotMet: 'Password does not meet the requirements',
    errPasswordConfirmMismatch: 'Password and confirmation do not match',
    errAttachIdDoc: 'Please attach your ID verification document',
    errAttachBusinessDoc: 'Please attach your business verification document',
    toastSignupSuccess: 'Registration successful. Please wait for document verification.',
    errSignupFailed: 'Registration failed. Please try again.',
    errFillCompleteInfo: 'Please fill in all information',
    toastProfileSaved: 'Profile saved successfully',
    errActiveJobBlockStatus: 'You have an active job. Finish it before changing your status.',
    toastJobAccepted: 'Job {id} accepted. Heading to the customer.',
    errAcceptJobFailed: 'Something went wrong while accepting the job',
    toastJobDeclined: 'Job {id} declined. The system will find the next technician.',
    errConfirmPaymentBeforeFinish: 'Please confirm payment (cash/slip) before finishing the job',
    errUpdateStatusFailed: 'Failed to update job status. Please try again.',
    toastJobCompleted: 'Job {id} completed! Received ฿{amount}',
    avatarFallback: 'T',
    lineAuthOpening: 'Opening LINE...',
    lineIdentityVerifiedNote: 'Identity verified via LINE. No need to set an email/password.',
    otpNotConnectedNote: 'SMS sending is not yet connected — your test code is',
    newPasswordPlaceholder: 'Enter new password',
    confirmNewPasswordPlaceholder: 'Re-enter new password',
    appVersionFooter: 'Version 1.0.4 (Mechanic Edition)',
    dashSubtitle: 'Overview of your work stats and earnings',
    last7Days: 'Last 7 days',
    last6Months: 'Last 6 months',
    closeWindow: 'Close',
    closeThisWindow: 'Close this window',
    noCustomerName: 'Customer name not provided',
    noCustomerPhone: 'Phone number not provided',
    noIssueType: 'Issue not specified',
    noPickupAddress: 'Location not specified',
    vsYesterday: 'vs yesterday',
    reportIssueBtn: 'Report Problem',
    slideTruckLabel: 'Slide Truck',
    wheelLiftTruckLabel: 'Wheel-Lift Truck',
    personalVehicleLabel: 'Mobile Repair Vehicle',
    onSiteServiceTitle: 'On-site Repair Services (No Towing)',
    onSiteServiceDesc: 'Only select services you have the equipment ready for — the system will start sending you these job types as soon as you check them.',
    jumpStartLabel: 'Jump Start',
    jumpStartSubLabel: 'Jump Start / Battery Replacement',
    tireChangeLabel: 'Tire Change/Repair',
    receiptCompletedTitle: 'Job Completed!',
    receiptJobDoneMsg: 'Job {id} is fully completed',
    receiptSummaryTitle: 'Service Summary',
    customerLabel: 'Customer',
    serviceFeeLabel: 'Service Fee',
    paymentMethodLabel: 'Payment Method',
    paymentMethodCash: 'Cash',
    paymentMethodCreditCard: 'Credit/Debit Card',
    paymentMethodTransfer: 'PromptPay / Bank Transfer',
    paymentStatusLabel: 'Payment Status',
    paymentStatusAutoCard: 'Auto Card Charge',
    paymentConfirmedText: 'Payment Confirmed',
    paymentStatusNoInfo: 'No payment information',
    navigateConfirmTitle: 'Confirm before navigating',
    navigateConfirmDesc: 'Double-check this job\'s details before heading out',
    openMapsNav: 'Open Maps Navigation',
    callCustomerBeforeDeparture: 'Call customer before heading out',
    chatCustomerJobLabel: 'Customer · Job {id}',
    noMessagesYet: 'No messages yet. Say hello to your customer.',
    typeMessagePlaceholder: 'Type a message...',
    outgoingCallLabel: 'Calling customer...',
    openPhoneAppToCall: 'Open phone app to call',
    incomingCallLabel: 'Incoming call from customer',
    declineBtn: 'Decline',
    answerCallBtn: 'Answer',
    cancelStuckTitle: 'Cancel this job?',
    cancelStuckDesc: 'Use this only when you\'re genuinely stuck — e.g. the customer never re-attached a slip after rejection. The system will notify the customer automatically and free you up to accept new jobs right away.',
    cancelStuckReasonPlaceholder: 'Reason (optional), e.g. customer hasn\'t re-attached a slip for over 15 minutes',
    dontCancelBtn: 'Don\'t Cancel',
    confirmCancelBtn: 'Confirm Cancel',
    techLabelWheelLift: 'Wheel-Lift Technician',
    techLabelPersonal: 'Mobile Repair Technician',
    techLabelSlide: 'Slide Truck Technician',
    techLabelGeneric: 'Technician',
    noGpsCoords: 'No GPS coordinates for the pickup location',
    cashReceivedDone: 'Cash Received',
    cashPendingOnSite: 'Awaiting cash on-site',
    cardChargedDone: 'Card Charged',
    cardChargePending: 'Awaiting card charge',
    customerPaidCash: 'Customer chose to pay by cash',
    customerPaidCard: 'Customer chose to pay by credit/debit card',
    amountShort: 'Amount Incorrect',
    confirmCashReceived: 'Confirm Cash Received',
    paymentRejectedWaitingNewCash: 'Rejected — waiting for customer to pay again',
    transferSlipLabel: 'Transfer Slip',
    paymentStatusRejected: 'Rejected',
    paymentStatusPendingReview: 'Pending Review',
    customerNoSlipYet: 'Customer has not attached a slip yet',
    slipInvalidFake: 'Invalid/Fake Slip',
    paymentRejectedWaitingNewSlip: 'Rejected — waiting for customer to attach a new slip',
    noPaymentInfoFromCustomer: 'No payment information from customer yet',
    confirmPaymentBeforeFinishNote: 'Please confirm payment above before finishing the job',
    cancelStuckJobBtn: 'Cancel This Job (Stuck, Can\'t Proceed)',
    mapLoadingText: 'Loading map...',
    offlineWarningBanner: 'No internet connection — GPS location and job data may not update',
    notificationsTitle: 'Notifications',
    markAllReadBtn: 'Mark All as Read',
    noNotificationsYet: 'No notifications yet',
    profilePersonalInfo: 'Personal Information',
    profilePersonalInfoSub: 'Name, Email, ...',
    profileAccountInfoTitle: 'Account Info',
    profileAccountInfoSub: 'Personal info, bank details, support, documents',
    profileBankDetails: 'Bank & Payment Details',
    profileBankDetailsSub: 'Update your payout account and payment info',
    profileNotiSub: 'Your alerts and updates',
    profileSettingsSub: 'App theme, more',
    profileHelpSupport: 'Help & Support',
    profileHelpSupportSub: 'Contact support',
    profileDocuments: 'Documents',
    profileDocumentsVerified: 'Verified',
    profileStatusOnline: 'Online',
    profileStatusOffline: 'Offline',
    myPerformance: 'My Performance',
    viewDetails: 'View Details',
    completionRate: 'Completion Rate',
    rankLabel: 'Rank',
    daysActive: 'Days Active',
    featureComingSoon: 'This feature is coming soon',
    collectVehicleLabel: 'Collect Vehicle',
    vehicleDestinationLabel: 'Vehicle Destination',
    estimatedCostLabel: 'Estimated Cost',
    moreJobsWaitingLabel: 'More jobs waiting in queue',
    confirmDeclineTitle: 'Decline this case?',
    confirmDeclineDesc: 'This case will be offered to another technician right away and will no longer show on your screen.',
    dontDeclineBtn: "Don't Decline",
    confirmDeclineBtn: 'Confirm Decline',
  },
   CN: {
    appTitle: 'DTC 技师端',
    appSubTitle: '紧急拖车与平板车救援系统',
    login: '技师登录',
    forgotPassword: '忘记密码？',
    email: '邮箱',
    signIn: '登录',
    newAccountTab: '注册新账号',
    signUpWithEmail: '使用邮箱注册',
    signUpWithLine: '使用 Line 注册',
    termsAgreePrefix: '登录即表示您同意我们的',
    termsOfService: '服务条款',
    and: '与',
    privacyPolicy: '隐私政策',
    welcomeTitle: '欢迎',
    welcomeSubtitle: '智能工具，实时更新，共创更优质的拖车服务。',
    navSupportTitle: '导航与支持',
    navSupportDesc: '随时获取最佳路线和 24/7 支持。',
    jobMgmtTitle: '智能订单管理',
    jobMgmtDesc: '轻松接收、接受并管理订单。',
    btnLogin: '登录',
    btnCreateAccount: '创建新账号',
    phone: '手机号码',
    password: '密码',
    resetPasswordTitle: '重置密码',
    resetPasswordDesc: '输入您的手机号码以接收 OTP 验证码',
    sendOtp: '发送 OTP 验证码',
    backToLogin: '返回登录',
    verifyOtpTitle: '验证 OTP',
    verifyOtpDesc: '输入发送至您手机的 OTP 验证码',
    verify: '验证',
    createNewPasswordTitle: '设置新密码',
    newPasswordLabel: '新密码',
    confirmPasswordLabel: '确认新密码',
    resetSuccessTitle: '密码重置成功',
    resetSuccessSub: '您现在可以使用新密码登录',
    backToLoginBtn: '返回登录',
    statusOnline: '在线',
    statusWorking: '工作中',
    statusBreak: '休息',
    statusOffline: '离线',
    todayEarnings: '今日收入',
    todayCompleted: '今日完成',
    cashCollected: '今日现金',
    transferCollected: '今日转账',
    newJobs: '新订单',
    noJobs: '暂无新订单',
    noActiveJob: '目前没有进行中的订单',
    goToMyJobsHint: '点击查看订单详情和路线',
    errRouteFallback: '暂时无法计算道路路线，先显示一条直线代替。',
    breakState: '您正在休息中',
    offlineState: '您已离线（停止接单）',
    onlineInstruction: '点击上方“在线”开始接单',
    tabHome: '首页',
    tabHistory: '历史订单',
    tabMyJobs: '我的订单',
    tabScan: '扫描',
    tabCallOffice: '致电总部',
    darkModeLabel: '深色模式',
    tabEarning: '收入',
    newJobAlertTitle: '新订单！等待您处理',
    ratingAvgLabel: '平均评分',
    scanComingSoon: '二维码扫描功能即将推出',
    tabProfile: '个人中心',
    historyTitle: '已完成订单历史',
    noHistory: '暂无历史记录',
    editProfile: '编辑资料',
    saveProfile: '保存修改',
    cancel: '取消',
    name: '姓名',
    plateNumber: '拖车车牌号',
    rating: '服务评分',
    jobsDone: '累计接单',
    unitJobs: '单',
    unitKm: '公里',
    notifications: '通知设置',
    soundNoti: '新订单声音提示',
    vibrateNoti: '新订单震动提示',
    logout: '退出登录 (Log Out)',
    langSelect: '选择语言',
    acceptJob: '接受订单',
    declineJob: '拒绝',
    callCustomer: '电话联系',
    chatCustomer: '在线沟通',
    navigate: '导航',
    fullScreenNavBtn: '全屏导航',
    stdPrice: '标准服务费用',
    activeJobTitle: '当前进行中订单',
    startRoute: '开始前往',
    arrivedLocation: '已到达现场',
    startLoading: '开始拖车',
    deliveringToGarage: '运送至修车厂',
    finishJob: '完成服务',
    jobAccepted: '已接单',
    jobEnRoute: '前往中',
    jobArrived: '已到达',
    jobLoading: '拖车中',
    jobDelivering: '送达中',
    unitM: '米',
    navTurnLeft: '左转',
    navTurnRight: '右转',
    navSlightLeft: '稍向左转',
    navSlightRight: '稍向右转',
    navSharpLeft: '急左转',
    navSharpRight: '急右转',
    navUturn: '掉头',
    navContinue: '直行',
    navRoundabout: '进入环岛',
    navMerge: '并道',
    navRamp: '进入匝道',
    navEndOfRoad: '道路尽头转弯',
    navFork: '靠边行驶',
    navDepart: '出发',
    navArrive: '已到达目的地',
    navOnto: '进入',
    dailySummary: '日度报表',
    monthlySummary: '月度报表',
    totalIncome: '总收入',
    totalJobsCount: '总订单数',
    vehicleType: '救援车型',
    slideTruck: '平板拖车 (Slide Truck)',
    wheelLiftTruck: '辅助轮托举车 (Wheel-Lift)',
    dashMenu: '收入与钱包',
    menuWorkSection: '工作菜单',
    menuSystemSection: '系统与支持',
    menuHome: '首页（接单）',
    menuHistory: '接单历史',
    menuVehicle: '车辆与设备',
    menuProfile: '个人资料与文件',
    menuNoti: '通知设置',
    menuHelp: '帮助中心 / 客服',
    menuSafety: '安全政策',
    menuSettings: '应用设置',
    joinIntro: '加入 Intelligent Towing，让工作更轻松。',
    fullNameLabel: '姓名',
    fullNamePlaceholder: '请输入姓名',
    employeeIdLabel: '员工编号',
    employeeIdPlaceholder: '请输入员工编号',
    phonePlaceholder: '请输入电话号码',
    emailPlaceholder: '请输入电子邮箱',
    createPasswordPlaceholder: '设置密码',
    confirmPasswordPlaceholder: '确认密码',
    passwordMustContain: '密码必须包含：',
    pwdReqLength: '至少 8 个字符',
    pwdReqUppercase: '至少一个大写字母',
    pwdReqNumberSpecial: '至少一个数字和特殊字符',
    identityVerificationTitle: '身份验证',
    identityVerificationDesc: '请上传清晰的政府身份证件照片。',
    uploadIdCard: '上传身份证 / 护照 / 驾驶证',
    companyVerificationTitle: '公司验证',
    uploadBusinessDoc: '上传营业执照 / 公司注册文件（JPG、PNG 或 PDF）',
    verifyPhoneTitle: '验证手机号码',
    verifyPhoneDesc: '我们将向您的手机发送 6 位验证码。',
    changePhone: '更改',
    verified: '已验证',
    next: '下一步',
    submitting: '提交中...',
    greetingMsg: '您好，我是{name}，已接受您的订单，正准备出发前往事故地点 🚚 有任何问题可以随时通过聊天或电话联系我。',
    defaultTechName: '技师',
    statusMsgEnRoute: '我已出发，正在前往事故地点 🚚',
    statusMsgArrivedTow: '已到达事故地点，正在检查车况并准备拖车设备。',
    statusMsgArrivedOnSite: '已到达事故地点，正在检查车况并准备设备。',
    statusMsgLoading: '正在将车辆装上平板拖车，请稍候。',
    statusMsgDelivering: '车辆已装载完毕，正在运往目的地维修厂。',
    statusMsgCompletedTow: '已到达目的地维修厂，工单已完成，感谢您使用我们的服务！🙏',
    statusMsgCompletedOnSite: '维修已完成，工单已完成，感谢您使用我们的服务！🙏',
    reportPromptTech: '请简要描述本次工单遇到的问题（例如：客户未付款、爽约）：',
    reportPrefixTech: '[REPORT] 技师报告问题：',
    reportSentSuccessTech: '问题报告已发送，团队将进行审核',
    rejectPaymentCashMsg: '技师报告收到的现金金额不正确，请核对后重新支付正确金额。',
    rejectPaymentSlipMsg: '技师报告付款凭证无效或金额不符，请在聊天或工单详情页重新上传凭证。',
    toastPaymentVerifyFail: '确认收款失败，请重试',
    toastPaymentVerified: '已确认收款',
    toastPaymentRejectFail: '拒绝付款失败，请重试',
    toastPaymentRejected: '已拒绝付款/转账凭证',
    toastJobCancelled: '工单 {id} 已取消',
    toastJobCancelFail: '取消工单失败：{reason}',
    genericRetry: '请重试',
    toastFillEmailPassword: '请填写完整的邮箱和密码',
    toastLoginSuccess: '登录成功，欢迎您，{name}',
    errInvalidCredentials: '邮箱或密码不正确',
    errLoginFailedGeneric: '登录失败，请重试',
    errLineLoginOpenFail: '无法打开LINE登录页面，请重试',
    toastLineSignupNeeded: 'LINE登录成功，请填写完整信息以完成注册',
    errLineLoginFailed: 'LINE登录失败，请重试',
    toastOtpSentToPhone: '验证码已发送至 {phone}',
    errNewPasswordRequired: '请输入新密码',
    errPasswordMinLength: '密码长度至少需要6个字符',
    errConfirmPasswordRequired: '请确认新密码',
    errPasswordMismatch: '两次输入的密码不一致',
    errPhoneRequired: '请先输入手机号码',
    toastOtpSentWithTest: '验证码已发送至 {phone}（测试验证码：{otp}）',
    errOtpInvalid: '验证码不正确，请重试',
    errFillAllFields: '请填写所有栏位',
    errVerifyPhoneOtpFirst: '请先验证手机验证码',
    errPasswordRequirementsNotMet: '密码不符合要求',
    errPasswordConfirmMismatch: '密码与确认密码不一致',
    errAttachIdDoc: '请上传身份证明文件',
    errAttachBusinessDoc: '请上传公司证明文件',
    toastSignupSuccess: '注册成功，请等待团队审核文件',
    errSignupFailed: '注册失败，请重试',
    errFillCompleteInfo: '请填写完整信息',
    toastProfileSaved: '资料已保存成功',
    errActiveJobBlockStatus: '您还有进行中的工单，请先完成当前工作再更改状态',
    toastJobAccepted: '已接受工单 {id}，正在前往客户位置',
    errAcceptJobFailed: '接受工单时发生错误',
    toastJobDeclined: '已拒绝工单 {id}，系统将寻找下一位技师',
    errConfirmPaymentBeforeFinish: '请先确认收款（现金/转账凭证）再结束工单',
    errUpdateStatusFailed: '更新工单状态失败，请重试',
    toastJobCompleted: '工单 {id} 已完成！收款 ฿{amount}',
    avatarFallback: '技',
    lineAuthOpening: '正在打开LINE页面...',
    lineIdentityVerifiedNote: '已通过LINE验证身份，无需设置邮箱/密码',
    otpNotConnectedNote: '尚未接入短信发送系统 — 您的测试验证码是',
    newPasswordPlaceholder: '请输入新密码',
    confirmNewPasswordPlaceholder: '请再次输入新密码',
    appVersionFooter: '版本 1.0.4（技师版）',
    dashSubtitle: '工作统计与收入概览',
    last7Days: '最近7天',
    last6Months: '最近6个月',
    closeWindow: '关闭窗口',
    closeThisWindow: '关闭此窗口',
    noCustomerName: '未提供客户姓名',
    noCustomerPhone: '未提供电话号码',
    noIssueType: '未说明故障类型',
    noPickupAddress: '未提供位置',
    vsYesterday: '较昨日',
    reportIssueBtn: '报告问题',
    slideTruckLabel: '拖板车',
    wheelLiftTruckLabel: '吊车（板轮式）',
    personalVehicleLabel: '移动维修车',
    onSiteServiceTitle: '现场维修服务（无需拖车）',
    onSiteServiceDesc: '请仅勾选您已备妥设备的服务项目，勾选后系统将立即开始派发此类工单',
    jumpStartLabel: '搭电启动',
    jumpStartSubLabel: '搭电启动 / 更换电池',
    tireChangeLabel: '换胎/补胎',
    receiptCompletedTitle: '工单已完成！',
    receiptJobDoneMsg: '工单 {id} 已圆满完成',
    receiptSummaryTitle: '费用汇总',
    customerLabel: '客户',
    serviceFeeLabel: '服务费',
    paymentMethodLabel: '付款方式',
    paymentMethodCash: '现金',
    paymentMethodCreditCard: '信用卡/借记卡',
    paymentMethodTransfer: 'PromptPay / 银行转账',
    paymentStatusLabel: '收款状态',
    paymentStatusAutoCard: '自动扣款',
    paymentConfirmedText: '已确认收款',
    paymentStatusNoInfo: '无付款信息',
    navigateConfirmTitle: '导航前请确认',
    navigateConfirmDesc: '出发前请再次核对本工单信息',
    openMapsNav: '打开地图导航',
    callCustomerBeforeDeparture: '出发前致电客户',
    chatCustomerJobLabel: '客户 · 工单 {id}',
    noMessagesYet: '暂无消息，快跟客户打个招呼吧',
    typeMessagePlaceholder: '输入消息...',
    outgoingCallLabel: '正在呼叫客户...',
    openPhoneAppToCall: '打开电话应用拨打电话',
    incomingCallLabel: '客户来电',
    declineBtn: '拒接',
    answerCallBtn: '接听',
    cancelStuckTitle: '要取消此工单吗？',
    cancelStuckDesc: '仅在确实无法继续时使用，例如客户被拒后一直未重新上传转账凭证。系统会自动通知客户，并立即解除您的状态以便接新单',
    cancelStuckReasonPlaceholder: '原因（选填），例如客户超过15分钟未重新上传转账凭证',
    dontCancelBtn: '不取消',
    confirmCancelBtn: '确认取消',
    techLabelWheelLift: '吊车技师',
    techLabelPersonal: '移动维修技师',
    techLabelSlide: '拖板车技师',
    techLabelGeneric: '技师',
    noGpsCoords: '接单地点无GPS坐标',
    cashReceivedDone: '已收现金',
    cashPendingOnSite: '待现场收款',
    cardChargedDone: '已扣款',
    cardChargePending: '等待系统扣款',
    customerPaidCash: '客户选择现金支付',
    customerPaidCard: '客户选择信用卡/借记卡支付',
    amountShort: '金额不足',
    confirmCashReceived: '确认已收现金',
    paymentRejectedWaitingNewCash: '已拒绝，等待客户重新付款',
    transferSlipLabel: '转账凭证',
    paymentStatusRejected: '已被拒绝',
    paymentStatusPendingReview: '待审核',
    customerNoSlipYet: '客户尚未上传转账凭证',
    slipInvalidFake: '凭证有误/伪造',
    paymentRejectedWaitingNewSlip: '已拒绝，等待客户重新上传凭证',
    noPaymentInfoFromCustomer: '尚无客户付款信息',
    confirmPaymentBeforeFinishNote: '请先在上方确认收款，才能结束工单',
    cancelStuckJobBtn: '取消此工单（遇到问题，无法继续）',
    mapLoadingText: '地图加载中...',
    offlineWarningBanner: '网络连接中断 — GPS位置和工单信息可能无法更新',
    notificationsTitle: '通知',
    markAllReadBtn: '全部标记为已读',
    noNotificationsYet: '暂无通知',
    profilePersonalInfo: '个人信息',
    profilePersonalInfoSub: '姓名、邮箱……',
    profileAccountInfoTitle: '账户信息',
    profileAccountInfoSub: '个人信息、银行账户、帮助中心、文件',
    profileBankDetails: '银行卡与付款信息',
    profileBankDetailsSub: '更新您的收款账户和付款信息',
    profileNotiSub: '您的提醒与更新',
    profileSettingsSub: '应用主题等',
    profileHelpSupport: '帮助与支持',
    profileHelpSupportSub: '联系客服',
    profileDocuments: '文件',
    profileDocumentsVerified: '已认证',
    profileStatusOnline: '在线',
    profileStatusOffline: '离线',
    myPerformance: '我的工作表现',
    viewDetails: '查看详情',
    completionRate: '完成率',
    rankLabel: '排名',
    daysActive: '活跃天数',
    featureComingSoon: '该功能即将上线',
    collectVehicleLabel: '取车地点',
    vehicleDestinationLabel: '目的地',
    estimatedCostLabel: '预估费用',
    moreJobsWaitingLabel: '还有更多工单排队等候',
    confirmDeclineTitle: '确定要拒绝此工单吗？',
    confirmDeclineDesc: '此工单将立即转给其他技师处理，且不会再显示在您的屏幕上',
    dontDeclineBtn: '不拒绝',
    confirmDeclineBtn: '确认拒绝',
  },
};

function mapDbRowToTowJob(row: any): TowJob {
  return {
    id: row.id,
    status: row.status,
    techId: row.assigned_tech_id ?? undefined,
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
  } as TowJob;
}

const STATUS_META: Record<
  TechStatus,
  { icon: React.ElementType; dot: string; chipActive: string; chipIdle: string }
> = {
  online: {
    icon: Wifi,
    dot: 'bg-emerald-400',
    chipActive: 'bg-emerald-500 text-white shadow-md shadow-emerald-200',
    chipIdle: 'bg-white text-slate-500 border border-slate-200',
  },
  working: {
    icon: Zap,
    dot: 'bg-sky-400',
    chipActive: 'bg-sky-500 text-white shadow-md shadow-sky-200',
    chipIdle: 'bg-white text-slate-500 border border-slate-200',
  },
  break: {
    icon: Coffee,
    dot: 'bg-amber-400',
    chipActive: 'bg-amber-500 text-white shadow-md shadow-amber-200',
    chipIdle: 'bg-white text-slate-500 border border-slate-200',
  },
  offline: {
    icon: WifiOff,
    dot: 'bg-red-500',
    chipActive: 'bg-red-500 text-white shadow-md shadow-red-200',
    chipIdle: 'bg-white text-slate-500 border border-slate-200',
  },
};

const STATUS_ORDER: TechStatus[] = ['online', 'working', 'break', 'offline'];

type ServiceTruckType = 'slide' | 'wheellift' | 'personal';

interface ExtendedTechProfile extends TechnicianProfile {
  truckType: ServiceTruckType;
}

const DEFAULT_TECH: ExtendedTechProfile = {
  id: '7f3a1c92-4e6d-4b8a-9f21-3d8c5a0b6e17',
  name: 'ช่างสมศักดิ์ บริการดี',
  phone: '081-234-5678',
  plateNumber: '2กข 5544',
  rating: 4.9,
  jobsDone: 210,
  status: 'online',
  specialties: ['tow'],
  truckType: 'slide',
};

type Tab = 'home' | 'myjobs' | 'history' | 'profile';

export default function TechnicianApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'phone' | 'otp' | 'newPassword'>('phone');
  const [resetPhone, setResetPhone] = useState('');
  const [resetPhoneError, setResetPhoneError] = useState(false);
  const [generatedResetOtp, setGeneratedResetOtp] = useState('');
  const [resetOtpValues, setResetOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const resetOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newLoginPassword, setNewLoginPassword] = useState('');
  const [confirmLoginPassword, setConfirmLoginPassword] = useState('');
  const [newLoginPasswordErr, setNewLoginPasswordErr] = useState('');
  const [confirmLoginPasswordErr, setConfirmLoginPasswordErr] = useState('');
  const [showNewLoginPassword, setShowNewLoginPassword] = useState(false);
  const [showConfirmLoginPassword, setShowConfirmLoginPassword] = useState(false);
  const [showResetSuccessModal, setShowResetSuccessModal] = useState(false);
  
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ---- LINE Login (OAuth ผ่าน Supabase custom:line) ----
  // isLineFlow: true เมื่อผ่าน LINE OAuth มาแล้วและกำลังกรอกฟอร์มสมัคร (t3/t4) ต่อ — ใช้ซ่อน
  // ช่องอีเมล/รหัสผ่าน (ไม่ต้องใช้ เพราะมี auth session จาก LINE อยู่แล้ว) และบอก
  // handleSubmitSignup ว่าไม่ต้องเรียก registerTechnician()/signUp() ซ้ำ ให้ใช้ lineTechId แทน
  const [isLineAuthLoading, setIsLineAuthLoading] = useState(false);
  const [isLineFlow, setIsLineFlow] = useState(false);
  const [lineTechId, setLineTechId] = useState<string>('');

  // ---- สมัครสมาชิกช่าง (New Account — หน้าเดียวกับ t3+t4 ในภาพตัวอย่าง, scroll ยาว) ----
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmployeeId, setSignupEmployeeId] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string>('');
  const [businessDocFile, setBusinessDocFile] = useState<File | null>(null);
  const [businessDocPreview, setBusinessDocPreview] = useState<string>('');
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupGeneratedOtp, setSignupGeneratedOtp] = useState('');
  const [signupOtpValues, setSignupOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [signupPhoneVerified, setSignupPhoneVerified] = useState(false);
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const signupOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ---- Language State ----
  const [lang, setLang] = useState<Lang>('TH');
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  // แยกรายการ "ข้อมูลส่วนตัว/บัญชีธนาคาร/ศูนย์ช่วยเหลือ/เอกสาร" ออกจากแท็บโปรไฟล์หลัก
  // มาเป็นหน้าจอเต็มจอต่างหาก (เดิมโชว์เป็นรายการ 6 แถวแช่อยู่กลางแท็บโปรไฟล์ตลอด ทำให้
  // ดูรกและแท็บโปรไฟล์ยาวเกินจำเป็น) — ตอนนี้แท็บโปรไฟล์เหลือแค่ปุ่มเดียว กดแล้วค่อยเปิด
  // หน้านี้มาแสดงรายการทั้งหมดแทน
  const [showAccountInfoScreen, setShowAccountInfoScreen] = useState(false);

  // State ระบบแจ้งเตือน (Notifications) — mock data ฝั่ง client เหมือนแอปลูกค้า
  const [notifications, setNotifications] = useState<Array<{
    id: string; title: string; message: string; time: string; read: boolean; type: 'info' | 'success' | 'warning';
  }>>([
    { id: 'n1', title: 'ยินดีต้อนรับช่างเข้าสู่ระบบ DTC', message: 'เริ่มรับงานได้ทันทีโดยกดออนไลน์ที่หน้าแรก', time: '2 ชม.ที่แล้ว', read: false, type: 'info' },
    { id: 'n2', title: 'อัปเดตระบบ', message: 'ระบบนำทางแบบเรียลไทม์พร้อมใช้งานแล้ว', time: '1 วันที่แล้ว', read: false, type: 'success' },
    { id: 'n3', title: 'แจ้งเตือนเอกสาร', message: 'กรุณาตรวจสอบเอกสารยืนยันตัวตนให้เป็นปัจจุบัน', time: '3 วันที่แล้ว', read: true, type: 'warning' },
  ]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;
  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };
  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };
  const t = TRANSLATIONS[lang];

  const dateLocaleTag = getLocaleTag(lang);
  // wrapper ให้ component หลักเรียก formatNumber(value, options) แบบเดิมได้โดยไม่ต้องส่ง lang ทุกครั้ง
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => formatNumberFor(value, lang, options);
  // เหมือนกันกับ formatNumber แต่สำหรับ label วันที่/เดือนแบบสั้น (เช่น "1月") ที่มีเลขอาราบิก
  // ปนอยู่ในสตริง — แปลงเป็นเลขจีนด้วยตัวเองเช่นกัน ไม่พึ่ง ICU numbering system extension
  const formatDateLabel = (date: Date, options: Intl.DateTimeFormatOptions) => {
    const formatted = date.toLocaleDateString(dateLocaleTag, options);
    return lang === 'CN' ? toChineseDigits(formatted) : formatted;
  };

  // ---- Analytics View Mode ----
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');

  // ---- Real-Time Device Status ----
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isWifiOnline, setIsWifiOnline] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');

  // ---- Technician Profile State ----
  const [tech, setTech] = useState<ExtendedTechProfile>(DEFAULT_TECH);

  // ติ๊ก/ถอนติ๊กความสามารถซ่อมหน้างาน (พ่วงแบต/เปลี่ยน-ปะยาง) — เพิ่ม/เอาออกจาก
  // tech.specialties เอง โดยไม่ไปยุ่งกับ 'tow' ที่มีอยู่แล้ว (ทุกคนมีรถ ลากได้เสมอ)
  // useEffect ที่ sync profile -> Supabase (upsertTechProfile) จะยิงอัตโนมัติเพราะ
  // มัน watch tech.specialties อยู่แล้ว ไม่ต้องเรียก setTechSpecialties ซ้ำเอง
  const toggleSpecialty = (specialty: string) => {
    setTech((prev) => {
      const has = prev.specialties.includes(specialty);
      return {
        ...prev,
        specialties: has
          ? prev.specialties.filter((s) => s !== specialty)
          : [...prev.specialties, specialty],
      };
    });
  };
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(DEFAULT_TECH.name);
  const [editPhone, setEditPhone] = useState(DEFAULT_TECH.phone);
  const [editPlate, setEditPlate] = useState(DEFAULT_TECH.plateNumber);

  const [jobs, setJobs] = useState<TowJob[]>([]);
  // true จนกว่าจะดึงรายการงานสำเร็จ/ล้มเหลวครั้งแรก — ใช้โชว์ skeleton แทนหน้าจอว่าง
  // ("ยังไม่มีงาน") ตอนเปิดแอปครั้งแรก กันเข้าใจผิดว่าไม่มีงานทั้งที่จริงๆ ยังโหลดไม่เสร็จ
  // ไม่ reset กลับเป็น true อีกตอน resync (visibilitychange/focus/online) เพราะตอนนั้นมี
  // ข้อมูลอยู่แล้ว ไม่ต้องการให้ skeleton โผล่ทับซ้ำ
  const [jobsLoading, setJobsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPendingJob, setSelectedPendingJob] = useState<TowJob | null>(null);
  // งานที่รอให้ยืนยันก่อนปฏิเสธจริง (กันช่างมือลั่นกด Decline พลาดแล้วเสียเคสฟรีๆ)
  const [jobToDecline, setJobToDecline] = useState<TowJob | null>(null);
  // เก็บ snapshot ของงาน+วิธีชำระเงินไว้โชว์เป็นสรุปใบเสร็จหลังกดจบงาน — เดิมกดจบงานแล้ว
  // เด้งกลับหน้าหลักทันที ไม่มีสรุปให้ช่างดูอีกเลยว่าจบงานอะไรไป ได้เงินเท่าไหร่ ชำระวิธีไหน
  const [completedReceipt, setCompletedReceipt] = useState<{
    job: TowJob;
    payment: { payment_method: 'transfer' | 'cash' | 'credit'; status: 'pending' | 'verified' | 'rejected' } | null;
  } | null>(null);
  // ตัวจับเวลานับถอยหลังของ "งานใหม่" ที่ขึ้นเป็นการ์ดใหญ่บนสุด (แค่บอกความเร่งด่วนให้ช่างเห็น
  // ไม่ได้ใช้ปฏิเสธงานอัตโนมัติเมื่อครบเวลา เพื่อกันพลาดกรณีช่างกำลังตัดสินใจอยู่)
  const [newJobCountdown, setNewJobCountdown] = useState(30);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  // Dark mode — เก็บใน localStorage เพื่อจำค่าไว้ข้ามเซสชัน (เหมือน soundOn/vibrateOn
  // ควรจะทำ แต่ตอนนี้ยังไม่ persist เหมือนกัน — ทำ dark mode ให้ persist ไว้ก่อนเพราะเป็น
  // ค่าที่กระทบสายตาทันทีทุกครั้งที่เปิดแอป ต่างจาก sound/vibrate ที่ไม่เห็นผลจนกว่าจะมีงานเข้า)
  // ครอบ try/catch เพราะ localStorage อาจไม่พร้อมใช้งานตอน SSR/บาง WebView
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    try {
      setDarkMode(window.localStorage.getItem('dtc_dark_mode') === '1');
    } catch {
      // ไม่มี localStorage ก็ปล่อยเป็น light mode ปกติ ไม่ต้อง block การใช้งานส่วนอื่น
    }
  }, []);
  const toggleDarkMode = useCallback((v: boolean) => {
    setDarkMode(v);
    try {
      window.localStorage.setItem('dtc_dark_mode', v ? '1' : '0');
    } catch {
      // เซฟไม่ได้ก็แค่ไม่จำข้ามเซสชัน ไม่กระทบการสลับธีมในเซสชันปัจจุบัน
    }
  }, []);

  // ---- Chat State ----
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'tech'; text: string }>>([]);
  const [inputMsg, setInputMsg] = useState('');

  // จุดแดงแจ้งเตือนข้อความแชตที่ยังไม่ได้อ่าน — ติดเมื่อลูกค้าส่งข้อความเข้ามาขณะหน้าต่างแชตปิดอยู่
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const isChatOpenRef = useRef(false);
  useEffect(() => {
    isChatOpenRef.current = showChat;
    if (showChat) setHasUnreadChat(false); // เปิดแชตแล้วถือว่าอ่านข้อความหมดแล้ว เคลียร์จุดแดง
  }, [showChat]);

  // ---- Call State (หน้าจอโทรแบบเดียวกับฝั่งลูกค้า + สัญญาณเชื่อมกันแบบเรียลไทม์ผ่าน Supabase Broadcast) ----
  const [showOutgoingCall, setShowOutgoingCall] = useState(false);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{ name: string; phone: string } | null>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Splash Screen Timeout — เปลี่ยนไปหน้า Welcome/Login เสมอหลังจาก 5 วินาที
  // (ปิดแอปแล้วเปิดใหม่ต้องล็อกอินซ้ำทุกครั้ง ไม่ข้ามไปหน้า Dashboard อัตโนมัติ)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Real-time Clock, Wi-Fi & Battery Status API
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    const handleOnline = () => setIsWifiOnline(true);
    const handleOffline = () => setIsWifiOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsWifiOnline(navigator.onLine);

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setBatteryLevel(Math.round(battery.level * 100));
          setIsCharging(battery.charging);
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      });
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync profile local -> lib
  // Sync profile -> Supabase
  // เดิม upsert ทั้งก้อนรวม jobs_done/status เข้าไปด้วย (client กำหนดเองได้) เปลี่ยนมา
  // ส่งเฉพาะฟิลด์โปรไฟล์ที่ช่างแก้เองได้จริง — jobs_done นับโดย server ตอนงานเสร็จ
  // (ดู 0002_price_and_status_rpc.sql), ส่วน status แยกไปเรียก setTechStatusApi() ต่างหาก
  useEffect(() => {
    if (!isLoggedIn) return;
    upsertTechProfile({
      id: tech.id,
      name: tech.name,
      phone: tech.phone,
      plateNumber: tech.plateNumber,
      specialties: tech.specialties,
    }).catch((err) => console.error('Error syncing technician profile:', err));
  }, [isLoggedIn, tech.name, tech.phone, tech.plateNumber, tech.specialties]);

  // Load Technician profile from Supabase
  useEffect(() => {
    if (!isLoggedIn) return;

    const hydrateFromSupabase = async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('name, phone, plate_number, rating, jobs_done')
        .eq('id', tech.id)
        .maybeSingle();

      if (!error && data) {
        setTech((prev) => ({
          ...prev,
          name: data.name ?? prev.name,
          phone: data.phone ?? prev.phone,
          plateNumber: data.plate_number ?? prev.plateNumber,
          rating: data.rating ?? prev.rating,
          jobsDone: data.jobs_done ?? prev.jobsDone,
        }));
        setEditName(data.name ?? tech.name);
        setEditPhone(data.phone ?? tech.phone);
        setEditPlate(data.plate_number ?? tech.plateNumber);
      }
    };

    hydrateFromSupabase();
  }, [isLoggedIn, tech.id]);

  // Auto hide Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Realtime Jobs Subscription
  useEffect(() => {
    if (!isLoggedIn) return;

    // เดิม select ตรง + เปิด channel เอง เปลี่ยนมาใช้ listPendingAndOwnJobs() +
    // subscribeAllJobs() จาก lib/dtc-api.ts แทน (logic การ upsert เข้า state เหมือนเดิม)
    const fetchRelevantJobs = async () => {
      try {
        const jobsData = await listPendingAndOwnJobs(tech.id, tech.specialties);
        setJobs(jobsData);
      } catch (err) {
        console.error('Error fetching jobs:', err);
      } finally {
        // ปิด skeleton หลังพยายามโหลดครั้งแรกเสร็จไม่ว่าจะสำเร็จหรือพลาด — ถ้าพลาดจะไป
        // เจอ empty state ปกติ (t.noJobs) แทน ดีกว่าค้าง skeleton ไว้ตลอดไป
        setJobsLoading(false);
      }
    };

    fetchRelevantJobs();

    const unsubscribe = subscribeAllJobs((mapped) => {
      // งานที่เป็นของช่างคนนี้อยู่แล้ว (รับไปแล้ว) ต้องเห็นการอัปเดตเสมอไม่ว่า specialty จะตรงไหม
      // ส่วนงานใหม่ที่ยังไม่มีใครรับ (pending) ต้องกรองตาม specialties ของช่างคนนี้ก่อน ไม่งั้น
      // ช่างที่เลือกรับแค่งานลากจะเห็น/ได้แจ้งเตือนเคสเปลี่ยนยาง-พ่วงแบตที่ไม่ตรงสายงานไปด้วย
      const isOwnJob = mapped.assignedTechId === tech.id;
      const matchesSpecialty = tech.specialties.length === 0 || tech.specialties.includes(mapped.requiredSpecialty);
      if (!isOwnJob && !matchesSpecialty) return;

      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === mapped.id);
        if (idx === -1) return [mapped, ...prev];
        const next = [...prev];
        next[idx] = mapped;
        return next;
      });
    });

    // เดิมพึ่ง Realtime channel อย่างเดียว ถ้า WebSocket หลุดเงียบๆ ระหว่างที่แอปเปิดค้างไว้
    // นาน ๆ (สลับแอป/ล็อกจอ/สัญญาณมือถือกระตุก — พบบ่อยบนเบราว์เซอร์มือถือ ตัดการเชื่อมต่อ
    // background โดยไม่มี error ให้เห็น) จะไม่มีงานใหม่โผล่มาอีกเลยจนกว่าจะรีโหลดหน้า (ออกแอป
    // เข้าใหม่) — เพิ่ม fetch ซ้ำทุกครั้งที่กลับมาที่หน้าจอ/แอปกลับมา foreground/เน็ตกลับมาต่อ
    // เพื่อ sync รายการงานให้ตรงกับ DB จริงเสมอ โดยไม่ต้องรอ event จาก Realtime ฝั่งเดียว
    const handleResync = () => {
      if (document.visibilityState === 'visible') fetchRelevantJobs();
    };
    window.addEventListener('visibilitychange', handleResync);
    window.addEventListener('focus', fetchRelevantJobs);
    window.addEventListener('online', fetchRelevantJobs);

    return () => {
      unsubscribe();
      window.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('focus', fetchRelevantJobs);
      window.removeEventListener('online', fetchRelevantJobs);
    };
  }, [isLoggedIn, tech.id, tech.specialties]);

  const activeJob = useMemo(
    () => jobs.find((j) => j.techId === tech.id && !['completed', 'cancelled'].includes(j.status)),
    [jobs, tech.id]
  );

  // จอนำทางเต็มจอ (FullScreenNav สไตล์ Google Maps) — เปิดอัตโนมัติทุกครั้งที่งานเข้าสถานะ
  // "กำลังเดินทาง" (en_route ไปจุดเกิดเหตุ หรือ delivering ไปอู่) เพราะสองสถานะนี้คือช่วงที่ช่าง
  // ต้องขับรถจริงๆ ไม่ต้องเห็นรายละเอียดอื่นในการ์ด เอาแผนที่เต็มจอไว้ก่อน แก้ปัญหาเดิมที่แผนที่
  // ฝังอยู่ในการ์ดที่เลื่อนได้ ทำให้เผลอเลื่อนจอแล้วนิ้วไปโดนแผนที่จนแพนแผนที่เล่นแทนที่จะเลื่อน
  // หน้า — พอเปลี่ยนสถานะอื่น (arrived, loading ฯลฯ) จะปิดอัตโนมัติกลับไปโชว์การ์ดรายละเอียดปกติ
  // ช่างกดปุ่ม "โหมดนำทางเต็มจอ" ในการ์ดเพื่อเปิดกลับมาเองได้ทุกเมื่อ (ไม่ได้ล็อกไว้)
  const [navFullScreen, setNavFullScreen] = useState(false);
  useEffect(() => {
    setNavFullScreen(!!activeJob && (activeJob.status === 'en_route' || activeJob.status === 'delivering'));
  }, [activeJob?.id, activeJob?.status]);

  // ตำแหน่ง GPS จริงของตัวช่างเอง เก็บไว้ในเครื่องด้วย (เดิมมีแต่โค้ดที่ "เขียนขึ้น" Supabase
  // อย่างเดียว ไม่เคยเก็บไว้แสดงในแอปช่างเองเลย) ใช้โชว์หมุด "ตำแหน่งของฉัน" บนแผนที่ในหน้า
  // งานที่กำลังทำอยู่ อัปเดตทุกครั้งที่ GPS ขยับแบบไม่หน่วง (อัปเดต state ในเครื่องไม่มีต้นทุน
  // เครือข่าย ต่างจากการเขียนขึ้น Supabase ที่ throttle ไว้ที่ ~9 วิ/ครั้งด้านล่างเพื่อประหยัด quota)
  const [techLiveCoords, setTechLiveCoords] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  // เส้นทางจริงตามถนนจาก OSRM ไปยังจุดเกิดเหตุของงานที่กำลังทำอยู่ — ใช้วาดเส้นทับแผนที่
  // ใน ActiveJobCard เหมือนที่ทำฝั่งลูกค้า (user-page.tsx)
  const [routeGeometry, setRouteGeometry] = useState<{ lat: number; lng: number }[] | null>(null);
  // จุดเลี้ยว (turn-by-turn) ของเส้นทางเดียวกับ routeGeometry ด้านบน — มาจาก compute-route
  // เวอร์ชันที่รองรับ steps เท่านั้น เป็น [] เสมอถ้า Edge Function เก่ายังไม่รองรับ/ล้มเหลว
  // (เส้นทางสำรองเส้นตรง) ฝั่ง FullScreenNav เช็ค length === 0 แล้ว fallback เป็นป้าย
  // ระยะทางรวมแบบเดิมเอง ไม่ต้องพังถ้ายังไม่มีข้อมูลนี้
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);

  // แก้บั๊ก: เดิมคำนวณเส้นทางแค่ขาไปจุดเกิดเหตุ (accepted/en_route) ขาไปอู่ตอน loading/delivering
  // ไม่เคยคำนวณเลย (คงเหลือ routeGeometry เก่าจากขาแรกค้างอยู่ หรือไม่มีเส้นให้ดูเลย) — เพิ่ม
  // เช็คขาที่สอง (ช่าง -> อู่) ให้คำนวณเส้นทางอัตโนมัติเหมือนกัน ไม่ต้องกดปุ่มใดๆ ทั้งสองขา
  //
  // แก้เพิ่ม: เดิม useEffect นี้ผูกกับ techLiveCoords ตรงๆ ซึ่งเปลี่ยนถี่มากทุกครั้งที่ GPS
  // ขยับแม้แค่ 2-3 เมตร ทำให้ยิง computeRoute() (เรียก OSRM ผ่าน edge function) รัวๆ ทุกครั้ง
  // ที่ตำแหน่งขยับ ทั้งเปลืองและทำให้เส้นดูกระตุกเปลี่ยนรูปร่างตลอดเวลา ต่างจาก Google Maps จริง
  // ที่คำนวณเส้นทางครั้งเดียวตอนเริ่มเดินทาง แล้วปล่อยให้ "จุดตำแหน่งเรา" ไหลไปตามเส้นเดิม
  // ค่อย "รีรูท" (คำนวณใหม่) เฉพาะตอนหลุดออกนอกเส้นทางจริงๆ หรือนานเกินไปแล้วยังไม่รีรูทเลย —
  // เลียนแบบพฤติกรรมนั้นด้วยเงื่อนไข 3 ข้อ: (1) เพิ่งเปลี่ยนขา (ปลายทางเปลี่ยนจากจุดเกิดเหตุ
  // เป็นอู่ หรือกลับกัน) (2) ตำแหน่งช่างห่างจากจุดที่ใช้คำนวณเส้นทางล่าสุดเกิน 60 เมตร (เบี่ยง
  // ออกนอกเส้นทางเดิมจริงๆ) หรือ (3) เวลาผ่านไปนานเกิน 25 วิ นับจากคำนวณครั้งล่าสุด (กันเส้น
  // ทางค้างนานเกินไปเผื่อสภาพถนนจริงเปลี่ยน) — นอกเหนือจากนี้ไม่ยิง API ใหม่ ปล่อยหมุดช่าง
  // (techPos) เลื่อนไปตามเส้นเดิมแบบ real-time เฉยๆ เหมือนแอปนำทางจริง
  const lastRouteFetchRef = useRef<{ at: number; origin: { lat: number; lng: number }; destKey: string } | null>(
    null
  );

  // เดิมถ้า computeRoute() คืนค่า null (OSRM/edge function เรียกไม่สำเร็จ) หรือ geometry ว่าง
  // จะเซ็ต routeGeometry เป็น null เฉยๆ ทำให้ไม่มีเส้นให้เห็นเลยบนแผนที่ (ต่อให้หมุดช่าง/หมุด
  // ปลายทางขึ้นปกติทั้งคู่ก็ตาม) — เพิ่ม fallback เป็นเส้นตรง (ประ) ระหว่างช่าง-ปลายทางแทน อย่าง
  // น้อยเห็นทิศทางคร่าวๆ ไม่ใช่ไม่มีอะไรให้ดูเลย พร้อมแยก flag routeIsEstimated ไว้บอกฝั่งแผนที่
  // ว่านี่เป็นเส้นประมาณ (ไม่ใช่เส้นตามถนนจริงจาก OSRM) จะได้วาดสไตล์ต่างกันให้สังเกตออก
  const [routeIsEstimated, setRouteIsEstimated] = useState(false);
  // แจ้งเตือนครั้งเดียวต่องาน (ไม่ใช่ทุกครั้งที่รีรูท) ว่ากำลังใช้เส้นสำรอง เพื่อให้รู้ทันทีว่าควร
  // ไปเช็ค Edge Function compute-route ฝั่ง Supabase (ปัญหานี้แก้จากโค้ดฝั่งแอปอย่างเดียวไม่ได้)
  const warnedRouteFallbackJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    const headingToPickup = !!activeJob && (activeJob.status === 'accepted' || activeJob.status === 'en_route');
    const headingToGarage = !!activeJob && (activeJob.status === 'loading' || activeJob.status === 'delivering');

    let destination: { lat: number; lng: number } | null = null;
    let destKey = '';
    if (headingToPickup && activeJob!.pickupLat != null && activeJob!.pickupLng != null) {
      destination = { lat: activeJob!.pickupLat, lng: activeJob!.pickupLng };
      destKey = `pickup:${activeJob!.id}`;
    } else if (headingToGarage && activeJob!.garageLat != null && activeJob!.garageLng != null) {
      destination = { lat: activeJob!.garageLat, lng: activeJob!.garageLng };
      destKey = `garage:${activeJob!.id}`;
    }

    if (!destination || !techLiveCoords) {
      setRouteGeometry(null);
      setRouteIsEstimated(false);
      setRouteSteps([]);
      lastRouteFetchRef.current = null;
      return;
    }

    const last = lastRouteFetchRef.current;
    const legChanged = !last || last.destKey !== destKey;
    const driftedOffRoute = !legChanged && haversineDistanceMeters(last!.origin, techLiveCoords) > 60;
    const staleTimeout = !legChanged && Date.now() - last!.at > 25000;

    // ยังไม่ถึงเงื่อนไขที่ควรรีรูทใหม่ — ปล่อยเส้นทางเดิมค้างไว้ (หมุดช่างเลื่อนเองผ่าน techPos อยู่แล้ว)
    if (!legChanged && !driftedOffRoute && !staleTimeout) {
      return;
    }

    const originAtFetch = techLiveCoords;
    let cancelled = false;
    computeRoute(originAtFetch, destination).then((route) => {
      if (cancelled) return;
      lastRouteFetchRef.current = { at: Date.now(), origin: originAtFetch, destKey };

      if (route && route.geometry.length > 0) {
        setRouteGeometry(route.geometry);
        setRouteIsEstimated(false);
        setRouteSteps(route.steps ?? []);
        return;
      }

      // computeRoute ล้มเหลว/ไม่มี geometry — ใช้เส้นตรงระหว่างช่าง-ปลายทางแทนชั่วคราว ไม่มี
      // จุดเลี้ยวจริงให้ใช้ (เป็นแค่เส้นประมาณทิศทาง) เลยเคลียร์ routeSteps ไปด้วย ให้
      // FullScreenNav fallback ไปโชว์ป้ายระยะทางรวมแทนป้ายเลี้ยว
      setRouteGeometry([originAtFetch, destination!]);
      setRouteIsEstimated(true);
      setRouteSteps([]);
      if (activeJob && warnedRouteFallbackJobIdRef.current !== activeJob.id) {
        warnedRouteFallbackJobIdRef.current = activeJob.id;
        setToast({ message: t.errRouteFallback, type: 'error' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    techLiveCoords,
    activeJob?.id,
    activeJob?.status,
    activeJob?.pickupLat,
    activeJob?.pickupLng,
    activeJob?.garageLat,
    activeJob?.garageLng,
  ]);

  // ส่งพิกัด GPS จริงของช่างขึ้น Supabase ตราบใดที่มีงานอยู่ในมือ (แทนตำแหน่งจำลองที่ฝั่งลูกค้าเคยใช้)
  // throttle การเขียนไว้ที่ ~9 วิ/ครั้ง (ปรับจากเดิม 12 วิ ให้ฝั่งลูกค้ารู้สึก real-time ขึ้น
  // แต่ยังไม่ถี่จนเปลือง quota ของ Supabase หรือแบตช่างหมดเร็วเกินไป)
  // แก้เพิ่ม (ระบบเสนองานให้ช่างใกล้สุด — ดู 0012_nearest_tech_offer_dispatch.sql):
  // เดิม effect นี้ทำงานเฉพาะตอนมี activeJob เท่านั้น แปลว่า technicians.current_lat/lng
  // ของช่างที่ "ออนไลน์รอรับงานเฉยๆ" (ยังไม่มีงานในมือ) จะไม่เคยถูกอัปเดตเลย ทำให้ trigger
  // หาช่างใกล้สุดฝั่ง DB มองไม่เห็นตำแหน่งจริงของช่างกลุ่มนี้ (มีแต่พิกัดเก่าตอนจบงานล่าสุด
  // หรือไม่มีเลยถ้ายังไม่เคยรับงานสักครั้ง) เปลี่ยนเงื่อนไขให้ยิงพิกัดขึ้นด้วยตราบใดที่
  // สถานะเป็น 'online' ไม่ว่าจะมีงานอยู่ในมือหรือไม่ก็ตาม
  const lastGpsWriteRef = useRef<number>(0);
  useEffect(() => {
    if (!activeJob && tech.status !== 'online') {
      setTechLiveCoords(null);
      return;
    }

    let watchId: string | null = null;
    let cancelled = false;

    // ฟังก์ชันกลาง เขียนพิกัดใหม่ทั้งขึ้น UI local และ throttle การยิงขึ้น Supabase (ทุก 9 วิ)
    // แยกออกมาเพื่อให้ทั้ง watchPosition callback และ resume listener ด้านล่างเรียกซ้ำได้
    const handleNewPosition = (lat: number, lng: number, heading?: number | null) => {
      if (cancelled) return;
      setTechLiveCoords({ lat, lng, heading });
      const now = Date.now();
      if (now - lastGpsWriteRef.current < 9000) return;
      lastGpsWriteRef.current = now;
      updateTechLocation(tech.id, lat, lng).catch((error) => {
        console.error('Error updating tech live location:', error);
      });
    };

    // ใช้ปลั๊กอิน @capacitor/geolocation แทน navigator.geolocation ตรงๆ เพราะตอนรันเป็น
    // native app ผ่าน Capacitor เบราว์เซอร์ WebView ไม่สามารถขอสิทธิ์ ACCESS_FINE_LOCATION
    // ของ Android เองได้ — ปลั๊กอินนี้จัดการขอสิทธิ์ + เพิ่ม permission ใน
    // AndroidManifest.xml ให้อัตโนมัติตอน `npx cap sync android` (โค้ดยังใช้ได้ปกติ
    // ตอนรันในเบราว์เซอร์ธรรมดาเหมือนเดิม ปลั๊กอินสลับ implementation ให้เอง)
    //
    // ข้อจำกัดที่ทราบอยู่: watchPosition() ของปลั๊กอินนี้ทำงานอยู่บน WebView ธรรมดา (ไม่ใช่
    // Foreground Service ของ Android) เพราะงั้นตอนช่างกด "นำทาง" แล้วแอปถูก minimize ไปเปิด
    // Google Maps ระบบปฏิบัติการอาจ throttle/หยุด JS ของ WebView ชั่วคราวได้ ทำให้พิกัดค้าง
    // ไม่อัปเดตจนกว่าช่างจะสลับกลับมาที่แอปเอง — วิธีแก้ที่สมบูรณ์จริงๆ ต้องใช้ปลั๊กอิน
    // background-geolocation ระดับ native (เช่น @capacitor-community/background-geolocation)
    // ที่รันเป็น Foreground Service ได้แม้แอปอยู่เบื้องหลัง ซึ่งต้องติดตั้งแพ็กเกจเพิ่มและตั้งค่า
    // native permission เอง — ยังไม่ได้ทำในรอบนี้ ด้านล่างเป็นแค่ตัวช่วยลดผลกระทบเบื้องต้น:
    // ฟัง appStateChange แล้วดึงพิกัดสดทันทีทุกครั้งที่ช่างสลับกลับมาที่แอป เพื่อปิดช่องว่างที่
    // อาจเกิดขึ้นระหว่างที่แอปอยู่เบื้องหลัง
    const resumeListenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || cancelled) return;
      Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
        .then((position) => {
          handleNewPosition(position.coords.latitude, position.coords.longitude, position.coords.heading);
        })
        .catch((error) => {
          console.error('Error refetching position on app resume:', error);
        });
    });

    (async () => {
      try {
        await Geolocation.requestPermissions();
      } catch (permErr) {
        // บางแพลตฟอร์ม (เช่นเบราว์เซอร์เดสก์ท็อป) ไม่มี requestPermissions แยกให้เรียก
        // ("Not implemented on web") — ข้ามได้ ไม่ต้องให้พังทั้งบล็อก เพราะ watchPosition()
        // เองจะเด้งขอสิทธิ์ให้อัตโนมัติอยู่แล้วตอนรันบนเว็บ
      }

      try {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
          (position, err) => {
            if (err) {
              console.error('Geolocation watch error:', err);
              return;
            }
            if (!position || cancelled) return;
            handleNewPosition(position.coords.latitude, position.coords.longitude, position.coords.heading);
          }
        );
      } catch (error) {
        console.error('Geolocation watchPosition error:', error);
      }
    })();

    return () => {
      cancelled = true;
      if (watchId) {
        Geolocation.clearWatch({ id: watchId }).catch(() => {});
      }
      resumeListenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [activeJob?.id, tech.id, tech.status]);

  // ดึงสลิปโอนเงินล่าสุดของงานปัจจุบันจากตาราง payments + ดักฟังแบบเรียลไทม์
  // (กรณีลูกค้าเพิ่งอัปโหลดสลิปหลังกดยืนยันจอง สลิปจะขึ้นในหน้าช่างทันทีโดยไม่ต้องรีเฟรช)
  const [activeJobPayment, setActiveJobPayment] = useState<{
    id: string;
    slip_url: string | null;
    amount: number | null;
    payment_method: 'transfer' | 'cash' | 'credit';
    status: 'pending' | 'verified' | 'rejected';
  } | null>(null);

  useEffect(() => {
    if (!activeJob) {
      setActiveJobPayment(null);
      return;
    }

    const fetchPayment = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('job_id', activeJob.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveJobPayment({
          id: data.id,
          slip_url: data.slip_url,
          amount: data.amount,
          payment_method: (data.payment_method === 'cash' || data.payment_method === 'credit') ? data.payment_method : 'transfer',
          status: data.status,
        });
      } else {
        setActiveJobPayment(null);
      }
    };

    fetchPayment();

    const paymentChannel = supabase
      .channel(`payment_${activeJob.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `job_id=eq.${activeJob.id}` },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          setActiveJobPayment({
            id: row.id,
            slip_url: row.slip_url,
            amount: row.amount,
            payment_method: (row.payment_method === 'cash' || row.payment_method === 'credit') ? row.payment_method : 'transfer',
            status: row.status,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(paymentChannel);
    };
  }, [activeJob?.id]);

  // ช่างกดยืนยันว่าได้รับเงินแล้ว (ตรวจสลิปด้วยตาเปล่าเทียบยอด แล้วกดยืนยัน)
  // แก้บั๊ก: เดิมเขียน .update() ตรงเข้าตาราง payments ซึ่งโดน RLS บล็อกเงียบๆ (0 rows
  // affected ไม่มี error) ทำให้ status ไม่เคยเปลี่ยนเป็น 'verified' จริงในฐานข้อมูล
  // ปุ่ม "จบงาน" ที่เช็คเงื่อนไขนี้เลยกดไม่ได้ตลอดไป เปลี่ยนมาเรียกผ่าน verifyJobPayment()
  // RPC แทน (ดู lib/dtc-api.ts + 0010_verify_reject_job_payment_rpc.sql)
  const handleVerifyPayment = async () => {
    if (!activeJobPayment) return;
    try {
      await verifyJobPayment(activeJobPayment.id, tech.name);
    } catch (err) {
      setToast({ message: t.toastPaymentVerifyFail, type: 'error' });
      return;
      
    }
    setActiveJobPayment((prev) => (prev ? { ...prev, status: 'verified' } : prev));
    setToast({ message: t.toastPaymentVerified, type: 'success' });
  };

  // ช่างกดปฏิเสธสลิป/การชำระเงิน — ใช้เมื่อสลิปผิดยอด ปลอม หรือเงินสดไม่ครบ
  // แจ้งเตือนลูกค้าทันทีผ่านแชต ให้รู้สาเหตุและกลับไปแก้ไข (แนบสลิปใหม่) แทนที่จะค้างเฉยๆ ไม่รู้อะไร
  // แก้บั๊กเดียวกับ handleVerifyPayment ด้านบน — เดิม .update() ตรงถูก RLS บล็อกเงียบๆ
  // ทำให้ status ไม่เคยเป็น 'rejected' จริง แบนเนอร์แนบสลิปใหม่ฝั่งลูกค้าเลยไม่เคยขึ้น
  // (เงื่อนไข status==='rejected' ไม่เคยจริง) เปลี่ยนมาเรียกผ่าน rejectJobPayment() RPC แทน
  const handleRejectPayment = async (job: TowJob) => {
    if (!activeJobPayment) return;
    try {
      await rejectJobPayment(activeJobPayment.id, tech.name);
    } catch (err) {
      setToast({ message: t.toastPaymentRejectFail, type: 'error' });
      return;
    }
    setActiveJobPayment((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
    setToast({ message: t.toastPaymentRejected, type: 'success' });

    const msg =
      activeJobPayment.payment_method === 'cash'
        ? t.rejectPaymentCashMsg
        : t.rejectPaymentSlipMsg;
    sendSystemChatMessage(job.id, msg);
  };

  // ทางออกฉุกเฉิน: ช่างยกเลิกงานตัวเองตอนติดค้าง (เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูก
  // ปฏิเสธไปแล้ว) — ใช้ไม่ได้เฉพาะตอน 'loading' (กำลังยกรถขึ้นจริง) เท่านั้น (เช็คซ้ำอีกชั้น
  // ฝั่ง RPC เอง) ปลดสถานะช่างกลับ 'online' ให้อัตโนมัติในทรานแซคชันเดียวกัน ไม่ต้องเรียก
  // setTechStatusApi แยก
  const [showCancelStuckModal, setShowCancelStuckModal] = useState(false);
  const [cancelStuckReason, setCancelStuckReason] = useState('');
  const [isCancellingStuckJob, setIsCancellingStuckJob] = useState(false);

  const handleCancelStuckJob = async (job: TowJob) => {
    setIsCancellingStuckJob(true);
    try {
      await cancelJobByTech(job.id, tech.id, cancelStuckReason.trim() || undefined);
      setToast({ message: t.toastJobCancelled.replace('{id}', job.id), type: 'success' });
      setShowCancelStuckModal(false);
      setCancelStuckReason('');
    } catch (err: any) {
      // log ข้อความ error จริงออก console + โชว์ในตัว toast ชั่วคราวไว้ debug ว่า RPC
      // ยังไม่ถูก deploy (function not found) หรือ raise exception จากเงื่อนไขในตัว RPC เอง
      // (เช่น สถานะงานไม่ตรงเงื่อนไข / not authorized) — ลบกลับเป็นข้อความ generic ทีหลังได้
      console.error('cancelJobByTech failed:', err);
      setToast({
        message: t.toastJobCancelFail.replace('{reason}', err?.message ?? t.genericRetry),
        type: 'error',
      });
    } finally {
      setIsCancellingStuckJob(false);
    }
  };

  // ดึงประวัติแชตจริงจาก Supabase + ดักฟังข้อความใหม่แบบเรียลไทม์
  // (เดิมแชตฝั่งช่างอัปเดตแค่ state ในเครื่อง ไม่เคย insert เข้า chat_messages เลย
  // ทำให้ข้อความไม่เคยไปถึงฝั่งลูกค้า และข้อความจากลูกค้าก็ไม่เคยโผล่มาฝั่งช่าง)
  // หมายเหตุ: เดิมดักฟังเฉพาะตอนเปิดหน้าต่างแชต (showChat) เท่านั้น ทำให้พลาดข้อความ/แจ้งเตือนไม่ได้ตอนแชตปิดอยู่
  // ตอนนี้ดักฟังตลอดตราบใดที่ยังมีงานอยู่ (activeJob) เพื่อให้ขึ้นจุดแดงแจ้งเตือนได้แม้ปิดหน้าต่างแชตอยู่
  useEffect(() => {
    if (!activeJob) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('job_id', activeJob.id)
        .order('created_at', { ascending: true });
      if (data) {
        const mapped: { sender: 'user' | 'tech'; text: string }[] = data.map((m: any) => ({
          sender: m.sender === 'customer' ? 'user' : 'tech',
          text: m.text,
        }));
        // ใช้ functional update เทียบจำนวนข้อความเดิม เผื่อข้อความใหม่มาจาก poll (ไม่ใช่ realtime)
        // จะได้ติดจุดแดงแจ้งเตือนถูกต้องแม้ Realtime มาช้า/หลุดไปเลย
        setChatMessages((prev) => {
          if (mapped.length > prev.length && !isChatOpenRef.current) {
            setHasUnreadChat(true);
          }
          return mapped;
        });
      }
    };
    fetchMessages();

    const chatChannel = supabase
      .channel(`chat_${activeJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `job_id=eq.${activeJob.id}`,
        },
        (payload) => {
          const newMsg: any = payload.new;
          if (newMsg.sender === 'customer') {
            setChatMessages((prev) => [...prev, { sender: 'user', text: newMsg.text }]);
            // ถ้าหน้าต่างแชตปิดอยู่ตอนที่ข้อความใหม่เข้ามา ให้ติดจุดแดงแจ้งเตือนว่ายังไม่ได้อ่าน
            if (!isChatOpenRef.current) setHasUnreadChat(true);
          }
        }
      )
      .subscribe();

    // Poll สำรองทุก 3 วิ คู่กับ Realtime — เผื่อ Realtime มาช้า/หลุด ข้อความจะไม่มีทางช้าเกิน 3 วิ
    // (fetchMessages ดึงมาทั้งชุดทับของเดิมเสมอ จึงไม่มีปัญหาข้อความซ้ำ)
    const pollInterval = setInterval(fetchMessages, 3000);

    return () => {
      supabase.removeChannel(chatChannel);
      clearInterval(pollInterval);
    };
  }, [activeJob?.id]);

  // ส่งข้อความแชตจริงเข้า Supabase — เดิม insert ตรงเข้า chat_messages โดน RLS บล็อกเงียบๆ
  // (ตามที่ dtc-api.ts ระบุไว้ว่าปิดสิทธิ์เขียนตรงหมดแล้ว ต้องผ่าน RPC เท่านั้น) ข้อความช่าง
  // เลยไม่เคยไปถึงฝั่งลูกค้าจริง เปลี่ยนมาเรียก sendChatMessage() แทน
  const handleSendTechMessage = async () => {
    const text = inputMsg.trim();
    if (!text || !activeJob) return;
    setChatMessages((prev) => [...prev, { sender: 'tech', text }]);
    setInputMsg('');
    try {
      await sendChatMessage({ jobId: activeJob.id, sender: 'tech', text });
    } catch (err) {
      console.error('Error sending chat message:', err);
    }
  };

  // ส่งข้อความระบบอัตโนมัติเข้าแชต (ทักทายตอนรับงาน / แจ้งเตือนทุกสถานะ) — เดิม insert ตรงเข้า
  // chat_messages โดน RLS บล็อกเงียบๆ เช่นกัน ทำให้ข้อความ "รับงานแล้ว" / "ถึงจุดเกิดเหตุแล้ว" ฯลฯ
  // ไม่เคยถูกบันทึกจริง ฝั่งลูกค้าเลยไม่เห็นความคืบหน้าอะไรเลยแม้สถานะงานจะเปลี่ยนจริงก็ตาม
  // เปลี่ยนมาเรียก sendChatMessage() ผ่าน RPC แทน เหมือนข้อความที่ช่างพิมพ์เอง
  const sendSystemChatMessage = async (jobId: string, text: string) => {
    setChatMessages((prev) => (activeJob?.id === jobId ? [...prev, { sender: 'tech', text }] : prev));
    try {
      await sendChatMessage({ jobId, sender: 'tech', text });
    } catch (err) {
      console.error('Error sending system chat message:', err);
    }
  };

  // ดักฟังสัญญาณโทรแบบเรียลไทม์กับลูกค้า (Supabase Broadcast) — ใช้ช่องสัญญาณเดียวกับฝั่งลูกค้า `call_{jobId}`
  // เมื่อลูกค้ากดโทรหาช่าง หน้าจอ "สายเรียกเข้า" จะเด้งขึ้นทันทีที่ฝั่งช่าง และในทางกลับกันก็เช่นกัน
  useEffect(() => {
    if (!activeJob) {
      callChannelRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`call_${activeJob.id}`)
      .on('broadcast', { event: 'call_ring' }, ({ payload }) => {
        if (payload?.from === 'customer') {
          setIncomingCallInfo({ name: payload.name || activeJob.customerName, phone: payload.phone || activeJob.customerPhone });
          setShowIncomingCall(true);
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }) => {
        if (payload?.from === 'customer') {
          setShowIncomingCall(false);
          setShowOutgoingCall(false);
        }
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      callChannelRef.current = null;
    };
  }, [activeJob?.id]);

  // ฟังก์ชันโทรหาลูกค้า — เปิดหน้าจอ "กำลังโทรออก" ในแอปก่อน (เหมือนฝั่งลูกค้า) พร้อมส่งสัญญาณแจ้งเตือนไปยังฝั่งลูกค้าแบบเรียลไทม์
  const handleCallCustomer = (job: TowJob) => {
    setShowOutgoingCall(true);
    callChannelRef.current?.send({
      type: 'broadcast',
      event: 'call_ring',
      payload: { from: 'tech', name: tech.name, phone: tech.phone },
    });
  };

  // ฟังก์ชันรับสายที่ลูกค้าโทรเข้ามา — ปิดหน้าจอสายเรียกเข้าแล้วเปิดแอปโทรศัพท์จริงเพื่อคุยกัน
  const handleAcceptIncomingCall = () => {
    setShowIncomingCall(false);
  };

  // ฟังก์ชันปฏิเสธสาย — แจ้งฝั่งลูกค้าว่าช่างไม่สะดวกรับสาย
  const handleDeclineIncomingCall = () => {
    setShowIncomingCall(false);
    callChannelRef.current?.send({
      type: 'broadcast',
      event: 'call_end',
      payload: { from: 'tech' },
    });
  };

  // เก็บ id ของเคสที่ถูกปฏิเสธ (กดปฏิเสธเอง หรือหมดเวลานับถอยหลัง 30 วิ) — กรองออกจาก
  // pendingJobs ของช่างคนนี้เท่านั้น ไม่ได้ลบงานออกจากระบบจริง เผื่อช่างคนอื่นยังรับได้อยู่
  const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(new Set());

  // เพิ่ม (ระบบเสนองานให้ช่างใกล้สุด — ดู 0012_nearest_tech_offer_dispatch.sql):
  // 1) ซ่อนงานที่ server เสนอให้ช่างคนอื่นอยู่ (offeredTechId ไม่ตรงกับตัวเองและยังไม่หมดอายุ)
  //    ออกจากคิวไปเลย — listPendingAndOwnJobs ฝั่ง dtc-api.ts กรองให้ชั้นหนึ่งแล้วตอน fetch
  //    แรก แต่ subscribeAllJobs (realtime) ยังส่งทุกแถวเข้ามาดิบๆ ไม่ผ่านตัวกรองนั้น เลยต้อง
  //    กรองซ้ำอีกชั้นตรงนี้ด้วย กัน race ที่งานเสนอให้คนอื่นโผล่เข้าคิวเราชั่วครู่ผ่าน realtime
  // 2) เรียงตามระยะทางจริงจากตำแหน่งช่าง (techLiveCoords) ไปยังจุดเกิดเหตุ แทนการเรียงตาม
  //    เวลาสร้างงาน (createdAt) เดิม ให้เคสที่อยู่ใกล้ตัวช่างที่สุดขึ้นเป็นอันดับแรกจริงๆ
  //    ถ้ายังไม่มีตำแหน่งสด (เพิ่งเปิดแอป ยัง GPS lock ไม่ทัน) fallback เป็น createdAt เดิม
  const now = Date.now();
  const pendingJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'pending' && !j.techId && !dismissedJobIds.has(j.id))
        .filter((j) => {
          if (!j.offeredTechId) return true;
          if (j.offeredTechId === tech.id) return true;
          return !!(j.offerExpiresAt && j.offerExpiresAt < now);
        })
        .sort((a, b) => {
          if (techLiveCoords && a.pickupLat != null && a.pickupLng != null && b.pickupLat != null && b.pickupLng != null) {
            const distA = haversineDistanceMeters(techLiveCoords, { lat: a.pickupLat, lng: a.pickupLng });
            const distB = haversineDistanceMeters(techLiveCoords, { lat: b.pickupLat, lng: b.pickupLng });
            return distA - distB;
          }
          return b.createdAt - a.createdAt;
        }),
    [jobs, dismissedJobIds, tech.id, techLiveCoords]
  );

  // รีเซ็ตตัวจับเวลานับถอยหลังทุกครั้งที่ "งานที่อยู่บนสุด" เปลี่ยน (งานใหม่เข้ามาแทนที่ หรืองานเดิมถูกจัดการไปแล้ว)
  const topPendingJobId = pendingJobs[0]?.id ?? null;
  useEffect(() => {
    setNewJobCountdown(30);
    if (!topPendingJobId) return;

    // สั่นเตือนช่างทันทีที่มีเคสใหม่ขึ้นมาบนสุด (กันพลาดเคสตอนไม่ได้จ้องหน้าจอ)
    // ครอบ try/catch ไว้เพราะปลั๊กอิน Haptics ใช้ไม่ได้ตอนรันบนเบราว์เซอร์ปกติ (นอก Capacitor)
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});

    const timer = setInterval(() => {
      setNewJobCountdown((prev) => {
        if (prev <= 1) {
          // หมดเวลา 30 วิแล้วยังไม่กดรับ — เคสนี้หายไปจากหน้าจอช่างคนนี้ ระบบจะเสนอให้ช่างคนถัดไปแทน
          // (เดิมคอมเมนต์นี้เขียนไว้ล่วงหน้าแต่โค้ดยังไม่เคยแจ้ง server จริง — ตอนนี้เรียก
          // expireStaleJobOffer จริงแล้ว server จะเช็คเวลาซ้ำเองแล้วส่งต่อช่างใกล้สุดคนถัดไป
          // ดู 0012_nearest_tech_offer_dispatch.sql)
          setDismissedJobIds((ids) => new Set(ids).add(topPendingJobId));
          expireStaleJobOffer(topPendingJobId).catch((err) =>
            console.error('Error expiring stale job offer:', err)
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [topPendingJobId]);

  const historyJobs = useMemo(
    () => jobs.filter((j) => j.techId === tech.id && j.status === 'completed').sort((a, b) => b.updatedAt - a.updatedAt),
    [jobs, tech.id]
  );

  // ยอดเงินสด vs โอนที่เก็บมาวันนี้ — ดึงจากตาราง payments จริง (แยกจาก todayEarnings ซึ่งเป็น
  // ยอดราคางานรวมทั้งหมด ไม่แยกวิธีชำระ)
  const [todayCashTotal, setTodayCashTotal] = useState(0);
  const [todayTransferTotal, setTodayTransferTotal] = useState(0);

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todaysJobIds = historyJobs
      .filter((j) => j.updatedAt >= startOfDay.getTime())
      .map((j) => j.id);

    if (todaysJobIds.length === 0) {
      setTodayCashTotal(0);
      setTodayTransferTotal(0);
      return;
    }

    supabase
      .from('payments')
      .select('amount, payment_method')
      .in('job_id', todaysJobIds)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading today payment breakdown:', error);
          return;
        }
        const rows = data ?? [];
        const cash = rows
          .filter((p: any) => p.payment_method === 'cash')
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const transfer = rows
          .filter((p: any) => p.payment_method !== 'cash')
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        setTodayCashTotal(cash);
        setTodayTransferTotal(transfer);
      });
  }, [historyJobs]);

  const todayEarnings = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return historyJobs
      .filter((j) => j.updatedAt >= startOfDay.getTime())
      .reduce((sum, j) => sum + j.price, 0);
  }, [historyJobs]);

  // เปรียบเทียบรายได้วันนี้กับเมื่อวาน (คำนวณจากข้อมูลจริงใน historyJobs ไม่ใช่ค่าจำลอง)
  const yesterdayEarnings = useMemo(() => {
    const startOfYesterday = new Date();
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return historyJobs
      .filter((j) => j.updatedAt >= startOfYesterday.getTime() && j.updatedAt < startOfToday.getTime())
      .reduce((sum, j) => sum + j.price, 0);
  }, [historyJobs]);

  const earningsChangePercent = useMemo(() => {
    if (yesterdayEarnings === 0) return todayEarnings > 0 ? 100 : 0;
    return Math.round(((todayEarnings - yesterdayEarnings) / yesterdayEarnings) * 100);
  }, [todayEarnings, yesterdayEarnings]);

  const dailyChartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const dayJobs = historyJobs.filter(
        (j) => j.updatedAt >= d.getTime() && j.updatedAt < nextD.getTime()
      );
      const totalIncome = dayJobs.reduce((acc, curr) => acc + curr.price, 0);

      days.push({
        label: formatDateLabel(d, { weekday: 'short' }),
        income: totalIncome,
        jobsCount: dayJobs.length,
      });
    }
    return days;
  }, [historyJobs, lang]);

  const monthlyChartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);

      const nextM = new Date(d);
      nextM.setMonth(d.getMonth() + 1);

      const monthJobs = historyJobs.filter(
        (j) => j.updatedAt >= d.getTime() && j.updatedAt < nextM.getTime()
      );
      const totalIncome = monthJobs.reduce((acc, curr) => acc + curr.price, 0);

      months.push({
        label: formatDateLabel(d, { month: 'short' }),
        income: totalIncome,
        jobsCount: monthJobs.length,
      });
    }
    return months;
  }, [historyJobs, lang]);

  const maxChartIncome = useMemo(() => {
    const data = chartMode === 'daily' ? dailyChartData : monthlyChartData;
    return Math.max(...data.map((d) => d.income), 1000);
  }, [chartMode, dailyChartData, monthlyChartData]);

  // ---- เข้าสู่ระบบด้วยอีเมล/รหัสผ่านจริง (ผูก Supabase Auth) ----
  // เดิมฟังก์ชันนี้แค่เช็คว่ากรอกครบสองช่องแล้ว setIsLoggedIn(true) เลย ไม่ว่าจะพิมพ์อะไรมา
  // ก็เข้าได้และเห็นโปรไฟล์ DEFAULT_TECH ("ช่างสมศักดิ์ บริการดี") เหมือนกันหมด — ตอนนี้เช็ค
  // กับบัญชีที่สมัครไว้จริงผ่าน signInTechnician() ถ้าอีเมล/รหัสผ่านผิดหรือยังไม่เคยสมัคร
  // จะขึ้น error ไม่ให้เข้า และถ้าเข้าได้จะโหลดชื่อ/เบอร์/ทะเบียนของช่างคนนั้นจริง ๆ มาแสดง
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword.trim()) {
      setToast({ message: t.toastFillEmailPassword, type: 'error' });
      return;
    }
    setIsLoggingIn(true);
    try {
      const profile = await signInTechnician(loginPhone.trim(), loginPassword);
      setTech((prev) => ({
        ...prev,
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        plateNumber: profile.plateNumber,
        rating: profile.rating,
        jobsDone: profile.jobsDone,
        status: profile.status,
        specialties: profile.specialties,
      }));
      setEditName(profile.name);
      setEditPhone(profile.phone);
      setEditPlate(profile.plateNumber);
      setIsLoggedIn(true);
      setToast({ message: t.toastLoginSuccess.replace('{name}', profile.name), type: 'success' });
    } catch (err: any) {
      const rawMessage: string = err?.message || '';
      const friendlyMessage = rawMessage.toLowerCase().includes('invalid login credentials')
        ? t.errInvalidCredentials
        : rawMessage || t.errLoginFailedGeneric;
      setToast({ message: friendlyMessage, type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // กดปุ่ม "เข้าสู่ระบบด้วย LINE" — เปิดหน้า LINE consent ในเบราว์เซอร์ระบบผ่าน Supabase
  // OAuth (custom:line) ผลลัพธ์จริงจะมาที่ useEffect ที่ลงทะเบียน registerLineAuthListener
  // ด้านล่าง เพราะตอบกลับผ่าน deep link แยกรอบ ไม่ใช่ return value ตรงจากฟังก์ชันนี้
  const handleLineLogin = async () => {
    setIsLineAuthLoading(true);
    try {
      await signInWithLine('worker');
    } catch (err: any) {
      setIsLineAuthLoading(false);
      setToast({ message: err?.message || t.errLineLoginOpenFail, type: 'error' });
    }
  };

  // ผลลัพธ์หลัง LINE OAuth สำเร็จ (มี Supabase session แล้ว) — เช็คว่าเคยมีแถวโปรไฟล์ช่าง
  // (ตาราง technicians) ไว้หรือยัง ถ้าเคย = ล็อกอินสำเร็จเข้าแอปได้เลย ถ้ายัง = เป็นช่าง LINE
  // ใหม่ ต้องพาไปกรอกฟอร์มสมัคร (t3/t4) ต่อให้ครบ — ชื่อ/เบอร์/ทะเบียนรถ/แนบเอกสารยืนยัน
  // ตัวตน ยังจำเป็นอยู่เหมือนเดิม เพราะ LINE ID token ไม่มีข้อมูลพวกนี้ให้เลย
  const handleLineAuthSuccess = async (
    userId: string,
    claims: { name?: string; email?: string; picture?: string }
  ) => {
    try {
      const existingProfile = await getTechProfileIfExists(userId);
      if (existingProfile) {
        setTech((prev) => ({
          ...prev,
          id: existingProfile.id,
          name: existingProfile.name,
          phone: existingProfile.phone,
          plateNumber: existingProfile.plateNumber,
          rating: existingProfile.rating,
          jobsDone: existingProfile.jobsDone,
          status: existingProfile.status,
          specialties: existingProfile.specialties,
        }));
        setEditName(existingProfile.name);
        setEditPhone(existingProfile.phone);
        setEditPlate(existingProfile.plateNumber);
        setIsLoggedIn(true);
        setIsLineAuthLoading(false);
        setToast({ message: t.toastLoginSuccess.replace('{name}', existingProfile.name), type: 'success' });
        return;
      }

      // ช่าง LINE ใหม่ — พาไปแท็บสมัครสมาชิก พร้อม prefill ชื่อจาก LINE และซ่อนช่อง
      // อีเมล/รหัสผ่านออก (isLineFlow) เพราะมี auth session จาก LINE อยู่แล้ว
      setLineTechId(userId);
      setIsLineFlow(true);
      setSignupFullName(claims.name || '');
      setSignupEmail(claims.email || '');
      setAuthTab('signup');
      setIsLineAuthLoading(false);
      setToast({ message: t.toastLineSignupNeeded, type: 'success' });
    } catch (err: any) {
      setIsLineAuthLoading(false);
      setToast({ message: err?.message || t.errLineLoginFailed, type: 'error' });
    }
  };

  const handleLineAuthError = (message: string) => {
    setIsLineAuthLoading(false);
    setToast({ message, type: 'error' });
  };

  // ลงทะเบียนดักฟัง deep link callback จาก LINE OAuth ครั้งเดียวตอน mount หน้านี้
  useEffect(() => {
    const cleanup = registerLineAuthListener('worker', handleLineAuthSuccess, handleLineAuthError);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- ลืมรหัสผ่าน: ขั้นตอนที่ 1 ส่งรหัส OTP ไปยังเบอร์โทร (เหมือนฝั่งลูกค้า) ----
  const handleSendResetOtp = () => {
    if (!resetPhone.trim()) {
      setResetPhoneError(true);
      return;
    }
    setResetPhoneError(false);
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedResetOtp(randomOtp);
    setResetOtpValues(['', '', '', '', '', '']);
    setForgotStep('otp');
    setToast({ message: t.toastOtpSentToPhone.replace('{phone}', resetPhone), type: 'success' });
  };

  // ---- ลืมรหัสผ่าน: ขั้นตอนที่ 2 กรอก OTP ----
  const handleResetOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const next = [...resetOtpValues];
    next[index] = value;
    setResetOtpValues(next);
    if (value && index < 5) resetOtpRefs.current[index + 1]?.focus();
  };

  const handleResetOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !resetOtpValues[index] && index > 0) {
      resetOtpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyResetOtp = () => {
    setForgotStep('newPassword');
  };

  // ---- ลืมรหัสผ่าน: ขั้นตอนที่ 3 ตั้งรหัสผ่านใหม่ ----
  const handleSubmitNewLoginPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let hasError = false;
    setNewLoginPasswordErr('');
    setConfirmLoginPasswordErr('');

    if (!newLoginPassword.trim()) {
      setNewLoginPasswordErr(t.errNewPasswordRequired);
      hasError = true;
    } else if (newLoginPassword.length < 6) {
      setNewLoginPasswordErr(t.errPasswordMinLength);
      hasError = true;
    }

    if (!confirmLoginPassword.trim()) {
      setConfirmLoginPasswordErr(t.errConfirmPasswordRequired);
      hasError = true;
    } else if (newLoginPassword.trim() && confirmLoginPassword.trim() && newLoginPassword !== confirmLoginPassword) {
      setConfirmLoginPasswordErr(t.errPasswordMismatch);
      hasError = true;
    }

    if (!hasError) {
      setShowResetSuccessModal(true);
    }
  };

  const handleResetSuccessClose = () => {
    setShowResetSuccessModal(false);
    setLoginPassword(newLoginPassword);
    setLoginPhone(resetPhone || loginPhone);
    setNewLoginPassword('');
    setConfirmLoginPassword('');
    setResetPhone('');
    setForgotStep('phone');
    setShowForgotPassword(false);
  };

  // ---- สมัครสมาชิกช่าง: เลือกไฟล์เอกสารยืนยันตัวตน/บริษัท (แค่พรีวิว ยังไม่อัปโหลดจนกว่าจะกด NEXT) ----
  const handleSignupFileSelect = (kind: 'id' | 'business', file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (kind === 'id') {
      setIdCardFile(file);
      setIdCardPreview(previewUrl);
    } else {
      setBusinessDocFile(file);
      setBusinessDocPreview(previewUrl);
    }
  };

  // ---- สมัครสมาชิกช่าง: ส่งรหัส OTP ไปยังเบอร์โทรที่กรอก (mock เหมือนฟลว์ลืมรหัสผ่านด้านบน — ยังไม่ผูก SMS gateway จริง) ----
  const handleSendSignupOtp = () => {
    if (!signupPhone.trim()) {
      setToast({ message: t.errPhoneRequired, type: 'error' });
      return;
    }
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setSignupGeneratedOtp(randomOtp);
    setSignupOtpValues(['', '', '', '', '', '']);
    setSignupOtpSent(true);
    setSignupPhoneVerified(false);
    setToast({ message: t.toastOtpSentWithTest.replace('{phone}', signupPhone).replace('{otp}', randomOtp), type: 'success' });
  };

  const handleSignupOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const next = [...signupOtpValues];
    next[index] = value;
    setSignupOtpValues(next);
    if (value && index < 5) signupOtpRefs.current[index + 1]?.focus();
    const joined = next.join('');
    if (joined.length === 6) {
      if (joined === signupGeneratedOtp) {
        setSignupPhoneVerified(true);
      } else {
        setToast({ message: t.errOtpInvalid, type: 'error' });
      }
    }
  };

  const handleSignupOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !signupOtpValues[index] && index > 0) {
      signupOtpRefs.current[index - 1]?.focus();
    }
  };

  // ---- สมัครสมาชิกช่าง: เช็คเงื่อนไขรหัสผ่านแบบเรียลไทม์ (แสดง checklist ตามภาพตัวอย่าง) ----
  const signupPasswordChecks = useMemo(
    () => ({
      length: signupPassword.length >= 8,
      uppercase: /[A-Z]/.test(signupPassword),
      numberSpecial: /[0-9]/.test(signupPassword) && /[^A-Za-z0-9]/.test(signupPassword),
    }),
    [signupPassword]
  );

  // ---- สมัครสมาชิกช่าง: กด NEXT — สร้างบัญชี, อัปโหลดเอกสารขึ้น Supabase Storage แล้วบันทึกโปรไฟล์ ----
  const handleSubmitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFullName.trim() || !signupEmployeeId.trim() || !signupPhone.trim()) {
      setToast({ message: t.errFillAllFields, type: 'error' });
      return;
    }
    // ยืนยัน OTP เบอร์โทรยังจำเป็นสำหรับทุกคนไม่ว่าจะสมัครแบบไหน (ตรวจสอบว่าเบอร์ใช้งานได้จริง)
    if (!signupPhoneVerified) {
      setToast({ message: t.errVerifyPhoneOtpFirst, type: 'error' });
      return;
    }
    // ช่องอีเมล/รหัสผ่าน ไม่จำเป็นสำหรับผู้ที่มาจาก LINE OAuth แล้ว (isLineFlow) เพราะยืนยัน
    // ตัวตนผ่าน LINE ไปแล้ว ไม่ต้องตั้งบัญชีอีเมล/รหัสผ่านซ้ำอีกชั้น
    if (!isLineFlow) {
      if (!signupEmail.trim()) {
        setToast({ message: t.errFillAllFields, type: 'error' });
        return;
      }
      if (!signupPasswordChecks.length || !signupPasswordChecks.uppercase || !signupPasswordChecks.numberSpecial) {
        setToast({ message: t.errPasswordRequirementsNotMet, type: 'error' });
        return;
      }
      if (signupPassword !== signupConfirmPassword) {
        setToast({ message: t.errPasswordConfirmMismatch, type: 'error' });
        return;
      }
    }
    if (!idCardFile) {
      setToast({ message: t.errAttachIdDoc, type: 'error' });
      return;
    }
    if (!businessDocFile) {
      setToast({ message: t.errAttachBusinessDoc, type: 'error' });
      return;
    }

    setIsSubmittingSignup(true);
    try {
      // 1) หา techId — ถ้ามาจาก LINE OAuth แล้วใช้ auth user id เดิมที่มีอยู่แล้วเลย (lineTechId)
      //    ไม่เรียก signUp() ซ้ำ เพราะจะสร้างบัญชีอีเมล/รหัสผ่านซ้อนทับ session ของ LINE
      //    ถ้าสมัครด้วยอีเมลปกติ (ไม่ใช่ LINE) ยังคงสร้างบัญชีใหม่ผ่าน registerTechnician() เหมือนเดิม
      const techId = isLineFlow ? lineTechId : (await registerTechnician({
        email: signupEmail,
        password: signupPassword,
      })).techId;

      // 2) อัปโหลดเอกสารทั้งสองไฟล์ขึ้น Supabase Storage (bucket: tech-documents) พร้อมกัน
      const [idCardUpload, businessDocUpload] = await Promise.all([
        uploadTechDocument(techId, idCardFile, 'id_card'),
        uploadTechDocument(techId, businessDocFile, 'business_doc'),
      ]);

      // 3) บันทึกโปรไฟล์ + URL เอกสารผ่าน RPC เดียว (ดู supabase/migrations/0005_tech_documents.sql)
      await saveTechRegistrationDetails({
        techId,
        fullName: signupFullName,
        employeeId: signupEmployeeId,
        phone: signupPhone,
        idCardUrl: idCardUpload.publicUrl,
        businessDocUrl: businessDocUpload.publicUrl,
      });

      setToast({ message: t.toastSignupSuccess, type: 'success' });
      setAuthTab('login'); setIsLineFlow(false);
    } catch (err: any) {
      setToast({ message: err?.message || t.errSignupFailed, type: 'error' });
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editPhone.trim() || !editPlate.trim()) {
      setToast({ message: t.errFillCompleteInfo, type: 'error' });
      return;
    }
    const updated = {
      ...tech,
      name: editName,
      phone: editPhone,
      plateNumber: editPlate,
    };
    setTech(updated);
    setIsEditingProfile(false);
    setToast({ message: t.toastProfileSaved, type: 'success' });
  };

  const changeStatus = useCallback(
    (status: TechStatus) => {
      if (activeJob && status !== 'working') {
        setToast({ message: t.errActiveJobBlockStatus, type: 'error' });
        return;
      }
      // เดิมเรียก setTechStatus() จาก dtc-shared (เขียนแค่ localStorage) เปลี่ยนเป็น
      // setTechStatusApi() ที่เขียนขึ้น Supabase จริง
      setTech((prev) => {
        const next = { ...prev, status };
        setTechStatusApi(prev.id, status).catch((err) =>
          console.error('Error setting technician status:', err)
        );
        return next;
      });
    },
    [activeJob]
  );

  const acceptJob = async (job: TowJob) => {
    try {
      // เดิม update ตรงเข้า jobs พร้อมส่งข้อมูลช่าง 5 ฟิลด์เอง เปลี่ยนเป็นเรียก
      // acceptJobApi() แทน — RPC ไปดึงข้อมูลช่างจากตาราง technicians เอง (source
      // of truth เดียว) ดู 0003_accept_job_rpc.sql
      await acceptJobApi(job.id, tech.id);

      // เดิมจุดนี้อัปเดตแค่สถานะของ "งาน" เป็น accepted แต่ไม่เคยแตะสถานะของ "ช่าง" เลย
      // ทำให้ช่างค้างเป็น "ออนไลน์" ทั้งที่มีงานอยู่ในมือจริง ต้องเปลี่ยนสถานะช่างเป็น
      // 'working' ทันทีที่กดรับงาน เหมือนกับตอนกด "จบงาน" ที่ปล่อยกลับเป็น online เอง
      setTech((prev) => ({ ...prev, status: 'working' }));
      setTechStatusApi(tech.id, 'working').catch((err) =>
        console.error('Error setting technician status to working:', err)
      );

      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'accepted', techId: tech.id } : j)));
      setSelectedPendingJob(null);
      setToast({ message: t.toastJobAccepted.replace('{id}', job.id), type: 'success' });
      // กดรับงานแล้วพาไปหน้า "งานของฉัน" ทันที แทนที่จะค้างอยู่หน้าแรก (เดิมงานที่รับจะไปโผล่
      // ทับหน้าแรกเฉยๆ ทำให้สับสนว่าอยู่หน้าไหน) — หน้าแรกกลับไปว่างพร้อมรับเคสถัดไป
      setActiveTab('myjobs');

      // ข้อความทักทายอัตโนมัติ ส่งเข้าแชตทันทีที่รับงาน ให้ลูกค้ารู้ว่าช่างคนไหนรับงานและกำลังจะไปหา
      sendSystemChatMessage(
        job.id,
        t.greetingMsg.replace('{name}', tech.name || t.defaultTechName)
      );
    } catch (err) {
      console.error('Error accepting job:', err);
      setToast({ message: t.errAcceptJobFailed, type: 'error' });
    }
  };

  const declineJob = (job: TowJob) => {
    setDismissedJobIds((ids) => new Set(ids).add(job.id));
    setSelectedPendingJob(null);
    setToast({ message: t.toastJobDeclined.replace('{id}', job.id), type: 'error' });
    // เดิมตรงนี้ซ่อนงานจากเครื่องตัวเองเฉยๆ ไม่เคยแจ้ง server เลย ทำให้ระบบไม่รู้ว่าต้องส่งต่อ
    // ให้ช่างคนถัดไป (ดู 0012_nearest_tech_offer_dispatch.sql) — fire-and-forget ได้ เพราะ UI
    // ฝั่งช่างคนนี้อัปเดตไปแล้วข้างบนไม่ว่า call นี้จะสำเร็จหรือไม่ (ถ้าพลาดจริงๆ ยังมี
    // expireStaleJobOffer เป็น safety net ตอน offer หมดอายุอยู่ดี)
    declineJobOffer(job.id, tech.id).catch((err) =>
      console.error('Error notifying server of job decline:', err)
    );
  };

  // ข้อความแจ้งเตือนสถานะอัตโนมัติที่จะถูกส่งเข้าแชตทุกครั้งที่ช่างกดอัปเดตสถานะงาน
  // ให้ลูกค้าเห็นความคืบหน้าทุกขั้นตอนในแชตเดียวกัน โดยไม่กระทบการพิมพ์คุยกันปกติ
  // ใช้ t.xxx แทนข้อความไทยตายตัว เพื่อให้ข้อความที่ส่งเข้าแชตเปลี่ยนตามภาษาที่ช่างเลือกไว้ (lang)
  const STATUS_CHAT_MESSAGES: Partial<Record<TowJob['status'], string>> = {
    en_route: t.statusMsgEnRoute,
    arrived: t.statusMsgArrivedTow,
    loading: t.statusMsgLoading,
    delivering: t.statusMsgDelivering,
    completed: t.statusMsgCompletedTow,
  };

  // ข้อความสำหรับงานที่ไม่ต้องลากรถ (จบที่หน้างานเลย เช่น พ่วงแบต/เปลี่ยนยาง)
  const STATUS_CHAT_MESSAGES_ON_SITE: Partial<Record<TowJob['status'], string>> = {
    en_route: t.statusMsgEnRoute,
    arrived: t.statusMsgArrivedOnSite,
    completed: t.statusMsgCompletedOnSite,
  };

  const advanceJob = async (job: TowJob) => {
    // งาน 'tow' ต้องลากรถไปอู่ (arrived → ยกรถ → นำส่งอู่ → เสร็จ)
    // งาน 'jump_start' / 'tire_change' ซ่อมจบที่หน้างานเลย ไม่ต้องยกรถ/นำส่งอู่
    const needsTow = job.requiredSpecialty === 'tow';
    const jobSteps: { status: TowJob['status']; label: string; buttonLabel: string }[] = needsTow
      ? [
          { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
          { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
          { status: 'arrived', label: t.jobArrived, buttonLabel: t.startLoading },
          { status: 'loading', label: t.jobLoading, buttonLabel: t.deliveringToGarage },
          { status: 'delivering', label: t.jobDelivering, buttonLabel: t.finishJob },
        ]
      : [
          { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
          { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
          { status: 'arrived', label: t.jobArrived, buttonLabel: t.finishJob },
        ];

    const currentIdx = jobSteps.findIndex((s) => s.status === job.status);
    const nextStep = jobSteps[currentIdx + 1];
    const newStatus: TowJob['status'] = nextStep ? nextStep.status : 'completed';

    // บังคับให้ช่างกดยืนยันว่าได้รับเงินแล้ว (เงินสด/สลิปโอน) ก่อนถึงจะกดปุ่ม "จบงาน" ได้
    // เดิมกดจบงานได้เลยแม้ยังไม่ได้กดยืนยันรับเงิน ทำให้งานปิดไปโดยไม่มีหลักฐานการชำระเงินยืนยันแล้ว
    // ยกเว้น 2 กรณี:
    //  - payment_method === 'credit' : บัตรตัดเงินอัตโนมัติ ไม่มีปุ่มให้ช่างกดยืนยันอยู่แล้ว (ดู ActiveJobCard)
    //  - activeJobPayment เป็น null : ไม่มี record การชำระเงินเลย (เช่น insert ตอนสร้างงานพลาดไป)
    //    เพื่อกันไม่ให้งานค้างจบไม่ได้ตลอดกาลจากเหตุสุดวิสัยฝั่งระบบ ไม่ใช่ความผิดช่าง
    if (
      newStatus === 'completed' &&
      activeJobPayment &&
      activeJobPayment.payment_method !== 'credit' &&
      activeJobPayment.status !== 'verified'
    ) {
      setToast({ message: t.errConfirmPaymentBeforeFinish, type: 'error' });
      return;
    }

    // เดิม update ตรง + client เพิ่ม jobsDone เอง เปลี่ยนเป็นเรียก advanceJobStatus()
    // แทน — RPC เช็คลำดับ status ก่อนอนุญาต และนับ jobs_done ให้เองตอน completed
    // (ดู 0002_price_and_status_rpc.sql) จึงลบส่วน upsertTech(prev.jobsDone+1) ทิ้ง
    try {
      await advanceJobStatus(job.id, newStatus);
    } catch (err) {
      console.error('Error advancing job status:', err);
      setToast({ message: t.errUpdateStatusFailed, type: 'error' });
      return;
    }

    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j)));

    // แจ้งเตือนสถานะใหม่เข้าไปในแชตของลูกค้าทันที ไม่ต้องรอให้ช่างพิมพ์เอง
    const statusMsg = (needsTow ? STATUS_CHAT_MESSAGES : STATUS_CHAT_MESSAGES_ON_SITE)[newStatus];
    if (statusMsg) sendSystemChatMessage(job.id, statusMsg);

    if (!nextStep) {
      // สถานะ 'online' และ jobsDone ที่แท้จริงจะ sync กลับมาจาก server ผ่าน
      // hydrateFromSupabase / realtime subscription — ที่นี่แค่ปรับ UI ให้ไวขึ้นชั่วคราว
      setTech((prev) => ({ ...prev, status: 'online' as TechStatus }));
      setToast({ message: t.toastJobCompleted.replace('{id}', job.id).replace('{amount}', formatNumber(job.price)), type: 'success' });
      // เก็บ snapshot ไว้โชว์เป็นสรุปใบเสร็จ — ใช้ activeJobPayment ตอนนี้ (ก่อนที่ effect จะเคลียร์
      // ทิ้งพอ activeJob เปลี่ยนเป็น null ในเฟรมถัดไป)
      setCompletedReceipt({
        job,
        payment: activeJobPayment
          ? { payment_method: activeJobPayment.payment_method, status: activeJobPayment.status }
          : null,
      });
    }
  };

  const openMaps = (job: TowJob) => {
    // แก้บั๊ก: เดิม deep link ไป Google Maps ชี้ไปจุดเกิดเหตุตลอด แม้สถานะจะเป็น loading/delivering
    // (กำลังนำรถไปส่งอู่แล้ว) ทำให้ปุ่ม "นำทาง" พาช่างวกกลับไปจุดเกิดเหตุผิดที่ — เช็คสถานะงานก่อน
    // ว่าตอนนี้ควรไปอู่หรือไปจุดเกิดเหตุ
    const headingToGarage = job.status === 'loading' || job.status === 'delivering';
    const dest =
      headingToGarage && job.garageLat != null && job.garageLng != null
        ? { lat: job.garageLat, lng: job.garageLng }
        : job.pickupLat != null && job.pickupLng != null
        ? { lat: job.pickupLat, lng: job.pickupLng }
        : null;

    const url = dest
      ? `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.pickupAddress)}`;
    window.open(url, '_blank');
  };

  // สรุปงานก่อนกดนำทางจริง — เดิมกด "นำทาง" แล้วเด้งออกไปเปิด Google Maps ทันที ไม่มีจุดให้เช็ค
  // ที่อยู่/เบอร์ลูกค้าอีกครั้งก่อน ถ้ากดผิดงาน (เผลอกดใบที่ไม่ใช่ตอนมีหลายงานพร้อมกัน) จะรู้ตัว
  // อีกทีตอนขับไปถึงที่ผิดแล้ว — เพิ่ม modal สรุปสั้นๆ ให้เช็คก่อนออกไปจริง
  const [navigateConfirmJob, setNavigateConfirmJob] = useState<TowJob | null>(null);
  const confirmAndOpenMaps = () => {
    if (!navigateConfirmJob) return;
    openMaps(navigateConfirmJob);
    setNavigateConfirmJob(null);
  };

  // รายงานปัญหา/ตามกวนหนี้กับงานที่จบไปแล้ว — ยังไม่มีตาราง dispute หรือแอปแอดมินแยกต่างหากในระบบนี้
  // เลยส่งเป็นข้อความพิเศษ (คำนำหน้า [REPORT]) เข้าแชตของงานนั้นแทน อย่างน้อยลูกค้าเห็นทันทีว่าช่าง
  // แจ้งปัญหาไว้แล้ว และแอดมินที่เข้ามาไล่ดูแชตย้อนหลังจะกรองด้วยคำนำหน้านี้เจอ
  const reportJobIssue = async (job: TowJob) => {
    const reason = window.prompt(t.reportPromptTech);
    if (!reason || !reason.trim()) return;
    await sendSystemChatMessage(job.id, `${t.reportPrefixTech}${reason.trim()}`);
    setToast({ message: t.reportSentSuccessTech, type: 'success' });
  };

  // ==========================================================================
  // SPLASH SCREEN
  // ==========================================================================
  if (showSplash) {
    return (
      <div className="flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased">
        <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-white shadow-2xl flex flex-col items-center justify-center p-6">
          <div className="relative h-56 w-full max-w-[260px] animate-pulse">
            <Image src="/M5.png" alt="DTC Mechanic Solutions" fill sizes="260px" className="object-contain" priority />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // WELCOME SCREEN (หน้าแรกที่เห็นหลัง Splash ก่อนเข้าหน้า Login)
  // ==========================================================================
  if (showWelcome) {
    return (
      <div className="flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased">
        <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-white shadow-2xl flex flex-col">
          {/* หมายเหตุ: เอากรอบมือถือจำลอง (fixed 390x844px + notch ปลอม) ออก เพราะตอนรันเป็น native app
              ผ่าน Capacitor จอจริงของเครื่องมีขนาด/รอยบากอยู่แล้ว ไม่ต้องจำลองซ้ำ */}

          {/* Real-time Status Bar เอาออกแล้ว — ตอนรันเป็น native app ผ่าน Capacitor
              จอเครื่องมีแถบสถานะจริงอยู่แล้ว ไม่ต้องจำลองซ้ำในหน้าล็อกอิน/onboarding */}

          {/* โครงสร้างแบบเดียวกับหน้า Welcome ฝั่งลูกค้า (โค้ด n3): รูป Hero เต็มจอด้านบนสุด ไม่มีโลโก้/ตัวหนังสือคั่น
              แล้วการ์ดข้อมูล (โลโก้ + หัวข้อ + ฟีเจอร์ + ปุ่ม) ซ้อนทับขอบล่างของรูป (-mt-6 rounded-t-3xl) */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="relative w-full flex-1 min-h-[280px] overflow-hidden">
              <Image src="/M4.jpg" alt="DTC Towing" fill sizes="100vw" className="object-cover" priority />

              {/* โลโก้ + หัวข้อ ซ้อนทับบนรูป (บริเวณท้องฟ้า) ขยายใหญ่ขึ้นตามที่ขอ */}
              <div className="absolute top-14 left-0 right-0 z-10 flex flex-col items-center px-6 text-center">
                <div className="relative h-24 w-60 drop-shadow-lg">
                  <Image src="/M5.png" alt="DTC Mechanic Solutions" fill sizes="240px" className="object-contain" priority />
                </div>
                <h1 className="mt-2 text-2xl font-black text-white drop-shadow-md">{t.welcomeTitle}</h1>
                <p className="mt-1 text-xs text-white/90 leading-relaxed drop-shadow-md max-w-[280px]">{t.welcomeSubtitle}</p>
              </div>
            </div>

            <div className="relative z-10 bg-white px-5 pt-5 pb-6 -mt-6 rounded-t-3xl shadow-2xl space-y-2.5">
              <div className="space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{t.navSupportTitle}</p>
                    <p className="text-[10px] text-slate-500">{t.navSupportDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{t.jobMgmtTitle}</p>
                    <p className="text-[10px] text-slate-500">{t.jobMgmtDesc}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { setAuthTab('login'); setShowWelcome(false); setIsLineFlow(false); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
              >
                {t.btnLogin} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setAuthTab('signup'); setShowWelcome(false); setIsLineFlow(false); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 active:scale-95 transition-all"
              >
                <UserPlus className="h-3.5 w-3.5" /> {t.btnCreateAccount}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // LOGIN SCREEN (พร้อมระบบสลับภาษา Text-Only + Real-time Status Header)
  // ==========================================================================
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased">
        <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-white shadow-2xl flex flex-col">


          {/* วงไล่สีชมพูอ่อนมุมขวาบน ตกแต่งพื้นหลังตามภาพตัวอย่าง */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-pink-100/70 blur-3xl" />

          {/* Real-time Status Bar เอาออกแล้ว — ตอนรันเป็น native app ผ่าน Capacitor
              จอเครื่องมีแถบสถานะจริงอยู่แล้ว ไม่ต้องจำลองซ้ำในหน้าล็อกอิน */}

          {/* Top Bar Language Selector (Text-only ไม่มีรูปธงชาติ) */}
          <div className="relative z-40 flex justify-end px-6 mt-1">
            <div className="flex items-center gap-1 bg-slate-100 rounded-full px-2 py-1">
              {(['TH', 'EN', 'CN'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                    lang === l ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1">{LANG_FLAG[l]} {l}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Login Form / Forgot Password View */}
          {authTab === 'signup' && !showForgotPassword ? (
            /* ==================================================================
               SIGNUP SCREEN (สมัครสมาชิกช่าง) — หน้าเดียวยาว scroll ได้ ตรงกับภาพ
               ตัวอย่าง t3 (ครึ่งบน: ข้อมูลทั่วไป+รหัสผ่าน) ต่อด้วย t4 (ครึ่งล่าง:
               อัปโหลดเอกสาร+ยืนยันเบอร์โทร) — เป็น section เดียวกันไม่ใช่คนละหน้า
               ================================================================== */
            <div className="relative z-10 flex flex-1 flex-col px-6 pt-1 pb-5 overflow-y-auto">
              <div className="mb-3 flex flex-col items-center text-center">
                <div className="relative h-16 w-full max-w-[160px]">
                  <Image src="/M5.png" alt="DTC Mechanic Solutions" fill sizes="160px" className="object-contain" priority />
                </div>
              </div>

              {/* Tabs: เข้าสู่ระบบ / สมัครสมาชิก */}
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setIsLineFlow(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-500 transition-all"
                >
                  <KeyRound className="h-3.5 w-3.5" /> {t.login}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setIsLineFlow(false); }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold bg-orange-500 text-white shadow-xs transition-all"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {t.newAccountTab}
                </button>
              </div>

              <p className="mb-4 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" /> {t.joinIntro}
              </p>

              <form onSubmit={handleSubmitSignup} className="space-y-3.5 pb-2">
                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.fullNameLabel}
                  </label>
                  <input
                    type="text"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                    placeholder={t.fullNamePlaceholder}
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.employeeIdLabel}
                  </label>
                  <input
                    type="text"
                    value={signupEmployeeId}
                    onChange={(e) => setSignupEmployeeId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                    placeholder={t.employeeIdPlaceholder}
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.phone}
                  </label>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 focus-within:border-orange-500 focus-within:bg-white transition-all">
                    <span className="text-xs font-bold text-slate-500">+66</span>
                    <input
                      type="tel"
                      value={signupPhone}
                      onChange={(e) => {
                        setSignupPhone(e.target.value);
                        setSignupOtpSent(false);
                        setSignupPhoneVerified(false);
                      }}
                      className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none"
                      placeholder={t.phonePlaceholder}
                    />
                  </div>
                </div>

                {/* Email / รหัสผ่าน — ซ่อนไว้ถ้ามาจาก LINE OAuth แล้ว (isLineFlow) เพราะยืนยัน
                    ตัวตนผ่าน LINE ไปแล้ว ไม่ต้องตั้งบัญชีอีเมล/รหัสผ่านซ้ำอีกชั้น */}
                {isLineFlow ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#06C755">
                      <path d="M12 2C6.48 2 2 5.87 2 10.5c0 4.02 3.36 7.4 7.93 8.16-.11.5-.68 2.28-.78 2.63 0 0-.02.13.06.18.08.05.17.02.17.02.23-.03 2.65-1.75 3.73-2.47.62.09 1.26.14 1.89.14 5.52 0 10-3.87 10-8.66S17.52 2 12 2z" />
                    </svg>
                    <p className="text-[10px] font-bold text-emerald-700">{t.lineIdentityVerifiedNote}</p>
                  </div>
                ) : (
                  <>
                    {/* Email Address */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                        {t.email}
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                        placeholder={t.emailPlaceholder}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                        {t.password}
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                          placeholder={t.createPasswordPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showSignupPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                        {t.confirmPasswordLabel}
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupConfirmPassword ? 'text' : 'password'}
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                          placeholder={t.confirmPasswordPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showSignupConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Password requirements checklist */}
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {t.passwordMustContain}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${signupPasswordChecks.length ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqLength}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${signupPasswordChecks.uppercase ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqUppercase}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${signupPasswordChecks.numberSpecial ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqNumberSpecial}
                      </p>
                    </div>
                  </>
                )}

                {/* Identity Verification */}
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {idCardFile ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5 text-orange-500" />
                    )}
                    {t.identityVerificationTitle}
                  </p>
                  <p className="text-[10px] text-slate-400">{t.identityVerificationDesc}</p>
                  <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-orange-300 bg-orange-50 py-4 cursor-pointer active:scale-95 transition-all">
                    {idCardPreview ? (
                      <img src={idCardPreview} alt="Identity document" className="h-16 w-auto rounded-lg object-cover" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-orange-500" />
                        <span className="text-[10px] font-bold text-orange-600 text-center px-4">{t.uploadIdCard}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleSignupFileSelect('id', e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                {/* Company Verification */}
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    {businessDocFile ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5 text-orange-500" />
                    )}
                    {t.companyVerificationTitle}
                  </p>
                  <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-orange-300 bg-orange-50 py-4 cursor-pointer active:scale-95 transition-all">
                    {businessDocPreview ? (
                      <img src={businessDocPreview} alt="Business document" className="h-16 w-auto rounded-lg object-cover" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-orange-500" />
                        <span className="text-[10px] font-bold text-orange-600 text-center px-4">{t.uploadBusinessDoc}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => handleSignupFileSelect('business', e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                {/* Verify phone number */}
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-orange-500" /> {t.verifyPhoneTitle}
                  </p>
                  {!signupOtpSent ? (
                    <>
                      <p className="text-[10px] text-slate-400">{t.verifyPhoneDesc}</p>
                      <button
                        type="button"
                        onClick={handleSendSignupOtp}
                        className="w-full rounded-xl bg-slate-800 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                      >
                        {t.sendOtp}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">+66 {signupPhone}</span>
                        <button
                          type="button"
                          onClick={handleSendSignupOtp}
                          className="text-[10px] font-bold text-orange-600 hover:underline"
                        >
                          {t.changePhone}
                        </button>
                      </div>
                      {!signupPhoneVerified && (
                        <p className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] text-amber-700">
                          {t.otpNotConnectedNote}{' '}
                          <span className="font-extrabold text-amber-900">{signupGeneratedOtp}</span>
                        </p>
                      )}
                      <div className="flex justify-between items-center gap-1.5 py-1">
                        {signupOtpValues.map((val, idx) => (
                          <input
                            key={idx}
                            ref={(el) => { signupOtpRefs.current[idx] = el; }}
                            type="text"
                            maxLength={1}
                            value={val}
                            onChange={(e) => handleSignupOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleSignupOtpKeyDown(idx, e)}
                            disabled={signupPhoneVerified}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-300 bg-slate-50 text-center text-sm font-bold text-slate-800 shadow-xs focus:bg-white focus:border-orange-500 focus:outline-none transition-all disabled:opacity-60"
                          />
                        ))}
                      </div>
                      {signupPhoneVerified && (
                        <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {t.verified}
                        </p>
                      )}
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSignup}
                  className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all mt-1 disabled:opacity-60"
                >
                  {isSubmittingSignup && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSubmittingSignup ? t.submitting : t.next}
                </button>
              </form>
            </div>
          ) : !showForgotPassword ? (
            <div className="relative z-10 flex flex-1 flex-col px-6 pt-1 pb-5 overflow-y-auto">
              <div className="mb-3 flex flex-col items-center text-center">
                <div className="relative h-20 w-full max-w-[190px]">
                  <Image src="/M5.png" alt="DTC Mechanic Solutions" fill sizes="190px" className="object-contain" priority />
                </div>
              </div>

              {/* Tabs: เข้าสู่ระบบ / สมัครสมาชิก ตามภาพตัวอย่าง */}
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => { setAuthTab('login'); setIsLineFlow(false); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    authTab === 'login' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" /> {t.login}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setIsLineFlow(false); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    authTab === 'signup' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" /> {t.newAccountTab}
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.email}
                  </label>
                  <input
                    type="text"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                    placeholder="tech@dtcmechanic.com"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.password}
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 pr-10 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white transition-all"
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showLoginPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setForgotStep('phone'); setShowForgotPassword(true); }}
                    className="text-[10px] font-bold text-orange-600 hover:underline"
                  >
                    {t.forgotPassword}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all mt-1 disabled:opacity-60"
                >
                  {isLoggingIn && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isLoggingIn ? t.submitting : t.signIn}
                </button>
              </form>

              {/* ปุ่มสมัคร/เข้าสู่ระบบทางเลือกอื่น ตามภาพตัวอย่าง (ยังเป็นปุ่มตกแต่ง ไม่ได้ผูก OAuth จริง — ถ้ากดจะขึ้น toast บอกว่ายังไม่เปิดใช้งาน แทนที่จะแกล้งล็อกอินให้เข้าได้เลย) */}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setIsLineFlow(false); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 active:scale-95 transition-all"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-500" /> {t.signUpWithEmail}
                </button>
                <button
                  type="button"
                  onClick={handleLineLogin}
                  disabled={isLineAuthLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#06C755">
                    <path d="M12 2C6.48 2 2 5.87 2 10.5c0 4.02 3.36 7.4 7.93 8.16-.11.5-.68 2.28-.78 2.63 0 0-.02.13.06.18.08.05.17.02.17.02.23-.03 2.65-1.75 3.73-2.47.62.09 1.26.14 1.89.14 5.52 0 10-3.87 10-8.66S17.52 2 12 2z" />
                  </svg>
                  {isLineAuthLoading ? t.lineAuthOpening : t.signUpWithLine}
                </button>
              </div>

              <p className="mt-4 text-center text-[9px] text-slate-400 leading-relaxed">
                {t.termsAgreePrefix}{' '}
                <a href="#" className="text-orange-600 font-semibold hover:underline">{t.termsOfService}</a>{' '}
                {t.and}{' '}
                <a href="#" className="text-orange-600 font-semibold hover:underline">{t.privacyPolicy}</a>
              </p>
            </div>
          ) : forgotStep === 'phone' ? (
            /* Forgot Password: ขั้นตอนที่ 1 กรอกเบอร์โทร */
            <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-800">{t.resetPasswordTitle}</h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.resetPasswordDesc}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.phone}
                  </label>
                  <input
                    type="text"
                    value={resetPhone}
                    onChange={(e) => {
                      setResetPhone(e.target.value);
                      if (e.target.value.trim() !== '') setResetPhoneError(false);
                    }}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none transition-all ${
                      resetPhoneError
                        ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                        : 'border border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white'
                    }`}
                    placeholder="081-234-5678"
                  />
                </div>

                <button
                  onClick={handleSendResetOtp}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
                >
                  {t.sendOtp}
                </button>

                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-800 pt-2 block"
                >
                  {t.backToLogin}
                </button>
              </div>
            </div>
            </div>
          ) : forgotStep === 'otp' ? (
            /* Forgot Password: ขั้นตอนที่ 2 ยืนยัน OTP */
            <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-800">{t.verifyOtpTitle}</h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{t.verifyOtpDesc}</p>
              </div>

              <div className="flex justify-between items-center gap-1.5 py-3">
                {resetOtpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { resetOtpRefs.current[idx] = el; }}
                    type="text"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleResetOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleResetOtpKeyDown(idx, e)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-300 bg-slate-50 text-center text-base font-bold text-slate-800 shadow-xs focus:bg-white focus:border-orange-500 focus:outline-none transition-all"
                  />
                ))}
              </div>

              <div className="space-y-3 mt-2">
                <button
                  onClick={handleVerifyResetOtp}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
                >
                  {t.verify}
                </button>

                <button
                  onClick={() => setForgotStep('phone')}
                  className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-slate-800 pt-2 block"
                >
                  {t.backToLogin}
                </button>
              </div>
            </div>
            </div>
          ) : (
            /* Forgot Password: ขั้นตอนที่ 3 ตั้งรหัสผ่านใหม่ */
            <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-6">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
              <form onSubmit={handleSubmitNewLoginPassword} className="space-y-3">
                <h2 className="text-sm font-bold text-slate-800">{t.createNewPasswordTitle}</h2>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.newPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewLoginPassword ? 'text' : 'password'}
                      value={newLoginPassword}
                      onChange={(e) => {
                        setNewLoginPassword(e.target.value);
                        if (e.target.value.trim() !== '') setNewLoginPasswordErr('');
                      }}
                      placeholder={t.newPasswordPlaceholder}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none transition-all pr-10 ${
                        newLoginPasswordErr
                          ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                          : 'border border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewLoginPassword(!showNewLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewLoginPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {newLoginPasswordErr && (
                    <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{newLoginPasswordErr}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase tracking-wider">
                    {t.confirmPasswordLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmLoginPassword ? 'text' : 'password'}
                      value={confirmLoginPassword}
                      onChange={(e) => {
                        setConfirmLoginPassword(e.target.value);
                        if (e.target.value.trim() !== '') setConfirmLoginPasswordErr('');
                      }}
                      placeholder={t.confirmNewPasswordPlaceholder}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none transition-all pr-10 ${
                        confirmLoginPasswordErr
                          ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                          : 'border border-slate-200 bg-slate-50 focus:border-orange-500 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmLoginPassword(!showConfirmLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmLoginPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {confirmLoginPasswordErr && (
                    <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{confirmLoginPasswordErr}</p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all mt-2"
                >
                  {t.verify}
                </button>
              </form>
            </div>
            </div>
          )}

          {/* Modal: ตั้งรหัสผ่านสำเร็จ */}
          {showResetSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 shadow-inner">
                  <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{t.resetSuccessTitle}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{t.resetSuccessSub}</p>
                <button
                  onClick={handleResetSuccessClose}
                  className="w-full rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all mt-5"
                >
                  {t.backToLoginBtn}
                </button>
              </div>
            </div>
          )}

          <div className="text-center text-[10px] text-slate-400 pb-2">
            © 2026 DTC Rescue Network. All rights reserved.
          </div>

          {/* Toast Notification — เดิมหน้าล็อกอิน/สมัครสมาชิกนี้ไม่มี Toast ของตัวเอง (มีแค่ใน
              MAIN APP DASHBOARD ด้านล่าง) ทำให้ setToast() ตอนกด NEXT/สมัครสมาชิกไม่ error ก็จริง
              แต่ข้อความ (ทั้ง error และ success) ไม่โผล่ให้เห็นเลย เหมือนกดแล้วไม่มีอะไรเกิดขึ้น */}
          {toast && (
            <div className="absolute bottom-6 left-4 right-4 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div
                className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-2xl border text-xs font-bold text-white ${
                  toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-500 border-red-400'
                }`}
              >
                {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{toast.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ป้ายชื่อบนหมุดช่างสำหรับจอนำทางเต็มจอ (FullScreenNav) — ตรรกะเดียวกับที่ใช้ใน ActiveJobCard
  // (คำนวณแยกไว้ตรงนี้เพราะ FullScreenNav อยู่นอก ActiveJobCard คนละจุดกัน)
  const techMapLabelForNav =
    tech.truckType === 'wheellift'
      ? t.techLabelWheelLift
      : tech.truckType === 'personal'
      ? t.techLabelPersonal
      : tech.truckType === 'slide'
      ? t.techLabelSlide
      : t.techLabelGeneric;

  // ==========================================================================
  // MAIN APP DASHBOARD & WORKING INTERFACE
  // ==========================================================================
  return (
    <div className={`flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased ${darkMode ? 'dark' : ''}`}>
      <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-slate-50 dark:bg-slate-950 shadow-2xl transform">


        {/* Status Bar เอาออกแล้ว — มือถือจริงมีแถบสถานะอยู่แล้ว ไม่ต้องจำลองซ้ำ */}

        {/* Header */}
        <div className="bg-gradient-to-b from-orange-500 to-orange-600 pt-11 pb-4 px-5 rounded-b-[32px] shadow-lg shadow-orange-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Hamburger Button 3 ขีด — ย้ายมาไว้ซ้ายสุด (เปิดเมนู 3 ขีดที่รวมปุ่มเปลี่ยนภาษาไว้อยู่แล้ว) */}
              <button
                onClick={() => setShowDrawerMenu(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-sm border border-white/20">
                {tech.name.slice(3, 4) || t.avatarFallback}
              </div>
              <div>
                <p className="text-white font-bold text-xs leading-tight">{tech.name}</p>
                <div className="flex items-center gap-1 text-orange-100 text-[10px] mt-0.5">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  <span>{formatNumber(tech.rating)}</span>
                  <span>· {formatNumber(tech.jobsDone)} {t.jobsDone}</span>
                </div>
              </div>
            </div>

            {/* กระดิ่งแจ้งเตือน — แทนที่ตำแหน่งปุ่ม 3 ขีดเดิม ให้เหมือนฝั่งลูกค้า */}
            <button
              onClick={() => setShowNotificationsPanel(true)}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-orange-500">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          </div>

          {/* Status Toggle Buttons */}
          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {STATUS_ORDER.map((statusKey) => {
              const m = STATUS_META[statusKey];
              const Icon = m.icon;
              const isActive = tech.status === statusKey;
              const isAutoSlot = statusKey === 'working';
              
              let labelText = t.statusOnline;
              if (statusKey === 'working') labelText = t.statusWorking;
              if (statusKey === 'break') labelText = t.statusBreak;
              if (statusKey === 'offline') labelText = t.statusOffline;

              return (
                <button
                  key={statusKey}
                  onClick={() => !isAutoSlot && changeStatus(statusKey)}
                  disabled={isAutoSlot}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-all active:scale-95 ${
                    isActive ? m.chipActive : m.chipIdle
                  } ${isAutoSlot ? 'cursor-default opacity-90' : ''}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {labelText}
                </button>
              );
            })}
          </div>
        </div>

        {/* แถบเตือนเน็ตหลุด — ใช้ isWifiOnline ที่มีอยู่แล้วในโค้ด (ฟัง online/offline event
            ครบอยู่แล้ว) แต่เดิมไม่เคยเอามาโชว์เป็น UI จริงเลย สำคัญมากสำหรับช่างเพราะถ้าเน็ตหลุด
            ระหว่างงาน ตำแหน่ง GPS จะไม่ถูกส่งขึ้น Supabase และลูกค้าจะเห็นหมุดค้าง โดยที่ช่าง
            เองก็ไม่รู้ตัวว่าเน็ตหลุดอยู่ */}
        {!isWifiOnline && (
          <div className="flex items-center justify-center gap-1.5 bg-red-500 px-4 py-1.5 text-[10px] font-bold text-white">
            <WifiOff className="h-3 w-3" />
            {t.offlineWarningBanner}
          </div>
        )}

        {/* ☰ Side Navigation Drawer Menu (เมนู 3 ขีด เเก้ปัญหา Headset) */}
        {showDrawerMenu && (
          <div className="absolute inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-xs">
            <div className="w-5/6 h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200 overflow-y-auto">
              
              <div>
                {/* 1. Header Section */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white">
                  <div className="flex items-center justify-between mb-3">
                    {/* ปุ่มสลับภาษา (TH | EN | CN) ไม่มีธงชาติ */}
                    <div className="flex items-center gap-1 bg-black/20 rounded-full px-2 py-0.5 border border-white/10">
                      {(['TH', 'EN', 'CN'] as Lang[]).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLang(l)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                            lang === l ? 'bg-white text-orange-600 shadow-xs' : 'text-orange-100 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-1">{LANG_FLAG[l]} {l}</span>
                        </button>
                      ))}
                    </div>

                    <button onClick={() => setShowDrawerMenu(false)} className="text-white hover:opacity-80">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* โปรไฟล์ช่าง */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600 font-black text-lg border-2 border-orange-200 shadow-xs">
                      {tech.name.slice(3, 4) || t.avatarFallback}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs leading-tight text-white">{tech.name}</h3>
                      <p className="text-[10px] text-orange-100 mt-0.5 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> {tech.phone}
                      </p>
                      <span className="inline-block bg-orange-700/40 text-orange-100 text-[9px] px-2 py-0.5 rounded-md mt-1 border border-orange-300/30 font-semibold">
                        ✓ DTC Certified
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Main Work Features Section */}
                <div className="p-4 border-b border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t.menuWorkSection}
                  </p>
                  
                  <button
                    onClick={() => {
                      setActiveTab('home');
                      setShowDrawerMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'home' ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Home className="h-4 w-4 text-orange-500" />
                    <span>{t.menuHome}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('myjobs');
                      setShowDrawerMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'myjobs' ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="h-4 w-4 text-orange-500" />
                    <span>{t.tabMyJobs}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('history');
                      setShowDrawerMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'history' ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <History className="h-4 w-4 text-orange-500" />
                    <span>{t.menuHistory}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDrawerMenu(false);
                      setShowDashboardModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Wallet className="h-4 w-4 text-orange-500" />
                    <span>{t.dashMenu}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowDrawerMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      activeTab === 'profile' ? 'bg-orange-50 text-orange-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <User className="h-4 w-4 text-orange-500" />
                    <span>{t.menuProfile}</span>
                  </button>
                </div>

                {/* 3. System & Support Section */}
                <div className="p-4 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t.menuSystemSection}
                  </p>

                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowDrawerMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Bell className="h-4 w-4 text-orange-500" />
                    <span>{t.menuNoti}</span>
                  </button>

                  <button
                    onClick={() => setShowDrawerMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Headset className="h-4 w-4 text-orange-500" />
                    <span>{t.menuHelp}</span>
                  </button>

                  <button
                    onClick={() => setShowDrawerMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Shield className="h-4 w-4 text-orange-500" />
                    <span>{t.menuSafety}</span>
                  </button>

                  <button
                    onClick={() => setShowDrawerMenu(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Settings className="h-4 w-4 text-orange-500" />
                    <span>{t.menuSettings}</span>
                  </button>
                </div>
              </div>

              {/* 4. Footer Section (ออกจากระบบ) */}
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={async () => {
                    setShowDrawerMenu(false);
                    changeStatus('offline');
                    try {
                      await signOutTechnician();
                    } catch {
                      // เคลียร์หน้าจอฝั่ง client ต่อได้แม้ signOut ฝั่ง server จะพลาด ไม่บล็อกผู้ใช้
                    }
                    setIsLoggedIn(false);
                    setTech(DEFAULT_TECH);
                    setLoginPhone('');
                    setLoginPassword('');
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-red-500 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 active:scale-95 transition-all shadow-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t.logout}</span>
                </button>
                <p className="text-center text-[9px] text-slate-400 mt-2">{t.appVersionFooter}</p>
              </div>

            </div>
          </div>
        )}

        {/* 🔔 MODAL: การแจ้งเตือน (Notifications) — ดีไซน์เดียวกับฝั่งลูกค้า */}
        {showNotificationsPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-500" />
                  <span>{t.notificationsTitle}</span>
                </h3>
                <button onClick={() => setShowNotificationsPanel(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {unreadNotificationCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="self-end text-[10px] font-bold text-orange-600 hover:underline"
                >
                  {t.markAllReadBtn}
                </button>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">{t.noNotificationsYet}</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkNotificationRead(n.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        n.read ? 'bg-white border-slate-100' : 'bg-orange-50 border-orange-100'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          n.type === 'success' ? 'bg-emerald-100 text-emerald-600' : n.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {n.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : n.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{n.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-slate-300 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 📊 Dashboard Modal */}
        {showDashboardModal && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
            <div className="w-full h-[620px] rounded-t-3xl bg-white p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-bottom duration-200">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">{t.dashMenu}</h3>
                      <p className="text-[10px] text-slate-400">{t.dashSubtitle}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDashboardModal(false)} className="text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setChartMode('daily')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      chartMode === 'daily' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    {t.dailySummary}
                  </button>
                  <button
                    onClick={() => setChartMode('monthly')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      chartMode === 'monthly' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    {t.monthlySummary}
                  </button>
                </div>

                <div className="mt-6 pt-4 pb-2 flex items-end justify-between gap-2 h-48 border-b border-slate-100 px-2">
                  {(chartMode === 'daily' ? dailyChartData : monthlyChartData).map((item, idx) => {
                    const heightPercent = maxChartIncome > 0 ? (item.income / maxChartIncome) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="text-[9px] font-bold text-orange-600 mb-1">
                          ฿{item.income > 0 ? formatNumber(item.income / 1000, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + 'k' : formatNumber(0)}
                        </div>
                        <div className="w-full bg-slate-100 rounded-t-lg relative flex items-end h-full">
                          <div
                            style={{ height: `${Math.max(heightPercent, 8)}%` }}
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              item.income > 0
                                ? 'bg-gradient-to-t from-orange-500 to-amber-400'
                                : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 mt-2">{item.label}</span>
                        <span className="text-[9px] text-slate-400">{formatNumber(item.jobsCount)} {t.unitJobs}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between bg-orange-50 p-3.5 rounded-2xl border border-orange-100">
                  <span className="text-xs text-orange-800 font-bold">
                    {t.totalIncome} · {chartMode === 'daily' ? t.last7Days : t.last6Months}
                  </span>
                  <span className="text-lg font-black text-orange-600">
                    ฿{formatNumber(
                      (chartMode === 'daily' ? dailyChartData : monthlyChartData)
                        .reduce((a, b) => a + b.income, 0)
                    )}
                  </span>
                </div>

                {/* ยอดของ "วันนี้" เท่านั้น แยกออกมาให้ชัดเจน ไม่ปนกับยอดรวมของช่วงด้านบน
                    (ยอดรวมด้านบนคือผลรวมของหลายวัน/หลายเดือน ไม่ใช่ยอดวันนี้) */}
                <div className="mt-2 flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 font-bold">{t.todayEarnings}</span>
                  <span className="text-sm font-black text-slate-800">฿{formatNumber(todayEarnings)}</span>
                </div>
              </div>

              <button
                onClick={() => setShowDashboardModal(false)}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white active:scale-95 transition-all"
              >
                {t.closeWindow}
              </button>
            </div>
          </div>
        )}

        {/* จอนำทางเต็มจอสไตล์ Google Maps — ลอยทับทุกอย่าง (แม้แต่ Content Area ที่เลื่อนได้
            ด้านล่าง) ตอนงานอยู่ในสถานะ "กำลังเดินทาง" ดู useEffect ที่ setNavFullScreen ด้านบน
            สำหรับเงื่อนไขเปิด/ปิดอัตโนมัติ */}
        {navFullScreen && activeJob && (activeJob.status === 'en_route' || activeJob.status === 'delivering') && (
          <FullScreenNav
            job={activeJob}
            t={t}
            lang={lang}
            techPos={techLiveCoords}
            techMapLabel={techMapLabelForNav}
            routeGeometry={routeGeometry}
            routeIsEstimated={routeIsEstimated}
            routeSteps={routeSteps}
            payment={activeJobPayment}
            onMinimize={() => setNavFullScreen(false)}
            onAdvance={advanceJob}
            onCall={handleCallCustomer}
            onChat={() => setShowChat(true)}
            onNavigate={setNavigateConfirmJob}
            hasUnreadChat={hasUnreadChat}
          />
        )}

        {/* Content Area */}
        <div className="h-[calc(100%-190px)] overflow-y-auto px-4 py-4 pb-24 space-y-4 dark:bg-slate-950">
          {activeTab === 'home' && (
            <>
              {activeJob ? (
                // ย้าย ActiveJobCard (การ์ดงานปัจจุบัน+แผนที่) ไปอยู่แท็บ "งานของฉัน" (myjobs)
                // แยกต่างหากแล้ว — หน้าแรกตอนมีงานอยู่ในมือ โชว์แค่แบนเนอร์สั้นๆ ให้กดไปดูต่อ
                // เพื่อไม่ให้สับสนว่าตัวเองอยู่หน้าไหน (เดิมงานที่รับจะโผล่ทับหน้าแรกไปเลย)
                <button
                  onClick={() => setActiveTab('myjobs')}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-left text-white shadow-lg active:scale-[0.98] transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-orange-300 uppercase tracking-wide">{t.activeJobTitle}</p>
                    <p className="text-sm font-bold mt-0.5 truncate">{activeJob.customerName || t.noCustomerName}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{t.goToMyJobsHint}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-orange-300 shrink-0" />
                </button>
              ) : tech.status === 'online' ? (
                jobsLoading && jobs.length === 0 ? (
                  // Skeleton ตอนโหลดรายการงานครั้งแรก — เดิมช่วงนี้จอว่างเปล่าจนกว่า fetch
                  // จะเสร็จ ทำให้ดูเหมือนแอปค้าง/ไม่มีงานทั้งที่จริงยังโหลดอยู่
                  <div className="space-y-2 animate-pulse">
                    {[0, 1].map((i) => (
                      <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
                          <div className="h-5 w-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="h-3 w-2/3 rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="flex gap-2 pt-1">
                          <div className="h-9 flex-1 rounded-xl bg-slate-100 dark:bg-slate-800" />
                          <div className="h-9 flex-1 rounded-xl bg-slate-200 dark:bg-slate-700" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pendingJobs.length === 0 ? (
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 text-center border border-dashed border-slate-200 dark:border-slate-700">
                    <Truck className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t.noJobs}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* การ์ดงานใหม่บนสุด — ดีไซน์ใหม่ตามภาพที่ผู้ใช้ส่งมา (การ์ดไล่สีส้ม-แดง,
                        แสดงจุดรับรถ/จุดหมายปลายทางเป็นสองแถวแยกกัน, ราคาประเมินเป็น chip,
                        ระยะทางมุมขวาบน) — ยังคงตัวจับเวลานับถอยหลัง 30 วิเดิมไว้ (ในวงกลมมุมขวาบน) */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-500 to-red-500 shadow-lg shadow-orange-200 p-4 text-white">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25">
                            <Bell className="h-3.5 w-3.5 text-white animate-bounce" />
                          </div>
                          <span className="text-xs font-bold text-white">{t.newJobAlertTitle}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-white/90">
                            {formatNumber(pendingJobs[0].distanceKm)} {t.unitKm}
                          </span>
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 text-[10px] font-black text-white">
                            {newJobCountdown}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2">
                          <MapPin className="h-3.5 w-3.5 text-white shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">{t.collectVehicleLabel}</p>
                            <p className="text-[11px] font-semibold text-white truncate">
                              {pendingJobs[0].pickupAddress || t.noPickupAddress}
                            </p>
                          </div>
                        </div>

                        {pendingJobs[0].requiredSpecialty === 'tow' && pendingJobs[0].nearestGarage && (
                          <div className="flex items-start gap-2 rounded-xl bg-white/15 px-3 py-2">
                            <Flag className="h-3.5 w-3.5 text-white shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">{t.vehicleDestinationLabel}</p>
                              <p className="text-[11px] font-semibold text-white truncate">{pendingJobs[0].nearestGarage}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-orange-700">
                          <Wrench className="h-3 w-3" /> {pendingJobs[0].issueType || t.noIssueType}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-black text-amber-300">
                          {t.estimatedCostLabel} ฿{formatNumber(pendingJobs[0].price)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => setJobToDecline(pendingJobs[0])}
                          className="rounded-xl bg-white/20 py-2.5 text-xs font-bold text-white active:scale-95 transition-all"
                        >
                          {t.declineJob}
                        </button>
                        <button
                          onClick={() => acceptJob(pendingJobs[0])}
                          className="rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-900/20 active:scale-95 transition-all"
                        >
                          {t.acceptJob}
                        </button>
                      </div>
                    </div>

                    {/* แถบสรุปคิวงานที่รอถัดไป — เห็นชัดตั้งแต่ไกลๆ ไม่ต้องนับแถวเอง */}
                    {pendingJobs.length > 1 && (
                      <div className="flex items-center justify-between rounded-xl bg-orange-50 border border-orange-100 px-3 py-2">
                        <span className="text-[11px] font-bold text-orange-700 flex items-center gap-1.5">
                          <Bell className="h-3.5 w-3.5" />
                          {t.moreJobsWaitingLabel}
                        </span>
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-black text-white">
                          {pendingJobs.length - 1}
                        </span>
                      </div>
                    )}

                    {/* งานที่รอคิวถัดไป (ถ้ามีมากกว่า 1 งาน) — แถวเล็กกดเข้าไปดูรายละเอียดได้ */}
                    {pendingJobs.slice(1).map((job) => (
                      <PendingJobRow key={job.id} job={job} t={t} lang={lang} onOpen={() => setSelectedPendingJob(job)} />
                    ))}
                  </div>
                )
              ) : (
                <div className="rounded-2xl bg-red-50/60 p-8 text-center border border-red-100 mt-4">
                  <div
                    className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
                      tech.status === 'break' ? 'bg-amber-100 text-amber-500' : 'bg-red-100 text-red-500'
                    }`}
                  >
                    {tech.status === 'break' ? <Coffee className="h-7 w-7" /> : <WifiOff className="h-7 w-7" />}
                  </div>
                  <p className={`text-sm font-bold ${tech.status === 'break' ? 'text-amber-800' : 'text-red-700'}`}>
                    {tech.status === 'break' ? t.breakState : t.offlineState}
                  </p>
                  <p className="text-xs text-red-400 mt-1">{t.onlineInstruction}</p>
                </div>
              )}

              {/* การ์ดหลัก — รายได้วันนี้ พร้อม % เปลี่ยนแปลงจากเมื่อวาน (คำนวณจากข้อมูลจริง) */}
              <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> {t.todayEarnings}
                </div>
                <div className="flex items-end justify-between mt-1">
                  <p className="text-2xl font-black text-slate-800">฿{formatNumber(todayEarnings)}</p>
                  {earningsChangePercent !== 0 && (
                    <span
                      className={`flex items-center gap-0.5 text-[11px] font-bold mb-0.5 ${
                        earningsChangePercent > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      <TrendingUp className={`h-3 w-3 ${earningsChangePercent < 0 ? 'rotate-180' : ''}`} />
                      {earningsChangePercent > 0 ? '+' : ''}
                      {formatNumber(earningsChangePercent)}% {t.vsYesterday}
                    </span>
                  )}
                </div>
              </div>

              {/* การ์ดรอง 2 อัน — งานเสร็จสิ้นวันนี้ / คะแนนรีวิวเฉลี่ย */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" /> {t.todayCompleted}
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    {formatNumber(historyJobs.filter((j) => j.updatedAt >= new Date().setHours(0, 0, 0, 0)).length)} {t.unitJobs}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <Clock className="h-3.5 w-3.5 text-amber-500" /> {t.ratingAvgLabel}
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {formatNumber(tech.rating)}
                  </p>
                </div>
              </div>

              {/* เงินสด vs โอน ที่เก็บมาวันนี้ */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <Banknote className="h-3.5 w-3.5 text-emerald-500" /> {t.cashCollected}
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1">฿{formatNumber(todayCashTotal)}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <CreditCard className="h-3.5 w-3.5 text-sky-500" /> {t.transferCollected}
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1">฿{formatNumber(todayTransferTotal)}</p>
                </div>
              </div>

            </>
          )}

          {activeTab === 'myjobs' && (
            <div className="space-y-4">
              {activeJob ? (
                <ActiveJobCard
                  job={activeJob}
                  t={t}
                  lang={lang}
                  onAdvance={advanceJob}
                  onNavigate={setNavigateConfirmJob}
                  onChat={() => setShowChat(true)}
                  onCall={handleCallCustomer}
                  hasUnreadChat={hasUnreadChat}
                  payment={activeJobPayment}
                  onVerifyPayment={handleVerifyPayment}
                  onRejectPayment={() => handleRejectPayment(activeJob)}
                  onCancelStuckJob={() => setShowCancelStuckModal(true)}
                  techPos={techLiveCoords}
                  routeGeometry={routeGeometry}
                  routeIsEstimated={routeIsEstimated}
                  techTruckType={tech.truckType}
                  onOpenFullScreenNav={() => setNavFullScreen(true)}
                />
              ) : (
                <div className="rounded-2xl bg-white p-8 text-center border border-dashed border-slate-200">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
                    <Truck className="h-7 w-7 text-orange-300" />
                  </div>
                  <p className="text-xs text-slate-400">{t.noActiveJob}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 mb-1">{t.historyTitle}</h3>
              {historyJobs.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">{t.noHistory}</p>
              ) : (
                historyJobs.map((job) => (
                  <div key={job.id} className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800">{job.id}</p>
                      <p className="text-xs font-black text-orange-600">฿{formatNumber(job.price)}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {job.carBrand} {job.carModel} · {job.plateNumber}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" /> {job.pickupAddress || t.noPickupAddress}
                    </p>
                    <button
                      onClick={() => reportJobIssue(job)}
                      className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500"
                    >
                      <AlertCircle className="h-3 w-3" /> {t.reportIssueBtn}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* การ์ดโปรไฟล์หลัก — ดีไซน์ตามภาพที่ผู้ใช้ส่งมา (โทนส้ม, รูป, คะแนน, สถานะออนไลน์) */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-xl shadow-md border border-white/30">
                        {tech.name.slice(3, 4) || t.avatarFallback}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-orange-600">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-white">{tech.name}</h2>
                        <ShieldCheck className="h-4 w-4 text-white/90" />
                      </div>
                      <p className="text-[10px] text-orange-100 font-medium">{tech.phone}</p>
                      <div className="flex items-center gap-1 text-[10px] text-white mt-0.5">
                        <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                        <span className="font-bold">{formatNumber(tech.rating)}</span>
                        <span className="text-orange-100">({formatNumber(tech.jobsDone)} {t.jobsDone})</span>
                      </div>
                    </div>
                  </div>

                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* ปุ่มสถานะออนไลน์/ออฟไลน์ — สะท้อนสถานะจริงจาก tech.status (แตะเพื่อกลับไป
                    สลับที่หน้าแรกได้เร็วๆ นี้ ตอนนี้แค่แสดงผล ให้ตรงกับสถานะปัจจุบัน) */}
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${
                      tech.status !== 'offline' ? 'bg-white text-emerald-600' : 'bg-white/20 text-white'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tech.status !== 'offline' ? 'bg-emerald-500' : 'bg-white/60'}`} />
                    {tech.status !== 'offline' ? t.profileStatusOnline : t.profileStatusOffline}
                  </span>
                </div>
              </div>

              {/* เดิมตรงนี้เป็นรายการ 6 แถว (ข้อมูลส่วนตัว/บัญชีธนาคาร/แจ้งเตือน/ตั้งค่า/
                  ช่วยเหลือ/เอกสาร) แช่อยู่กลางแท็บโปรไฟล์ตลอด ทำให้หน้ายาวและรก — ยุบเหลือ
                  ปุ่มเดียว กดแล้วค่อยเปิดเป็นหน้าจอแยกต่างหาก (ดู showAccountInfoScreen
                  ด้านล่างสุดของไฟล์) ส่วนแจ้งเตือน/โหมดมืดยังเข้าถึงเร็วได้จากกล่องด้านล่าง
                  (ไม่ต้องเข้าไปอีกชั้นเพราะเป็นของที่กดใช้บ่อย) */}
              <button
                onClick={() => setShowAccountInfoScreen(true)}
                className="w-full flex items-center gap-3 rounded-2xl bg-white shadow-xs border border-slate-100 px-4 py-3.5 text-left hover:bg-slate-50 transition-all"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{t.profileAccountInfoTitle}</p>
                  <p className="text-[10px] text-slate-400 truncate">{t.profileAccountInfoSub}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
              </button>

              {/* การ์ดสรุปผลงาน — ตามภาพ: Completion Rate / Rating / Rank / Days Active
                  (หมายเหตุ: completion rate, rank และ days active ยังไม่มีคอลัมน์จริงใน
                  ตาราง technicians จึงแสดงเป็นค่าประมาณชั่วคราวไปก่อน ส่วน rating ดึงจาก
                  ข้อมูลจริง tech.rating) */}
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-800">{t.myPerformance}</p>
                  <button
                    onClick={() => setShowDashboardModal(true)}
                    className="text-[10px] font-bold text-orange-600 hover:underline"
                  >
                    {t.viewDetails}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white mb-1">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">90%</p>
                    <p className="text-[8px] text-slate-400 leading-tight">{t.completionRate}</p>
                  </div>
                  <div>
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-white mb-1">
                      <Star className="h-4 w-4 fill-white" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">{formatNumber(tech.rating)}</p>
                    <p className="text-[8px] text-slate-400 leading-tight">{t.rating}</p>
                  </div>
                  <div>
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-sky-400 text-white mb-1">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">9</p>
                    <p className="text-[8px] text-slate-400 leading-tight">{t.rankLabel}</p>
                  </div>
                  <div>
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-orange-400 text-white mb-1">
                      <History className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">75</p>
                    <p className="text-[8px] text-slate-400 leading-tight">{t.daysActive}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-orange-500" /> {t.vehicleType}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTech((prev) => ({ ...prev, truckType: 'slide' }))}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      tech.truckType === 'slide'
                        ? 'bg-orange-50/80 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Truck className="h-5 w-5 text-orange-500" />
                      {tech.truckType === 'slide' && <CircleDot className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold">{t.slideTruckLabel}</p>
                      <p className="text-[9px] text-slate-400">Slide Tow Truck</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setTech((prev) => ({ ...prev, truckType: 'wheellift' }))}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      tech.truckType === 'wheellift'
                        ? 'bg-orange-50/80 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Wrench className="h-5 w-5 text-orange-500" />
                      {tech.truckType === 'wheellift' && <CircleDot className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold">{t.wheelLiftTruckLabel}</p>
                      <p className="text-[9px] text-slate-400">Wheel-Lift Truck</p>
                    </div>
                  </button>

                  {/* รถส่วนตัวของช่างที่ใช้ออกงานซ่อมหน้างาน (แบตหมด/ยางแตก) โดยไม่ต้อง
                      เอารถสไลด์/รถยกไปด้วย — เป็นแค่ป้ายระบุประเภทรถที่ใช้เดินทาง ส่วนงาน
                      ประเภทไหนจะส่งเข้ามาจริงยังคุมด้วย specialties (jump_start/tire_change)
                      ด้านล่างเหมือนเดิม ไม่ผูกกับ truckType นี้ */}
                  <button
                    onClick={() => setTech((prev) => ({ ...prev, truckType: 'personal' }))}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      tech.truckType === 'personal'
                        ? 'bg-orange-50/80 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Car className="h-5 w-5 text-orange-500" />
                      {tech.truckType === 'personal' && <CircleDot className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold">{t.personalVehicleLabel}</p>
                      <p className="text-[9px] text-slate-400">Mobile Repair Vehicle</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* บริการซ่อมหน้างาน (ไม่ต้องใช้รถสไลด์/รถยก) — ติ๊กได้มากกว่า 1 อัน ต้องมี
                  อุปกรณ์พร้อมจริงถึงจะติ๊ก เพราะจะเริ่มมีเคสพ่วงแบต/เปลี่ยนยางส่งเข้ามาให้ทันที */}
              <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-orange-500" /> {t.onSiteServiceTitle}
                </p>
                <p className="text-[9px] text-slate-400 -mt-2">
                  {t.onSiteServiceDesc}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleSpecialty('jump_start')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      tech.specialties.includes('jump_start')
                        ? 'bg-orange-50/80 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Battery className="h-5 w-5 text-orange-500" />
                      {tech.specialties.includes('jump_start') && <CircleDot className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold">{t.jumpStartLabel}</p>
                      <p className="text-[9px] text-slate-400">{t.jumpStartSubLabel}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => toggleSpecialty('tire_change')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      tech.specialties.includes('tire_change')
                        ? 'bg-orange-50/80 border-orange-500 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Wrench className="h-5 w-5 text-orange-500" />
                      {tech.specialties.includes('tire_change') && <CircleDot className="h-4 w-4 text-orange-600" />}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-bold">{t.tireChangeLabel}</p>
                      <p className="text-[9px] text-slate-400">Tire Change</p>
                    </div>
                  </button>
                </div>
              </div>

              {isEditingProfile && (
                <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                  <p className="text-xs font-bold text-slate-800">{t.editProfile}</p>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">{t.name}</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">{t.phone}</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">{t.plateNumber}</label>
                      <input
                        type="text"
                        value={editPlate}
                        onChange={(e) => setEditPlate(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setIsEditingProfile(false)}
                        className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500 active:scale-95 transition-all"
                      >
                        {t.cancel}
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-white shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <Save className="h-3.5 w-3.5" /> {t.saveProfile}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-xs border border-slate-100 dark:border-slate-800 space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" /> {t.notifications}
                </p>
                <ToggleRow icon={soundOn ? Bell : BellOff} label={t.soundNoti} value={soundOn} onChange={setSoundOn} />
                <ToggleRow icon={Vibrate} label={t.vibrateNoti} value={vibrateOn} onChange={setVibrateOn} />
                {/* Dark mode toggle — เฟส 1: ใช้ได้กับ shell หลัก/แถบล่าง/แท็บหน้าแรกก่อน
                    ส่วนอื่น (modal, หน้าลงทะเบียน, การ์ดงานที่กำลังทำ ฯลฯ) ยังเป็นสีเดิม
                    (light) รอทำเพิ่มเป็นเฟสถัดไป — ดูคอมเมนต์ที่ตัวแปร darkMode ด้านบน */}
                <ToggleRow icon={darkMode ? Moon : Sun} label={t.darkModeLabel} value={darkMode} onChange={toggleDarkMode} />
              </div>

              <button
                onClick={async () => {
                  changeStatus('offline');
                  try {
                    await signOutTechnician();
                  } catch {
                    // เคลียร์หน้าจอฝั่ง client ต่อได้แม้ signOut ฝั่ง server จะพลาด ไม่บล็อกผู้ใช้
                  }
                  setIsLoggedIn(false);
                  setTech(DEFAULT_TECH);
                  setLoginPhone('');
                  setLoginPassword('');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-red-500 py-3 text-xs font-bold text-red-500 active:scale-95 transition-all"
              >
                <LogOut className="h-4 w-4" /> {t.logout}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-3 py-3 rounded-b-[38px] flex items-center justify-between">
          <NavButton icon={Home} label={t.tabHome} active={activeTab === 'home'} onClick={() => setActiveTab('home')} showBadge={hasUnreadChat && activeTab !== 'home'} badgeCount={activeTab !== 'home' ? pendingJobs.length : 0} />
          {/* เดิมปุ่มนี้ใช้ไอคอน History แต่ติดป้าย "งานของฉัน" และพาไปหน้าประวัติงานที่เสร็จแล้ว
              (คนละเรื่องกัน) — แก้ให้ตรงกับป้ายจริง: พาไปแท็บ myjobs (งานปัจจุบัน) ส่วนประวัติงาน
              ย้ายไปอยู่ในเมนู ☰ (ดู t.menuHistory ในลิ้นชักเมนูด้านบนแทน) */}
          <NavButton icon={Truck} label={t.tabMyJobs} active={activeTab === 'myjobs'} onClick={() => setActiveTab('myjobs')} showBadge={!!activeJob && activeTab !== 'myjobs'} />

          {/* ปุ่มกลาง — เดิมเป็นไอคอนสแกน QR แล้วเปลี่ยนเป็นโลโก้ M5.png ลอยตรงกลาง แต่กดแล้ว
              ไม่ทำอะไรจริงจัง (แค่ toast "เร็วๆ นี้" ของฟีเจอร์สแกนที่ยังไม่ได้ทำ) เปลี่ยนให้
              กดแล้วโทรหาศูนย์/สำนักงานทันที (ดูค่าคงที่ COMPANY_HOTLINE_NUMBER ด้านบนไฟล์ —
              ต้องใส่เบอร์จริงก่อน deploy) มีประโยชน์จริงเวลาช่างเจอเหตุฉุกเฉิน/ข้อพิพาทกับ
              ลูกค้าระหว่างทำงาน ไม่ต้องเข้าเมนู ☰ > ศูนย์ช่วยเหลือ ให้เสียเวลา */}
          <a
            href={`tel:${COMPANY_HOTLINE_NUMBER}`}
            className="relative -mt-8 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 shadow-lg shadow-slate-400/40 border-4 border-white active:scale-95 transition-all overflow-hidden"
            aria-label={t.tabCallOffice}
          >
            <Image src="/M5.png" alt="DTC Mechanic Solutions" fill sizes="56px" className="object-cover" />
          </a>

          <NavButton icon={Wallet} label={t.tabEarning} active={false} onClick={() => setShowDashboardModal(true)} />
          <NavButton icon={User} label={t.tabProfile} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>

        {/* Modal: สรุปใบเสร็จหลังจบงาน */}
        {completedReceipt && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl border border-slate-100 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200">
                <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{t.receiptCompletedTitle}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{t.receiptJobDoneMsg.replace('{id}', completedReceipt.job.id)}</p>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white p-3.5 text-left space-y-1.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t.receiptSummaryTitle}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.customerLabel}</span>
                  <span className="text-[11px] font-bold text-white">{completedReceipt.job.customerName || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.serviceFeeLabel}</span>
                  <span className="text-sm font-black text-amber-300">
                    ฿{formatNumber(completedReceipt.job.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.paymentMethodLabel}</span>
                  <span className="text-[11px] font-bold text-white">
                    {completedReceipt.payment?.payment_method === 'cash'
                      ? t.paymentMethodCash
                      : completedReceipt.payment?.payment_method === 'credit'
                      ? t.paymentMethodCreditCard
                      : t.paymentMethodTransfer}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.paymentStatusLabel}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    {completedReceipt.payment?.payment_method === 'credit'
                      ? t.paymentStatusAutoCard
                      : completedReceipt.payment?.status === 'verified'
                      ? t.paymentConfirmedText
                      : t.paymentStatusNoInfo}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
              >
                {t.closeThisWindow}
              </button>
            </div>
          </div>
        )}

        {/* Modal: งานใหม่ */}
        {selectedPendingJob && (
          <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
            <div className="w-full rounded-t-3xl bg-white p-5 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-500" /> {t.newJobs} {selectedPendingJob.id}
                </h3>
                <button onClick={() => setSelectedPendingJob(null)} className="text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl bg-orange-50 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="flex items-center gap-2 font-bold">
                    <User className="h-3.5 w-3.5 text-orange-500" />
                    {selectedPendingJob.customerName || t.noCustomerName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">#{selectedPendingJob.id}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <PhoneCall className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.customerPhone || t.noCustomerPhone}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Car className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.carBrand} {selectedPendingJob.carModel} · {selectedPendingJob.plateNumber}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.pickupAddress || t.noPickupAddress} ({formatNumber(selectedPendingJob.distanceKm)} {t.unitKm})
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <span className="text-[10px] text-slate-300 font-bold">{t.stdPrice}</span>
                <span className="text-base font-black text-amber-300">฿{formatNumber(selectedPendingJob.price)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setJobToDecline(selectedPendingJob)}
                  className="rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-500 active:scale-95 transition-all"
                >
                  {t.declineJob}
                </button>
                <button
                  onClick={() => acceptJob(selectedPendingJob)}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
                >
                  {t.acceptJob}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal ยืนยันก่อนปฏิเสธงานจริง — กันช่างมือลั่นกด Decline พลาดแล้วเสียเคสฟรีๆ */}
        {jobToDecline && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl border border-slate-100 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{t.confirmDeclineTitle}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{t.confirmDeclineDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setJobToDecline(null)}
                  className="rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 active:scale-95 transition-all"
                >
                  {t.dontDeclineBtn}
                </button>
                <button
                  onClick={() => {
                    declineJob(jobToDecline);
                    setJobToDecline(null);
                    // ถ้าโมดัลรายละเอียดงานเปิดอยู่ตอนกดยืนยันปฏิเสธ ให้ปิดไปด้วยเลย
                    setSelectedPendingJob((cur) => (cur?.id === jobToDecline.id ? null : cur));
                  }}
                  className="rounded-xl bg-red-500 py-3 text-xs font-bold text-white shadow-md shadow-red-200 active:scale-95 transition-all"
                >
                  {t.confirmDeclineBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal สรุปงานก่อนกดนำทางจริง — ให้ช่างเช็คที่อยู่/เบอร์ลูกค้าอีกรอบก่อนออกไปเปิด Google
            Maps เพื่อลดโอกาสกดผิดงานตอนมีงานเข้ามาพร้อมกันหลายใบ */}
        {navigateConfirmJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-sm font-black text-slate-800">{t.navigateConfirmTitle}</h3>
              <p className="mt-1 text-[11px] text-slate-400">{t.navigateConfirmDesc}</p>

              <div className="mt-4 space-y-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">
                    {navigateConfirmJob.pickupAddress || t.noPickupAddress}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">
                    {navigateConfirmJob.customerName} · {navigateConfirmJob.customerPhone || t.noCustomerPhone}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setNavigateConfirmJob(null)}
                  className="rounded-xl bg-slate-100 py-3 text-xs font-bold text-slate-600 active:scale-95 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={confirmAndOpenMaps}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
                >
                  {t.openMapsNav}
                </button>
              </div>

              {/* ปุ่มโทรด่วน เผื่อช่างอยากเช็ค/โทรถามทางก่อนออกจริง */}
              {navigateConfirmJob.customerPhone && (
                <a
                  href={`tel:${navigateConfirmJob.customerPhone}`}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-[11px] font-bold text-slate-500 active:scale-95 transition-all"
                >
                  <Phone className="h-3.5 w-3.5" /> {t.callCustomerBeforeDeparture}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Modal Chat — เต็มจอ ไม่ใช่กล่องลอยตรงกลางอีกต่อไป กันปัญหาคีย์บอร์ดบังกล่องพิมพ์ */}
        {showChat && activeJob && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <div className="bg-orange-500 p-3 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xs font-bold leading-tight">{activeJob.customerName}</h3>
                <span className="text-[9px] text-orange-100 block">{t.chatCustomerJobLabel.replace('{id}', activeJob.id)}</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 bg-slate-50">
              {chatMessages.length === 0 && (
                <p className="text-center text-[11px] text-slate-400 pt-6">{t.noMessagesYet}</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'tech' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-xs ${
                      msg.sender === 'tech'
                        ? 'bg-orange-500 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendTechMessage()}
                placeholder={t.typeMessagePlaceholder}
                className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-800 focus:outline-none"
              />
              <button
                onClick={handleSendTechMessage}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white"
              >
                <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

        {/* Modal: กำลังโทรออกหาลูกค้า — ดีไซน์เดียวกับฝั่งลูกค้า */}
        {showOutgoingCall && activeJob && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl border border-slate-700 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 relative">
                <span className="absolute inset-0 rounded-full bg-orange-400/20 animate-ping" />
                <Phone className="h-9 w-9 relative animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.outgoingCallLabel}</p>
                <h3 className="text-base font-bold text-white mt-1">{activeJob.customerName}</h3>
                <p className="text-sm text-orange-300 font-black mt-0.5">{activeJob.customerPhone}</p>
              </div>

              <a
                href={`tel:${activeJob.customerPhone}`}
                onClick={() => setShowOutgoingCall(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md hover:bg-orange-600 active:scale-95 transition-all"
              >
                <PhoneCall className="h-4 w-4" />
                <span>{t.openPhoneAppToCall}</span>
              </a>

              <button
                onClick={() => {
                  setShowOutgoingCall(false);
                  callChannelRef.current?.send({ type: 'broadcast', event: 'call_end', payload: { from: 'tech' } });
                }}
                className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/20 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* Account Info Screen — เต็มจอ รวมรายการที่เดิมแช่อยู่กลางแท็บโปรไฟล์ (ข้อมูล
            ส่วนตัว/บัญชีธนาคาร/ศูนย์ช่วยเหลือ/เอกสาร) มาไว้ที่นี่แทน เข้าจากปุ่มเดียวใน
            แท็บโปรไฟล์ (ดู showAccountInfoScreen) รายการด้านล่างส่วนใหญ่ยังเป็น
            placeholder (toast "เร็วๆ นี้") เหมือนเดิม แค่ย้ายที่อยู่ ไม่ได้ทำฟังก์ชันจริง
            เพิ่มให้ในรอบนี้ */}
        {showAccountInfoScreen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950">
            <div className="bg-orange-500 p-4 pt-11 text-white flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowAccountInfoScreen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 active:scale-95 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-bold">{t.profileAccountInfoTitle}</h3>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
              <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-xs border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {[
                  { icon: User, title: t.profilePersonalInfo, sub: t.profilePersonalInfoSub, onClick: () => setToast({ message: t.featureComingSoon, type: 'success' }) },
                  { icon: Wallet, title: t.profileBankDetails, sub: t.profileBankDetailsSub, onClick: () => setToast({ message: t.featureComingSoon, type: 'success' }) },
                  { icon: Headset, title: t.profileHelpSupport, sub: t.profileHelpSupportSub, onClick: () => setToast({ message: t.featureComingSoon, type: 'success' }) },
                  { icon: Shield, title: t.profileDocuments, sub: t.profileDocumentsVerified, onClick: () => setToast({ message: t.featureComingSoon, type: 'success' }) },
                ].map((row, idx) => {
                  const RowIcon = row.icon;
                  return (
                    <button
                      key={idx}
                      onClick={row.onClick}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500">
                        <RowIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{row.title}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{row.sub}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {showIncomingCall && incomingCallInfo && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl border border-slate-700 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 relative">
                <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                <PhoneCall className="h-9 w-9 relative animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.incomingCallLabel}</p>
                <h3 className="text-base font-bold text-white mt-1">{incomingCallInfo.name}</h3>
                <p className="text-sm text-emerald-300 font-black mt-0.5">{incomingCallInfo.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDeclineIncomingCall}
                  className="rounded-xl bg-red-500/20 text-red-300 py-3 text-xs font-bold hover:bg-red-500/30 active:scale-95 transition-all"
                >
                  {t.declineBtn}
                </button>
                <a
                  href={`tel:${incomingCallInfo.phone}`}
                  onClick={handleAcceptIncomingCall}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-white py-3 text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <PhoneCall className="h-3.5 w-3.5" /> {t.answerCallBtn}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Modal ยืนยันยกเลิกงานฉุกเฉิน — ให้ช่างกรอกเหตุผลก่อนยืนยัน กันกดพลาด
            (ใช้ได้เฉพาะตอนงานยังไม่ถึงขั้นยกรถ ดูเงื่อนไข canCancelStuck ใน ActiveJobCard) */}
        {showCancelStuckModal && activeJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500 shadow-inner">
                <XCircle className="h-8 w-8 stroke-[2.5]" />
              </div>
              <h3 className="text-center text-base font-bold text-slate-900 mb-1">{t.cancelStuckTitle}</h3>
              <p className="text-center mt-1 text-xs text-slate-500 leading-relaxed">
                {t.cancelStuckDesc}

              </p>
              <textarea
                value={cancelStuckReason}
                onChange={(e) => setCancelStuckReason(e.target.value)}
                placeholder="{t.cancelStuckReasonPlaceholder}"
                rows={3}
                className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowCancelStuckModal(false);
                    setCancelStuckReason('');
                  }}
                  disabled={isCancellingStuckJob}
                  className="rounded-xl bg-slate-100 text-slate-600 py-3 text-xs font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {t.dontCancelBtn}
                </button>
                <button
                  onClick={() => handleCancelStuckJob(activeJob)}
                  disabled={isCancellingStuckJob}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500 text-white py-3 text-xs font-bold active:scale-95 transition-all disabled:opacity-60"
                >
                  {isCancellingStuckJob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  {t.confirmCancelBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="absolute bottom-24 left-4 right-4 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-2xl border text-xs font-bold text-white ${
                toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-500 border-red-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponents
function PendingJobRow({ job, t, lang, onOpen }: { job: TowJob; t: Record<string, string>; lang: Lang; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl bg-white p-3 shadow-xs border border-orange-100 flex items-center justify-between text-left active:scale-[0.98] transition-all"
    >
      <div>
        <p className="text-xs font-bold text-slate-800">
          {job.customerName || t.noCustomerName}
        </p>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
          <Car className="h-3 w-3 text-orange-500" /> {job.carBrand} {job.carModel} · {job.plateNumber}
        </p>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-orange-500" /> {job.pickupAddress || t.noPickupAddress} · {formatNumberFor(job.distanceKm, lang)} {t.unitKm}
        </p>
      </div>
      <div className="flex items-center gap-1 text-orange-600 font-black text-xs">
        ฿{formatNumberFor(job.price, lang)}
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}

// ไอคอนประจำแต่ละสเตจของงาน — ใช้ทั้งใน stepper แนวนอนด้านบนการ์ด และปุ่มหลักด้านล่าง
// (ไอคอนของปุ่มหลักจะหยิบมาจากสเตจ 'ถัดไป' ที่จะเข้าไป ไม่ใช่สเตจปัจจุบัน)
const STEP_ICON_MAP: Record<string, React.ElementType> = {
  accepted: CheckCircle2,
  en_route: Navigation,
  arrived: MapPin,
  loading: Truck,
  delivering: Send,
};

/** แถบความคืบหน้าแนวนอนของงาน — แทนที่ป้ายข้อความสถานะเดิม (badge เดียวลอยๆ) ด้วยเส้นทาง
 *  ที่เห็นทั้งหมดในมุมเดียว: สเตจไหนผ่านแล้ว (เขียว ✓), สเตจไหนอยู่ตอนนี้ (ส้ม เต้นเบาๆ),
 *  สเตจไหนยังไม่ถึง (จาง) — ช่างกวาดตาดูรอบเดียวรู้เลยว่าอยู่ตรงไหนของงาน ไม่ต้องอ่านข้อความ */
function JobProgressStepper({
  steps,
  currentIdx,
}: {
  steps: { status: string; label: string }[];
  currentIdx: number;
}) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const Icon = STEP_ICON_MAP[s.status] ?? CircleDot;
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <React.Fragment key={s.status}>
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                isDone
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : isCurrent
                  ? 'border-orange-300 bg-orange-500 text-white shadow-md shadow-orange-500/40 animate-pulse'
                  : 'border-slate-200 bg-white text-slate-300'
              }`}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 h-0.5 flex-1 rounded-full ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// จอนำทางเต็มหน้าจอ สไตล์ Google Maps — ใช้ตอนช่างกำลัง "ขับรถ" จริง (en_route ไปจุดเกิดเหตุ
// หรือ delivering ไปอู่) สองสถานะนี้เท่านั้นที่ต้องขับรถ จึงเอาแผนที่เต็มจอไว้ก่อน ไม่ต้องมี
// รายละเอียดอื่นให้เสียสมาธิ/เผลอเลื่อนจอแล้วนิ้วไปโดนแผนที่จนแพนแผนที่เล่นแทนที่จะเลื่อนหน้า
// (ปัญหาเดิมตอนแผนที่ถูกฝังอยู่ในการ์ดที่เลื่อนได้ปกติ) กดปุ่มลูกศรซ้ายบนเพื่อย่อกลับไปดูการ์ด
// รายละเอียดปกติได้ทุกเมื่อ ไม่ได้ล็อกช่างไว้
function FullScreenNav({
  job,
  t,
  lang,
  techPos,
  techMapLabel,
  routeGeometry,
  routeIsEstimated,
  routeSteps,
  payment,
  onMinimize,
  onAdvance,
  onCall,
  onChat,
  onNavigate,
  hasUnreadChat,
}: {
  job: TowJob;
  t: Record<string, string>;
  lang: Lang;
  techPos: { lat: number; lng: number; heading?: number | null } | null;
  techMapLabel: string;
  routeGeometry: { lat: number; lng: number }[] | null;
  routeIsEstimated: boolean;
  routeSteps: RouteStep[];
  payment: { payment_method: string; status: string } | null;
  onMinimize: () => void;
  onAdvance: (job: TowJob) => void;
  onCall: (job: TowJob) => void;
  onChat: () => void;
  onNavigate: (job: TowJob) => void;
  hasUnreadChat: boolean;
}) {
  const isDelivering = job.status === 'delivering';
  const statusLabel = isDelivering ? t.jobDelivering : t.jobEnRoute;
  const buttonLabel = isDelivering ? t.finishJob : t.arrivedLocation;
  // "delivering" คือขั้นสุดท้ายของงานลาก (ดู jobSteps ใน ActiveJobCard) จึงต้องเช็คเงื่อนไข
  // รอยืนยันรับเงินก่อนกดจบงานเหมือนกับปุ่มหลักในการ์ดปกติ (เว้นบัตรเครดิตที่ตัดเงินอัตโนมัติ)
  const paymentBlocked =
    isDelivering && !!payment && payment.payment_method !== 'credit' && payment.status !== 'verified';

  // ------------------------------------------------------------------------
  // ป้ายบอกเลี้ยว (turn-by-turn): เดินหน้า index ของ routeSteps ตามตำแหน่งช่างจริง
  // ------------------------------------------------------------------------
  // ระยะ (เมตร) ที่ถือว่า "ถึงจุดเลี้ยวนี้แล้ว ไปดูจุดถัดไปได้" — ไม่ใช่ map-matching เต็มรูป
  // แบบ แค่ heuristic ง่ายๆ พอสำหรับกรณีที่ช่างขับตามเส้นทางที่คำนวณไว้ตามปกติ ถ้าช่างหลุด
  // ออกนอกเส้นทางจริงๆ ระบบรีรูท (ดู useEffect คำนวณ routeGeometry ด้านบน) จะยิง
  // computeRoute() ใหม่แล้ว routeSteps ก็จะเปลี่ยน object ใหม่ ทำให้ index รีเซ็ตอัตโนมัติ
  const ARRIVE_STEP_RADIUS_M = 30;
  const currentStepIdxRef = useRef(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // รีเซ็ต index ทุกครั้งที่ routeSteps เปลี่ยน (คำนวณเส้นทางใหม่/เปลี่ยนขาเดินทาง)
  useEffect(() => {
    currentStepIdxRef.current = 0;
    setCurrentStepIdx(0);
  }, [routeSteps]);

  useEffect(() => {
    if (!techPos || routeSteps.length === 0) return;
    let idx = currentStepIdxRef.current;
    while (
      idx < routeSteps.length - 1 &&
      haversineDistanceMeters(techPos, routeSteps[idx].location) < ARRIVE_STEP_RADIUS_M
    ) {
      idx += 1;
    }
    if (idx !== currentStepIdxRef.current) {
      currentStepIdxRef.current = idx;
      setCurrentStepIdx(idx);
    }
  }, [techPos, routeSteps]);

  const currentStep = routeSteps.length > 0 ? routeSteps[currentStepIdx] : null;
  // ระยะสดจากตำแหน่งช่างจริงไปยังจุดเลี้ยว — แม่นกว่า step.distanceMeters (ค่าตอนคำนวณ
  // เส้นทางครั้งแรก ซึ่งไม่ได้ลดลงเองตามที่ช่างขับมาแล้ว)
  const distanceToManeuverM =
    currentStep && techPos ? haversineDistanceMeters(techPos, currentStep.location) : currentStep?.distanceMeters ?? 0;

  return (
    <div className="absolute inset-0 z-30 bg-slate-100">
      <LiveTrackingMap
        techPos={techPos}
        pickupPos={job.pickupLat != null && job.pickupLng != null ? { lat: job.pickupLat, lng: job.pickupLng } : null}
        garagePos={job.garageLat != null && job.garageLng != null ? { lat: job.garageLat, lng: job.garageLng } : null}
        showPickupMarker={!isDelivering}
        showGarageMarker={isDelivering}
        routeGeometry={routeGeometry}
        routeIsEstimated={routeIsEstimated}
        statusLabel={statusLabel}
        heightClassName="h-full"
        fullBleed
        techLabel={techMapLabel}
      />

      {/* แถบบนสไตล์ Google Maps: การ์ดสีเขียวเต็มความกว้างจอ (edge-to-edge) มุมมนแค่ล่าง
          แทนการ์ดลอยขอบมนสี่มุม + ปุ่มย่อ (เดิม) — ให้ความรู้สึกเหมือนแถบนำทางจริงของ Google
          Maps ตัวเลขระยะทางตัวใหญ่ตัวหนา ชื่อถนนบรรทัดล่างตัวบางกว่า (ไม่ตัวหนาเท่าเดิม)
          ปุ่มย่อ (เดิมเป็นวงกลมสีขาวข้างการ์ด) ย้ายมาลอยทับมุมซ้ายบนของแถบแทน เหมือนปุ่ม X/ย่อ
          ที่ลอยอยู่บนแถบนำทางของ Google Maps เอง ไม่ใช่อยู่นอกแถบแยกกัน */}
      <div className="absolute inset-x-0 top-0 z-10">
        <div className="bg-gradient-to-b from-emerald-600 to-emerald-500 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-lg rounded-b-3xl">
          <div className="flex items-center gap-3 px-4">
            <button
              onClick={onMinimize}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {currentStep ? (
              <>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <ManeuverArrow step={currentStep} className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-3xl font-bold leading-tight tracking-tight">
                    {formatManeuverDistance(distanceToManeuverM, lang, t)}
                  </p>
                  <p className="truncate text-[13px] font-normal text-emerald-50">{maneuverPhrase(currentStep, t)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <Navigation className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-3xl font-bold leading-tight tracking-tight">
                    {formatNumberFor(job.distanceKm, lang)} {t.unitKm}
                  </p>
                  <p className="truncate text-[13px] font-normal text-emerald-50">{statusLabel}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* การ์ดล่างสไตล์ "Arriving at..." ของ Google Maps — ข้อมูลลูกค้า/ราคา + ปุ่มติดต่อ +
          ปุ่มยืนยันหลัก ลอยทับแผนที่แทนที่จะฝังอยู่ในหน้าที่เลื่อนได้เหมือนเดิม */}
      <div className="absolute inset-x-3 bottom-3 z-10 space-y-2.5 rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{job.customerName}</p>
            {!isDelivering && (
              <p className="truncate text-[11px] text-slate-500">{job.pickupAddress || t.noPickupAddress}</p>
            )}
            {/* แถบบนสุดโชว์ป้ายเลี้ยวแทนระยะทางรวม/สถานะแล้ว (currentStep ไม่ null) — เอาข้อมูล
                สองอย่างนี้มาโชว์เสริมตรงนี้แทน จะได้ไม่หายไปจากจอเลย */}
            {currentStep && (
              <p className="truncate text-[10px] font-semibold text-slate-400">
                {statusLabel} · {formatNumberFor(job.distanceKm, lang)} {t.unitKm}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-600">
            ฿{formatNumberFor(job.price, lang)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onCall(job)}
            className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 py-2 active:scale-95 transition-all"
          >
            <PhoneCall className="h-4 w-4 text-emerald-600" />
            <span className="text-[9px] font-bold text-slate-700">{t.callCustomer}</span>
          </button>
          <button
            onClick={onChat}
            className="relative flex flex-col items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 py-2 active:scale-95 transition-all"
          >
            <MessageSquare className="h-4 w-4 text-sky-600" />
            <span className="text-[9px] font-bold text-slate-700">{t.chatCustomer}</span>
            {hasUnreadChat && (
              <span className="absolute top-1 right-3 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate(job)}
            className="flex flex-col items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 py-2 active:scale-95 transition-all"
          >
            <Navigation className="h-4 w-4 text-orange-600" />
            <span className="text-[9px] font-bold text-slate-700">{t.navigate}</span>
          </button>
        </div>

        {paymentBlocked && (
          <p className="text-[10px] text-center text-amber-600 font-semibold">{t.confirmPaymentBeforeFinishNote}</p>
        )}

        <button
          onClick={() => onAdvance(job)}
          disabled={paymentBlocked}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold shadow-md active:scale-95 transition-all ${
            paymentBlocked
              ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed active:scale-100'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-orange-500/30'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function ActiveJobCard({
  job,
  t,
  lang,
  onAdvance,
  onNavigate,
  onChat,
  onCall,
  hasUnreadChat,
  payment,
  onVerifyPayment,
  onRejectPayment,
  onCancelStuckJob,
  techPos,
  routeGeometry,
  routeIsEstimated,
  techTruckType,
  onOpenFullScreenNav,
}: {
  job: TowJob;
  t: Record<string, string>;
  lang: Lang;
  onAdvance: (job: TowJob) => void;
  onNavigate: (job: TowJob) => void;
  onChat: () => void;
  onCall: (job: TowJob) => void;
  hasUnreadChat: boolean;
  /** เปิดจอนำทางเต็มจอ (FullScreenNav) กลับมาเอง — ใช้ตอนช่างเคยกดย่อออกไปดูการ์ดนี้แล้วอยาก
   *  กลับไปดูแผนที่เต็มจออีกครั้งระหว่างสถานะ en_route/delivering ไม่ระบุ = ไม่โชว์ปุ่มนี้ */
  onOpenFullScreenNav?: () => void;
  /** ประเภทรถของช่างเอง ('slide' | 'wheellift' | 'personal') — ใช้กำหนดป้ายชื่อบนหมุดช่าง
   *  ในแผนที่ ไม่ระบุ = LiveTrackingMap จะ fallback เป็นคำกลางๆ "ช่าง" เอง */
  techTruckType?: 'slide' | 'wheellift' | 'personal';
  payment?: {
    id: string;
    slip_url: string | null;
    amount: number | null;
    payment_method: 'transfer' | 'cash' | 'credit';
    status: 'pending' | 'verified' | 'rejected';
  } | null;
  onVerifyPayment?: () => void;
  onRejectPayment?: () => void;
  /** ทางออกฉุกเฉิน: ยกเลิกงานตัวเองตอนติดค้าง (เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ) —
   *  โชว์ปุ่มได้ทุกสเตจยกเว้น 'loading' (กำลังยกรถขึ้นจริง) และสถานะจบแล้ว ดูเงื่อนไข
   *  canCancelStuck ด้านล่าง */
  onCancelStuckJob?: (job: TowJob) => void;
  /** ตำแหน่ง GPS จริงของช่างเอง (null = ยังไม่มี GPS ping เข้ามา) ใช้โชว์หมุด "ตำแหน่งของฉัน" บนแผนที่ */
  techPos: { lat: number; lng: number; heading?: number | null } | null;
  /** เส้นทาง (ช่าง -> จุดเกิดเหตุ/อู่ แล้วแต่สเตจ) — ปกติเป็นเส้นตามถนนจริงจาก OSRM แต่ถ้า
   *  computeRoute() ล้มเหลว จะเป็นเส้นตรงสำรอง 2 จุดแทน (ดู routeIsEstimated) null = ไม่มี/ยังไม่เดินทาง */
  routeGeometry?: { lat: number; lng: number }[] | null;
  /** true = routeGeometry ด้านบนเป็นเส้นตรงสำรอง (คำนวณตามถนนจริงไม่สำเร็จ) ไม่ใช่เส้นทางจริง
   *  จาก OSRM — ใช้บอก LiveTrackingMap ให้วาดเป็นเส้นประแทนเส้นทึบ จะได้แยกออกว่าเป็นเส้น
   *  ประมาณ ไม่ใช่เส้นทางถนนจริง */
  routeIsEstimated?: boolean;
}) {
  const needsTow = job.requiredSpecialty === 'tow';
  const jobSteps: { status: TowJob['status']; label: string; buttonLabel: string }[] = needsTow
    ? [
        { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
        { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
        { status: 'arrived', label: t.jobArrived, buttonLabel: t.startLoading },
        { status: 'loading', label: t.jobLoading, buttonLabel: t.deliveringToGarage },
        { status: 'delivering', label: t.jobDelivering, buttonLabel: t.finishJob },
      ]
    : [
        { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
        { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
        { status: 'arrived', label: t.jobArrived, buttonLabel: t.finishJob },
      ];

  const currentIdx = jobSteps.findIndex((s) => s.status === job.status);
  const step = jobSteps[currentIdx] ?? jobSteps[0];
  // ปุ่มนี้เป็นปุ่ม "จบงาน" (ขั้นตอนสุดท้าย) ไหม และยังติดเงื่อนไขรอยืนยันรับเงินอยู่หรือเปล่า
  // (เว้นบัตรเครดิตไว้ เพราะตัดเงินอัตโนมัติไม่มีปุ่มให้กดยืนยัน — ดู logic เดียวกันใน advanceJob)
  const isLastStep = currentIdx === jobSteps.length - 1;
  const paymentBlocked =
    isLastStep &&
    !!payment &&
    payment.payment_method !== 'credit' &&
    payment.status !== 'verified';

  // ทางออกฉุกเฉิน: กันเฉพาะตอน 'loading' (กำลังยกรถขึ้นจริง — ยกครึ่งทางแล้วกดยกเลิกจะพัง)
  // และสถานะจบแล้ว — เดิมจำกัดแค่ accepted/en_route/arrived ซึ่งพลาด เพราะปุ่มยืนยัน/ปฏิเสธ
  // สลิปกับปุ่ม "จบงาน" (isLastStep) โผล่ตอน arrived (งานไม่ต้องลาก) หรือ delivering (งานลาก)
  // ต่างหาก นั่นคือสเตจจริงที่ช่างจะติดค้างเวลาลูกค้าไม่แนบสลิปใหม่ ไม่ใช่ก่อนหน้านั้น
  const canCancelStuck = !['loading', 'completed', 'cancelled'].includes(job.status);

  // ป้ายชื่อบนหมุดช่างในแผนที่ — ให้ตรงกับรถที่ช่างเลือกไว้จริงในโปรไฟล์ ไม่ใช่ hardcode
  // "ช่างสไลด์" เหมือนเดิมที่จะผิดทันทีถ้าช่างใช้รถยกซ้อนล้อหรือรถซ่อมเคลื่อนที่มาแทน
  const techMapLabel =
    techTruckType === 'wheellift'
      ? t.techLabelWheelLift
      : techTruckType === 'personal'
      ? t.techLabelPersonal
      : techTruckType === 'slide'
      ? t.techLabelSlide
      : t.techLabelGeneric;

  // ไอคอนของปุ่มหลัก: อิงจากสเตจถัดไปที่จะเข้า ไม่ใช่สเตจปัจจุบัน (เช่น ตอนนี้ 'accepted'
  // ปุ่มจะพาไป 'en_route' เลยโชว์ไอคอน Navigation ให้ตรงกับสิ่งที่กำลังจะเกิดขึ้นจริง)
  const nextStepStatus = jobSteps[currentIdx + 1]?.status;
  const CtaIcon = isLastStep ? CheckCircle2 : STEP_ICON_MAP[nextStepStatus ?? ''] ?? ArrowRight;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-4 pt-5 text-slate-900 shadow-[0_2px_20px_rgba(15,23,42,0.08)] space-y-3.5">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">{t.activeJobTitle} · {job.id}</span>
        </div>
        {/* แถบความคืบหน้าแทนป้ายข้อความเดี่ยวเดิม — เห็นทุกสเตจพร้อมกันในแวบเดียว */}
        <JobProgressStepper steps={jobSteps} currentIdx={currentIdx} />
        <p className="text-xs font-bold text-orange-600">{step.label}</p>
      </div>

      <div className="border-t border-slate-100" />

      <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <p className="text-sm font-bold text-slate-900">{job.customerName}</p>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Phone className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] text-slate-600">{job.customerPhone || t.noCustomerPhone}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Car className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] text-slate-600">{job.carBrand} {job.carModel} · {job.plateNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <MapPin className="h-3.5 w-3.5" />
          </span>
          <p className="text-[11px] text-slate-600">{job.pickupAddress || t.noPickupAddress} · {formatNumberFor(job.distanceKm, lang)} {t.unitKm}</p>
        </div>
      </div>

      {/* แผนที่ในแอปแสดงจุดเกิดเหตุที่ต้องไป + ตำแหน่งจริงของช่างเอง — เดิมเป็น iframe แบบลาก/ซูม
          ไม่ได้และไม่มีหมุดช่างเลย ตอนนี้เปลี่ยนเป็น Leaflet จริง real-time เหมือนฝั่งลูกค้า
          — ครอบด้วย div relative แล้วลอยป้ายราคาทับมุมซ้ายบน ช่างเห็นราคาได้ทันทีโดยไม่ต้อง
          เลื่อนจอลงไปหาแยกต่างหากเหมือนเดิม */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100">
        {job.pickupLat != null && job.pickupLng != null ? (
          <LiveTrackingMap
            techPos={techPos}
            pickupPos={{ lat: job.pickupLat, lng: job.pickupLng }}
            // แก้บั๊ก: เดิมส่ง garagePos={null} ตายตัวเสมอ (ดูคอมเมนต์ใน dtc-api.ts) ทำให้ไม่เคย
            // เห็นหมุดอู่ปลายทางในแผนที่ของช่างเลย ทั้งที่ตอนนำรถไปส่งอู่ควรเห็นทั้งเส้นทางและหมุด
            garagePos={job.garageLat != null && job.garageLng != null ? { lat: job.garageLat, lng: job.garageLng } : null}
            // ซ่อนหมุดจุดเกิดเหตุตอนงานเข้าสถานะยกรถ/นำส่งอู่แล้ว (ไม่เกี่ยวแล้ว) แล้วโชว์หมุดอู่แทน
            showPickupMarker={job.status !== 'loading' && job.status !== 'delivering'}
            showGarageMarker={job.status === 'loading' || job.status === 'delivering'}
            routeGeometry={routeGeometry}
            routeIsEstimated={routeIsEstimated}
            statusLabel={step.label}
            // ขยายแผนที่ให้ใหญ่ขึ้นชัดเจน (เดิม h-36 เล็กเกินไปตอนย้ายมาเป็นแท็บ "งานของฉัน"
            // ของตัวเองแล้วมีพื้นที่เหลือเยอะ) ใช้ viewport height แทนค่าคงที่ให้ปรับตามจอได้
            heightClassName="h-[42vh]"
            techLabel={techMapLabel}
          />
        ) : (
          <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-500">
            {t.noGpsCoords}
          </div>
        )}
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur">
          <span className="text-[9px] font-bold text-slate-500">{t.stdPrice}</span>
          <span className="text-xs font-black text-orange-600">฿{formatNumberFor(job.price, lang)}</span>
        </div>
        {/* ปุ่มเปิดโหมดนำทางเต็มจอกลับมาเอง — โชว์เฉพาะตอนที่ยังเป็นสถานะ "กำลังเดินทาง"
            (ตอนอื่น เช่น arrived/loading ไม่มีอะไรให้นำทางแล้ว ไม่ต้องมีปุ่มนี้) */}
        {onOpenFullScreenNav && (job.status === 'en_route' || job.status === 'delivering') && (
          <button
            onClick={onOpenFullScreenNav}
            className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 shadow-sm backdrop-blur active:scale-95 transition-all"
          >
            <Navigation className="h-3 w-3" />
            {t.fullScreenNavBtn}
          </button>
        )}
      </div>

      {/* วิธีชำระเงินจากลูกค้า — ดึงจากตาราง payments จริง ไม่ใช่ของ mock
          ถ้าลูกค้าเลือกเงินสด (payment_method === 'cash') จะไม่มีสลิปเลยตั้งแต่ต้น
          เพราะฉะนั้นห้ามขึ้นข้อความ "ยังไม่ได้แนบสลิป" ในกรณีนี้ ให้ขึ้นป้ายเงินสดแทน */}
      {payment ? (
        payment.payment_method === 'cash' || payment.payment_method === 'credit' ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                <Wallet className="h-3 w-3 text-emerald-600" /> {t.paymentMethodLabel}
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  payment.status === 'verified'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {payment.payment_method === 'cash'
                  ? payment.status === 'verified' ? t.cashReceivedDone : t.cashPendingOnSite
                  : payment.status === 'verified' ? t.cardChargedDone : t.cardChargePending}
              </span>
            </div>
            <p className="text-[11px] text-slate-800 font-bold flex items-center gap-1.5">
              {payment.payment_method === 'cash' ? (
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              )}
              {payment.payment_method === 'cash' ? t.customerPaidCash : t.customerPaidCard}
              {payment.amount != null && <span className="text-orange-600">฿{formatNumberFor(payment.amount, lang)}</span>}
            </p>

            {payment.payment_method === 'cash' && payment.status !== 'verified' && payment.status !== 'rejected' && onVerifyPayment && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRejectPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-[11px] font-bold text-red-600 active:scale-95 transition-all"
                >
                  <X className="h-3.5 w-3.5" /> {t.amountShort}
                </button>
                <button
                  onClick={onVerifyPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t.confirmCashReceived}
                </button>
              </div>
            )}
            {payment.status === 'rejected' && (
              <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {t.paymentRejectedWaitingNewCash}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500">{t.transferSlipLabel}</span>
              {/* เดิมเช็คแค่ 'verified' vs else ทำให้เคส 'rejected' โชว์ป้าย "รอตรวจสอบ" ผิดๆ
                  ทั้งที่จริงถูกปฏิเสธไปแล้วและกำลังรอลูกค้าแนบสลิปใหม่ (ดูข้อความด้านล่าง) —
                  แยกป้าย 3 สถานะให้ตรงกับความจริง กันช่างเข้าใจผิดว่ายังรอตรวจอยู่เฉยๆ */}
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  payment.status === 'verified'
                    ? 'bg-emerald-50 text-emerald-600'
                    : payment.status === 'rejected'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {payment.status === 'verified'
                  ? t.paymentConfirmedText
                  : payment.status === 'rejected'
                  ? t.paymentStatusRejected
                  : t.paymentStatusPendingReview}
              </span>
            </div>

            {payment.slip_url ? (
              <a
                href={payment.slip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative h-32 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100"
              >
                {/* ใช้ <img> ธรรมดาแทน next/image เพราะโดเมน Supabase Storage เป็น URL แบบไดนามิก
                    ยังไม่ได้เพิ่มใน next.config.js (images.remotePatterns) — ถ้าจะสลับกลับไปใช้ next/image
                    ทีหลัง ต้องเพิ่ม hostname ของ Supabase project ใน next.config.js ก่อน */}
                <img src={payment.slip_url} alt={t.transferSlipLabel} className="h-full w-full object-contain" />
              </a>
            ) : (
              <p className="text-[10px] text-slate-500">{t.customerNoSlipYet}</p>
            )}

            {payment.status !== 'verified' && payment.status !== 'rejected' && payment.slip_url && onVerifyPayment && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRejectPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-50 py-2 text-[11px] font-bold text-red-600 active:scale-95 transition-all"
                >
                  <X className="h-3.5 w-3.5" /> {t.slipInvalidFake}
                </button>
                <button
                  onClick={onVerifyPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t.paymentConfirmedText}
                </button>
              </div>
            )}
            {payment.status === 'rejected' && (
              <p className="text-[10px] text-red-500 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {t.paymentRejectedWaitingNewSlip}
              </p>
            )}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-[10px] text-slate-500">
          {t.noPaymentInfoFromCustomer}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => onCall(job)}
          className="flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 py-2.5 active:scale-95 transition-all"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <PhoneCall className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-bold text-slate-700">{t.callCustomer}</span>
        </button>
        <button
          onClick={onChat}
          className="relative flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 py-2.5 active:scale-95 transition-all"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-bold text-slate-700">{t.chatCustomer}</span>
          {hasUnreadChat && (
            <span className="absolute top-1 right-4 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate(job)}
          className="flex flex-col items-center gap-1 rounded-2xl border border-slate-100 bg-slate-50 py-2.5 active:scale-95 transition-all"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Navigation className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-bold text-slate-700">{t.navigate}</span>
        </button>
      </div>

      {paymentBlocked && (
        <p className="text-[10px] text-center text-amber-600 font-semibold -mb-1">
          {t.confirmPaymentBeforeFinishNote}
         
        </p>
      )}

      <button
        onClick={() => onAdvance(job)}
        disabled={paymentBlocked}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold shadow-md active:scale-95 transition-all ${
          paymentBlocked
            ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed active:scale-100'
            : isLastStep
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30'
            : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/30'
        }`}
      >
        <CtaIcon className="h-4 w-4" />
        {step.buttonLabel}
      </button>

      {/* ทางออกฉุกเฉิน: ยกเลิกงานเองตอนติดค้าง (เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ)
          กันไว้เฉพาะตอน 'loading' (กำลังยกรถขึ้นจริง) กันกดพลาดกลางการยกรถ */}
      {canCancelStuck && onCancelStuckJob && (
        <button
          onClick={() => onCancelStuckJob(job)}
          className="w-full flex items-center justify-center gap-1 rounded-2xl border border-red-100 bg-red-50 py-2.5 text-[11px] font-bold text-red-600 active:scale-95 transition-all"
        >
          <XCircle className="h-3.5 w-3.5" /> {t.cancelStuckJobBtn}
        </button>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <Icon className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" /> {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full transition-colors relative ${value ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  showBadge,
  badgeCount,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  showBadge?: boolean;
  badgeCount?: number;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5">
      <div className="relative">
        <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : 'text-slate-300'}`} />
        {!!badgeCount && badgeCount > 0 ? (
          <span className="absolute -top-2 -right-2.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : (
          showBadge && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
            </span>
          )
        )}
      </div>
      <span className={`text-[9px] font-bold ${active ? 'text-orange-500' : 'text-slate-300'}`}>{label}</span>
    </button>
  );
}