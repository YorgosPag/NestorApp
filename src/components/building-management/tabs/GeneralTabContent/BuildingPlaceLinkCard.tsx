'use client';

/**
 * @fileoverview **ΤΟ ΚΤΙΡΙΟ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ ΔΕΙΧΝΕΙ ΣΤΟ ΚΟΙΝΟ ΚΤΙΡΙΟ** — το μισό της §14.5 που έλειπε.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §14.3 · §14.4 · §14.5
 * @module components/building-management/tabs/GeneralTabContent/BuildingPlaceLinkCard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ ΚΕΝΟ, ΟΧΙ ΕΠΙΘΥΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `grep -rn "placeRef" src/services/properties src/types/property.ts` → **0**.
 * Ο **ιδιώτης** δήλωνε τον τόπο του από την Α14· ο **επαγγελματίας** —δηλαδή η
 * πλειοψηφία του αποθέματος— **δεν είχε πού**. Άρα κάθε αγγελία εταιρείας έφτανε στη
 * μηχανή ταιριάσματος με `place: null`, και μια ζήτηση Ζ3/Ζ5 («*ψάχνω **αυτό** το
 * κτίριο*») απαντούσε `place-unresolved` **για όλες**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΣΤΟ **ΚΤΙΡΙΟ** ΚΑΙ ΟΧΙ ΣΤΟ ΑΚΙΝΗΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Όλα τα διαμερίσματα ενός κτιρίου βρίσκονται στο **ίδιο** φυσικό κτίριο. Μια δήλωση
 * ανά ακίνητο θα ήταν **N αντίγραφα** του ίδιου γεγονότος — ακριβώς το *«χωρίς
 * διπλότυπα»* που το §14.5 ονομάζει **πρώτο** κριτήριο. Η προβολή το **κατεβάζει**
 * στην αγγελία (`collectPlaceKnowledge`), δεν το αντιγράφει στα έγγραφα.
 *
 * ⚠️ **Ο δεσμός δείχνει από το Β προς το Α, ΠΟΤΕ αντίστροφα** (§14.4 κανόνας 4): το
 * κοινό κτίριο δεν μαθαίνει ποτέ ποιος το διεκδίκησε, γιατί `read: if true` σημαίνει
 * ότι ό,τι γραφτεί εκεί το βλέπει **κάθε ανώνυμος**.
 *
 * ⚠️ **Ισχυρισμός, όχι απόδειξη** (§14.3). Ο διακομιστής επαληθεύει μόνο ότι ο τόπος
 * **υπάρχει**· ότι είναι **αυτός** ο τόπος το λέει ο άνθρωπος και μένει επώνυμο.
 */

import React, { useCallback, useState } from 'react';

import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import type { PlaceRef } from '@/types/geo/public-place';

const logger = createModuleLogger('BuildingPlaceLinkCard');
const NS = 'building-address';

/**
 * **Τι απάντησε ο διακομιστής** — και η διάκριση δεν είναι λεπτολογία.
 *
 * 🔴 Το `unverified` (**503**) λέει *«ξαναδοκίμασε, μην αλλάξεις τίποτα»*· το `rejected`
 * (**422**) λέει *«αυτός ο τόπος δεν υπάρχει, διάλεξε άλλον»*. Συγχωνευμένα, μια
 * στιγμιαία αστοχία της βάσης θα έστελνε τον επαγγελματία να **φτιάξει δεύτερη
 * ταυτότητα** για κτίριο που έχει ήδη μία — δηλαδή να παραγάγει ακριβώς το διπλότυπο
 * που όλο το επίπεδο Α υπάρχει για να αποτρέψει.
 */
type SaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'unverified' }
  | { readonly kind: 'failed' };

/** Οι κωδικοί που γεννά το `assertPlaceRefResolvable` του `building-update.handler`. */
const REJECTED_CODES: ReadonlySet<string> = new Set(['PLACE_REF_MALFORMED', 'PLACE_REF_ABSENT']);
const UNVERIFIED_CODE = 'PLACE_REF_UNVERIFIED';

