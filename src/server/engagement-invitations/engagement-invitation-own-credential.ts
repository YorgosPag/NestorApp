import 'server-only';

/**
 * @fileoverview **«Θυμήσου με» στη σελίδα πρόσκλησης** — ο συνδεδεμένος παραλήπτης βρίσκει προσυμπληρωμένο τον αριθμό
 *   μητρώου που **ο ίδιος** δήλωσε τελευταία στο **ίδιο** μητρώο, και μπορεί να τον αλλάξει (ADR-915 §45.13).
 * @related lib/conveyance/declared-credential.ts (`latestOwnDeclaration` — η ΜΙΑ κρίση) ·
 *   services/conveyance/conveyance-engagement-access.service.ts (`offerCredentialHint` — η ίδια σειρά στο `/cases`)
 * @module server/engagement-invitations/engagement-invitation-own-credential
 *
 * 🔑 **Η ίδια σειρά με το `/cases`**: πρώτα η δική του δήλωση, μετά ό,τι κατέγραψε το γραφείο. Ακριβέστερη (την
 *    πληκτρολόγησε ο ίδιος) και δεν διαρρέει τίποτα (είναι δικά του δεδομένα).
 * 🔒 **Μόνο για τον συνδεδεμένο ΠΑΡΑΛΗΠΤΗ** (`addressedToViewer === true`), όπως το «για ποιο γραφείο» της σελίδας.
 *    Ένα προωθημένο email σε τρίτον δεν ρωτά ποτέ το ιστορικό κανενός.
 * 🔑 Προσυμπλήρωση, **ποτέ** δήλωση (Ε-4): δηλώνει μόνο το πάτημα της αποδοχής.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { listEngagementsOfUser } from '@/lib/auth/engagement-read';
import { latestOwnDeclaration } from '@/lib/conveyance/declared-credential';
import type { PageIdentity } from '@/server/auth/page-identity';

import type { EngagementInvitationPreviewOutcome } from './engagement-invitation-preview';

/**
 * Η όψη με την **δική του** τελευταία δήλωση στη θέση της υπόδειξης του γραφείου — αν υπάρχει. Σε κάθε άλλη περίπτωση
 * (άλλος θεατής · κανείς συνδεδεμένος · καμία δήλωση · αποτυχία ανάγνωσης) η όψη επιστρέφει **ως έχει**.
 */
export async function withOwnCredentialHint(
  db: Firestore,
  outcome: EngagementInvitationPreviewOutcome,
  viewer: PageIdentity,
): Promise<EngagementInvitationPreviewOutcome> {
  if (outcome.kind !== 'preview' || outcome.addressedToViewer !== true || !viewer.ok) return outcome;
  const history = await listEngagementsOfUser(db, viewer.ctx.uid);
  // «Δεν μπόρεσα να ρωτήσω» ⇒ η υπόδειξη του γραφείου μένει· η προσυμπλήρωση δεν είναι κρίση (το ίχνος το γράφει η λίστα).
  if (history.outcome !== 'ok') return outcome;
  const own = latestOwnDeclaration(history.engagements, outcome.preview.credentialAuthority);
  return own === null ? outcome : { ...outcome, preview: { ...outcome.preview, credentialHint: own } };
}
