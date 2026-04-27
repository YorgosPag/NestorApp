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
    [doc['firstName'], doc['lastName']].filter(Boolean).join(' ') ||
    (doc['companyName'] as string | undefined) ??
    ''
  );
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
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await docRef.get();
  if (!snap.exists || snap.data()?.companyId !== companyId) return;
  const currentEmails = (snap.data()?.emails ?? []) as Array<{ email: string }>;
  const normalized = email.toLowerCase().trim();
  if (currentEmails.some((e) => e.email.toLowerCase() === normalized)) return;
  const emailType = inferEmailType(email);
  await docRef.update({
    emails: FieldValue.arrayUnion({ email: normalized, type: emailType, isPrimary: currentEmails.length === 0 }),
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: uid,
  });
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: resolveDisplayName(snap.data() as Record<string, unknown>),
    action: 'updated',
    changes: [{ field: 'emails', oldValue: null, newValue: `${normalized} (${emailType})`, label: 'Email' }],
    performedBy: uid,
    performedByName: uid,
    companyId,
  });
}

// ── Logo storage ─────────────────────────────────────────────────────────────

export async function setContactLogoIfEmpty(
  contactId: string,
  companyId: string,
  uid: string,
  logoUrl: string,
): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await docRef.get();
  if (!snap.exists || snap.data()?.companyId !== companyId) return;
  if (snap.data()?.photoURL) return;
  await docRef.update({ photoURL: logoUrl, updatedAt: FieldValue.serverTimestamp(), lastModifiedBy: uid });
}

// ── Supplier persona ──────────────────────────────────────────────────────────

const SUPPLIER_PERSONA = { personaType: 'supplier', status: 'active', supplierCategory: null, paymentTermsDays: null, tradeSpecialties: [] } as const;

export async function ensureSupplierPersona(
  contactId: string,
  companyId: string,
  uid: string,
): Promise<void> {
  const db = getAdminFirestore();
  const docRef = db.collection(COLLECTIONS.CONTACTS).doc(contactId);
  const snap = await docRef.get();
  if (!snap.exists || snap.data()?.companyId !== companyId) return;
  const personaTypes = (snap.data()?.personaTypes ?? []) as string[];
  if (personaTypes.includes('supplier')) return;
  await docRef.update({
    personas: FieldValue.arrayUnion(SUPPLIER_PERSONA),
    personaTypes: FieldValue.arrayUnion('supplier'),
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: uid,
  });
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: contactId,
    entityName: resolveDisplayName(snap.data() as Record<string, unknown>),
    action: 'updated',
    changes: [{ field: 'personaTypes', oldValue: null, newValue: 'supplier', label: 'Persona' }],
    performedBy: uid,
    performedByName: uid,
    companyId,
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
