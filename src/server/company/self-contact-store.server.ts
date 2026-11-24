import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας του δεσμού «χώρος ↔ επαφή»** — `companies/{companyId}.selfContact` (ADR-951).
 * @module server/company/self-contact-store.server
 * @related types/company-self-contact · lib/company/self-contact-ref · server/company/brand-logo-store.server
 *
 * Τρεις πράξεις, όλες εδώ (CHECK της ADR-951: κανείς άλλος δεν γράφει το πεδίο):
 * - **σύνδεση** υπάρχουσας επαφής — προαιρετικά με «η εικόνα της επαφής γίνεται λογότυπο του χώρου», που περνά από
 *   τον ΕΝΑ γραφέα λογοτύπου (`setCompanyBrandLogo`: κανονικοποίηση, αμετάβλητο asset, Ιστορικό)·
 * - **δημιουργία** επαφής από τα στοιχεία του χώρου (μοτίβο Odoo `res.company.create` → partner) — επαφή **και**
 *   δεσμός στην **ίδια** συναλλαγή: ποτέ επαφή-ορφανή, ποτέ δεσμός σε επαφή που δεν γράφτηκε·
 * - **αποσύνδεση** — μόνο ο δεσμός· η επαφή μένει ως έχει.
 *
 * 🔑 **Ιδεμποτία εκ κατασκευής**: σύνδεση με την ήδη συνδεδεμένη επαφή ⇒ τίποτα να γραφτεί.
 * 🔑 Κάθε κρίση επαναλαμβάνεται **μέσα** στη συναλλαγή: ο προέλεγχος πριν το λογότυπο υπάρχει μόνο για να μην αλλάξει
 *    λογότυπο μια σύνδεση που ήδη ξέρουμε ότι θα αρνηθεί.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { performerId, type AuditPerformer } from '@/lib/audit/audit-performer';
import { SELF_CONTACT_FIELD, selfContactOf } from '@/lib/company/self-contact-ref';
import { nowISO } from '@/lib/date-local';
import { FieldValue, getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeVat } from '@/lib/validation/greek-vat-number';
import { auditActorOf, performerStamp, resolvePerformer, type ResolvedPerformer } from '@/server/lib/performer-stamp';
import { buildContactDocument } from '@/services/ai-pipeline/shared/contact-document-builder';
import { readCompanyContactDeclaration, readCompanyTaxDeclaration } from '@/services/company/company-legal-identity';
import { recordAccountContactBirth } from '@/services/contact/account-contact-resolver';
import { isInactiveContact } from '@/services/contact/platform-company-contact-resolver';
import { generateContactId } from '@/services/enterprise-id-convenience';
import { EntityAuditService } from '@/services/entity-audit.service';
import type {
  SelfContactLogoChoice,
  SelfContactRefusal,
  WorkspaceSelfContact,
} from '@/types/company-self-contact';
import { setCompanyBrandLogo } from './brand-logo-store.server';
import { readContactImageBytes } from './contact-image-bytes.server';

const logger = createModuleLogger('SelfContactStore');

export type SelfContactWriteOutcome =
  | { readonly kind: 'linked'; readonly selfContact: WorkspaceSelfContact }
  | { readonly kind: 'unlinked' }
  | { readonly kind: 'refused'; readonly refusal: SelfContactRefusal }
  /** Το έγγραφο του χώρου δεν υπάρχει. */
  | { readonly kind: 'absent' }
  /** Το προφίλ δεν διαβάστηκε (βλάβη) — ποτέ άρνηση «χωρίς επωνυμία» για δεδομένα που δεν είδαμε. */
  | { readonly kind: 'unavailable' };

type Data = FirebaseFirestore.DocumentData | undefined;

const companyRef = (companyId: string) => getAdminFirestore().collection(COLLECTIONS.COMPANIES).doc(companyId);
const contactRef = (contactId: string) => getAdminFirestore().collection(COLLECTIONS.CONTACTS).doc(contactId);

/** Η μία κρίση «μπορεί αυτή η επαφή να είναι ο χώρος;» — ίδια στον προέλεγχο και στη συναλλαγή. */
function contactRefusalOf(companyId: string, exists: boolean, data: Data): SelfContactRefusal | null {
  if (!exists || data?.companyId !== companyId) return 'contact-not-found';
  if (data?.type !== 'company') return 'not-a-company';
  if (isInactiveContact(data)) return 'contact-inactive';
  return null;
}

