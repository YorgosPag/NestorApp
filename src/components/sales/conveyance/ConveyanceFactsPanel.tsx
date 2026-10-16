'use client';

/**
 * ADR-901 Φ1 — οι ερωτήσεις της υπόθεσης. Ρωτά ΜΟΝΟ ό,τι δεν παράγεται από τα δεδομένα
 * (σχήμα TurboTax)· όσα παράχθηκαν φαίνονται ως «Από τα στοιχεία» και μπορούν να διορθωθούν
 * ρητά, γιατί η ρητή απάντηση υπερισχύει. Ό,τι επιβάλλει ο νόμος από άλλο γεγονός (`FACT_ENTAILMENTS`) φαίνεται ως
 * «Από τον νόμο» και **δεν** αλλάζει — η τιμή είναι η ΙΔΙΑ με του καταλόγου (`resolveCaseFacts`).
 *
 * ADR-915 §22 — τα γεγονότα **προσώπου** («πληρεξούσιο;», «υπόχρεος ΕΦΚΑ;») ρωτώνται **ανά πωλητή**: κάθε συμπωλητής
 * έχει τη δική του ομάδα, με τα γεγονότα που χρειάζονται οι **δικές του** γραμμές. Με έναν πωλητή η όψη είναι όπως πριν.
 *
 * @module components/sales/conveyance/ConveyanceFactsPanel
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { CONVEYANCE_FACT_IDS, isPartyFact, type ConveyanceFactId } from '@/config/conveyance-checklist/types';
import type { ChecklistRow, ConveyanceCase, ConveyanceFactAnswer } from '@/types/conveyance-case';
import { derivePartyFacts, factEntailedBy, type FactValues } from '@/lib/conveyance/derive-facts';
import { resolveCaseFacts } from '@/lib/conveyance/case-rows';

type FactAnswers = Readonly<Partial<Record<ConveyanceFactId, ConveyanceFactAnswer>>>;

interface ConveyanceFactsPanelProps {
  /** Οι ρητές απαντήσεις και τα πρόσωπα της υπόθεσης. */
  readonly record: Pick<ConveyanceCase, 'facts' | 'partyFacts' | 'parties'>;
  /** Οι γραμμές του καταλόγου — ορίζουν ποια γεγονότα έχουν σημασία για ΑΥΤΗ την υπόθεση (και για ΑΥΤΟ το πρόσωπο). */
  readonly rows: readonly ChecklistRow[];
  /** Τα παραγόμενα γεγονότα **της υπόθεσης** (`deriveFacts`). Του προσώπου παράγονται από το ίδιο (`derivePartyFacts`). */
  readonly derivedFacts: FactValues;
  readonly canEdit: boolean;
  /** `partyKey: null` = γεγονός της υπόθεσης. */
  readonly onAnswer: (factId: ConveyanceFactId, value: boolean | null, partyKey: string | null) => void;
}

/** Ένα σύνολο ερωτήσεων με το δικό του πλαίσιο: της υπόθεσης, ή ενός προσώπου. */
interface FactScope {
  readonly partyKey: string | null;
  readonly factIds: readonly ConveyanceFactId[];
  readonly resolved: FactValues;
  readonly derived: FactValues;
  readonly answers: FactAnswers;
}

interface FactRowProps {
  readonly factId: ConveyanceFactId;
  readonly scope: FactScope;
  readonly canEdit: boolean;
  readonly onAnswer: ConveyanceFactsPanelProps['onAnswer'];
}

function FactRow({ factId, scope, canEdit, onAnswer }: FactRowProps) {
  const { t } = useTranslation(['conveyance']);
  const value = scope.resolved[factId];
  const derived = scope.answers[factId] === undefined && scope.derived[factId] !== undefined;
  // Η τιμή την επιβάλλει ο νόμος ⇒ ούτε ερώτηση ούτε διόρθωση.
  const entailed = factEntailedBy(scope.resolved, factId) !== null;
  const choose = (next: boolean) => onAnswer(factId, value === next && !derived ? null : next, scope.partyKey);
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

/** Τα γεγονότα που ρωτούν οι δοσμένες γραμμές, με τη σειρά του λεξιλογίου. */
function factsAskedBy(rows: readonly ChecklistRow[]): readonly ConveyanceFactId[] {
  const asked = new Set(rows.flatMap((row) => (row.item.requirement.kind === 'when' ? [row.item.requirement.fact] : [])));
  return CONVEYANCE_FACT_IDS.filter((factId) => asked.has(factId));
}

/** Της υπόθεσης πρώτα, μετά ένα πλαίσιο ανά πωλητή — μόνο όσα έχουν ερωτήσεις. */
function factScopes({ record, rows, derivedFacts }: Pick<ConveyanceFactsPanelProps, 'record' | 'rows' | 'derivedFacts'>): readonly FactScope[] {
  const facts = resolveCaseFacts(derivedFacts, record);
  const caseScope: FactScope = {
    partyKey: null, factIds: factsAskedBy(rows).filter((factId) => !isPartyFact(factId)),
    resolved: facts.case, derived: derivedFacts, answers: record.facts,
  };
  const partyScopes = record.parties.sellers.map((party): FactScope => ({
    partyKey: party.key, factIds: factsAskedBy(rows.filter((row) => row.party?.key === party.key)).filter(isPartyFact),
    resolved: facts.parties[party.key] ?? {}, derived: derivePartyFacts(party), answers: record.partyFacts[party.key] ?? {},
  }));
  return [caseScope, ...partyScopes].filter((scope) => scope.factIds.length > 0);
}

export function ConveyanceFactsPanel({ record, rows, derivedFacts, canEdit, onAnswer }: ConveyanceFactsPanelProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const scopes = factScopes({ record, rows, derivedFacts });
  if (scopes.length === 0) return null;
  // Με έναν πωλητή δεν χρειάζεται «ποιος»: η όψη μένει όπως πριν από την §22.
  const sellerIndex = (partyKey: string) => record.parties.sellers.findIndex((party) => party.key === partyKey) + 1;
  const named = record.parties.sellers.length > 1;
  return (
    <section className="rounded-lg border bg-card p-3" aria-labelledby="conveyance-facts-title">
      <header className="mb-1">
        <h3 id="conveyance-facts-title" className="text-sm font-semibold">{t('facts.title')}</h3>
        <p className={cn('text-xs', colors.text.muted)}>{t('facts.hint')}</p>
      </header>
      {scopes.map((scope) => (
        <section key={scope.partyKey ?? 'case'} aria-label={scope.partyKey !== null && named ? t('facts.sellerHeading', { index: sellerIndex(scope.partyKey) }) : undefined}>
          {scope.partyKey !== null && named && (
            <h4 className={cn('mt-2 text-xs font-semibold', colors.text.secondary)}>{t('facts.sellerHeading', { index: sellerIndex(scope.partyKey) })}</h4>
          )}
          <ul className="divide-y">
            {scope.factIds.map((factId) => (
              <FactRow key={factId} factId={factId} scope={scope} canEdit={canEdit} onAnswer={onAnswer} />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
