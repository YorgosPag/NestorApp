/**
 * @fileoverview **Η ΟΨΗ ΤΟΥ PDF ΠΛΗΡΟΦΟΡΙΑΚΟΥ ΥΠΟΛΟΓΙΣΜΟΥ** — από υπολογισμό σε έτοιμες συμβολοσειρές (ADR-947 Φ2β · Δ-Φ2.2).
 * @module services/pdf/renderers/objective-value/objective-value-pdf-view
 * @related objective-value-pdf-renderer.ts (ο ΕΝΑΣ renderer) · objective-value-pdf-snapshot-view.ts (το στιγμιότυπο) ·
 *   objective-value-pdf-inputs.ts (οι είσοδοι με προέλευση)
 *
 * 🏆 **Μία όψη, δύο πηγές** (Stripe: το PDF του τιμολογίου αποδίδεται από την εγγραφή, ποτέ από την οθόνη): ο ζωντανός
 *    υπολογισμός της συσκευής (βαθμίδα 1) και το αμετάβλητο στιγμιότυπο του server γίνονται **το ίδιο σχήμα**
 *    (`ObjectiveValuePdfCalculation`) πριν φτάσουν εδώ. Ο renderer δεν ξέρει από πού ήρθαν — άρα δεν μπορούν να αποκλίνουν.
 * 🔑 **Καμία λέξη μέσα στον renderer**: η όψη κρατά μόνο έτοιμα κείμενα, επιλυμένα από τον καλούντα με τον ΕΝΑ τύπο
 *    μεταφραστή (`PriceLabelT`): i18next στη συσκευή, `createBundleTranslate` στον server. Η γλώσσα είναι **παράμετρος**,
 *    ποτέ καθολική κατάσταση.
 * 🔴 **Πληροφοριακός υπολογισμός, ΟΧΙ βεβαίωση** (ADR-947 §2, §9.6): κανένα κείμενο εδώ δεν λέει «βεβαίωση» ή «επίσημη».
 */

import { PRODUCT_NAME } from '@/constants/product-identity';
import type { HumanLanguage } from '@/i18n/languages';
import { formatCurrencyIn, formatNumberIn } from '@/lib/intl-formatting';
import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import type { ObjectiveValueEngineIdentity } from '@/lib/objective-value/objective-value-engine-version';
import { objectiveValueFactorLabel } from '@/lib/objective-value/objective-value-factor-label';
import { AADE_MYPROPERTY_URL } from '@/lib/objective-value/objective-value-page-sections';
import type { ObjectiveValueSnapshotProvenance, ZoneTableIdentity } from '@/lib/objective-value/objective-value-snapshot';
import type { ComputedObjectiveValue } from '@/lib/objective-value/objective-value-types';
import type { ObjectiveValueIdentification } from '@/lib/objective-value/objective-value-identification';
import { formatOperatorDate, formatOperatorDateTime } from '@/lib/operator-time-format';
import { pdfAppBrand, type PdfAppBrand } from '@/services/pdf/pdf-app-logo';
import type { PdfFlowPair } from '@/services/pdf/pdf-flow';

import {
  objectiveValuePdfInputRows,
  objectiveValuePdfSummary,
  type ObjectiveValuePdfInputRow,
  type PdfWords,
} from './objective-value-pdf-inputs';

const NS = 'objective-value';

/** Από πού ήρθε η τιμή ζώνης — ό,τι ξέρει **η πηγή** του υπολογισμού. */
interface ObjectiveValuePdfZone {
  readonly fromSource: boolean;
  /** `YYYY-MM-DD` — έναρξη ισχύος της τιμής· `null` όταν δηλώθηκε χειροκίνητα. */
  readonly validFrom: string | null;
  /** Η ταυτότητα του πίνακα ζωνών — μόνο στο στιγμιότυπο (η συσκευή δεν την κρατά). */
  readonly table: ZoneTableIdentity | null;
}

