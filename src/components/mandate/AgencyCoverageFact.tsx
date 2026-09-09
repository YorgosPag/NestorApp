'use client';

/**
 * @fileoverview **ΠΟΥ ΔΟΥΛΕΥΕΙ** — η δηλωμένη εμβέλεια στη δημόσια βιτρίνα.
 * @related ADR-846 · components/mandate/AgencyProfileContent · AgencyCard (η ΑΛΛΗ οθόνη)
 * @module components/mandate/AgencyCoverageFact
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΔΥΟ ΟΘΟΝΕΣ ΚΑΤΑΝΑΛΩΝΟΥΝ ΤΟ `coverage`, ΚΑΙ Η ΔΕΥΤΕΡΗ ΞΕΧΑΣΤΗΚΕ ΜΙΑ ΦΟΡΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * *(μετρημένο ζωντανά, 2026-09-08, Φάση 2)*: το `AgencyCard` *(κατάλογος)* έμαθε το
 * σκέλος της ακτίνας· **αυτή η γραμμή όχι**. Το `coverage.adminIds.map(…)` με δήλωση
 * κύκλου πέταξε `TypeError: Cannot read properties of undefined (reading 'map')` και
 * **ολόκληρη η δημόσια σελίδα** έπεσε σε οθόνη σφάλματος.
 *
 * ⚠️ Η κλειστή ένωση **δεν** το έπιασε στη μεταγλώττιση, επειδή κανείς πράκτορας δεν
 * τρέχει `tsc` *(N.17)* — το έπιασε **μόνο** το άνοιγμα της σελίδας.
 * ⇒ **Κάθε νέο σκέλος γράφεται ΚΑΙ εδώ ΚΑΙ στο `AgencyCard`, στο ίδιο commit.**
 *
 * 🔑 **ΓΙΑΤΙ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ** *(Φ3)*: με το τέταρτο σκέλος **και** τον χάρτη, η
 * `AgencyProfileContent` περνούσε τις **500 γραμμές** *(N.7.1)*. Η γραμμή της εμβέλειας
 * είναι ούτως ή άλλως **μία ευθύνη** — έχει δικό της λεξιλόγιο, δικό της αναγνώστη
 * ιεραρχίας και, πλέον, δική της απόδοση σχήματος.
 *
 * ⚠️ **Τα ονόματα λύνονται ΤΩΡΑ** από την ιεραρχία — ποτέ αποθηκευμένα δίπλα στα ids
 * *(δες `types/agency-coverage.ts`)*.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΦΑΣΗ 5γ — Η ΓΡΑΜΜΗ ΛΕΕΙ **ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΜΙΣΟ ΤΗΣ ΑΛΗΘΕΙΑΣ**
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Μέχρι σήμερα η βιτρίνα έγραφε *«Δηλώνει: Αττική»* και **από κάτω παρέθετε αγγελίες
 * στη Θεσσαλονίκη** — δύο ανεξάρτητες αναγνώσεις, **καμία κοινή κρίση**, και η αντίφαση
 * **ορατή και ασχολίαστη** *(ADR-846 §8.8.1, ευρήματα **Β** και **Γ**)*. Ο επισκέπτης
 * την ανακάλυπτε **μόνος του** — ο ακριβότερος τύπος ασυμφωνίας.
 *
 * 🔑 **ΤΟ FRAMING ΕΙΝΑΙ ΘΕΤΙΚΟ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΤΟΥ GIORGIO** *(2026-09-09)*: η γραμμή
 * λέει *«Έχει **επίσης** ακίνητα εκτός αυτής της περιοχής»* — **ποτέ** *«6 από τα 7 είναι
 * εκτός»*. Ο αριθμός είναι σωστός και **δημόσια διαβάζεται ως κατηγορία** προς τον
 * επαγγελματία, για κάτι που είναι συχνά **απολύτως νόμιμο** *(αποσύρεται από περιοχή
 * ξεπουλώντας απόθεμα)*. Ο **αριθμός ανήκει στον ίδιο**, στον επιλογέα *(Φ5β)*· στο
 * κοινό ανήκει η **πληροφορία**: *«άρα μπορεί να με βοηθήσει κι εδώ»*.
 *
 * ⛔ **ΠΟΤΕ ΟΝΟΜΑΤΑ ΠΕΡΙΟΧΩΝ.** Το προφανές *«Έχει ακίνητα και σε: Θέρμη, Πυλαία»* θα
 * απαιτούσε σημείο → `AdminEntity.id`, που **δεν λύνεται** *(§9 #1)*. Θα ήταν ισχυρισμός
 * χωρίς απόδειξη — σε **δημόσια** σελίδα, για λογαριασμό τρίτου.
 */

