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
import {
  resolveSurveyDestination,
  type SurveyDestination,
} from '@/lib/title-block/resolve-survey-record';
import {
  SURVEY_RECORD_LABEL_NAMESPACE,
  surveyRecordDisplayName,
} from '@/config/survey-record-labels';
import { BLOCKED_LABEL, SOURCE_KIND_LABEL } from './title-block-binding/proposal-labels';
import type { TitleBlockReading } from '@/types/title-block-reading';
import { TitleBlockBindingPaletteStore } from '../../stores/TitleBlockBindingPaletteStore';
import { ESC_PRIORITY, useEscapeHandler } from '../../systems/escape-bus';
import { PANEL_ANCHORING, PanelPositionCalculator } from '../../config/panel-tokens';
import { TitleBlockProposalList } from './title-block-binding/TitleBlockProposalList';
import { TitleBlockUnreadSection } from './title-block-binding/TitleBlockUnreadSection';
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
  const surveyDestination = resolveSurveyDestination(state.survey);

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

          {/* 🔑 **Ο προορισμός δηλώνεται ΜΙΑ φορά, όχι ανά γραμμή** (ADR-759 Φ3γ). Είναι
              ιδιότητα του **έργου**, όχι του κελιού: όλες οι δηλώσεις του τοπογράφου πάνε
              στην ίδια εγγραφή, γιατί αλλιώς ο μηχανικός θα μπορούσε να συνθέσει βεβαίωση
              που κανείς δεν υπέγραψε. Ίδια πρακτική με το Copy/Monitor του Revit: διαλέγεις
              τον σύνδεσμο μία φορά, μετά τα στοιχεία. Επαναλαμβανόμενο ανά γραμμή θα ήταν
              και θόρυβος (§5.8) και λάθος μοντέλο. */}
          <SurveyDestinationNotice destination={surveyDestination} />

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

          {/* 🔴 **Το σώμα του σχεδίου, ΧΩΡΙΣΤΑ** (ADR-759 §4.6). Η πινακίδα έχει δομή· το σώμα
              είναι πρόζα, και η ίδια μηχανή πάνω στα δύο υλικά δίνει δύο διαφορετικές
              ποιότητες. Ενωμένες σε μία λίστα, οι δύο θα φαίνονταν ίδιες — γι' αυτό η ομάδα
              φέρει ρητή επικεφαλίδα «επιβεβαίωσε», και όχι απλώς μια σήμανση ανά γραμμή. */}
          {!state.loading && state.bodyProposals.length > 0 ? (
            <section className="flex flex-col gap-1 border-t border-border pt-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--text-warning))]">
                {t(SOURCE_KIND_LABEL['document-body'])}
              </h3>
              <TitleBlockProposalList
                proposals={state.bodyProposals}
                readings={EMPTY_READINGS}
                fileRecordId={fileRecordId}
                levelId={levelId}
                layerName=""
                projectId={projectId}
                onContactCreated={state.refresh}
              />
            </section>
          ) : null}

          {/* 🔴 ADR-762 §5 — ό,τι διαβάστηκε και δεν δέθηκε. Κάτω από τις προτάσεις επίτηδες:
              είναι **πληροφορία**, όχι εργασία, και δεν πρέπει να ανταγωνίζεται τα κουμπιά. */}
          {!state.loading && candidate ? (
            <TitleBlockUnreadSection readings={candidate.readings} />
          ) : null}
        </section>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};

/**
 * «Οι δηλώσεις του τοπογράφου γράφονται στο: …» — ή **γιατί δεν γράφονται πουθενά**.
 *
 * 🔑 Το μήνυμα άρνησης είναι το **ίδιο** που θα έδειχνε η κάθε μπλοκαρισμένη γραμμή
 * (`BLOCKED_LABEL`), γιατί είναι η **ίδια** απόφαση ({@link resolveSurveyDestination}) —
 * δεύτερη διατύπωση θα ήταν δύο κείμενα για ένα γεγονός, και θα απέκλιναν. Εδώ όμως λέγεται
 * **μία** φορά αντί για τέσσερις, που είναι η διαφορά ανάμεσα σε πληροφορία και θόρυβο.
 */
const SurveyDestinationNotice: React.FC<{ readonly destination: SurveyDestination }> = ({
  destination,
}) => {
  // 🔴 Δεύτερο namespace: το **όνομα** της εγγραφής ζει στο λεξιλόγιο της καρτέλας, όχι εδώ
  // (SSoT — δες `config/survey-record-labels.ts`). Χωρίς τη δήλωση, το προθεματισμένο κλειδί
  // βάφεται ωμό στην οθόνη ενώ η μετάφραση υπάρχει — η βλάβη του ADR-752, ίδιο σχήμα με τους
  // ρόλους έργου. Το φυλάει το `title-block-binding-wiring.test.ts`.
  const { t } = useTranslation(['dxf-viewer-shell', SURVEY_RECORD_LABEL_NAMESPACE]);

  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      {destination.to === 'record'
        ? t('titleBlockBinding.surveyDestination', {
            // Η **ίδια** σύνθεση με την καρτέλα: «Τοπογραφικό 30/7/2026» ή «Τοπογραφικό χωρίς
            // ημερομηνία» — ποτέ σκέτη παύλα, που ήταν η κατάσταση κάθε νέας καρτέλας.
            record: surveyRecordDisplayName(destination.record.label, t),
          })
        : t(BLOCKED_LABEL[destination.reason])}
    </p>
  );
};
