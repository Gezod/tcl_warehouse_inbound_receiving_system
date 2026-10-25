'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Boxes,
  History,
  Users,
  LogOut,
  Menu,
  X,
  Warehouse,
} from 'lucide-react';
import { CurrentUser } from '@/src/types/domain';
import { apiClient, ApiClientError } from '@/src/lib/api-client';
import { cn } from '@/src/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  supervisorOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Receiving Documents', href: '/receiving-documents', icon: ClipboardList },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Inventory', href: '/inventory', icon: Boxes },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'Users', href: '/users', icon: Users, supervisorOnly: true },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get<CurrentUser>('/auth/me')
      .then((user) => {
        if (mounted) {
          setCurrentUser(user);
          setIsLoadingUser(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsLoadingUser(false);
          if (err instanceof ApiClientError && err.statusCode === 401) {
            router.push('/login');
          }
        }
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.supervisorOnly) {
      return currentUser?.role === 'SUPERVISOR';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-16 bg-white border-b border-border z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-button bg-primary text-white shadow-sm">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-primary block leading-none">
              Warehouse
            </span>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted block leading-none mt-1">
              Receiving System
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-button text-secondary hover:text-primary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 w-72 bg-white border-r border-border z-50 transform transition-transform duration-200 ease-in-out flex flex-col justify-between',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-button bg-primary text-white shadow-sm">
              <Warehouse className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-primary">Warehouse Receiving</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-button text-secondary hover:text-primary hover:bg-surface-hover"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-secondary')} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Mobile User Profile Footer */}
        <div className="p-3 border-t border-border bg-surface">
          {currentUser ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-primary truncate">{currentUser.fullName}</p>
                  <p className="text-xs text-muted truncate">@{currentUser.username}</p>
                </div>
                <span
                  className={cn(
                    'rounded-pill px-2 py-0.5 text-[11px] font-medium border uppercase tracking-wider shrink-0',
                    currentUser.role === 'SUPERVISOR'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  )}
                >
                  {currentUser.role === 'SUPERVISOR' ? 'Supervisor' : 'Operator'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 rounded-button border border-border bg-white px-3 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
              </button>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center text-xs text-muted">
              Loading session...
            </div>
          )}
        </div>
      </div>

      {/* Desktop Fixed Sidebar (260px wide) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-border flex-col justify-between z-30">
        <div>
          {/* Brand Wordmark Header */}
          <div className="h-16 px-5 border-b border-border flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-button bg-primary text-white shadow-sm">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-primary block leading-none">
                Warehouse
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted block leading-none mt-1">
                Receiving System
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="p-3 space-y-1">
            {visibleNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-secondary')} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Desktop User Profile Card */}
        <div className="p-4 border-t border-border bg-surface">
          {currentUser ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-primary truncate" title={currentUser.fullName}>
                    {currentUser.fullName}
                  </p>
                  <p className="text-xs text-muted truncate">@{currentUser.username}</p>
                </div>
                <span
                  className={cn(
                    'rounded-pill px-2 py-0.5 text-[11px] font-medium border uppercase tracking-wider shrink-0',
                    currentUser.role === 'SUPERVISOR'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  )}
                >
                  {currentUser.role === 'SUPERVISOR' ? 'Supervisor' : 'Operator'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 rounded-button border border-border bg-white px-3 py-2 text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{isLoggingOut ? 'Signing out...' : 'Sign out'}</span>
              </button>
            </div>
          ) : (
            <div className="h-16 flex items-center justify-center text-xs text-muted">
              {isLoadingUser ? 'Loading session...' : 'Not authenticated'}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
