'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { LayoutDashboard } from 'lucide-react';
import { PageLoadingState } from '@/core/states';

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
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // ADR-229 Phase 2: Data-level loading guard
  if (loading) {
    return <PageLoadingState icon={LayoutDashboard} message="Φόρτωση..." layout="fullscreen" />;
  }

  if (!user) {
    return null;
  }

  return <DashboardHome />;
}