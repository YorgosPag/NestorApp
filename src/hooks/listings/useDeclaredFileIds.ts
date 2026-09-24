'use client';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΜΙΑΣ ΔΗΛΩΣΗΣ ΤΟΥ ΑΚΙΝΗΤΟΥ** — αισιοδοξία, γραφή, συμφιλίωση.
 * @related ADR-841 §7 (Α14.7 · Α17.7) · ADR-880 · lib/listings/declared-file-ids
 * @module hooks/listings/useDeclaredFileIds
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΗΧΘΗ ΕΠΕΙΔΗ ΤΟ **jscpd ΤΟ ΚΑΤΗΓΓΕΙΛΕ** — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΒΛΕΦΘΕΝ (N.18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο δηλώσεις της αγγελίας *(σειρά ⊕ κατόψεις)* γεννήθηκαν ως **δύο hooks με
 * ταυτόσημο σκελετό**: ίδια αισιόδοξη κατάσταση, ίδια τέσσερα `useState`, ίδια
 * συμφιλίωση, ίδιο `try/catch/finally`. Το **CHECK 3.28** το μέτρησε: *«7 γραμμές / 56
 * tokens»* — ακριβώς πάνω από το κατώφλι των 50, και ακριβώς το σχήμα που ο κανόνας
 * **N.18** ονομάζει *«κεντρικοποιείς το Α, γράφεις Β ως δίδυμο»*.
 *
 * 🔑 **ΚΑΙ ΤΟ ΕΥΡΗΜΑ ΗΤΑΝ ΣΩΣΤΟ**: ο κύκλος ζωής μιας δήλωσης **δεν** εξαρτάται από το τι
 * δηλώνεται. Ό,τι διαφέρει δίνεται ως όρισμα: **ποιο πεδίο** γράφεται, **πώς διαβάζεται**, **πότε
 * δύο δηλώσεις είναι ίδιες** και **πώς γίνεται σύρμα**.
 *
 * 🎯 **ADR-880 — η τρίτη δήλωση (σημεία εστίασης) έκανε τη μηχανή ΓΕΝΙΚΗ στο πεδίο**, αντί να γεννηθεί
 * τρίτο δίδυμο: ένας χάρτης `fileId → σημείο` έχει τον **ίδιο** κύκλο ζωής με έναν πίνακα ταυτοτήτων.
 *
 * ⛔ **Εδώ ΔΕΝ ζει καμία απόφαση**: ούτε τι σημαίνει «πρώτη», ούτε «κάτοψη», ούτε «εστίαση».
 * Ίδιο δόγμα με το `lib/ordering/total-name-order` — *η μηχανή κοινή, η απόφαση όχι*.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { updateProperty } from '@/services/properties.service';
import { createModuleLogger } from '@/lib/telemetry';
import { declaredFileIds, type DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

const logger = createModuleLogger('useDeclaredFileIds');

/**
 * **Οι τιμές κάθε πεδίου δήλωσης του `properties/{id}`** — ό,τι βλέπει η οθόνη, πριν γίνει σύρμα.
 *
 * 🔑 **Κλειστό σύνολο κλειδιών και όχι `string`**: το πεδίο ταξιδεύει σε `updateProperty`, δηλαδή σε
 * **γραφή εγγράφου**. Ένα `string` εδώ θα επέτρεπε τυπογραφικό λάθος να γράψει **νέο πεδίο** στο
 * έγγραφο του ακινήτου, σιωπηλά — και η πόρτα του PATCH είναι `.passthrough()` *(Α14.7.5)*.
 */
export interface PropertyDeclarationValues {
  readonly publishedMediaOrder: DeclaredFileIds;
  readonly publishedFloorplans: DeclaredFileIds;
  readonly publishedMediaFocalPoints: ReadonlyMap<string, PhotoFocalPoint>;
}

export type PropertyDeclarationField = keyof PropertyDeclarationValues;

/** Τα δύο πεδία **δήλωσης αρχείων** (ADR-841 §7 Α14.7 · Α17.7). */
export type DeclarationField = 'publishedMediaOrder' | 'publishedFloorplans';

/** Πώς διαβάζεται, συγκρίνεται και γράφεται **ένα** πεδίο — τα τρία πράγματα που διαφέρουν. */
export interface PropertyDeclarationCodec<T> {
  readonly read: (stored: unknown) => T;
  readonly equals: (a: T, b: T) => boolean;
  readonly toWire: (value: T) => unknown;
}

/** **Ίδιες ταυτότητες, ΙΔΙΑ ΣΕΙΡΑ** — για δήλωση όπου η σειρά **είναι** το περιεχόμενο. */
export function sameSequence(a: DeclaredFileIds, b: DeclaredFileIds): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** **Ίδιες ταυτότητες, ΑΔΙΑΦΟΡΗ ΣΕΙΡΑ** — για δήλωση που είναι **σύνολο**. */
export function sameSet(a: DeclaredFileIds, b: DeclaredFileIds): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  return b.every((id) => left.has(id));
}

export interface PropertyDeclarationState<T> {
  /** Η δήλωση όπως τη βλέπει **αυτή τη στιγμή** ο άνθρωπος (αισιόδοξη ή αποθηκευμένη). */
  readonly declared: T;
  /** Γράφεται τώρα — η πράξη κλειδώνει ώστε δύο κλικ να μη γίνουν δύο αγώνες. */
  readonly saving: boolean;
  /** Η τελευταία προσπάθεια απέτυχε **και η οθόνη γύρισε πίσω**. */
  readonly failed: boolean;
  readonly commit: (next: T) => Promise<void>;
}

/** Η κατάσταση μιας δήλωσης αρχείων — ειδική περίπτωση του {@link PropertyDeclarationState}. */
export type DeclaredFileIdsState = PropertyDeclarationState<DeclaredFileIds>;

/**
 * **Ο κύκλος ζωής μιας δήλωσης πάνω στο έγγραφο του ακινήτου.**
 *
 * 🔑 **ΑΙΣΙΟΔΟΞΗ ΓΡΑΦΗ ΜΕ ΣΥΜΦΙΛΙΩΣΗ, ΟΧΙ ΜΕ ΛΗΞΗ ΧΡΟΝΟΥ** (N.7.2 #1): η τοπική δήλωση
 * υπερισχύει **μέχρι το αποθηκευμένο έγγραφο να πει το ίδιο πράγμα**, και τότε
 * αποσύρεται. Ένα σκέτο `setState` που δεν αποσύρεται ποτέ θα **έκρυβε** μια μελλοντική
 * αλλαγή από άλλη καρτέλα ή άλλον συνάδελφο· ένα `setTimeout` θα μάντευε πότε έφτασε το
 * `onSnapshot`. Η συμφιλίωση **ρωτά**, δεν μαντεύει.
 *
 * ⚠️ **Αποτυχία ⇒ ΕΠΑΝΑΦΟΡΑ, όχι σιωπή** (`failed`). Κατάσταση που φαίνεται αλλαγμένη
 * ενώ ο διακομιστής την απέρριψε είναι χειρότερη από σφάλμα: ο άνθρωπος φεύγει
 * πιστεύοντας ότι η αγγελία του άλλαξε.
 *
 * ⚠️ **`saving` κλειδώνει την πράξη** (N.7.2 #2): δύο γρήγορα κλικ θα ήταν δύο PATCH στο
 * **ίδιο** έγγραφο, και ποιο γράφεται τελευταίο δεν το αποφασίζει κανείς εδώ.
 *
 * 🔑 **Ο ΥΠΑΡΧΩΝ γραφέας**, ποτέ δεύτερη διαδρομή γραφής: το `updateProperty` περνά από
 * το PATCH `/api/properties/[id]`, που **ήδη** ξαναδημοσιεύει την αγγελία
 * (`republishPublicProjection`). Η δήλωση φτάνει στον κόσμο από την **ίδια πόρτα** με
 * κάθε άλλη αλλαγή του ακινήτου.
 */
export function usePropertyDeclaration<F extends PropertyDeclarationField>(
  propertyId: string,
  field: F,
  storedValue: unknown,
  codec: PropertyDeclarationCodec<PropertyDeclarationValues[F]>,
): PropertyDeclarationState<PropertyDeclarationValues[F]> {
  type T = PropertyDeclarationValues[F];
  const { read, equals, toWire } = codec;
  const stored = useMemo(() => read(storedValue), [read, storedValue]);
  const [optimistic, setOptimistic] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // 🔑 Η **συμφιλίωση**: μόλις το αποθηκευμένο συμφωνήσει με το αισιόδοξο, το αισιόδοξο
  //    δεν έχει πια δουλειά — και πρέπει να φύγει, αλλιώς σκιάζει κάθε επόμενη αλλαγή.
  useEffect(() => {
    if (optimistic !== null && equals(stored, optimistic)) setOptimistic(null);
  }, [stored, optimistic, equals]);

  const commit = useCallback(
    async (next: T): Promise<void> => {
      if (saving) return;
      setOptimistic(next);
      setSaving(true);
      setFailed(false);
      try {
        await updateProperty(propertyId, { [field]: toWire(next) });
      } catch (error) {
        setOptimistic(null);
        setFailed(true);
        logger.warn('Η δήλωση δεν αποθηκεύτηκε', {
          propertyId,
          field,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setSaving(false);
      }
    },
    [field, propertyId, saving, toWire],
  );

  return { declared: optimistic ?? stored, saving, failed, commit };
}

/** Η δήλωση αρχείων στο σύρμα είναι ο ίδιος ο πίνακας. */
const fileIdsToWire = (value: DeclaredFileIds): unknown => [...value];

/**
 * **Δήλωση αρχείων** (σειρά · κατόψεις) — λεπτό περιτύλιγμα του {@link usePropertyDeclaration}.
 * ⚠️ Ο `equals` ορίζει την ταυτότητα της δήλωσης (σειρά ή σύνολο) — γι' αυτό τον δίνει ο καλών.
 */
export function useDeclaredFileIds(
  propertyId: string,
  field: DeclarationField,
  storedValue: unknown,
  equals: (a: DeclaredFileIds, b: DeclaredFileIds) => boolean,
): DeclaredFileIdsState {
  const codec = useMemo<PropertyDeclarationCodec<DeclaredFileIds>>(
    () => ({ read: declaredFileIds, equals, toWire: fileIdsToWire }),
    [equals],
  );
  return usePropertyDeclaration(propertyId, field, storedValue, codec);
}
