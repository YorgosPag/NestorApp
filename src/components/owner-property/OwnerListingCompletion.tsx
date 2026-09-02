'use client';

/**
 * @fileoverview **ΠΟΣΟ ΠΛΗΡΗΣ ΕΙΝΑΙ Η ΑΓΓΕΛΙΑ ΣΟΥ — ΚΑΙ ΤΙ ΝΑ ΚΑΝΕΙΣ ΤΩΡΑ** (ADR-842 Φ5).
 * @related ADR-842 §5 (Α2 · Α5) · §6 #7 · §7 (Φ5) · ADR-287 (η μηχανή) · ADR-777 Α14
 * @module components/owner-property/OwnerListingCompletion
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🎯 ΤΟ ΚΙΝΗΤΡΟ ΠΡΙΝ ΤΗ ΦΟΡΜΑ — ΚΑΙ ΕΙΝΑΙ ΣΕΙΡΑ ΜΕ ΛΟΓΟ, ΟΧΙ ΔΙΑΤΑΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Φ5 τρέχει ΠΡΙΝ τη Φ4** επίτηδες (ADR-842 §7): πρώτα ο άνθρωπος **βλέπει τι
 * κερδίζει**, μετά του ζητείται να συμπληρώσει. Είναι το μοτίβο *«publish first, then
 * improve»* της Airbnb (§4) — και το αντίθετο του «γέμισε 40 πεδία πριν δημοσιεύσεις»,
 * που είναι ο λόγος που η `/offers/new` μένει **ακριβώς 8 πεδία** για πάντα (Α2).
 *
 * ⛔ **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΜΗΧΑΝΗ (Α5).** Αυτό το αρχείο **δεν υπολογίζει πληρότητα**: ρωτά
 * τον μεταφραστή (`listingCompletionArgs`) και τη μηχανή του ADR-287, και **ζωγραφίζει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΠΡΟΤΑΣΕΙΣ ΤΗ ΦΟΡΑ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΤΟ `PropertyCompletionBreakdown`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Υπάρχει ήδη οθόνη που δείχνει **όλες** τις ελλείψεις: το
 * `features/property-details/components/PropertyCompletionBreakdown.tsx`. Είναι
 * **σωστή για τον επαγγελματία** που ελέγχει την καρτέλα του — και **λάθος εδώ**.
 *
 * Το ADR-842 §6 #7 το γράφει ρητά: *«ΜΗΝ δείξεις όλες τις ελλείψεις μαζί… σωστό για
 * **φράγματα**, λάθος για **coaching**. Προτάσεις **3 τη φορά**.»* Είκοσι μία γραμμές
 * «λείπει» σε άνθρωπο που μόλις δημοσίευσε το σπίτι του διαβάζονται ως
 * **κατηγορητήριο** — και το μετρήσιμο αποτέλεσμα είναι ότι δεν συμπληρώνει **κανένα**.
 *
 * 🔑 Τα τρία **δεν** είναι τυχαία: είναι τα **βαρύτερα** που λείπουν (η μηχανή τα
 * επιστρέφει ήδη ταξινομημένα κατά βάρος), δηλαδή αυτά που μετακινούν περισσότερο τον
 * δείκτη. Και ο τίτλος λέει **πόσα** μένουν συνολικά — *«strong information scent»*
 * κατά NN/g, ποτέ «Περισσότερα».
 *
 * ⚠️ **ΜΗΔΕΝ ΝΕΑ ΚΛΕΙΔΙΑ i18n, ΜΕΤΡΗΜΕΝΟ.** Όλα τα κείμενα ζουν ήδη στο
 * `properties:completion.*` (τίτλος, οι τρεις βαθμίδες, και **και τα 17** ονόματα
 * πεδίων) από το ADR-287. Ένα δεύτερο σύνολο ετικετών για τα ίδια πεδία θα ήταν
 * δεύτερο μητρώο — και θα απέκλινε την πρώτη φορά που κάποιος μετονόμαζε ένα.
 */

import React from 'react';

import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { assessPropertyCompleteness } from '@/constants/property-completion';
import type { FieldKey } from '@/constants/field-completion-weights';
import { listingCompletionArgs } from '@/lib/listings/listing-completion-slice';
import type { PublicListing } from '@/types/public-listing';

import {
  completionBucketIndicatorClass,
  completionBucketTextClass,
} from '@/components/completion/completion-bucket-classes';

const NS = 'properties';
const K = `${NS}:completion`;

