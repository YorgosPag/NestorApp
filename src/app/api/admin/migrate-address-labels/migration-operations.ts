/**
 * =============================================================================
 * ADDRESS LABEL MIGRATION — raw i18n key ➜ σημασιολογικό slug (ADR-319 / N.11)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Ιστορικά, ο κλάδος φυσικού προσώπου του `EnterpriseContactSaver` αποθήκευε
 * `addresses[].label = 'contacts.address.primary'` — δηλαδή **raw i18n key ως
 * δεδομένο**. Αν μετονομαστεί το κλειδί στα locales, τα ήδη αποθηκευμένα
 * δεδομένα σπάνε: παραβίαση N.11 σε επίπεδο persistence, όχι απλού UI string.
 *
 * ΤΙ ΓΡΑΦΕΙ ΣΤΗ ΘΕΣΗ ΤΟΥ
 * Το σημασιολογικό slug της ταξινομίας ADR-319 (`home`, `headquarters`, …) —
 * ακριβώς ό,τι γράφει σήμερα ο κλάδος εταιρειών. Η μετάφραση γίνεται στο render.
 *
 * ΙΔΙΟΤΡΟΠΙΑ (N.7.2 #3)
 * Επαναλαμβανόμενη εκτέλεση = ίδιο αποτέλεσμα: γράφονται μόνο τα documents που
 * ΕΧΟΥΝ ακόμη legacy key. Δεύτερη εκτέλεση βρίσκει 0 και δεν γράφει τίποτα.
 *
 * AUDIT (γιατί ΔΕΝ καλείται εδώ `EntityAuditService.recordChange`)
 * Τα `contacts` είναι η ΜΟΝΑΔΙΚΗ οντότητα με CDC trigger (`auditContactWrite`)
 * — κάθε `batch.update` παράγει από μόνο του εγγραφή `updated` στο
 * `entity_audit_trail`. Μια service-side κλήση εδώ θα ήταν ακριβώς το διπλότυπο
 * που αφαίρεσε η Φάση 3 του ADR-195. Η ίδια η εκτέλεση της μετάπτωσης
 * καταγράφεται ξεχωριστά από τον envelope (`logMigrationExecuted`, ADR-704).
 *
 * @module app/api/admin/migrate-address-labels/migration-operations
 * @enterprise ADR-319 (contact address taxonomy) · N.11 (i18n SSoT)
 * @see ADR-704 — flushInBatches/BATCH_WRITE_LIMIT· ο `db` έρχεται από τον envelope
 * @see ADR-195 §Φάση 3 — CDC coverage για contacts
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  getPrimaryAddressType,
  isValidContactAddressType,
} from '@/types/contacts/address-types';
import type { ContactType } from '@/types/contacts';

const logger = createModuleLogger('MigrateAddressLabels');

/** Το legacy prefix που δηλώνει «αυτό είναι i18n key, όχι δεδομένο». */
const LEGACY_LABEL_PREFIX = 'contacts.address.';

interface StoredAddress {
  label?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

export interface AddressLabelMigrationEntry {
  contactId: string;
  companyId: string | null;
  /** Τιμές πριν ➜ μετά, ανά θέση στον πίνακα διευθύνσεων. */
  changes: Array<{ index: number; from: string; to: string }>;
}

export interface AddressLabelMigrationReport {
  success: true;
  dryRun: boolean;
  scannedContacts: number;
  affectedContacts: number;
  affectedAddresses: number;
  /** Πλήρης λίστα στο preview· στο execute περιορίζεται για να μη φουσκώσει η απόκριση. */
  entries: AddressLabelMigrationEntry[];
  /** Μηνύματα από batches που απέτυχαν (per-batch resilience, ADR-704). */
  batchErrors?: string[];
}

function isLegacyLabel(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(LEGACY_LABEL_PREFIX);
}

/**
 * Το slug που πρέπει να πάρει μια διεύθυνση με legacy label.
 *
 * Προτεραιότητα: ρητή επιλογή χρήστη ➜ ο ίδιος ο τύπος της διεύθυνσης (αν ανήκει
 * στην ταξινομία) ➜ ο κανονικός πρωτεύων τύπος για το είδος της επαφής.
 */
function resolveReplacementSlug(
  contact: Record<string, unknown>,
  address: StoredAddress,
): string {
  const customFields = contact.customFields as Record<string, unknown> | undefined;
  const explicit = contact.primaryAddressType ?? customFields?.primaryAddressType;
  if (isValidContactAddressType(explicit)) return explicit;

  if (isValidContactAddressType(address.type)) return address.type;

  return getPrimaryAddressType(contact.type as ContactType | undefined);
}

/**
 * Σαρώνει τις επαφές και επιστρέφει τι θα άλλαζε (και το αλλάζει αν `dryRun === false`).
 *
 * @param db Admin Firestore από τον envelope (`runMigration`, ADR-704).
 * @param dryRun όταν `true`, καμία εγγραφή — μόνο αναφορά.
 * @param companyId ο οργανισμός που έλυσε ο `resolveTenantListScopeFromUrl`·
 *        `undefined` = «όλοι οι οργανισμοί», νόμιμη απάντηση μόνο για bypass role (ADR-702).
 */
export async function migrateAddressLabels(
  db: Firestore,
  dryRun: boolean,
  companyId?: string,
): Promise<AddressLabelMigrationReport> {
  // Admin SDK παρακάμπτει τους Firestore rules — το tenant scope εφαρμόζεται ΕΔΩ, ρητά.
  const baseQuery = companyId
    ? db.collection(COLLECTIONS.CONTACTS).where('companyId', '==', companyId)
    : db.collection(COLLECTIONS.CONTACTS);

  const snapshot = await baseQuery.get();

  const entries: AddressLabelMigrationEntry[] = [];
  const pendingWrites: Array<{ id: string; addresses: StoredAddress[] }> = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const addresses = data.addresses;
    if (!Array.isArray(addresses)) continue;

    const changes: AddressLabelMigrationEntry['changes'] = [];
    const nextAddresses = addresses.map((raw, index) => {
      const address = raw as StoredAddress;
      if (!isLegacyLabel(address.label)) return address;

      const to = resolveReplacementSlug(data, address);
      changes.push({ index, from: address.label, to });
      return { ...address, label: to };
    });

    if (changes.length === 0) continue;

    entries.push({
      contactId: docSnap.id,
      companyId: typeof data.companyId === 'string' ? data.companyId : null,
      changes,
    });
    pendingWrites.push({ id: docSnap.id, addresses: nextAddresses });
  }

  const affectedAddresses = entries.reduce((sum, e) => sum + e.changes.length, 0);

  let batchErrors: string[] | undefined;

  if (!dryRun && pendingWrites.length > 0) {
    const updates: BatchUpdate[] = pendingWrites.map((write) => ({
      ref: db.collection(COLLECTIONS.CONTACTS).doc(write.id),
      data: { addresses: write.addresses },
    }));

    const { written, errors } = await flushInBatches(db, updates);
    batchErrors = errors.length > 0 ? errors : undefined;

    logger.info('Address labels migrated', {
      affectedContacts: written,
      affectedAddresses,
      companyId: companyId ?? 'ALL',
      failedBatches: errors.length,
    });
  }

  return {
    success: true,
    dryRun,
    scannedContacts: snapshot.size,
    affectedContacts: entries.length,
    affectedAddresses,
    entries: dryRun ? entries : entries.slice(0, 50),
    ...(batchErrors ? { batchErrors } : {}),
  };
}
