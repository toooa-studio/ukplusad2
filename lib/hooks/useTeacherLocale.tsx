'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  formatDateEn,
  formatDateJa,
  formatDurationEn,
  formatDuration as formatDurationJa,
  formatMonthEn,
  getDayName,
  getDayNameEn,
  toDate,
} from '@/lib/utils';
import {
  TEACHER_LOCALE_STORAGE_KEY,
  TEACHER_WEEKDAYS,
  translations,
  type TeacherLocale,
  type TranslationKey,
} from '@/lib/teacher/i18n/translations';

interface TeacherLocaleContextValue {
  locale: TeacherLocale;
  setLocale: (locale: TeacherLocale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string) => string;
  formatDuration: (minutes: number) => string;
  formatMonth: (date: Date) => string;
  getDayNameLocalized: (date: Date) => string;
  weekDays: string[];
}

const TeacherLocaleContext = createContext<TeacherLocaleContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

export function TeacherLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<TeacherLocale>('en');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TEACHER_LOCALE_STORAGE_KEY);
      if (stored === 'ja' || stored === 'en') {
        setLocaleState(stored);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: TeacherLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(TEACHER_LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'ja' ? 'en' : 'ja');
  }, [locale, setLocale]);

  const value = useMemo<TeacherLocaleContextValue>(() => {
    const t = (key: TranslationKey, params?: Record<string, string | number>) =>
      interpolate(translations[locale][key], params);

    return {
      locale,
      setLocale,
      toggleLocale,
      t,
      formatDate: (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return locale === 'ja' ? formatDateJa(d) : formatDateEn(d);
      },
      formatDuration: (minutes: number) =>
        locale === 'ja' ? formatDurationJa(minutes) : formatDurationEn(minutes),
      formatMonth: (date: Date) =>
        locale === 'ja'
          ? `${date.getFullYear()}年${date.getMonth() + 1}月`
          : formatMonthEn(date),
      getDayNameLocalized: (date: Date) =>
        locale === 'ja' ? getDayName(date) : getDayNameEn(date),
      weekDays: TEACHER_WEEKDAYS[locale],
    };
  }, [locale, setLocale, toggleLocale]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <TeacherLocaleContext.Provider value={value}>
      {children}
    </TeacherLocaleContext.Provider>
  );
}

export function useTeacherLocale(): TeacherLocaleContextValue {
  const ctx = useContext(TeacherLocaleContext);
  if (!ctx) {
    throw new Error('useTeacherLocale must be used within TeacherLocaleProvider');
  }
  return ctx;
}

/** For shared components (e.g. color strip) used outside teacher layout */
export function useTeacherLocaleOptional(): TeacherLocaleContextValue | null {
  return useContext(TeacherLocaleContext);
}

export { toDate };
