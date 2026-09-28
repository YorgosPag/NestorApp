'use client';

/**
 * **Τιμές συμβολαίων μιας περιοχής** — πηγές Β + Γ του ADR-890 §3, από το Μητρώο Αξιών Μεταβιβάσεων (ADR-889 Φ2).
 *
 * 🔑 **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΝΟΜΑΣΜΕΝΕΣ.** «Δεν υπήρξαν συμβόλαια» (γεγονός) ≠ «δεν διαβάστηκαν» (σφάλμα): η δεύτερη
 * **δεν** λέει ποτέ «κανένα συμβόλαιο».
 *
 * 🔑 **Η ΑΝΑΦΟΡΑ ΚΑΤΑ CC-BY ΚΛΕΙΝΕΙ ΤΗΝ ΕΝΟΤΗΤΑ** — κύριος, άδεια και δήλωση αλλαγών (`OpenDataAttribution`).
 */

import React from 'react';

import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDay } from '@/lib/intl-formatting';
import type { AreaContractsState, AreaMarketSnapshot } from '@/types/area-market';

import { contractSegmentViews } from './area-contracts-view';
import { AreaContractCard } from './AreaContractCard';

const NS = 'market-contracts';
const HEADING_ID = 'area-contracts';

interface AreaContractSectionProps {
  readonly contracts: AreaContractsState;
  /** Οι ζητούμενες της ίδιας περιοχής — για την απόσταση ζητούμενης ↔ συμβολαίου. */
  readonly asking: AreaMarketSnapshot | null;
  readonly parentName: string | null;
}

function ContractCards({ contracts, asking, parentName }: AreaContractSectionProps) {
  const { t } = useTranslation([NS]);
  if (contracts.kind === 'unavailable') return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:section.unavailable`)}</p>;
  const views = contracts.kind === 'ready' ? contractSegmentViews(contracts.summary, contracts.parent, asking) : [];
  if (views.length === 0) {
    return <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:section.none`, { from: contracts.window.from, to: contracts.window.to })}</p>;
  }
  // Μία κάρτα ανά γραμμή: γράφημα + πίνακας έτους δεν χωρούν σε μισή στήλη (μετρημένο: κοβόταν η στήλη «Συμβόλαια»).
  return (
    <ul className="m-0 grid list-none gap-3 p-0">
      {views.map((view) => (
        <li key={view.segment} className="min-w-0">
          <AreaContractCard view={view} parentName={parentName} />
        </li>
      ))}
    </ul>
  );
}

export function AreaContractSection(props: AreaContractSectionProps) {
  const { t } = useTranslation([NS]);
  const { contracts } = props;
  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 id={HEADING_ID} className="m-0 text-xl font-semibold text-foreground">{t(`${NS}:section.title`)}</h2>
        {contracts.kind === 'ready' && (
          <p className="m-0 text-sm text-muted-foreground">
            {t(`${NS}:section.subtitle`, { date: formatCalendarDay(contracts.summary.asOf, true) })}
          </p>
        )}
      </header>
      <ContractCards {...props} />
      {contracts.kind !== 'unavailable' && <OpenDataAttribution source="transferValues" />}
    </section>
  );
}
