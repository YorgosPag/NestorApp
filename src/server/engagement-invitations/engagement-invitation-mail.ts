import 'server-only';

/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΟΥ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ, ΑΝΑ ΕΙΔΟΣ** — ένας συνθέτης ανά είδος υπόθεσης, ολικός πίνακας.
 * @related ADR-862 §5.3.11 · ADR-915 §39 · ADR-744 §27.4 · `server/engagements/engagement-hosts.ts` (οι οικοδεσπότες)
 * @module server/engagement-invitations/engagement-invitation-mail
 *
 * 🔑 **Γιατί ΔΕΝ είναι μέθοδος του οικοδεσπότη (διαχωρισμός διεπαφών).** Τον οικοδεσπότη τον ρωτούν η όψη, η
 *    εξαργύρωση και η σελίδα του επαγγελματία· το email το χρειάζεται **μόνο** η διαδρομή αποστολής
 *    (`engagement-invitation-notice.ts`). Όσο ο συνθέτης ζούσε μέσα στον οικοδεσπότη, κάθε σελίδα που ρωτούσε τον
 *    οικοδεσπότη έσερνε στατικά τα email templates και τα λεξιλόγιά τους — μετρημένο: η `/case-invite/[token]` πήρε
 *    το `document-registry` στο route slice της (CHECK 3.34) για ένα email που δεν στέλνει ποτέ.
 * 🔑 Τα στοιχεία διαβάζονται από τους **ίδιους** αναγνώστες με την όψη (`describe…Invitation`) — μία περιγραφή, όχι δύο.
 * 🔑 Τρίτο είδος υπόθεσης **δεν μεταγλωττίζεται** χωρίς συνθέτη εδώ (ολικός πίνακας πάνω στο `EngagementSubjectKind`).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { caseInvitationHref } from '@/lib/conveyance/conveyance-routes';
import { publicUrl } from '@/lib/http/public-origin';
import { describeConveyanceInvitation } from '@/services/conveyance/conveyance-engagement-host-adapter';
import { contactNameOf, describeIssuanceInvitation } from '@/services/document-registry/issuance-engagement-host-adapter';
import type { ConfirmationEmailResult } from '@/services/email-templates/confirmation-email-shared';
import { buildEngagementInvitationEmail } from '@/services/email-templates/engagement-invitation-email';
import { buildIssuanceEmail } from '@/services/email-templates/issuance-invitation-email';
import type { EngagementSubjectKind } from '@/types/engagement';
import {
  isConveyanceInvitation,
  isIssuanceInvitation,
  type ConveyanceEngagementInvitation,
  type EngagementInvitation,
  type IssuanceEngagementInvitation,
} from '@/types/engagement-invitation';

type InvitationOf<K extends EngagementSubjectKind> = Extract<EngagementInvitation, { readonly subject: { readonly kind: K } }>;

/** `null` ⇒ χωρίς δημόσια διεύθυνση (ποτέ σύνδεσμος που δεν οδηγεί πουθενά). Το ωμό token **μόνο** εδώ. */
type ComposerFor<K extends EngagementSubjectKind> = (
  db: Firestore,
  invitation: InvitationOf<K>,
  token: string,
  language: unknown,
) => Promise<ConfirmationEmailResult | null>;

/** Η πρόσκληση υπόθεσης μεταβίβασης — ρόλος + κατάλογος του ρόλου. */
async function composeConveyance(db: Firestore, invitation: ConveyanceEngagementInvitation, token: string, language: unknown) {
  const description = await describeConveyanceInvitation(db, invitation);
  return buildEngagementInvitationEmail({
    language,
    hostName: description.hostName,
    propertyLabel: description.propertyLabel,
    role: invitation.role,
    checklist: description.subject.checklist,
    expiresAt: invitation.expiresAt,
    token,
  });
}

/**
 * §39 — η πρόσκληση στον χώρο της ανάθεσης (επαναποστολή): «ο χώρος της ανάθεσης σας περιμένει». Το προσόν και ο
 * αριθμός είναι ό,τι κατέγραψε το γραφείο (το «(όπως το δήλωσε το γραφείο)» των άλλων μηνυμάτων της ανάθεσης).
 */
async function composeIssuance(db: Firestore, invitation: IssuanceEngagementInvitation, token: string, language: unknown) {
  const link = publicUrl(caseInvitationHref(token));
  if (link === null) return null;
  const [description, professionalName] = await Promise.all([
    describeIssuanceInvitation(db, invitation),
    contactNameOf(db, invitation.hostCompanyId, invitation.contactId),
  ]);
  const facts = {
    officeName: description.hostName,
    propertyLabel: description.propertyLabel,
    documentKind: invitation.documentKind,
    professionalName,
    credential: { qualification: invitation.qualification, registryNumber: invitation.credentialHint.number },
    note: null,
  };
  return buildIssuanceEmail({ kind: 'space', language, facts, space: { link, expiresAt: invitation.expiresAt } });
}

/** Ολικός — **συνάρτηση, όχι σταθερά module** (CHECK 3.80, ίδια αρχή με το `engagementHosts()`). */
function invitationComposers(): { readonly [K in EngagementSubjectKind]: ComposerFor<K> } {
  return { conveyance_case: composeConveyance, document_issuance: composeIssuance };
}

/** **Το email αυτής της πρόσκλησης**, στη γλώσσα του παραλήπτη — από το είδος της υπόθεσής της, ποτέ από το αίτημα. */
export function composeEngagementInvitationEmail(
  db: Firestore,
  invitation: EngagementInvitation,
  token: string,
  language: unknown,
): Promise<ConfirmationEmailResult | null> {
  if (isIssuanceInvitation(invitation)) return invitationComposers().document_issuance(db, invitation, token, language);
  if (isConveyanceInvitation(invitation)) return invitationComposers().conveyance_case(db, invitation, token, language);
  throw new Error(`Engagement invitation ${invitation.id} has no composer for its subject kind`);
}
