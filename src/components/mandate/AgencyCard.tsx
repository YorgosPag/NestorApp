'use client';

/**
 * **Η ΚΑΡΤΑ ΤΟΥ ΕΠΑΓΓΕΛΜΑΤΙΑ** — όνομα · απόδειξη · πόρτα.
 *
 * @related ADR-827 §9.9 β (η απόδειξη ζει στην ΚΑΡΤΑ) · ADR-841 §7 Α5 (οι
 *          επαγγελματίες δεν είναι αγγελία) · §7 Α4.3 (ο διακόπτης απέκτησε πάνελ)
 *          · §7 Α9.1 (ποιος εξέδωσε τον αριθμό μητρώου)
 * @module components/mandate/AgencyCard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `AgencyDirectoryContent` — ΕΞΑΓΩΓΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζούσε **ιδιωτική** μέσα στο `AgencyDirectoryContent.tsx`, με **έναν** καταναλωτή.
 * Η **Α4.3** έδωσε δεύτερο: η βιτρίνα της ρίζας, στη λειτουργία «Επαγγελματίες».
 *
 * ⛔ **Η αντιγραφή θα ήταν το σχήμα του ADR-749**: δύο κάρτες που απαντούν *«πώς
 * φαίνεται ένας επαγγελματίας;»*, ελεύθερες να αποκλίνουν — και η μία θα έχανε την
 * **απόδειξη**, που είναι *«αυτό που κάνει τον κατάλογο χρήσιμο αντί για επικίνδυνο»*
 * (§9.9 β). Ίδιος κανόνας με το `agency-door.ts`: *μετακινούμε καταναλωτές, όχι
 * αρχεία* — το αρχείο **γεννιέται** όταν αποκτήσει τον δεύτερο.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ ΓΙΑ ΤΟΝ ΥΠΑΡΧΟΝΤΑ ΚΑΤΑΝΑΛΩΤΗ.** Το σώμα μετακόμισε
 * **αυτούσιο**: ίδιο `<li>`, ίδια `CredibilityStatement` ανά credential, ίδιος
 * σύνδεσμος, **ίδιο `<h2>`** *(η προεπιλογή του `headingLevel`)*. Μια «βελτίωση» την
 * ώρα της μετακόμισης θα έκανε το `git diff` **μη αναγνώσιμο** — και τότε κανείς δεν
 * μπορεί να επαληθεύσει ότι η εξαγωγή ήταν αθώα.
 *
 * ✅ **Η ΜΟΝΗ ΠΡΟΣΘΗΚΗ ΕΙΝΑΙ ΠΡΟΣΘΕΤΙΚΗ**: το `headingLevel`, με προεπιλογή που κρατά
 * τον `/pro` **byte-για-byte** ίδιο. Δες τη δικαιολόγησή του στο ίδιο το πεδίο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ `<li>` ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ — Ο ΚΑΤΑΝΑΛΩΤΗΣ ΟΦΕΙΛΕΙ ΝΑ ΔΩΣΕΙ `<ul>`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Και οι δύο καταναλωτές το τηρούν, με **διαφορετική διάταξη**: ο κατάλογος `/pro`
 * είναι **στήλη** *(`flex-col`)*, η βιτρίνα της ρίζας **πλέγμα πλήρους πλάτους**. Η
 * διάταξη ανήκει στον κατάλογο· η **κάρτα** μένει ίδια. *(Ίδιος διαχωρισμός με τη
 * `ListingCard`, που εξυπηρετεί τρεις διατάξεις χωρίς να ξέρει καμία.)*
 *
 * ⚠️ **ΚΑΙ Η ΤΥΠΟΓΡΑΦΙΑ ΤΟΥ `<li>` ΕΧΕΙ ΙΣΤΟΡΙΚΟ**: το `shell-surface.css` επιβάλλει
 * τυπογραφία **πρόζας** σε κάθε `<li>` που **δεν** δηλώνει διάταξη — και είχε ήδη
 * κοστίσει 36px ανάμεσα σε κάρτες, **και στο `/pro`** *(ADR-777 §8.49)*. Ο κανόνας
 * εξαιρεί λίστες με `flex`/`grid` στην κλάση· και οι δύο καταναλωτές δηλώνουν.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PublicShowcase } from '@/types/agency-profile';
import { CredibilityStatement } from './CredibilityStatement';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import { agencyProfileRoute } from './agency-directory-route';
import { lettermarkOf } from '@/lib/agency/showcase-mark';
import { ShowcaseMarkView } from './ShowcaseMarkView';
import { lineageIdsOf, useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { coverageRelation } from '@/lib/agency/coverage-match';
import { isNationwide } from '@/types/agency-coverage';

interface AgencyCardProps {
  readonly profile: PublicShowcase;
  /**
   * **Το επίπεδο επικεφαλίδας το δηλώνει ο ΚΑΤΑΛΟΓΟΣ, γιατί μόνο αυτός ξέρει τι
   * υπάρχει από πάνω** — και η προεπιλογή κρατά τον `/pro` **αμετάβλητο**.
   *
   * 🔴 **ΔΕΝ είναι προτίμηση, είναι μετρημένη διαφορά περιβάλλοντος**: ο κατάλογος
   * `/pro` έχει `<h1>` και **καμία** `<h2>` ⇒ η κάρτα οφείλει να είναι `h2`, αλλιώς
   * το δέντρο **παραλείπει επίπεδο**. Η βιτρίνα της ρίζας έχει ήδη δική της `<h2>`
   * *(«Δες τι υπάρχει ήδη»)* ⇒ εκεί η κάρτα είναι `h3`, αλλιώς οι κάρτες διαβάζονται
   * ως **αδελφές ενότητες** της βιτρίνας αντί για περιεχόμενό της.
   *
   * ⚠️ Ένα καρφωμένο επίπεδο θα ήταν **λάθος στη μία από τις δύο**, ό,τι κι αν
   * διαλέγαμε — γι' αυτό ρωτιέται, αντί να μαντεύεται.
   */
  readonly headingLevel?: 2 | 3;
  /**
   * **Η περιοχή που ρώτησε ο επισκέπτης**, όταν ρώτησε *(ADR-846)*.
   *
   * 🔑 **Προαιρετικό, γιατί η ΣΧΕΣΗ δεν υπάρχει χωρίς ερώτημα.** Η κάρτα εμφανίζεται και
   * σε οθόνη χωρίς φίλτρο *(η βιτρίνα της ρίζας)*, όπου το *«καλύπτει όλη την περιοχή»*
   * δεν έχει **σε τι** να αναφέρεται. Χωρίς αυτό το prop, η κάρτα δείχνει μόνο **τι
   * δήλωσε** — που ισχύει πάντα.
   *
   * ⛔ **ΔΕΝ επηρεάζει ποτέ τη σειρά** — μόνο μια γραμμή κειμένου. Δες τον φρουρό στο
   * `agency-directory-order.ts`.
   */
  readonly queryAreaId?: string | null;
}

