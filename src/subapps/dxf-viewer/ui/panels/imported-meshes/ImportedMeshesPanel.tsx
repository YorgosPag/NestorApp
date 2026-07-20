'use client';

/**
 * ImportedMeshesPanel — ADR-683 **Φ3.1γ**: το αριστερό tab «Εισαγόμενα».
 *
 * **Η ορατή απουσία.** Η Φ3.1α αποφάσισε ρητά ότι ένα ανανάθετο πλέγμα **δεν** παράγει γραμμή BOQ
 * (μια μηδενική γραμμή μοιάζει με μετρημένο κόστος μηδέν). Το τίμημα αυτής της απόφασης είναι ότι
 * τα ανανάθετα γίνονται **αόρατα** — και μέχρι τη Φ3.1γ ο μόνος τόπος που ανέφερε το πλήθος τους
 * ήταν το ίδιο το dialog ανάθεσης, δηλαδή μόνο αφού ο χρήστης είχε ήδη βρει ένα μόνος του. Αυτό
 * το πάνελ κλείνει τον κύκλο: το πλήθος φαίνεται **πριν** ανοίξει τίποτα.
 *
 * Ροή: γραμμή → επιλογή οντότητας (η κάτοψη πάει πάνω της) → άνοιγμα του dialog ανάθεσης. Δύο
 * store κλήσεις, καμία νέα κατάσταση εδώ — το πάνελ είναι **αναγνώστης**, ο κύκλος ζωής της
 * ανάθεσης παραμένει στον `ImportedMeshBoqHost` (ένας ιδιοκτήτης, N.7.2 §7).
 *
 * ADR-040: zero canvas, zero high-frequency store — διαβάζει το `scene` prop όπως τα αδέλφια tabs.
 *
 * @see ../../../bim/entities/imported-mesh/imported-mesh-panel-rows — η ομαδοποίηση (SSoT σειράς/μετρήματος)
 * @see ../../../app/ImportedMeshBoqHost — ο ιδιοκτήτης της ανάθεσης
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  groupImportedMeshesByUpload,
  totalUnassigned,
} from '../../../bim/entities/imported-mesh/imported-mesh-panel-rows';
import { SelectedEntitiesStore } from '../../../systems/selection/SelectedEntitiesStore';
import { ImportedMeshBoqDialogStore } from '../../../stores/ImportedMeshBoqDialogStore';
import type { SceneModel } from '../../../types/scene';
import { ImportedMeshUploadSection } from './ImportedMeshUploadSection';

export interface ImportedMeshesPanelProps {
  readonly scene: SceneModel | null;
}

/** Καμία εισαγωγή σε αυτόν τον όροφο — κατάσταση, όχι σφάλμα. */
function ImportedMeshesEmptyState() {
  const { t } = useTranslation('dxf-viewer-panels');
  const colors = useSemanticColors();

  return (
    <section className="p-3">
      <p className={`text-center text-xs ${colors.text.muted}`}>
        {t('panels.importedMeshes.empty')}
      </p>
    </section>
  );
}

/** Ο τίτλος με το πλήθος εκκρεμοτήτων — ο λόγος ύπαρξης του πάνελ. */
function ImportedMeshesHeader({ pending }: { readonly pending: number }) {
  const { t } = useTranslation('dxf-viewer-panels');
  const colors = useSemanticColors();

  return (
    <header className="flex items-center justify-between gap-2 px-1">
      <h3 className={`text-xs font-semibold ${colors.text.primary}`}>
        {t('panels.importedMeshes.title')}
      </h3>
      {pending > 0 && (
        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">
          {t('panels.importedMeshes.unassignedBadge', { count: pending })}
        </span>
      )}
    </header>
  );
}

export function ImportedMeshesPanel({ scene }: ImportedMeshesPanelProps) {
  const groups = useMemo(() => groupImportedMeshesByUpload(scene?.entities ?? []), [scene?.entities]);
  const pending = totalUnassigned(groups);

  /**
   * Επιλογή **πριν** το άνοιγμα: ο χρήστης πρέπει να βλέπει στην κάτοψη ποιο αντικείμενο
   * κοστολογεί. Το store κρατά καρφωμένο το `entityId` όσο το dialog είναι ανοιχτό, οπότε η
   * σειρά είναι ασφαλής και δεν μπορεί να γραφτεί ανάθεση σε άλλο πλέγμα.
   */
  const handleSelect = useCallback((entityId: string) => {
    SelectedEntitiesStore.selectEntity({ id: entityId, type: 'dxf-entity' });
    ImportedMeshBoqDialogStore.open(entityId);
  }, []);

  if (groups.length === 0) return <ImportedMeshesEmptyState />;

  return (
    <section className="flex flex-col gap-3 p-2">
      <ImportedMeshesHeader pending={pending} />

      {groups.map((group) => (
        <ImportedMeshUploadSection key={group.uploadId} group={group} onSelect={handleSelect} />
      ))}
    </section>
  );
}
