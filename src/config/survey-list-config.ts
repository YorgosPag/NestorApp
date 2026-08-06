/**
 * @related ADR-759 §4.2/§4.3.1 — the REPEATING sections of the card, as DATA
 *
 * Sections Α′ (institutional acts), Η (remarks), Θ (approvals) and Ι (title deeds)
 * are lists, not scalar fields, so `survey-card-config.ts` cannot describe them.
 * This file does — in the same spirit and with the same reasoning: the card is
 * described once as data and rendered by one component, because four hand-written
 * list editors are four chances at the sibling clone N.18 exists to stop.
 *
 * 🔑 THE TRICK THAT AVOIDS A SECOND EDITOR. A row's fields are not typed against
 * the row — they are **projected back onto the whole `SurveyRecord`**. The accessor
 * for `approvals[2].authority` is an ordinary `FieldAccessor`, exactly the type the
 * scalar card already uses, whose `read` walks in and whose `write` rebuilds on the
 * way out. Consequences, all of them free:
 *   • `SourcedFieldRow` stays THE one editor — no generics, no second component;
 *   • the copy-paste round-trip anchor of `survey-card-config.test.ts` generalises
 *     to list rows unchanged, because the accessors are the same type;
 *   • a row field cannot secretly write outside its row — the test can prove it.
 *
 * ⚠️ `rowFields(index)` builds closures per call. That is deliberate and safe: they
 * only capture `index`. What must NEVER move into render is `appendRow` — it mints
 * an enterprise id (see `survey-list-rows.ts`).
 */
import type { FieldAccessor } from '@/config/survey-card-config';
import {
  ACT_GROUP_KEYS,
  actLens,
  appendRow,
  approvalLens,
  gazetteLens,
  removeRow,
  remarkLens,
  rowAt,
  titleDeedLens,
  updateRow,
  type ActGroupKey,
  type ListLens,
} from '@/lib/survey-record/survey-list-rows';
import {
  emptySourced,
  type GazetteRelation,
  type Sourced,
  type SurveyRecord,
} from '@/types/project-survey-record';

// ---------------------------------------------------------------------------
// The ΦΕΚ sub-list — plain values, NOT `Sourced`
// ---------------------------------------------------------------------------

/**
 * 🔴 WHY THE GAZETTE FIELDS ARE NOT `Sourced`. A `GazetteRef` has no provenance of
 * its own — the act that owns it carries that. Wrapping its parts in `Sourced`
 * would invent an origin per fragment and, worse, would let `SourcedFieldRow`
 * render `rawText` as *"blank in the drawing"*, which is the wrong sentence for a
 * field that is **required** (ADR-759 Q3: the verbatim reference is the one thing
 * that must survive when nothing parses). Two shapes, two controls, no lie.
 */
interface GazetteFieldBase {
  readonly labelKey: string;
  readonly hintKey?: string;
  /** Which part of a read gazette this is — see `FieldBase.part`. Only `rawText` has one. */
  readonly part?: string;
}

export interface GazetteTextField extends GazetteFieldBase {
  readonly kind: 'text';
  /** `true` only for `rawText`. Empty is a legitimate state while typing. */
  readonly required: boolean;
  /** `''` stands for absent — the control needs a string, always. */
  read(record: SurveyRecord): string;
  write(record: SurveyRecord, next: string): SurveyRecord;
}

export interface GazetteRelationField extends GazetteFieldBase {
  readonly kind: 'relation';
  read(record: SurveyRecord): GazetteRelation | null;
  /** 🔴 Only ever called from an explicit human choice. Never inferred. */
  write(record: SurveyRecord, next: GazetteRelation | null): SurveyRecord;
}

export type GazetteFieldAccessor = GazetteTextField | GazetteRelationField;

/** The ΦΕΚ list living inside one act of an act group. */
export interface GazetteSubList {
  readonly titleKey: string;
  readonly addKey: string;
  readonly removeKey: string;
  readonly emptyKey: string;
  count(record: SurveyRecord, actIndex: number): number;
  appendRow(record: SurveyRecord, actIndex: number): SurveyRecord;
  removeRow(record: SurveyRecord, actIndex: number, gazetteIndex: number): SurveyRecord;
  fields(actIndex: number, gazetteIndex: number): readonly GazetteFieldAccessor[];
}

// ---------------------------------------------------------------------------
// A row field that pairs a written name with an optional entity link
// ---------------------------------------------------------------------------