export function AgencyCard({
  profile,
  headingLevel = 2,
  queryAreaId = null,
}: AgencyCardProps): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const Heading = (headingLevel === 3 ? 'h3' : 'h2') as 'h2' | 'h3';

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      {/*
        🔴 ADR-841 Α21 — Η ΚΑΡΤΑ ΕΓΙΝΕ ΓΡΑΜΜΗ, ΚΑΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ ΣΤΗΛΗ.
        Το `flex-col gap-1` μετακόμισε **αυτούσιο** στο εσωτερικό `<div>`· η
        `<article>` κρατά πλέον σήμα + περιεχόμενο δίπλα-δίπλα.

        ⚠️ **Το `min-w-0` δεν είναι διακόσμηση**: στοιχείο flex έχει
        `min-width:auto`, δηλαδή **αρνείται να συρρικνωθεί κάτω από το περιεχόμενό
        του**. Χωρίς αυτό, μια μεγάλη επωνυμία **σπρώχνει το σήμα έξω** από το
        πλαίσιο — και το `globals.css` επιβάλλει ήδη `white-space: nowrap` σε κάθε
        επικεφαλίδα κάρτας (ADR-777 §8.59, `bc3451be`), οπότε δεν υπάρχει αναδίπλωση
        να τη σώσει.
      */}
      <article className="flex items-start gap-3">
        {/*
          🏆 ADR-841 §7 Α21, Φάση 2 — Η ΕΙΚΟΝΑ ΑΝ ΤΗ ΔΗΛΩΣΕ, ΤΑ ΑΡΧΙΚΑ ΑΝ ΟΧΙ.

          🔑 **Η ΕΦΕΔΡΕΙΑ ΔΕΝ ΑΠΟΤΥΓΧΑΝΕΙ ΠΟΤΕ**: το `lettermark` είναι **συνάρτηση της
          ταυτότητας** — δεν κατεβάζει τίποτα, δεν περιμένει τίποτα, και δεν μπορεί να
          λείπει. Γι' αυτό οι περισσότεροι επαγγελματίες, που δεν θα δηλώσουν ποτέ σήμα,
          **δεν μένουν ανώνυμοι**.
        */}
        <ShowcaseMarkView
          mark={
            profile.mark !== null
              ? { declared: profile.mark }
              : { lettermark: lettermarkOf(profile.companyId, profile.displayName) }
          }
          size="card"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Heading className="m-0 text-lg font-semibold text-foreground">
            {profile.displayName}
          </Heading>
          {/*
            ⚠️ Η ΑΠΟΔΕΙΞΗ δεν είναι διακόσμηση: είναι **αυτό που κάνει τον κατάλογο
            χρήσιμο αντί για επικίνδυνο** (§9.9 β). Γι' αυτό είναι στην **κάρτα**,
            όχι κρυμμένη μέσα στη σελίδα προφίλ.

            🔴 ADR-841 Φ6-Β — ΗΤΑΝ ΜΙΑ ΓΡΑΜΜΗ «ΓΕΜΗ {number}», ΚΑΙ ΔΕΝ ΑΡΚΕΙ ΠΙΑ.
            Με **πέντε** επαγγέλματα στον ίδιο πίνακα, ο σκέτος αριθμός δεν λέει
            **ποιος τον εξέδωσε** *(Α9.1)*, και η απουσία του δεν λέει **γιατί
            λείπει** — ο ελαιοχρωματιστής δεν έχει πού να γραφτεί, ο δικηγόρος που
            σιωπά έχει. Δύο γραμμές, δύο ερωτήματα, ποτέ μία πρόταση.

            ⚠️ **ΚΑΘΕ credential αποδίδεται**: το μικτό γραφείο *(μεσιτική άδεια ΚΑΙ
            τεχνική ιδιότητα)* δείχνει **και τα δύο**. Ένα `credentials[0]` θα
            έκρυβε τη μισή του ταυτότητα.
          */}
          {profile.credentials.map((credential) => (
            <CredibilityStatement key={credential.occupation.escoUri} credential={credential} />
          ))}
          {/*
            🏆 **Η ΔΗΛΩΣΗ ΕΙΝΑΙ ΟΡΑΤΗ — ΚΑΙ ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ** (ADR-846).

            Zillow · Thumbtack · Google: κανένας **δεν δείχνει την έκταση** που δήλωσε
            ο επαγγελματίας δίπλα στο αποτέλεσμα. Ο επισκέπτης μαθαίνει ότι «καλύπτει
            την περιοχή» χωρίς να μάθει ποτέ ότι ο ίδιος δήλωσε **ολόκληρη τη χώρα**.

            ⚠️ **Η ορατότητα ΑΝΤΙΚΑΘΙΣΤΑ τον ανιχνευτή spam**: όταν η υπερδήλωση
            **φαίνεται**, ο άνθρωπος την κρίνει μόνος του — και δεν χρειάζεται
            αλγόριθμος που μαντεύει ποιος «το παρακάνει».

            ⛔ **Καμία ετικέτα σχέσης εδώ** *(«καλύπτει όλη την περιοχή»)*: αυτή έχει
            νόημα **μόνο** όταν υπάρχει ερώτημα, και η κάρτα εμφανίζεται και χωρίς.
          */}
          <CoverageLine coverage={profile.coverage} queryAreaId={queryAreaId} />
          <Link
            href={agencyProfileRoute(profile.alias)}
            className="mt-2 self-start text-sm font-medium text-foreground underline underline-offset-4"
          >
            {t(DIRECTORY_KEYS.open)}
          </Link>
        </div>
      </article>
    </li>
  );
}

