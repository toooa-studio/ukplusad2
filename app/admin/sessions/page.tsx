'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { PrivateSlot, PrivateBooking, AppUser, BookingStatus } from '@/lib/types';
import { collection, getDocs, query, where, Timestamp, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { toDate, formatDateJa, formatTime, formatDuration, formatDate } from '@/lib/utils';
import {
  BookOpen, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Search, X, FileText,
  User, Video, Calendar, Filter, Eye,
} from 'lucide-react';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';
type StatusFilter = 'all' | 'booked' | 'completed' | 'cancelled' | 'no_show';

interface EnrichedLesson {
  booking: PrivateBooking;
  slot: PrivateSlot;
  teacher?: AppUser;
  student?: AppUser;
  durationMinutes: number;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  booked: { label: '予約済み', bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
  completed: { label: '完了', bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 },
  cancelled_consumed: { label: 'キャンセル', bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
  rescheduled: { label: '振替済', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Calendar },
  no_show_consumed: { label: 'ノーショー', bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertTriangle },
};

export default function SessionsPage() {
  const [slots, setSlots] = useState<PrivateSlot[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState('');

  const [selectedLesson, setSelectedLesson] = useState<EnrichedLesson | null>(null);

  const userMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    allUsers.forEach(u => { map[u.id] = u; });
    return map;
  }, [allUsers]);

  const teachers = useMemo(() => allUsers.filter(u => u.role === 'teacher'), [allUsers]);

  const loadData = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [usersSnap, slotsSnap, bookingsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'privateSlots'), orderBy('startAt', 'desc'))),
        getDocs(query(collection(db, 'privateBookings'), orderBy('bookedAt', 'desc'))),
      ]);
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
      setSlots(slotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateSlot)));
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateBooking)));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const slotMap = useMemo(() => {
    const map: Record<string, PrivateSlot> = {};
    slots.forEach(s => { map[s.id] = s; });
    return map;
  }, [slots]);

  const enrichedLessons: EnrichedLesson[] = useMemo(() => {
    return bookings.map(booking => {
      const slot = slotMap[booking.slotId];
      if (!slot) return null;
      const start = toDate(slot.startAt);
      const end = toDate(slot.endAt);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      return {
        booking,
        slot,
        teacher: userMap[booking.teacherId],
        student: userMap[booking.studentId],
        durationMinutes,
      };
    }).filter(Boolean) as EnrichedLesson[];
  }, [bookings, slotMap, userMap]);

  const filteredLessons = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return enrichedLessons.filter(lesson => {
      const lessonDate = toDate(lesson.slot.startAt);

      if (periodFilter === 'today' && (lessonDate < todayStart || lessonDate >= todayEnd)) return false;
      if (periodFilter === 'week' && (lessonDate < weekStart || lessonDate >= weekEnd)) return false;
      if (periodFilter === 'month' && (lessonDate < monthStart || lessonDate > monthEnd)) return false;

      if (statusFilter !== 'all') {
        const statusMap: Record<StatusFilter, BookingStatus[]> = {
          all: [],
          booked: ['booked'],
          completed: ['completed'],
          cancelled: ['cancelled_consumed', 'rescheduled'],
          no_show: ['no_show_consumed'],
        };
        if (!statusMap[statusFilter].includes(lesson.booking.status)) return false;
      }

      if (teacherFilter !== 'all' && lesson.booking.teacherId !== teacherFilter) return false;

      if (studentSearch) {
        const q = studentSearch.toLowerCase();
        const name = lesson.student?.displayName?.toLowerCase() || '';
        const email = lesson.student?.email?.toLowerCase() || '';
        if (!name.includes(q) && !email.includes(q)) return false;
      }

      return true;
    });
  }, [enrichedLessons, periodFilter, statusFilter, teacherFilter, studentSearch]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthLessons = enrichedLessons.filter(l => {
      const d = toDate(l.slot.startAt);
      return d >= monthStart && d <= monthEnd;
    });

    return {
      total: monthLessons.length,
      completed: monthLessons.filter(l => l.booking.status === 'completed').length,
      upcoming: monthLessons.filter(l => l.booking.status === 'booked').length,
      noShow: monthLessons.filter(l => l.booking.status === 'no_show_consumed').length,
      cancelled: monthLessons.filter(l => ['cancelled_consumed', 'rescheduled'].includes(l.booking.status)).length,
    };
  }, [enrichedLessons]);

  const periodLabels: Record<PeriodFilter, string> = {
    today: '今日',
    week: '今週',
    month: '今月',
    all: 'すべて',
  };

  const statusLabels: Record<StatusFilter, string> = {
    all: 'すべて',
    booked: '予約済み',
    completed: '完了',
    cancelled: 'キャンセル',
    no_show: 'ノーショー',
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'teacher']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">授業管理</h2>
            <p className="mt-1 text-sm text-gray-600">
              プライベートレッスンの実施状況・授業記録を管理
            </p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="今月の授業" value={stats.total} color="blue" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="実施済み" value={stats.completed} color="green" />
            <StatCard icon={<Clock className="w-5 h-5" />} label="予定" value={stats.upcoming} color="indigo" />
            <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="ノーショー / キャンセル" value={stats.noShow + stats.cancelled} color="orange" />
          </div>

          {/* フィルター */}
          <div className="bg-white border border-gray-200 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Filter className="w-4 h-4" />
              絞り込み
            </div>

            <div className="flex flex-wrap gap-3">
              {/* 期間 */}
              <div className="flex border border-gray-200 rounded-[6px] overflow-hidden">
                {(Object.keys(periodLabels) as PeriodFilter[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setPeriodFilter(key)}
                    className={`px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                      periodFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {periodLabels[key]}
                  </button>
                ))}
              </div>

              {/* ステータス */}
              <div className="flex border border-gray-200 rounded-[6px] overflow-hidden">
                {(Object.keys(statusLabels) as StatusFilter[]).map(key => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                      statusFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {statusLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* 教師 */}
              <select
                value={teacherFilter}
                onChange={e => setTeacherFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-[6px] text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="all">教師: すべて</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName || t.email}</option>
                ))}
              </select>

              {/* 生徒検索 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="生徒名・メールで検索"
                  className="pl-9 pr-8 py-2 border border-gray-300 rounded-[6px] text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] w-64"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 授業一覧テーブル */}
          <div className="bg-white border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                授業一覧（{filteredLessons.length}件）
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                <BookOpen className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm">該当する授業がありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日時</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">教師</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生徒</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLessons.map(lesson => {
                      const startDate = toDate(lesson.slot.startAt);
                      const cfg = statusConfig[lesson.booking.status] || statusConfig.booked;
                      const StatusIcon = cfg.icon;
                      const isPast = startDate < new Date() && lesson.booking.status === 'booked';

                      return (
                        <tr key={lesson.booking.id} className={`hover:bg-gray-50 ${isPast ? 'bg-yellow-50/40' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDateJa(startDate)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTime(startDate)} - {formatTime(toDate(lesson.slot.endAt))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{lesson.teacher?.displayName || '不明'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{lesson.student?.displayName || '不明'}</div>
                            <div className="text-xs text-gray-500">{lesson.student?.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDuration(lesson.durationMinutes)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>
                              <StatusIcon className="w-3 h-3" />
                              {cfg.label}
                            </span>
                            {isPast && (
                              <span className="ml-1 text-xs text-yellow-600 font-medium">未処理</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => setSelectedLesson(lesson)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selectedLesson && (
          <LessonDetailModal
            lesson={selectedLesson}
            onClose={() => setSelectedLesson(null)}
            onRefresh={loadData}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    orange: 'text-orange-600 bg-orange-50',
  };
  return (
    <div className="bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface LessonDetailModalProps {
  lesson: EnrichedLesson;
  onClose: () => void;
  onRefresh: () => void;
}

function LessonDetailModal({ lesson, onClose, onRefresh }: LessonDetailModalProps) {
  const [processing, setProcessing] = useState(false);
  const [memo, setMemo] = useState('');

  const startDate = toDate(lesson.slot.startAt);
  const endDate = toDate(lesson.slot.endAt);
  const cfg = statusConfig[lesson.booking.status] || statusConfig.booked;
  const StatusIcon = cfg.icon;
  const isPastAndBooked = startDate < new Date() && lesson.booking.status === 'booked';

  const handleMarkCompleted = async () => {
    if (!db) return;
    if (!confirm('この授業を「完了」にしますか？')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', lesson.booking.id), {
        status: 'completed' as BookingStatus,
        'consumption.consumedCount': 1,
        'consumption.consumedAt': Timestamp.now(),
        'consumption.consumedReason': 'booking_completed',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error marking completed:', error);
      alert('更新に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkNoShow = async () => {
    if (!db) return;
    if (!confirm('この授業を「ノーショー」にしますか？回数は消費されます。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', lesson.booking.id), {
        status: 'no_show_consumed' as BookingStatus,
        'consumption.consumedCount': 1,
        'consumption.consumedAt': Timestamp.now(),
        'consumption.consumedReason': 'no_show',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error marking no-show:', error);
      alert('更新に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!db) return;
    if (!confirm('この予約をキャンセルしますか？スロットは空き状態に戻ります。')) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'privateBookings', lesson.booking.id), {
        status: 'cancelled_consumed' as BookingStatus,
        cancelledAt: Timestamp.now(),
        cancellationReason: '管理者によるキャンセル',
        updatedAt: Timestamp.now(),
      });
      await updateDoc(doc(db, 'privateSlots', lesson.slot.id), {
        status: 'open',
        updatedAt: Timestamp.now(),
      });
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('キャンセルに失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">授業詳細</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* ステータス */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full ${cfg.bg} ${cfg.text}`}>
              <StatusIcon className="w-4 h-4" />
              {cfg.label}
            </span>
            {isPastAndBooked && (
              <span className="px-3 py-1.5 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">
                未処理
              </span>
            )}
          </div>

          {/* 日時情報 */}
          <div className="border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{formatDateJa(startDate)}</p>
                <p className="text-sm text-gray-600">
                  {formatTime(startDate)} - {formatTime(endDate)}（{formatDuration(lesson.durationMinutes)}）
                </p>
              </div>
            </div>
          </div>

          {/* 教師・生徒 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">教師</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{lesson.teacher?.displayName || '不明'}</p>
                  <p className="text-xs text-gray-500">{lesson.teacher?.email}</p>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">生徒</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{lesson.student?.displayName || '不明'}</p>
                  <p className="text-xs text-gray-500">{lesson.student?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 予約情報 */}
          <div className="border border-gray-200 p-4 space-y-2">
            <p className="text-xs text-gray-500">予約情報</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">予約日:</span>{' '}
                <span className="text-gray-900">{formatDateJa(toDate(lesson.booking.bookedAt))}</span>
              </div>
              <div>
                <span className="text-gray-500">消化回数:</span>{' '}
                <span className="text-gray-900">{lesson.booking.consumption?.consumedCount ?? 0}回</span>
              </div>
              {lesson.booking.cancellationReason && (
                <div className="col-span-2">
                  <span className="text-gray-500">キャンセル理由:</span>{' '}
                  <span className="text-red-600">{lesson.booking.cancellationReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* アクション */}
          {lesson.booking.status === 'booked' && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-gray-500 font-medium">授業ステータスの変更</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleMarkCompleted}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-[6px] hover:bg-green-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  完了にする
                </button>
                <button
                  onClick={handleMarkNoShow}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white text-sm font-medium rounded-[6px] hover:bg-orange-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  <AlertTriangle className="w-4 h-4" />
                  ノーショー
                </button>
              </div>
              <button
                onClick={handleCancelBooking}
                disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-[6px] hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <XCircle className="w-4 h-4" />
                予約をキャンセル
              </button>
            </div>
          )}

          {lesson.booking.status === 'completed' && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <p className="text-sm font-medium">この授業は完了済みです</p>
              </div>
            </div>
          )}

          {lesson.booking.status === 'no_show_consumed' && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-medium">ノーショーとして記録済み（回数消化済み）</p>
              </div>
            </div>
          )}

          {['cancelled_consumed', 'rescheduled'].includes(lesson.booking.status) && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" />
                <p className="text-sm font-medium">この予約はキャンセル済みです</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