/** «Ο χώρος δείχνει ήδη ΑΛΛΗ επαφή;» — ίδια επαφή ⇒ όχι άρνηση (ιδεμποτία). */
function linkRefusalOf(company: Data, contactId: string): SelfContactRefusal | null {
  const current = selfContactOf(company);
  return current !== null && current.contactId !== contactId ? 'already-linked' : null;
}

/** Η γραμμή Ιστορικού στον χώρο. Αποτυχία Ιστορικού δεν ακυρώνει την αλλαγή (ADR-195). */
async function recordSelfContactChange(
  companyId: string, previous: string | null, next: string | null, actor: ResolvedPerformer,
): Promise<void> {
  try {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.COMPANY,
      entityId: companyId,
      entityName: null,
      action: 'updated',
      changes: [{ field: SELF_CONTACT_FIELD, oldValue: previous, newValue: next, label: SELF_CONTACT_FIELD }],
      ...auditActorOf(actor),
      companyId,
    });
  } catch (error) {
    logger.warn('Self-contact audit failed', { companyId, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Προέλεγχος εκτός συναλλαγής — μόνο για να μη γραφτεί λογότυπο για σύνδεση που θα αρνηθεί. */
type LinkPrecheck =
  | { readonly passed: true; readonly contact: Data }
  | { readonly passed: false; readonly outcome: SelfContactWriteOutcome };

async function precheckLink(companyId: string, contactId: string): Promise<LinkPrecheck> {
  const [company, contact] = await Promise.all([companyRef(companyId).get(), contactRef(contactId).get()]);
  if (!company.exists) return { passed: false, outcome: { kind: 'absent' } };
  const refusal = contactRefusalOf(companyId, contact.exists, contact.data()) ?? linkRefusalOf(company.data(), contactId);
  if (refusal !== null) return { passed: false, outcome: { kind: 'refused', refusal } };
  return { passed: true, contact: contact.data() };
}

/** «Η εικόνα της επαφής γίνεται λογότυπο του χώρου» — μέσα από τον ΕΝΑ γραφέα λογοτύπου. */
async function adoptContactImage(
  companyId: string, contact: Data, performer: AuditPerformer,
): Promise<SelfContactWriteOutcome | null> {
  const imageUrl = typeof contact?.logoURL === 'string' ? contact.logoURL.trim() : '';
  const bytes = imageUrl === '' ? null : await readContactImageBytes(imageUrl, companyId);
  if (bytes === null) return { kind: 'refused', refusal: 'contact-image-unavailable' };
  const outcome = await setCompanyBrandLogo(companyId, bytes, performer);
  if (outcome.kind === 'refused') return { kind: 'refused', refusal: 'contact-image-refused' };
  return outcome.kind === 'absent' ? { kind: 'absent' } : null;
}

/** Η εγγραφή του δεσμού σε συναλλαγή, με όλες τις κρίσεις ξανά. */
async function writeLink(
  companyId: string, contactId: string, actor: ResolvedPerformer,
): Promise<{ readonly outcome: SelfContactWriteOutcome; readonly previous: string | null; readonly changed: boolean }> {
  return getAdminFirestore().runTransaction(async (tx) => {
    const [company, contact] = await Promise.all([tx.get(companyRef(companyId)), tx.get(contactRef(contactId))]);
    if (!company.exists) return { outcome: { kind: 'absent' }, previous: null, changed: false };
    const refusal = contactRefusalOf(companyId, contact.exists, contact.data()) ?? linkRefusalOf(company.data(), contactId);
    if (refusal !== null) return { outcome: { kind: 'refused', refusal }, previous: null, changed: false };
    const current = selfContactOf(company.data());
    if (current !== null) return { outcome: { kind: 'linked', selfContact: current }, previous: current.contactId, changed: false };
    const selfContact: WorkspaceSelfContact = { contactId, linkedAt: nowISO(), linkedBy: actor.id };
    tx.update(companyRef(companyId), {
      [SELF_CONTACT_FIELD]: selfContact, updatedAt: FieldValue.serverTimestamp(), ...performerStamp(actor),
    });
    return { outcome: { kind: 'linked', selfContact }, previous: null, changed: true };
  });
}

/** **Σύνδεση υπάρχουσας επαφής** ως «ο χώρος». */
export async function linkSelfContact(
  companyId: string, contactId: string, logoChoice: SelfContactLogoChoice, performer: AuditPerformer,
): Promise<SelfContactWriteOutcome> {
  const precheck = await precheckLink(companyId, contactId);
  if (!precheck.passed) return precheck.outcome;
  if (logoChoice === 'use-contact-image') {
    const adopted = await adoptContactImage(companyId, precheck.contact, performer);
    if (adopted !== null) return adopted;
  }
  const actor = await resolvePerformer(performer);
  const { outcome, previous, changed } = await writeLink(companyId, contactId, actor);
  if (changed) {
    await recordSelfContactChange(companyId, previous, contactId, actor);
    logger.info('Self contact linked', { companyId, contactId, logoChoice });
  }
  return outcome;
}

interface ProfileContactSeed {
  readonly companyName: string;
  readonly vatNumber: string | null;
  readonly email: string | null;
  readonly phone: string | null;
}

/**
 * Τα στοιχεία του προφίλ (ADR-439) για τη νέα επαφή. Τρεις διακριτές απαντήσεις: στοιχεία · «χωρίς επωνυμία» (απόφαση
 * του ανθρώπου να τα συμπληρώσει) · «δεν διαβάστηκε» (βλάβη — η επαφή δεν γεννιέται από μισά στοιχεία).
 */
async function profileContactSeed(
  companyId: string,
): Promise<ProfileContactSeed | { readonly kind: 'unavailable' } | { readonly kind: 'refused'; readonly refusal: SelfContactRefusal }> {
  const [tax, channels] = await Promise.all([readCompanyTaxDeclaration(companyId), readCompanyContactDeclaration(companyId)]);
  if (tax.kind === 'unavailable' || channels.kind === 'unavailable') return { kind: 'unavailable' };
  const name = tax.kind === 'present' ? tax.declaration.businessName?.trim() ?? '' : '';
  if (name === '') return { kind: 'refused', refusal: 'profile-nameless' };
  const declaration = channels.kind === 'present' ? channels.declaration : null;
  return {
    companyName: name,
    vatNumber: tax.kind === 'present' && tax.taxId !== null ? normalizeVat(tax.taxId) : null,
    email: declaration?.email ?? null,
    phone: declaration?.phone ?? declaration?.mobile ?? null,
  };
}

/** **Δημιουργία επαφής από τα στοιχεία του χώρου** + σύνδεση, σε ΜΙΑ συναλλαγή (μοτίβο Odoo). */
export async function createSelfContactFromWorkspace(
  companyId: string, performer: AuditPerformer,
): Promise<SelfContactWriteOutcome> {
  const seed = await profileContactSeed(companyId);
  if ('kind' in seed) return seed;
  const actor = await resolvePerformer(performer);
  const contactId = generateContactId();
  const built = buildContactDocument(
    { ...seed, type: 'company', companyId, firstName: '', lastName: '', performer, skipDuplicateCheck: true }, actor,
  );
  const outcome = await getAdminFirestore().runTransaction(async (tx): Promise<SelfContactWriteOutcome> => {
    const company = await tx.get(companyRef(companyId));
    if (!company.exists) return { kind: 'absent' };
    if (selfContactOf(company.data()) !== null) return { kind: 'refused', refusal: 'already-linked' };
    const selfContact: WorkspaceSelfContact = { contactId, linkedAt: nowISO(), linkedBy: actor.id };
    tx.create(contactRef(contactId), built.doc);
    tx.update(companyRef(companyId), {
      [SELF_CONTACT_FIELD]: selfContact, updatedAt: FieldValue.serverTimestamp(), ...performerStamp(actor),
    });
    return { kind: 'linked', selfContact };
  });
  if (outcome.kind !== 'linked') return outcome;
  await recordAccountContactBirth({
    contactId, displayName: built.displayName, companyId, performedBy: performerId(performer),
    origin: { field: SELF_CONTACT_FIELD, value: companyId, label: SELF_CONTACT_FIELD },
  });
  await recordSelfContactChange(companyId, null, contactId, actor);
  return outcome;
}

/** **Αποσύνδεση** — μόνο ο δεσμός· η επαφή και το λογότυπο μένουν. */
export async function unlinkSelfContact(companyId: string, performer: AuditPerformer): Promise<SelfContactWriteOutcome> {
  const actor = await resolvePerformer(performer);
  const previous = await getAdminFirestore().runTransaction(async (tx) => {
    const company = await tx.get(companyRef(companyId));
    if (!company.exists) return undefined;
    const current = selfContactOf(company.data());
    if (current === null) return null;
    tx.update(companyRef(companyId), {
      [SELF_CONTACT_FIELD]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp(), ...performerStamp(actor),
    });
    return current.contactId;
  });
  if (previous === undefined) return { kind: 'absent' };
  if (previous !== null) await recordSelfContactChange(companyId, previous, null, actor);
  return { kind: 'unlinked' };
}
