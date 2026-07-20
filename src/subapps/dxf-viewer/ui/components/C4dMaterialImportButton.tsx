'use client';

/**
 * C4dMaterialImportButton — ADR-678 Φ1 UI · **ADR-683 Φ2-UI (glTF/GLB)**. Κουμπί «Εισαγωγή υλικών
 * από 3Δ αρχείο»: ο χρήστης επιλέγει ό,τι του γύρισε ο συνεργάτης — `.glb`/`.gltf` (σύγχρονος
 * παραλήπτης) ή `.obj` + `.mtl` (legacy C4D R15) — και τα χρώματα/υλικά «κατεβαίνουν» πίσω στα
 * ίδια BIM στοιχεία (name-based).
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
import { buildKnownMaterialResolver } from '../../io/mesh3d-material-import/known-import-materials';
import type { GltfObjectRecord } from '../../io/mesh3d-roundtrip/gltf-scene-parse';
import { isImportableNode } from '../../io/mesh3d-roundtrip/import-gltf-meshes';
import { ImportedMeshImportDialog } from './imported-mesh/ImportedMeshImportDialog';

/** Τι βρέθηκε στην επιλογή του χρήστη — το format καθορίζει και τον τρόπο ανάγνωσης. */
type ImportPayload =
  | { readonly kind: 'gltf'; readonly data: ArrayBuffer | string; readonly file: File }
  | { readonly kind: 'obj'; readonly objText: string; readonly mtlText: string };

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
    return { kind: 'gltf', data: binary ? await gltf.arrayBuffer() : await gltf.text(), file: gltf };
  }

  const obj = list.find((f) => /\.obj$/i.test(f.name));
  if (!obj) return null;
  const mtl = list.find((f) => /\.mtl$/i.test(f.name));
  return { kind: 'obj', objText: await obj.text(), mtlText: mtl ? await mtl.text() : '' };
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
  const { materials } = useMaterialLibrary({
    companyId: user?.companyId ?? undefined,
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
        const gltfResult = await importGltfAppearance(levels, payload.data, resolveKnownId);
        result = gltfResult.appearance;
        // ADR-683 Φ3β — μόνο το glTF κουβαλά γεωμετρία, άρα μόνο από εκεί μπορεί να προκύψει
        // νέα οντότητα. Ο OBJ δρόμος δεν έχει τι να προσφέρει εδώ (μηδέν κορυφές).
        importableRecords = gltfResult.unmatchedRecords.filter(isImportableNode);
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
  }, [levels, notifications, t, resolveKnownId]);

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
        <Palette className={iconSizes.sm} />
        {t('c4dMaterialImport.button')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,.obj,.mtl"
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
