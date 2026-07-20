/**
 * export-manifest — ADR-683 §7. Το **sidecar** `.nestor.json` που ταξιδεύει δίπλα σε κάθε 3Δ
 * export (OBJ ή GLB) και γυρίζει πίσω **αυτούσιο** μαζί με το πειραγμένο μοντέλο.
 *
 * **Γιατί υπάρχει:** τα mesh formats δεν χωράνε την πληροφορία που χρειάζεται ο reconciler.
 * Το manifest δίνει τα τρία πράγματα που λείπουν (ADR-683 §7):
 *   (α) το `geometryHash`/`geometry` κάθε στοιχείου **όπως ήταν κατά την εξαγωγή** → χωρίς αυτό
 *       δεν ξεχωρίζει η κατάσταση **A** («άλλαξε μόνο χρώμα») από την **C** («άλλαξε το σχήμα»)·
 *   (β) το πλήρες σύνολο των εξαχθέντων στοιχείων → από το set difference προκύπτει η κατάσταση
 *       **E** (MISSING: υπήρχε στην εξαγωγή, λείπει στην επιστροφή)·
 *   (γ) τη σύνδεση `meshName → bimId/bimType/levelId` χωρίς lossy reverse-parse ονόματος.
 *
 * **Ο εξωτερικός μηχανικός δεν το αγγίζει.** Είναι δεδομένα του Νέστορα, όχι ρύθμιση.
 *
 * **Μονάδα:** το `unit` περιγράφει το **αρχείο μοντέλου** (το OBJ κλιμακώνεται σε cm/mm κατ'
 * επιλογή· το glTF είναι spec-locked σε μέτρα). Τα fingerprints είναι **ΠΑΝΤΑ σε μέτρα** —
 * υπολογίζονται πριν το `applyExportUnit`, αλλιώς το ίδιο μοντέλο θα έδινε άλλο hash ανά επιλογή
 * μονάδας (βλ. `./geometry-hash`).
 *
 * **Τι ΔΕΝ γράφεται ακόμη:** οι αρχικές παράμετροι (`params`) του ADR-683 §7. Τις χρειάζεται ο
 * **διάλογος** της Φ4 για να δείξει «τι άλλαξε»· η headless σκηνή εξαγωγής κουβαλά ταυτότητα
 * (`userData`), όχι το παραμετρικό DNA. Θα μπουν στη Φ4 από την πλευρά των οντοτήτων, όχι από
 * το three δέντρο.
 *
 * @see ./geometry-hash — το SSoT των fingerprints (ίδια συνάρτηση, export + import)
 * @see ../../export/core/mesh3d/mesh3d-identity — resolveBimMeshIdentity (SSoT ταυτότητας)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §7
 */

import type * as THREE from 'three';
import { resolveBimMeshIdentity } from '../../export/core/mesh3d/mesh3d-identity';
import { computeGeometryFingerprint, type GeometryFingerprint, type GeometrySignature, type Vec3M } from './geometry-hash';

/** Έκδοση σχήματος. Αλλαγή **ασύμβατη** ⇒ νέο string, ώστε ένα παλιό manifest να απορρίπτεται ρητά. */
export const NESTOR_MANIFEST_SCHEMA = 'nestor-export/1';

/** Κατάληξη του sidecar (περνά στο `buildFloorFilename` — μηδέν δεύτερος filename builder). */
export const NESTOR_MANIFEST_EXT = 'nestor.json';

export const NESTOR_MANIFEST_MIME = 'application/json';

/** Μία εξαχθείσα οντότητα, όπως ήταν τη στιγμή της εξαγωγής. */
export interface ManifestEntity {
  /** Το όνομα που πήρε το mesh στο αρχείο (`buildMeshName` + τυχόν `_N`). Το κλειδί αντιστοίχισης. */
  readonly meshName: string;
  readonly bimId: string | null;
  readonly bimType: string | null;
  readonly levelId: string | null;
  /** `null` όταν το mesh δεν είχε αξιοποιήσιμες κορυφές — ποτέ δεν θεωρείται «ίδιο». */
  readonly geometryHash: string | null;
  readonly geometry: GeometrySignature | null;
}

export interface NestorExportManifest {
  readonly schema: string;
  /** ISO 8601. */
  readonly exportedAt: string;
  readonly projectName: string;
  readonly buildingId: string | null;
  /** Μονάδα του **αρχείου μοντέλου** — όχι των fingerprints (πάντα μέτρα). */
  readonly unit: string;
  readonly entities: readonly ManifestEntity[];
}

export interface ManifestBuildOptions {
  readonly exportedAt: string;
  readonly projectName: string;
  readonly buildingId: string | null;
  readonly unit: string;
}

