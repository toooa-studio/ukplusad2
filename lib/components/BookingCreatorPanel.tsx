'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  AppUser,
  Enrollment,
  PrivateSlot,
  StudentGroup,
  DEFAULT_LESSON_MINUTES,
} from '@/lib/types';
import {
  BOOKING_DURATION_STEP_MINUTES,
  formatTime,
  toDate,
} from '@/lib/utils';

type BookingType = 'private' | 'semi_private';

/** セミプライベートのレッスン時間として提示する選択肢（受講管理と揃える） */
const LESSON_MINUTES_OPTIONS = [30, 40, 45, 60, 75, 90, 120];

interface BookingCreatorPanelProps {
  slot: PrivateSlot;
  onSuccess: () => void;
}

interface StartTimeOption {
  iso: string;
  label: string;
}

/**
 * 管理者が空きスロットに対して **代理予約**を作成するパネル。
 *
 * - プライベート: 生徒1名 + その生徒の active enrollment 1件
 * - セミプライベート: 既存ペア（studentGroup） + 全メンバーが共通で持つ lessonMinutes
 *
 * いずれもサーバー側 `/api/bookings/create` の整合チェック（残数・期限・lessonMinutes 一致）に従う。
 */
export function BookingCreatorPanel({ slot, onSuccess }: BookingCreatorPanelProps) {
  const { user } = useAuth();
  const [bookingType, setBookingType] = useState<BookingType>('private');

  const [students, setStudents] = useState<AppUser[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [enrollmentsByStudent, setEnrollmentsByStudent] = useState<
    Record<string, Enrollment[]>
  >({});
  const [loading, setLoading] = useState(true);

  // 共通入力
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedLessonMinutes, setSelectedLessonMinutes] = useState<number | null>(null);
  const [selectedStartIso, setSelectedStartIso] = useState('');
  const [zoomURL, setZoomURL] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slotStart = useMemo(() => slot.startAt.toDate(), [slot]);
  const slotEnd = useMemo(() => slot.endAt.toDate(), [slot]);

  // 初回ロード: 生徒・ペア・enrollments
  useEffect(() => {
    const loadAll = async () => {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const [studentsSnap, groupsSnap, enrollSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
          getDocs(query(collection(db, 'studentGroups'), where('status', '==', 'active'))),
          getDocs(query(collection(db, 'enrollments'), where('status', '==', 'active'))),
        ]);

        const allStudents = studentsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as AppUser,
        );
        const allGroups = groupsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as StudentGroup,
        );
        const allEnrollments = enrollSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Enrollment,
        );

        const map: Record<string, Enrollment[]> = {};
        allEnrollments.forEach((e) => {
          if (!map[e.studentId]) map[e.studentId] = [];
          map[e.studentId].push(e);
        });

        setStudents(allStudents);
        setGroups(allGroups);
        setEnrollmentsByStudent(map);
      } catch (err) {
        console.error('Failed to load booking creator data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // ペア（セミプライベート）でこの講師が担当しているもの・全員 enrollment を持っているものに絞り込む
  const eligibleGroups = useMemo(() => {
    return groups.filter((g) => {
      if (g.assignedTeacherIds && g.assignedTeacherIds.length > 0) {
        if (!g.assignedTeacherIds.includes(slot.teacherId)) return false;
      }
      // メンバー全員が active enrollment を1つでも持っているか
      return g.memberIds.every((mid) => (enrollmentsByStudent[mid] || []).length > 0);
    });
  }, [groups, slot.teacherId, enrollmentsByStudent]);

  const selectedGroup = useMemo(
    () => eligibleGroups.find((g) => g.id === selectedGroupId) || null,
    [eligibleGroups, selectedGroupId],
  );

  /**
   * セミプライベート選択時の「各候補レッスン時間ごとの利用可否」マップ。
   * - 各メンバーがその時間の active enrollment（残数 > 0・期限内）を持っていれば available
   * - 1名でも欠ければその時間は disabled で表示し、誰が不足しているかを通知
   */
  const lessonMinutesAvailability = useMemo(() => {
    if (!selectedGroup) return [] as { minutes: number; available: boolean; missingMemberIds: string[] }[];
    return LESSON_MINUTES_OPTIONS.map((m) => {
      const missingMemberIds: string[] = [];
      for (const mid of selectedGroup.memberIds) {
        const list = enrollmentsByStudent[mid] || [];
        const hasMatching = list.some((e) => {
          const lm = e.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
          return lm === m && (e.remainingCount ?? 0) > 0;
        });
        if (!hasMatching) missingMemberIds.push(mid);
      }
      return {
        minutes: m,
        available: missingMemberIds.length === 0,
        missingMemberIds,
      };
    });
  }, [selectedGroup, enrollmentsByStudent]);

  // プライベート: 選択中の生徒の active enrollments
  const studentActiveEnrollments = useMemo<Enrollment[]>(() => {
    if (!selectedStudentId) return [];
    return (enrollmentsByStudent[selectedStudentId] || []).filter(
      (e) => (e.remainingCount ?? 0) > 0,
    );
  }, [selectedStudentId, enrollmentsByStudent]);

  // 選択中の lessonMinutes（プライベートは選んだ enrollment から決まる）
  const effectiveLessonMinutes = useMemo<number | null>(() => {
    if (bookingType === 'private') {
      const e = studentActiveEnrollments.find((x) => x.id === selectedEnrollmentId);
      if (!e) return null;
      return e.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
    }
    return selectedLessonMinutes;
  }, [bookingType, studentActiveEnrollments, selectedEnrollmentId, selectedLessonMinutes]);

  // 開始時刻の選択肢: スロット範囲内で 30 分刻み、かつ end が範囲内に収まるもの
  const startTimeOptions = useMemo<StartTimeOption[]>(() => {
    if (!effectiveLessonMinutes || effectiveLessonMinutes <= 0) return [];
    const step = BOOKING_DURATION_STEP_MINUTES;
    const opts: StartTimeOption[] = [];
    const cur = new Date(slotStart);
    cur.setSeconds(0, 0);
    const minute = cur.getMinutes();
    if (minute % step !== 0) {
      cur.setMinutes(minute + (step - (minute % step)));
    }
    while (cur.getTime() + effectiveLessonMinutes * 60_000 <= slotEnd.getTime()) {
      const endLabel = new Date(cur.getTime() + effectiveLessonMinutes * 60_000);
      opts.push({
        iso: cur.toISOString(),
        label: `${formatTime(cur)} 〜 ${formatTime(endLabel)}`,
      });
      cur.setMinutes(cur.getMinutes() + step);
    }
    return opts;
  }, [slotStart, slotEnd, effectiveLessonMinutes]);

  // 種別が変わったら関連選択をリセット
  useEffect(() => {
    setSelectedStudentId('');
    setSelectedEnrollmentId('');
    setSelectedGroupId('');
    setSelectedLessonMinutes(null);
    setSelectedStartIso('');
    setError('');
  }, [bookingType]);

  // 生徒・ペア変更時に下流をリセット
  useEffect(() => {
    setSelectedEnrollmentId('');
    setSelectedStartIso('');
  }, [selectedStudentId]);
  useEffect(() => {
    setSelectedLessonMinutes(null);
    setSelectedStartIso('');
  }, [selectedGroupId]);
  useEffect(() => {
    setSelectedStartIso('');
  }, [selectedLessonMinutes, selectedEnrollmentId]);

  const handleSubmit = async () => {
    setError('');
    if (!user?.uid) {
      setError('ログイン情報が取得できません。再ログインしてください。');
      return;
    }
    if (!effectiveLessonMinutes) {
      setError('レッスン時間が確定していません。');
      return;
    }
    if (!selectedStartIso) {
      setError('開始時刻を選択してください。');
      return;
    }

    const start = new Date(selectedStartIso);
    const end = new Date(start.getTime() + effectiveLessonMinutes * 60_000);

    let body: Record<string, unknown> = {
      slotId: slot.id,
      lessonStartAt: start.toISOString(),
      lessonEndAt: end.toISOString(),
      bookedBy: user.uid,
      zoomURL: zoomURL.trim() || undefined,
    };

    if (bookingType === 'private') {
      if (!selectedStudentId || !selectedEnrollmentId) {
        setError('生徒と受講登録を選択してください。');
        return;
      }
      body = {
        ...body,
        studentId: selectedStudentId,
        enrollmentId: selectedEnrollmentId,
      };
    } else {
      if (!selectedGroup) {
        setError('ペアを選択してください。');
        return;
      }
      const attendees: { studentId: string; enrollmentId: string }[] = [];
      for (const mid of selectedGroup.memberIds) {
        const e = (enrollmentsByStudent[mid] || []).find((x) => {
          const lm = x.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
          return lm === effectiveLessonMinutes && (x.remainingCount ?? 0) > 0;
        });
        if (!e) {
          setError(`メンバーの中に ${effectiveLessonMinutes}分用の有効な受講登録を持っていない方がいます。`);
          return;
        }
        attendees.push({ studentId: mid, enrollmentId: e.id });
      }
      body = {
        ...body,
        groupId: selectedGroup.id,
        attendees,
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '予約作成に失敗しました');
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '予約作成に失敗しました';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-gray-200 rounded p-4 text-center text-sm text-gray-500">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">代理予約を作成</h4>
        <span className="text-xs text-gray-500">
          スロット: {formatTime(slotStart)} 〜 {formatTime(slotEnd)}
        </span>
      </div>

      {/* タイプ切替 */}
      <div className="grid grid-cols-2 gap-2">
        {(['private', 'semi_private'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setBookingType(t)}
            className={`py-2 px-3 text-sm rounded-[6px] min-h-[44px] border transition-colors ${
              bookingType === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t === 'private' ? 'プライベート' : 'セミプライベート（ペア）'}
          </button>
        ))}
      </div>

      {bookingType === 'private' ? (
        <PrivateInputs
          students={students}
          studentEnrollments={studentActiveEnrollments}
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          selectedEnrollmentId={selectedEnrollmentId}
          setSelectedEnrollmentId={setSelectedEnrollmentId}
        />
      ) : (
        <SemiPrivateInputs
          groups={eligibleGroups}
          students={students}
          enrollmentsByStudent={enrollmentsByStudent}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          lessonMinutesAvailability={lessonMinutesAvailability}
          selectedLessonMinutes={selectedLessonMinutes}
          setSelectedLessonMinutes={setSelectedLessonMinutes}
        />
      )}

      {/* 開始時刻 */}
      {effectiveLessonMinutes && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            開始時刻（{effectiveLessonMinutes}分レッスン）
          </label>
          {startTimeOptions.length === 0 ? (
            <div className="text-sm text-red-600">
              この時間（{effectiveLessonMinutes}分）はスロット範囲内に収まりません。
            </div>
          ) : (
            <select
              value={selectedStartIso}
              onChange={(e) => setSelectedStartIso(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
            >
              <option value="">選択してください</option>
              {startTimeOptions.map((opt) => (
                <option key={opt.iso} value={opt.iso}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Zoom URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Zoom URL（任意）
        </label>
        <input
          type="url"
          value={zoomURL}
          onChange={(e) => setZoomURL(e.target.value)}
          placeholder="例：https://zoom.us/j/1234567890"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !effectiveLessonMinutes || !selectedStartIso}
        className="w-full py-3 px-4 text-sm font-medium rounded-[6px] text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {submitting ? '予約作成中...' : '予約を確定する'}
      </button>
    </div>
  );
}

// ===== 子コンポーネント: プライベート入力 =====

interface PrivateInputsProps {
  students: AppUser[];
  studentEnrollments: Enrollment[];
  selectedStudentId: string;
  setSelectedStudentId: (v: string) => void;
  selectedEnrollmentId: string;
  setSelectedEnrollmentId: (v: string) => void;
}

function PrivateInputs({
  students,
  studentEnrollments,
  selectedStudentId,
  setSelectedStudentId,
  selectedEnrollmentId,
  setSelectedEnrollmentId,
}: PrivateInputsProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          生徒
        </label>
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
        >
          <option value="">選択してください</option>
          {students
            .slice()
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName || s.email}
              </option>
            ))}
        </select>
      </div>

      {selectedStudentId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            使用する受講登録（チケット）
          </label>
          {studentEnrollments.length === 0 ? (
            <div className="text-sm text-red-600">
              この生徒には残数のあるアクティブな受講登録がありません。
            </div>
          ) : (
            <div className="space-y-2">
              {studentEnrollments.map((e) => {
                const lm = e.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
                const checked = selectedEnrollmentId === e.id;
                const validUntil = toDate(e.validUntil);
                return (
                  <label
                    key={e.id}
                    className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer min-h-[44px] ${
                      checked
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="enrollmentRadio"
                      checked={checked}
                      onChange={() => setSelectedEnrollmentId(e.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full">
                        {lm}分
                      </span>
                      <span className="text-sm text-gray-900">
                        残{e.remainingCount}回 / {e.registeredCount}回
                      </span>
                      <span className="text-xs text-gray-500">
                        期限: {validUntil.toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== 子コンポーネント: セミプライベート入力 =====

interface SemiPrivateInputsProps {
  groups: StudentGroup[];
  students: AppUser[];
  enrollmentsByStudent: Record<string, Enrollment[]>;
  selectedGroupId: string;
  setSelectedGroupId: (v: string) => void;
  lessonMinutesAvailability: {
    minutes: number;
    available: boolean;
    missingMemberIds: string[];
  }[];
  selectedLessonMinutes: number | null;
  setSelectedLessonMinutes: (v: number | null) => void;
}

function SemiPrivateInputs({
  groups,
  students,
  enrollmentsByStudent,
  selectedGroupId,
  setSelectedGroupId,
  lessonMinutesAvailability,
  selectedLessonMinutes,
  setSelectedLessonMinutes,
}: SemiPrivateInputsProps) {
  const studentMap = useMemo(() => {
    const m: Record<string, AppUser> = {};
    students.forEach((s) => {
      m[s.id] = s;
    });
    return m;
  }, [students]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) || null;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ペア
        </label>
        {groups.length === 0 ? (
          <div className="text-sm text-red-600">
            このスロットの講師に紐づく有効なペアがありません。先に「ペア管理」から作成してください。
          </div>
        ) : (
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
          >
            <option value="">選択してください</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}（{g.memberIds.length}名）
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedGroup && (
        <div className="border border-gray-100 bg-gray-50 rounded p-3 space-y-2">
          <p className="text-xs text-gray-500">メンバーと残チケット</p>
          <ul className="space-y-1">
            {selectedGroup.memberIds.map((mid) => {
              const list = enrollmentsByStudent[mid] || [];
              const u = studentMap[mid];
              return (
                <li key={mid} className="text-sm text-gray-800 flex flex-wrap items-center gap-1">
                  <span className="font-medium">
                    {u?.displayName || u?.email || mid}
                  </span>
                  <span className="text-xs text-gray-400">:</span>
                  {list.length === 0 ? (
                    <span className="text-xs text-red-600">アクティブな受講登録なし</span>
                  ) : (
                    list.map((e) => {
                      const lm = e.lessonMinutes ?? DEFAULT_LESSON_MINUTES;
                      return (
                        <span
                          key={e.id}
                          className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded-full"
                        >
                          {lm}分×残{e.remainingCount}
                        </span>
                      );
                    })
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedGroup && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            レッスン時間
          </label>
          <div className="grid grid-cols-3 gap-2">
            {lessonMinutesAvailability.map(({ minutes, available }) => {
              const checked = selectedLessonMinutes === minutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  disabled={!available}
                  onClick={() => available && setSelectedLessonMinutes(minutes)}
                  className={`py-2 px-2 text-sm rounded-[6px] min-h-[44px] border transition-colors ${
                    checked
                      ? 'bg-blue-600 text-white border-blue-600'
                      : available
                        ? 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                  title={
                    available
                      ? ''
                      : 'メンバーの中にこの時間用のチケットを持っていない方がいます'
                  }
                >
                  {minutes}分
                </button>
              );
            })}
          </div>
          {selectedLessonMinutes != null && (() => {
            const entry = lessonMinutesAvailability.find(
              (a) => a.minutes === selectedLessonMinutes,
            );
            if (!entry || entry.available) return null;
            const names = entry.missingMemberIds.map(
              (mid) => studentMap[mid]?.displayName || studentMap[mid]?.email || mid,
            );
            return (
              <p className="mt-2 text-xs text-red-600">
                以下のメンバーは {selectedLessonMinutes}分用のチケットを持っていません:{' '}
                {names.join(', ')}
              </p>
            );
          })()}
          <p className="mt-2 text-xs text-gray-500">
            ※ 選んだ時間に対応する受講登録（{selectedLessonMinutes ?? '◯'}分チケット）から、メンバー全員ぶんが同時に消費されます。
            該当チケットを持っていない方がいる場合は、先に「受講管理」から発行してください。
          </p>
        </div>
      )}
    </div>
  );
}
