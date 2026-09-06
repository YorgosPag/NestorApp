'use client';

/**
 * **Η ΦΟΡΜΑ ΠΟΥ ΔΕΝ ΑΝΟΙΓΕΙ, ΚΑΙ ΛΕΕΙ ΓΙΑΤΙ** — ο μπαγιάτικος σύνδεσμος του Α5.
 *
 * @related ADR-841 §7 Α5 · ADR-834 §6.2 (σχήμα P2B άρθρο 4)
 * @module components/mandate/MandateUnavailableNotice
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ `redirect()` — Η ΕΡΕΥΝΑ ΑΛΛΑΞΕ ΤΗΝ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σελίδα κάνει ήδη `redirect` σε δύο περιπτώσεις *(`not-found` · `not-published`)*
 * και ο πειρασμός ήταν τρίτη. **Δεν είναι η ίδια περίπτωση**: εκεί δεν υπάρχει
 * **τίποτα** να δείξεις — εδώ το γραφείο **υπάρχει, φαίνεται, και ο άνθρωπος μόλις
 * ερχόταν από τη βιτρίνα του**. Σιωπηλή ανακατεύθυνση θα του έλεγε *«κάτι πήγε
 * στραβά»* χωρίς να πει **τι**, και θα τον έβγαζε από το γραφείο που διάλεξε.
 *
 * 🔑 Η καθιερωμένη πρακτική λέει το αντίθετο: *πες την αλήθεια για τη **μειωμένη**
 * δυνατότητα, και αν η δουλειά προχωρά σε **στενότερη** μορφή, πες το και **κάνε τη
 * στενότερη**.* Η στενότερη μορφή εδώ είναι *«πήγαινε πίσω και πλησίασέ τον»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ **ΔΕΝ** ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Δεν κρίνει.** Ο κριτής είναι ο `acceptsMandate` και τρέχει στη **σελίδα**
 * *(διακομιστής)*· εδώ γίνεται μόνο η απόδοση. **Δεν γράφει κείμενο**: ο λόγος
 * έρχεται από το `REJECTION_KEYS['agency-not-brokerage']`, το **ίδιο** που θα δει
 * όποιος υποβάλει το αίτημα με χειρόγραφο POST — **μία** φωνή για μία άρνηση, ποτέ
 * δύο *(N.12)*.
 *
 * 🔑 **Ούτε ένα νέο κλειδί i18n**: ο σύνδεσμος επιστροφής είναι το υπάρχον
 * `DIRECTORY_KEYS.open` *(«Δείτε τη βιτρίνα»)*, που λέει **ακριβώς** αυτό.
 *
 * ⚠️ **Client component επειδή χρειάζεται μεταφραστή**, όχι επειδή έχει κατάσταση —
 * ίδιος λόγος και ίδιο σχήμα με το `MandateRequestFormContent`, που δέχεται κι
 * εκείνο το `agencyHref` **ως prop από τον διακομιστή**: το ψευδώνυμο το έχει η
 * διεύθυνση, και η αντίστροφη αναζήτηση `companyId → ψευδώνυμο` θα ήταν **σάρωση**
 * *(ADR-787 Ε-5 §4 #1)*.
 */

import React from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';

import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { MandateRequestOutcomeNotice } from './MandateRequestOutcomeNotice';

export interface MandateUnavailableNoticeProps {
  /** Η διεύθυνση της βιτρίνας — **δίνεται**, δεν αναζητείται (δες docblock). */
  readonly agencyHref: string;
}

export function MandateUnavailableNotice({
  agencyHref,
}: MandateUnavailableNoticeProps): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  return (
    // ⚠️ **`content-start` ΜΕ ΛΟΓΟ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ.** Το `[data-shell-measure]`
    //    είναι `grid` για τις **στήλες** (το μέτρο ανάγνωσης)· οι **γραμμές** του είναι
    //    σιωπηρές και, όταν το `main` είναι ψηλότερο από το περιεχόμενο, το
    //    προεπιλεγμένο `align-content: normal` μοιράζει το πλεόνασμα σε αυτές. Με δύο
    //    κοντά παιδιά μετρήθηκε **504px ύψος για μια ειδοποίηση 3 γραμμών**.
    //    ⛔ ΟΧΙ `h-*` ούτε `max-h-*`: το ύψος δεν είναι το πρόβλημα — η **κατανομή**
    //    είναι. Ίδιος κανόνας με το «μην ξαναγράψεις `mx-auto`» του `shell-surface.css`.
    <ShellSurface as="main" measure="prose" className="gap-4 content-start">
      <MandateRequestOutcomeNotice reason="agency-not-brokerage" />
      <nav>
        <Link
          href={agencyHref}
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t(DIRECTORY_KEYS.open)}
        </Link>
      </nav>
    </ShellSurface>
  );
}
