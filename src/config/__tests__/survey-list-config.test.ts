/**
 * ADR-759 Φ2β — anchors for the FOUR repeating sections (Α′ · Η · Θ · Ι).
 *
 * What this file is defending, in order of how badly it would hurt:
 *
 * 1. **Row identity.** Revit's contract for `UniqueId` is *assigned at creation,
 *    never changes*. Here that means an id is minted by `appendRow` and by nothing
 *    else — never during render, never on an edit. If it slipped into the render
 *    path, every keystroke would give the row a new identity and the notary link on
 *    a deed would follow the wrong row. Nothing about the screen would look wrong.
 * 2. **No cross-talk between rows.** With hand-written `read`/`write` pairs the
 *    characteristic bug is a mis-pasted index: row 1's field writing into row 0.
 *    Same type, no compiler complaint, wrong data.
 * 3. **The visible order.** The printed form interleaves (Α′ between Α and Β), so
 *    the eleven sections are asserted as one sequence — not seven here and four
 *    somewhere else, which is how the CHECK 3.34 namespace lists diverged by 63.
 * 4. **`relation` is never inferred.** ADR-759 Q3. One correction chain in one
 *    drawing is not a class.
 * 5. **Every i18n key the config names actually exists — in both languages.** This
 *    project has shipped raw keys to production with every static gate green
 *    (ADR-752). A config that names a key no locale has is exactly that failure.
 */
import elLocale from '@/i18n/locales/el/surveyRecord.json';
import enLocale from '@/i18n/locales/en/surveyRecord.json';
import { SURVEY_CARD_SECTIONS } from '../survey-card-config';
import {
  SURVEY_ACT_SECTIONS,
  SURVEY_APPROVALS_SECTION,
  SURVEY_LIST_SECTIONS,
  SURVEY_REMARKS_SECTION,
  SURVEY_TITLE_DEEDS_SECTION,
  type SurveyListSection,
} from '../survey-list-config';
import {
  orderedListSections,
  orderedScalarSections,
  SURVEY_CARD_ORDER,
} from '../survey-card-order';
import { createEmptySurveyRecord } from '@/lib/survey-record/survey-record-factory';
import { newGazetteRef } from '@/lib/survey-record/survey-list-rows';
import { userSourced, type SurveyRecord } from '@/types/project-survey-record';
import {
  expectNoCrossTalk,
  probeFromAccessor,
  probeFromGazetteAccessor,
  type FieldProbe,
} from './helpers/survey-field-probe';

// Ids must be DISTINCT per call — a fixed stub would hide the very bug that row
// identity exists to prevent (two rows sharing one id).
jest.mock('@/services/enterprise-id.service', () => {
  let counter = 0;
  return {
    generateSurveyRecordId: () => 'srv_test_fixed',
    generateSurveyActId: () => `svact_${++counter}`,
    generateSurveyApprovalId: () => `svapr_${++counter}`,
    generateSurveyTitleDeedId: () => `svdeed_${++counter}`,
  };
});

function blank(): SurveyRecord {
  return createEmptySurveyRecord({
    companyId: 'company-a',
    projectId: 'proj_1',
    createdBy: 'usr_1',
    now: '2026-08-05T10:00:00.000Z',
  });
}

/** Two rows in every repeating section, and one ΦΕΚ inside every act. */
function seeded(): SurveyRecord {
  let record = blank();
  for (const section of SURVEY_LIST_SECTIONS) {
    record = section.appendRow(record);
    record = section.appendRow(record);
    if (section.gazettes) {
      record = section.gazettes.appendRow(record, 0);
      record = section.gazettes.appendRow(record, 1);
    }
  }
  return record;
}

const ROWS_PER_SECTION = 2;

// ===========================================================================
// 1. The visible order
// ===========================================================================

