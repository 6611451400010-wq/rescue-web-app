'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/lib/supabaseClient';
import {
  createJob as createJobApi,
  subscribeJob,
  getJob,
  cancelJob,
  recordJobPayment,
  sendChatMessage,
  submitJobReview,
  registerCustomer,
  signInCustomer,
  signOutCustomer,
  getCustomerProfileIfExists,
  completeCustomerProfileAfterOAuth,
  computeRoute,
  getTechStatusCounts,
  subscribeTechStatusCounts,
  getNearbyTechPreview,
  type TowJob,
  type CustomerProfile,
  type NearbyTechPreview,
} from '@/lib/dtc-api';
import { signInWithLine, registerLineAuthListener } from '@/lib/lineAuth';
// แก้บั๊กใหญ่: ทั้งไฟล์นี้เดิม insert()/update() ตรงเข้าตาราง payments, chat_messages,
// reviews, technicians ทั้งหมด — โดน RLS (0001_lock_down_rls.sql) บล็อกเงียบๆ ทุกจุด เพราะ
// ฝั่งลูกค้าเป็น anon role ล้วน ไม่มี Supabase Auth session (ตามที่ dtc-api.ts บันทึกไว้เอง
// บรรทัด 435-441, 578-580) error แค่ถูก console.error ไม่ throw ไม่ขึ้น toast เลย ทำให้ดู
// เหมือนกดสำเร็จ (state ในเครื่อง/optimistic update ยังอัปเดต) แต่ DB จริงไม่เคยเปลี่ยนแปลง —
// นี่คือสาเหตุจริงที่ banner แนบสลิปใหม่/ข้อความแจ้งช่างไม่เคยขึ้นเลยไม่ว่าจะกดกี่ครั้ง เปลี่ยนมา
// เรียกผ่าน RPC ทั้งหมด (recordJobPayment / sendChatMessage / submitJobReview) แทน
// หมายเหตุ: ยังไม่เจอปุ่ม/ฟังก์ชันยกเลิกงานตรงๆ ในไฟล์นี้ ถ้าจะทำเพิ่ม ให้ import
// cancelJob จาก '@/lib/dtc-api' แล้วเรียก cancelJob(currentJobId) แทนการ update ตรง

// แผนที่ติดตามงาน real-time จริงด้วย Leaflet — ต้อง dynamic import แบบ ssr:false เพราะ
// ไลบรารี leaflet อ่านค่า window ตอน import ซึ่งจะพังถ้า Next.js เรียกรันฝั่ง server (ดู
// หมายเหตุเต็มในไฟล์ components/LiveTrackingMap.tsx)
const LiveTrackingMap = dynamic(() => import('@/components/LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-slate-300/80 bg-slate-100 text-[11px] font-bold text-slate-400 shadow-md animate-pulse">
      กำลังโหลดแผนที่...
    </div>
  ),
});
import {
  Wifi, 
  WifiOff,
  Battery, 
  BatteryCharging,
  ShieldCheck, 
  MapPin, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Menu,
  Bell,
  Home,
  Sliders,
  ClipboardList,
  User,
  Truck,
  Phone,
  Wrench,
  DollarSign,
  Car,
  Activity as ActivityIcon,
  UserCheck,
  UserX,
  Coffee,
  AlertTriangle,
  Maximize2,
  Navigation,
  Star,
  CheckCircle,
  Upload,
  FileText,
  Trash2,
  LogOut,
  HelpCircle,
  Settings,
  Shield,
  CreditCard,
  History,
  Headphones,
  Send,
  Globe,
  ChevronDown,
  PlusCircle,
  Lock,
  FileCheck2,
  PhoneCall,
  Check,
  QrCode,
  Fuel
} from 'lucide-react';

type Language = 'EN' | 'TH' | 'CN';

// Mockup Data ช่างบริการที่ถูกเลือก
interface Technician {
  id: string;
  name: string;
  phone: string;
  rating: number;
  jobs: number;
  plateNumber: string;
  photoUrl?: string; // รูปโปรไฟล์/โลโก้ของช่าง (ดีฟอลต์ /M5.png)
  status?: 'online' | 'working' | 'break' | 'offline'; // สถานะสด อัปเดตจากตาราง technicians ผ่าน Supabase Realtime
}

const mockAssignedTech: Technician = {
  id: 'tech_001',
  name: 'ช่างสมศักดิ์ บริการดี',
  phone: '0812345678', // เบอร์ช่างจริง
  rating: 4.9,
  jobs: 210,
  plateNumber: '2กข 5544',
  photoUrl: '/M5.png',
  status: 'online'
};