import React from 'react';

import { useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { useCoverageResolvers } from '@/hooks/useCoverageResolvers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { coverageEvidenceOf } from '@/lib/agency/coverage-agreement';
import { coverageOutlineAreaKm2 } from '@/lib/agency/coverage-outline';
import { isNationwide, isOutlineCoverage, isRadiusCoverage } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';
import type { PublicListing } from '@/types/public-listing';

import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';
import { CoverageOutlineMap } from './CoverageOutlineMap';
import { Fact } from './AgencyFact';

/**
 * **ΠΟΥ ΔΟΥΛΕΥΕΙ** — δίπλα στην έδρα και **ξεχωριστά από αυτήν** *(ADR-846)*.
 *
 * 🔴 **Μέχρι το ADR-846 η σελίδα έλεγε «Περιοχή δραστηριότητας» δείχνοντας την ΕΔΡΑ.**
 * Δεν ήταν ανακρίβεια διατύπωσης: ήταν **υπόσχεση που το δεδομένο δεν μπορούσε να
 * τηρήσει**, και ο επισκέπτης έβγαζε συμπέρασμα για την εμβέλεια από μια διεύθυνση.
 */
export function CoverageFact({
  coverage,
  listings,
}: {
  readonly coverage: PublicShowcase['coverage'];
  /**
   * **Οι αγγελίες ΑΥΤΟΥ του γραφείου** — διαβασμένες **μία φορά** από τη σελίδα *(Φ5γ)*.
   *
   * 🔑 **Ταξιδεύουν ως prop και ΔΕΝ ξαναδιαβάζονται εδώ.** Ένα δεύτερο
   * `usePublicAgencyListings` σε αυτό το αρχείο θα άνοιγε **δεύτερο `onSnapshot`** για το
   * ίδιο ερώτημα στην **ίδια** σελίδα — και το κόστος δεν είναι το χειρότερο: δύο
   * συνδρομές μπορούν να **αποκλίνουν** μεταξύ καρέ, οπότε η γραμμή θα έλεγε *«έχει και
   * αλλού»* ενώ η λίστα από κάτω θα έδειχνε κάτι άλλο. Ίδιο ιδίωμα με το `acceptsMandate`
   * της σελίδας *(ADR-841 §7 Α5: **μία ερώτηση, μία φορά**)*.
   */
  readonly listings: readonly PublicListing[];
}): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { findById } = useAdministrativeHierarchy();

  const value = ((): string => {
    if (coverage === null) return t(PROFILE_KEYS.coverageUnknown);
    if (isNationwide(coverage)) return t(PROFILE_KEYS.coverageNationwide);
    if (isRadiusCoverage(coverage)) {
      return t(PROFILE_KEYS.coverageRadius, { km: coverage.circle.radiusKm });
    }
    // 🏆 **Η ΕΚΤΑΣΗ ΜΕ ΛΕΞΕΙΣ, ΚΑΙ ΤΟ ΣΧΗΜΑ ΜΕ ΓΡΑΜΜΕΣ** — δες `CoverageOutlineMap`:
    //    εμβαδόν **χωρίς σχήμα** δεν λέει *πού*, και σχήμα χωρίς μέγεθος δεν λέει *πόσο*.
    if (isOutlineCoverage(coverage)) {
      return t(PROFILE_KEYS.coverageOutline, { km2: coverageOutlineAreaKm2(coverage.outline) });
    }
    const names = coverage.adminIds
      .map((adminId) => findById(adminId)?.name)
      .filter((name): name is string => name !== undefined);
    return names.length === 0 ? t(PROFILE_KEYS.coverageUnknown) : names.join(' · ');
  })();

  return (
    <Fact label={t(PROFILE_KEYS.coverageLabel)} value={value}>
      {/*
        🔑 **Η ΚΡΙΣΗ ΠΡΟΣΑΡΤΑΤΑΙ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΤΙ ΝΑ ΚΡΙΘΕΙ** — και οι δύο όροι είναι
        **σημασιολογικοί**, όχι μικρο-βελτιστοποιήσεις:

        · `coverage === null` ⇒ **ΔΕΝ υπάρχει «αυτή η περιοχή»**. Ο κριτής θα απαντούσε
          σωστά `understated` *(κενή δήλωση = `disjoint`, ADR-846 §8.8.11 #1)*, αλλά η
          πρόταση *«έχει ακίνητα εκτός αυτής της περιοχής»* δίπλα σε *«Δεν δηλώθηκε»*
          είναι **ασυνάρτητη**. Ο ίδιος κριτής, **άλλο ακροατήριο**: στον επιλογέα το
          *«δεν δήλωσες τίποτα και έχεις δέκα ακίνητα»* είναι χρήσιμο· εδώ είναι θόρυβος.

        · `listings.length === 0` ⇒ η ετυμηγορία είναι **εξ ορισμού** `unproven` *(§8.8.3:
          «καμία αγγελία» κρίνεται **πρώτο**)*. Χωρίς αυτόν τον όρο, **κάθε** βιτρίνα —
          και οι περισσότερες σήμερα δεν έχουν αγγελίες — θα κατέβαζε τα **713 KB** των
          αποτυπωμάτων για να απαντήσει σε ερώτηση **χωρίς υποκείμενο**.
      */}
      {coverage !== null && listings.length > 0 ? (
        <AlsoOutsideNote coverage={coverage} listings={listings} />
      ) : null}
      {coverage !== null && isOutlineCoverage(coverage) ? (
        <CoverageOutlineMap outline={coverage.outline} />
      ) : null}
    </Fact>
  );
}

