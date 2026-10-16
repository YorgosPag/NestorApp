/**
 * @fileoverview Depreciation Engine — Fixed Asset Depreciation Service
 * @description Αποσβέσεις χρήσης: προεπισκόπηση, καταχώριση στο Βιβλίο Ε-Ε (σύγκλιση), αναίρεση· εκποιήσεις· πρόβλεψη
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 3.0.0 — 2026-10-15: ADR-ACC-010 §2.1.1 Φάσεις 4–5
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 *
 * 🔴 Φάση 4 (2026-10-15): πλήρης σάρωση (όχι σελίδα των 50) · υπόλοιπο αρχής από τον πίνακα αποσβέσεων · ΕΝΑΣ
 *   ατομικός, ιδεμπότητος γραφέας (`repository.postDepreciation`).
 * 🔴 Φάση 5 (2026-10-15): οι αποσβέσεις φτάνουν στο Βιβλίο Ε-Ε (έξοδο 31/12). Η εκτέλεση ΣΥΓΚΛΙΝΕΙ το καταχωρημένο
 *   στο σωστό (SAP AFAB test run → update run → repeat run) και η αναίρεση στο 0 (Xero rollback). Η απόφαση ζει στο
 *   καθαρό `depreciation-booking.ts`.
 */

import type { IDepreciationEngine, IAccountingRepository } from '../../types/interfaces';
import type {
  FixedAsset,
  DepreciationIntent,
  DepreciationPostedChange,
  DepreciationPostingOutcome,
  DepreciationPreview,
  DepreciationPreviewLine,
  DepreciationRecord,
  DepreciationRunBlocker,
  DepreciationRunResult,
  DisposalResult,
} from '../../types/assets';
import { chunkArray } from '@/lib/array-utils';
import { roundToTwo } from '../../utils/math';
import { accountingToday } from '../../utils/accounting-day';
import { depreciationForYear, depreciationScheduleThrough } from './depreciation-schedule';
import {
  bookedAmountOf,
  decideDepreciation,
  depreciationPeriodIdFor,
  depreciationRecordBodyOf,
  depreciationTargetFor,
} from './depreciation-booking';
import { postingPeriodDenialOf } from '../fiscal-period-transitions';

/** Πόσες καταχωρίσεις (συναλλαγές, μία ανά πάγιο) τρέχουν ταυτόχρονα. */
const POSTING_CONCURRENCY = 20;

/** Η εκτέλεση αρνήθηκε ΠΡΙΝ γράψει οτιδήποτε. */
export class DepreciationRunError extends Error {
  constructor(readonly code: DepreciationRunBlocker, readonly fiscalYear: number) {
    super(`Depreciation run refused (${code}) for fiscal year ${fiscalYear}`);
    this.name = 'DepreciationRunError';
  }
}

/** Γραμμή του πίνακα ως εγγραφή χωρίς καταχώριση (υπολογισμός / πρόβλεψη — ποτέ στο βιβλίο). */
function scheduledRecordOf(asset: FixedAsset, fiscalYear: number, recordId: string): DepreciationRecord {
  const row = depreciationForYear(asset, fiscalYear);
  return { ...depreciationRecordBodyOf(asset, row, row.charge), recordId, journalEntryId: null };
}

/** Ένα πάγιο με ό,τι είναι καταχωρημένο γι' αυτό στη χρήση. */
interface AssetBooking {
  readonly asset: FixedAsset;
  readonly record: DepreciationRecord | null;
}

function previewLineOf({ asset, record }: AssetBooking, fiscalYear: number): DepreciationPreviewLine | null {
  const { row, target } = depreciationTargetFor(asset, fiscalYear);
  const booked = bookedAmountOf(record);
  if (target === 0 && booked === 0) return null;
  return {
    assetId: asset.assetId,
    description: asset.description,
    category: asset.category,
    appliedRate: asset.depreciationRate,
    monthsApplied: target > 0 ? row.monthsApplied : 0,
    target,
    booked,
    delta: roundToTwo(target - booked),
  };
}

const sum = (values: readonly number[]): number => roundToTwo(values.reduce((total, value) => total + value, 0));

interface RunTally {
  readonly posted: DepreciationPostedChange[];
  readonly adjusted: DepreciationPostedChange[];
  readonly unchanged: DepreciationRecord[];
  readonly refused: { readonly assetId: string; readonly reason: 'LATER_YEAR_POSTED' }[];
}

function tallyOutcome(tally: RunTally, outcome: DepreciationPostingOutcome): void {
  if (outcome.kind === 'posted') (outcome.change.wasPosted ? tally.adjusted : tally.posted).push(outcome.change);
  else if (outcome.kind === 'refused') tally.refused.push({ assetId: outcome.assetId, reason: outcome.reason });
  else if (outcome.record !== null) tally.unchanged.push(outcome.record);
}

