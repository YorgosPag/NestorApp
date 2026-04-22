'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function MessageScreen({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--showcase-bg))] px-4">
      <div className="bg-[hsl(var(--showcase-surface))] rounded-xl shadow-sm p-8 max-w-md text-center border border-[hsl(var(--showcase-border))]">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-xl font-bold text-[hsl(var(--showcase-fg))] mb-2">{title}</h1>
        <p className="text-[hsl(var(--showcase-muted-fg))]">{description}</p>
      </div>
    </div>
  );
}

export function ShowcaseFooter({
  company,
}: { company: { name: string; phone?: string; email?: string; website?: string } }) {
  const { t } = useTranslation('showcase');
  const contact = [company.phone, company.email, company.website].filter(Boolean).join(' · ');
  const year = new Date().getFullYear();
  return (
    <footer className="mt-6 pt-5 border-t border-[hsl(var(--showcase-border))] text-center space-y-3">
      {contact && (
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))]">
          {company.name} · {contact}
        </p>
      )}
      <div className="flex items-center justify-center gap-2 text-xs text-[hsl(var(--showcase-muted-fg))]">
        <img
          src="/images/nestor-app-logo.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded bg-white/90 object-contain p-0.5"
          aria-hidden="true"
        />
        <span className="font-semibold">{t('brand.poweredBy')}</span>
      </div>
      <p className="text-[10px] text-[hsl(var(--showcase-muted-fg))]/70">
        &copy; {year} {t('brand.appName')}
      </p>
    </footer>
  );
}
