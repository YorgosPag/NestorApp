/**
 * @fileoverview Depreciation Engine — Fixed Asset Depreciation Service
 * @description Αποσβέσεις χρήσης (πλήρης σάρωση, ιδεμπότητη καταχώριση) + εκποιήσεις + πρόβλεψη
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 2.0.0 — 2026-10-15: ADR-ACC-010 §2.1.1 Φάση 4
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * 🔴 Φάση 4 (2026-10-15) — τι άλλαξε και γιατί:
 *   - διάβαζε τη ΣΕΛΙΔΑ (50 ενεργά) ⇒ τώρα `collectFixedAssets` (όλη η εμβέλεια ή σφάλμα), και όχι μόνο `active`:
 *     πάγιο που εκποιήθηκε μέσα στη χρήση αποσβένεται ως την εκποίηση·
 *   - υπόλοιπο αρχής από το μεταβλητό `accumulatedDepreciation` ⇒ τώρα από τον πίνακα αποσβέσεων
 *     (`depreciation-schedule.ts`): ίδιο πάγιο + ίδια χρήση = ίδιο ποσό, σε όποια σειρά κι όσες φορές·
 *   - δύο ανεξάρτητες εγγραφές ⇒ τώρα ΕΝΑΣ ατομικός, ιδεμπότητος γραφέας (`repository.postDepreciation`).
 */

import type { IDepreciationEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  FixedAsset,
  DepreciationPosting,
  DepreciationPostingOutcome,
  DepreciationRecord,
  DepreciationRunResult,
  DisposalResult,
} from '../../types/assets';
import { nowISO } from '@/lib/date-local';
import { chunkArray } from '@/lib/array-utils';
import { roundToTwo } from '../../utils/math';
import { accountingToday } from '../../utils/accounting-day';
import {
  depreciationForYear,
  depreciationScheduleThrough,
  isFullyDepreciatedAt,
  type DepreciationYear,
} from './depreciation-schedule';

/** Πόσες καταχωρίσεις (συναλλαγές, μία ανά πάγιο) τρέχουν ταυτόχρονα. */
const POSTING_CONCURRENCY = 20;

/** Η εκτέλεση αρνήθηκε ΠΡΙΝ γράψει οτιδήποτε. */
export class DepreciationRunError extends Error {
  constructor(readonly code: 'FISCAL_YEAR_NOT_ENDED', readonly fiscalYear: number) {
    super(`Depreciation run refused (${code}) for fiscal year ${fiscalYear}`);
    this.name = 'DepreciationRunError';
  }
}

/**
 * Συμμετέχει το πάγιο στην εκτέλεση; Το `inactive` (εκτός εκμετάλλευσης) ΟΧΙ — ΠΟΛ 1073/2015: καμία απόσβεση για
 * όσο είναι εκτός εκμετάλλευσης. ⚠️ Δεν κρατάμε ΔΙΑΣΤΗΜΑΤΑ αδράνειας, άρα η κατάσταση ισχύει για όλη τη χρήση.
 */
function participates(asset: FixedAsset): boolean {
  return asset.status !== 'inactive';
}

/** Η εγγραφή μιας γραμμής του πίνακα — χωρίς ταυτότητα (την αποφασίζει ο γραφέας). */
function recordBodyOf(asset: FixedAsset, row: DepreciationYear): Omit<DepreciationRecord, 'recordId'> {
  return {
    assetId: asset.assetId,
    fiscalYear: row.fiscalYear,
    acquisitionCost: asset.acquisitionCost,
    openingAccumulatedDepreciation: row.openingAccumulated,
    annualDepreciation: row.charge,
    closingAccumulatedDepreciation: row.closingAccumulated,
    closingNetBookValue: row.closingNetBookValue,
    appliedRate: asset.depreciationRate,
    monthsApplied: row.monthsApplied,
    journalEntryId: null,
    calculatedAt: nowISO(),
  };
}

/** Τι γράφεται για (πάγιο, χρήση) — `null` αν δεν υπάρχει απόσβεση. Καθαρό: τρέχει μέσα στη συναλλαγή. */
export function depreciationPostingFor(asset: FixedAsset, fiscalYear: number): DepreciationPosting | null {
  if (!participates(asset)) return null;
  const row = depreciationForYear(asset, fiscalYear);
  if (row.charge <= 0) return null;
  const fully = isFullyDepreciatedAt(asset, row);
  return {
    record: recordBodyOf(asset, row),
    assetProjection: {
      accumulatedDepreciation: row.closingAccumulated,
      netBookValue: row.closingNetBookValue,
      // Μόνο το `active` γίνεται `fully_depreciated` — ένα `disposed` μένει `disposed`.
      status: fully && asset.status === 'active' ? 'fully_depreciated' : asset.status,
      fullyDepreciatedDate: fully ? `${fiscalYear}-12-31` : asset.fullyDepreciatedDate,
    },
  };
}

