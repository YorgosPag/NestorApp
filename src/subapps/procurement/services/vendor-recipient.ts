/**
 * =============================================================================
 * ΠΟΙΟΣ ΠΑΡΑΛΑΜΒΑΝΕΙ ΜΙΑ ΠΡΟΣΚΛΗΣΗ — η ΜΙΑ κρίση (ADR-923 §5.13 Ε6δ, Τ5 · ADR-327 §7)
 * =============================================================================
 *
 * Πριν, τρία σημεία διάβαζαν την επαφή και έβγαζαν email μόνα τους (fan-out του `createRfq` · `createVendorInvite` ·
 * `resolveInviteRecipient`). Η επαφή ενός **προμηθευτή της πλατφόρμας** (Τ3) δεν έχει email, άρα και στα τρία η πρόσκληση
 * πήγαινε στο κενό: το RFQ γραφόταν και ο προμηθευτής δεν μάθαινε τίποτα. Τώρα όλα ρωτούν **εδώ**.
 *
 * | Επαφή | Παραλήπτης | Γλώσσα |
 * |---|---|---|
 * | του αγοραστή, με email | το email της επαφής (ο αγοραστής το έγραψε, ο αγοραστής το βλέπει) | `preferredLanguage` της επαφής |
 * | **πλατφόρμας** (`platformCompanyOfContact`) | το `quoteIntake.recipientEmail` του προμηθευτή, **τη στιγμή της αποστολής**, μόνο όσο η βιτρίνα είναι επιβεβαιωμένη **και** δέχεται | η δηλωμένη γλώσσα email των διαχειριστών του χώρου |
 * | ξένη, χωρίς tenant, ανύπαρκτη, χωρίς email | κανένας | — |
 *
 * 🔒 **Ο παραλήπτης αποφασίζεται μόνο από επαληθευμένα δεδομένα του διακομιστή.** Ένα `platformCompanyId` μετρά μόνο αν
 *    συμφωνούν πεδίο, ντετερμινιστικό id ζεύγους, χώρος και τύπος (Τ3)· το πεδίο το γράφει **μόνο** ο διακομιστής
 *    (`firestore.rules`, καρτέλα `contacts`)· και ο χώρος πρέπει να έχει **επιβεβαιωμένη δημόσια βιτρίνα**
 *    (`readPublicSupplier`) — η ίδια κρίση με το σχέδιο του `createRfq`. Ποτέ email ή χώρος από το σώμα ενός αιτήματος.
 * 🔒 Για επαφή πλατφόρμας το email της καρτέλας **αγνοείται**: το κανάλι του χώρου είναι ένα, και το ορίζει ο προμηθευτής.
 * 🔒 Η διεύθυνση του προμηθευτή **δεν** γράφεται σε έγγραφο του αγοραστή ({@link recipientEmailSnapshot}): το
 *    `vendor_invites` το διαβάζει κάθε μέλος της εταιρείας του αγοραστή, και θα γινόταν κανάλι συλλογής διευθύνσεων.
 *
 * @module subapps/procurement/services/vendor-recipient
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { DEFAULT_LANGUAGE, isHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { readQuoteIntakeRecipient } from '@/server/catalog/public/public-model-snapshot.server';
import { loadDeclaredEmailLanguage } from '@/server/notifications/user-notification-settings-store';
import { isInactiveContact, platformCompanyOfContact } from '@/services/contact/platform-company-contact-resolver';
import { getContactEmail } from '@/services/contacts/contact-name-resolver-types';
import { readPublicSupplier } from '@/services/public-catalog/public-catalog.reader';

import type { DeliveryChannel } from '../types/vendor-invite';
import type { InviteRecipientKind } from '../types/vendor-invite-delivery';
import { pickContactDisplayName } from './vendor-name-resolver';

export interface VendorContactSnapshot {
  id: string;
  displayName: string;
  email: string | null;
  preferredChannel: DeliveryChannel | null;
  /** Ο χώρος του προμηθευτή, **μόνο** όταν η καρτέλα περνά την κρίση `platformCompanyOfContact`. */
  platformCompanyId: string | null;
  /** Η γλώσσα που δήλωσε ο αγοραστής για την επαφή (`preferredLanguage`), αλλιώς `null`. */
  language: HumanLanguage | null;
  /** Λ1β Χ1 — αρχειοθετημένη ή διαγραμμένη καρτέλα (ίδια κρίση με τη γέννηση της επαφής πλατφόρμας). */
  inactive: boolean;
}

/**
 * 🔑 Λ1β Χ2 — **πετά** σε βλάβη ανάγνωσης (ήταν `safeFirestoreOperation(…, null)`): ένα στιγμιαίο σφάλμα γινόταν «ανύπαρκτη
 * επαφή», δηλαδή οριστικό `no_recipient`. Τώρα η παράδοση το βλέπει ως εξαίρεση και ξαναδοκιμάζει.
 */