/**
 * A name **as the document writes it**, plus an optional link to who we think that
 * is. The two are kept apart on purpose: reading is not identification (ADR-745
 * §8), so the drawing's `"Μ. Αθανασιάδου"` never silently becomes a contact id.
 *
 * The same shape already exists in the app for employers, and it is served by the
 * shared picker SSoT (`LinkedSinglePickerView`, ADR-601) — which is what renders
 * this, rather than a second autocomplete.
 */
export interface LinkedContactField {
  readonly labelKey: string;
  readonly linkedBadgeKey: string;
  readonly noLinkKey: string;
  readName(record: SurveyRecord, index: number): Sourced<string>;
  readLinkedId(record: SurveyRecord, index: number): string | null;
  write(
    record: SurveyRecord,
    index: number,
    name: Sourced<string>,
    linkedId: string | null
  ): SurveyRecord;
}

// ---------------------------------------------------------------------------
// A repeating section
// ---------------------------------------------------------------------------

/**
 * One repeating section of the card.
 *
 * Non-generic on purpose: every member speaks in terms of `SurveyRecord` and a row
 * **index**, so sections of different row types live in one ordered array without
 * casts, existential encodings or `any` (N.2).
 */
export interface SurveyListSection {
  /** Stable id — anchors and test selectors, never shown. */
  readonly id: string;
  /** i18n key for the section heading. */
  readonly titleKey: string;
  readonly addKey: string;
  readonly removeKey: string;
  /** Shown when the list is empty. ADR-759 §4.2 rule 3: empty is visible, not hidden. */
  readonly emptyKey: string;
  count(record: SurveyRecord): number;
  /** React key for row `index` — the row's enterprise id where it has one. */
  rowKey(record: SurveyRecord, index: number): string;
  /** 🔴 Mints an enterprise id. Event handlers only — never during render. */
  appendRow(record: SurveyRecord): SurveyRecord;
  removeRow(record: SurveyRecord, index: number): SurveyRecord;
  /** The `Sourced` fields of row `index`, projected onto the whole record. */
  rowFields(index: number): readonly FieldAccessor[];
  /** Declared capability: this section's rows own a nested ΦΕΚ list. */
  readonly gazettes?: GazetteSubList;
  /** Declared capability: this section's rows carry a written name + entity link. */
  readonly linkedContact?: LinkedContactField;
}

// ---------------------------------------------------------------------------
// Shared plumbing — written once, used by all four sections
// ---------------------------------------------------------------------------

/** Row identity: the enterprise id when the row is a rooted entity, else position. */
function identifiedRowKey(id: string | undefined, index: number): string {
  return id ?? `index-${index}`;
}

/**
 * The parts of a section that are pure lens mechanics — same for every list, so
 * they are derived instead of retyped four times.
 */
function lensBoundSection<TRow>(
  lens: ListLens<TRow>,
  keyOf: (row: TRow | undefined, index: number) => string
): Pick<SurveyListSection, 'count' | 'rowKey' | 'appendRow' | 'removeRow'> {
  return {
    count: (record) => lens.read(record).length,
    rowKey: (record, index) => keyOf(rowAt(record, lens, index), index),
    appendRow: (record) => appendRow(record, lens),
    removeRow: (record, index) => removeRow(record, lens, index),
  };
}

// ---------------------------------------------------------------------------
// Section Α′ — three act groups that differ ONLY by which key they live under
// ---------------------------------------------------------------------------

/** `''` ⇄ `null` for the optional parts of a gazette reference. */
function nullable(next: string): string | null {
  return next === '' ? null : next;
}