function summarize(fiscalYear: number, outcomes: readonly DepreciationPostingOutcome[]): DepreciationRunResult {
  const posted: DepreciationRecord[] = [];
  const alreadyPosted: DepreciationRecord[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === 'posted') posted.push(outcome.record);
    else if (outcome.kind === 'already_posted') alreadyPosted.push(outcome.record);
  }
  const totalDepreciation = roundToTwo(
    [...posted, ...alreadyPosted].reduce((sum, record) => sum + record.annualDepreciation, 0)
  );
  return { fiscalYear, posted, alreadyPosted, totalDepreciation };
}

/**
 * Depreciation Engine — Υπολογισμός Αποσβέσεων
 *
 * Μέθοδος: Σταθερή (straight line) — η μόνη αποδεκτή από ΚΦΕ. Ο υπολογισμός ζει στο SSoT `depreciation-schedule.ts`.
 */
export class DepreciationEngine implements IDepreciationEngine {
  constructor(
    private readonly repository: IAccountingRepository,
    /** Η σημερινή ημέρα λογιστικής (Αθήνα) — ενέσιμη ώστε το «έχει λήξει η χρήση;» να ελέγχεται. */
    private readonly today: () => string = accountingToday
  ) {}

  /** Η απόσβεση μιας χρήσης για ένα πάγιο, από τον πίνακα αποσβέσεων (όχι από μεταβλητά πεδία του παγίου). */
  calculateAnnualDepreciation(asset: FixedAsset, fiscalYear: number): DepreciationRecord {
    return { ...recordBodyOf(asset, depreciationForYear(asset, fiscalYear)), recordId: '' };
  }

  /**
   * Εκτέλεση αποσβέσεων χρήσης (SAP AFAB / Xero «run depreciation»).
   *
   * - μόνο για χρήση που ΕΧΕΙ ΛΗΞΕΙ: ετήσια απόσβεση πριν τελειώσει η χρήση θα κατέγραφε μήνες που δεν πέρασαν·
   * - ΟΛΑ τα πάγια της εμβέλειας (πλήρης σάρωση)· ΜΙΑ ατομική συναλλαγή ανά πάγιο·
   * - ιδεμπότητη: η επανεκτέλεση ολοκληρώνει μια διακοπείσα εκτέλεση χωρίς να ξαναγράψει ό,τι πέρασε.
   */
  async bookDepreciations(fiscalYear: number): Promise<DepreciationRunResult> {
    if (this.today() <= `${fiscalYear}-12-31`) throw new DepreciationRunError('FISCAL_YEAR_NOT_ENDED', fiscalYear);

    const assets = await this.repository.collectFixedAssets({ scope: { kind: 'depreciationYear', fiscalYear } });
    // Προέλεγχος στο αντίγραφο της σάρωσης: αποφεύγει άδειες συναλλαγές. Η ΑΠΟΦΑΣΗ ξαναπαίρνεται μέσα στη συναλλαγή.
    const candidates = assets.filter((asset) => depreciationPostingFor(asset, fiscalYear) !== null);

    const outcomes: DepreciationPostingOutcome[] = [];
    for (const chunk of chunkArray(candidates, POSTING_CONCURRENCY)) {
      outcomes.push(...(await Promise.all(chunk.map((asset) => this.repository.postDepreciation({
        assetId: asset.assetId,
        fiscalYear,
        compute: (fresh) => depreciationPostingFor(fresh, fiscalYear),
      })))));
    }
    return summarize(fiscalYear, outcomes);
  }

  /** Υπολογισμός αποτελέσματος εκποίησης (0 = διαγραφή). */
  calculateDisposal(asset: FixedAsset, salePrice: number, disposalDate: string): DisposalResult {
    const netBookValue = asset.netBookValue;
    const gain = roundToTwo(Math.max(0, salePrice - netBookValue));
    const loss = roundToTwo(Math.max(0, netBookValue - salePrice));
    const disposalType: DisposalResult['disposalType'] = salePrice > 0 ? 'sale' : 'write_off';

    return {
      assetId: asset.assetId,
      acquisitionCost: asset.acquisitionCost,
      accumulatedDepreciation: asset.accumulatedDepreciation,
      netBookValue,
      salePrice,
      gain,
      loss,
      disposalDate,
      disposalType,
    };
  }

  /**
   * Πρόβλεψη αποσβέσεων των επόμενων χρήσεων (έως 5) — από τον ΙΔΙΟ πίνακα με την καταχώριση, ώστε πρόβλεψη και
   * πραγματικό να μη διαφωνούν ποτέ. Χρήσεις χωρίς απόσβεση (πλήρως αποσβεσμένο / εκποιημένο) παραλείπονται.
   */
  forecastDepreciations(asset: FixedAsset, years: number): DepreciationRecord[] {
    const firstYear = Number(this.today().substring(0, 4)) + 1;
    const lastYear = firstYear + Math.min(years, 5) - 1;
    return depreciationScheduleThrough(asset, lastYear)
      .filter((row) => row.fiscalYear >= firstYear && row.charge > 0)
      .map((row) => ({ ...recordBodyOf(asset, row), recordId: `forecast_${row.fiscalYear}` }));
  }
}
