'use client';

/**
 * ADR-745 Φ3β — «Σύνδεση Πινακίδας» ως **modeless palette**.
 *
 * Κέλυφος-δίδυμο του {@link ./ExternalReferencesPalette} (ADR-736): ίδιο `FloatingPanel`, ίδιο
 * πρωτόκολλο εστίασης/ESC, ίδια μόνιμη γεωμετρία. Η ομοιότητα είναι **σκόπιμη** — δύο παλέτες
 * του ίδιου εργαλείου που συμπεριφέρονται διαφορετικά είναι σφάλμα σχεδίασης, όχι ποικιλία.
 *
 * ⚠️ **Καμία `pushModalKeyboardScope()`** (ADR-711): ο καμβάς κρατά τους accelerators του ενώ η
 * παλέτα είναι ανοιχτή.
 *
 * 🔴 **Καμία εγγραφή σε αυτό το αρχείο.** Η παλέτα διαβάζει και δείχνει· η βάση αλλάζει **μόνο**
 * από ρητό κλικ έγκρισης (§5.1).
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { FileSignature } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloatingPanel } from '@/components/ui/floating';
import type { TitleBlockReading } from '@/types/title-block-reading';
import { TitleBlockBindingPaletteStore } from '../../stores/TitleBlockBindingPaletteStore';
import { ESC_PRIORITY, useEscapeHandler } from '../../systems/escape-bus';
import { PANEL_ANCHORING, PanelPositionCalculator } from '../../config/panel-tokens';
import { TitleBlockProposalList } from './title-block-binding/TitleBlockProposalList';
import { useTitleBlockProposals } from './title-block-binding/useTitleBlockProposals';

const PALETTE_DOM_ID = 'dxf-title-block-binding-palette';

/** Σταθερή αναφορά: νέος πίνακας ανά απόδοση θα ξανάφτιαχνε το `subject` κάθε γραμμής, και
 *  μαζί του το `prefill` που είναι **εξάρτηση effect** μέσα στη φόρμα επαφής. */
const EMPTY_READINGS: readonly TitleBlockReading[] = [];

/** Σταθερή για πάντα: αλλαγή = «ξέχασε τη θέση όλων των χρηστών». */
const PALETTE_PERSISTENCE_KEY = 'dxf.title-block-binding';

/** Στενή στήλη με κατακόρυφη λίστα — χωρά τα 7 συμπληρωμένα πεδία μιας πινακίδας χωρίς κύλιση. */
const PALETTE_SIZE = { width: 460, height: 560 } as const;
const PALETTE_MIN_SIZE = { width: 340, height: 260 } as const;

function isFocusInsidePalette(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById(PALETTE_DOM_ID);
  const active = document.activeElement;
  if (!root || !active) return false;
  return root.contains(active);
}

interface Props {
  readonly levelId: string | null;
  readonly projectId?: string;
  /**
   * 🔴 **Μηδενίσιμο εκ σχεδιασμού — ΠΟΤΕ `?? ''`** (ADR-745 §Γ2).
   *
   * Το `fileRecordId` είναι **προαιρετικό, μηδενίσιμο και φτάνει ΑΡΓΟΤΕΡΑ** από την πρώτη
   * απόδοση (`dxf-import-save-context.ts:34`, `useViewportAutoFit.ts:93` «*immune to the
   * cold-load fileRecordId race*», `bim-floor-scope.ts:210` «**VOLATILE**»). Είναι μέρος του
   * ντετερμινιστικού κλειδιού: με κενή τιμή το επόμενο φόρτωμα δεν ξαναβρίσκει τη σύνδεση και
   * το δεύτερο κλικ φτιάχνει **δεύτερο έγγραφο**. Γι' αυτό το κουμπί απενεργοποιείται **με
   * ορατό μήνυμα** αντί να ανεχτεί κενό.
   */
  readonly fileRecordId: string | null;
}

export const TitleBlockBindingPalette: React.FC<Props> = ({ levelId, projectId, fileRecordId }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const { isOpen } = useSyncExternalStore(
    TitleBlockBindingPaletteStore.subscribe,
    TitleBlockBindingPaletteStore.getSnapshot,
    TitleBlockBindingPaletteStore.getSnapshot,
  );

  const state = useTitleBlockProposals({ levelId, projectId, enabled: isOpen });

  const handleClose = useCallback((): void => {
    TitleBlockBindingPaletteStore.close();
  }, []);

  useEscapeHandler(
    isOpen
      ? {
          id: 'title-block-binding-palette',
          priority: ESC_PRIORITY.FOCUSED_PALETTE,
          canHandle: isFocusInsidePalette,
          handle: (): boolean => {
            TitleBlockBindingPaletteStore.close();
            return true;
          },
        }
      : null,
  );

  const getClientPosition = useCallback(
    () => PanelPositionCalculator.getTopRightPosition(PALETTE_SIZE.width),
    [],
  );
  const draggableOptions = useMemo(() => ({ getClientPosition }), [getClientPosition]);

  // Κλειστή ⇒ τίποτα στο DOM και **καμία ανάγνωση της βάσης** (το `enabled` το φράζει).
  if (!isOpen) return null;

  const candidate = state.scan?.candidates.find((c) => c.layerId === state.selectedLayerId);

  return (
    <FloatingPanel
      id={PALETTE_DOM_ID}
      data-testid={PALETTE_DOM_ID}
      resizable
      persistenceKey={PALETTE_PERSISTENCE_KEY}
      dimensions={PALETTE_SIZE}
      minSize={PALETTE_MIN_SIZE}
      defaultPosition={{
        x: PANEL_ANCHORING.OFFSETS.VIEWPORT_MARGIN,
        y: PANEL_ANCHORING.FALLBACKS.TOOLBAR_BOTTOM,
      }}
      draggableOptions={draggableOptions}
      onClose={handleClose}
    >
      <FloatingPanel.Header title={t('titleBlockBinding.title')} icon={<FileSignature />} />
      <FloatingPanel.Content>
        <section className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-muted-foreground">
            {t('titleBlockBinding.description')}
          </p>

          {state.loading ? (
            <p className="text-sm text-muted-foreground">{t('titleBlockBinding.loading')}</p>
          ) : null}

          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          {!state.loading && candidate ? (
            <header className="flex flex-col gap-0.5 border-b border-border pb-2">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('titleBlockBinding.layerLabel')}
              </span>
              <span className="text-sm font-medium text-foreground">{candidate.layerName}</span>
              <span className="text-[11px] text-muted-foreground">
                {t('titleBlockBinding.summary', {
                  count: candidate.readings.length,
                  fields: candidate.fieldCount,
                })}
              </span>
              {state.scan && state.scan.skipped.length > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  {t('titleBlockBinding.skipped', { count: state.scan.skipped.length })}
                </span>
              ) : null}
            </header>
          ) : null}

          {!state.loading && !candidate ? (
            <p className="text-sm text-muted-foreground">{t('titleBlockBinding.empty')}</p>
          ) : null}

          <TitleBlockProposalList
            proposals={state.proposals}
            readings={candidate?.readings ?? EMPTY_READINGS}
            fileRecordId={fileRecordId}
            levelId={levelId}
            layerName={candidate?.layerName ?? ''}
            projectId={projectId}
            onContactCreated={state.refresh}
          />
        </section>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
