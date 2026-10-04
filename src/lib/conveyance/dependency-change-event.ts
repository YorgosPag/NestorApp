/**
 * @fileoverview **ΤΟ ΓΕΓΟΝΟΣ ΑΛΛΑΓΗΣ ΕΞΑΡΤΗΣΗΣ** — το συμβόλαιο ανάμεσα στον trigger (Functions) και τον αποδέκτη
 * (Next.js) του Σταδίου 3 (ADR-905 §6).
 * @module lib/conveyance/dependency-change-event
 *
 * Ο trigger είναι **αναμεταδότης**: στέλνει ποιο έγγραφο άλλαξε και τις δύο καταστάσεις του, **τίποτε άλλο**. Η κρίση
 * «ποια όψη το βλέπει» τρέχει στον αποδέκτη με τους **ίδιους** κριτές που παράγουν την όψη — δεύτερη μηχανή στα
 * Functions ήταν ο λόγος που επιλέχθηκε webhook (ο κριτής CDE δεν προβάλλεται, ADR-874).
 *
 * Ένα αρχείο για τις δύο άκρες (προβάλλεται αυτούσιο, CHECK 3.93): ο **τύπος**, η **διαδρομή**, η **σειριοποίηση**
 * (`toWireValue`) και η **ανάλυση** (`parseDependencyChangeEvent`) δεν μπορούν να αποκλίνουν.
 *
 * **Layering**: leaf — καμία εισαγωγή (καμία `@/`, κανένα πακέτο).
 */

/** Η εσωτερική διαδρομή του αποδέκτη. */
export const CONVEYANCE_DEPENDENCY_WEBHOOK_PATH = '/api/internal/conveyance/dependency-changed';

/**
 * Από ποια συλλογή ήρθε η αλλαγή. Λεξιλόγιο **σημασίας**, όχι ονόματα συλλογών: κάθε άκρη τα δένει με το δικό της
 * `COLLECTIONS` (ο trigger στο binding του, ο αποδέκτης στην ανάγνωσή του).
 *
 * ⚠️ `files_personal` **εκτός**: δεν έχει `companyId`, άρα δεν απαντά «ποιες υποθέσεις **του μισθωτή**» (CHECK 3.35)·
 * τις αλλαγές του τις κάνει ο ίδιος ο συντάκτης, και τις πιάνει το δίχτυ ορατότητας (ADR-905 §6, δηλωμένο όριο).
 */
export const DEPENDENCY_SOURCES = ['file', 'property', 'project'] as const;
export type DependencySource = (typeof DEPENDENCY_SOURCES)[number];

/** Τιμή JSON — ό,τι ταξιδεύει. */
export type WireValue = string | number | boolean | null | readonly WireValue[] | { readonly [key: string]: WireValue };
export type WireDocument = { readonly [key: string]: WireValue };

export interface DependencyChangeEvent {
  /** Η ταυτότητα του γεγονότος Firestore — και το `Idempotency-Key` του αποδέκτη (μία εκτέλεση ανά γεγονός). */
  readonly eventId: string;
  readonly source: DependencySource;
  readonly docId: string;
  /** `null` = το έγγραφο δεν υπήρχε (γέννηση) / δεν υπάρχει πια (διαγραφή). */
  readonly before: WireDocument | null;
  readonly after: WireDocument | null;
}

/** Χρονοσφραγίδα της Firestore (ή `Date`) — αναγνωρίζεται δομικά, χωρίς εισαγωγή SDK. */
function asDate(value: object): Date | null {
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: unknown };
  if (typeof candidate.toDate !== 'function') return null;
  const date: unknown = candidate.toDate();
  return date instanceof Date ? date : null;
}

/**
 * Τιμή Firestore → JSON. Χρονοσφραγίδα → ISO (το διαβάζει το `normalizeToISO` του αποδέκτη)· ό,τι δεν
 * σειριοποιείται (`undefined`, συνάρτηση, μη πεπερασμένος αριθμός) → `null`. Αναφορές/γεωσημεία → απλά αντικείμενα.
 */
export function toWireValue(value: unknown): WireValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toWireValue);
  if (typeof value !== 'object') return null;
  const date = asDate(value);
  if (date) return Number.isNaN(date.getTime()) ? null : date.toISOString();
  const out: Record<string, WireValue> = {};
  for (const [key, inner] of Object.entries(value)) out[key] = toWireValue(inner);
  return out;
}

export function toWireDocument(data: Record<string, unknown> | undefined): WireDocument | null {
  if (!data) return null;
  const value = toWireValue(data);
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as WireDocument) : null;
}

function isWireDocument(value: unknown): value is WireDocument {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDependencySource(value: unknown): value is DependencySource {
  return typeof value === 'string' && (DEPENDENCY_SOURCES as readonly string[]).includes(value);
}

/** Ανεκτικός αναγνώστης: ό,τι δεν έχει το σχήμα ⇒ `null` (ο αποδέκτης απαντά 400, ο trigger δεν ξαναδοκιμάζει). */
export function parseDependencyChangeEvent(raw: unknown): DependencyChangeEvent | null {
  if (!isWireDocument(raw)) return null;
  const { eventId, source, docId, before, after } = raw;
  if (typeof eventId !== 'string' || eventId === '' || typeof docId !== 'string' || docId === '') return null;
  if (!isDependencySource(source)) return null;
  if (before !== null && !isWireDocument(before)) return null;
  if (after !== null && !isWireDocument(after)) return null;
  if (before === null && after === null) return null;
  return { eventId, source, docId, before, after };
}
