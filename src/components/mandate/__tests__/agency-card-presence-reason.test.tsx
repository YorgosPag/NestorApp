/**
 * @fileoverview 🔴 **Η ΚΑΡΤΑ ΛΕΕΙ ΓΙΑΤΙ ΕΜΦΑΝΙΣΤΗΚΕ — ΚΑΙ ΤΟ ΛΕΕΙ ΜΕ ΕΝΕΡΓΟ ΕΡΩΤΗΜΑ.**
 * @related components/mandate/AgencyCard · lib/agency/showcase-presence · ADR-846 §8.8.18
 * @module components/mandate/__tests__/agency-card-presence-reason
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η κάρτα καλεί το `presenceMatches` **μόνο όταν `where !== null`**. Και όταν η §9 #13
 * άλλαξε την υπογραφή εκείνης της συνάρτησης *(σκέτο `presence` → ζεύγος
 * {@link PresenceEvidence})*, **καμία από τις 277 δοκιμές** του `components/mandate`
 * δεν κοκκίνισε — γιατί **καμία δεν περνά ενεργό ερώτημα στην κάρτα**.
 *
 * ⇒ Μια ενδιάμεση κατάσταση του δέντρου *(ο κριτής αλλαγμένος, η κάρτα όχι)* ήταν
 * **πράσινη σε 277 δοκιμές** ενώ κάθε επισκέπτης που φιλτράρει κατά περιοχή θα έπαιρνε
 * `Cannot read properties of undefined (reading 'some')` — δηλαδή **ολόκληρη η δημόσια
 * σελίδα κάτω**.
 *
 * 🔑 **Είναι Η ΙΔΙΑ ΚΛΑΣΗ με το περιστατικό της Φ3**, γραμμένο στο ίδιο το `AgencyCard`:
 * *«το `coverage.adminIds.map(…)` πέταξε TypeError που έριξε ολόκληρη τη δημόσια
 * σελίδα. Η κλειστή ένωση δεν το έπιασε στη μεταγλώττιση, γιατί κανείς πράκτορας δεν
 * τρέχει `tsc` (N.17)»*. **Δεύτερη φορά, ίδιο σημείο, ίδιος λόγος.**
 *
 * ⚠️ Άρα η άγκυρα **δεν** μετρά διατύπωση — μετρά ότι η κάρτα **εκτελείται** με ενεργό
 * ερώτημα, και στις **δύο** διαδρομές της ένωσης *(λεξιλογική και γεωμετρική)*.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { AgencyCard } from '../AgencyCard';
import { DIRECTORY_KEYS } from '../agency-directory-labels';
import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

const HOME = { lat: 40.6306898, lng: 22.9468742 };

const MUNICIPALITY = 'municipality:0701';
const REGION = 'region:112';
const OTHER_REGION = 'region:351';

const LINEAGE: Record<string, readonly string[]> = {
  [MUNICIPALITY]: [MUNICIPALITY, 'regional_unit:07', REGION],
  [REGION]: [REGION],
  [OTHER_REGION]: [OTHER_REGION],
};

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  ADMIN_LEVELS: {
    MAJOR_GEO: 1, DECENTRALIZED_ADMIN: 2, REGION: 3, REGIONAL_UNIT: 4,
    MUNICIPALITY: 5, MUNICIPAL_UNIT: 6, COMMUNITY: 7, SETTLEMENT: 8,
  },
  ADMIN_LEVEL_LABEL_KEYS: {},
  lineageIdsOf: (id: string): readonly string[] => LINEAGE[id] ?? [],
  useAdministrativeHierarchy: () => ({
    isLoading: false,
    findById: () => undefined,
    levelOptions: () => [],
    resolvePath: () => ({}),
    getByLevel: () => [],
    searchOptions: () => [],
    getChildren: () => [],
  }),
}));

/**
 * ⚠️ **Καμία γεωμετρία στο mock** *(`footprintOf: () => null`)*, και είναι **απόφαση**:
 * έτσι το `region:112` **δεν μπορεί** να απαντηθεί γεωμετρικά, ακριβώς όπως στην
 * παραγωγή *(το κάλυμμα της περιφέρειας δεν πιάνει την ακτή)*. Ό,τι περνά, περνά
 * **λεξιλογικά** — δηλαδή η άγκυρα μετρά τη θεραπεία, όχι τύχη.
 */
jest.mock('@/hooks/useAdminFootprints', () => ({
  useAdminFootprints: () => ({
    isLoading: false,
    footprintOf: () => null,
    // ⚠️ **Πλήρες σχήμα, ακόμη κι όταν αυτή η σουίτα δεν σαρώνει** *(§9 #12)*: mock που
    //    υπο-δηλώνει τη διεπαφή είναι **παγίδα με ημερομηνία** — δουλεύει μέχρι ο πρώτος
    //    καταναλωτής να ζητήσει το πεδίο που λείπει, και τότε σπάει **αλλού**.
    entries: new Map(),
  }),
}));

/** Γραφείο **χωρίς καμία δήλωση** — μόνο η απόδειξη μιλά. */
const proven = showcaseFixture({
  companyId: 'comp_proven',
  alias: 'proven',
  coverage: null,
  presence: [{ center: HOME, radiusKm: 0 }],
  presenceAdminIds: [MUNICIPALITY],
});

const renderCard = (adminId: string | null): void => {
  render(
    <ul>
      <AgencyCard profile={proven} where={adminId === null ? null : { adminId }} />
    </ul>,
  );
};

describe('Κ 🔴 — η κάρτα ΕΚΤΕΛΕΙΤΑΙ με ενεργό ερώτημα, και εξηγεί τον εαυτό της', () => {
  it('🔴 Κ1 — ΠΕΡΙΦΕΡΕΙΑ: η κάρτα λέει «έχει ακίνητο εδώ» ΜΕΣΩ ΤΗΣ ΙΕΡΑΡΧΙΑΣ', () => {
    // Χωρίς αποτυπώματα, **μόνο** το λεξιλογικό σκέλος μπορεί να απαντήσει.
    renderCard(REGION);
    expect(screen.getByText(DIRECTORY_KEYS.coverageProvenOnly)).toBeInTheDocument();
  });

  it('Κ2 — ΔΗΜΟΣ: το ίδιο, στο στενό ερώτημα', () => {
    renderCard(MUNICIPALITY);
    expect(screen.getByText(DIRECTORY_KEYS.coverageProvenOnly)).toBeInTheDocument();
  });

  it('🔴 Κ3 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΑΛΛΗ περιφέρεια ⇒ η κάρτα ΣΙΩΠΑ', () => {
    // ⚠️ Χωρίς αυτό, ένα «λέει πάντα ναι» θα άφηνε τα Κ1/Κ2 πράσινα — και η κάρτα θα
    //    ισχυριζόταν παρουσία **παντού**, σε δημόσιο κατάλογο, για λογαριασμό τρίτου.
    renderCard(OTHER_REGION);
    expect(screen.queryByText(DIRECTORY_KEYS.coverageProvenOnly)).not.toBeInTheDocument();
  });

  it('Κ4 — ΧΩΡΙΣ ερώτημα η κάρτα δεν κρίνει καθόλου (η αρχική οθόνη)', () => {
    renderCard(null);
    expect(screen.queryByText(DIRECTORY_KEYS.coverageProvenOnly)).not.toBeInTheDocument();
  });
});
