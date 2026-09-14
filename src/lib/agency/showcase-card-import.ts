/**
 * @fileoverview **«ΕΙΣΑΓΩΓΗ ΑΠΟ ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ»** — σύγκριση ανά πεδίο και εφαρμογή στο πρόχειρο
 *   (ADR-841 §7 Α21.19).
 * @related types/showcase-card-import.ts · lib/agency/showcase-card-draft.ts · components/mandate/ShowcaseCardImportDialog.tsx
 * @module lib/agency/showcase-card-import
 *
 * 🔑 **ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ, ΜΗΔΕΝ I/O** — πελάτης και άγκυρες τρέχουν την ίδια κρίση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΕΙ ΚΑΛΥΤΕΡΑ ΑΠΟ ΤΟ MERGE ΤΩΝ CRM
 * ────────────────────────────────────────────────────────────────────────────
 *
 * - **«Ίδιο» κρίνεται ΜΕΤΑ την κανονικοποίηση, από τους ΙΔΙΟΥΣ κριτές με τον γραφέα** (`normalisePhone` ·
 *   `normaliseChannelEmail` · `normalisePublicWebsite`). Το «2310 123456» και το «+30 2310123456» δεν είναι
 *   σύγκρουση — είναι ο ίδιος αριθμός. Τα merge του HubSpot/Salesforce συγκρίνουν κείμενο και γεμίζουν ψευδείς διαφορές.
 * - **Ερώτηση μόνο εκεί που υπάρχει πραγματική διαφορά** (`differs`), με προεπιλογή *«κράτα της κάρτας»*: η κάρτα
 *   είναι δημόσια και μπορεί να είναι σκόπιμα επιμελημένη.
 * - **Τα πολλαπλά κανάλια ΠΡΟΣΤΙΘΕΝΤΑΙ, δεν αντικαθίστανται** (Apple Contacts): κανένα τηλέφωνο δεν χάνεται.
 * - ⛔ **Ποτέ τόπος, ποτέ όνομα**: ο τόπος επιβεβαιώνεται στον χάρτη από τον άνθρωπο· το όνομα έχει ήδη μία αλήθεια (Α22).
 * - ⛔ **Ποτέ ο διακόπτης «Δημοσίευση οδού»**: η κατοικία του επαγγελματία δεν δημοσιεύεται επειδή πάτησε «Εισαγωγή».
 */

import { normalisePhone } from '@/lib/contact/channel-phone';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { isValidEmail, normalisePublicWebsite } from '@/lib/validation/email-validation';
import { MAX_EMAILS_PER_LOCATION, MAX_PHONES_PER_LOCATION } from '@/types/showcase-card';
import { normalizeGreekText } from '@/utils/greek-text';
import type { CompanyContactSource, ImportField, ImportOrigin } from '@/types/showcase-card-import';
import { emptyLocationDraft, type ShowcaseLocationDraft } from './showcase-card-draft';

/**
 * - `fill` — η κάρτα δεν έχει τιμή· **προτείνεται** (προεπιλογή: παίρνεται).
 * - `same` — ίδιο μετά την κανονικοποίηση· καμία πράξη.
 * - `differs` — η κάρτα λέει άλλο· **ερώτηση** (προεπιλογή: κράτα της κάρτας).
 * - `no-room` — δεν χωρά (ταβάνι καναλιών)· λέγεται, δεν παραλείπεται σιωπηλά.
 * - `invalid-source` — η τιμή της εταιρείας δεν περνά τον κριτή· λέγεται, ώστε να διορθωθεί **στην πηγή**.
 */
export type ImportRowStatus = 'fill' | 'same' | 'differs' | 'no-room' | 'invalid-source';

interface RowBase {
  /** Σταθερό κλειδί απόφασης — `street` · `website` · `phones:<E.164>` · `emails:<email>`. */
  readonly key: string;
  readonly status: ImportRowStatus;
  /** Ό,τι γράφει η κάρτα σήμερα, για προβολή· `null` όταν δεν έχει. */
  readonly current: string | null;
  /** Ό,τι προτείνει η πηγή, για προβολή. */
  readonly candidate: string;
  readonly origin: ImportOrigin;
  readonly checkedAt: string | null;
}

export type ImportRow =
  | (RowBase & { readonly field: 'street'; readonly street: ShowcaseLocationDraft['street']; readonly placeHint: string })
  | (RowBase & { readonly field: Exclude<ImportField, 'street'>; readonly value: string });

export interface ImportComparison {
  readonly rows: readonly ImportRow[];
}

