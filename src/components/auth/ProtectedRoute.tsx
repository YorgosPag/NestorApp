'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const iconSizes = useIconSizes();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className={`${iconSizes.lg} animate-spin text-muted-foreground`} />
            <p className="text-muted-foreground">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
