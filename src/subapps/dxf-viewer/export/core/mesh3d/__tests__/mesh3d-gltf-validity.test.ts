/**
 * @jest-environment jsdom
 *
 * @fileoverview 🏆 **ΠΑΡΑΓΕΙ Ο ΕΞΑΓΩΓΕΑΣ ΜΑΣ ΕΓΚΥΡΟ glTF 2.0;** — ο επίσημος κριτής, εκτελούμενος.
 * @related ADR-413 (UV) · ADR-668 (serialiseGlb) · ADR-845 §9 (Ο-15) · public-shelf-model-bake
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ, ΟΧΙ ΥΠΟΘΕΤΙΚΟ (2026-09-09)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα πραγματικό GLB **122.636 bytes** ανέβηκε, έφτασε στον ψήστη, και απορρίφθηκε:
 * *«glTF-Validator reported **13** error(s) — the file is not valid glTF 2.0»*. Και τα 13 ήταν
 * **ΕΝΑ** ελάττωμα, δεκατρείς φορές:
 *
 * ```
 * MESH_PRIMITIVE_INDEXED_SEMANTIC_CONTINUITY
 *   Indices for indexed attribute semantic 'TEXCOORD' must start with 0 and be continuous.
 *   Total expected indices: 3, total provided indices: 2.
 * ```
 *
 * Μετρημένο **μέσα στο ίδιο το αρχείο**: `13x [POSITION, NORMAL, TEXCOORD_0, TEXCOORD_2]` —
 * **τρύπα στο `TEXCOORD_1`**. Αιτία: τα UV helpers έγραφαν `uv2`, και ο `GLTFExporter` του
 * **r170** χαρτογραφεί `uv→TEXCOORD_0 · uv1→TEXCOORD_1 · uv2→TEXCOORD_2`.
 *
 * 🔑 **ΤΟ `uv2` ΕΙΧΕ ΠΑΨΕΙ ΝΑ ΣΗΜΑΙΝΕΙ ΑΥΤΟ ΠΟΥ ΝΟΜΙΖΑΜΕ, ΣΙΩΠΗΛΑ, ΣΤΟ r152**: ο επίσημος
 * οδηγός μετάβασης γράφει *«`uv`, `uv2`, `uv3`, `uv4` are now `uv`, `uv1`, `uv2`, `uv3`»* και
 * *«`aoMap` and `lightMap` **no longer use `uv2`** — set `material.lightMap.channel`»*. Το
 * `aoMap` μας **ποτέ** δεν όρισε `channel`, άρα διάβαζε ήδη `uv` *(channel 0)* — δηλαδή το
 * `uv2` ήταν **αντίγραφο που κανείς δεν διάβαζε**, και μόνο δηλητηρίαζε την εξαγωγή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΗ ΑΠΟ ΤΗΝ ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας του κλάδου *(Khronos glTF-Validator σε CI, 3D Commerce Asset Auditor)* ρωτά
 * *«είναι έγκυρο **αυτό το αρχείο**;»* και τρέχει πάνω σε **δεσμευμένα** `.glb`.
 *
 * ⛔ **Σε εμάς αυτό θα ήταν πύλη που δεν φυλάει τίποτα**: δεν έχουμε δεσμευμένα `.glb` — έχουμε
 * **εξαγωγέα**, και ο **εξαγωγέας** έσπασε. Ένα δείγμα ελεγμένο σήμερα δεν λέει τίποτα για ό,τι
 * παράγεται αύριο από άλλη γεωμετρία.
 *
 * ⇒ Εδώ η ερώτηση είναι *«παράγει **η ΔΙΚΗ ΜΑΣ ΑΛΥΣΙΔΑ** έγκυρο glTF;»*: εκτελούνται τα
 * **πραγματικά** UV helpers, ο **πραγματικός** {@link serialiseGlb}, και ο **ίδιος** κριτής που
 * τρέχει ο ψήστης της δημοσίευσης. Ίδιο σχήμα με τη ραφή του **Ο-13**: δοκιμάζεται ο **γραφέας**,
 * ποτέ ένα χειρόγραφο δείγμα του.
 *
 * ⚠️ **Μόνο `numErrors`, ποτέ `numWarnings`** — ίδιο συμβόλαιο με τον ψήστη
 * *(`validateOrThrow`)*: πύλη που μπλοκάρει σε προειδοποίηση είναι πύλη που κανείς δεν περνά,
 * και η πρώτη που απενεργοποιείται.
 */

import * as THREE from 'three';

