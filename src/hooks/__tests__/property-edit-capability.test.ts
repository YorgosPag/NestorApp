/**
 * ADR-840 Σ2 — ΑΓΚΥΡΕΣ ΤΗΣ ΕΡΩΤΗΣΗΣ *«να του δείξω την επεξεργασία;»*.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΜΕΤΡΑΝΕ ΕΔΩ**: αν ο κριτής κρίνει σωστά — αυτό το απαντούν οι
 * άγκυρες του `lib/auth/__tests__/authority.test.ts` και του PEP
 * (`auth/hooks/__tests__/useCapability.test.tsx`). Εδώ μετριούνται **τρία**
 * πράγματα που μόνο αυτό το στάδιο μπορεί να χαλάσει:
 *
 *   Α — ότι η οθόνη **ρωτά τον ρόλο** και δίνει **διαφορετική** απάντηση σε
 *       διαφορετικούς ανθρώπους (πριν ήταν σταθερά, άρα ίδια για όλους).
 *   Β — ότι η **υπόθεση** πάνω στην οποία στηρίζεται η απόφαση (ADR-840 §8.2)
 *       εξακολουθεί να ισχύει: ο φύλακας της γραφής **δεν ρωτά τον ρόλο έργου**.
 *   Γ — ότι καμία από τις **πέντε** σταθερές `read-only` δεν επέζησε.
 *
 * 🔑 Το **Β** είναι το λιγότερο προφανές και το σημαντικότερο: χωρίς αυτό, η
 * απόφαση θα σάπιζε **σιωπηλά** την ημέρα που κάποιος κάνει τη διαδρομή
 * project-scoped — και θα έκρυβε κουμπιά από ανθρώπους που δικαιούνται.
 */

import fs from 'fs';
import path from 'path';
import { renderHook } from '@testing-library/react';

import {
  usePropertyEditCapability,
  PROPERTY_EDIT_PERMISSION,
} from '@/hooks/usePropertyEditCapability';

// -----------------------------------------------------------------------------
// Ο διπλός του AuthContext — ίδιος στόχος με τις άγκυρες του PEP (ADR-801).
// Προσομοιώνεται **μόνο η ταυτότητα**: ο κριτής (`lib/auth/authority.ts`) και ο
// κατάλογος ρόλων (`role-catalogue.ts`) τρέχουν **αληθινοί**.
// -----------------------------------------------------------------------------

interface FakeAuth {
  user: { globalRole?: string | null; permissions?: string[] | null } | null;
  loading: boolean;
}

