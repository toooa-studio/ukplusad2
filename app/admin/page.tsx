'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { PrivateSlot, PrivateBooking, AppUser, Announcement } from '@/lib/types';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { toDate, formatDateJa, formatTime, formatDuration, formatDate } from '@/lib/utils';
import {
  CalendarDays, Clock, GraduationCap, Users,
  CheckCircle2, AlertTriangle, ChevronRight, Megaphone,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [slots, setSlots] = useState<PrivateSlot[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [usersSnap, slotsSnap, bookingsSnap, annSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'privateSlots')),
        getDocs(collection(db, 'privateBookings')),
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(5))),
      ]);
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
      setSlots(slotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateSlot)));
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateBooking)));
      setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const userMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    allUsers.forEach(u => { map[u.id] = u; });
    return map;
  }, [allUsers]);

  const slotMap = useMemo(() => {
    const map: Record<string, PrivateSlot> = {};
    slots.forEach(s => { map[s.id] = s; });
    return map;
  }, [slots]);

  const now = new Date();
  const todayStr = formatDate(now);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const weekStart = new Date(todayStart);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todaysBookings = useMemo(() => {
    return bookings
      .filter(b => {
        const slot = slotMap[b.slotId];
        if (!slot) return false;
        const d = toDate(slot.startAt);
        return formatDate(d) === todayStr && b.status === 'booked';
      })
      .map(b => ({ booking: b, slot: slotMap[b.slotId]! }))
      .sort((a, b) => toDate(a.slot.startAt).getTime() - toDate(b.slot.startAt).getTime());
  }, [bookings, slotMap, todayStr]);

  const weekBookingsCount = useMemo(() => {
    return bookings.filter(b => {
      const slot = slotMap[b.slotId];
      if (!slot) return false;
      const d = toDate(slot.startAt);
      return d >= weekStart && d < weekEnd && b.status === 'booked';
    }).length;
  }, [bookings, slotMap]);

  const studentCount = useMemo(() => allUsers.filter(u => u.role === 'student').length, [allUsers]);
  const teacherCount = useMemo(() => allUsers.filter(u => u.role === 'teacher').length, [allUsers]);

  const monthStats = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthBookings = bookings.filter(b => {
      const slot = slotMap[b.slotId];
      if (!slot) return false;
      const d = toDate(slot.startAt);
      return d >= monthStart && d <= monthEnd;
    });
    return {
      total: monthBookings.length,
      completed: monthBookings.filter(b => b.status === 'completed').length,
      upcoming: monthBookings.filter(b => b.status === 'booked').length,
      cancelled: monthBookings.filter(b => ['cancelled_consumed', 'rescheduled'].includes(b.status)).length,
      noShow: monthBookings.filter(b => b.status === 'no_show_consumed').length,
    };
  }, [bookings, slotMap]);

  const importanceBadge: Record<string, { bg: string; label: string }> = {
    normal: { bg: 'bg-gray-100 text-gray-700', label: '通常' },
    important: { bg: 'bg-yellow-100 text-yellow-800', label: '重要' },
    urgent: { bg: 'bg-red-100 text-red-800', label: '緊急' },
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">ダッシュボード</h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatDateJa(now)}の概要
            </p>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<CalendarDays className="w-5 h-5" />} label="今日の予約" value={todaysBookings.length} color="blue" />
            <StatCard icon={<Clock className="w-5 h-5" />} label="今週の予約" value={weekBookingsCount} color="indigo" />
            <StatCard icon={<GraduationCap className="w-5 h-5" />} label="生徒数" value={studentCount} color="green" />
            <StatCard icon={<Users className="w-5 h-5" />} label="教師数" value={teacherCount} color="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 今日の予約 */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">今日の予約</h3>
                <Link href="/admin/calendar" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  カレンダー <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              {todaysBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <CalendarDays className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">今日の予約はありません</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {todaysBookings.slice(0, 6).map(({ booking, slot }) => {
                    const start = toDate(slot.startAt);
                    const end = toDate(slot.endAt);
                    const teacher = userMap[booking.teacherId];
                    const student = userMap[booking.studentId];
                    return (
                      <div key={booking.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[56px]">
                            <p className="text-sm font-bold text-gray-900">{formatTime(start)}</p>
                            <p className="text-xs text-gray-500">{formatTime(end)}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{student?.displayName || '不明'}</p>
                            <p className="text-xs text-gray-500">{teacher?.displayName || '不明'}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {todaysBookings.length > 6 && (
                    <div className="px-6 py-2 text-center text-xs text-gray-500">
                      他 {todaysBookings.length - 6} 件
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 最近のお知らせ */}
            <div className="bg-white border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">最近のお知らせ</h3>
                <Link href="/admin/announcements" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  一覧 <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              {announcements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <Megaphone className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">お知らせはありません</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {announcements.map(ann => {
                    const badge = importanceBadge[ann.importance] || importanceBadge.normal;
                    return (
                      <div key={ann.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="min-w-0 mr-3">
                          <p className="text-sm font-medium text-gray-900 truncate">{ann.title}</p>
                          <p className="text-xs text-gray-500">
                            {ann.createdAt ? formatDateJa(toDate(ann.createdAt)) : ''}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 今月のサマリー */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {now.getFullYear()}年{now.getMonth() + 1}月のサマリー
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <SummaryItem icon={<BookOpen className="w-4 h-4" />} label="総授業数" value={monthStats.total} color="text-gray-900" />
              <SummaryItem icon={<CheckCircle2 className="w-4 h-4" />} label="完了" value={monthStats.completed} color="text-green-600" />
              <SummaryItem icon={<Clock className="w-4 h-4" />} label="予定" value={monthStats.upcoming} color="text-blue-600" />
              <SummaryItem icon={<AlertTriangle className="w-4 h-4" />} label="ノーショー" value={monthStats.noShow} color="text-orange-600" />
              <SummaryItem icon={<CalendarDays className="w-4 h-4" />} label="キャンセル" value={monthStats.cancelled} color="text-red-600" />
            </div>
          </div>
        </div>
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

function SummaryItem({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
