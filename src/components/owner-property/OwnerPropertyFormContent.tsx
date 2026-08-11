'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΤΗΣ ΠΡΟΣΦΟΡΑΣ** — δομημένα δεδομένα, όχι «κάτοψη και τηλέφωνο».
 * @related ADR-777 §7 (Α14 §17.1/§17.2 · Α20 · Α22 · Α8) · §25.6 · §8.16
 * @module components/owner-property/OwnerPropertyFormContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΦΟΡΜΑ ΔΕΝ ΕΙΝΑΙ ΓΡΑΦΕΙΟΚΡΑΤΙΑ — §17.1
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *Ακίνητο χωρίς πεδία είναι **αόρατο στη μηχανή ταιριάσματος** — δεν συναντά καμία
 * > από τις Ζ1–Ζ8, κανένα φίλτρο, καμία βαθμίδα ζουμ. **Υπάρχει στη βάση και δεν
 * > συναντά ποτέ τίποτα.***
 *
 * Άρα τα πεδία **είναι** ο πυρήνας, και τα αρχεία είναι το «ό,τι έχεις». Μια φόρμα
 * «φωτογραφία + τηλέφωνο» θα γεννούσε ακριβώς το ακίνητο που το §14.5 δεσμεύτηκε να
 * αποτρέψει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΟΛΕΣ ΟΙ ΠΑΡΑΒΙΑΣΕΙΣ, ΣΥΝΕΧΩΣ — ΠΟΤΕ ΜΙΑ ΤΗ ΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επικύρωση τρέχει **σε κάθε αλλαγή** ({@link validateOwnerPropertyForm} πάνω σε
 * `watch()`), και η λίστα είναι ορατή **πριν** πατηθεί κουμπί — η **Α14 §17.2**
 * δεσμεύτηκε ότι *«η φόρμα μικραίνει όσο δίνεις»*, και ο άνθρωπος δεν μπορεί να ξέρει
 * **πόσο κοντά είναι** αν του λέμε ένα σφάλμα τη φορά.
 *
 * ⚠️ **Το κουμπί απενεργοποιείται, αλλά ο λόγος είναι ΠΑΝΤΑ γραμμένος από πάνω.** Ένα
 * ανενεργό κουμπί χωρίς εξήγηση είναι ο ορισμός του αδιεξόδου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΤΑΥΤΟΤΗΤΑ ΓΕΝΝΙΕΤΑΙ **ΜΙΑ ΦΟΡΑ**, ΣΤΟ ΑΝΟΙΓΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα αρχεία ζουν στο `owner_properties/{uid}/{ownerPropertyId}/…` ⇒ η διαδρομή
 * αποθήκευσης προϋποθέτει την ταυτότητα **πριν** υπάρξει το έγγραφο. Το `useState`
 * με **αρχικοποιητή συνάρτησης** την παράγει σε **μία** απόδοση· μια ταυτότητα που
 * αλλάζει θα σκόρπιζε τα ανεβασμένα αρχεία σε φακέλους που κανείς δεν ξαναβρίσκει.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { useAuth } from '@/auth/hooks/useAuth';
