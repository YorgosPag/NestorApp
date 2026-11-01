/**
 * Η ΔΗΛΩΣΗ ΠΟΛΙΤΙΚΗΣ της καθολικής αναζήτησης: ποιος ρόλος βρίσκει τι (ADR-829 §7).
 *
 * ⚠️ Γραμμένη με το χέρι, ΕΠΙΤΗΔΕΣ, όπως η `building-floor-role-policy.fixture.ts`. Το αποτέλεσμα
 * βγαίνει ζωντανά από τον κατάλογο ρόλων μέσω του πραγματικού `withAuth`. Αν και το αναμενόμενο
 * παραγόταν από τον κατάλογο, μια λάθος παραχώρηση θα μετακινούσε και τα δύο και το test θα έμενε
 * πράσινο (ADR-790 §9.1). Κάθε αλλαγή εδώ είναι αλλαγή πολιτικής και φαίνεται στο diff.
 *
 * @see ./search-role-matrix.route.test.ts — ο διακομιστής
 * @see src/components/__tests__/app-header-search-gate.test.tsx — η μπάρα
 */

import type { GlobalRole } from '@/lib/auth/types';
import type { SearchEntityType } from '@/types/search';

const SPACES: readonly SearchEntityType[] = [
  'project', 'building', 'floor', 'property', 'parking', 'storage',
];

const EVERYTHING: readonly SearchEntityType[] = [
  ...SPACES, 'contact', 'file', 'opportunity', 'communication', 'task',
];

/** `null` = η πόρτα δεν ανοίγει καθόλου: 403 από το `withAuth`, πριν από κάθε ερώτημα. */
export const SEARCH_ROLE_POLICY: Readonly<Record<GlobalRole, readonly SearchEntityType[] | null>> = {
  super_admin: EVERYTHING,
  company_admin: EVERYTHING,
  internal_user: SPACES,
  external_user: null,
};
