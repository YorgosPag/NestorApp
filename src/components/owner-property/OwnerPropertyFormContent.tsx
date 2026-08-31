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
import { useRouter } from '@/lib/workspace/navigation';
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
// 🔴 ADR-787 §5.3 ο — **Ο ΚΡΙΤΗΣ ΤΟΥ ΧΩΡΟΥ, ΟΧΙ ΔΕΥΤΕΡΟΣ.** Ο ίδιος που κάνει το
//    `useMyOwnerProperty` να απαντά `absent` για εταιρική αγγελία μέσα στον ιδιωτικό
//    χώρο· εδώ ρωτιέται **πριν** σταλεί κάποιος εκεί.
import { isPersonalCustody } from '@/lib/owner-property/listing-custody';
import { MY_OFFERS_ROUTE, offerDetailHref } from '@/lib/owner-property/owner-property-routes';
// 🔴 Ο προορισμός του χώρου **γραφείου** — ο κατάλογος εντολών. Η μόνη οθόνη που
//    υπάρχει: ο χώρος γραφείου **δεν έχει** σελίδα ανά αγγελία (μετρημένο στον δίσκο,
//    `app/(app)/o/[workspace]/listings/mandates/` = κατάλογος · new · requests).
import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import {
  createBrokeredOwnerListing,
  createOwnerListing,
  newOwnerPropertyId,
  updateOwnerListing,
  type BrokeredNotifyOutcome,
} from '@/services/owner-property/owner-property.service';
import { useOwnerPropertyDraftMemory } from '@/hooks/owner-property/useOwnerPropertyDraftMemory';
import { draftIdentityBlockers } from '@/lib/forms/draft-identity';
import { withExtraBlockers } from '@/lib/forms/draft-validation';
import {
  useOfferFormText,
  type OfferBlocker,
  type OfferViolation,
} from '@/components/owner-property/offer-form-labels';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import type { OwnerPropertyInvariant } from '@/types/owner-property-invariants';
import type { PropertyOffer } from '@/types/property-offers';

