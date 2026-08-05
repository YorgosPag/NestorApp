/**
 * @related ADR-759 §4.2 / Φ2β — the immutable algebra of the survey record's LISTS
 *
 * Sections Α′ (institutional acts), Η (remarks), Θ (approvals) and Ι (title deeds)
 * are repeating lists, and a list needs four operations: read, append, remove,
 * update-one. Written out per section that is 4 × 4 = sixteen near-identical
 * functions — the sibling clone CLAUDE.md N.18 exists to stop, and the one
 * `ssot:discover` (name-based) cannot see because every copy has a different name.
 *
 * 🔑 So the four operations are written ONCE, over a {@link ListLens}: a triple of
 * "where the rows live" + "how to put them back" + "how to make a new one". Each
 * section contributes only its lens. The nested ΦΕΚ list proves the design — its
 * lens is *composed* from the act lens (see {@link gazetteLens}) rather than
 * duplicating the traversal.
 *
 * 🔴 WHO GETS AN ID, AND WHY IT IS A RULE. `InstitutionalAct`, `SurveyApproval` and
 * `SurveyTitleDeed` carry an enterprise id; `GazetteRef` and the remark strings
 * carry none. That is not an oversight — it is the line IFC draws between *rooted*
 * entities (subtypes of `IfcRoot`, which own a `GlobalId`) and non-rooted **value
 * objects** such as `IfcDocumentReference`, which exist only through whoever
 * references them and get no identity of their own. Revit draws it the same way:
 * every element carries a `UniqueId` fixed at creation, while the parameters inside
 * it are identified by their definition, not by an id.
 *
 * 🔴 AND THE ID IS MINTED EXACTLY ONCE. Revit's contract for `UniqueId` is
 * "assigned when the element is created, never changes afterwards". Here that means
 * the `create()` of a lens may only ever be reached from an **event handler**.
 * Calling it during render would mint a fresh id every frame, and row identity —
 * React keys, focus, the notary link on a deed — would dissolve silently.
 * `survey-list-config.test.ts` holds that invariant.
 */
import {
  generateSurveyActId,
  generateSurveyApprovalId,
  generateSurveyTitleDeedId,
} from '@/services/enterprise-id.service';
import {
  emptySourced,
  type GazetteRef,
  type InstitutionalAct,
  type Sourced,
  type SurveyApproval,
  type SurveyRecord,
  type SurveyTitleDeed,
} from '@/types/project-survey-record';

// ---------------------------------------------------------------------------
// Generic, total array operations. Out-of-range is a no-op, never a throw:
// a row can be removed while a pending edit still names its index.
// ---------------------------------------------------------------------------

function replaceAt<T>(list: readonly T[], index: number, next: T): readonly T[] {
  return list.map((item, i) => (i === index ? next : item));
}

function removeAt<T>(list: readonly T[], index: number): readonly T[] {
  return list.filter((_, i) => i !== index);
}

// ---------------------------------------------------------------------------
// The lens
// ---------------------------------------------------------------------------

/**
 * Everything the four list operations need to know about one repeating section.
 *
 * `create` is separate from `read`/`write` on purpose: it is the only member that
 * has a side effect on identity (it mints an id), and keeping it named makes the
 * "creation only" rule visible at every call site.
 */
export interface ListLens<TRow> {
  read(record: SurveyRecord): readonly TRow[];
  write(record: SurveyRecord, rows: readonly TRow[]): SurveyRecord;
  /** 🔴 Mints identity. Reachable from event handlers only — never from render. */
  create(): TRow;
}

/** Append one fresh, empty row. */
export function appendRow<TRow>(record: SurveyRecord, lens: ListLens<TRow>): SurveyRecord {
  return lens.write(record, [...lens.read(record), lens.create()]);
}

/** Drop row `index`. Out-of-range leaves the record untouched. */
export function removeRow<TRow>(
  record: SurveyRecord,
  lens: ListLens<TRow>,
  index: number
): SurveyRecord {
  const rows = lens.read(record);
  if (index < 0 || index >= rows.length) return record;
  return lens.write(record, removeAt(rows, index));
}

/**
 * Rewrite row `index` through `patch`.
 *
 * The row is passed in so a patch never has to re-find it — which is how a
 * hand-written editor ends up writing into its neighbour.
 */
export function updateRow<TRow>(
  record: SurveyRecord,
  lens: ListLens<TRow>,
  index: number,
  patch: (row: TRow) => TRow
): SurveyRecord {
  const rows = lens.read(record);
  const row = rows[index];
  if (row === undefined) return record;
  return lens.write(record, replaceAt(rows, index, patch(row)));
}

/** Row `index`, or `undefined` when it no longer exists. */
export function rowAt<TRow>(
  record: SurveyRecord,
  lens: ListLens<TRow>,
  index: number
): TRow | undefined {
  return lens.read(record)[index];
}

