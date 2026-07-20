/**
 * imported-mesh-panel-rows — ADR-683 **Φ3.1γ**: η σκηνή γίνεται λίστα αναθεώρησης.
 *
 * Ο πυρήνας του πάνελ εισαγόμενων, **χωρίς React**: παίρνει τις οντότητες του ενεργού ορόφου και
 * βγάζει ομάδες ανά εισαγωγή με έτοιμες γραμμές. Ζει εδώ (και όχι μέσα στο component) επειδή η
 * σειρά και το μέτρημα είναι **συμπεριφορά**, όχι παρουσίαση — και η συμπεριφορά ελέγχεται με tests.
 *
 * ## Γιατί ομαδοποιείται ανά εισαγωγή, όχι επίπεδη λίστα
 *
 * Το `uploadId` **είναι** η ταυτότητα «αυτά ήρθαν μαζί» (βλ. `imported-mesh-types`, linked-model
 * μοντέλο). Ένα `.glb` φέρνει δεκάδες κόμβους· επίπεδη λίστα 60 γραμμών από τρία διαφορετικά
 * αρχεία συνεργατών δεν απαντά στην ερώτηση που έχει ο χρήστης («τι μου έστειλε ο Χ;»). Ίδια
 * γραμμή με το Manage Links του Revit: η πηγή είναι πρώτης τάξεως, τα περιεχόμενα από κάτω.
 *
 * ## Γιατί τα ανανάθετα πάνε πρώτα
 *
 * Το πάνελ **είναι** λίστα εκκρεμοτήτων: ένα ανανάθετο πλέγμα δεν παράγει γραμμή BOQ (§10.2), άρα
 * είναι αόρατο στον προϋπολογισμό. Η δουλειά που μένει μπαίνει στην κορυφή· τα τελειωμένα μένουν
 * ορατά από κάτω για επαλήθευση/διόρθωση.
 *
 * @see ./imported-mesh-boq — `hasBoqIdentity` / `countUnassignedImportedMeshes` (ίδιος ορισμός «ανατεθειμένο»)
 * @see ../../../ui/panels/imported-meshes/ImportedMeshesPanel — ο καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import { hasBoqIdentity, type SceneEntityLike } from './imported-mesh-boq';
import {
  IMPORTED_MESH_ENTITY_TYPE,
  type ImportedMeshBoqUnit,
  type ImportedMeshParams,
} from './imported-mesh-types';

// ─── Σχήματα ──────────────────────────────────────────────────────────────────

/**
 * Το ελάχιστο συμβόλαιο σκηνής για τη λίστα: ό,τι ζητά ο μετρητής **συν** το `id`, που εδώ είναι
 * απαραίτητο γιατί το κλικ πρέπει να επιλέξει τη συγκεκριμένη οντότητα.
 */
export interface ImportedMeshListEntityLike extends SceneEntityLike {
  readonly id: string;
}

/** Μία γραμμή λίστας — ένας κόμβος του `.glb`. */
export interface ImportedMeshRow {
  readonly entityId: string;
  readonly nodeName: string;
  readonly assigned: boolean;
  /** Τα πεδία ανάθεσης είναι `null` όσο η ταυτότητα λείπει — ποτέ κενό string «σαν να» υπάρχει. */
  readonly categoryCode: string | null;
  readonly titleEL: string | null;
  readonly unit: ImportedMeshBoqUnit | null;
}

/** Μία εισαγωγή (`.glb`) με τους κόμβους της. */
export interface ImportedMeshUploadGroup {
  readonly uploadId: string;
  readonly sourceFileName: string;
  readonly rows: readonly ImportedMeshRow[];
  readonly unassignedCount: number;
}

// ─── Εσωτερικά ────────────────────────────────────────────────────────────────

/** Τα params **μόνο** αν η οντότητα είναι εισαγόμενο πλέγμα· αλλιώς `null`. */
function readImportedMeshParams(entity: ImportedMeshListEntityLike): ImportedMeshParams | null {
  if (entity.type !== IMPORTED_MESH_ENTITY_TYPE) return null;
  return (entity.params as ImportedMeshParams | undefined) ?? null;
}

function toRow(entityId: string, params: ImportedMeshParams): ImportedMeshRow {
  const identity = params.importedMeshIdentity;
  return {
    entityId,
    nodeName: params.nodeName,
    assigned: hasBoqIdentity(params),
    categoryCode: identity?.categoryCode ?? null,
    titleEL: identity?.titleEL ?? null,
    unit: identity?.unit ?? null,
  };
}

/** Ανανάθετα πρώτα (η εκκρεμότητα στην κορυφή), μετά αλφαβητικά κατά όνομα κόμβου. */
function compareRows(a: ImportedMeshRow, b: ImportedMeshRow): number {
  if (a.assigned !== b.assigned) return a.assigned ? 1 : -1;
  return a.nodeName.localeCompare(b.nodeName, 'el');
}

/** Ομάδες με εκκρεμότητες πρώτα, μετά αλφαβητικά κατά όνομα αρχείου. */
function compareGroups(a: ImportedMeshUploadGroup, b: ImportedMeshUploadGroup): number {
  const aPending = a.unassignedCount > 0;
  const bPending = b.unassignedCount > 0;
  if (aPending !== bPending) return aPending ? -1 : 1;
  return a.sourceFileName.localeCompare(b.sourceFileName, 'el');
}

// ─── Δημόσιο API ──────────────────────────────────────────────────────────────

/**
 * Οι εισαγόμενες οντότητες της σκηνής, ομαδοποιημένες ανά `.glb`. Οντότητες άλλου τύπου —
 * και εισαγόμενα χωρίς params — αγνοούνται σιωπηλά: το πάνελ είναι αναγνώστης, δεν επιβάλλει.
 */
export function groupImportedMeshesByUpload(
  entities: readonly ImportedMeshListEntityLike[],
): readonly ImportedMeshUploadGroup[] {
  const byUpload = new Map<string, { sourceFileName: string; rows: ImportedMeshRow[] }>();

  for (const entity of entities) {
    const params = readImportedMeshParams(entity);
    if (!params) continue;
    const existing = byUpload.get(params.uploadId);
    const group = existing ?? { sourceFileName: params.sourceFileName, rows: [] };
    if (!existing) byUpload.set(params.uploadId, group);
    group.rows.push(toRow(entity.id, params));
  }

  return [...byUpload.entries()]
    .map(([uploadId, group]) => ({
      uploadId,
      sourceFileName: group.sourceFileName,
      rows: [...group.rows].sort(compareRows),
      unassignedCount: group.rows.reduce((n, row) => (row.assigned ? n : n + 1), 0),
    }))
    .sort(compareGroups);
}

/** Το συνολικό πλήθος ανανάθετων στις ομάδες — ο αριθμός του badge. */
export function totalUnassigned(groups: readonly ImportedMeshUploadGroup[]): number {
  return groups.reduce((sum, group) => sum + group.unassignedCount, 0);
}
