'use client';

/**
 * C4dMaterialImportButton — ADR-678 Φ1 UI · **ADR-683 Φ2-UI (glTF/GLB)** · **ADR-678 Φ4 (COLLADA
 * `.dae`, per-face)**. Κουμπί «Εισαγωγή υλικών από 3Δ αρχείο»: ο χρήστης επιλέγει ό,τι του γύρισε ο
 * συνεργάτης — `.glb`/`.gltf` (σύγχρονος παραλήπτης), `.dae` (C4D R15, per-face) ή `.obj` + `.mtl`
 * (legacy C4D R15) — και τα χρώματα/υλικά «κατεβαίνουν» πίσω στα ίδια BIM στοιχεία (name-based).
 *
 * **ΕΝΑ κουμπί για όλα τα formats**, όχι ένα ανά format: είναι η πρακτική των μεγάλων (Revit
 * «Link/Import» = ένα dialog με format dropdown· ίδιο ArchiCAD/C4D). Ο διαχωρισμός γίνεται από την
 * κατάληξη, όχι από τον χρήστη.
 *
 * Αποκλειστικός δρόμος (ΟΧΙ ο wizard κάτοψης, που σβήνει τον όροφο): εδώ η γεωμετρία μένει
 * ανέγγιχτη — μόνο η εμφάνιση (`faceAppearance['*']`) ενημερώνεται, με ΕΝΑ undo.
 *
 * @see ../../io/mesh3d-material-import/import-c4d-materials — ο κοινός πυρήνας + OBJ wrapper
 * @see ../../io/mesh3d-roundtrip/import-gltf-appearance — ο glTF wrapper
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md
 */

