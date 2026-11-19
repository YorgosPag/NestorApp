'use client';

/**
 * @fileoverview **Το πλαϊνό πάνελ της σελίδας ακινήτου ιδιοκτήτη** — ό,τι πρέπει να φαίνεται **όποια ενότητα κι αν
 * είναι ανοιχτή**: οι ενέργειες, «τι λείπει» (η επόμενη κίνηση), και ο κύκλος ζωής. Το πάνελ ιδιοτήτων του Revit /
 * Figma: δεν το ψάχνεις, είναι εκεί.
 * @related ADR-946 · ADR-770 §18 (μία γραμμή ενεργειών, μία κύρια) · ADR-842 Φ5 · `core/layouts/record-action-bar`
 * @module components/owner-property/OwnerPropertyAside
 *
 * ⚠️ **Η απόσυρση ΔΕΝ διαγράφει** (`lifecycle: 'withdrawn'`), και το λέει η ίδια η οθόνη: η αγγελία φεύγει από τον
 * χάρτη και **μένει στον κατάλογό του**.
 */

import React from 'react';

import { RecordActionLead } from '@/core/layouts/record-action-bar';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { offerStayCalendarHref, offerTourHref } from '@/lib/owner-property/owner-property-routes';
import { Link } from '@/lib/workspace/navigation';
import { cn } from '@/lib/utils';
import type { projectListingShape } from '@/services/listings/public-listing-projection';
import { setOwnerListingLifecycle } from '@/services/owner-property/owner-property.service';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';

import { OwnerListingCompletion } from './OwnerListingCompletion';

const NS = 'property-market';
const K = `${NS}:offer`;
const SECONDARY = cn('inline-block rounded-md px-4 py-2 font-medium', COLOR_BRIDGE.action.secondary);

/** Οι τρεις καταστάσεις του κουμπιού κύκλου ζωής. **Ποτέ** `boolean` + `string`. */
type LifecycleState = 'idle' | 'busy' | 'failed';

/**
 * **Απόσυρση / επαναφορά** — ένα κουμπί, δύο κατευθύνσεις. ⚠️ **Όχι αισιόδοξο**: αλλάζει **τι βλέπει ο κόσμος**, και
 * μια όψη που λέει «αποσύρθηκε» ενώ η αγγελία είναι ακόμη στον χάρτη είναι το χειρότερο ψέμα προς τον ιδιοκτήτη.
 */
function LifecycleButton({ property }: { property: OwnerProperty }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [state, setState] = React.useState<LifecycleState>('idle');
  const next = property.lifecycle === 'listed' ? 'withdrawn' : 'listed';

  async function handleClick(): Promise<void> {
    setState('busy');
    const outcome = await setOwnerListingLifecycle(property.id, next);
    // Η ζωντανή ανάγνωση (`useMyOwnerProperty`) φέρνει τη νέα κατάσταση μόνη της — **μία** πηγή.
    setState(outcome.kind === 'saved' ? 'idle' : 'failed');
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'busy'}
        className={cn(
          'self-start rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50',
          // ADR-770 §18 — η ΑΠΟΣΥΡΣΗ αλλάζει τι βλέπει ο κόσμος ⇒ μελάνι προσοχής· η ΕΠΑΝΑΦΟΡΑ δευτερεύουσα.
          next === 'withdrawn' ? COLOR_BRIDGE.action.caution : COLOR_BRIDGE.action.secondary,
        )}
      >
        {t(next === 'withdrawn' ? `${K}.lifecycle.withdraw` : `${K}.lifecycle.restore`)}
      </button>
      <p className="text-sm text-muted-foreground">{t(`${K}.lifecycle.withdrawNote`)}</p>
      {state === 'failed' && (
        <p aria-live="polite" className="text-sm text-foreground">
          {t(`${K}.lifecycle.failed`)}
        </p>
      )}
    </div>
  );
}

/**
 * 🎯 ADR-770 §18 — **ΜΙΑ γραμμή ενεργειών, ΜΙΑ κύρια** (η επεξεργασία). Ο σύνδεσμος προς τη δημόσια αγγελία κλείνει
 * τον κύκλο της Α14 και εμφανίζεται **μόνο** όταν η αγγελία είναι πραγματικά δημοσιευμένη. Ημερολόγιο μόνο για
 * βραχυχρόνια διάθεση (ADR-835 §20)· περιήγηση 360° σε δική της σελίδα (ADR-884 Κ3α).
 */
function OwnerPropertyActions({ property, onMap, onEdit }: { property: OwnerProperty; onMap: boolean; onEdit: () => void }) {
  const { t } = useTranslation([NS]);
  return (
    <nav aria-label={t(`${K}.sections.actionsLabel`)} className="flex flex-wrap gap-3">
      <button type="button" onClick={onEdit} className={cn('rounded-md px-4 py-2 font-medium', COLOR_BRIDGE.action.primary)}>
        {t(`${K}.detail.edit`)}
      </button>
      {onMap && (
        <Link href={listingDetailHref(property.id)} className={SECONDARY}>
          {t(`${K}.publish.view`)}
        </Link>
      )}
      {ownerPropertyOfferKinds(property).includes('leaseShort') && (
        <Link href={offerStayCalendarHref(property.id)} className={SECONDARY}>
          {t(`${K}.stayCalendar.open`)}
        </Link>
      )}
      <Link href={offerTourHref(property.id)} className={SECONDARY}>
        {t(`${K}.tour.open`)}
      </Link>
    </nav>
  );
}

export function OwnerPropertyAside({
  property,
  onMap,
  projectedListing,
  editing,
  onEdit,
}: {
  readonly property: OwnerProperty;
  readonly onMap: boolean;
  /** ADR-842 Φ5 — η ίδια προβολή που βλέπει ο αγοραστής, **χωρίς** την πύλη: ο δείκτης υπάρχει και πριν τη δημοσίευση. */
  readonly projectedListing: ReturnType<typeof projectListingShape>;
  /** Ανοιχτή φόρμα ⇒ καμία ενέργεια (η φόρμα έχει τις δικές της)· πληρότητα και κύκλος ζωής μένουν. */
  readonly editing: boolean;
  readonly onEdit: () => void;
}) {
  return (
    <>
      {/* Στο κινητό οι ενέργειες πάνε στην κάτω μπάρα (στον αντίχειρα)· παντού αλλού μένουν εδώ. */}
      {!editing && (
        <RecordActionLead>
          <OwnerPropertyActions property={property} onMap={onMap} onEdit={onEdit} />
        </RecordActionLead>
      )}
      <OwnerListingCompletion listing={projectedListing} improveOfferId={onMap ? property.id : null} />
      <LifecycleButton property={property} />
    </>
  );
}
