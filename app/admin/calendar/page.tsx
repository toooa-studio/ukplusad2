'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { getWeekDates, getWeekRangeBounds, formatDate, getDayName, formatTime, formatDuration, calculateOverlapLayout } from '@/lib/utils';
import { PrivateSlot, PrivateBooking, AppUser } from '@/lib/types';
import { collection, query, where, getDocs, Timestamp, doc, setDoc, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import {
  ADMIN_CALENDAR_WEEK_THEME,
  getSlotWeekColorPresetById,
  matchSlotWeekColorPresetId,
  monthSlotDotBackground,
  slotWeekCellComputedStyle,
} from '@/lib/scheduleSlotStyle';
import { SlotWeekColorPresetStrip } from '@/lib/components/SlotWeekColorPresetStrip';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { X, ChevronLeft, ChevronRight, Clock, User, Video, FileText, Trash2, XCircle, RotateCcw, Lock, Unlock, Calendar, CalendarDays } from 'lucide-react';

const HOUR_HEIGHT = 80;
const START_HOUR = 9;
const END_HOUR = 22;

type ViewMode = 'week' | 'month';

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<PrivateSlot[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PrivateSlot | null>(null);
  const [teacherList, setTeacherList] = useState<AppUser[]>([]);
  const [studentList, setStudentList] = useState<AppUser[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);

  const weekDates = getWeekDates(currentWeek);

  const userMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    allUsers.forEach(u => { map[u.id] = u; });
    return map;
  }, [allUsers]);

  const filterTeachers = useMemo(() => [
    { id: 'all', name: 'すべて' },
    ...teacherList.map(t => ({ id: t.id, name: t.displayName || t.email || '名前未設定' })),
  ], [teacherList]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      setAllUsers(users);
      setTeacherList(users.filter(u => u.role === 'teacher'));
      setStudentList(users.filter(u => u.role === 'student'));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  useEffect(() => {
    if (viewMode === 'week') {
      loadWeekData();
    } else {
      loadMonthData();
    }
  }, [currentWeek, currentMonth, selectedTeacher, viewMode]);

  const loadWeekData = async () => {
    setLoading(true);
    try {
      const { start: startOfWeek, end: endOfWeek } = getWeekRangeBounds(currentWeek);

      const slotsQuery = query(
        collection(db, 'privateSlots'),
        where('startAt', '>=', Timestamp.fromDate(startOfWeek)),
        where('startAt', '<=', Timestamp.fromDate(endOfWeek))
      );
      const slotsSnapshot = await getDocs(slotsQuery);
      const slotsData = slotsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PrivateSlot[];

      const filteredSlots = selectedTeacher === 'all'
        ? slotsData
        : slotsData.filter(slot => slot.teacherId === selectedTeacher);
      setSlots(filteredSlots);

      const bookingsSnapshot = await getDocs(collection(db, 'privateBookings'));
      setBookings(bookingsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PrivateBooking[]);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const slotsQuery = query(
        collection(db, 'privateSlots'),
        where('startAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('startAt', '<=', Timestamp.fromDate(endOfMonth))
      );
      const slotsSnapshot = await getDocs(slotsQuery);
      const slotsData = slotsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PrivateSlot[];

      const filteredSlots = selectedTeacher === 'all'
        ? slotsData
        : slotsData.filter(slot => slot.teacherId === selectedTeacher);
      setSlots(filteredSlots);

      const bookingsSnapshot = await getDocs(collection(db, 'privateBookings'));
      setBookings(bookingsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as PrivateBooking[]);
    } catch (error) {
      console.error('Error loading month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const goToNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
    setCurrentMonth(new Date());
  };

  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: (Date | null)[] = [];
    
    // 前月の日付で埋める
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // 当月の日付
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getSlotsForDate = (date: Date) => {
    return slots.filter(slot => {
      const slotDate = slot.startAt.toDate();
      return formatDate(slotDate) === formatDate(date);
    });
  };

  const getBookingForSlot = (slotId: string) => {
    return bookings.find(b => b.slotId === slotId);
  };

  const getSlotPosition = (slot: PrivateSlot) => {
    const start = slot.startAt.toDate();
    const end = slot.endAt.toDate();
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24);
    return { top, height };
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!db) return;
    if (!confirm('この空き枠を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'privateSlots', slotId));
      setSelectedSlot(null);
      loadWeekData();
    } catch (error) {
      console.error('Error deleting slot:', error);
      alert('削除に失敗しました');
    }
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

  return (
    <ProtectedRoute allowedRoles={['admin', 'teacher']}>
      <AdminLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">予約カレンダー</h2>
              <p className="mt-1 text-sm text-gray-600">プライベートレッスンの予約状況</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              + 空き枠を追加
            </button>
          </div>

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
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={viewMode === 'week' ? goToPreviousWeek : goToPreviousMonth}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                {viewMode === 'week' ? '今週' : '今月'}
              </button>
              <button
                onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="text-lg font-semibold text-gray-900">
                {viewMode === 'week' 
                  ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}`
                  : `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`
                }
              </span>
            </div>

            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filterTeachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : viewMode === 'month' ? (
              <MonthView
                monthDays={getMonthDays()}
                slots={slots}
                bookings={bookings}
                userMap={userMap}
                getSlotsForDate={getSlotsForDate}
                getBookingForSlot={getBookingForSlot}
                onSlotClick={setSelectedSlot}
              />
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200 sticky top-0 bg-white z-10">
                  <div className="p-3 text-sm font-medium text-gray-500 border-r border-gray-200">時間</div>
                  {weekDates.map((date, index) => (
                    <div
                      key={index}
                      className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${
                        formatDate(date) === formatDate(new Date()) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{getDayName(date)}</div>
                      <div className={`text-2xl font-bold mt-1 ${
                        formatDate(date) === formatDate(new Date()) ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-[64px_repeat(7,1fr)]">
                  <div>
                    {hours.map(hour => (
                      <div key={hour} className="h-20 border-b border-r border-gray-200 p-2 text-xs text-gray-500">
                        {hour}:00
                      </div>
                    ))}
                  </div>

                  {weekDates.map((date, dayIndex) => {
                    const daySlots = getSlotsForDate(date);
                    const layoutItems = daySlots.map(slot => {
                      const start = slot.startAt.toDate();
                      const end = slot.endAt.toDate();
                      return {
                        id: slot.id,
                        startMinutes: start.getHours() * 60 + start.getMinutes(),
                        endMinutes: end.getHours() * 60 + end.getMinutes(),
                      };
                    });
                    const overlapLayout = calculateOverlapLayout(layoutItems);

                    return (
                      <div key={dayIndex} className="relative border-r border-gray-200 last:border-r-0">
                        {hours.map(hour => (
                          <div
                            key={hour}
                            className={`h-20 border-b border-gray-200 ${
                              formatDate(date) === formatDate(new Date()) ? 'bg-blue-50/30' : ''
                            }`}
                          />
                        ))}

                        {daySlots.map(slot => {
                          const { top, height } = getSlotPosition(slot);
                          const layout = overlapLayout[slot.id];
                          const colIndex = layout?.columnIndex ?? 0;
                          const totalCols = layout?.totalColumns ?? 1;
                          const colWidthPct = 100 / totalCols;
                          const leftPct = colIndex * colWidthPct;

                          const booking = getBookingForSlot(slot.id);
                          const teacher = userMap[slot.teacherId];
                          const student = booking ? userMap[booking.studentId] : null;
                          const isCancelled = booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled');
                          const effectiveStatus: 'open' | 'booked' | 'closed' =
                            booking && !isCancelled
                              ? 'booked'
                              : slot.status === 'closed'
                                ? 'closed'
                                : 'open';

                          return (
                            <div
                              key={slot.id}
                              className={`absolute rounded cursor-pointer overflow-hidden transition-opacity hover:opacity-90 ${
                                isCancelled ? 'border border-orange-300 bg-orange-100 text-orange-800' : ''
                              }`}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `calc(${leftPct}% + 2px)`,
                                width: `calc(${colWidthPct}% - 4px)`,
                                zIndex: 5 + colIndex,
                                ...(isCancelled
                                  ? {}
                                  : slotWeekCellComputedStyle(slot, effectiveStatus, ADMIN_CALENDAR_WEEK_THEME)),
                              }}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              <div className="p-1 h-full flex flex-col text-xs">
                                <div className="font-semibold whitespace-nowrap truncate">
                                  {formatTime(slot.startAt.toDate())}{totalCols === 1 ? ` - ${formatTime(slot.endAt.toDate())}` : ''}
                                </div>
                                {slot.title && height > 28 && (
                                  <div className="truncate font-medium">{slot.title}</div>
                                )}
                                {height > 44 && teacher && (
                                  <div className="truncate opacity-80">{teacher.displayName || teacher.email}</div>
                                )}
                                {height > 64 && (
                                  isCancelled
                                    ? <div className="truncate mt-auto opacity-70">キャンセル済</div>
                                    : booking && student && <div className="truncate mt-auto opacity-70">{student.displayName}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-700">空き</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
              <span className="text-gray-700">予約済み</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
              <span className="text-gray-700">キャンセル済</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
              <span className="text-gray-700">クローズ</span>
            </div>
          </div>

          {showAddModal && (
            <AddBookingModal
              teachers={teacherList}
              onClose={() => setShowAddModal(false)}
              onSuccess={() => {
                setShowAddModal(false);
                loadWeekData();
              }}
            />
          )}

          {selectedSlot && (
            <SlotDetailModal
              slot={selectedSlot}
              booking={getBookingForSlot(selectedSlot.id) || null}
              userMap={userMap}
              onClose={() => setSelectedSlot(null)}
              onDelete={handleDeleteSlot}
              onRefresh={loadWeekData}
            />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

interface AddBookingModalProps {
  teachers: AppUser[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddBookingModal({ teachers, onClose, onSuccess }: AddBookingModalProps) {
  const { user } = useAuth();
  const [teacherId, setTeacherId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [durationHour, setDurationHour] = useState(1);
  const [durationMinute, setDurationMinute] = useState(0);
  const [colorPresetId, setColorPresetId] = useState('default');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hourOptions = Array.from({ length: 13 }, (_, i) => i + 9);
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  const durationHourOptions = Array.from({ length: 13 }, (_, i) => i);
  const durationMinuteOptions = Array.from({ length: 60 }, (_, i) => i);

  const totalDuration = durationHour * 60 + durationMinute;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!db) {
      setError('Firebaseの接続設定が正しくありません。');
      return;
    }
    if (!teacherId || !date) {
      setError('教師と日付を選択してください。');
      return;
    }
    if (totalDuration <= 0) {
      setError('空き枠の時間を1分以上に設定してください。');
      return;
    }

    setSubmitting(true);

    try {
      const [year, month, dayNum] = date.split('-').map(Number);
      const startAt = new Date(year, month - 1, dayNum, startHour, startMinute, 0, 0);

      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + totalDuration);

      const weekDay = startAt.getDay();
      const diff = startAt.getDate() - weekDay + (weekDay === 0 ? -6 : 1);
      const monday = new Date(startAt);
      monday.setDate(diff);
      const weekKey = formatDate(monday);

      const colorPreset = getSlotWeekColorPresetById(colorPresetId) ?? getSlotWeekColorPresetById('default')!;
      const colorFields =
        colorPreset.weekCellBg && colorPreset.weekCellText
          ? { weekCellBg: colorPreset.weekCellBg, weekCellText: colorPreset.weekCellText }
          : {};

      const slotRef = doc(collection(db, 'privateSlots'));
      const slotData = {
        id: slotRef.id,
        teacherId,
        title: title.trim() || null,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        status: 'open' as const,
        source: 'admin_managed' as const,
        note: null,
        weekKey,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        ...colorFields,
      };
      await setDoc(slotRef, slotData);

      onSuccess();
    } catch (err: unknown) {
      console.error('Error creating booking:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`空き枠の作成に失敗しました: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">空き枠を追加</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="booking-teacher" className="block text-sm font-medium text-gray-700">
              教師
            </label>
            <select
              id="booking-teacher"
              required
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            >
              <option value="">選択してください</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.displayName || t.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="booking-title" className="block text-sm font-medium text-gray-700">
              授業名
            </label>
            <input
              id="booking-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：英会話レッスン、IELTS対策"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700">
              日付
            </label>
            <input
              id="booking-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              開始時間
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              >
                {hourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-gray-700 font-medium flex-shrink-0">時</span>
              <select
                value={startMinute}
                onChange={(e) => setStartMinute(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              >
                {minuteOptions.map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-gray-700 font-medium flex-shrink-0">分</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              空き枠の長さ
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={durationHour}
                onChange={(e) => setDurationHour(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              >
                {durationHourOptions.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-gray-700 font-medium flex-shrink-0">時間</span>
              <select
                value={durationMinute}
                onChange={(e) => setDurationMinute(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              >
                {durationMinuteOptions.map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                ))}
              </select>
              <span className="text-gray-700 font-medium flex-shrink-0">分</span>
            </div>
            {totalDuration > 0 && (
              <p className="mt-1 text-xs text-gray-500">合計: {totalDuration}分</p>
            )}
          </div>

          <SlotWeekColorPresetStrip value={colorPresetId} onChange={setColorPresetId} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

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
              className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {submitting ? '作成中...' : '空き枠を作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SlotDetailModalProps {
  slot: PrivateSlot;
  booking: PrivateBooking | null;
  userMap: Record<string, AppUser>;
  onClose: () => void;
  onDelete: (slotId: string) => void;
  onRefresh: () => void;
}

function SlotDetailModal({ slot, booking, userMap, onClose, onDelete, onRefresh }: SlotDetailModalProps) {
  const [processing, setProcessing] = useState(false);
  const [editingZoom, setEditingZoom] = useState(false);
  const [zoomURL, setZoomURL] = useState(booking?.zoomURL || '');
  const [slotColorPresetId, setSlotColorPresetId] = useState('default');
  const [slotColorCustomBg, setSlotColorCustomBg] = useState('#86efac');
  const [slotColorCustomText, setSlotColorCustomText] = useState('#14532d');
  const [slotColorSaving, setSlotColorSaving] = useState(false);
  const [slotColorMessage, setSlotColorMessage] = useState('');
  const teacher = userMap[slot.teacherId];
  const student = booking ? userMap[booking.studentId] : null;
  const startDate = slot.startAt.toDate();
  const endDate = slot.endAt.toDate();
  const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  const isCancelled = booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled');
  const canEditSlotColors = !booking && slot.status !== 'booked';

  useEffect(() => {
    setSlotColorPresetId(matchSlotWeekColorPresetId(slot));
    setSlotColorCustomBg(slot.weekCellBg?.trim() || '#86efac');
    setSlotColorCustomText(slot.weekCellText?.trim() || '#14532d');
    setSlotColorMessage('');
  }, [slot.id]);

  const slotStatusConfig: Record<string, { label: string; className: string }> = {
    open: { label: '空き', className: 'bg-green-100 text-green-800' },
    booked: { label: '予約済み', className: 'bg-blue-100 text-blue-800' },
    closed: { label: 'クローズ', className: 'bg-gray-100 text-gray-600' },
  };
  const status = slotStatusConfig[slot.status] || slotStatusConfig.open;

  const bookingStatusLabels: Record<string, string> = {
    booked: '確定',
    completed: '完了',
    cancelled_consumed: 'キャンセル済（消化）',
    rescheduled: '振替済',
    no_show_consumed: '欠席（消化）',
  };

  const handleCancelBooking = async () => {
    if (!db || !booking) return;
    if (!confirm('この予約をキャンセルしますか？スロットは空き状態に戻ります。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', booking.id), {
        status: 'cancelled_consumed',
        cancelledAt: Timestamp.now(),
        cancellationReason: '管理者によるキャンセル',
        updatedAt: Timestamp.now(),
      });
      await updateDoc(doc(db, 'privateSlots', slot.id), {
        status: 'open',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('キャンセルに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreSlotToOpen = async () => {
    if (!db) return;
    if (!confirm('このスロットを「空き」状態に戻しますか？')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateSlots', slot.id), {
        status: 'open',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error restoring slot:', error);
      alert('更新に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseSlot = async () => {
    if (!db) return;
    if (!confirm('このスロットを「クローズ」にしますか？生徒は予約できなくなります。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateSlots', slot.id), {
        status: 'closed',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error closing slot:', error);
      alert('更新に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveSlotColors = async () => {
    if (!db || !canEditSlotColors) return;
    setSlotColorSaving(true);
    setSlotColorMessage('');
    try {
      const preset = getSlotWeekColorPresetById(slotColorPresetId);
      let colorUpdate: Record<string, unknown> = {
        weekCellBg: deleteField(),
        weekCellText: deleteField(),
        updatedAt: Timestamp.now(),
      };
      if (slotColorPresetId === 'custom') {
        const bg = slotColorCustomBg.trim();
        const tx = slotColorCustomText.trim();
        if (bg && tx) {
          colorUpdate = { weekCellBg: bg, weekCellText: tx, updatedAt: Timestamp.now() };
        }
      } else if (preset?.weekCellBg && preset.weekCellText) {
        colorUpdate = { weekCellBg: preset.weekCellBg, weekCellText: preset.weekCellText, updatedAt: Timestamp.now() };
      }
      await updateDoc(doc(db, 'privateSlots', slot.id), colorUpdate);
      onRefresh();
      setSlotColorMessage('色を保存しました');
    } catch (error) {
      console.error('Error saving slot colors:', error);
      setSlotColorMessage('色の保存に失敗しました');
    } finally {
      setSlotColorSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">予約詳細</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isCancelled ? 'bg-orange-100 text-orange-800' : status.className
            }`}>
              {isCancelled ? 'キャンセル済' : status.label}
            </span>
            <span className="text-sm text-gray-500">{formatDuration(durationMinutes)}</span>
          </div>

          <div className="border border-gray-200 rounded p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {startDate.getFullYear()}年{startDate.getMonth() + 1}月{startDate.getDate()}日（{getDayName(startDate)}）
                </div>
                <div className="text-sm text-gray-600">
                  {formatTime(startDate)} - {formatTime(endDate)}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-500">教師</div>
                <div className="text-sm font-medium text-gray-900">
                  {teacher?.displayName || teacher?.email || '不明'}
                </div>
                {teacher?.email && (
                  <div className="text-xs text-gray-500">{teacher.email}</div>
                )}
              </div>
            </div>
          </div>

          {booking ? (
            <div className={`border rounded p-4 space-y-3 ${
              isCancelled ? 'border-orange-200 bg-orange-50' : 'border-blue-200 bg-blue-50'
            }`}>
              <div className={`text-sm font-medium ${isCancelled ? 'text-orange-800' : 'text-blue-800'}`}>
                予約情報
              </div>

              <div className="flex items-center gap-3">
                <User className={`w-5 h-5 flex-shrink-0 ${isCancelled ? 'text-orange-400' : 'text-blue-400'}`} />
                <div>
                  <div className={`text-xs ${isCancelled ? 'text-orange-600' : 'text-blue-600'}`}>生徒</div>
                  <div className={`text-sm font-medium ${isCancelled ? 'text-orange-900' : 'text-blue-900'}`}>
                    {student?.displayName || '不明'}
                  </div>
                  {student?.email && (
                    <div className={`text-xs ${isCancelled ? 'text-orange-600' : 'text-blue-600'}`}>{student.email}</div>
                  )}
                </div>
              </div>

              <div className={`space-y-1 text-xs ${isCancelled ? 'text-orange-600' : 'text-blue-600'}`}>
                <div>予約ステータス: {bookingStatusLabels[booking.status] || booking.status}</div>
                {booking.bookedAt && (
                  <div>予約日時: {booking.bookedAt.toDate().toLocaleString('ja-JP')}</div>
                )}
                {booking.cancelledAt && (
                  <div>キャンセル日時: {booking.cancelledAt.toDate().toLocaleString('ja-JP')}</div>
                )}
                {booking.cancellationReason && (
                  <div>キャンセル理由: {booking.cancellationReason}</div>
                )}
              </div>

              {!isCancelled && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-3">
                    <Video className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    {editingZoom ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="url"
                          value={zoomURL}
                          onChange={e => setZoomURL(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={async () => {
                            if (!db || !booking) return;
                            try {
                              await updateDoc(doc(db, 'privateBookings', booking.id), { zoomURL: zoomURL || null, updatedAt: Timestamp.now() });
                              setEditingZoom(false);
                              onRefresh();
                            } catch { alert('保存に失敗しました'); }
                          }}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >保存</button>
                        <button onClick={() => { setEditingZoom(false); setZoomURL(booking?.zoomURL || ''); }} className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800">取消</button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-between">
                        {booking?.zoomURL ? (
                          <a href={booking.zoomURL} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 underline truncate max-w-[240px]">{booking.zoomURL}</a>
                        ) : (
                          <span className="text-sm text-blue-500">Zoom URL: 未設定</span>
                        )}
                        <button onClick={() => setEditingZoom(true)} className="text-xs text-blue-600 hover:text-blue-800 ml-2 whitespace-nowrap">編集</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-gray-200 rounded p-4 text-center text-sm text-gray-500">
              まだ予約はありません
            </div>
          )}

          {slot.note && (
            <div className="border border-gray-200 rounded p-4">
              <div className="text-xs text-gray-500 mb-1">メモ</div>
              <div className="text-sm text-gray-700">{slot.note}</div>
            </div>
          )}

          {canEditSlotColors && (
            <div className="border border-gray-200 rounded p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">週表示のコマ色</p>
              <SlotWeekColorPresetStrip
                value={slotColorPresetId}
                onChange={setSlotColorPresetId}
                showCustomOption
              />
              {slotColorPresetId === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">背景色</label>
                    <input
                      type="color"
                      value={slotColorCustomBg}
                      onChange={e => setSlotColorCustomBg(e.target.value)}
                      className="h-11 w-full min-h-[44px] cursor-pointer border border-gray-300 rounded-[6px] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">文字色</label>
                    <input
                      type="color"
                      value={slotColorCustomText}
                      onChange={e => setSlotColorCustomText(e.target.value)}
                      className="h-11 w-full min-h-[44px] cursor-pointer border border-gray-300 rounded-[6px] bg-white"
                    />
                  </div>
                </div>
              )}
              {slotColorMessage && (
                <p className={`text-sm ${slotColorMessage.includes('失敗') ? 'text-red-600' : 'text-gray-600'}`}>
                  {slotColorMessage}
                </p>
              )}
              <button
                type="button"
                onClick={handleSaveSlotColors}
                disabled={slotColorSaving}
                className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
              >
                {slotColorSaving ? '保存中...' : 'コマの色を保存'}
              </button>
            </div>
          )}

          <div className="space-y-2 pt-2">
            {/* 開放 / クローズ切り替え */}
            {!booking && slot.status === 'open' && (
              <button
                onClick={handleCloseSlot}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {processing ? '処理中...' : 'クローズする'}
              </button>
            )}

            {!booking && slot.status === 'closed' && (
              <button
                onClick={handleRestoreSlotToOpen}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                {processing ? '処理中...' : '開放する'}
              </button>
            )}

            {/* 予約キャンセル */}
            {booking && booking.status === 'booked' && (
              <button
                onClick={handleCancelBooking}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {processing ? '処理中...' : '予約をキャンセル'}
              </button>
            )}

            {/* キャンセル済スロットを空きに戻す */}
            {isCancelled && (
              <button
                onClick={handleRestoreSlotToOpen}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                {processing ? '処理中...' : 'スロットを空きに戻す'}
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => onDelete(slot.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-[6px] transition-colors min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 text-sm font-medium rounded-[6px] text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[44px]"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================
// 月表示コンポーネント
// ============================

interface MonthViewProps {
  monthDays: (Date | null)[];
  slots: PrivateSlot[];
  bookings: PrivateBooking[];
  userMap: Record<string, AppUser>;
  getSlotsForDate: (date: Date) => PrivateSlot[];
  getBookingForSlot: (slotId: string) => PrivateBooking | undefined;
  onSlotClick: (slot: PrivateSlot) => void;
}

function MonthView({ monthDays, slots, bookings, userMap, getSlotsForDate, getBookingForSlot, onSlotClick }: MonthViewProps) {
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const selectedDaySlots = selectedDate ? getSlotsForDate(selectedDate) : [];

  return (
    <div className="p-4">
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
                  .sort((a, b) => a.startAt.toDate().getTime() - b.startAt.toDate().getTime())
                  .slice(0, 4)
                  .map(slot => {
                    const start = slot.startAt.toDate();
                    const end = slot.endAt.toDate();
                    const booking = getBookingForSlot(slot.id);
                    const teacher = userMap[slot.teacherId];
                    const isCancelled = booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled');
                    const teacherName = teacher?.displayName?.substring(0, 4) || '';
                    const hasActiveBooking = !!booking && !isCancelled;
                    const dotBg = monthSlotDotBackground(slot, {
                      isCancelled: !!isCancelled,
                      hasActiveBooking,
                      isClosed: slot.status === 'closed',
                    });

                    return (
                      <div key={slot.id} className="flex items-center gap-1 truncate leading-tight">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotBg }} />
                        <span className="truncate text-gray-700">
                          {formatTime(start)}-{formatTime(end)}
                          {teacherName && <span className="text-gray-500 ml-0.5">{teacherName}</span>}
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
          <span>クローズ</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>キャンセル済</span>
        </div>
      </div>

      {/* 日別予定一覧モーダル */}
      {selectedDate && (
        <DayDetailModal
          date={selectedDate}
          daySlots={selectedDaySlots}
          userMap={userMap}
          getBookingForSlot={getBookingForSlot}
          onSlotClick={(slot) => { setSelectedDate(null); onSlotClick(slot); }}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ============================
// 日別予定一覧モーダル（管理者用）
// ============================

interface DayDetailModalProps {
  date: Date;
  daySlots: PrivateSlot[];
  userMap: Record<string, AppUser>;
  getBookingForSlot: (slotId: string) => PrivateBooking | undefined;
  onSlotClick: (slot: PrivateSlot) => void;
  onClose: () => void;
}

function DayDetailModal({ date, daySlots, userMap, getBookingForSlot, onSlotClick, onClose }: DayDetailModalProps) {
  const dayOfWeek = getDayName(date);
  const sortedSlots = [...daySlots].sort((a, b) =>
    a.startAt.toDate().getTime() - b.startAt.toDate().getTime()
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
                const start = slot.startAt.toDate();
                const end = slot.endAt.toDate();
                const booking = getBookingForSlot(slot.id);
                const teacher = userMap[slot.teacherId];
                const student = booking ? userMap[booking.studentId] : null;
                const isCancelled = booking && (booking.status === 'cancelled_consumed' || booking.status === 'rescheduled');
                const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

                let statusLabel: string;
                let statusColor: string;
                let borderColor: string;

                if (isCancelled) {
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
                  statusLabel = 'クローズ';
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
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {teacher && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {teacher.displayName || teacher.email}
                            </span>
                          )}
                          {student && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-blue-500" />
                              {student.displayName || student.email}
                            </span>
                          )}
                        </div>
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
