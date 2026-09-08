/**
 * @fileoverview 🎯 **Η ΑΓΚΥΡΑ ΤΟΥ ΒΗΜΑΤΟΣ Γ**: *«μετρούν ο ΠΕΛΑΤΗΣ και ο ΔΙΑΚΟΜΙΣΤΗΣ το ίδιο
 * πράγμα για την ίδια σκηνή;»* — ADR-845 §6.2.1 · §8 (Α-9).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΑΥΤΟΛΟΓΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η κλειστή λογιστική συγκρίνει τη **δήλωση** του πελάτη με τη **μέτρηση** του διακομιστή. Το
 * Βήμα Γ έπρεπε να απαντήσει *«ποιος μετράει στη μεριά του πελάτη;»* — και η **προφανής**
 * απάντηση *(«διάβασε τη σκηνή `THREE`»)* θα έφτιαχνε πύλη με **100% ψευδώς θετικά**.
 *
 * 🔑 Η **Κ4** παρακάτω το **ΕΚΤΕΛΕΙ**, αντί να το γράφει σε σχόλιο: δύο `THREE.Mesh` που
 * μοιράζονται γεωμετρία **και** υλικό γίνονται **ΕΝΑ** glTF mesh — άρα μια μέτρηση της σκηνής
 * θα δήλωνε `meshCount: 2` για αρχείο που έχει `1`, και **κάθε** δημοσίευση θα απορριπτόταν
 * λέγοντας *«η γεωμετρία δεν ταιριάζει»*, δηλαδή δείχνοντας το **λάθος** μέρος.
 *
 * ⚠️ **Οι σκηνές φτιάχνονται σε ΣΥΝΑΡΤΗΣΕΙΣ, όχι σε σταθερές του `describe`**: μια εξαίρεση στο
 * σώμα του `describe` τρέχει στη **συλλογή** και ρίχνει **ολόκληρο** το αρχείο με
 * `Tests: 0 total` — πράσινο που σημαίνει «κανείς δεν κοίταξε».
 */

import * as THREE from 'three';

import { MemoryIO } from '@/services/listings/gltf-memory-io';
import { measureModelBytes, measureModelLedger } from '@/services/listings/gltf-model-measure';
import { compareModelLedger } from '@/lib/listings/listing-model-declaration';

import { serialiseGlb } from '../../../export/core/mesh3d/mesh3d-serialise';

/** Δύο κουτιά με **δικά τους** γεωμετρία και υλικό — η κανονική περίπτωση BIM εξαγωγής. */
function twoDistinctBoxes(): THREE.Object3D {
  const root = new THREE.Object3D();
  const first = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x884422 }),
  );
  const second = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x224488 }),
  );
  second.position.set(10, 0, 0);
  root.add(first, second);
  return root;
}

/** Δύο τοποθετήσεις **του ίδιου** πλέγματος — instancing, όπως το γράφει ένας BIM κατάλογος. */
function twoInstancesOfOneBox(): THREE.Object3D {
  const root = new THREE.Object3D();
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({ color: 0x336699 });

  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material);
  second.position.set(5, 0, 0);
  root.add(first, second);
  return root;
}

/** Ο **διακομιστής**: bytes → `Document` → λογιστική. Ακριβώς ό,τι κάνει ο ψήστης. */
async function measureAsServer(bytes: Uint8Array) {
  return measureModelLedger(await new MemoryIO().readBinary(bytes));
}

async function exportScene(scene: THREE.Object3D): Promise<Uint8Array> {
  return new Uint8Array(await serialiseGlb(scene));
}

describe('ADR-845 Α-9 — η κλειστή λογιστική έχει ΕΝΑΝ μετρητή', () => {
  it('Κ1 — οι δύο άκρες ΣΥΜΦΩΝΟΥΝ για την ίδια σκηνή', async () => {
    const bytes = await exportScene(twoDistinctBoxes());

    const declared = await measureModelBytes(bytes);
    const measured = await measureAsServer(bytes);

    expect(compareModelLedger(declared, measured)).toEqual({ agrees: true });
  });

  it('Κ2 — και δίνουν ΤΑΥΤΟΣΗΜΗ λογιστική, όχι απλώς συμβατή', async () => {
    const bytes = await exportScene(twoDistinctBoxes());

    const declared = await measureModelBytes(bytes);
    const measured = await measureAsServer(bytes);

    // 🔑 Το `toEqual` σε **ολόκληρη** τη λογιστική, όχι σε επιλεγμένα πεδία: μια σύγκριση
    //    πεδίο-πεδίο θα άφηνε το αποτύπωμα έξω, δηλαδή ακριβώς τον κριτή.
    expect(declared).toEqual(measured);
    expect(declared.fingerprint).not.toBeNull();
    expect(declared.triangleCount).toBeGreaterThan(0);
  });

  it('Κ3 — και ΜΠΟΡΟΥΝ να διαφωνήσουν: άλλη σκηνή ⇒ ονομαστική διαφωνία', async () => {
    const mine = await measureModelBytes(await exportScene(twoDistinctBoxes()));
    const other = await measureAsServer(await exportScene(twoInstancesOfOneBox()));

    const verdict = compareModelLedger(mine, other);

    // ⚠️ Χωρίς αυτό, τα Κ1/Κ2 θα ήταν πράσινα ακόμη κι αν ο συγκριτής έλεγε **πάντα** «ναι».
    expect(verdict.agrees).toBe(false);
    if (verdict.agrees) throw new Error('unreachable');
    expect(verdict.disagreement.field).toBe('meshCount');
  });

  it('Κ4 — 🔴 ΓΙΑΤΙ Ο ΠΕΛΑΤΗΣ ΔΕΝ ΜΕΤΡΑΕΙ ΤΗ ΣΚΗΝΗ: ο exporter ΑΠΟΔΙΠΛΑΣΙΑΖΕΙ πλέγματα', async () => {
    const scene = twoInstancesOfOneBox();

    // Η σκηνή έχει **δύο** πλέγματα — αυτό βλέπει ο άνθρωπος, κι αυτό θα μετρούσε ένας
    // «προφανής» μετρητής σκηνής.
    let sceneMeshes = 0;
    scene.traverse((object) => { if ((object as THREE.Mesh).isMesh) sceneMeshes += 1; });
    expect(sceneMeshes).toBe(2);

    const ledger = await measureAsServer(await exportScene(scene));

    // 🔴 Το **αρχείο** έχει ΕΝΑ: ο `GLTFExporter.processMesh` κρατά cache με κλειδί
    //    `geometry.uuid + material.uuid`, και οι δύο τοποθετήσεις γίνονται δύο **κόμβοι**
    //    πάνω στο ίδιο mesh. Μια δήλωση `meshCount: 2` θα ήταν εγγυημένη απόρριψη.
    expect(ledger.meshCount).toBe(1);

    // 🏆 ΚΑΙ ΟΜΩΣ Η ΓΕΩΜΕΤΡΙΑ ΕΙΝΑΙ ΣΩΣΤΗ: η διέλευση είναι **των κόμβων**, άρα και οι δύο
    //    τοποθετήσεις μετρούν — 12 τρίγωνα ανά κουτί, 24 συνολικά. Γι' αυτό το αποτύπωμα
    //    παραμένει έγκυρος κριτής ενώ τα πλήθη δεν είναι.
    expect(ledger.triangleCount).toBe(24);
  });
});
