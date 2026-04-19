'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseCompanyBrand } from './types';

const FALLBACK_LOGO_URL = '/images/pagonis-energo-logo.png';

interface ShowcaseHeaderProps {
  company: ShowcaseCompanyBrand;
}

export function ShowcaseHeader({ company }: ShowcaseHeaderProps) {
  const { t } = useTranslation('showcase');
  const logoSrc = company.logoUrl && company.logoUrl.trim().length > 0
    ? company.logoUrl
    : FALLBACK_LOGO_URL;
  return (
    <header className="bg-[hsl(var(--showcase-surface))] text-[hsl(var(--showcase-fg))] px-6 py-5 rounded-xl shadow-md border border-[hsl(var(--showcase-border))] flex items-center gap-4">
      <img
        src={logoSrc}
        alt={company.name}
        width={72}
        height={72}
        className="h-16 w-16 rounded-lg object-contain bg-white/95 p-1 shadow-sm"
      />
      <div className="min-w-0">
        <h1 className="text-xl font-bold leading-tight truncate">{company.name}</h1>
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">{t('header.subtitle')}</p>
      </div>
    </header>
  );
}
