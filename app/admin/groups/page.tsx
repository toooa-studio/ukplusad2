'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { AppUser, StudentGroup } from '@/lib/types';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  UserCheck,
  Pause,
  Play,
} from 'lucide-react';

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<AppUser[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);

  const studentMap = useMemo(() => {
    const m: Record<string, AppUser> = {};
    students.forEach((s) => {
      m[s.id] = s;
    });
    return m;
  }, [students]);

  const teacherMap = useMemo(() => {
    const m: Record<string, AppUser> = {};
    teachers.forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [teachers]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      if (!db) return;
      const [groupsSnap, studentsSnap, teachersSnap] = await Promise.all([
        getDocs(collection(db, 'studentGroups')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      ]);
      setGroups(
        groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentGroup),
      );
      setStudents(
        studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser),
      );
      setTeachers(
        teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser),
      );
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter((g) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (g.name?.toLowerCase().includes(q)) return true;
    return g.memberIds.some((mid) =>
      studentMap[mid]?.displayName?.toLowerCase().includes(q),
    );
  });

  const handleCreate = () => {
    setEditingGroup(null);
    setShowFormModal(true);
  };

  const handleEdit = (group: StudentGroup) => {
    setEditingGroup(group);
    setShowFormModal(true);
  };

  const handleDelete = async (group: StudentGroup) => {
    if (!db) return;
    if (
      !window.confirm(
        `ペア「${group.name}」を削除します。この操作は取り消せません。よろしいですか?`,
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'studentGroups', group.id));
      await loadAll();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('削除に失敗しました');
    }
  };

  const handleToggleStatus = async (group: StudentGroup) => {
    if (!db) return;
    const newStatus = group.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'studentGroups', group.id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      await loadAll();
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータスの変更に失敗しました');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 whitespace-nowrap">
                ペア管理
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                セミプライベートレッスン用のペア（生徒グループ）を登録します
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px] whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              新規ペアを作成
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-none p-4">
            <input
              type="text"
              placeholder="ペア名 / 生徒名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-none overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  {groups.length === 0
                    ? 'まだペアが登録されていません。「新規ペアを作成」から追加してください。'
                    : '検索条件に一致するペアがありません。'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        ペア名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        メンバー
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        担当講師
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        ステータス
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredGroups.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {g.name}
                          {g.note ? (
                            <div className="text-xs text-gray-500 mt-1">
                              {g.note}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className="flex flex-wrap gap-1">
                            {g.memberIds.map((mid) => (
                              <span
                                key={mid}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full"
                              >
                                <UserCheck className="w-3 h-3" />
                                {studentMap[mid]?.displayName || '不明な生徒'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {g.assignedTeacherIds && g.assignedTeacherIds.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {g.assignedTeacherIds.map((tid) => (
                                <span
                                  key={tid}
                                  className="inline-flex items-center px-2 py-0.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full whitespace-nowrap"
                                >
                                  {teacherMap[tid]?.displayName || '不明'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">指定なし</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {g.status === 'active' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              アクティブ
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              停止中
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStatus(g)}
                              title={g.status === 'active' ? '停止する' : '再開する'}
                              className="inline-flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md min-h-[44px] min-w-[44px]"
                            >
                              {g.status === 'active' ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(g)}
                              title="編集"
                              className="inline-flex items-center justify-center w-9 h-9 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md min-h-[44px] min-w-[44px]"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(g)}
                              title="削除"
                              className="inline-flex items-center justify-center w-9 h-9 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md min-h-[44px] min-w-[44px]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">登録ペア数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {groups.length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">アクティブ</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {groups.filter((g) => g.status === 'active').length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">対象生徒数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {new Set(groups.flatMap((g) => g.memberIds)).size}
              </p>
            </div>
          </div>

          {showFormModal && (
            <GroupFormModal
              group={editingGroup}
              students={students}
              teachers={teachers}
              currentUserId={user?.uid || 'admin'}
              onClose={() => {
                setShowFormModal(false);
                setEditingGroup(null);
              }}
              onSuccess={() => {
                setShowFormModal(false);
                setEditingGroup(null);
                loadAll();
              }}
            />
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

// =====================================================================
// ペア作成・編集モーダル
// =====================================================================

interface GroupFormModalProps {
  group: StudentGroup | null;
  students: AppUser[];
  teachers: AppUser[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function GroupFormModal({
  group,
  students,
  teachers,
  currentUserId,
  onClose,
  onSuccess,
}: GroupFormModalProps) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name || '');
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds || []);
  const [assignedTeacherIds, setAssignedTeacherIds] = useState<string[]>(
    group?.assignedTeacherIds || [],
  );
  const [note, setNote] = useState(group?.note || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(
    group?.status || 'active',
  );
  const [studentSearch, setStudentSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const filteredStudents = students.filter((s) => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.displayName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleTeacher = (id: string) => {
    setAssignedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!db) {
      setError('Firestore に接続できません');
      return;
    }
    if (!name.trim()) {
      setError('ペア名を入力してください');
      return;
    }
    if (memberIds.length < 2) {
      setError('メンバーは2名以上選択してください');
      return;
    }
    if (new Set(memberIds).size !== memberIds.length) {
      setError('同じ生徒が重複して選択されています');
      return;
    }

    setSubmitting(true);
    try {
      const now = Timestamp.now();
      if (isEdit && group) {
        await updateDoc(doc(db, 'studentGroups', group.id), {
          name: name.trim(),
          memberIds,
          assignedTeacherIds,
          note: note.trim() || null,
          status,
          updatedAt: now,
        });
      } else {
        const ref = doc(collection(db, 'studentGroups'));
        await setDoc(ref, {
          id: ref.id,
          name: name.trim(),
          type: 'semi_private',
          memberIds,
          assignedTeacherIds,
          status,
          note: note.trim() || null,
          createdBy: currentUserId,
          createdAt: now,
          updatedAt: now,
        });
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving group:', err);
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white border border-gray-200 rounded-none w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? 'ペアを編集' : '新規ペアを作成'}
          </h3>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md min-h-[44px] min-w-[44px]"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ペア名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例:山田太郎・鈴木花子ペア"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メンバー <span className="text-red-500">*</span>{' '}
              <span className="text-xs text-gray-500">
                （現在 {memberIds.length} 名選択中）
              </span>
            </label>
            <input
              type="text"
              placeholder="生徒名・メールで絞り込み..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            />
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-none divide-y divide-gray-100">
              {filteredStudents.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  生徒が見つかりません
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const checked = memberIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer min-h-[44px] ${
                        checked ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMember(s.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {s.displayName || '名前未設定'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.email}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              共通の担当講師{' '}
              <span className="text-xs text-gray-500">（任意・複数選択可）</span>
            </label>
            {teachers.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 border border-gray-200 rounded-none">
                講師が登録されていません
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {teachers.map((t) => {
                  const checked = assignedTeacherIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeacher(t.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border min-h-[44px] whitespace-nowrap ${
                        checked
                          ? 'bg-purple-100 text-purple-700 border-purple-300'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {t.displayName || '名前未設定'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`px-3 py-1.5 text-sm rounded-full border min-h-[44px] whitespace-nowrap ${
                  status === 'active'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                アクティブ
              </button>
              <button
                type="button"
                onClick={() => setStatus('inactive')}
                className={`px-3 py-1.5 text-sm rounded-full border min-h-[44px] whitespace-nowrap ${
                  status === 'inactive'
                    ? 'bg-gray-200 text-gray-700 border-gray-400'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                停止中
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              停止中のペアでは新規予約ができなくなります（既存予約には影響しません）。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メモ <span className="text-xs text-gray-500">（任意）</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="ペアに関する備考があれば記入"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-none text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-50 min-h-[44px]"
          >
            キャンセル
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
          >
            {submitting ? '保存中...' : isEdit ? '変更を保存' : '作成する'}
          </button>
        </div>
      </div>
    </div>
  );
}
