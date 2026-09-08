/**
 * @fileoverview 🏆 **Η ΑΡΙΣΤΕΡΗ ΑΚΡΗ**: σκηνή → GLB → δήλωση → ιδιωτικός κάδος του ακινήτου.
 * @related ADR-845 §6.2 · §7.5 (Φ4.2β/Βήμα Γ) · ADR-668 (serialiseGlb) · ADR-683
 * @module subapps/dxf-viewer/io/model-publish/publish-model-to-property
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΙΑ ΣΥΝΑΡΜΟΛΟΓΗΣΗ, ΔΥΟ ΠΡΟΟΡΙΣΜΟΙ — ⛔ **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΔΙΑΔΡΟΜΗ ΣΚΗΝΗΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `.glb` παράγεται από **ακριβώς** τον αγωγό που παράγει και το κατέβασμα:
 * `resolveExportFloors` → `exportFloorsToMesh3d(…, format:'gltf')` → `serialiseGlb`. Ο νέος
 * προορισμός παίρνει το **ίδιο** αποτέλεσμα· αλλάζει μόνο **πού πάει**.
 *
 * 🔑 Μια δεύτερη συναρμολόγηση «για τη δημοσίευση» θα ήταν δύο σκηνές για την ίδια μελέτη —
 * και ο άνθρωπος θα δημοσίευε κάτι **άλλο** από αυτό που κατέβασε, χωρίς κανένα σημάδι.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΔΗΛΩΣΗ ΜΕΤΡΙΕΤΑΙ ΜΕ ΤΟΝ **ΙΔΙΟ** ΜΕΤΡΗΤΗ ΠΟΥ ΘΑ ΤΗΝ ΕΛΕΓΞΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ⛔ **ΜΗΝ μετρήσεις τη σκηνή `THREE`.** Το `measureModelBytes` είναι το **ίδιο**
 * `measureModelLedger` που τρέχει ο ψήστης — δες την κεφαλίδα του `gltf-model-measure` για τα
 * **τρία** μεγέθη που θα απέκλιναν δομικά αν ο πελάτης μετρούσε τη σκηνή *(αποδιπλασιασμός
 * πλεγμάτων του `GLTFExporter` · υποδοχές υφής · `truncateDrawRange`)*. Η κλειστή λογιστική
 * του §6.2.1 ρωτά *«είναι **αυτό** που στάλθηκε;»* — και εδώ η απάντηση δεν μπορεί να είναι
 * ψευδώς αρνητική.
 *
 * ⚠️ **ΤΟ `at` ΚΑΙ ΤΟ `sourceRef` ΔΕΝ ΖΟΥΝ ΕΔΩ**: τα γράφει ο γραφέας του `models[]` από το
 * `timeCreated` του **ιδιωτικού αντικειμένου** *(ποτέ ρολόι πελάτη)*. Αυτό το module στέλνει
 * bytes και δήλωση — τίποτα άλλο.
 */

import { API_ROUTES } from '@/config/domain-constants';
import {
  encodeModelDeclaration,
} from '@/lib/listings/model-declaration-metadata';
import type {
  ModelPublicationDeclaration,
  ModelSignatory,
  ModelStateMark,
} from '@/lib/listings/listing-model-declaration';
import { measureModelBytes } from '@/services/listings/gltf-model-measure';

import { resolveExportFloors } from '../../export/core/export-floor-scope';
import { exportFloorsToMesh3d } from '../../export/formats/mesh3d-export-adapter';
import type { ExportDeps, ExportFloorScope } from '../../export/types';

/**
 * Το εύρος που **έχει νόημα για μία αγγελία**.
 *
 * ⚠️ **Χωρίς `all-zip`, και είναι απόφαση**: εκείνο παράγει **ένα αρχείο ανά όροφο**, δηλαδή
 * *πολλά* μοντέλα — ενώ η αγγελία δέχεται **ένα**. Ένας σιωπηλός «πρώτος όροφος» θα ήταν
 * επιλογή που κανείς άνθρωπος δεν έκανε.
 */
export type ModelPublishScope = Extract<ExportFloorScope, 'active' | 'all-single'>;

/** Ό,τι ζητά το χειριστήριο από τον άνθρωπο, πριν φύγει ένα byte. */
export interface ModelPublishRequest {
  readonly propertyId: string;
  readonly scope: ModelPublishScope;
  readonly state: ModelStateMark;
  readonly signatory: ModelSignatory;
}

/**
 * **Γιατί δεν έφυγε** — ονομαστικά, ποτέ «κάτι πήγε στραβά» *(ADR-844 §1)*.
 *
 * 🔑 Κάθε τιμή αντιστοιχεί σε **διαφορετική ανθρώπινη πράξη**: άλλο «δεν υπάρχει γεωμετρία»
 * *(διάλεξε άλλον όροφο)*, άλλο «ο διακομιστής αρνήθηκε» *(δες το μήνυμά του)*.
 */
export type ModelPublishRefusal =
  | 'no-geometry'
  | 'unreadable-model'
  | 'declaration-too-large'
  | 'rejected'
  | 'network';

export type ModelPublishOutcome =
  | { readonly ok: true; readonly fileId: string }
  | { readonly ok: false; readonly refusal: ModelPublishRefusal; readonly detail?: string };

