/**
 * @fileoverview Accounting Repository — Company Setup (M-001): **ΜΙΑ συναλλαγή — ανάγνωση → μάσκα →
 *   γραφή → ίχνος** (ADR-841 §7 Α23 Φ3.2 Γ3 · ADR-439 · ADR-440 · ADR-256).
 *
 * 🔴 Ως τις 2026-09-15: `get`, μετά `set(ολόκληρο)` χωρίς συναλλαγή, και ίχνος **μετά** και **έξω**
 * από τη γραφή. Μια μπαγιάτικη οθόνη ξανάγραφε σιωπηλά επωνυμία που είχε υιοθετηθεί στο μεταξύ, και
 * η διαδρομή έκρινε τις συνέπειες από **δεύτερη** ανάγνωση.
 *
 * 🔑 Τώρα (Firestore: read-modify-write **μόνο** μέσα σε συναλλαγή):
 * - το αποθηκευμένο διαβάζεται με `transaction.get` ⇒ ταυτόχρονη γραφή ⇒ το σώμα **ξανατρέχει**·
 * - γράφονται **μόνο** τα πεδία της μάσκας (`mergeProfileFields` — Figma · AIP-134 · Protobuf `oneof`)·
 * - το ίχνος (`auditOf`) μπαίνει στην **ίδια** συναλλαγή — αλλαγή χωρίς ίχνος είναι αδύνατη·
 * - τίποτα δεν άλλαξε ⇒ **καμία** γραφή (ιδεμποτής: ούτε `updatedAt`, ούτε ίχνος).
 * - ο **σύντροφος** (`options.companion`, Α23.12) δεσμεύεται στην **ίδια** συναλλαγή — π.χ. η διαγραφή του
 *   αντιγράφου ΓΕΜΗ όταν άλλαξε ο αριθμός: αλλαγή αριθμού με παλιό αντίγραφο να επιζεί είναι αδύνατη.
 *
 * ⚠️ Το σώμα μπορεί να τρέξει **πολλές** φορές: μόνο αναγνώσεις/γραφές της συναλλαγής και καθαρές
 * συναρτήσεις. Οι συνέπειες (βιτρίνα, αγγελίες) ανήκουν στον καλούντα, **μετά** το commit.
 *
 * ⚖️ GDPR: άρθ. 6(1)(β) — πράξη του κατόχου στο δικό του προφίλ · ίχνος 6(1)(γ) (ΚΦΔ) + 5(2) ·
 * 5(1)(γ) — γράφεται μόνο ό,τι άλλαξε.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { CompanyProfile, CompanySetupInput } from '../../types/company';
import { LEGACY_DEFAULT_ENTITY_TYPE } from '../../types/entity';
import type { TenantContext } from '../../types/common';
import type { CompanySetupSaveOptions, CompanySetupSaveResult } from '../../types/interfaces';
import { changedProfileFields, mergeProfileFields } from '../setup/company-profile-field-mask';

import { appendAuditEntryInTransaction } from './accounting-repo-audit';
import { isoNow, sanitizeForFirestore } from './firestore-helpers';

/** Έγγραφο χωρίς `entityType` ⇒ ατομική (ο ΕΝΑΣ κανόνας, ADR-841 Α23) — για **κάθε** ανάγνωση. */
function companyProfileOf(raw: Record<string, unknown>): CompanyProfile {
  const profile = raw.entityType ? raw : { ...raw, entityType: LEGACY_DEFAULT_ENTITY_TYPE };
  return profile as unknown as CompanyProfile;
}

function profileRefOf(db: Firestore, tenant: TenantContext) {
  return db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(tenant.companyId);
}

export async function getCompanySetup(tenant: TenantContext): Promise<CompanyProfile | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await profileRefOf(db, tenant).get();
    return snap.exists ? companyProfileOf(snap.data() as Record<string, unknown>) : null;
  }, null);
}

/** Ίδιο περιεχόμενο **και** ήδη σφραγισμένο για τον οργανισμό ⇒ τίποτα να γραφτεί. */
function isUnchanged(
  stored: Record<string, unknown> | null,
  before: CompanyProfile | null,
  merged: CompanySetupInput,
  tenant: TenantContext,
): before is CompanyProfile {
  return before !== null
    && stored?.companyId === tenant.companyId
    && changedProfileFields(before, merged).length === 0;
}

/** Σφραγίδες του διακομιστή — ο πελάτης δεν τις γράφει ποτέ. */
function stampedProfile(merged: CompanySetupInput, before: CompanyProfile | null, tenant: TenantContext): CompanyProfile {
  const now = isoNow();
  return companyProfileOf({ ...merged, companyId: tenant.companyId, createdAt: before?.createdAt ?? now, updatedAt: now });
}

async function writeCompanySetup(
  db: Firestore,
  transaction: Transaction,
  tenant: TenantContext,
  data: CompanySetupInput,
  options: CompanySetupSaveOptions,
): Promise<CompanySetupSaveResult> {
  const ref = profileRefOf(db, tenant);
  // ⚠️ Firestore: όλες οι αναγνώσεις ΠΡΙΝ από κάθε γραφή — ο σύντροφος διαβάζει εδώ, γράφει στο τέλος.
  const [snap, companionWrite] = await Promise.all([transaction.get(ref), options.companion?.(transaction)]);
  const stored = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  const before = stored === null ? null : companyProfileOf(stored);
  const merged = mergeProfileFields(before, data, options.fields);
  if (isUnchanged(stored, before, merged, tenant)) return { before, after: before };

  const after = stampedProfile(merged, before, tenant);
  transaction.set(ref, sanitizeForFirestore({ ...after }));
  for (const entry of options.auditOf?.(before, after) ?? []) {
    appendAuditEntryInTransaction(db, transaction, tenant, entry);
  }
  companionWrite?.(before, after);
  return { before, after };
}

/** Αποτυχία **πετά**: μια αποθήκευση δεν προσποιείται ποτέ επιτυχία (κανένα fallback). */
export async function saveCompanySetup(
  tenant: TenantContext,
  data: CompanySetupInput,
  options: CompanySetupSaveOptions = {},
): Promise<CompanySetupSaveResult> {
  return safeFirestoreOperation((db) =>
    db.runTransaction((transaction) => writeCompanySetup(db, transaction, tenant, data, options)),
  );
}
