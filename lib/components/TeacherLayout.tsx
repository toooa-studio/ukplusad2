'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTeacherLocale } from '@/lib/hooks/useTeacherLocale';
import { ReactNode } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  MessageSquare,
  LogOut,
  Languages,
} from 'lucide-react';

interface SidebarLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

function SidebarLink({ href, icon, label, badge }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center space-x-3">
        <span className="w-5 h-5 flex-shrink-0">{icon}</span>
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}

interface TeacherLayoutProps {
  children: ReactNode;
  unreadCount?: number;
}

export function TeacherLayout({ children, unreadCount }: TeacherLayoutProps) {
  const { user, signOut } = useAuth();
  const { locale, setLocale, t } = useTeacherLocale();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap tracking-wide">UKPLUS Teacher</h1>
          <div className="flex items-center flex-wrap justify-end gap-2 sm:gap-4">
            <div
              className="inline-flex items-center rounded-[6px] border border-gray-200 overflow-hidden"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLocale('ja')}
                className={`inline-flex items-center gap-1 px-3 py-2 text-sm min-h-[44px] transition-colors ${
                  locale === 'ja'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Languages className="w-4 h-4" />
                {t('layout.lang.ja')}
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`inline-flex items-center gap-1 px-3 py-2 text-sm min-h-[44px] transition-colors border-l border-gray-200 ${
                  locale === 'en'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('layout.lang.en')}
              </button>
            </div>
            <span className="text-sm text-gray-600 hidden sm:inline">{user?.displayName || user?.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              {t('layout.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] p-4">
          <nav className="space-y-2">
            <SidebarLink href="/teacher" icon={<LayoutDashboard className="w-5 h-5" />} label={t('layout.nav.dashboard')} />
            <SidebarLink href="/teacher/schedule" icon={<CalendarDays className="w-5 h-5" />} label={t('layout.nav.schedule')} />
            <SidebarLink href="/teacher/messages" icon={<MessageSquare className="w-5 h-5" />} label={t('layout.nav.messages')} badge={unreadCount} />
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
