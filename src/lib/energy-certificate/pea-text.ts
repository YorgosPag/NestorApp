/**
 * @fileoverview **Ανάγνωση του κειμένου ενός ΠΕΑ** (ADR-777 §8.96) — καθαρή, ντετερμινιστική, ποτέ μαντεψιά.
 * @related `services/pdf/pdf-rasterize.service.ts#extractPdfText` (από πού έρχονται οι σελίδες) ·
 *   `./energy-class-ratio.ts` (η κλάση από EP/RR) · `./pea-proposal.ts` (ό,τι διαβάστηκε → πρόταση για το μπλοκ)
 * @module lib/energy-certificate/pea-text
 *
 * 🔑 **Πρότυπο με όνομα**: το έντυπο του Αρχείου Επιθεωρήσεων (buildingcert.gr) βγαίνει από PD4ML και έχει σταθερές
 * ετικέτες («Αρ. Πρωτοκόλλου:», «Ωφέλιμη Επιφάνεια:» …). Η διάταξη **μετρήθηκε** σε δύο πραγματικά ΠΕΑ (2025 · 2026,
 * ADR-777 §8.96.1) — όχι γράφτηκε από μνήμη. Αν αλλάξει το έντυπο, αλλάζει **αυτό** το αρχείο και η σταθερά του.
 *
 * 🔑 **Ανεξάρτητο από αλλαγές γραμμής**: το pdf.js και το PyMuPDF σπάνε τις γραμμές διαφορετικά (μετρημένο: δύο κελιά
 * του πίνακα βγαίνουν στην ίδια γραμμή, «4.4 11.2»). Ο αναγνώστης δουλεύει πάνω σε κείμενο με **ενοποιημένα κενά** και
 * διαβάζει ετικέτα → τιμή.
 *
 * ⚠️ **Ό,τι δεν διαβάζεται ⇒ `null` + όνομα στο `unread`** — ποτέ «ο πιο κοντινός αριθμός». Η κλάση **δεν** διαβάζεται
 * εδώ (στο έντυπο είναι εικόνα)· την υπολογίζει ο `energy-class-ratio` από τα EP και RR.
 *
 * 🔒 **Δεν διαβάζονται ποτέ** ονόματα (ιδιοκτήτης · επιθεωρητής) ούτε διεύθυνση: δεν τα χρειάζεται καμία λειτουργία, και
 * ό,τι δεν διαβάζεται δεν μπορεί να διαρρεύσει.
 */

import {
  CERTIFICATE_ENERGY_SOURCES,
  type CertificateEnergySource,
} from '@/constants/certificate-energy-sources';
import { normalizeCalendarDay } from '@/lib/date-local';
import { parseStrictDecimal } from '@/lib/survey-record/survey-number';

import { readFinalEnergy, type FinalEnergyLine } from './certificate-final-energy';

/** Το έντυπο που ξέρει να διαβάζει αυτός ο αναγνώστης. */
export const PEA_TEMPLATE = 'buildingcert-pd4ml' as const;

/**
 * Πού επαληθεύεται η γνησιότητα (Αρ. Πρωτοκόλλου + Αρ. Ασφαλείας): η φόρμα «Έλεγχος Εγκυρότητας ΠΕΑ» της αρχικής
 * σελίδας του Αρχείου Επιθεωρήσεων. ⚠️ Το έντυπο τυπώνει `…/checkCert.view`, που μετρήθηκε 404 (2026-10-14)· δεν
 * υπάρχει δημόσιο API ούτε όροι αυτόματης πρόσβασης ⇒ σύνδεσμος για τον άνθρωπο, ποτέ αυτόματη κλήση.
 */
export const PEA_VERIFY_URL = 'https://www.buildingcert.gr/';

/** Τα πεδία που διαβάζει — και τα ονόματα που μπορούν να βρεθούν στο `unread`. */
export const PEA_FIELDS = [
  'protocol',
  'securityNumber',
  'issuedOn',
  'validUntil',
  'unitTitle',
  'buildingUse',
  'totalArea',
  'usefulArea',
  'referenceEnergy',
  'primaryEnergy',
  'co2Emissions',
  'finalEnergy',
] as const;
export type PeaField = (typeof PEA_FIELDS)[number];