// ---------------------------------------------------------------------------
// Section Α′ — institutional acts, in three groups that differ ONLY by key
// ---------------------------------------------------------------------------

/**
 * The three act groups of section Α′. They are three keys of one shape, so they
 * share one lens factory instead of three copies.
 */
export type ActGroupKey = 'urbanPlanDecree' | 'generalUrbanPlan' | 'zoningRegulations';

export const ACT_GROUP_KEYS: readonly ActGroupKey[] = [
  'urbanPlanDecree',
  'generalUrbanPlan',
  'zoningRegulations',
];

/** A new act: an enterprise id, and everything else explicitly empty. */
export function newInstitutionalAct(): InstitutionalAct {
  return {
    id: generateSurveyActId(),
    reference: emptySourced<string>(),
    gazettes: [],
    note: emptySourced<string>(),
  };
}

export function actLens(group: ActGroupKey): ListLens<InstitutionalAct> {
  return {
    read: (record) => record.institutionalActs[group],
    write: (record, rows) => ({
      ...record,
      institutionalActs: { ...record.institutionalActs, [group]: rows },
    }),
    create: newInstitutionalAct,
  };
}

// ---------------------------------------------------------------------------
// The ΦΕΚ list nested inside one act
// ---------------------------------------------------------------------------

/**
 * A brand-new gazette reference.
 *
 * `rawText` starts `''` because ADR-759 Q3 makes it **required by signature**: the
 * verbatim reference is the one thing that must survive even when nothing parses.
 * The structured triple starts `null` — unparsed is a state, not a gap.
 *
 * 🔴 `relation` starts `null` and is **never** inferred. ADR-759 Q3: we have seen
 * one correction chain in one drawing, and one sample is not a class. Only an
 * explicit human choice may set it; the Φ4 reader must leave it alone and let
 * `rawText` carry the chain.
 */
export function newGazetteRef(): GazetteRef {
  return { rawText: '', number: null, series: null, date: null, relation: null };
}

/**
 * The gazettes of act `actIndex` in group `group`.
 *
 * 🔑 This is where the lens design earns itself: the nested list is not a second
 * traversal, it is the act lens **composed with itself**. `write` delegates to
 * {@link updateRow}, so there is exactly one implementation of "replace one act"
 * in the file, and the nested case cannot drift away from the flat case.
 */
export function gazetteLens(group: ActGroupKey, actIndex: number): ListLens<GazetteRef> {
  const acts = actLens(group);
  return {
    read: (record) => acts.read(record)[actIndex]?.gazettes ?? [],
    write: (record, rows) =>
      updateRow(record, acts, actIndex, (act) => ({ ...act, gazettes: rows })),
    create: newGazetteRef,
  };
}

// ---------------------------------------------------------------------------
// Sections Η / Θ / Ι
// ---------------------------------------------------------------------------

/**
 * Section Η — remarks.
 *
 * A remark **is** a `Sourced<string>`: there is no row object wrapping it, and so
 * no id. It is a value, and its identity is its position — the same call IFC makes
 * for a non-rooted reference.
 */
export const remarkLens: ListLens<Sourced<string>> = {
  read: (record) => record.remarks,
  write: (record, rows) => ({ ...record, remarks: rows }),
  create: () => emptySourced<string>(),
};

/** Section Θ — approvals. Protocol numbers are blank in G753; blank is data. */
export function newSurveyApproval(): SurveyApproval {
  return {
    id: generateSurveyApprovalId(),
    authority: emptySourced<string>(),
    protocolNumber: emptySourced<string>(),
    date: emptySourced<string>(),
  };
}

export const approvalLens: ListLens<SurveyApproval> = {
  read: (record) => record.approvals,
  write: (record, rows) => ({ ...record, approvals: rows }),
  create: newSurveyApproval,
};

/**
 * Section Ι — title deeds.
 *
 * `notaryContactId` starts `null` deliberately. The drawing states a **name**;
 * who that name *is* remains an open question until a human links a contact.
 * Reading is not identification (ADR-745 §8) — so the two live side by side.
 */
export function newSurveyTitleDeed(): SurveyTitleDeed {
  return {
    id: generateSurveyTitleDeedId(),
    number: emptySourced<string>(),
    date: emptySourced<string>(),
    kind: emptySourced<string>(),
    notaryName: emptySourced<string>(),
    notaryContactId: null,
    volume: emptySourced<string>(),
    entry: emptySourced<string>(),
    registry: emptySourced<string>(),
  };
}

export const titleDeedLens: ListLens<SurveyTitleDeed> = {
  read: (record) => record.titleDeeds,
  write: (record, rows) => ({ ...record, titleDeeds: rows }),
  create: newSurveyTitleDeed,
};
