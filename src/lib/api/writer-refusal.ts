/**
 * @fileoverview **Η μία ερμηνεία μιας άρνησης γραφέα, για την οθόνη** — κλειστό λεξιλόγιο ειδών + ευρήματα με κωδικό.
 * @related lib/api/api-client-types.ts (`apiErrorBodyOf` — ο ΕΝΑΣ κριτής του σώματος άρνησης) ·
 *   services/catalog/catalog-failure.ts (ADR-923) · services/procurement/subcontracts/subcontract-failure.ts (ADR-928)
 * @module lib/api/writer-refusal
 *
 * Οι γραφείς με κλειστό σύνολο ειδών (κατάλογος ADR-923 §5.9 · υπεργολαβία ADR-928) στέλνουν `errorCode = <πρόθεμα><είδος>`
 * και ευρήματα `{ code, path }` στο σώμα. Ως την Φ3α-2 του ADR-928 η ερμηνεία ζούσε μέσα στο `catalog-failure` — η
 * υπεργολαβία θα ήταν κλώνος του (CHECK 3.28). Εδώ μόνο το κοινό· κάθε τομέας προσθέτει τα δικά του πεδία.
 *
 * 🔑 **Ρητή ένωση, ποτέ εξαίρεση προς τα πάνω**: η οθόνη κάνει `switch` στο `kind`.
 * ⚠️ Το σώμα έρχεται από το δίκτυο ⇒ κάθε εύρημα **ελέγχεται** από τον τομέα (`issueOf`) πριν γίνει δεκτό.
 */

import { ApiClientError, apiErrorBodyOf } from './enterprise-api-client';

/** Τα είδη που δεν είναι του γραφέα: άρνηση συνόρου, δίκτυο (δεν ξέρουμε αν έφτασε), οτιδήποτε άλλο. */
export const TRANSPORT_REFUSAL_KINDS = ['forbidden', 'network', 'unknown'] as const;
export type TransportRefusalKind = (typeof TRANSPORT_REFUSAL_KINDS)[number];

export interface WriterRefusalSpec<K extends string, I> {
  /** Π.χ. `catalog.` · `subcontracts.` */
  readonly errorCodePrefix: string;
  readonly kinds: readonly K[];
  /** Ένα εύρημα από το σύρμα, ή `null` όταν δεν ανήκει στο λεξιλόγιο του τομέα. */
  readonly issueOf: (raw: Readonly<Record<string, unknown>>) => I | null;
}

export interface WriterRefusal<K extends string, I> {
  readonly kind: K | TransportRefusalKind;
  readonly issues: readonly I[];
  /** Το σώμα της άρνησης — για τα πεδία που ξέρει μόνο ο τομέας (π.χ. `currentRevision`). */
  readonly body: Readonly<Record<string, unknown>> | null;
}

function issuesOf<I>(raw: unknown, issueOf: (raw: Readonly<Record<string, unknown>>) => I | null): I[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): I[] => {
    if (item === null || typeof item !== 'object') return [];
    const issue = issueOf(item as Record<string, unknown>);
    return issue === null ? [] : [issue];
  });
}

function writerKindOf<K extends string>(errorCode: unknown, spec: WriterRefusalSpec<K, unknown>): K | null {
  if (typeof errorCode !== 'string' || !errorCode.startsWith(spec.errorCodePrefix)) return null;
  const kind = errorCode.slice(spec.errorCodePrefix.length);
  return (spec.kinds as readonly string[]).includes(kind) ? (kind as K) : null;
}

/** **Η μία ερμηνεία** μιας αποτυχημένης εγγραφής. */
export function writerRefusalOf<K extends string, I>(cause: unknown, spec: WriterRefusalSpec<K, I>): WriterRefusal<K, I> {
  if (!ApiClientError.isApiClientError(cause)) return { kind: 'network', issues: [], body: null };
  const body = apiErrorBodyOf(cause);
  const kind = writerKindOf(body?.errorCode ?? cause.errorCode, spec);
  if (kind) return { kind, issues: issuesOf(body?.issues, spec.issueOf), body };
  if (cause.statusCode === 401 || cause.statusCode === 403) return { kind: 'forbidden', issues: [], body };
  if (cause.statusCode === 0) return { kind: 'network', issues: [], body };
  return { kind: 'unknown', issues: [], body };
}

/** Το `currentRevision` μιας άρνησης CAS, όπως το στέλνουν οι γραφείς με κλειστό σύνολο ειδών. */
export function currentRevisionOf(body: Readonly<Record<string, unknown>> | null): number | null {
  const revision = body?.currentRevision;
  return typeof revision === 'number' ? revision : null;
}