import { OwnerPropertyMediaField } from './form/OwnerPropertyMediaField';
import { RestoredDraftNotice } from './form/RestoredDraftNotice';
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

  const memory = useOwnerPropertyDraftMemory(editingId);

  // 🔑 **Αρχικοποιητής συνάρτησης**: εκτελείται σε μία απόδοση και ποτέ ξανά. Ένα
  // `useState(newOwnerPropertyId())` θα καλούσε τη γεννήτρια σε **κάθε** απόδοση
  // (πετώντας το αποτέλεσμα) — δουλειά χωρίς καταναλωτή, και εύκολο να γίνει σφάλμα.
  //
  // 🔴 **Η ΣΕΙΡΑ ΤΩΝ ΤΡΙΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ** (ADR-660 §5.10): επεξεργασία → η
  // υπάρχουσα ταυτότητα· επαναφορά → **η ίδια** που είχε κοπεί πριν φύγει ο άνθρωπος
  // να συνδεθεί· αλλιώς → καινούργια. Αν η επαναφορά έκοβε νέα, τα αρχεία του θα
  // κατέληγαν σε **άλλον φάκελο** από αυτόν που δηλώνει η αγγελία, και η σταθερότητα
  // της ταυτότητας — που είναι όλη η θέση του §5.9 — θα ίσχυε μέχρι το πρώτο login.
  const [draftId] = React.useState<string>(
    () => editingId ?? memory.restored?.draftId ?? newOwnerPropertyId(),
  );

  const form = useForm<OwnerPropertyFormValues>({
    defaultValues: memory.restored?.values ?? initialValues,
  });

  // ⚠️ `watch()` χωρίς όνομα επιστρέφει **όλες** τις τιμές και ξαναποδίδει σε κάθε
  // αλλαγή — που είναι **ακριβώς** το ζητούμενο: η λίστα «τι λείπει» οφείλει να είναι
  // ζωντανή, όχι στιγμιότυπο υποβολής.
  const values = form.watch();

  /**
   * 🔑 **Γράφεται ΜΟΝΟ όταν ο άνθρωπος έχει αγγίξει τη φόρμα** (`isDirty`).
   *
   * ⚠️ Χωρίς αυτό, το **άνοιγμα** της σελίδας θα αποθήκευε **κενό** προσχέδιο, και
   * την επόμενη φορά ο άνθρωπος θα έβλεπε «επαναφέραμε το προσχέδιό σου» πάνω σε
   * άδεια φόρμα — υπόσχεση που δεν έχει αντικείμενο.
   *
   * ⚠️ **Ποτέ στην επεξεργασία**: εκεί υπάρχει ήδη αποθηκευμένη αγγελία, και η μνήμη
   * του περιηγητή δεν έχει καμία δουλειά να συναγωνίζεται τον διακομιστή.
   */
  React.useEffect(() => {
    if (editingId !== null || !form.formState.isDirty) return;
    memory.remember(draftId, values);
  }, [editingId, form.formState.isDirty, memory, draftId, values]);

  const propertyValidation = React.useMemo(
    () =>
      validateOwnerPropertyForm(values, {
        previous: previousOffers,
        mintOfferId: () => enterpriseIdService.generatePropertyOfferId(),
      }),
    [values, previousOffers],
  );

  /**
   * 🔴 **ΤΑ ΕΜΠΟΔΙΑ ΤΟΥ ΠΕΡΙΒΑΛΛΟΝΤΟΣ ΜΠΑΙΝΟΥΝ ΣΤΗΝ ΙΔΙΑ ΛΙΣΤΑ, ΟΧΙ ΣΕ ΔΕΥΤΕΡΗ.**
   *
   * Η **Α14 §17.2** δεσμεύτηκε ότι ο άνθρωπος βλέπει **πόσο κοντά είναι** — και δύο
   * λίστες «τι λείπει» σε μία οθόνη σημαίνουν ότι μπορεί να διορθώσει τη μία, να δει
   * το κουμπί ακόμη ανενεργό, και να μην ξέρει γιατί.
   *
   * ⚠️ Μια πλήρης φόρμα ακινήτου με **ελλιπή** εντολή δεν είναι `ready`: το `draft`
   * υπάρχει, αλλά δεν υπάρχει **πράξη** να γίνει με αυτό.
   *
   * ✅ **ΔΕΥΤΕΡΗ ΠΗΓΗ — Η ΤΑΥΤΟΤΗΤΑ (2026-08-23, ADR-660 §5.9).** Ισχύει γι' αυτήν
   * **κατά λέξη** ό,τι ίσχυε για την εντολή: δεν προκύπτει από ό,τι πληκτρολόγησε ο
   * άνθρωπος, άρα δεν μπορεί να ζει στο `blockersOf` — και η θέση της είναι η **ίδια**
   * λίστα, όχι δεύτερη.
   *
   * ⚠️ **Μπαίνει ΤΕΛΕΥΤΑΙΑ**, και είναι σειρά-συμβόλαιο: όλα τα άλλα λένε *«συμπλήρωσε
   * κάτι»*, ενώ ο λογαριασμός λέει *«σώσε ό,τι συμπλήρωσες»* — το βήμα που έρχεται
   * **αφού** δοθεί η αξία, ποτέ πριν (§5.2, «useful screen»).
   */
  // 🔑 **ΤΑ ΚΕΙΜΕΝΑ ΤΗΣ ΒΑΣΗΣ «offer»**, από τον ΕΝΑ μεταφραστή της. Κάθε `t()` ζει
  //    εκεί, με **σταθερά module** — άρα το βλέπει και ο τεμαχιστής και η CHECK 3.8.
  const formText = useOfferFormText();

  const contextBlockers = React.useMemo<readonly OfferBlocker[]>(
    () => [...(mandate?.blockers ?? []), ...draftIdentityBlockers(user?.uid ?? null)],
    [mandate, user],
  );

  /**
   * 🔑 **Η συγχώνευση ζει στο SSoT** ({@link withExtraBlockers}), όχι εδώ: ήταν
   * γραμμένη σε αυτό το αρχείο όσο η πηγή ήταν **μία**, και με τη δεύτερη θα γινόταν
   * δίδυμο **σειράς** — ποιο εμπόδιο πρώτο, τι γίνεται όταν η φόρμα είναι `ready`
   * αλλά το περιβάλλον όχι.
   *
   * ⚠️ **Τα ρητά γενικά ορίσματα δεν είναι διακόσμηση** — και από τις 2026-08-29
   * **δεν είναι πια `string`**: τα τρία ανεξάρτητα λεξιλόγια (`offer` · `mandate` ·
   * `identity`) ενώνονται **ονομαστικά** στο {@link OfferBlocker}. Το `string` τα
   * άφηνε να συνυπάρχουν, αλλά **επέτρεπε και κωδικό που δεν έχει κείμενο** — τώρα
   * αυτό **δεν μεταγλωττίζεται**.
   */
  const validation = React.useMemo(
    () =>
      withExtraBlockers<OwnerPropertyDraft, OfferBlocker, OfferViolation>(
        propertyValidation,
        contextBlockers,
      ),
    [propertyValidation, contextBlockers],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    // 🔴 **ΕΝΑΣ ΦΡΟΥΡΟΣ, ΟΧΙ ΔΥΟ** (ADR-660 §5.9). Μέχρι 2026-08-23 εδώ υπήρχε και
    // `|| user === null`, και ήταν **σιωπηλό αδιέξοδο**: το κουμπί ενεργοποιείται από
    // το `validation.kind === 'ready'`, οπότε μια πλήρης φόρμα χωρίς λογαριασμό
    // έδειχνε **ενεργό** κουμπί που δεν έκανε **τίποτα** — καμία αλλαγή κατάστασης,
    // κανένα μήνυμα. Πλέον η απουσία ταυτότητας είναι **ορατό εμπόδιο** παραπάνω,
    // άρα το `ready` το αποκλείει ήδη· δεύτερος έλεγχος εδώ θα ήταν δεύτερη απάντηση
    // στην ίδια ερώτηση, με τη μία από τις δύο αόρατη (ο καθρέφτης του ADR-749).
    if (validation.kind !== 'ready') return;

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
    // ⚠️ **Πρώτα η λήθη, μετά η πλοήγηση.** Ένα προσχέδιο που επιβιώνει της υποβολής
    // του θα επανερχόταν ως «ημιτελές» πάνω σε αγγελία που **δημοσιεύτηκε**.
    memory.forget();

    // ────────────────────────────────────────────────────────────────────────
    // 🔴 Ο ΠΡΟΟΡΙΣΜΟΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΧΩΡΟ **ΤΗΣ ΑΓΓΕΛΙΑΣ** (ADR-787 §5.3 ο)
    // ────────────────────────────────────────────────────────────────────────
    //
    // Ως τις 2026-08-31 αυτή η γραμμή ήταν `router.push(offerDetailHref(…))` **χωρίς
    // κανέναν όρο** — και η ίδια φόρμα φοριέται από **δύο** χώρους: τον προσωπικό
    // (`/offers/new`) και του **γραφείου** (`/o/<χώρος>/listings/mandates/new`).
    // Άρα μια αγγελία με `authorCompanyId: comp_…` στελνόταν στη διαδρομή του χώρου
    // όπου `authorCompanyId === null`, και ο μεσίτης διάβαζε *«Αυτό το ακίνητο δεν
    // υπάρχει — ή δεν είναι δικό σου»* για ακίνητο που **μόλις** δημιούργησε.
    //
    // 🔑 **ΤΟ ΜΗΝΥΜΑ ΗΤΑΝ ΣΩΣΤΟ· Η ΑΠΟΣΤΟΛΗ ΗΤΑΝ ΛΑΘΟΣ.** Το `useMyOwnerProperty`
    //    ρωτά **αυτόν ακριβώς** τον κριτή και απαντά `absent` — και έχει γραμμένο
    //    δίπλα του, **σε σχόλιο**, τον σωστό προορισμό: *«μια εταιρική αγγελία ζει
    //    στον χώρο του γραφείου, και η οθόνη της είναι ο κατάλογος εντολών»*. Ο
    //    κριτής ρωτιόταν **μόνο στον προορισμό**, ποτέ στην απόφαση να πάμε εκεί.
    //
    // ⚠️ **ΚΑΝΕΝΑΣ ΝΕΟΣ ΚΡΙΤΗΣ, ΚΑΙ ΚΑΜΙΑ ΝΕΑ ΙΔΙΟΤΗΤΑ.** Η θεματοφυλακή είναι
    //    **παράγωγη** από πεδία που γράφει η πύλη δημιουργίας και κανείς δεν μπορεί
    //    να στείλει από το δίκτυο (`listing-custody.ts`) — άρα ο προορισμός **δεν
    //    μπορεί** να διαφωνήσει με τον χώρο της αγγελίας. Μια `destination` ιδιότητα
    //    θα ήταν **δεύτερη αυθεντία** που ο επόμενος φορέας της φόρμας θα μπορούσε
    //    να συμπληρώσει λάθος — ακριβώς το σχήμα του ADR-749.
    //
    // ⚠️ **Δύο εντολές `push`, όχι τριαδικό**: κάθε κλήση κρατά τον **δικό της**
    //    στενό τύπο διεύθυνσης· μια ένωση των δύο θα φάρδαινε σε `string` και θα
    //    έκανε το σύνορο τυφλό (`route-worlds.ts`, «λείπει **μορφή**»).
    if (isPersonalCustody(outcome.property)) {
      router.push(offerDetailHref(outcome.property.id));
      return;
    }
    router.push(MANDATE_CATALOG_ROUTE);
  }

  /**
   * ⚠️ **Η απόρριψη κάνει ΔΥΟ πράγματα, και τα δύο είναι απαραίτητα**: καθαρίζει την
   * οθόνη **και** σβήνει τη μνήμη. Μόνο το πρώτο θα άφηνε το προσχέδιο να επανέλθει
   * στην επόμενη επίσκεψη — δηλαδή «ξεκίνα από την αρχή» που δεν ξεκινά από την αρχή.
   *
   * ⚠️ **Το `draftId` ΔΕΝ ξανακόβεται**, και είναι σωστό: μια ταυτότητα που δεν
   * χρησιμοποιήθηκε ποτέ δεν είναι «λερωμένη», ενώ η αλλαγή της μέσα στη ζωή της
   * φόρμας θα σκόρπιζε ό,τι είχε ήδη ανέβει (αν ο άνθρωπος είχε συνδεθεί εν τω μεταξύ).
   */
  function discardRestoredDraft(): void {
    form.reset(initialValues);
    memory.forget();
  }

  return (
    <DraftFormShell
      // 🔑 **ΚΕΙΜΕΝΑ, ΟΧΙ ΡΙΖΑ ΛΕΞΙΛΟΓΙΟΥ** — δες `lib/forms/draft-form-labels.ts`.
      //    Το `keyBase="offer"` έκανε τα κλειδιά άλυτα στατικά και ανάγκαζε το κοινό
      //    κέλυφος να δηλώνει **και** τη ρίζα της ζήτησης.
      text={formText}
      // 🔑 **ΤΟ ΑΚΡΟΑΤΗΡΙΟ ΕΙΝΑΙ Ο ΧΩΡΟΣ** (ADR-820 §5.2). Το `mandate` είναι ήδη ο
      //    διακρίτης των δύο πορτών — «απών για τον ιδιώτη, παρών για το γραφείο»
      //    (§8.33) — και είναι ακριβώς το ίδιο μπιτ που γίνεται `authorCompanyId`:
      //    `null` στην `/api/owner-properties`, `ctx.companyId` στην `…/brokered`.
      //    ⛔ ΜΗΝ βάλεις εδώ `useAuth()`: το ερώτημα είναι **ποια πόρτα**, όχι
      //    **ποιος ρωτά** — ο υπάλληλος περνά κι από τις δύο.
      custody={mandate === undefined ? 'personal' : 'company'}
      form={form}
      editing={editingId !== null}
      validation={validation}
      submitState={submitState}
      onSubmit={handleSubmit}
      onCancel={() => router.push(MY_OFFERS_ROUTE)}
    >
      {memory.noticeVisible && (
        <RestoredDraftNotice onKeep={memory.acknowledge} onDiscard={discardRestoredDraft} />
      )}
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
