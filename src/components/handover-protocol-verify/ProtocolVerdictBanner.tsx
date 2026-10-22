'use client';

/**
 * @fileoverview **Η μία ετυμηγορία στην οθόνη** — λέξη + εικονίδιο + εξήγηση (ADR-916 Φ-Γ2 Σ6 · CHECK 3.41).
 * @module components/handover-protocol-verify/ProtocolVerdictBanner
 *
 * 🏆 Acrobat: η σφραγίδα έχει **ονομασμένες** καταστάσεις. Εδώ η κατάσταση είναι **λέξη** στον τίτλο — το χρώμα και το
 *    εικονίδιο τη συνοδεύουν, δεν τη φέρουν. `role="status"`: ο αναγνώστης οθόνης ακούει την ετυμηγορία μόλις φτάσει.
 */

import React from 'react';
import { History, Info, Loader2, ShieldCheck, ShieldX } from 'lucide-react';

import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

export type ProtocolVerdictTone = 'verified' | 'caution' | 'refuted' | 'neutral' | 'working';

const ICONS: Record<ProtocolVerdictTone, typeof ShieldCheck> = {
  verified: ShieldCheck,
  caution: History,
  refuted: ShieldX,
  neutral: Info,
  working: Loader2,
};

/** Θεματικά tokens μόνο (COLOR_BRIDGE): επιφάνεια ανά τόνο, μελάνι εικονιδίου ανά τόνο — το κείμενο μένει `foreground`. */
const TONE_CLASS: Record<ProtocolVerdictTone, { readonly surface: string; readonly icon: string }> = {
  verified: { surface: COLOR_BRIDGE.bg.successSubtle, icon: COLOR_BRIDGE.text.success },
  caution: { surface: COLOR_BRIDGE.bg.warningSubtle, icon: COLOR_BRIDGE.text.warning },
  refuted: { surface: COLOR_BRIDGE.bg.errorSubtle, icon: COLOR_BRIDGE.text.error },
  neutral: { surface: 'bg-muted/40', icon: 'text-muted-foreground' },
  working: { surface: 'bg-muted/40', icon: 'text-muted-foreground' },
};

export function ProtocolVerdictBanner({ tone, title, body, icon, children }: {
  readonly tone: ProtocolVerdictTone;
  readonly title: string;
  readonly body?: string;
  /** Όταν ο τόνος δεν αρκεί — δύο «προσοχή» με διαφορετικό νόημα (αντικατεστημένο · αβέβαιο). */
  readonly icon?: typeof ShieldCheck;
  readonly children?: React.ReactNode;
}) {
  const iconSizes = useIconSizes();
  const Icon = icon ?? ICONS[tone];
  return (
    <article role="status" aria-live="polite" className={cn('flex flex-col gap-3 rounded-lg border border-border p-4', TONE_CLASS[tone].surface)}>
      <header className="flex items-start gap-2">
        <Icon className={cn(iconSizes.md, 'mt-0.5 shrink-0', TONE_CLASS[tone].icon, tone === 'working' && 'animate-spin')} aria-hidden="true" />
        <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
      </header>
      {body !== undefined && <p className="m-0 text-sm text-foreground">{body}</p>}
      {children}
    </article>
  );
}
