/**
 * =============================================================================
 * «Τι έγγραφο είναι αυτό το αρχείο;» — από τον κατάλογο μεταβίβασης, χωρίς υπόθεση (ADR-915 §20)
 * =============================================================================
 *
 * Ένα αρχείο κουβαλά `(entityType, purpose)` — ποτέ «είδος εγγράφου». Ποιο είδος **υπόσχεται** το ξέρει ήδη ο ΕΝΑΣ
 * κατάλογος: κάθε γραμμή με `documentKind` δηλώνει ποια entry points την ικανοποιούν. Εδώ η ίδια αντιστοίχιση
 * διαβάζεται ανάποδα (`matchersAcceptFile`) — καμία δεύτερη λίστα «purpose → είδος» που θα απέκλινε σιωπηλά.
 *
 * ADR-915 §32 — δεύτερη, **δηλωμένη** πηγή: είδος που δεν το ζητά ο κατάλογος (π.χ. ΥΔΕ) δηλώνει τα entry points του
 * στο `DocumentKindSpec.standaloneEvidence`. Ένας ιδιοκτήτης ανά είδος — η άγκυρα απαγορεύει να δηλωθεί και στα δύο.
 *
 * Επιστρέφει **σύνολο**: ένας σκοπός μπορεί θεωρητικά να υπηρετεί δύο είδη· ποιο από τα δύο είναι, το λέει μόνο το
 * ίδιο το έγγραφο (ο αναγνώστης κειμένου).
 *
 * ADR-915 §33 — **υπόσχεση vs φιλοξενία**: γενική θέση (`EvidenceMatcher.promise: 'candidate'`, π.χ. «Πιστοποιητικό»)
 * φιλοξενεί ένα είδος χωρίς να το υπόσχεται. Το `documentKindsOfFile` τη μετρά (ο αναγνώστης κειμένου κρίνει)· το
 * `namedDocumentKindOfFile` **όχι** — εκείνο απαντά «το αρχείο ΕΙΝΑΙ αυτό το είδος, ακόμη κι αν δεν το διάβασε κανείς».
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές σε server/client/tests.
 *
 * @module lib/conveyance/document-kind-of-file
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import type { EvidenceMatcher } from '@/config/conveyance-checklist/types';
import { DOCUMENT_KINDS, documentKindSpec, type DocumentKind } from '@/config/document-validity/document-validity';
import { matcherFileKeys, matchersAcceptFile, type MatcherFileKey } from './evidence-match';

/** Ό,τι χρειάζεται η ερώτηση από την εγγραφή αρχείου — δομικό. */
export interface DocumentKindFileRef {
  readonly entityType?: unknown;
  readonly purpose?: unknown;
}

/** Ένα είδος και οι matchers που το ικανοποιούν — από γραμμή καταλόγου ή από το `standaloneEvidence` του είδους. */
interface KindEvidence {
  readonly kind: DocumentKind;
  readonly matchers: readonly EvidenceMatcher[];
}

/** Οι δύο δηλωμένες πηγές, ενωμένες. Οκνηρά: ο κατάλογος entry points δεν ρωτιέται την ώρα της φόρτωσης (CHECK 3.80). */
function kindEvidence(): readonly KindEvidence[] {
  const evidence: KindEvidence[] = [];
  for (const item of CONVEYANCE_CHECKLIST) {
    if (item.documentKind === undefined || item.satisfaction.kind !== 'files') continue;
    evidence.push({ kind: item.documentKind, matchers: item.satisfaction.matchers });
  }
  // ADR-915 §32 — είδη που ΔΕΝ ζητά ο κατάλογος (ΥΔΕ) δηλώνουν τα entry points τους στο ίδιο το είδος.
  for (const kind of DOCUMENT_KINDS) {
    const matchers = documentKindSpec(kind).standaloneEvidence;
    if (matchers !== null) evidence.push({ kind, matchers });
  }
  return evidence;
}

const isNamed = (matcher: EvidenceMatcher): boolean => matcher.promise !== 'candidate';

function kindsAccepting(file: DocumentKindFileRef, onlyNamed: boolean): ReadonlySet<DocumentKind> {
  const { entityType, purpose } = file;
  const kinds = new Set<DocumentKind>();
  if (typeof entityType !== 'string' || typeof purpose !== 'string') return kinds;
  for (const { kind, matchers } of kindEvidence()) {
    const counted = onlyNamed ? matchers.filter(isNamed) : matchers;
    if (matchersAcceptFile(counted, entityType, purpose)) kinds.add(kind);
  }
  return kinds;
}

/** Τα είδη εγγράφου που υπόσχεται **ή φιλοξενεί** η θέση του αρχείου — κενό = το αρχείο δεν παρακολουθείται. */
export function documentKindsOfFile(file: DocumentKindFileRef): readonly DocumentKind[] {
  return [...kindsAccepting(file, false)];
}

/**
 * **Το ΕΝΑ είδος που υπόσχεται η θέση του αρχείου** (ADR-915 §33), ή `null`: γενική θέση · καμία θέση · ή θέση που
 * ταιριάζει σε **δύο** είδη (μόνο το έγγραφο ξέρει ποιο). Ό,τι επιστρέφει εδώ γίνεται γραμμή «χωρίς στοιχεία» στο μητρώο.
 */
export function namedDocumentKindOfFile(file: DocumentKindFileRef): DocumentKind | null {
  const all = kindsAccepting(file, false);
  const named = kindsAccepting(file, true);
  if (all.size !== 1 || named.size !== 1) return null;
  return [...named][0];
}

/**
 * Τα `(entityType, purpose)` των **ονομαστικών** θέσεων — από αυτά το μητρώο **παράγει** τους σκοπούς του ερωτήματός
 * του (ADR-915 §33)· ποτέ χειρόγραφη λίστα σκοπών που θα απέκλινε από τον κατάλογο.
 */
export function namedDocumentFileKeys(): readonly MatcherFileKey[] {
  const seen = new Map<string, MatcherFileKey>();
  for (const { matchers } of kindEvidence()) {
    for (const key of matchers.filter(isNamed).flatMap(matcherFileKeys)) seen.set(`${key.entityType}|${key.purpose}`, key);
  }
  return [...seen.values()];
}
