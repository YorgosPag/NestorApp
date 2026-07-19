'use client';

/**
 * C4dMaterialImportButton — ADR-678 Φ1 UI. Κουμπί «Εισαγωγή υλικών από C4D»: ο χρήστης επιλέγει
 * το `.obj` (+ συνοδευτικό `.mtl`) που εξήγαγε από το Cinema 4D, και τα χρώματα/υλικά που έβαλε
 * «κατεβαίνουν» πίσω στα ίδια BIM στοιχεία (name-based, μέσω `importC4dMaterials`).
 *
 * Αποκλειστικός δρόμος (ΟΧΙ ο wizard κάτοψης, που σβήνει τον όροφο): εδώ η γεωμετρία μένει
 * ανέγγιχτη — μόνο η εμφάνιση (`faceAppearance['*']`) ενημερώνεται, με ΕΝΑ undo.
 *
 * @see ../../io/mesh3d-material-import/import-c4d-materials — orchestrator
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import { useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../systems/levels';
import { useNotifications } from '../../../../providers/NotificationProvider';
import { useMaterialLibrary } from '../panels/materials/hooks/useMaterialLibrary';
import { importC4dMaterials } from '../../io/mesh3d-material-import/import-c4d-materials';
import { buildKnownMaterialResolver } from '../../io/mesh3d-material-import/known-import-materials';

/** Βρίσκει το `.obj` (υποχρεωτικό) και το `.mtl` (προαιρετικό) μέσα στα επιλεγμένα αρχεία. */
async function readObjMtl(files: FileList): Promise<{ objText: string; mtlText: string } | null> {
  const list = Array.from(files);
  const obj = list.find((f) => f.name.toLowerCase().endsWith('.obj'));
  if (!obj) return null;
  const mtl = list.find((f) => f.name.toLowerCase().endsWith('.mtl'));
  return { objText: await obj.text(), mtlText: mtl ? await mtl.text() : '' };
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

  const handleFiles = useCallback(async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    let payload: { objText: string; mtlText: string } | null;
    try {
      payload = await readObjMtl(files);
    } catch {
      notifications.error(t('c4dMaterialImport.readError'));
      return;
    }
    if (!payload) {
      notifications.warning(t('c4dMaterialImport.noObj'));
      return;
    }
    const result = importC4dMaterials(levels, payload, resolveKnownId);
    if (result.appliedCount === 0 && result.finishMemberCount === 0) {
      // Διάκριση: λάθος/κενό αρχείο (κανένα object) vs έγκυρο Nestor OBJ αλλά ΧΩΡΙΣ αλλαγή
      // υλικού (όλα αρχικά DNA — το C4D paint δεν μπήκε στο export ή λείπει το .mtl).
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
        accept=".obj,.mtl"
        multiple
        hidden
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
      />
    </>
  );
}
