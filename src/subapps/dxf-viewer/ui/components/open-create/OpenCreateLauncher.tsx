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

import React, { useCallback, useRef, useState } from 'react';
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
  const actions = useOpenCreateActions({ canImportFloorplan: !!onImportComplete });
  const [creatingDraft, setCreatingDraft] = useState(false);

  const closeWizard = useCallback(() => setWizard((prev) => ({ ...prev, open: false })), []);

  // Όταν το παράθυρο κλείνει ΕΠΕΙΔΗ επιλέχθηκε ενέργεια, η εστίαση ανήκει σε ό,τι ανοίγει εκείνη
  // (το πεδίο μετονομασίας του νέου πρόχειρου, ο οδηγός) — όχι πίσω στο κουμπί. Με Esc/✕ η
  // εστίαση γυρίζει κανονικά στο κουμπί (προεπιλογή Radix).
  const closedByActionRef = useRef(false);
  const closeForAction = useCallback(() => {
    closedByActionRef.current = true;
    setDialogOpen(false);
  }, []);
  // Το πρόχειρο που περιμένει να ονομαστεί μόλις το παράθυρο ΑΦΗΣΕΙ την εστίαση.
  const draftAwaitingNameRef = useRef<CreatedLevelRef | null>(null);
  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!closedByActionRef.current) return;
      closedByActionRef.current = false;
      event.preventDefault();
      // 🔑 Η μετονομασία ανοίγει ΕΔΩ, όχι μαζί με το κλείσιμο (μετρημένο σε Chrome 2026-10-11): όσο
      // το παράθυρο είναι προσαρτημένο, η παγίδα εστίασης του Radix παίρνει πίσω την εστίαση από
      // το πεδίο που μόλις εμφανίστηκε, το πεδίο χάνει την εστίαση και η μετονομασία κλείνει πριν
      // ο άνθρωπος πληκτρολογήσει. Το `onCloseAutoFocus` είναι η στιγμή που το Radix ρωτά «πού
      // πάει η εστίαση τώρα;» — και η απάντηση είναι το πεδίο.
      const draft = draftAwaitingNameRef.current;
      draftAwaitingNameRef.current = null;
      if (draft) onDraftCreated?.(draft);
    },
    [onDraftCreated],
  );

  // Το πρόχειρο γεννιέται με το παράθυρο ΑΝΟΙΧΤΟ: ό,τι πληκτρολογήσει ο άνθρωπος όσο απαντά ο
  // διακομιστής μένει μέσα στο παράθυρο, δεν πάει στις συντομεύσεις του καμβά (ADR-914 §2.9).
  const createDraft = useCallback(async () => {
    setCreatingDraft(true);
    try {
      const draft = await actions.createDraft();
      if (!draft) return;
      draftAwaitingNameRef.current = draft;
      closeForAction();
    } finally {
      setCreatingDraft(false);
    }
  }, [actions, closeForAction]);

  const handleAction = useCallback(
    (kind: OpenCreateActionKind) => {
      const wizardMode = WIZARD_MODE_BY_ACTION[kind];
      if (wizardMode) {
        closeForAction();
        setWizard({ open: true, mode: wizardMode });
      } else if (kind === 'importMesh3d') {
        closeForAction();
        // Μέσα στη χειρονομία του χρήστη: ο browser ανοίγει επιλογέα αρχείων μόνο από κλικ.
        mesh3d.openPicker();
      } else {
        void createDraft();
      }
    },
    [mesh3d, closeForAction, createDraft],
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
        busy={creatingDraft}
        onCloseAutoFocus={handleCloseAutoFocus}
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
