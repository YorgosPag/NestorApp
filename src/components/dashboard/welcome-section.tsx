"use client";

import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

interface WelcomeSectionProps {
  activeToday: number;
}

export function WelcomeSection({ activeToday }: WelcomeSectionProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('dashboard');
  
  return (
    <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
      <div className="relative z-10">
        <h1 className="text-3xl font-bold mb-2">{t('welcome.title')}</h1>
        <p className="text-blue-100 mb-6 max-w-2xl">
          {t('welcome.subtitle', { count: activeToday })}
        </p>
        <div className="flex flex-wrap gap-4">
          <Button
            size="lg"
            variant="secondary"
            className={`bg-white text-blue-600 ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
          >
            <Plus className={`mr-2 ${iconSizes.md}`} />
            {t('welcome.actions.newContact')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className={`border-white text-white ${HOVER_BACKGROUND_EFFECTS.TRANSPARENT}`}
          >
            <Search className={`mr-2 ${iconSizes.md}`} />
            {t('welcome.actions.search')}
          </Button>
        </div>
      </div>
      <div className="absolute right-0 top-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute left-1/2 bottom-0 -mb-4 h-32 w-32 rounded-full bg-purple-400/20 blur-2xl" />
    </div>
  );
}