export interface PeaReading {
  readonly template: typeof PEA_TEMPLATE;
  /** Αρ. Πρωτοκόλλου, π.χ. `182439/2026`. Επαληθεύεται στο buildingcert.gr μαζί με τον αριθμό ασφαλείας. */
  readonly protocol: string | null;
  /** Αρ. Ασφαλείας, π.χ. `D3X0W-JF4UU-L2K4P-3`. */
  readonly securityNumber: string | null;
  readonly issuedOn: string | null;
  readonly validUntil: string | null;
  /** «Τίτλος Κτηριακής Μονάδας» χωρίς εισαγωγικά — η ένδειξη μονάδα ή κτήριο. */
  readonly unitTitle: string | null;
  /** «Χρήση» (π.χ. `Πολυκατοικία`) — η χρήση του **κτηρίου**, όχι της μονάδας. */
  readonly buildingUse: string | null;
  readonly totalArea: number | null;
  readonly usefulArea: number | null;
  /** Πρωτογενής του κτηρίου αναφοράς (RR), kWh/m²·έτος. */
  readonly referenceEnergy: number | null;
  /** Πρωτογενής του επιθεωρούμενου (EP), kWh/m²·έτος. */
  readonly primaryEnergy: number | null;
  readonly co2Emissions: number | null;
  readonly finalEnergy: readonly FinalEnergyLine[] | null;
  readonly unread: readonly PeaField[];
}

export type PeaTextResult = { readonly kind: 'read'; readonly reading: PeaReading } | { readonly kind: 'not-a-certificate' };

const NUMBER = String.raw`(\d{1,6}(?:[.,]\d{1,2})?)`;
const DATE = String.raw`(\d{2})\/(\d{2})\/(\d{4})`;
const HEADER = /ΠΙΣΤΟΠΟΙΗΤΙΚΟ\s+ΕΝΕΡΓΕΙΑΚΗΣ\s+ΑΠΟΔΟΣΗΣ/;
/**
 * «ανά m²» όπως βγαίνει από **κάθε** εξαγωγέα. ⚠️ **Μετρημένο** (pdf.js σε δύο πραγματικά ΠΕΑ, 2026-10-14): ο εκθέτης
 * είναι ξεχωριστό κομμάτι κειμένου ⇒ `[kWh/m 2 ]` · `[kg /m 2 ]`· το PyMuPDF δίνει `m2]`. Ένα `m2\]` έχανε και τα
 * τρία πεδία της κλάσης στην παραγωγή (ADR-777 §8.96.5).
 */
const PER_SQM = String.raw`\/\s*m\s*2\s*\]`;

/** Οι ετικέτες της σελίδας 1, ακριβώς όπως τις τυπώνει το έντυπο (μετά την ενοποίηση κενών). */
const PATTERNS = {
  protocol: /Αρ\.\s*Πρωτοκόλλου:\s*(\d{1,9}\/\d{4})/,
  securityNumber: /Αρ\.\s*Ασφαλείας:\s*([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9])\b/,
  issuedOn: new RegExp(String.raw`Ημερομηνία\s+Έκδοσης:\s*${DATE}`),
  validUntil: new RegExp(String.raw`Ημερομηνία\s+Ισχύος:\s*${DATE}`),
  unitTitle: /Τίτλος\s+Κτηριακής\s+Μονάδας:\s*["“«]?(.+?)["”»]?\s+Χρήση:/,
  buildingUse: /Χρήση:\s*(.+?)\s+Κλιματική\s+Ζώνη:/,
  totalArea: new RegExp(String.raw`Συνολική\s+Επιφάνεια:\s*${NUMBER}`),
  usefulArea: new RegExp(String.raw`Ωφέλιμη\s+Επιφάνεια:\s*${NUMBER}`),
  referenceEnergy: new RegExp(String.raw`Κτηρίου\s+αναφοράς\s*\[kWh\s*${PER_SQM}:\s*${NUMBER}`),
  primaryEnergy: new RegExp(String.raw`Επιθεωρούμενου\s+κτηρίου\s*\[kWh\s*${PER_SQM}:\s*${NUMBER}`),
  co2Emissions: new RegExp(String.raw`Υπολογιζόμενες\s+ετήσιες\s+εκπομπές\s+CO[2₂]\s*\[kg\s*${PER_SQM}:\s*${NUMBER}`),
} as const;

/** Οι γραμμές του πίνακα τελικής ενέργειας (σελ. 2), με τη σειρά του εντύπου — ίδια με το `CERTIFICATE_ENERGY_SOURCES`. */
const FINAL_ENERGY_ROWS: ReadonlyArray<readonly [CertificateEnergySource, RegExp]> = [
  ['electricity', /Ηλεκτρική/],
  ['oil', /Πετρέλαιο/],
  ['natural-gas', /Φυσικό\s+Αέριο/],
  ['other-fossil', /Άλλα\s+Ορυκτά\s+Καύσιμα/],
  ['solar', /Ηλιακή/],
  ['biomass', /Βιομάζα/],
  ['geothermal', /Γεωθερμία/],
  ['other-renewable', /Άλλη\s+ΑΠΕ/],
];

