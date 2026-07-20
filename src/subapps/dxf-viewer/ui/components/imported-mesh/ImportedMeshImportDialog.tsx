'use client';

/**
 * ImportedMeshImportDialog — ADR-683 Φ3β: ο χρήστης **αποφασίζει** τι μπαίνει στην κάτοψη.
 *
 * **Γιατί dialog και όχι αυτόματη εισαγωγή:** το `.glb` του συνεργάτη μπορεί να περιέχει βοηθητική
 * γεωμετρία (κάμερες-proxy, έπιπλα σκηνογραφίας, δοκιμαστικά αντίγραφα) που δεν έχει καμία θέση στο
 * έργο. Σιωπηλή εισαγωγή όλων = ο χρήστης καθαρίζει ξένα σκουπίδια από την κάτοψή του. Είναι και η
 * πρακτική των μεγάλων: το Revit «Link/Import» δείχνει **πάντα** τι θα εισαχθεί πριν το κάνει.
 *
 * **Όλα προεπιλεγμένα**: η κοινή περίπτωση είναι «ναι, φέρ' τα» — ο χρήστης αφαιρεί εξαιρέσεις,
 * δεν χτίζει τη λίστα από το μηδέν.
 *
 * Τα Firestore hooks του πλαισίου τοποθέτησης ζουν **εδώ**, όχι στο κουμπί: το dialog προσαρτάται
 * μόνο όταν υπάρχουν πράγματι κόμβοι προς εισαγωγή, οπότε δεν πληρώνεται τίποτα στη συνήθη ροή.
 *
 * @see ./useImportedMeshPlacementContext — το πλαίσιο συντεταγμένων του ορόφου υποδοχής
 * @see ../../../io/mesh3d-roundtrip/import-gltf-meshes — η πράξη (upload + οντότητες + ΕΝΑ undo)
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Boxes } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevels } from '../../../systems/levels';
import { useNotifications } from '../../../../../providers/NotificationProvider';
import type { GltfObjectRecord } from '../../../io/mesh3d-roundtrip/gltf-scene-parse';
import { importGltfMeshes, isImportableNode } from '../../../io/mesh3d-roundtrip/import-gltf-meshes';
import { useImportedMeshPlacementContext } from './useImportedMeshPlacementContext';

const M_TO_MM = 1000;

export interface ImportedMeshImportDialogProps {
  readonly open: boolean;
  /** Οι κόμβοι χωρίς αντιστοίχιση, όπως τους επέστρεψε το parse. */
  readonly records: readonly GltfObjectRecord[];
  /** Τα bytes του ίδιου `.glb` που αναλύθηκε. */
  readonly data: ArrayBuffer | Blob;
  readonly sourceFileName: string;
  readonly onClose: () => void;
}

/** «2000 × 100 × 900 mm» — από το ήδη μετρημένο `sizeM` (tuple m), χωρίς νέα γεωμετρία. */
function formatSize(record: GltfObjectRecord): string {
  const size = record.fingerprint?.signature.sizeM;
  if (!size) return '—';
  const [x, y, z] = size;
  return `${Math.round(x * M_TO_MM)} × ${Math.round(z * M_TO_MM)} × ${Math.round(y * M_TO_MM)} mm`;
}

export function ImportedMeshImportDialog({
  open,
  records,
  data,
  sourceFileName,
  onClose,
}: ImportedMeshImportDialogProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const levels = useLevels();
  const notifications = useNotifications();
  const { user } = useAuth();
  const { placement, layerId, floorId } = useImportedMeshPlacementContext();

  // Μόνο οι κόμβοι με σχήμα ΚΑΙ θέση είναι εισαγώγιμοι· οι υπόλοιποι δεν εμφανίζονται καν, γιατί
  // μια επιλογή που δεν μπορεί να τηρηθεί είναι χειρότερη από απούσα.
  const importable = useMemo(() => records.filter(isImportableNode), [records]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(importable.map((r) => r.objectName)),
  );
  const [busy, setBusy] = useState(false);

  const toggle = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === importable.length ? new Set() : new Set(importable.map((r) => r.objectName)),
    );
  }, [importable]);

  const projectId = levels.saveContext?.projectId ?? '';
  const companyId = user?.companyId ?? '';

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!projectId || !companyId || !layerId) {
      notifications.warning(t('c4dMaterialImport.importMeshes.missingProject'));
      return;
    }

    setBusy(true);
    try {
      const chosen = importable.filter((r) => selected.has(r.objectName));
      const result = await importGltfMeshes(levels, {
        records: chosen,
        data,
        sourceFileName,
        companyId,
        projectId,
        placement,
        layerId,
        floorId,
      });

      notifications.success(t('c4dMaterialImport.importMeshes.success', { count: result.created.length }));
      // Τα παραλειφθέντα ΑΝΑΦΕΡΟΝΤΑΙ — ποτέ σιωπηλή απώλεια (N.7.2: όχι silent cap).
      if (result.skipped.length > 0) {
        notifications.warning(t('c4dMaterialImport.importMeshes.skipped', { count: result.skipped.length }));
      }
      onClose();
    } catch {
      notifications.error(t('c4dMaterialImport.importMeshes.uploadError'));
    } finally {
      setBusy(false);
    }
  }, [
    projectId, companyId, layerId, floorId, importable, selected, levels, data,
    sourceFileName, placement, notifications, t, onClose,
  ]);

  const allSelected = selected.size === importable.length && importable.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('c4dMaterialImport.importMeshes.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t('c4dMaterialImport.importMeshes.description')}
          </p>
        </DialogHeader>

        <label className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground cursor-pointer">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label={t('c4dMaterialImport.importMeshes.selectAll')}
          />
          <span>{t('c4dMaterialImport.importMeshes.selectAll')}</span>
        </label>

        <ul className="flex flex-col gap-1 py-1 max-h-64 overflow-y-auto">
          {importable.map((record) => (
            <li key={record.objectName}>
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent/50">
                <Checkbox
                  checked={selected.has(record.objectName)}
                  onCheckedChange={() => toggle(record.objectName)}
                  aria-label={record.objectName}
                />
                <span className="flex-1 truncate">{record.objectName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatSize(record)}</span>
              </label>
            </li>
          ))}
        </ul>

        <p className="px-2 text-xs text-muted-foreground">
          {t('c4dMaterialImport.importMeshes.note')}
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {t('c4dMaterialImport.importMeshes.cancel')}
          </button>
          <button
            type="button"
            onClick={() => { void handleConfirm(); }}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Boxes size={13} />
            {busy
              ? t('c4dMaterialImport.importMeshes.uploading')
              : `${t('c4dMaterialImport.importMeshes.confirm')} (${selected.size})`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
