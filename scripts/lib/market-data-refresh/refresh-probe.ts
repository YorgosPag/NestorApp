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

import type { SourceProbe } from '../cached-download';
import { mamaSourceUrl, type MamaWindow } from '../market-transactions/mama-download';
import { VALUE_ZONES_SOURCE_URL } from '../value-zones/zone-download';
import type { MamaInput, MarketSnapshot, ZoneSnapshot } from './refresh-snapshot';

export type Probe = (url: string) => Promise<SourceProbe>;

export interface ProbeDecision {
  readonly changed: boolean;
  /** Αναγνώσιμοι λόγοι — γράφονται στην αναφορά και στο log. */
  readonly reasons: readonly string[];
}

const UNCHANGED: ProbeDecision = { changed: false, reasons: [] };

function decision(reasons: readonly string[]): ProbeDecision {
  return reasons.length === 0 ? UNCHANGED : { changed: true, reasons };
}

function assertServed(probe: SourceProbe, label: string): void {
  if (probe.status < 200 || probe.status >= 300) throw new Error(`${label}: HTTP ${probe.status} από ${probe.url} — η πηγή δεν σερβίρει το αρχείο`);
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