/** Ο πίνακας: από την επικεφαλίδα «ανα Πηγή Ενέργειας» ως τη γραμμή «Σύνολο». */
const FINAL_ENERGY_TABLE = /αν[αά]\s+Πηγή\s+Ενέργειας[\s\S]*?Ηλεκτρική([\s\S]*?)\sΣύνολο\s/;

/** 4 κελιά χρήσεων + «Συνολική» + «%» ⇒ η «Συνολική» είναι η προτελευταία. */
const FINAL_ENERGY_ROW_CELLS = 6;
const CELL = /^(?:\d{1,6}(?:[.,]\d{1,2})?|-{2,3})$/;

function flatten(page: string): string {
  return page.replace(/\s+/g, ' ').trim();
}

function capture(text: string, pattern: RegExp): string | null {
  const value = pattern.exec(text)?.[1]?.trim();
  return value === undefined || value === '' ? null : value;
}

function numberOf(text: string, pattern: RegExp): number | null {
  return parseStrictDecimal(capture(text, pattern));
}

function dateOf(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  return match === null ? null : normalizeCalendarDay(`${match[3]}-${match[2]}-${match[1]}`);
}

/** Τα κελιά μιας γραμμής πηγής: ό,τι ακολουθεί την ετικέτα της ως την ετικέτα της επόμενης. */
function rowCells(table: string, index: number): readonly string[] | null {
  const start = FINAL_ENERGY_ROWS[index][1].exec(table);
  if (start === null) return null;
  const rest = table.slice(start.index + start[0].length);
  const next = FINAL_ENERGY_ROWS.slice(index + 1)
    .map(([, label]) => label.exec(rest)?.index)
    .find((at) => at !== undefined);
  const cells = rest.slice(0, next).trim().split(' ').filter((cell) => cell !== '');
  return cells.every((cell) => CELL.test(cell)) && cells.length === FINAL_ENERGY_ROW_CELLS ? cells : null;
}

/**
 * Ο πίνακας τελικής ενέργειας, **ολόκληρος ή καθόλου** (ίδιος κανόνας με τον `readFinalEnergy`): μία γραμμή που δεν
 * διαβάζεται ⇒ `null`. Μηδενική «Συνολική» = απουσία γραμμής, όχι γραμμή με μηδέν.
 */
function finalEnergyOf(text: string): readonly FinalEnergyLine[] | null {
  const body = FINAL_ENERGY_TABLE.exec(text)?.[1];
  if (body === undefined) return null;
  const table = `Ηλεκτρική${body}`;
  const lines: { source: CertificateEnergySource; perSqm: number }[] = [];
  for (let index = 0; index < FINAL_ENERGY_ROWS.length; index++) {
    const cells = rowCells(table, index);
    if (cells === null) return null;
    const total = parseStrictDecimal(cells[FINAL_ENERGY_ROW_CELLS - 2]);
    if (total === null && cells[FINAL_ENERGY_ROW_CELLS - 2].startsWith('-')) continue;
    if (total === null) return null;
    if (total > 0) lines.push({ source: FINAL_ENERGY_ROWS[index][0], perSqm: total });
  }
  return lines.length === 0 ? null : readFinalEnergy(lines);
}

type PeaValues = Omit<PeaReading, 'template' | 'unread'>;

function valuesOf(text: string): PeaValues {
  return {
    protocol: capture(text, PATTERNS.protocol),
    securityNumber: capture(text, PATTERNS.securityNumber),
    issuedOn: dateOf(text, PATTERNS.issuedOn),
    validUntil: dateOf(text, PATTERNS.validUntil),
    unitTitle: capture(text, PATTERNS.unitTitle),
    buildingUse: capture(text, PATTERNS.buildingUse),
    totalArea: numberOf(text, PATTERNS.totalArea),
    usefulArea: numberOf(text, PATTERNS.usefulArea),
    referenceEnergy: numberOf(text, PATTERNS.referenceEnergy),
    primaryEnergy: numberOf(text, PATTERNS.primaryEnergy),
    co2Emissions: numberOf(text, PATTERNS.co2Emissions),
    finalEnergy: finalEnergyOf(text),
  };
}

/**
 * Οι σελίδες του PDF (μία συμβολοσειρά ανά σελίδα) → ό,τι γράφει το ΠΕΑ. Χωρίς την κεφαλίδα του εντύπου ⇒
 * `not-a-certificate`: ένα άλλο PDF δεν «διαβάζεται μισό».
 */
export function readPeaText(pages: readonly string[]): PeaTextResult {
  const text = flatten(pages.join(' '));
  if (!HEADER.test(text)) return { kind: 'not-a-certificate' };
  const values = valuesOf(text);
  const unread = PEA_FIELDS.filter((field) => values[field] === null);
  return { kind: 'read', reading: { template: PEA_TEMPLATE, ...values, unread } };
}
