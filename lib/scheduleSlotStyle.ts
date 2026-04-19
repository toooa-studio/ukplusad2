import type { CSSProperties } from 'react';

/** 週表示グリッドのコマ枠線（教師週表示と揃える） */
export const SLOT_WEEK_CELL_BORDER = '2px solid rgba(15, 23, 42, 0.28)';

export type SlotWeekEffectiveStatus = 'open' | 'booked' | 'closed';

export type SlotWeekThemeColors = {
  open: { bg: string; text: string };
  booked: { bg: string; text: string };
  closed: { bg: string; text: string };
};

/** 管理画面週表示の従来色（Tailwind の green/blue/gray 系に近い値） */
export const ADMIN_CALENDAR_WEEK_THEME: SlotWeekThemeColors = {
  open: { bg: '#dcfce7', text: '#166534' },
  booked: { bg: '#dbeafe', text: '#1e40af' },
  closed: { bg: '#f3f4f6', text: '#4b5563' },
};

/** 教師マイスケジュールの `teacherProfiles` 週色設定 → テーマ */
export function teacherProfileToWeekTheme(c: {
  scheduleWeekOpenBg: string;
  scheduleWeekOpenText: string;
  scheduleWeekBookedBg: string;
  scheduleWeekBookedText: string;
  scheduleWeekClosedBg: string;
  scheduleWeekClosedText: string;
}): SlotWeekThemeColors {
  return {
    open: { bg: c.scheduleWeekOpenBg, text: c.scheduleWeekOpenText },
    booked: { bg: c.scheduleWeekBookedBg, text: c.scheduleWeekBookedText },
    closed: { bg: c.scheduleWeekClosedBg, text: c.scheduleWeekClosedText },
  };
}

export type SlotWeekColorPreset = {
  id: string;
  label: string;
  weekCellBg: string | null;
  weekCellText: string | null;
};

/** 週表示コマのプリセット（背景・文字のコントラスト済み） */
export const SLOT_WEEK_COLOR_PRESETS: SlotWeekColorPreset[] = [
  { id: 'default', label: 'デフォルト', weekCellBg: null, weekCellText: null },
  { id: 'mint', label: 'ミント', weekCellBg: '#86efac', weekCellText: '#14532d' },
  { id: 'sky', label: 'スカイ', weekCellBg: '#bae6fd', weekCellText: '#0c4a6e' },
  { id: 'violet', label: 'バイオレット', weekCellBg: '#ddd6fe', weekCellText: '#4c1d95' },
  { id: 'amber', label: 'アンバー', weekCellBg: '#fde68a', weekCellText: '#78350f' },
  { id: 'rose', label: 'ローズ', weekCellBg: '#fecdd3', weekCellText: '#881337' },
  { id: 'slate', label: 'スレート', weekCellBg: '#e2e8f0', weekCellText: '#0f172a' },
  { id: 'coral', label: 'コーラル', weekCellBg: '#fed7aa', weekCellText: '#9a3412' },
];

export function getSlotWeekColorPresetById(id: string): SlotWeekColorPreset | undefined {
  return SLOT_WEEK_COLOR_PRESETS.find((p) => p.id === id);
}

export function matchSlotWeekColorPresetId(slot: {
  weekCellBg?: string | null;
  weekCellText?: string | null;
}): string {
  const bg = slot.weekCellBg?.trim();
  const text = slot.weekCellText?.trim();
  if (!bg || !text) return 'default';
  const hit = SLOT_WEEK_COLOR_PRESETS.find(
    (p) => p.weekCellBg === bg && p.weekCellText === text,
  );
  return hit?.id ?? 'custom';
}

type SlotWeekCellFields = {
  weekCellBg?: string | null;
  weekCellText?: string | null;
};

/** 月表示の小さなドット用（背景のみ） */
export function monthSlotDotBackground(
  slot: SlotWeekCellFields,
  opts: { isCancelled: boolean; hasActiveBooking: boolean; isClosed: boolean },
): string {
  if (opts.isCancelled) return '#fb923c';
  if (opts.hasActiveBooking) return '#3b82f6';
  if (opts.isClosed) return '#9ca3af';
  const bg = slot.weekCellBg?.trim();
  if (bg) return bg;
  return '#22c55e';
}

export function slotWeekCellComputedStyle(
  slot: SlotWeekCellFields,
  effectiveStatus: SlotWeekEffectiveStatus,
  theme: SlotWeekThemeColors,
): Pick<CSSProperties, 'backgroundColor' | 'color' | 'border'> {
  const bg = slot.weekCellBg?.trim();
  const text = slot.weekCellText?.trim();
  if (bg && text) {
    return {
      backgroundColor: bg,
      color: text,
      border: SLOT_WEEK_CELL_BORDER,
    };
  }
  const row = theme[effectiveStatus];
  return {
    backgroundColor: row.bg,
    color: row.text,
    border: SLOT_WEEK_CELL_BORDER,
  };
}