/**
 * **Η δηλωμένη εμβέλεια, με λέξεις** *(ADR-846)*.
 *
 * ⚠️ **Τα ονόματα λύνονται ΤΩΡΑ, από την ιεραρχία** — δεν αποθηκεύονται δίπλα στα ids.
 * Ένα `coverageNames: string[]` στο έγγραφο θα ήταν δεύτερη αυθεντία που **παλιώνει**
 * στην πρώτη μετονομασία δήμου, και θα έμοιαζε επικίνδυνα με το σχήμα «ταυτότητα +
 * όνομα ανά επίπεδο» που κυνηγά το CHECK 3.44.
 *
 * 🔑 **Όσο η ιεραρχία δεν έχει φορτώσει, η γραμμή ΛΕΙΠΕΙ** αντί να δείξει ωμά ids: ένα
 * `municipality:0706` στην κάρτα δεν λέει τίποτα σε κανέναν.
 */
function CoverageLine({
  coverage,
  queryAreaId,
}: {
  readonly coverage: PublicShowcase['coverage'];
  readonly queryAreaId: string | null;
}): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { findById } = useAdministrativeHierarchy();

  if (coverage === null) return null;

  // 🏆 **Η ΤΡΙΤΗ ΑΠΑΝΤΗΣΗ, ΟΡΑΤΗ** — *«ναι, ολόκληρη»* ≠ *«ίσως, εν μέρει»*. Οι
  //    πλατφόρμες ακινήτων υποβαθμίζουν αυτό το ερώτημα σε δυαδικό *(εμφανίζεται ή
  //    όχι)*· εδώ ο επισκέπτης βλέπει **ποια από τις δύο** ισχύει, και κρίνει μόνος του.
  //
  // ⛔ **ΦΙΛΤΡΟ ΚΑΙ ΠΕΡΙΓΡΑΦΗ, ΠΟΤΕ ΣΕΙΡΑ**: το `within` ΔΕΝ ανεβάζει κανέναν πάνω από
  //    το `intersects` — θα ήταν κατάταξη παραγόμενη από δήλωση του ίδιου.
  if (queryAreaId !== null && queryAreaId !== '') {
    const relation = coverageRelation(coverage, queryAreaId, lineageIdsOf);
    if (relation !== 'disjoint') {
      return (
        <p className="m-0 text-sm text-muted-foreground">
          {t(relation === 'within' ? DIRECTORY_KEYS.coverageWithin : DIRECTORY_KEYS.coverageIntersects)}
        </p>
      );
    }
  }

  if (isNationwide(coverage)) {
    return (
      <p className="m-0 text-sm text-muted-foreground">
        {t(DIRECTORY_KEYS.coverageDeclaredNationwide)}
      </p>
    );
  }

  const names = coverage.adminIds
    .map((adminId) => findById(adminId)?.name)
    .filter((name): name is string => name !== undefined);
  if (names.length === 0) return null;

  return (
    <p className="m-0 text-sm text-muted-foreground">
      {t(DIRECTORY_KEYS.coverageDeclared, { areas: names.join(' · ') })}
    </p>
  );
}
