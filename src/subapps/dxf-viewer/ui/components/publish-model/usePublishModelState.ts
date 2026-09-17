'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΟΥ ΧΕΙΡΙΣΤΗΡΙΟΥ** — τι ρωτήθηκε ο άνθρωπος, και τι λείπει ακόμη.
 * @related ADR-845 §7.5 (Φ4.2β/Βήμα Γ) · ADR-841 §7 Α10 (υπογράφων) · Α11 (σήμανση)
 * @module subapps/dxf-viewer/ui/components/publish-model/usePublishModelState
 *
 * 🔑 **Καμία προεπιλογή σε τίποτα που είναι ΙΣΧΥΡΙΣΜΟΣ.** Ούτε ακίνητο, ούτε υπογράφων, ούτε
 * ημερομηνία μελέτης: μια προεπιλογή εδώ θα σήμαινε ότι **ο πρώτος που θα ξεχάσει να απαντήσει
 * δημοσιεύει** — το ίδιο σκεπτικό που το `ModelPublicationDeclaration` γράφει για τα δικά του
 * τρία πεδία. Η **σήμανση** έχει αρχική τιμή `as-built` επειδή είναι το **λιγότερο** ισχυρό
 * που μπορεί να πει ένα μοντέλο *(«αυτό υπάρχει»)* — και είναι ρητά ορατή στην οθόνη.
 *
 * ⚠️ Ο πρώτος καρπός της αρχής: το εύρος ορόφων **έχει** αρχική τιμή, γιατί *«ενεργός όροφος»*
 * είναι **ό,τι βλέπει ήδη** ο άνθρωπος, όχι ισχυρισμός για το ακίνητο.
 */

import * as React from 'react';

import { hasSignatory, type ModelStateMark } from '@/lib/listings/listing-model-declaration';
import type {
  ModelPublishRequest,
  ModelPublishScope,
} from '../../../io/model-publish/publish-model-to-property';

export interface PublishModelState {
  readonly propertyId: string;
  readonly scope: ModelPublishScope;
  readonly state: ModelStateMark;
  readonly name: string;
  readonly discipline: string;
  readonly studiedAt: string;
  readonly setPropertyId: (value: string) => void;
  readonly setScope: (value: ModelPublishScope) => void;
  readonly setState: (value: ModelStateMark) => void;
  readonly setName: (value: string) => void;
  readonly setDiscipline: (value: string) => void;
  readonly setStudiedAt: (value: string) => void;
  /** Μπορεί να φύγει; — **μία** ερώτηση, ώστε το κουμπί και ο έλεγχος να μη διαφωνήσουν. */
  readonly complete: boolean;
  readonly buildRequest: () => ModelPublishRequest;
}

export function usePublishModelState(): PublishModelState {
  const [propertyId, setPropertyId] = React.useState('');
  const [scope, setScope] = React.useState<ModelPublishScope>('active');
  const [state, setState] = React.useState<ModelStateMark>('as-built');
  const [name, setName] = React.useState('');
  const [discipline, setDiscipline] = React.useState('');
  const [studiedAt, setStudiedAt] = React.useState('');

  const signatory = React.useMemo(
    () => ({ name, discipline, studiedAt }),
    [name, discipline, studiedAt],
  );

  /**
   * ⚠️ **Το `hasSignatory` είναι Ο ΙΔΙΟΣ φρουρός με τον ψήστη** *(άγκυρα Α-4)* — όχι δεύτερη
   * διατύπωση του *«τι μετράει ως υπογραφή»*. Το χειριστήριο απλώς τον ρωτά **νωρίτερα**,
   * ώστε το κουμπί να είναι σβηστό αντί ο άνθρωπος να μάθει την άρνηση μετά το ανέβασμα.
   *
   * 🔑 **Η ημερομηνία μελέτης ζητιέται ΕΠΙΠΛΕΟΝ, και η ασυμμετρία είναι δηλωμένη**: ο
   * διακομιστής δεν την επιβάλλει *(η Α-4 ρωτά «υπάρχει υπογράφων;», όχι «πότε μελέτησε;»)*,
   * αλλά κενή ημερομηνία σε πεδίο που ρωτά *«πότε έγινε η μελέτη»* θα ταξίδευε ως **ψέμα**,
   * όχι ως κενό. ⛔ Και γι' αυτό **δεν** μπήκε στο `hasSignatory`: εκείνο φυλάει ήδη
   * δημοσιευμένα artifacts, και μια αλλαγή του θα άλλαζε **αναδρομικά** τι ήταν έγκυρο.
   */
  const complete =
    propertyId.trim() !== '' && hasSignatory(signatory) && studiedAt.trim() !== '';

  const buildRequest = React.useCallback(
    (): ModelPublishRequest => ({
      propertyId,
      scope,
      state,
      signatory,
      // 🔑 ADR-862 Φ0 Β10 — κανένα `actorUid`: την αρχειοθέτηση των προκατόχων την κάνει πλέον ο
      //    διακομιστής με τη **δική του** επαληθευμένη ταυτότητα (`ctx.uid`), ποτέ με τιμή του πελάτη.
    }),
    [propertyId, scope, state, signatory],
  );

  return {
    propertyId, scope, state, name, discipline, studiedAt,
    setPropertyId, setScope, setState, setName, setDiscipline, setStudiedAt,
    complete, buildRequest,
  };
}
