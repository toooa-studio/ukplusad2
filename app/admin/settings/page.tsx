'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/lib/components/ProtectedRoute';
import { AdminLayout } from '@/lib/components/AdminLayout';
import { AppSettings } from '@/lib/types';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { BOOKING_DURATION_STEP_MINUTES } from '@/lib/utils';

const SETTINGS_DOC = 'general';

const defaultSettings: Omit<AppSettings, 'updatedAt'> = {
  privateLessonDurationMinutes: 60,
  breakBufferMinutesDefault: 10,
  rescheduleDeadlineHours: 24,
  bookingCutoff: {
    mode: 'global_hours_before',
    globalDaysBefore: null,
    globalHoursBefore: 24,
    minLeadTimeHours: 2,
  },
  weekStartsOn: 'monday',
  email: {
    provider: 'sendgrid',
    fromName: 'UKPLUS',
    fromEmail: 'noreply@ukplus.com',
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          privateLessonDurationMinutes: data.privateLessonDurationMinutes ?? defaultSettings.privateLessonDurationMinutes,
          breakBufferMinutesDefault: data.breakBufferMinutesDefault ?? defaultSettings.breakBufferMinutesDefault,
          rescheduleDeadlineHours: data.rescheduleDeadlineHours ?? defaultSettings.rescheduleDeadlineHours,
          bookingCutoff: {
            mode: data.bookingCutoff?.mode ?? defaultSettings.bookingCutoff.mode,
            globalDaysBefore: data.bookingCutoff?.globalDaysBefore ?? null,
            globalHoursBefore: data.bookingCutoff?.globalHoursBefore ?? 24,
            minLeadTimeHours: data.bookingCutoff?.minLeadTimeHours ?? 2,
          },
          weekStartsOn: data.weekStartsOn ?? defaultSettings.weekStartsOn,
          email: {
            provider: data.email?.provider ?? defaultSettings.email.provider,
            fromName: data.email?.fromName ?? defaultSettings.email.fromName,
            fromEmail: data.email?.fromEmail ?? defaultSettings.email.fromEmail,
          },
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'settings', SETTINGS_DOC), {
        ...settings,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      setMessage({ type: 'success', text: '設定を保存しました' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
      const err = error as { code?: string; message?: string };
      setMessage({ type: 'error', text: `保存に失敗しました: ${err.code || err.message || '不明なエラー'}` });
    } finally {
      setSaving(false);
    }
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
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">設定</h2>
              <p className="mt-1 text-sm text-gray-600">システム全体の設定を管理</p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>

          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-[6px] text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {/* レッスン設定 */}
          <Section title="レッスン設定">
            <Field label="デフォルトのレッスン時間（分）">
              <select
                value={settings.privateLessonDurationMinutes}
                onChange={e => setSettings(prev => ({ ...prev, privateLessonDurationMinutes: Number(e.target.value) }))}
                className="input-field"
              >
                {[30, 60, 90, 120, 150, 180].map(m => (
                  <option key={m} value={m}>{m}分</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                予約時間は {BOOKING_DURATION_STEP_MINUTES} 分単位で設定されます。
              </p>
            </Field>
            <Field label="授業準備時間・休憩バッファ（分）">
              <input
                type="number"
                min={0}
                max={60}
                value={settings.breakBufferMinutesDefault}
                onChange={e => setSettings(prev => ({ ...prev, breakBufferMinutesDefault: Number(e.target.value) }))}
                className="input-field"
              />
              <p className="mt-1 text-xs text-gray-500">
                生徒が予約した際、授業後に自動的にこの時間分の空白が確保されます。残りの空き枠は空白の後に再設定されます。
              </p>
            </Field>
            <Field label="週の開始曜日">
              <select
                value={settings.weekStartsOn}
                onChange={e => setSettings(prev => ({ ...prev, weekStartsOn: e.target.value }))}
                className="input-field"
              >
                <option value="monday">月曜日</option>
                <option value="sunday">日曜日</option>
              </select>
            </Field>
          </Section>

          {/* 下部保存ボタン */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-[6px] hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>

        <style jsx>{`
          :global(.input-field) {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 0.875rem;
            color: #111827;
            min-height: 44px;
          }
          :global(.input-field:focus) {
            outline: none;
            ring: 2px;
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
          }
        `}</style>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="px-6 py-4 space-y-5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
