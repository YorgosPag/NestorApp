/**
 * @fileoverview **Η ΕΚΒΑΣΗ ΜΙΑΣ ΕΓΓΡΑΦΗΣ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ** — κλειστή ένωση, κάθε άρνηση
 *   με όνομα.
 * @related ADR-835 §20 (Στάδιο Α) · services/stay-calendar/stay-calendar-write.service.ts ·
 *   app/api/owner-properties/[ownerPropertyId]/stay-calendar/route.ts
 * @module services/stay-calendar/stay-calendar-write-result
 *
 * **Layering**: leaf — τύποι + καθαρές συναρτήσεις. Ζει χωριστά από την υπηρεσία ώστε η
 * οθόνη να εισάγει τον τύπο **χωρίς** `server-only`.
 */

import type { StayCalendarVerdict } from '@/lib/stay/stay-conflict';
import { isStayAvailabilityKind, type StayAvailabilityKind } from '@/lib/stay/stay-availability-vocabulary';
import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { isRecord } from '@/lib/type-guards';
import { isStayRuleWarningKind, type StayRuleWarningKind } from '@/lib/stay/stay-rule-warnings';

/**
 * **Με τι συγκρούστηκε** — ό,τι χρειάζεται η οθόνη για να πει «πέφτει πάνω στην κράτηση
 * 14–18/10», και **τίποτα** παραπάνω: ούτε όνομα επισκέπτη, ούτε σημείωση.
 */
export interface StayCalendarConflictView {
  readonly entryKind: 'booking' | 'block';
  readonly entryId: string;
  readonly from: string;
  readonly to: string;
  /**
   * 🏆 **Αν η σύγκρουση είναι ΖΩΝΤΑΝΟ ΑΙΤΗΜΑ, ως πότε κρατά** (Στάδιο Δ, §23.5) — «πέφτει πάνω σε
   * αίτημα σε αναμονή ως 14:00», όχι σκέτο «κλειστό». Έχει **άλλη θεραπεία**: περίμενε ή απάντησε.
   */
  readonly heldUntil: string | null;
}

/** Οι μέγιστες ταυτόχρονες εκκρεμότητες ενός επισκέπτη — ζει στην κεφαλή του (§23.4). */
export interface StayGuestHoldLimit {
  readonly limit: number;
}

