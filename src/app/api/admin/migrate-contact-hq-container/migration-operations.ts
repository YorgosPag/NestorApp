/**
 * =============================================================================
 * CONTACT HQ CONTAINER MIGRATION — η έδρα σε ΕΝΑ δοχείο (ADR-332 §D30 Φάση 2)
 * =============================================================================
 *
 * ΤΙ ΔΙΟΡΘΩΝΕΙ
 * Ως τη Φάση 2 η διαδρομή ενημέρωσης άφηνε τα επίπεδα πεδία έδρας της φόρμας να πέφτουν στη
 * **ρίζα** του εγγράφου (μετρημένο στην `cont_c4d79d09…`: top-level `neighborhood`), και πολύ παλιά
 * έγγραφα κρατούν τη διεύθυνση **μόνο** εκεί. Ο κώδικας τα ανέχεται (tolerant reader, 4η πηγή του
 * `resolveContactAddresses`) και τα επισκευάζει στην επόμενη αποθήκευση (repair-on-write). Αυτή η
 * μετάπτωση κάνει το ίδιο **για όλα** τα έγγραφα, ώστε να ανοίξει το contract.
 *
 * ΤΙ ΓΡΑΦΕΙ, ΑΝΑ ΕΓΓΡΑΦΟ
 * 1. Λείπει η αυθεντική λίστα (`customFields.companyAddresses`) ⇒ υλοποιείται με τον **ίδιο**
 *    reader της φόρμας (λίστα ρίζας → `addresses[]` → ρίζα), κλαδεμένη (D20), με ταυτότητες (N.6)·
 *    και το `addresses[]` ξαναπαράγεται από αυτή με τον **ίδιο** builder του saver.
 * 2. Κάθε `LEGACY_ROOT_ADDRESS_FIELDS` της ρίζας ⇒ `FieldValue.delete()`. Ποτέ η μόνη αντιγραφή:
 *    ρίζα με κείμενο υλοποιείται στη λίστα **στην ίδια εγγραφή** (βήμα 1)· ρίζα χωρίς κείμενο = κενά κλειδιά.
 *
 * 🔑 Ο ΜΕΤΡΗΤΗΣ ΑΠΟΦΑΣΙΖΕΙ ΤΟ CONTRACT. Το dry-run (GET) επιστρέφει `affectedContacts`. Όταν
 * δείξει 0, ο κλάδος ρίζας του reader, το `contact-hq-legacy-fields` και το λεξιλόγιο
 * `contactFlat` (ADR-772) φεύγουν — σε ξεχωριστό, μελλοντικό commit.
 *
 * ΙΔΙΟΤΡΟΠΙΑ (N.7.2 #3): δεύτερη εκτέλεση βρίσκει 0 έγγραφα και δεν γράφει τίποτα.
 *
 * AUDIT: τα `contacts` έχουν CDC trigger (`auditContactWrite`, ADR-195 Φάση 3) — κάθε `update`
 * παράγει από μόνο του γραμμή ιστορικού· η εκτέλεση καταγράφεται από τον envelope (ADR-704).
 *
 * @module app/api/admin/migrate-contact-hq-container/migration-operations
 * @enterprise ADR-332 §D30 Φάση 2 · ADR-772 · ADR-704 · ADR-319
 */

import 'server-only';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import type { ResolvedPerformer } from '@/server/lib/performer-stamp';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import { generateAddressId } from '@/services/enterprise-id.service';
import { buildAddressInfoListFromCompanyAddresses } from '@/utils/contacts/address-info-builder';
import { authoritativeContactAddresses, resolveContactAddresses } from '@/utils/contacts/contact-addresses-reader';
import { pruneBlankContactAddresses } from '@/utils/contacts/contact-address-blankness';
import { presentLegacyRootAddressFields } from '@/utils/contacts/contact-hq-legacy-fields';

const logger = createModuleLogger('MigrateContactHqContainer');

export interface ContactHqMigrationEntry {
  contactId: string;
  companyId: string | null;
  /** Υλοποιήθηκε η αυθεντική λίστα (έλειπε) — πόσες εγγραφές. */
  materializedAddresses: number;
  /** Τα κλειδιά διεύθυνσης ρίζας που σβήνονται. */
  removedRootFields: string[];
}

export interface ContactHqMigrationReport {
  success: true;
  dryRun: boolean;
  scannedContacts: number;
  /** 🔑 Ο μετρητής του contract: έγγραφα παλαιού σχήματος. 0 ⇒ ο κώδικας ανάγνωσης ρίζας φεύγει. */
  affectedContacts: number;
  materializedContacts: number;
  cleanedContacts: number;
  /** Πλήρης λίστα στο preview· στο execute περιορίζεται για να μη φουσκώσει η απόκριση. */
  entries: ContactHqMigrationEntry[];
  batchErrors?: string[];
}

