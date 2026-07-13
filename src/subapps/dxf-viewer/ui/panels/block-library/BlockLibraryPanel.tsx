'use client';

/**
 * @module ui/panels/block-library/BlockLibraryPanel
 * @description Το palette της βιβλιοθήκης block («Τα Blocks μου» + η έτοιμη βιβλιοθήκη).
 *
 * Δείχνει ΜΙΑ ενωμένη λίστα (ADR-652 M2/M3): τα blocks του τρέχοντος import, τη μόνιμη
 * βιβλιοθήκη του χρήστη/της εταιρείας, ΚΑΙ την έτοιμη (system/partner) βιβλιοθήκη.
 * Κλικ σε κάρτα → (αν χρειάζεται) κατεβάζει τη γεωμετρία, θέτει την επιλογή στο
 * `block-library-selection-store` και ενεργοποιεί το placement tool.
 *
 * M3 — content browser όπως των μεγάλων (Revit family browser / Figma assets): **αναζήτηση +
 * κατηγορία + chips βιβλιοθήκης**, μέσω του κοινού `LibraryFilterBar` (τον μοιράζεται με το
 * panel των υλικών — όχι δεύτερο φίλτρο). Ενέργειες ανά κάρτα: αποθήκευση (session),
 * δημοσίευση (ιδιωτικό → εταιρεία/έργο, με το νομικό gate), διαγραφή.
 *
 * Container only: ο κύκλος ζωής ζει στο `useBlockLibraryPalette`, η κάρτα στο
 * `BlockLibraryCard`, οι φόρμες στα `BlockSaveToLibraryDialog` / `BlockPromoteDialog`.
 *
 * @see ./hooks/useBlockLibraryPalette.ts (merge + hydrate + save/promote/delete)
 * @see ../shared/library-filter.ts (ο pure κανόνας φιλτραρίσματος)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n';
import { useSelectedBlockName } from '../../../bim/block-library/block-library-selection-store';
import {
  canDeleteBlockEntry,
  canEditBlockEntry,
  canPromoteBlockEntry,
  isBlockNameTaken,
  type BlockPaletteEntry,
} from '../../../bim/block-library/block-palette-entries';
import { BLOCK_CATEGORIES } from '../../../bim/block-library/block-library-types';
import { LibraryFilterBar } from '../shared/LibraryFilterBar';
import {
  EMPTY_LIBRARY_FILTER,
  matchesLibraryFilter,
  type LibraryFilterState,
} from '../shared/library-filter';
import { BlockLibraryCard } from './BlockLibraryCard';
import { BlockSaveToLibraryDialog } from './BlockSaveToLibraryDialog';
import { BlockPromoteDialog } from './BlockPromoteDialog';
import { BlockEditDialog } from './BlockEditDialog';
import {
  useBlockLibraryPalette,
  type BlockEditFormValues,
  type BlockPromoteFormValues,
  type BlockSaveFormValues,
} from './hooks/useBlockLibraryPalette';

const PANEL_DIMENSIONS = { width: 300, height: 560 } as const;
const SSR_FALLBACK_POSITION = { x: 120, y: 120 };

interface BlockLibraryPanelProps {
  isVisible: boolean;
  onClose: () => void;
  /** Επιλογή block → set selection + activate placement tool (wiring στον καλούντα). */
  onSelectBlock: (name: string) => void;
  projectId?: string;
}

