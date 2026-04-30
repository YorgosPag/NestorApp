'use client';

import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface OfflineBannerProps {
  isConnected: boolean;
}

type BannerState = 'hidden' | 'offline' | 'recovered';

export function OfflineBanner({ isConnected }: OfflineBannerProps) {
  const { t } = useTranslation('quotes');
  const [state, setState] = useState<BannerState>('hidden');
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevConnected = useRef(isConnected);

  useEffect(() => {
    const wasConnected = prevConnected.current;
    prevConnected.current = isConnected;

    if (!isConnected) {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
      setState('offline');
    } else if (!wasConnected && isConnected) {
      setState('recovered');
      recoveryTimer.current = setTimeout(() => setState('hidden'), 3000);
    }

    return () => {
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    };
  }, [isConnected]);

  if (state === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        state === 'offline'
          ? 'bg-yellow-50 text-yellow-900 border border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-200 dark:border-yellow-800'
          : 'bg-green-50 text-green-900 border border-green-200 dark:bg-green-950/20 dark:text-green-200 dark:border-green-800',
      )}
    >
      {state === 'offline' ? (
        <>
          <WifiOff className="size-4 shrink-0 animate-pulse" />
          <span>{t('rfqs.offline.banner')}</span>
        </>
      ) : (
        <>
          <Wifi className="size-4 shrink-0" />
          <span>{t('rfqs.offline.recovered')}</span>
        </>
      )}
    </div>
  );
}
