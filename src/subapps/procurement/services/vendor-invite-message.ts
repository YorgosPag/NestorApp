/**
 * =============================================================================
 * ΤΟ ΜΗΝΥΜΑ ΜΙΑΣ ΠΡΟΣΚΛΗΣΗΣ — ο ΕΝΑΣ builder (ADR-327 §7.5 · ADR-923 §5.13)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει (Ε2 · Ε3)**: τέσσερις διαδρομές έφτιαχναν το `VendorInviteMessage` με το χέρι —
 * outbox (`rfq-invite-delivery`), νέα πρόσκληση (`vendor-invite-create`), επαναποστολή
 * (`vendor-invite-links-service`), ανανέωση (`vendor-link-renew`) — και **και οι τέσσερις** έγραφαν
 * `projectName: null`. Έτσι το email έλεγε «για το έργο <τίτλος RFQ>» και η γραμμή του έργου δεν έβγαινε ποτέ.
 * Και η χειροκίνητη πρόσκληση χαιρετούσε «Γεια σας <email>». Τώρα όλες ρωτούν **εδώ**:
 *
 * | Πεδίο | Πηγή |
 * |---|---|
 * | `projectName` | `resolveCompanyProjectNameOrNull` — μόνο έργο του **ίδιου** tenant· ανώνυμο/ξένο/βλάβη ⇒ `null` |
 * | `vendorName` | {@link greetingName} — κενό ή όνομα που περιέχει `@` ⇒ `null` (ουδέτερος χαιρετισμός) |
 * | `responseDueAt` | `rfq.deadlineDate` |
 * | `buyerNote` | το σημείωμα της **πρόσκλησης** — ίδιο σε κάθε αποστολή της |
 *
 * 🔒 Το όνομα του έργου **δεν** σταματά ποτέ μια αποστολή: βλάβη ανάγνωσης ⇒ μήνυμα χωρίς τη γραμμή του έργου.
 *
 * @module subapps/procurement/services/vendor-invite-message
 */

import 'server-only';

import type { HumanLanguage } from '@/i18n/languages';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizePersonalNote } from '@/services/email-templates/personal-note-block';
import { resolveCompanyProjectNameOrNull } from '@/services/financial-intelligence/project-reference';

import type { RFQ } from '../types/rfq';
import type { VendorInviteMessage } from './channels/types';

const logger = createModuleLogger('VENDOR_INVITE_MESSAGE');

type ProjectReader = Parameters<typeof resolveCompanyProjectNameOrNull>[0];

/**
 * Το όνομα που χαιρετάμε — ή `null` για ουδέτερο χαιρετισμό. Ένα όνομα που περιέχει `@` είναι (ή κρύβει)
 * διεύθυνση email, όχι όνομα ανθρώπου: δεν χαιρετάμε ποτέ «Γεια σας info@…» (Ε3).
 */
export function greetingName(raw: string | null | undefined): string | null {
  const name = raw?.trim() ?? '';
  return name === '' || name.includes('@') ? null : name;
}

/** Ο σύνδεσμος που φεύγει με το μήνυμα — ό,τι έχουν κοινό το `IssuedVendorLink` και το `InviteDeliveryLink`. */
export interface VendorInviteMessageLink {
  readonly portalUrl: string;
  readonly declineUrl: string | null;
  readonly expiresAtIso: string;
}

export interface VendorInviteMessageInput {
  /** Ο αναγνώστης του έργου· παραλείπεται ⇒ `getAdminFirestore()`, **μέσα** στο ασφαλές μπλοκ (βλάβη ⇒ χωρίς έργο). */
  readonly db?: ProjectReader;
  readonly companyId: string;
  readonly inviteId: string;
  readonly rfq: Pick<RFQ, 'title' | 'projectId' | 'deadlineDate'>;
  /** Πού πηγαίνει (email, ή ο σύνδεσμος για το `copy_link`). */
  readonly to: string;
  /** Το όνομα του παραλήπτη όπως το ξέρουμε — περνά από {@link greetingName}. */
  readonly recipientName: string | null;
  readonly link: VendorInviteMessageLink;
  readonly buyerNote: string | null | undefined;
  readonly locale: HumanLanguage;
}

async function projectNameOf(input: VendorInviteMessageInput): Promise<string | null> {
  if (!input.rfq.projectId) return null;
  try {
    return await resolveCompanyProjectNameOrNull(input.db ?? getAdminFirestore(), input.rfq.projectId, input.companyId);
  } catch (error) {
    logger.warn('Το όνομα του έργου δεν διαβάστηκε — το μήνυμα φεύγει χωρίς αυτό', { inviteId: input.inviteId, error });
    return null;
  }
}

/** **Το** μήνυμα μιας πρόσκλησης — για κάθε δίαυλο και κάθε διαδρομή αποστολής. */
export async function buildVendorInviteMessage(input: VendorInviteMessageInput): Promise<VendorInviteMessage> {
  const deadline = input.rfq.deadlineDate;
  return {
    inviteId: input.inviteId,
    vendorName: greetingName(input.recipientName),
    recipient: input.to,
    rfqTitle: input.rfq.title,
    projectName: await projectNameOf(input),
    portalUrl: input.link.portalUrl,
    expiresAt: input.link.expiresAtIso,
    responseDueAt: deadline ? new Date(deadline.toMillis()).toISOString() : null,
    buyerNote: normalizePersonalNote(input.buyerNote),
    locale: input.locale,
    declineUrl: input.link.declineUrl,
  };
}