export interface BuildingPlaceLinkCardProps {
  readonly buildingId: string;
  readonly placeRef: PlaceRef | null;
}

export function BuildingPlaceLinkCard({
  buildingId,
  placeRef,
}: BuildingPlaceLinkCardProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  // ⚠️ Τοπική αλήθεια μετά την αποθήκευση: το έγγραφο του κτιρίου φτάνει εδώ ως prop
  // από τον γονέα και **δεν** ξαναδιαβάζεται· χωρίς αυτό ο άνθρωπος θα έβλεπε τον
  // παλιό τόπο μέχρι το επόμενο φόρτωμα και θα νόμιζε ότι δεν αποθηκεύτηκε.
  const [chosen, setChosen] = useState<PlaceRef | null>(placeRef);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  const save = useCallback(
    async (next: PlaceRef | null): Promise<void> => {
      setState({ kind: 'saving' });

      const result = await updateBuildingWithPolicy({ buildingId, updates: { placeRef: next } });

      if (result.success) {
        setChosen(next);
        setState({ kind: 'saved' });
        return;
      }

      logger.warn('Ο δεσμός προς το επίπεδο Α δεν αποθηκεύτηκε', {
        buildingId,
        error: result.error,
        errorCode: result.errorCode,
      });

      if (result.errorCode !== undefined && REJECTED_CODES.has(result.errorCode)) {
        setState({ kind: 'rejected' });
        return;
      }
      setState({ kind: result.errorCode === UNVERIFIED_CODE ? 'unverified' : 'failed' });
    },
    [buildingId],
  );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{t('address.placeLink.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('address.placeLink.help')}</p>
      </header>

      {chosen === null && state.kind !== 'saving' && (
        <p className="text-sm text-muted-foreground">{t('address.placeLink.none')}</p>
      )}

      {/*
        ⚠️ **Η ΙΔΙΑ επιφάνεια με τη ζήτηση και με τον ιδιώτη** — και αυτό είναι το
        §14.5 σε μία γραμμή: τρεις διαφορετικοί άνθρωποι, τρεις φόρμες, **η ίδια**
        ταυτότητα στο τέλος. Ένα αντίγραφο ανά τομέα θα ήταν το σχήμα του ADR-749 στην
        πιο επικίνδυνη θέση του, γιατί η **σύγκριση** αυτών των τιμών **είναι** η
        μηχανή ταιριάσματος.

        🔑 Το `key` αναγκάζει το χειριστήριο να **ξαναγεννηθεί** μόλις αλλάξει ο
        αποθηκευμένος δεσμός: κρατά δική του κατάσταση «επεξεργασία;», και χωρίς αυτό
        θα έμενε ανοιχτό ο επιλογέας πάνω σε τόπο που μόλις αποθηκεύτηκε.
      */}
      <PlaceIdentityField
        key={chosen?.buildingId ?? chosen?.landId ?? 'none'}
        chosen={chosen}
        onChosen={(ref) => void save(ref)}
      />

      {chosen !== null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={state.kind === 'saving'}
          onClick={() => void save(null)}
        >
          {t('address.placeLink.clear')}
        </Button>
      )}

      <SaveNotice state={state} />
    </section>
  );
}

/** Κάθε κατάσταση λέγεται ρητά — καμία `default`, καμία σιωπή. */
function SaveNotice({ state }: { readonly state: SaveState }): React.ReactElement | null {
  const { t } = useTranslation([NS]);

  switch (state.kind) {
    case 'idle':
      return null;
    case 'saving':
      return <p className="text-sm text-muted-foreground">{t('address.placeLink.saving')}</p>;
    case 'saved':
      return <p className="text-sm text-muted-foreground">{t('address.placeLink.saved')}</p>;
    case 'rejected':
      return <p className="text-sm text-foreground">{t('address.placeLink.rejected')}</p>;
    case 'unverified':
      return <p className="text-sm text-foreground">{t('address.placeLink.unverified')}</p>;
    case 'failed':
      return <p className="text-sm text-foreground">{t('address.placeLink.failed')}</p>;
  }
}
