/**
 * BOQ Document Normalizers — έγγραφο Firestore → αντικείμενο πεδίου ορισμού
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΙΝΑΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (ADR-734 Φάση 3, §8.3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο Νέστωρ διαβάζει τα ίδια έγγραφα από **δύο** SDK: το client Firebase SDK
 * (browser, `boq-repository.ts`) και το Admin SDK (server, ο πράκτορας του
 * ADR-734). Τα *ερωτήματα* γράφονται αναγκαστικά αλλιώς — `query(collection(…))`
 * έναντι `db.collection(…)`. Η *μετάφραση εγγράφου → `BOQItem`* όμως είναι
 * ταυτόσημη, γιατί το σχήμα του εγγράφου είναι ένα.
 *
 * ⚠️ Αν αντιγραφόταν, η απόκλιση θα ήταν **σιωπηλή και επικίνδυνη**: νέο πεδίο
 * στο `BOQItem` θα προστίθετο στο ένα αντίγραφο, και το άλλο θα το γύριζε
 * `?? null` χωρίς κανένα σφάλμα. Δηλαδή η οθόνη και ο πράκτορας θα έδειχναν
 * **διαφορετικό αριθμό για το ίδιο έγγραφο** — ακριβώς η κατηγορία αστοχίας που
 * το VQE (ADR-734 §6.1) υπάρχει για να αποτρέψει.
 *
 * Το αρχείο είναι **καθαρό και ανεξάρτητο SDK**: δέχεται `Record<string, unknown>`
 * (ό,τι επιστρέφουν και τα δύο `doc.data()`) και δεν εισάγει τίποτα από Firebase.
 * Άρα ελέγχεται χωρίς Firestore.
 *
 * @module services/measurements/boq-document-normalize
 * @see ADR-175 (BOQ) · ADR-734 §8.3 (γιατί εξήχθη) · ADR-218 (normalizeToISO)
 */

import { normalizeToISO, nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { BOQCategory, BOQItem, BOQItemStatus } from '@/types/boq';

const logger = createModuleLogger('BoqDocumentNormalize');

/**
 * Firestore `Timestamp` | `Date` | string → ISO string.
 * ADR-218: delegates to the centralized `normalizeToISO`.
 */
const toDateString = (value: unknown): string => normalizeToISO(value) ?? nowISO();

/**
 * Normalize Firestore document → `BOQItem`.
 *
 * Κάθε προαιρετικό πεδίο → `?? null`. Η προεπιλογή κάθε πεδίου είναι μέρος του
 * συμβολαίου ανάγνωσης: αλλάζοντάς την εδώ, αλλάζει **ταυτόχρονα** για UI και
 * πράκτορα — που είναι όλος ο λόγος ύπαρξης αυτού του αρχείου.
 */
export const normalizeBOQItem = (id: string, data: Record<string, unknown>): BOQItem => ({
  id,
  companyId: (data.companyId as string) ?? '',
  projectId: (data.projectId as string) ?? '',
  buildingId: (data.buildingId as string) ?? '',
  scope: (data.scope as BOQItem['scope']) ?? 'building',
  linkedFloorId: (data.linkedFloorId as string) ?? null,
  linkedUnitId: (data.linkedUnitId as string) ?? null,
  linkedUnitIds: (data.linkedUnitIds as string[]) ?? null,
  costAllocationMethod: (data.costAllocationMethod as BOQItem['costAllocationMethod']) ?? 'by_area',
  customAllocations: (data.customAllocations as Record<string, number>) ?? null,
  categoryCode: (data.categoryCode as string) ?? '',
  subCategoryCode: (data.subCategoryCode as string) ?? null,
  title: (data.title as string) ?? '',
  description: (data.description as string) ?? null,
  unit: (data.unit as BOQItem['unit']) ?? 'm2',
  estimatedQuantity: (data.estimatedQuantity as number) ?? 0,
  actualQuantity: (data.actualQuantity as number) ?? null,
  wasteFactor: (data.wasteFactor as number) ?? 0,
  wastePolicy: (data.wastePolicy as BOQItem['wastePolicy']) ?? 'inherited',
  materialUnitCost: (data.materialUnitCost as number) ?? 0,
  laborUnitCost: (data.laborUnitCost as number) ?? 0,
  equipmentUnitCost: (data.equipmentUnitCost as number) ?? 0,
  priceAuthority: (data.priceAuthority as BOQItem['priceAuthority']) ?? 'master',
  linkedPhaseId: (data.linkedPhaseId as string) ?? null,
  linkedTaskId: (data.linkedTaskId as string) ?? null,
  linkedInvoiceId: (data.linkedInvoiceId as string) ?? null,
  linkedContractorId: (data.linkedContractorId as string) ?? null,
  source: (data.source as BOQItem['source']) ?? 'manual',
  measurementMethod: (data.measurementMethod as BOQItem['measurementMethod']) ?? 'manual',
  sourceType: (data.sourceType as BOQItem['sourceType']) ?? undefined,
  sourceEntityId: (data.sourceEntityId as string) ?? null,
  sourceEntityType: (data.sourceEntityType as BOQItem['sourceEntityType']) ?? null,
  detached: (data.detached as boolean) ?? null,
  status: (data.status as BOQItemStatus) ?? 'draft',
  qaStatus: (data.qaStatus as BOQItem['qaStatus']) ?? 'pending',
  notes: (data.notes as string) ?? null,
  createdBy: (data.createdBy as string) ?? null,
  approvedBy: (data.approvedBy as string) ?? null,
  createdAt: toDateString(data.createdAt),
  updatedAt: toDateString(data.updatedAt),
});

/** Ό,τι το `normalizeBOQItem`, αλλά ένα κακοσχηματισμένο έγγραφο δεν ρίχνει τη λίστα. */
export const normalizeBOQItemSafe = (
  id: string,
  data: Record<string, unknown>,
): BOQItem | null => {
  try {
    return normalizeBOQItem(id, data);
  } catch (error) {
    logger.error('Error normalizing BOQ item', { error, itemId: id });
    return null;
  }
};

/** Normalize Firestore document → `BOQCategory`. */
export const normalizeBOQCategory = (id: string, data: Record<string, unknown>): BOQCategory => ({
  id,
  companyId: (data.companyId as string) ?? '',
  code: (data.code as string) ?? '',
  nameEL: (data.nameEL as string) ?? '',
  nameEN: (data.nameEN as string) ?? '',
  description: (data.description as string) ?? null,
  level: (data.level as BOQCategory['level']) ?? 'group',
  parentId: (data.parentId as string) ?? null,
  sortOrder: (data.sortOrder as number) ?? 0,
  defaultWasteFactor: (data.defaultWasteFactor as number) ?? 0,
  allowedUnits: (data.allowedUnits as BOQCategory['allowedUnits']) ?? ['m2'],
  isActive: (data.isActive as boolean) ?? true,
  createdAt: toDateString(data.createdAt),
  updatedAt: toDateString(data.updatedAt),
});
