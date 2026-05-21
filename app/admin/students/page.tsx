'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { AppUser, Enrollment, DEFAULT_LESSON_MINUTES } from '@/lib/types';
import { collection, getDocs, query, where, doc, setDoc, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, createUserWithoutSignIn } from '@/lib/firebase/client';
import { deleteAuthUser } from '@/lib/auth';
import { formatDate, formatDateJa, toDate } from '@/lib/utils';
import { X, User, Mail, Ticket, CalendarDays, Clock, Edit2, Check, UserCheck, Users, Trash2, AlertTriangle, Pause, Play } from 'lucide-react';
import { calculateRescheduleAllowed } from '@/lib/types';
import { useAuth } from '@/lib/hooks/useAuth';

export default function StudentsPage() {
  const [students, setStudents] = useState<AppUser[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [enrollments, setEnrollments] = useState<Record<string, Enrollment[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AppUser | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const teacherMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    teachers.forEach(t => { map[t.id] = t; });
    return map;
  }, [teachers]);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      if (!db) return;
      const [studentsSnapshot, teachersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      ]);

      const studentsData = studentsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as AppUser[];
      const teachersData = teachersSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as AppUser[];

      setStudents(studentsData);
      setTeachers(teachersData);

      const enrollmentsData: Record<string, Enrollment[]> = {};
      for (const student of studentsData) {
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('studentId', '==', student.id)
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        enrollmentsData[student.id] = enrollmentsSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as Enrollment[];
      }

      setEnrollments(enrollmentsData);
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student =>
    student.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDetail = (student: AppUser) => {
    setSelectedStudent(student);
    setShowDetailModal(true);
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">生徒管理</h2>
              <p className="mt-1 text-sm text-gray-600">
                登録されている生徒の一覧と受講状況
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              + 生徒を追加
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-none p-4">
            <input
              type="text"
              placeholder="生徒名またはメールアドレスで検索..."
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
            ) : filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">生徒が登録されていません</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生徒名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">メールアドレス</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">受講可能な教師</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">残り回数</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有効期限</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map((student) => {
                      const studentEnrollments = enrollments[student.id] || [];
                      const activeEnrollments = studentEnrollments.filter(e => e.status === 'active');
                      const earliestValidUntil = activeEnrollments.length > 0
                        ? activeEnrollments.reduce((min, e) => {
                            const d = toDate(e.validUntil);
                            return !min || d.getTime() < min.getTime() ? d : min;
                          }, null as Date | null)
                        : null;

                      return (
                        <tr key={student.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {student.displayName || '名前未設定'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{student.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {student.assignedTeacherIds && student.assignedTeacherIds.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {student.assignedTeacherIds.map(tid => (
                                  <span key={tid} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                                    <UserCheck className="w-3 h-3" />
                                    {teacherMap[tid]?.displayName || '不明'}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">制限なし</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {activeEnrollments.length === 0 ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {activeEnrollments.map(e => {
                                  const lm = e.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
                                  const isLow = e.remainingCount <= 2;
                                  return (
                                    <span key={e.id} className="inline-flex items-center gap-1 whitespace-nowrap">
                                      <span className="px-1.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                                        {lm}分
                                      </span>
                                      <span className={`text-sm ${isLow ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                        × 残{e.remainingCount}回
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {earliestValidUntil ? formatDateJa(earliestValidUntil) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {activeEnrollments.length > 0 ? (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">アクティブ</span>
                            ) : (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">登録なし</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleOpenDetail(student)}
                              className="text-blue-600 hover:text-blue-900 min-h-[44px]"
                            >
                              詳細
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">総生徒数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{students.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">アクティブ生徒</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {students.filter(s => (enrollments[s.id] || []).some(e => e.status === 'active')).length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-none p-6">
              <p className="text-sm font-medium text-gray-600">総残り回数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {Object.values(enrollments).flat().filter(e => e.status === 'active').reduce((sum, e) => sum + e.remainingCount, 0)}回
              </p>
            </div>
          </div>

          {showAddModal && (
            <AddStudentModal
              onClose={() => setShowAddModal(false)}
              onSuccess={() => { setShowAddModal(false); loadStudents(); }}
            />
          )}

          {showDetailModal && selectedStudent && (
            <StudentDetailModal
              student={selectedStudent}
              enrollments={enrollments[selectedStudent.id] || []}
              teachers={teachers}
              teacherMap={teacherMap}
              onClose={() => { setShowDetailModal(false); setSelectedStudent(null); }}
              onUpdate={loadStudents}
            />
          )}

        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

// ============================
// 生徒詳細モーダル
// ============================

interface StudentDetailModalProps {
  student: AppUser;
  enrollments: Enrollment[];
  teachers: AppUser[];
  teacherMap: Record<string, AppUser>;
  onClose: () => void;
  onUpdate: () => void;
}

function StudentDetailModal({ student, enrollments, teachers, teacherMap, onClose, onUpdate }: StudentDetailModalProps) {
  const [editingTeachers, setEditingTeachers] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(student.assignedTeacherIds || []);
  const [savingTeachers, setSavingTeachers] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [processing, setProcessing] = useState(false);

  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const expiredEnrollments = enrollments.filter(e => e.status !== 'active');

  const statusLabels: Record<string, string> = {
    active: 'アクティブ',
    expired: '期限切れ',
    depleted: '回数消化済み',
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

  const handleToggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds(prev =>
      prev.includes(teacherId) ? prev.filter(id => id !== teacherId) : [...prev, teacherId]
    );
  };

  const handleSaveTeachers = async () => {
    if (!db) return;
    setSavingTeachers(true);
    try {
      await updateDoc(doc(db, 'users', student.id), {
        assignedTeacherIds: selectedTeacherIds,
        updatedAt: Timestamp.now(),
      });
      setEditingTeachers(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving teacher assignments:', error);
      alert('保存に失敗しました');
    } finally {
      setSavingTeachers(false);
    }
  };

  const handleClearTeachers = async () => {
    if (!db) return;
    if (!confirm('教師の制限を解除しますか？すべての教師の授業を受けられるようになります。')) return;
    setSavingTeachers(true);
    try {
      await updateDoc(doc(db, 'users', student.id), {
        assignedTeacherIds: [],
        updatedAt: Timestamp.now(),
      });
      setSelectedTeacherIds([]);
      setEditingTeachers(false);
      onUpdate();
    } catch (error) {
      console.error('Error clearing teacher assignments:', error);
      alert('更新に失敗しました');
    } finally {
      setSavingTeachers(false);
    }
  };

  const handleDeactivateAllEnrollments = async () => {
    if (!db) return;
    if (activeEnrollments.length === 0) {
      alert('アクティブな受講登録がありません');
      return;
    }
    if (!confirm(`${student.displayName || student.email}のすべてのアクティブな受講登録を停止しますか？\n\n生徒は授業を予約できなくなります。後から再開することも可能です。`)) return;
    
    setProcessing(true);
    try {
      for (const enrollment of activeEnrollments) {
        await updateDoc(doc(db, 'enrollments', enrollment.id), {
          status: 'inactive',
          updatedAt: Timestamp.now(),
        });
      }
      alert('すべての受講登録を停止しました');
      onUpdate();
    } catch (error) {
      console.error('Error deactivating enrollments:', error);
      alert('停止に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  const handleActivateAllEnrollments = async () => {
    if (!db) return;
    const inactiveEnrollments = enrollments.filter(e => e.status === 'inactive');
    if (inactiveEnrollments.length === 0) {
      alert('停止中の受講登録がありません');
      return;
    }
    if (!confirm(`${student.displayName || student.email}の停止中の受講登録を再開しますか？\n\n生徒は再び授業を予約できるようになります。`)) return;
    
    setProcessing(true);
    try {
      for (const enrollment of inactiveEnrollments) {
        await updateDoc(doc(db, 'enrollments', enrollment.id), {
          status: 'active',
          updatedAt: Timestamp.now(),
        });
      }
      alert('すべての受講登録を再開しました');
      onUpdate();
    } catch (error) {
      console.error('Error activating enrollments:', error);
      alert('再開に失敗しました');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-none border border-gray-200 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">生徒詳細</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">基本情報</h4>
            <div className="border border-gray-200 rounded-none p-4 space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 w-20 flex-shrink-0">名前</span>
                <span className="text-sm font-medium text-gray-900">{student.displayName || '未設定'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 w-20 flex-shrink-0">メール</span>
                <span className="text-sm font-medium text-gray-900">{student.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <CalendarDays className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 w-20 flex-shrink-0">登録日</span>
                <span className="text-sm font-medium text-gray-900">{formatDateJa(toDate(student.createdAt))}</span>
              </div>
            </div>
          </div>

          {/* 受講可能な教師 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">受講可能な教師</h4>
              {!editingTeachers && (
                <button
                  onClick={() => { setEditingTeachers(true); setSelectedTeacherIds(student.assignedTeacherIds || []); }}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium min-h-[44px] flex items-center"
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  編集
                </button>
              )}
            </div>
            <div className="border border-gray-200 rounded-none p-4">
              {editingTeachers ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    この生徒が受講できる教師を複数選択してください。何も選択しない場合はすべての教師の授業を受けられます。
                  </p>
                  {teachers.length === 0 ? (
                    <p className="text-sm text-gray-400">教師が登録されていません</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-medium">
                          {selectedTeacherIds.length}/{teachers.length}人 選択中
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedTeacherIds.length === teachers.length) {
                              setSelectedTeacherIds([]);
                            } else {
                              setSelectedTeacherIds(teachers.map(t => t.id));
                            }
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          {selectedTeacherIds.length === teachers.length ? '全解除' : '全選択'}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {teachers.map(teacher => {
                          const isSelected = selectedTeacherIds.includes(teacher.id);
                          return (
                            <label
                              key={teacher.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleTeacher(teacher.id)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-semibold flex-shrink-0">
                                {teacher.displayName?.[0] || 'T'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{teacher.displayName || '名前未設定'}</p>
                                <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    {(student.assignedTeacherIds || []).length > 0 && (
                      <button
                        onClick={handleClearTeachers}
                        disabled={savingTeachers}
                        className="py-2 px-3 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-[6px] transition-colors min-h-[44px]"
                      >
                        制限を解除
                      </button>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => { setEditingTeachers(false); setSelectedTeacherIds(student.assignedTeacherIds || []); }}
                      className="py-2 px-4 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px]"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSaveTeachers}
                      disabled={savingTeachers}
                      className="py-2 px-4 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-[6px] transition-colors min-h-[44px] flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      {savingTeachers ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {(student.assignedTeacherIds || []).length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-blue-600 font-medium">以下の教師のみ受講可能</span>
                      </div>
                      {student.assignedTeacherIds!.map(tid => {
                        const t = teacherMap[tid];
                        return (
                          <div key={tid} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-[6px]">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-semibold flex-shrink-0">
                              {t?.displayName?.[0] || '?'}
                            </div>
                            <span className="text-sm text-gray-900">{t?.displayName || '不明な教師'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">制限なし — すべての教師の授業を受講可能</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* アクティブな受講情報 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              アクティブな受講 ({activeEnrollments.length}件)
            </h4>
            {activeEnrollments.length === 0 ? (
              <div className="border border-gray-200 rounded-none p-4 text-center">
                <p className="text-sm text-gray-500">アクティブな受講がありません</p>
              </div>
            ) : (
              activeEnrollments.map((enrollment) => (
                <EnrollmentCard key={enrollment.id} enrollment={enrollment} statusLabels={statusLabels} statusColors={statusColors} typeLabels={typeLabels} onUpdate={onUpdate} />
              ))
            )}
          </div>

          {/* 過去の受講情報 */}
          {expiredEnrollments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                過去の受講 ({expiredEnrollments.length}件)
              </h4>
              {expiredEnrollments.map((enrollment) => (
                <EnrollmentCard key={enrollment.id} enrollment={enrollment} statusLabels={statusLabels} statusColors={statusColors} typeLabels={typeLabels} onUpdate={onUpdate} />
              ))}
            </div>
          )}

          {/* アクティブ停止・再開 */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">受講状態の管理</h4>
            <div className="space-y-2">
              {activeEnrollments.length > 0 && (
                <button
                  onClick={handleDeactivateAllEnrollments}
                  disabled={processing}
                  className="w-full py-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-[6px] min-h-[44px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Pause className="w-4 h-4" />
                  {processing ? '処理中...' : 'すべての受講を停止'}
                </button>
              )}
              {enrollments.filter(e => e.status === 'inactive').length > 0 && (
                <button
                  onClick={handleActivateAllEnrollments}
                  disabled={processing}
                  className="w-full py-2 text-sm text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-[6px] min-h-[44px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {processing ? '処理中...' : '停止中の受講を再開'}
                </button>
              )}
              {activeEnrollments.length === 0 && enrollments.filter(e => e.status === 'inactive').length === 0 && (
                <div className="border border-gray-200 rounded-none p-4 text-center">
                  <p className="text-sm text-gray-500">管理可能な受講登録がありません</p>
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-[6px] p-3">
              <p className="text-xs text-blue-800">
                <strong>停止:</strong> 生徒は授業を予約できなくなります（アカウントは残ります）<br />
                <strong>再開:</strong> 停止中の受講登録を再びアクティブにします
              </p>
            </div>
          </div>

          {/* 生徒削除 */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-red-500 uppercase tracking-wider">危険な操作</h4>
            {showDeleteConfirm ? (
              <div className="border border-red-200 rounded-none p-4 space-y-3 bg-red-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">本当にこの生徒を削除しますか？</p>
                    <p className="text-xs text-red-600 mt-1">
                      「{student.displayName || student.email}」のアカウントとFirestore上のユーザーデータが削除されます。この操作は取り消せません。
                    </p>
                  </div>
                </div>
                {deleteError && (
                  <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-[6px] text-xs">{deleteError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                    disabled={deleting}
                    className="flex-1 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-[6px] min-h-[44px]"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={async () => {
                      if (!db) return;
                      setDeleting(true);
                      setDeleteError('');
                      try {
                        const authResult = await deleteAuthUser(student.id);
                        if (!authResult.success) {
                          setDeleteError(authResult.error || 'Authユーザーの削除に失敗しました');
                        }
                        await deleteDoc(doc(db, 'users', student.id));
                        for (const enrollment of enrollments) {
                          await deleteDoc(doc(db, 'enrollments', enrollment.id));
                        }
                        onUpdate();
                        onClose();
                      } catch (error) {
                        console.error('Error deleting student:', error);
                        const err = error as { code?: string; message?: string };
                        setDeleteError(`削除に失敗しました: ${err.code || err.message || '不明なエラー'}`);
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="flex-1 py-2 text-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 rounded-[6px] min-h-[44px] flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 text-sm text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-[6px] min-h-[44px] flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                この生徒を削除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EnrollmentCardProps {
  enrollment: Enrollment;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  typeLabels: Record<string, string>;
  onUpdate: () => void;
}

function EnrollmentCard({ enrollment, statusLabels, statusColors, typeLabels, onUpdate }: EnrollmentCardProps) {
  const [editing, setEditing] = useState(false);
  const [newCount, setNewCount] = useState(enrollment.registeredCount);
  const [newLessonMinutes, setNewLessonMinutes] = useState<number>(
    enrollment.lessonMinutes ?? DEFAULT_LESSON_MINUTES,
  );
  const [newValidUntil, setNewValidUntil] = useState(
    formatDate(toDate(enrollment.validUntil))
  );
  const [saving, setSaving] = useState(false);
  const lessonMinutes = enrollment.lessonMinutes ?? DEFAULT_LESSON_MINUTES;

  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      const remaining = newCount - enrollment.usedCount;
      await updateDoc(doc(db, 'enrollments', enrollment.id), {
        registeredCount: newCount,
        remainingCount: remaining < 0 ? 0 : remaining,
        rescheduleAllowedCount: calculateRescheduleAllowed(newCount),
        lessonMinutes: newLessonMinutes,
        validUntil: Timestamp.fromDate(new Date(newValidUntil + 'T23:59:59')),
        status: remaining <= 0 ? 'depleted' : 'active',
        updatedAt: Timestamp.now(),
      });
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating enrollment:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColors[enrollment.status]}`}>
            {statusLabels[enrollment.status]}
          </span>
          <span className="px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
            {lessonMinutes}分レッスン
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{typeLabels[enrollment.type]}</span>
          {!editing && enrollment.status === 'active' && (
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">レッスン時間</label>
              <select
                value={newLessonMinutes}
                onChange={(e) => setNewLessonMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
              >
                {[30, 40, 45, 60, 75, 90, 120].map((m) => (
                  <option key={m} value={m}>{m}分</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">登録回数</label>
              <input
                type="number"
                min={enrollment.usedCount}
                value={newCount}
                onChange={(e) => setNewCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">有効期限</label>
              <input
                type="date"
                value={newValidUntil}
                onChange={(e) => setNewValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-[6px] min-h-[44px]">
              キャンセル
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-[6px] min-h-[44px] flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">残り / 登録回数</p>
              <p className="text-sm font-bold text-gray-900">{enrollment.remainingCount} / {enrollment.registeredCount}回</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">使用済み</p>
              <p className="text-sm font-bold text-gray-900">{enrollment.usedCount}回</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">有効期限</p>
              <p className="text-sm font-bold text-gray-900">{formatDateJa(toDate(enrollment.validUntil))}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">振替可能回数</p>
              <p className="text-sm font-bold text-gray-900">{enrollment.rescheduleAllowedCount - enrollment.rescheduleUsedCount} / {enrollment.rescheduleAllowedCount}回</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================
// 生徒追加モーダル
// ============================

interface AddStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddStudentModal({ onClose, onSuccess }: AddStudentModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください。');
      return;
    }
    setSubmitting(true);
    try {
      await createUserWithoutSignIn(email, password, name, 'student', user?.uid);
      onSuccess();
    } catch (err: unknown) {
      console.error('Error adding student:', err);
      if (err instanceof Error && 'code' in err) {
        const firebaseError = err as { code: string };
        if (firebaseError.code === 'auth/email-already-in-use') {
          setError('このメールアドレスは既に使用されています。');
        } else if (firebaseError.code === 'auth/weak-password') {
          setError('パスワードが弱すぎます。6文字以上で入力してください。');
        } else if (firebaseError.code === 'auth/invalid-email') {
          setError('メールアドレスの形式が正しくありません。');
        } else {
          setError(`エラーが発生しました: ${firebaseError.code}`);
        }
      } else {
        setError('予期しないエラーが発生しました。');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">生徒を追加</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="student-name" className="block text-sm font-medium text-gray-700">名前</label>
            <input id="student-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]" placeholder="例：山田太郎" />
          </div>
          <div>
            <label htmlFor="student-email" className="block text-sm font-medium text-gray-700">メールアドレス</label>
            <input id="student-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]" placeholder="例：xxxx@gmail.com" />
          </div>
          <div>
            <label htmlFor="student-password" className="block text-sm font-medium text-gray-700">パスワード（6文字以上）</label>
            <input id="student-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]" />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md text-sm">
            <p className="font-medium mb-1">自動設定される内容：</p>
            <ul className="text-xs space-y-1 ml-4 list-disc">
              <li>レッスン時間: 60分</li>
              <li>登録回数: 8回</li>
              <li>有効期限: 3ヶ月後</li>
              <li>ステータス: アクティブ</li>
              <li>振替可能回数: 2回</li>
            </ul>
            <p className="text-xs mt-2 text-blue-600">
              ※ 後から編集可能です。40分など別時間のレッスンを追加したい場合は、生徒詳細・受講管理から複数登録できます。
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors min-h-[44px]">キャンセル</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]">{submitting ? '追加中...' : '追加する'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
