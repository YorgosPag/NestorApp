'use client';

/**
 * @fileoverview **Η ταυτότητα μιας συσκευής στη λίστα** — εικονίδιο, «Chrome σε Windows», θέση, χρόνος.
 * @related components/account/SessionsList (ζωντανές) · components/account/EndedSessionsSection (όσες τελείωσαν)
 * @module components/account/session-device-summary
 *
 * ℹ️ Ζούσε μέσα στο `SessionsList.tsx`· εξήχθη όταν ήρθε ο **δεύτερος** καταναλωτής (ADR-894 §10 Β2), ώστε η ίδια
 * συσκευή να φαίνεται **ίδια** στις δύο ενότητες. Ο χρόνος έρχεται από τον καλούντα: «ενεργή πριν από…» για τις
 * ζωντανές, «τελείωσε πριν από…» για τις υπόλοιπες.
 */

import React from 'react';
import { Check, Globe, Monitor, Smartphone, Tablet } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BrowserType, DeviceType, SessionDisplayItem } from '@/services/session';

export type Translate = ReturnType<typeof useTranslation>['t'];

function getDeviceIcon(deviceType: DeviceType, className: string): React.ReactNode {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className={className} aria-hidden="true" />;
    case 'tablet':
      return <Tablet className={className} aria-hidden="true" />;
    case 'desktop':
    default:
      return <Monitor className={className} aria-hidden="true" />;
  }
}

function getBrowserColor(browserType: BrowserType): string {
  switch (browserType) {
    case 'Chrome':
      return 'text-[hsl(var(--text-success))]';
    case 'Firefox':
      return 'text-[hsl(var(--text-warning))]';
    case 'Safari':
    case 'Edge':
      return 'text-[hsl(var(--text-info))]';
    default:
      return 'text-muted-foreground';
  }
}

export interface SessionDeviceSummaryProps {
  t: Translate;
  session: SessionDisplayItem;
  device: string;
  locationLabel: string;
  /** Η χρονική φράση της γραμμής και η στιγμή της (για το `<time dateTime>`). */
  when: { readonly label: string; readonly at: Date };
}

export function SessionDeviceSummary({ t, session, device, locationLabel, when }: SessionDeviceSummaryProps) {
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const muted = cn(typography.body.sm, colors.text.muted);
  return (
    <article className={layout.flexCenterGap4}>
      <figure className={cn(layout.padding2, borders.radiusClass.md, 'bg-background', getBrowserColor(session.browserType))}>
        {getDeviceIcon(session.deviceType, iconSizes.md)}
      </figure>
      <section>
        <header className={layout.flexCenterGap2}>
          <h4 className={cn(typography.body.base, 'font-medium')}>{device}</h4>
          {session.isCurrent && (
            <Badge variant="default" className="text-xs">
              <Check className={cn(iconSizes.xs, 'mr-1')} aria-hidden="true" />
              {t('account.security.thisDevice')}
            </Badge>
          )}
        </header>
        <footer className={cn(layout.flexCenterGap2, 'mt-1')}>
          <Globe className={cn(iconSizes.xs, colors.text.muted)} aria-hidden="true" />
          <span className={muted}>{locationLabel}</span>
          <span className={muted} aria-hidden="true">•</span>
          <time className={muted} dateTime={when.at.toISOString()}>{when.label}</time>
        </footer>
      </section>
    </article>
  );
}