interface PlannedWrite {
  entry: ContactHqMigrationEntry;
  data: Record<string, unknown>;
}

function contactKindOf(data: Readonly<Record<string, unknown>>): Contact['type'] | undefined {
  const type = data.type;
  return type === 'company' || type === 'individual' || type === 'service' ? type : undefined;
}

/** Η λίστα που πρέπει να υλοποιηθεί, ή `undefined` όταν η αυθεντική υπάρχει ήδη. */
function listToMaterialize(data: Readonly<Record<string, unknown>>): CompanyAddress[] | undefined {
  const customFields = data.customFields as Readonly<Record<string, unknown>> | undefined;
  if (authoritativeContactAddresses(customFields)) return undefined;
  const resolved = pruneBlankContactAddresses(resolveContactAddresses(data as unknown as Contact, contactKindOf(data)));
  if (resolved.length === 0) return undefined;
  return resolved.map((address) => (address.id ? address : { ...address, id: generateAddressId() }));
}

/**
 * Το σχέδιο εγγραφής για ένα έγγραφο — ή `null` όταν είναι ήδη στο νέο σχήμα. Καθαρή συνάρτηση
 * (εκτός από τη γέννηση ταυτοτήτων), εκτεθειμένη για τα tests.
 */
export function planContactHqMigration(
  contactId: string,
  data: Readonly<Record<string, unknown>>,
): PlannedWrite | null {
  const materialized = listToMaterialize(data);
  // Ποτέ η μόνη αντιγραφή — και χωρίς δικλείδα: ρίζα με κείμενο ⇒ ο reader την υλοποιεί ΣΤΗΝ ΙΔΙΑ
  // εγγραφή (`materialized`)· ρίζα χωρίς κείμενο ⇒ τα κλειδιά είναι κενά και σβήνουν ακίνδυνα.
  const removedRootFields = presentLegacyRootAddressFields(data);
  if (!materialized && removedRootFields.length === 0) return null;

  const update: Record<string, unknown> = {};
  if (materialized) {
    update['customFields.companyAddresses'] = materialized;
    update.addresses = buildAddressInfoListFromCompanyAddresses(materialized);
  }
  for (const key of removedRootFields) update[key] = FieldValue.delete();

  return {
    entry: {
      contactId,
      companyId: typeof data.companyId === 'string' ? data.companyId : null,
      materializedAddresses: materialized?.length ?? 0,
      removedRootFields,
    },
    data: update,
  };
}

async function flushPlannedWrites(
  db: Firestore,
  planned: readonly PlannedWrite[],
  performer: ResolvedPerformer,
): Promise<string[] | undefined> {
  const updates: BatchUpdate[] = planned.map((write) => ({
    ref: db.collection(COLLECTIONS.CONTACTS).doc(write.entry.contactId),
    data: write.data,
  }));
  const { written, errors } = await flushInBatches(db, updates, { collections: [COLLECTIONS.CONTACTS], performer });
  logger.info('Contact HQ container migrated', { affectedContacts: written, failedBatches: errors.length });
  return errors.length > 0 ? errors : undefined;
}

/**
 * Σαρώνει τις επαφές του οργανισμού και επιστρέφει τι θα άλλαζε (και το αλλάζει αν `dryRun === false`).
 *
 * @param companyId ο οργανισμός από τον `resolveTenantListScopeFromUrl`· `undefined` = όλοι
 *        (νόμιμο μόνο για bypass role, ADR-702). Το Admin SDK παρακάμπτει τους κανόνες ⇒ ρητό scope.
 */
export async function migrateContactHqContainer(
  db: Firestore,
  dryRun: boolean,
  performer: ResolvedPerformer,
  companyId?: string,
): Promise<ContactHqMigrationReport> {
  const baseQuery = companyId
    ? db.collection(COLLECTIONS.CONTACTS).where('companyId', '==', companyId)
    : db.collection(COLLECTIONS.CONTACTS);
  const snapshot = await baseQuery.get();

  const planned = snapshot.docs
    .map((docSnap) => planContactHqMigration(docSnap.id, docSnap.data() as Record<string, unknown>))
    .filter((write): write is PlannedWrite => write !== null);
  const entries = planned.map((write) => write.entry);

  const batchErrors = !dryRun && planned.length > 0 ? await flushPlannedWrites(db, planned, performer) : undefined;

  return {
    success: true,
    dryRun,
    scannedContacts: snapshot.size,
    affectedContacts: entries.length,
    materializedContacts: entries.filter((e) => e.materializedAddresses > 0).length,
    cleanedContacts: entries.filter((e) => e.removedRootFields.length > 0).length,
    entries: dryRun ? entries : entries.slice(0, 50),
    ...(batchErrors ? { batchErrors } : {}),
  };
}