/**
 * Πόσες προτάσεις δείχνουμε **ταυτόχρονα**.
 *
 * ⛔ **ΜΗΝ το ανεβάσεις για να «φαίνονται όλα»** — αυτό είναι το
 * `PropertyCompletionBreakdown`, και είναι άλλη οθόνη για άλλον άνθρωπο (δες την
 * κεφαλίδα). Ο αριθμός είναι απόφαση του ADR-842 §6 #7.
 */
const SUGGESTIONS_AT_A_TIME = 3;

/** Μία πρόταση: το όνομα του πεδίου, από το **υπάρχον** μητρώο ετικετών. */
function Suggestion({ fieldKey }: { fieldKey: FieldKey }): React.ReactElement {
  const { t } = useTranslation([NS]);
  return <li className="text-sm text-foreground">{t(`${K}.fields.${fieldKey}`)}</li>;
}

/**
 * **Ο δείκτης πληρότητας της αγγελίας του ιδιώτη.**
 *
 * 🔑 **Η είσοδος είναι η ΔΗΜΟΣΙΑ αγγελία, όχι ο `OwnerProperty`** — και είναι η
 * ανατροπή που έφερε η μέτρηση της Φ5 (δες `listing-completion-slice.ts`): η ίδια
 * προβολή εξυπηρετεί **και** τον ιδιώτη **και** την εταιρεία, με μία γραφή. Έτσι ο
 * δείκτης μετρά **ακριβώς ό,τι βλέπει ο αγοραστής** — όχι ό,τι κρατά η βάση.
 */
export function OwnerListingCompletion({
  listing,
}: {
  readonly listing: PublicListing;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const colors = useSemanticColors();

  const assessment = React.useMemo(
    () => assessPropertyCompleteness(listingCompletionArgs(listing)),
    [listing],
  );

  // ⛔ Η μηχανή κρύβει τον δείκτη μόνο για `draft` — και μια **δημοσιευμένη** αγγελία
  //    δεν είναι πρόχειρο εξ ορισμού (δες `property-completion-stance.ts`). Η γραμμή
  //    μένει γιατί το συμβόλαιο της μηχανής το ζητά, όχι επειδή περιμένουμε να πυροδοτήσει.
  if (assessment.shouldHide) return null;

  const { percentage, bucketColor, missing } = assessment;
  const shown = missing.slice(0, SUGGESTIONS_AT_A_TIME);

  return (
    <section
      aria-label={t(`${K}.aria`)}
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{t(`${K}.title`)}</h2>
        <p className={cn('text-sm font-semibold', completionBucketTextClass(bucketColor, colors))}>
          {percentage}%
        </p>
      </header>

      <Progress
        value={percentage}
        className="h-2 bg-transparent"
        indicatorClassName={completionBucketIndicatorClass(bucketColor)}
      />

      {/*
        🔑 **Η ΒΑΘΜΙΔΑ ΜΕΤΡΑΕΙ ΤΟ ΣΩΣΤΟ ΠΡΑΓΜΑ ΣΕ ΚΑΘΕ ΧΡΩΜΑ.** Στο κόκκινο μιλάμε για
        τα **κρίσιμα** (εκεί είναι ο πόνος)· στο πορτοκαλί για **όλες** τις βελτιώσεις
        (εκεί μένουν μόνο μικρά). Το ίδιο κείμενο και στις δύο θα ήταν είτε
        τρομακτικό είτε ανακριβές.
      */}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {bucketColor === 'green'
          ? t(`${K}.bucket.green`)
          : bucketColor === 'amber'
            ? t(`${K}.bucket.amber`, { count: missing.length })
            : t(`${K}.bucket.red`, { count: assessment.missingCritical.length })}
      </p>

      {shown.length > 0 && (
        <>
          {/*
            📐 **NN/g — «strong information scent»**: η επικεφαλίδα λέει **τι** είναι η
            λίστα, και η βαθμίδα από πάνω λέει **πόσα** μένουν συνολικά. Ποτέ
            «Περισσότερα», που είναι η διατύπωση χωρίς άρωμα.
          */}
          <h3 className="text-sm font-medium text-foreground">{t(`${K}.breakdown.heading`)}</h3>
          <ul className="flex flex-col gap-1">
            {shown.map((fieldKey) => (
              <Suggestion key={fieldKey} fieldKey={fieldKey} />
            ))}
          </ul>
        </>
      )}

      {missing.length === 0 && (
        <p className="text-sm text-muted-foreground">{t(`${K}.breakdown.allComplete`)}</p>
      )}
    </section>
  );
}