import { useRef, useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../systems/levels';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useMaterialLibrary } from '../panels/materials/hooks/useMaterialLibrary';
import {
  importC4dMaterials,
  type ImportedAppearanceResult,
} from '../../io/mesh3d-material-import/import-c4d-materials';
import { importGltfAppearance } from '../../io/mesh3d-roundtrip/import-gltf-appearance';
import {
  importColladaAppearance,
  type ColladaTextureImporter,
} from '../../io/mesh3d-material-import/import-collada-appearance';
import { importForeignTextures } from '../../io/mesh3d-material-import/import-foreign-textures';
import { sha256HexOfFile } from '../../io/mesh3d-material-import/texture-content-hash';
import { uploadMaterialTextureMap } from '../../bim/services/bim-material-texture-upload.service';
import { buildKnownMaterialResolver } from '../../io/mesh3d-material-import/known-import-materials';
import type { GltfObjectRecord } from '../../io/mesh3d-roundtrip/gltf-scene-parse';
import { isImportableNode } from '../../io/mesh3d-roundtrip/import-gltf-meshes';
import { parseExportManifest, indexManifestMaterials, indexManifestByMeshName } from '../../io/mesh3d-roundtrip/export-manifest';
import { ImportedMeshImportDialog } from './imported-mesh/ImportedMeshImportDialog';

/** Τι βρέθηκε στην επιλογή του χρήστη — το format καθορίζει και τον τρόπο ανάγνωσης. */
type ImportPayload =
  | {
      readonly kind: 'gltf';
      readonly data: ArrayBuffer | string;
      readonly file: File;
      /** ADR-683 §7 — manifest baseline από συνοδό `.nestor.json` (repaint detection). */
      readonly baseline?: ReadonlyMap<string, string>;
      /** ADR-678 Βήμα 2 — per-entity/per-face baseline από συνοδό `.nestor.json` (catalog swap). */
      readonly materialBaselineByMesh?: ReadonlyMap<string, Readonly<Record<string, string>>>;
    }
  | {
      /** ADR-678 Φ4 — COLLADA `.dae` (C4D R15, per-face). */
      readonly kind: 'dae';
      readonly daeText: string;
      readonly baseline?: ReadonlyMap<string, string>;
      /** ADR-678 Βήμα 2 — per-entity/per-face baseline (το `.dae` είναι το κύριο per-face μονοπάτι). */
      readonly materialBaselineByMesh?: ReadonlyMap<string, Readonly<Record<string, string>>>;
      /** ADR-678 Βήμα 3 — τα αρχεία εικόνων (ξένες υφές) που επέλεξε ο χρήστης δίπλα στο `.dae`. */
      readonly imageFiles: readonly File[];
    }
  | {
      readonly kind: 'obj';
      readonly objText: string;
      readonly mtlText: string;
      /** ADR-678 Βήμα 2 — per-entity/per-face baseline από συνοδό `.nestor.json` (catalog swap). */
      readonly materialBaselineByMesh?: ReadonlyMap<string, Readonly<Record<string, string>>>;
    };

/** ADR-683 Φ3β — τι περιμένει απόφαση του χρήστη μετά το parse (κατάσταση D του §5). */
interface PendingMeshImport {
  readonly records: readonly GltfObjectRecord[];
  readonly file: File;
}

/**
 * Διαλέγει format από την κατάληξη και διαβάζει τα bytes με τον σωστό τρόπο: `.glb` = binary
 * (`arrayBuffer`), `.gltf` = JSON κείμενο, `.obj`/`.mtl` = κείμενο.
 *
 * **Το glTF προηγείται** όταν ο χρήστης επιλέξει και τα δύο: κουβαλά ταυτότητα, υλικά **και**
 * γεωμετρία (άρα ανίχνευση αλλαγής σχήματος), ενώ το OBJ μόνο τα δύο πρώτα.
 */
async function readImportFiles(files: FileList): Promise<ImportPayload | null> {
  const list = Array.from(files);

  const gltf = list.find((f) => /\.(glb|gltf)$/i.test(f.name));
  if (gltf) {
    const binary = /\.glb$/i.test(gltf.name);
    // Το `File` κρατιέται δίπλα στα bytes: αν ο χρήστης εισαγάγει τους unmatched κόμβους, ανεβαίνει
    // **το ίδιο** αρχείο που αναλύθηκε — όχι δεύτερη ανάγνωση που θα μπορούσε να αποκλίνει.
    return {
      kind: 'gltf',
      data: binary ? await gltf.arrayBuffer() : await gltf.text(),
      file: gltf,
      baseline: await readManifestBaseline(list),
      materialBaselineByMesh: await readMaterialBaselineByMesh(list),
    };
  }

  // COLLADA `.dae` (C4D R15, per-face) — XML κείμενο· το ίδιο `.nestor.json` baseline με glTF.
  const dae = list.find((f) => /\.dae$/i.test(f.name));
  if (dae) {
    return {
      kind: 'dae',
      daeText: await dae.text(),
      baseline: await readManifestBaseline(list),
      materialBaselineByMesh: await readMaterialBaselineByMesh(list),
      // ADR-678 Βήμα 3 — οι εικόνες υφών που ήρθαν μαζί (Maxon «Save with Assets»).
      imageFiles: list.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name)),
    };
  }

  const obj = list.find((f) => /\.obj$/i.test(f.name));
  if (!obj) return null;
  const mtl = list.find((f) => /\.mtl$/i.test(f.name));
  return {
    kind: 'obj',
    objText: await obj.text(),
    mtlText: mtl ? await mtl.text() : '',
    // ADR-678 Βήμα 2 — το per-entity baseline είναι name-based, άρα ασφαλές για OBJ (σε αντίθεση με
    // το χρωματικό `baseline` που το OBJ σκόπιμα παραλείπει λόγω colour-space mismatch).
    materialBaselineByMesh: await readMaterialBaselineByMesh(list),
  };
}

/**
 * ADR-683 §7 — διαβάζει το συνοδό `.nestor.json` (αν ο χρήστης το επέλεξε) → baseline υλικών
 * (`όνομα → sRGB hex`) για ανίχνευση repaint. Απόν/μη έγκυρο manifest → `undefined` (no-op:
 * ο import πέφτει στην προ-baseline συμπεριφορά, καμία αποτυχία).
 */
async function readManifestBaseline(
  list: readonly File[],
): Promise<ReadonlyMap<string, string> | undefined> {
  const sidecar = list.find((f) => /\.json$/i.test(f.name));
  if (!sidecar) return undefined;
  const manifest = parseExportManifest(await sidecar.text());
  return manifest ? indexManifestMaterials(manifest) : undefined;
}

