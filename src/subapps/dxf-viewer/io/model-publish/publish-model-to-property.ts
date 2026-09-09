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
import { FileRecordService } from '@/services/file-record.service';

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
  /**
   * **Ποιος έκανε την αντικατάσταση** — για την **ιστορία**, ποτέ για την εξουσιοδότηση
   * (ADR-845 Ο-27).
   *
   * 🔴 **ΔΕΝ ΕΙΝΑΙ ΙΣΧΥΡΙΣΜΟΣ ΤΑΥΤΟΤΗΤΑΣ, ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΑΣΦΑΛΕΙΑ.** Την **άδεια** να
   * ανέβει το μοντέλο την κρίνει ο διακομιστής από το **δικό του** auth context
   * *(`ctx.uid`, `requirePropertyInTenantScope`)* — αυτό εδώ **δεν ταξιδεύει** στο POST.
   * Χρησιμοποιείται **μόνο** στην πράξη απόσυρσης του πελάτη, που τρέχει με client SDK και
   * υπόκειται στους Firestore rules του **ίδιου** ανθρώπου: ένα ψεύτικο uid εδώ θα έγραφε
   * λάθος **όνομα σε ημερολόγιο**, ποτέ δεν θα άνοιγε πόρτα.
   *
   * ⚠️ Ίδιο ακριβώς ιδίωμα με το `config.userId` του `StepUpload.performUpload` — η αδελφή
   * διαδρομή που κάνει την **ίδια** πράξη για τις κατόψεις *(Ο-16)*.
   */
  readonly actorUid: string;
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

  return sendModel(request.propertyId, bytes, encoded, request.actorUid);
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
  actorUid: string,
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
  if (fileId === null) return { ok: false, refusal: 'rejected' };

  await recordSuccession(readSupersedes(payload), fileId, actorUid);

  return { ok: true, fileId };
}

/**
 * 🌐 **Η ΙΣΤΟΡΙΑ, ΟΧΙ Η ΑΛΗΘΕΙΑ** — ISO 19650 §10.2 (ADR-845 Ο-27).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΔΩ, ΣΤΟΝ ΠΕΛΑΤΗ, ΕΝΩ Η ΔΗΜΟΣΙΕΥΣΗ ΕΙΝΑΙ `'server-only'`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **μία** πόρτα της απόσυρσης *(`supersedeFileRecord` → `moveToTrash`)* εισάγει
 * `@/lib/firebase` — **client SDK**. Η πόρτα του ανεβάσματος είναι `'server-only'`.
 * **Δεν συναντιούνται**, και ένα admin δίδυμο απορρίφθηκε ρητά: δεύτερη μηχανή για την ίδια
 * ερώτηση *(N.18 · ADR-749)* — το απαγορεύει η ίδια της η κεφαλίδα.
 *
 * ⇒ **Ο διακομιστής κρίνει, ο πελάτης πράττει.** Ο κατάλογος έρχεται από την απάντηση: το
 * *«ποιοι δημοσιεύουν το ίδιο πράγμα;»* το απαντά **ένα** σώμα *(`supersededByPublication`)*,
 * το ίδιο που ζει δίπλα στην επιμέλεια της αγγελίας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ Η ΑΠΟΤΥΧΙΑ ΕΔΩ **ΔΕΝ** ΑΚΥΡΩΝΕΙ ΤΗ ΔΗΜΟΣΙΕΥΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αγγελία είναι **ήδη σωστή** χωρίς αυτή τη γραμμή: το `currentPerIdentity` κρατά
 * **παράγωγα** το νεότερο ανά ταυτότητα, σε **κάθε** πέρασμα. Ο κόσμος δεν βλέπει διπλότυπο
 * ούτε αν ο περιηγητής κλείσει σε αυτό ακριβώς το σημείο.
 *
 * Αυτό που χάνεται σε αποτυχία είναι η **ιστορία**: το παλιό μένει `active` στον διαχειριστή
 * αρχείων, δηλαδή ο κάτοχος βλέπει δύο και ο κόσμος ένα. Ενοχλητικό, **όχι λάθος** — και
 * επισκευάσιμο με την επόμενη δημοσίευση, που θα το ξαναβρεί.
 *
 * 🔑 **Γι' αυτό ακριβώς επιτρέπεται να ζει σε δεύτερο βήμα.** Η γραμμένη ένσταση της διεξόδου
 * Α *(«παράθυρο κούρσας»)* **εξέπνευσε** τη στιγμή που η ορθότητα έγινε παράγωγη: το παράθυρο
 * υπάρχει ακόμη, αλλά **δεν χωρά τίποτα μέσα του**.
 *
 * ⚠️ **`allSettled`, ποτέ `all`**: μια αποτυχία στον έναν προκάτοχο δεν επιτρέπεται να κρύψει
 * την επιτυχία στον άλλο. *(Στην πράξη είναι σχεδόν πάντα **ένας** — αλλά «σχεδόν πάντα» δεν
 * είναι εγγύηση, και ο πληθυντικός δεν κοστίζει.)*
 */
async function recordSuccession(
  supersedes: readonly string[],
  fileId: string,
  actorUid: string,
): Promise<void> {
  if (supersedes.length === 0) return;

  await Promise.allSettled(
    supersedes.map((previousFileId) =>
      FileRecordService.supersedeFileRecord(previousFileId, fileId, actorUid),
    ),
  );
}

/** Ο διακομιστής υπόσχεται σχήμα· ο πελάτης το **ελέγχει**, δεν το ισχυρίζεται *(N.2)*. */
function readFileId(payload: unknown): string | null {
  const fileId = readResponseField(payload, 'fileId');
  return typeof fileId === 'string' && fileId.length > 0 ? fileId : null;
}

/**
 * **Ποιους διαδέχεται** — και `[]` για **κάθε** άλλη απάντηση.
 *
 * ⚠️ **Fail-closed προς την πράξη**: ένα σχήμα που δεν αναγνωρίζεται σημαίνει *«μην αποσύρεις
 * τίποτα»*, ποτέ *«απόσυρε ό,τι βρεις»*. Η χειρότερη εκδοχή του λάθους εδώ είναι να ρίξει
 * στον κάδο μοντέλο που **κανείς δεν αντικατέστησε**.
 */
function readSupersedes(payload: unknown): readonly string[] {
  const raw = readResponseField(payload, 'supersedes');
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
