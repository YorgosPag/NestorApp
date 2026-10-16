'use client';

/**
 * ADR-901 Φ1 — οι ερωτήσεις της υπόθεσης. Ρωτά ΜΟΝΟ ό,τι δεν παράγεται από τα δεδομένα
 * (σχήμα TurboTax)· όσα παράχθηκαν φαίνονται ως «Από τα στοιχεία» και μπορούν να διορθωθούν
 * ρητά, γιατί η ρητή απάντηση υπερισχύει. Ό,τι επιβάλλει ο νόμος από άλλο γεγονός (`FACT_ENTAILMENTS`) φαίνεται ως
 * «Από τον νόμο» και **δεν** αλλάζει — η τιμή είναι η ΙΔΙΑ με του καταλόγου (`resolveFacts`).
 *
 * @module components/sales/conveyance/ConveyanceFactsPanel
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CONVEYANCE_FACT_IDS, type ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ChecklistRow, ConveyanceCase } from '@/types/conveyance-case';
import { factEntailedBy, resolveFacts } from '@/lib/conveyance/derive-facts';

interface ConveyanceFactsPanelProps {
  /** Οι ρητές απαντήσεις της υπόθεσης (`ConveyanceCase.facts`). */
  readonly answers: ConveyanceCase['facts'];
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
  /** Η τιμή την επιβάλλει ο νόμος ⇒ ούτε ερώτηση ούτε διόρθωση. */
  readonly entailed: boolean;
  readonly canEdit: boolean;
  readonly onAnswer: ConveyanceFactsPanelProps['onAnswer'];
}

function FactRow({ factId, value, derived, entailed, canEdit, onAnswer }: FactRowProps) {
  const { t } = useTranslation(['conveyance']);
  const choose = (next: boolean) => onAnswer(factId, value === next && !derived ? null : next);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-sm">{t(`facts.${factId}.question`)}</span>
      <span className="flex items-center gap-1">
        {entailed
          ? <Badge variant="muted">{t('facts.entailed')}</Badge>
          : derived && <Badge variant="muted">{t('facts.derived')}</Badge>}
        <ToggleButton size="sm" pressed={value === true} disabled={!canEdit || entailed} onClick={() => choose(true)}>
          {t('facts.yes')}
        </ToggleButton>
        <ToggleButton size="sm" pressed={value === false} disabled={!canEdit || entailed} onClick={() => choose(false)}>
          {t('facts.no')}
        </ToggleButton>
      </span>
    </li>
  );
}

export function ConveyanceFactsPanel({ answers, rows, derivedFacts, canEdit, onAnswer }: ConveyanceFactsPanelProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const relevant = new Set(rows.flatMap((row) => (row.item.requirement.kind === 'when' ? [row.item.requirement.fact] : [])));
  const factIds = CONVEYANCE_FACT_IDS.filter((factId) => relevant.has(factId));
  if (factIds.length === 0) return null;
  const resolved = resolveFacts(derivedFacts, answers);
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
            value={resolved[factId]}
            derived={answers[factId] === undefined && derivedFacts[factId] !== undefined}
            entailed={factEntailedBy(resolved, factId) !== null}
            canEdit={canEdit}
            onAnswer={onAnswer}
          />
        ))}
      </ul>
    </section>
  );
}
