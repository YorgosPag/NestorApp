'use client';

/**
 * @fileoverview **«Λήψη PDF» — ο πληροφοριακός υπολογισμός της συσκευής** (ADR-947 Φ2β · βαθμίδα 1).
 * @module components/objective-value/ObjectiveValuePdfButton
 * @related services/pdf/renderers/objective-value/* (η ΜΙΑ όψη + ο ΕΝΑΣ renderer, κοινοί με το στιγμιότυπο του server) ·
 *   hooks/useExportAction.ts · components/shared/ExportFileButton.tsx
 *
 * 🏆 **Πρότυπο ΦΥΑΑ της ΑΑΔΕ**: το φύλλο υπολογισμού είναι εκτυπώσιμο και ρητά πληροφοριακό. Εδώ το PDF παράγεται **στη
 *    συσκευή**: κανένα byte δεν φεύγει, τίποτα δεν αποθηκεύεται (ADR-889 §10.2), κανένας κωδικός — αυτά τα φέρει μόνο το
 *    στιγμιότυπο επαγγελματία (Δ3).
 * 🔑 **Τίποτα βαρύ στη σελίδα**: jsPDF, γραμματοσειρά και όψη φορτώνονται **με το κλικ** (`import()`) — ο δημόσιος
 *    υπολογιστής δεν πληρώνει ούτε ένα byte για όποιον δεν ζητήσει PDF.
 * 🔑 **Ό,τι δείχνει η οθόνη τη στιγμή του κλικ**: το `useExportAction` διαβάζει την τελευταία κλήση· το ποσό είναι αυτό
 *    που ήδη υπολόγισε η ΕΝΑ μηχανή — το PDF δεν ξαναπολλαπλασιάζει τίποτα.
 */

import { FileDown } from 'lucide-react';

import { ExportFileButton } from '@/components/shared/ExportFileButton';
import { useExportAction } from '@/hooks/useExportAction';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { nowISO } from '@/lib/date-local';
import { publicUrl } from '@/lib/http/public-origin';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import {
  identificationFileSlug,
  resolveIdentification,
  type ObjectiveValueIdentification,
  type ObjectiveValueIdentificationDraft,
} from '@/lib/objective-value/objective-value-identification';
import type { ObjectiveValueProvenance } from '@/lib/objective-value/objective-value-input-provenance';
import type { ComputedObjectiveValue } from '@/lib/objective-value/objective-value-types';

import { chosenZoneOrigin } from './objective-value-zone';
import type { ObjectiveValueLocationState } from './useObjectiveValueLocation';

const NS = 'objective-value';

interface ObjectiveValuePdfButtonProps {
  readonly result: ComputedObjectiveValue;
  /** Το πρόχειρο **όπως το είδε η μηχανή** (`effectiveDraftOf`). */
  readonly effective: ObjectiveValueDraft;
  readonly provenance: ObjectiveValueProvenance;
  readonly location: ObjectiveValueLocationState;
  /** `YYYY-MM-DD` — η ημερομηνία αποτίμησης του υπολογισμού. */
  readonly valuationDate: string;
  /** Περιγραφή + ΚΑΕΚ, όπως τα πληκτρολόγησε ο άνθρωπος (`ObjectiveValuePdfIdentification`). */
  readonly identification: ObjectiveValueIdentificationDraft;
}

/** Η αρχική της εφαρμογής για τη σφραγίδα: η δηλωμένη δημόσια διεύθυνση, αλλιώς εκεί όπου τρέχει η σελίδα. */
function appHref(): string {
  return publicUrl('/') ?? `${window.location.origin}/`;
}

/** Όνομα αρχείου — με την περιγραφή όταν δόθηκε, ώστε πολλά PDF στις Λήψεις να ξεχωρίζουν. */
function pdfFileName(t: PriceLabelT, identification: ObjectiveValueIdentification, date: string): string {
  const subject = identificationFileSlug(identification);
  return subject === null ? t(`${NS}:pdf.fileName`, { date }) : t(`${NS}:pdf.fileNameWithSubject`, { subject, date });
}

/** Η σύνθεση και η λήψη — μόνο μέσα στο κλικ, με δυναμική φόρτωση όλων των βαριών εξαρτήσεων. */
async function downloadObjectiveValuePdf(props: ObjectiveValuePdfButtonProps, t: PriceLabelT, languageTag: string) {
  const [{ liveObjectiveValuePdfView }, { renderObjectiveValuePdf }, { objectiveValueEngineIdentity }, { downloadPDF }, { fetchPdfAppLogo }] = await Promise.all([
    import('@/services/pdf/renderers/objective-value/objective-value-pdf-view'),
    import('@/services/pdf/renderers/objective-value/objective-value-pdf-renderer'),
    import('@/lib/objective-value/objective-value-engine-version'),
    import('@/services/pdf/utils/download'),
    import('@/services/pdf/pdf-app-logo'),
  ]);
  const { result, effective, provenance, location, valuationDate } = props;
  const identification = resolveIdentification(props.identification);
  const words = { t, language: resolveHumanLanguage(languageTag) };
  const zone = { ...chosenZoneOrigin(location.lookup, location.frontKey), table: null };
  const calculation = { valuationDate, draft: effective, result, provenance, zone, engine: await objectiveValueEngineIdentity() };
  const place = location.resolved?.label ?? null;
  const view = liveObjectiveValuePdfView(words, { calculation, generatedAt: nowISO(), place, identification, appHref: appHref() });
  const logo = await fetchPdfAppLogo();
  downloadPDF(await renderObjectiveValuePdf(view, { qrPng: null, logo }), `${pdfFileName(t, identification, valuationDate)}.pdf`);
}

export function ObjectiveValuePdfButton(props: ObjectiveValuePdfButtonProps) {
  const { t, i18n } = useTranslation([NS, 'properties-enums']);
  const action = useExportAction(() => downloadObjectiveValuePdf(props, t, i18n.language));
  const labels = { idle: t(`${NS}:pdf.download`), busy: t(`${NS}:pdf.downloading`), failed: t(`${NS}:pdf.downloadFailed`) };
  return <ExportFileButton action={action} icon={FileDown} labels={labels} align="start" />;
}
