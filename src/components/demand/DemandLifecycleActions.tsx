'use client';

/**
 * **Παύση · «το βρήκα» · απόσυρση** — και **καμία διαγραφή**.
 *
 * @related ADR-777 §7 (Α9) · SPEC-777B §12.6 · firestore.rules (`allow delete: if false`)
 * @module components/demand/DemandLifecycleActions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΚΟΥΜΠΙ «ΔΙΑΓΡΑΦΗ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας Firestore το κάνει **δομικά αδύνατο** (`allow delete: if false`), και ο
 * λόγος είναι γραμμένος δίπλα του: *«μια σβησμένη ζήτηση δεν μπορεί να αποδείξει ότι
 * μετρήθηκε ποτέ σωστά στο άθροισμα — και το άθροισμα είναι προϊόν που πουλάμε»* (Ε2).
 *
 * Η **απόσυρση** κάνει ό,τι θέλει πραγματικά ο άνθρωπος: η ζήτηση **παύει να ψάχνει**
 * και **βγαίνει από το άθροισμα**, αλλά μένει στον κατάλογό του. Η οθόνη το λέει —
 * ένα κουμπί «Απόσυρση» χωρίς εξήγηση θα διαβαζόταν ως διαγραφή, και ο άνθρωπος θα
 * δίσταζε να το πατήσει ή θα εκπλησσόταν που η ζήτηση παρέμεινε.
 *
 * ⚠️ **Δεν υπάρχει `expired`, και δεν μπορεί να σταλεί**: ο τύπος
 * {@link DemandLifecycle} δεν το περιέχει. Η **Ζ3** («όποτε κι αν βγει») απαγορεύει τη
 * λήξη· η παλαίωση εκφράζεται ως **φρεσκάδα**, που είναι αναστρέψιμη με ένα κλικ.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { setDemandLifecycle } from '@/services/demand/property-demand.service';
import type { DemandLifecycle, PropertyDemand } from '@/types/property-demand';

const NS = 'property-market';

/**
 * Ποιες μεταβάσεις προσφέρονται σε κάθε κατάσταση.
 *
 * 🔑 **`Record` πάνω σε κλειστό σύνολο**: νέα κατάσταση κύκλου ζωής **δεν
 * μεταγλωττίζεται** χωρίς να απαντηθεί «τι μπορεί να κάνει ο άνθρωπος από εδώ». Μια
 * κατάσταση χωρίς μεταβάσεις θα ήταν αδιέξοδο που κανείς δεν αποφάσισε.
 *
 * ⚠️ Το `withdrawn` **δεν προσφέρει τίποτα**, και είναι σκόπιμο: η επαναφορά μιας
 * αποσυρμένης εντολής είναι **νέα εντολή** — τα κριτήρια της αγοράς έχουν αλλάξει από
 * τότε, και το `affirmedAt` της παλιάς θα ήταν ψευδής ισχυρισμός φρεσκάδας.
 */
const TRANSITIONS: Readonly<Record<DemandLifecycle, readonly DemandLifecycle[]>> = {
  active: ['paused', 'fulfilled', 'withdrawn'],
  paused: ['active', 'withdrawn'],
  fulfilled: ['active', 'withdrawn'],
  withdrawn: [],
};

/** Ποια ετικέτα κουμπιού για ποια μετάβαση **από** ποια κατάσταση. */
function actionKey(from: DemandLifecycle, to: DemandLifecycle): string {
  if (to === 'active') return 'resume';
  if (to === 'paused') return 'pause';
  if (to === 'fulfilled') return 'fulfil';
  // `withdrawn` — μία ετικέτα, ανεξάρτητα από πού έρχεται.
  void from;
  return 'withdraw';
}

export function DemandLifecycleActions({
  demand,
}: {
  demand: PropertyDemand;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState<DemandLifecycle | null>(null);

  const options = TRANSITIONS[demand.lifecycle];
  if (options.length === 0) return null;

  async function move(to: DemandLifecycle): Promise<void> {
    setBusy(to);
    setFailed((await setDemandLifecycle(demand.id, to)).kind !== 'done');
    setBusy(null);
  }

  const K = `${NS}:demand.lifecycle`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <button
            key={to}
            type="button"
            onClick={() => move(to)}
            disabled={busy !== null}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
          >
            {t(`${K}.${actionKey(demand.lifecycle, to)}`)}
          </button>
        ))}
      </div>

      {options.includes('withdrawn') && (
        <p className="text-sm text-muted-foreground">{t(`${K}.withdrawNote`)}</p>
      )}
      {failed && <p className="text-sm text-foreground">{t(`${K}.failed`)}</p>}
    </div>
  );
}