export type StayCalendarWriteResult =
  | {
      readonly kind: 'ok';
      readonly entryId: string | null;
      readonly version: number;
      /** Η προθεσμία που **υποσχέθηκε** ένα νέο αίτημα (§23.3)· `null` για κάθε άλλη πράξη. */
      readonly holdExpiresAt: string | null;
    }
  /** Δεν υπάρχει — **ή** δεν το διαχειρίζεσαι. Ίδια έκβαση, επίτηδες (δεν διαρρέει ύπαρξη). */
  | { readonly kind: 'absent' }
  /** Νέα κατάληψη σε ακίνητο **χωρίς** ζωντανή βραχυχρόνια διάθεση. */
  | { readonly kind: 'not-a-stay' }
  | { readonly kind: 'conflict'; readonly conflicts: readonly StayCalendarConflictView[] }
  /** 🔴 Κάποια εγγραφή δεν διαβάζεται — **άρνηση**, ποτέ «έγραψα με ό,τι βρήκα» (§6.4). */
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'entry-absent' }
  /** Block εξωτερικής πηγής (το ανοίγει η πηγή) ή κράτηση που δεν ακυρώνεται πια. */
  | { readonly kind: 'not-changeable'; readonly reason: 'external-source' | 'lifecycle' }
  /**
   * 🏆 Η χειροκίνητη κράτηση **παρακάμπτει κανόνες** που ο οικοδεσπότης δεν αποδέχτηκε ρητά
   * (ADR-835 §21). Η οθόνη τους ονομάζει και ζητά αποδοχή — ποτέ σιωπηλή παράκαμψη.
   */
  | { readonly kind: 'rules-unacknowledged'; readonly warnings: readonly StayRuleWarningKind[] }
  /** Η ρύθμιση ημερών αφήνει μέρα με ελάχιστες > μέγιστες νύχτες — αντίφαση, όχι κανόνας. */
  | { readonly kind: 'contradictory-rules'; readonly date: string }
  // ── Στάδιο Δ (§23.4) — το αίτημα του επισκέπτη ──────────────────────────────────────────
  /**
   * Η **ίδια** μηχανή διαθεσιμότητας είπε όχι — με τον κάδο της, ώστε η οθόνη να δώσει την ίδια
   * θεραπεία που δίνει και η σελίδα. Για τον επισκέπτη οι κανόνες είναι **σκληροί**.
   */
  | { readonly kind: 'unavailable'; readonly answer: StayAvailabilityKind }
  /** Δεν μένει χρόνος για τίμια προθεσμία πριν την άφιξη — «επικοινώνησε με τον οικοδεσπότη». */
  | { readonly kind: 'too-late' }
  /** Το ακίνητο πωλείται και ο επισκέπτης **δεν** δήλωσε ότι το ξέρει (§4.7). */
  | { readonly kind: 'risk-not-acknowledged' }
  /** Ο επισκέπτης έχει ήδη τόσα ζωντανά αιτήματα — ανά **άνθρωπο**, όχι ανά ακίνητο (§20.3). */
  | ({ readonly kind: 'guest-hold-limit' } & StayGuestHoldLimit)
  /** Αποδοχή αιτήματος που **έληξε** — οι μέρες μπορεί να έχουν ήδη δοθεί αλλού. */
  | { readonly kind: 'hold-lapsed' }
  /** Λήξη αιτήματος που **ζει ακόμη** — ο δρομέας δεν σκοτώνει ζωντανή υπόσχεση. */
  | { readonly kind: 'hold-alive' }
  /** Αίτημα στη **δική σου** αγγελία — ο οικοδεσπότης κλείνει μέρες από το ημερολόγιό του. */
  | { readonly kind: 'own-listing' }
  /**
   * 🏆 **Η τιμή άλλαξε από τη στιγμή που την είδε ο επισκέπτης** (ADR-777 §8.60.21.7) — με το **νέο**
   * σύνολο (`null` = πλέον δεν τιμολογείται). Κανείς δεν δεσμεύεται σε ποσό που δεν είδε
   * (Οδηγία 2011/83/ΕΕ άρ. 6(6)): η οθόνη το λέει και ξαναρωτά.
   */
  | { readonly kind: 'price-changed'; readonly totalMinor: MinorAmount | null };

export type StayCalendarWriteKind = StayCalendarWriteResult['kind'];

/** Η ετυμηγορία του κριτή ως έκβαση — `undetermined` ⇒ `unreadable`, **ποτέ** «καθαρό». */
export function refusalOf(verdict: StayCalendarVerdict): StayCalendarWriteResult | null {
  if (verdict.kind === 'clear') return null;
  if (verdict.kind === 'undetermined') return { kind: 'unreadable' };
  const seen = new Set<string>();
  const conflicts: StayCalendarConflictView[] = [];
  for (const conflict of verdict.conflicts) {
    const entry = conflict.with.source;
    const view: StayCalendarConflictView = entry.kind === 'booking'
      ? {
          entryKind: 'booking', entryId: entry.booking.id, from: entry.booking.checkIn, to: entry.booking.checkOut,
          // Στον κριτή φτάνουν **μόνο** ζωντανά holds (`stayEntryOccupies`), άρα `requested` ⇒ ζει.
          heldUntil: entry.booking.lifecycle === 'requested' ? entry.booking.hold?.expiresAt ?? null : null,
        }
      : { entryKind: 'block', entryId: entry.block.id, from: entry.block.from, to: entry.block.to, heldUntil: null };
    // Μία γραμμή ανά εγγραφή — ο κριτής δίνει μία ανά αμφισβητούμενο **χώρο**.
    if (seen.has(view.entryId)) continue;
    seen.add(view.entryId);
    conflicts.push(view);
  }
  return { kind: 'conflict', conflicts };
}

