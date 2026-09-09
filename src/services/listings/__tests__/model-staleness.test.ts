/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **Η ΑΓΚΥΡΑ ΤΗΣ ΠΑΛΑΙΟΤΗΤΑΣ (Ο-25)** — *«αυτό που βλέπει ο κόσμος ισχύει ακόμα;»*
 * @related ADR-845 §7.13 (Ο-25) · §8 (Α-16) · lib/listings/model-source-revisions
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο Giorgio κοίταξε τη **δική του** αγγελία, είδε παλιό μοντέλο, και **χρειάστηκε να ρωτήσει
 * άνθρωπο** ποιο ισχύει. Το σύστημα ήξερε **και τους δύο** αριθμούς και **δεν είπε κανέναν**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΟΧΙ** ΤΟ `_v` ΤΟΥ ΕΠΙΠΕΔΟΥ — ΜΕΤΡΗΜΕΝΟ ΣΤΟ ΖΩΝΤΑΝΟ FIRESTORE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο δείκτης που προτάθηκε ήταν το `dxf_viewer_levels._v`. Ανοίχτηκε το ζωντανό επίπεδο:
 *
 * ```
 * dxf_viewer_levels/lvl_9f2c7d41…   _v: 56   ← ΚΑΜΙΑ γεωμετρία μέσα: name · order · visible
 *                                              floorId · bimRenderSettings · sceneFileId
 * files/file_7cd206cc…        revision:  5   ← ΕΔΩ ζει το σχέδιο (552 οντότητες, .scene.json)
 * ```
 *
 * **Ίδιο επίπεδο, ίδια μέρα: 56 έναντι 5 — ενδεκαπλάσιος θόρυβος.** Το `_v` αυξάνεται σε
 * **κάθε** PATCH *(μετονομασία, ορατότητα, σειρά, χρώμα πένας)*, δηλαδή το μοντέλο θα
 * δηλωνόταν μπαγιάτικο **51 φορές χωρίς να έχει αλλάξει ούτε ένα τρίγωνο**. Ένα gate με
 * τέτοιο ποσοστό ψευδώς θετικών **δεν είναι gate — είναι θόρυβος** *(ο ίδιος ≤10% πήχης της
 * Google που επικαλείται το `geometry-fingerprint`)*.
 *
 * 🏆 **Το `revision` του `sceneFileId` είναι ο σωστός δείκτης, και υπάρχει ήδη**:
 * `newVersion = existingRevision + 1`, γραμμένο **μόνο** από το `POST /api/cad-files`
 * *(`cad-files.handlers.ts`)* — δηλαδή **μόνο όταν αποθηκεύεται η σκηνή**. Μονότονο ⇒ η
 * παλαιότητα γίνεται **ακριβής ισότητα**, ποτέ σύγκριση ρολογιών *(που λέει ψέματα κάθε φορά
 * που μια αποθήκευση δεν άλλαξε γεωμετρία)*.
 *
 * ⚠️ **Και είναι καλύτερο ΚΑΙ από το αποτύπωμα γεωμετρίας**: μηδέν υπολογισμός, και κανένα
 * ζήτημα **αναπαράστασης** *(σκηνή `THREE` vs `glTF` — τα τρία μεγέθη που το
 * `publish-model-to-property` απαγορεύει ρητά να συγκριθούν)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΡΑΦΗ ΕΙΝΑΙ Η ΙΔΙΑ ΜΕ ΤΟΥ `at`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **πελάτης** ξέρει **ποια** αρχεία σκηνής συνέθεσαν το μοντέλο *(ο `Level` κουβαλά
 * `sceneFileId`, και το `resolveExportFloors` επιστρέφει ακριβώς τα επίπεδα του εύρους)*.
 * Ο **διακομιστής** ξέρει **σε ποιο revision** ήταν. ⇒ Ο πελάτης **δεν μπορεί να πει ψέματα**
 * για την έκδοση, όπως δεν μπορεί για τη στιγμή.
 *
 * ⛔ **ΚΑΙ ΔΕΝ ΤΑΞΙΔΕΥΕΙ ΣΤΟ GLB**: είναι ιδιωτικά `file_…` αναγνωριστικά, και το
 * `LISTING_MODEL_SOURCE_REF` απορρίπτει **ονομαστικά** *«ένα ιδιωτικό μονοπάτι σε ανώνυμο
 * επισκέπτη, για μηδενικό όφελος»*. Ζει **μόνο** στο `files` έγγραφο.
 */