/** **Ο υπολογισμός**, όποια κι αν είναι η πηγή του — το ΕΝΑ σχήμα που διαβάζει η όψη. */
export interface ObjectiveValuePdfCalculation {
  readonly valuationDate: string;
  /** Το πρόχειρο **όπως το είδε η μηχανή** (`effectiveDraftOf`). */
  readonly draft: ObjectiveValueDraft;
  readonly result: ComputedObjectiveValue;
  readonly provenance: ObjectiveValueSnapshotProvenance;
  readonly zone: ObjectiveValuePdfZone;
  readonly engine: ObjectiveValueEngineIdentity;
}

/** Ένας πίνακας της όψης — κεφαλίδα + στήλες + γραμμές, όλα κείμενο. */
export interface ObjectiveValuePdfTable {
  readonly heading: string;
  readonly columns: readonly [string, string, string];
  readonly rows: readonly (readonly [string, string, string])[];
}

/** Ενότητα «ζεύγη» με επικεφαλίδα. */
export interface ObjectiveValuePdfPairsSection {
  readonly heading: string;
  readonly rows: readonly PdfFlowPair[];
}

/** Η επαλήθευση — μόνο το στιγμιότυπο τη φέρει. */
export interface ObjectiveValuePdfVerification {
  readonly heading: string;
  readonly rows: readonly PdfFlowPair[];
  readonly notes: readonly string[];
  /** Ο σύνδεσμος που κωδικοποιεί το QR — `null` ⇒ κανένα QR (ο server δεν ξέρει τη δημόσια διεύθυνσή του). */
  readonly qrPayload: string | null;
}

/** **Η όψη** — ό,τι χρειάζεται ο renderer, τίποτα που να χρειάζεται μετάφραση ή μορφοποίηση. */
export interface ObjectiveValuePdfView {
  /** Η γλώσσα του εγγράφου — γράφεται και στο `/Lang` του PDF (αναγνώστες οθόνης, PDF/UA). */
  readonly language: HumanLanguage;
  /** Η σφραγίδα «λογότυπο + Nestor App» της κεφαλίδας και πού οδηγεί. */
  readonly brand: PdfAppBrand;
  readonly title: string;
  readonly notice: string;
  readonly facts: readonly PdfFlowPair[];
  /** **Το ακίνητο** (RICS «identification») — μόνο η συσκευή· το στιγμιότυπο το γράφει στα `facts` (`subject`). */
  readonly subject: ObjectiveValuePdfPairsSection | null;
  readonly result: { readonly heading: string; readonly value: PdfFlowPair; readonly base: string };
  readonly factors: ObjectiveValuePdfTable;
  readonly inputs: ObjectiveValuePdfTable;
  readonly zone: ObjectiveValuePdfPairsSection;
  readonly engine: ObjectiveValuePdfPairsSection;
  readonly statement: { readonly heading: string; readonly paragraphs: readonly string[]; readonly link: PdfFlowPair };
  readonly verification: ObjectiveValuePdfVerification | null;
  readonly footer: { readonly center: string; readonly timestamp: string; readonly pageLabel: (page: number, total: number) => string };
  /** Ντετερμινιστικά μεταδεδομένα — `null` ⇒ ο renderer δεν τα σφραγίζει (ζωντανός υπολογισμός, κανένα id). */
  readonly identity: { readonly id: string; readonly issuedAt: string } | null;
  readonly properties: {
    readonly title: string;
    readonly subject: string;
    readonly author: string;
    readonly creator: string;
    /** Λέξεις για την αναζήτηση του λειτουργικού (περιγραφή · διεύθυνση · ΚΑΕΚ) — μόνο όταν δόθηκαν. */
    readonly keywords?: string;
  };
}