function conflictViewsOf(value: unknown): readonly StayCalendarConflictView[] | null {
  if (!Array.isArray(value)) return null;
  const views: StayCalendarConflictView[] = [];
  for (const item of value) {
    if (!isRecord(item) || (item.entryKind !== 'booking' && item.entryKind !== 'block')) return null;
    const { entryId, from, to, heldUntil } = item;
    if (typeof entryId !== 'string' || typeof from !== 'string' || typeof to !== 'string') return null;
    if (heldUntil !== null && typeof heldUntil !== 'string') return null;
    views.push({ entryKind: item.entryKind, entryId, from, to, heldUntil });
  }
  return views;
}

/**
 * **Η έκβαση από το σύρμα** — για την οθόνη, που παίρνει το 409 ως σώμα σφάλματος.
 * Άγνωστο σχήμα ⇒ `null` (ο καλών το λέει «απέτυχε», ποτέ «αποθηκεύτηκε»).
 */
export function stayCalendarWriteResultFrom(raw: unknown): StayCalendarWriteResult | null {
  if (!isRecord(raw)) return null;
  switch (raw.kind) {
    case 'ok':
      return typeof raw.version === 'number' && (typeof raw.entryId === 'string' || raw.entryId === null)
        && (typeof raw.holdExpiresAt === 'string' || raw.holdExpiresAt === null)
        ? { kind: 'ok', entryId: raw.entryId, version: raw.version, holdExpiresAt: raw.holdExpiresAt }
        : null;
    case 'unavailable':
      return isStayAvailabilityKind(raw.answer) ? { kind: 'unavailable', answer: raw.answer } : null;
    case 'guest-hold-limit':
      return typeof raw.limit === 'number' ? { kind: 'guest-hold-limit', limit: raw.limit } : null;
    case 'conflict': {
      const conflicts = conflictViewsOf(raw.conflicts);
      return conflicts === null ? null : { kind: 'conflict', conflicts };
    }
    case 'rules-unacknowledged':
      return Array.isArray(raw.warnings) && raw.warnings.every(isStayRuleWarningKind)
        ? { kind: 'rules-unacknowledged', warnings: raw.warnings }
        : null;
    case 'contradictory-rules':
      return typeof raw.date === 'string' ? { kind: 'contradictory-rules', date: raw.date } : null;
    case 'price-changed':
      return raw.totalMinor === null || isMinorAmount(raw.totalMinor)
        ? { kind: 'price-changed', totalMinor: raw.totalMinor }
        : null;
    case 'not-changeable':
      return raw.reason === 'external-source' || raw.reason === 'lifecycle'
        ? { kind: 'not-changeable', reason: raw.reason }
        : null;
    case 'absent':
    case 'not-a-stay':
    case 'unreadable':
    case 'entry-absent':
    case 'too-late':
    case 'risk-not-acknowledged':
    case 'hold-lapsed':
    case 'hold-alive':
    case 'own-listing':
      return { kind: raw.kind };
    default:
      return null;
  }
}

/** Ο κωδικός HTTP κάθε έκβασης — **ένας** πίνακας, `Record` ώστε νέα έκβαση να μη μεταγλωττίζεται σιωπηλά. */
export const STAY_CALENDAR_WRITE_STATUS: Readonly<Record<StayCalendarWriteKind, number>> = {
  ok: 200,
  absent: 404,
  'not-a-stay': 409,
  conflict: 409,
  unreadable: 503,
  'entry-absent': 404,
  'not-changeable': 409,
  'rules-unacknowledged': 409,
  'contradictory-rules': 422,
  unavailable: 409,
  'too-late': 409,
  'risk-not-acknowledged': 409,
  'guest-hold-limit': 409,
  'hold-lapsed': 409,
  'hold-alive': 409,
  'own-listing': 409,
  'price-changed': 409,
};