import {
  MODEL_STATE_MARKS,
  type ModelPublicationDeclaration,
} from '@/lib/listings/listing-model-declaration';
import {
  modelFreshness,
  sourceFileIdsOf,
  type ModelSourceRevision,
} from '@/lib/listings/model-source-revisions';
import { buildPublishedModelFileRecord } from '@/lib/listings/model-file-record';
import { buildFinalizeFileRecordUpdate } from '@/services/file-record';

const LISTING = 'prop_ef2eaebd-de24-4058-a76e-6f2ec389aff9';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const AUTHOR = 'WKBWEg3DSfcdSbLNJfzGEW3vkct1';
const MODEL_MIME = 'model/gltf-binary';

/** Το **ζωντανό** αρχείο σκηνής του `lvl_9f2c7d41…`, με το πραγματικό του revision. */
const SCENE_FILE = 'file_7cd206cc-9751-463b-b1dd-70fd1ffb8deb';
const SCENE_REVISION = 5;

function declaration(): ModelPublicationDeclaration {
  return {
    state: MODEL_STATE_MARKS[0],
    scope: 'active-floor',
    signatory: { name: 'Γ. Παγώνης', discipline: 'πολιτικός μηχανικός', studiedAt: '2026-09-01' },
    geometry: {
      meshCount: 12, triangleCount: 288, materialCount: 1, textureCount: 0, fingerprint: null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ο-25 — ΤΟ ΔΗΜΟΣΙΕΥΜΕΝΟ ΜΟΝΤΕΛΟ ΞΕΡΕΙ ΑΠΟ ΠΟΥ ΗΡΘΕ
// ═══════════════════════════════════════════════════════════════════════════

describe('ADR-845 Ο-25 — η παλαιότητα του δημοσιευμένου μοντέλου', () => {
  it('Κ1 — 🏆 το έγγραφο κουβαλά ΑΠΟ ΠΟΙΑ ΕΚΔΟΣΗ ΣΧΕΔΙΟΥ παρήχθη', () => {
    // 🔴 **ΤΟ ΜΕΤΡΗΜΕΝΟ ΚΕΝΟ**: σήμερα αυτό απαντά `undefined`. Το σύστημα ξέρει και τους δύο
    //    αριθμούς — το `revision` της σκηνής και τη στιγμή της δημοσίευσης — και **δεν κρατά
    //    κανέναν δεσμό ανάμεσά τους**. Γι' αυτό ο άνθρωπος χρειάστηκε να ρωτήσει άνθρωπο.
    const { recordBase } = buildPublishedModelFileRecord({
      companyId: COMPANY,
      propertyId: LISTING,
      contentType: MODEL_MIME,
      originalFilename: `${LISTING}.glb`,
      createdBy: AUTHOR,
      declaration: declaration(),
      sourceRevisions: [{ fileId: SCENE_FILE, revision: SCENE_REVISION }],
    });

    const finalized = buildFinalizeFileRecordUpdate({ sizeBytes: 251004, downloadUrl: '/x' });
    const landed = { ...recordBase, ...finalized };

    expect(landed.sourceRevisions).toEqual([{ fileId: SCENE_FILE, revision: SCENE_REVISION }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Η ΚΡΙΣΗ — **ΑΚΡΙΒΗΣ ΙΣΟΤΗΤΑ**, ΠΟΤΕ ΣΥΓΚΡΙΣΗ ΡΟΛΟΓΙΩΝ
// ═══════════════════════════════════════════════════════════════════════════

const RECORDED: readonly ModelSourceRevision[] = [{ fileId: SCENE_FILE, revision: SCENE_REVISION }];

describe('ADR-845 Ο-25 — «ισχύει ακόμα αυτό που δημοσιεύσαμε;»', () => {
  it('Κ2 — 🏆 ΙΔΙΟ revision ⇒ ΙΣΧΥΕΙ', () => {
    expect(modelFreshness(RECORDED, new Map([[SCENE_FILE, SCENE_REVISION]])))
      .toEqual({ state: 'current' });
  });

  it('Κ3 — 🔴 το σχέδιο ΠΡΟΧΩΡΗΣΕ ⇒ ΜΠΑΓΙΑΤΙΚΟ, και ΛΕΕΙ ποιο', () => {
    // Ακριβώς το γεγονός: ο άνθρωπος αποθήκευσε τη σκηνή (revision 5 → 6) και η αγγελία
    // εξακολουθεί να δείχνει ό,τι παρήχθη από το 5. Το **ονομάζει**, ώστε το μήνυμα να
    // μπορεί να πει *ποιο* σχέδιο — όχι «κάτι άλλαξε» (ADR-844 §1).
    const verdict = modelFreshness(RECORDED, new Map([[SCENE_FILE, SCENE_REVISION + 1]]));

    expect(verdict).toEqual({ state: 'stale', changed: RECORDED });
  });

  it('Κ4 — ⚠️ το σχέδιο ΕΞΑΦΑΝΙΣΤΗΚΕ ⇒ ΜΠΑΓΙΑΤΙΚΟ — απουσία ΔΕΝ σημαίνει «δεν άλλαξε»', () => {
    // Διαγράφηκε, αντικαταστάθηκε (Ο-16) ή έχασε την κηδεμονία του. Ένα `?? recorded` εδώ θα
    // έλεγε «ισχύει» για μοντέλο του οποίου η πηγή **δεν υπάρχει πια**.
    expect(modelFreshness(RECORDED, new Map()).state).toBe('stale');
  });

  it('Κ5 — 🔴 ΧΩΡΙΣ καταγραφή ⇒ «ΔΕΝ ΞΕΡΩ», ΠΟΤΕ «ισχύει»', () => {
    // Κάθε μοντέλο που δημοσιεύτηκε **πριν** από αυτή τη φάση — και υπάρχουν δύο, ζωντανά.
    // Το να τα βαφτίσουμε «φρέσκα» είναι ο ΙΔΙΟΣ ισχυρισμός που το Ο-25 καταγγέλλει, ανάποδα.
    const full = new Map([[SCENE_FILE, SCENE_REVISION]]);

    expect(modelFreshness(undefined, full)).toEqual({ state: 'unknown' });
    expect(modelFreshness([], full)).toEqual({ state: 'unknown' });
  });

  it('Κ6 — ΠΟΛΛΑ σχέδια (`all-floors`): **ΕΝΑ** αρκεί για να γίνει μπαγιάτικο', () => {
    const other = 'file_aaaa1111-2222-4333-8444-555566667777';
    const recorded: readonly ModelSourceRevision[] = [
      { fileId: SCENE_FILE, revision: 5 },
      { fileId: other, revision: 2 },
    ];

    expect(modelFreshness(recorded, new Map([[SCENE_FILE, 5], [other, 2]])).state).toBe('current');

    const verdict = modelFreshness(recorded, new Map([[SCENE_FILE, 5], [other, 3]]));
    expect(verdict).toEqual({ state: 'stale', changed: [{ fileId: other, revision: 2 }] });
  });

  it('Κ7 — 🔑 ΕΝΑ πέρασμα για ΠΟΛΛΑ μοντέλα — καμία διπλή ανάγνωση', () => {
    // Δύο μοντέλα του ίδιου ακινήτου (`as-built` + `proposal`, ο πληθυντικός του Ο-27)
    // μοιράζονται τα ΙΔΙΑ σχέδια. Ένα ερώτημα ανά μοντέλο θα πλήρωνε τα ίδια reads δύο φορές.
    const other = 'file_aaaa1111-2222-4333-8444-555566667777';
    const ids = sourceFileIdsOf([
      [{ fileId: SCENE_FILE, revision: 5 }],
      [{ fileId: SCENE_FILE, revision: 5 }, { fileId: other, revision: 2 }],
      undefined,
    ]);

    expect([...ids].sort()).toEqual([other, SCENE_FILE].sort());
  });
});
