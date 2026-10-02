'use client';

/**
 * ADR-901 Φ1 — οι ερωτήσεις της υπόθεσης. Ρωτά ΜΟΝΟ ό,τι δεν παράγεται από τα δεδομένα
 * (σχήμα TurboTax)· όσα παράχθηκαν φαίνονται ως «Από τα στοιχεία» και μπορούν να διορθωθούν
 * ρητά, γιατί η ρητή απάντηση υπερισχύει.
 *
 * @module components/sales/conveyance/ConveyanceFactsPanel
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CONVEYANCE_FACT_IDS, type ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ChecklistRow, ConveyanceCase } from '@/types/conveyance-case';

interface ConveyanceFactsPanelProps {
  readonly record: ConveyanceCase;
  /** Οι γραμμές του καταλόγου — ορίζουν ποια γεγονότα έχουν σημασία για ΑΥΤΗ την υπόθεση. */
  readonly rows: readonly ChecklistRow[];
  readonly derivedFacts: Readonly<Partial<Record<ConveyanceFactId, boolean>>>;
  readonly canEdit: boolean;
  readonly onAnswer: (factId: ConveyanceFactId, value: boolean | null) => void;
}

interface FactRowProps {
  readonly factId: ConveyanceFactId;
  readonly value: boolean | undefined;
  readonly derived: boolean;
  readonly canEdit: boolean;
  readonly onAnswer: ConveyanceFactsPanelProps['onAnswer'];
}

function FactRow({ factId, value, derived, canEdit, onAnswer }: FactRowProps) {
  const { t } = useTranslation(['conveyance']);
  const choose = (next: boolean) => onAnswer(factId, value === next && !derived ? null : next);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-sm">{t(`facts.${factId}.question`)}</span>
      <span className="flex items-center gap-1">
        {derived && <Badge variant="muted">{t('facts.derived')}</Badge>}
        <Button size="sm" variant={value === true ? 'default' : 'outline'} disabled={!canEdit} aria-pressed={value === true} onClick={() => choose(true)}>
          {t('facts.yes')}
        </Button>
        <Button size="sm" variant={value === false ? 'default' : 'outline'} disabled={!canEdit} aria-pressed={value === false} onClick={() => choose(false)}>
          {t('facts.no')}
        </Button>
      </span>
    </li>
  );
}

export function ConveyanceFactsPanel({ record, rows, derivedFacts, canEdit, onAnswer }: ConveyanceFactsPanelProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const relevant = new Set(rows.flatMap((row) => (row.item.requirement.kind === 'when' ? [row.item.requirement.fact] : [])));
  const factIds = CONVEYANCE_FACT_IDS.filter((factId) => relevant.has(factId));
  if (factIds.length === 0) return null;
  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="conveyance-facts-title">
      <header className="mb-1">
        <h3 id="conveyance-facts-title" className="text-sm font-semibold">{t('facts.title')}</h3>
        <p className={cn('text-xs', colors.text.muted)}>{t('facts.hint')}</p>
      </header>
      <ul className="divide-y">
        {factIds.map((factId) => (
          <FactRow
            key={factId}
            factId={factId}
            value={record.facts[factId]?.value ?? derivedFacts[factId]}
            derived={record.facts[factId] === undefined && derivedFacts[factId] !== undefined}
            canEdit={canEdit}
            onAnswer={onAnswer}
          />
        ))}
      </ul>
    </section>
  );
}