export async function fetchVendorContact(companyId: string, contactId: string): Promise<VendorContactSnapshot | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  // Επαφή χωρίς `companyId` δεν ανήκει σε κανέναν (ADR-742 §4 · ADR-876 §5 Σ15) — ήταν `data.companyId && …`.
  if (!isPayloadOwnedByCompany(data, companyId)) return null;
  const supplierPersona = data.supplierPersona as { preferredChannel?: DeliveryChannel } | undefined;
  return {
    id: snap.id,
    displayName: pickContactDisplayName(data) ?? contactId,
    email: getContactEmail(data as Parameters<typeof getContactEmail>[0]),
    preferredChannel: supplierPersona?.preferredChannel ?? null,
    platformCompanyId: platformCompanyOfContact(snap.id, companyId, data),
    language: isHumanLanguage(data.preferredLanguage) ? data.preferredLanguage : null,
    inactive: isInactiveContact(data),
  };
}

/** Ένας παραλήπτης που μπορεί να λάβει email. */
export interface VendorRecipient {
  readonly email: string;
  readonly name: string;
  readonly kind: InviteRecipientKind;
  /** Μόνο για `platform`: ο χώρος του προμηθευτή (ποσόστωση, ειδοποίηση). */
  readonly platformCompanyId: string | null;
  /** Η γλώσσα του **παραλήπτη**, όταν την έχει δηλώσει κάποιος· αλλιώς `null` ({@link inviteEmailLanguage}). */
  readonly language: HumanLanguage | null;
}

/**
 * Η γλώσσα email που δήλωσε **ο ίδιος ο προμηθευτής**: ο πρώτος (σταθερή σειρά) ενεργός διαχειριστής του χώρου με δηλωμένη
 * γλώσσα. Καμία δήλωση ή βλάβη ανάγνωσης ⇒ `null` (η αποστολή δεν εξαρτάται από αυτό).
 */
async function supplierEmailLanguage(supplierCompanyId: string): Promise<HumanLanguage | null> {
  try {
    const administrators = [...(await activeWorkspaceAdministrators(getAdminFirestore(), supplierCompanyId))].sort();
    for (const uid of administrators) {
      const declared = await loadDeclaredEmailLanguage(uid);
      if (declared !== null) return declared;
    }
  } catch {
    // Η γλώσσα δεν σταματά ποτέ μια παράδοση: πέφτει στην προεπιλογή.
  }
  return null;
}

/** Ο παραλήπτης μιας **ήδη ελεγμένης** επαφής του αγοραστή `buyerCompanyId`. */
export async function recipientOfContact(contact: VendorContactSnapshot, buyerCompanyId: string): Promise<VendorRecipient | null> {
  const supplier = contact.platformCompanyId;
  if (supplier === null) {
    return contact.email
      ? { email: contact.email, name: contact.displayName, kind: 'contact', platformCompanyId: null, language: contact.language }
      : null;
  }
  if (supplier === buyerCompanyId || contact.inactive) return null;
  // Χωρίς επιβεβαιωμένη βιτρίνα δεν υπάρχει opt-in (§5.13 Ε6β) — ίδια κρίση με το `requireQuoteSupplierName`.
  if ((await readPublicSupplier(supplier)) === null) return null;
  const email = await readQuoteIntakeRecipient(supplier);
  if (!email) return null;
  return { email, name: contact.displayName, kind: 'platform', platformCompanyId: supplier, language: await supplierEmailLanguage(supplier) };
}

/** **Η μία ερώτηση «σε ποιον πάει;»** για την επαφή `contactId` του αγοραστή `companyId`. `null` ⇒ πουθενά. */
export async function resolveVendorRecipient(companyId: string, contactId: string): Promise<VendorRecipient | null> {
  const contact = await fetchVendorContact(companyId, contactId);
  return contact === null ? null : recipientOfContact(contact, companyId);
}

/** Τι επιτρέπεται να μείνει ως στιγμιότυπο στην πρόσκληση: ποτέ η ιδιωτική διεύθυνση ενός χώρου της πλατφόρμας. */
export function recipientEmailSnapshot(recipient: Pick<VendorRecipient, 'email' | 'kind'>): string | null {
  return recipient.kind === 'platform' ? null : recipient.email;
}

/**
 * **Σε ποια γλώσσα γράφεται το email** — του **παραλήπτη**, όχι της οθόνης του αγοραστή: δηλωμένη γλώσσα του παραλήπτη ⇒
 * η γλώσσα που ζήτησε ο αποστολέας ⇒ η προεπιλογή του έργου.
 */
export function inviteEmailLanguage(recipient: Pick<VendorRecipient, 'language'> | null, requested?: HumanLanguage): HumanLanguage {
  return recipient?.language ?? requested ?? DEFAULT_LANGUAGE;
}

/**
 * 🔒 Το κείμενο σφάλματος του παρόχου για χώρο της πλατφόρμας μπορεί να περιέχει τη διεύθυνση `quoteIntake` του — ιδιωτική
 * για τον αγοραστή (ADR-923 §5.13 Τ5). Εκεί φτάνει μόνο ο κωδικός· το ωμό κείμενο το καταγράφει ο ίδιος ο δίαυλος.
 */
export function buyerVisibleErrorReason(kind: InviteRecipientKind | null, errorReason: string | null): string | null {
  if (errorReason === null || kind !== 'platform') return errorReason;
  return 'provider_rejected';
}
