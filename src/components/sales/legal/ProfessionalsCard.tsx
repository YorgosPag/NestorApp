'use client';

/**
 * ProfessionalsCard — 3 νομικοί ρόλοι (seller_lawyer, buyer_lawyer, notary)
 * Live from unit associations (NOT from contract snapshots).
 *
 * @enterprise ADR-230 (SPEC-230D Task C)
 */

import React from 'react';
import { User, Scale, Briefcase } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import type { EntityAssociationLink } from '@/types/entity-associations';

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalsCardProps {
  /** All contact links for this unit */
  associations: EntityAssociationLink[];
}

interface ProfessionalSlot {
  role: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ElementType;
}

const SLOTS: ProfessionalSlot[] = [
  { role: 'seller_lawyer', labelKey: 'sales.legal.sellerLawyer', defaultLabel: 'Δικηγόρος Πωλητή', icon: Briefcase },
  { role: 'buyer_lawyer', labelKey: 'sales.legal.buyerLawyer', defaultLabel: 'Δικηγόρος Αγοραστή', icon: Briefcase },
  { role: 'notary', labelKey: 'sales.legal.notary', defaultLabel: 'Συμβολαιογράφος', icon: Scale },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ProfessionalsCard({ associations }: ProfessionalsCardProps) {
  const { t } = useTranslation('common');

  return (
    <section className="rounded-lg border bg-card p-3 space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <User className="h-4 w-4 text-muted-foreground" />
        {t('sales.legal.professionalsTitle', { defaultValue: 'Νομικοί Επαγγελματίες' })}
      </h3>

      <ul className="space-y-1.5">
        {SLOTS.map((slot) => {
          const linked = associations.find((a) => a.role === slot.role);

          return (
            <li key={slot.role} className="flex items-center gap-2 text-sm">
              <slot.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground min-w-0 shrink-0">
                {t(slot.labelKey, { defaultValue: slot.defaultLabel })}:
              </span>
              {linked ? (
                <span className="font-medium truncate">{linked.contactName}</span>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground/60">
                  {t('sales.legal.unassigned', { defaultValue: 'Μη ανατεθ.' })}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-muted-foreground italic">
        {t('sales.legal.professionalsHint', {
          defaultValue: 'Ανάθεση μέσω Συσχετίσεις → Μονάδα',
        })}
      </p>
    </section>
  );
}
