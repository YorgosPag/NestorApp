/**
 * @fileoverview **Η ΣΕΛΙΔΑ ΤΟΥ ΣΥΝΔΕΣΜΟΥ ΕΠΙΒΕΒΑΙΩΣΗΣ** — δείχνει, δεν αποφασίζει (ADR-841 §7 Α21.18).
 * @related services/mandate/showcase-email-confirmation-decision.ts · app/(auth)/mandate/[token]/page.tsx (το πρότυπο)
 * @module app/(auth)/card-email/[token]/page
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΕΓΓΡΑΦΗ ΣΕ ΑΥΤΗ ΤΗ ΣΕΛΙΔΑ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ `/contact/[token]`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το email καταλήγει συχνά σε **επαγγελματικό** γραμματοκιβώτιο, πίσω από Microsoft Defender Safe Links ή
 * εταιρική πύλη: **μηχανή ανοίγει τον σύνδεσμο πριν τον άνθρωπο**. Σελίδα που εξαργυρώνει εδώ θα έγραφε
 * «επιβεβαιώθηκε» χωρίς να το δει κανείς — δηλαδή το σήμα δεν θα απέδειχνε τίποτα. Η απόφαση φεύγει μόνο
 * από κουμπί (`POST /api/showcase-email-confirmations/[token]`).
 *
 * 🔑 **ΣΤΟ `(auth)`**: *«Οθόνες σύνδεσης/συγκατάθεσης. Ο χρήστης φτάνει εδώ ΧΩΡΙΣ ταυτότητα»* — κατά λέξη.
 * ⚠️ `force-dynamic` (CHECK 3.55) · `noindex` (ο σύνδεσμος είναι διαπιστευτήριο).
 */

import 'server-only';

import type { Metadata } from 'next';

import {
  CREDENTIAL_LINK_PAGE_METADATA,
  readCredentialLinkAnswerPage,
  type CredentialLinkAnswerPageProps,
} from '@/lib/tokens/credential-link-page';

import { ShowcaseEmailConfirmationContent } from '@/components/mandate/ShowcaseEmailConfirmationContent';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readShowcaseEmailConfirmation } from '@/services/mandate/showcase-email-confirmation-decision';

export const dynamic = 'force-dynamic';

// ADR-876 — noindex · no-referrer από το ΕΝΑ SSoT (άγκυρα `credential-link-page.test.ts`).
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default async function ShowcaseEmailConfirmationPage(
  props: CredentialLinkAnswerPageProps,
): Promise<React.ReactElement> {
  const { token, answer } = await readCredentialLinkAnswerPage(props);
  const lookup = await readShowcaseEmailConfirmation(getAdminFirestore(), token);

  return <ShowcaseEmailConfirmationContent token={token} lookup={lookup} disownFirst={answer === 'disown'} />;
}
