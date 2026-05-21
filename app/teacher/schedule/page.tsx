'use client';

import type { CSSProperties } from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { TeacherLayout } from '@/lib/components/TeacherLayout';
import { useAuth } from '@/lib/hooks/useAuth';
import { PrivateSlot, PrivateBooking, AppUser, BookingStatus } from '@/lib/types';
import {
  collection, getDocs, getDoc, query, where, Timestamp,
  doc, setDoc, updateDoc, deleteDoc, deleteField,
} from 'firebase/firestore';
import {
  getSlotWeekColorPresetById,
  matchSlotWeekColorPresetId,
  slotWeekCellComputedStyle,
  teacherProfileToWeekTheme,
  monthSlotDotBackground,
} from '@/lib/scheduleSlotStyle';
import { SlotWeekColorPresetStrip } from '@/lib/components/SlotWeekColorPresetStrip';
import { db } from '@/lib/firebase/client';
import {
  toDate, formatDateJa, formatTime, formatDuration,
  formatDate, getWeekDates, getWeekRangeBounds, getDayName, calculateOverlapLayout,
  BOOKING_DURATION_STEP_MINUTES, generateMinuteStepOptions,
} from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Plus, X, Clock, User,
  CheckCircle2, AlertTriangle, Trash2, Eye, Calendar, CalendarDays,
  List, Pencil, Lock, Unlock, Palette,
} from 'lucide-react';

const HOUR_HEIGHT = 64;
const START_HOUR = 9;
const END_HOUR = 22;

/** 週キー（月曜始まりの YYYY-MM-DD） */
function weekKeyFromStartDate(startDate: Date): string {
  const weekDay = startDate.getDay();
  const diff = startDate.getDate() - weekDay + (weekDay === 0 ? -6 : 1);
  const monday = new Date(startDate);
  monday.setDate(diff);
  return formatDate(monday);
}

type ViewMode = 'week' | 'month' | 'list';

/** 週表示スロット用の色（Firestore teacherProfiles と同期） */
type ScheduleWeekColors = {
  scheduleWeekOpenBg: string;
  scheduleWeekOpenText: string;
  scheduleWeekBookedBg: string;
  scheduleWeekBookedText: string;
  scheduleWeekClosedBg: string;
  scheduleWeekClosedText: string;
};

const DEFAULT_SCHEDULE_WEEK_COLORS: ScheduleWeekColors = {
  scheduleWeekOpenBg: '#86efac',
  scheduleWeekOpenText: '#14532d',
  scheduleWeekBookedBg: '#93c5fd',
  scheduleWeekBookedText: '#1e3a8a',
  scheduleWeekClosedBg: '#cbd5e1',
  scheduleWeekClosedText: '#1e293b',
};

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-green-100', text: 'text-green-800' },
  booked: { bg: 'bg-blue-100', text: 'text-blue-800' },
  closed: { bg: 'bg-gray-200', text: 'text-gray-600' },
};

function weekSlotColorsBase(
  effective: 'open' | 'booked' | 'closed',
  custom: ScheduleWeekColors,
): Pick<CSSProperties, 'backgroundColor' | 'color'> {
  switch (effective) {
    case 'booked':
      return {
        backgroundColor: custom.scheduleWeekBookedBg,
        color: custom.scheduleWeekBookedText,
      };
    case 'closed':
      return {
        backgroundColor: custom.scheduleWeekClosedBg,
        color: custom.scheduleWeekClosedText,
      };
    default:
      return {
        backgroundColor: custom.scheduleWeekOpenBg,
        color: custom.scheduleWeekOpenText,
      };
  }
}

