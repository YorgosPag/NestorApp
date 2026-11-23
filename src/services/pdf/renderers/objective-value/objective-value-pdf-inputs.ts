/**
 * @fileoverview **Οι είσοδοι του υπολογισμού, με την προέλευσή τους** — οι γραμμές «στοιχείο · τιμή · προέλευση» του PDF
 *               πληροφοριακού υπολογισμού (ADR-947 Φ2β · Δ2).
 * @module services/pdf/renderers/objective-value/objective-value-pdf-inputs
 * @related objective-value-pdf-view.ts (ο συνθέτης) · lib/objective-value/objective-value-input-provenance.ts (τα 4 σκέλη)
 *
 * 🔑 **Ίδιο λεξιλόγιο με την οθόνη**: κάθε ετικέτα είναι το κλειδί που ήδη δείχνει ο υπολογιστής (ερωτήσεις · ακίνητο ·
 *    σήμα προέλευσης) — το PDF δεν ονομάζει τίποτα με δική του λέξη. Νέες λέξεις μόνο όπου αλλάζει η **φωνή**: η οθόνη
 *    μιλά στον άνθρωπο («Δική σας τιμή»), το έγγραφο μιλά για τον συντάκτη («Δηλωμένη τιμή»).
 * 🔑 **Μόνο οι είσοδοι που γνωρίζει η μηχανή** (`ObjectiveValueInputKey`)· οι ειδικές περιπτώσεις φαίνονται ως
 *    συντελεστές με το άρθρο τους, όχι δεύτερη φορά εδώ.
 */