/** Η επέκταση που ξεχωρίζει το μοντέλο από το sidecar manifest της ίδιας εξαγωγής. */
const GLB_SUFFIX = '.glb';

/**
 * **Συναρμολόγησε, μέτρησε, στείλε.**
 *
 * ⚠️ Δεν πετά ποτέ για λόγο που ο άνθρωπος μπορεί να διορθώσει — επιστρέφει **ονομασμένη**
 * άρνηση. Πετά μόνο για σφάλμα προγραμματισμού *(π.χ. ζητήθηκε όροφος χωρίς φορτωμένη σκηνή —
 * το `resolveExportFloors` το λέει ήδη με το δικό του μήνυμα)*.
 */
export async function publishModelToProperty(
  request: ModelPublishRequest,
  deps: ExportDeps,
): Promise<ModelPublishOutcome> {
  const bytes = await buildModelBytes(request.scope, deps);
  if (bytes === null) return { ok: false, refusal: 'no-geometry' };

  const declaration = await declareModel(bytes, request);
  if (declaration === null) return { ok: false, refusal: 'unreadable-model' };

  let encoded: string;
  try {
    encoded = encodeModelDeclaration(declaration);
  } catch {
    return { ok: false, refusal: 'declaration-too-large' };
  }

  return sendModel(request.propertyId, bytes, encoded);
}

/**
 * Τα bytes του `.glb`, ή `null` όταν **δεν υπάρχει γεωμετρία** στο επιλεγμένο εύρος.
 *
 * 🔑 Το `exportFloorsToMesh3d` επιστρέφει **κενά** artifacts όταν το `meshCount` είναι μηδέν —
 * δηλαδή το «τίποτα» είναι **δηλωμένη** απάντηση, όχι σφάλμα. Διαβάζεται εδώ ως τέτοιο.
 */
async function buildModelBytes(
  scope: ModelPublishScope,
  deps: ExportDeps,
): Promise<Uint8Array | null> {
  const floors = resolveExportFloors(deps.levelScenes, deps.activeLevelId, scope);
  const stacked = scope === 'all-single';

  const out = await exportFloorsToMesh3d(floors, deps, {
    format: 'gltf',
    baseName: deps.projectName,
    // ⚠️ Το glTF είναι **spec-locked σε μέτρα** — η μονάδα αφορά μόνο OBJ/COLLADA. Δηλώνεται
    //    ρητά ώστε να μη διαβαστεί ως παράλειψη.
    unit: 'meters',
    filenamePart: stacked ? 'all-floors' : '',
    prefixMeshesWithFloor: stacked,
  });

  const glb = out.artifacts.find((artifact) => artifact.filename.endsWith(GLB_SUFFIX));
  if (glb === undefined) return null;

  return new Uint8Array(await glb.blob.arrayBuffer());
}

/**
 * **Η δήλωση του πελάτη** — σήμανση + υπογράφων *(ανθρώπινοι)* και λογιστική *(μετρημένη)*.
 *
 * `null` όταν τα ίδια μας τα bytes δεν διαβάζονται: αντί για ανώνυμη κατάρρευση, ο άνθρωπος
 * μαθαίνει ότι **η εξαγωγή** είναι το πρόβλημα — όχι το ακίνητο, όχι το δίκτυο.
 */
async function declareModel(
  bytes: Uint8Array,
  request: ModelPublishRequest,
): Promise<ModelPublicationDeclaration | null> {
  try {
    return {
      state: request.state,
      signatory: request.signatory,
      geometry: await measureModelBytes(bytes),
    };
  } catch {
    return null;
  }
}

/** Το ανέβασμα — **multipart**, γιατί τα bytes και η δήλωση φεύγουν μαζί. */
async function sendModel(
  propertyId: string,
  bytes: Uint8Array,
  declaration: string,
): Promise<ModelPublishOutcome> {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: 'model/gltf-binary' }), `${propertyId}.glb`);
  body.append('declaration', declaration);

  let response: Response;
  try {
    response = await fetch(API_ROUTES.PROPERTIES.MODEL(propertyId), { method: 'POST', body });
  } catch {
    return { ok: false, refusal: 'network' };
  }

  if (!response.ok) {
    // ⚠️ Ο κωδικός του διακομιστή ταξιδεύει **αυτούσιος** ως `detail`: το χειριστήριο τον
    //    μεταφράζει σε ανθρώπινο μήνυμα. Μια μετάφραση **εδώ** θα ήταν δεύτερο λεξιλόγιο.
    return { ok: false, refusal: 'rejected', detail: await response.text().catch(() => undefined) };
  }

  const payload: unknown = await response.json().catch(() => null);
  const fileId = readFileId(payload);
  return fileId === null
    ? { ok: false, refusal: 'rejected' }
    : { ok: true, fileId };
}

/** Ο διακομιστής υπόσχεται σχήμα· ο πελάτης το **ελέγχει**, δεν το ισχυρίζεται *(N.2)*. */
function readFileId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;

  const fileId = (data as { fileId?: unknown }).fileId;
  return typeof fileId === 'string' && fileId.length > 0 ? fileId : null;
}
