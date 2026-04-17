'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseCompanyBrand } from './types';

interface ShowcaseHeaderProps {
  company: ShowcaseCompanyBrand;
}

export function ShowcaseHeader({ company }: ShowcaseHeaderProps) {
  const { t } = useTranslation('showcase');
  return (
    <header className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white px-6 py-6 rounded-xl shadow-md">
      <div className="flex items-center gap-3">
        <Share2 className="h-7 w-7" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold leading-tight">{company.name}</h1>
          <p className="text-sm opacity-90">{t('header.subtitle')}</p>
        </div>
      </div>
    </header>
  );
}
