'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import {
  Wifi,
  WifiOff,
  Coffee,
  Zap,
  MapPin,
  Phone,
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
  MessageSquare,
  Send,
  Menu,
  Globe,
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
  Apple,
  ArrowRight,
  UserPlus,
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
  listPendingAndOwnJobs,
} from '@/lib/dtc-api';
// ลบ import จาก '@/lib/dtc-shared' เดิมทิ้งแล้ว (ไฟล์นั้นเป็น localStorage mock
// ที่ไม่มีผลกับข้อมูลจริง) เปลี่ยนมาใช้ '@/lib/dtc-api' ที่คุยกับ Supabase จริงแทน

// ============================================================================
// Multi-language Translations (TH, EN, CN)
// ============================================================================
type Lang = 'TH' | 'EN' | 'CN';

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
    signUpWithGoogle: 'สมัครด้วย Google',
    signUpWithApple: 'สมัครด้วย Apple',
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
    newJobs: 'งานเข้าใหม่',
    noJobs: 'ยังไม่มีงานเข้ามา รอสักครู่นะ',
    breakState: 'คุณกำลังพักอยู่',
    offlineState: 'คุณกำลังออฟไลน์อยู่ (ปิดรับงาน)',
    onlineInstruction: 'กด "ออนไลน์" ด้านบนเพื่อเริ่มรับงาน',
    tabHome: 'หน้าแรก',
    tabHistory: 'ประวัติงาน',
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
    signUpWithGoogle: 'Sign up with Google',
    signUpWithApple: 'Sign up with Apple',
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
    newJobs: 'Incoming Jobs',
    noJobs: 'No active job requests',
    breakState: 'You are currently on break',
    offlineState: 'You are Offline (Not receiving jobs)',
    onlineInstruction: 'Switch to "Online" above to start receiving jobs',
    tabHome: 'Home',
    tabHistory: 'Job History',
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
    signUpWithGoogle: '使用 Google 注册',
    signUpWithApple: '使用 Apple 注册',
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
    newJobs: '新订单',
    noJobs: '暂无新订单',
    breakState: '您正在休息中',
    offlineState: '您已离线（停止接单）',
    onlineInstruction: '点击上方“在线”开始接单',
    tabHome: '首页',
    tabHistory: '历史订单',
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

type ServiceTruckType = 'slide' | 'wheellift';

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
  truckType: 'slide',
};

