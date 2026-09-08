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
 */

import React from 'react';

import { useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { coverageOutlineAreaKm2 } from '@/lib/agency/coverage-outline';
import { isNationwide, isOutlineCoverage, isRadiusCoverage } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';

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
}: {
  readonly coverage: PublicShowcase['coverage'];
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
      {coverage !== null && isOutlineCoverage(coverage) ? (
        <CoverageOutlineMap outline={coverage.outline} />
      ) : null}
    </Fact>
  );
}
