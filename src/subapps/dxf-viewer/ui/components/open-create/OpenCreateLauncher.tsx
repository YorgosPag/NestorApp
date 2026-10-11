'use client';

/**
 * OpenCreateLauncher — το ΕΝΑ κουμπί «Άνοιγμα / Δημιουργία» της Παλέτας σχεδίασης (ADR-914).
 *
 * Αντικαθιστά τρία κουμπιά («Εισαγωγή Κάτοψης», «Φόρτωση από αποθήκη», «Εισαγωγή 3Δ αρχείου») και
 * προσθέτει ό,τι έλειπε: κενό σχέδιο. Ο host κρατά ό,τι πρέπει να ζει ΑΦΟΥ κλείσει το παράθυρο —
 * τον οδηγό κάτοψης (ένα mount, τρία modes) και τον επιλογέα 3Δ αρχείων.
 *
 * Τα pipelines των τριών παλιών ενεργειών είναι αυτούσια· άλλαξε μόνο το σημείο εισόδου τους.
 *
 * @module subapps/dxf-viewer/ui/components/open-create/OpenCreateLauncher
 */

import React, { useCallback, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  FloorplanImportWizard,
  type FloorplanWizardMode,
  type WizardCompleteMeta,
} from '@/features/floorplan-import';
import { OpenCreateDialog } from './OpenCreateDialog';
import type { OpenCreateActionKind } from './open-create-cards';
import { useMesh3dImport } from './useMesh3dImport';
import { useOpenCreateActions, type CreatedLevelRef } from './useOpenCreateActions';

interface OpenCreateLauncherProps {
  /**
   * Η ολοκλήρωση του οδηγού εισαγωγής (SSoT: `useFloorplanImportComplete`). Απόν ⇒ ο viewer δεν
   * παραλαμβάνει εισαγόμενες σκηνές και η κάρτα «Κάτοψη DXF / PDF» δεν προσφέρεται.
   */
  readonly onImportComplete?: (file: File, meta: WizardCompleteMeta) => void | Promise<void>;
  /** Το πρόχειρο γεννήθηκε — ο host ανοίγει άμεση μετονομασία. */
  readonly onDraftCreated?: (level: CreatedLevelRef) => void;
}

/** Ποιο mode του οδηγού ανοίγει κάθε κάρτα που περνά από τον οδηγό. */
const WIZARD_MODE_BY_ACTION: Partial<Record<OpenCreateActionKind, FloorplanWizardMode>> = {
  floorplanFor: 'create',
  fromStorage: 'load',
  importFloorplan: 'import',
};

export function OpenCreateLauncher({ onImportComplete, onDraftCreated }: OpenCreateLauncherProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const iconSizes = useIconSizes();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Το mode μένει και μετά το κλείσιμο, ώστε ο τίτλος να μην αλλάζει όσο ο οδηγός σβήνει.
  const [wizard, setWizard] = useState<{ open: boolean; mode: FloorplanWizardMode }>({
    open: false,
    mode: 'import',
  });

  const mesh3d = useMesh3dImport();
  const actions = useOpenCreateActions({
    canImportFloorplan: !!onImportComplete,
    onDraftCreated,
  });

  const closeWizard = useCallback(() => setWizard((prev) => ({ ...prev, open: false })), []);

  const handleAction = useCallback(
    (kind: OpenCreateActionKind) => {
      setDialogOpen(false);
      const wizardMode = WIZARD_MODE_BY_ACTION[kind];
      if (wizardMode) {
        setWizard({ open: true, mode: wizardMode });
      } else if (kind === 'importMesh3d') {
        // Μέσα στη χειρονομία του χρήστη: ο browser ανοίγει επιλογέα αρχείων μόνο από κλικ.
        mesh3d.openPicker();
      } else {
        void actions.createDraft();
      }
    },
    [mesh3d, actions],
  );

  const handleImportComplete = useCallback(
    (file: File, meta: WizardCompleteMeta) => {
      closeWizard();
      return onImportComplete?.(file, meta);
    },
    [closeWizard, onImportComplete],
  );

  return (
    <>
      <Button variant="default" className="w-full" onClick={() => setDialogOpen(true)}>
        <FolderPlus className={iconSizes.sm} />
        {t('panels.openCreate.button')}
      </Button>

      <OpenCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        availability={actions.availability}
        onAction={handleAction}
      />

      <FloorplanImportWizard
        isOpen={wizard.open}
        onClose={closeWizard}
        mode={wizard.mode}
        onComplete={handleImportComplete}
        onLoad={actions.loadFromStorage}
        onCreate={actions.createForSelection}
      />

      {mesh3d.host}
    </>
  );
}