/**
 * **«ΕΧΕΙ ΚΑΙ ΑΛΛΟΥ;»** — μία πρόταση, **μόνο** όταν η απάντηση είναι αποδεδειγμένα ναι.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΙΩΠΗ ΕΙΝΑΙ Η ΠΡΟΕΠΙΛΟΓΗ — ΚΑΙ ΤΡΕΙΣ ΑΠΟ ΤΙΣ ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΣΙΩΠΟΥΝ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | Ετυμηγορία | Εδώ |
 * |---|---|
 * | `understated` | **η μόνη** που μιλά — υπάρχει αγγελία **αποδεδειγμένα** έξω |
 * | `agreed` | σιωπή: ο έπαινος για το αναμενόμενο είναι θόρυβος |
 * | `unproven` | σιωπή: δεν κρίθηκε τίποτα *(δομικά ανέφικτο εδώ — δες τον όρο του καλούντα)* |
 * | `unknown` | 🔑 **σιωπή, και είναι Η ΣΗΜΕΡΙΝΗ ΠΡΑΓΜΑΤΙΚΟΤΗΤΑ** |
 *
 * ⚠️ **Το `unknown` δεν είναι ακραία περίπτωση**: μετρημένο **6 ακίνητα · 0 στον χάρτη**
 * *(ADR-846 §8.8.5 α)*. Μια δημόσια πρόταση χτισμένη σε **δικό μας** κενό θα
 * κατηγορούσε τον επαγγελματία για δικό μας λάθος — μπροστά στους πελάτες του.
 *
 * 🔑 **Και δεν χρειάζεται φρουρός φόρτωσης.** Όσο τα αποτυπώματα δεν έχουν φτάσει, ο
 * `footprintOf` απαντά `null` ⇒ ο κριτής λέει `'unknown'` ⇒ η ετυμηγορία **δεν** είναι
 * `understated` ⇒ **σιωπή**. Η αναμονή είναι **αυτομάτως** τίμια, γιατί η άγνοια είναι
 * πρώτης κατηγορίας σε **όλη** την αλυσίδα — δεν χρειάστηκε να το θυμηθεί αυτή η οθόνη.
 * Όταν φτάσουν, η ταυτότητα του `resolvers` αλλάζει και η πρόταση εμφανίζεται μόνη της.
 */
function AlsoOutsideNote({
  coverage,
  listings,
}: {
  readonly coverage: NonNullable<PublicShowcase['coverage']>;
  readonly listings: readonly PublicListing[];
}): React.JSX.Element | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { resolvers } = useCoverageResolvers();

  const { agreement } = React.useMemo(
    () => coverageEvidenceOf(coverage, listings, resolvers),
    [coverage, listings, resolvers],
  );

  if (agreement !== 'understated') return null;

  // ⚠️ **Ίδια όψη με το `hint` του {@link Fact}** *(`text-xs`)*, γιατί είναι το ίδιο
  //    πράγμα: δευτερεύουσα διευκρίνιση της τιμής. Δεν περνά **ως** `hint` επειδή
  //    εκείνο είναι `string` — και μια συμβολοσειρά δεν μπορεί να προσαρτηθεί υπό όρους,
  //    δηλαδή θα ανάγκαζε κάθε βιτρίνα να κατεβάσει τα αποτυπώματα.
  return <span className="text-xs">{t(PROFILE_KEYS.coverageAlsoOutside)}</span>;
}