export default function TeacherSchedulePage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<PrivateSlot[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [studentList, setStudentList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PrivateSlot | null>(null);
  const [scheduleWeekColors, setScheduleWeekColors] = useState<ScheduleWeekColors>(() => ({
    ...DEFAULT_SCHEDULE_WEEK_COLORS,
  }));
  const [showWeekColorPanel, setShowWeekColorPanel] = useState(false);
  const [savingWeekColors, setSavingWeekColors] = useState(false);
  const [weekColorsMessage, setWeekColorsMessage] = useState('');
  const [scheduleLoadError, setScheduleLoadError] = useState('');

  const weekDates = getWeekDates(currentWeek);

  useEffect(() => {
    if (!db || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'teacherProfiles', user.uid));
        if (cancelled || !snap.exists()) return;
        const d = snap.data();
        setScheduleWeekColors({
          scheduleWeekOpenBg: (d.scheduleWeekOpenBg as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekOpenBg,
          scheduleWeekOpenText: (d.scheduleWeekOpenText as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekOpenText,
          scheduleWeekBookedBg: (d.scheduleWeekBookedBg as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekBookedBg,
          scheduleWeekBookedText: (d.scheduleWeekBookedText as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekBookedText,
          scheduleWeekClosedBg: (d.scheduleWeekClosedBg as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekClosedBg,
          scheduleWeekClosedText: (d.scheduleWeekClosedText as string) || DEFAULT_SCHEDULE_WEEK_COLORS.scheduleWeekClosedText,
        });
      } catch (e) {
        console.error('Failed to load schedule week colors:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSaveWeekColors = async () => {
    if (!db || !user?.uid) return;
    setSavingWeekColors(true);
    setWeekColorsMessage('');
    try {
      await setDoc(
        doc(db, 'teacherProfiles', user.uid),
        {
          id: user.uid,
          ...scheduleWeekColors,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
      setWeekColorsMessage('色の設定を保存しました');
      setTimeout(() => setWeekColorsMessage(''), 4000);
    } catch (e) {
      console.error(e);
      setWeekColorsMessage('保存に失敗しました');
    } finally {
      setSavingWeekColors(false);
    }
  };

  const handleResetWeekColors = () => {
    setScheduleWeekColors({ ...DEFAULT_SCHEDULE_WEEK_COLORS });
    setWeekColorsMessage('デフォルトに戻しました（保存で反映）');
    setTimeout(() => setWeekColorsMessage(''), 4000);
  };

  const slotsSortedByStart = useMemo(() => {
    return [...slots].sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime());
  }, [slots]);

  const studentMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    studentList.forEach(s => { map[s.id] = s; });
    return map;
  }, [studentList]);

  const loadData = useCallback(async () => {
    if (!db || !user) return;
    setLoading(true);
    setScheduleLoadError('');
    try {
      let startDate: Date;
      let endDate: Date;

      if (viewMode === 'week') {
        const bounds = getWeekRangeBounds(currentWeek);
        startDate = bounds.start;
        endDate = bounds.end;
      } else if (viewMode === 'month') {
        startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      } else {
        // 一覧: 今日から約8週間先まで（後から確認・整理しやすい範囲）
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 56);
        endDate.setHours(23, 59, 59, 999);
      }

      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      // teacherId のみで取得し、日付はクライアントで絞る（複合インデックス未作成でも動作する）
      const [slotsSnap, bookingsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'privateSlots'), where('teacherId', '==', user.uid))),
        getDocs(query(
          collection(db, 'privateBookings'),
          where('teacherId', '==', user.uid),
        )),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
      ]);

      const allSlots = slotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateSlot));
      const filteredSlots = allSlots.filter(s => {
        const t = toDate(s.startAt).getTime();
        return t >= startMs && t <= endMs;
      });

      setSlots(filteredSlots);
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateBooking)));
      setStudentList(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    } catch (error) {
      console.error('Error loading schedule:', error);
      const msg = error instanceof Error ? error.message : 'データの読み込みに失敗しました';
      setScheduleLoadError(msg);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [user, viewMode, currentWeek, currentMonth]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const getBookingForSlot = (slotId: string) => {
    return bookings.find(b => b.slotId === slotId && !['cancelled_consumed', 'rescheduled'].includes(b.status));
  };

  const getSlotsForDate = (date: Date) => {
    return slots.filter(slot => {
      const d = toDate(slot.startAt);
      return formatDate(d) === formatDate(date);
    });
  };

  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <TeacherLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">マイスケジュール</h2>
              <p className="mt-1 text-sm text-gray-600">自分の空き枠と予約を管理</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              空き枠を追加
            </button>
          </div>

          {scheduleLoadError && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 rounded-[6px]" role="alert">
              <p className="font-medium">スケジュールの読み込みに失敗しました</p>
              <p className="mt-1 text-xs break-words">{scheduleLoadError}</p>
              <p className="mt-2 text-xs text-red-700">
                Firestore の権限やネットワークを確認し、ページを再読み込みしてください。
              </p>
            </div>
          )}

          {/* 表示切り替えボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors min-h-[44px] flex items-center gap-2 ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              週表示
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors min-h-[44px] flex items-center gap-2 ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              月表示
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors min-h-[44px] flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              一覧
            </button>
          </div>

          {/* ナビゲーション */}
          <div className="flex items-center justify-between bg-white border border-gray-200 p-4">
            {viewMode === 'list' ? (
              <>
                <div className="w-10" />
                <div className="text-center flex-1 px-2">
                  <span className="text-lg font-semibold text-gray-900">今後の枠（約8週間）</span>
                  <p className="text-xs text-gray-500 mt-1">今日から8週間先までの空き枠・予約を時系列で確認・編集できます</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadData()}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px] whitespace-nowrap"
                >
                  再読込
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (viewMode === 'week') {
                      const d = new Date(currentWeek);
                      d.setDate(d.getDate() - 7);
                      setCurrentWeek(d);
                    } else {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() - 1);
                      setCurrentMonth(d);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900">
                    {viewMode === 'week'
                      ? `${formatDateJa(weekDates[0])} - ${formatDateJa(weekDates[6])}`
                      : `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentWeek(new Date());
                      setCurrentMonth(new Date());
                    }}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px]"
                  >
                    {viewMode === 'week' ? '今週' : '今月'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (viewMode === 'week') {
                      const d = new Date(currentWeek);
                      d.setDate(d.getDate() + 7);
                      setCurrentWeek(d);
                    } else {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() + 1);
                      setCurrentMonth(d);
                    }
                  }}
                  className="p-2 hover:bg-gray-100 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* 凡例（週表示で設定した色と一致） */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-700 items-center">
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-[4px] shrink-0 border border-gray-400"
                style={weekSlotColorsBase('open', scheduleWeekColors)}
              />
              空き
            </span>
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-[4px] shrink-0 border border-gray-400"
                style={weekSlotColorsBase('booked', scheduleWeekColors)}
              />
              予約済み
            </span>
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-[4px] shrink-0 border border-gray-400"
                style={weekSlotColorsBase('closed', scheduleWeekColors)}
              />
              閉鎖
            </span>
          </div>

          {/* 週表示の枠色カスタマイズ */}
          {viewMode === 'week' && (
            <div className="border border-gray-200 bg-white p-4">
              <button
                type="button"
                onClick={() => setShowWeekColorPanel(v => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-800 bg-gray-50 border border-gray-300 rounded-[6px] hover:bg-gray-100 min-h-[44px]"
              >
                <Palette className="w-4 h-4" />
                {showWeekColorPanel ? '色設定を閉じる' : '週表示の色を自分で設定'}
              </button>
              {showWeekColorPanel && (
                <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-600">
                    空き枠・予約済み・閉鎖それぞれについて、背景色と文字色を選べます。保存するとこのアカウントで同期されます。
                  </p>
                  {(
                    [
                      { label: '空き枠', bgKey: 'scheduleWeekOpenBg' as const, textKey: 'scheduleWeekOpenText' as const },
                      { label: '予約済み', bgKey: 'scheduleWeekBookedBg' as const, textKey: 'scheduleWeekBookedText' as const },
                      { label: '閉鎖', bgKey: 'scheduleWeekClosedBg' as const, textKey: 'scheduleWeekClosedText' as const },
                    ] as const
                  ).map(row => (
                    <div
                      key={row.label}
                      className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr] gap-3 items-center"
                    >
                      <span className="text-sm font-medium text-gray-900">{row.label}</span>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        背景
                        <input
                          type="color"
                          value={scheduleWeekColors[row.bgKey]}
                          onChange={e =>
                            setScheduleWeekColors(prev => ({ ...prev, [row.bgKey]: e.target.value }))
                          }
                          className="w-full min-h-[44px] h-11 border border-gray-300 cursor-pointer rounded-[6px] bg-white"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        文字
                        <input
                          type="color"
                          value={scheduleWeekColors[row.textKey]}
                          onChange={e =>
                            setScheduleWeekColors(prev => ({ ...prev, [row.textKey]: e.target.value }))
                          }
                          className="w-full min-h-[44px] h-11 border border-gray-300 cursor-pointer rounded-[6px] bg-white"
                        />
                      </label>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleResetWeekColors}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-[6px] hover:bg-gray-200 min-h-[44px]"
                    >
                      デフォルトに戻す
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveWeekColors}
                      disabled={savingWeekColors}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-[6px] hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
                    >
                      {savingWeekColors ? '保存中...' : '色を保存'}
                    </button>
                  </div>
                  {weekColorsMessage && (
                    <p className="text-sm text-gray-700">{weekColorsMessage}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* カレンダー / 一覧 */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left">
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">日付</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">時間</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">状態</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 min-w-[120px]">授業名</th>
                      <th className="px-4 py-3 font-semibold text-gray-700">生徒</th>
                      <th className="px-4 py-3 font-semibold text-gray-700 whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotsSortedByStart.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                          この期間に枠はありません。週表示・月表示から空き枠を追加できます。
                        </td>
                      </tr>
                    ) : (
                      slotsSortedByStart.map(slot => {
                        const st = toDate(slot.startAt);
                        const en = toDate(slot.endAt);
                        const bk = getBookingForSlot(slot.id);
                        const effective = bk ? 'booked' : slot.status;
                        const stLabel =
                          effective === 'booked'
                            ? '予約済み'
                            : slot.status === 'closed'
                              ? '閉鎖'
                              : '空き';
                        const stClass =
                          effective === 'booked'
                            ? 'text-blue-700 bg-blue-50 border border-blue-200'
                            : slot.status === 'closed'
                              ? 'text-gray-600 bg-gray-100 border border-gray-200'
                              : 'text-green-700 bg-green-50 border border-green-200';
                        return (
                          <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatDateJa(st)}</td>
                            <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                              {formatTime(st)} - {formatTime(en)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 text-xs font-medium rounded-[6px] ${stClass}`}>
                                {stLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">{slot.title || '—'}</td>
                            <td className="px-4 py-3 text-gray-700 truncate max-w-[140px]">
                              {bk ? studentMap[bk.studentId]?.displayName || '—' : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-[6px] hover:bg-blue-100 min-h-[44px]"
                              >
                                <Eye className="w-4 h-4" />
                                確認・編集
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === 'month' ? (
            <TeacherMonthView
              monthDays={getMonthDays()}
              slots={slots}
              bookings={bookings}
              studentMap={studentMap}
              getSlotsForDate={getSlotsForDate}
              getBookingForSlot={getBookingForSlot}
              onSlotClick={setSelectedSlot}
            />
          ) : (
            <div className="bg-white border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  {/* ヘッダー */}
                  <div className="grid grid-cols-8 border-b border-gray-200">
                    <div className="p-2 text-xs text-gray-500 border-r border-gray-200" />
                    {weekDates.map((date, i) => {
                      const isToday = formatDate(date) === formatDate(new Date());
                      return (
                        <div key={i} className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                          <p className="text-xs text-gray-500">{getDayName(date)}</p>
                          <p className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                            {date.getDate()}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* 時間グリッド */}
                  <div className="grid grid-cols-8">
                    {/* 時間列 */}
                    <div className="border-r border-gray-200">
                      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                        <div key={i} className="border-b border-gray-100 text-xs text-gray-400 text-right pr-2 pt-1" style={{ height: HOUR_HEIGHT }}>
                          {START_HOUR + i}:00
                        </div>
                      ))}
                    </div>

                    {/* 日ごとの列 */}
                    {weekDates.map((date, dayIdx) => {
                      const daySlots = getSlotsForDate(date);
                      const isToday = formatDate(date) === formatDate(new Date());
                      const layoutItems = daySlots.map(slot => {
                        const start = toDate(slot.startAt);
                        const end = toDate(slot.endAt);
                        return {
                          id: slot.id,
                          startMinutes: start.getHours() * 60 + start.getMinutes(),
                          endMinutes: end.getHours() * 60 + end.getMinutes(),
                        };
                      });
                      const overlapLayout = calculateOverlapLayout(layoutItems);

                      return (
                        <div key={dayIdx} className={`relative border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-blue-50/30' : ''}`} style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                            <div key={i} className="border-b border-gray-100" style={{ height: HOUR_HEIGHT }} />
                          ))}

                          {daySlots.map(slot => {
                            const start = toDate(slot.startAt);
                            const end = toDate(slot.endAt);
                            const startMin = start.getHours() * 60 + start.getMinutes();
                            const endMin = end.getHours() * 60 + end.getMinutes();
                            const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24);
                            const layout = overlapLayout[slot.id];
                            const colIndex = layout?.columnIndex ?? 0;
                            const totalCols = layout?.totalColumns ?? 1;
                            const colWidthPct = 100 / totalCols;
                            const leftPct = colIndex * colWidthPct;

                            const booking = getBookingForSlot(slot.id);
                            const effectiveStatus: 'open' | 'booked' | 'closed' = booking
                              ? 'booked'
                              : slot.status === 'closed'
                                ? 'closed'
                                : 'open';

                            return (
                              <button
                                key={slot.id}
                                onClick={() => setSelectedSlot(slot)}
                                className="absolute rounded-[6px] text-xs p-1 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity text-left font-medium"
                                style={{
                                  top,
                                  height,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${colWidthPct}% - 4px)`,
                                  zIndex: 5 + colIndex,
                                  ...slotWeekCellComputedStyle(
                                    slot,
                                    effectiveStatus,
                                    teacherProfileToWeekTheme(scheduleWeekColors),
                                  ),
                                }}
                              >
                                <span className="font-semibold truncate block">
                                  {formatTime(start)}{totalCols === 1 ? ` - ${formatTime(end)}` : ''}
                                </span>
                                {slot.title && height > 28 && (
                                  <span className="block truncate font-medium">{slot.title}</span>
                                )}
                                {booking && height > 44 && (
                                  <span className="block truncate opacity-80">
                                    {studentMap[booking.studentId]?.displayName || '生徒'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showAddModal && (
          <AddSlotModal
            teacherId={user?.uid || ''}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => { setShowAddModal(false); loadData(); }}
          />
        )}

        {selectedSlot && (
          <SlotDetailModal
            slot={selectedSlot}
            booking={getBookingForSlot(selectedSlot.id) || null}
            student={getBookingForSlot(selectedSlot.id) ? studentMap[getBookingForSlot(selectedSlot.id)!.studentId] : undefined}
            onClose={() => setSelectedSlot(null)}
            onRefresh={loadData}
          />
        )}
      </TeacherLayout>
    </ProtectedRoute>
  );
}

/* ==================== 空き枠追加モーダル ==================== */

interface AddSlotModalProps {
  teacherId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddSlotModal({ teacherId, onClose, onSuccess }: AddSlotModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [durationHour, setDurationHour] = useState(1);
  const [durationMinute, setDurationMinute] = useState(0);
  const [colorPresetId, setColorPresetId] = useState('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const hourOptions = Array.from({ length: 13 }, (_, i) => i + 9);
  const minuteOptions = generateMinuteStepOptions();
  const durationHourOptions = Array.from({ length: 13 }, (_, i) => i);
  const durationMinuteOptions = generateMinuteStepOptions();

  const totalDuration = durationHour * 60 + durationMinute;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setError('');

    if (totalDuration <= 0) {
      setError('空き枠の時間を1分以上に設定してください。');
      return;
    }
    if (totalDuration % BOOKING_DURATION_STEP_MINUTES !== 0) {
      setError(`空き枠の時間は ${BOOKING_DURATION_STEP_MINUTES} 分単位で設定してください。`);
      return;
    }
    if (startMinute % BOOKING_DURATION_STEP_MINUTES !== 0) {
      setError(`開始時刻は ${BOOKING_DURATION_STEP_MINUTES} 分単位で設定してください。`);
      return;
    }

    setSubmitting(true);

    try {
      const [year, month, day] = date.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, startHour, startMinute);
      const endDate = new Date(startDate.getTime() + totalDuration * 60000);

      const weekStart = new Date(startDate);
      const d = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - d + (d === 0 ? -6 : 1));
      const weekKey = formatDate(weekStart);

      const colorPreset = getSlotWeekColorPresetById(colorPresetId) ?? getSlotWeekColorPresetById('default')!;
      const colorFields =
        colorPreset.weekCellBg && colorPreset.weekCellText
          ? { weekCellBg: colorPreset.weekCellBg, weekCellText: colorPreset.weekCellText }
          : {};

      const slotRef = doc(collection(db, 'privateSlots'));
      await setDoc(slotRef, {
        id: slotRef.id,
        teacherId,
        title: title.trim() || null,
        startAt: Timestamp.fromDate(startDate),
        endAt: Timestamp.fromDate(endDate),
        status: 'open',
        source: 'teacher_managed',
        note: null,
        weekKey,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...colorFields,
      });
      onSuccess();
    } catch (err: unknown) {
      console.error('Error creating slot:', err);
      const firebaseErr = err as { code?: string; message?: string };
      setError(`作成に失敗しました: ${firebaseErr.code || firebaseErr.message || '不明なエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">空き枠を追加</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">授業名</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例：英会話レッスン、IELTS対策"
              className="w-full px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <span className="block text-xs text-gray-500 mb-1">時</span>
                <select
                  value={String(startHour)}
                  onChange={e => setStartHour(Number(e.target.value))}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  {hourOptions.map(h => (
                    <option key={h} value={String(h)}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-gray-500 mb-1">分</span>
                <select
                  value={String(startMinute)}
                  onChange={e => setStartMinute(Number(e.target.value))}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  {minuteOptions.map(m => (
                    <option key={m} value={String(m)}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">空き枠の長さ</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <span className="block text-xs text-gray-500 mb-1">時間</span>
                <select
                  value={String(durationHour)}
                  onChange={e => setDurationHour(Number(e.target.value))}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  {durationHourOptions.map(h => (
                    <option key={h} value={String(h)}>{h}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-gray-500 mb-1">分</span>
                <select
                  value={String(durationMinute)}
                  onChange={e => setDurationMinute(Number(e.target.value))}
                  className="w-full min-w-0 px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                >
                  {durationMinuteOptions.map(m => (
                    <option key={m} value={String(m)}>{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            {totalDuration > 0 && (
              <p className="mt-1 text-xs text-gray-500">合計: {totalDuration}分</p>
            )}
          </div>

          <SlotWeekColorPresetStrip value={colorPresetId} onChange={setColorPresetId} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[44px]"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-[6px] hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {submitting ? '作成中...' : '空き枠を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== スロット詳細モーダル ==================== */

interface SlotDetailModalProps {
  slot: PrivateSlot;
  booking: PrivateBooking | null;
  student?: AppUser;
  onClose: () => void;
  onRefresh: () => void;
}

function SlotDetailModal({ slot, booking, student, onClose, onRefresh }: SlotDetailModalProps) {
  const [processing, setProcessing] = useState(false);
  const [editingSlot, setEditingSlot] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editStartH, setEditStartH] = useState(10);
  const [editStartM, setEditStartM] = useState(0);
  const [editDurH, setEditDurH] = useState(1);
  const [editDurM, setEditDurM] = useState(0);
  const [editError, setEditError] = useState('');
  const [editColorPresetId, setEditColorPresetId] = useState('default');
  const [editCustomBg, setEditCustomBg] = useState('#86efac');
  const [editCustomText, setEditCustomText] = useState('#14532d');

  const start = toDate(slot.startAt);
  const end = toDate(slot.endAt);
  const dur = Math.round((end.getTime() - start.getTime()) / 60000);

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteOptions = useMemo(() => generateMinuteStepOptions(), []);
  const durHourOptions = useMemo(() => Array.from({ length: 13 }, (_, i) => i), []);
  const durMinuteOptions = useMemo(() => generateMinuteStepOptions(), []);

  useEffect(() => {
    const s = toDate(slot.startAt);
    const e = toDate(slot.endAt);
    const minutes = Math.max(1, Math.round((e.getTime() - s.getTime()) / 60000));
    setEditTitle(slot.title || '');
    setEditDate(formatDate(s));
    setEditStartH(s.getHours());
    setEditStartM(s.getMinutes());
    setEditDurH(Math.floor(minutes / 60));
    setEditDurM(minutes % 60);
    setEditingSlot(false);
    setEditError('');
    setEditColorPresetId(matchSlotWeekColorPresetId(slot));
    setEditCustomBg(slot.weekCellBg?.trim() || '#86efac');
    setEditCustomText(slot.weekCellText?.trim() || '#14532d');
  }, [slot.id]);

  const canEditSlotFields = !booking && slot.status !== 'booked';

  const handleComplete = async () => {
    if (!db || !booking) return;
    if (!confirm('この授業を「完了」にしますか？')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', booking.id), {
        status: 'completed' as BookingStatus,
        'consumption.consumedCount': 1,
        'consumption.consumedAt': Timestamp.now(),
        'consumption.consumedReason': 'booking_completed',
        updatedAt: Timestamp.now(),
      });
      onRefresh(); onClose();
    } catch (e) { console.error(e); alert('更新に失敗しました'); }
    finally { setProcessing(false); }
  };

  const handleNoShow = async () => {
    if (!db || !booking) return;
    if (!confirm('ノーショーとして記録しますか？回数は消化されます。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', booking.id), {
        status: 'no_show_consumed' as BookingStatus,
        'consumption.consumedCount': 1,
        'consumption.consumedAt': Timestamp.now(),
        'consumption.consumedReason': 'no_show',
        updatedAt: Timestamp.now(),
      });
      onRefresh(); onClose();
    } catch (e) { console.error(e); alert('更新に失敗しました'); }
    finally { setProcessing(false); }
  };

  const handleDeleteSlot = async () => {
    if (!db) return;
    if (booking) { alert('予約済みのスロットは削除できません'); return; }
    if (!confirm('この空き枠を削除しますか？')) return;
    setProcessing(true);
    try {
      await deleteDoc(doc(db, 'privateSlots', slot.id));
      onRefresh(); onClose();
    } catch (e) { console.error(e); alert('削除に失敗しました'); }
    finally { setProcessing(false); }
  };

  const handleCloseSlot = async () => {
    if (!db || booking) return;
    if (slot.status !== 'open') return;
    if (!confirm('この枠を閉鎖しますか？生徒は予約できなくなります。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateSlots', slot.id), {
        status: 'closed' as const,
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
      alert('閉鎖に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleReopenSlot = async () => {
    if (!db || booking) return;
    if (slot.status !== 'closed') return;
    if (!confirm('閉鎖を解除し、再び空き枠として公開しますか？')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateSlots', slot.id), {
        status: 'open' as const,
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
      alert('再開に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveSlotEdit = async () => {
    if (!db || !canEditSlotFields) return;
    setEditError('');
    const totalMin = editDurH * 60 + editDurM;
    if (totalMin <= 0) {
      setEditError('枠の長さは1分以上にしてください');
      return;
    }
    if (totalMin % BOOKING_DURATION_STEP_MINUTES !== 0) {
      setEditError(`枠の長さは ${BOOKING_DURATION_STEP_MINUTES} 分単位で設定してください`);
      return;
    }
    if (editStartM % BOOKING_DURATION_STEP_MINUTES !== 0) {
      setEditError(`開始時刻は ${BOOKING_DURATION_STEP_MINUTES} 分単位で設定してください`);
      return;
    }
    setProcessing(true);
    try {
      const [y, m, d] = editDate.split('-').map(Number);
      const startDate = new Date(y, m - 1, d, editStartH, editStartM, 0, 0);
      const endDate = new Date(startDate.getTime() + totalMin * 60000);

      const preset = getSlotWeekColorPresetById(editColorPresetId);
      let colorPayload: Record<string, unknown> = {
        weekCellBg: deleteField(),
        weekCellText: deleteField(),
      };
      if (editColorPresetId === 'custom') {
        const bg = editCustomBg.trim();
        const tx = editCustomText.trim();
        if (bg && tx) {
          colorPayload = { weekCellBg: bg, weekCellText: tx };
        }
      } else if (preset?.weekCellBg && preset.weekCellText) {
        colorPayload = { weekCellBg: preset.weekCellBg, weekCellText: preset.weekCellText };
      }

      await updateDoc(doc(db, 'privateSlots', slot.id), {
        title: editTitle.trim() || null,
        startAt: Timestamp.fromDate(startDate),
        endAt: Timestamp.fromDate(endDate),
        weekKey: weekKeyFromStartDate(startDate),
        updatedAt: Timestamp.now(),
        ...colorPayload,
      });
      setEditingSlot(false);
      onRefresh();
      onClose();
    } catch (e) {
      console.error(e);
      setEditError('保存に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">空き枠の確認・編集</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ステータス */}
          <div>
            {booking ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                <User className="w-4 h-4" /> 予約済み
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full ${statusColors[slot.status].bg} ${statusColors[slot.status].text}`}>
                <Clock className="w-4 h-4" /> {slot.status === 'open' ? '空き' : '閉鎖'}
              </span>
            )}
            {booking && booking.status === 'completed' && (
              <span className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                <CheckCircle2 className="w-4 h-4" /> 完了
              </span>
            )}
            {booking && booking.status === 'no_show_consumed' && (
              <span className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-full bg-orange-100 text-orange-800">
                <AlertTriangle className="w-4 h-4" /> ノーショー
              </span>
            )}
          </div>

          {/* 日時（閲覧） */}
          {!editingSlot && (
            <div className="border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900">{formatDateJa(start)}</p>
              <p className="text-sm text-gray-600">{formatTime(start)} - {formatTime(end)}（{formatDuration(dur)}）</p>
            </div>
          )}

          {booking && booking.status === 'booked' && (
            <div className="border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
              予約が入っているため、日時の変更・枠の削除はできません。予約の取り消しが必要な場合は管理者へご相談ください。
            </div>
          )}

          {/* 生徒情報 */}
          {booking && student && (
            <div className="border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">生徒</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{student.displayName || '不明'}</p>
                  <p className="text-xs text-gray-500">{student.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* アクション: 授業ステータス */}
          {booking && booking.status === 'booked' && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500 font-medium">授業ステータスの変更</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleComplete} disabled={processing} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-[6px] hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[44px]">
                  <CheckCircle2 className="w-4 h-4" /> 完了
                </button>
                <button onClick={handleNoShow} disabled={processing} className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white text-sm font-medium rounded-[6px] hover:bg-orange-700 transition-colors disabled:opacity-50 min-h-[44px]">
                  <AlertTriangle className="w-4 h-4" /> ノーショー
                </button>
              </div>
            </div>
          )}

          {/* 枠の編集（予約なし・かつFirestore上もbookedでない） */}
          {canEditSlotFields && (
            <div className="border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">日時・授業名の編集</p>
                {!editingSlot && (
                  <button
                    type="button"
                    onClick={() => setEditingSlot(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-[6px] hover:bg-blue-100 min-h-[44px]"
                  >
                    <Pencil className="w-4 h-4" />
                    編集する
                  </button>
                )}
              </div>
              {editingSlot && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">授業名（任意）</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-[6px] text-gray-900 min-h-[44px]"
                      placeholder="例：英会話レッスン"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-[6px] min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">開始</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={String(editStartH)}
                        onChange={e => setEditStartH(Number(e.target.value))}
                        className="min-w-0 w-full px-2 py-2 border border-gray-300 rounded-[6px] min-h-[44px]"
                      >
                        {hourOptions.map(h => <option key={h} value={String(h)}>{h}時</option>)}
                      </select>
                      <select
                        value={String(editStartM)}
                        onChange={e => setEditStartM(Number(e.target.value))}
                        className="min-w-0 w-full px-2 py-2 border border-gray-300 rounded-[6px] min-h-[44px]"
                      >
                        {minuteOptions.map(m => <option key={m} value={String(m)}>{m.toString().padStart(2, '0')}分</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">枠の長さ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={String(editDurH)}
                        onChange={e => setEditDurH(Number(e.target.value))}
                        className="min-w-0 w-full px-2 py-2 border border-gray-300 rounded-[6px] min-h-[44px]"
                      >
                        {durHourOptions.map(h => <option key={h} value={String(h)}>{h}時間</option>)}
                      </select>
                      <select
                        value={String(editDurM)}
                        onChange={e => setEditDurM(Number(e.target.value))}
                        className="min-w-0 w-full px-2 py-2 border border-gray-300 rounded-[6px] min-h-[44px]"
                      >
                        {durMinuteOptions.map(m => <option key={m} value={String(m)}>{m.toString().padStart(2, '0')}分</option>)}
                      </select>
                    </div>
                  </div>
                  <SlotWeekColorPresetStrip
                    value={editColorPresetId}
                    onChange={setEditColorPresetId}
                    showCustomOption
                  />
                  {editColorPresetId === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">背景色</label>
                        <input
                          type="color"
                          value={editCustomBg}
                          onChange={e => setEditCustomBg(e.target.value)}
                          className="h-11 w-full min-h-[44px] cursor-pointer border border-gray-300 rounded-[6px] bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">文字色</label>
                        <input
                          type="color"
                          value={editCustomText}
                          onChange={e => setEditCustomText(e.target.value)}
                          className="h-11 w-full min-h-[44px] cursor-pointer border border-gray-300 rounded-[6px] bg-white"
                        />
                      </div>
                    </div>
                  )}
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingSlot(false); setEditError(''); }}
                      className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-[6px] hover:bg-gray-200 min-h-[44px]"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSlotEdit}
                      disabled={processing}
                      className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-[6px] hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
                    >
                      {processing ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 閉鎖・再開・削除 */}
          {canEditSlotFields && !editingSlot && (
            <div className="space-y-2">
              {slot.status === 'open' && (
                <button
                  type="button"
                  onClick={handleCloseSlot}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-800 bg-gray-100 border border-gray-300 rounded-[6px] hover:bg-gray-200 disabled:opacity-50 min-h-[44px]"
                >
                  <Lock className="w-4 h-4" />
                  この枠を閉鎖する（予約不可）
                </button>
              )}
              {slot.status === 'closed' && (
                <button
                  type="button"
                  onClick={handleReopenSlot}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-[6px] hover:bg-green-100 disabled:opacity-50 min-h-[44px]"
                >
                  <Unlock className="w-4 h-4" />
                  閉鎖を解除して空きに戻す
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteSlot}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-[6px] hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" /> 空き枠を削除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================
// 教師用月表示コンポーネント
// ============================

interface TeacherMonthViewProps {
  monthDays: (Date | null)[];
  slots: PrivateSlot[];
  bookings: PrivateBooking[];
  studentMap: Record<string, AppUser>;
  getSlotsForDate: (date: Date) => PrivateSlot[];
  getBookingForSlot: (slotId: string) => PrivateBooking | undefined;
  onSlotClick: (slot: PrivateSlot) => void;
}

function TeacherMonthView({ monthDays, slots, bookings, studentMap, getSlotsForDate, getBookingForSlot, onSlotClick }: TeacherMonthViewProps) {
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const selectedDaySlots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <div className="bg-white border border-gray-200 p-4">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={`text-center text-sm font-semibold py-2 ${
              i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="aspect-square bg-gray-50 rounded border border-gray-100" />;
          }

          const dateStr = formatDate(date);
          const isToday = dateStr === today;
          const daySlots = getSlotsForDate(date);
          const dayOfWeek = date.getDay();

          const bookedCount = daySlots.filter(slot => {
            const booking = getBookingForSlot(slot.id);
            return booking && !['cancelled_consumed', 'rescheduled'].includes(booking.status);
          }).length;
          const openCount = daySlots.filter(slot => {
            const booking = getBookingForSlot(slot.id);
            return slot.status === 'open' && !booking;
          }).length;
          const closedCount = daySlots.filter(slot => slot.status === 'closed').length;
          const totalCount = daySlots.length;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(date)}
              className={`aspect-square border rounded-[6px] p-2 flex flex-col text-left cursor-pointer ${
                isToday
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              } transition-colors`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-sm font-semibold ${
                    isToday
                      ? 'text-blue-600'
                      : dayOfWeek === 0
                      ? 'text-red-600'
                      : dayOfWeek === 6
                      ? 'text-blue-600'
                      : 'text-gray-900'
                  }`}
                >
                  {date.getDate()}
                </span>
                {totalCount > 0 && (
                  <span className="text-xs text-gray-400">{totalCount}</span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-0.5 text-xs overflow-hidden">
                {daySlots
                  .sort((a, b) => toDate(a.startAt).getTime() - toDate(b.startAt).getTime())
                  .slice(0, 4)
                  .map(slot => {
                    const start = toDate(slot.startAt);
                    const end = toDate(slot.endAt);
                    const booking = getBookingForSlot(slot.id);
                    const student = booking ? studentMap[booking.studentId] : null;
                    const studentName = student?.displayName?.substring(0, 4) || '';
                    const isCancelled =
                      !!booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled');
                    const hasActiveBooking = !!booking && !isCancelled;
                    const dotBg = monthSlotDotBackground(slot, {
                      isCancelled,
                      hasActiveBooking,
                      isClosed: slot.status === 'closed',
                    });

                    return (
                      <div key={slot.id} className="flex items-center gap-1 truncate leading-tight">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotBg }} />
                        <span className="truncate text-gray-700">
                          {formatTime(start)}-{formatTime(end)}
                          {studentName && <span className="text-blue-600 ml-0.5">{studentName}</span>}
                        </span>
                      </div>
                    );
                  })}
                {daySlots.length > 4 && (
                  <span className="text-gray-400 text-center">+{daySlots.length - 4}件</span>
                )}
                {daySlots.length === 0 && (
                  <span className="text-gray-300 text-center mt-auto">-</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>予約済み</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>空き</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span>閉鎖</span>
        </div>
      </div>

      {/* 日別予定一覧モーダル */}
      {selectedDate && (
        <TeacherDayDetailModal
          date={selectedDate}
          daySlots={selectedDaySlots}
          studentMap={studentMap}
          getBookingForSlot={getBookingForSlot}
          onSlotClick={(slot) => { setSelectedDate(null); onSlotClick(slot); }}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ============================
// 日別予定一覧モーダル（教師用）
// ============================

interface TeacherDayDetailModalProps {
  date: Date;
  daySlots: PrivateSlot[];
  studentMap: Record<string, AppUser>;
  getBookingForSlot: (slotId: string) => PrivateBooking | undefined;
  onSlotClick: (slot: PrivateSlot) => void;
  onClose: () => void;
}

function TeacherDayDetailModal({ date, daySlots, studentMap, getBookingForSlot, onSlotClick, onClose }: TeacherDayDetailModalProps) {
  const dayOfWeek = getDayName(date);
  const sortedSlots = [...daySlots].sort((a, b) =>
    toDate(a.startAt).getTime() - toDate(b.startAt).getTime()
  );

  const bookedCount = sortedSlots.filter(s => {
    const b = getBookingForSlot(s.id);
    return b && !['cancelled_consumed', 'rescheduled'].includes(b.status);
  }).length;
  const openCount = sortedSlots.filter(s => {
    const b = getBookingForSlot(s.id);
    return s.status === 'open' && !b;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col rounded-[6px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {date.getMonth() + 1}月{date.getDate()}日（{dayOfWeek}）
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                予約 {bookedCount}件
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                空き {openCount}件
              </span>
              <span>合計 {sortedSlots.length}件</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* スロット一覧 */}
        <div className="flex-1 overflow-y-auto p-4">
          {sortedSlots.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">この日の予定はありません</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedSlots.map(slot => {
                const start = toDate(slot.startAt);
                const end = toDate(slot.endAt);
                const booking = getBookingForSlot(slot.id);
                const student = booking ? studentMap[booking.studentId] : null;
                const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

                let statusLabel: string;
                let statusColor: string;
                let borderColor: string;

                if (booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled')) {
                  statusLabel = booking.status === 'rescheduled' ? '振替済' : 'キャンセル';
                  statusColor = 'text-orange-700 bg-orange-50';
                  borderColor = 'border-orange-200';
                } else if (booking) {
                  statusLabel = booking.status === 'completed' ? '完了' : booking.status === 'no_show_consumed' ? '欠席' : '予約済み';
                  statusColor = booking.status === 'completed' ? 'text-gray-600 bg-gray-100' : 'text-blue-700 bg-blue-50';
                  borderColor = booking.status === 'completed' ? 'border-gray-200' : 'border-blue-200';
                } else if (slot.status === 'open') {
                  statusLabel = '空き';
                  statusColor = 'text-green-700 bg-green-50';
                  borderColor = 'border-green-200';
                } else {
                  statusLabel = '閉鎖';
                  statusColor = 'text-gray-600 bg-gray-100';
                  borderColor = 'border-gray-200';
                }

                return (
                  <button
                    key={slot.id}
                    onClick={() => onSlotClick(slot)}
                    className={`w-full text-left border ${borderColor} rounded-[6px] p-3 hover:bg-gray-50 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900">
                            {formatTime(start)} - {formatTime(end)}
                          </span>
                          <span className="text-xs text-gray-400">{durationMin}分</span>
                        </div>
                        {slot.title && (
                          <p className="text-xs text-gray-600 mb-1">{slot.title}</p>
                        )}
                        {student && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <User className="w-3 h-3 text-blue-500" />
                            {student.displayName || student.email}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium rounded-[6px] text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[44px]"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