/** Οι συντελεστές της μηχανής — όνομα · τιμή · άρθρο, ποτέ δεύτερος πολλαπλασιασμός. */
function factorsTable(words: PdfWords, result: ComputedObjectiveValue): ObjectiveValuePdfTable {
  const { t, language } = words;
  return {
    heading: t(`${NS}:result.breakdown`),
    columns: [t(`${NS}:result.factorColumn`), t(`${NS}:result.valueColumn`), t(`${NS}:result.refColumn`)],
    rows: result.factors.map((factor) => [
      objectiveValueFactorLabel(t, factor),
      formatNumberIn(language, factor.factor, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
      factor.ref,
    ]),
  };
}

function inputsTable(words: PdfWords, calculation: ObjectiveValuePdfCalculation): ObjectiveValuePdfTable {
  const { t } = words;
  const rows: readonly ObjectiveValuePdfInputRow[] = objectiveValuePdfInputRows(words, calculation.draft, calculation.provenance);
  return { heading: t(`${NS}:pdf.inputsHeading`), columns: [t(`${NS}:pdf.inputColumn`), t(`${NS}:result.valueColumn`), t(`${NS}:pdf.sourceColumn`)], rows };
}

/** Η τιμή ζώνης: πηγή · ισχύς · ταυτότητα πίνακα (όσα είναι γνωστά). */
function zoneSection(words: PdfWords, zone: ObjectiveValuePdfZone): ObjectiveValuePdfPairsSection {
  const { t, language } = words;
  const source = zone.fromSource ? t(`${NS}:provenance.detail.zonePrice`) : t(`${NS}:pdf.zoneManual`);
  const rows: PdfFlowPair[] = [[t(`${NS}:pdf.zoneSource`), source]];
  if (zone.validFrom !== null) rows.push([t(`${NS}:pdf.zoneValidFrom`), formatOperatorDate(zone.validFrom, language)]);
  if (zone.table !== null) {
    const { from, to } = zone.table.validFrom;
    rows.push([t(`${NS}:pdf.zoneTableValidity`), t(`${NS}:pdf.dateRange`, { from: formatOperatorDate(from, language), to: formatOperatorDate(to, language) })]);
    rows.push([t(`${NS}:pdf.zoneTableDigest`), zone.table.sha256]);
  }
  return { heading: t(`${NS}:pdf.zoneHeading`), rows };
}

function engineSection(words: PdfWords, engine: ObjectiveValueEngineIdentity): ObjectiveValuePdfPairsSection {
  const { t } = words;
  return {
    heading: t(`${NS}:pdf.engineHeading`),
    rows: [[t(`${NS}:pdf.engineVersion`), engine.version], [t(`${NS}:pdf.engineTables`), engine.tablesSha256]],
  };
}

/** Το σώμα που είναι **ίδιο** σε κάθε πηγή — αποτέλεσμα · συντελεστές · είσοδοι · ζώνη · μηχανή · χαρακτήρας. */
type ObjectiveValuePdfBody = Pick<ObjectiveValuePdfView, 'title' | 'result' | 'factors' | 'inputs' | 'zone' | 'engine' | 'statement'>;

export function objectiveValuePdfBody(words: PdfWords, calculation: ObjectiveValuePdfCalculation): ObjectiveValuePdfBody {
  const { t, language } = words;
  const { result } = calculation;
  return {
    title: t(`${NS}:pdf.title`),
    result: {
      heading: t(`${NS}:pdf.resultHeading`),
      value: [t(`${NS}:result.label`), formatCurrencyIn(language, result.value)],
      base: t(`${NS}:result.base`, { price: formatCurrencyIn(language, result.zonePrice), area: formatNumberIn(language, result.area) }),
    },
    factors: factorsTable(words, result),
    inputs: inputsTable(words, calculation),
    zone: zoneSection(words, calculation.zone),
    engine: engineSection(words, calculation.engine),
    statement: {
      heading: t(`${NS}:pdf.statementHeading`),
      paragraphs: [t(`${NS}:pdf.statement`), t(`${NS}:result.disclaimer`)],
      link: [t(`${NS}:result.myProperty`), AADE_MYPROPERTY_URL],
    },
  };
}

/** Η αρίθμηση σελίδων στη γλώσσα του εγγράφου. */
export function objectiveValuePdfPageLabel(words: PdfWords): (page: number, total: number) => string {
  return (page, total) => words.t(`${NS}:pdf.page`, { page, total });
}

/** **Ο ζωντανός υπολογισμός της συσκευής** (βαθμίδα 1) — χωρίς κωδικό, χωρίς αποθήκευση, χωρίς QR. */
interface ObjectiveValueLivePdfSource {
  readonly calculation: ObjectiveValuePdfCalculation;
  /** ISO 8601 — η στιγμή που πατήθηκε το κουμπί. */
  readonly generatedAt: string;
  /** Η διεύθυνση όπως την κατάλαβε ο γεωκωδικοποιητής — `null` όταν δόθηκε μόνο σημείο ή χειροκίνητη τιμή. */
  readonly place: string | null;
  /** Περιγραφή + ΚΑΕΚ που έδωσε ο άνθρωπος — μόνο στη συσκευή, ποτέ αποθηκευμένα. */
  readonly identification: ObjectiveValueIdentification;
  /** Η αρχική της εφαρμογής, για τη σφραγίδα — `null` ⇒ χωρίς σύνδεσμο. */
  readonly appHref: string | null;
}

/** **Το ακίνητο**: περιγραφή · διεύθυνση · ΚΑΕΚ · χαρακτηριστικά — όσα δόθηκαν, με αυτή τη σειρά. */
function liveSubject(words: PdfWords, source: ObjectiveValueLivePdfSource): ObjectiveValuePdfPairsSection {
  const { t } = words;
  const { description, kaek } = source.identification;
  const rows: PdfFlowPair[] = [];
  if (description !== null) rows.push([t(`${NS}:pdf.subject.description`), description]);
  if (source.place !== null) rows.push([t(`${NS}:pdf.facts.place`), source.place]);
  if (kaek !== null) rows.push([t(`${NS}:pdf.subject.kaek`), kaek]);
  rows.push([t(`${NS}:pdf.subject.summary`), objectiveValuePdfSummary(words, source.calculation.draft)]);
  return { heading: t(`${NS}:pdf.facts.subject`), rows };
}

/** Τίτλος και λέξεις αναζήτησης του αρχείου — η περιγραφή κάνει το PDF **ευρέσιμο** από το λειτουργικό. */
function liveProperties(title: string, notice: string, source: ObjectiveValueLivePdfSource): ObjectiveValuePdfView['properties'] {
  const { description, kaek } = source.identification;
  const keywords = [description, source.place, kaek].filter((word): word is string => word !== null);
  return {
    title: description === null ? title : `${title} — ${description}`,
    subject: notice,
    author: PRODUCT_NAME,
    creator: PRODUCT_NAME,
    ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
  };
}

export function liveObjectiveValuePdfView(words: PdfWords, source: ObjectiveValueLivePdfSource): ObjectiveValuePdfView {
  const { t, language } = words;
  const body = objectiveValuePdfBody(words, source.calculation);
  const generated = formatOperatorDateTime(source.generatedAt, language);
  const facts: PdfFlowPair[] = [
    [t(`${NS}:pdf.facts.valuationDate`), formatOperatorDate(source.calculation.valuationDate, language)],
    [t(`${NS}:pdf.facts.generatedAt`), generated],
  ];
  const notice = t(`${NS}:pdf.liveNotice`);
  return {
    ...body,
    language,
    brand: pdfAppBrand(source.appHref),
    notice,
    facts,
    subject: liveSubject(words, source),
    verification: null,
    footer: { center: body.title, timestamp: generated, pageLabel: objectiveValuePdfPageLabel(words) },
    identity: null,
    properties: liveProperties(body.title, notice, source),
  };
}
