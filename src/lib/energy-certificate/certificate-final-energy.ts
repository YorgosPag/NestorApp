/**
 * @fileoverview **Η τελική ενέργεια και η ωφέλιμη επιφάνεια του ΠΕΑ** (ADR-777 §8.95) — ό,τι χρειάζεται μια εκτίμηση
 * κόστους, αντιγραμμένο από το πιστοποιητικό.
 * @related `./energy-certificate.ts` (το μπλοκ που τα κουβαλά) · `constants/certificate-energy-sources.ts` ·
 *   `lib/energy-cost/listing-energy-cost.ts` (ο μόνος που τα πολλαπλασιάζει)
 * @module lib/energy-certificate/certificate-final-energy
 *
 * 🔑 **Γιατί τελική και όχι πρωτογενής**: ο λογαριασμός πληρώνεται σε **τελική** ενέργεια, **ανά πηγή**. Η πρωτογενής
 * (ο αριθμός της κλάσης) περιέχει συντελεστές μετατροπής που δεν πληρώνει κανείς. Το ΠΕΑ τυπώνει και τις δύο· εδώ
 * ζει η στήλη **«Συνολική»** του πίνακα «κατανάλωση τελικής ενέργειας ανά πηγή ενέργειας & τελική χρήση» (σελ. 2).
 *
 * 🔑 **Γιατί ωφέλιμη επιφάνεια του ΠΕΑ και όχι το εμβαδό της αγγελίας**: τα kWh/m² του πιστοποιητικού είναι ανά m²
 * **ωφέλιμης** επιφάνειας, μετρημένης με εξωτερικές διαστάσεις (ΤΟΤΕΕ 20701-4, §2.1.5). Πολλαπλασιασμός με άλλο
 * εμβαδό θα ήταν άλλος αριθμός με την ίδια όψη.
 *
 * ⚠️ **Ο πίνακας διαβάζεται ολόκληρος ή καθόλου**: μία άκυρη γραμμή (άγνωστη πηγή, διπλή πηγή, αριθμός εκτός ορίων)
 * ⇒ `null`. Ένας πίνακας με «τις γραμμές που κατάλαβα» θα έδινε εκτίμηση που **παραλείπει σιωπηλά** ένα καύσιμο.
 */

import { z } from 'zod';

import {
  CERTIFICATE_ENERGY_SOURCES,
  certificateEnergySourceRank,
  isCertificateEnergySource,
  type CertificateEnergySource,
} from '@/constants/certificate-energy-sources';
import { isPlainRecord } from '@/lib/type-guards';

/** Άνω όρια λογικής — πάνω από αυτά είναι λάθος πληκτρολόγησης. */
export const MAX_FINAL_ENERGY_PER_SQM = 2000;
export const MAX_USEFUL_AREA = 20000;

/** Μία γραμμή του πίνακα: πηγή και **συνολική** τελική κατανάλωση, kWh/m²·έτος, ένα δεκαδικό. */
export interface FinalEnergyLine {
  readonly source: CertificateEnergySource;
  readonly perSqm: number;
}

/** **Θετικός**, έως το όριο, με το πολύ ένα δεκαδικό. Το μηδέν δεν είναι γραμμή — είναι απουσία γραμμής. */
function isPositiveCertificateFigure(raw: unknown, max: number): raw is number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0 || raw > max) return false;
  return Math.abs(raw * 10 - Math.round(raw * 10)) < 1e-6;
}

export function isFinalEnergyPerSqm(raw: unknown): raw is number {
  return isPositiveCertificateFigure(raw, MAX_FINAL_ENERGY_PER_SQM);
}

export function isUsefulArea(raw: unknown): raw is number {
  return isPositiveCertificateFigure(raw, MAX_USEFUL_AREA);
}

function readLine(raw: unknown): FinalEnergyLine | null {
  if (!isPlainRecord(raw)) return null;
  const { source, perSqm } = raw;
  return isCertificateEnergySource(source) && isFinalEnergyPerSqm(perSqm) ? { source, perSqm } : null;
}

/**
 * Ό,τι είναι αποθηκευμένο → ο πίνακας σε **σειρά εντύπου**, ή `null` («δεν δηλώθηκε»).
 *
 * ⚠️ Κενός πίνακας ⇒ `null`: «δήλωσα ότι δεν καταναλώνει τίποτα» δεν είναι απάντηση που δίνει πιστοποιητικό.
 */
export function readFinalEnergy(raw: unknown): readonly FinalEnergyLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const lines: FinalEnergyLine[] = [];
  for (const entry of raw) {
    const line = readLine(entry);
    if (line === null || lines.some((seen) => seen.source === line.source)) return null;
    lines.push(line);
  }
  return lines.sort((a, b) => certificateEnergySourceRank(a.source) - certificateEnergySourceRank(b.source));
}

/** Ίδιος πίνακας; Και οι δύο είναι κανονικοποιημένοι (σειρά εντύπου) ⇒ αρκεί σύγκριση θέση-θέση. */
export function sameFinalEnergy(
  a: readonly FinalEnergyLine[] | null,
  b: readonly FinalEnergyLine[] | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((line, i) => line.source === b[i].source && line.perSqm === b[i].perSqm);
}

const finalEnergyLineSchema = z
  .object({ source: z.enum(CERTIFICATE_ENERGY_SOURCES), perSqm: z.number().refine(isFinalEnergyPerSqm) })
  .strict();

/** Ο πίνακας όπως τον στέλνει η φόρμα — **ολόκληρος** σε κάθε διόρθωση, ποτέ γραμμή-γραμμή. */
export const finalEnergySchema = z
  .array(finalEnergyLineSchema)
  .min(1)
  .max(CERTIFICATE_ENERGY_SOURCES.length)
  .refine((lines) => new Set(lines.map((line) => line.source)).size === lines.length);

export const usefulAreaSchema = z.number().refine(isUsefulArea);
