/**
 * @module kaek
 * @description **Ο ΚΑΕΚ ως ταυτότητα** — ανάλυση, μορφοποίηση, επικύρωση. Καμία εξάρτηση.
 *
 * Ο Κωδικός Αριθμός Εθνικού Κτηματολογίου (ADR-900 §3.8):
 *
 * | Ψηφία | Σημασία |
 * |---|---|
 * | 1–2 | νομός |
 * | 3–5 | δήμος / δημοτικό διαμέρισμα |
 * | 6–7 | κτηματολογικός τομέας |
 * | 8–9 | κτηματολογική ενότητα (π.χ. οικοδομικό τετράγωνο) |
 * | 10–12 | αύξων αριθμός γεωτεμαχίου |
 * | `/Κ` | κάθετη ιδιοκτησία (0 = καμία) |
 * | `/Ο` | οριζόντια ιδιοκτησία (διαμέρισμα, κατάστημα…) |
 *
 * Τα 12 ψηφία ορίζουν το **γεωτεμάχιο**· το `/Κ/Ο` ορίζει την **ιδιοκτησία μέσα του** — η
 * δημόσια ταυτότητα μονάδας πάνω στην οποία πατά το ADR-900 §8 #2 (2β).
 *
 * 🔑 **Κανονική μορφή = με καθέτους** (`050681726003/0/1`), όπως τη γράφουν το ΠΚΑ και οι
 * υπηρεσίες του Κτηματολογίου. Η **συμπαγής 16ψήφια** (12 + 2 κάθετη + 2 οριζόντια)
 * γίνεται δεκτή ως **είσοδος** και κανονικοποιείται.
 * ⚠️ Η αντιστοίχιση 2+2 της συμπαγούς μορφής **δεν** επιβεβαιώθηκε ακόμη σε πραγματικό
 * έγγραφο — όταν επιβεβαιωθεί, σημειώνεται εδώ (ADR-900 §3.8).
 *
 * ⚠️ **ΜΙΑ ΑΛΗΘΕΙΑ**: κάθε σημείο που διαβάζει ή γράφει ΚΑΕΚ (`OwnershipTable.kaekCodes` ·
 * `PlotSite.kaek` · `ProjectAddress.cadastralCode` · ανάγνωση ΠΚΑ) ρωτά **εδώ**.
 * Ο ΚΑΕΚ **δεν** έχει ψηφίο ελέγχου — η επικύρωση είναι δομική, όχι αριθμητική.
 *
 * **Layering**: leaf, καθαρή — πελάτης, διακομιστής, tests.
 */

/** Τα 12 ψηφία του γεωτεμαχίου. */
const PARCEL_DIGITS = 12;

/** Μέγιστο πλήθος ψηφίων στους αριθμούς κάθετης/οριζόντιας ιδιοκτησίας της μορφής με καθέτους. */
const PART_MAX_DIGITS = 4;

/** Συμπαγής μορφή: 12 + 2 (κάθετη) + 2 (οριζόντια). */
const COMPACT_DIGITS = 16;

const PARCEL_REGEX = /^\d{12}$/;
const SLASHED_REGEX = new RegExp(`^(\\d{${PARCEL_DIGITS}})/(\\d{1,${PART_MAX_DIGITS}})/(\\d{1,${PART_MAX_DIGITS}})$`);
const COMPACT_REGEX = /^(\d{12})(\d{2})(\d{2})$/;

/** Ο ΚΑΕΚ αναλυμένος. `unit === null` ⇒ κωδικός **γεωτεμαχίου** (χωρίς ιδιοκτησία μέσα του). */
export interface Kaek {
  /** Τα 12 ψηφία του γεωτεμαχίου. */
  readonly parcel: string;
  readonly prefecture: string;
  readonly municipality: string;
  readonly sector: string;
  readonly unitBlock: string;
  readonly serial: string;
  /** Κάθετη / οριζόντια ιδιοκτησία — `null` όταν ο κωδικός δείχνει μόνο το γεωτεμάχιο. */
  readonly unit: { readonly vertical: number; readonly horizontal: number } | null;
}

export type KaekParseFailure = 'empty' | 'malformed' | 'zero-parcel';