/**
 * Χτίζει το manifest από την **ονοματισμένη** σκηνή εξαγωγής. Πρέπει να κληθεί **μετά** το
 * `nameMeshesForExport` (αλλιώς τα `meshName` είναι κενά) και **πριν** το `applyExportUnit`
 * (αλλιώς τα fingerprints δεν είναι σε μέτρα).
 */
export function buildExportManifest(
  root: THREE.Object3D,
  options: ManifestBuildOptions,
): NestorExportManifest {
  const entities: ManifestEntity[] = [];

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const identity = resolveBimMeshIdentity(mesh);
    const fingerprint: GeometryFingerprint | null = computeGeometryFingerprint(mesh);
    entities.push({
      meshName: mesh.name,
      bimId: identity.bimId,
      bimType: identity.bimType,
      levelId: identity.levelId,
      geometryHash: fingerprint?.hash ?? null,
      geometry: fingerprint?.signature ?? null,
    });
  });

  return {
    schema: NESTOR_MANIFEST_SCHEMA,
    exportedAt: options.exportedAt,
    projectName: options.projectName,
    buildingId: options.buildingId,
    unit: options.unit,
    entities,
  };
}

/** Αναγνώσιμο JSON — ο χρήστης μπορεί να το ανοίξει και να καταλάβει τι στέλνει. */
export function serialiseManifest(manifest: NestorExportManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readVec3(source: Record<string, unknown>, key: string): Vec3M | null {
  const value = source[key];
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((n): n is number => typeof n === 'number' && Number.isFinite(n))) return null;
  return [value[0], value[1], value[2]];
}

function parseSignature(value: unknown): GeometrySignature | null {
  if (!isRecord(value)) return null;
  const vertexCount = readNumber(value, 'vertexCount');
  const triangleCount = readNumber(value, 'triangleCount');
  const areaM2 = readNumber(value, 'areaM2');
  const sizeM = readVec3(value, 'sizeM');
  const centroidM = readVec3(value, 'centroidM');
  if (vertexCount === null || triangleCount === null || areaM2 === null) return null;
  if (sizeM === null || centroidM === null) return null;
  return { vertexCount, triangleCount, areaM2, sizeM, centroidM };
}

function parseEntity(value: unknown): ManifestEntity | null {
  if (!isRecord(value)) return null;
  const meshName = readString(value, 'meshName');
  if (meshName === null) return null;
  return {
    meshName,
    bimId: readString(value, 'bimId'),
    bimType: readString(value, 'bimType'),
    levelId: readString(value, 'levelId'),
    geometryHash: readString(value, 'geometryHash'),
    geometry: parseSignature(value['geometry']),
  };
}

/**
 * Διαβάζει ένα επιστρεφόμενο `.nestor.json`. **Fail-closed:** άγνωστο/κατεστραμμένο σχήμα →
 * `null`, ώστε ο caller να προειδοποιήσει ρητά («δεν βρέθηκε manifest — δεν μπορώ να ξεχωρίσω
 * τι άλλαξε») αντί να τρέξει reconcile πάνω σε μισοδιαβασμένα δεδομένα.
 */
export function parseExportManifest(text: string): NestorExportManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  if (readString(raw, 'schema') !== NESTOR_MANIFEST_SCHEMA) return null;
  if (!Array.isArray(raw['entities'])) return null;

  const entities = raw['entities'].map(parseEntity).filter((e): e is ManifestEntity => e !== null);
  return {
    schema: NESTOR_MANIFEST_SCHEMA,
    exportedAt: readString(raw, 'exportedAt') ?? '',
    projectName: readString(raw, 'projectName') ?? '',
    buildingId: readString(raw, 'buildingId'),
    unit: readString(raw, 'unit') ?? 'meters',
    entities,
  };
}

/**
 * `meshName → εγγραφή`. Το ίδιο κλειδί που παράγει ο parser του επιστρεφόμενου αρχείου
 * (`collectGltfObjects().objectName` / `parseObjObjects().objectName`) → άμεσο join χωρίς
 * δεύτερη σημασιολογία ονόματος.
 */
export function indexManifestByMeshName(
  manifest: NestorExportManifest,
): Map<string, ManifestEntity> {
  const map = new Map<string, ManifestEntity>();
  for (const entity of manifest.entities) {
    if (entity.meshName.length > 0) map.set(entity.meshName, entity);
  }
  return map;
}

/** Το fingerprint μιας εγγραφής manifest σε μορφή συγκρίσιμη με το import (`compareGeometry`). */
export function manifestFingerprint(entity: ManifestEntity): GeometryFingerprint | null {
  if (entity.geometryHash === null || entity.geometry === null) return null;
  return { hash: entity.geometryHash, signature: entity.geometry };
}
