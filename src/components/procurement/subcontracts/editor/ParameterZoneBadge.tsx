'use client';

/**
 * Η ζώνη μιας τιμής ρήτρας **δίπλα στο πεδίο** (ADR-928 §5.2.1 · Φ3γ απόφαση 3): ελεύθερη · θέλει λόγο και έγκριση ·
 * απαγορεύεται. Εικονίδιο + λέξη, όχι μόνο χρώμα (ADR-771: διαβάζεται χωρίς να φαίνεται το χρώμα). Η ετυμηγορία είναι
 * του **ίδιου** κριτή με τον γραφέα (`toleranceVerdict`).
 */

import { Ban, CircleCheck, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isFreeVerdict } from '@/subapps/procurement/subcontracts/clauses/tolerance-verdict';
import type { ToleranceVerdict } from '@/subapps/procurement/subcontracts/types/clause-parameter';

type Zone = 'free' | 'needsApproval' | 'forbidden';

const PRESENTATION: Readonly<Record<Zone, { readonly icon: LucideIcon; readonly variant: 'secondary' | 'outline' | 'destructive' }>> = {
  free: { icon: CircleCheck, variant: 'secondary' },
  needsApproval: { icon: ShieldAlert, variant: 'outline' },
  forbidden: { icon: Ban, variant: 'destructive' },
};

export function zoneOf(verdict: ToleranceVerdict): Zone {
  if (isFreeVerdict(verdict)) return 'free';
  return verdict === 'forbidden' ? 'forbidden' : 'needsApproval';
}

export function ParameterZoneBadge({ verdict }: { readonly verdict: ToleranceVerdict }) {
  const { t } = useTranslation('procurement');
  const zone = zoneOf(verdict);
  const { icon: Icon, variant } = PRESENTATION[zone];
  return (
    <Badge variant={variant} className="gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" aria-hidden />
      {t(`subcontracts.editor.zone.${zone}`)}
    </Badge>
  );
}
