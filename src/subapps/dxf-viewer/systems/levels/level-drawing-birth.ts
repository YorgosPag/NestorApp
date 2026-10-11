/**
 * level-drawing-birth — ο στόχος αποθήκευσης ενός επιπέδου ΧΩΡΙΣ αρχείο κάτοψης (ADR-913).
 *
 * ## Το πρόβλημα
 *
 * Ένα επίπεδο χωρίς `sceneFileId` δεν είχε πού να γράψει: ο loader μηδένιζε τον στόχο του
 * auto-save (ADR-399) και ό,τι σχεδιαζόταν πάνω του χανόταν στην επαναφόρτωση — 2Δ παντού,
 * και BIM όπου το επίπεδο δεν είχε όροφο (το `floorplanId` fallback του ADR-420 ήταν `null`).
 *
 * ## Η αρχή: ταυτότητα στη γέννηση, bytes στο πρώτο περιεχόμενο
 *
 * Το αναγνωριστικό του αρχείου **παράγεται ντετερμινιστικά από το ίδιο το επίπεδο**
 * (`generateDeterministicFileId`). Άρα:
 *
 *  - **δεν αποθηκεύεται πουθενά** ⇒ καμία migration, κανένα νέο πεδίο, κανένα endpoint·
 *  - **δύο συνεδρίες** στο ίδιο κενό επίπεδο καταλήγουν στο ΙΔΙΟ αρχείο — με τυχαίο id ανά
 *    συνεδρία θα γεννιόνταν δύο και το ένα θα ορφάνευε·
 *  - **κανένα άδειο αρχείο**: το FileRecord και το blob γεννιούνται στην πρώτη αποθήκευση με
 *    περιεχόμενο (ο φρουρός «ποτέ κενή σκηνή» μένει). Ένας όροφος που απλώς άνοιξε δεν
 *    αποκτά άδεια «κάτοψη» στη διαχείριση κτηρίου.
 *
 * Ο στόχος ανήκει στην **πιο συγκεκριμένη δέσμευση** του επιπέδου: ακίνητο → όροφος → κτήριο → έργο →
 * χώρος εργασίας (εταιρεία). Το path περιέχει ΜΟΝΟ αμετάβλητες ταυτότητες (ADR-709).
 *
 * Pure: καμία πρόσβαση σε React/Firebase — δοκιμάζεται αυτόνομο, όπως το `cross-floor-link.ts`.
 *
 * @module subapps/dxf-viewer/systems/levels/level-drawing-birth
 * @see docs/centralized-systems/reference/adrs/ADR-913-level-drawing-birth.md
 */

import {
  ENTITY_TYPES,
  FILE_CATEGORIES,
  FILE_DOMAINS,
  FLOORPLAN_PURPOSES,
  type CadLinkableEntityType,
} from '@/config/domain-constants';
import { generateDeterministicFileId } from '@/services/enterprise-id.service';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import type { DxfSaveContext } from '../../services/dxf-firestore.types';
import { deriveScenePath } from '../../services/dxf-scene-path';
import type { Level } from './config';

/** Ό,τι χρειάζεται ο resolver από ένα `Level` (ISP — δεν δένεται σε όλο τον τύπο). */
export type DrawingBearingLevel = Pick<
  Level,
  'id' | 'name' | 'floorId' | 'buildingId' | 'projectId' | 'propertyId' | 'floorplanType' | 'entityLabel'
>;

/** Ο πλήρης στόχος γέννησης: ό,τι χρειάζεται το auto-save για να γράψει, και τίποτα ambient. */
export interface LevelDrawingBirthTarget {
  readonly fileId: string;
  readonly fileName: string;
  readonly saveContext: DxfSaveContext;
}

/** Σε τι είναι δεμένο το επίπεδο — καθορίζει κάτοχο, κατηγορία και σκοπό του αρχείου. */
interface DrawingBinding {
  /** `undefined` = αδέσμευτο πρόχειρο: ανήκει στον χώρο εργασίας, χωρίς entity link. */
  readonly entityType?: CadLinkableEntityType;
  readonly entityId: string;
  readonly purpose?: string;
}

