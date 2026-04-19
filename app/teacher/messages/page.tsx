'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { TeacherLayout } from '@/lib/components/TeacherLayout';
import { useAuth } from '@/lib/hooks/useAuth';
import { AppUser, Message, MessageThread, PrivateSlot, PrivateBooking } from '@/lib/types';
import {
  collection, getDocs, query, where, orderBy, Timestamp,
  doc, setDoc, addDoc, onSnapshot, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { toDate, formatDateJa, formatTime, formatDuration } from '@/lib/utils';
import {
  MessageSquare, Send, User, ArrowLeft, Search, X, Clock, CalendarDays, BookOpen,
} from 'lucide-react';

function getThreadId(uid1: string, uid2: string) {
  return [uid1, uid2].sort().join('_');
}

export default function TeacherMessagesPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<(MessageThread & { otherUser?: AppUser; lastMessage?: string })[]>([]);
  const [studentList, setStudentList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<AppUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const studentMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    studentList.forEach(s => { map[s.id] = s; });
    return map;
  }, [studentList]);

  const totalUnread = useMemo(() => Object.values(unreadCounts).reduce((a, b) => a + b, 0), [unreadCounts]);

  const loadData = useCallback(async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const [usersSnap, threadsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'student'))),
        getDocs(query(
          collection(db, 'threads'),
          where('participantIds', 'array-contains', user.uid),
        )),
      ]);

      const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      setStudentList(students);
      const sMap: Record<string, AppUser> = {};
      students.forEach(s => { sMap[s.id] = s; });

      const threadsList = await Promise.all(
        threadsSnap.docs.map(async d => {
          const data = { id: d.id, ...d.data() } as MessageThread;
          const otherId = data.participantIds.find(id => id !== user.uid);
          const otherUser = otherId ? sMap[otherId] : undefined;

          const msgsSnap = await getDocs(query(
            collection(db, 'threads', d.id, 'messages'),
            orderBy('createdAt', 'desc'),
          ));

          const lastMsg = msgsSnap.docs[0]?.data();
          const unread = msgsSnap.docs.filter(m => {
            const msg = m.data();
            return msg.senderId !== user.uid && !(msg.readBy || []).includes(user.uid);
          }).length;

          return {
            ...data,
            otherUser,
            lastMessage: lastMsg?.text || '',
            unread,
          };
        })
      );

      const uc: Record<string, number> = {};
      threadsList.forEach(t => { if (t.unread > 0) uc[t.id] = t.unread; });
      setUnreadCounts(uc);

      threadsList.sort((a, b) => {
        const aTime = a.lastMessageAt ? toDate(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? toDate(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      setThreads(threadsList);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleSelectThread = (thread: typeof threads[0]) => {
    setSelectedThreadId(thread.id);
    setSelectedStudent(thread.otherUser || null);
    setShowNewChat(false);
  };

  const handleStartNewChat = async (student: AppUser) => {
    if (!user || !db) return;
    const threadId = getThreadId(user.uid, student.id);

    const existing = threads.find(t => t.id === threadId);
    if (existing) {
      handleSelectThread(existing);
      return;
    }

    try {
      await setDoc(doc(db, 'threads', threadId), {
        participantIds: [user.uid, student.id],
        participantRoles: ['teacher', 'student'],
        lastMessageAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error creating thread:', error);
    }

    setSelectedThreadId(threadId);
    setSelectedStudent(student);
    setShowNewChat(false);
    loadData();
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return studentList;
    const q = searchQuery.toLowerCase();
    return studentList.filter(s =>
      (s.displayName?.toLowerCase() || '').includes(q) ||
      (s.email?.toLowerCase() || '').includes(q)
    );
  }, [studentList, searchQuery]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter(t =>
      (t.otherUser?.displayName?.toLowerCase() || '').includes(q) ||
      (t.otherUser?.email?.toLowerCase() || '').includes(q)
    );
  }, [threads, searchQuery]);

  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <TeacherLayout unreadCount={totalUnread}>
        <div className="h-[calc(100vh-73px-48px)] flex">
          {/* スレッドリスト */}
          <div className={`w-80 border-r border-gray-200 bg-white flex flex-col ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">メッセージ</h2>
                <button
                  onClick={() => setShowNewChat(!showNewChat)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="新しいチャット"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="生徒名で検索"
                  className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-[6px] text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {showNewChat ? (
                <div>
                  <p className="px-4 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">生徒を選択してチャットを開始</p>
                  {filteredStudents.map(student => (
                    <button
                      key={student.id}
                      onClick={() => handleStartNewChat(student)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{student.displayName || '名前未設定'}</p>
                        <p className="text-xs text-gray-500 truncate">{student.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <MessageSquare className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">メッセージはありません</p>
                  <button onClick={() => setShowNewChat(true)} className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                    新しいチャットを開始
                  </button>
                </div>
              ) : (
                filteredThreads.map(thread => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 ${
                      selectedThreadId === thread.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="relative w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-500" />
                      {(unreadCounts[thread.id] || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {unreadCounts[thread.id]}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {thread.otherUser?.displayName || '不明'}
                        </p>
                        {thread.lastMessageAt && (
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            {formatTime(toDate(thread.lastMessageAt))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{thread.lastMessage || 'メッセージなし'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* チャットエリア */}
          <div className={`flex-1 flex flex-col bg-white ${!selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
            {selectedThreadId && selectedStudent ? (
              <ChatArea
                threadId={selectedThreadId}
                student={selectedStudent}
                currentUserId={user?.uid || ''}
                teacherId={user?.uid || ''}
                onBack={() => { setSelectedThreadId(null); setSelectedStudent(null); }}
                onMessageSent={loadData}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare className="w-16 h-16 mb-4 text-gray-200" />
                <p className="text-lg">チャットを選択してください</p>
                <p className="text-sm mt-1">左側のリストから生徒を選択</p>
              </div>
            )}
          </div>
        </div>
      </TeacherLayout>
    </ProtectedRoute>
  );
}

/* ==================== チャットエリア ==================== */

interface LessonRef {
  bookingId: string;
  slotId: string;
  title: string | null;
  date: string;
  time: string;
  duration: number;
}

interface ChatAreaProps {
  threadId: string;
  student: AppUser;
  currentUserId: string;
  teacherId: string;
  onBack: () => void;
  onMessageSent: () => void;
}

function ChatArea({ threadId, student, currentUserId, teacherId, onBack, onMessageSent }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lessons, setLessons] = useState<LessonRef[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonRef | null>(null);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lessonMap = useMemo(() => {
    const map: Record<string, LessonRef> = {};
    lessons.forEach(l => { map[l.bookingId] = l; });
    return map;
  }, [lessons]);

  useEffect(() => {
    if (!db || !teacherId || !student.id) return;
    const loadLessons = async () => {
      try {
        const [bookingsSnap, slotsSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'privateBookings'),
            where('teacherId', '==', teacherId),
            where('studentId', '==', student.id),
          )),
          getDocs(query(
            collection(db, 'privateSlots'),
            where('teacherId', '==', teacherId),
          )),
        ]);
        const slotMap: Record<string, PrivateSlot> = {};
        slotsSnap.docs.forEach(d => { const s = { id: d.id, ...d.data() } as PrivateSlot; slotMap[s.id] = s; });

        const refs: LessonRef[] = bookingsSnap.docs
          .map(d => {
            const b = { id: d.id, ...d.data() } as PrivateBooking;
            const slot = slotMap[b.slotId];
            if (!slot) return null;
            const start = toDate(slot.startAt);
            const end = toDate(slot.endAt);
            const dur = Math.round((end.getTime() - start.getTime()) / 60000);
            return {
              bookingId: b.id,
              slotId: slot.id,
              title: slot.title || null,
              date: formatDateJa(start),
              time: formatTime(start),
              duration: dur,
            };
          })
          .filter(Boolean) as LessonRef[];

        refs.sort((a, b) => {
          const da = new Date(a.date).getTime();
          const db2 = new Date(b.date).getTime();
          return db2 - da;
        });
        setLessons(refs);
      } catch (error) {
        console.error('Error loading lessons:', error);
      }
    };
    loadLessons();
  }, [teacherId, student.id]);

  useEffect(() => {
    if (!db || !threadId) return;
    const q = query(
      collection(db, 'threads', threadId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsubscribe = onSnapshot(q, snapshot => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);

      snapshot.docs.forEach(d => {
        const msg = d.data();
        if (msg.senderId !== currentUserId && !(msg.readBy || []).includes(currentUserId)) {
          updateDoc(doc(db!, 'threads', threadId, 'messages', d.id), {
            readBy: arrayUnion(currentUserId),
          }).catch(() => {});
        }
      });
    });
    return () => unsubscribe();
  }, [threadId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!db || !newMessage.trim() || sending) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');
    const lessonRef = selectedLesson;
    setSelectedLesson(null);

    try {
      await addDoc(collection(db, 'threads', threadId, 'messages'), {
        senderId: currentUserId,
        text,
        attachmentPath: null,
        relatedBookingId: lessonRef?.bookingId || null,
        relatedSlotId: lessonRef?.slotId || null,
        createdAt: Timestamp.now(),
        readBy: [currentUserId],
      });
      await updateDoc(doc(db, 'threads', threadId), {
        lastMessageAt: Timestamp.now(),
      });
      onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(text);
      setSelectedLesson(lessonRef);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach(msg => {
      const dateStr = formatDateJa(toDate(msg.createdAt));
      const last = groups[groups.length - 1];
      if (last && last.date === dateStr) {
        last.msgs.push(msg);
      } else {
        groups.push({ date: dateStr, msgs: [msg] });
      }
    });
    return groups;
  }, [messages]);

  const renderLessonCard = (bookingId: string, isOwn: boolean) => {
    const lesson = lessonMap[bookingId];
    if (!lesson) return null;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1 text-xs ${
        isOwn ? 'bg-blue-500/30 text-blue-100' : 'bg-blue-50 text-blue-700 border border-blue-200'
      }`}>
        <BookOpen className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">
          {lesson.title ? `${lesson.title} — ` : ''}{lesson.date} {lesson.time}
        </span>
      </div>
    );
  };

  return (
    <>
      {/* チャットヘッダー */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <button onClick={onBack} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded min-w-[44px] min-h-[44px] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{student.displayName || '名前未設定'}</p>
          <p className="text-xs text-gray-500">{student.email}</p>
        </div>
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-12 h-12 mb-2 text-gray-200" />
            <p className="text-sm">メッセージを送信して会話を始めましょう</p>
          </div>
        )}
        {groupedMessages.map((group, gi) => (
          <div key={gi}>
            <div className="flex justify-center my-3">
              <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">{group.date}</span>
            </div>
            {group.msgs.map(msg => {
              const isOwn = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2 text-sm ${
                    isOwn
                      ? 'bg-blue-600 text-white rounded-t-2xl rounded-bl-2xl'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-t-2xl rounded-br-2xl'
                  }`}>
                    {msg.relatedBookingId && renderLessonCard(msg.relatedBookingId, isOwn)}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                      {formatTime(toDate(msg.createdAt))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 授業ピッカー */}
      {showLessonPicker && lessons.length > 0 && (
        <div className="border-t border-gray-200 bg-white px-3 py-2 max-h-40 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 font-medium">授業を選択してメッセージに紐づけ</p>
          <div className="space-y-1">
            {lessons.map(lesson => (
              <button
                key={lesson.bookingId}
                onClick={() => { setSelectedLesson(lesson); setShowLessonPicker(false); }}
                className="w-full text-left px-3 py-2 text-sm rounded-[6px] hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="text-gray-900">
                  {lesson.title ? <span className="font-medium">{lesson.title}</span> : null}
                  {lesson.title ? ' — ' : ''}
                  {lesson.date} {lesson.time}（{formatDuration(lesson.duration)}）
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 選択中の授業タグ */}
      {selectedLesson && (
        <div className="px-3 pt-2 bg-white">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
            <BookOpen className="w-3 h-3" />
            <span>{selectedLesson.title ? `${selectedLesson.title} — ` : ''}{selectedLesson.date} {selectedLesson.time}</span>
            <button onClick={() => setSelectedLesson(null)} className="ml-1 text-blue-400 hover:text-blue-600">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* メッセージ入力 */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowLessonPicker(!showLessonPicker)}
            className={`p-3 rounded-[6px] transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ${
              showLessonPicker || selectedLesson
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="授業を紐づけ"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力..."
            rows={1}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-[6px] text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );
}
