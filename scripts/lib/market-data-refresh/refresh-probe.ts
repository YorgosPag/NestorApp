/**
 * @fileoverview **«ΑΛΛΑΞΕ Η ΠΗΓΗ;» — ο φθηνός έλεγχος** πριν από την ακριβή παραγωγή (ADR-889 §11, απόφαση 1).
 * @related `cached-download.ts` (`probeSource`) · `refresh-snapshot.ts` (η καταγεγραμμένη προέλευση)
 *
 * 🔑 Ιδίωμα Renovate/Dependabot: **συχνός** έλεγχος, **σπάνια** δουλειά. Κάθε εβδομάδα ένα `HEAD` ανά αρχείο πηγής·
 * η παραγωγή (~1′ + λήψη) τρέχει μόνο όταν η **κεφαλίδα** (Last-Modified / μέγεθος) ή το **παράθυρο ετών** διαφέρει.
 *
 * ⚠️ Η κεφαλίδα είναι **σήμα**, όχι απόδειξη: μετρήθηκε μαζική επανεγγραφή των ετών 2017–2022 (2024-01-17). Αν η
 * κεφαλίδα αλλάξει αλλά τα bytes όχι, η παραγωγή βγάζει byte-ταυτόσημη έξοδο και **δεν ανοίγει PR**. Η αλήθεια είναι
 * το sha256 της εξόδου, όχι η ημερομηνία του διακομιστή.
 */

import { SourceHttpError, type SourceAccessRestriction, type SourceProbe } from '../cached-download';
import { MAMA_SOURCE_ACCESS, mamaSourceUrl, type MamaWindow } from '../market-transactions/mama-download';
import { VALUE_ZONES_SOURCE_URL } from '../value-zones/zone-download';
import type { MamaInput, MarketSnapshot, ZoneSnapshot } from './refresh-snapshot';

export type Probe = (url: string) => Promise<SourceProbe>;

export interface ProbeDecision {
  readonly changed: boolean;
  /** Αναγνώσιμοι λόγοι — γράφονται στην αναφορά και στο log. */
  readonly reasons: readonly string[];
}

/**
 * Η κρίση **μίας** πηγής: ελέγχθηκε (άλλαξε ή όχι) **ή** είναι απρόσιτη από εδώ.
 *
 * 🔑 Οι δύο πηγές κρίνονται **χωριστά** (ADR-889 §11.10): ο gsis.gr απαντά 403 εκτός Ελλάδας (μετρημένο 2026-09-29),
 * ενώ το data.gov.gr περνά. Μια απρόσιτη πηγή **δεν** ρίχνει την άλλη — και δεν γίνεται ποτέ σιωπηλό «ίδιο»: το αν είναι
 * γνωστός περιορισμός (⚠️) ή βλάβη (🔴) το κρίνει το `classifyAccess`.
 */
export type SourceCheck =
  | { readonly reachable: true; readonly decision: ProbeDecision }
  /** `status`: η απάντηση του διακομιστή (`SourceHttpError`)· `null` = δίκτυο / 5xx / άλλο σφάλμα. */
  | { readonly reachable: false; readonly reason: string; readonly status: number | null };

/**
 * Η πρόσβαση μιας πηγής σε σχέση με τον **δηλωμένο** περιορισμό της (ADR-889 §11.11):
 * - `ok` — απάντησε, κανένας περιορισμός
 * - `expected-restriction` — απρόσιτη με **ακριβώς** το δηλωμένο status ⇒ ⚠️ (το κόκκινο το δίνει η φρεσκάδα, Ε8)
 * - `restriction-lifted` — δηλωμένη ως περιορισμένη, αλλά **απάντησε** ⇒ ⚠️ «η δήλωση ίσως πάλιωσε»
 * - `unexpected` — κάθε άλλη αποτυχία (5xx, δίκτυο, άλλο status, αδήλωτη) ⇒ 🔴
 */
export type SourceAccess = 'ok' | 'expected-restriction' | 'restriction-lifted' | 'unexpected';

export function classifyAccess(check: SourceCheck, restriction: SourceAccessRestriction | null): SourceAccess {
  if (check.reachable) return restriction === null ? 'ok' : 'restriction-lifted';
  return restriction !== null && check.status === restriction.status ? 'expected-restriction' : 'unexpected';
}

