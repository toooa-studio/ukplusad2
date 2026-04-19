'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { TeacherLayout } from '@/lib/components/TeacherLayout';
import { useAuth } from '@/lib/hooks/useAuth';
import { PrivateSlot, PrivateBooking, AppUser } from '@/lib/types';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { toDate, formatDateJa, formatTime, formatDuration } from '@/lib/utils';
import {
  CalendarDays, Clock, CheckCircle2, AlertTriangle, User, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<PrivateSlot[]>([]);
  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const studentMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    students.forEach(s => { map[s.id] = s; });
    return map;
  }, [students]);

  useEffect(() => {
    if (!user?.uid || !db) return;
    loadData();
  }, [user?.uid]);

  const loadData = async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const [slotsSnap, bookingsSnap, usersSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'privateSlots'),
          where('teacherId', '==', user.uid),
        )),
        getDocs(query(
          collection(db, 'privateBookings'),
          where('teacherId', '==', user.uid),
        )),
        getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'student'),
        )),
      ]);
      setSlots(slotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateSlot)));
      setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PrivateBooking)));
      setStudents(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const slotMap = useMemo(() => {
    const map: Record<string, PrivateSlot> = {};
    slots.forEach(s => { map[s.id] = s; });
    return map;
  }, [slots]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todaysLessons = useMemo(() => {
    return bookings
      .filter(b => {
        const slot = slotMap[b.slotId];
        if (!slot) return false;
        const d = toDate(slot.startAt);
        return d >= todayStart && d < todayEnd && b.status === 'booked';
      })
      .map(b => ({ booking: b, slot: slotMap[b.slotId]! }))
      .sort((a, b) => toDate(a.slot.startAt).getTime() - toDate(b.slot.startAt).getTime());
  }, [bookings, slotMap]);

  const weekUpcoming = useMemo(() => {
    return bookings.filter(b => {
      const slot = slotMap[b.slotId];
      if (!slot) return false;
      const d = toDate(slot.startAt);
      return d >= todayEnd && d < weekEnd && b.status === 'booked';
    }).length;
  }, [bookings, slotMap]);

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
    };
  }, [bookings, slotMap]);

  const openSlots = useMemo(() => {
    return slots.filter(s => {
      const d = toDate(s.startAt);
      return d >= todayStart && s.status === 'open';
    }).length;
  }, [slots]);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['teacher']}>
        <TeacherLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        </TeacherLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <TeacherLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              こんにちは、{user?.displayName || '先生'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {formatDateJa(now)}の概要
            </p>
          </div>

          {/* 統計 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<CalendarDays className="w-5 h-5" />} label="今日の授業" value={todaysLessons.length} color="blue" />
            <StatCard icon={<Clock className="w-5 h-5" />} label="今週の予定" value={weekUpcoming} color="indigo" />
            <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="今月完了" value={monthStats.completed} color="green" />
            <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="空きスロット" value={openSlots} color="orange" />
          </div>

          {/* 今日の授業 */}
          <div className="bg-white border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">今日の授業</h3>
              <Link
                href="/teacher/schedule"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                スケジュールを見る <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {todaysLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <CalendarDays className="w-8 h-8 mb-2 text-gray-300" />
                <p className="text-sm">今日の授業はありません</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {todaysLessons.map(({ booking, slot }) => {
                  const start = toDate(slot.startAt);
                  const end = toDate(slot.endAt);
                  const dur = Math.round((end.getTime() - start.getTime()) / 60000);
                  const student = studentMap[booking.studentId];
                  return (
                    <div key={booking.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-lg font-bold text-gray-900">{formatTime(start)}</p>
                          <p className="text-xs text-gray-500">{formatDuration(dur)}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <p className="text-sm font-medium text-gray-900">
                              {student?.displayName || '生徒不明'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500">{student?.email}</p>
                        </div>
                      </div>
                      <Link
                        href="/teacher/messages"
                        className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-[6px] transition-colors min-h-[44px] flex items-center"
                      >
                        メッセージ
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 今月のサマリー */}
          <div className="bg-white border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">今月のサマリー</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-gray-900">{monthStats.total}</p>
                <p className="text-sm text-gray-500">総授業数</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{monthStats.completed}</p>
                <p className="text-sm text-gray-500">完了済み</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">{monthStats.upcoming}</p>
                <p className="text-sm text-gray-500">予定</p>
              </div>
            </div>
          </div>
        </div>
      </TeacherLayout>
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
