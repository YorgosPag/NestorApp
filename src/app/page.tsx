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
      return;
    }
    // ADR-660: αυθεντικοποιημένος χρήστης χωρίς tenant (εκκρεμεί έγκριση admin)
    // → οθόνη «εκκρεμεί έγκριση» αντί για σπασμένο dashboard (fail-closed κόβει
    // ούτως ή άλλως κάθε data call).
    if (!loading && user && !user.companyId) {
      router.replace('/pending-approval');
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

  // Χρήστης χωρίς tenant → redirect σε /pending-approval (μην κάνεις flash το dashboard).
  if (!loading && user && !user.companyId) {
    return null;
  }

  return <DashboardHome />;
}