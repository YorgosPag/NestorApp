'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import { DashboardHome } from '@/components/dashboard/DashboardHome';
import { Loader2 } from 'lucide-react';

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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <DashboardHome />;
}