'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { LayoutDashboard } from 'lucide-react';
import { PageLoadingState } from '@/core/states';

// Module-level auth cache (ADR-300 stale-while-revalidate pattern).
// DashboardHome is fully static — safe to render optimistically on re-navigation.
let _authKnown = false;
let _wasAuthenticated = false;

/**
 * Main Page — ADR-179: Hybrid Navigation Dashboard
 *
 * Authenticated users → Dashboard Home (SAP Fiori-style navigation tiles)
 * Unauthenticated users → Redirect to /login
 */
export default function MainPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      _authKnown = true;
      _wasAuthenticated = !!user;
    }
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // First visit: show loading until auth resolves.
  // Subsequent navigations: if user was authenticated before, render immediately
  // (stale-while-revalidate — DashboardHome is static, no user data needed).
  if (loading && !(_authKnown && _wasAuthenticated)) {
    return <PageLoadingState icon={LayoutDashboard} message="Φόρτωση..." layout="fullscreen" />;
  }

  if (!loading && !user) {
    return null;
  }

  return <DashboardHome />;
}