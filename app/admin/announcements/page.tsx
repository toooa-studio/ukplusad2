'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import {
  Announcement, UserRole, AnnouncementImportance, AnnouncementTarget, AppUser,
} from '@/lib/types';
import {
  collection, getDocs, query, orderBy, limit, doc, setDoc, deleteDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { formatDateTime, toDate } from '@/lib/utils';
import { Pin, X, Trash2, Edit2, Search } from 'lucide-react';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [annSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(100))),
        getDocs(collection(db, 'users')),
      ]);
      setAnnouncements(annSnap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      setStudents(allUsers.filter(u => u.role === 'student'));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm('このお知らせを削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('削除に失敗しました');
    }
  };

  const studentMap: Record<string, AppUser> = {};
  students.forEach(s => { studentMap[s.id] = s; });

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">お知らせ管理</h2>
              <p className="mt-1 text-sm text-gray-600">生徒・教師へのお知らせの作成と管理</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              + お知らせを作成
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard title="総お知らせ数" value={announcements.length.toString()} color="blue" />
            <StatCard title="ピン留め" value={announcements.filter(a => a.pinned).length.toString()} color="yellow" />
            <StatCard title="重要" value={announcements.filter(a => a.importance === 'important').length.toString()} color="orange" />
            <StatCard title="緊急" value={announcements.filter(a => a.importance === 'urgent').length.toString()} color="red" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {announcements.map(announcement => (
                  <AnnouncementItem
                    key={announcement.id}
                    announcement={announcement}
                    studentMap={studentMap}
                    onEdit={() => setEditingAnnouncement(announcement)}
                    onDelete={() => handleDelete(announcement.id)}
                  />
                ))}
                {announcements.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-gray-500">お知らせがまだありません</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {showCreateModal && (
          <AnnouncementFormModal
            students={students}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              loadData();
            }}
          />
        )}

        {editingAnnouncement && (
          <AnnouncementFormModal
            announcement={editingAnnouncement}
            students={students}
            onClose={() => setEditingAnnouncement(null)}
            onSuccess={() => {
              setEditingAnnouncement(null);
              loadData();
            }}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: 'blue' | 'yellow' | 'orange' | 'red' }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    orange: 'bg-orange-50 border-orange-200',
    red: 'bg-red-50 border-red-200',
  };
  return (
    <div className={`rounded-sm border p-6 ${colorClasses[color]}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface AnnouncementItemProps {
  announcement: Announcement;
  studentMap: Record<string, AppUser>;
  onEdit: () => void;
  onDelete: () => void;
}

function AnnouncementItem({ announcement, studentMap, onEdit, onDelete }: AnnouncementItemProps) {
  const importanceColors: Record<string, string> = {
    normal: 'bg-gray-100 text-gray-700',
    important: 'bg-yellow-100 text-yellow-800',
    urgent: 'bg-red-100 text-red-800',
  };
  const importanceLabels: Record<string, string> = {
    normal: '通常',
    important: '重要',
    urgent: '緊急',
  };
  const roleLabels: Record<UserRole, string> = {
    student: '生徒',
    teacher: '教師',
    admin: '管理者',
  };

  const getTargetLabel = () => {
    const target = announcement.target || 'roles';
    if (target === 'all') return '全員';
    if (target === 'individual') {
      const ids = announcement.targetStudentIds || [];
      if (ids.length === 0) return '個別（対象なし）';
      const names = ids.map(id => studentMap[id]?.displayName || '不明').join(', ');
      return `個別: ${names}`;
    }
    return (announcement.audienceRoles || []).map(role => roleLabels[role]).join(', ');
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {announcement.pinned && (
              <Pin className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
            <h3 className="text-lg font-semibold text-gray-900">{announcement.title}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded ${importanceColors[announcement.importance]}`}>
              {importanceLabels[announcement.importance]}
            </span>
          </div>

          <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{announcement.body}</p>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span>{formatDateTime(toDate(announcement.createdAt))}</span>
            <span>|</span>
            <span>対象: {getTargetLabel()}</span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AnnouncementFormModalProps {
  announcement?: Announcement;
  students: AppUser[];
  onClose: () => void;
  onSuccess: () => void;
}

function AnnouncementFormModal({ announcement, students, onClose, onSuccess }: AnnouncementFormModalProps) {
  const { user } = useAuth();
  const isEditing = !!announcement;

  const [title, setTitle] = useState(announcement?.title || '');
  const [body, setBody] = useState(announcement?.body || '');
  const [importance, setImportance] = useState<AnnouncementImportance>(announcement?.importance || 'normal');
  const [pinned, setPinned] = useState(announcement?.pinned || false);
  const [target, setTarget] = useState<AnnouncementTarget>(announcement?.target || 'roles');
  const [audienceRoles, setAudienceRoles] = useState<UserRole[]>(announcement?.audienceRoles || ['student']);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(announcement?.targetStudentIds || []);
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filteredStudents = students.filter(s => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (s.displayName?.toLowerCase().includes(q)) || (s.email?.toLowerCase().includes(q));
  });

  const toggleRole = (role: UserRole) => {
    if (audienceRoles.includes(role)) {
      setAudienceRoles(audienceRoles.filter(r => r !== role));
    } else {
      setAudienceRoles([...audienceRoles, role]);
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const selectAllStudents = () => setSelectedStudentIds(students.map(s => s.id));
  const deselectAllStudents = () => setSelectedStudentIds([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!db || !user) {
      setError('認証エラーが発生しました');
      return;
    }

    if (target === 'roles' && audienceRoles.length === 0) {
      setError('配信対象のロールを1つ以上選択してください');
      return;
    }
    if (target === 'individual' && selectedStudentIds.length === 0) {
      setError('配信対象の生徒を1人以上選択してください');
      return;
    }

    setSubmitting(true);

    try {
      const annRef = isEditing
        ? doc(db, 'announcements', announcement!.id)
        : doc(collection(db, 'announcements'));

      const data: Record<string, unknown> = {
        id: isEditing ? announcement!.id : annRef.id,
        title,
        body,
        importance,
        pinned,
        target,
        audienceRoles: target === 'roles' ? audienceRoles : [],
        targetStudentIds: target === 'individual' ? selectedStudentIds : [],
        updatedAt: Timestamp.now(),
      };

      if (!isEditing) {
        data.createdBy = user.uid;
        data.createdAt = Timestamp.now();
        data.startsAt = null;
        data.endsAt = null;
      }

      await setDoc(annRef, data, { merge: isEditing });
      onSuccess();
    } catch (err: unknown) {
      console.error('Error saving announcement:', err);
      const firebaseErr = err as { code?: string; message?: string };
      setError(`保存に失敗しました: ${firebaseErr.code || firebaseErr.message || '不明なエラー'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">
            {isEditing ? 'お知らせを編集' : '新しいお知らせを作成'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="ann-title" className="block text-sm font-medium text-gray-700">
              タイトル
            </label>
            <input
              id="ann-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：来週のスケジュール変更について"
            />
          </div>

          <div>
            <label htmlFor="ann-body" className="block text-sm font-medium text-gray-700">
              本文
            </label>
            <textarea
              id="ann-body"
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="3月15日（月）は祝日のため休校となります。振替レッスンについては個別にご連絡します"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ann-importance" className="block text-sm font-medium text-gray-700">
                重要度
              </label>
              <select
                id="ann-importance"
                value={importance}
                onChange={(e) => setImportance(e.target.value as AnnouncementImportance)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              >
                <option value="normal">通常</option>
                <option value="important">重要</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 px-3 py-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">トップにピン留めする</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              配信対象
            </label>
            <div className="flex gap-2 mb-3">
              {([
                { value: 'all', label: '全員' },
                { value: 'roles', label: 'ロール指定' },
                { value: 'individual', label: '個別生徒' },
              ] as { value: AnnouncementTarget; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTarget(opt.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors min-h-[44px] ${
                    target === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {target === 'roles' && (
              <div className="border border-gray-200 rounded p-4 space-y-2">
                {(['student', 'teacher', 'admin'] as UserRole[]).map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audienceRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {role === 'student' ? '全生徒' : role === 'teacher' ? '全教師' : '全管理者'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {target === 'individual' && (
              <div className="border border-gray-200 rounded p-4 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
                    placeholder="名前またはメールで検索"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{selectedStudentIds.length}人 選択中</span>
                  <div className="flex gap-3">
                    <button type="button" onClick={selectAllStudents} className="text-blue-600 hover:underline">
                      全選択
                    </button>
                    <button type="button" onClick={deselectAllStudents} className="text-blue-600 hover:underline">
                      全解除
                    </button>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      {students.length === 0 ? '生徒が登録されていません' : '該当する生徒がいません'}
                    </p>
                  ) : (
                    filteredStudents.map(s => (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                          selectedStudentIds.includes(s.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {s.displayName || '名前未設定'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{s.email}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
              {submitting ? '保存中...' : isEditing ? '更新する' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
