/**
 * @fileoverview **Το σύνορο ανάγνωσης του αποθηκευμένου στιγμιότυπου** (ADR-947 Δ3) — από `unknown` (Firestore) σε
 * `ObjectiveValueSnapshot`, ή `null`. Καθαρό, χωρίς I/O.
 * @related `objective-value-snapshot.ts` (το μοντέλο · το αποτύπωμα) ·
 *   `services/objective-value/objective-value-snapshots.server.ts` (ο ΜΟΝΟΣ γραφέας και αναγνώστης)
 * @module lib/objective-value/objective-value-snapshot-record
 *
 * 🔑 **Δύο φράχτες, όχι ένας**: (1) αυτός εδώ ελέγχει το **σχήμα** (σχήμα 1, πεδία με τύπο)· (2) ο αναγνώστης
 *    ξαναϋπολογίζει το **αποτύπωμα** και το συγκρίνει με το αποθηκευμένο — έγγραφο που άλλαξε μετά τη γραφή (χειροκίνητα
 *    στην κονσόλα, ή από σφάλμα) **δεν** διαβάζεται ως στιγμιότυπο. Ο πρώτος πιάνει «δεν είναι στιγμιότυπο», ο δεύτερος
 *    «ήταν, και πειράχτηκε».
 */

import { OBJECTIVE_VALUE_SNAPSHOT_SCHEMA, type ObjectiveValueSnapshot } from './objective-value-snapshot';

type Fields = Readonly<Record<string, unknown>>;

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasStrings(record: Fields, keys: readonly string[]): boolean {
  return keys.every((key) => typeof record[key] === 'string');
}

function isComputedResult(value: unknown): boolean {
  return isFields(value) && value.kind === 'computed' && typeof value.value === 'number' && Array.isArray(value.factors);
}

function isZone(value: unknown): boolean {
  if (!isFields(value) || typeof value.price !== 'number') return false;
  if (value.kind === 'manual') return true;
  return value.kind === 'valueZones' && isFields(value.point) && isFields(value.table) && typeof value.validFrom === 'string';
}

function isIssuer(value: unknown): boolean {
  return isFields(value) && hasStrings(value, ['companyId', 'name', 'qualification']);
}

function hasEnvelope(record: Fields): boolean {
  return record.schema === OBJECTIVE_VALUE_SNAPSHOT_SCHEMA && hasStrings(record, ['id', 'digest', 'companyId', 'createdAt', 'createdBy', 'valuationDate']);
}

function hasContent(record: Fields): boolean {
  return (
    isFields(record.subject) &&
    isFields(record.draft) &&
    isFields(record.provenance) &&
    isFields(record.engine) &&
    isZone(record.zone) &&
    isComputedResult(record.result) &&
    isIssuer(record.issuer)
  );
}

/** Είναι αυτό αποθηκευμένο στιγμιότυπο του τρέχοντος σχήματος; (Το αποτύπωμα το ελέγχει ο αναγνώστης.) */
export function isObjectiveValueSnapshotRecord(value: unknown): value is ObjectiveValueSnapshot {
  return isFields(value) && hasEnvelope(value) && hasContent(value);
}