/** Οι αποφάσεις του ανθρώπου: τα κλειδιά των γραμμών που **παίρνονται**. */
export type ImportDecisions = ReadonlySet<string>;

const PROFILE: ImportOrigin = 'company-profile';

/** «ΣΑΜΟΘΡΑΚΗΣ» = «Σαμοθράκης»: τα κεφαλαία δεν γράφουν τόνο — ο **ένας** ελληνικός κανονικοποιητής του έργου. */
const fold = (value: string) => normalizeGreekText(value.trim());
const hasText = (value: string) => value.trim() !== '';

function streetText({ street, number, postalCode }: ShowcaseLocationDraft['street']): string {
  return [`${street} ${number}`.trim(), postalCode].filter(hasText).join(', ');
}

/** Η έδρα του προχείρου, αν υπάρχει. */
function headquartersOf(drafts: readonly ShowcaseLocationDraft[]): ShowcaseLocationDraft | null {
  return drafts.find(({ role }) => role === 'headquarters') ?? null;
}

function streetRow(hq: ShowcaseLocationDraft | null, source: CompanyContactSource): ImportRow[] {
  const address = source.address;
  if (address === null || !hasText(address.street)) return [];
  const candidate = { street: address.street, number: address.number, postalCode: address.postalCode };
  const current = hq?.street ?? null;
  const currentEmpty = current === null || (!hasText(current.street) && !hasText(current.postalCode));
  const same =
    !currentEmpty &&
    fold(current.street) === fold(candidate.street) &&
    fold(current.number) === fold(candidate.number) &&
    fold(current.postalCode) === fold(candidate.postalCode);
  const placeHint = [streetText(candidate), address.locality].filter(hasText).join(', ');
  return [{
    key: 'street', field: 'street', street: candidate, placeHint,
    status: currentEmpty ? 'fill' : same ? 'same' : 'differs',
    current: currentEmpty ? null : streetText(current), candidate: streetText(candidate),
    origin: address.origin, checkedAt: address.checkedAt,
  }];
}

function phoneRows(hq: ShowcaseLocationDraft | null, source: CompanyContactSource): ImportRow[] {
  const held = (hq?.phones ?? []).map(({ number }) => normalisePhone(number)).flatMap((n) => (n.ok ? [n.e164] : []));
  let used = (hq?.phones ?? []).filter(({ number }) => hasText(number)).length;
  const rows: ImportRow[] = [];
  for (const raw of source.phones) {
    const phone = normalisePhone(raw);
    const common = { field: 'phones' as const, current: null, origin: PROFILE, checkedAt: null };
    if (!phone.ok) {
      rows.push({ ...common, key: `phones:${raw}`, value: raw, candidate: raw, status: 'invalid-source' });
      continue;
    }
    if (rows.some(({ key }) => key === `phones:${phone.e164}`)) continue;
    const status: ImportRowStatus = held.includes(phone.e164) ? 'same' : used < MAX_PHONES_PER_LOCATION ? 'fill' : 'no-room';
    if (status === 'fill') used += 1;
    rows.push({ ...common, key: `phones:${phone.e164}`, value: phone.display, candidate: phone.display, status });
  }
  return rows;
}

function emailRows(hq: ShowcaseLocationDraft | null, source: CompanyContactSource): ImportRow[] {
  if (source.email === null || !hasText(source.email)) return [];
  const common = { field: 'emails' as const, current: null, origin: PROFILE, checkedAt: null };
  if (!isValidEmail(source.email)) {
    return [{ ...common, key: `emails:${source.email}`, value: source.email, candidate: source.email, status: 'invalid-source' }];
  }
  const email = normaliseChannelEmail(source.email);
  const filled = (hq?.emails ?? []).filter(hasText);
  const status: ImportRowStatus = filled.some((held) => isValidEmail(held) && normaliseChannelEmail(held) === email)
    ? 'same'
    : filled.length < MAX_EMAILS_PER_LOCATION ? 'fill' : 'no-room';
  return [{ ...common, key: `emails:${email}`, value: email, candidate: email, status }];
}

function websiteRow(website: string, source: CompanyContactSource): ImportRow[] {
  if (source.website === null || !hasText(source.website)) return [];
  const common = { key: 'website', field: 'website' as const, origin: PROFILE, checkedAt: null };
  const candidate = normalisePublicWebsite(source.website);
  const current = hasText(website) ? website.trim() : null;
  if (candidate === null) {
    return [{ ...common, value: source.website, candidate: source.website, current, status: 'invalid-source' }];
  }
  const status: ImportRowStatus =
    current === null ? 'fill' : normalisePublicWebsite(current) === candidate ? 'same' : 'differs';
  return [{ ...common, value: candidate, candidate, current, status }];
}