function gazetteSubList(group: ActGroupKey): GazetteSubList {
  return {
    titleKey: 'gazette.title',
    addKey: 'gazette.add',
    removeKey: 'gazette.remove',
    emptyKey: 'gazette.empty',
    count: (record, actIndex) => gazetteLens(group, actIndex).read(record).length,
    appendRow: (record, actIndex) => appendRow(record, gazetteLens(group, actIndex)),
    removeRow: (record, actIndex, gazetteIndex) =>
      removeRow(record, gazetteLens(group, actIndex), gazetteIndex),
    fields: (actIndex, gazetteIndex) => {
      const lens = gazetteLens(group, actIndex);
      const at = (record: SurveyRecord) => rowAt(record, lens, gazetteIndex);
      return [
        {
          kind: 'text',
          // 🔴 Required by signature in the schema, and required here too. The one
          // part of a ΦΕΚ that must survive even when nothing parses.
          required: true,
          part: 'rawText',
          labelKey: 'gazette.rawText',
          hintKey: 'gazette.rawTextHint',
          read: (record) => at(record)?.rawText ?? '',
          write: (record, next) =>
            updateRow(record, lens, gazetteIndex, (g) => ({ ...g, rawText: next })),
        },
        {
          kind: 'text',
          required: false,
          labelKey: 'gazette.number',
          read: (record) => at(record)?.number ?? '',
          write: (record, next) =>
            updateRow(record, lens, gazetteIndex, (g) => ({ ...g, number: nullable(next) })),
        },
        {
          kind: 'text',
          required: false,
          labelKey: 'gazette.series',
          read: (record) => at(record)?.series ?? '',
          write: (record, next) =>
            updateRow(record, lens, gazetteIndex, (g) => ({ ...g, series: nullable(next) })),
        },
        {
          kind: 'text',
          required: false,
          labelKey: 'gazette.date',
          read: (record) => at(record)?.date ?? '',
          write: (record, next) =>
            updateRow(record, lens, gazetteIndex, (g) => ({ ...g, date: nullable(next) })),
        },
        {
          kind: 'relation',
          labelKey: 'gazette.relation',
          hintKey: 'gazette.relationHint',
          read: (record) => at(record)?.relation ?? null,
          write: (record, next) =>
            updateRow(record, lens, gazetteIndex, (g) => ({ ...g, relation: next })),
        },
      ];
    },
  };
}

/**
 * One act group of section Α′.
 *
 * The three groups (ρυμοτομία / Γ.Π.Σ. / πολεοδομικές ρυθμίσεις) are the same
 * shape under three keys, so they are one factory called three times. Written out
 * they would be three ~60-line twins — and `ssot:discover`, being name-based,
 * would not see them.
 */
function institutionalActSection(group: ActGroupKey): SurveyListSection {
  const lens = actLens(group);
  const at = (record: SurveyRecord, index: number) => rowAt(record, lens, index);
  return {
    id: `a-acts-${group}`,
    titleKey: `acts.${group}`,
    addKey: 'acts.add',
    removeKey: 'acts.remove',
    emptyKey: 'acts.empty',
    ...lensBoundSection(lens, (row, index) => identifiedRowKey(row?.id, index)),
    rowFields: (index) => [
      {
        kind: 'text',
        part: 'reference',
        labelKey: 'acts.reference',
        read: (record) => at(record, index)?.reference ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, lens, index, (act) => ({ ...act, reference: next })),
      },
      {
        kind: 'text',
        multiline: true,
        part: 'note',
        labelKey: 'acts.note',
        read: (record) => at(record, index)?.note ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, lens, index, (act) => ({ ...act, note: next })),
      },
    ],
    gazettes: gazetteSubList(group),
  };
}

/** Section Α′ — the three act groups, in the order the printed form lists them. */
export const SURVEY_ACT_SECTIONS: readonly SurveyListSection[] =
  ACT_GROUP_KEYS.map(institutionalActSection);

// ---------------------------------------------------------------------------
// Section Η — ΠΑΡΑΤΗΡΗΣΕΙΣ
// ---------------------------------------------------------------------------

/**
 * A remark **is** a `Sourced<string>` — there is no row object around it, so the
 * row's single field reads and writes the row itself.
 */
export const SURVEY_REMARKS_SECTION: SurveyListSection = {
  id: 'i-remarks',
  titleKey: 'sections.i',
  addKey: 'remarks.add',
  removeKey: 'remarks.remove',
  emptyKey: 'remarks.empty',
  ...lensBoundSection(remarkLens, (_row, index) => `index-${index}`),
  rowFields: (index) => [
    {
      kind: 'text',
      multiline: true,
      labelKey: 'remarks.item',
      read: (record) => rowAt(record, remarkLens, index) ?? emptySourced<string>(),
      write: (record, next) => updateRow(record, remarkLens, index, () => next),
    },
  ],
};

// ---------------------------------------------------------------------------
// Section Θ — ΕΓΚΡΙΣΕΙΣ
// ---------------------------------------------------------------------------

