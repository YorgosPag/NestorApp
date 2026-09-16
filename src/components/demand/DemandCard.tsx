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
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { demandExclusionReason } from '@/lib/demand/demand-aggregate';
import { demandDetailHref } from '@/lib/demand/demand-routes';
import { affirmDemand } from '@/services/demand/property-demand.service';
import {
  demandReadId,
  type StoredDemandRead,
} from '@/lib/demand/property-demand-from-document';
import { DEMAND_AFFIRMATION_TTL_DAYS, type PropertyDemand } from '@/types/property-demand';
import { DemandSummary } from './DemandSummary';

/** Οι τρεις καταστάσεις του κουμπιού. **Ποτέ** `boolean` + `string`. */
type AffirmState = 'idle' | 'busy' | 'affirmed' | 'failed';

/** Το κουμπί «ψάχνω ακόμη» — και η εξήγηση της παλαίωσης δίπλα του. */
function AffirmButton({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
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

  const K = 'property-market:demand.affirm';

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

/**
 * **Η ζήτηση που δεν διαβάστηκε ολόκληρη** — ορατή, εξηγημένη, διορθώσιμη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΜΦΑΝΙΖΕΤΑΙ ΑΝΤΙ ΝΑ ΠΕΤΑΧΤΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο διακομιστής τη **βγάζει** από κάθε άθροισμα και ταίριασμα (καραντίνα — πρότυπο
 * **RESO** `Incomplete`: *«δεν συμπληρώθηκε, δεν δημοσιεύεται»*). Εδώ όμως είναι ο
 * κατάλογος του **ίδιου του κατόχου**, και η **Α5 §4.1** απαγορεύει τη σιωπηλή
 * εξαφάνιση: κάτι δικό του που «χάθηκε μόνο του» είναι το χειρότερο που μπορεί να δει.
 *
 * 🔑 **Λέει ΤΙ λείπει, όχι «σφάλμα».** Τα κενά είναι κλειστό λεξιλόγιο με δικά τους
 * κλειδιά i18n (`demand.incomplete.gap.*`), ώστε ο άνθρωπος να διαβάζει *«λείπει: η
 * περιοχή»* — και ο δρόμος διόρθωσης να είναι **ένα κλικ**, η ίδια φόρμα που θα είχε
 * καταρρεύσει πριν το σύνορο.
 */
function IncompleteDemandCard({
  id,
  gaps,
}: {
  id: string;
  gaps: readonly string[];
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const K = 'property-market:demand.incomplete';

  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t(`${K}.badge`)}</h3>
        <Link href={demandDetailHref(id)} className="text-sm font-medium text-foreground underline">
          {t(`${K}.fix`)}
        </Link>
      </header>

      <p className="text-sm text-foreground">
        {t(`${K}.why`, { gaps: gaps.map((gap) => t(`${K}.gap.${gap}`)).join(' · ') })}
      </p>
      <p className="text-sm text-muted-foreground">{t(`${K}.reassure`)}</p>
    </article>
  );
}

export function DemandCard({ read }: { read: StoredDemandRead }): React.ReactElement {
  if (read.kind === 'incomplete') {
    return <IncompleteDemandCard id={read.id} gaps={read.gaps} />;
  }
  return <CompleteDemandCard demand={read.demand} />;
}

/** Η κάρτα όπως ήταν — **αμετάβλητη**, και πλέον με τον τύπο να λέει αλήθεια. */
function CompleteDemandCard({ demand }: { demand: PropertyDemand }): React.ReactElement {
  const { t } = useTranslation(['property-market']);

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t(`property-market:demand.lifecycle.${demand.lifecycle}`)}
        </h3>
        <Link
          href={demandDetailHref(demand.id)}
          className="text-sm font-medium text-foreground underline"
        >
          {t('property-market:demand.list.open')}
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