/** **Η σύγκριση** — μία γραμμή ανά πρόταση της πηγής. Πεδίο που η πηγή δεν γνωρίζει δεν εμφανίζεται. */
export function compareCardWithSource(
  drafts: readonly ShowcaseLocationDraft[],
  website: string,
  source: CompanyContactSource,
): ImportComparison {
  const hq = headquartersOf(drafts);
  return {
    rows: [...streetRow(hq, source), ...phoneRows(hq, source), ...emailRows(hq, source), ...websiteRow(website, source)],
  };
}

/** Πόσα θα άλλαζαν — ό,τι γράφει το κουμπί. Η ζωντανή ένδειξη «άλλαξαν τα στοιχεία» χωρίς αποθήκευση. */
export function differenceCount(comparison: ImportComparison): number {
  return comparison.rows.filter(({ status }) => status === 'fill' || status === 'differs').length;
}

/** Η προεπιλογή: παίρνεται ό,τι λείπει· ό,τι διαφέρει **κρατά** την τιμή της κάρτας. */
export function defaultDecisions(comparison: ImportComparison): ImportDecisions {
  return new Set(comparison.rows.filter(({ status }) => status === 'fill').map(({ key }) => key));
}

/** Το πεδίο άλλαξε από τον άνθρωπο ⇒ η σήμανση προέλευσης **φεύγει** — δεν είναι πια «από την εταιρεία». */
export function withoutProvenance(draft: ShowcaseLocationDraft, field: ImportField): ShowcaseLocationDraft {
  if (!(field in draft.provenance)) return draft;
  const { [field]: _dropped, ...rest } = draft.provenance;
  return { ...draft, provenance: rest };
}

function appendChannel(list: readonly string[], value: string): string[] {
  const blank = list.findIndex((entry) => !hasText(entry));
  return blank === -1 ? [...list, value] : list.map((entry, at) => (at === blank ? value : entry));
}

function applyRow(hq: ShowcaseLocationDraft, row: ImportRow): ShowcaseLocationDraft {
  const provenance = { ...hq.provenance, [row.field]: row.origin };
  switch (row.field) {
    case 'street':
      return { ...hq, street: row.street, placeHint: row.placeHint, provenance };
    case 'phones': {
      const numbers = appendChannel(hq.phones.map(({ number }) => number), row.value);
      const phones = numbers.map((number, at) => ({ number, extension: hq.phones[at]?.extension ?? '' }));
      return { ...hq, phones, provenance };
    }
    case 'emails':
      return { ...hq, emails: appendChannel(hq.emails, row.value), provenance };
    case 'website':
      return hq;
  }
}

export interface AppliedImport {
  readonly drafts: readonly ShowcaseLocationDraft[];
  readonly website: string;
  /** Η προέλευση της ιστοσελίδας — ανήκει στον οργανισμό, όχι σε κατάστημα. */
  readonly websiteOrigin: ImportOrigin | null;
  readonly applied: number;
}

/**
 * **Η εφαρμογή** — νέοι πίνακες, **κανένα** input δεν μεταλλάσσεται (η αναίρεση είναι απλώς το προηγούμενο στιγμιότυπο).
 *
 * Χωρίς έδρα ⇒ γεννιέται έδρα **χωρίς τόπο**, πρώτη στη λίστα· η φόρμα ζητά ήδη τόπο πριν την αποθήκευση.
 */
export function applyImport(
  drafts: readonly ShowcaseLocationDraft[],
  website: string,
  comparison: ImportComparison,
  decisions: ImportDecisions,
): AppliedImport {
  const taken = comparison.rows.filter(
    ({ key, status }) => decisions.has(key) && (status === 'fill' || status === 'differs'),
  );
  const websiteRowTaken = taken.find((row) => row.field === 'website');
  const locationRows = taken.filter((row) => row.field !== 'website');

  let next = drafts;
  if (locationRows.length > 0) {
    const existing = headquartersOf(drafts);
    const hq = locationRows.reduce(applyRow, existing ?? emptyLocationDraft('headquarters'));
    next = existing === null ? [hq, ...drafts] : drafts.map((draft) => (draft === existing ? hq : draft));
  }
  return {
    drafts: next,
    website: websiteRowTaken?.field === 'website' ? websiteRowTaken.value : website,
    websiteOrigin: websiteRowTaken?.origin ?? null,
    applied: taken.length,
  };
}