export const SURVEY_APPROVALS_SECTION: SurveyListSection = {
  id: 'th-approvals',
  titleKey: 'sections.th',
  addKey: 'approvals.add',
  removeKey: 'approvals.remove',
  emptyKey: 'approvals.empty',
  ...lensBoundSection(approvalLens, (row, index) => identifiedRowKey(row?.id, index)),
  rowFields: (index) => {
    const at = (record: SurveyRecord) => rowAt(record, approvalLens, index);
    return [
      {
        // 🔴 **Τι** εγκρίνεται — χωριστό από το **ποιος** εγκρίνει, γιατί το σχέδιο γράφει
        // και τα δύο στην ίδια γραμμή και δεν είναι το ίδιο πράγμα (ADR-759 §2β.7).
        kind: 'text',
        part: 'subject',
        labelKey: 'approvals.subject',
        read: (record) => at(record)?.subject ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, approvalLens, index, (row) => ({ ...row, subject: next })),
      },
      {
        kind: 'text',
        part: 'authority',
        labelKey: 'approvals.authority',
        read: (record) => at(record)?.authority ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, approvalLens, index, (row) => ({ ...row, authority: next })),
      },
      {
        // Blank for both approvals in the G753 sample — and that is the point.
        kind: 'text',
        labelKey: 'approvals.protocolNumber',
        read: (record) => at(record)?.protocolNumber ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, approvalLens, index, (row) => ({ ...row, protocolNumber: next })),
      },
      {
        kind: 'text',
        labelKey: 'approvals.date',
        read: (record) => at(record)?.date ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, approvalLens, index, (row) => ({ ...row, date: next })),
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Section Ι — ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ
// ---------------------------------------------------------------------------

export const SURVEY_TITLE_DEEDS_SECTION: SurveyListSection = {
  id: 'iota-title-deeds',
  titleKey: 'sections.iota',
  addKey: 'titleDeeds.add',
  removeKey: 'titleDeeds.remove',
  emptyKey: 'titleDeeds.empty',
  ...lensBoundSection(titleDeedLens, (row, index) => identifiedRowKey(row?.id, index)),
  rowFields: (index) => {
    const at = (record: SurveyRecord) => rowAt(record, titleDeedLens, index);
    return [
      {
        kind: 'text',
        part: 'number',
        labelKey: 'titleDeeds.number',
        read: (record) => at(record)?.number ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, number: next })),
      },
      {
        kind: 'text',
        part: 'date',
        labelKey: 'titleDeeds.date',
        read: (record) => at(record)?.date ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, date: next })),
      },
      {
        kind: 'text',
        part: 'kind',
        labelKey: 'titleDeeds.kind',
        read: (record) => at(record)?.kind ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, kind: next })),
      },
      {
        kind: 'text',
        part: 'volume',
        labelKey: 'titleDeeds.volume',
        read: (record) => at(record)?.volume ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, volume: next })),
      },
      {
        kind: 'text',
        part: 'entry',
        labelKey: 'titleDeeds.entry',
        read: (record) => at(record)?.entry ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, entry: next })),
      },
      {
        kind: 'text',
        part: 'registry',
        labelKey: 'titleDeeds.registry',
        read: (record) => at(record)?.registry ?? emptySourced<string>(),
        write: (record, next) =>
          updateRow(record, titleDeedLens, index, (row) => ({ ...row, registry: next })),
      },
    ];
  },
  // The notary is NOT in `rowFields`: the written name and the contact link are one
  // control, because they answer one question together.
  linkedContact: {
    labelKey: 'titleDeeds.notaryName',
    linkedBadgeKey: 'titleDeeds.notaryContact',
    noLinkKey: 'titleDeeds.notaryContactNone',
    readName: (record, index) =>
      rowAt(record, titleDeedLens, index)?.notaryName ?? emptySourced<string>(),
    readLinkedId: (record, index) =>
      rowAt(record, titleDeedLens, index)?.notaryContactId ?? null,
    write: (record, index, name, linkedId) =>
      updateRow(record, titleDeedLens, index, (row) => ({
        ...row,
        notaryName: name,
        notaryContactId: linkedId,
      })),
  },
};

/** Every repeating section, flattened. Used by tests and by the order SSoT. */
export const SURVEY_LIST_SECTIONS: readonly SurveyListSection[] = [
  ...SURVEY_ACT_SECTIONS,
  SURVEY_REMARKS_SECTION,
  SURVEY_APPROVALS_SECTION,
  SURVEY_TITLE_DEEDS_SECTION,
];
