'use client';

import { useState, useEffect, useRef } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { TeacherProfile, AppUser, UserRole } from '@/lib/types';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, createUserWithoutSignIn } from '@/lib/firebase/client';
import { deleteAuthUser } from '@/lib/auth';
import { X, Trash2, Plus, Camera, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<(AppUser & { profile?: TeacherProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<(AppUser & { profile?: TeacherProfile }) | null>(null);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'admin'])
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersData = teachersSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as AppUser[];

      const teachersWithProfiles = await Promise.all(
        teachersData.map(async (teacher) => {
          try {
            const profileSnapshot = await getDocs(
              query(collection(db, 'teacherProfiles'), where('__name__', '==', teacher.id))
            );
            const profile = profileSnapshot.docs[0]?.data() as TeacherProfile | undefined;
            return { ...teacher, profile };
          } catch (error) {
            console.error(`Error loading profile for ${teacher.id}:`, error);
            return teacher;
          }
        })
      );

      setTeachers(teachersWithProfiles);
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">教師管理</h2>
              <p className="mt-1 text-sm text-gray-600">
                登録されている教師の一覧とプロフィール
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              + 教師を追加
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              teachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  onEdit={() => setEditingTeacher(teacher)}
                />
              ))
            )}
          </div>

          {showAddModal && (
            <AddTeacherModal
              onClose={() => setShowAddModal(false)}
              onSuccess={() => {
                setShowAddModal(false);
                loadTeachers();
              }}
            />
          )}

          {editingTeacher && (
            <EditTeacherModal
              teacher={editingTeacher}
              onClose={() => setEditingTeacher(null)}
              onSuccess={() => {
                setEditingTeacher(null);
                loadTeachers();
              }}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600">総教師数</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{teachers.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600">管理者</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {teachers.filter(t => t.role === 'admin').length}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600">教師</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {teachers.filter(t => t.role === 'teacher').length}
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

interface TeacherCardProps {
  teacher: AppUser & { profile?: TeacherProfile };
  onEdit: () => void;
}

function TeacherCard({ teacher, onEdit }: TeacherCardProps) {
  const photoURL = teacher.profile?.photoPath || teacher.photoURL;

  return (
    <div className="bg-white rounded-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-20"></div>

      <div className="px-6 pb-6 flex flex-col flex-1">
        <div className="flex flex-col items-center -mt-10">
          {photoURL ? (
            <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white">
              <Image
                src={photoURL}
                alt={teacher.profile?.name || teacher.displayName || '教師'}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white border-4 border-white flex items-center justify-center text-2xl font-bold text-blue-600">
              {teacher.profile?.name?.[0] || teacher.displayName?.[0] || 'T'}
            </div>
          )}
          <h3 className="mt-3 text-lg font-bold text-gray-900">
            {teacher.profile?.name || teacher.displayName || '名前未設定'}
          </h3>
          <p className="text-sm text-gray-600">{teacher.email}</p>

          {teacher.role === 'admin' && (
            <span className="mt-2 px-3 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
              管理者
            </span>
          )}
        </div>

        {teacher.profile?.specialties && teacher.profile.specialties.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">専門分野</p>
            <div className="flex flex-wrap gap-2">
              {teacher.profile.specialties.map((specialty, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {teacher.profile?.bio && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 mb-1">自己紹介</p>
            <p className="text-sm text-gray-700 line-clamp-3">{teacher.profile.bio}</p>
          </div>
        )}

        <div className="mt-auto pt-6">
          <button
            onClick={onEdit}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px]"
          >
            編集
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditTeacherModalProps {
  teacher: AppUser & { profile?: TeacherProfile };
  onClose: () => void;
  onSuccess: () => void;
}

function EditTeacherModal({ teacher, onClose, onSuccess }: EditTeacherModalProps) {
  const [name, setName] = useState(teacher.profile?.name || teacher.displayName || '');
  const [bio, setBio] = useState(teacher.profile?.bio || '');
  const [specialties, setSpecialties] = useState<string[]>(teacher.profile?.specialties || []);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [photoURL, setPhotoURL] = useState(teacher.profile?.photoPath || teacher.photoURL || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('画像サイズは5MB以下にしてください');
      return;
    }

    setUploadingPhoto(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `teacher-photos/${teacher.id}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('画像のアップロードに失敗しました');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!storage || !photoURL) return;
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `teacher-photos/${teacher.id}`);
      await deleteObject(storageRef).catch(() => {});
      setPhotoURL('');
    } catch (err) {
      console.error('Error removing photo:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
      setNewSpecialty('');
    }
  };

  const handleRemoveSpecialty = (index: number) => {
    setSpecialties(specialties.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!db) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await setDoc(doc(db, 'users', teacher.id), {
        displayName: name,
        photoURL: photoURL || null,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      await setDoc(doc(db, 'teacherProfiles', teacher.id), {
        id: teacher.id,
        name,
        bio,
        specialties,
        photoPath: photoURL || null,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      setSuccess('保存しました');
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      console.error('Error saving teacher:', err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!db) return;
    setError('');
    setDeleting(true);

    try {
      await deleteDoc(doc(db, 'teacherProfiles', teacher.id));
      await deleteDoc(doc(db, 'users', teacher.id));

      const authResult = await deleteAuthUser(teacher.id);
      if (!authResult.success) {
        console.warn('Auth user deletion skipped:', authResult.error);
      }

      onSuccess();
    } catch (err) {
      console.error('Error deleting teacher:', err);
      setError('削除に失敗しました');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">教師情報の編集</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div className="text-xs text-gray-500">
            メールアドレス: {teacher.email}
          </div>

          {/* プロフィール画像 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">プロフィール画像</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {photoURL ? (
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-200">
                    <Image src={photoURL} alt="プロフィール" width={80} height={80} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl font-bold text-gray-400">
                    {name?.[0] || 'T'}
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-[6px] transition-colors min-h-[44px] disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  {photoURL ? '画像を変更' : '画像を選択'}
                </button>
                {photoURL && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="inline-flex items-center gap-1 px-4 py-2 text-xs text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    画像を削除
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">JPEG/PNG、最大5MB</p>
          </div>

          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
              表示名
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：John Smith"
            />
            <p className="mt-1 text-xs text-gray-500">生徒に表示される名前です</p>
          </div>

          <div>
            <label htmlFor="edit-bio" className="block text-sm font-medium text-gray-700">
              自己紹介
            </label>
            <textarea
              id="edit-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="10年以上の英語教育経験があり、ビジネス英語・IELTS対策を得意としています"
            />
            <p className="mt-1 text-xs text-gray-500">生徒に表示されるプロフィール文です</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              専門分野
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {specialties.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleRemoveSpecialty(i)}
                    className="text-blue-400 hover:text-blue-700 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {specialties.length === 0 && (
                <span className="text-sm text-gray-400">まだ追加されていません</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpecialty}
                onChange={(e) => setNewSpecialty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSpecialty();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
                placeholder="例：ビジネス英語、IELTS、日常会話"
              />
              <button
                type="button"
                onClick={handleAddSpecialty}
                className="px-3 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">生徒が教師を選ぶ際の参考になります</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
              {success}
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
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1 py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>

          <div className="border-t border-gray-200 pt-5 mt-2">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                このアカウントを削除する
              </button>
            ) : (
              <div className="border border-red-200 bg-red-50 rounded p-4 space-y-3">
                <p className="text-sm font-medium text-red-800">
                  本当に「{teacher.profile?.name || teacher.displayName}」を削除しますか？
                </p>
                <p className="text-xs text-red-600">
                  この操作は取り消せません。教師のアカウント情報、プロフィールがすべて削除されます。
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 px-4 text-sm font-medium rounded-[6px] text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors min-h-[44px]"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 px-4 text-sm font-medium rounded-[6px] text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AddTeacherModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddTeacherModal({ onClose, onSuccess }: AddTeacherModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');
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
      await createUserWithoutSignIn(email, password, name, role);
      onSuccess();
    } catch (err: unknown) {
      console.error('Error adding teacher:', err);
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
      <div
        className="bg-white rounded-none border border-gray-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">教師を追加</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teacher-name" className="block text-sm font-medium text-gray-700">
              名前
            </label>
            <input
              id="teacher-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：山田太郎"
            />
          </div>

          <div>
            <label htmlFor="teacher-email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="teacher-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
              placeholder="例：xxxx@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="teacher-password" className="block text-sm font-medium text-gray-700">
              パスワード（6文字以上）
            </label>
            <input
              id="teacher-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="teacher-role" className="block text-sm font-medium text-gray-700">
              権限
            </label>
            <select
              id="teacher-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm min-h-[44px]"
            >
              <option value="teacher">教師</option>
              <option value="admin">管理者</option>
            </select>
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
              {submitting ? '追加中...' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
