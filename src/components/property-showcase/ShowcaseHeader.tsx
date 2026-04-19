'use client';

import React from 'react';
import {
  MapPin, Phone, Mail, Globe,
  Facebook, Instagram, Linkedin, Twitter, Youtube, Github, Link as LinkIcon,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  ShowcaseCompanyBrand,
  ShowcaseSocialPlatform,
  ShowcaseContactSocial,
} from './types';
import { EmailProviderPicker } from './EmailProviderPicker';

const FALLBACK_LOGO_URL = '/images/pagonis-energo-logo.png';

interface ShowcaseHeaderProps {
  company: ShowcaseCompanyBrand;
}

const SOCIAL_ICONS: Record<ShowcaseSocialPlatform, React.ComponentType<{ className?: string }>> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
  github: Github,
  other: LinkIcon,
};

function buildPhoneHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length > 0 ? `tel:${digits}` : '#';
}

function SocialIcon({ item }: { item: ShowcaseContactSocial }) {
  const Icon = SOCIAL_ICONS[item.platform] ?? LinkIcon;
  const label = item.label ?? item.platform;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--showcase-surface-elevated,var(--showcase-surface)))]/60 text-[hsl(var(--showcase-fg))] ring-1 ring-[hsl(var(--showcase-border))] hover:bg-[hsl(var(--showcase-border))] transition-colors"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

export function ShowcaseHeader({ company }: ShowcaseHeaderProps) {
  const { t } = useTranslation('showcase');
  const logoSrc = company.logoUrl && company.logoUrl.trim().length > 0
    ? company.logoUrl
    : FALLBACK_LOGO_URL;

  const addresses = company.addresses ?? [];
  const phones = company.phones ?? (company.phone ? [{ value: company.phone }] : []);
  const emails = company.emails ?? (company.email ? [{ value: company.email }] : []);
  const websites = company.websites ?? (company.website ? [{ url: company.website }] : []);
  const socials = company.socialMedia ?? [];

  const hasContacts =
    addresses.length > 0
    || phones.length > 0
    || emails.length > 0
    || websites.length > 0
    || socials.length > 0;

  return (
    <header className="bg-[hsl(var(--showcase-surface))] text-[hsl(var(--showcase-fg))] px-6 py-5 rounded-xl shadow-md border border-[hsl(var(--showcase-border))] grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
      <img
        src={logoSrc}
        alt={company.name}
        width={96}
        height={96}
        className="h-20 w-20 md:h-24 md:w-24 mx-auto md:mx-0 rounded-lg object-contain bg-white/95 p-1 shadow-sm"
      />
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-bold leading-tight text-center md:text-left">{company.name}</h1>
        <p className="text-sm text-[hsl(var(--showcase-muted-fg))] text-center md:text-left">
          {t('header.subtitle')}
        </p>

        {hasContacts && (
          <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {addresses.length > 0 && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--showcase-muted-fg))]" aria-hidden />
                <dt className="sr-only">{t('header.contacts.addressLabel')}</dt>
                <dd className="min-w-0">
                  {addresses.map((line) => (
                    <p key={line} className="leading-snug">{line}</p>
                  ))}
                </dd>
              </div>
            )}
            {phones.length > 0 && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--showcase-muted-fg))]" aria-hidden />
                <dt className="sr-only">{t('header.contacts.phoneLabel')}</dt>
                <dd className="min-w-0">
                  {phones.map((p) => (
                    <p key={p.value} className="leading-snug">
                      <a href={buildPhoneHref(p.value)} className="hover:underline">{p.value}</a>
                      {p.label ? <span className="text-[hsl(var(--showcase-muted-fg))]"> · {p.label}</span> : null}
                    </p>
                  ))}
                </dd>
              </div>
            )}
            {emails.length > 0 && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--showcase-muted-fg))]" aria-hidden />
                <dt className="sr-only">{t('header.contacts.emailLabel')}</dt>
                <dd className="min-w-0">
                  {emails.map((e) => (
                    <p key={e.value} className="leading-snug truncate">
                      <EmailProviderPicker address={e.value} />
                    </p>
                  ))}
                </dd>
              </div>
            )}
            {websites.length > 0 && (
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--showcase-muted-fg))]" aria-hidden />
                <dt className="sr-only">{t('header.contacts.websiteLabel')}</dt>
                <dd className="min-w-0">
                  {websites.map((w) => (
                    <p key={w.url} className="leading-snug truncate">
                      <a href={w.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {w.label ?? w.url.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                  ))}
                </dd>
              </div>
            )}
            {socials.length > 0 && (
              <div className="flex items-start gap-2 md:col-span-2">
                <dt className="sr-only">{t('header.contacts.socialLabel')}</dt>
                <dd className="flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <SocialIcon key={`${s.platform}-${s.url}`} item={s} />
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </header>
  );
}