import {
  DraftFormShell,
  type DraftFormProps,
  type DraftSubmitState,
} from '@/components/shared/forms/DraftFormShell';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  EMPTY_OWNER_PROPERTY_FORM,
  type OwnerPropertyFormValues,
} from '@/lib/owner-property/owner-property-form-values';
import { validateOwnerPropertyForm } from '@/lib/owner-property/owner-property-form-validation';
import { MY_OFFERS_ROUTE, offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import {
  createOwnerListing,
  newOwnerPropertyId,
  updateOwnerListing,
} from '@/services/owner-property/owner-property.service';
import type { PropertyOffer } from '@/types/property-offers';

import { OwnerPropertyMediaField } from './form/OwnerPropertyMediaField';
import { OwnerPropertyPlaceField } from './form/OwnerPropertyPlaceField';
import {
  OwnerBasicsFields,
  OwnerIdentityFields,
  OwnerOffersField,
} from './form/OwnerPropertyFields';

export interface OwnerPropertyFormContentProps
  extends DraftFormProps<OwnerPropertyFormValues> {
  /**
   * Οι **υπάρχουσες** διαθέσεις, όταν επεξεργαζόμαστε.
   *
   * 🔴 **Δεν είναι πλεονασμός των `initialValues`.** Η φόρμα κρατά **ποσά**, όχι
   * διαθέσεις — και η **Α20 σημείο 4** στηρίζεται στην **ταυτότητα** κάθε διάθεσης
   * (*«το κλείσιμο μιας διάθεσης αποσύρει τις άλλες»*). Χωρίς αυτές, κάθε αποθήκευση
   * θα γεννούσε **νέα** `offr_*` και το ιστορικό θα έσπαγε σιωπηλά.
   */
  readonly previousOffers?: readonly PropertyOffer[];
}

export function OwnerPropertyFormContent({
  initialValues = EMPTY_OWNER_PROPERTY_FORM,
  editingId = null,
  previousOffers = [],
}: OwnerPropertyFormContentProps): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const [submitState, setSubmitState] = React.useState<DraftSubmitState>('idle');

  // 🔑 **Αρχικοποιητής συνάρτησης**: εκτελείται σε μία απόδοση και ποτέ ξανά. Ένα
  // `useState(newOwnerPropertyId())` θα καλούσε τη γεννήτρια σε **κάθε** απόδοση
  // (πετώντας το αποτέλεσμα) — δουλειά χωρίς καταναλωτή, και εύκολο να γίνει σφάλμα.
  const [draftId] = React.useState<string>(() => editingId ?? newOwnerPropertyId());

  const form = useForm<OwnerPropertyFormValues>({ defaultValues: initialValues });

  // ⚠️ `watch()` χωρίς όνομα επιστρέφει **όλες** τις τιμές και ξαναποδίδει σε κάθε
  // αλλαγή — που είναι **ακριβώς** το ζητούμενο: η λίστα «τι λείπει» οφείλει να είναι
  // ζωντανή, όχι στιγμιότυπο υποβολής.
  const values = form.watch();

  const validation = React.useMemo(
    () =>
      validateOwnerPropertyForm(values, {
        previous: previousOffers,
        mintOfferId: () => enterpriseIdService.generatePropertyOfferId(),
      }),
    [values, previousOffers],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (validation.kind !== 'ready' || user === null) return;

    setSubmitState('saving');

    // 🔑 **Δύο ρητά μονοπάτια, ΟΧΙ ένα με τριαδικό στην ταυτότητα.** Το `editingId`
    // λέει ποια πράξη είναι· το `draftId` είναι η ταυτότητα και στις δύο (στην
    // επεξεργασία **είναι** το `editingId`, βλ. τον αρχικοποιητή).
    const outcome =
      editingId === null
        ? await createOwnerListing(draftId, validation.draft)
        : await updateOwnerListing(editingId, validation.draft);

    // `invalid` **δεν πρέπει** να φτάσει εδώ — το κουμπί είναι ανενεργό όσο υπάρχουν
    // παραβιάσεις, και ο **ίδιος** κριτής τρέχει και στις δύο πλευρές. Αν φτάσει,
    // είναι πραγματική απόκλιση: λέγεται ως αποτυχία, όχι ως σιωπή.
    if (outcome.kind !== 'saved') {
      setSubmitState('failed');
      return;
    }
    router.push(offerDetailHref(outcome.property.id));
  }

  return (
    <DraftFormShell
      keyBase="offer"
      form={form}
      editing={editingId !== null}
      validation={validation}
      submitState={submitState}
      onSubmit={handleSubmit}
      onCancel={() => router.push(MY_OFFERS_ROUTE)}
    >
      <OwnerIdentityFields />
      <OwnerBasicsFields />
      <OwnerOffersField />
      <OwnerPropertyPlaceField />
      <OwnerPropertyMediaField
        ownerUserId={user?.uid ?? null}
        ownerPropertyId={draftId}
      />
    </DraftFormShell>
  );
}