/**
 * ADR-678 Βήμα 2 — από το συνοδό `.nestor.json` χτίζει το per-entity/per-face baseline
 * (`meshName → { faceKey → εξαχθέν όνομα υλικού }`) που εντοπίζει catalog→catalog swap. Reuse
 * `indexManifestByMeshName` (ίδιο join key με τον parser). Απόν/παλιό manifest ή manifest χωρίς
 * `materialsByFace` → `undefined` (no-op: ο import πέφτει στο global name-based fallback).
 */
async function readMaterialBaselineByMesh(
  list: readonly File[],
): Promise<ReadonlyMap<string, Readonly<Record<string, string>>> | undefined> {
  const sidecar = list.find((f) => /\.json$/i.test(f.name));
  if (!sidecar) return undefined;
  const manifest = parseExportManifest(await sidecar.text());
  if (!manifest) return undefined;
  const byMesh = new Map<string, Readonly<Record<string, string>>>();
  for (const [meshName, entity] of indexManifestByMeshName(manifest)) {
    if (entity.materialsByFace) byMesh.set(meshName, entity.materialsByFace);
  }
  return byMesh.size > 0 ? byMesh : undefined;
}

export function C4dMaterialImportButton() {
  const { t } = useTranslation('dxf-viewer-shell');
  const levels = useLevels();
  const notifications = useNotifications();
  const iconSizes = useIconSizes();
  const inputRef = useRef<HTMLInputElement>(null);

  // ADR-679 Φ2a — live library υλικά (system + company + project scope) ώστε το round-trip
  // import να αναγνωρίζει ΚΑΙ τα δικά σου υλικά (by id ή ανθρώπινο όνομα), όχι μόνο catalog.
  const { user } = useAuth();
  const companyId = user?.companyId ?? undefined;
  const { materials, save, update, remove } = useMaterialLibrary({
    companyId,
    userId: user?.uid ?? undefined,
    projectId: levels.saveContext?.projectId ?? undefined,
  });
  const resolveKnownId = useMemo(() => buildKnownMaterialResolver(materials), [materials]);

  // ADR-683 Φ3β — οι κόμβοι χωρίς αντιστοίχιση περιμένουν απόφαση του χρήστη. Κρατιούνται σε state
  // (όχι σε ref) γιατί η άφιξή τους ΠΡΕΠΕΙ να ανοίξει το dialog.
  const [pendingImport, setPendingImport] = useState<PendingMeshImport | null>(null);

  const handleFiles = useCallback(async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    let payload: ImportPayload | null;
    try {
      payload = await readImportFiles(files);
    } catch {
      notifications.error(t('c4dMaterialImport.readError'));
      return;
    }
    if (!payload) {
      notifications.warning(t('c4dMaterialImport.noSource'));
      return;
    }

    let result: ImportedAppearanceResult;
    let importableRecords: readonly GltfObjectRecord[] = [];
    try {
      // Ένας πυρήνας, δύο wrappers (ADR-683 §8.1) — η διαφορά είναι μόνο parse + charset.
      if (payload.kind === 'gltf') {
        const gltfResult = await importGltfAppearance(
          levels, payload.data, resolveKnownId, payload.baseline, payload.materialBaselineByMesh,
        );
        result = gltfResult.appearance;
        // ADR-683 Φ3β — μόνο το glTF κουβαλά γεωμετρία, άρα μόνο από εκεί μπορεί να προκύψει
        // νέα οντότητα. Ο OBJ/DAE δρόμος δεν έχει τι να προσφέρει εδώ (μηδέν κορυφές).
        importableRecords = gltfResult.unmatchedRecords.filter(isImportableNode);
      } else if (payload.kind === 'dae') {
        // ADR-678 Φ4/Βήμα 3 — COLLADA per-face: parse → (async) upload ξένων υφών → βαφή. Ο
        // textureImporter injected ώστε ο io wrapper να μένει καθαρός από Firebase (DI).
        // Toast ΜΟΝΟ όταν όντως θα τρέξει upload (companyId + εικόνες): αλλιώς θα έλεγε ψευδώς
        // «ανεβάζω» ενώ ο textureImporter είναι undefined (χωρίς companyId δεν φτιάχνεται υλικό).
        if (companyId && payload.imageFiles.length > 0) notifications.info(t('c4dMaterialImport.uploadingTextures'));
        // Οι υφές που το `.dae` αναφέρει αλλά ο χρήστης δεν επέλεξε (ο C4D γράφει absolute path άλλου
        // δίσκου) — τις μαζεύουμε για actionable warning (Revit «missing assets»).
        let missingTextures: readonly string[] = [];
        const textureImporter: ColladaTextureImporter | undefined = companyId
          ? async (textures) => {
              const { created, missing } = await importForeignTextures(textures, payload.imageFiles, {
                existingMaterials: materials,
                saveMaterial: save,
                updateMaterial: update,
                uploadAlbedo: (file, materialId) =>
                  uploadMaterialTextureMap({ file, companyId, materialId, map: 'albedo' })
                    .then((r) => r.downloadUrl),
                hashFile: sha256HexOfFile,
                deleteMaterial: remove,
              });
              missingTextures = missing;
              return created;
            }
          : undefined;
        result = await importColladaAppearance(
          levels, payload.daeText, resolveKnownId, payload.baseline,
          payload.materialBaselineByMesh, textureImporter,
        );
        if (missingTextures.length > 0) {
          notifications.warning(t('c4dMaterialImport.missingTextures', { files: missingTextures.join(', ') }));
        }
      } else {
        result = importC4dMaterials(levels, payload, resolveKnownId);
      }
    } catch {
      // Κατεστραμμένο/μη έγκυρο glTF ή `.gltf` με εξωτερικά `.bin` που δεν επιλέχθηκαν.
      notifications.error(t('c4dMaterialImport.parseError'));
      return;
    }

    // ⚠️ Η προσφορά εισαγωγής προηγείται **σκόπιμα** των μηνυμάτων βαφής. Ένα αρχείο που περιέχει
    // ΜΟΝΟ νέα γεωμετρία (ο συνεργάτης έφτιαξε τα κάγκελα, δεν άλλαξε κανένα υλικό) έχει
    // `appliedCount === 0` → θα έπεφτε στο early return του «καμία αλλαγή» και ο χρήστης δεν θα
    // έβλεπε ΠΟΤΕ τα αντικείμενά του. Δηλαδή ακριβώς η περίπτωση για την οποία φτιάχτηκε η Φ3β.
    if (payload.kind === 'gltf' && importableRecords.length > 0) {
      setPendingImport({ records: importableRecords, file: payload.file });
      return;
    }

    if (result.appliedCount === 0 && result.finishMemberCount === 0) {
      // Διάκριση: λάθος/κενό αρχείο (κανένα object) vs έγκυρο Nestor αρχείο αλλά ΧΩΡΙΣ αλλαγή
      // υλικού (όλα αρχικά DNA — η βαφή δεν μπήκε στο export ή λείπει το .mtl).
      notifications.warning(t(result.objectCount > 0 ? 'c4dMaterialImport.noChanges' : 'c4dMaterialImport.noMatch'));
      return;
    }
    notifications.success(t('c4dMaterialImport.success', {
      applied: result.appliedCount,
      finish: result.finishMemberCount,
      matched: result.matchedCount,
      unmatched: result.unmatched.length,
    }));
  }, [levels, notifications, t, resolveKnownId, companyId, materials, save, update, remove]);

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
        <Palette className={iconSizes.sm} />
        {t('c4dMaterialImport.button')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,.dae,.obj,.mtl,.json,.png,.jpg,.jpeg,.webp"
        multiple
        hidden
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
      />
      {pendingImport && (
        <ImportedMeshImportDialog
          open
          records={pendingImport.records}
          data={pendingImport.file}
          sourceFileName={pendingImport.file.name}
          onClose={() => setPendingImport(null)}
        />
      )}
    </>
  );
}
