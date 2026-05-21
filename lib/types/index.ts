import { Timestamp } from 'firebase/firestore';

// ===========================
// User & Roles
// ===========================

export type UserRole = 'student' | 'teacher' | 'admin';

export interface AppUser {
  id: string;
  role: UserRole;
  displayName: string;
  email: string;
  photoURL?: string | null;
  assignedTeacherIds?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notificationPrefs?: {
    lessonReminders: boolean;
    announcements: boolean;
    messages: boolean;
    homework: boolean;
    summaries: boolean;
  };
}

// ===========================
// Teacher Profile
// ===========================

export interface TeacherProfile {
  id: string;
  name: string;
  bio: string;
  specialties: string[];
  photoPath?: string | null;
  updatedAt: Timestamp;
  /** マイスケジュール週表示の枠色（#RRGGBB）。未設定時はアプリのデフォルト色を使用 */
  scheduleWeekOpenBg?: string;
  scheduleWeekOpenText?: string;
  scheduleWeekBookedBg?: string;
  scheduleWeekBookedText?: string;
  scheduleWeekClosedBg?: string;
  scheduleWeekClosedText?: string;
}

// ===========================
// Classes & Sessions
// ===========================

export interface ClassModel {
  id: string;
  title: string;
  level?: string | null;
  description?: string | null;
  active: boolean;
  teacherIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SessionModality = 'in_person' | 'online' | 'hybrid';
export type SessionStatus = 'scheduled' | 'cancelled' | 'completed';

export interface Session {
  id: string;
  classId: string;
  title: string;
  startAt: Timestamp;
  endAt: Timestamp;
  modality: SessionModality;
  location?: string | null;
  zoomURL?: string | null;
  teacherIds: string[];
  capacity?: number | null;
  status: SessionStatus;
  updatedAt: Timestamp;
}

// ===========================
// Private Booking System
// ===========================

export type EnrollmentType = 'monthly_registration' | 'ticket_bundle';
export type EnrollmentStatus = 'active' | 'expired' | 'depleted' | 'inactive';

export interface Enrollment {
  id: string;
  studentId: string;
  type: EnrollmentType;
  /**
   * この受講登録（チケット）でのレッスン時間（分）。
   * 例: 60 → 60分レッスン用 / 40 → 40分レッスン用。
   * 1人の生徒が「60分×8回」「40分×4回」を別 enrollment として複数持てる。
   * 後方互換: 既存データで未設定の場合は呼び出し側で 60 にフォールバック。
   */
  lessonMinutes?: number;
  registeredCount: number;
  usedCount: number;
  remainingCount: number;
  validFrom?: Timestamp | null;
  validUntil: Timestamp;
  rescheduleAllowedCount: number;
  rescheduleUsedCount: number;
  status: EnrollmentStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** lessonMinutes 未設定時のフォールバック値（既存データ互換） */
export const DEFAULT_LESSON_MINUTES = 60;

// ===========================
// Student Groups (Semi-Private Pair Registration)
// ===========================

export type StudentGroupType = 'semi_private';
export type StudentGroupStatus = 'active' | 'inactive';

/**
 * 生徒グループ（セミプライベート用のペア事前登録）。
 * 管理者があらかじめ「セミプライベートで一緒に受ける2人組」を登録しておき、
 * 予約時にメンバー全員ぶんの enrollment を同時に消費する。
 *
 * - 通常はメンバー2名（セミプライベート）。
 * - 共通の担当講師を割り当て可能。
 * - グループは固定運用（毎レッスンで違う相手と組む想定はしない）。
 */
export interface StudentGroup {
  id: string;
  name: string;
  type: StudentGroupType;
  /** メンバーの uid 配列（2 人以上）。順序に意味は無い。 */
  memberIds: string[];
  /** 共通の担当講師。空配列なら指定なし。 */
  assignedTeacherIds: string[];
  status: StudentGroupStatus;
  note?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SlotStatus = 'open' | 'closed' | 'booked';
export type SlotSource = 'system_generated' | 'teacher_managed' | 'admin_managed';

export interface PrivateSlot {
  id: string;
  teacherId: string;
  title?: string | null;
  startAt: Timestamp;
  endAt: Timestamp;
  status: SlotStatus;
  source: SlotSource;
  note?: string | null;
  /** 週表示グリッドのコマ色（未設定時は教師プロフィール／管理画面のステータス別色） */
  weekCellBg?: string | null;
  weekCellText?: string | null;
  weekKey: string; // YYYY-MM-DD (monday start)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type BookingStatus = 
  | 'booked'
  | 'rescheduled'
  | 'cancelled_consumed'
  | 'completed'
  | 'no_show_consumed';

export type ConsumptionReason = 
  | 'booking_completed'
  | 'late_change'
  | 'no_show'
  | 'quota_exceeded'
  | 'no_slot_available';

export interface BookingConsumption {
  consumedCount: number;
  consumedAt?: Timestamp | null;
  consumedReason?: ConsumptionReason | null;
}

/**
 * 予約参加者単位での消費レコード（セミプライベートでメンバー個別に管理するため）。
 */
export interface BookingAttendeeConsumption {
  studentId: string;
  enrollmentId: string;
  consumed: boolean;
  consumedAt?: Timestamp | null;
  consumedReason?: ConsumptionReason | null;
}

export type BookingType = 'private' | 'semi_private';

export interface PolicySnapshot {
  rescheduleDeadlineHours: number;
  breakBufferMinutes: number;
  weekStartsOn: string;
}

export interface PrivateBooking {
  id: string;
  slotId: string;
  teacherId: string;
  /**
   * 代表者の uid。
   * セミプライベートの場合も「予約を主導した1名」を入れる（後方互換／検索用）。
   */
  studentId: string;
  /** 代表者の enrollment id（後方互換） */
  enrollmentId: string;
  /**
   * 実際に予約されたレッスン時間（分）。記録用。
   * 通常は消費した enrollment.lessonMinutes と一致する。
   */
  lessonMinutes?: number;
  /**
   * レッスン種別。未指定の場合は 'private' とみなす（後方互換）。
   */
  type?: BookingType;
  /**
   * セミプライベート時に設定されるグループ ID。
   * プライベートの場合は null / undefined。
   */
  groupId?: string | null;
  /**
   * 参加者全員の uid 一覧（セミプライベートで使用）。
   * クライアントからの絞り込みクエリに使うため flat な配列で持つ。
   * プライベート単独の場合は省略可。
   */
  attendeeStudentIds?: string[];
  /**
   * 参加者ごとの消費状況。
   * セミプライベートはメンバー人数分のエントリが入る。
   * プライベート単独の場合は省略可（既存の `consumption` を参照）。
   */
  attendeeConsumptions?: BookingAttendeeConsumption[];
  status: BookingStatus;
  bookedAt: Timestamp;
  bookedBy: string; // uid (student or admin)
  rescheduledFromBookingId?: string | null;
  rescheduleRequestedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;
  cancellationReason?: string | null;
  zoomURL?: string | null;
  consumption: BookingConsumption;
  policySnapshot: PolicySnapshot;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===========================
// Teacher Private Rules
// ===========================

export interface AvailabilityWindow {
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface TeacherPrivateRules {
  id: string; // teacherId
  availabilityWindows: AvailabilityWindow[];
  breakBetweenLessonsMinutesMin: number;
  lunchBreakRequiredMinutesPerDay: number;
  weeklyBookingCapEnabled: boolean;
  weeklyBookingCapHours?: number | null;
  weekStartsOn: string; // "monday"
  updatedAt: Timestamp;
}

// ===========================
// Settings
// ===========================

export type BookingCutoffMode = 
  | 'teacher_close'
  | 'global_days_before'
  | 'global_hours_before'
  | 'hybrid';

export interface BookingCutoff {
  mode: BookingCutoffMode;
  globalDaysBefore?: number | null;
  globalHoursBefore?: number | null;
  minLeadTimeHours?: number | null;
}

export interface EmailSettings {
  provider: string; // 'sendgrid' | 'mailgun' | 'firebase_extension_trigger_email' | 'other'
  fromName: string;
  fromEmail: string;
}

export interface AppSettings {
  privateLessonDurationMinutes: number;
  breakBufferMinutesDefault: number;
  rescheduleDeadlineHours: number;
  bookingCutoff: BookingCutoff;
  weekStartsOn: string;
  email: EmailSettings;
  updatedAt: Timestamp;
}

// ===========================
// Announcements
// ===========================

export type AnnouncementImportance = 'normal' | 'important' | 'urgent';

export type AnnouncementTarget = 'all' | 'roles' | 'individual';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  importance: AnnouncementImportance;
  target: AnnouncementTarget;
  audienceRoles: UserRole[];
  targetStudentIds: string[];
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===========================
// Lesson Content
// ===========================

export interface AttachmentItem {
  path: string;
  type: 'pdf' | 'image' | 'other';
}

export interface LessonSummary {
  id: string;
  sessionId: string;
  classId: string;
  createdBy: string; // teacherId
  title: string;
  body: string;
  attachments: AttachmentItem[];
  published: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface VocabularyItem {
  word: string;
  meaning?: string | null;
  example?: string | null;
  audioPath?: string | null;
}

export interface VocabularyList {
  id: string;
  sessionId: string;
  classId: string;
  createdBy: string; // teacherId
  items: VocabularyItem[];
  published: boolean;
  updatedAt: Timestamp;
}

export interface Homework {
  id: string;
  sessionId: string;
  classId: string;
  createdBy: string; // teacherId
  title: string;
  instructions: string;
  dueAt: Timestamp;
  attachments: AttachmentItem[];
  published: boolean;
  updatedAt: Timestamp;
}

// ===========================
// Messaging
// ===========================

export interface MessageThread {
  id: string;
  participantIds: string[]; // uids
  participantRoles: string[];
  lastMessageAt: Timestamp;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  attachmentPath?: string | null;
  relatedBookingId?: string | null;
  relatedSlotId?: string | null;
  createdAt: Timestamp;
  readBy: string[]; // uids
}

// ===========================
// Email Queue
// ===========================

export type EmailTemplate = 'booking_confirmation' | 'booking_rescheduled' | 'booking_cancelled';
export type EmailStatus = 'queued' | 'sent' | 'failed';

export interface EmailPayload {
  studentName: string;
  teacherName: string;
  startAt: Timestamp;
  endAt: Timestamp;
  locationOrOnline: string;
  zoomURL?: string | null;
  policyNotes: string;
}

export interface EmailQueue {
  id: string;
  to: string;
  template: EmailTemplate;
  payload: EmailPayload;
  status: EmailStatus;
  createdAt: Timestamp;
  sentAt?: Timestamp | null;
  error?: string | null;
}

// ===========================
// Helper Functions
// ===========================

export function calculateRescheduleAllowed(registeredCount: number): number {
  if (registeredCount >= 1 && registeredCount <= 3) return 0;
  if (registeredCount >= 4 && registeredCount <= 7) return 1;
  if (registeredCount >= 8 && registeredCount <= 11) return 2;
  return Math.floor(registeredCount / 4);
}

export function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dd}`;
}