/** Οι πηγές της ανανέωσης, σε σταθερή σειρά (αναφορά, log, παραγωγή). */
export const SOURCE_IDS = ['market', 'zones'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

/** Τα ονόματα των πηγών — **ένα** σημείο για επικεφαλίδα, ετυμηγορία και log. */
export const SOURCE_LABELS: Readonly<Record<SourceId, string>> = { market: 'Συμβόλαια (ΜΑΜΑ)', zones: 'Ζώνες αντικειμενικών αξιών' };

/** Ο δηλωμένος περιορισμός κάθε πηγής — η δήλωση ζει δίπλα στο URL της, εδώ μόνο αντιστοιχίζεται. */
export const SOURCE_RESTRICTIONS: Readonly<Record<SourceId, SourceAccessRestriction | null>> = { market: MAMA_SOURCE_ACCESS, zones: null };

export type SourceChecks = Readonly<Record<SourceId, SourceCheck>>;

/** Η πρόσβαση κάθε πηγής, με τον δηλωμένο περιορισμό της. */
export function accessOf(checks: SourceChecks): Readonly<Record<SourceId, SourceAccess>> {
  return { market: classifyAccess(checks.market, SOURCE_RESTRICTIONS.market), zones: classifyAccess(checks.zones, SOURCE_RESTRICTIONS.zones) };
}

/**
 * Τρέχει τον έλεγχο μιας πηγής και μετατρέπει **κάθε** αποτυχία του (HTTP ≠ 2xx/404, δίκτυο, απρόσμενο έτος) σε
 * `reachable: false` με το αρχικό μήνυμα. Με `force` η κεφαλίδα δεν αποφασίζει — η **προσβασιμότητα** όμως ελέγχεται
 * πάντα, ώστε η παραγωγή να μην ξεκινήσει μια λήψη που είναι γνωστό ότι θα κοπεί.
 */
export async function checkSource(run: () => Promise<ProbeDecision>, force: boolean): Promise<SourceCheck> {
  try {
    const decision = await run();
    if (!force) return { reachable: true, decision };
    return { reachable: true, decision: { changed: true, reasons: ['παραγωγή με `--force` (η κεφαλίδα δεν αποφασίζει)', ...decision.reasons] } };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return { reachable: false, reason, status: error instanceof SourceHttpError ? error.status : null };
  }
}

/** Θα ξαναπαραχθεί; — μόνο αν η πηγή είναι προσβάσιμη **και** άλλαξε. */
export function needsBuild(check: SourceCheck): boolean {
  return check.reachable && check.decision.changed;
}

const UNCHANGED: ProbeDecision = { changed: false, reasons: [] };

function decision(reasons: readonly string[]): ProbeDecision {
  return reasons.length === 0 ? UNCHANGED : { changed: true, reasons };
}

function assertServed(probe: SourceProbe, label: string): void {
  if (probe.status >= 200 && probe.status < 300) return;
  throw new SourceHttpError(`${label}: HTTP ${probe.status} από ${probe.url} — η πηγή δεν σερβίρει το αρχείο`, probe.url, probe.status);
}

/** Διαφορά κεφαλίδας ↔ καταγεγραμμένης προέλευσης. Άγνωστη ημερομηνία ⇒ «άλλαξε» (αποφασίζει το sha256 της εξόδου). */
function headerChange(label: string, probe: SourceProbe, recorded: { lastModified: string | null; bytes?: number }): string | null {
  if (probe.lastModified === null || recorded.lastModified === null) return `${label}: χωρίς Last-Modified — κρίνει το περιεχόμενο`;
  if (probe.lastModified !== recorded.lastModified) return `${label}: Last-Modified ${recorded.lastModified} → ${probe.lastModified}`;
  if (recorded.bytes !== undefined && probe.bytes !== null && probe.bytes !== recorded.bytes) {
    return `${label}: μέγεθος ${recorded.bytes} → ${probe.bytes} bytes`;
  }
  return null;
}

async function yearChange(year: number, recorded: MamaInput | undefined, probe: Probe): Promise<string | null> {
  const label = `ΜΑΜΑ ${year}`;
  const result = await probe(mamaSourceUrl(year));
  assertServed(result, label);
  if (recorded === undefined) return `${label}: νέο έτος στο παράθυρο`;
  return headerChange(label, result, recorded);
}

/** Τα συμβόλαια: κύλιση παραθύρου + κάθε έτος του παραθύρου. Χωρίς προηγούμενη έξοδο ⇒ «άλλαξε». */
export async function probeMarket(before: MarketSnapshot | null, window: MamaWindow, probe: Probe): Promise<ProbeDecision> {
  if (before === null) return decision(['συμβόλαια: δεν υπάρχει προηγούμενη έξοδος']);
  const reasons: string[] = [];
  if (before.window.from !== window.from || before.window.to !== window.to) {
    reasons.push(`συμβόλαια: παράθυρο ${before.window.from}–${before.window.to} → ${window.from}–${window.to}`);
  }
  const byYear = new Map(before.inputs.map((input) => [input.year, input]));
  for (let year = window.from; year <= window.to; year += 1) {
    const reason = await yearChange(year, byYear.get(year), probe);
    if (reason !== null) reasons.push(reason);
  }
  return decision(reasons);
}

/** Οι ζώνες: ένα zip. Η προέλευση των ζωνών δεν κρατά μέγεθος — μόνο Last-Modified + sha256. */
export async function probeZones(before: ZoneSnapshot | null, probe: Probe): Promise<ProbeDecision> {
  if (before === null) return decision(['ζώνες: δεν υπάρχει προηγούμενη έξοδος']);
  const result = await probe(VALUE_ZONES_SOURCE_URL);
  assertServed(result, 'ζώνες');
  if (before.source.url !== VALUE_ZONES_SOURCE_URL) return decision([`ζώνες: νέα διεύθυνση πόρου ${VALUE_ZONES_SOURCE_URL}`]);
  const reason = headerChange('ζώνες', result, before.source);
  return decision(reason === null ? [] : [reason]);
}
