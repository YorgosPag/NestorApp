/**
 * Shared probe machinery for the ADR-759 card anchors.
 *
 * 🔑 WHY THIS IS A HELPER AND NOT COPIED INTO EACH TEST. Both the scalar-card anchor
 * and the repeating-list anchor ask the same question — *"does writing through this
 * accessor move anything it should not?"* — over accessors of the same type. Written
 * twice, the two copies drift, and the day one of them stops asserting the crucial
 * part nothing notices. It is also exactly the sibling clone N.18 forbids, in the one
 * place people assume the rule does not apply.
 *
 * 🔴 THE FAILURE THIS DETECTS IS INVISIBLE TO THE COMPILER. With hand-written
 * `read`/`write` pairs, the characteristic bug is a mis-pasted line: `maxCoveragePct`
 * writing into `declaredCoveragePct`, or the field of deed row 1 writing into deed
 * row 0. Both sides have the same type, so it compiles, the form renders, the label
 * is right, and the value lands somewhere else. Only a round-trip over EVERY accessor
 * can see it.
 */
import type { FieldAccessor } from '@/config/survey-card-config';
import type { GazetteFieldAccessor } from '@/config/survey-list-config';
import { userSourced, type SurveyRecord } from '@/types/project-survey-record';

/** One accessor, reduced to "read a comparable value" + "write a distinguishable one". */
export interface FieldProbe {
  /** Human-readable identity, shown when an assertion fails. */
  readonly id: string;
  read(record: SurveyRecord): unknown;
  write(record: SurveyRecord, seed: number): SurveyRecord;
}

/** A probe over a `Sourced` field accessor — the scalar card and the list rows. */
export function probeFromAccessor(id: string, field: FieldAccessor): FieldProbe {
  switch (field.kind) {
    case 'text':
      return {
        id,
        read: (record) => field.read(record).value,
        write: (record, seed) => field.write(record, userSourced<string>(`probe-${seed}`)),
      };
    case 'number':
      return {
        id,
        read: (record) => field.read(record).value,
        write: (record, seed) => field.write(record, userSourced<number>(seed)),
      };
    case 'boolean':
      return {
        id,
        read: (record) => field.read(record).value,
        write: (record) => field.write(record, userSourced<boolean>(true)),
      };
    case 'textList':
      return {
        id,
        read: (record) => field.read(record).value,
        write: (record, seed) =>
          field.write(record, userSourced<readonly string[]>([`probe-${seed}`])),
      };
    default: {
      const never: never = field;
      throw new Error(`probeFromAccessor: unhandled kind ${String(never)}`);
    }
  }
}

/**
 * A probe over a ΦΕΚ field accessor.
 *
 * These are plain values, not `Sourced`, and their pristine baseline is `''` (or
 * `null` for `relation`) rather than `null` — which is precisely why
 * {@link expectNoCrossTalk} compares against the pristine record instead of assuming
 * a baseline.
 */
export function probeFromGazetteAccessor(id: string, field: GazetteFieldAccessor): FieldProbe {
  switch (field.kind) {
    case 'text':
      return {
        id,
        read: (record) => field.read(record),
        write: (record, seed) => field.write(record, `probe-${seed}`),
      };
    case 'relation':
      return {
        id,
        read: (record) => field.read(record),
        write: (record) => field.write(record, 'correction'),
      };
    default: {
      const never: never = field;
      throw new Error(`probeFromGazetteAccessor: unhandled kind ${String(never)}`);
    }
  }
}

/**
 * Write through every probe in turn and assert that **only** that probe's value moved.
 *
 * `makeRecord` is called fresh for each write so the probes never see each other's
 * edits. The baseline is read off a pristine record rather than hard-coded, so the
 * same function serves `Sourced` fields (baseline `null`), a required `rawText`
 * (baseline `''`) and a relation (baseline `null`) without knowing the difference.
 */
export function expectNoCrossTalk(
  probes: readonly FieldProbe[],
  makeRecord: () => SurveyRecord
): void {
  const before = probes.map((probe) => probe.read(makeRecord()));

  probes.forEach((probe, index) => {
    const written = probe.write(makeRecord(), index + 1);
    const after = probes.map((other) => other.read(written));

    // The write actually landed — a no-op `write` would pass the leak check trivially.
    expect({ probe: probe.id, changed: after[index] !== before[index] }).toEqual({
      probe: probe.id,
      changed: true,
    });

    probes.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      expect({
        wrote: probe.id,
        leakedInto: other.id,
        value: after[otherIndex],
      }).toEqual({
        wrote: probe.id,
        leakedInto: other.id,
        value: before[otherIndex],
      });
    });
  });
}