export type KaekParseResult =
  | { readonly kind: 'parsed'; readonly kaek: Kaek }
  | { readonly kind: 'invalid'; readonly reason: KaekParseFailure };

/**
 * Αφαιρεί ό,τι **δεν** φέρει πληροφορία: κενά, παύλες, τελείες (π.χ. `05 068 17 26 003`).
 * Οι κάθετοι **μένουν** — χωρίζουν ψηφία με σημασία.
 */
export function normalizeKaekInput(raw: string): string {
  return raw.replace(/[\s.\-–]/g, '');
}

function buildKaek(parcel: string, unit: Kaek['unit']): Kaek {
  return {
    parcel,
    prefecture: parcel.slice(0, 2),
    municipality: parcel.slice(2, 5),
    sector: parcel.slice(5, 7),
    unitBlock: parcel.slice(7, 9),
    serial: parcel.slice(9, 12),
    unit,
  };
}

function unitOf(vertical: string, horizontal: string): Kaek['unit'] {
  return { vertical: Number(vertical), horizontal: Number(horizontal) };
}

/** Ανάλυση από **οποιαδήποτε** αποδεκτή μορφή (12 · 12/Κ/Ο · συμπαγής 16). */
export function parseKaek(raw: string): KaekParseResult {
  const input = normalizeKaekInput(raw);
  if (input.length === 0) return { kind: 'invalid', reason: 'empty' };

  let kaek: Kaek | null = null;
  const slashed = SLASHED_REGEX.exec(input);
  const compact = input.length === COMPACT_DIGITS ? COMPACT_REGEX.exec(input) : null;
  if (PARCEL_REGEX.test(input)) kaek = buildKaek(input, null);
  else if (slashed) kaek = buildKaek(slashed[1], unitOf(slashed[2], slashed[3]));
  else if (compact) kaek = buildKaek(compact[1], unitOf(compact[2], compact[3]));

  if (kaek === null) return { kind: 'invalid', reason: 'malformed' };
  if (/^0+$/.test(kaek.parcel)) return { kind: 'invalid', reason: 'zero-parcel' };
  return { kind: 'parsed', kaek };
}

/** `true` όταν το κείμενο είναι ΚΑΕΚ σε οποιαδήποτε αποδεκτή μορφή. */
export function isValidKaek(raw: string): boolean {
  return parseKaek(raw).kind === 'parsed';
}

/** Η **κανονική** μορφή (με καθέτους) — αυτή αποθηκεύεται και συγκρίνεται. */
export function formatKaek(kaek: Kaek): string {
  if (kaek.unit === null) return kaek.parcel;
  return `${kaek.parcel}/${kaek.unit.vertical}/${kaek.unit.horizontal}`;
}

/** Κανονικοποίηση σε ένα βήμα — `null` όταν το κείμενο δεν είναι ΚΑΕΚ. */
export function canonicalKaek(raw: string): string | null {
  const result = parseKaek(raw);
  return result.kind === 'parsed' ? formatKaek(result.kaek) : null;
}

/** Ο κωδικός του **γεωτεμαχίου** (12 ψηφία) — ό,τι καταλαβαίνει η υπηρεσία INSPIRE. */
export function parcelKaekOf(kaek: Kaek): string {
  return kaek.parcel;
}

/**
 * Όλοι οι ΚΑΕΚ που εμφανίζονται σε ελεύθερο κείμενο (π.χ. κείμενο ΠΚΑ), κανονικοποιημένοι,
 * χωρίς διπλότυπα, με τη σειρά εμφάνισης. Τα όρια λέξης εμποδίζουν να «κοπεί» ΚΑΕΚ από
 * μακρύτερο αριθμό (π.χ. αριθμό πρωτοκόλλου).
 */
export function findKaekCodes(text: string): ReadonlyArray<string> {
  const pattern = new RegExp(
    `(?<!\\d)\\d{${PARCEL_DIGITS}}(?:\\s*/\\s*\\d{1,${PART_MAX_DIGITS}}\\s*/\\s*\\d{1,${PART_MAX_DIGITS}})?(?![\\d/])`,
    'g',
  );
  const found: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const canonical = canonicalKaek(match[0]);
    if (canonical !== null && !found.includes(canonical)) found.push(canonical);
  }
  return found;
}