export const BlockLibraryPanel: React.FC<BlockLibraryPanelProps> = ({
  isVisible,
  onClose,
  onSelectBlock,
  projectId,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    entries,
    busyKey,
    error,
    selectEntry,
    saveEntry,
    promoteEntry,
    updateEntry,
    deleteEntry,
    canSaveToLibrary,
    userId,
    hasProject,
  } = useBlockLibraryPalette(projectId);

  const selectedName = useSelectedBlockName();
  const [filter, setFilter] = useState<LibraryFilterState>(EMPTY_LIBRARY_FILTER);
  const [saveTarget, setSaveTarget] = useState<BlockPaletteEntry | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<BlockPaletteEntry | null>(null);
  const [editTarget, setEditTarget] = useState<BlockPaletteEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlockPaletteEntry | null>(null);

  /**
   * Ο έλεγχος μοναδικότητας ονόματος τρέχει πάνω στη ΓΕΜΑΤΗ λίστα (`entries`), ΟΧΙ στη
   * φιλτραρισμένη: ένα φίλτρο δεν εξαφανίζει τη σύγκρουση ταυτότητας — απλώς την κρύβει.
   */
  const makeNameTakenCheck = useCallback(
    (exceptKey: string) => (name: string) => isBlockNameTaken(entries, name, exceptKey),
    [entries],
  );

  /** Seeded blocks έχουν i18n ετικέτα (ADR-415 catalog keys)· ξένα blocks το raw όνομά τους. */
  const displayNameOf = useCallback(
    (entry: BlockPaletteEntry): string => (entry.labelKey ? t(entry.labelKey) : entry.name),
    [t],
  );

  /** Chips ΜΟΝΟ για τις βιβλιοθήκες που πραγματικά υπάρχουν στη λίστα (Revit browser semantics). */
  const scopeOptions = useMemo(() => {
    const present = new Set(entries.map((e) => e.scope));
    return [...present].map((scope) => ({
      value: scope,
      label: t(`blockLibrary.scopes.${scope}`),
    }));
  }, [entries, t]);

  const categoryOptions = useMemo(
    () => BLOCK_CATEGORIES.map((c) => ({ value: c, label: t(`blockLibrary.categories.${c}`) })),
    [t],
  );

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) =>
        matchesLibraryFilter(
          {
            names: [entry.name, entry.labelKey ? t(entry.labelKey) : null],
            category: entry.category,
            scope: entry.scope,
          },
          filter,
        ),
      ),
    [entries, filter, t],
  );

  const handleSelect = useCallback(
    async (entry: BlockPaletteEntry) => {
      const name = await selectEntry(entry);
      if (name) onSelectBlock(name);
    },
    [selectEntry, onSelectBlock],
  );

  const handleSave = useCallback(
    async (values: BlockSaveFormValues) => {
      if (!saveTarget) return;
      if (await saveEntry(saveTarget, values)) setSaveTarget(null);
    },
    [saveTarget, saveEntry],
  );

  const handlePromote = useCallback(
    async (values: BlockPromoteFormValues) => {
      if (!promoteTarget) return;
      if (await promoteEntry(promoteTarget, values)) setPromoteTarget(null);
    },
    [promoteTarget, promoteEntry],
  );

  const handleEdit = useCallback(
    async (values: BlockEditFormValues) => {
      if (!editTarget) return;
      if (await updateEntry(editTarget, values)) setEditTarget(null);
    },
    [editTarget, updateEntry],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (await deleteEntry(deleteTarget)) setDeleteTarget(null);
  }, [deleteTarget, deleteEntry]);

  if (!isVisible) return null;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      className="flex w-[300px] max-h-[560px] flex-col"
    >
      <FloatingPanel.Header title={t('blockLibrary.title')} icon={<Boxes />} />
      <FloatingPanel.Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex-shrink-0 border-b border-border pb-2 text-xs text-muted-foreground">
          {t('blockLibrary.hint')}
        </p>

        {entries.length > 0 && (
          <LibraryFilterBar
            value={filter}
            onChange={setFilter}
            searchPlaceholder={t('blockLibrary.filter.searchPlaceholder')}
            categories={categoryOptions}
            allCategoriesLabel={t('blockLibrary.filter.allCategories')}
            scopes={scopeOptions}
            allScopesLabel={t('blockLibrary.filter.allScopes')}
            ariaLabel={t('blockLibrary.filter.ariaLabel')}
          />
        )}

        {error && (
          <p role="alert" className="pt-2 text-xs text-destructive">
            {t(`blockLibrary.errors.${error}`)}
          </p>
        )}

        {visibleEntries.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {entries.length === 0 ? t('blockLibrary.empty') : t('blockLibrary.filter.noMatch')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-auto py-2">
            {visibleEntries.map((entry) => (
              <li key={entry.key}>
                <BlockLibraryCard
                  entry={entry}
                  displayName={displayNameOf(entry)}
                  isActive={entry.name === selectedName}
                  isBusy={busyKey === entry.key}
                  canSaveToLibrary={canSaveToLibrary}
                  canPromote={canPromoteBlockEntry(entry, userId)}
                  canEdit={canEditBlockEntry(entry, userId)}
                  canDelete={canDeleteBlockEntry(entry, userId)}
                  onSelect={handleSelect}
                  onSave={setSaveTarget}
                  onPromote={setPromoteTarget}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              </li>
            ))}
          </ul>
        )}
      </FloatingPanel.Content>

      <BlockSaveToLibraryDialog
        open={saveTarget !== null}
        blockName={saveTarget?.name ?? ''}
        saving={saveTarget !== null && busyKey === saveTarget.key}
        isNameTaken={makeNameTakenCheck(saveTarget?.key ?? '')}
        onSave={handleSave}
        onCancel={() => setSaveTarget(null)}
      />

      <BlockEditDialog
        open={editTarget !== null}
        item={editTarget?.item ?? null}
        saving={editTarget !== null && busyKey === editTarget.key}
        isNameTaken={makeNameTakenCheck(editTarget?.key ?? '')}
        onSubmit={handleEdit}
        onCancel={() => setEditTarget(null)}
      />

      <BlockPromoteDialog
        open={promoteTarget !== null}
        blockName={promoteTarget ? displayNameOf(promoteTarget) : ''}
        license={promoteTarget?.item?.license ?? null}
        hasProject={hasProject}
        saving={promoteTarget !== null && busyKey === promoteTarget.key}
        onPromote={handlePromote}
        onCancel={() => setPromoteTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('blockLibrary.delete.title')}
        description={t('blockLibrary.delete.description', {
          name: deleteTarget ? displayNameOf(deleteTarget) : '',
        })}
        confirmText={t('blockLibrary.delete.action')}
        variant="destructive"
        loading={deleteTarget !== null && busyKey === deleteTarget.key}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </FloatingPanel>
  );
};
