'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { ReactNode } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Users,
  BookOpen,
  Megaphone,
  Ticket,
  Settings,
  LogOut,
} from 'lucide-react';

interface SidebarLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
}

function SidebarLink({ href, icon, label }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 font-medium'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">UKPLUS Admin</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)] p-4">
          <nav className="space-y-2">
            <SidebarLink href="/admin" icon={<LayoutDashboard className="w-5 h-5" />} label="ダッシュボード" />
            <SidebarLink href="/admin/calendar" icon={<CalendarDays className="w-5 h-5" />} label="予約カレンダー" />
            <SidebarLink href="/admin/students" icon={<GraduationCap className="w-5 h-5" />} label="生徒管理" />
            <SidebarLink href="/admin/teachers" icon={<Users className="w-5 h-5" />} label="教師管理" />
            <SidebarLink href="/admin/sessions" icon={<BookOpen className="w-5 h-5" />} label="授業管理" />
            <SidebarLink href="/admin/announcements" icon={<Megaphone className="w-5 h-5" />} label="お知らせ" />
            <SidebarLink href="/admin/enrollments" icon={<Ticket className="w-5 h-5" />} label="受講管理" />
            <SidebarLink href="/admin/settings" icon={<Settings className="w-5 h-5" />} label="設定" />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
