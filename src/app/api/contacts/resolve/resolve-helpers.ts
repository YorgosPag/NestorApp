/**
 * Helpers for POST /api/contacts/resolve — schemas, name matching, email/bank storage.
 * @see route.ts
 */

import 'server-only';

import { z } from 'zod';
import { getAdminFirestore, FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { BankAccountsServerService } from '@/services/banking/bank-accounts-server.service';
import type { CurrencyCode } from '@/types/contacts/banking';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';

const logger = createModuleLogger('ContactResolveRoute');

// ── Schemas ──────────────────────────────────────────────────────────────────

export const BankAccountSchema = z.object({
  bankName: z.string().min(1),
  bic: z.string().nullable().optional(),
  iban: z.string().min(5),
  currency: z.string().nullable().optional(),
  accountHolder: z.string().nullable().optional(),
});

export const ResolveContactSchema = z.object({
  vatNumber: z.string().nullable().optional(),
  name: z.string().min(1).nullable().optional(),
  phone: z.string().nullable().optional(),
  emails: z.array(z.string()).optional(),
  logoUrl: z.string().nullable().optional(),
  vendorAddress: z.string().nullable().optional(),
  vendorCity: z.string().nullable().optional(),
  vendorPostalCode: z.string().nullable().optional(),
  vendorCountry: z.string().nullable().optional(),
  bankAccounts: z.array(BankAccountSchema).optional(),
});

// ── Name / VAT helpers ────────────────────────────────────────────────────────

export function normalizeVat(vat: string | null | undefined): string {
  if (!vat) return '';
  return vat.replace(/^BG/i, '').replace(/\s/g, '').toLowerCase();
}

const SUFFIX_RE =
  /\b(α\.?ε\.?|ε\.?π\.?ε\.?|ι\.?κ\.?ε\.?|ο\.?ε\.?|еоод|оод|ад|ltd|llc|inc|gmbh|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?|n\.?v\.?)\b\.?/gi;

export function stripLegalSuffix(name: string): string {
  return name.replace(SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
}

export function resolveDisplayName(doc: Record<string, unknown>): string {
  return (
    (doc['displayName'] as string | undefined) ??
    (doc['name'] as string | undefined) ??
    ([doc['firstName'], doc['lastName']].filter(Boolean).join(' ') ||
      ((doc['companyName'] as string | undefined) ?? ''))
  );
}

// ── Το άνοιγμα «δική μου επαφή;» ──────────────────────────────────────────────

/**
 * Ανοίγει την επαφή **μόνο αν ανήκει** στον καλούντα — αλλιώς `null`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ (ADR-742 §7octies · N.18)
 * ─────────────────────────────────────────────────────────────────────────────
 * Τρεις συναρτήσεις αυτού του αρχείου (`storeContactEmail`,
 * `setContactLogoIfEmpty`, `ensureSupplierPersona`) έγραφαν **αυτολεξεί** την
 * ίδια τριάδα:
 *
 * ```ts
 * const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
 * const snap = await docRef.get();
 * if (!snap.exists || snap.data()?.companyId !== companyId) return;
 * ```
 *
 * 🔴 **Και οι τρεις είχαν την παγίδα του κενού** (§4): σκέτο `!==` σημαίνει ότι
 * καλών με χαλασμένο token (`companyId: ''`) **έγραφε** σε κάθε επαφή με κενό ή
 * απόν `companyId` — και εδώ η ζημιά δεν είναι διαρροή αλλά **εγγραφή**:
 * προσθήκη email, αλλαγή λογότυπου, προσθήκη ρόλου προμηθευτή σε ξένο έγγραφο.
 *
 * ⚠️ Η πολιτική παραμένει **σιωπηλή** (`null`, όχι ρίψη) — αυτές οι συναρτήσεις
 * είναι βοηθητικά βήματα του `resolve`, όχι σύνορα HTTP, και το ADR-742 §7ter
 * τις είχε ήδη ταξινομήσει ως **Δ** (σιωπούν ήδη). Αλλάζει ο **έλεγχος**, όχι η
 * σημασιολογία της αστοχίας.
 */
async function openOwnedContact(
  contactId: string,
  companyId: string,
): Promise<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData } | null> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await ref.get();

  if (!snap.exists) return null;

  const data = snap.data();
  if (!isPayloadOwnedByCompany(data, companyId)) {
    logger.warn('Cross-tenant contact write blocked', { contactId, callerCompanyId: companyId });
    return null;
  }

  return { ref, data: data! };
}

