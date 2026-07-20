/**
 * gltf-node-placement — ADR-683 Φ3β: **ο αντίστροφος** του `mesh-to-object3d` (ADR-411).
 *
 * Όταν ο Νέστωρ *τοποθετεί* ένα εισαγόμενο πλέγμα, το `meshToObject3D` μετατρέπει
 * «θέση κάτοψης (scene units) + υψόμετρο έδρασης» → «παγκόσμιες συντεταγμένες three (m, Y-up)».
 * Όταν *εισάγει*, χρειάζεται ακριβώς η αντίστροφη πράξη: ο κόμβος του `.glb` κάθεται ήδη κάπου
 * στον χώρο, και πρέπει να βρεθεί ποια θέση κάτοψης θα τον ξανα-τοποθετούσε **εκεί ακριβώς**.
 *
 * **Γιατί δεν εφευρίσκεται νέα σύμβαση:** η αντιστοίχιση αξόνων ζει ήδη — και μόνο — στο
 * `mesh-to-object3d.ts:80-99`. Δεύτερη διατύπωσή της θα ήταν δεύτερη πηγή αλήθειας που θα
 * απέκλινε σιωπηλά. Εδώ γίνεται **αναστροφή** αυτής, όχι επαναδιατύπωση:
 *
 * | Τοποθέτηση (`meshToObject3D`)            | Εισαγωγή (εδώ)                              |
 * |------------------------------------------|---------------------------------------------|
 * | `worldX = position.x * sceneToM`          | `position.x = centre.x / sceneToM`          |
 * | `worldZ = -(position.y * sceneToM)`       | `position.y = -centre.z / sceneToM`         |
 * | base anchor: `bbox.min.y === mountingY`   | `mountingElevationMm` από το `minY`         |
 *
 * ⚠️ **Ο πιο ύπουλος τρόπος να σπάσει:** λάθος πρόσημο στο `z`. Δεν πετά σφάλμα, δεν κρασάρει —
 * τα αντικείμενα απλώς προσγειώνονται **καθρεφτισμένα** ως προς τον άξονα Χ, και κανείς δεν
 * καταλαβαίνει γιατί «το κάγκελο μπήκε στην απέναντι πλευρά». Το test χρησιμοποιεί **ασύμμετρες**
 * συντεταγμένες ώστε το λάθος πρόσημο να μην μπορεί να περάσει.
 *
 * ⚠️ **Αν αλλάξει το `mesh-to-object3d`, ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΣΠΑΕΙ** — το round-trip test είναι εκεί
 * ακριβώς γι' αυτό: πιάνει την απόκλιση των δύο πλευρών, όχι το καθένα χωριστά.
 *
 * @see ../../bim-3d/converters/mesh-to-object3d — η ευθεία πράξη (SSoT της σύμβασης αξόνων)
 * @see ./gltf-scene-parse — από εκεί έρχεται το `worldBoxM` κάθε κόμβου
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §5
 */

import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import type { Point3D } from '../../bim/types/bim-base';

const M_TO_MM = 1000;

/**
 * Η **απόλυτη** θέση ενός κόμβου glTF στον κόσμο (m). Κρατιέται σκόπιμα **έξω** από το
 * `GeometrySignature`: το fingerprint οφείλει να μένει ανεξάρτητο μετατόπισης, αλλιώς ένα
 * μετακινημένο-αλλά-αναλλοίωτο αντικείμενο θα φαινόταν «αλλαγμένο σχήμα» στον reconciler (§5).
 */
export interface GltfNodeWorldBox {
  /** Κέντρο του bounding box (m, three world: Y-up). */
  readonly centre: { readonly x: number; readonly y: number; readonly z: number };
  /** Κατώτατο σημείο στον κατακόρυφο άξονα (m) — η έδρα του αντικειμένου. */
  readonly minY: number;
}

/** Το πλαίσιο υποδοχής: πού «κάθεται» ο όροφος στον οποίο εισάγεται ο κόμβος. */
export interface GltfPlacementContext {
  readonly sceneUnits: SceneUnits;
  /** Υψόμετρο τελειωμένου δαπέδου του ορόφου υποδοχής (mm). */
  readonly floorElevationMm: number;
  /** Βάση κτηρίου (m) — 0 για μονο-κτηριακά έργα. */
  readonly buildingBaseElevationM?: number;
}

/** Ό,τι χρειάζεται το `ImportedMeshParams` για να ξανα-τοποθετήσει τον κόμβο στην ίδια θέση. */
export interface GltfNodePlacement {
  readonly position: Point3D;
  readonly mountingElevationMm: number;
}

/**
 * Παγκόσμιο κουτί κόμβου → θέση κάτοψης + υψόμετρο έδρασης.
 *
 * **Καθαρή** συνάρτηση: κανένα three, κανένα I/O, ντετερμινιστική. Δεν πετά ποτέ — μη-πεπερασμένη
 * είσοδος δεν φιλτράρεται εδώ, γιατί ο `buildImportedMeshEntity` απορρίπτει ήδη τους εκφυλισμένους
 * κόμβους· διπλός έλεγχος θα σήμαινε δύο μέρη να αποφασίζουν το ίδιο πράγμα.
 *
 * Ο κατακόρυφος άξονας χρησιμοποιεί το **`minY`, όχι το κέντρο**: το `meshToObject3D` προσγειώνει
 * τα εισαγόμενα με `verticalAnchor: 'base'` (`imported-mesh-to-three.ts:60`) — δηλαδή η *έδρα*
 * πέφτει στο επίπεδο στήριξης. Με κέντρο, κάθε αντικείμενο θα βυθιζόταν στο μισό του ύψους του.
 */
export function gltfNodeToPlacement(
  worldBox: GltfNodeWorldBox,
  context: GltfPlacementContext,
): GltfNodePlacement {
  const sceneToM = sceneUnitsToMeters(context.sceneUnits);
  const mountingPlaneM = worldBox.minY - (context.buildingBaseElevationM ?? 0);

  return {
    position: {
      x: worldBox.centre.x / sceneToM,
      // Κάτοψη Y=Βορράς → three z=-Βορράς. Το πρόσημο ΕΙΝΑΙ η σύμβαση, όχι λεπτομέρεια.
      y: -worldBox.centre.z / sceneToM,
    },
    mountingElevationMm: mountingPlaneM * M_TO_MM - context.floorElevationMm,
  };
}