const translations = {
  EN: {
    login: 'Login',
    newAccount: 'New Account',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    forgetPassword: 'Forget Password ?',
    signIn: 'Sign in',
    signUpEmail: 'Sign up with Email',
    signUpLine: 'Sign up with Line',
    agreeTermsText: 'By signing in, you agree to our ',
    termsLink: 'Terms of Service',
    andText: ' and ',
    privacyLink: 'Privacy Policy',
    next: 'Next',
    acceptTermsBtn: 'Accept Terms of Service',
    getStarted: 'Get Started',
    contactSupport: 'Contact Support / Emergency Hotline:',
    callNow: 'Call Now',
    close: 'Close',
    forgetPasswordTitle: 'Forget Password',
    forgetPasswordSub: 'Enter your email / phone number to receive a code',
    sendCode: 'Send Code',
    verificationTitle: 'Verification',
    verificationSub: 'Enter your OTP sent in email / phone',
    verify: 'Verify',
    createNewPasswordTitle: 'Create New Password',
    newPasswordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    passwordMustContain: 'Password must contain:',
    pwdReqLength: 'At least 8 characters',
    pwdReqUppercase: 'One uppercase letter',
    pwdReqNumberSpecial: 'One number & special character',
    emailRequiredErr: 'Please enter your email',
    passwordRequiredErr: 'Please enter your password',
    newPasswordRequiredErr: 'Please enter a new password',
    confirmPasswordRequiredErr: 'Please confirm your password',
    passwordMismatchErr: 'Passwords do not match',
    resetSuccessTitle: 'Password Changed Successfully!',
    resetSuccessSub: 'Your password has been reset. You can now log in with your new password.',
    backToLogin: 'Back to Login',
    regTitle: 'Enter your personal details to complete your customer registration.',
    name: 'Name',
    surname: 'Surname',
    phone: 'Phone Number',
    carNo: 'Registration Car Number',
    carBrand: 'Car Brand',
    carModel: 'Car Model',
    aiDescription: 'AI instantly pairs stranded vehicles with the nearest, properly equipped tow truck.',
    emergencyNoticeTitle: 'Terms of Service & Emergency Hotline',
    emergencyNoticeSub: 'Need immediate towing assistance or facing issues? Please call our hotline 1176',
    serviceType: 'Tow Truck Type',
    vehicleCategory: 'Vehicle Category',
    confirmBooking: 'Confirm & Call Mechanic',
    priceNotice: '* System standard fixed rate. Mechanics cannot charge extra.',
    bookingSuccess: 'Request Sent! Mechanic on the way.',
    techDashboard: 'Technician Dashboard',
    onlineTechs: 'Online',
    offlineTechs: 'Offline',
    workingTechs: 'Working',
    breakTechs: 'On Break',
    requestHelpBtn: 'Request Assistance / Towing',
    uploadSlip: 'Upload Payment Slip',
    removeSlip: 'Remove Slip',
    selectLanguage: 'Select Language',
    sidebarHome: 'Home',
    sidebarRequest: 'Request Towing',
    sidebarHistory: 'Service History',
    sidebarProfile: 'Profile',
    sidebarPayment: 'Payment Methods',
    sidebarPrivacySecurity: 'Privacy & Security',
    sidebarSupport: 'Support Center',
    sidebarSettings: 'App Settings',
    logout: 'Log Out',
    profileServices: 'Services Used',
    profilePayments: 'Payment Methods',
    profileSavedCars: 'Saved Cars',
    profileEdit: 'Edit Profile',
    profileSave: 'Save',
    profilePersonalInfo: 'Personal Information',
    profileMainCar: 'Primary Vehicle',
    profileDefault: 'Default',
    profileBrand: 'Vehicle Brand',
    profileModel: 'Vehicle Model',
    profilePlate: 'License Plate',
    profileOtherCars: 'My Other Cars',
    profileNoOtherCars: 'No additional cars yet — add another car for easier service requests.',
    profileAddCar: 'Add Another Car',
    profileLanguage: 'Language',
    profileSupport: 'Contact Support',
    profilePrivacy: 'Privacy Policy',
    profileTerms: 'Terms of Service',
    emergencyTitle: '24-Hour Emergency Hotline',
    emergencySubtitle: 'DTC emergency towing assistance and coordination center',
    emergencyCall: 'Call Now Hotline 1176',
    emergencyLocationTitle: 'Your Emergency Location',
    latitudeLongitude: 'Latitude / Longitude',
    emergencySearching: 'Finding your location...',
    emergencyNotEnabled: 'GPS is not enabled yet — press the button below to get your current location.',
    updateLocation: 'Update Location',
    enableGPS: 'Enable GPS',
    shareEmergency: 'Share Emergency Location',
    locationUnsupported: 'This device does not support GPS location.',
    locationPermissionError: 'Unable to access your location. Please allow GPS/location permission in your browser.',
    locationUnavailableError: 'Your location is currently unavailable. Please turn on GPS and try again.',
    locationTimeoutError: 'Location request timed out. Please try again.',
    pinGpsTitle: 'Pin GPS Location',
    pinNew: 'Pin New Location',
    nearestGarage: 'Nearest Garage (Automatic)',
    liveGPS: 'Live GPS',
    emergencyTermsButton: 'Read Emergency Service Terms',
    navHome: 'Home',
    navRequest: 'Request Tow',
    navHotline: 'Hotline',
    navHistory: 'History',
    navProfile: 'Profile',
    issueBreakdown: 'Breakdown',
    issueBattery: 'Dead Battery',
    issueTire: 'Flat Tire',
    issueFuel: 'Out of Fuel',
    issueOther: 'Other',
    describeIssueTitle: 'Describe the Issue / Problem',
    reporterInfoTitle: 'Reporter Information',
    reporterNameLabel: 'Reporter Name:',
    reporterPhoneLabel: 'Phone Number:',
    towTypeSlide: 'Slide Tow',
    towTypeLift: 'Lift Tow (Wheel-Lift)',
    serviceReceiveTitle: 'Service You Will Receive',
    noTowNeededTag: 'No towing needed',
    jumpStartService: 'Jump Start Service',
    tireChangeService: 'Tire Change / Repair Service',
    fuelDeliveryService: 'Fuel Delivery Service',
    noTowDefaultMsg: 'A mechanic will fix it on-site — no need to tow your car',
    techOnBreak: 'Mechanic is on a short break',
    techOffline: 'Mechanic offline (signal lost)',
    techEnRoute: 'Heading your way',
    techLoading: 'Loading car onto the tow truck',
    techOnSite: 'Repairing on-site',
    techToGarage: 'Taking your car to the garage',
    techCompleted: 'Job completed',
    techWorking: 'Mechanic is working',
    techHeadingToScene: 'Mechanic is heading to the location',
    techLoadingEllipsis: 'Loading car onto tow truck...',
    techOnSiteEllipsis: 'Mechanic is repairing on-site...',
    techToGarageDest: 'Taking your car to the destination garage',
    techRepairDone: 'Repair completed',
    etaWithinLabel: 'Arriving within',
    currentStatusLabel: 'Current Status',
    etaApprox: 'About {min} min',
    arrivedLoading: 'Mechanic arrived, loading car onto tow truck',
    arrivedOnSite: 'Mechanic arrived, repairing on-site',
    techLabelLift: 'Lift Tow Mechanic',
    techLabelSlide: 'Slide Tow Mechanic',
    techLabelGeneric: 'Mechanic',
    techCountUnit: '',
    choosePaymentChannel: 'Choose Payment Method',
    promptpayTitle: 'PromptPay / Scan QR Code',
    promptpaySubtitle: 'Transfer and attach the payment slip in the app',
    creditCardTitle: 'Credit / Debit Card',
    creditCardSubtitle: 'Automatically charged to your saved card',
    cashTitle: 'Cash Payment',
    cashSubtitle: 'Pay the mechanic directly on-site',
    creditCardShort: 'Credit /',
    debitCardShort: 'Debit',
    cashShort: 'Cash',
    savedCardsTitle: 'Saved Cards',
    addNewCard: 'Add New Card',
    primaryBadge: 'Primary',
    paymentSecurityTitle: 'Payment Security',
    paymentSecurityDesc: 'All payment data is encrypted to international security standards (SSL Encrypted) — 100% secure',
    qrCompanyAlt: 'Company PromptPay QR Code',
    qrCompanyCaption: 'DTC Service Company PromptPay QR',
    qrScanInstructions: 'Scan the QR code above to pay, then attach the payment slip below to confirm',
    supportedFileTypes: 'Supports JPG, PNG files',
    etvPriceHeading: 'ETV Standard Price',
    totalServicePrice: 'Total Service Price:',
    gpsRequiredWarning: 'Please pin the GPS location above before requesting a mechanic',
    slipRequiredWarning: 'Please attach the payment slip in the "Payment Method" tab before requesting a mechanic',
    serviceHistoryHeading: 'Service History',
    totalItemsPrefix: 'Total',
    totalItemsSuffix: 'items',
    historyDateLabel: 'Date:',
    historyCarTypeLabel: 'Car Type:',
    historyLocationLabel: 'Location:',
    historyTechLabel: 'Mechanic:',
    netPaidLabel: 'Total Paid',
    reportIssueBtn: 'Report an Issue',
    historyStatusCompleted: 'Completed',
    historyStatusInProgress: 'In Progress',
    findingNearestTech: 'Finding the nearest mechanic for you...',
    waitingTechAccept: 'Waiting for a mechanic to accept — the tracking map will open automatically once accepted',
    cancellingEllipsis: 'Cancelling...',
    cancelRequestBtn: 'Cancel Request',
    activeStatusBadge: 'In Progress (Active)',
    viewLiveTrackingMap: 'View Live Tracking Map',
    mechanicLabelShort: 'Mechanic:',
    waitingGarageSearch: 'Waiting for GPS location to search for nearby garages',
    searchingNearbyTechs: 'Searching for available technicians near you...',
    nearbyTechsFound: '{count} technician(s) available nearby — nearest about {distance} km away',
    noNearbyTechsFallback: 'No technician nearby right now, but we will keep searching once you request help',
    noTowRepairNote: 'The mechanic will repair on-site — no need to tow to a garage',
    approxLocationSuffix: '(approximate location)',
    serviceFeeLabel: 'Service Fee',
    paymentMethodLabel: 'Payment Method',
    statusLabel: 'Status',
    paymentMethodTransfer: 'PromptPay / Transfer',
    techConfirmedPayment: 'Mechanic confirmed payment',
    waitingTechVerify: 'Waiting for mechanic to verify',
    viewEnlargedImage: 'View Enlarged Image',
    creditAutoChargeNote: 'The system will automatically charge your saved card — no slip needed',
    cashPayDirectNote: 'Pay the mechanic directly on-site — no slip needed',
    promptpayAfterAcceptNote: 'You can scan the QR code and attach the payment slip on the tracking page once a mechanic accepts your request',
    sendSlipBtn: 'Send Slip',
    kmUnit: 'km',
    jobsUnit: 'jobs',
    cardDetailsRequiredErr: 'Please fill in all card details',
    carDetailsRequiredErr: 'Please fill in all car details',
    approxLocationSetToast: 'Approximate location set. Please re-pin the exact location if possible',
    slipUploadedToast: 'Payment slip sent. Waiting for mechanic to verify',
    slipUploadFailedToast: 'Failed to upload slip — please attach it again from the history page',
    setPasswordErr: 'Please set a password',
    passwordInvalidErr: 'Password does not meet the requirements',
    regConfirmPasswordRequiredErr: 'Please confirm your password',
    serverConnectFailedToast: 'Could not connect to the server. Please check your internet connection and try again',
    serverConnectFailedErr: 'Could not connect to the server. Please try again',
    emailAlreadyUsedErr: 'This email is already registered',
    signupFailedErr: 'Sign up failed. Please try again',
    loginInvalidErr: 'Incorrect email or password, or no account found',
    lineOpenFailedToast: 'Could not open the LINE login page. Please try again',
    loginSuccessWelcome: 'Login successful. Welcome',
    lineLoginFailedToast: 'LINE login failed. Please try again',
    surnameRequiredErr: 'Please enter your surname',
    phoneRequiredErr: 'Please enter your phone number',
    emailRequiredLineErr: 'Please enter your email (LINE did not provide one)',
    lineSignupSuccessWelcome: 'LINE sign up successful. Welcome',
    saveFailedTryAgainErr: 'Failed to save. Please try again',
    passwordMinLengthErr: 'Password must be at least 6 characters',
    jobCreateFailedToast: 'Request failed: the system did not create a job (create_job_priced returned nothing). Please try again or contact support',
    submitFailedPrefix: 'Failed to submit:',
    reportIssuePrompt: 'Briefly describe the issue with this job (e.g. mechanic arrived unusually late, inappropriate behavior):',
    reportSentToast: 'Report sent. Our team will review it',
    reportFailedToast: 'Failed to send report (this job may be outdated data no longer in the system)',
    slipReattachedToast: 'New slip attached. Waiting for mechanic to verify again',
    slipReattachFailedToast: 'Failed to attach new slip. Please try again',
    techAcceptedNotif: 'has accepted your job and is on the way',
    techArrivedToast: 'Mechanic has arrived at the location',
    techLoadingCarToast: 'Mechanic is loading the car onto the tow truck',
    carLoadedHeadingToGarageToast: 'Car loaded. Heading to the destination garage',
    cancelJobSuccessToast: 'Request cancelled successfully',
    cancelJobFailedToast: 'Cancel failed — a mechanic may have just accepted this job. Try refreshing the page',
    tapToChoosePlateSubtitle: 'Tap to choose a service type and send your location',
    updateBtn: 'Update',
    locationNotFoundTap: 'Your location was not found — tap to try again',
    useApproxLocationInstead: 'Use approximate location instead',
    backToListBtn: 'Back to List',
    slipRejectedByTech: 'Mechanic reported the slip is invalid',
    reviewSlipAndReattach: 'Please double-check the transfer amount and attach a new slip below',
    reattachSlipBtn: 'Attach New Slip',
    sendingSlipEllipsis: 'Sending slip...',
    resendSlipBtn: 'Resend Slip',
    towingPlateLabel: 'Tow Truck Plate',
    techPhoneLabel: 'Mechanic Phone Number',
    callTechBtn: 'Call Mechanic',
    chatBtn: 'Chat',
    onlinePlateStatus: 'Online • Plate',
    chatInputPlaceholder: 'Type a message...',
    addNewCardTitle: 'Add New Credit / Debit Card',
    nameOnCard: 'Name on Card',
    cardNumberLabel: 'Card Number (16 digits)',
    expiryLabel: 'Expiry Date (MM/YY)',
    cvcLabel: 'CVC / CVV Code',
    saveCardBtn: 'Save Card',
    jobCompletedTitle: 'Service Completed!',
    jobCompletedSub: 'Mechanic has arrived at the destination garage. Please rate your experience',
    serviceFeeSummaryLabel: 'Service Fee Summary',
    ratingLabels: 'Very Bad,Not Satisfied,Okay,Good,Excellent!',
    reviewFeedbackPlaceholder: 'Write feedback or compliments for the mechanic (optional)...',
    submitReviewBtn: 'Submit Review & Close Job',
    sendingToNearestTechLoading: 'Sending your request to the nearest mechanic...',
    termsLine1: '1. Terms of service for towing and roadside emergency assistance, DTC Intelligent Towing Service',
    termsLine2: '2. Users must provide accurate location details and vehicle brand/model information',
    termsLine3: '3. Service fees are calculated based on the standard ETV rate — mechanics may not charge above this rate',
    termsLine4: '4. Cancelling after a mechanic has departed may incur a fee as specified in the terms',
    privacyLine1: '1. We take your privacy and personal data protection seriously (PDPA Compliance)',
    privacyLine2: '2. Your GPS location and phone number are used only for matching and dispatching a mechanic to assist you',
    privacyLine3: '3. Card and payment history data is stored under SSL Encrypted security standards and never shared with third parties',
    notificationsTitle: 'Notifications',
    markAllReadBtn: 'Mark All as Read',
    noNotificationsYet: 'No notifications yet',
    appSettingsTitle: 'App Settings',
    notificationsSectionLabel: 'Notifications',
    notificationSoundLabel: 'Notification Sound',
    vibrationLabel: 'Vibration',
    displaySectionLabel: 'Display',
    darkModeLabel: 'Dark Mode',
    manageMyAccount: 'Manage My Account',
    deleteAccountRequestToast: 'Account deletion request sent. Our team will contact you within 3 business days',
    deleteAccountBtn: 'Delete Account',
    helpCenterTitle: 'Help Center / FAQ',
    emergencyHotlineBtn: 'Call Emergency Hotline 1176',
    faqQ1: 'How long until a mechanic arrives after requesting a slide tow?',
    faqA1: 'On average, a mechanic arrives within 15-30 minutes depending on distance and traffic conditions',
    faqQ2: 'How is the service fee calculated?',
    faqA2: 'The system calculates fees based on the standard ETV rate, considering vehicle service type and distance. Mechanics may not charge above the rate shown',
    faqQ3: 'Can I cancel my request?',
    faqA3: 'You can cancel before the mechanic departs. Cancelling after they depart may incur a fee per the terms of service',
    faqQ4: 'What payment methods are supported?',
    faqA4: 'We support PromptPay (with slip), Credit/Debit Card, and Cash paid directly to the mechanic',
    carBrandLabel: 'Car Brand',
    carModelLabel: 'Car Model',
    plateNumberLabel: 'License Plate',
    platePlaceholder: 'AB 1234 Bangkok',
    saveCarBtn: 'Save This Car',
    callingTechTitle: 'Calling Mechanic',
    openPhoneAppBtn: 'Open Phone App to Call',
    cancelBtn: 'Cancel',
    incomingCallFromTech: 'Incoming Call from Mechanic',
    declineBtn: 'Decline',
    answerBtn: 'Answer',
    almostDoneTitle: 'Almost Done!',
    fillRemainingInfo: 'Please fill in the remaining details before you start',
    firstNameLabel: 'First Name',
    firstNamePlaceholder: 'First Name',
    lastNamePlaceholder: 'Last Name',
    phoneNumberLabel: 'Phone Number',
    emailLabel: 'Email',
    savingEllipsis: 'Saving...',
    getStartedBtn: 'Get Started',
    thankYouForReviewTitle: 'Thanks for Your Review!',
    thankYouForReviewMsg: 'Thank you for rating and using our service. Your feedback helps us improve',
    closeWindowBtn: 'Close Window',
    loadingMapEllipsis: 'Loading map...',
    offlineBannerText: 'No internet connection — data may not update until connection is restored',
    signingInEllipsis: 'Signing in...',
    openingLinePageEllipsis: 'Opening LINE page...',
    signingUpEllipsis: 'Signing up...',
    newPasswordPlaceholder: 'Enter new password',
    confirmNewPasswordPlaceholder: 'Enter new password again',
    selectServiceTypePrefix: 'Select vehicle service type',
    yourVehicleTypePrefix: 'Your vehicle type',
    carCategorySedanOption: 'Sedan (Sedan / Hatchback)',
    carCategoryEvOption: 'Electric Vehicle (EV / Hybrid)',
    carCategoryPickupOption: 'Pickup Truck',
    carCategorySuvOption: 'SUV / Van'
  },
  TH: {
    login: 'เข้าสู่ระบบ',
    newAccount: 'สร้างบัญชีใหม่',
    emailPlaceholder: 'อีเมล',
    passwordPlaceholder: 'รหัสผ่าน',
    forgetPassword: 'ลืมรหัสผ่าน ?',
    signIn: 'เข้าสู่ระบบ',
    signUpEmail: 'ลงทะเบียนด้วย อีเมล',
    signUpLine: 'ลงทะเบียนด้วย Line',
    agreeTermsText: 'ในการเข้าสู่ระบบ คุณยอมรับ ',
    termsLink: 'เงื่อนไขการให้บริการ',
    andText: ' และ ',
    privacyLink: 'นโยบายความเป็นส่วนตัว',
    next: 'ถัดไป',
    acceptTermsBtn: 'ยอมรับเงื่อนไขการใช้งาน',
    getStarted: 'เริ่มต้นใช้งาน',
    contactSupport: 'ติดต่อศูนย์บริการ / สายด่วนฉุกเฉิน:',
    callNow: 'โทรออกทันที',
    close: 'ปิดหน้าต่าง',
    forgetPasswordTitle: 'ลืมรหัสผ่าน',
    forgetPasswordSub: 'กรอกอีเมลหรือเบอร์โทรศัพท์ของคุณเพื่อรับรหัสยืนยัน',
    sendCode: 'ส่งรหัสยืนยัน',
    verificationTitle: 'ยืนยันตัวตน',
    verificationSub: 'กรอกรหัส OTP ที่ได้รับทางอีเมล / เบอร์โทรศัพท์',
    verify: 'ยืนยัน',
    createNewPasswordTitle: 'ตั้งรหัสผ่านใหม่',
    newPasswordLabel: 'รหัสผ่านใหม่',
    confirmPasswordLabel: 'ยืนยันรหัสผ่านใหม่',
    passwordMustContain: 'รหัสผ่านต้องมี:',
    pwdReqLength: 'อย่างน้อย 8 ตัวอักษร',
    pwdReqUppercase: 'มีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว',
    pwdReqNumberSpecial: 'มีตัวเลขและอักขระพิเศษอย่างน้อย 1 ตัว',
    emailRequiredErr: 'กรุณากรอกอีเมล',
    passwordRequiredErr: 'กรุณากรอกรหัสผ่าน',
    newPasswordRequiredErr: 'กรุณากรอกรหัสผ่านใหม่',
    confirmPasswordRequiredErr: 'กรุณายืนยันรหัสผ่านใหม่',
    passwordMismatchErr: 'รหัสผ่านไม่ตรงกัน',
    resetSuccessTitle: 'เปลี่ยนรหัสผ่านสำเร็จ!',
    resetSuccessSub: 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ',
    backToLogin: 'กลับไปหน้าเข้าสู่ระบบ',
    regTitle: 'กรอกข้อมูลส่วนตัวของคุณเพื่อลงทะเบียนสมาชิกใหม่',
    name: 'ชื่อ',
    surname: 'นามสกุล',
    phone: 'เบอร์โทรศัพท์',
    carNo: 'ทะเบียนรถยนต์',
    carBrand: 'ยี่ห้อรถ (เช่น Toyota, Honda, BYD)',
    carModel: 'รุ่นรถ (เช่น Civic, Hilux, Atto 3)',
    aiDescription: 'ระบบ AI จะจับคู่ยานพาหนะที่ขัดข้องกับรถยกที่อยู่ใกล้ที่สุดและมีอุปกรณ์เหมาะสมทันที',
    emergencyNoticeTitle: 'เงื่อนไขการให้บริการ & สายด่วนฉุกเฉิน',
    emergencyNoticeSub: 'หากต้องการความช่วยเหลือฉุกเฉินหรือพบปัญหาการใช้งาน กรุณาติดต่อสายด่วน 1176',
    serviceType: 'ประเภทรถบริการ',
    vehicleCategory: 'ประเภทรถของผู้แจ้ง',
    confirmBooking: 'ยืนยันเรียกช่างทันที',
    priceNotice: '* ราคากลางควบคุมโดยระบบ ช่างไม่สามารถเรียกเก็บเกินได้',
    bookingSuccess: 'ส่งคำขอเรียบร้อย! ช่างกำลังเดินทางไปหาคุณ',
    techDashboard: 'แดชบอร์ดสถานะช่างบริการ',
    onlineTechs: 'ออนไลน์',
    offlineTechs: 'ออฟไลน์',
    workingTechs: 'กำลังทำงาน',
    breakTechs: 'เวลาพัก',
    requestHelpBtn: 'ส่งคำขอความช่วยเหลือ / เรียกช่าง',
    uploadSlip: 'แนบสลิปการโอนเงิน',
    removeSlip: 'ลบสลิป',
    selectLanguage: 'เลือกภาษา',
    sidebarHome: 'หน้าแรก',
    sidebarRequest: 'เรียกรถยก',
    sidebarHistory: 'ประวัติการใช้บริการ',
    sidebarProfile: 'โปรไฟล์ส่วนตัว',
    sidebarPayment: 'วิธีการชำระเงิน',
    sidebarPrivacySecurity: 'นโยบายและความปลอดภัย',
    sidebarSupport: 'ติดต่อศูนย์ช่วยเหลือ',
    sidebarSettings: 'ตั้งค่าแอปพลิเคชัน',
    logout: 'ออกจากระบบ',
    profileServices: 'ครั้งที่ใช้บริการ',
    profilePayments: 'วิธีชำระเงิน',
    profileSavedCars: 'รถที่บันทึกไว้',
    profileEdit: 'แก้ไขโปรไฟล์',
    profileSave: 'บันทึก',
    profilePersonalInfo: 'ข้อมูลส่วนตัว',
    profileMainCar: 'ข้อมูลรถยนต์หลัก',
    profileDefault: 'ค่าเริ่มต้น',
    profileBrand: 'ยี่ห้อรถยนต์',
    profileModel: 'รุ่นรถยนต์',
    profilePlate: 'ทะเบียนรถ',
    profileOtherCars: 'รถคันอื่นของฉัน',
    profileNoOtherCars: '{t.profileNoOtherCars}',
    profileAddCar: 'เพิ่มรถอีกคัน',
    profileLanguage: 'ภาษา / Language',
    profileSupport: 'ติดต่อศูนย์ช่วยเหลือ',
    profilePrivacy: 'นโยบายความเป็นส่วนตัว',
    profileTerms: 'เงื่อนไขการให้บริการ',
    emergencyTitle: 'สายด่วนฉุกเฉิน 24 ชั่วโมง',
    emergencySubtitle: 'ศูนย์ช่วยเหลือและประสานงานรถยกด่วน DTC Hotline',
    emergencyCall: 'โทรออกทันที Hotline 1176',
    emergencyLocationTitle: 'พิกัดตำแหน่งฉุกเฉินของคุณ',
    latitudeLongitude: 'ละติจูด / ลองจิจูด',
    emergencySearching: 'กำลังค้นหาตำแหน่งของคุณ...',
    emergencyNotEnabled: 'ยังไม่ได้เปิดใช้งาน GPS — กดปุ่มด้านล่างเพื่อระบุตำแหน่งปัจจุบันของคุณ',
    updateLocation: 'อัปเดตตำแหน่ง',
    enableGPS: 'เปิดใช้งาน GPS',
    shareEmergency: 'แชร์พิกัดฉุกเฉิน',
    locationUnsupported: 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง GPS',
    locationPermissionError: 'ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตการใช้งาน GPS ในเบราว์เซอร์',
    locationUnavailableError: 'ไม่พบตำแหน่งปัจจุบัน กรุณาเปิด GPS แล้วลองใหม่',
    locationTimeoutError: 'หมดเวลาในการค้นหาตำแหน่ง กรุณาลองใหม่',
    pinGpsTitle: 'ตรึง GPS จุดเกิดเหตุ',
    pinNew: 'ปักหมุดใหม่',
    nearestGarage: 'อู่ใกล้เคียงที่สุด (อัตโนมัติ)',
    liveGPS: 'Live GPS',
    emergencyTermsButton: 'อ่านเงื่อนไขการให้บริการฉุกเฉิน',
    navHome: 'หน้าแรก',
    navRequest: 'เรียกรถยก',
    navHotline: 'สายด่วน',
    navHistory: 'ประวัติ',
    navProfile: 'โปรไฟล์',
    issueBreakdown: 'รถเสีย',
    issueBattery: 'แบตหมด',
    issueTire: 'ยางแตก',
    issueFuel: 'น้ำมันหมด',
    issueOther: 'อื่นๆ',
    describeIssueTitle: 'ระบุอาการเสีย / ปัญหาที่พบ',
    reporterInfoTitle: 'ข้อมูลผู้แจ้ง',
    reporterNameLabel: 'ชื่อผู้แจ้ง:',
    reporterPhoneLabel: 'เบอร์โทรศัพท์:',
    towTypeSlide: 'รถสไลด์ (Slide Tow)',
    towTypeLift: 'รถยกช้อนล้อ (Lift Tow)',
    serviceReceiveTitle: 'บริการที่จะได้รับ',
    noTowNeededTag: 'ไม่ต้องใช้รถลาก',
    jumpStartService: 'บริการพ่วงแบตเตอรี่',
    tireChangeService: 'บริการเปลี่ยน/ปะยาง',
    fuelDeliveryService: 'บริการนำน้ำมันไปเติมให้',
    noTowDefaultMsg: 'ช่างซ่อมให้เสร็จที่หน้างานเลย ไม่ต้องนำรถไปอู่',
    techOnBreak: 'ช่างขอพักชั่วคราว',
    techOffline: 'ช่างออฟไลน์ (สัญญาณขาดหาย)',
    techEnRoute: 'กำลังเดินทางมาหาคุณ',
    techLoading: 'กำลังยกรถขึ้นรถสไลด์',
    techOnSite: 'กำลังซ่อมให้ที่หน้างาน',
    techToGarage: 'กำลังนำรถไปส่งอู่',
    techCompleted: 'งานเสร็จสิ้นแล้ว',
    techWorking: 'ช่างกำลังทำงาน',
    techHeadingToScene: 'ช่างกำลังเดินทางไปจุดเกิดเหตุ',
    techLoadingEllipsis: 'กำลังยกรถขึ้นรถสไลด์...',
    techOnSiteEllipsis: 'ช่างกำลังซ่อมให้ที่หน้างาน...',
    techToGarageDest: 'กำลังนำรถไปส่งที่อู่จุดหมาย',
    techRepairDone: 'ซ่อมเสร็จเรียบร้อยแล้ว',
    etaWithinLabel: 'ถึงจุดเกิดเหตุภายใน',
    currentStatusLabel: 'สถานะปัจจุบัน',
    etaApprox: 'ประมาณ {min} นาที',
    arrivedLoading: 'ช่างถึงจุดเกิดเหตุแล้ว กำลังยกรถขึ้นรถสไลด์',
    arrivedOnSite: 'ช่างถึงจุดเกิดเหตุแล้ว กำลังซ่อมให้ที่หน้างาน',
    techLabelLift: 'ช่างยกซ้อนล้อ',
    techLabelSlide: 'ช่างสไลด์',
    techLabelGeneric: 'ช่าง',
    techCountUnit: 'คน',
    choosePaymentChannel: 'เลือกช่องทางการชำระเงิน',
    promptpayTitle: 'PromptPay / สแกน QR Code',
    promptpaySubtitle: 'โอนชำระพร้อมแนบสลิปผ่านแอป',
    creditCardTitle: 'บัตรเครดิต / เดบิต (Credit/Debit Card)',
    creditCardSubtitle: 'ตัดผ่านบัตรที่บันทึกไว้โดยอัตโนมัติ',
    cashTitle: 'เงินสด (Cash Payment)',
    cashSubtitle: 'ชำระกับช่างโดยตรงที่หน้างาน',
    creditCardShort: 'บัตรเครดิต /',
    debitCardShort: 'เดบิต',
    cashShort: 'เงินสด',
    savedCardsTitle: 'บัตรที่บันทึกไว้',
    addNewCard: 'เพิ่มบัตรใหม่',
    primaryBadge: 'หลัก',
    paymentSecurityTitle: 'ความปลอดภัยของระบบชำระเงิน',
    paymentSecurityDesc: 'ข้อมูลการชำระเงินทั้งหมดได้รับการเข้ารหัสความปลอดภัยระดับมาตรฐานสากล (SSL Encrypted) ปลอดภัย 100%',
    qrCompanyAlt: 'QR Code PromptPay บริษัท',
    qrCompanyCaption: 'QR PromptPay บริษัท DTC Service',
    qrScanInstructions: 'สแกนจ่ายผ่าน QR ด้านบน แล้วแนบสลิปการโอนเงินด้านล่างเพื่อยืนยัน',
    supportedFileTypes: 'รองรับไฟล์ JPG, PNG',
    etvPriceHeading: 'ราคากลาง ETV Standard Price',
    totalServicePrice: 'ค่าบริการรวมสุทธิ:',
    gpsRequiredWarning: 'กรุณาตรึง GPS จุดเกิดเหตุด้านบนก่อน จึงจะเรียกช่างได้',
    slipRequiredWarning: 'กรุณาแนบสลิปการโอนเงินในแท็บ "วิธีการชำระเงิน" ก่อน จึงจะเรียกช่างได้',
    serviceHistoryHeading: 'ประวัติการเรียกใช้บริการ',
    totalItemsPrefix: 'ทั้งหมด',
    totalItemsSuffix: 'รายการ',
    historyDateLabel: 'วันที่:',
    historyCarTypeLabel: 'ประเภทรถ:',
    historyLocationLabel: 'สถานที่:',
    historyTechLabel: 'ช่างผู้ดูแล:',
    netPaidLabel: 'ยอดชำระสุทธิ',
    reportIssueBtn: 'รายงานปัญหา',
    historyStatusCompleted: 'เสร็จสิ้น',
    historyStatusInProgress: 'กำลังดำเนินการ',
    findingNearestTech: 'กำลังหาช่างที่ใกล้ที่สุดให้คุณ...',
    waitingTechAccept: 'รอช่างกดรับงาน แผนที่ติดตามจะเปิดขึ้นอัตโนมัติทันทีที่มีช่างรับงาน',
    cancellingEllipsis: 'กำลังยกเลิก...',
    cancelRequestBtn: 'ยกเลิกการเรียกช่าง',
    activeStatusBadge: 'กำลังดำเนินการ (Active)',
    viewLiveTrackingMap: 'ดูแผนที่ Live Tracking',
    mechanicLabelShort: 'ช่าง:',
    waitingGarageSearch: 'รอตำแหน่ง GPS จุดเกิดเหตุเพื่อค้นหาอู่ใกล้เคียง',
    searchingNearbyTechs: 'กำลังค้นหาช่างว่างใกล้จุดคุณ...',
    nearbyTechsFound: 'มีช่างว่างใกล้จุดคุณ {count} คน ใกล้สุดประมาณ {distance} กม.',
    noNearbyTechsFallback: 'ตอนนี้ยังไม่พบช่างว่างในระยะใกล้ แต่ระบบจะยังคงหาช่างให้หลังจากคุณกดเรียก',
    noTowRepairNote: 'ช่างซ่อมให้เสร็จที่หน้างานเลย ไม่ต้องนำรถไปอู่',
    approxLocationSuffix: '(ตำแหน่งโดยประมาณ)',
    serviceFeeLabel: 'ค่าบริการ',
    paymentMethodLabel: 'วิธีชำระเงิน',
    statusLabel: 'สถานะ',
    paymentMethodTransfer: 'PromptPay / โอนเงิน',
    techConfirmedPayment: 'ช่างยืนยันรับเงินแล้ว',
    waitingTechVerify: 'รอช่างตรวจสอบ',
    viewEnlargedImage: 'ดูรูปขยาย',
    creditAutoChargeNote: 'ระบบจะตัดผ่านบัตรเครดิต/เดบิตที่บันทึกไว้โดยอัตโนมัติ ไม่ต้องแนบสลิป',
    cashPayDirectNote: 'ชำระเงินสดกับช่างโดยตรงที่หน้างาน ไม่ต้องแนบสลิป',
    promptpayAfterAcceptNote: 'คุณสามารถสแกน QR Code และแนบสลิปการโอนเงินได้ในหน้าติดตามงาน หลังจากช่างกดรับงานของคุณแล้ว',
    sendSlipBtn: 'ส่งสลิป',
    kmUnit: 'กม.',
    jobsUnit: 'งาน',
    cardDetailsRequiredErr: 'กรุณากรอกข้อมูลบัตรให้ครบถ้วน',
    carDetailsRequiredErr: 'กรุณากรอกข้อมูลรถให้ครบถ้วน',
    approxLocationSetToast: 'ใช้ตำแหน่งโดยประมาณแล้ว กรุณาปักหมุดแก้ไขให้ตรงจุดเกิดเหตุอีกครั้งหากทำได้',
    slipUploadedToast: 'ส่งสลิปโอนเงินเรียบร้อย รอช่างตรวจสอบ',
    slipUploadFailedToast: 'อัปโหลดสลิปไม่สำเร็จ กรุณาแนบสลิปใหม่ในหน้าประวัติงาน',
    setPasswordErr: 'กรุณาตั้งรหัสผ่าน',
    passwordInvalidErr: 'รหัสผ่านไม่ตรงตามเงื่อนไขที่กำหนด',
    regConfirmPasswordRequiredErr: 'กรุณายืนยันรหัสผ่าน',
    serverConnectFailedToast: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
    serverConnectFailedErr: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    emailAlreadyUsedErr: 'อีเมลนี้ถูกใช้สมัครสมาชิกไปแล้ว',
    signupFailedErr: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    loginInvalidErr: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือยังไม่เคยสมัครสมาชิก',
    lineOpenFailedToast: 'ไม่สามารถเปิดหน้าล็อกอิน LINE ได้ กรุณาลองใหม่อีกครั้ง',
    loginSuccessWelcome: 'เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ',
    lineLoginFailedToast: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    surnameRequiredErr: 'กรุณากรอกนามสกุล',
    phoneRequiredErr: 'กรุณากรอกเบอร์โทรศัพท์',
    emailRequiredLineErr: 'กรุณากรอกอีเมล (LINE ไม่ได้ให้อีเมลมา)',
    lineSignupSuccessWelcome: 'สมัครสมาชิกด้วย LINE สำเร็จ ยินดีต้อนรับคุณ',
    saveFailedTryAgainErr: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    passwordMinLengthErr: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
    jobCreateFailedToast: 'ส่งคำขอไม่สำเร็จ: ระบบไม่ได้สร้างงานจริง (create_job_priced ไม่คืนค่างานกลับมา) กรุณาลองใหม่หรือแจ้งทีมงาน',
    submitFailedPrefix: 'ส่งข้อมูลไม่สำเร็จ:',
    reportIssuePrompt: 'อธิบายปัญหาที่พบกับงานนี้สั้นๆ (เช่น ช่างมาช้าผิดปกติ, พฤติกรรมไม่เหมาะสม):',
    reportSentToast: 'ส่งรายงานปัญหาแล้ว ทีมงานจะตรวจสอบให้',
    reportFailedToast: 'ส่งรายงานไม่สำเร็จ (งานนี้อาจเป็นข้อมูลเก่าที่ไม่มีอยู่ในระบบแล้ว)',
    slipReattachedToast: 'แนบสลิปใหม่เรียบร้อย รอช่างตรวจสอบอีกครั้ง',
    slipReattachFailedToast: 'แนบสลิปใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    techAcceptedNotif: 'รับงานของคุณแล้ว กำลังเดินทางมาหา',
    techArrivedToast: 'ช่างถึงจุดเกิดเหตุแล้ว',
    techLoadingCarToast: 'ช่างกำลังยกรถขึ้นรถสไลด์',
    carLoadedHeadingToGarageToast: 'ยกรถเสร็จแล้ว กำลังนำรถไปส่งที่อู่ปลายทาง',
    cancelJobSuccessToast: 'ยกเลิกการเรียกช่างเรียบร้อยแล้ว',
    cancelJobFailedToast: 'ยกเลิกไม่สำเร็จ อาจมีช่างรับงานไปแล้วพอดี ลองรีเฟรชหน้าดูอีกครั้ง',
    tapToChoosePlateSubtitle: 'กดเพื่อเลือกประเภทบริการและส่งพิกัด',
    updateBtn: 'อัปเดต',
    locationNotFoundTap: 'ยังไม่พบตำแหน่งของคุณ — แตะเพื่อลองอีกครั้ง',
    useApproxLocationInstead: 'ใช้ตำแหน่งโดยประมาณแทน',
    backToListBtn: 'ย้อนกลับหน้ารายการ',
    slipRejectedByTech: 'ช่างแจ้งว่าสลิปไม่ถูกต้อง',
    reviewSlipAndReattach: 'กรุณาตรวจสอบยอดโอนอีกครั้งแล้วแนบสลิปใหม่ด้านล่างนี้',
    reattachSlipBtn: 'แนบสลิปใหม่',
    sendingSlipEllipsis: 'กำลังส่งสลิป...',
    resendSlipBtn: 'ส่งสลิปใหม่',
    towingPlateLabel: 'ทะเบียนรถยก',
    techPhoneLabel: 'เบอร์โทรศัพท์ช่าง',
    callTechBtn: 'โทรหาช่าง',
    chatBtn: 'แชต',
    onlinePlateStatus: 'ออนไลน์ • ทะเบียน',
    chatInputPlaceholder: 'พิมพ์ข้อความ...',
    addNewCardTitle: 'เพิ่มบัตรเครดิต / เดบิตใหม่',
    nameOnCard: 'ชื่อบนบัตร',
    cardNumberLabel: 'หมายเลขบัตร (16 หลัก)',
    expiryLabel: 'วันหมดอายุ (MM/YY)',
    cvcLabel: 'รหัส CVC / CVV',
    saveCardBtn: 'บันทึกบัตรชำระเงิน',
    jobCompletedTitle: 'งานบริการเสร็จสิ้น!',
    jobCompletedSub: 'ช่างถึงอู่ปลายทางเรียบร้อยแล้ว ให้คะแนนความพึงพอใจกันหน่อย',
    serviceFeeSummaryLabel: 'สรุปค่าบริการ',
    ratingLabels: 'แย่มาก,ไม่ประทับใจ,พอใช้,ดี,ดีเยี่ยม!',
    reviewFeedbackPlaceholder: 'เขียนข้อเสนอแนะหรือคำชมเชยช่าง (ถ้ามี)...',
    submitReviewBtn: 'ส่งรีวิวและปิดงาน',
    sendingToNearestTechLoading: 'ระบบกำลังส่งข้อมูลไปยังช่างสไลด์ที่ใกล้คุณที่สุด...',
    termsLine1: '1. เงื่อนไขการให้บริการยกรถและช่วยเหลือฉุกเฉิน DTC Intelligent Towing Service',
    termsLine2: '2. ผู้ใช้บริการต้องให้ข้อมูลพิกัดสถานที่และรายละเอียด ยี่ห้อ/รุ่น ของยานพาหนะตามความเป็นจริง',
    termsLine3: '3. อัตราค่าบริการคำนวณตามราคากลางมาตรฐาน ETV ห้ามช่างเรียกเก็บเงินเพิ่มเติมเกินอัตรากำหนด',
    termsLine4: '4. การยกเลิกคำขอหลังช่างออกเดินทางแล้วอาจมีค่าธรรมเนียมตามที่กำหนดในเงื่อนไข',
    privacyLine1: '1. เราให้ความสำคัญกับความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลของคุณ (PDPA Compliance)',
    privacyLine2: '2. ข้อมูล GPS และเบอร์โทรศัพท์ของคุณจะถูกใช้เพื่อการจับคู่และเดินทางไปให้ความช่วยเหลือของช่างเท่านั้น',
    privacyLine3: '3. ข้อมูลบัตรและประวัติการชำระเงินจะถูกจัดเก็บด้วยมาตรฐานความปลอดภัย SSL Encrypted ไม่มีการเปิดเผยแก่บุคคลภายนอก',
    notificationsTitle: 'การแจ้งเตือน',
    markAllReadBtn: 'ทำเครื่องหมายว่าอ่านทั้งหมด',
    noNotificationsYet: 'ยังไม่มีการแจ้งเตือน',
    appSettingsTitle: 'ตั้งค่าแอปพลิเคชัน',
    notificationsSectionLabel: 'การแจ้งเตือน',
    notificationSoundLabel: 'เสียงแจ้งเตือน',
    vibrationLabel: 'การสั่นเตือน',
    displaySectionLabel: 'การแสดงผล',
    darkModeLabel: 'โหมดมืด (Dark Mode)',
    manageMyAccount: 'จัดการบัญชีของฉัน',
    deleteAccountRequestToast: 'คำขอลบบัญชีถูกส่งแล้ว ทีมงานจะติดต่อกลับภายใน 3 วันทำการ',
    deleteAccountBtn: 'ลบบัญชีผู้ใช้งาน',
    helpCenterTitle: 'ศูนย์ช่วยเหลือ / คำถามที่พบบ่อย',
    emergencyHotlineBtn: 'โทรสายด่วนฉุกเฉิน 1176',
    faqQ1: 'เรียกรถสไลด์แล้วช่างมาถึงภายในกี่นาที?',
    faqA1: 'โดยเฉลี่ยช่างจะถึงจุดหมายภายใน 15-30 นาที ขึ้นอยู่กับระยะทางและสภาพการจราจร',
    faqQ2: 'ค่าบริการคำนวณอย่างไร?',
    faqA2: 'ระบบคำนวณตามราคากลางมาตรฐาน ETV โดยพิจารณาจากประเภทรถบริการและระยะทาง ช่างไม่สามารถเรียกเก็บเกินราคาที่ระบบแจ้งได้',
    faqQ3: 'ยกเลิกคำขอได้หรือไม่?',
    faqA3: 'ยกเลิกได้ก่อนช่างออกเดินทาง หากยกเลิกหลังช่างออกเดินทางแล้วอาจมีค่าธรรมเนียมตามเงื่อนไขการให้บริการ',
    faqQ4: 'ชำระเงินได้ช่องทางใดบ้าง?',
    faqA4: 'รองรับพร้อมเพย์ (แนบสลิป), บัตรเครดิต/เดบิต และเงินสดกับช่างโดยตรง',
    carBrandLabel: 'ยี่ห้อรถ',
    carModelLabel: 'รุ่นรถ',
    plateNumberLabel: 'ทะเบียนรถ',
    platePlaceholder: 'กข 1234 กทม.',
    saveCarBtn: 'บันทึกรถคันนี้',
    callingTechTitle: 'กำลังโทรออกหาช่าง',
    openPhoneAppBtn: 'เปิดแอปโทรศัพท์เพื่อโทรออก',
    cancelBtn: 'ยกเลิก',
    incomingCallFromTech: 'สายเรียกเข้าจากช่าง',
    declineBtn: 'ปฏิเสธ',
    answerBtn: 'รับสาย',
    almostDoneTitle: 'เกือบเสร็จแล้ว!',
    fillRemainingInfo: 'กรุณากรอกข้อมูลเพิ่มเติมให้ครบก่อนเริ่มใช้งาน',
    firstNameLabel: 'ชื่อ',
    firstNamePlaceholder: 'ชื่อจริง',
    lastNamePlaceholder: 'นามสกุล',
    phoneNumberLabel: 'เบอร์โทรศัพท์',
    emailLabel: 'อีเมล',
    savingEllipsis: 'กำลังบันทึก...',
    getStartedBtn: 'เริ่มใช้งาน',
    thankYouForReviewTitle: 'ขอบคุณสำหรับคะแนนรีวิว!',
    thankYouForReviewMsg: 'ขอบคุณที่ให้คะแนนและใช้บริการกับเรา ความคิดเห็นของคุณช่วยให้เราพัฒนาการบริการต่อไป',
    closeWindowBtn: 'ปิดหน้าต่าง',
    loadingMapEllipsis: 'กำลังโหลดแผนที่...',
    offlineBannerText: 'ขาดการเชื่อมต่ออินเทอร์เน็ต — ข้อมูลอาจไม่อัปเดตจนกว่าเน็ตจะกลับมา',
    signingInEllipsis: 'กำลังเข้าสู่ระบบ...',
    openingLinePageEllipsis: 'กำลังเปิดหน้า LINE...',
    signingUpEllipsis: 'กำลังสมัครสมาชิก...',
    newPasswordPlaceholder: 'กรอกรหัสผ่านใหม่',
    confirmNewPasswordPlaceholder: 'กรอกรหัสผ่านใหม่อีกครั้ง',
    selectServiceTypePrefix: 'เลือกประเภทรถบริการ',
    yourVehicleTypePrefix: 'ประเภทรถของท่าน',
    carCategorySedanOption: 'รถเก๋ง (Sedan / Hatchback)',
    carCategoryEvOption: 'รถไฟฟ้า (EV / Hybrid)',
    carCategoryPickupOption: 'รถกระบะ (Pickup Truck)',
    carCategorySuvOption: 'รถ SUV / รถตู้ (Van)'
  },
  CN: {
    login: '登录',
    newAccount: '新建账户',
    emailPlaceholder: '电子邮件',
    passwordPlaceholder: '密码',
    forgetPassword: '忘记密码？',
    signIn: '登录',
    signUpEmail: '通过电子邮件注册',
    signUpLine: '通过 Line 注册',
    agreeTermsText: '登录即表示您同意 our',
    termsLink: '服务条款',
    andText: ' 和 ',
    privacyLink: '隐私政策',
    next: '下一步',
    acceptTermsBtn: '接受服务条款',
    getStarted: '开始使用',
    contactSupport: '联系客服 / 紧急热线：',
    callNow: '立即拨打',
    close: '关闭窗口',
    forgetPasswordTitle: '忘记密码',
    forgetPasswordSub: '输入您的电子邮件 / 电话号码以接收验证码',
    sendCode: '发送验证码',
    verificationTitle: '验证',
    verificationSub: '输入发送至您邮箱 / 手机的 OTP 验证码',
    verify: '确认',
    createNewPasswordTitle: '创建新密码',
    newPasswordLabel: '新密码',
    confirmPasswordLabel: '确认新密码',
    passwordMustContain: '密码必须包含：',
    pwdReqLength: '至少 8 个字符',
    pwdReqUppercase: '至少一个大写字母',
    pwdReqNumberSpecial: '至少一个数字和特殊字符',
    emailRequiredErr: '请输入您的电子邮件',
    passwordRequiredErr: '请输入您的密码',
    newPasswordRequiredErr: '请输入新密码',
    confirmPasswordRequiredErr: '请确认新密码',
    passwordMismatchErr: '密码不匹配',
    resetSuccessTitle: '密码修改成功！',
    resetSuccessSub: '您的密码已成功重置，请使用新密码登录。',
    backToLogin: '返回登录页面',
    regTitle: '请输入您的个人信息以完成客户注册。',
    name: '名字',
    surname: '姓氏',
    phone: '电话号码',
    carNo: '车牌号码',
    carBrand: '汽车品牌',
    carModel: '汽车型号',
    aiDescription: 'AI commercial pairing stranded vehicles with tow trucks.',
    emergencyNoticeTitle: '服务条款 & 紧急热线',
    emergencyNoticeSub: '如需紧急拖车协助或遇到问题，请拨打热线 1176',
    serviceType: '拖车类型',
    vehicleCategory: '车辆类型',
    confirmBooking: '确认并呼叫技师',
    priceNotice: '* 系统标准统一定价，技师无法额外收费',
    bookingSuccess: '请求已发送！技师正在赶来',
    techDashboard: '技师状态仪表板',
    onlineTechs: '在线',
    offlineTechs: '离线',
    workingTechs: '工作中',
    breakTechs: '休息中',
    requestHelpBtn: '发送求助请求 / 呼叫技师',
    uploadSlip: '上传付款凭证',
    removeSlip: '删除凭证',
    selectLanguage: '选择语言',
    sidebarHome: '首页',
    sidebarRequest: '呼叫拖车',
    sidebarHistory: '服务记录',
    sidebarProfile: '个人资料',
    sidebarPayment: '支付方式',
    sidebarPrivacySecurity: '隐私与安全',
    sidebarSupport: '帮助中心',
    sidebarSettings: '应用设置',
    logout: '退出登录',
    profileServices: '服务次数',
    profilePayments: '支付方式',
    profileSavedCars: '已保存车辆',
    profileEdit: '编辑资料',
    profileSave: '保存',
    profilePersonalInfo: '个人信息',
    profileMainCar: '主要车辆信息',
    profileDefault: '默认',
    profileBrand: '汽车品牌',
    profileModel: '汽车型号',
    profilePlate: '车牌号码',
    profileOtherCars: '我的其他车辆',
    profileNoOtherCars: '暂无其他车辆 — 添加车辆后可更方便地请求服务。',
    profileAddCar: '添加其他车辆',
    profileLanguage: '语言',
    profileSupport: '联系客服',
    profilePrivacy: '隐私政策',
    profileTerms: '服务条款',
    emergencyTitle: '24小时紧急热线',
    emergencySubtitle: 'DTC 紧急拖车援助与协调中心',
    emergencyCall: '立即拨打热线 1176',
    emergencyLocationTitle: '您的紧急位置',
    latitudeLongitude: '纬度 / 经度',
    emergencySearching: '正在获取您的位置...',
    emergencyNotEnabled: '尚未启用 GPS — 点击下方按钮获取当前位置。',
    updateLocation: '更新位置',
    enableGPS: '启用 GPS',
    shareEmergency: '分享紧急位置',
    locationUnsupported: '此设备不支持 GPS 定位。',
    locationPermissionError: '无法访问您的位置。请在浏览器中允许 GPS/位置权限。',
    locationUnavailableError: '当前无法获取位置。请开启 GPS 后重试。',
    locationTimeoutError: '获取位置超时，请重试。',
    pinGpsTitle: '固定 GPS 位置',
    pinNew: '重新定位',
    nearestGarage: '最近的维修中心（自动）',
    liveGPS: '实时 GPS',
    emergencyTermsButton: '阅读紧急服务条款',
    navHome: '首页',
    navRequest: '呼叫拖车',
    navHotline: '热线',
    navHistory: '记录',
    navProfile: '我的',
    issueBreakdown: '车辆故障',
    issueBattery: '电瓶没电',
    issueTire: '轮胎爆胎',
    issueFuel: '燃油耗尽',
    issueOther: '其他',
    describeIssueTitle: '请描述故障 / 遇到的问题',
    reporterInfoTitle: '报案人信息',
    reporterNameLabel: '报案人姓名：',
    reporterPhoneLabel: '电话号码：',
    towTypeSlide: '平板拖车 (Slide Tow)',
    towTypeLift: '吊臂拖车 (Lift Tow)',
    serviceReceiveTitle: '将提供的服务',
    noTowNeededTag: '无需拖车',
    jumpStartService: '搭电服务',
    tireChangeService: '换胎/补胎服务',
    fuelDeliveryService: '送油上门服务',
    noTowDefaultMsg: '技师将在现场直接完成维修，无需拖车',
    techOnBreak: '技师暂时休息中',
    techOffline: '技师离线（信号中断）',
    techEnRoute: '正在赶往您的位置',
    techLoading: '正在将车辆装上拖车',
    techOnSite: '正在现场维修',
    techToGarage: '正在将车送往维修厂',
    techCompleted: '任务已完成',
    techWorking: '技师正在处理中',
    techHeadingToScene: '技师正在赶往事故地点',
    techLoadingEllipsis: '正在将车辆装上拖车...',
    techOnSiteEllipsis: '技师正在现场维修...',
    techToGarageDest: '正在将车送往目的地维修厂',
    techRepairDone: '维修已完成',
    etaWithinLabel: '预计到达时间',
    currentStatusLabel: '当前状态',
    etaApprox: '约 {min} 分钟',
    arrivedLoading: '技师已到达现场，正在将车辆装上拖车',
    arrivedOnSite: '技师已到达现场，正在维修',
    techLabelLift: '吊臂拖车技师',
    techLabelSlide: '平板拖车技师',
    techLabelGeneric: '技师',
    techCountUnit: '人',
    choosePaymentChannel: '选择支付方式',
    promptpayTitle: 'PromptPay / 扫描二维码',
    promptpaySubtitle: '转账后在应用内上传付款凭证',
    creditCardTitle: '信用卡 / 借记卡 (Credit/Debit Card)',
    creditCardSubtitle: '自动从已保存的卡片扣款',
    cashTitle: '现金 (Cash Payment)',
    cashSubtitle: '直接向技师现场付款',
    creditCardShort: '信用卡 /',
    debitCardShort: '借记卡',
    cashShort: '现金',
    savedCardsTitle: '已保存的卡片',
    addNewCard: '添加新卡',
    primaryBadge: '默认',
    paymentSecurityTitle: '支付安全',
    paymentSecurityDesc: '所有支付信息均采用国际安全标准加密（SSL加密），100%安全',
    qrCompanyAlt: '公司PromptPay二维码',
    qrCompanyCaption: 'DTC Service 公司 PromptPay 二维码',
    qrScanInstructions: '扫描上方二维码付款，然后在下方上传付款凭证以确认',
    supportedFileTypes: '支持 JPG、PNG 格式文件',
    etvPriceHeading: 'ETV标准价格',
    totalServicePrice: '服务总费用：',
    gpsRequiredWarning: '请先在上方标记事故地点GPS位置，才能呼叫技师',
    slipRequiredWarning: '请先在"支付方式"标签页上传付款凭证，才能呼叫技师',
    serviceHistoryHeading: '服务历史记录',
    totalItemsPrefix: '共',
    totalItemsSuffix: '项',
    historyDateLabel: '日期：',
    historyCarTypeLabel: '车辆类型：',
    historyLocationLabel: '地点：',
    historyTechLabel: '负责技师：',
    netPaidLabel: '实付金额',
    reportIssueBtn: '举报问题',
    historyStatusCompleted: '已完成',
    historyStatusInProgress: '进行中',
    findingNearestTech: '正在为您寻找最近的技师...',
    waitingTechAccept: '等待技师接单，接单后地图将自动打开',
    cancellingEllipsis: '正在取消...',
    cancelRequestBtn: '取消呼叫',
    activeStatusBadge: '进行中 (Active)',
    viewLiveTrackingMap: '查看实时追踪地图',
    mechanicLabelShort: '技师：',
    waitingGarageSearch: '等待GPS定位以搜索附近维修厂',
    searchingNearbyTechs: '正在搜索您附近的可用技师...',
    nearbyTechsFound: '附近有 {count} 位技师可用，最近约 {distance} 公里',
    noNearbyTechsFallback: '目前附近暂无可用技师，但发出请求后系统仍会持续为您寻找',
    noTowRepairNote: '技师将在现场完成维修，无需拖车到维修厂',
    approxLocationSuffix: '（大概位置）',
    serviceFeeLabel: '服务费',
    paymentMethodLabel: '支付方式',
    statusLabel: '状态',
    paymentMethodTransfer: 'PromptPay / 转账',
    techConfirmedPayment: '技师已确认收款',
    waitingTechVerify: '等待技师确认',
    viewEnlargedImage: '查看大图',
    creditAutoChargeNote: '系统将自动从已保存的卡片扣款，无需上传凭证',
    cashPayDirectNote: '直接向技师现场付款，无需上传凭证',
    promptpayAfterAcceptNote: '技师接单后，您可以在追踪页面扫描二维码并上传付款凭证',
    sendSlipBtn: '发送凭证',
    kmUnit: '公里',
    jobsUnit: '单',
    cardDetailsRequiredErr: '请填写完整的卡片信息',
    carDetailsRequiredErr: '请填写完整的车辆信息',
    approxLocationSetToast: '已使用大概位置，请尽量重新标记准确的事故地点',
    slipUploadedToast: '付款凭证已发送，等待技师确认',
    slipUploadFailedToast: '上传凭证失败，请在历史记录页面重新上传',
    setPasswordErr: '请设置密码',
    passwordInvalidErr: '密码不符合要求',
    regConfirmPasswordRequiredErr: '请确认密码',
    serverConnectFailedToast: '连接服务器失败，请检查网络连接后重试',
    serverConnectFailedErr: '连接服务器失败，请重试',
    emailAlreadyUsedErr: '该邮箱已被注册',
    signupFailedErr: '注册失败，请重试',
    loginInvalidErr: '邮箱或密码不正确，或尚未注册',
    lineOpenFailedToast: '无法打开LINE登录页面，请重试',
    loginSuccessWelcome: '登录成功，欢迎',
    lineLoginFailedToast: 'LINE登录失败，请重试',
    surnameRequiredErr: '请输入姓氏',
    phoneRequiredErr: '请输入电话号码',
    emailRequiredLineErr: '请输入邮箱（LINE未提供邮箱信息）',
    lineSignupSuccessWelcome: 'LINE注册成功，欢迎',
    saveFailedTryAgainErr: '保存失败，请重试',
    passwordMinLengthErr: '密码长度至少需要6个字符',
    jobCreateFailedToast: '请求失败：系统未能创建工单（create_job_priced未返回工单信息），请重试或联系客服',
    submitFailedPrefix: '提交失败：',
    reportIssuePrompt: '请简要描述此工单遇到的问题（例如：技师严重迟到、行为不当）：',
    reportSentToast: '问题报告已发送，团队将进行审核',
    reportFailedToast: '报告发送失败（该工单可能是系统中已不存在的旧数据）',
    slipReattachedToast: '新凭证已上传，等待技师再次确认',
    slipReattachFailedToast: '重新上传凭证失败，请重试',
    techAcceptedNotif: '已接单，正在赶来为您服务',
    techArrivedToast: '技师已到达事故地点',
    techLoadingCarToast: '技师正在将车辆装上拖车',
    carLoadedHeadingToGarageToast: '装车完成，正在将车送往目的地维修厂',
    cancelJobSuccessToast: '呼叫已成功取消',
    cancelJobFailedToast: '取消失败，可能刚好有技师接单，请刷新页面重试',
    tapToChoosePlateSubtitle: '点击选择服务类型并发送您的位置',
    updateBtn: '更新',
    locationNotFoundTap: '未找到您的位置 — 点击重试',
    useApproxLocationInstead: '改用大概位置',
    backToListBtn: '返回列表',
    slipRejectedByTech: '技师报告凭证有误',
    reviewSlipAndReattach: '请再次核对转账金额，并在下方重新上传凭证',
    reattachSlipBtn: '重新上传凭证',
    sendingSlipEllipsis: '正在发送凭证...',
    resendSlipBtn: '重新发送凭证',
    towingPlateLabel: '拖车车牌号',
    techPhoneLabel: '技师电话号码',
    callTechBtn: '致电技师',
    chatBtn: '聊天',
    onlinePlateStatus: '在线 • 车牌',
    chatInputPlaceholder: '输入消息...',
    addNewCardTitle: '添加新的信用卡 / 借记卡',
    nameOnCard: '卡片持有人姓名',
    cardNumberLabel: '卡号（16位）',
    expiryLabel: '有效期（MM/YY）',
    cvcLabel: 'CVC / CVV 安全码',
    saveCardBtn: '保存卡片',
    jobCompletedTitle: '服务已完成！',
    jobCompletedSub: '技师已到达目的地维修厂，请为本次服务评分',
    serviceFeeSummaryLabel: '费用汇总',
    ratingLabels: '很差,不满意,一般,好,非常好！',
    reviewFeedbackPlaceholder: '写下对技师的建议或称赞（选填）...',
    submitReviewBtn: '提交评价并结束工单',
    sendingToNearestTechLoading: '系统正在为您寻找最近的拖车技师...',
    termsLine1: '1. DTC智能拖车服务的拖车及道路救援服务条款',
    termsLine2: '2. 用户须如实提供事故地点及车辆品牌/型号等详细信息',
    termsLine3: '3. 服务费用按ETV标准价格计算，技师不得收取超出规定的费用',
    termsLine4: '4. 技师出发后取消请求可能会根据条款收取相应费用',
    privacyLine1: '1. 我们重视您的隐私及个人数据保护（符合PDPA规定）',
    privacyLine2: '2. 您的GPS位置及电话号码仅用于匹配及派遣技师为您提供协助',
    privacyLine3: '3. 卡片及付款记录信息将以SSL加密等安全标准存储，不会向第三方披露',
    notificationsTitle: '通知',
    markAllReadBtn: '全部标记为已读',
    noNotificationsYet: '暂无通知',
    appSettingsTitle: '应用设置',
    notificationsSectionLabel: '通知',
    notificationSoundLabel: '通知提示音',
    vibrationLabel: '震动提醒',
    displaySectionLabel: '显示',
    darkModeLabel: '深色模式（Dark Mode）',
    manageMyAccount: '管理我的账户',
    deleteAccountRequestToast: '账户删除请求已发送，团队将在3个工作日内与您联系',
    deleteAccountBtn: '删除账户',
    helpCenterTitle: '帮助中心 / 常见问题',
    emergencyHotlineBtn: '拨打紧急热线 1176',
    faqQ1: '呼叫拖车后，技师多久能到达？',
    faqA1: '平均而言，技师会在15-30分钟内到达，具体取决于距离和路况',
    faqQ2: '服务费用如何计算？',
    faqA2: '系统根据ETV标准价格，综合考虑服务车型和距离计算费用，技师不得收取超出系统显示的费用',
    faqQ3: '可以取消请求吗？',
    faqA3: '在技师出发前可以取消。技师出发后取消可能会根据服务条款收取相应费用',
    faqQ4: '支持哪些支付方式？',
    faqA4: '支持PromptPay（上传凭证）、信用卡/借记卡，以及直接向技师支付现金',
    carBrandLabel: '车辆品牌',
    carModelLabel: '车辆型号',
    plateNumberLabel: '车牌号',
    platePlaceholder: '例：กข 1234 曼谷',
    saveCarBtn: '保存此车辆',
    callingTechTitle: '正在致电技师',
    openPhoneAppBtn: '打开电话应用拨打',
    cancelBtn: '取消',
    incomingCallFromTech: '技师来电',
    declineBtn: '拒接',
    answerBtn: '接听',
    almostDoneTitle: '快完成了！',
    fillRemainingInfo: '请填写剩余信息后即可开始使用',
    firstNameLabel: '名字',
    firstNamePlaceholder: '名字',
    lastNamePlaceholder: '姓氏',
    phoneNumberLabel: '电话号码',
    emailLabel: '邮箱',
    savingEllipsis: '正在保存...',
    getStartedBtn: '开始使用',
    thankYouForReviewTitle: '感谢您的评分！',
    thankYouForReviewMsg: '感谢您的评分与使用，您的意见将帮助我们不断改进服务',
    closeWindowBtn: '关闭窗口',
    loadingMapEllipsis: '正在加载地图...',
    offlineBannerText: '网络连接已断开 — 数据可能无法更新，直至网络恢复',
    signingInEllipsis: '登录中...',
    openingLinePageEllipsis: '正在打开LINE页面...',
    signingUpEllipsis: '注册中...',
    newPasswordPlaceholder: '请输入新密码',
    confirmNewPasswordPlaceholder: '请再次输入新密码',
    selectServiceTypePrefix: '选择拖车服务类型',
    yourVehicleTypePrefix: '您的车辆类型',
    carCategorySedanOption: '轿车 (Sedan / Hatchback)',
    carCategoryEvOption: '电动车 (EV / Hybrid)',
    carCategoryPickupOption: '皮卡车 (Pickup Truck)',
    carCategorySuvOption: 'SUV / 厢式车 (Van)'
  },
};

