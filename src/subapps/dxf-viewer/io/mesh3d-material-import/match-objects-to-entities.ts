/**
 * match-objects-to-entities — ADR-678 Φ1. Αντιστοιχίζει τα OBJ objects (από το C4D) στα ζωντανά
 * BIM στοιχεία, **ανά όνομα**.
 *
 * **Γιατί forward map και όχι reverse-parse:** το export name (`buildMeshName`) περνά από
 * transliteration + sanitization → το ανάποδο parsing θα ήταν lossy/αμφίσημο (το `bimId` και το
 * όνομα ορόφου έχουν κι αυτά `_`/`-`). Αντ' αυτού παράγουμε ΤΟ ΙΔΙΟ όνομα για κάθε ζωντανή
 * οντότητα με την ΙΔΙΑ `buildMeshName` και χτίζουμε `Map<name, bimId>` — μηδέν drift απ' το export.
 *
 * Καλύπτουμε και single-floor (χωρίς πρόθεμα ορόφου) και multi-floor export: προσθέτουμε στον
 * χάρτη ΚΑΙ τις δύο εκδοχές του ονόματος. Το `HIDDEN_` πρόθεμα και το `_N` disambiguation suffix
 * αφαιρούνται στο matching (πολλά meshes ίδιου `bimId` → ίδιος στόχος βαφής).
 *
 * @see ../../export/core/mesh3d/mesh3d-naming — buildMeshName (SSoT ονοματοδοσίας)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import { buildMeshName, type MeshNameCharset } from '../../export/core/mesh3d/mesh3d-naming';
import { HIDDEN_NAME_PREFIX } from '../../export/core/mesh3d/mesh3d-naming';
import type { ObjectMaterialAssignment } from './obj-mtl-parse';

/** Ταυτότητα ζωντανής οντότητας για αναπαραγωγή του export ονόματος. */
export interface EntityExportIdentity {
  readonly bimId: string;
  readonly bimType: string | null;
  /** Εμφανιζόμενο όνομα ορόφου (κενό όταν η οντότητα δεν έχει level). */
  readonly floorName: string;
}

/** Ένα ταιριασμένο ζεύγος object ↔ οντότητα. */
export interface MatchedObject {
  readonly objectName: string;
  readonly bimId: string;
  readonly materialName: string | null;
}

export interface MatchResult {
  readonly matched: readonly MatchedObject[];
  /** Ονόματα object που δεν βρήκαν οντότητα (π.χ. νέα γεωμετρία που πρόσθεσε ο χρήστης στο C4D). */
  readonly unmatched: readonly string[];
}

/** `Wall_w-42_3` → `Wall_w-42` (αφαίρεση disambiguation suffix). Χωρίς suffix → ίδιο. */
function stripDisambiguation(name: string): string {
  return name.replace(/_\d+$/, '');
}

/** `HIDDEN_Isogeio_Wall_w-42` → `Isogeio_Wall_w-42`. */
function stripHidden(name: string): string {
  const prefix = `${HIDDEN_NAME_PREFIX}_`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

/** Χάρτης `exportName → bimId` για όλες τις οντότητες (με & χωρίς πρόθεμα ορόφου). */
function buildNameToBimId(
  entities: readonly EntityExportIdentity[],
  charset: MeshNameCharset,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entities) {
    const identity = { bimType: e.bimType, bimId: e.bimId, matId: null, levelId: null };
    const withFloor = buildMeshName(identity, 0, { floorName: e.floorName, hidden: false, charset });
    const noFloor = buildMeshName(identity, 0, { floorName: '', hidden: false, charset });
    map.set(withFloor, e.bimId);
    map.set(noFloor, e.bimId);
  }
  return map;
}

/**
 * Αντιστοιχίζει OBJ objects → BIM οντότητες. Δοκιμάζει: άμεσο όνομα → χωρίς `HIDDEN_` →
 * χωρίς `_N` suffix. Πρώτο hit κερδίζει.
 */
export function matchObjectsToEntities(
  objects: readonly ObjectMaterialAssignment[],
  entities: readonly EntityExportIdentity[],
  charset: MeshNameCharset,
): MatchResult {
  const nameToBimId = buildNameToBimId(entities, charset);
  const matched: MatchedObject[] = [];
  const unmatched: string[] = [];

  for (const obj of objects) {
    const candidates = [
      obj.objectName,
      stripHidden(obj.objectName),
      stripDisambiguation(obj.objectName),
      stripDisambiguation(stripHidden(obj.objectName)),
    ];
    const bimId = candidates.map((c) => nameToBimId.get(c)).find((v) => v !== undefined);
    if (bimId !== undefined) {
      matched.push({ objectName: obj.objectName, bimId, materialName: obj.materialName });
    } else {
      unmatched.push(obj.objectName);
    }
  }
  return { matched, unmatched };
}
