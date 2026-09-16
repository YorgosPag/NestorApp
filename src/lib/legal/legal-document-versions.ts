/**
 * =============================================================================
 * ΟΙ ΕΚΔΟΣΕΙΣ ΤΩΝ ΝΟΜΙΚΩΝ ΕΓΓΡΑΦΩΝ — ο **ένας** αναγνώστης (ADR-861 Φ3)
 * =============================================================================
 *
 * Κάθε ερώτηση «ποια έκδοση;» περνά από εδώ: η τρέχουσα σελίδα, το αρχείο εκδόσεων και η
 * συναίνεση πωλητή (ADR-864 Α8). Οι απαντήσεις είναι **ονομασμένες**, ποτέ `null` και **ποτέ**
 * «πάρε την τελευταία» όταν ζητήθηκε συγκεκριμένη.
 *
 * 🔑 **«Σε ισχύ» ≠ «τελευταία».** Μια έκδοση μπορεί να παγώσει με **μελλοντική** `effectiveFrom`
 * (προαναγγελία ουσιώδους αλλαγής — πρότυπο Google/GitHub, ADR-861 Φ4). Μέχρι τότε ισχύει η
 * προηγούμενη, και η νέα είναι `upcoming`.
 *
 * @module lib/legal/legal-document-versions
 * @see ADR-861 §7
 */

import { LEGAL_DOCUMENT_IDS, type LegalDocumentId } from '@/constants/legal-documents';
import type { CalendarDay } from '@/constants/platform-operator';
import manifest from '@/config/legal-document-versions/manifest.json';
import { FROZEN_LEGAL_DOCUMENTS } from '@/config/legal-document-versions/index.generated';
import { canonicalJson } from '@/lib/legal/canonical-json';
import { frozenLegalDocumentFrom, type FrozenLegalDocument } from '@/lib/legal/frozen-legal-document';

/** Μία δημοσιευμένη έκδοση: το στενεμένο κείμενο **και** τα bytes που υπογράφει το αποτύπωμα. */
export interface LegalDocumentVersion {
  readonly frozen: FrozenLegalDocument;
  /** `sha256:…` — από το μητρώο, όχι υπολογισμένο στον browser. */
  readonly digest: string;
  /** Τα **ακριβή** bytes του αρχείου (κανονική σειριοποίηση) — για λήψη και επαλήθευση. */
  readonly bytes: string;
}

export type VersionLookup =
  | { readonly kind: 'published'; readonly version: LegalDocumentVersion }
  | { readonly kind: 'absent' };

export type InForceLookup =
  | {
      readonly kind: 'in-force';
      readonly version: LegalDocumentVersion;
      /** Νεότερη έκδοση με μελλοντική `effectiveFrom`, αν υπάρχει. */
      readonly upcoming: LegalDocumentVersion | null;
    }
  | { readonly kind: 'none-yet' };

export const isLegalDocumentId = (value: unknown): value is LegalDocumentId =>
  LEGAL_DOCUMENT_IDS.some((id) => id === value);

function digestOf(document: LegalDocumentId, version: number): string {
  const rows: readonly { readonly version: number; readonly digest: string }[] =
    manifest.documents[document] ?? [];
  const row = rows.find((r) => r.version === version);
  // ⚠️ ΔΙΑΓΝΩΣΤΙΚΟ ΑΝΑΛΛΟΙΩΤΟΥ, ΟΧΙ ΚΕΙΜΕΝΟ ΧΡΗΣΤΗ — και γι' αυτό **αγγλικό**:
  //    πυροδοτείται μόνο αν το μητρώο διαφωνήσει με τα παγωμένα αρχεία, κατάσταση
  //    που ο **Κ1 του CHECK 3.85** κάνει δομικά αδύνατη. Κλειδί i18n εδώ θα μόλυνε
  //    τα locales με πρόταση που κανένας άνθρωπος δεν πρόκειται να δει (N.11).
  if (row === undefined) throw new Error(`[legal-documents] ${document} v${version} missing from manifest`);
  return row.digest;
}

function buildHistory(): ReadonlyMap<LegalDocumentId, readonly LegalDocumentVersion[]> {
  const history = new Map<LegalDocumentId, LegalDocumentVersion[]>(LEGAL_DOCUMENT_IDS.map((id) => [id, []]));
  for (const raw of FROZEN_LEGAL_DOCUMENTS) {
    const frozen = frozenLegalDocumentFrom(raw);
    history.get(frozen.document)?.push({
      frozen,
      digest: digestOf(frozen.document, frozen.version),
      bytes: canonicalJson(raw),
    });
  }
  for (const versions of history.values()) versions.sort((a, b) => a.frozen.version - b.frozen.version);
  return history;
}

const HISTORY = buildHistory();

/** Όλες οι εκδόσεις ενός εγγράφου, από την 1η. */
export function legalDocumentVersions(document: LegalDocumentId): readonly LegalDocumentVersion[] {
  return HISTORY.get(document) ?? [];
}

/** Μία **συγκεκριμένη** έκδοση — ποτέ υποκατάσταση με άλλη. */
export function legalDocumentVersion(document: LegalDocumentId, version: number): VersionLookup {
  const found = legalDocumentVersions(document).find((v) => v.frozen.version === version);
  return found === undefined ? { kind: 'absent' } : { kind: 'published', version: found };
}

/** Η έκδοση **σε ισχύ** μια μέρα (ελληνική μέρα — `calendarDayOf`). */
export function legalDocumentInForce(document: LegalDocumentId, day: CalendarDay): InForceLookup {
  const versions = legalDocumentVersions(document);
  const inForce = versions.filter((v) => v.frozen.effectiveFrom <= day).at(-1);
  if (inForce === undefined) return { kind: 'none-yet' };
  const upcoming = versions.find((v) => v.frozen.effectiveFrom > day) ?? null;
  return { kind: 'in-force', version: inForce, upcoming };
}

/** Η **τελευταία** έκδοση, σε ισχύ ή όχι — αυτή υπογράφει μια **νέα** συναίνεση (ADR-864). */
export function latestLegalDocumentVersion(document: LegalDocumentId): VersionLookup {
  const latest = legalDocumentVersions(document).at(-1);
  return latest === undefined ? { kind: 'absent' } : { kind: 'published', version: latest };
}