const FlagTH = () => (
  <svg className="w-4 h-3 rounded-xs shadow-xs object-cover" viewBox="0 0 640 480">
    <path fill="#f4f5f8" d="M0 0h640v480H0z"/>
    <path fill="#2d2a4a" d="M0 160h640v160H0z"/>
    <path fill="#a51931" d="M0 0h640v80H0zm0 400h640v80H0z"/>
  </svg>
);

const FlagGB = () => (
  <svg className="w-4 h-3 rounded-xs shadow-xs object-cover" viewBox="0 0 640 480">
    <path fill="#012169" d="M0 0h640v480H0z"/>
    <path fill="#FFF" d="m75 0 245 180L565 0h75v55L400 240l240 185v55h-75L320 300 75 480H0v-55l240-185L0 55V0h75z"/>
    <path fill="#C8102E" d="m424 281 216 159v40l-216-159zm-208 0L0 440v40l216-159zM0 0l216 159v-40L0 0zm424 0 216 159v-40L424 0z"/>
    <path fill="#FFF" d="M240 0v480h160V0H240zM0 160v160h640V160H0z"/>
    <path fill="#C8102E" d="M272 0v480h96V0h-96zM0 192v96h640v-96H0z"/>
  </svg>
);

const FlagCN = () => (
  <svg className="w-4 h-3 rounded-xs shadow-xs object-cover" viewBox="0 0 640 480">
    <path fill="#ee1c25" d="M0 0h640v480H0z"/>
    <path fill="#ffff00" d="M120 160l-37.6 27.3 14.4-44.2-37.7-27.4h46.6L120 71.5l14.4 44.2h46.6l-37.7 27.4 14.4 44.2zm60-96l10 13.7-16.7 3.3 14.8 8.3-6.5 15.6 13.7-10 13.7 10-6.5-15.6 14.8-8.3-16.7-3.3zm36 48l4.4 16.4-15.3-7.2 9.6 13.9-12.7 11.2 16.4-4.4 4.4 16.4 4.4-16.4 16.4 4.4-12.7-11.2 9.6-13.9-15.3 7.2zm0 60l-12.7-11.2 9.6-13.9-15.3 7.2 4.4-16.4-16.4 4.4 4.4 16.4-15.3-7.2 9.6 13.9-12.7 11.2 16.4-4.4zm-36 48l-16.7-3.3 14.8-8.3-6.5-15.6 13.7 10 13.7-10-6.5 15.6 14.8 8.3-16.7 3.3 10 13.7z"/>
  </svg>
);

// ย้าย bannerImages ออกมาเป็นค่าคงที่นอก component เพื่อให้ reference คงที่ทุก render
// (เดิมประกาศไว้ข้างในฟังก์ชัน ทำให้ array ถูกสร้างใหม่ทุกครั้งที่ re-render และไปรีเซ็ต
// ตัวจับเวลาเลื่อนแบนเนอร์อัตโนมัติซ้ำๆ จนไม่มีทางเลื่อนเองได้สักที)
const bannerImages = ['/b1.png', '/b2.png', '/b3.png'];

