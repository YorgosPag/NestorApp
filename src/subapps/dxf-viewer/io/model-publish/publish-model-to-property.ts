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
  ModelPublicationScope,
  ModelSignatory,
  ModelStateMark,
} from '@/lib/listings/listing-model-declaration';
import { measureModelBytes } from '@/services/listings/gltf-model-measure';
import { RealtimeService } from '@/services/realtime';

import {
  resolveExportFloors,
  type ResolvedExportFloor,
} from '../../export/core/export-floor-scope';
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

/**
 * 🏆 **Η ΜΕΤΑΦΡΑΣΗ ΣΤΟ ΣΥΝΟΡΟ** — από *«πώς συσκευάζεται»* σε *«τι καλύπτει»* (ADR-845 Ο-27).
 *
 * 🔴 **ΔΥΟ ΛΕΞΙΛΟΓΙΑ ΓΙΑ ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΕΠΙΧΕΙΡΗΜΑ ΜΕ ΤΗΝ Α11.** Το ADR
 * ξεχωρίζει ήδη ρητά την **προέλευση** από τη **σήμανση**: *«δένοντάς τες, το ίδιο ακριβώς
 * αρχείο θα άλλαζε βαθμίδα αξιοπιστίας επειδή κάποιος άλλαξε ετικέτα κατάστασης»*. Εδώ
 * συμβαίνει το ίδιο: το `all-single` απαντά *«ένα αρχείο ή zip;»* — και το `all-zip` καλύπτει
 * **ακριβώς το ίδιο** με άλλη συσκευασία. Ταυτότητα χτισμένη πάνω στη συσκευασία θα έλεγε ότι
 * δύο μοντέλα του **ίδιου** κτιρίου είναι διαφορετικά πράγματα, επειδή διέφερε το **κουτί**.
 *
 * 🔑 **Εδώ και ΜΟΝΟ εδώ**: αυτό το αρχείο είναι η **μόνη** θέση που ξέρει και τα δύο
 * λεξιλόγια — το `lib/listings/` δεν επιτρέπεται να δει τον εξαγωγέα *(είναι εκτός του root
 * `tsconfig`: μια τέτοια εισαγωγή θα ήταν αόρατη σε κάθε πύλη πλην του CI — CHECK 3.29)*.
 *
 * ⚠️ **`Record` και όχι `switch`**: ο τύπος **δεν μεταγλωττίζεται** αν το `ModelPublishScope`
 * αποκτήσει τρίτη τιμή χωρίς απάντηση εδώ. Ένας `switch` με `default` θα σιωπούσε.
 */
const PUBLICATION_SCOPE_OF: Record<ModelPublishScope, ModelPublicationScope> = {
  active: 'active-floor',
  'all-single': 'all-floors',
};

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
  // 🔑 **ΤΑ ΙΔΙΑ ΕΠΙΠΕΔΑ, ΜΙΑ ΦΟΡΑ** *(ADR-845 Ο-25)*: ο κατάλογος των σχεδίων που θα
  //    καταγραφούν πρέπει να είναι **ακριβώς** αυτός που παρήγαγε τα bytes. Δεύτερη κλήση του
  //    `resolveExportFloors` θα ήταν δεύτερη απάντηση στο *«ποιοι όροφοι;»* — και θα μπορούσε
  //    να δει **άλλη** σκηνή αν κάτι φορτώθηκε ανάμεσα στις δύο.
  const floors = resolveExportFloors(deps.levelScenes, deps.activeLevelId, request.scope);

  const bytes = await buildModelBytes(floors, request.scope, deps);
  if (bytes === null) return { ok: false, refusal: 'no-geometry' };

  const declaration = await declareModel(bytes, request);
  if (declaration === null) return { ok: false, refusal: 'unreadable-model' };

  let encoded: string;
  try {
    encoded = encodeModelDeclaration(declaration);
  } catch {
    return { ok: false, refusal: 'declaration-too-large' };
  }

  return sendModel(request.propertyId, bytes, encoded, sceneFileIdsOf(floors));
}