describe('printed-form order (ADR-759 §2β.2)', () => {
  it('prints the eleven sections in the order of the survey sheet', () => {
    const sequence = SURVEY_CARD_ORDER.flatMap((entry) => {
      switch (entry.kind) {
        case 'scalar':
          return [entry.section.titleKey];
        case 'list':
          return [entry.section.titleKey];
        case 'listGroup':
          return [entry.titleKey, ...entry.sections.map((s) => s.titleKey)];
        default:
          throw new Error('unhandled entry kind');
      }
    });

    expect(sequence).toEqual([
      'sections.doc', // «Το έγγραφο» — εκτός φόρμας Α–Ι· ποιο έγγραφο διαβάζουμε (Φ3γ)
      'sections.a', // Α  ΟΡΟΙ ΔΟΜΗΣΗΣ
      'sections.aActs', // Α′ ΘΕΣΜΙΚΕΣ ΠΡΑΞΕΙΣ — between Α and Β, not appended
      'acts.urbanPlanDecree',
      'acts.generalUrbanPlan',
      'acts.zoningRegulations',
      'sections.b', // Β  ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ
      'sections.c', // Γ  ΑΡΤΙΟ & ΟΙΚΟΔΟΜΗΣΙΜΟ
      'sections.d', // Δ  ΚΑΘΟΡΙΣΜΟΣ ΡΥΜΟΤΟΜΙΑΣ
      'sections.e', // Ε  ΕΚΤΟΣ ΑΝΑΣΤΟΛΗΣ
      'sections.st', // ΣΤ ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ
      'sections.z', // Ζ  ΑΦΕΤΗΡΙΑ ΥΨΟΥΣ
      'sections.i', // Η  ΠΑΡΑΤΗΡΗΣΕΙΣ
      'sections.th', // Θ  ΕΓΚΡΙΣΕΙΣ
      'sections.iota', // Ι  ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ
    ]);
  });

  it('renders every section that is defined, exactly once', () => {
    // 🔴 The gate that a new section cannot be written and silently not appear.
    // Defining a section and forgetting to add it to the order is invisible
    // otherwise: no type error, no missing key, just a field nobody can fill.
    expect(orderedScalarSections()).toEqual(SURVEY_CARD_SECTIONS);
    expect(orderedListSections()).toEqual(SURVEY_LIST_SECTIONS);
  });

  it('uses a unique id across scalar and repeating sections alike', () => {
    const ids = [
      ...SURVEY_CARD_SECTIONS.map((s) => s.id),
      ...SURVEY_LIST_SECTIONS.map((s) => s.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives section Α′ its three act groups, in document order', () => {
    expect(SURVEY_ACT_SECTIONS.map((s) => s.titleKey)).toEqual([
      'acts.urbanPlanDecree',
      'acts.generalUrbanPlan',
      'acts.zoningRegulations',
    ]);
  });
});

// ===========================================================================
// 2. Row identity — the Revit invariant
// ===========================================================================

describe('row identity', () => {
  const identified: readonly [string, SurveyListSection][] = [
    ['acts', SURVEY_ACT_SECTIONS[0]],
    ['approvals', SURVEY_APPROVALS_SECTION],
    ['titleDeeds', SURVEY_TITLE_DEEDS_SECTION],
  ];

  it.each(identified)('%s: appending twice gives two distinct enterprise ids', (_name, section) => {
    const record = section.appendRow(section.appendRow(blank()));
    expect(section.count(record)).toBe(2);
    const first = section.rowKey(record, 0);
    const second = section.rowKey(record, 1);
    expect(first).not.toBe(second);
    expect(first).toMatch(/^(svact|svapr|svdeed)_/);
  });

  it.each(identified)('%s: editing a field never re-mints the row id', (_name, section) => {
    // 🔴 Revit's `UniqueId` contract. If `appendRow` ever reached the render path
    // this would fail — and nothing on screen would look wrong.
    const record = section.appendRow(blank());
    const idBefore = section.rowKey(record, 0);
    const [field] = section.rowFields(0);
    const edited = field.write(record, userSourced<string>('anything'));
    expect(section.rowKey(edited, 0)).toBe(idBefore);
  });

  it.each(identified)('%s: removing row 0 keeps row 1 its own id', (_name, section) => {
    // The off-by-one detector: a `removeRow` that rebuilt rows instead of filtering
    // would silently hand row 1's data a new identity.
    const record = section.appendRow(section.appendRow(blank()));
    const secondId = section.rowKey(record, 1);
    const after = section.removeRow(record, 0);
    expect(section.count(after)).toBe(1);
    expect(section.rowKey(after, 0)).toBe(secondId);
  });

  it('remarks are value objects: identity is position, not an id', () => {
    // IFC's line between rooted entities and value objects, applied. A remark is a
    // string with a provenance — minting an id would claim an independence it has not.
    const record = SURVEY_REMARKS_SECTION.appendRow(blank());
    expect(SURVEY_REMARKS_SECTION.rowKey(record, 0)).toBe('index-0');
    expect(Object.keys(record.remarks[0] ?? {})).not.toContain('id');
  });

  it('a ΦΕΚ reference is a value object too', () => {
    expect(Object.keys(newGazetteRef())).not.toContain('id');
  });
});

// ===========================================================================
// 3. No cross-talk — the generalised Ζ.8 anchor
// ===========================================================================

/** Every `Sourced` accessor the card owns: scalar fields plus two rows per list. */
function allSourcedProbes(): readonly FieldProbe[] {
  const probes: FieldProbe[] = SURVEY_CARD_SECTIONS.flatMap((section) =>
    section.fields.map((field) => probeFromAccessor(`scalar:${field.labelKey}`, field))
  );

  for (const section of SURVEY_LIST_SECTIONS) {
    for (let index = 0; index < ROWS_PER_SECTION; index += 1) {
      for (const field of section.rowFields(index)) {
        probes.push(probeFromAccessor(`${section.id}[${index}]:${field.labelKey}`, field));
      }
      const linked = section.linkedContact;
      if (linked) {
        probes.push({
          id: `${section.id}[${index}]:${linked.labelKey}`,
          read: (record) => linked.readName(record, index).value,
          write: (record, seed) =>
            linked.write(record, index, userSourced<string>(`probe-${seed}`), null),
        });
      }
    }
  }
  return probes;
}

/** Every ΦΕΚ accessor: one gazette inside each of the two acts of each group. */
function allGazetteProbes(): readonly FieldProbe[] {
  const probes: FieldProbe[] = [];
  for (const section of SURVEY_ACT_SECTIONS) {
    const gazettes = section.gazettes;
    if (!gazettes) continue;
    for (let actIndex = 0; actIndex < ROWS_PER_SECTION; actIndex += 1) {
      for (const field of gazettes.fields(actIndex, 0)) {
        probes.push(
          probeFromGazetteAccessor(`${section.id}[${actIndex}].g0:${field.labelKey}`, field)
        );
      }
    }
  }
  return probes;
}

describe('no accessor writes into another', () => {
  it('holds across every scalar field and every list row', () => {
    expectNoCrossTalk(allSourcedProbes(), seeded);
  });

  it('holds across every ΦΕΚ field of every act of every group', () => {
    expectNoCrossTalk(allGazetteProbes(), seeded);
  });

  it('keeps the three act groups independent', () => {
    // Three groups built from one factory: the bug this catches is the factory
    // ignoring its key and every group writing into the first one.
    const record = SURVEY_ACT_SECTIONS[1].appendRow(blank());
    expect(SURVEY_ACT_SECTIONS[0].count(record)).toBe(0);
    expect(SURVEY_ACT_SECTIONS[1].count(record)).toBe(1);
    expect(SURVEY_ACT_SECTIONS[2].count(record)).toBe(0);
  });

  it('keeps a ΦΕΚ inside the act that owns it', () => {
    const section = SURVEY_ACT_SECTIONS[0];
    const gazettes = section.gazettes;
    if (!gazettes) throw new Error('the act section must declare a gazette sub-list');
    const record = gazettes.appendRow(section.appendRow(section.appendRow(blank())), 1);
    expect(gazettes.count(record, 0)).toBe(0);
    expect(gazettes.count(record, 1)).toBe(1);
  });

  it('leaves record identity and tenant scope alone', () => {
    const before = seeded();
    for (const section of SURVEY_LIST_SECTIONS) {
      const after = section.appendRow(before);
      expect(after.id).toBe(before.id);
      expect(after.companyId).toBe(before.companyId);
      expect(after.projectId).toBe(before.projectId);
      expect(after.confirmedBy).toBeNull();
    }
  });
});

// ===========================================================================
// 4. ΦΕΚ semantics — rawText required, relation never inferred
// ===========================================================================

describe('ΦΕΚ semantics (ADR-759 Q3)', () => {
  const section = SURVEY_ACT_SECTIONS[0];

  function withOneGazette(): SurveyRecord {
    const gazettes = section.gazettes;
    if (!gazettes) throw new Error('the act section must declare a gazette sub-list');
    return gazettes.appendRow(section.appendRow(blank()), 0);
  }

  function fieldByKey(key: string) {
    const gazettes = section.gazettes;
    if (!gazettes) throw new Error('the act section must declare a gazette sub-list');
    const field = gazettes.fields(0, 0).find((f) => f.labelKey === key);
    if (!field) throw new Error(`no gazette field ${key}`);
    return field;
  }

  it('creates rawText as the only non-null part', () => {
    const fresh = newGazetteRef();
    expect(fresh.rawText).toBe('');
    expect(fresh.number).toBeNull();
    expect(fresh.series).toBeNull();
    expect(fresh.date).toBeNull();
    // 🔴 Never guessed. Only an explicit human choice writes here.
    expect(fresh.relation).toBeNull();
  });

  it('marks rawText required and the triple optional', () => {
    const gazettes = section.gazettes;
    if (!gazettes) throw new Error('the act section must declare a gazette sub-list');
    const required = gazettes
      .fields(0, 0)
      .filter((f) => f.kind === 'text' && f.required)
      .map((f) => f.labelKey);
    expect(required).toEqual(['gazette.rawText']);
  });

  it('stores a cleared optional part as null, and a cleared rawText as empty text', () => {
    // The distinction matters: `rawText` is typed `string` because the verbatim
    // reference is the one thing that must never become "absent".
    const record = withOneGazette();
    const number = fieldByKey('gazette.number');
    const raw = fieldByKey('gazette.rawText');

    const withNumber = number.kind === 'text' ? number.write(record, '963') : record;
    expect(withNumber.institutionalActs.urbanPlanDecree[0]?.gazettes[0]?.number).toBe('963');

    const cleared = number.kind === 'text' ? number.write(withNumber, '') : withNumber;
    expect(cleared.institutionalActs.urbanPlanDecree[0]?.gazettes[0]?.number).toBeNull();

    const clearedRaw = raw.kind === 'text' ? raw.write(cleared, '') : cleared;
    expect(clearedRaw.institutionalActs.urbanPlanDecree[0]?.gazettes[0]?.rawText).toBe('');
  });

  it('round-trips an explicitly chosen relation and an explicit clearing', () => {
    const record = withOneGazette();
    const relation = fieldByKey('gazette.relation');
    if (relation.kind !== 'relation') throw new Error('gazette.relation must be a relation field');

    expect(relation.read(record)).toBeNull();
    const chosen = relation.write(record, 'correction');
    expect(relation.read(chosen)).toBe('correction');
    expect(relation.read(relation.write(chosen, null))).toBeNull();
  });
});

// ===========================================================================
// 5. Totality — an index that no longer exists must not throw
// ===========================================================================

describe('out-of-range access is total', () => {
  it.each(SURVEY_LIST_SECTIONS.map((s) => [s.id, s] as const))(
    '%s: reading a missing row yields empty, not an exception',
    (_id, section) => {
      const record = blank();
      const [field] = section.rowFields(5);
      expect(field.read(record).value).toBeNull();
    }
  );

  it.each(SURVEY_LIST_SECTIONS.map((s) => [s.id, s] as const))(
    '%s: writing to a missing row is a no-op',
    (_id, section) => {
      // A pending edit can name a row the user has just removed. That must leave the
      // record alone rather than resurrect a phantom row.
      const record = blank();
      const [field] = section.rowFields(5);
      expect(field.write(record, userSourced<string>('ghost'))).toBe(record);
      expect(section.count(record)).toBe(0);
    }
  );

  it.each(SURVEY_LIST_SECTIONS.map((s) => [s.id, s] as const))(
    '%s: removing a missing row is a no-op',
    (_id, section) => {
      const record = section.appendRow(blank());
      expect(section.removeRow(record, 9)).toBe(record);
      expect(section.count(record)).toBe(1);
    }
  );
});

// ===========================================================================
// 6. Every key the config names exists — in BOTH languages
// ===========================================================================

describe('i18n reachability of every key the config names', () => {
  function resolve(locale: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => {
      if (typeof node !== 'object' || node === null) return undefined;
      return (node as Record<string, unknown>)[part];
    }, locale);
  }

  function keysNamedByConfig(): readonly string[] {
    const keys = new Set<string>(['provenance.empty', 'actions.clear', 'gazette.relationNone']);

    for (const section of SURVEY_CARD_SECTIONS) {
      keys.add(section.titleKey);
      for (const field of section.fields) {
        keys.add(field.labelKey);
        if (field.hintKey) keys.add(field.hintKey);
      }
    }

    for (const entry of SURVEY_CARD_ORDER) {
      if (entry.kind === 'listGroup') keys.add(entry.titleKey);
    }

    for (const section of SURVEY_LIST_SECTIONS) {
      keys.add(section.titleKey);
      keys.add(section.addKey);
      keys.add(section.removeKey);
      keys.add(section.emptyKey);
      for (const field of section.rowFields(0)) {
        keys.add(field.labelKey);
        if (field.hintKey) keys.add(field.hintKey);
      }
      const gazettes = section.gazettes;
      if (gazettes) {
        keys.add(gazettes.titleKey);
        keys.add(gazettes.addKey);
        keys.add(gazettes.removeKey);
        keys.add(gazettes.emptyKey);
        for (const field of gazettes.fields(0, 0)) {
          keys.add(field.labelKey);
          if (field.hintKey) keys.add(field.hintKey);
        }
      }
      const linked = section.linkedContact;
      if (linked) {
        keys.add(linked.labelKey);
        keys.add(linked.linkedBadgeKey);
        keys.add(linked.noLinkKey);
      }
    }

    for (const key of ['searchResults', 'noResults', 'useFreeText']) {
      keys.add(`picker.${key}`);
    }
    for (const key of ['relationOriginal', 'relationCorrection', 'relationRevision']) {
      keys.add(`gazette.${key}`);
    }

    return [...keys].sort();
  }

  it.each(keysNamedByConfig().map((key) => [key] as const))(
    '%s resolves to text in el and en',
    (key) => {
      // 🔴 ADR-752: six namespaces shipped raw keys to production with every static
      // gate green, because nothing compared what the code names against what the
      // locales hold. This is that comparison, for this card.
      expect({ locale: 'el', key, value: typeof resolve(elLocale, key) }).toEqual({
        locale: 'el',
        key,
        value: 'string',
      });
      expect({ locale: 'en', key, value: typeof resolve(enLocale, key) }).toEqual({
        locale: 'en',
        key,
        value: 'string',
      });
    }
  );
});
