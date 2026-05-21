import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 予約時間の最少単位（分）。
 * 空き枠の開始時刻・レッスン時間はこの値の倍数で指定する。
 */
export const BOOKING_DURATION_STEP_MINUTES = 30;

/**
 * 0〜59 分のうち、step 分単位の値だけを返す。
 * 例: step=30 → [0, 30] / step=15 → [0, 15, 30, 45]
 */
export function generateMinuteStepOptions(step: number = BOOKING_DURATION_STEP_MINUTES): number[] {
  if (step <= 0 || step > 60) return [0];
  const out: number[] = [];
  for (let m = 0; m < 60; m += step) out.push(m);
  return out;
}

/**
 * 任意の分の値を step 単位に丸める（最も近い倍数に向けて切り捨て）。
 * 例: roundDownToStep(45, 30) → 30
 */
export function roundDownToStep(minutes: number, step: number = BOOKING_DURATION_STEP_MINUTES): number {
  if (step <= 0) return minutes;
  return Math.floor(minutes / step) * step;
}

/**
 * Timestamp型をDateに変換
 */
export function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}

/**
 * 日付を"YYYY-MM-DD"形式に変換
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付を"YYYY年MM月DD日"形式に変換
 */
export function formatDateJa(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 時刻を"HH:mm"形式に変換
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * 日時を"YYYY年MM月DD日 HH:mm"形式に変換
 */
export function formatDateTime(date: Date | string): string {
  return `${formatDateJa(date)} ${formatTime(date)}`;
}

/**
 * 週の月曜日を取得（週は月曜始まり）
 */
export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * 週キー（YYYY-MM-DD形式の月曜日）を取得
 */
export function getWeekKey(date: Date): string {
  const monday = getMonday(date);
  return formatDate(monday);
}

/**
 * 週の日付配列を取得（月曜～日曜）
 */
export function getWeekDates(date: Date): Date[] {
  const monday = getMonday(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * 週表示・Firestore範囲クエリ用: 月曜0:00 〜 日曜23:59:59.999（ローカル）
 * getWeekDates() 単体では時刻が元の日付のまま残るため、朝の枠がクエリから漏れるのを防ぐ
 */
export function getWeekRangeBounds(anchorDate: Date): { start: Date; end: Date } {
  const wd = getWeekDates(anchorDate);
  const start = new Date(wd[0]);
  start.setHours(0, 0, 0, 0);
  const end = new Date(wd[6]);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * 曜日名を取得
 */
export function getDayName(date: Date): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

/**
 * 時間範囲が重複しているかチェック
 */
export function isTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * 分を時間表記に変換（例: 90 → "1時間30分"）
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}分`;
  if (mins === 0) return `${hours}時間`;
  return `${hours}時間${mins}分`;
}

/**
 * 重なるスロットのカラムレイアウトを計算
 * 各スロットに columnIndex (何列目) と totalColumns (全体の列数) を割り当て
 */
export interface SlotLayout {
  id: string;
  columnIndex: number;
  totalColumns: number;
}

export function calculateOverlapLayout(
  items: { id: string; startMinutes: number; endMinutes: number }[]
): Record<string, SlotLayout> {
  if (items.length === 0) return {};

  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const groups: (typeof items)[] = [];
  let currentGroup = [sorted[0]];
  let groupEnd = sorted[0].endMinutes;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.startMinutes < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, item.endMinutes);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = item.endMinutes;
    }
  }
  groups.push(currentGroup);

  const result: Record<string, SlotLayout> = {};

  for (const group of groups) {
    if (group.length === 1) {
      result[group[0].id] = { id: group[0].id, columnIndex: 0, totalColumns: 1 };
      continue;
    }

    const columns: number[] = [];
    const assignments: { item: typeof group[0]; col: number }[] = [];

    for (const item of group) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (item.startMinutes >= columns[col]) {
          columns[col] = item.endMinutes;
          assignments.push({ item, col });
          placed = true;
          break;
        }
      }
      if (!placed) {
        assignments.push({ item, col: columns.length });
        columns.push(item.endMinutes);
      }
    }

    const totalCols = columns.length;
    for (const { item, col } of assignments) {
      result[item.id] = { id: item.id, columnIndex: col, totalColumns: totalCols };
    }
  }

  return result;
}