type Tab = 'home' | 'history' | 'profile';

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
  
  const [loginPhone, setLoginPhone] = useState('081-234-5678');
  const [loginPassword, setLoginPassword] = useState('123456');

  // ---- Language State ----
  const [lang, setLang] = useState<Lang>('TH');
  const [showDrawerMenu, setShowDrawerMenu] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const t = TRANSLATIONS[lang];

  // ---- Analytics View Mode ----
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');

  // ---- Real-Time Device Status ----
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isWifiOnline, setIsWifiOnline] = useState<boolean>(true);
  const [time, setTime] = useState<string>('');

  // ---- Technician Profile State ----
  const [tech, setTech] = useState<ExtendedTechProfile>(DEFAULT_TECH);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(DEFAULT_TECH.name);
  const [editPhone, setEditPhone] = useState(DEFAULT_TECH.phone);
  const [editPlate, setEditPlate] = useState(DEFAULT_TECH.plateNumber);

  const [jobs, setJobs] = useState<TowJob[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedPendingJob, setSelectedPendingJob] = useState<TowJob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);

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

  // Splash Screen Timeout
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1800);
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
    }).catch((err) => console.error('Error syncing technician profile:', err));
  }, [isLoggedIn, tech.name, tech.phone, tech.plateNumber]);

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
        const jobsData = await listPendingAndOwnJobs(tech.id);
        setJobs(jobsData);
      } catch (err) {
        console.error('Error fetching jobs:', err);
      }
    };

    fetchRelevantJobs();

    const unsubscribe = subscribeAllJobs((mapped) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === mapped.id);
        if (idx === -1) return [mapped, ...prev];
        const next = [...prev];
        next[idx] = mapped;
        return next;
      });
    });

    return unsubscribe;
  }, [isLoggedIn, tech.id]);

  const activeJob = useMemo(
    () => jobs.find((j) => j.techId === tech.id && !['completed', 'cancelled'].includes(j.status)),
    [jobs, tech.id]
  );

  // ส่งพิกัด GPS จริงของช่างขึ้น Supabase ตราบใดที่มีงานอยู่ในมือ (แทนตำแหน่งจำลองที่ฝั่งลูกค้าเคยใช้)
  // throttle การเขียนไว้ที่ ~12 วิ/ครั้ง กัน quota ของ Supabase และแบตช่างหมดเร็วเกินไป
  const lastGpsWriteRef = useRef<number>(0);
  useEffect(() => {
    if (!activeJob || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastGpsWriteRef.current < 12000) return;
        lastGpsWriteRef.current = now;

        updateTechLocation(tech.id, pos.coords.latitude, pos.coords.longitude)
          .then(() => {})
          .catch((error) => {
            console.error('Error updating tech live location:', error);
          });
      },
      (err) => console.error('Geolocation watch error:', err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeJob?.id, tech.id]);

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
  const handleVerifyPayment = async () => {
    if (!activeJobPayment) return;
    const { error } = await supabase
      .from('payments')
      .update({ status: 'verified', verified_by: tech.name, verified_at: new Date().toISOString() })
      .eq('id', activeJobPayment.id);

    if (error) {
      setToast({ message: 'ยืนยันการรับเงินไม่สำเร็จ ลองใหม่อีกครั้ง', type: 'error' });
      return;
    }
    setActiveJobPayment((prev) => (prev ? { ...prev, status: 'verified' } : prev));
    setToast({ message: 'ยืนยันรับเงินแล้ว', type: 'success' });
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
        setChatMessages(
          data.map((m: any) => ({
            sender: m.sender === 'customer' ? 'user' : 'tech',
            text: m.text,
          }))
        );
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

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [activeJob?.id]);

  // ส่งข้อความแชตจริงเข้า Supabase (แทนที่การอัปเดตแค่ state ในเครื่อง)
  const handleSendTechMessage = async () => {
    const text = inputMsg.trim();
    if (!text || !activeJob) return;
    setChatMessages((prev) => [...prev, { sender: 'tech', text }]);
    setInputMsg('');
    const { error } = await supabase
      .from('chat_messages')
      .insert([{ job_id: activeJob.id, sender: 'tech', text }]);
    if (error) console.error('Error sending chat message:', error);
  };

  // ส่งข้อความระบบอัตโนมัติเข้าแชต (ทักทายตอนรับงาน / แจ้งเตือนทุกสถานะ) — insert เข้า chat_messages จริง
  // เหมือนข้อความที่ช่างพิมพ์เอง ฝั่งลูกค้าจะเห็นในแชทช่องเดียวกันตามลำดับเวลาจริง
  const sendSystemChatMessage = async (jobId: string, text: string) => {
    setChatMessages((prev) => (activeJob?.id === jobId ? [...prev, { sender: 'tech', text }] : prev));
    const { error } = await supabase.from('chat_messages').insert([{ job_id: jobId, sender: 'tech', text }]);
    if (error) console.error('Error sending system chat message:', error);
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

  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === 'pending' && !j.techId).sort((a, b) => b.createdAt - a.createdAt),
    [jobs]
  );

  const historyJobs = useMemo(
    () => jobs.filter((j) => j.techId === tech.id && j.status === 'completed').sort((a, b) => b.updatedAt - a.updatedAt),
    [jobs, tech.id]
  );

  const todayEarnings = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return historyJobs
      .filter((j) => j.updatedAt >= startOfDay.getTime())
      .reduce((sum, j) => sum + j.price, 0);
  }, [historyJobs]);

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
        label: d.toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', { weekday: 'short' }),
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
        label: d.toLocaleDateString(lang === 'TH' ? 'th-TH' : 'en-US', { month: 'short' }),
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword.trim()) {
      setToast({ message: 'กรุณากรอกเบอร์โทรและรหัสผ่านให้ครบ', type: 'error' });
      return;
    }
    setIsLoggedIn(true);
    setToast({ message: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับครับ', type: 'success' });
  };

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
    setToast({ message: `ส่งรหัส OTP ไปยังเบอร์ ${resetPhone} แล้ว`, type: 'success' });
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
      setNewLoginPasswordErr('กรุณากรอกรหัสผ่านใหม่');
      hasError = true;
    } else if (newLoginPassword.length < 6) {
      setNewLoginPasswordErr('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      hasError = true;
    }

    if (!confirmLoginPassword.trim()) {
      setConfirmLoginPasswordErr('กรุณายืนยันรหัสผ่านใหม่');
      hasError = true;
    } else if (newLoginPassword.trim() && confirmLoginPassword.trim() && newLoginPassword !== confirmLoginPassword) {
      setConfirmLoginPasswordErr('รหัสผ่านไม่ตรงกัน');
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

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editPhone.trim() || !editPlate.trim()) {
      setToast({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'error' });
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
    setToast({ message: 'บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว', type: 'success' });
  };

  const changeStatus = useCallback(
    (status: TechStatus) => {
      if (activeJob && status !== 'working') {
        setToast({ message: 'มีงานค้างอยู่ ต้องทำงานปัจจุบันให้เสร็จก่อนเปลี่ยนสถานะ', type: 'error' });
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

      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'accepted', techId: tech.id } : j)));
      setSelectedPendingJob(null);
      setToast({ message: `รับงาน ${job.id} เรียบร้อย กำลังไปหาลูกค้า`, type: 'success' });

      // ข้อความทักทายอัตโนมัติ ส่งเข้าแชตทันทีที่รับงาน ให้ลูกค้ารู้ว่าช่างคนไหนรับงานและกำลังจะไปหา
      sendSystemChatMessage(
        job.id,
        `สวัสดีครับ ผม${tech.name || 'ช่างบริการ'} รับงานของคุณเรียบร้อยแล้วนะครับ กำลังเตรียมตัวออกเดินทางไปยังจุดเกิดเหตุ 🚚 มีอะไรสอบถามทักแชทหรือโทรหาผมได้เลยครับ`
      );
    } catch (err) {
      console.error('Error accepting job:', err);
      setToast({ message: 'เกิดข้อผิดพลาดในการกดรับงาน', type: 'error' });
    }
  };

  const declineJob = (job: TowJob) => {
    setSelectedPendingJob(null);
    setToast({ message: `ปฏิเสธงาน ${job.id} แล้ว ระบบจะหาช่างคนถัดไป`, type: 'error' });
  };

  // ข้อความแจ้งเตือนสถานะอัตโนมัติที่จะถูกส่งเข้าแชตทุกครั้งที่ช่างกดอัปเดตสถานะงาน
  // ให้ลูกค้าเห็นความคืบหน้าทุกขั้นตอนในแชตเดียวกัน โดยไม่กระทบการพิมพ์คุยกันปกติ
  const STATUS_CHAT_MESSAGES: Partial<Record<TowJob['status'], string>> = {
    en_route: 'ผมออกเดินทางแล้วนะครับ กำลังมุ่งหน้าไปยังจุดเกิดเหตุ 🚚',
    arrived: 'ถึงจุดเกิดเหตุแล้วครับ กำลังตรวจสอบสภาพรถและเตรียมอุปกรณ์ยกรถ',
    loading: 'กำลังยกรถขึ้นรถสไลด์ให้เรียบร้อยครับ รอสักครู่นะครับ',
    delivering: 'ยกรถเสร็จเรียบร้อยแล้ว กำลังนำรถไปส่งที่อู่ปลายทางครับ',
    completed: 'ถึงอู่ปลายทางเรียบร้อยแล้วครับ งานเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการนะครับ 🙏',
  };

  const advanceJob = async (job: TowJob) => {
    const jobSteps: { status: TowJob['status']; label: string; buttonLabel: string }[] = [
      { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
      { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
      { status: 'arrived', label: t.jobArrived, buttonLabel: t.startLoading },
      { status: 'loading', label: t.jobLoading, buttonLabel: t.deliveringToGarage },
      { status: 'delivering', label: t.jobDelivering, buttonLabel: t.finishJob },
    ];

    const currentIdx = jobSteps.findIndex((s) => s.status === job.status);
    const nextStep = jobSteps[currentIdx + 1];
    const newStatus: TowJob['status'] = nextStep ? nextStep.status : 'completed';

    // เดิม update ตรง + client เพิ่ม jobsDone เอง เปลี่ยนเป็นเรียก advanceJobStatus()
    // แทน — RPC เช็คลำดับ status ก่อนอนุญาต และนับ jobs_done ให้เองตอน completed
    // (ดู 0002_price_and_status_rpc.sql) จึงลบส่วน upsertTech(prev.jobsDone+1) ทิ้ง
    try {
      await advanceJobStatus(job.id, newStatus);
    } catch (err) {
      console.error('Error advancing job status:', err);
      setToast({ message: 'อัปเดตสถานะงานไม่สำเร็จ กรุณาลองใหม่', type: 'error' });
      return;
    }

    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: newStatus } : j)));

    // แจ้งเตือนสถานะใหม่เข้าไปในแชตของลูกค้าทันที ไม่ต้องรอให้ช่างพิมพ์เอง
    const statusMsg = STATUS_CHAT_MESSAGES[newStatus];
    if (statusMsg) sendSystemChatMessage(job.id, statusMsg);

    if (!nextStep) {
      // สถานะ 'online' และ jobsDone ที่แท้จริงจะ sync กลับมาจาก server ผ่าน
      // hydrateFromSupabase / realtime subscription — ที่นี่แค่ปรับ UI ให้ไวขึ้นชั่วคราว
      setTech((prev) => ({ ...prev, status: 'online' as TechStatus }));
      setToast({ message: `งาน ${job.id} เสร็จสมบูรณ์! ได้รับ ฿${job.price.toLocaleString()}`, type: 'success' });
    }
  };

  const openMaps = (job: TowJob) => {
    const url =
      job.pickupLat != null && job.pickupLng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${job.pickupLat},${job.pickupLng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.pickupAddress)}`;
    window.open(url, '_blank');
  };

  // ==========================================================================
  // SPLASH SCREEN
  // ==========================================================================
  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans antialiased">
        <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[50px] border-[12px] border-slate-800 bg-white shadow-2xl flex flex-col items-center justify-center p-6">
          <div className="absolute top-2 left-1/2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

          <div className="relative h-56 w-full max-w-[260px] animate-pulse">
            <Image src="/M3.png" alt="DTC Mechanic Solutions" fill className="object-contain" priority />
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
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans antialiased">
        <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[50px] border-[12px] border-slate-800 bg-white shadow-2xl flex flex-col">
          <div className="absolute top-2 left-1/2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

          {/* Real-time Status Bar (เวลา/Wifi/แบตเตอรี — ใช้ค่าจริงจากระบบเหมือนเดิม) — สีดำ */}
          <div className="absolute top-0 left-0 right-0 z-40 pt-3 px-7 flex items-center justify-between text-xs font-semibold text-slate-900">
            <span>{time || '09:41'}</span>
            <div className="flex items-center gap-2">
              {isWifiOnline ? (
                <Wifi className="h-3.5 w-3.5 text-slate-900" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              )}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-bold">{batteryLevel}%</span>
                {isCharging ? (
                  <BatteryCharging className="h-4 w-4 fill-amber-500 text-amber-500" />
                ) : (
                  <Battery className="h-4 w-4 fill-slate-900 text-slate-900" />
                )}
              </div>
            </div>
          </div>

          {/* โครงสร้างแบบเดียวกับหน้า Welcome ฝั่งลูกค้า (โค้ด n3): รูป Hero เต็มจอด้านบนสุด ไม่มีโลโก้/ตัวหนังสือคั่น
              แล้วการ์ดข้อมูล (โลโก้ + หัวข้อ + ฟีเจอร์ + ปุ่ม) ซ้อนทับขอบล่างของรูป (-mt-6 rounded-t-3xl) */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="relative w-full flex-1 min-h-[280px] overflow-hidden">
              <Image src="/M1.png" alt="DTC Towing" fill className="object-cover" priority />

              {/* โลโก้ + หัวข้อ ซ้อนทับบนรูป (บริเวณท้องฟ้า) ขยายใหญ่ขึ้นตามที่ขอ */}
              <div className="absolute top-14 left-0 right-0 z-10 flex flex-col items-center px-6 text-center">
                <div className="relative h-24 w-60 drop-shadow-lg">
                  <Image src="/M3.png" alt="DTC Mechanic Solutions" fill className="object-contain" priority />
                </div>
                <h1 className="mt-2 text-2xl font-black text-slate-900 drop-shadow-md">{t.welcomeTitle}</h1>
                <p className="mt-1 text-xs text-slate-800/90 leading-relaxed drop-shadow-md max-w-[280px]">{t.welcomeSubtitle}</p>
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
                onClick={() => { setAuthTab('login'); setShowWelcome(false); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
              >
                {t.btnLogin} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => { setAuthTab('signup'); setShowWelcome(false); }}
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
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans antialiased">
        <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[50px] border-[12px] border-slate-800 bg-white shadow-2xl flex flex-col">
          <div className="absolute top-2 left-1/2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

          {/* วงไล่สีชมพูอ่อนมุมขวาบน ตกแต่งพื้นหลังตามภาพตัวอย่าง */}
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-pink-100/70 blur-3xl" />

          {/* Real-time Status Bar สำหรับหน้า Login (เวลา/Wifi/แบตเตอรี ใช้ค่าจริงจากระบบเหมือนเดิม) */}
          <div className="relative z-40 pt-3 px-7 flex items-center justify-between text-xs font-semibold text-slate-800">
            <span>{time || '09:41'}</span>
            <div className="flex items-center gap-2">
              {isWifiOnline ? (
                <Wifi className="h-3.5 w-3.5 text-slate-800" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" />
              )}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-bold">{batteryLevel}%</span>
                {isCharging ? (
                  <BatteryCharging className="h-4 w-4 fill-amber-500 text-amber-500" />
                ) : (
                  <Battery className="h-4 w-4 fill-slate-800 text-slate-800" />
                )}
              </div>
            </div>
          </div>

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
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Main Login Form / Forgot Password View */}
          {!showForgotPassword ? (
            <div className="relative z-10 flex flex-1 flex-col px-6 pt-1 pb-5 overflow-y-auto">
              <div className="mb-3 flex flex-col items-center text-center">
                <div className="relative h-20 w-full max-w-[190px]">
                  <Image src="/M3.png" alt="DTC Mechanic Solutions" fill className="object-contain" priority />
                </div>
              </div>

              {/* Tabs: เข้าสู่ระบบ / สมัครสมาชิก ตามภาพตัวอย่าง */}
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    authTab === 'login' ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" /> {t.login}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('signup')}
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
                  className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all mt-1"
                >
                  {authTab === 'login' ? t.signIn : t.newAccountTab}
                </button>
              </form>

              {/* ปุ่มสมัคร/เข้าสู่ระบบทางเลือกอื่น ตามภาพตัวอย่าง (ยังเป็นปุ่มตกแต่ง ไม่ได้ผูก OAuth จริง) */}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setToast({ message: 'ฟีเจอร์นี้ยังไม่เปิดใช้งาน', type: 'error' })}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 active:scale-95 transition-all"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-500" /> {t.signUpWithEmail}
                </button>
                <button
                  type="button"
                  onClick={() => setToast({ message: 'ฟีเจอร์นี้ยังไม่เปิดใช้งาน', type: 'error' })}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 active:scale-95 transition-all"
                >
                  <Globe className="h-3.5 w-3.5 text-red-500" /> {t.signUpWithGoogle}
                </button>
                <button
                  type="button"
                  onClick={() => setToast({ message: 'ฟีเจอร์นี้ยังไม่เปิดใช้งาน', type: 'error' })}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 active:scale-95 transition-all"
                >
                  <Apple className="h-3.5 w-3.5 text-slate-800" /> {t.signUpWithApple}
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
                      placeholder="กรอกรหัสผ่านใหม่"
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
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MAIN APP DASHBOARD & WORKING INTERFACE
  // ==========================================================================
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 font-sans antialiased">
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[50px] border-[12px] border-slate-800 bg-slate-50 shadow-2xl transform">
        <div className="absolute top-2 left-1/2 z-50 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

        {/* Status Bar */}
        <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-7 pt-3 text-xs font-semibold text-white drop-shadow-sm">
          <span>{time || '09:41'}</span>
          <div className="flex items-center gap-2">
            {isWifiOnline ? (
              <Wifi className="h-3.5 w-3.5 text-white" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-300" />
            )}
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-bold">{batteryLevel}%</span>
              {isCharging ? (
                <BatteryCharging className="h-4 w-4 fill-amber-300 text-amber-300" />
              ) : (
                <Battery className="h-4 w-4 fill-white text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-b from-orange-500 to-orange-600 pt-11 pb-4 px-5 rounded-b-[32px] shadow-lg shadow-orange-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white font-black text-sm border border-white/20">
                {tech.name.slice(3, 4) || 'ช'}
              </div>
              <div>
                <p className="text-white font-bold text-xs leading-tight">{tech.name}</p>
                <div className="flex items-center gap-1 text-orange-100 text-[10px] mt-0.5">
                  <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                  <span>{tech.rating}</span>
                  <span>· {tech.jobsDone} {t.jobsDone}</span>
                </div>
              </div>
            </div>

            {/* Text Language Switcher (ไม่มีธงชาติ) + Hamburger Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xs rounded-full px-2 py-0.5 border border-white/10">
                {(['TH', 'EN', 'CN'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all ${
                      lang === l ? 'bg-white text-orange-600 shadow-xs' : 'text-orange-100 hover:text-white'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Hamburger Button 3 ขีด */}
              <button
                onClick={() => setShowDrawerMenu(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
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
                          {l}
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
                      {tech.name.slice(3, 4) || 'ช'}
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
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Truck className="h-4 w-4 text-orange-500" />
                    <span>{t.menuVehicle}</span>
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
                  onClick={() => {
                    setShowDrawerMenu(false);
                    changeStatus('offline');
                    setIsLoggedIn(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-red-500 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 active:scale-95 transition-all shadow-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t.logout}</span>
                </button>
                <p className="text-center text-[9px] text-slate-400 mt-2">เวอร์ชัน 1.0.4 (Mechanic Edition)</p>
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
                      <p className="text-[10px] text-slate-400">ภาพรวมสถิติการทำงานและรายได้</p>
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
                          ฿{item.income > 0 ? (item.income / 1000).toFixed(1) + 'k' : 0}
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
                        <span className="text-[9px] text-slate-400">{item.jobsCount} งาน</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between bg-orange-50 p-3.5 rounded-2xl border border-orange-100">
                  <span className="text-xs text-orange-800 font-bold">
                    {t.totalIncome} · {chartMode === 'daily' ? '7 วันล่าสุด' : '6 เดือนล่าสุด'}
                  </span>
                  <span className="text-lg font-black text-orange-600">
                    ฿{(chartMode === 'daily' ? dailyChartData : monthlyChartData)
                      .reduce((a, b) => a + b.income, 0)
                      .toLocaleString()}
                  </span>
                </div>

                {/* ยอดของ "วันนี้" เท่านั้น แยกออกมาให้ชัดเจน ไม่ปนกับยอดรวมของช่วงด้านบน
                    (ยอดรวมด้านบนคือผลรวมของหลายวัน/หลายเดือน ไม่ใช่ยอดวันนี้) */}
                <div className="mt-2 flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[11px] text-slate-500 font-bold">{t.todayEarnings}</span>
                  <span className="text-sm font-black text-slate-800">฿{todayEarnings.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setShowDashboardModal(false)}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white active:scale-95 transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="h-[calc(100%-190px)] overflow-y-auto px-4 py-4 pb-24 space-y-4">
          {activeTab === 'home' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> {t.todayEarnings}
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1">฿{todayEarnings.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" /> {t.todayCompleted}
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1">
                    {historyJobs.filter((j) => j.updatedAt >= new Date().setHours(0, 0, 0, 0)).length} งาน
                  </p>
                </div>
              </div>

              {activeJob ? (
                <ActiveJobCard
                  job={activeJob}
                  t={t}
                  onAdvance={advanceJob}
                  onNavigate={openMaps}
                  onChat={() => setShowChat(true)}
                  onCall={handleCallCustomer}
                  hasUnreadChat={hasUnreadChat}
                  payment={activeJobPayment}
                  onVerifyPayment={handleVerifyPayment}
                />
              ) : tech.status === 'online' ? (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5 text-orange-500 animate-bounce" /> {t.newJobs} ({pendingJobs.length})
                  </h3>
                  {pendingJobs.length === 0 ? (
                    <div className="rounded-2xl bg-white p-6 text-center border border-dashed border-slate-200">
                      <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">{t.noJobs}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingJobs.map((job) => (
                        <PendingJobRow key={job.id} job={job} onOpen={() => setSelectedPendingJob(job)} />
                      ))}
                    </div>
                  )}
                </div>
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
            </>
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
                      <p className="text-xs font-black text-orange-600">฿{job.price.toLocaleString()}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {job.carBrand} {job.carModel} · {job.plateNumber}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" /> {job.pickupAddress || 'ไม่ระบุตำแหน่ง'}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 p-5 text-white shadow-xl border border-white/10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white font-black text-xl shadow-md">
                        {tech.name.slice(3, 4) || 'ช'}
                      </div>
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-900">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-white">{tech.name}</h2>
                        <ShieldCheck className="h-4 w-4 text-orange-400" />
                      </div>
                      <p className="text-[10px] text-orange-200/80 font-medium">{tech.phone}</p>
                      <span className="inline-block mt-1 text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5">
                        DTC Certified Partner
                      </span>
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

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                  <div>
                    <span className="text-[9px] text-slate-400 block">{t.rating}</span>
                    <span className="text-sm font-bold text-amber-300 flex items-center justify-center gap-0.5 mt-0.5">
                      <Star className="h-3 w-3 fill-amber-300" /> {tech.rating}
                    </span>
                  </div>
                  <div className="border-x border-white/10">
                    <span className="text-[9px] text-slate-400 block">{t.jobsDone}</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">{tech.jobsDone} งาน</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">{t.plateNumber}</span>
                    <span className="text-xs font-bold text-orange-300 mt-1 block">{tech.plateNumber}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-orange-500" /> {t.vehicleType}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTech((prev) => ({ ...prev, truckType: 'slide' }))}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
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
                      <p className="text-xs font-bold">รถสไลด์</p>
                      <p className="text-[9px] text-slate-400">Slide Tow Truck</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setTech((prev) => ({ ...prev, truckType: 'wheellift' }))}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
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
                      <p className="text-xs font-bold">รถยกซ้อนล้อ</p>
                      <p className="text-[9px] text-slate-400">Wheel-Lift Truck</p>
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

              <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" /> {t.notifications}
                </p>
                <ToggleRow icon={soundOn ? Bell : BellOff} label={t.soundNoti} value={soundOn} onChange={setSoundOn} />
                <ToggleRow icon={Vibrate} label={t.vibrateNoti} value={vibrateOn} onChange={setVibrateOn} />
              </div>

              <button
                onClick={() => {
                  changeStatus('offline');
                  setIsLoggedIn(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-red-500 py-3 text-xs font-bold text-red-500 active:scale-95 transition-all"
              >
                <LogOut className="h-4 w-4" /> {t.logout}
              </button>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 rounded-b-[38px] flex items-center justify-between">
          <NavButton icon={Home} label={t.tabHome} active={activeTab === 'home'} onClick={() => setActiveTab('home')} showBadge={hasUnreadChat && activeTab !== 'home'} />
          <NavButton icon={History} label={t.tabHistory} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <NavButton icon={User} label={t.tabProfile} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>

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
                    {selectedPendingJob.customerName || 'ไม่ระบุชื่อลูกค้า'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">#{selectedPendingJob.id}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <PhoneCall className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.customerPhone || 'ไม่ระบุเบอร์โทร'}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Car className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.carBrand} {selectedPendingJob.carModel} · {selectedPendingJob.plateNumber}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-orange-500" />
                  {selectedPendingJob.pickupAddress || 'ไม่ระบุตำแหน่ง'} ({selectedPendingJob.distanceKm} กม.)
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <span className="text-[10px] text-slate-300 font-bold">{t.stdPrice}</span>
                <span className="text-base font-black text-amber-300">฿{selectedPendingJob.price.toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => declineJob(selectedPendingJob)}
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

        {/* Modal Chat */}
        {showChat && activeJob && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
            <div className="w-full h-[520px] rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col justify-between overflow-hidden">
              <div className="bg-orange-500 p-3 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold leading-tight">{activeJob.customerName}</h3>
                  <span className="text-[9px] text-orange-100 block">ลูกค้า · งาน {activeJob.id}</span>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50">
                {chatMessages.length === 0 && (
                  <p className="text-center text-[11px] text-slate-400 pt-6">ยังไม่มีข้อความ เริ่มทักทายลูกค้าได้เลย</p>
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

              <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendTechMessage()}
                  placeholder="พิมพ์ข้อความ..."
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">กำลังโทรออกหาลูกค้า</p>
                <h3 className="text-base font-bold text-white mt-1">{activeJob.customerName}</h3>
                <p className="text-sm text-orange-300 font-black mt-0.5">{activeJob.customerPhone}</p>
              </div>

              <a
                href={`tel:${activeJob.customerPhone}`}
                onClick={() => setShowOutgoingCall(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-bold text-white shadow-md hover:bg-orange-600 active:scale-95 transition-all"
              >
                <PhoneCall className="h-4 w-4" />
                <span>เปิดแอปโทรศัพท์เพื่อโทรออก</span>
              </a>

              <button
                onClick={() => {
                  setShowOutgoingCall(false);
                  callChannelRef.current?.send({ type: 'broadcast', event: 'call_end', payload: { from: 'tech' } });
                }}
                className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/20 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Modal: สายเรียกเข้าจากลูกค้า — เด้งขึ้นแบบเรียลไทม์เมื่อลูกค้ากดโทรหาช่าง */}
        {showIncomingCall && incomingCallInfo && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl border border-slate-700 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 relative">
                <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                <PhoneCall className="h-9 w-9 relative animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">สายเรียกเข้าจากลูกค้า</p>
                <h3 className="text-base font-bold text-white mt-1">{incomingCallInfo.name}</h3>
                <p className="text-sm text-emerald-300 font-black mt-0.5">{incomingCallInfo.phone}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDeclineIncomingCall}
                  className="rounded-xl bg-red-500/20 text-red-300 py-3 text-xs font-bold hover:bg-red-500/30 active:scale-95 transition-all"
                >
                  ปฏิเสธ
                </button>
                <a
                  href={`tel:${incomingCallInfo.phone}`}
                  onClick={handleAcceptIncomingCall}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-white py-3 text-xs font-bold hover:bg-emerald-600 active:scale-95 transition-all"
                >
                  <PhoneCall className="h-3.5 w-3.5" /> รับสาย
                </a>
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
function PendingJobRow({ job, onOpen }: { job: TowJob; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl bg-white p-3 shadow-xs border border-orange-100 flex items-center justify-between text-left active:scale-[0.98] transition-all"
    >
      <div>
        <p className="text-xs font-bold text-slate-800">
          {job.customerName || 'ไม่ระบุชื่อลูกค้า'}
        </p>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
          <Car className="h-3 w-3 text-orange-500" /> {job.carBrand} {job.carModel} · {job.plateNumber}
        </p>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-orange-500" /> {job.pickupAddress || 'ไม่ระบุตำแหน่ง'} · {job.distanceKm} กม.
        </p>
      </div>
      <div className="flex items-center gap-1 text-orange-600 font-black text-xs">
        ฿{job.price.toLocaleString()}
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}

function ActiveJobCard({
  job,
  t,
  onAdvance,
  onNavigate,
  onChat,
  onCall,
  hasUnreadChat,
  payment,
  onVerifyPayment,
}: {
  job: TowJob;
  t: Record<string, string>;
  onAdvance: (job: TowJob) => void;
  onNavigate: (job: TowJob) => void;
  onChat: () => void;
  onCall: (job: TowJob) => void;
  hasUnreadChat: boolean;
  payment?: {
    id: string;
    slip_url: string | null;
    amount: number | null;
    payment_method: 'transfer' | 'cash' | 'credit';
    status: 'pending' | 'verified' | 'rejected';
  } | null;
  onVerifyPayment?: () => void;
}) {
  const jobSteps: { status: TowJob['status']; label: string; buttonLabel: string }[] = [
    { status: 'accepted', label: t.jobAccepted, buttonLabel: t.startRoute },
    { status: 'en_route', label: t.jobEnRoute, buttonLabel: t.arrivedLocation },
    { status: 'arrived', label: t.jobArrived, buttonLabel: t.startLoading },
    { status: 'loading', label: t.jobLoading, buttonLabel: t.deliveringToGarage },
    { status: 'delivering', label: t.jobDelivering, buttonLabel: t.finishJob },
  ];

  const currentIdx = jobSteps.findIndex((s) => s.status === job.status);
  const step = jobSteps[currentIdx] ?? jobSteps[0];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 text-white shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wide">{t.activeJobTitle} · {job.id}</span>
        <span className="rounded-full bg-orange-500/20 text-orange-300 text-[10px] font-bold px-2 py-0.5">
          {step.label}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-bold">{job.customerName}</p>
        <p className="text-[11px] text-slate-300 flex items-center gap-1">
          <Car className="h-3 w-3 text-orange-400" /> {job.carBrand} {job.carModel} · {job.plateNumber}
        </p>
        <p className="text-[11px] text-slate-300 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-orange-400" /> {job.pickupAddress || 'ไม่ระบุตำแหน่ง'} · {job.distanceKm} กม.
        </p>
      </div>

      {/* แผนที่ในแอปแสดงจุดเกิดเหตุที่ต้องไป — เดิมฝั่งช่างไม่มีแมพขึ้นเลย มีแค่ปุ่มเปิด Google Maps ภายนอก */}
      {job.pickupLat != null && job.pickupLng != null ? (
        <div className="relative h-36 w-full rounded-xl overflow-hidden border border-white/10">
          <iframe
            title="ตำแหน่งจุดเกิดเหตุ"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${job.pickupLng - 0.01}%2C${job.pickupLat - 0.01}%2C${job.pickupLng + 0.01}%2C${job.pickupLat + 0.01}&layer=mapnik&marker=${job.pickupLat}%2C${job.pickupLng}`}
            className="w-full h-full pointer-events-none"
          />
          <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 text-red-400" /> จุดเกิดเหตุ
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-white/20 text-[10px] text-slate-400">
          ไม่มีพิกัด GPS ของจุดรับงาน
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
        <span className="text-[10px] text-slate-300 font-bold">{t.stdPrice}</span>
        <span className="text-sm font-black text-amber-300">฿{job.price.toLocaleString()}</span>
      </div>

      {/* วิธีชำระเงินจากลูกค้า — ดึงจากตาราง payments จริง ไม่ใช่ของ mock
          ถ้าลูกค้าเลือกเงินสด (payment_method === 'cash') จะไม่มีสลิปเลยตั้งแต่ต้น
          เพราะฉะนั้นห้ามขึ้นข้อความ "ยังไม่ได้แนบสลิป" ในกรณีนี้ ให้ขึ้นป้ายเงินสดแทน */}
      {payment ? (
        payment.payment_method === 'cash' || payment.payment_method === 'credit' ? (
          <div className="rounded-xl bg-white/10 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                <Wallet className="h-3 w-3 text-emerald-300" /> วิธีชำระเงิน
              </span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  payment.status === 'verified'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {payment.payment_method === 'cash'
                  ? payment.status === 'verified' ? 'รับเงินสดแล้ว' : 'รอรับเงินสดหน้างาน'
                  : payment.status === 'verified' ? 'ตัดบัตรแล้ว' : 'รอระบบตัดบัตร'}
              </span>
            </div>
            <p className="text-[11px] text-white font-bold flex items-center gap-1.5">
              {payment.payment_method === 'cash' ? (
                <DollarSign className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              )}
              {payment.payment_method === 'cash' ? 'ลูกค้าเลือกชำระเป็นเงินสด' : 'ลูกค้าเลือกชำระผ่านบัตรเครดิต/เดบิต'}
              {payment.amount != null && <span className="text-amber-300">฿{payment.amount.toLocaleString()}</span>}
            </p>

            {payment.payment_method === 'cash' && payment.status !== 'verified' && onVerifyPayment && (
              <button
                onClick={onVerifyPayment}
                className="w-full flex items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยันรับเงินสดแล้ว
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-white/10 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300">สลิปโอนเงิน</span>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  payment.status === 'verified'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {payment.status === 'verified' ? 'ยืนยันรับเงินแล้ว' : 'รอตรวจสอบ'}
              </span>
            </div>

            {payment.slip_url ? (
              <a
                href={payment.slip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative h-32 w-full rounded-lg overflow-hidden border border-white/10 bg-slate-950"
              >
                {/* ใช้ <img> ธรรมดาแทน next/image เพราะโดเมน Supabase Storage เป็น URL แบบไดนามิก
                    ยังไม่ได้เพิ่มใน next.config.js (images.remotePatterns) — ถ้าจะสลับกลับไปใช้ next/image
                    ทีหลัง ต้องเพิ่ม hostname ของ Supabase project ใน next.config.js ก่อน */}
                <img src={payment.slip_url} alt="สลิปโอนเงิน" className="h-full w-full object-contain" />
              </a>
            ) : (
              <p className="text-[10px] text-slate-400">ลูกค้ายังไม่ได้แนบสลิป</p>
            )}

            {payment.status !== 'verified' && payment.slip_url && onVerifyPayment && (
              <button
                onClick={onVerifyPayment}
                className="w-full flex items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยันรับเงินแล้ว
              </button>
            )}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 p-2.5 text-center text-[10px] text-slate-400">
          ยังไม่มีข้อมูลการชำระเงินจากลูกค้า
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onCall(job)}
          className="flex items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-bold active:scale-95 transition-all"
        >
          <PhoneCall className="h-3.5 w-3.5" /> {t.callCustomer}
        </button>
        <button
          onClick={onChat}
          className="relative flex items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-bold active:scale-95 transition-all"
        >
          <MessageSquare className="h-3.5 w-3.5" /> {t.chatCustomer}
          {hasUnreadChat && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-slate-800"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => onNavigate(job)}
          className="flex items-center justify-center gap-1 rounded-xl bg-white/10 py-2 text-[11px] font-bold active:scale-95 transition-all"
        >
          <Navigation className="h-3.5 w-3.5" /> {t.navigate}
        </button>
      </div>

      <button
        onClick={() => onAdvance(job)}
        className="w-full flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-2.5 text-xs font-bold shadow-md shadow-orange-500/30 active:scale-95 transition-all"
      >
        {step.buttonLabel}
      </button>
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
      <span className="flex items-center gap-2 text-xs text-slate-600">
        <Icon className="h-3.5 w-3.5 text-slate-400" /> {label}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full transition-colors relative ${value ? 'bg-orange-500' : 'bg-slate-200'}`}
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
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  showBadge?: boolean;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5">
      <div className="relative">
        <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : 'text-slate-300'}`} />
        {showBadge && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
          </span>
        )}
      </div>
      <span className={`text-[9px] font-bold ${active ? 'text-orange-500' : 'text-slate-300'}`}>{label}</span>
    </button>
  );
}