'use client';

/**
 * **Μία ζήτηση στον κατάλογο** — περίληψη, φρεσκάδα, και το κουμπί «ψάχνω ακόμη».
 *
 * @related ADR-777 §7 (Α9) · SPEC-777B §12.6 · lib/demand/demand-aggregate.ts
 * @module components/demand/DemandCard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ Η ΦΡΕΣΚΑΔΑ ΔΕΝ ΥΠΟΛΟΓΙΖΕΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «είναι μπαγιάτικη;» το απαντά **αποκλειστικά** το
 * {@link demandExclusionReason} — η **ίδια** συνάρτηση που αποφασίζει αν η ζήτηση
 * μετράει στο ανώνυμο άθροισμα. Ένα `daysSince(...) > 90` γραμμένο εδώ θα ήταν
 * **δεύτερος κριτής**: η οθόνη θα έλεγε «φρέσκια» ενώ ο θερμοχάρτης δεν θα τη
 * μετρούσε, και ο άνθρωπος δεν θα είχε **κανέναν** τρόπο να το μάθει.
 *
 * 🔑 Και η σειρά των λόγων είναι συμβόλαιο: μια **αποσυρμένη** ζήτηση που είναι
 * *επίσης* μπαγιάτικη λογίζεται «αποσυρμένη» — αλλιώς η οθόνη θα ζητούσε από τον
 * άνθρωπο να «επιβεβαιώσει ότι ψάχνει» κάτι που ο ίδιος **σταμάτησε**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ «ΨΑΧΝΩ ΑΚΟΜΗ» ΕΙΝΑΙ ΑΙΣΙΟΔΟΞΟ, ΚΑΙ ΞΑΝΑΓΥΡΝΑ ΑΝ ΑΠΟΤΥΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κλικ αλλάζει **αμέσως** την όψη (N.7: *optimistic updates*), γιατί η πράξη είναι
 * ένα πεδίο και η αναμονή δικτύου για αυτό είναι θόρυβος. Αλλά η αποτυχία **δεν
 * σιωπά**: το μήνυμα εμφανίζεται και η κατάσταση επιστρέφει, γιατί μια ζήτηση που
 * *φαίνεται* επιβεβαιωμένη και **δεν είναι** βγαίνει από το άθροισμα χωρίς να το
 * μάθει ποτέ ο κάτοχός της.
 */

import React from 'react';
import Link from 'next/link';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { demandExclusionReason } from '@/lib/demand/demand-aggregate';
import { demandDetailHref } from '@/lib/demand/demand-routes';
import { affirmDemand } from '@/services/demand/property-demand.service';
import { DEMAND_AFFIRMATION_TTL_DAYS, type PropertyDemand } from '@/types/property-demand';
import { DemandSummary } from './DemandSummary';

/** Οι τρεις καταστάσεις του κουμπιού. **Ποτέ** `boolean` + `string`. */
type AffirmState = 'idle' | 'busy' | 'affirmed' | 'failed';

/** Το κουμπί «ψάχνω ακόμη» — και η εξήγηση της παλαίωσης δίπλα του. */
function AffirmButton({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation(['search-results']);
  const [state, setState] = React.useState<AffirmState>('idle');

  // ⚠️ Το ρολόι διαβάζεται **μία φορά ανά απόδοση**, από το SSoT — και περνιέται στη
  // μηχανή ως ρητή παράμετρος, όπως παντού στη ζήτηση.
  const stale = React.useMemo(
    () => state !== 'affirmed' && demandExclusionReason(demand, nowISO()) === 'stale',
    [demand, state],
  );

  async function handleAffirm(): Promise<void> {
    setState('busy');
    const outcome = await affirmDemand(demand.id);
    setState(outcome.kind === 'done' ? 'affirmed' : 'failed');
  }

  const K = 'search-results:demand.affirm';

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleAffirm}
        disabled={state === 'busy'}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
      >
        {state === 'busy' ? t(`${K}.busy`) : t(`${K}.action`)}
      </button>

      {state === 'affirmed' && <p className="text-sm text-muted-foreground">{t(`${K}.done`)}</p>}
      {state === 'failed' && <p className="text-sm text-foreground">{t(`${K}.failed`)}</p>}
      {state === 'idle' && stale && (
        <>
          <p className="text-sm text-foreground">
            {t(`${K}.stale`, { days: DEMAND_AFFIRMATION_TTL_DAYS })}
          </p>
          <p className="text-sm text-muted-foreground">{t(`${K}.staleWhy`)}</p>
        </>
      )}
    </div>
  );
}

export function DemandCard({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation(['search-results']);

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t(`search-results:demand.lifecycle.${demand.lifecycle}`)}
        </h3>
        <Link
          href={demandDetailHref(demand.id)}
          className="text-sm font-medium text-foreground underline"
        >
          {t('search-results:demand.list.open')}
        </Link>
      </header>

      <DemandSummary demand={demand} />

      {/*
        Το «ψάχνω ακόμη» εμφανίζεται **μόνο** στις ζωντανές: το να ζητάμε από κάποιον
        να επιβεβαιώσει μια ζήτηση που ο ίδιος απέσυρε θα ήταν να του μιλάμε για
        απόφαση που έχει ήδη πάρει.
      */}
      {demand.lifecycle === 'active' && <AffirmButton demand={demand} />}
    </article>
  );
}