/**
 * Η πιο συγκεκριμένη δέσμευση του επιπέδου, ή `null` όταν δεν μπορεί να κριθεί.
 *
 * Επίπεδο ΑΚΙΝΗΤΟΥ (`floorplanType: 'unit'`): κάτοχος είναι το **ακίνητο** (`propertyId`,
 * ADR-914) — ποτέ ο όροφος, που θα το έκανε «κάτοψη ΟΡΟΦΟΥ» (λάθος κάτοχος, λάθος σκοπός).
 *
 * ⚠️ Επίπεδο ακινήτου **χωρίς** `propertyId` ⇒ `null`, όπως πριν: είναι τα επίπεδα που
 * γεννήθηκαν πριν το πεδίο υπάρξει. Δεν μαντεύουμε κάτοχο — μένουν χωρίς στόχο.
 */
function resolveDrawingBinding(level: DrawingBearingLevel, companyId: string): DrawingBinding | null {
  if (level.floorplanType === 'unit') {
    return level.propertyId
      ? { entityType: ENTITY_TYPES.PROPERTY, entityId: level.propertyId, purpose: FLOORPLAN_PURPOSES.PROPERTY }
      : null;
  }
  if (level.floorId) {
    return { entityType: ENTITY_TYPES.FLOOR, entityId: level.floorId, purpose: FLOORPLAN_PURPOSES.FLOOR };
  }
  if (level.buildingId) {
    return { entityType: ENTITY_TYPES.BUILDING, entityId: level.buildingId, purpose: FLOORPLAN_PURPOSES.BUILDING };
  }
  if (level.projectId) {
    return { entityType: ENTITY_TYPES.PROJECT, entityId: level.projectId, purpose: FLOORPLAN_PURPOSES.PROJECT };
  }
  return { entityId: companyId };
}

/** Όνομα αρχείου από το όνομα του επιπέδου — ό,τι βλέπει ο χρήστης στο πάνελ και στο widget. */
function birthFileName(level: DrawingBearingLevel): string {
  const base = level.name.trim().slice(0, 200) || level.id;
  return `${base}.dxf`;
}

/** Σταθερό id ανά επίπεδο: ίδιο επίπεδο ⇒ ίδιο αρχείο, σε κάθε συνεδρία και συσκευή. */
export function levelDrawingFileId(levelId: string): string {
  return generateDeterministicFileId(`level-drawing:${levelId}`);
}

/**
 * Ο στόχος γέννησης ενός επιπέδου χωρίς αρχείο, ή `null` όταν δεν ορίζεται κάτοχος
 * (χωρίς `companyId`, ή επίπεδο ακινήτου που δεν ξέρει το ακίνητό του — βλ. {@link resolveDrawingBinding}).
 *
 * Ίδια είσοδος ⇒ ίδια έξοδος: δεν διαβάζει «τρέχον» τίποτα (ADR-714).
 */
export function resolveLevelDrawingBirthTarget(
  level: DrawingBearingLevel,
  companyId: string | null | undefined,
): LevelDrawingBirthTarget | null {
  if (!companyId) return null;
  const binding = resolveDrawingBinding(level, companyId);
  if (!binding) return null;

  const fileId = levelDrawingFileId(level.id);
  const filesCategory = binding.entityType ? FILE_CATEGORIES.FLOORPLANS : FILE_CATEGORIES.DRAWINGS;
  const { path } = buildStoragePath({
    companyId,
    entityType: binding.entityType ?? ENTITY_TYPES.COMPANY,
    entityId: binding.entityId,
    domain: FILE_DOMAINS.CONSTRUCTION,
    category: filesCategory,
    fileId,
    ext: 'dxf',
  });

  return {
    fileId,
    fileName: birthFileName(level),
    saveContext: {
      companyId,
      ...(level.projectId ? { projectId: level.projectId } : {}),
      ...(level.buildingId ? { buildingId: level.buildingId } : {}),
      ...(level.floorId ? { floorId: level.floorId } : {}),
      // ADR-914 §2.12 — κάτοψη ΑΚΙΝΗΤΟΥ: ο κάτοχος ταξιδεύει ρητά (αλλιώς ο διακομιστής έγραφε
      // τον όροφο ως κάτοχο), μαζί με τον όροφο που απεικονίζει (ADR-236, καρτέλα κατόψεων).
      ...(binding.entityType === ENTITY_TYPES.PROPERTY
        ? { propertyId: binding.entityId, ...(level.floorId ? { levelFloorId: level.floorId } : {}) }
        : {}),
      ...(binding.entityType ? { entityType: binding.entityType } : {}),
      ...(binding.purpose ? { purpose: binding.purpose } : {}),
      filesCategory,
      entityLabel: level.entityLabel || level.name,
      canonicalScenePath: deriveScenePath(path),
      fileRecordId: fileId,
    },
  };
}