export default function App() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  // ติดตามสถานะการชำระเงินของงานปัจจุบันแบบเรียลไทม์ — เดิมฝั่งลูกค้า insert ครั้งเดียวจบ
  // ไม่เคยดึงกลับมาดูอีกเลย ทำให้ไม่รู้เลยว่าช่างปฏิเสธสลิปไปหรือยัง
  const [myPayment, setMyPayment] = useState<{
    id: string;
    slip_url: string | null;
    amount: number | null;
    payment_method: 'transfer' | 'cash' | 'credit';
    status: 'pending' | 'verified' | 'rejected';
  } | null>(null);
  const [reslipFile, setReslipFile] = useState<File | null>(null);
  const [isReuploadingSlip, setIsReuploadingSlip] = useState(false);
  const reslipFileInputRef = useRef<HTMLInputElement | null>(null);
  // input แนบสลิปใหม่ "ในหน้าแชท" แยก ref ต่างหากจากตัวบนหน้ารายละเอียดงาน (reslipFileInputRef)
  // เพราะทั้งสอง banner mount พร้อมกันได้จริง (chat modal เป็น overlay ลอยทับ ไม่ผูกกับ activeTab)
  // ถ้าใช้ ref เดียวกันจะมีแค่ input ตัวที่ mount หลังสุดเท่านั้นที่ทำงาน — แชร์กันแค่ state (reslipFile) พอ
  const reslipChatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<number>(1);
  const [time, setTime] = useState<string>('');
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [isWifiOnline, setIsWifiOnline] = useState<boolean>(true);
  const [lang, setLang] = useState<Language>('TH');
  const [showLangDropdown, setShowLangDropdown] = useState<boolean>(false);
  const [showSidebarLangDropdown, setShowSidebarLangDropdown] = useState<boolean>(false);
  
  // State ควบคุม Sidebar Menu
  const [showSidebar, setShowSidebar] = useState<boolean>(false);

  const [authTab, setAuthTab] = useState<'login' | 'newAccount'>('login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  // รหัสผ่านตอนสมัครสมาชิก (แยกออกจาก registerForm เพื่อไม่ให้รหัสผ่านหลุดไปปนกับ
  // ข้อมูลที่ใช้แสดงผล/ส่งไป Supabase เช่นตอนสร้างงาน)
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  // ---- สมัครสมาชิกลูกค้า: เช็คเงื่อนไขรหัสผ่านแบบเรียลไทม์ (checklist แบบเดียวกับฝั่งช่าง) ----
  const regPasswordChecks = useMemo(
    () => ({
      length: regPassword.length >= 8,
      uppercase: /[A-Z]/.test(regPassword),
      numberSpecial: /[0-9]/.test(regPassword) && /[^A-Za-z0-9]/.test(regPassword),
    }),
    [regPassword]
  );
  const [regPasswordErr, setRegPasswordErr] = useState<string>('');
  const [regConfirmPasswordErr, setRegConfirmPasswordErr] = useState<string>('');
  const [regEmailErrMsg, setRegEmailErrMsg] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState<boolean>(false);
  
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'home' | 'request' | 'emergency' | 'activity' | 'profile' | 'payment'>('home');

  // State หน้า Live Chat
  // (เดิมมีข้อความทักทายมอคอัพฝังตายตัวอยู่ตรงนี้ ตอนนี้ข้อความทักทายจริงจะถูกส่งเข้ามาอัตโนมัติ
  // จากฝั่งช่างทันทีที่กดรับงาน แล้วโหลดเข้ามาจริงผ่าน fetchMessages/Realtime ด้านล่าง จึงเริ่มจาก array ว่าง)
  const [activeChatTech, setActiveChatTech] = useState<Technician | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'tech'; text: string }>>([]);
  const [inputMsg, setInputMsg] = useState('');

  // State การแนบและลบสลิปโอนเงิน
  const [slipImage, setSlipImage] = useState<string | null>(null); // base64 ไว้พรีวิวในแอปเท่านั้น
  const [slipFile, setSlipFile] = useState<File | null>(null); // ไฟล์จริงที่จะอัปโหลดขึ้น Supabase Storage
  const [isUploadingSlip, setIsUploadingSlip] = useState<boolean>(false);
  const slipFileInputRef = useRef<HTMLInputElement | null>(null);

  // State สำหรับการจัดการวิธีการชำระเงิน (Payment Methods)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'promptpay' | 'credit' | 'cash'>('promptpay');
  const [savedCards, setSavedCards] = useState([
    { id: 'c1', bank: 'Kasikornbank', last4: '4321', cardType: 'Visa', isDefault: true },
    { id: 'c2', bank: 'SCB', last4: '8890', cardType: 'Mastercard', isDefault: false }
  ]);
  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);
  const [newCardNumber, setNewCardNumber] = useState<string>('');
  const [newCardExp, setNewCardExp] = useState<string>('');
  const [newCardCvc, setNewCardCvc] = useState<string>('');
  const [newCardName, setNewCardName] = useState<string>('');

  const [showTrackingDetail, setShowTrackingDetail] = useState<boolean>(false);
  const [truckProgress, setTruckProgress] = useState<number>(0);
  const [trackingPhase, setTrackingPhase] = useState<'moving_to_red' | 'loading' | 'on_site' | 'moving_to_green' | 'completed'>('moving_to_red');
  const [hasActiveBooking, setHasActiveBooking] = useState<boolean>(false);
  // true ตั้งแต่ช่างกดรับงานจริงจากฝั่ง t3 (ผ่าน Supabase realtime) เท่านั้น — ก่อนหน้านี้ต้องรอ ห้ามเด้งไปหน้าแมพ
  const [techAccepted, setTechAccepted] = useState<boolean>(false);
  // ข้อมูลช่างที่ระบบจับคู่ให้จริง (อัปเดตจาก payload ตอนช่างกดรับงาน) เริ่มต้นเป็น mock ไว้ก่อน
  const [assignedTech, setAssignedTech] = useState<Technician>(mockAssignedTech);
  // พิกัด GPS จริงล่าสุดของช่างที่ได้รับมอบหมาย ดึงจากตาราง technicians (คอลัมน์ current_lat/current_lng)
  // แทนตำแหน่งจำลองแบบ hardcode เดิม — เป็น null จนกว่าช่างจะเริ่มส่งพิกัดจริงเข้ามาครั้งแรก
  const [techLiveCoords, setTechLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  // ระยะเวลาโดยประมาณ (นาที) ที่ช่างจะถึงจุดเกิดเหตุ ณ ตอนกดเรียกช่าง — ใช้คำนวณเวลานับถอยหลัง
  const [etaTotalMinutes, setEtaTotalMinutes] = useState<number>(15);

  // State ประวัติการใช้บริการ (History)
  const [serviceHistory, setServiceHistory] = useState<Array<{
    id: string;
    date: string;
    time: string;
    towType: string;
    carCategory: string;
    location: string;
    price: number;
    techName: string;
    status: 'เสร็จสิ้น' | 'กำลังดำเนินการ';
  }>>([
    {
      id: 'JOB-20260210',
      date: '10 ก.พ. 2569',
      time: '14:30 น.',
      towType: 'รถสไลด์ (Slide Tow)',
      carCategory: 'รถเก๋ง / Sedan',
      location: 'ถนนสุขุมวิท ซอย 21',
      price: 1500,
      techName: 'ช่างสมศักดิ์ บริการดี',
      status: 'เสร็จสิ้น'
    }
  ]);
  
  // State สำหรับหน้ารีวิวและให้คะแนนช่าง
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittedRating, setSubmittedRating] = useState<number>(5);

  // State สำหรับหน้าโปรไฟล์ (Edit mode + Language dropdown ในหน้าโปรไฟล์)
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [showProfileLangDropdown, setShowProfileLangDropdown] = useState<boolean>(false);

  // State ระบบแจ้งเตือน (Notifications)
  const [notifications, setNotifications] = useState<Array<{
    id: string; title: string; message: string; time: string; read: boolean; type: 'info' | 'success' | 'warning';
  }>>([
    { id: 'n1', title: 'ยินดีต้อนรับสู่ DTC Service', message: 'เริ่มต้นใช้งานระบบเรียกรถสไลด์อัจฉริยะได้แล้ววันนี้', time: '2 ชม.ที่แล้ว', read: false, type: 'info' },
    { id: 'n2', title: 'โปรโมชั่นพิเศษ', message: 'ลดค่าบริการ 10% สำหรับการเรียกรถครั้งแรกของคุณ', time: '1 วันที่แล้ว', read: false, type: 'success' },
    { id: 'n3', title: 'แจ้งเตือนระบบ', message: 'กรุณาตรวจสอบข้อมูลบัตรเครดิต/เดบิตของคุณให้เป็นปัจจุบัน', time: '3 วันที่แล้ว', read: true, type: 'warning' },
  ]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState<boolean>(false);

  // State ตำแหน่งฉุกเฉินแบบเรียลไทม์ (Live GPS สำหรับปุ่ม SOS)
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string>('');

  // State หน้าตั้งค่าแอปพลิเคชัน (Settings)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState<boolean>(true);
  const [notifVibrateEnabled, setNotifVibrateEnabled] = useState<boolean>(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState<boolean>(false);

  // State ศูนย์ช่วยเหลือ / คำถามที่พบบ่อย (FAQ)
  const [showFaqModal, setShowFaqModal] = useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // State บันทึกรถได้หลายคัน (Multi-car) — รถคันแรกคือรถหลักใน registerForm อยู่แล้ว
  // savedCars เก็บ "รถคันเพิ่มเติม" ที่ผู้ใช้บันทึกเสริมจากรถหลัก
  const [savedCars, setSavedCars] = useState<Array<{ id: string; brand: string; model: string; plate: string }>>([]);
  const [showAddCarModal, setShowAddCarModal] = useState<boolean>(false);
  const [newCarBrand, setNewCarBrand] = useState<string>('');
  const [newCarModel, setNewCarModel] = useState<string>('');
  const [newCarPlate, setNewCarPlate] = useState<string>('');

  // State ป๊อปอัพ "กำลังโทรออก" ที่แสดงอยู่ในกรอบมือถือ (แทนการเด้ง tel: ออกนอกจอทันที)
  const [showCallingModal, setShowCallingModal] = useState<boolean>(false);
  const [callingTechName, setCallingTechName] = useState<string>('');
  const [callingTechPhone, setCallingTechPhone] = useState<string>('');

  // State สายเรียกเข้าจากช่าง — เด้งขึ้นแบบเรียลไทม์เมื่อช่างกดโทรหาลูกค้า (เชื่อมกันผ่าน Supabase Broadcast)
  const [showIncomingCallModal, setShowIncomingCallModal] = useState<boolean>(false);
  const [incomingCallInfo, setIncomingCallInfo] = useState<{ name: string; phone: string } | null>(null);
  const callChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Stateจุดแดงแจ้งเตือนข้อความแชตที่ยังไม่ได้อ่าน — ติดเมื่อช่างส่งข้อความเข้ามาขณะที่หน้าต่างแชตปิดอยู่
  const [hasUnreadChat, setHasUnreadChat] = useState<boolean>(false);
  const isChatOpenRef = useRef(false);
  useEffect(() => {
    isChatOpenRef.current = !!activeChatTech;
  }, [activeChatTech]);

  // State ข้อความแจ้งเตือนในแอป (แทน alert() ของเบราว์เซอร์ที่หลุดออกนอกกรอบมือถือ)
  const [appToast, setAppToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // สถานะเน็ตของเครื่อง — แอปนี้พึ่ง Supabase Realtime หนักมาก (แผนที่, สถานะช่าง, แชท) ถ้าเน็ต
  // หลุดกลางทางเดิมไม่มีอะไรบอกลูกค้าเลยว่าทำไมหน้าจอไม่ขยับ เพิ่มแถบเตือนง่ายๆ จาก
  // navigator.onLine + online/offline event ให้อย่างน้อยรู้ว่าเน็ตหลุดจริง ไม่ใช่แอปค้าง
  const [isOnline, setIsOnline] = useState<boolean>(true);
  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // State ป๊อปอัพขอบคุณหลังส่งรีวิวสำเร็จ (แสดงในกรอบมือถือ แทน alert())
  const [showReviewThanksModal, setShowReviewThanksModal] = useState<boolean>(false);

  const [currentBannerIndex, setCurrentBannerIndex] = useState<number>(0);
  const [expandedBannerUrl, setExpandedBannerUrl] = useState<string | null>(null);

  // เดิมเป็นเลขปลอมคงที่ (useState({ online: 18, ... }) ไม่เคยมี setter เรียกเลย ค้างตัวเลข
  // เดิมตลอดชีวิตแอป) เปลี่ยนมาดึงของจริงผ่าน getTechStatusCounts() (RPC get_tech_status_counts)
  // ตอนโหลดหน้าแรก แล้วฟัง subscribeTechStatusCounts() เพื่อ refetch ใหม่ทุกครั้งที่มีช่างคนไหน
  // เปลี่ยนสถานะ (ไม่ push ตัวเลขตรงๆ มาเพราะ payload realtime มีแค่ 1 แถวที่เปลี่ยน ให้ DB
  // นับผลรวมใหม่ทั้งหมดให้แม่นกว่า)
  const [techStats, setTechStats] = useState({
    online: 0,
    working: 0,
    breakTime: 0,
    offline: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const refetchTechStats = () => {
      getTechStatusCounts()
        .then((counts) => {
          if (!cancelled) setTechStats(counts);
        })
        .catch((err) => console.error('Error fetching tech status counts:', err));
    };
    refetchTechStats();
    const unsubscribe = subscribeTechStatusCounts(refetchTechStats);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const [registerForm, setRegisterForm] = useState({
    name: '',
    surname: '',
    phoneNumber: '',
    email: '',
    nationalType: 'National',
    carNumber: '',
    carBrand: '',
    carModel: '',
    allowLocation: 'Yes'
  });

  const [towingRequest, setTowingRequest] = useState({
    selectedIssue: 'รถเสีย',
    towType: 'รถสไลด์ (Slide Tow)',
    carCategory: 'รถเก๋ง / Sedan',
    gpsLocation: '',
    nearestGarage: '',
    nearestGarageLat: null as number | null,
    nearestGarageLng: null as number | null,
    distanceKm: 0,
    calculatedEtvPrice: 1500
  });

  const [isBookingSuccess, setIsBookingSuccess] = useState<boolean>(false);

  // Error States
  const [regNameErr, setRegNameErr] = useState<boolean>(false);
  const [regSurnameErr, setRegSurnameErr] = useState<boolean>(false);
  const [regPhoneErr, setRegPhoneErr] = useState<boolean>(false);
  const [regEmailErr, setRegEmailErr] = useState<boolean>(false);
  const [regCarNoErr, setRegCarNoErr] = useState<boolean>(false);

  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // โปรไฟล์ลูกค้าจริงจาก Supabase Auth + ตาราง customers (แทนที่บัญชีปลอมใน localStorage
  // เดิม) — ตั้งค่าตอนสมัคร/ล็อกอินสำเร็จ ใช้ยืนยันว่ามี session จริงอยู่ไหม
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // ---- LINE Login (OAuth ผ่าน Supabase custom:line) ----
  // isLineAuthLoading: true ตั้งแต่กดปุ่ม LINE จนกว่าเบราว์เซอร์ระบบจะเปิดขึ้น/ปิดลง
  // showLineCompleteProfile: true เมื่อ LINE OAuth สำเร็จแต่ยังไม่เคยมีแถวใน customers
  //   (ผู้ใช้ LINE ใหม่ครั้งแรก) ต้องกรอกนามสกุล/เบอร์โทร (และอีเมลถ้า LINE ไม่ได้ให้มา)
  //   ก่อนถึงจะสร้างโปรไฟล์จริงได้ เพราะ ID token ของ LINE ไม่มีเบอร์โทร
  const [isLineAuthLoading, setIsLineAuthLoading] = useState(false);
  const [showLineCompleteProfile, setShowLineCompleteProfile] = useState(false);
  const [lineOAuthUserId, setLineOAuthUserId] = useState<string>('');
  const [lineCompleteForm, setLineCompleteForm] = useState({ name: '', surname: '', phone: '', email: '' });
  const [lineCompleteErr, setLineCompleteErr] = useState<{ surname?: string; phone?: string; email?: string }>({});
  const [lineCompleteSubmitting, setLineCompleteSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');

  const [resetContact, setResetContact] = useState<string>('');
  const [contactError, setContactError] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('528491');
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [showOtpNotification, setShowOtpNotification] = useState<boolean>(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [newPasswordVal, setNewPasswordVal] = useState<string>('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState<string>('');
  const [newPasswordErr, setNewPasswordErr] = useState<string>('');
  const [confirmPasswordErr, setConfirmPasswordErr] = useState<string>('');
  const [showResetSuccessModal, setShowResetSuccessModal] = useState<boolean>(false);

  const t = translations[lang];

  // แปลง locale ของแอป (Language) เป็น BCP-47 locale tag สำหรับ Intl API
  // - TH / EN → เลขอาราบิก (0-9) ปกติ (th-TH ใน browser ใช้เลขอาราบิกเป็นค่าเริ่มต้นอยู่แล้ว
  //   ไม่ใช่เลขไทย ๑๒๓ ดังนั้นไม่ต้องกำหนด numbering system เพิ่ม)
  // - CN → ใช้ตัวเลขจีน (〇一二三四五六七八九) ผ่าน Unicode extension -u-nu-hanidec
  const localeMap: Record<Language, string> = {
    TH: 'th-TH',
    EN: 'en-US',
    CN: 'zh-Hans-CN',
  };

  // ใช้แปลงตัวเลข (ราคา, จำนวน ฯลฯ) ให้ตรงกับภาษาที่เลือกอยู่ตอนนี้ (lang) แทนการเรียก
  // .toLocaleString() เปล่าๆ ซึ่งจะใช้ locale ของเบราว์เซอร์/อุปกรณ์แทน ไม่ใช่ภาษาที่เลือกในแอป
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    const localeTag = lang === 'CN' ? `${localeMap.CN}-u-nu-hanidec` : localeMap[lang];
    return new Intl.NumberFormat(localeTag, options).format(value);
  };

  // ใช้แปลงวันที่ให้ตรงกับภาษาที่เลือก แทนการ hardcode 'th-TH' แบบเดิม
  const formatDate = (date: Date, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    const localeTag = lang === 'CN' ? `${localeMap.CN}-u-nu-hanidec` : localeMap[lang];
    return date.toLocaleDateString(localeTag, options);
  };

  // เปลี่ยนภาษาแบบรวมศูนย์ + จำค่าภาษาไว้ในเครื่อง
  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    setShowLangDropdown(false);
    setShowSidebarLangDropdown(false);
    setShowProfileLangDropdown(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dtc-language', newLang);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedLang = localStorage.getItem('dtc-language') as Language | null;
    if (savedLang === 'TH' || savedLang === 'EN' || savedLang === 'CN') {
      setLang(savedLang);
    }
  }, []);

  // ฟังก์ชันเพิ่มบัตรใหม่
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardNumber || !newCardExp || !newCardCvc) {
      setAppToast({ message: t.cardDetailsRequiredErr, type: 'error' });
      return;
    }
    const last4 = newCardNumber.slice(-4) || '9999';
    setSavedCards(prev => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        bank: 'ธนาคารผู้ให้ออกบัตร',
        last4: last4,
        cardType: 'Visa/Mastercard',
        isDefault: false
      }
    ]);
    setNewCardNumber('');
    setNewCardExp('');
    setNewCardCvc('');
    setNewCardName('');
    setShowAddCardModal(false);
  };

  // ขอพิกัด GPS จริงแบบ Promise เพื่อให้ "ตรึง GPS" และ "แชร์พิกัด"
  // ใช้พิกัดเดียวกัน และแก้ปัญหาการกดแชร์ครั้งแรกแล้วไม่แชร์
  const requestCurrentLocation = async (): Promise<{ lat: number; lng: number }> => {
    // ใช้ปลั๊กอิน @capacitor/geolocation แทน navigator.geolocation ตรงๆ เพราะตอนรันเป็น
    // native app ผ่าน Capacitor เบราว์เซอร์ WebView ไม่สามารถขอสิทธิ์ ACCESS_FINE_LOCATION
    // ของ Android เองได้ — ปลั๊กอินนี้จัดการขอสิทธิ์ + เพิ่ม permission ใน
    // AndroidManifest.xml ให้อัตโนมัติตอน `npx cap sync android` (โค้ดยังใช้ได้ปกติ
    // ตอนรันในเบราว์เซอร์ธรรมดาเหมือนเดิม ปลั๊กอินสลับ implementation ให้เอง)
    try {
      await Geolocation.requestPermissions();
    } catch {
      // บางแพลตฟอร์ม (เช่นเบราว์เซอร์เดสก์ท็อป) ไม่มี requestPermissions แยกให้เรียก — ข้ามได้
    }

    const toCoords = (position: { coords: { latitude: number; longitude: number } }) => ({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    });

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      return toCoords(position);
    } catch (error: any) {
      // มือถือหลายรุ่นเปิด high accuracy แล้ว timeout/หาไม่เจอบ่อยมาก
      // ถ้าไม่ใช่เพราะผู้ใช้ปฏิเสธสิทธิ์ (code 1) ให้ลองใหม่แบบความแม่นยำต่ำก่อน ค่อยแจ้ง error จริง
      if (error?.code !== 1) {
        const fallbackPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        });
        return toCoords(fallbackPosition);
      }
      throw error;
    }
  };

  const formatGpsLocation = (lat: number, lng: number) => {
    const latText = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
    const lngText = `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`;
    return `${latText}, ${lngText}`;
  };

  // ค้นหาอู่หลังจากได้พิกัดจุดเกิดเหตุแล้วเท่านั้น
  const findNearestGarage = (coords: { lat: number; lng: number }) => {
    const garages = [
      { name: 'ศูนย์บริการ DTC และอู่มาตรฐานบางนา', lat: 13.6688, lng: 100.6341 },
      { name: 'DTC Service พระราม 9', lat: 13.7589, lng: 100.5742 },
      { name: 'อู่มาตรฐานลาดพร้าว', lat: 13.8072, lng: 100.6042 },
    ];
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const distanceBetween = (garage: typeof garages[number]) => {
      const earthRadiusKm = 6371;
      const deltaLat = toRadians(garage.lat - coords.lat);
      const deltaLng = toRadians(garage.lng - coords.lng);
      const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(toRadians(coords.lat)) *
          Math.cos(toRadians(garage.lat)) *
          Math.sin(deltaLng / 2) ** 2;
      return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const nearest = garages.reduce((best, garage) =>
      distanceBetween(garage) < distanceBetween(best) ? garage : best
    );
    const distanceKm = Number(distanceBetween(nearest).toFixed(1));
    return {
      label: `${nearest.name} (${distanceKm.toFixed(1)} ${t.kmUnit})`,
      distanceKm,
      lat: nearest.lat,
      lng: nearest.lng,
    };
  };

  // ค่า distanceKm ตอนแรกมาจาก Haversine (เส้นตรง) ใน findNearestGarage ซึ่งใช้เลือกอู่
  // ที่ใกล้สุดได้พอ แต่ไม่แม่นพอจะเอาไปคิดราคา — ฟังก์ชันนี้เรียก compute-route (OSRM) เพื่อ
  // เอาระยะทางถนนจริงจากจุดเกิดเหตุไปอู่มาแทนที่ ทำงานแบบ fire-and-forget หลัง UI แสดงค่า
  // ประมาณไปก่อนแล้ว (ไม่บล็อกผู้ใช้รอ) ถ้า compute-route ล่ม/เน็ตหลุด ค่า Haversine เดิม
  // จะยังอยู่เป็น fallback ต่อไป ไม่มีอะไรพัง
  const refineDistanceWithRealRoute = async (
    pickup: { lat: number; lng: number },
    garage: { lat: number; lng: number }
  ) => {
    const route = await computeRoute(pickup, garage);
    if (!route) return;
    setTowingRequest(prev => ({ ...prev, distanceKm: Number(route.distanceKm.toFixed(1)) }));
  };

  const handleFetchLiveLocation = async (): Promise<boolean> => {
    setIsFetchingLocation(true);
    setLocationError('');

    try {
      const coords = await requestCurrentLocation();

      const nearestGarage = findNearestGarage(coords);
      setLiveCoords(coords);
      setTowingRequest(prev => ({
        ...prev,
        gpsLocation: formatGpsLocation(coords.lat, coords.lng),
        nearestGarage: nearestGarage.label,
        nearestGarageLat: nearestGarage.lat,
        nearestGarageLng: nearestGarage.lng,
        distanceKm: nearestGarage.distanceKm
      }));
      refineDistanceWithRealRoute(coords, { lat: nearestGarage.lat, lng: nearestGarage.lng });
      return true;
    } catch (error: any) {
      if (error?.code === -1) {
        setLocationError(t.locationUnsupported);
      } else if (error?.code === 1) {
        setLocationError(t.locationPermissionError);
      } else if (error?.code === 2) {
        setLocationError(t.locationUnavailableError);
      } else if (error?.code === 3) {
        setLocationError(t.locationTimeoutError);
      } else {
        setLocationError(t.locationPermissionError);
      }
      return false;
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // ดึงตำแหน่ง GPS อัตโนมัติทันทีที่เข้าแท็บ "เรียกรถฉุกเฉิน" — ไม่ต้องรอผู้ใช้แตะเอง
  // (ตามที่ต้องการให้ล็อกอินเสร็จแล้วกดเรียกได้ทันทีแบบง่ายที่สุด)
  useEffect(() => {
    if (activeTab === 'request' && !liveCoords && !isFetchingLocation) {
      handleFetchLiveLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // แชร์พิกัดฉุกเฉินให้คนที่ไว้ใจ / ศูนย์บริการ
  const handleShareLocation = async () => {
    try {
      const coords = liveCoords ?? await requestCurrentLocation();

      const nearestGarage = findNearestGarage(coords);
      setLiveCoords(coords);
      setTowingRequest(prev => ({
        ...prev,
        gpsLocation: formatGpsLocation(coords.lat, coords.lng),
        nearestGarage: nearestGarage.label,
        nearestGarageLat: nearestGarage.lat,
        nearestGarageLng: nearestGarage.lng,
        distanceKm: nearestGarage.distanceKm
      }));
      refineDistanceWithRealRoute(coords, { lat: nearestGarage.lat, lng: nearestGarage.lng });
      setLocationError('');

      const mapsUrl = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
      const shareText = `DTC Towing Emergency: ${formatGpsLocation(coords.lat, coords.lng)} — ${mapsUrl}`;

      if (navigator.share) {
        await navigator.share({
          title: t.shareEmergency,
          text: shareText
        });
      } else {
        window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;

      if (error?.code === 1) {
        setLocationError(t.locationPermissionError);
      } else if (error?.code === 2) {
        setLocationError(t.locationUnavailableError);
      } else if (error?.code === 3) {
        setLocationError(t.locationTimeoutError);
      } else {
        setLocationError(t.locationPermissionError);
      }
    }
  };

  // ปุ่มสำรอง: ใช้เมื่อกด "เปิดใช้งาน GPS" แล้วเบราว์เซอร์/มือถือเข้าถึงตำแหน่งจริงไม่ได้เลย
  // (ผู้ใช้ปิดสิทธิ์ GPS, เบราว์เซอร์ไม่รองรับ ฯลฯ) เพื่อให้ยังค้นหาอู่ใกล้เคียงที่สุดและเรียกช่างได้
  const handleUseApproximateLocation = () => {
    const approxCoords = { lat: 13.7563, lng: 100.5018 }; // ใจกลางกรุงเทพฯ (ค่าประมาณ ใช้เป็นทางเลือกสำรอง)
    const nearestGarage = findNearestGarage(approxCoords);
    setLiveCoords(approxCoords);
    setTowingRequest(prev => ({
      ...prev,
      gpsLocation: `${formatGpsLocation(approxCoords.lat, approxCoords.lng)} ${t.approxLocationSuffix}`,
      nearestGarage: nearestGarage.label,
      nearestGarageLat: nearestGarage.lat,
      nearestGarageLng: nearestGarage.lng,
      distanceKm: nearestGarage.distanceKm
    }));
    refineDistanceWithRealRoute(approxCoords, { lat: nearestGarage.lat, lng: nearestGarage.lng });
    setLocationError('');
    setAppToast({ message: t.approxLocationSetToast, type: 'success' });
  };

  // ฟังก์ชันจัดการการแจ้งเตือน
  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // ฟังก์ชันจัดการรถที่บันทึกไว้เพิ่มเติม (Multi-car)
  const handleAddCar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarBrand.trim() || !newCarModel.trim() || !newCarPlate.trim()) {
      setAppToast({ message: t.carDetailsRequiredErr, type: 'error' });
      return;
    }
    setSavedCars(prev => [
      ...prev,
      { id: `car_${Date.now()}`, brand: newCarBrand, model: newCarModel, plate: newCarPlate }
    ]);
    setNewCarBrand('');
    setNewCarModel('');
    setNewCarPlate('');
    setShowAddCarModal(false);
  };

  const handleRemoveCar = (id: string) => {
    setSavedCars(prev => prev.filter(c => c.id !== id));
  };

  // ฟังก์ชันโทรหาช่าง — เปิดหน้าจอ "กำลังโทรออก" ภายในแอปก่อน แทนที่จะยิง tel: ออกไปทันที
  // (การยิง tel: ตรงๆ ทำให้เบราว์เซอร์เด้ง popup ยืนยันซึ่งจะโผล่นอกกรอบมือถือ)
  // เมื่อโทรหาช่างที่รับงานอยู่ (ไม่ใช่สายด่วน 1176) จะส่งสัญญาณแจ้งเตือนไปยังฝั่งช่างแบบเรียลไทม์ด้วย
  const handleCallMechanic = (techPhone: string, techName?: string) => {
    setCallingTechName(techName || assignedTech.name);
    setCallingTechPhone(techPhone);
    setShowCallingModal(true);

    if (currentJobId && techPhone === assignedTech.phone) {
      callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call_ring',
        payload: { from: 'customer', name: getUserDisplayName(), phone: registerForm.phoneNumber },
      });
    }
  };

  // ฟังก์ชันรับสายที่ช่างโทรเข้ามา — ปิดหน้าจอสายเรียกเข้าแล้วเปิดแอปโทรศัพท์จริงเพื่อคุยกัน
  const handleAcceptIncomingCall = () => {
    setShowIncomingCallModal(false);
  };

  // ฟังก์ชันปฏิเสธสาย — แจ้งฝั่งช่างว่าลูกค้าไม่สะดวกรับสาย
  const handleDeclineIncomingCall = () => {
    setShowIncomingCallModal(false);
    callChannelRef.current?.send({ type: 'broadcast', event: 'call_end', payload: { from: 'customer' } });
  };

  // ฟังก์ชันเปิดหน้าต่างแชตช่างที่มอบหมาย — เปิดแล้วถือว่าอ่านข้อความหมดแล้ว จึงเคลียร์จุดแดง
  const handleOpenChatWithTech = (tech: Technician) => {
    setActiveChatTech(tech);
    setHasUnreadChat(false);
  };

  // ฟังก์ชันส่งข้อความแชตหาช่าง — เดิม insert() ตรงเข้า chat_messages ซึ่งโดน RLS บล็อกเงียบๆ
  // (ฝั่งลูกค้าเป็น anon role ไม่มี Supabase Auth session) ข้อความเลยไม่เคยไปถึงฝั่งช่างจริง
  // แม้จะโชว์ในแชทฝั่งลูกค้าเองก็ตาม (เพราะ optimistic update ใน state เครื่องอัปเดตไปแล้ว)
  // เปลี่ยนมาเรียกผ่าน sendChatMessage() RPC แทน
  const handleSendMessage = async () => {
    if (!inputMsg.trim() || !currentJobId) return;
    const text = inputMsg.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text }]);
    setInputMsg('');
    try {
      await sendChatMessage({ jobId: currentJobId, sender: 'customer', text });
    } catch (err) {
      console.error('Error sending chat message:', err);
    }
  };

  // ฟังก์ชันจัดการรูปภาพสลิป
  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file); // เก็บไฟล์จริงไว้อัปโหลดขึ้น Supabase Storage ตอนยืนยันการจอง
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSlip = () => {
    setSlipImage(null);
    setSlipFile(null);
    if (slipFileInputRef.current) {
      slipFileInputRef.current.value = '';
    }
  };

  // อัปโหลดสลิปขึ้น Supabase Storage (bucket: payment-slips) แล้วบันทึกแถวในตาราง payments
  // ผูกกับ job_id ที่เพิ่งสร้าง — ทำงานแบบ best-effort: ถ้าอัปโหลดสลิปพลาด จะไม่ทำให้การจองงานล้มเหลวไปด้วย
  // (งานถูกสร้างไปแล้ว แค่ยังไม่มีสลิปแนบ ช่าง/แอดมินตรวจสอบเพิ่มเติมได้ทีหลัง)
  const uploadPaymentSlip = async (jobId: string) => {
    if (!slipFile) return;
    setIsUploadingSlip(true);
    try {
      const fileExt = slipFile.name.split('.').pop() || 'jpg';
      const filePath = `${jobId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(filePath, slipFile, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('payment-slips')
        .getPublicUrl(filePath);

      await recordJobPayment({
        jobId,
        amount: towingRequest.calculatedEtvPrice,
        paymentMethod: 'promptpay',
        slipUrl: publicUrlData.publicUrl,
      });

      // อัปเดต state myPayment ทันที (optimistic) ไม่ต้องรอ realtime/poll กลับมา — การ์ด QR
      // ในหน้าติดตามงานเช็คเงื่อนไข !myPayment?.slip_url อยู่ จะได้ซ่อนได้ทันทีที่ส่งสำเร็จ
      setMyPayment((prev) =>
        prev
          ? { ...prev, slip_url: publicUrlData.publicUrl, status: 'pending' }
          : {
              id: jobId,
              slip_url: publicUrlData.publicUrl,
              amount: towingRequest.calculatedEtvPrice,
              payment_method: 'transfer',
              status: 'pending',
            }
      );
      setSlipImage(null);
      setSlipFile(null);
      if (slipFileInputRef.current) slipFileInputRef.current.value = '';

      setAppToast({ message: t.slipUploadedToast, type: 'success' });
    } catch (err) {
      console.error('Error uploading payment slip:', err);
      setAppToast({ message: t.slipUploadFailedToast, type: 'error' });
    } finally {
      setIsUploadingSlip(false);
    }
  };

  // บันทึกวิธีชำระเงินของงานนี้ลงตาราง payments เสมอ ไม่ว่าจะเลือกช่องทางไหน
  // - promptpay ที่แนบสลิปมาแล้ว: ใช้ uploadPaymentSlip() ด้านบน (มีสลิปจริงให้ช่างตรวจ)
  // - cash / credit / promptpay ที่ยังไม่ได้แนบสลิป: insert แถว payment ทันทีแบบไม่มีสลิป
  //   เพื่อให้ฝั่งช่างเห็นว่าลูกค้าเลือกวิธีไหนไว้ (โดยเฉพาะเงินสด จะได้ไม่ขึ้นว่า "ยังไม่แนบสลิป")
  const submitPaymentRecord = async (jobId: string) => {
    if (selectedPaymentMethod === 'promptpay' && slipFile) {
      uploadPaymentSlip(jobId);
      return;
    }
    try {
      await recordJobPayment({
        jobId,
        amount: towingRequest.calculatedEtvPrice,
        paymentMethod: selectedPaymentMethod,
        slipUrl: null,
      });
    } catch (err) {
      console.error('Error creating payment record:', err);
    }
  };

  // ฟังก์ชันส่งรีวิวและให้คะแนนช่าง — คะแนนใหม่จะถูกคำนวณเฉลี่ยถ่วงน้ำหนักกับคะแนนสะสมเดิมของช่างจริง
  // (ไม่ใช่แค่ตั้งค่าคะแนนล่าสุดทับ) แล้วอัปเดตกลับเข้าตาราง technicians ใน Supabase
  const handleSubmitReview = async () => {
    // กันการกดส่งซ้ำ/ถูกเรียกซ้ำ (เช่น กดปุ่มรัวๆ) ซึ่งจะทำให้บันทึกประวัติซ้ำ
    if (!showReviewModal) return;

    // บันทึกรายการล่าสุดเข้าประวัติการใช้บริการ
    const now = new Date();
    const dateStr = formatDate(now);
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    // ต่อท้าย "น." (นาฬิกา) เฉพาะภาษาไทยเท่านั้น ภาษาอื่นแสดงแค่เวลาเปล่าๆ
    const timeStr = lang === 'TH'
      ? `${formatNumber(now.getHours()).padStart(2, '0')}:${formatNumber(now.getMinutes()).padStart(2, '0')} น.`
      : lang === 'CN'
        ? `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
        : `${hh}:${mm}`;
    const newHistoryItem = {
      id: `JOB-${Date.now().toString().slice(-8)}`,
      date: dateStr,
      time: timeStr,
      towType: towingRequest.towType,
      carCategory: towingRequest.carCategory,
      location: towingRequest.gpsLocation,
      price: towingRequest.calculatedEtvPrice,
      techName: assignedTech.name,
      status: 'เสร็จสิ้น' as const
    };
    setServiceHistory(prev => [newHistoryItem, ...prev]);

    // อัปเดตคะแนนสะสมของช่าง + บันทึกรีวิว — เดิม .select()/.update() ตาราง technicians และ
    // .insert() ตาราง reviews ตรงๆ ทั้งคู่ โดน RLS บล็อกเงียบๆ เหมือนจุดอื่น (ฝั่งลูกค้าเป็น anon
    // role) คะแนนช่างเลยไม่เคยขยับจริง เปลี่ยนมาเรียก submitJobReview() RPC ตัวเดียว ซึ่งฝั่ง
    // server คำนวณ weighted average และอัปเดต technicians.rating + insert reviews ให้ในทรานแซคชัน
    // เดียวกันอยู่แล้ว (ดู dtc-api.ts) ไม่ต้องคำนวณเองฝั่ง client อีกต่อไป
    try {
      if (currentJobId) {
        await submitJobReview({
          jobId: currentJobId,
          techId: assignedTech.id,
          rating,
          text: reviewText,
        });
      }
    } catch (err) {
      console.error('Error updating technician rating / saving review:', err);
    }

    setSubmittedRating(rating);
    setShowReviewModal(false);
    setHasActiveBooking(false);
    setShowTrackingDetail(false);
    setTechAccepted(false);
    setAssignedTech(mockAssignedTech);
    setTechLiveCoords(null);
    setCurrentJobId(null);
    setTruckProgress(0);
    setTrackingPhase('moving_to_red');
    setReviewText('');
    setRating(5);
    setSlipImage(null);
    setSlipFile(null);
    setShowReviewThanksModal(true);
  };

  // Effect ปิด Toast ในแอปอัตโนมัติหลังแสดงครบ 2.5 วินาที
  useEffect(() => {
    if (appToast) {
      const timer = setTimeout(() => setAppToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [appToast]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // สถานะ Wi-Fi จริงของเครื่อง
    const handleOnline = () => setIsWifiOnline(true);
    const handleOffline = () => setIsWifiOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsWifiOnline(navigator.onLine);

    // สถานะแบตเตอรี่จริงของเครื่อง (เหมือนฝั่งช่าง)
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

  // ออกจากหน้าโลโก้แรก: ไปหน้า onboarding ตามปกติเสมอ (step 2) — ปิดแอปแล้วเปิดใหม่ต้อง
  // ล็อกอินซ้ำทุกครั้ง ไม่ข้ามไปหน้า Home อัตโนมัติ (บัญชีที่เคยสมัครไว้ยังใช้ล็อกอินได้ตามปกติ
  // เพราะข้อมูลบัญชี email+password ถูกเก็บแยกไว้ต่างหาก ดู getStoredAccounts/handleLoginSubmit)
  const goPastSplash = () => {
    setStep(2);
  };

  // หน้าโลโก้แรก (step 1): เปลี่ยนไปหน้าถัดไปเองอัตโนมัติหลังจาก 5 วินาที
  useEffect(() => {
    if (step === 1) {
      const splashTimer = setTimeout(goPastSplash, 5000);
      return () => clearTimeout(splashTimer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 9 && !expandedBannerUrl) {
      const bannerTimer = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
      }, 3000);
      return () => clearInterval(bannerTimer);
    }
  }, [step, bannerImages.length, expandedBannerUrl]);

  // หมายเหตุ: เดิมส่วนนี้เป็นตัวจับเวลาจำลองการเคลื่อนที่ของรถช่างเอง (setInterval สุ่มขยับทุก 500ms)
  // ซึ่งทำงานแยกขาดจากสถานะจริงของช่างฝั่ง t3 โดยสิ้นเชิง — ตอนนี้เปลี่ยนมาใช้สถานะจริงจาก
  // Supabase realtime แทนแล้ว (ดู useEffect "1. ดักฟังเมื่อช่างฝั่ง t3 กดรับงาน" ด้านบน ที่อัปเดต
  // trackingPhase / truckProgress / showReviewModal ตามสถานะ accepted / en_route / arrived /
  // loading / delivering / completed ที่ช่างกดจริงในแอปช่าง) จึงลบตัวจับเวลาจำลองออก

  useEffect(() => {
    const issueConfig = ISSUE_SERVICE_CONFIG[towingRequest.selectedIssue] ?? { requiresTow: true };
    let basePrice = issueConfig.requiresTow
      ? (towingRequest.towType === 'รถสไลด์ (Slide Tow)' ? 1500 : 1200)
      : (issueConfig.basePrice ?? 400);
    if (towingRequest.carCategory.includes('ไฟฟ้า')) basePrice += 300;
    const finalPrice = basePrice + Math.round(towingRequest.distanceKm * 50);
    setTowingRequest(prev => ({ ...prev, calculatedEtvPrice: finalPrice }));
  }, [towingRequest.selectedIssue, towingRequest.towType, towingRequest.carCategory, towingRequest.distanceKm]);

  const getUserDisplayName = () => {
    if (registerForm.name.trim()) return registerForm.name;
    if (loginEmail.trim()) return loginEmail.split('@')[0];
    return lang === 'TH' ? 'ผู้ใช้งาน' : lang === 'CN' ? '用户' : 'User';
  };

  const handleRegisterInputChange = (field: string, value: string) => {
    setRegisterForm(prev => ({ ...prev, [field]: value }));
    if (field === 'name' && value.trim()) setRegNameErr(false);
    if (field === 'surname' && value.trim()) setRegSurnameErr(false);
    if (field === 'phoneNumber' && value.trim()) setRegPhoneErr(false);
    if (field === 'email' && value.trim()) setRegEmailErr(false);
    if (field === 'carNumber' && value.trim()) setRegCarNoErr(false);
  };

  // ⚠️ LEGACY: เดิมฟังก์ชันคู่นี้เป็นแหล่งข้อมูลจริงของระบบสมาชิก (register/login เทียบกับ
  // localStorage ตรง ๆ) — ปัญหาคือลบแอปแล้วลงใหม่ localStorage หายหมด บัญชีเลยหายไปด้วย
  // ทั้งที่จริงยังสมัครไว้อยู่ ตอนนี้ handleRegisterSubmit / handleLoginSubmit เปลี่ยนไปใช้
  // registerCustomer() / signInCustomer() (Supabase Auth จริง) แล้ว บัญชีจึงอยู่ถาวรฝั่ง
  // server ไม่หายแม้ลบแอป — ฟังก์ชันคู่นี้เหลือไว้ให้ "หน้าลืมรหัสผ่าน (OTP)" ด้านล่างใช้
  // เท่านั้น ซึ่งยังเป็น mock (สุ่ม OTP โชว์บนจอเอง ไม่ได้ส่งจริง) ไม่ได้ผูกกับรหัสผ่านจริง
  // ใน Supabase — ถ้าจะทำระบบลืมรหัสผ่านให้ใช้งานได้จริง ต้องแยกทำต่างหากผ่าน
  // supabase.auth.resetPasswordForEmail() (ส่งอีเมลจริง ไม่ใช่ scope ของการแก้ครั้งนี้)
  type StoredAccount = {
    name: string;
    surname: string;
    phoneNumber: string;
    email: string;
    password: string;
  };

  const getStoredAccounts = (): StoredAccount[] => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('dtc_customer_accounts') : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const saveStoredAccounts = (accounts: StoredAccount[]) => {
    try {
      localStorage.setItem('dtc_customer_accounts', JSON.stringify(accounts));
    } catch {
      // localStorage ใช้ไม่ได้ (โหมด private/incognito) — ข้ามไป ไม่กระทบการใช้งานหลัก
    }
  };

  // สมัครสมาชิกจริงผ่าน Supabase Auth (registerCustomer) แทนที่การเขียนบัญชีลง
  // localStorage เดิม — เดิมลบแอปแล้วลงใหม่คือข้อมูลหายหมด เพราะไม่เคยไปอยู่ที่ฝั่ง
  // server เลย ตอนนี้บัญชีจะอยู่ถาวรใน Supabase ไม่ว่าจะลบ/ลงแอปใหม่กี่รอบก็ล็อกอินได้เหมือนเดิม
  const handleRegisterSubmit = async () => {
    let hasError = false;
    setRegEmailErrMsg('');
    setRegPasswordErr('');
    setRegConfirmPasswordErr('');

    if (!registerForm.name.trim()) { setRegNameErr(true); hasError = true; }
    if (!registerForm.surname.trim()) { setRegSurnameErr(true); hasError = true; }
    if (!registerForm.phoneNumber.trim()) { setRegPhoneErr(true); hasError = true; }
    if (!registerForm.email.trim()) { setRegEmailErr(true); hasError = true; }

    if (!regPassword.trim()) {
      setRegPasswordErr(t.setPasswordErr);
      hasError = true;
    } else if (!regPasswordChecks.length || !regPasswordChecks.uppercase || !regPasswordChecks.numberSpecial) {
      setRegPasswordErr(t.passwordInvalidErr);
      hasError = true;
    }

    if (!regConfirmPassword.trim()) {
      setRegConfirmPasswordErr(t.regConfirmPasswordRequiredErr);
      hasError = true;
    } else if (regPassword.trim() && regConfirmPassword !== regPassword) {
      setRegConfirmPasswordErr(t.passwordMismatchErr);
      hasError = true;
    }

    if (hasError) return;

    setAuthSubmitting(true);
    try {
      // กันเคส request ค้างไม่ตอบเลย (เช่น env/URL ของ Supabase ผิด หรือเน็ตมือถือมีปัญหา)
      // ไม่ให้ปุ่ม "กำลังสมัครสมาชิก..." ค้างตลอดไปแบบไม่มีวันจบ — ตั้ง timeout ไว้ 20 วิ
      // (เผื่อเวลาให้พอสำหรับเน็ตมือถือช้าจริง ๆ ไม่ใช่แค่ debug ชั่วคราวแบบเดิม)
      const profile = await Promise.race([
        registerCustomer({
          name: registerForm.name,
          surname: registerForm.surname,
          phone: registerForm.phoneNumber,
          email: registerForm.email,
          password: regPassword,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('__TIMEOUT__')), 20000)
        ),
      ]);
      setCustomerProfile(profile);

      // เคลียร์ค่ารหัสผ่านที่พิมพ์ไว้ในฟอร์มออกจาก state ทันทีหลังสมัครสำเร็จ
      setRegPassword('');
      setRegConfirmPassword('');
      setStep(9);
    } catch (err: any) {
      const msg: string = err?.message || '';

      if (msg === '__TIMEOUT__') {
        setAppToast({ message: t.serverConnectFailedToast, type: 'error' });
        setRegEmailErr(true);
        setRegEmailErrMsg(t.serverConnectFailedErr);
        return;
      }

      // ข้อความจาก Supabase Auth ตอนอีเมลซ้ำมักจะมีคำว่า "already registered" /
      // "already exists" ปนมา — เช็คแบบ loose ไว้กันเวอร์ชัน error message เปลี่ยน
      if (/already/i.test(msg)) {
        setRegEmailErr(true);
        setRegEmailErrMsg(t.emailAlreadyUsedErr);
      } else {
        setRegEmailErr(true);
        setRegEmailErrMsg(msg || t.signupFailedErr);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let hasError = false;

    if (!loginEmail.trim()) {
      setEmailError(true);
      hasError = true;
    } else {
      setEmailError(false);
    }

    if (!loginPassword.trim()) {
      setPasswordError(t.passwordRequiredErr);
      hasError = true;
    } else {
      setPasswordError('');
    }

    if (hasError) return;

    setAuthSubmitting(true);
    try {
      // กันเคส request ค้างไม่ตอบเลย (เช่น env/URL ของ Supabase ผิด หรือเน็ตมือถือมีปัญหา)
      // ไม่ให้ปุ่ม "กำลังเข้าสู่ระบบ..." ค้างตลอดไปแบบไม่มีวันจบ — ตั้ง timeout ไว้ 20 วิ
      const profile = await Promise.race([
        signInCustomer(loginEmail.trim(), loginPassword),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('__TIMEOUT__')), 20000)
        ),
      ]);
      setCustomerProfile(profile);
      setRegisterForm(prev => ({
        ...prev,
        name: profile.name,
        surname: profile.surname,
        phoneNumber: profile.phone,
        email: profile.email,
      }));
      setStep(9);
    } catch (err: any) {
      const msg: string = err?.message || '';

      if (msg === '__TIMEOUT__') {
        setAppToast({ message: t.serverConnectFailedToast, type: 'error' });
        return;
      }

      // Supabase ไม่บอกแยกว่า "อีเมลไม่พบ" หรือ "รหัสผ่านผิด" (กันเดาอีเมลถูกจากข้อความ error)
      // เลยแสดงข้อความรวมที่ช่องรหัสผ่านเหมือนกันทั้งสองกรณี
      setEmailError(true);
      setPasswordError(t.loginInvalidErr);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // กดปุ่ม "LINE" — เปิดหน้า LINE consent ในเบราว์เซอร์ระบบผ่าน Supabase OAuth (custom:line)
  // จริง ผลลัพธ์ (สำเร็จ/ไม่สำเร็จ/ผู้ใช้ใหม่ต้องกรอกโปรไฟล์เพิ่ม) จะมาที่ useEffect
  // ที่ลงทะเบียน registerLineAuthListener ด้านล่าง เพราะการตอบกลับมาผ่าน deep link
  // แยกรอบ ไม่ใช่ return value ตรงจากฟังก์ชันนี้
  const handleLineSelect = async () => {
    setIsLineAuthLoading(true);
    try {
      await signInWithLine('customer');
      // ไม่ setIsLineAuthLoading(false) ตรงนี้ — ปล่อยให้ค้าง loading ไว้จนกว่า
      // listener จะได้ผลลัพธ์กลับมา (สำเร็จ/ผิดพลาด) เพราะผู้ใช้กำลังอยู่ในเบราว์เซอร์ระบบ
    } catch (err: any) {
      setIsLineAuthLoading(false);
      setAppToast({ message: err?.message || t.lineOpenFailedToast, type: 'error' });
    }
  };

  // ผลลัพธ์หลัง LINE OAuth สำเร็จ (มี Supabase session แล้ว) — เช็คว่าเคยกรอกโปรไฟล์
  // ลูกค้า (ตาราง customers) ไว้หรือยัง ถ้าเคย = ล็อกอินสำเร็จเข้าแอปได้เลย (เหมือน
  // handleLoginSubmit) ถ้ายัง = เป็นผู้ใช้ LINE ใหม่ ต้องโชว์ฟอร์ม "กรอกข้อมูลให้ครบ" ก่อน
  const handleLineAuthSuccess = async (
    userId: string,
    claims: { name?: string; email?: string; picture?: string }
  ) => {
    try {
      const existingProfile = await getCustomerProfileIfExists(userId);
      if (existingProfile) {
        setCustomerProfile(existingProfile);
        setRegisterForm(prev => ({
          ...prev,
          name: existingProfile.name,
          surname: existingProfile.surname,
          phoneNumber: existingProfile.phone,
          email: existingProfile.email,
        }));
        setIsLineAuthLoading(false);
        setStep(9);
        setAppToast({ message: `${t.loginSuccessWelcome}${existingProfile.name}`, type: 'success' });
        return;
      }

      // ผู้ใช้ LINE ใหม่ — เปิดฟอร์มกรอกข้อมูลเพิ่ม โดย prefill ชื่อ/อีเมลจาก LINE ถ้ามีมาให้
      setLineOAuthUserId(userId);
      setLineCompleteForm({
        name: claims.name || '',
        surname: '',
        phone: '',
        email: claims.email || '',
      });
      setIsLineAuthLoading(false);
      setShowLineCompleteProfile(true);
    } catch (err: any) {
      setIsLineAuthLoading(false);
      setAppToast({ message: err?.message || t.lineLoginFailedToast, type: 'error' });
    }
  };

  const handleLineAuthError = (message: string) => {
    setIsLineAuthLoading(false);
    setAppToast({ message, type: 'error' });
  };

  // ลงทะเบียนดักฟัง deep link callback จาก LINE OAuth ครั้งเดียวตอน mount หน้านี้
  useEffect(() => {
    const cleanup = registerLineAuthListener('customer', handleLineAuthSuccess, handleLineAuthError);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ผู้ใช้ LINE ใหม่กดยืนยันฟอร์ม "กรอกข้อมูลให้ครบ" — สร้างแถวโปรไฟล์จริงในตาราง customers
  // ผูกกับ auth user ที่มีอยู่แล้วจาก LINE OAuth (ไม่เรียก signUp ซ้ำ ต่างจากสมัครด้วยอีเมล)
  const handleSubmitLineCompleteProfile = async () => {
    const errs: { surname?: string; phone?: string; email?: string } = {};
    if (!lineCompleteForm.surname.trim()) errs.surname = t.surnameRequiredErr;
    if (!lineCompleteForm.phone.trim()) errs.phone = t.phoneRequiredErr;
    if (!lineCompleteForm.email.trim()) errs.email = t.emailRequiredLineErr;
    setLineCompleteErr(errs);
    if (Object.keys(errs).length > 0) return;

    setLineCompleteSubmitting(true);
    try {
      const profile = await completeCustomerProfileAfterOAuth({
        customerId: lineOAuthUserId,
        name: lineCompleteForm.name,
        surname: lineCompleteForm.surname,
        phone: lineCompleteForm.phone,
        email: lineCompleteForm.email,
      });
      setCustomerProfile(profile);
      setRegisterForm(prev => ({
        ...prev,
        name: profile.name,
        surname: profile.surname,
        phoneNumber: profile.phone,
        email: profile.email,
      }));
      setShowLineCompleteProfile(false);
      setStep(9);
      setAppToast({ message: `${t.lineSignupSuccessWelcome}${profile.name}`, type: 'success' });
    } catch (err: any) {
      setAppToast({ message: err?.message || t.saveFailedTryAgainErr, type: 'error' });
    } finally {
      setLineCompleteSubmitting(false);
    }
  };

  const handleSendCode = () => {
    if (!resetContact.trim()) {
      setContactError(true);
      return;
    }
    setContactError(false);

    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);
    setOtpValues(randomOtp.split(''));
    setStep(7);
    setShowOtpNotification(true);
    setTimeout(() => {
      setShowOtpNotification(false);
    }, 6000);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    const newOtp = [...otpValues];
    newOtp[index] = value;
    setOtpValues(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResetPasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let hasError = false;

    setNewPasswordErr('');
    setConfirmPasswordErr('');

    if (!newPasswordVal.trim()) {
      setNewPasswordErr(t.newPasswordRequiredErr);
      hasError = true;
    } else if (newPasswordVal.length < 6) {
      setNewPasswordErr(t.passwordMinLengthErr);
      hasError = true;
    }

    if (!confirmPasswordVal.trim()) {
      setConfirmPasswordErr(t.confirmPasswordRequiredErr);
      hasError = true;
    }

    if (newPasswordVal.trim() && confirmPasswordVal.trim()) {
      if (newPasswordVal !== confirmPasswordVal) {
        setConfirmPasswordErr(t.passwordMismatchErr);
        hasError = true;
      }
    }

    if (!hasError) {
      // บันทึกรหัสผ่านใหม่ลงบัญชีจริง (หาโดยจับคู่ email หรือเบอร์โทรที่กรอกไว้ตอนขอรีเซ็ต)
      const accounts = getStoredAccounts();
      const contactTrimmed = resetContact.trim().toLowerCase();
      const idx = accounts.findIndex(
        a => a.email.trim().toLowerCase() === contactTrimmed || a.phoneNumber.trim() === resetContact.trim()
      );
      if (idx !== -1) {
        accounts[idx] = { ...accounts[idx], password: newPasswordVal };
        saveStoredAccounts(accounts);
      }
      setShowResetSuccessModal(true);
    }
  };

  const handleSuccessModalClose = () => {
    setShowResetSuccessModal(false);
    // ไม่กรอกรหัสผ่านใหม่ใส่ช่องล็อกอินให้อัตโนมัติ — ให้ลูกค้าพิมพ์เข้าไปเองตอนล็อกอินจริง
    setLoginPassword('');
    setNewPasswordVal('');
    setConfirmPasswordVal('');
    setAuthTab('login');
    setStep(5);
  };
const handleConfirmTowingBooking = async () => {
    if (!liveCoords) {
      setAppToast({ message: t.gpsRequiredWarning, type: 'error' });
      return;
    }

    // แก้ตามที่ตกลงกันไว้: เรียกช่างได้ทันทีโดยไม่ต้องจ่าย/แนบสลิปก่อนอีกต่อไป — ถ้าเลือกจ่ายผ่าน
    // PromptPay ลูกค้าจะไปสแกน QR + แนบสลิปในหน้าติดตามงานแทน หลังจากช่างกดรับงานแล้วเท่านั้น
    // (ดูส่วน activeTab === 'activity' ด้านล่าง) ไม่บล็อกการเรียกช่างตรงนี้เหมือนเดิมอีกต่อไป

    try {
      // เดิม insert ตรงเข้า 'jobs' และส่ง price เอง (towingRequest.calculatedEtvPrice)
      // เปลี่ยนเป็นเรียก createJobApi() แทน — ราคาคำนวณฝั่ง server เสมอ ดู
      // supabase/migrations/0002_price_and_status_rpc.sql
      // requiredSpecialty: ส่งไปให้ backend รู้ว่างานนี้ต้องแมทช์ช่างประเภทไหน
      // ('tow' = ต้องใช้รถลาก/สไลด์ ตาม towType, 'jump_start'/'tire_change' = ช่างเฉพาะทาง ไม่ต้องลากรถ)
      // *ต้องอัปเดต create_job_priced RPC ให้รับ p_required_specialty ด้วย ไม่งั้นค่านี้จะถูก DB เพิกเฉย*
      const data = await createJobApi({
        customerName: getUserDisplayName(),
        customerPhone: registerForm.phoneNumber,
        carBrand: registerForm.carBrand,
        carModel: registerForm.carModel,
        carPlate: registerForm.carNumber,
        issueType: towingRequest.selectedIssue,
        towType: towingRequest.towType,
        requiredSpecialty: currentIssueConfig.requiresTow ? 'tow' : (currentIssueConfig.specialty ?? 'tow'),
        carCategory: towingRequest.carCategory,
        locationLat: liveCoords.lat,
        locationLng: liveCoords.lng,
        locationText: towingRequest.gpsLocation,
        nearestGarage: towingRequest.nearestGarage,
        garageLat: towingRequest.nearestGarageLat!,
        garageLng: towingRequest.nearestGarageLng!,
        distanceKm: towingRequest.distanceKm,
      });

      // เดิม setIsBookingSuccess(true) อยู่นอก if (data) เลยขึ้นหน้า "ส่งคำขอสำเร็จ"
      // เสมอแม้ RPC จะไม่ได้สร้างงานจริงในฐานข้อมูล (ไม่ throw error แต่ data/data.id
      // ว่างเปล่า) — ย้ายเข้ามาไว้ใน if (data && data.id) ให้ตรงกับผลจริง และโชว์ error
      // ชัดๆ ถ้า RPC สำเร็จ (ไม่ throw) แต่ไม่ได้คืน job จริงมาให้
      if (data && data.id) {
        setCurrentJobId(data.id);
        // บันทึกวิธีชำระเงินที่ลูกค้าเลือกไว้เสมอ (ไม่ await เพื่อไม่ให้ลูกค้ารอ — หน้า
        // "ส่งคำขอสำเร็จ" ขึ้นได้ทันที ส่วนบันทึก/อัปโหลดสลิปทำงานเบื้องหลัง)
        submitPaymentRecord(data.id);

        const estimatedMinutes = Math.max(8, Math.min(30, Math.round(towingRequest.distanceKm * 2) + 8));
        setEtaTotalMinutes(estimatedMinutes);
        setIsBookingSuccess(true);
        setHasActiveBooking(true);
        setTechAccepted(false); // ยังไม่มีช่างรับงาน ห้ามเปิดหน้าแมพจนกว่าจะได้รับสถานะ 'accepted' จริงจาก Supabase
        setTruckProgress(15);
        setTrackingPhase('moving_to_red');

        // แสดงหน้า "ส่งคำขอสำเร็จ" สั้นๆ แล้วพาไปแท็บกิจกรรม แต่ "ยังไม่" เปิดแผนที่ —
        // แผนที่ (showTrackingDetail) จะเปิดก็ต่อเมื่อช่างกดรับงานจริงเท่านั้น (ดู useEffect ดักฟัง Supabase ด้านล่าง)
        setTimeout(() => {
          setIsBookingSuccess(false);
          setActiveTab('activity');
        }, 2500);
      } else {
        setAppToast({
          message: t.jobCreateFailedToast,
          type: 'error',
        });
        return;
      }

    } catch (err: any) {
      console.error('Error creating booking:', err);
      // โชว์ข้อความ error จริงจาก Supabase ในแอปเลย (ชั่วคราวเพื่อ debug บนเครื่องจริง
      // ที่เปิด chrome://inspect ไม่ได้เพราะนโยบายองค์กรบล็อกไว้)
      const detail = err?.message || err?.error_description || err?.hint || JSON.stringify(err);
      setAppToast({ message: `${t.submitFailedPrefix} ${detail}`, type: 'error' });
    }
  };

  // ดึงและติดตามสถานะการชำระเงินของงานปัจจุบันแบบเรียลไทม์ — เพื่อให้รู้ทันทีถ้าช่างกดปฏิเสธสลิป
  // (rejected) จะได้ขึ้นแบนเนอร์เตือนพร้อมปุ่มแนบสลิปใหม่ แทนที่จะค้างไม่รู้อะไรเลย
  //
  // เดิมมีแค่ fetch ครั้งเดียว + realtime subscribe เท่านั้น ไม่มี poll สำรองเหมือนจุดอื่นในไฟล์นี้
  // (เทียบ fetchMessages ด้านล่างที่มี pollInterval สำรองไว้อยู่แล้ว เพราะ Supabase Realtime
  // WebSocket หลุดเงียบๆ ได้บ่อยบนมือถือเวลาแอปถูกย่อ/ล็อกจอ/สลับแอป แล้วไม่ reconnect เอง)
  // ผลคือถ้า WebSocket หลุดตอนช่างกดปฏิเสธสลิปพอดี ฝั่งลูกค้าจะไม่มีทางรู้เลยว่า status
  // เปลี่ยนเป็น rejected แล้ว จนกว่าจะรีโหลดแอปทั้งหน้า (banner เลยไม่ขึ้นทั้งที่ DB อัปเดตถูกต้อง) —
  // เพิ่ม poll ทุก 4 วิ เป็นตัวสำรอง ให้ sync กลับมาเองได้แม้ realtime หลุด
  useEffect(() => {
    if (!currentJobId) {
      setMyPayment(null);
      return;
    }

    const fetchMyPayment = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('job_id', currentJobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setMyPayment({
          id: data.id,
          slip_url: data.slip_url,
          amount: data.amount,
          payment_method: data.payment_method === 'cash' || data.payment_method === 'credit' ? data.payment_method : 'transfer',
          status: data.status,
        });
      }
    };

    fetchMyPayment();

    const myPaymentChannel = supabase
      .channel(`my_payment_${currentJobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `job_id=eq.${currentJobId}` },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          setMyPayment({
            id: row.id,
            slip_url: row.slip_url,
            amount: row.amount,
            payment_method: row.payment_method === 'cash' || row.payment_method === 'credit' ? row.payment_method : 'transfer',
            status: row.status,
          });
        }
      )
      .subscribe();

    // poll สำรอง เผื่อ realtime หลุดเงียบๆ — ทำงานคู่ขนานกับ subscribe ด้านบน ไม่ทดแทนกัน
    const myPaymentPollInterval = setInterval(fetchMyPayment, 4000);

    return () => {
      supabase.removeChannel(myPaymentChannel);
      clearInterval(myPaymentPollInterval);
    };
  }, [currentJobId]);

  // ลูกค้าแนบสลิปใหม่หลังช่างปฏิเสธสลิปเดิม — อัปโหลดไฟล์ใหม่ทับที่ bucket เดิม แล้วอัปเดต
  // แถวเดิมในตาราง payments (ไม่สร้างแถวใหม่ เพื่อให้ประวัติการปฏิเสธ/ยืนยันอยู่ที่แถวเดียวกัน)
  // สถานะกลับไปเป็น 'pending' ให้ช่างตรวจสอบใหม่อีกครั้ง
  // รายงานปัญหา/ร้องเรียนงานที่จบไปแล้ว — ยังไม่มีตาราง dispute หรือแอปแอดมินแยกต่างหากในระบบนี้
  // เลยส่งเป็นข้อความพิเศษ (คำนำหน้า [REPORT]) เข้าแชตของงานนั้นแทน — ใช้ได้เฉพาะงานที่มี job_id
  // จริงจาก Supabase เท่านั้น (รายการประวัติเก่าที่เป็นข้อมูลตัวอย่าง เช่น 'JOB-20260210' จะ insert
  // ไม่ผ่านเพราะไม่ตรงกับ job จริงในระบบ — ครอบ try/catch ไว้กันแอปพังถ้าเจอกรณีนี้)
  const handleReportServiceIssue = async (jobId: string) => {
    const reason = window.prompt(t.reportIssuePrompt);
    if (!reason || !reason.trim()) return;
    try {
      await sendChatMessage({ jobId, sender: 'customer', text: `[REPORT] ลูกค้ารายงานปัญหา: ${reason.trim()}` });
      setAppToast({ message: t.reportSentToast, type: 'success' });
    } catch (err) {
      console.error('Error reporting job issue:', err);
      setAppToast({ message: t.reportFailedToast, type: 'error' });
    }
  };

  // แก้ให้เขียนผ่าน RPC ทั้งคู่ (recordJobPayment / sendChatMessage) แทนการ .update()/.insert()
  // ตรงเข้าตาราง — เดิมโดน RLS บล็อกเงียบๆ ทั้งคู่ (ดูคอมเมนต์ตอน import ด้านบนไฟล์) ทำให้
  // status ไม่เคยเปลี่ยนเป็น 'pending' จริงใน DB และข้อความแจ้งช่างก็ไม่เคยถูกบันทึกจริงเลย
  // แม้ toast จะขึ้นว่า "สำเร็จ" ก็ตาม (เพราะ error ถูกกลืนไปแค่ console.error)
  const handleReuploadSlip = async () => {
    if (!reslipFile || !myPayment || !currentJobId) return;
    setIsReuploadingSlip(true);
    try {
      const fileExt = reslipFile.name.split('.').pop() || 'jpg';
      const filePath = `${myPayment.id}-reupload-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-slips')
        .upload(filePath, reslipFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('payment-slips').getPublicUrl(filePath);

      // record_job_payment เป็น RPC เดียวกับตอนจองงาน (upsert ทับแถวเดิมของ job นี้ ไม่สร้างแถวใหม่)
      // ต้องส่ง amount เดิมกลับไปด้วยเสมอ ไม่งั้นค่าฝั่ง server อาจถูกเขียนทับด้วยค่าว่าง/ผิดยอด
      await recordJobPayment({
        jobId: currentJobId,
        amount: myPayment.amount ?? 0,
        paymentMethod: 'promptpay',
        slipUrl: publicUrlData.publicUrl,
      });

      setMyPayment((prev) => (prev ? { ...prev, slip_url: publicUrlData.publicUrl, status: 'pending' } : prev));
      setReslipFile(null);
      if (reslipFileInputRef.current) reslipFileInputRef.current.value = '';
      if (reslipChatFileInputRef.current) reslipChatFileInputRef.current.value = '';
      setAppToast({ message: t.slipReattachedToast, type: 'success' });

      // แจ้งช่างเข้าแชทอัตโนมัติทันทีที่ส่งสลิปใหม่สำเร็จ พร้อมลิงก์สลิป — เดิมช่างไม่มีทางรู้เลยว่า
      // ลูกค้าส่งสลิปใหม่มาหรือยัง นอกจากเปิดหน้ารายละเอียดงานเข้าไปเช็คเอง
      const notifyText = `แนบสลิปโอนเงินใหม่แล้ว กรุณาตรวจสอบอีกครั้ง: ${publicUrlData.publicUrl}`;
      setChatMessages((prev) => [...prev, { sender: 'user', text: notifyText }]);
      try {
        await sendChatMessage({ jobId: currentJobId, sender: 'customer', text: notifyText });
      } catch (chatErr) {
        console.error('Error notifying tech about new slip:', chatErr);
      }
    } catch (err) {
      console.error('Error re-uploading payment slip:', err);
      setAppToast({ message: t.slipReattachFailedToast, type: 'error' });
    } finally {
      setIsReuploadingSlip(false);
    }
  };

  // 1. ดักฟังเมื่อช่างฝั่ง t3 กดรับงาน / อัปเดตสถานะงานระหว่างทาง
  // เดิมเปิด supabase.channel(...) เอง เปลี่ยนมาใช้ subscribeJob() จาก lib/dtc-api.ts แทน
  //
  // applyJobStatus คือ logic กลางที่ใช้ทั้ง 2 ทาง:
  //  (a) ตอนเปิดหน้า/ได้ currentJobId มาใหม่ — ดึงสถานะจริงจาก DB ด้วย getJob() ทันที (silent = true,
  //      ไม่ต้องเด้ง toast ย้อนหลังสำหรับ event ที่พลาดไปแล้ว)
  //  (b) ตอนมี Realtime event ใหม่เข้ามาจริงๆ ระหว่างที่หน้าเปิดอยู่ (silent = false, เด้ง toast ปกติ)
  //
  // เหตุผลที่ต้องมี (a): Supabase Realtime ส่งเฉพาะ event ที่เกิด "หลังจาก" channel
  // subscribe เสร็จเท่านั้น (เป็นสตรีมสด ไม่ใช่คิวเก็บของเก่า) ถ้าช่างกดรับงาน+เปลี่ยนสถานะเร็ว
  // กว่าที่ channel ฝั่งลูกค้าจะพร้อม เหตุการณ์ตรงกลาง (เช่น 'accepted') จะหลุดหายไปเลย ทำให้
  // techAccepted ไม่เคยถูกตั้งเป็น true และการ์ด "กำลังหาช่าง..." ค้างอยู่ทั้งที่งานอาจจบไปแล้ว
  const applyJobStatus = (job: TowJob, opts: { silent?: boolean } = {}) => {
    const jobStatus = job.status;
    const silent = opts.silent ?? false;

    // ครอบคลุมทุกสถานะตั้งแต่ 'accepted' เป็นต้นไป ไม่ใช่แค่ดักจับ event 'accepted' แบบเป๊ะๆ
    // เผื่อกรณีพลาด 'accepted' ไปแล้วมาเจอ en_route/arrived/... เป็นสถานะแรกที่ได้รับแทน
    const techIsEngaged = jobStatus !== 'pending' && jobStatus !== 'cancelled';
    if (techIsEngaged && !techAccepted) {
      setAssignedTech({
        id: job.assignedTechId || mockAssignedTech.id,
        name: job.assignedTechName || mockAssignedTech.name,
        phone: job.assignedTechPhone || mockAssignedTech.phone,
        rating: job.assignedTechRating ?? mockAssignedTech.rating,
        jobs: job.assignedTechJobs ?? mockAssignedTech.jobs,
        plateNumber: job.assignedTechPlate || mockAssignedTech.plateNumber,
        photoUrl: mockAssignedTech.photoUrl,
        status: 'working',
      });
      setTechAccepted(true);
      setActiveTab('activity');
      setShowTrackingDetail(true);
      if (!silent) {
        setAppToast({
          message: `${job.assignedTechName || t.techLabelGeneric} ${t.techAcceptedNotif}`,
          type: 'success',
        });
      }
    }

    // สถานะถัดไปของงาน ที่ฝั่งช่าง (t3) เป็นคนกดอัปเดตจริงระหว่างทาง —
    // แผนที่ฝั่งลูกค้าต้องขยับตามสถานะจริงเหล่านี้ ไม่ใช่ตัวจับเวลาจำลองอีกต่อไป
    switch (jobStatus) {
      case 'accepted':
        setTrackingPhase('moving_to_red');
        setTruckProgress(15);
        break;
      case 'en_route':
        setTrackingPhase('moving_to_red');
        setTruckProgress(35);
        break;
      case 'arrived':
        setTrackingPhase(currentIssueConfig.requiresTow ? 'loading' : 'on_site');
        setTruckProgress(50);
        if (!silent) setAppToast({ message: t.techArrivedToast, type: 'success' });
        break;
      case 'loading':
        setTrackingPhase('loading');
        setTruckProgress(50);
        if (!silent) setAppToast({ message: t.techLoadingCarToast, type: 'success' });
        break;
      case 'delivering':
        setTrackingPhase('moving_to_green');
        setTruckProgress(75);
        if (!silent) setAppToast({ message: t.carLoadedHeadingToGarageToast, type: 'success' });
        break;
      case 'completed':
        setTrackingPhase('completed');
        setTruckProgress(100);
        setShowReviewModal(true);
        break;
      default:
        break;
    }
  };

  // ยกเลิกงานที่ลูกค้าเพิ่งเรียก — ทำได้เฉพาะตอนยังไม่มีช่างรับงาน (ก่อน techAccepted เป็น true
  // เท่านั้น ตรงกับที่ RPC ฝั่ง server อนุญาต ดูคอมเมนต์ cancelJob() ใน dtc-api.ts) ปุ่มนี้จะไม่โชว์
  // เลยถ้ามีช่างรับงานไปแล้ว เพื่อไม่ให้ลูกค้ากดแล้วเจอ error จาก RPC
  const [isCancellingJob, setIsCancellingJob] = useState<boolean>(false);
  const handleCancelJob = async () => {
    if (!currentJobId || isCancellingJob) return;
    setIsCancellingJob(true);
    try {
      await cancelJob(currentJobId);
      setHasActiveBooking(false);
      setCurrentJobId(null);
      setTechAccepted(false);
      setShowTrackingDetail(false);
      setAppToast({ message: t.cancelJobSuccessToast, type: 'success' });
    } catch (err: any) {
      console.error('Error cancelling job:', err);
      setAppToast({
        message: err?.message || t.cancelJobFailedToast,
        type: 'error',
      });
    } finally {
      setIsCancellingJob(false);
    }
  };

  // 1a. ดึงสถานะจริงจาก DB ทันทีตอนได้ currentJobId มา (เปิดหน้า/รีเฟรช/กลับมาจากพื้นหลัง)
  // เพื่อไม่ให้พลาด event ที่เกิดขึ้นก่อน Realtime channel จะเชื่อมต่อเสร็จ
  useEffect(() => {
    if (!currentJobId) return;
    let cancelled = false;
    getJob(currentJobId)
      .then((job) => {
        if (!cancelled && job) applyJobStatus(job, { silent: true });
      })
      .catch((err) => {
        console.error('Error fetching current job status:', err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId]);

  // 1b. ดักฟังอัปเดตสดต่อจากนั้นด้วย Realtime
  useEffect(() => {
    if (!currentJobId) return;
    const unsubscribe = subscribeJob(currentJobId, (job) => applyJobStatus(job, { silent: false }));
    return unsubscribe;
  }, [currentJobId, techAccepted]);

  // 1b-ii. Polling สำรอง เผื่อ event Realtime ของ 'completed' หลุดหายไประหว่างทาง (เน็ตสะดุด,
  // แอปถูกส่งไปพื้นหลังแล้วกลับมา, ฯลฯ) — เดิมพึ่ง subscribeJob() อย่างเดียว ถ้า event สุดท้าย
  // (ช่างกดจบงาน) ไม่มาถึงจริงๆ หน้าจอลูกค้าจะค้างอยู่ที่แผนที่ตลอดไป ทั้งที่งานจบไปแล้วจริงและ
  // ควรเด้งไปหน้าให้คะแนน/รีวิวแทน จึง poll ทุก 5 วินาทีเพื่อดึงสถานะจริงจาก DB มา sync ซ้ำ
  // เป็นตาข่ายนิรภัยเสริมจาก Realtime ไม่ได้แทนที่ — หยุด poll เองทันทีที่งานถึงสถานะจบสิ้นแล้ว
  useEffect(() => {
    if (!currentJobId || trackingPhase === 'completed') return;
    const intervalId = setInterval(() => {
      getJob(currentJobId)
        .then((job) => {
          if (job) applyJobStatus(job, { silent: false });
        })
        .catch((err) => {
          console.error('Error polling job status:', err);
        });
    }, 5000);
    return () => clearInterval(intervalId);
  }, [currentJobId, trackingPhase]);

  // 1b. ดักฟังสถานะสดของช่าง (online / working / break / offline) + พิกัด GPS จริง จากตาราง technicians
  // เพื่อให้แดชบอร์ดและแผนที่ฝั่งลูกค้าอัปเดตตามข้อมูลจริงของช่างที่ได้รับมอบหมาย
  useEffect(() => {
    if (!assignedTech.id) return;

    const fetchTechStatus = async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('status, current_lat, current_lng')
        .eq('id', assignedTech.id)
        .single();
      if (error) {
        console.error('Error fetching technician status:', error);
      }
      if (data?.status) {
        setAssignedTech((prev) => ({ ...prev, status: data.status }));
      }
      if (data?.current_lat != null && data?.current_lng != null) {
        setTechLiveCoords({ lat: data.current_lat, lng: data.current_lng });
      }
    };
    fetchTechStatus();

    const techStatusChannel = supabase
      .channel(`tech_status_${assignedTech.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'technicians',
          filter: `id=eq.${assignedTech.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row?.status) {
            setAssignedTech((prev) => ({ ...prev, status: row.status }));
          }
          if (row?.current_lat != null && row?.current_lng != null) {
            setTechLiveCoords({ lat: row.current_lat, lng: row.current_lng });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(techStatusChannel);
    };
  }, [assignedTech.id]);

  // 1c. คำนวณ ETA จริงจากตำแหน่ง GPS สดของช่าง -> จุดเกิดเหตุ ทุกครั้งที่พิกัดช่างขยับ
  // (เดิมค่านี้ค้างอยู่ที่ etaTotalMinutes ตัวเดียวตลอด เพราะ getEtaMinutesRemaining() อิงจาก
  // truckProgress ซึ่งไม่มีจุดไหนอัปเดตให้เลย — ตอนนี้ผูกกับตำแหน่งจริงผ่าน compute-route
  // (OSRM) แทน ถ้าช่างอยู่จุดเดียวกับจุดเกิดเหตุ ตัวเลขจะเหลือใกล้ 0 นาทีจริง ไม่ใช่ค้างที่ 15)
  useEffect(() => {
    if (trackingPhase !== 'moving_to_red' || !techLiveCoords || !liveCoords) return;
    let cancelled = false;
    computeRoute(techLiveCoords, liveCoords).then((route) => {
      if (!cancelled && route) setEtaTotalMinutes(Math.max(0, Math.round(route.durationMinutes)));
    });
    return () => {
      cancelled = true;
    };
  }, [techLiveCoords, trackingPhase, liveCoords]);

  // 2. ดักฟังข้อความแชตใหม่แบบ Realtime
  useEffect(() => {
    if (!currentJobId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('job_id', currentJobId)
        .order('created_at', { ascending: true });

      if (data) {
        const mapped: { sender: 'user' | 'tech'; text: string }[] = data.map(m => ({
          sender: m.sender === 'customer' ? 'user' : 'tech',
          text: m.text
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
      .channel(`chat_${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `job_id=eq.${currentJobId}`
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.sender !== 'customer') {
            setChatMessages((prev) => [
              ...prev,
              { sender: 'tech', text: newMsg.text }
            ]);
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
  }, [currentJobId]);

  // 3. ดักฟังสัญญาณโทรแบบเรียลไทม์กับช่าง (Supabase Broadcast) — ใช้ช่องสัญญาณเดียวกับฝั่งช่าง `call_{jobId}`
  // เมื่อช่างกดโทรหาลูกค้า หน้าจอ "สายเรียกเข้า" จะเด้งขึ้นทันทีที่ฝั่งลูกค้า และในทางกลับกันก็เช่นกัน
  useEffect(() => {
    if (!currentJobId) {
      callChannelRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`call_${currentJobId}`)
      .on('broadcast', { event: 'call_ring' }, ({ payload }) => {
        if (payload?.from === 'tech') {
          setIncomingCallInfo({ name: payload.name || assignedTech.name, phone: payload.phone || assignedTech.phone });
          setShowIncomingCallModal(true);
        }
      })
      .on('broadcast', { event: 'call_end' }, ({ payload }) => {
        if (payload?.from === 'tech') {
          setShowIncomingCallModal(false);
          setShowCallingModal(false);
        }
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      callChannelRef.current = null;
    };
  }, [currentJobId]);

  const languageList: { code: Language; label: string; name: string; FlagComponent: React.FC }[] = [
    { code: 'TH', label: 'TH', name: 'ภาษาไทย (TH)', FlagComponent: FlagTH },
    { code: 'EN', label: 'EN', name: 'English (EN)', FlagComponent: FlagGB },
    { code: 'CN', label: 'CN', name: '中文 (CN)', FlagComponent: FlagCN },
  ];

  const currentLangObj = languageList.find((item) => item.code === lang);

  // หมายเหตุ: id ยังคงเป็นคีย์ภาษาไทยตายตัวโดยตั้งใจ (ใช้จับคู่กับ ISSUE_SERVICE_CONFIG และ
  // ถูกส่งเป็น issueType ไปที่ backend ตรงๆ) — แปลแค่ label ที่แสดงผลให้ตรงภาษาที่เลือก (lang)
  const issueTypes = [
    { id: 'รถเสีย', label: t.issueBreakdown, icon: Car },
    { id: 'แบตหมด', label: t.issueBattery, icon: ActivityIcon },
    { id: 'ยางแตก', label: t.issueTire, icon: Wrench },
    { id: 'น้ำมันหมด', label: t.issueFuel, icon: Fuel },
    { id: 'อื่นๆ', label: t.issueOther, icon: AlertTriangle },
  ];

  // อาการไหนไม่ต้องใช้รถลาก/สไลด์ (ราคาถูกกว่า และต้องแมทช์ช่างเฉพาะทาง แทนช่างรถลาก)
  // requiresTow: true ใช้ตัวเลือกรถสไลด์/รถยกแบบเดิม, false ใช้ specialty + basePrice ด้านล่างแทน
  const ISSUE_SERVICE_CONFIG: Record<string, { requiresTow: boolean; specialty?: string; label?: string; basePrice?: number }> = {
    'รถเสีย': { requiresTow: true },
    'แบตหมด': { requiresTow: false, specialty: 'jump_start', label: t.jumpStartService, basePrice: 400 },
    'ยางแตก': { requiresTow: false, specialty: 'tire_change', label: t.tireChangeService, basePrice: 350 },
    // ราคาตั้งเท่ากับ jump_start ไว้ก่อน (ทั้งคู่คือ "ช่างขับรถมาช่วยที่จุดเกิดเหตุ ไม่ต้องลาก")
    // ปรับตัวเลขนี้ได้ตามต้นทุนน้ำมัน/ระยะทางจริงภายหลัง ไม่กระทบโครงสร้างโค้ด
    'น้ำมันหมด': { requiresTow: false, specialty: 'fuel_delivery', label: t.fuelDeliveryService, basePrice: 400 },
    'อื่นๆ': { requiresTow: true },
  };
  const currentIssueConfig = ISSUE_SERVICE_CONFIG[towingRequest.selectedIssue] ?? { requiresTow: true };

  // เพิ่ม: preview "มีช่างว่างใกล้จุดคุณกี่คน ใกล้สุดกี่กม." โชว์ก่อนกดยืนยันเรียกช่าง — เดิม
  // ลูกค้ากดยืนยันแล้วรอเงียบๆ ไม่รู้เลยว่ามีช่างแถวนั้นจริงไหม (ดู 0012_nearest_tech_offer_
  // dispatch.sql ฝั่ง backend ที่ทำให้ระบบเสนองานให้ช่างใกล้สุดจริงๆ ด้วย) ยิงใหม่ทุกครั้งที่
  // ตำแหน่ง GPS หรือประเภทปัญหาที่เลือกเปลี่ยน ไม่ต้องรอกดยืนยันก่อนถึงจะรู้
  const [nearbyPreview, setNearbyPreview] = useState<NearbyTechPreview | null>(null);
  const [nearbyPreviewLoading, setNearbyPreviewLoading] = useState(false);
  const requiredSpecialtyForPreview = currentIssueConfig.requiresTow ? 'tow' : (currentIssueConfig.specialty ?? 'tow');
  useEffect(() => {
    if (!liveCoords) {
      setNearbyPreview(null);
      return;
    }
    let cancelled = false;
    setNearbyPreviewLoading(true);
    getNearbyTechPreview(liveCoords, requiredSpecialtyForPreview)
      .then((preview) => {
        if (!cancelled) setNearbyPreview(preview);
      })
      .finally(() => {
        if (!cancelled) setNearbyPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [liveCoords?.lat, liveCoords?.lng, requiredSpecialtyForPreview]);

  // ขอบเขตแผนที่ (bbox) เดิมที่คำนวณเองเทียบ % สำหรับ overlay หมุดบน iframe static ถูกลบออก
  // ทั้งหมดแล้ว — ย้ายไปให้ Leaflet (components/LiveTrackingMap.tsx) จัดการ pan/zoom/fit bounds
  // เองโดยตรงจากพิกัด lat/lng จริง แม่นกว่าการคำนวณ % เทียบ bbox เอง และลาก/ซูมได้จริงด้วย
  // ตำแหน่งจำลอง (fallback ตอนยังไม่มี techLiveCoords) ก็ถูกตัดออกเช่นกัน — ให้แผนที่บอกตามตรง
  // ว่า "กำลังรอสัญญาณ GPS จากช่าง..." แทนที่จะแกล้งขยับหมุดตามเวลา ให้ตรงกับที่ขอ "แผนที่ GPS
  // ต้องเป็นของจริงแบบ real-time" มากขึ้น

  // เวลาที่เหลือ (นาที) ก่อนช่างจะถึงจุดเกิดเหตุ — เดิมคำนวณจาก truckProgress ซึ่งเป็นตัวเลข
  // จำลองที่ไม่มีจุดไหนอัปเดตจริง (ค้างที่ 0 เสมอ) ทำให้ ETA โชว์ค่าตั้งต้นตลอดไม่ว่าช่างจะ
  // อยู่ตรงไหน — ตอนนี้ etaTotalMinutes ถูกอัปเดตสดจาก compute-route ทุกครั้งที่ตำแหน่ง GPS
  // จริงของช่าง (techLiveCoords) ขยับแล้ว (ดู useEffect "1c." ด้านบน) จึงคืนค่าตรงๆ ได้เลย
  const getEtaMinutesRemaining = () => {
    if (trackingPhase === 'moving_to_red') {
      return Math.max(0, etaTotalMinutes);
    }
    return 0; // ช่างถึงจุดเกิดเหตุแล้ว (กำลังยกรถ/นำส่งอู่)
  };

  // ป้ายสถานะช่างบนการ์ด "MECHANIC INFO & CONTACT" — เดิมอิงจาก assignedTech.status
  // ('online'/'working'/'break'/'offline') ที่ดึงมาจากตาราง technicians ตรงๆ ซึ่งเป็นสถานะ
  // "รับงานได้ทั่วไป" ของช่าง ไม่ใช่ความคืบหน้าของงานลูกค้าคนนี้จริงๆ — และเนื่องจากฝั่งช่าง
  // (t3.txt) บังคับไม่ให้เปลี่ยนสถานะเป็น break/offline ได้เลยตราบใดที่มีงานค้างอยู่ (ดู
  // changeStatus() ที่เช็ค activeJob) สถานะนี้จึงค้างเป็น 'working' ตลอดทั้งงานอยู่แล้ว ทำให้
  // ป้ายค้างที่ "ช่างกำลังทำงาน" ตัวเดียวไม่ขยับเลยตั้งแต่รับงานจนจบงาน ไม่ตรงกับความคืบหน้าจริง
  // ที่กำลังเกิดขึ้น (กำลังเดินทางมา/ถึงแล้ว/กำลังยกรถ/กำลังนำส่งอู่) ซึ่งมีอยู่แล้วใน trackingPhase
  // (ใช้ตัวเดียวกับ statusLabel ของ LiveTrackingMap ด้านล่าง เพื่อให้ 2 จุดนี้บอกตรงกันเสมอ)
  // เปลี่ยนมาให้ป้ายนี้สะท้อน trackingPhase แทน ส่วน break/offline ยังคงเก็บไว้เป็นข้อมูลสำรอง
  // เผื่อกรณีขอบ (เช่น ช่างหลุดออฟไลน์กะทันหันระหว่างงานจริงๆ)
  const techStatusDisplay = (() => {
    // 'break'/'offline' คือสถานะจริงของช่างจากตาราง technicians (ไม่ใช่ความคืบหน้างาน) —
    // โชว์ก่อนเป็นอันดับแรกเสมอ เพราะสำคัญกว่า trackingPhase (ลูกค้าควรรู้ทันทีถ้าช่างพัก/หลุด
    // ออฟไลน์ระหว่างงาน แม้ trackingPhase จะยังค้างอยู่ที่เฟสเดิมก็ตาม)
    if (assignedTech.status === 'break') {
      return { label: t.techOnBreak, dotClass: 'bg-amber-400' };
    }
    if (assignedTech.status === 'offline') {
      return { label: t.techOffline, dotClass: 'bg-slate-400' };
    }
    switch (trackingPhase) {
      case 'moving_to_red':
        return { label: t.techEnRoute, dotClass: 'bg-emerald-500' };
      case 'loading':
        return { label: t.techLoading, dotClass: 'bg-emerald-500' };
      case 'on_site':
        return { label: t.techOnSite, dotClass: 'bg-emerald-500' };
      case 'moving_to_green':
        return { label: t.techToGarage, dotClass: 'bg-emerald-500' };
      case 'completed':
        return { label: t.techCompleted, dotClass: 'bg-slate-400' };
      default:
        return { label: t.techWorking, dotClass: 'bg-emerald-500' };
    }
  })();

  return (
    <div className="flex min-h-screen w-full items-stretch justify-center bg-slate-900 font-sans antialiased">
      {/* หมายเหตุ: เอากรอบมือถือจำลอง (fixed 390x844px + ขอบดำ + มุมโค้ง) ออก เพราะตอนรันเป็น
          native app ผ่าน Capacitor จอจริงของเครื่องมีขนาด/รอยบากอยู่แล้ว ไม่ต้องจำลองซ้ำ
          เพิ่ม class "transform" ไว้เหมือนเดิมเพื่อทำให้กรอบนี้เป็น containing block
          ของ position:fixed ทั้งหมดที่อยู่ข้างใน (modal, popup, alert) จะได้ไม่หลุดออกไปเต็มจอ */}
      <div className="relative h-dvh w-full max-w-[480px] overflow-hidden bg-black shadow-2xl transform">
        
        {/* Dynamic OTP Banner */}
        {showOtpNotification && (
          <div className="absolute top-10 left-3 right-3 z-50 rounded-2xl bg-slate-900/90 text-white p-3 shadow-2xl backdrop-blur-md border border-slate-700 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex justify-between font-bold text-slate-300 text-[10px]">
                <span>MESSAGES</span>
                <span>now</span>
              </div>
              <p className="font-semibold text-white mt-0.5">
                Your OTP code is <span className="text-cyan-400 font-extrabold">{generatedOtp}</span>
              </p>
            </div>
          </div>
        )}

        {/* Status Bar เอาออกทั้งหมดแล้ว (ทุกหน้ารวม Home) — ตอนรันเป็น native app ผ่าน
            Capacitor จอเครื่องมีแถบสถานะจริงอยู่แล้ว ไม่ต้องจำลองซ้ำ */}

        {/* Main View Area */}
        <div className="h-full w-full bg-white flex flex-col justify-between overflow-y-auto">

          {/* STEP 1: Splash Screen */}
          {step === 1 && (
            <div 
              onClick={goPastSplash}
              className="flex h-full flex-col items-center justify-center p-6 pt-12 text-center cursor-pointer select-none"
            >
              <div className="relative h-48 w-full max-w-[280px]">
                <Image
                  src="/logodtc1.png"
                  alt="DTC Intelligent Towing Logo"
                  fill
                  sizes="280px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          )}

          {/* STEP 2: Welcome Screen */}
          {step === 2 && (
            <div className="relative flex h-full flex-col justify-between overflow-hidden">
              <div className="relative w-full h-[62%] overflow-hidden">
                <Image
                  src="/w7.JPG"
                  alt="Towing Service"
                  fill
                  sizes="100vw"
                  className="object-cover object-top"
                  priority
                />
              </div>

              <div className="relative z-10 flex flex-1 flex-col justify-between bg-white px-6 pt-4 pb-6 -mt-6 rounded-t-3xl shadow-2xl">
                <div className="grid grid-cols-3 gap-2.5 my-auto">
                  <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100 shadow-xs flex flex-col items-center justify-center">
                    <ShieldCheck className="h-7 w-7 text-cyan-500 mb-1.5" />
                    <p className="text-[11px] font-bold text-slate-800">Reliable</p>
                    <p className="text-[8px] text-slate-400 leading-tight mt-0.5">Professional towing</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100 shadow-xs flex flex-col items-center justify-center">
                    <MapPin className="h-7 w-7 text-cyan-500 mb-1.5" />
                    <p className="text-[11px] font-bold text-slate-800">Real-time</p>
                    <p className="text-[8px] text-slate-400 leading-tight mt-0.5">Live tracking</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 text-center border border-slate-100 shadow-xs flex flex-col items-center justify-center">
                    <Clock className="h-7 w-7 text-cyan-500 mb-1.5" />
                    <p className="text-[11px] font-bold text-slate-800">24/7 Support</p>
                    <p className="text-[8px] text-slate-400 leading-tight mt-0.5">Always here</p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex justify-center gap-1.5">
                    <div className="h-1.5 w-6 rounded-full bg-cyan-500" />
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 py-3.5 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
                  >
                    {t.next}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Terms Screen */}
          {step === 3 && (
            <div className="relative flex h-full flex-col justify-between overflow-hidden">
              <button 
                onClick={() => setStep(2)} 
                className="absolute top-12 left-6 z-50 rounded-full bg-white/80 p-2 text-slate-700 backdrop-blur-md shadow-md hover:bg-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="relative w-full h-[65%] overflow-hidden">
                <Image
                  src="/w3.JPG"
                  alt="Accept Terms"
                  fill
                  sizes="100vw"
                  className="object-cover object-top"
                  priority
                />
              </div>

              <div className="relative z-10 flex flex-1 flex-col justify-between bg-white px-6 pt-6 pb-6 -mt-6 rounded-t-3xl shadow-2xl">
                <div className="my-auto text-center">
                  <p className="text-xs text-slate-500 px-2 leading-relaxed font-medium">
                    {t.agreeTermsText}
                    <span 
                      onClick={() => setShowTermsModal(true)} 
                      className="text-cyan-500 underline cursor-pointer font-bold"
                    >
                      {t.termsLink}
                    </span>
                    {t.andText}
                    <span 
                      onClick={() => setShowPrivacyPolicyModal(true)} 
                      className="text-cyan-500 underline cursor-pointer font-bold"
                    >
                      {t.privacyLink}
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => setStep(4)}
                  className="w-full rounded-full bg-cyan-500 py-3.5 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
                >
                  {t.acceptTermsBtn}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: AI Matching Screen */}
          {step === 4 && (
            <div className="relative flex h-full flex-col justify-between overflow-hidden">
              <button 
                onClick={() => setStep(3)} 
                className="absolute top-12 left-6 z-50 rounded-full bg-white/80 p-2 text-slate-700 backdrop-blur-md shadow-md hover:bg-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="relative w-full h-[65%] overflow-hidden">
                <Image
                  src="/w2.JPG"
                  alt="AI Fleet Optimizer"
                  fill
                  sizes="100vw"
                  className="object-cover object-top"
                  priority
                />
              </div>

              <div className="relative z-10 flex flex-1 flex-col justify-between bg-white px-6 pt-6 pb-6 -mt-6 rounded-t-3xl shadow-2xl">
                <div>
                  <p className="text-center text-xs leading-relaxed text-slate-600 px-2 font-medium">
                    {t.aiDescription}
                  </p>

                  <div className="mt-4 flex justify-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                    <div className="h-1.5 w-6 rounded-full bg-cyan-500" />
                  </div>
                </div>

                <button
                  onClick={() => setStep(5)}
                  className="w-full rounded-full bg-cyan-500 py-3.5 text-sm font-semibold text-white shadow-md active:scale-95 transition-transform"
                >
                  {t.getStarted}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Login / Register Form */}
          {step === 5 && (
            <div className="relative flex h-full flex-col justify-between bg-white px-5 pb-6 overflow-y-auto">
              
              <div className="relative flex items-center justify-between z-30 pt-1">
                {authTab === 'newAccount' ? (
                  <button 
                    onClick={() => setAuthTab('login')}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white shadow-xs active:scale-95 transition-transform"
                  >
                    <ArrowLeft className="h-4 w-4 stroke-[3]" />
                  </button>
                ) : (
                  <div />
                )}

                {/* Dropdown List เปลี่ยนภาษาพร้อมธงชาติ */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLangDropdown(!showLangDropdown)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition-colors active:scale-95"
                  >
                    {currentLangObj && <currentLangObj.FlagComponent />}
                    <span>{currentLangObj?.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showLangDropdown && (
                    <div className="absolute right-0 mt-1.5 w-36 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                      {languageList.map((item) => {
                        const Flag = item.FlagComponent;
                        return (
                          <button
                            key={item.code}
                            type="button"
                            onClick={() => {
                              handleLanguageChange(item.code);
                              setShowLangDropdown(false);
                            }}
                            className={`flex w-full items-center justify-start gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                              lang === item.code ? 'bg-cyan-50 text-cyan-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Flag />
                            <span>{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center my-2">
                <div className="relative h-44 w-full max-w-[260px] mb-1">
                  <Image
                    src="/logodtc1.png"
                    alt="Intelligent Towing Logo"
                    fill
                    sizes="260px"
                    className="object-contain"
                    priority
                  />
                </div>
                {authTab === 'newAccount' && (
                  <div className="text-center px-2">
                    <h2 className="text-xs font-bold text-slate-800 leading-tight">
                      {t.regTitle}
                    </h2>
                  </div>
                )}
              </div>

              <div className="bg-white p-1 my-auto">
                <div className="flex rounded-2xl bg-slate-100/80 p-1 mb-3">
                  <button
                    onClick={() => {
                      setAuthTab('login');
                      setEmailError(false);
                      setPasswordError('');
                    }}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all ${
                      authTab === 'login'
                        ? 'bg-white text-cyan-500 shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    🔑 {t.login}
                  </button>
                  <button
                    onClick={() => {
                      setAuthTab('newAccount');
                      setEmailError(false);
                      setPasswordError('');
                    }}
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all ${
                      authTab === 'newAccount'
                        ? 'bg-white text-cyan-500 shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    👤 {t.newAccount}
                  </button>
                </div>

                {authTab === 'login' ? (
                  <form onSubmit={handleLoginSubmit} className="space-y-3">
                    <div>
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          if (e.target.value.trim() !== '') setEmailError(false);
                        }}
                        placeholder={t.emailPlaceholder}
                        className={`w-full rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all ${
                          emailError 
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100 focus:border-red-500' 
                            : 'border border-slate-200 bg-slate-50 focus:border-cyan-500 focus:bg-white'
                        }`}
                      />
                      {emailError && !loginEmail.trim() && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">
                          {t.emailRequiredErr}
                        </p>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          if (e.target.value.trim() !== '') setPasswordError('');
                        }}
                        placeholder={t.passwordPlaceholder}
                        className={`w-full rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all pr-10 ${
                          passwordError 
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100 focus:border-red-500' 
                            : 'border border-slate-200 bg-slate-50 focus:border-cyan-500 focus:bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {passwordError && (
                      <p className="text-[10px] font-semibold text-red-500 pl-1 -mt-2">
                        {passwordError}
                      </p>
                    )}

                    <div className="text-right">
                      <button 
                        type="button"
                        onClick={() => {
                          setResetContact(loginEmail);
                          setStep(6);
                        }}
                        className="text-[10px] font-semibold text-slate-800 hover:text-cyan-500 transition-colors"
                      >
                        {t.forgetPassword}
                      </button>
                    </div>

                    <button 
                      type="submit"
                      disabled={authSubmitting}
                      className="w-full rounded-full bg-cyan-500 py-3 text-xs font-bold text-white shadow-md active:scale-95 transition-transform mt-1 disabled:opacity-60 disabled:active:scale-100"
                    >
                      {authSubmitting ? t.signingInEllipsis : t.signIn}
                    </button>

                    <div className="text-center pt-1">
                      <p className="text-[10px] text-slate-500 leading-tight">
                        {t.agreeTermsText}
                        <button
                          type="button"
                          onClick={() => setShowTermsModal(true)}
                          className="text-cyan-500 underline font-bold hover:text-cyan-600"
                        >
                          {t.termsLink}
                        </button>
                        {t.andText}
                        <button
                          type="button"
                          onClick={() => setShowPrivacyPolicyModal(true)}
                          className="text-cyan-500 underline font-bold hover:text-cyan-600"
                        >
                          {t.privacyLink}
                        </button>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button 
                        type="button" 
                        onClick={() => setAuthTab('newAccount')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
                      >
                        <div className="flex h-4 w-4 items-center justify-center rounded-md bg-blue-500 text-white">
                          <Mail className="h-2.5 w-2.5" />
                        </div>
                        <span>{t.signUpEmail}</span>
                      </button>

                      <button 
                        type="button" 
                        onClick={handleLineSelect}
                        disabled={isLineAuthLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100"
                      >
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#06C755] text-white">
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 5.87 2 10.5c0 4.02 3.36 7.4 7.93 8.16-.11.5-.68 2.28-.78 2.63 0 0-.02.13.06.18.08.05.17.02.17.02.23-.03 2.65-1.75 3.73-2.47.62.09 1.26.14 1.89.14 5.52 0 10-3.87 10-8.66S17.52 2 12 2z" />
                          </svg>
                        </div>
                        <span>{isLineAuthLoading ? t.openingLinePageEllipsis : t.signUpLine}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <input
                        type="text"
                        placeholder={t.name}
                        value={registerForm.name}
                        onChange={(e) => handleRegisterInputChange('name', e.target.value)}
                        className={`w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regNameErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder={t.surname}
                        value={registerForm.surname}
                        onChange={(e) => handleRegisterInputChange('surname', e.target.value)}
                        className={`w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regSurnameErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                    </div>

                    <div>
                      <input
                        type="tel"
                        placeholder={t.phone}
                        value={registerForm.phoneNumber}
                        onChange={(e) => handleRegisterInputChange('phoneNumber', e.target.value)}
                        className={`w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regPhoneErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                    </div>

                    <div>
                      <input
                        type="email"
                        placeholder={t.emailPlaceholder}
                        value={registerForm.email}
                        onChange={(e) => {
                          handleRegisterInputChange('email', e.target.value);
                          setRegEmailErrMsg('');
                        }}
                        className={`w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regEmailErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                      {regEmailErrMsg && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{regEmailErrMsg}</p>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        placeholder={t.passwordPlaceholder}
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          if (e.target.value.trim()) setRegPasswordErr('');
                        }}
                        className={`w-full rounded-xl px-4 py-2 pr-10 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regPasswordErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRegPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      {regPasswordErr && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{regPasswordErr}</p>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        placeholder={t.confirmPasswordLabel}
                        value={regConfirmPassword}
                        onChange={(e) => {
                          setRegConfirmPassword(e.target.value);
                          if (e.target.value.trim()) setRegConfirmPasswordErr('');
                        }}
                        className={`w-full rounded-xl px-4 py-2 pr-10 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none transition-all shadow-xs ${
                          regConfirmPasswordErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200/50 bg-slate-100/80 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRegConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      {regConfirmPasswordErr && (
                        <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{regConfirmPasswordErr}</p>
                      )}
                    </div>

                    {/* กล่องเงื่อนไขรหัสผ่าน — ดีไซน์เดียวกับฝั่งช่าง */}
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {t.passwordMustContain}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${regPasswordChecks.length ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqLength}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${regPasswordChecks.uppercase ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqUppercase}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 ${regPasswordChecks.numberSpecial ? 'text-emerald-600' : 'text-slate-500'}`}>
                        <Check className="h-3 w-3" /> {t.pwdReqNumberSpecial}
                      </p>
                    </div>

                    {/* ยี่ห้อ/รุ่น/ทะเบียนรถ ย้ายออกจากหน้าสมัครสมาชิกแล้ว (รกเกินไป) —
                        ไปกรอกตอนเรียกช่างแทน ดูส่วน "ข้อมูลลูกค้า & รถยนต์" ในแท็บ request */}

                    <button
                      onClick={handleRegisterSubmit}
                      disabled={authSubmitting}
                      className="w-full rounded-full bg-cyan-500 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all mt-2 disabled:opacity-60 disabled:active:scale-100"
                    >
                      {authSubmitting ? t.signingUpEllipsis : t.next}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* STEP 6: Forget Password */}
          {step === 6 && (
            <div className="relative flex h-full flex-col justify-between bg-white pt-12 px-6 pb-8 overflow-y-auto">
              <button 
                onClick={() => setStep(5)} 
                className="absolute top-12 left-6 z-50 rounded-full bg-cyan-500 p-1.5 text-white shadow-md hover:bg-cyan-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center justify-center mt-6">
                <div className="relative h-48 w-full max-w-[280px] my-2 overflow-hidden rounded-2xl">
                  <Image
                    src="/w4.JPG"
                    alt="Forget Password Illustration"
                    fill
                    sizes="280px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-4 my-auto">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{t.forgetPasswordTitle}</h2>
                  <p className="text-xs text-slate-500 mt-1">{t.forgetPasswordSub}</p>
                </div>

                <div>
                  <input
                    type="text"
                    value={resetContact}
                    onChange={(e) => {
                      setResetContact(e.target.value);
                      if (e.target.value.trim() !== '') setContactError(false);
                    }}
                    placeholder="Email / Phone number"
                    className={`w-full rounded-2xl px-4 py-3.5 text-xs text-slate-800 focus:outline-none transition-all shadow-inner ${
                      contactError
                        ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                        : 'border border-slate-200 bg-slate-100 focus:bg-white focus:border-cyan-500'
                    }`}
                  />
                </div>

                <button
                  onClick={handleSendCode}
                  className="w-full rounded-full bg-cyan-500 py-3.5 text-xs font-bold text-white shadow-md active:scale-95 transition-transform mt-4"
                >
                  {t.sendCode}
                </button>
              </div>

              <div className="h-4" />
            </div>
          )}

          {/* STEP 7: Verification OTP */}
          {step === 7 && (
            <div className="relative flex h-full flex-col justify-between bg-white pt-12 px-6 pb-8 overflow-y-auto">
              <button 
                onClick={() => setStep(6)} 
                className="absolute top-12 left-6 z-50 rounded-full bg-cyan-500 p-1.5 text-white shadow-md hover:bg-cyan-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center justify-center mt-6">
                <div className="relative h-48 w-full max-w-[280px] my-2 overflow-hidden rounded-2xl">
                  <Image
                    src="/w5.JPG"
                    alt="OTP Verification Illustration"
                    fill
                    sizes="280px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-4 my-auto">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{t.verificationTitle}</h2>
                  <p className="text-xs text-slate-500 mt-1">{t.verificationSub}</p>
                </div>

                <div className="flex justify-between items-center gap-1.5 py-4">
                  {otpValues.map((val, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400 bg-slate-50 text-center text-base font-bold text-slate-800 shadow-xs focus:bg-white focus:border-cyan-600 focus:outline-none transition-all"
                    />
                  ))}
                </div>

                <button
                  onClick={() => setStep(8)}
                  className="w-full rounded-full bg-cyan-500 py-3.5 text-xs font-bold text-white shadow-md active:scale-95 transition-transform mt-2"
                >
                  {t.verify}
                </button>
              </div>

              <div className="h-4" />
            </div>
          )}

          {/* STEP 8: Create New Password */}
          {step === 8 && (
            <div className="relative flex h-full flex-col justify-between bg-white pt-12 px-6 pb-8 overflow-y-auto">
              <button 
                type="button"
                onClick={() => setStep(7)} 
                className="absolute top-12 left-6 z-50 rounded-full bg-cyan-500 p-1.5 text-white shadow-md hover:bg-cyan-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center justify-center mt-6">
                <div className="relative h-48 w-full max-w-[280px] my-2 overflow-hidden rounded-2xl">
                  <Image
                    src="/w6.JPG"
                    alt="Create New Password Illustration"
                    fill
                    sizes="280px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="flex flex-col space-y-4 my-auto">
                <h2 className="text-base font-bold text-slate-900">{t.createNewPasswordTitle}</h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 mb-1 block">
                      {t.newPasswordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPasswordVal}
                        onChange={(e) => {
                          setNewPasswordVal(e.target.value);
                          if (e.target.value.trim() !== '') setNewPasswordErr('');
                        }}
                        placeholder={t.newPasswordPlaceholder}
                        className={`w-full rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition-all pr-10 shadow-inner ${
                          newPasswordErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200 bg-slate-100 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {newPasswordErr && (
                      <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{newPasswordErr}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 mb-1 block">
                      {t.confirmPasswordLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPasswordVal}
                        onChange={(e) => {
                          setConfirmPasswordVal(e.target.value);
                          if (e.target.value.trim() !== '') setConfirmPasswordErr('');
                        }}
                        placeholder={t.confirmNewPasswordPlaceholder}
                        className={`w-full rounded-2xl px-4 py-3 text-xs text-slate-800 focus:outline-none transition-all pr-10 shadow-inner ${
                          confirmPasswordErr
                            ? 'border-2 border-red-500 bg-red-50 ring-2 ring-red-100'
                            : 'border border-slate-200 bg-slate-100 focus:bg-white focus:border-cyan-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    {confirmPasswordErr && (
                      <p className="mt-1 text-[10px] font-semibold text-red-500 pl-1">{confirmPasswordErr}</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-cyan-500 py-3.5 text-xs font-bold text-white shadow-md active:scale-95 transition-transform mt-4 hover:bg-cyan-600"
                >
                  {t.verify}
                </button>
              </form>

              <div className="h-4" />

              {showResetSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                  <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 shadow-inner">
                      <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">{t.resetSuccessTitle}</h3>
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                      {t.resetSuccessSub}
                    </p>
                    <button
                      type="button"
                      onClick={handleSuccessModalClose}
                      className="mt-6 w-full rounded-full bg-cyan-500 py-3 text-xs font-bold text-white shadow-md hover:bg-cyan-600 active:scale-95 transition-all"
                    >
                      {t.backToLogin}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 9: MAIN DASHBOARD */}
          {step === 9 && (
            <div className="relative flex h-full flex-col justify-between bg-slate-50 pb-16 overflow-hidden">
              
              {/* Top Navigation Bar */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3 bg-white border-b border-slate-100 z-30">
                {/* ปุ่มเปิด Sidebar (ปุ่ม 3 ขีด) */}
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md active:scale-95 transition-transform"
                >
                  <Menu className="h-5 w-5 stroke-[2.5]" />
                </button>
                <div className="text-center">
                  <span className="text-xs font-black text-slate-800 tracking-wide block uppercase">DTC SERVICE</span>
                  <span className="text-[9px] text-slate-400 font-bold block -mt-0.5">INTELLIGENT TOWING</span>
                </div>
                <button
                  onClick={() => setShowNotificationsPanel(true)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md active:scale-95 transition-transform"
                >
                  <Bell className="h-5 w-5 stroke-[2.5]" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              </div>

              {/* แถบเตือนเน็ตหลุด — โผล่เฉพาะตอน navigator.onLine เป็น false เท่านั้น ไม่กระทบ
                  เลย์เอาต์ปกติตอนเน็ตปกติ อยู่ใต้ Top Nav Bar ให้เห็นชัดโดยไม่บังเนื้อหา */}
              {!isOnline && (
                <div className="flex items-center justify-center gap-1.5 bg-red-500 px-4 py-1.5 text-[10px] font-bold text-white z-30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {t.offlineBannerText}
                </div>
              )}

              {/* SIDEBAR NAVIGATION */}
              {showSidebar && (
                <div className="absolute inset-0 z-50 flex animate-in fade-in duration-200">
                  {/* Backdrop Background */}
                  <div 
                    onClick={() => setShowSidebar(false)} 
                    className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" 
                  />

                  {/* Sidebar Drawer */}
                  <div className="relative w-[280px] h-full bg-white shadow-2xl flex flex-col justify-between p-5 pt-12 z-10 animate-in slide-in-from-left duration-300">
                    <div>
                      {/* Header Sidebar & Close Button */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-sky-500 text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                            {getUserDisplayName().charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">{getUserDisplayName()} {registerForm.surname}</h3>
                            <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{registerForm.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowSidebar(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Dropdown เลือกเปลี่ยนภาษาใน Sidebar */}
                      <div className="mt-3 relative">
                        <button
                          type="button"
                          onClick={() => setShowSidebarLangDropdown(!showSidebarLangDropdown)}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-sky-500" />
                            <span>{t.selectLanguage}: {currentLangObj?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {currentLangObj && <currentLangObj.FlagComponent />}
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showSidebarLangDropdown ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {showSidebarLangDropdown && (
                          <div className="absolute left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-50">
                            {languageList.map((item) => {
                              const Flag = item.FlagComponent;
                              return (
                                <button
                                  key={item.code}
                                  type="button"
                                  onClick={() => {
                                    handleLanguageChange(item.code);
                                    setShowSidebarLangDropdown(false);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                    lang === item.code ? 'bg-sky-50 text-sky-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>{item.name}</span>
                                  <Flag />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Menu List */}
                      <div className="mt-3 space-y-1">
                        <button 
                          onClick={() => { setActiveTab('home'); setShowSidebar(false); }}
                          className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'home' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Home className="h-4 w-4" />
                          <span>{t.sidebarHome}</span>
                        </button>

                        <button 
                          onClick={() => { setActiveTab('request'); setShowSidebar(false); }}
                          className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'request' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Wrench className="h-4 w-4" />
                          <span>{t.sidebarRequest}</span>
                        </button>

                        <button 
                          onClick={() => { setActiveTab('activity'); setShowSidebar(false); }}
                          className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'activity' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <History className="h-4 w-4" />
                          <span>{t.sidebarHistory}</span>
                        </button>

                        <div className="my-2 border-t border-slate-100" />

                        <button 
                          onClick={() => { setActiveTab('payment'); setShowSidebar(false); }}
                          className={`flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                            activeTab === 'payment' ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>{t.sidebarPayment}</span>
                        </button>

                        <button 
                          onClick={() => {
                            setShowSidebar(false);
                            setShowPrivacyPolicyModal(true);
                          }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                          <Shield className="h-4 w-4 text-sky-500" />
                          <span>{t.sidebarPrivacySecurity}</span>
                        </button>

                        <button
                          onClick={() => { setShowSidebar(false); setShowFaqModal(true); }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                          <Headphones className="h-4 w-4" />
                          <span>{t.sidebarSupport}</span>
                        </button>

                        <button
                          onClick={() => { setShowSidebar(false); setShowSettingsModal(true); }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                          <Settings className="h-4 w-4" />
                          <span>{t.sidebarSettings}</span>
                        </button>
                      </div>
                    </div>

                    {/* Footer / Logout Button */}
                    <div className="pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => {
                          setShowSidebar(false);
                          // เดิมแค่สลับหน้าจอกลับไปล็อกอิน ไม่เคยเคลียร์ session ของ Supabase
                          // Auth จริงเลย ทำให้ล็อกอินเก่ายังค้างอยู่เบื้องหลัง — เพิ่ม signOutCustomer()
                          signOutCustomer().catch(() => {});
                          setCustomerProfile(null);
                          setStep(5);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 active:scale-95 transition-all"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>{t.logout}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: HOME */}
              {activeTab === 'home' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  
                  {/* Banner Slider */}
                  <div 
                    onClick={() => setExpandedBannerUrl(bannerImages[currentBannerIndex])}
                    className="relative h-44 w-full rounded-2xl bg-slate-200 overflow-hidden shadow-md border border-slate-200 group cursor-pointer"
                  >
                    {bannerImages.map((src, index) => (
                      <div
                        key={src}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                          index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                      >
                        <Image
                          src={src}
                          alt={`Promotion Banner ${index + 1}`}
                          fill
                          sizes="100vw"
                          className="object-cover"
                          priority={index === 0}
                        />
                      </div>
                    ))}

                    <div className="absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-xs group-hover:bg-black/60 transition-colors">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </div>

                    <div className="absolute bottom-2.5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-xs">
                      {bannerImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentBannerIndex(index);
                          }}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            index === currentBannerIndex ? 'w-5 bg-cyan-400' : 'w-1.5 bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <ActivityIcon className="h-4 w-4 text-sky-500 animate-pulse" />
                        <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">
                          {t.techDashboard}
                        </h2>
                      </div>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        LIVE STATUS
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">{t.onlineTechs}</span>
                          <span className="text-base font-black text-emerald-700">{formatNumber(techStats.online)} {t.techCountUnit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-50/60 border border-sky-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white shadow-xs">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">{t.workingTechs}</span>
                          <span className="text-base font-black text-sky-700">{formatNumber(techStats.working)} {t.techCountUnit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
                          <Coffee className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">{t.breakTechs}</span>
                          <span className="text-base font-black text-amber-700">{formatNumber(techStats.breakTime)} {t.techCountUnit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100/70 border border-slate-200">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500 text-white shadow-xs">
                          <UserX className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">{t.offlineTechs}</span>
                          <span className="text-base font-black text-slate-700">{formatNumber(techStats.offline)} {t.techCountUnit}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('request')}
                      className="w-full group relative flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 p-4 text-white shadow-lg shadow-sky-500/20 active:scale-98 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
                          <Wrench className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black block tracking-wide uppercase">{t.requestHelpBtn}</span>
                          <span className="text-[10px] text-sky-100 block font-medium">{t.tapToChoosePlateSubtitle}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-6 w-6 text-white group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                </div>
              )}

              {/* TAB CONTENT: REQUEST */}
              {activeTab === 'request' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-6">
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100">
                    <h2 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span>{t.describeIssueTitle}</span>
                    </h2>
                    
                    {/* grid-cols-3 แทน grid-cols-4 เดิม — พอเพิ่ม "น้ำมันหมด" เป็นตัวเลือกที่ 5 แล้ว
                        4 คอลัมน์จะเหลือแถวสุดท้าย 1 ช่องเดี่ยวๆ ดูไม่เป็นระเบียบ 3 คอลัมน์ (2 แถว: 3+2)
                        จัดกลางสวยกว่าโดยไม่ต้องเปลี่ยนโครงสร้างปุ่มเลย */}
                    <div className="grid grid-cols-3 gap-2">
                      {issueTypes.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = towingRequest.selectedIssue === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTowingRequest(prev => ({ ...prev, selectedIssue: item.id }))}
                            className={`flex flex-col items-center justify-center py-3 px-1 rounded-2xl border transition-all ${
                              isSelected
                                ? 'border-sky-400 bg-sky-50/50 shadow-md ring-2 ring-sky-300'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full mb-1.5 ${
                              isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <IconComponent className="h-5 w-5" />
                            </div>
                            <span className={`text-[11px] font-bold ${
                              isSelected ? 'text-sky-600' : 'text-slate-700'
                            }`}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100">
                    <h2 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-sky-500" />
                      <span>{t.reporterInfoTitle}</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[9px]">{t.reporterNameLabel}</span>
                        <span className="font-bold text-slate-800">{getUserDisplayName()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">{t.reporterPhoneLabel}</span>
                        <span className="font-bold text-slate-800">{registerForm.phoneNumber}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100 space-y-3">
                    {currentIssueConfig.requiresTow ? (
                      <div>
                        <label className="text-xs font-bold text-slate-800 mb-1.5 block flex items-center gap-1.5">
                          <Truck className="h-4 w-4 text-sky-500" />
                          <span>{t.selectServiceTypePrefix} ({t.serviceType})</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'รถสไลด์ (Slide Tow)', label: t.towTypeSlide },
                            { value: 'รถยกช้อนล้อ (Lift Tow)', label: t.towTypeLift },
                          ].map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setTowingRequest(prev => ({ ...prev, towType: type.value }))}
                              className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                                towingRequest.towType === type.value
                                  ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-bold text-slate-800 mb-1.5 block flex items-center gap-1.5">
                          <Wrench className="h-4 w-4 text-sky-500" />
                          <span>{t.serviceReceiveTitle}</span>
                        </label>
                        {/* อาการนี้ไม่ต้องใช้รถลาก/สไลด์ — ส่งช่างเฉพาะทางไปแทน (ราคาถูกกว่า) */}
                        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-sky-700">{currentIssueConfig.label}</span>
                          <span className="text-[10px] font-bold text-slate-500">{t.noTowNeededTag}</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-slate-800 mb-1.5 block flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-sky-500" />
                        <span>{t.yourVehicleTypePrefix} ({t.vehicleCategory})</span>
                      </label>
                      <select
                        value={towingRequest.carCategory}
                        onChange={(e) => setTowingRequest(prev => ({ ...prev, carCategory: e.target.value }))}
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
                      >
                        <option value="รถเก๋ง / Sedan">{t.carCategorySedanOption}</option>
                        <option value="รถไฟฟ้า (EV)">{t.carCategoryEvOption}</option>
                        <option value="รถกระบะ / Pickup">{t.carCategoryPickupOption}</option>
                        <option value="รถ SUV / Van">{t.carCategorySuvOption}</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100 space-y-2.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-red-500 fill-red-100" />
                          <span>{t.pinGpsTitle}</span>
                        </span>
                        <span className="text-[10px] text-sky-600 font-bold bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                          {t.liveGPS}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-medium">
                        {liveCoords ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="break-words">{towingRequest.gpsLocation}</span>
                            <button
                              type="button"
                              onClick={handleFetchLiveLocation}
                              disabled={isFetchingLocation}
                              className="shrink-0 text-[10px] font-bold text-sky-600 underline disabled:opacity-50"
                            >
                              {isFetchingLocation ? '...' : t.updateBtn}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleFetchLiveLocation}
                            disabled={isFetchingLocation}
                            className="w-full text-left text-sky-600 font-bold disabled:opacity-60"
                          >
                            {isFetchingLocation ? t.emergencySearching : t.locationNotFoundTap}
                          </button>
                        )}
                        {locationError && !liveCoords && (
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-red-500 font-semibold">{locationError}</p>
                            <button
                              type="button"
                              onClick={handleUseApproximateLocation}
                              className="shrink-0 text-[10px] font-bold text-amber-600 underline"
                            >
                              {t.useApproxLocationInstead}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {currentIssueConfig.requiresTow ? (
                      <div>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1 mb-1">
                          <Wrench className="h-4 w-4 text-amber-500" />
                          <span>{t.nearestGarage}</span>
                        </span>
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-medium">
                          {towingRequest.nearestGarage || t.waitingGarageSearch}
                        </div>
                      </div>
                    ) : (
                      // อาการที่ไม่ต้องใช้รถลาก (แบตหมด/ยางแตก) — ช่างซ่อมให้เสร็จหน้างานเลย
                      // ไม่ต้องนำรถไปอู่ปลายทาง จึงไม่แสดงขั้นตอนหาอู่ใกล้เคียงให้สับสน
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 shrink-0" />
                        <span>{currentIssueConfig.label || t.noTowRepairNote}</span>
                      </div>
                    )}

                    {/* เพิ่ม: การ์ด preview ช่างว่างใกล้เคียง — ให้ลูกค้าอุ่นใจก่อนกดยืนยันว่ามี
                        ช่างจริงแถวนั้นไหม ไม่ใช่กดแล้วรอลุ้นเงียบๆ (ดู getNearbyTechPreview) */}
                    <div
                      className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 ${
                        nearbyPreviewLoading
                          ? 'bg-slate-50 border-slate-200 text-slate-500'
                          : nearbyPreview && nearbyPreview.nearbyCount > 0
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-amber-50 border-amber-100 text-amber-700'
                      }`}
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {nearbyPreviewLoading ? (
                        <span>{t.searchingNearbyTechs}</span>
                      ) : nearbyPreview && nearbyPreview.nearbyCount > 0 ? (
                        <span>
                          {t.nearbyTechsFound
                            .replace('{count}', String(nearbyPreview.nearbyCount))
                            .replace('{distance}', formatNumber(nearbyPreview.nearestDistanceKm ?? 0))}
                        </span>
                      ) : (
                        <span>{t.noNearbyTechsFallback}</span>
                      )}
                    </div>
                  </div>

                  {/* ส่วนเลือกวิธีชำระเงิน — ใช้ selectedPaymentMethod ตัวเดียวกับแท็บ "วิธีการชำระเงิน"
                      เพื่อให้ค่าที่ลูกค้าเลือกตอนจองงาน ตรงกับที่บันทึกลงตาราง payments จริง
                      และฝั่งช่างเห็นตรงกัน (ไม่ใช่แค่ UI สวยๆ เฉยๆ) */}
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100 space-y-3">
                    <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-sky-500" />
                      <span>{t.choosePaymentChannel}</span>
                    </h2>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('promptpay')}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                          selectedPaymentMethod === 'promptpay'
                            ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-900 text-white font-black text-[10px] flex items-center justify-center">
                          PP
                        </div>
                        <span className="text-[9px] font-bold text-slate-700 text-center leading-tight">PromptPay /<br />QR Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('credit')}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                          selectedPaymentMethod === 'credit'
                            ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-700 text-center leading-tight">{t.creditCardShort}<br />{t.debitCardShort}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPaymentMethod('cash')}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                          selectedPaymentMethod === 'cash'
                            ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-700 text-center leading-tight">{t.cashShort}</span>
                      </button>
                    </div>

                    {/* ตัดการโชว์ QR บริษัท + ช่องแนบสลิปออกจากหน้ายืนยันการจองแล้วตามที่ตกลงกันไว้ —
                        ลูกค้าเรียกช่างได้ทันทีโดยไม่ต้องจ่ายก่อน QR + ช่องแนบสลิปจริงย้ายไปแสดงใน
                        หน้าติดตามงานแทน (activeTab === 'activity') และจะโผล่ก็ต่อเมื่อช่างกดรับงาน
                        แล้วเท่านั้น ตรงนี้เหลือแค่ข้อความแจ้งลูกค้าไว้เฉยๆ ว่าจะไปแนบสลิปได้ที่ไหน */}
                    {selectedPaymentMethod === 'promptpay' && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/60 p-3 animate-in fade-in duration-200">
                        <QrCode className="h-4 w-4 text-sky-600 shrink-0" />
                        <p className="text-[10px] text-sky-800 leading-tight">
                          {t.promptpayAfterAcceptNote}
                        </p>
                      </div>
                    )}

                    {selectedPaymentMethod === 'credit' && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 animate-in fade-in duration-200">
                        <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-[10px] text-amber-800 leading-tight">
                          {t.creditAutoChargeNote}
                        </p>
                      </div>
                    )}

                    {selectedPaymentMethod === 'cash' && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 animate-in fade-in duration-200">
                        <DollarSign className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-[10px] text-emerald-800 leading-tight">
                          {t.cashPayDirectNote}
                        </p>
                      </div>
                    )}
                  </div>


                  {/* การ์ด "เวลาโดยประมาณที่ช่างจะถึง" ถูกลบออกจากหน้ายืนยันเรียกช่างแล้วตามคำขอ —
                      เดิมเป็นการประมาณแบบหยาบจากระยะทางตรง (Haversine * 2) ก่อนที่จะมีช่างจริงมารับงาน
                      ด้วยซ้ำ ทำให้ตัวเลขไม่แม่นและอาจตั้งความคาดหวังผิดๆ ให้ลูกค้า ตัวเลข ETA จริงที่แม่นยำ
                      (คำนวณจาก compute-route/OSRM จากพิกัดช่างจริง) ยังคงแสดงอยู่ตามปกติในหน้าติดตามงาน
                      (LiveTrackingMap) หลังช่างรับงานแล้ว ไม่ได้ถูกกระทบจากการลบครั้งนี้ */}

                  <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-md border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <DollarSign className="h-4 w-4 stroke-[3]" />
                        <span className="text-xs font-extrabold uppercase tracking-wide">{t.etvPriceHeading}</span>
                      </div>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    </div>

                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-700/60">
                      <span className="text-[11px] text-slate-300">{t.totalServicePrice}</span>
                      <span className="text-2xl font-black text-amber-400 tracking-tight">
                        ฿{formatNumber(towingRequest.calculatedEtvPrice)}
                      </span>
                    </div>

                    <p className="text-[9px] text-slate-400 font-medium leading-tight">
                      {t.priceNotice}
                    </p>
                  </div>

                  {!liveCoords && (
                    <p className="text-[10px] text-center text-red-500 font-semibold -mt-1">
                      {t.gpsRequiredWarning}
                    </p>
                  )}

                  <button
                    onClick={handleConfirmTowingBooking}
                    disabled={!liveCoords}
                    className="w-full rounded-2xl bg-cyan-500 py-3.5 text-xs font-bold text-white shadow-lg active:scale-95 hover:bg-cyan-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    <Truck className="h-4 w-4" />
                    <span>{t.confirmBooking}</span>
                  </button>
                </div>
              )}

              {/* TAB CONTENT: PAYMENT (วิธีการชำระเงิน) */}
              {activeTab === 'payment' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-sky-500" />
                      <span>{t.sidebarPayment}</span>
                    </h2>
                  </div>

                  {/* เลือกช่องทางหลัก */}
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-700 mb-2">{t.choosePaymentChannel}</h3>
                    
                    {/* PromptPay */}
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('promptpay')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        selectedPaymentMethod === 'promptpay'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          PP
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800">{t.promptpayTitle}</p>
                          <p className="text-[10px] text-slate-400">{t.promptpaySubtitle}</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === 'promptpay' ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                      }`}>
                        {selectedPaymentMethod === 'promptpay' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* Credit/Debit Card */}
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('credit')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        selectedPaymentMethod === 'credit'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800">{t.creditCardTitle}</p>
                          <p className="text-[10px] text-slate-400">{t.creditCardSubtitle}</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === 'credit' ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                      }`}>
                        {selectedPaymentMethod === 'credit' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </button>

                    {/* Cash */}
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('cash')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        selectedPaymentMethod === 'cash'
                          ? 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-200'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          <DollarSign className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800">{t.cashTitle}</p>
                          <p className="text-[10px] text-slate-400">{t.cashSubtitle}</p>
                        </div>
                      </div>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod === 'cash' ? 'border-sky-500 bg-sky-500' : 'border-slate-300'
                      }`}>
                        {selectedPaymentMethod === 'cash' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  </div>

                  {/* รายการบัตรที่บันทึกไว้ (แสดงเมื่อเลือก Credit/Debit) */}
                  {selectedPaymentMethod === 'credit' && (
                    <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800">{t.savedCardsTitle}</h3>
                        <button
                          type="button"
                          onClick={() => setShowAddCardModal(true)}
                          className="flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>{t.addNewCard}</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {savedCards.map((card) => (
                          <div key={card.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="flex items-center gap-3">
                              <CreditCard className="h-5 w-5 text-slate-600" />
                              <div>
                                <p className="text-xs font-bold text-slate-800">•••• •••• •••• {card.last4}</p>
                                <p className="text-[10px] text-slate-400">{card.bank} ({card.cardType})</p>
                              </div>
                            </div>
                            {card.isDefault && (
                              <span className="text-[9px] font-extrabold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                                {t.primaryBadge}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-emerald-50/80 p-3.5 border border-emerald-200 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800">{t.paymentSecurityTitle}</h4>
                      <p className="text-[10px] text-emerald-700 mt-0.5 leading-relaxed">
                        {t.paymentSecurityDesc}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {showTrackingDetail ? (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <button 
                        onClick={() => setShowTrackingDetail(false)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>{t.backToListBtn}</span>
                      </button>

                      {/* แบนเนอร์แจ้งเตือนเมื่อช่างปฏิเสธสลิป/การชำระเงิน — ให้ลูกค้ารู้ทันทีและแนบใหม่ได้เลย
                          แทนที่จะค้างไม่รู้อะไรเหมือนเดิม (เกิดได้เฉพาะวิธีชำระผ่านสลิปโอนเงินเท่านั้น) */}
                      {myPayment?.status === 'rejected' && myPayment.payment_method === 'transfer' && (
                        <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 space-y-2.5">
                          <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4" /> {t.slipRejectedByTech}
                          </p>
                          <p className="text-[10px] text-red-500">
                            {t.reviewSlipAndReattach}
                          </p>
                          <input
                            ref={reslipFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setReslipFile(e.target.files?.[0] ?? null)}
                          />
                          {!reslipFile ? (
                            <button
                              onClick={() => reslipFileInputRef.current?.click()}
                              className="w-full rounded-xl border-2 border-dashed border-red-300 bg-white py-3 text-[11px] font-bold text-red-500 flex items-center justify-center gap-1.5"
                            >
                              <Upload className="h-3.5 w-3.5" /> {t.reattachSlipBtn}
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] text-slate-600 truncate">{reslipFile.name}</p>
                              <button
                                onClick={handleReuploadSlip}
                                disabled={isReuploadingSlip}
                                className="w-full rounded-xl bg-red-500 py-2.5 text-[11px] font-bold text-white disabled:opacity-50"
                              >
                                {isReuploadingSlip ? t.sendingSlipEllipsis : t.resendSlipBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* QR โอนเงิน + ช่องแนบสลิป — ย้ายมาจากหน้า "ยืนยันการจอง" ตามที่ตกลงกันไว้:
                          ลูกค้าเรียกช่างได้ทันทีโดยไม่ต้องจ่ายก่อน แล้วค่อยสแกน QR/แนบสลิปตรงนี้
                          หลังช่างกดรับงานแล้วเท่านั้น (การ์ดนี้อยู่ใน showTrackingDetail ซึ่งเปิดได้
                          ก็ต่อเมื่อ techAccepted แล้วเท่านั้น) ซ่อนอัตโนมัติทันทีที่ส่งสลิปสำเร็จ
                          (myPayment.slip_url ไม่ใช่ null อีกต่อไป) */}
                      {selectedPaymentMethod === 'promptpay' && !myPayment?.slip_url && (
                        <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-sky-100 space-y-3">
                          <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <QrCode className="h-4 w-4 text-sky-500" />
                            <span>{t.promptpayTitle}</span>
                          </h2>

                          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-3">
                            <div className="relative h-36 w-36 rounded-lg overflow-hidden bg-white border border-slate-200">
                              <Image
                                src="QR.png"
                                alt={t.qrCompanyAlt}
                                fill
                                sizes="144px"
                                className="object-contain p-1.5"
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-600">{t.qrCompanyCaption}</p>
                            <p className="text-[9px] text-slate-400 text-center leading-tight">
                              {t.qrScanInstructions}
                            </p>
                          </div>

                          <input
                            type="file"
                            accept="image/*"
                            ref={slipFileInputRef}
                            onChange={handleSlipUpload}
                            className="hidden"
                          />

                          {!slipImage ? (
                            <button
                              type="button"
                              onClick={() => slipFileInputRef.current?.click()}
                              className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                              <Upload className="h-6 w-6 text-slate-400 mb-1" />
                              <span className="text-xs font-semibold text-slate-600">{t.uploadSlip}</span>
                              <span className="text-[9px] text-slate-400 mt-0.5">{t.supportedFileTypes}</span>
                            </button>
                          ) : (
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 p-2">
                              <div className="relative h-40 w-full rounded-lg overflow-hidden">
                                <Image
                                  src={slipImage}
                                  alt="Payment Slip Preview"
                                  fill
                                  sizes="100vw"
                                  className="object-contain"
                                />
                              </div>

                              {/* ปุ่มเปิดดูรูปใหญ่ & ปุ่มลบสลิป */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setExpandedBannerUrl(slipImage)}
                                  className="flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                  <Maximize2 className="h-3 w-3" />
                                  <span>{t.viewEnlargedImage}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={handleRemoveSlip}
                                  className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-800/60 px-2.5 py-1 rounded-lg hover:bg-red-900/80 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>{t.removeSlip}</span>
                                </button>
                              </div>

                              {/* ปุ่มยืนยันส่งสลิป — ต่างจากหน้าเดิมตรงที่งานถูกสร้างไปแล้ว
                                  (currentJobId มีอยู่แล้ว) ต้องกดส่งเองแทนที่จะแนบไปพร้อมตอนจองงาน */}
                              <button
                                type="button"
                                onClick={() => currentJobId && uploadPaymentSlip(currentJobId)}
                                disabled={isUploadingSlip}
                                className="w-full mt-2 rounded-xl bg-sky-500 py-2.5 text-[11px] font-bold text-white disabled:opacity-50"
                              >
                                {isUploadingSlip ? t.sendingSlipEllipsis : t.sendSlipBtn}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* แผนที่ติดตามงาน real-time จริง (Leaflet + OSM) — ลาก/ซูมได้ พิกัดจริงล้วน
                          ไม่มีตำแหน่งจำลองอีกต่อไป ดู components/LiveTrackingMap.tsx
                          ไม่ render แผนที่เลยตอนมีหน้าต่างแชต/สายเรียกเข้า/ให้คะแนนรีวิวเปิดซ้อนอยู่
                          ด้านบน กันไม่ให้แผนที่โผล่ค้างอยู่เบื้องหลังหน้าต่างเหล่านั้น */}
                      {!activeChatTech && !showIncomingCallModal && !showCallingModal && !showReviewModal && (
                        <LiveTrackingMap
                          techPos={techLiveCoords}
                          pickupPos={liveCoords}
                          garagePos={
                            towingRequest.nearestGarageLat != null && towingRequest.nearestGarageLng != null
                              ? { lat: towingRequest.nearestGarageLat, lng: towingRequest.nearestGarageLng }
                              : null
                          }
                          showPickupMarker={trackingPhase !== 'moving_to_green' && trackingPhase !== 'completed'}
                          showGarageMarker={currentIssueConfig.requiresTow}
                          statusLabel={
                            trackingPhase === 'moving_to_red'
                              ? t.techHeadingToScene
                              : trackingPhase === 'loading'
                              ? t.techLoadingEllipsis
                              : trackingPhase === 'on_site'
                              ? t.techOnSiteEllipsis
                              : currentIssueConfig.requiresTow
                              ? t.techToGarageDest
                              : t.techRepairDone
                          }
                          // เดิม LiveTrackingMap hardcode ป้ายหมุดช่างว่า "ช่างสไลด์" ตายตัว ทั้งที่
                          // งานที่ไม่ต้องลากรถ (แบตหมด/ยางแตก) ช่างไม่ได้ขับรถสไลด์มาเลย — ใช้
                          // ประเภทรถที่ลูกค้าเลือกตอนขอบริการแทน (ถ้าต้องลากรถ) หรือคำกลางๆ
                          // ถ้าเป็นงานซ่อมหน้างานที่ไม่ต้องลาก
                          techLabel={
                            currentIssueConfig.requiresTow
                              ? towingRequest.towType === 'รถยกช้อนล้อ (Lift Tow)'
                                ? t.techLabelLift
                                : t.techLabelSlide
                              : t.techLabelGeneric
                          }
                        />
                      )}
                      {/* การ์ดเวลาถึงจุดเกิดเหตุ: นับถอยหลังตามระยะที่หมุดช่างเหลือถึงหมุดแดง */}
                      <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-white p-3.5 shadow-xs border border-sky-100 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-inner shrink-0">
                            <Clock className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              {trackingPhase === 'moving_to_red' ? t.etaWithinLabel : t.currentStatusLabel}
                            </p>
                            <p className="text-sm font-black text-sky-700">
                              {trackingPhase === 'moving_to_red' && t.etaApprox.replace('{min}', String(getEtaMinutesRemaining()))}
                              {trackingPhase === 'loading' && t.arrivedLoading}
                              {trackingPhase === 'on_site' && t.arrivedOnSite}
                              {(trackingPhase === 'moving_to_green' || (trackingPhase === 'completed' && currentIssueConfig.requiresTow)) && t.techToGarageDest}
                              {trackingPhase === 'completed' && !currentIssueConfig.requiresTow && t.techRepairDone}
                            </p>
                          </div>
                        </div>
                        {trackingPhase === 'moving_to_red' && (
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            {formatNumber(towingRequest.distanceKm)} {t.kmUnit}
                          </span>
                        )}
                      </div>

                      {/* MECHANIC INFO & CONTACT CARD */}
                      <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-inner shrink-0 bg-sky-100">
                              <Image
                                src={assignedTech.photoUrl || '/M5.png'}
                                alt={assignedTech.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                              />
                              {/* จุดสถานะสด: เขียว=กำลังดำเนินงานให้คุณ, เทา=ออฟไลน์/งานจบแล้ว —
                                  อิงจากความคืบหน้างานจริง (trackingPhase) ไม่ใช่สถานะรับงานทั่วไป
                                  ของช่างอีกต่อไป (ดู techStatusDisplay ด้านบน) */}
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${techStatusDisplay.dotClass}`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1">
                                <h3 className="text-xs font-bold text-slate-800">{assignedTech.name}</h3>
                                <CheckCircle className="h-3.5 w-3.5 text-sky-500 fill-sky-100" />
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                <span className="font-bold text-slate-700">{assignedTech.rating}</span>
                                <span>({formatNumber(assignedTech.jobs)}+ {t.jobsUnit})</span>
                              </div>
                              <span
                                className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  assignedTech.status === 'break'
                                    ? 'bg-amber-50 text-amber-600'
                                    : assignedTech.status === 'offline'
                                    ? 'bg-slate-100 text-slate-500'
                                    : trackingPhase === 'completed'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {techStatusDisplay.label}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">{t.towingPlateLabel}</span>
                            <span className="text-xs font-black text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                              {assignedTech.plateNumber}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 bg-sky-50/70 rounded-xl border border-sky-100">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-sky-600 animate-bounce" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-700">{t.techPhoneLabel}</p>
                              <p className="text-xs font-black text-sky-700">{assignedTech.phone}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCallMechanic(assignedTech.phone, assignedTech.name)}
                              className="flex items-center gap-1 bg-sky-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-xs hover:bg-sky-600 active:scale-95 transition-all"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{t.callTechBtn}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenChatWithTech(assignedTech)}
                              className="relative flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1.5 rounded-xl text-[10px] font-bold shadow-xs hover:bg-emerald-600 active:scale-95 transition-all"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>{t.chatBtn}</span>
                              {hasUnreadChat && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                          {t.serviceHistoryHeading}
                        </h2>
                        <span className="text-[10px] font-bold text-slate-400">
                          {t.totalItemsPrefix} {formatNumber(serviceHistory.length)} {t.totalItemsSuffix}
                        </span>
                      </div>

                      {hasActiveBooking && !techAccepted && (
                        <div className="rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 p-4 text-white shadow-md relative overflow-hidden">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-9 w-9 items-center justify-center shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60" />
                              <div className="relative h-8 w-8 rounded-full bg-orange-500 flex items-center justify-center">
                                <Truck className="h-4 w-4" />
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-bold">{t.findingNearestTech}</p>
                              <p className="text-[10px] text-slate-300 mt-0.5">
                                {t.waitingTechAccept}
                              </p>
                            </div>
                          </div>
                          {/* ปุ่มยกเลิก — โชว์เฉพาะตอนยังไม่มีช่างรับงาน (ตรงกับเงื่อนไข !techAccepted
                              ของการ์ดนี้อยู่แล้ว) กดแล้วเรียก cancelJob() ผ่าน RPC จริง ไม่ใช่แค่ซ่อน UI
                              เฉยๆ — เพื่อให้ระบบฝั่งช่างไม่เห็นงานนี้ค้างอยู่ในคิวอีกต่อไป */}
                          <button
                            type="button"
                            onClick={handleCancelJob}
                            disabled={isCancellingJob}
                            className="mt-3 w-full rounded-xl border border-white/25 bg-white/10 py-2 text-[11px] font-bold text-white/90 transition-colors hover:bg-white/20 disabled:opacity-50"
                          >
                            {isCancellingJob ? t.cancellingEllipsis : t.cancelRequestBtn}
                          </button>
                        </div>
                      )}

                      {hasActiveBooking && techAccepted && (
                        <div 
                          onClick={() => setShowTrackingDetail(true)}
                          className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-3.5 text-white shadow-md cursor-pointer hover:opacity-95 transition-all relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-extrabold bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                              {t.activeStatusBadge}
                            </span>
                            <span className="text-xs font-bold text-sky-100 flex items-center gap-1">
                              <span>{t.viewLiveTrackingMap}</span>
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </div>

                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-xs font-black">{towingRequest.towType}</p>
                              <p className="text-[10px] text-sky-100">{towingRequest.carCategory} • {towingRequest.gpsLocation.split('(')[1]?.replace(')', '') || 'Sukhumvit 21'}</p>
                              <p className="text-[10px] text-amber-200 font-bold mt-1">{t.mechanicLabelShort} {assignedTech.name}</p>
                            </div>
                            <span className="text-base font-black text-amber-300">฿{formatNumber(towingRequest.calculatedEtvPrice)}</span>
                          </div>
                        </div>
                      )}

                      {serviceHistory.map((item) => (
                        <div key={item.id} className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-bold text-slate-800">{item.towType}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              {item.status === 'เสร็จสิ้น' ? t.historyStatusCompleted : t.historyStatusInProgress}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                            <div>{t.historyDateLabel} <span className="font-semibold text-slate-700">{item.date} ({item.time})</span></div>
                            <div>{t.historyCarTypeLabel} <span className="font-semibold text-slate-700">{item.carCategory}</span></div>
                            <div className="col-span-2 truncate">{t.historyLocationLabel} <span className="font-semibold text-slate-700">{item.location}</span></div>
                            <div className="col-span-2">{t.historyTechLabel} <span className="font-semibold text-slate-700">{item.techName}</span></div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-xs">
                            <span className="text-slate-400 text-[10px]">{t.netPaidLabel}</span>
                            <span className="font-black text-slate-800">฿{formatNumber(item.price)}</span>
                          </div>

                          <button
                            onClick={() => handleReportServiceIssue(item.id)}
                            className="flex items-center gap-1 text-[10px] font-bold text-red-500 pt-1"
                          >
                            <AlertCircle className="h-3 w-3" /> {t.reportIssueBtn}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: PROFILE */}
              {activeTab === 'profile' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {/* การ์ดหัวโปรไฟล์: Cover + Avatar + ปุ่มแก้ไข */}
                  <div className="relative rounded-2xl overflow-hidden shadow-xs border border-slate-100 bg-white">
                    <div className="h-14 bg-gradient-to-r from-sky-500 to-cyan-400" />
                    <div className="px-4 pb-4">
                      <div className="flex items-end justify-between -mt-8">
                        <div className="h-16 w-16 rounded-full bg-sky-500 text-white font-black text-2xl flex items-center justify-center shadow-md ring-4 ring-white">
                          {getUserDisplayName().charAt(0)}
                        </div>
                        <button
                          onClick={() => setIsEditingProfile(!isEditingProfile)}
                          className={`mb-1 flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                            isEditingProfile ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isEditingProfile ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{t.profileSave}</span>
                            </>
                          ) : (
                            <>
                              <Settings className="h-3.5 w-3.5" />
                              <span>{t.profileEdit}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <h2 className="text-sm font-bold text-slate-800">{getUserDisplayName()} {registerForm.surname}</h2>
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                      </div>
                      <p className="text-[11px] text-slate-400">{registerForm.email}</p>
                    </div>
                  </div>

                  {/* สรุปยอดการใช้งานแบบย่อ */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white p-3 text-center shadow-xs border border-slate-100">
                      <p className="text-base font-black text-sky-600">{serviceHistory.length}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t.profileServices}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-center shadow-xs border border-slate-100">
                      <p className="text-base font-black text-sky-600">{savedCards.length}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t.profilePayments}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 text-center shadow-xs border border-slate-100">
                      <p className="text-base font-black text-sky-600">{1 + savedCars.length}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{t.profileSavedCars}</p>
                    </div>
                  </div>

                  {/* ข้อมูลส่วนตัว: ดู / แก้ไข */}
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-sky-500" />
                      <span>{t.profilePersonalInfo}</span>
                    </h3>

                    {isEditingProfile ? (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.name}</label>
                          <input
                            type="text"
                            value={registerForm.name}
                            onChange={(e) => handleRegisterInputChange('name', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.surname}</label>
                          <input
                            type="text"
                            value={registerForm.surname}
                            onChange={(e) => handleRegisterInputChange('surname', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.phone}</label>
                          <input
                            type="text"
                            value={registerForm.phoneNumber}
                            onChange={(e) => handleRegisterInputChange('phoneNumber', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">{t.phone}</span>
                          <span className="font-bold text-slate-700">{registerForm.phoneNumber}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">{t.emailPlaceholder}</span>
                          <span className="font-bold text-slate-700">{registerForm.email}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ข้อมูลรถยนต์หลัก: ดู / แก้ไข */}
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-sky-500" />
                        <span>{t.profileMainCar}</span>
                      </span>
                      <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">{t.profileDefault}</span>
                    </h3>

                    {isEditingProfile ? (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.profileBrand}</label>
                          <input
                            type="text"
                            value={registerForm.carBrand}
                            onChange={(e) => handleRegisterInputChange('carBrand', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.profileModel}</label>
                          <input
                            type="text"
                            value={registerForm.carModel}
                            onChange={(e) => handleRegisterInputChange('carModel', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block">{t.profilePlate}</label>
                          <input
                            type="text"
                            value={registerForm.carNumber}
                            onChange={(e) => handleRegisterInputChange('carNumber', e.target.value)}
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">{t.profileBrand}</span>
                          <span className="font-bold text-slate-700">{registerForm.carBrand}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-50">
                          <span className="text-slate-400">{t.profileModel}</span>
                          <span className="font-bold text-slate-700">{registerForm.carModel}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-400">{t.profilePlate}</span>
                          <span className="font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{registerForm.carNumber}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* รถเพิ่มเติมที่บันทึกไว้ (Multi-car) */}
                  <div className="rounded-2xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Car className="h-3.5 w-3.5 text-sky-500" />
                      <span>{t.profileOtherCars} ({savedCars.length})</span>
                    </h3>

                    {savedCars.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-1">{t.profileNoOtherCars}</p>
                    ) : (
                      <div className="space-y-2">
                        {savedCars.map((car) => (
                          <div key={car.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-sky-500">
                                <Car className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-700">{car.brand} {car.model}</p>
                                <p className="text-[10px] text-slate-400">{car.plate}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveCar(car.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setShowAddCarModal(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-sky-300 py-2.5 text-xs font-bold text-sky-600 hover:bg-sky-50 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>{t.profileAddCar}</span>
                    </button>
                  </div>

                  {/* เมนูลัด: การชำระเงิน / ประวัติ / ภาษา / ช่วยเหลือ / นโยบาย */}
                  <div className="rounded-2xl bg-white shadow-xs border border-slate-100 overflow-hidden divide-y divide-slate-50">
                    <button
                      onClick={() => setActiveTab('payment')}
                      className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <CreditCard className="h-4 w-4 text-sky-500" />
                        {t.profilePayments}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>

                    <button
                      onClick={() => setActiveTab('activity')}
                      className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <History className="h-4 w-4 text-sky-500" />
                        {t.sidebarHistory}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>

                    <div>
                      <button
                        onClick={() => setShowProfileLangDropdown(!showProfileLangDropdown)}
                        className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                          <Globe className="h-4 w-4 text-sky-500" />
                          {t.profileLanguage}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          {currentLangObj?.name}
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showProfileLangDropdown ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {showProfileLangDropdown && (
                        <div className="px-3.5 pb-2 space-y-1">
                          {languageList.map((item) => {
                            const Flag = item.FlagComponent;
                            return (
                              <button
                                key={item.code}
                                onClick={() => { handleLanguageChange(item.code); setShowProfileLangDropdown(false); }}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                  lang === item.code ? 'bg-sky-50 text-sky-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span>{item.name}</span>
                                <Flag />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setActiveTab('emergency')}
                      className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <Headphones className="h-4 w-4 text-sky-500" />
                        {t.profileSupport}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>

                    <button
                      onClick={() => setShowPrivacyPolicyModal(true)}
                      className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <Shield className="h-4 w-4 text-sky-500" />
                        {t.profilePrivacy}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>

                    <button
                      onClick={() => setShowTermsModal(true)}
                      className="flex w-full items-center justify-between px-3.5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                        <FileText className="h-4 w-4 text-sky-500" />
                        {t.profileTerms}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      // เดิมแค่สลับหน้าจอกลับไปล็อกอิน ไม่เคยเคลียร์ session ของ Supabase Auth
                      // จริงเลย — เพิ่ม signOutCustomer() ให้ตรงกับปุ่มออกจากระบบใน sidebar
                      signOutCustomer().catch(() => {});
                      setCustomerProfile(null);
                      setStep(5);
                    }}
                    className="w-full rounded-2xl bg-red-50 text-red-600 border border-red-100 py-3 text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-100 active:scale-95 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t.logout}</span>
                  </button>

                  <p className="text-center text-[9px] text-slate-300 pb-2">DTC Intelligent Towing • v1.0.0</p>
                </div>
              )}

              {/* TAB CONTENT: EMERGENCY / CONTACT SUPPORT */}
              {activeTab === 'emergency' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-5 text-white shadow-lg text-center space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-xs text-white">
                      <PhoneCall className="h-7 w-7 animate-bounce" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold uppercase tracking-wide">{t.emergencyTitle}</h2>
                      <p className="text-xs text-rose-100 mt-1">{t.emergencySubtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCallMechanic('1176', 'DTC Hotline 1176')}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-red-600 shadow-md active:scale-95 transition-transform"
                    >
                      <Phone className="h-4 w-4 fill-red-600" />
                      <span>{t.emergencyCall}</span>
                    </button>
                  </div>

                  {/* การ์ด SOS: ดึงพิกัด GPS จริง + แชร์พิกัดฉุกเฉิน */}
                  <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-sky-500" />
                      <span>{t.emergencyLocationTitle}</span>
                    </h3>

                    {liveCoords ? (
                      <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs">
                        <p className="text-slate-500">{t.latitudeLongitude}</p>
                        <p className="font-bold text-slate-800">{liveCoords.lat.toFixed(5)}, {liveCoords.lng.toFixed(5)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        {isFetchingLocation ? t.emergencySearching : t.emergencyNotEnabled}
                      </p>
                    )}
                    {locationError && (
                      <p className="text-[11px] text-red-500 font-semibold">{locationError}</p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleFetchLiveLocation}
                        disabled={isFetchingLocation}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-600 active:scale-95 transition-all disabled:opacity-60"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>{liveCoords ? t.updateLocation : t.enableGPS}</span>
                      </button>
                      <button
                        onClick={handleShareLocation}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-red-50 border border-red-100 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 active:scale-95 transition-all"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{t.shareEmergency}</span>
                      </button>
                    </div>

                    {/* ปุ่มสำรอง: แสดงเฉพาะตอนเปิด GPS จริงไม่สำเร็จ ให้ยังค้นหาอู่ใกล้เคียงที่สุดต่อได้ */}
                    {locationError && !liveCoords && (
                      <button
                        onClick={handleUseApproximateLocation}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 py-2.5 text-xs font-bold text-amber-700 hover:bg-amber-100 active:scale-95 transition-all"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{t.useApproxLocationInstead}</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-sky-500" />
                      <span>{t.emergencyNoticeTitle}</span>
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t.emergencyNoticeSub}
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setShowTermsModal(true)}
                        className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        {t.emergencyTermsButton}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Navigation Bar */}
              <div className="absolute bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-white border-t border-slate-100 py-2.5 px-2">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    activeTab === 'home' ? 'text-sky-500 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Home className="h-5 w-5" />
                  <span className="text-[9px]">{t.navHome}</span>
                </button>

                <button
                  onClick={() => setActiveTab('request')}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    activeTab === 'request' ? 'text-sky-500 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Wrench className="h-5 w-5" />
                  <span className="text-[9px]">{t.navRequest}</span>
                </button>

                <button
                  onClick={() => setActiveTab('emergency')}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    activeTab === 'emergency' ? 'text-red-500 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <div className="relative">
                    <PhoneCall className="h-5 w-5 text-red-500" />
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </div>
                  <span className="text-[9px] text-red-500 font-bold">{t.navHotline}</span>
                </button>

                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    activeTab === 'activity' ? 'text-sky-500 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <div className="relative">
                    <History className="h-5 w-5" />
                    {hasUnreadChat && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white"></span>
                      </span>
                    )}
                  </div>
                  <span className="text-[9px]">{t.navHistory}</span>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    activeTab === 'profile' ? 'text-sky-500 font-bold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <User className="h-5 w-5" />
                  <span className="text-[9px]">{t.navProfile}</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* MODAL: Banner Full Screen Preview */}
        {expandedBannerUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm h-[70vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-700 bg-black">
              <Image 
                src={expandedBannerUrl} 
                alt="Expanded Banner" 
                fill 
                sizes="100vw"
                className="object-contain" 
              />
              <button
                onClick={() => setExpandedBannerUrl(null)}
                className="absolute top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/40 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* MODAL: Live Chat กับช่าง — เต็มจอ ไม่ใช่กล่องลอยตรงกลางอีกต่อไป กันปัญหาคีย์บอร์ดบังกล่องพิมพ์ */}
        {activeChatTech && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white animate-in fade-in duration-200">

            {/* Chat Header */}
            <div className="bg-sky-500 p-3 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-white text-sky-600 font-bold text-xs flex items-center justify-center shadow-xs">
                  ชส
                </div>
                <div>
                  <h3 className="text-xs font-bold leading-tight">{activeChatTech.name}</h3>
                  <span className="text-[9px] text-sky-100 block">{t.onlinePlateStatus} {activeChatTech.plateNumber}</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveChatTech(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 min-h-0 p-3 overflow-y-auto space-y-2.5 bg-slate-50">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-sky-500 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* แบนเนอร์แจ้งเตือนสลิปถูกปฏิเสธ + ปุ่มแนบสลิปใหม่ — เดิมมีแค่ในหน้ารายละเอียดงานที่ซ่อนลึก
                (ต้องอยู่แท็บ "ติดตามงาน" และไม่ได้กดย้อนกลับเท่านั้น) ทั้งที่ข้อความแจ้งลูกค้าบอกว่า
                แนบใหม่ได้ที่ "หน้าแชทหรือหน้ารายละเอียดงาน" — ตอนนี้เพิ่มจุดแนบจริงเข้าหน้าแชทด้วย
                ใช้ input/ปุ่มแยกต่างหาก (reslipChatFileInputRef) แต่แชร์ state/ฟังก์ชันเดิมกับฝั่ง
                หน้ารายละเอียดงาน (reslipFile, handleReuploadSlip) เพื่อไม่ต้องเขียนใหม่ */}
            {myPayment?.status === 'rejected' && myPayment.payment_method === 'transfer' && (
              <div className="mx-2.5 mb-2.5 rounded-2xl bg-red-50 border border-red-200 p-3 space-y-2 shrink-0">
                <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {t.slipRejectedByTech}
                </p>
                <p className="text-[10px] text-red-500">
                  {t.reviewSlipAndReattach}
                </p>
                <input
                  ref={reslipChatFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setReslipFile(e.target.files?.[0] ?? null)}
                />
                {!reslipFile ? (
                  <button
                    onClick={() => reslipChatFileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-red-300 bg-white py-2.5 text-[11px] font-bold text-red-500 flex items-center justify-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" /> {t.reattachSlipBtn}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-600 truncate">{reslipFile.name}</p>
                    <button
                      onClick={handleReuploadSlip}
                      disabled={isReuploadingSlip}
                      className="w-full rounded-xl bg-red-500 py-2.5 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {isReuploadingSlip ? t.sendingSlipEllipsis : t.resendSlipBtn}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Chat Input Field */}
            <div className="p-2.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={t.chatInputPlaceholder}
                className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-sky-500"
              />
              <button
                onClick={handleSendMessage}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 text-white shadow-xs hover:bg-sky-600 active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

          </div>
        )}

        {/* MODAL: เพิ่มบัตรชำระเงินใหม่ */}
        {showAddCardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-sky-500" />
                  <span>{t.addNewCardTitle}</span>
                </h3>
                <button onClick={() => setShowAddCardModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddCard} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.nameOnCard}</label>
                  <input
                    type="text"
                    value={newCardName}
                    onChange={(e) => setNewCardName(e.target.value)}
                    placeholder="SOMCHAI JAIDEE"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 uppercase focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.cardNumberLabel}</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={newCardNumber}
                    onChange={(e) => setNewCardNumber(e.target.value)}
                    placeholder="4541 1234 5678 9012"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.expiryLabel}</label>
                    <input
                      type="text"
                      maxLength={5}
                      value={newCardExp}
                      onChange={(e) => setNewCardExp(e.target.value)}
                      placeholder="12/28"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.cvcLabel}</label>
                    <input
                      type="password"
                      maxLength={3}
                      value={newCardCvc}
                      onChange={(e) => setNewCardCvc(e.target.value)}
                      placeholder="123"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-600 active:scale-95 transition-all mt-2"
                >
                  {t.saveCardBtn}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: รีวิวและประเมินผลการบริการ */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200">
                <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900">{t.jobCompletedTitle}</h3>
                <p className="text-[11px] text-slate-400 mt-1">{t.jobCompletedSub}</p>
              </div>

              {/* สรุปใบเสร็จย่อ — ราคา/วิธีชำระเงินที่ใช้จริงในงานนี้ เดิมกดจบงานแล้วไม่มีสรุปให้ดูเลย */}
              <div className="rounded-2xl bg-slate-900 text-white p-3.5 text-left space-y-1.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{t.serviceFeeSummaryLabel}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.serviceFeeLabel}</span>
                  <span className="text-sm font-black text-amber-300">
                    ฿{formatNumber(towingRequest.calculatedEtvPrice ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{t.paymentMethodLabel}</span>
                  <span className="text-[11px] font-bold text-white">
                    {myPayment?.payment_method === 'cash'
                      ? t.cashShort
                      : myPayment?.payment_method === 'credit'
                      ? t.creditCardTitle
                      : t.paymentMethodTransfer}
                  </span>
                </div>
                {myPayment && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300">{t.statusLabel}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        myPayment.status === 'verified'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {myPayment.status === 'verified' ? t.techConfirmedPayment : t.waitingTechVerify}
                    </span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 py-3.5 space-y-1.5">
                <div className="flex items-center justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform active:scale-125"
                    >
                      <Star 
                        className={`h-8 w-8 transition-colors ${
                          star <= rating 
                            ? 'fill-amber-400 text-amber-400 filter drop-shadow-xs' 
                            : 'fill-slate-200 text-slate-300'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs font-bold text-amber-500">
                  {t.ratingLabels.split(',')[rating - 1]}
                </p>
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={t.reviewFeedbackPlaceholder}
                className="w-full h-20 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 resize-none transition-all"
              />

              <button
                type="button"
                onClick={handleSubmitReview}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 py-3 text-xs font-bold text-white shadow-md shadow-sky-200 hover:from-sky-600 hover:to-sky-700 active:scale-95 transition-all"
              >
                {t.submitReviewBtn}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: Booking Success Overlay */}
        {isBookingSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100 space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 animate-bounce">
                <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">{t.bookingSuccess}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t.sendingToNearestTechLoading}
              </p>
            </div>
          </div>
        )}

        {/* MODAL: Terms of Service */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3 max-h-[80vh] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800">{t.termsLink}</h3>
                <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto text-[11px] text-slate-600 space-y-2 pr-1">
                <p>{t.termsLine1}</p>
                <p>{t.termsLine2}</p>
                <p>{t.termsLine3}</p>
                <p>{t.termsLine4}</p>
              </div>

              <button
                onClick={() => setShowTermsModal(false)}
                className="w-full rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-600 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: Privacy Policy */}
        {showPrivacyPolicyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3 max-h-[80vh] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800">{t.privacyLink}</h3>
                <button onClick={() => setShowPrivacyPolicyModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto text-[11px] text-slate-600 space-y-2 pr-1">
                <p>{t.privacyLine1}</p>
                <p>{t.privacyLine2}</p>
                <p>{t.privacyLine3}</p>
              </div>

              <button
                onClick={() => setShowPrivacyPolicyModal(false)}
                className="w-full rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-600 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: การแจ้งเตือน (Notifications) */}
        {showNotificationsPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-sky-500" />
                  <span>{t.notificationsTitle}</span>
                </h3>
                <button onClick={() => setShowNotificationsPanel(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {unreadNotificationCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="self-end text-[10px] font-bold text-sky-600 hover:underline"
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
                        n.read ? 'bg-white border-slate-100' : 'bg-sky-50 border-sky-100'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          n.type === 'success' ? 'bg-emerald-100 text-emerald-600' : n.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'
                        }`}>
                          {n.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : n.type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{n.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[9px] text-slate-300 mt-1">{n.time}</p>
                        </div>
                        {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-sky-500 shrink-0" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ตั้งค่าแอปพลิเคชัน (Settings) */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-sky-500" />
                  <span>{t.appSettingsTitle}</span>
                </h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.notificationsSectionLabel}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{t.notificationSoundLabel}</span>
                  <button
                    onClick={() => setNotifSoundEnabled(!notifSoundEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${notifSoundEnabled ? 'bg-sky-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${notifSoundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{t.vibrationLabel}</span>
                  <button
                    onClick={() => setNotifVibrateEnabled(!notifVibrateEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${notifVibrateEnabled ? 'bg-sky-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${notifVibrateEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.displaySectionLabel}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">{t.darkModeLabel}</span>
                  <button
                    onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${darkModeEnabled ? 'bg-sky-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${darkModeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { setShowSettingsModal(false); setActiveTab('profile'); }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2"><User className="h-4 w-4 text-sky-500" /> {t.manageMyAccount}</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </button>
                <button
                  onClick={() => { setShowSettingsModal(false); setAppToast({ message: t.deleteAccountRequestToast, type: 'success' }); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> {t.deleteAccountBtn}
                </button>
              </div>

              <p className="text-center text-[9px] text-slate-300 pt-2">DTC Intelligent Towing • v1.0.0</p>
            </div>
          </div>
        )}

        {/* MODAL: ศูนย์ช่วยเหลือ / คำถามที่พบบ่อย (FAQ) */}
        {showFaqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-sky-500" />
                  <span>{t.helpCenterTitle}</span>
                </h3>
                <button onClick={() => setShowFaqModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleCallMechanic('1176', 'DTC Hotline 1176')}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                  <span>{t.emergencyHotlineBtn}</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {[
                  { q: t.faqQ1, a: t.faqA1 },
                  { q: t.faqQ2, a: t.faqA2 },
                  { q: t.faqQ3, a: t.faqA3 },
                  { q: t.faqQ4, a: t.faqA4 },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-100 overflow-hidden">
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="text-xs font-bold text-slate-700 pr-2">{item.q}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${openFaqIndex === idx ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaqIndex === idx && (
                      <p className="px-3 pb-3 text-[11px] text-slate-500 leading-relaxed">{item.a}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: เพิ่มรถอีกคัน (Multi-car) */}
        {showAddCarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Car className="h-4 w-4 text-sky-500" />
                  <span>{t.profileAddCar}</span>
                </h3>
                <button onClick={() => setShowAddCarModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddCar} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.carBrandLabel}</label>
                  <input
                    type="text"
                    value={newCarBrand}
                    onChange={(e) => setNewCarBrand(e.target.value)}
                    placeholder="Toyota"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.carModelLabel}</label>
                  <input
                    type="text"
                    value={newCarModel}
                    onChange={(e) => setNewCarModel(e.target.value)}
                    placeholder="Hilux Revo"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 mb-1 block">{t.plateNumberLabel}</label>
                  <input
                    type="text"
                    value={newCarPlate}
                    onChange={(e) => setNewCarPlate(e.target.value)}
                    placeholder={t.platePlaceholder}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-500 py-2.5 text-xs font-bold text-white shadow-md hover:bg-sky-600 active:scale-95 transition-all mt-2"
                >
                  {t.saveCarBtn}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: กำลังโทรออก — แสดงในกรอบมือถือแทนการยิง tel: ออกไปทันที */}
        {showCallingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs max-h-[calc(100%-2rem)] overflow-y-auto rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl border border-slate-700 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 relative">
                <span className="absolute inset-0 rounded-full bg-sky-400/20 animate-ping" />
                <Phone className="h-9 w-9 relative animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.callingTechTitle}</p>
                <h3 className="text-base font-bold text-white mt-1">{callingTechName}</h3>
                <p className="text-sm text-sky-300 font-black mt-0.5">{callingTechPhone}</p>
              </div>

              <a
                href={`tel:${callingTechPhone}`}
                onClick={() => setShowCallingModal(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-600 active:scale-95 transition-all"
              >
                <PhoneCall className="h-4 w-4" />
                <span>{t.openPhoneAppBtn}</span>
              </a>

              <button
                onClick={() => setShowCallingModal(false)}
                className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/20 transition-colors"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: สายเรียกเข้าจากช่าง — เด้งขึ้นแบบเรียลไทม์เมื่อช่างกดโทรหาลูกค้า */}
        {showIncomingCallModal && incomingCallInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 p-6 text-center shadow-2xl border border-slate-700 space-y-4">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 relative">
                <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                <PhoneCall className="h-9 w-9 relative animate-bounce" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t.incomingCallFromTech}</p>
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
                  <PhoneCall className="h-3.5 w-3.5" /> {t.answerBtn}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: กรอกข้อมูลให้ครบหลังล็อกอิน LINE ครั้งแรก — LINE ID token มีแค่ชื่อ/รูป/
            อีเมล(ถ้ามี) ไม่มีเบอร์โทร จึงต้องขอเพิ่มก่อนสร้างโปรไฟล์ลูกค้าจริงในระบบ */}
        {showLineCompleteProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#06C755] text-white shadow-md">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 5.87 2 10.5c0 4.02 3.36 7.4 7.93 8.16-.11.5-.68 2.28-.78 2.63 0 0-.02.13.06.18.08.05.17.02.17.02.23-.03 2.65-1.75 3.73-2.47.62.09 1.26.14 1.89.14 5.52 0 10-3.87 10-8.66S17.52 2 12 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">{t.almostDoneTitle}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {t.fillRemainingInfo}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500">{t.firstNameLabel}</label>
                  <input
                    type="text"
                    value={lineCompleteForm.name}
                    onChange={(e) => setLineCompleteForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t.firstNamePlaceholder}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500">{t.lastNamePlaceholder}</label>
                  <input
                    type="text"
                    value={lineCompleteForm.surname}
                    onChange={(e) => setLineCompleteForm(prev => ({ ...prev, surname: e.target.value }))}
                    placeholder={t.lastNamePlaceholder}
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400 ${lineCompleteErr.surname ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {lineCompleteErr.surname && <p className="mt-1 text-[10px] font-bold text-red-500">{lineCompleteErr.surname}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500">{t.phoneNumberLabel}</label>
                  <input
                    type="tel"
                    value={lineCompleteForm.phone}
                    onChange={(e) => setLineCompleteForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="08X-XXX-XXXX"
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400 ${lineCompleteErr.phone ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {lineCompleteErr.phone && <p className="mt-1 text-[10px] font-bold text-red-500">{lineCompleteErr.phone}</p>}
                </div>
                {/* ช่องอีเมล — โชว์เสมอ (ไม่ใช่แค่ตอนไม่มีค่า) เผื่อ LINE Channel ยังไม่เปิด
                    Email Address Permission หรือผู้ใช้ไม่ได้กดยินยอมให้แชร์อีเมลตอน consent
                    ถ้า claims.email มีมาแล้วฟิลด์นี้จะ prefill ไว้ให้ ผู้ใช้แก้ไขได้ */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold text-slate-500">{t.emailLabel}</label>
                  <input
                    type="email"
                    value={lineCompleteForm.email}
                    onChange={(e) => setLineCompleteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="example@email.com"
                    className={`w-full rounded-xl border px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-sky-400 ${lineCompleteErr.email ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {lineCompleteErr.email && <p className="mt-1 text-[10px] font-bold text-red-500">{lineCompleteErr.email}</p>}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitLineCompleteProfile}
                disabled={lineCompleteSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 py-3 text-xs font-bold text-white shadow-md shadow-sky-200 hover:from-sky-600 hover:to-sky-700 active:scale-95 transition-all disabled:opacity-60"
              >
                {lineCompleteSubmitting ? t.savingEllipsis : t.getStartedBtn}
              </button>
            </div>
          </div>
        )}

        {/* MODAL: ขอบคุณสำหรับรีวิว — แสดงในกรอบมือถือแทน alert() */}
        {showReviewThanksModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200">
                <CheckCircle2 className="h-11 w-11 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-slate-900">{t.thankYouForReviewTitle}</h3>
                <div className="flex items-center justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= submittedRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed pt-1">
                  {t.thankYouForReviewMsg}
                </p>
              </div>
              <button
                onClick={() => setShowReviewThanksModal(false)}
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 py-3 text-xs font-bold text-white shadow-md shadow-sky-200 hover:from-sky-600 hover:to-sky-700 active:scale-95 transition-all"
              >
                {t.closeWindowBtn}
              </button>
            </div>
          </div>
        )}

        {/* TOAST: ข้อความแจ้งเตือนสั้นๆ ในแอป — แทน alert() ของเบราว์เซอร์ */}
        {appToast && (
          <div className="absolute bottom-24 left-4 right-4 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-2xl border text-xs font-bold text-white ${
                appToast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-500 border-red-400'
              }`}
            >
              {appToast.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{appToast.message}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}