import { EVIDENCE_DOCUMENT_LABEL_KEYS } from '@/components/objective-value/objective-value-document-labels';
import type { HumanLanguage } from '@/i18n/languages';
import { formatCurrencyIn, formatNumberIn } from '@/lib/intl-formatting';
import { frontageLabel } from '@/lib/listings/frontage-label';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import type { LevelDraft, ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import { floorBucketOf, floorLabelSegment } from '@/lib/objective-value/objective-value-floor-bucket';
import type {
  CalculatorAssumption,
  ObjectiveValueInputSource,
  ObjectiveValueInputValue,
} from '@/lib/objective-value/objective-value-input-provenance';
import type { ObjectiveValueSnapshotProvenance } from '@/lib/objective-value/objective-value-snapshot';
import { formatCommercialityFactor } from '@/lib/objective-value/objective-value-zone';
import { formatOperatorDate } from '@/lib/operator-time-format';

const NS = 'objective-value';

/** Μία γραμμή του πίνακα εισόδων. */
export type ObjectiveValuePdfInputRow = readonly [input: string, value: string, source: string];

/** Ό,τι χρειάζεται για να ονομαστεί και να μορφοποιηθεί μία είσοδος. */
export interface PdfWords {
  readonly t: PriceLabelT;
  readonly language: HumanLanguage;
}

const yesNo = (words: PdfWords, value: boolean): string => words.t(`${NS}:questions.${value ? 'yes' : 'no'}`);
const squareMetres = (words: PdfWords, area: number): string => words.t(`${NS}:pdf.squareMetres`, { area: formatNumberIn(words.language, area) });
const floorOf = (words: PdfWords, floor: number): string => words.t(`${NS}:property.floor.${floorLabelSegment(floorBucketOf(floor))}`);

/** Το κείμενο κάθε υπόθεσης — τα **υπάρχοντα** κλειδιά της αγγελίας και του κτιρίου (ίδια με το σήμα της οθόνης). */
function assumptionText(words: PdfWords, assumption: CalculatorAssumption): string {
  switch (assumption) {
    case 'areaWithoutCommon':
      return words.t(`${NS}:listing.assumptions.areaWithoutCommon`);
    case 'parkingDefaultArea':
      return words.t(`${NS}:building.assumptions.parkingDefaultArea`);
    case 'commercialityUnknown':
      return words.t(`${NS}:questions.commercialityFactor.assumed`);
  }
}

/** Η αρχική τιμή μιας παράκαμψης, στο λεξιλόγιο του πεδίου. */
type FormatValue = (value: ObjectiveValueInputValue) => string;

/** Η προέλευση στη φωνή του εγγράφου· `null` (χωρίς σήμα στην οθόνη) = τιμή που δήλωσε ο συντάκτης. */
function sourceLabel(words: PdfWords, source: ObjectiveValueInputSource | null, formatOriginal: FormatValue): string {
  const { t } = words;
  if (source === null) return t(`${NS}:pdf.source.declaredValue`);
  switch (source.kind) {
    case 'property':
      return t(`${NS}:provenance.badge.property`);
    case 'openData':
      return t(`${NS}:provenance.badge.openData`);
    case 'assumption':
      return t(`${NS}:pdf.source.assumption`, { text: assumptionText(words, source.assumption) });
    case 'user':
      if (source.declaredFrom !== undefined) {
        const { document, page } = source.declaredFrom;
        return t(`${NS}:pdf.source.document`, { label: t(`${NS}:provenance.badge.declared`), document: t(EVIDENCE_DOCUMENT_LABEL_KEYS[document]), page });
      }
      return source.overrides === null
        ? t(`${NS}:pdf.source.declaredValue`)
        : t(`${NS}:pdf.source.override`, { original: formatOriginal(source.overrides.original) });
  }
}

const plainValue = (words: PdfWords): FormatValue => (value) =>
  typeof value === 'boolean' ? yesNo(words, value) : typeof value === 'number' ? formatNumberIn(words.language, value) : value;

interface InputContext {
  readonly words: PdfWords;
  readonly draft: ObjectiveValueDraft;
  readonly provenance: ObjectiveValueSnapshotProvenance;
}

function row(ctx: InputContext, labelKey: string, value: string, source: ObjectiveValueInputSource | null, format: FormatValue): ObjectiveValuePdfInputRow {
  return [ctx.words.t(labelKey), value, sourceLabel(ctx.words, source, format)];
}

/** Τιμή ζώνης και ΣΕ — οι δύο είσοδοι που δεν ζουν στο πρόχειρο, αλλά στη θέση. */
function zoneRows(ctx: InputContext): ObjectiveValuePdfInputRow[] {
  const { words, draft, provenance } = ctx;
  const plain = plainValue(words);
  const rows: ObjectiveValuePdfInputRow[] = [];
  if (draft.zonePrice !== null) {
    const price = words.t(`${NS}:pdf.perSquareMetre`, { price: formatCurrencyIn(words.language, draft.zonePrice) });
    rows.push(row(ctx, `${NS}:location.manualLabel`, price, provenance.zonePrice, plain));
  }
  if (draft.commercialityFactor !== null && provenance.commercialityFactor !== null) {
    const factor = formatCommercialityFactor(draft.commercialityFactor, words.language);
    rows.push(row(ctx, `${NS}:questions.commercialityFactor.label`, factor, provenance.commercialityFactor, plain));
  }
  return rows;
}

/** Τα επίπεδα της κατοικίας — όροφος και επιφάνεια ανά επίπεδο, με τον δικό τους δείκτη προέλευσης. */
function levelRows(ctx: InputContext): ObjectiveValuePdfInputRow[] {
  const { words, provenance } = ctx;
  const floorFormat: FormatValue = (value) => (typeof value === 'number' ? floorOf(words, value) : plainValue(words)(value));
  return ctx.draft.levels.flatMap((level: LevelDraft, index) => {
    const sources = provenance.levels[index] ?? { floor: null, area: null };
    const number = index + 1;
    const rows: ObjectiveValuePdfInputRow[] = [];
    if (level.floor !== null) rows.push([words.t(`${NS}:pdf.levelFloor`, { number }), floorOf(words, level.floor), sourceLabel(words, sources.floor, floorFormat)]);
    if (level.area !== null) rows.push([words.t(`${NS}:pdf.levelArea`, { number }), squareMetres(words, level.area), sourceLabel(words, sources.area, plainValue(words))]);
    return rows;
  });
}

/** Η θέση αποθήκης/στάθμευσης — κλειστό λεξιλόγιο του ακινήτου· χωρίς σήμα στην οθόνη, άρα δήλωση. */
function positionRow(ctx: InputContext): ObjectiveValuePdfInputRow | null {
  const { words, draft } = ctx;
  if (draft.form === 'storage' && draft.storagePosition !== null) {
    return [words.t(`${NS}:property.positionLabel`), words.t(`${NS}:property.storagePosition.${draft.storagePosition}`), words.t(`${NS}:pdf.source.declaredValue`)];
  }
  if (draft.form === 'parking' && draft.parkingPosition !== null) {
    return [words.t(`${NS}:property.positionLabel`), words.t(`${NS}:property.parkingPosition.${draft.parkingPosition}`), words.t(`${NS}:pdf.source.declaredValue`)];
  }
  return null;
}

/** Τα χαρακτηριστικά της κατοικίας που ρωτά η μηχανή — μόνο όσα έχουν τιμή. */
function residenceRows(ctx: InputContext): ObjectiveValuePdfInputRow[] {
  const { words, draft, provenance } = ctx;
  const { fields } = provenance;
  const plain = plainValue(words);
  const frontage: FormatValue = (value) => frontageLabel(words.t, String(value));
  const date: FormatValue = (value) => formatOperatorDate(String(value), words.language);
  const rows: ObjectiveValuePdfInputRow[] = [];
  if (draft.frontage !== null) rows.push(row(ctx, `${NS}:questions.frontage.label`, frontage(draft.frontage), fields.frontage, frontage));
  if (draft.hasCentralHeating !== null) rows.push(row(ctx, `${NS}:questions.hasCentralHeating.label`, yesNo(words, draft.hasCentralHeating), fields.hasCentralHeating, plain));
  if (draft.hasElevator !== null) rows.push(row(ctx, `${NS}:questions.hasElevator.label`, yesNo(words, draft.hasElevator), fields.hasElevator, plain));
  if (draft.permitDate !== null) rows.push(row(ctx, `${NS}:questions.ageYears.label`, date(draft.permitDate), fields.permitDate, date));
  rows.push(row(ctx, `${NS}:adjustments.areaIncludesCommon`, yesNo(words, draft.areaIncludesCommon), fields.areaIncludesCommon, plain));
  return rows;
}

/**
 * **Η μία γραμμή του ακινήτου** — «Κατοικία · Α' όροφος · 80 τ.μ.», με το ΙΔΙΟ λεξιλόγιο των εισόδων. Μεζονέτα ⇒ οι
 * όροφοι με «+» και η **συνολική** επιφάνεια. Ό,τι δεν δόθηκε απλώς λείπει.
 */
export function objectiveValuePdfSummary(words: PdfWords, draft: ObjectiveValueDraft): string {
  const parts: string[] = [words.t(`${NS}:property.form.${draft.form}`)];
  if (draft.form === 'residence') {
    const floors = draft.levels.flatMap((level) => (level.floor === null ? [] : [floorOf(words, level.floor)]));
    const areas = draft.levels.flatMap((level) => (level.area === null ? [] : [level.area]));
    if (floors.length > 0) parts.push(floors.join(' + '));
    if (areas.length > 0) parts.push(squareMetres(words, areas.reduce((sum, area) => sum + area, 0)));
  } else if (draft.area !== null) {
    parts.push(squareMetres(words, draft.area));
  }
  return parts.join(' · ');
}

/** **Οι γραμμές εισόδων** — είδος · θέση · τιμή ζώνης · ΣΕ · επιφάνεια/επίπεδα · χαρακτηριστικά, με τη σειρά της οθόνης. */
export function objectiveValuePdfInputRows(
  words: PdfWords,
  draft: ObjectiveValueDraft,
  provenance: ObjectiveValueSnapshotProvenance,
): readonly ObjectiveValuePdfInputRow[] {
  const ctx: InputContext = { words, draft, provenance };
  const formLabel: FormatValue = (value) => words.t(`${NS}:property.form.${String(value)}`);
  const rows: ObjectiveValuePdfInputRow[] = [row(ctx, `${NS}:property.formLabel`, formLabel(draft.form), provenance.fields.form, formLabel)];
  const position = positionRow(ctx);
  if (position !== null) rows.push(position);
  rows.push(...zoneRows(ctx));
  if (draft.form === 'residence') return [...rows, ...levelRows(ctx), ...residenceRows(ctx)];
  // Η ετικέτα γράφει ήδη τη μονάδα («Επιφάνεια (τ.μ.)») — η τιμή μένει σκέτος αριθμός.
  if (draft.area !== null) rows.push(row(ctx, `${NS}:property.areaLabel`, formatNumberIn(words.language, draft.area), provenance.fields.area, plainValue(words)));
  return rows;
}
