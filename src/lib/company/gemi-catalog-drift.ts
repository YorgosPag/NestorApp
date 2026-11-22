/**
 * @fileoverview **ΣΤΙΓΜΙΟΤΥΠΟ ⇄ ΖΩΝΤΑΝΟΣ ΚΑΤΑΛΟΓΟΣ** — τι άλλαξε στο ΓΕΜΗ από τη μέτρηση του χάρτη (ADR-948 §8 Βήμα 3).
 * @module lib/company/gemi-catalog-drift
 *
 * Πρακτική κατάλογου κωδικών των μεγάλων: ο χάρτης ζει **στον κώδικα**, σε έκδοση, και ενημερώνεται από
 * **άνθρωπο** που βλέπει τη διαφορά (Google libphonenumber / address metadata · GLEIF ELF code list ανά
 * έκδοση με change log · BvD/Orbis crosswalks). **Ποτέ** ανάγνωση καταλόγου την ώρα της χρήσης.
 *
 * Εδώ κρίνεται η διαφορά· την εκτελεί το `npm run gemi:catalog-diff`. Κάθε είδος λέει **τι κάνει ήδη ο φράχτης**
 * μέχρι να ξαναδεί άνθρωπος τη γραμμή — η ζωντανή συμπεριφορά είναι fail-closed, η διαφορά είναι εργασία.
 *
 * 🔑 Η ταυτότητα περιγραφής είναι η **μία** κρίση `sameDescription` — ίδια με του φράχτη ανά απάντηση.
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O.
 */

import { GEMI_COMPANY_STATUSES, GEMI_LEGAL_FORMS } from '@/config/company-registry/gemi-legal-forms';
import { sameDescription } from '@/lib/company/registry-legal-person';
import type { RegistryCatalogEntry } from '@/types/company-registry';

export type GemiCatalogName = 'legalTypes' | 'statuses';

/**
 * - `added` — νέος κωδικός ⇒ νομική μορφή: άρνηση `unmapped` · κατάσταση: `not-comparable`.
 * - `descr-changed` — ο κωδικός μπορεί να άλλαξε νόημα ⇒ άρνηση `catalog-drift` · κατάσταση: `not-comparable`.
 * - `activity-changed` — το `isActive` του καταλόγου άλλαξε (μόνο καταστάσεις).
 * - `removed` — λείπει από τον κατάλογο· η γραμμή **μένει** (παλιές απαντήσεις μπορεί να τον φέρουν).
 * - `descr-en-changed` — μόνο η αγγλική περιγραφή· δεν επηρεάζει καμία κρίση.
 */
export type GemiCatalogDriftKind = 'added' | 'descr-changed' | 'activity-changed' | 'removed' | 'descr-en-changed';

export interface GemiCatalogDrift {
  readonly catalog: GemiCatalogName;
  readonly id: string;
  readonly kind: GemiCatalogDriftKind;
  /** Η τιμή του στιγμιοτύπου — `null` όταν ο κωδικός είναι νέος. */
  readonly snapshot: string | null;
  /** Η ζωντανή τιμή — `null` όταν ο κωδικός αφαιρέθηκε. */
  readonly live: string | null;
}

/** Οι γραμμές του χάρτη στο σχήμα του καταλόγου — ο χάρτης μένει το **ένα** σημείο αλήθειας. */
export function gemiCatalogSnapshot(catalog: GemiCatalogName): readonly RegistryCatalogEntry[] {
  if (catalog === 'legalTypes') {
    return GEMI_LEGAL_FORMS.map((row) => ({ id: row.gemiId, descr: row.descr, descrEn: row.descrEn, isActive: null }));
  }
  return GEMI_COMPANY_STATUSES.map((row) => ({ id: row.gemiId, descr: row.descr, descrEn: row.descrEn, isActive: row.isActive }));
}

const sameText = (a: string | null, b: string | null): boolean =>
  a === null || b === null ? a === b : sameDescription(a, b);

const flag = (value: boolean | null): string | null => (value === null ? null : String(value));

/** Οι διαφορές **ενός** κωδικού που υπάρχει και στις δύο πλευρές. */
function rowDrifts(catalog: GemiCatalogName, snap: RegistryCatalogEntry, live: RegistryCatalogEntry): GemiCatalogDrift[] {
  const drifts: GemiCatalogDrift[] = [];
  const push = (kind: GemiCatalogDriftKind, snapshot: string | null, value: string | null): void => {
    drifts.push({ catalog, id: snap.id, kind, snapshot, live: value });
  };
  if (!sameDescription(live.descr, snap.descr)) push('descr-changed', snap.descr, live.descr);
  if (!sameText(live.descrEn, snap.descrEn)) push('descr-en-changed', snap.descrEn, live.descrEn);
  if (catalog === 'statuses' && live.isActive !== snap.isActive) push('activity-changed', flag(snap.isActive), flag(live.isActive));
  return drifts;
}

/** **Η διαφορά ενός καταλόγου** — κενή λίστα ⇒ ο χάρτης είναι τρέχων. Ταξινομημένη κατά κωδικό. */
export function diffGemiCatalog(
  catalog: GemiCatalogName,
  live: readonly RegistryCatalogEntry[],
  snapshot: readonly RegistryCatalogEntry[] = gemiCatalogSnapshot(catalog),
): readonly GemiCatalogDrift[] {
  const liveById = new Map(live.map((row) => [row.id, row]));
  const snapIds = new Set(snapshot.map((row) => row.id));
  const drifts: GemiCatalogDrift[] = [];
  for (const snap of snapshot) {
    const current = liveById.get(snap.id);
    if (current === undefined) drifts.push({ catalog, id: snap.id, kind: 'removed', snapshot: snap.descr, live: null });
    else drifts.push(...rowDrifts(catalog, snap, current));
  }
  for (const row of live) {
    if (!snapIds.has(row.id)) drifts.push({ catalog, id: row.id, kind: 'added', snapshot: null, live: row.descr });
  }
  return drifts.sort((a, b) => Number(a.id) - Number(b.id) || a.id.localeCompare(b.id));
}
