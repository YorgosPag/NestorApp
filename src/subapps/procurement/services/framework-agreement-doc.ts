import 'server-only';

/**
 * Framework Agreement — persistence shape and its serializer to the wire shape.
 *
 * Kept out of `types/framework-agreement.ts` because that module is imported by
 * client components: the persistence shape is an Admin-SDK concern and has no
 * business being reachable from the browser bundle.
 *
 * @see ADR-330 §3 Phase 5 — Framework Agreements
 * @see ADR-663 §4 part 5 — the three timestamp representations
 * @see ADR-218 — `normalizeToISO` is the single Timestamp → ISO converter
 */

import { normalizeToISO } from '@/lib/date-local';
import type {
  FrameworkAgreement,
  FrameworkAgreementTimestampField,
  FrameworkAgreementWire,
} from '../types/framework-agreement';

/**
 * What the Admin SDK actually reads from and writes to Firestore.
 *
 * Identical to `FrameworkAgreement` except that instants are **admin**
 * `Timestamp`s. The two are not interchangeable — the admin one lacks
 * `toJSON()`, which is exactly what makes it unfit to leave the server.
 */
export type FrameworkAgreementDoc =
  Omit<FrameworkAgreement, FrameworkAgreementTimestampField> &
  Record<FrameworkAgreementTimestampField, FirebaseFirestore.Timestamp>;

/**
 * Serialize a stored agreement for the HTTP response.
 *
 * Every instant field is listed explicitly on purpose: `FrameworkAgreementWire`
 * requires all of them, so adding a fifth instant field to
 * `FrameworkAgreementTimestampField` fails to compile here until it is mapped.
 */
export function toFrameworkAgreementWire(doc: FrameworkAgreementDoc): FrameworkAgreementWire {
  return {
    ...doc,
    validFrom: normalizeToISO(doc.validFrom) ?? '',
    validUntil: normalizeToISO(doc.validUntil) ?? '',
    createdAt: normalizeToISO(doc.createdAt) ?? '',
    updatedAt: normalizeToISO(doc.updatedAt) ?? '',
  };
}