/**
 * Τα bytes του `.glb`, ή `null` όταν **δεν υπάρχει γεωμετρία** στο επιλεγμένο εύρος.
 *
 * 🔑 Το `exportFloorsToMesh3d` επιστρέφει **κενά** artifacts όταν το `meshCount` είναι μηδέν —
 * δηλαδή το «τίποτα» είναι **δηλωμένη** απάντηση, όχι σφάλμα. Διαβάζεται εδώ ως τέτοιο.
 */
async function buildModelBytes(
  floors: readonly ResolvedExportFloor[],
  scope: ModelPublishScope,
  deps: ExportDeps,
): Promise<Uint8Array | null> {
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
 * 🏆 **ΠΟΙΑ ΣΧΕΔΙΑ ΠΑΡΗΓΑΓΑΝ ΑΥΤΟ ΤΟ ΜΟΝΤΕΛΟ** — ταυτοποιητικά, **ποτέ εκδόσεις** (Ο-25).
 *
 * 🔴 **Ο ΠΕΛΑΤΗΣ ΛΕΕΙ *ΠΟΙΑ*, Ο ΔΙΑΚΟΜΙΣΤΗΣ ΓΡΑΦΕΙ *ΣΕ ΠΟΙΟ REVISION*.** Είναι η **ίδια** ραφή
 * με το `at` του δημόσιου σχήματος *(`timeCreated` του αντικειμένου, ποτέ ρολόι πελάτη)*: ένα
 * revision που θα ερχόταν από εδώ θα ήταν **ισχυρισμός του καλούντος**, και θα μπορούσε να
 * είναι μπαγιάτικο **τη στιγμή που γράφεται** — ο πελάτης κρατά ένα στιγμιότυπο της σκηνής,
 * όχι το ζωντανό έγγραφο.
 *
 * ⚠️ **Επίπεδο χωρίς `sceneFileId` απλώς παραλείπεται.** Συμβαίνει: ένα επίπεδο που δεν έχει
 * ακόμη αποθηκευτεί δεν έχει αρχείο σκηνής. Το μοντέλο **δημοσιεύεται** — η καταγραφή είναι
 * **μερική**, και μια μερική καταγραφή πιάνει λιγότερα, ποτέ λάθος: το `modelFreshness` ρωτά
 * *«άλλαξε κάποιο από **αυτά**;»*, όχι *«είναι αυτά όλα;»*.
 *
 * 🔑 **Σύνολο, όχι πίνακας**: δύο επίπεδα **μπορούν** να δείχνουν στο ίδιο αρχείο *(το «sticky
 * fileId» του ADR-399, καταγγελμένο στο `cross-floor-link`)* — και τότε ένα διπλότυπο θα
 * πλήρωνε την ίδια ανάγνωση δύο φορές στον διακομιστή.
 */
function sceneFileIdsOf(floors: readonly ResolvedExportFloor[]): readonly string[] {
  const ids = new Set<string>();

  for (const floor of floors) {
    const fileId = floor.level.sceneFileId;
    if (typeof fileId === 'string' && fileId !== '') ids.add(fileId);
  }

  return [...ids];
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
      // 🔴 **ΤΟ ΕΥΡΟΣ ΤΑΞΙΔΕΥΕΙ ΤΩΡΑ** *(Ο-27)*: ως τις 2026-09-09 **επέλεγε ποια bytes
      //    παράγονται** και μετά **εξατμιζόταν** — μετρημένο, δεν γραφόταν πουθενά. Δηλαδή το
      //    ένα τρίτο της ταυτότητας του μοντέλου δεν υπήρχε, και δύο δημοσιεύσεις **άλλου**
      //    εύρους ήταν αδιάκριτες. Μεταφράζεται εδώ, στο σύνορο των δύο λεξιλογίων.
      scope: PUBLICATION_SCOPE_OF[request.scope],
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
  sceneFileIds: readonly string[],
): Promise<ModelPublishOutcome> {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: 'model/gltf-binary' }), `${propertyId}.glb`);
  body.append('declaration', declaration);
  // 🔑 **ΞΕΧΩΡΙΣΤΟ ΠΕΔΙΟ, ΟΧΙ ΜΕΣΑ ΣΤΗ ΔΗΛΩΣΗ** *(Ο-25)*. Η δήλωση **ψήνεται στο artifact**
  //    και ταξιδεύει με το αρχείο· τα `file_…` είναι **ιδιωτικά αναγνωριστικά** που το
  //    `LISTING_MODEL_SOURCE_REF` απορρίπτει ονομαστικά για δημόσιο υλικό. Μπαίνουν στο ίδιο
  //    multipart — καμία δεύτερη κλήση, καμία δεύτερη εγγραφή.
  body.append('sceneFileIds', JSON.stringify(sceneFileIds));

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
  if (fileId === null) return { ok: false, refusal: 'rejected' };

  announceArchived(readArchived(payload), fileId);

  return { ok: true, fileId };
}