import { ensureWorldUvs, setPlanarWorldUvs } from '../../../../bim-3d/converters/bim-uv-helpers';
import { serialiseGlb } from '../mesh3d-serialise';

/** Ο επίσημος κριτής — **δανεικός από τον ψήστη**, ποτέ δεύτερη γνώμη για το πρότυπο. */
interface ValidatorIssue {
  readonly severity: number;
  readonly code: string;
  readonly message: string;
  readonly pointer?: string;
}
interface ValidatorReport {
  readonly issues: {
    readonly numErrors: number;
    readonly messages: readonly ValidatorIssue[];
  };
}

async function validate(bytes: ArrayBuffer): Promise<ValidatorReport> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateBytes } = require('gltf-validator') as {
    validateBytes: (b: Uint8Array) => Promise<ValidatorReport>;
  };
  return validateBytes(new Uint8Array(bytes));
}

/** Τα ονόματα των σφαλμάτων, ώστε η αποτυχία να **λέει τι**, όχι «κάτι». */
function errorsOf(report: ValidatorReport): string[] {
  return report.issues.messages
    .filter((m) => m.severity === 0)
    .map((m) => `[${m.code}] ${m.pointer ?? ''} ${m.message}`);
}

/**
 * Μια σκηνή με τις **δύο** διαδρομές UV των helpers μας:
 * ① γεωμετρία **με** auto-UV *(`ensureWorldUvs`)* · ② γεωμετρία **χωρίς** *(`setPlanarWorldUvs`)*.
 *
 * ⚠️ Και οι δύο, γιατί έγραφαν `uv2` σε **διαφορετικά** σημεία: μια άγκυρα σε μία μόνο διαδρομή
 * θα έμενε πράσινη ενώ η άλλη θα παρήγαγε άκυρο αρχείο.
 */
function sceneFromOurHelpers(): THREE.Object3D {
  const scene = new THREE.Scene();

  const withAutoUv = new THREE.BoxGeometry(2, 3, 0.25);
  ensureWorldUvs(withAutoUv);
  scene.add(new THREE.Mesh(withAutoUv, new THREE.MeshStandardMaterial({ name: 'wall' })));

  const noUv = new THREE.BufferGeometry();
  noUv.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1]),
      3,
    ),
  );
  noUv.computeVertexNormals();
  setPlanarWorldUvs(noUv, { dominantAxis: 'y' });
  scene.add(new THREE.Mesh(noUv, new THREE.MeshStandardMaterial({ name: 'slab' })));

  return scene;
}

describe('ADR-845 Ο-15 — ο εξαγωγέας μας παράγει ΕΓΚΥΡΟ glTF 2.0', () => {
  it('Κ1 — 🏆 ΜΗΔΕΝ σφάλματα από τον επίσημο κριτή της Khronos', async () => {
    const report = await validate(await serialiseGlb(sceneFromOurHelpers()));

    // 🔴 Η ζωντανή μέτρηση ήταν **13**. Το μήνυμα απαριθμεί τα ονόματα, ώστε μια μελλοντική
    //    αποτυχία να λέει **ποιος** κανόνας του προτύπου έσπασε — όχι απλώς «άκυρο».
    expect(errorsOf(report)).toEqual([]);
    expect(report.issues.numErrors).toBe(0);
  }, 30_000);

  it('Κ2 — τα TEXCOORD ξεκινούν στο 0 και είναι ΣΥΝΕΧΗ (η ρίζα των 13)', async () => {
    const glb = await serialiseGlb(sceneFromOurHelpers());
    const buffer = Buffer.from(glb);
    const jsonLength = buffer.readUInt32LE(12);
    const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8')) as {
      meshes: readonly { primitives: readonly { attributes: Record<string, number> }[] }[];
    };

    // ⚠️ Ελέγχεται **κάθε** primitive: το ζωντανό αρχείο είχε 13 σπασμένα και 12 καθαρά —
    //    ένα δείγμα «του πρώτου» θα είχε περάσει ακόμη και τότε.
    const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives);
    expect(primitives.length).toBeGreaterThan(0);

    for (const primitive of primitives) {
      const sets = Object.keys(primitive.attributes)
        .filter((name) => name.startsWith('TEXCOORD_'))
        .map((name) => Number(name.slice('TEXCOORD_'.length)))
        .sort((a, b) => a - b);

      // Το glTF 2.0 απαιτεί ρητά: ξεκινούν στο 0, χωρίς κενά (§3.7.2.1).
      expect(sets).toEqual(sets.map((_, index) => index));
    }
  }, 30_000);
});
