'use client';

/**
 * @fileoverview 🏔️ **ΤΟ ΤΟΠΟΓΡΑΦΙΚΟ ΤΗΣ ΑΓΓΕΛΙΑΣ, ΑΠΟ ΑΡΧΗ ΩΣ ΤΕΛΟΣ** (ADR-920 Β4.9) — τι δημοσιεύεται τώρα · αρχείο ·
 * στήλες/μονάδες · «αυτό θα δει ο αγοραστής» (χάρτης + αριθμοί) · δήλωση Δ2 · δημοσίευση.
 * @related hooks/listings/useTerrainSurveyImport (ΟΛΗ η κατάσταση — εδώ μηδέν λογική) ·
 *   components/listing-detail/terrain/TerrainPreview (ο χάρτης, από τον Web Worker) ·
 *   components/listing-detail/terrain/TerrainStatsList · ./SurveyFilePicker · ./SurveyPointsStep ·
 *   ./SurveyDeclarationForm · ./PublishedTerrainSummary
 * @module components/terrain/survey-import/TerrainSurveyImportPanel
 *
 * 🔑 **Ανεξάρτητο από τον κάτοχο**: παίρνει μόνο την πόρτα (`TerrainPublishTarget`) και την κάρτα που δημοσιεύεται —
 *   ο ιδιώτης («Βελτίωσε την αγγελία», Β4.9) και το γραφείο (Β4.10) το φιλοξενούν ίδιο.
 * 🔑 **Πέρα από τους μεγάλους**: η προεπισκόπηση δεν είναι «περίπου» — χάρτης και αριθμοί βγαίνουν από το ΙΔΙΟ στιγμιότυπο
 *   που θα δημοσιευτεί (`prepareSurveyUpload`, ο κώδικας της πόρτας). Ό,τι βλέπει ο ιδιοκτήτης εδώ, αυτό θα δει ο αγοραστής.
 * 🔑 **Χωρίς πόρτα (`target === null`) η προεπισκόπηση μένει**: ο ιδιοκτήτης βλέπει την αξία πριν του ζητηθεί οτιδήποτε·
 *   στη θέση του κουμπιού λέγεται ΤΙ λείπει, ποτέ κουμπί που η πόρτα θα αρνιόταν.
 */

import React, { useId, type ReactNode } from 'react';

import { TerrainPreview } from '@/components/listing-detail/terrain/TerrainPreview';
import { TerrainStatsList } from '@/components/listing-detail/terrain/TerrainStatsList';
import { useTerrainSurveyImport, type TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingTerrainCard } from '@/lib/terrain/publication/listing-terrain-card';
import type { TerrainPublishTarget } from '@/lib/terrain/publication/terrain-publish-target';

import { PublishedTerrainSummary } from './PublishedTerrainSummary';
import { SurveyDeclarationForm } from './SurveyDeclarationForm';
import { SurveyFilePicker } from './SurveyFilePicker';
import { SurveyPointsStep } from './SurveyPointsStep';

const NS = 'terrain-survey';

/**
 * Οι χώροι ονομάτων που ζωγραφίζει το πάνελ (+ η ζώνη αρχείων). Το πάνελ φορτώνεται πίσω από όριο (`next/dynamic`, CHECK 3.34)
 * ⇒ τα κλειδιά του ΔΕΝ είναι στο slice της σελίδας· περιμένει να φορτώσουν ΟΛΟΚΛΗΡΟΙ, αλλιώς θα έβαφε ωμά κλειδιά.
 */
export const TERRAIN_SURVEY_IMPORT_NAMESPACES = ['terrain-survey', 'listing-detail', 'files', 'files-media'] as const;

export interface TerrainSurveyImportPanelProps {
  readonly target: TerrainPublishTarget | null;
  /** Η κάρτα του εδάφους που δημοσιεύεται τώρα· `null` ⇒ κανένα (ή η αγγελία δεν διαβάστηκε ακόμη). */
  readonly published: ListingTerrainCard | null;
  /** Ό,τι δείχνεται όσο φορτώνουν οι χώροι ονομάτων — ήδη μεταφρασμένο από τον φιλοξενούντα. */
  readonly pending: ReactNode;
}

/** «Αυτό θα δει ο αγοραστής» — ο χάρτης της προεπισκόπησης και οι αριθμοί του ίδιου στιγμιοτύπου. */
function BuyerView({ survey }: { readonly survey: TerrainSurveyImportApi }) {
  const { t } = useTranslation([NS]);
  const headingId = useId();
  const snapshot = survey.preparation?.ok ? survey.preparation.snapshot : null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}:buyer.heading`)}</h3>
        <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:buyer.intro`)}</p>
      </header>
      <TerrainPreview preview={survey.preview} onWidth={survey.setPreviewWidth} />
      {snapshot !== null && <TerrainStatsList stats={snapshot.stats} contourIntervalM={snapshot.contourIntervalM} />}
    </section>
  );
}

function TerrainSurveyImportBody({ target, published }: Omit<TerrainSurveyImportPanelProps, 'pending'>) {
  const { t } = useTranslation([NS]);
  const survey = useTerrainSurveyImport(target);
  const publishing = survey.publication.kind === 'publishing';
  // Η δήλωση μένει στο DOM όσο υπάρχουν σημεία — μια αλλαγή στήλης δεν σβήνει ό,τι έγραψε ο άνθρωπος· το κουμπί
  // περιμένει την ετυμηγορία (`canPublish`).
  const hasPoints = survey.points.points.length > 0;
  return (
    <section className="flex flex-col gap-4" data-terrain-survey-import="">
      <PublishedTerrainSummary card={published} />
      <SurveyFilePicker survey={survey} disabled={publishing} />
      <SurveyPointsStep survey={survey} disabled={publishing} />
      {hasPoints && <BuyerView survey={survey} />}
      {hasPoints && (target === null
        ? <p className="m-0 text-sm text-foreground">{t(`${NS}:publish.unavailable`)}</p>
        : <SurveyDeclarationForm survey={survey} replacing={published !== null} />)}
    </section>
  );
}

/** Το πάνελ, μόλις φορτώσουν οι χώροι ονομάτων του — ποτέ ωμά κλειδιά στο πρώτο καρέ. */
export function TerrainSurveyImportPanel({ pending, ...props }: TerrainSurveyImportPanelProps) {
  const { isNamespaceReady } = useTranslation(TERRAIN_SURVEY_IMPORT_NAMESPACES);
  return isNamespaceReady ? <TerrainSurveyImportBody {...props} /> : <>{pending}</>;
}
