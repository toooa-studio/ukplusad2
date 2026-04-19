'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { AppUser, Enrollment } from '@/lib/types';
import { calculateRescheduleAllowed } from '@/lib/types';
import { collection, getDocs, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { formatDate, formatDateJa, toDate } from '@/lib/utils';
import { Ticket, AlertTriangle, CheckCircle, Clock, Edit2, X } from 'lucide-react';

type EnrichedEnrollment = Enrollment & { studentName: string; studentEmail: string };

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrichedEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'depleted'>('all');
  const [editingEnrollment, setEditingEnrollment] = useState<EnrichedEnrollment | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, []);

  const loadEnrollments = async () => {
    setLoading(true);
    try {
      if (!db) return;

      const enrollSnap = await getDocs(collection(db, 'enrollments'));
      const enrollData = enrollSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Enrollment[];

      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const studentsMap: Record<string, AppUser> = {};
      studentsSnap.docs.forEach(d => {
        const data = d.data() as AppUser;
        studentsMap[d.id] = data;
      });

      const enriched = enrollData.map(e => ({
        ...e,
        studentName: studentsMap[e.studentId]?.displayName || '不明',
        studentEmail: studentsMap[e.studentId]?.email || '',
      }));

      enriched.sort((a, b) => {
        const order = { active: 0, expired: 1, depleted: 2, inactive: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });

      setEnrollments(enriched);
    } catch (error) {
      console.error('Error loading enrollments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? enrollments : enrollments.filter(e => e.status === filter);

  const stats = {
    total: enrollments.length,
    active: enrollments.filter(e => e.status === 'active').length,
    expired: enrollments.filter(e => e.status === 'expired').length,
    depleted: enrollments.filter(e => e.status === 'depleted').length,
    totalRemaining: enrollments.filter(e => e.status === 'active').reduce((sum, e) => sum + e.remainingCount, 0),
  };

  const statusLabels: Record<string, string> = {
    active: 'アクティブ',
    expired: '期限切れ',
    depleted: '消化済み',
    inactive: '無効',
  };
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    depleted: 'bg-yellow-100 text-yellow-800',
    inactive: 'bg-gray-100 text-gray-800',
  };
  const typeLabels: Record<string, string> = {
    monthly_registration: '月額登録',
    ticket_bundle: '回数券',
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">受講管理</h2>
            <p className="mt-1 text-sm text-gray-600">全生徒の受講状況・回数券の使用状況を一覧で管理</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">総受講登録</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">アクティブ</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">総残り回数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalRemaining}回</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-sm p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">期限切れ</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { key: 'all' as const, label: 'すべて' },
              { key: 'active' as const, label: 'アクティブ' },
              { key: 'expired' as const, label: '期限切れ' },
              { key: 'depleted' as const, label: '消化済み' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 text-sm rounded-[6px] transition-colors min-h-[44px] ${
                  filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">受講登録がありません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生徒</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">タイプ</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残り / 登録</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用済み</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">振替</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有効期限</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.map((enrollment) => {
                      const isExpiringSoon = enrollment.status === 'active' && (() => {
                        const until = toDate(enrollment.validUntil);
                        const daysLeft = Math.ceil((until.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        return daysLeft <= 7;
                      })();
                      const isLowCount = enrollment.status === 'active' && enrollment.remainingCount <= 2;

                      return (
                        <tr key={enrollment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{enrollment.studentName}</div>
                            <div className="text-xs text-gray-500">{enrollment.studentEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {typeLabels[enrollment.type]}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-bold ${isLowCount ? 'text-red-600' : 'text-gray-900'}`}>
                              {enrollment.remainingCount}
                            </span>
                            <span className="text-sm text-gray-500"> / {enrollment.registeredCount}回</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {enrollment.usedCount}回
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {enrollment.rescheduleAllowedCount - enrollment.rescheduleUsedCount} / {enrollment.rescheduleAllowedCount}回
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm ${isExpiringSoon ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                              {formatDateJa(toDate(enrollment.validUntil))}
                            </span>
                            {isExpiringSoon && (
                              <span className="ml-2 text-xs text-red-500">まもなく期限切れ</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[enrollment.status]}`}>
                              {statusLabels[enrollment.status]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => setEditingEnrollment(enrollment)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                            >
                              <Edit2 className="w-4 h-4" />
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

        {editingEnrollment && (
          <EditEnrollmentModal
            enrollment={editingEnrollment}
            onClose={() => setEditingEnrollment(null)}
            onSuccess={() => {
              setEditingEnrollment(null);
              loadEnrollments();
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

interface EditEnrollmentModalProps {
  enrollment: EnrichedEnrollment;
  onClose: () => void;
  onSuccess: () => void;
}

function EditEnrollmentModal({ enrollment, onClose, onSuccess }: EditEnrollmentModalProps) {
  const [registeredCount, setRegisteredCount] = useState(enrollment.registeredCount);
  const [validUntil, setValidUntil] = useState(formatDate(toDate(enrollment.validUntil)));
  const [status, setStatus] = useState(enrollment.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const newRemaining = Math.max(registeredCount - enrollment.usedCount, 0);
  const newRescheduleAllowed = calculateRescheduleAllowed(registeredCount);

  const handleSave = async () => {
    if (!db) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const [year, month, day] = validUntil.split('-').map(Number);
      const validUntilDate = new Date(year, month - 1, day, 23, 59, 59);

      await updateDoc(doc(db, 'enrollments', enrollment.id), {
        registeredCount,
        remainingCount: newRemaining,
        rescheduleAllowedCount: newRescheduleAllowed,
        validUntil: Timestamp.fromDate(validUntilDate),
        status,
        updatedAt: Timestamp.now(),
      });

      setSuccess('保存しました');
      setTimeout(() => onSuccess(), 600);
    } catch (err: unknown) {
      console.error('Error updating enrollment:', err);
      const firebaseErr = err as { code?: string; message?: string };
      setError(`保存に失敗しました: ${firebaseErr.code || firebaseErr.message || '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">受講情報の編集</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div className="border border-gray-200 rounded p-4">
            <div className="text-sm font-medium text-gray-900">{enrollment.studentName}</div>
            <div className="text-xs text-gray-500">{enrollment.studentEmail}</div>
            <div className="mt-2 text-xs text-gray-500">
              タイプ: {enrollment.type === 'ticket_bundle' ? '回数券' : '月額登録'}
              {' | '}使用済み: {enrollment.usedCount}回
            </div>
          </div>

          <div>
            <label htmlFor="edit-count" className="block text-sm font-medium text-gray-700">
              登録回数
            </label>
            <input
              id="edit-count"
              type="number"
              min={enrollment.usedCount}
              value={registeredCount}
              onChange={(e) => setRegisteredCount(Math.max(Number(e.target.value), enrollment.usedCount))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
            <div className="mt-2 flex gap-2">
              {[1, 2, 4, 8].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRegisteredCount(prev => prev + n)}
                  className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                >
                  +{n}回
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              残り回数: <span className="font-bold">{newRemaining}回</span>
              {' | '}振替可能: <span className="font-bold">{newRescheduleAllowed}回</span>
            </p>
          </div>

          <div>
            <label htmlFor="edit-valid" className="block text-sm font-medium text-gray-700">
              有効期限
            </label>
            <input
              id="edit-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
            <div className="mt-2 flex gap-2">
              {[
                { label: '+1ヶ月', months: 1 },
                { label: '+3ヶ月', months: 3 },
                { label: '+6ヶ月', months: 6 },
              ].map(({ label, months }) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => {
                    const [y, m, d] = validUntil.split('-').map(Number);
                    const newDate = new Date(y, m - 1 + months, d);
                    setValidUntil(formatDate(newDate));
                  }}
                  className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700">
              ステータス
            </label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Enrollment['status'])}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            >
              <option value="active">アクティブ</option>
              <option value="expired">期限切れ</option>
              <option value="depleted">消化済み</option>
              <option value="inactive">無効</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">{success}</div>
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
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
