'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/lib/supabaseClient';

// แผนที่ติดตามงาน real-time จริงด้วย Leaflet (ใช้ไฟล์เดียวกับฝั่งลูกค้า) — ต้อง dynamic
// import แบบ ssr:false เพราะไลบรารี leaflet อ่านค่า window ตอน import ซึ่งจะพังถ้า
// Next.js เรียกรันฝั่ง server (ดูหมายเหตุเต็มในไฟล์ components/LiveTrackingMap.tsx)
const LiveTrackingMap = dynamic(() => import('@/components/LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-36 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold text-slate-400 animate-pulse">
      กำลังโหลดแผนที่...
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
  QrCode,
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
  verifyJobPayment,
  rejectJobPayment,
  cancelJobByTech,
} from '@/lib/dtc-api';
// ลบ import จาก '@/lib/dtc-shared' เดิมทิ้งแล้ว (ไฟล์นั้นเป็น localStorage mock
// ที่ไม่มีผลกับข้อมูลจริง) เปลี่ยนมาใช้ '@/lib/dtc-api' ที่คุยกับ Supabase จริงแทน

// ============================================================================
// Multi-language Translations (TH, EN, CN)
// ============================================================================
type Lang = 'TH' | 'EN' | 'CN';

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
    breakState: 'คุณกำลังพักอยู่',
    offlineState: 'คุณกำลังออฟไลน์อยู่ (ปิดรับงาน)',
    onlineInstruction: 'กด "ออนไลน์" ด้านบนเพื่อเริ่มรับงาน',
    tabHome: 'หน้าแรก',
    tabHistory: 'ประวัติงาน',
    tabMyJobs: 'งานของฉัน',
    tabScan: 'สแกน',
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
    breakState: 'You are currently on break',
    offlineState: 'You are Offline (Not receiving jobs)',
    onlineInstruction: 'Switch to "Online" above to start receiving jobs',
    tabHome: 'Home',
    tabHistory: 'Job History',
    tabMyJobs: 'My Jobs',
    tabScan: 'Scan',
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
    breakState: '您正在休息中',
    offlineState: '您已离线（停止接单）',
    onlineInstruction: '点击上方“在线”开始接单',
    tabHome: '首页',
    tabHistory: '历史订单',
    tabMyJobs: '我的订单',
    tabScan: '扫描',
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
  specialties: ['tow'],
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
  
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

  // ตำแหน่ง GPS จริงของตัวช่างเอง เก็บไว้ในเครื่องด้วย (เดิมมีแต่โค้ดที่ "เขียนขึ้น" Supabase
  // อย่างเดียว ไม่เคยเก็บไว้แสดงในแอปช่างเองเลย) ใช้โชว์หมุด "ตำแหน่งของฉัน" บนแผนที่ในหน้า
  // งานที่กำลังทำอยู่ อัปเดตทุกครั้งที่ GPS ขยับแบบไม่หน่วง (อัปเดต state ในเครื่องไม่มีต้นทุน
  // เครือข่าย ต่างจากการเขียนขึ้น Supabase ที่ throttle ไว้ที่ ~9 วิ/ครั้งด้านล่างเพื่อประหยัด quota)
  const [techLiveCoords, setTechLiveCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ส่งพิกัด GPS จริงของช่างขึ้น Supabase ตราบใดที่มีงานอยู่ในมือ (แทนตำแหน่งจำลองที่ฝั่งลูกค้าเคยใช้)
  // throttle การเขียนไว้ที่ ~9 วิ/ครั้ง (ปรับจากเดิม 12 วิ ให้ฝั่งลูกค้ารู้สึก real-time ขึ้น
  // แต่ยังไม่ถี่จนเปลือง quota ของ Supabase หรือแบตช่างหมดเร็วเกินไป)
  const lastGpsWriteRef = useRef<number>(0);
  useEffect(() => {
    if (!activeJob) {
      setTechLiveCoords(null);
      return;
    }

    let watchId: string | null = null;
    let cancelled = false;

    // ใช้ปลั๊กอิน @capacitor/geolocation แทน navigator.geolocation ตรงๆ เพราะตอนรันเป็น
    // native app ผ่าน Capacitor เบราว์เซอร์ WebView ไม่สามารถขอสิทธิ์ ACCESS_FINE_LOCATION
    // ของ Android เองได้ — ปลั๊กอินนี้จัดการขอสิทธิ์ + เพิ่ม permission ใน
    // AndroidManifest.xml ให้อัตโนมัติตอน `npx cap sync android` (โค้ดยังใช้ได้ปกติ
    // ตอนรันในเบราว์เซอร์ธรรมดาเหมือนเดิม ปลั๊กอินสลับ implementation ให้เอง)
    (async () => {
      try {
        await Geolocation.requestPermissions();
      } catch {
        // บางแพลตฟอร์ม (เช่นเบราว์เซอร์เดสก์ท็อป) ไม่มี requestPermissions แยกให้เรียก
        // ("Not implemented on web") — ข้ามได้ ไม่ต้องให้พังทั้งบล็อก เพราะ watchPosition()
        // เองจะเด้งขอสิทธิ์ให้อัตโนมัติอยู่แล้วตอนรันบนเว็บ
      }

      try {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
          (position, err) => {
            if (err) {
              // TODO(debug): ถ้า error นี้ขึ้นถี่ ๆ ตอนกดปุ่ม "นำทาง" แปลว่าเป็นปัญหา permission
              // ไม่ใช่เรื่อง background execution — ลบ TODO นี้ทิ้งได้หลังยืนยันสาเหตุเสร็จ
              console.error('Geolocation watch error:', err);
              return;
            }
            if (!position || cancelled) return;

            // TODO(debug): log ชั่วคราวเพื่อดูว่า watchPosition ยังยิงต่อเนื่องไหมตอนแอปถูก
            // minimize ไปเปิด Google Maps นำทาง — ลบทิ้งหลังยืนยันสาเหตุเสร็จแล้ว
            console.log(
              '[GPS] ได้พิกัดใหม่',
              new Date().toLocaleTimeString(),
              position.coords.latitude,
              position.coords.longitude
            );

            setTechLiveCoords({ lat: position.coords.latitude, lng: position.coords.longitude });

            const now = Date.now();
            if (now - lastGpsWriteRef.current < 9000) return;
            lastGpsWriteRef.current = now;

            // TODO(debug): log ชั่วคราวก่อนยิงขึ้น Supabase — ลบทิ้งหลังยืนยันสาเหตุเสร็จแล้ว
            console.log('[GPS] กำลังส่งขึ้น Supabase', new Date().toLocaleTimeString());

            updateTechLocation(tech.id, position.coords.latitude, position.coords.longitude).catch((error) => {
              console.error('Error updating tech live location:', error);
            });
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
    };
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
  // แก้บั๊ก: เดิมเขียน .update() ตรงเข้าตาราง payments ซึ่งโดน RLS บล็อกเงียบๆ (0 rows
  // affected ไม่มี error) ทำให้ status ไม่เคยเปลี่ยนเป็น 'verified' จริงในฐานข้อมูล
  // ปุ่ม "จบงาน" ที่เช็คเงื่อนไขนี้เลยกดไม่ได้ตลอดไป เปลี่ยนมาเรียกผ่าน verifyJobPayment()
  // RPC แทน (ดู lib/dtc-api.ts + 0010_verify_reject_job_payment_rpc.sql)
  const handleVerifyPayment = async () => {
    if (!activeJobPayment) return;
    try {
      await verifyJobPayment(activeJobPayment.id, tech.name);
    } catch (err) {
      setToast({ message: 'ยืนยันการรับเงินไม่สำเร็จ ลองใหม่อีกครั้ง', type: 'error' });
      return;
    }
    setActiveJobPayment((prev) => (prev ? { ...prev, status: 'verified' } : prev));
    setToast({ message: 'ยืนยันรับเงินแล้ว', type: 'success' });
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
      setToast({ message: 'ปฏิเสธการชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง', type: 'error' });
      return;
    }
    setActiveJobPayment((prev) => (prev ? { ...prev, status: 'rejected' } : prev));
    setToast({ message: 'ปฏิเสธสลิป/การชำระเงินแล้ว', type: 'success' });

    const msg =
      activeJobPayment.payment_method === 'cash'
        ? 'ช่างแจ้งว่าจำนวนเงินสดที่ได้รับไม่ถูกต้อง กรุณาตรวจสอบและชำระใหม่ให้ตรงยอด'
        : 'ช่างแจ้งว่าสลิปโอนเงินไม่ถูกต้องหรือยอดไม่ตรง กรุณาแนบสลิปใหม่อีกครั้งในหน้าแชตหรือหน้ารายละเอียดงาน';
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
      setToast({ message: `ยกเลิกงาน ${job.id} แล้ว`, type: 'success' });
      setShowCancelStuckModal(false);
      setCancelStuckReason('');
    } catch (err: any) {
      // log ข้อความ error จริงออก console + โชว์ในตัว toast ชั่วคราวไว้ debug ว่า RPC
      // ยังไม่ถูก deploy (function not found) หรือ raise exception จากเงื่อนไขในตัว RPC เอง
      // (เช่น สถานะงานไม่ตรงเงื่อนไข / not authorized) — ลบกลับเป็นข้อความ generic ทีหลังได้
      console.error('cancelJobByTech failed:', err);
      setToast({
        message: `ยกเลิกงานไม่สำเร็จ: ${err?.message ?? 'ลองใหม่อีกครั้ง'}`,
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

  const pendingJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'pending' && !j.techId && !dismissedJobIds.has(j.id))
        .sort((a, b) => b.createdAt - a.createdAt),
    [jobs, dismissedJobIds]
  );

  // รีเซ็ตตัวจับเวลานับถอยหลังทุกครั้งที่ "งานที่อยู่บนสุด" เปลี่ยน (งานใหม่เข้ามาแทนที่ หรืองานเดิมถูกจัดการไปแล้ว)
  const topPendingJobId = pendingJobs[0]?.id ?? null;
  useEffect(() => {
    setNewJobCountdown(30);
    if (!topPendingJobId) return;
    const timer = setInterval(() => {
      setNewJobCountdown((prev) => {
        if (prev <= 1) {
          // หมดเวลา 30 วิแล้วยังไม่กดรับ — เคสนี้หายไปจากหน้าจอช่างคนนี้ ระบบจะเสนอให้ช่างคนถัดไปแทน
          setDismissedJobIds((ids) => new Set(ids).add(topPendingJobId));
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

  // ---- เข้าสู่ระบบด้วยอีเมล/รหัสผ่านจริง (ผูก Supabase Auth) ----
  // เดิมฟังก์ชันนี้แค่เช็คว่ากรอกครบสองช่องแล้ว setIsLoggedIn(true) เลย ไม่ว่าจะพิมพ์อะไรมา
  // ก็เข้าได้และเห็นโปรไฟล์ DEFAULT_TECH ("ช่างสมศักดิ์ บริการดี") เหมือนกันหมด — ตอนนี้เช็ค
  // กับบัญชีที่สมัครไว้จริงผ่าน signInTechnician() ถ้าอีเมล/รหัสผ่านผิดหรือยังไม่เคยสมัคร
  // จะขึ้น error ไม่ให้เข้า และถ้าเข้าได้จะโหลดชื่อ/เบอร์/ทะเบียนของช่างคนนั้นจริง ๆ มาแสดง
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone.trim() || !loginPassword.trim()) {
      setToast({ message: 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ', type: 'error' });
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
      setToast({ message: `เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ${profile.name}`, type: 'success' });
    } catch (err: any) {
      const rawMessage: string = err?.message || '';
      const friendlyMessage = rawMessage.toLowerCase().includes('invalid login credentials')
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : rawMessage || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      setToast({ message: friendlyMessage, type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
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
      setToast({ message: 'กรุณากรอกเบอร์โทรศัพท์ก่อน', type: 'error' });
      return;
    }
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setSignupGeneratedOtp(randomOtp);
    setSignupOtpValues(['', '', '', '', '', '']);
    setSignupOtpSent(true);
    setSignupPhoneVerified(false);
    setToast({ message: `ส่งรหัส OTP ไปยังเบอร์ ${signupPhone} แล้ว (รหัสทดสอบ: ${randomOtp})`, type: 'success' });
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
        setToast({ message: 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่', type: 'error' });
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
    if (!signupFullName.trim() || !signupEmployeeId.trim() || !signupPhone.trim() || !signupEmail.trim()) {
      setToast({ message: 'กรุณากรอกข้อมูลให้ครบทุกช่อง', type: 'error' });
      return;
    }
    if (!signupPasswordChecks.length || !signupPasswordChecks.uppercase || !signupPasswordChecks.numberSpecial) {
      setToast({ message: 'รหัสผ่านไม่ตรงตามเงื่อนไขที่กำหนด', type: 'error' });
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setToast({ message: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน', type: 'error' });
      return;
    }
    if (!idCardFile) {
      setToast({ message: 'กรุณาแนบเอกสารยืนยันตัวตน', type: 'error' });
      return;
    }
    if (!businessDocFile) {
      setToast({ message: 'กรุณาแนบเอกสารยืนยันบริษัท', type: 'error' });
      return;
    }
    if (!signupPhoneVerified) {
      setToast({ message: 'กรุณายืนยันรหัส OTP ของเบอร์โทรศัพท์ก่อน', type: 'error' });
      return;
    }

    setIsSubmittingSignup(true);
    try {
      // 1) สร้างบัญชีผู้ใช้ (Supabase Auth) ก่อน เพื่อให้ได้ techId ไว้ตั้ง path ไฟล์ในสตอเรจ
      const { techId } = await registerTechnician({
        email: signupEmail,
        password: signupPassword,
      });

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

      setToast({ message: 'สมัครสมาชิกสำเร็จ กรุณารอการตรวจสอบเอกสารจากทีมงาน', type: 'success' });
      setAuthTab('login');
    } catch (err: any) {
      setToast({ message: err?.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่', type: 'error' });
    } finally {
      setIsSubmittingSignup(false);
    }
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

      // เดิมจุดนี้อัปเดตแค่สถานะของ "งาน" เป็น accepted แต่ไม่เคยแตะสถานะของ "ช่าง" เลย
      // ทำให้ช่างค้างเป็น "ออนไลน์" ทั้งที่มีงานอยู่ในมือจริง ต้องเปลี่ยนสถานะช่างเป็น
      // 'working' ทันทีที่กดรับงาน เหมือนกับตอนกด "จบงาน" ที่ปล่อยกลับเป็น online เอง
      setTech((prev) => ({ ...prev, status: 'working' }));
      setTechStatusApi(tech.id, 'working').catch((err) =>
        console.error('Error setting technician status to working:', err)
      );

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
    setDismissedJobIds((ids) => new Set(ids).add(job.id));
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

  // ข้อความสำหรับงานที่ไม่ต้องลากรถ (จบที่หน้างานเลย เช่น พ่วงแบต/เปลี่ยนยาง)
  const STATUS_CHAT_MESSAGES_ON_SITE: Partial<Record<TowJob['status'], string>> = {
    en_route: 'ผมออกเดินทางแล้วนะครับ กำลังมุ่งหน้าไปยังจุดเกิดเหตุ 🚚',
    arrived: 'ถึงจุดเกิดเหตุแล้วครับ กำลังตรวจสอบสภาพรถและเตรียมอุปกรณ์',
    completed: 'ซ่อมให้เรียบร้อยแล้วครับ งานเสร็จสมบูรณ์ ขอบคุณที่ใช้บริการนะครับ 🙏',
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
      setToast({ message: 'กรุณากดยืนยันการรับเงิน (เงินสด/สลิป) ก่อนกดจบงาน', type: 'error' });
      return;
    }

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
    const statusMsg = (needsTow ? STATUS_CHAT_MESSAGES : STATUS_CHAT_MESSAGES_ON_SITE)[newStatus];
    if (statusMsg) sendSystemChatMessage(job.id, statusMsg);

    if (!nextStep) {
      // สถานะ 'online' และ jobsDone ที่แท้จริงจะ sync กลับมาจาก server ผ่าน
      // hydrateFromSupabase / realtime subscription — ที่นี่แค่ปรับ UI ให้ไวขึ้นชั่วคราว
      setTech((prev) => ({ ...prev, status: 'online' as TechStatus }));
      setToast({ message: `งาน ${job.id} เสร็จสมบูรณ์! ได้รับ ฿${job.price.toLocaleString()}`, type: 'success' });
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
    const url =
      job.pickupLat != null && job.pickupLng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${job.pickupLat},${job.pickupLng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.pickupAddress)}`;
    window.open(url, '_blank');
  };

  // รายงานปัญหา/ตามกวนหนี้กับงานที่จบไปแล้ว — ยังไม่มีตาราง dispute หรือแอปแอดมินแยกต่างหากในระบบนี้
  // เลยส่งเป็นข้อความพิเศษ (คำนำหน้า [REPORT]) เข้าแชตของงานนั้นแทน อย่างน้อยลูกค้าเห็นทันทีว่าช่าง
  // แจ้งปัญหาไว้แล้ว และแอดมินที่เข้ามาไล่ดูแชตย้อนหลังจะกรองด้วยคำนำหน้านี้เจอ
  const reportJobIssue = async (job: TowJob) => {
    const reason = window.prompt('อธิบายปัญหาที่พบกับงานนี้สั้นๆ (เช่น ลูกค้าไม่จ่ายเงิน, เบี้ยวนัด):');
    if (!reason || !reason.trim()) return;
    await sendSystemChatMessage(job.id, `[REPORT] ช่างรายงานปัญหา: ${reason.trim()}`);
    setToast({ message: 'ส่งรายงานปัญหาแล้ว ทีมงานจะตรวจสอบให้', type: 'success' });
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
                  onClick={() => setAuthTab('login')}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-500 transition-all"
                >
                  <KeyRound className="h-3.5 w-3.5" /> {t.login}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthTab('signup')}
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
                          ยังไม่ได้เชื่อมระบบส่ง SMS จริง — รหัสทดสอบของคุณคือ{' '}
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
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#06C755">
                    <path d="M12 2C6.48 2 2 5.87 2 10.5c0 4.02 3.36 7.4 7.93 8.16-.11.5-.68 2.28-.78 2.63 0 0-.02.13.06.18.08.05.17.02.17.02.23-.03 2.65-1.75 3.73-2.47.62.09 1.26.14 1.89.14 5.52 0 10-3.87 10-8.66S17.52 2 12 2z" />
                  </svg>
                  {t.signUpWithLine}
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

  // ==========================================================================
  // MAIN APP DASHBOARD & WORKING INTERFACE
  // ==========================================================================
  return (
    <div className="flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased">
      <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-slate-50 shadow-2xl transform">


        {/* Status Bar เอาออกแล้ว — มือถือจริงมีแถบสถานะอยู่แล้ว ไม่ต้องจำลองซ้ำ */}

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
                    <span className="flex items-center gap-1">{LANG_FLAG[l]} {l}</span>
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
                  onRejectPayment={() => handleRejectPayment(activeJob)}
                  onCancelStuckJob={() => setShowCancelStuckModal(true)}
                  techPos={techLiveCoords}
                />
              ) : tech.status === 'online' ? (
                pendingJobs.length === 0 ? (
                  <div className="rounded-2xl bg-white p-6 text-center border border-dashed border-slate-200">
                    <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">{t.noJobs}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* การ์ดงานใหม่บนสุด — เด่นเป็นพิเศษ พร้อมตัวจับเวลานับถอยหลังและปุ่มรับ/ปฏิเสธในตัว */}
                    <div className="rounded-2xl bg-white border-2 border-orange-400 shadow-md shadow-orange-100 overflow-hidden">
                      <div className="bg-orange-50 px-3.5 py-2 flex items-center gap-1.5 border-b border-orange-100">
                        <Bell className="h-3.5 w-3.5 text-orange-500 animate-bounce" />
                        <span className="text-xs font-bold text-orange-700">{t.newJobAlertTitle}</span>
                      </div>
                      <div className="p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800">
                            {pendingJobs[0].customerName || 'ไม่ระบุชื่อลูกค้า'}
                          </p>
                          {/* วงแหวนนับถอยหลัง — ถ้าครบ 30 วิแล้วไม่กด เคสนี้จะหายไปจากหน้าจอช่างคนนี้เอง */}
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-orange-400 text-[11px] font-black text-orange-600">
                            {newJobCountdown}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-orange-500" />
                          {pendingJobs[0].customerPhone || 'ไม่ระบุเบอร์โทร'}
                        </p>
                        <p className="text-[11px] font-semibold text-orange-700 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          {pendingJobs[0].issueType || 'ไม่ระบุอาการเสีย'}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-orange-500" />
                          {pendingJobs[0].carBrand} {pendingJobs[0].carModel} · {pendingJobs[0].plateNumber}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-orange-500" />
                          {pendingJobs[0].pickupAddress || 'ไม่ระบุตำแหน่ง'} ({pendingJobs[0].distanceKm} กม.)
                        </p>
                        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3.5 py-2.5">
                          <span className="text-[10px] text-slate-300 font-bold">{t.stdPrice}</span>
                          <span className="text-base font-black text-amber-300">
                            ฿{pendingJobs[0].price.toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                          <button
                            onClick={() => declineJob(pendingJobs[0])}
                            className="rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-500 active:scale-95 transition-all"
                          >
                            {t.declineJob}
                          </button>
                          <button
                            onClick={() => acceptJob(pendingJobs[0])}
                            className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
                          >
                            {t.acceptJob}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* งานที่รอคิวถัดไป (ถ้ามีมากกว่า 1 งาน) — แถวเล็กกดเข้าไปดูรายละเอียดได้ */}
                    {pendingJobs.slice(1).map((job) => (
                      <PendingJobRow key={job.id} job={job} onOpen={() => setSelectedPendingJob(job)} />
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
                  <p className="text-2xl font-black text-slate-800">฿{todayEarnings.toLocaleString()}</p>
                  {earningsChangePercent !== 0 && (
                    <span
                      className={`flex items-center gap-0.5 text-[11px] font-bold mb-0.5 ${
                        earningsChangePercent > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      <TrendingUp className={`h-3 w-3 ${earningsChangePercent < 0 ? 'rotate-180' : ''}`} />
                      {earningsChangePercent > 0 ? '+' : ''}
                      {earningsChangePercent}% จากเมื่อวาน
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
                    {historyJobs.filter((j) => j.updatedAt >= new Date().setHours(0, 0, 0, 0)).length} งาน
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <Clock className="h-3.5 w-3.5 text-amber-500" /> {t.ratingAvgLabel}
                  </div>
                  <p className="text-lg font-black text-slate-800 mt-1 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {tech.rating}
                  </p>
                </div>
              </div>

              {/* เงินสด vs โอน ที่เก็บมาวันนี้ */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <Banknote className="h-3.5 w-3.5 text-emerald-500" /> {t.cashCollected}
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1">฿{todayCashTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-xs border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold">
                    <CreditCard className="h-3.5 w-3.5 text-sky-500" /> {t.transferCollected}
                  </div>
                  <p className="text-base font-black text-slate-800 mt-1">฿{todayTransferTotal.toLocaleString()}</p>
                </div>
              </div>

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
                    <button
                      onClick={() => reportJobIssue(job)}
                      className="mt-2 flex items-center gap-1 text-[10px] font-bold text-red-500"
                    >
                      <AlertCircle className="h-3 w-3" /> รายงานปัญหา
                    </button>
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
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-3 py-3 rounded-b-[38px] flex items-center justify-between">
          <NavButton icon={Home} label={t.tabHome} active={activeTab === 'home'} onClick={() => setActiveTab('home')} showBadge={hasUnreadChat && activeTab !== 'home'} />
          <NavButton icon={History} label={t.tabMyJobs} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />

          {/* ปุ่ม Scan — ลอยตรงกลาง เด่นกว่าปุ่มอื่น (ฟีเจอร์สแกน QR ยังไม่เปิดใช้งานจริง แจ้งเตือนไว้ก่อน) */}
          <button
            onClick={() => setToast({ message: t.scanComingSoon, type: 'success' })}
            className="relative -mt-8 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-300/60 border-4 border-white active:scale-95 transition-all"
            aria-label={t.tabScan}
          >
            <QrCode className="h-6 w-6" />
          </button>

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
                <h3 className="text-base font-extrabold text-slate-900">จบงานเรียบร้อย!</h3>
                <p className="text-[11px] text-slate-400 mt-1">งาน {completedReceipt.job.id} เสร็จสมบูรณ์แล้ว</p>
              </div>

              <div className="rounded-2xl bg-slate-900 text-white p-3.5 text-left space-y-1.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">สรุปค่าบริการ</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">ลูกค้า</span>
                  <span className="text-[11px] font-bold text-white">{completedReceipt.job.customerName || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">ค่าบริการ</span>
                  <span className="text-sm font-black text-amber-300">
                    ฿{completedReceipt.job.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">วิธีชำระเงิน</span>
                  <span className="text-[11px] font-bold text-white">
                    {completedReceipt.payment?.payment_method === 'cash'
                      ? 'เงินสด'
                      : completedReceipt.payment?.payment_method === 'credit'
                      ? 'บัตรเครดิต/เดบิต'
                      : 'PromptPay / โอนเงิน'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">สถานะการรับเงิน</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                    {completedReceipt.payment?.payment_method === 'credit'
                      ? 'ตัดบัตรอัตโนมัติ'
                      : completedReceipt.payment?.status === 'verified'
                      ? 'ยืนยันรับเงินแล้ว'
                      : 'ไม่มีข้อมูลการชำระเงิน'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCompletedReceipt(null)}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-xs font-bold text-white shadow-md shadow-orange-200 active:scale-95 transition-all"
              >
                ปิดหน้าต่างนี้
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

        {/* Modal Chat — เต็มจอ ไม่ใช่กล่องลอยตรงกลางอีกต่อไป กันปัญหาคีย์บอร์ดบังกล่องพิมพ์ */}
        {showChat && activeJob && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white">
            <div className="bg-orange-500 p-3 text-white flex items-center justify-between shrink-0">
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

            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 bg-slate-50">
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

            <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
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

        {/* Modal ยืนยันยกเลิกงานฉุกเฉิน — ให้ช่างกรอกเหตุผลก่อนยืนยัน กันกดพลาด
            (ใช้ได้เฉพาะตอนงานยังไม่ถึงขั้นยกรถ ดูเงื่อนไข canCancelStuck ใน ActiveJobCard) */}
        {showCancelStuckModal && activeJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-500 shadow-inner">
                <XCircle className="h-8 w-8 stroke-[2.5]" />
              </div>
              <h3 className="text-center text-base font-bold text-slate-900 mb-1">ยกเลิกงานนี้?</h3>
              <p className="text-center mt-1 text-xs text-slate-500 leading-relaxed">
                ใช้เมื่อติดปัญหาไปต่อไม่ได้จริงๆ เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ
                ระบบจะแจ้งลูกค้าอัตโนมัติและปลดสถานะให้คุณรับงานใหม่ได้ทันที
              </p>
              <textarea
                value={cancelStuckReason}
                onChange={(e) => setCancelStuckReason(e.target.value)}
                placeholder="เหตุผล (ไม่บังคับ) เช่น ลูกค้าไม่แนบสลิปใหม่เกิน 15 นาที"
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
                  ไม่ยกเลิก
                </button>
                <button
                  onClick={() => handleCancelStuckJob(activeJob)}
                  disabled={isCancellingStuckJob}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500 text-white py-3 text-xs font-bold active:scale-95 transition-all disabled:opacity-60"
                >
                  {isCancellingStuckJob ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  ยืนยันยกเลิก
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
  onRejectPayment,
  onCancelStuckJob,
  techPos,
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
  onRejectPayment?: () => void;
  /** ทางออกฉุกเฉิน: ยกเลิกงานตัวเองตอนติดค้าง (เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ) —
   *  โชว์ปุ่มได้ทุกสเตจยกเว้น 'loading' (กำลังยกรถขึ้นจริง) และสถานะจบแล้ว ดูเงื่อนไข
   *  canCancelStuck ด้านล่าง */
  onCancelStuckJob?: (job: TowJob) => void;
  /** ตำแหน่ง GPS จริงของช่างเอง (null = ยังไม่มี GPS ping เข้ามา) ใช้โชว์หมุด "ตำแหน่งของฉัน" บนแผนที่ */
  techPos: { lat: number; lng: number } | null;
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

      {/* แผนที่ในแอปแสดงจุดเกิดเหตุที่ต้องไป + ตำแหน่งจริงของช่างเอง — เดิมเป็น iframe แบบลาก/ซูม
          ไม่ได้และไม่มีหมุดช่างเลย ตอนนี้เปลี่ยนเป็น Leaflet จริง real-time เหมือนฝั่งลูกค้า */}
      {job.pickupLat != null && job.pickupLng != null ? (
        <LiveTrackingMap
          techPos={techPos}
          pickupPos={{ lat: job.pickupLat, lng: job.pickupLng }}
          garagePos={null}
          showPickupMarker
          showGarageMarker={false}
          statusLabel={step.label}
          heightClassName="h-36"
        />
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

            {payment.payment_method === 'cash' && payment.status !== 'verified' && payment.status !== 'rejected' && onVerifyPayment && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRejectPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-500/20 py-2 text-[11px] font-bold text-red-300 active:scale-95 transition-all"
                >
                  <X className="h-3.5 w-3.5" /> เงินไม่ครบ
                </button>
                <button
                  onClick={onVerifyPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยันรับเงินสดแล้ว
                </button>
              </div>
            )}
            {payment.status === 'rejected' && (
              <p className="text-[10px] text-red-300 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> ปฏิเสธแล้ว รอลูกค้าชำระใหม่
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-white/10 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300">สลิปโอนเงิน</span>
              {/* เดิมเช็คแค่ 'verified' vs else ทำให้เคส 'rejected' โชว์ป้าย "รอตรวจสอบ" ผิดๆ
                  ทั้งที่จริงถูกปฏิเสธไปแล้วและกำลังรอลูกค้าแนบสลิปใหม่ (ดูข้อความด้านล่าง) —
                  แยกป้าย 3 สถานะให้ตรงกับความจริง กันช่างเข้าใจผิดว่ายังรอตรวจอยู่เฉยๆ */}
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  payment.status === 'verified'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : payment.status === 'rejected'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {payment.status === 'verified'
                  ? 'ยืนยันรับเงินแล้ว'
                  : payment.status === 'rejected'
                  ? 'ถูกปฏิเสธ'
                  : 'รอตรวจสอบ'}
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

            {payment.status !== 'verified' && payment.status !== 'rejected' && payment.slip_url && onVerifyPayment && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRejectPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-500/20 py-2 text-[11px] font-bold text-red-300 active:scale-95 transition-all"
                >
                  <X className="h-3.5 w-3.5" /> สลิปผิด/ปลอม
                </button>
                <button
                  onClick={onVerifyPayment}
                  className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500/90 py-2 text-[11px] font-bold text-white active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> ยืนยันรับเงินแล้ว
                </button>
              </div>
            )}
            {payment.status === 'rejected' && (
              <p className="text-[10px] text-red-300 font-semibold flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> ปฏิเสธแล้ว รอลูกค้าแนบสลิปใหม่
              </p>
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

      {paymentBlocked && (
        <p className="text-[10px] text-center text-amber-300 font-semibold -mb-1">
          กรุณายืนยันการรับเงินด้านบนก่อน จึงจะกดจบงานได้
        </p>
      )}

      <button
        onClick={() => onAdvance(job)}
        disabled={paymentBlocked}
        className={`w-full flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold shadow-md active:scale-95 transition-all ${
          paymentBlocked
            ? 'bg-slate-600 text-slate-400 shadow-none cursor-not-allowed active:scale-100'
            : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/30'
        }`}
      >
        {step.buttonLabel}
      </button>

      {/* ทางออกฉุกเฉิน: ยกเลิกงานเองตอนติดค้าง (เช่น ลูกค้าไม่แนบสลิปใหม่เลยหลังถูกปฏิเสธ)
          กันไว้เฉพาะตอน 'loading' (กำลังยกรถขึ้นจริง) กันกดพลาดกลางการยกรถ */}
      {canCancelStuck && onCancelStuckJob && (
        <button
          onClick={() => onCancelStuckJob(job)}
          className="w-full flex items-center justify-center gap-1 rounded-xl border border-red-400/30 bg-red-500/10 py-2 text-[11px] font-bold text-red-300 active:scale-95 transition-all"
        >
          <XCircle className="h-3.5 w-3.5" /> ยกเลิกงานนี้ (ติดปัญหา ไปต่อไม่ได้)
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