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
          ? 'bg-[hsl(var(--bg-warning))]/40 text-foreground border border-[hsl(var(--bg-warning))]/60'
          : 'bg-[hsl(var(--bg-success))]/40 text-[hsl(var(--text-success))] border border-[hsl(var(--bg-success))]/60',
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
