'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { LayoutDashboard } from 'lucide-react';
import { PageLoadingState } from '@/core/states';
import { createStaleCache } from '@/lib/stale-cache';

// SSoT stale-while-revalidate cache (ADR-300) — stores auth-known state.
// DashboardHome is fully static — safe to render optimistically on re-navigation.
const authCache = createStaleCache<boolean>('dashboard-auth');

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
      authCache.set(!!user);
    }
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // First visit: show loading until auth resolves.
  // Subsequent navigations: cache hit → render immediately (ADR-300).
  if (loading && !(authCache.hasLoaded() && authCache.get() === true)) {
    return <PageLoadingState icon={LayoutDashboard} message="Φόρτωση..." layout="fullscreen" />;
  }

  if (!loading && !user) {
    return null;
  }

  return <DashboardHome />;
}