/**
 * Καταγράφει **μία** αλλαγή πεδίου επαφής στο ημερολόγιο οντότητας.
 *
 * ⚠️ Εξήχθη επειδή το `jscpd` το μέτρησε ως κλώνο (10 γρ. / 57 tokens) ανάμεσα
 * στο `storeContactEmail` και στο `ensureSupplierPersona` — **και ο κλώνος
 * γεννήθηκε από τη ίδια αυτή δουλειά**: όσο τα δύο σημεία διάβαζαν το φορτίο με
 * διαφορετικό τρόπο (`snap.data()` το καθένα) έμοιαζαν λιγότερο· μόλις το
 * άνοιγμα ενοποιήθηκε στο {@link openOwnedContact}, οι δύο ουρές έγιναν
 * **πανομοιότυπες**. Ακριβώς η αστοχία που προβλέπει ο N.18 — απλώς προέκυψε
 * **ως συνέπεια** μιας σωστής κεντρικοποίησης, όχι πριν από αυτήν.
 */
async function recordContactChange(
  contactId: string,
  data: FirebaseFirestore.DocumentData,
  uid: string,
  companyId: string,
  change: { field: string; newValue: string; label: string },
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: resolveDisplayName(data as Record<string, unknown>),
    action: 'updated',
    changes: [{ ...change, oldValue: null }],
    performedBy: uid,
    performedByName: uid,
    companyId,
  });
}

// ── Email storage ─────────────────────────────────────────────────────────────

function inferEmailType(email: string): string {
  const prefix = email.split('@')[0].toLowerCase();
  if (['sales', 'sale'].includes(prefix)) return 'sales';
  if (['info', 'information', 'contact'].includes(prefix)) return 'info';
  if (['support', 'help'].includes(prefix)) return 'support';
  if (['hr', 'humanresources'].includes(prefix)) return 'department';
  return 'general';
}

export async function storeContactEmail(
  contactId: string,
  companyId: string,
  uid: string,
  email: string,
): Promise<void> {
  const owned = await openOwnedContact(contactId, companyId);
  if (owned === null) return;
  const { ref: docRef, data } = owned;
  const currentEmails = (data.emails ?? []) as Array<{ email: string }>;
  const normalized = email.toLowerCase().trim();
  if (currentEmails.some((e) => e.email.toLowerCase() === normalized)) return;
  const emailType = inferEmailType(email);
  await docRef.update({
    emails: FieldValue.arrayUnion({ email: normalized, type: emailType, isPrimary: currentEmails.length === 0 }),
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: uid,
  });
  await recordContactChange(contactId, data, uid, companyId, {
    field: 'emails',
    newValue: `${normalized} (${emailType})`,
    label: 'Email',
  });
}

// ── Logo storage ─────────────────────────────────────────────────────────────

export async function setContactLogoIfEmpty(
  contactId: string,
  companyId: string,
  uid: string,
  logoUrl: string,
): Promise<void> {
  const owned = await openOwnedContact(contactId, companyId);
  if (owned === null) return;
  if (owned.data.logoURL) return;
  await owned.ref.update({ logoURL: logoUrl, updatedAt: FieldValue.serverTimestamp(), lastModifiedBy: uid });
}

// ── Supplier persona ──────────────────────────────────────────────────────────

const SUPPLIER_PERSONA = { personaType: 'supplier', status: 'active', supplierCategory: null, paymentTermsDays: null, tradeSpecialties: [] } as const;

export async function ensureSupplierPersona(
  contactId: string,
  companyId: string,
  uid: string,
): Promise<void> {
  const owned = await openOwnedContact(contactId, companyId);
  if (owned === null) return;
  const { ref: docRef, data } = owned;
  const personaTypes = (data.personaTypes ?? []) as string[];
  if (personaTypes.includes('supplier')) return;
  await docRef.update({
    personas: FieldValue.arrayUnion(SUPPLIER_PERSONA),
    personaTypes: FieldValue.arrayUnion('supplier'),
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: uid,
  });
  await recordContactChange(contactId, data, uid, companyId, {
    field: 'personaTypes',
    newValue: 'supplier',
    label: 'Persona',
  });
}

// ── Bank account storage ──────────────────────────────────────────────────────

export type BankAccountInput = z.infer<typeof BankAccountSchema>;

export async function storeBankAccounts(
  contactId: string,
  companyId: string,
  uid: string,
  accounts: BankAccountInput[],
  contactDisplayName?: string,
): Promise<void> {
  for (let i = 0; i < accounts.length; i++) {
    const b = accounts[i];
    const result = await BankAccountsServerService.addAccount(
      contactId,
      {
        bankName: b.bankName,
        bankCode: b.bic ?? undefined,
        iban: b.iban,
        accountType: 'business',
        currency: (b.currency as CurrencyCode | undefined) ?? 'EUR',
        isPrimary: i === 0,
        isActive: true,
        holderName: contactDisplayName ?? b.accountHolder ?? undefined,
      },
      companyId,
      uid,
      { lenientIban: true },
    );
    if (!result.success && !result.error.includes('already exists')) {
      logger.warn('Bank account store failed', { contactId, iban: b.iban, error: result.error });
    }
  }
}