/**
 * 🌐 **Η ΙΣΤΟΡΙΑ ΕΓΡΑΦΤΗΚΕ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ — ΕΔΩ ΜΟΝΟ ΑΝΑΚΟΙΝΩΝΕΤΑΙ** (ADR-845 Ο-27 · ADR-862 Φ0 Β10).
 *
 * 🔴 **ΑΛΛΑΞΕ ΣΤΟ Β10.** Μέχρι τότε η αρχειοθέτηση των προκατόχων γινόταν **εδώ**, με client SDK
 * (`supersedeFileRecord` → `moveToTrash`), γιατί η μία πόρτα ήταν client και η δημοσίευση
 * `'server-only'`. Ο κανόνας `cdeCustodyUnchanged()` (Β4) άρχισε σωστά να απορρίπτει την εγγραφή
 * `cdeState` από τον browser, και το `allSettled` **έκρυψε** την άρνηση. Πλέον η πόρτα **είναι** ο
 * server γραφέας και την καλεί η ίδια η διαδρομή δημοσίευσης, με τη **δική της** ταυτότητα.
 *
 * 🔑 Ο πελάτης εκπέμπει `FILE_SUPERSEDED` **μόνο** για ό,τι ο διακομιστής **πράγματι** αρχειοθέτησε
 * (`archived`), ποτέ για ό,τι απλώς ταυτοποίησε (`supersedes`): ένα γεγονός για πράξη που δεν
 * έγινε θα έκρυβε από τη λίστα αρχείο που **είναι ακόμη ενεργό**.
 */
function announceArchived(archived: readonly string[], fileId: string): void {
  for (const previousFileId of archived) {
    RealtimeService.dispatch('FILE_SUPERSEDED', {
      fileId: previousFileId,
      supersededByFileId: fileId,
      timestamp: Date.now(),
    });
  }
}

/** Ο διακομιστής υπόσχεται σχήμα· ο πελάτης το **ελέγχει**, δεν το ισχυρίζεται *(N.2)*. */
function readFileId(payload: unknown): string | null {
  const fileId = readResponseField(payload, 'fileId');
  return typeof fileId === 'string' && fileId.length > 0 ? fileId : null;
}

/**
 * **Ποιοι αρχειοθετήθηκαν** — και `[]` για **κάθε** άλλη απάντηση.
 *
 * ⚠️ **Fail-closed προς την ανακοίνωση**: ένα σχήμα που δεν αναγνωρίζεται σημαίνει *«μην ανακοινώσεις
 * τίποτα»* — η χειρότερη εκδοχή του λάθους θα ήταν να κρυφτεί από τη λίστα αρχείο που **δεν**
 * αρχειοθετήθηκε.
 */
function readArchived(payload: unknown): readonly string[] {
  const raw = readResponseField(payload, 'archived');
  if (!Array.isArray(raw)) return [];

  const ids: readonly unknown[] = raw;
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Το `data.<πεδίο>` της τυποποιημένης απάντησης — **μία** ανάγνωση του φακέλου.
 *
 * 🔑 Εξήχθη μόλις εμφανίστηκε **δεύτερο** πεδίο: δύο σώματα που ξεδιπλώνουν το ίδιο
 * `{ data: … }` είναι sibling clone — ακριβώς αυτό που πιάνει το CHECK 3.28 και **δεν** θα
 * έβλεπε ποτέ το `ssot:discover` *(διαφορετικά ονόματα, N.18)*.
 */
function readResponseField(payload: unknown, field: string): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;

  return (data as Record<string, unknown>)[field];
}
