/**
 * ⚠️ ΠΑΡΑΓΕΤΑΙ — `npm run legal:freeze` / `npm run legal:index`. ΜΗΝ το επεξεργαστείς (CHECK 3.85 Κ7).
 *
 * Κάθε παγωμένη έκδοση νομικού εγγράφου, ως **άγνωστη** τιμή: τη στενεύει σε τύπο **ένας**
 * αναγνώστης, `lib/legal/legal-document-versions.ts` — ποτέ `as`.
 *
 * @see ADR-861 §7
 */

import privacyPolicyV1 from './privacy-policy/v1.json';
import termsOfServiceV1 from './terms-of-service/v1.json';
import dataDeletionV1 from './data-deletion/v1.json';
import privateMarketingDisclosureV1 from './private-marketing-disclosure/v1.json';

export const FROZEN_LEGAL_DOCUMENTS: readonly unknown[] = [privacyPolicyV1, termsOfServiceV1, dataDeletionV1, privateMarketingDisclosureV1];
