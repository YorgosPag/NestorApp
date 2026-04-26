'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import type { OnboardingState } from '@/services/onboarding/onboarding-types';
import { isBannerEligible } from '@/services/onboarding/onboarding-types';

const DISMISS_KEY = 'onboarding-banner-dismissed';

interface OnboardingApiResponse {
  state: OnboardingState | null;
}

export function OnboardingBanner() {
  const router = useRouter();
  const { t } = useTranslation('onboarding');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;

    fetch('/api/onboarding/organization')
      .then((res) => res.json() as Promise<OnboardingApiResponse>)
      .then(({ state }) => {
        if (!cancelled && isBannerEligible(state)) setVisible(true);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">{t('onboarding.banner.title')}</p>
        <p className="mt-0.5 text-xs opacity-80">{t('onboarding.banner.description')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
          onClick={() => router.push('/onboarding/organization')}
        >
          {t('onboarding.banner.cta')}
        </Button>
        <button
          type="button"
          aria-label={t('onboarding.banner.dismiss')}
          onClick={dismiss}
          className="text-amber-600 hover:text-amber-900 dark:text-amber-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