function summarize(fiscalYear: number, intent: DepreciationIntent, tally: RunTally): DepreciationRunResult {
  const changed = [...tally.posted, ...tally.adjusted];
  const totalDepreciation = sum([
    ...changed.map((change) => change.record.annualDepreciation),
    ...tally.unchanged.map((record) => record.annualDepreciation),
  ]);
  return { fiscalYear, intent, ...tally, totalDepreciation, bookedDelta: sum(changed.map((change) => change.delta)) };
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
    return scheduledRecordOf(asset, fiscalYear, '');
  }

  /** Τι εμποδίζει την εγγραφή — `book` θέλει χρήση που ΕΛΗΞΕ· και τα δύο θέλουν ανοιχτή την περίοδο 12. */
  private async runBlocker(fiscalYear: number, intent: DepreciationIntent): Promise<DepreciationRunBlocker | null> {
    if (intent === 'book' && this.today() <= `${fiscalYear}-12-31`) return 'FISCAL_YEAR_NOT_ENDED';
    return postingPeriodDenialOf(await this.repository.getFiscalPeriod(depreciationPeriodIdFor(fiscalYear)));
  }

  /** ΟΛΑ τα πάγια της χρήσης (πλήρης σάρωση) μαζί με ό,τι έχει καταχωρηθεί γι' αυτά. */
  private async bookingsFor(fiscalYear: number): Promise<AssetBooking[]> {
    const assets = await this.repository.collectFixedAssets({ scope: { kind: 'depreciationYear', fiscalYear } });
    const records = await this.repository.readDepreciationRecords(fiscalYear, assets.map((asset) => asset.assetId));
    return assets.map((asset) => ({ asset, record: records.get(asset.assetId) ?? null }));
  }

  /** Προεπισκόπηση (SAP AFAB test run / Xero πριν το «Post») — ΚΑΜΙΑ εγγραφή, επιτρέπεται πάντα. */
  async previewDepreciations(fiscalYear: number): Promise<DepreciationPreview> {
    const bookings = await this.bookingsFor(fiscalYear);
    const lines = bookings
      .map((booking) => previewLineOf(booking, fiscalYear))
      .filter((line): line is DepreciationPreviewLine => line !== null);
    const totalBooked = sum(lines.map((line) => line.booked));
    return {
      fiscalYear,
      lines,
      totalTarget: sum(lines.map((line) => line.target)),
      totalBooked,
      totalDelta: sum(lines.map((line) => line.delta)),
      blocker: await this.runBlocker(fiscalYear, 'book'),
      hasBooked: lines.some((line) => line.booked !== 0),
    };
  }

  /**
   * Σύγκλιση της χρήσης: `book` (καταχωρημένο → σωστό) ή `reverse` (καταχωρημένο → 0).
   * - αρνείται ΠΡΙΝ από κάθε ανάγνωση αν η χρήση/περίοδος δεν το επιτρέπει·
   * - ΟΛΑ τα πάγια (πλήρης σάρωση)· ΜΙΑ ατομική συναλλαγή ανά πάγιο, μόνο όπου ο προέλεγχος βρίσκει διαφορά·
   * - ιδεμπότητη: η επανεκτέλεση ολοκληρώνει μια διακοπείσα εκτέλεση και ΔΕΝ ξαναγράφει ό,τι ήδη συμφωνεί.
   */
  private async converge(fiscalYear: number, intent: DepreciationIntent): Promise<DepreciationRunResult> {
    const blocker = await this.runBlocker(fiscalYear, intent);
    if (blocker !== null) throw new DepreciationRunError(blocker, fiscalYear);

    const tally: RunTally = { posted: [], adjusted: [], unchanged: [], refused: [] };
    const pending: AssetBooking[] = [];
    for (const booking of await this.bookingsFor(fiscalYear)) {
      // Προέλεγχος στο αντίγραφο της σάρωσης: αποφεύγει άδειες συναλλαγές. Η ΑΠΟΦΑΣΗ ξαναπαίρνεται μέσα στη συναλλαγή.
      const decision = decideDepreciation(intent, fiscalYear, { asset: booking.asset, current: booking.record });
      if (decision.kind !== 'unchanged') pending.push(booking);
      else if (booking.record !== null) tally.unchanged.push(booking.record);
    }

    for (const chunk of chunkArray(pending, POSTING_CONCURRENCY)) {
      const outcomes = await Promise.all(chunk.map(({ asset }) => this.repository.postDepreciation({
        assetId: asset.assetId,
        fiscalYear,
        decide: (input) => decideDepreciation(intent, fiscalYear, input),
      })));
      for (const outcome of outcomes) tallyOutcome(tally, outcome);
    }
    return summarize(fiscalYear, intent, tally);
  }

  /** Εκτέλεση αποσβέσεων χρήσης που ΕΛΗΞΕ — καταχώριση στο Βιβλίο Ε-Ε (πρώτη φορά = όλο, μετά = μόνο η διαφορά). */
  bookDepreciations(fiscalYear: number): Promise<DepreciationRunResult> {
    return this.converge(fiscalYear, 'book');
  }

  /** Αναίρεση της χρήσης (Xero rollback) — αντιλογισμός, μόνο όπου είναι η νεότερη καταχωρημένη χρήση του παγίου. */
  reverseDepreciations(fiscalYear: number): Promise<DepreciationRunResult> {
    return this.converge(fiscalYear, 'reverse');
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
      .map((row) => scheduledRecordOf(asset, row.fiscalYear, `forecast_${row.fiscalYear}`));
  }
}
