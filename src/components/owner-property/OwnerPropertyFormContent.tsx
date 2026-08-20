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
  createBrokeredOwnerListing,
  createOwnerListing,
  newOwnerPropertyId,
  updateOwnerListing,
  type BrokeredNotifyOutcome,
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

  /**
   * 🔴 **ΤΟ ΑΚΡΟΑΤΗΡΙΟ (§8.33)** — απών για τον ιδιώτη, παρών για το γραφείο.
   *
   * 🔑 **Μία φόρμα, δύο ακροατήρια — ΟΧΙ δεύτερη φόρμα.** Τα πεδία του ακινήτου
   * (§25.6), οι διαθέσεις (Α20), η θέση (Α5) και τα αρχεία είναι **ταυτόσημα** για
   * τον ιδιώτη και για τον μεσίτη: αλλάζει **ποιανού είναι**, όχι **τι είναι**. Ένα
   * δεύτερο αντίγραφο αυτού του αρχείου θα ήταν κλώνος που μπλοκάρει το CHECK 3.28 —
   * και, χειρότερα, θα απέκλινε: η μία φόρμα θα μάθαινε νέο πεδίο και η άλλη όχι.
   *
   * ⚠️ **Η εντολή κρατά ΔΙΚΗ ΤΗΣ κατάσταση, στη σελίδα.** Δεν μπαίνει στο
   * `OwnerPropertyFormValues`, γιατί εκείνο είναι το σχήμα **του ακινήτου** και ο
   * ιδιώτης θα κουβαλούσε για πάντα τέσσερα πεδία που δεν τον αφορούν.
   */
  readonly mandate?: {
    /** Τα πεδία της εντολής, όπως τα ζωγραφίζει η σελίδα του γραφείου. */
    readonly section: React.ReactNode;
    /** Τι λείπει **από την εντολή** — μπαίνει στην ίδια λίστα με τα άλλα εμπόδια. */
    readonly blockers: readonly string[];
    /** Το αίτημα προς τον διακομιστή, όταν η εντολή είναι πλήρης. */
    readonly request: {
      readonly clientContactId: string;
      readonly expiresAt: string;
      readonly via: string;
      readonly documentPath: string | null;
    };
    /** Λέγεται στην οθόνη μόλις απαντήσει ο διακομιστής. */
    readonly onNotify: (outcome: BrokeredNotifyOutcome | undefined) => void;
  };
}

export function OwnerPropertyFormContent({
  initialValues = EMPTY_OWNER_PROPERTY_FORM,
  editingId = null,
  previousOffers = [],
  mandate,
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

  const propertyValidation = React.useMemo(
    () =>
      validateOwnerPropertyForm(values, {
        previous: previousOffers,
        mintOfferId: () => enterpriseIdService.generatePropertyOfferId(),
      }),
    [values, previousOffers],
  );

  /**
   * 🔴 **ΤΑ ΕΜΠΟΔΙΑ ΤΗΣ ΕΝΤΟΛΗΣ ΜΠΑΙΝΟΥΝ ΣΤΗΝ ΙΔΙΑ ΛΙΣΤΑ, ΟΧΙ ΣΕ ΔΕΥΤΕΡΗ.**
   *
   * Η **Α14 §17.2** δεσμεύτηκε ότι ο άνθρωπος βλέπει **πόσο κοντά είναι** — και δύο
   * λίστες «τι λείπει» σε μία οθόνη σημαίνουν ότι μπορεί να διορθώσει τη μία, να δει
   * το κουμπί ακόμη ανενεργό, και να μην ξέρει γιατί.
   *
   * ⚠️ Μια πλήρης φόρμα ακινήτου με **ελλιπή** εντολή δεν είναι `ready`: το `draft`
   * υπάρχει, αλλά δεν υπάρχει **πράξη** να γίνει με αυτό.
   */
  const validation = React.useMemo(() => {
    if (mandate === undefined || mandate.blockers.length === 0) return propertyValidation;
    if (propertyValidation.kind === 'ready') {
      return {
        kind: 'incomplete' as const,
        malformed: [] as readonly string[],
        blockers: mandate.blockers,
        violations: [] as readonly never[],
      };
    }
    return {
      ...propertyValidation,
      blockers: [...propertyValidation.blockers, ...mandate.blockers],
    };
  }, [propertyValidation, mandate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (validation.kind !== 'ready' || user === null) return;

    setSubmitState('saving');

    // 🔑 **Δύο ρητά μονοπάτια, ΟΧΙ ένα με τριαδικό στην ταυτότητα.** Το `editingId`
    // λέει ποια πράξη είναι· το `draftId` είναι η ταυτότητα και στις δύο (στην
    // επεξεργασία **είναι** το `editingId`, βλ. τον αρχικοποιητή).
    // 🔑 **Τρία ρητά μονοπάτια.** Το τρίτο (γραφείο) δεν είναι «το πρώτο με ένα πεδίο
    // παραπάνω»: χτυπά **άλλη πόρτα**, που απαιτεί εταιρεία και γεννά την έγκριση από
    // τον δρόμο απόδειξης αντί να τη δεχτεί από το σώμα.
    const outcome =
      editingId !== null
        ? await updateOwnerListing(editingId, validation.draft)
        : mandate === undefined
          ? await createOwnerListing(draftId, validation.draft)
          : await createBrokeredOwnerListing(draftId, validation.draft, mandate.request);

    if (mandate !== undefined) {
      mandate.onNotify(
        'notify' in outcome ? (outcome.notify as BrokeredNotifyOutcome | undefined) : undefined,
      );
    }

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
      {mandate?.section}
      <OwnerIdentityFields />
      <OwnerBasicsFields />
      <OwnerOffersField />
      <OwnerPropertyPlaceField />
      <OwnerPropertyMediaField
        authorUserId={user?.uid ?? null}
        ownerPropertyId={draftId}
      />
    </DraftFormShell>
  );
}