let mockAuthState: FakeAuth = { user: null, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

function capabilityFor(state: FakeAuth) {
  mockAuthState = state;
  return renderHook(() => usePropertyEditCapability()).result.current;
}

const repoRoot = path.resolve(__dirname, '..', '..', '..');

/**
 * Ο κώδικας **χωρίς τα σχόλια** — και ο λόγος είναι μετρημένος: η πρώτη γραφή
 * αυτών των αγκυρών **κοκκίνισε πάνω στην ίδια της την τεκμηρίωση**, επειδή τα
 * σχόλια που εξηγούν *«εδώ ζούσε το `isReadOnly: true`»* περιέχουν το μοτίβο
 * που η άγκυρα απαγορεύει. Άγκυρα που δεν ξεχωρίζει **εκτελούμενο** από
 * **γραμμένο** τιμωρεί όποιον τεκμηριώνει — δηλαδή διδάσκει σιωπή.
 */
const readCode = (relative: string): string =>
  fs
    .readFileSync(path.join(repoRoot, relative), 'utf8')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');

// =============================================================================
// Α — Η ΙΔΙΑ ΟΘΟΝΗ, ΔΥΟ ΑΝΘΡΩΠΟΙ, ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ
// =============================================================================

describe('ADR-840 Α4 — η επεξεργασία έρχεται από τον ρόλο', () => {
  beforeEach(() => {
    mockAuthState = { user: null, loading: false };
  });

  test('υπερδιαχειριστής → επεξεργάζεται (bypass, ΟΧΙ permission)', () => {
    // 🔴 Ο `super_admin` έχει **κενή** λίστα permissions (`roles.ts:55-62`): αν η
    //    ετυμηγορία ήταν `granted-by-role`, ο έλεγχος bypass θα είχε χαθεί.
    const capability = capabilityFor({ user: { globalRole: 'super_admin' }, loading: false });

    expect(capability.canEdit).toBe(true);
    expect(capability.verdict).toBe('granted-by-bypass');
  });

  test('διαχειριστής εταιρείας → επεξεργάζεται, από τον ΚΑΤΑΛΟΓΟ', () => {
    const capability = capabilityFor({ user: { globalRole: 'company_admin' }, loading: false });

    expect(capability.canEdit).toBe(true);
    expect(capability.verdict).toBe('granted-by-role');
  });

  test.each(['internal_user', 'external_user'])(
    '%s → μόνο προβολή, και η ετυμηγορία ΛΕΓΕΤΑΙ (δεν σιωπά)',
    (role) => {
      const capability = capabilityFor({ user: { globalRole: role }, loading: false });

      expect(capability.canEdit).toBe(false);
      // Ο λόγος υπάρχει ώστε η οθόνη να μπορεί να τον πει — ADR-840 §8.1 #2:
      // «απόκρυψη του εργαλείου, ΟΧΙ σιωπή για την κατάσταση».
      expect(capability.verdict).toBe('denied-insufficient');
    },
  );

  test('ρητή ικανότητα στο claim → επεξεργάζεται ακόμη κι αν ο ρόλος δεν τη δίνει', () => {
    // Το `ctx.permissions` είναι ο **Έλεγχος 4** του `checkPermission` — ο
    // διακομιστής το τιμά, άρα οφείλει να το τιμά και η οθόνη. Αλλιώς θα
    // κρύβαμε κουμπί από άνθρωπο που ο φύλακας **δέχεται**.
    const capability = capabilityFor({
      user: { globalRole: 'internal_user', permissions: ['properties:properties:update'] },
      loading: false,
    });

    expect(capability.canEdit).toBe(true);
    expect(capability.verdict).toBe('granted-by-permission');
  });

  test('όσο εκκρεμεί η ταυτότητα: κλειστό ΚΑΙ δηλωμένα μη-τελικό', () => {
    // ⚠️ Η κατεύθυνση είναι «κλειστό → ανοιχτό» και ποτέ το αντίστροφο: κουμπί
    //    που εμφανίζεται και μετά εξαφανίζεται είναι χειρότερο από κουμπί που
    //    αργεί. Και το `pending` υπάρχει ώστε η οθόνη να μην πει ποτέ «δεν
    //    δικαιούσαι» για άρνηση **που δεν κρίθηκε**.
    const capability = capabilityFor({ user: { globalRole: 'super_admin' }, loading: true });

    expect(capability.canEdit).toBe(false);
    expect(capability.pending).toBe(true);
  });
});

// =============================================================================
// Β — 🔒 Η ΥΠΟΘΕΣΗ ΓΙΑ ΤΟΝ ΦΥΛΑΚΑ: ΕΚΤΕΛΕΣΙΜΗ, ΟΧΙ ΣΧΟΛΙΟ (ADR-840 §8.2)
// =============================================================================

describe('ADR-840 §8.2 — ο φύλακας της γραφής ΔΕΝ ρωτά τον ρόλο έργου', () => {
  /**
   * ⚠️ **ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ**: δεν αποδεικνύει ότι ο έλεγχος είναι
   * σωστός — αποδεικνύει ότι η **υπόθεση της οθόνης** ταιριάζει ακόμη με τη
   * διαδρομή. Ο `project_manager` έχει `properties:properties:update` στον
   * κατάλογο και **δεν** φτάνει στον browser· αυτό θα ήταν πρόβλημα **μόνο** αν
   * ο διακομιστής τον ρωτούσε. Δεν τον ρωτά — και αν κάποτε αρχίσει, εδώ
   * κοκκινίζει.
   */
  test('η γραφή ακινήτου δηλώνει permission ΧΩΡΙΣ εμβέλεια έργου', () => {
    const route = readCode('src/app/api/properties/[id]/route.ts');

    expect(route).toContain("permissions: 'properties:properties:update'");
    expect(route).not.toMatch(/permissionOptions/);
  });

  test('ο μεταφορέας του route ΔΕΝ έχει καν τρόπο να εκφράσει έργο', () => {
    // `EntityIdRouteParams` = { permissions, missingIdMessage, handler } και
    // `runGuarded` καλεί `withAuth(..., { permissions })` — σκέτο. Δεν υπάρχει
    // δίοδος για `projectId`, άρα ο Έλεγχος 2 του `checkPermission` δεν τρέχει.
    expect(readCode('src/lib/api/entity-id-route.ts')).not.toMatch(/permissionOptions|projectId/);
    expect(readCode('src/lib/api/guarded-route.ts')).not.toMatch(/permissionOptions|projectId/);
  });

  test('η οθόνη ρωτά ΑΚΡΙΒΩΣ το permission που δηλώνει η διαδρομή', () => {
    expect(PROPERTY_EDIT_PERMISSION).toBe('properties:properties:update');
  });

  test('⛔ κανένας δεύτερος κριτής: η ερώτηση περνά από τον ΕΝΑ PEP (CHECK 3.68)', () => {
    const source = readCode('src/hooks/usePropertyEditCapability.ts');

    expect(source).toContain("from '@/auth/hooks/useCapability'");
    // Καμία χειρόγραφη σύγκριση ρόλου, καμία λίστα permissions ανά ρόλο.
    expect(source).not.toMatch(/globalRole\s*===|PREDEFINED_ROLES|getRolePermissions/);
  });
});

// =============================================================================
// Γ — ΟΙ ΣΤΑΘΕΡΕΣ ΕΦΥΓΑΝ, ΚΑΙ ΔΕΝ ΞΑΝΑΓΥΡΙΖΟΥΝ ΣΙΩΠΗΛΑ
// =============================================================================

describe('ADR-840 Α4 — καμία σταθερά read-only δεν επέζησε', () => {
  test.each([
    ['src/hooks/usePublicPropertyViewer.ts', /isReadOnly:\s*true/],
    ['src/features/property-management/utils/buildViewerProps.ts', /isReadOnly:\s*true/],
    ['src/features/property-management/types/publicViewer.ts', /isReadOnly:\s*true;/],
  ])('%s δεν καρφώνει πια read-only', (file, pattern) => {
    expect(readCode(file)).not.toMatch(pattern);
  });

  /**
   * 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΑΝΤΙΣΤΡΑΦΗΚΕ ΑΠΟ ΤΗ ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ** (2026-09-01).
   *
   * Απαιτούσε `isReadOnly={!canEdit}` στο `ListLayout` — και **ήταν λάθος**: στην
   * οθόνη, η φόρμα επεξεργασίας **δεν χωράει** στη στήλη των ~260px και κόβεται
   * οριζόντια. Το εμπόδιο είναι **ο χώρος**, όχι η άδεια, και ο σχεδιασμός του
   * χώρου είναι το **Σ3**.
   *
   * Πλέον η άγκυρα φυλάει το **αντίθετο**: ότι η σταθερά έχει **γραπτό δομικό
   * λόγο** και **δείκτη στο Σ3**. Σταθερά χωρίς λόγο είναι ακριβώς το ελάττωμα
   * που έλυσε το Σ2· σταθερά **με** μετρημένο λόγο είναι απόφαση.
   */
  test('το `ListLayout` κλειδώνει με ΔΟΜΙΚΟ λόγο, όχι σιωπηλά', () => {
    const file = 'src/features/read-only-viewer/components/ListLayout.tsx';

    // Ο δείκτης ζει στα σχόλια — γι' αυτό διαβάζεται το ΠΛΗΡΕΣ αρχείο εδώ.
    const withComments = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    expect(withComments).toMatch(/ADR-840 Σ2/);
    expect(withComments).toMatch(/Σ3/);

    // …και ο κώδικας δεν ρωτά ρόλο που δεν μπορεί να τιμήσει (θα ήταν νεκρός).
    expect(readCode(file)).not.toMatch(/usePropertyEditCapability/);
  });

  test('το δάπεδο εξουσιοδότησης είναι ΜΟΝΟΤΟΝΟ (το prop μόνο προσθέτει)', () => {
    // 🔴 Αν αυτό γίνει `isReadOnlyRequested && …` ή σκέτο `!canEdit`, ένας
    //    καλών θα μπορεί να **ξεκλειδώσει** επεξεργασία με prop — δηλαδή η
    //    οθόνη θα ξαναπαίρνει την απόφαση από τη διεύθυνση, που είναι ακριβώς
    //    το ελάττωμα που έλυσε το Σ2. «Ceilings only subtract» (`roles.ts`).
    expect(readCode('src/features/property-details/PropertyDetailsContent.tsx')).toContain(
      'const isReadOnly = isReadOnlyRequested || !editCapability.canEdit;',
    );
  });
});
