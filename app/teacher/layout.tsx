'use client';

import { TeacherLocaleProvider } from '@/lib/hooks/useTeacherLocale';

export default function TeacherLayoutRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TeacherLocaleProvider>{children}</TeacherLocaleProvider>;
}
