/**
 * @fileoverview Depreciation Engine — Fixed Asset Depreciation Service
 * @description Ετήσιες αποσβέσεις + εκποιήσεις + forecasting
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IDepreciationEngine, IAccountingRepository } from '../../types/interfaces';
import type { FixedAsset, DepreciationRecord, DisposalResult } from '../../types/assets';
import { getDepreciationRate } from '../config/depreciation-config';

// ============================================================================
// DEPRECIATION ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Depreciation Engine — Υπολογισμός Αποσβέσεων
 *
 * Μέθοδος: Σταθερή (straight line) — η μόνη αποδεκτή από ΚΦΕ.
 * Υπολογισμός: (Αξία κτήσης - Υπολειμματική αξία) × Συντελεστής × (Μήνες/12)
 *
 * Implements IDepreciationEngine interface.
 */
export class DepreciationEngine implements IDepreciationEngine {
  constructor(private readonly repository: IAccountingRepository) {}

  // ── Pure Methods ──────────────────────────────────────────────────────────

  /**
   * Υπολογισμός ετήσιας απόσβεσης ενός παγίου
   *
   * @param asset - Πάγιο στοιχείο
   * @param fiscalYear - Φορολογικό έτος
   * @returns DepreciationRecord
   *
   * @remarks
   * - Pro-rata αν το πάγιο αποκτήθηκε μέσα στο έτος
   * - Δεν υπερβαίνει την αναπόσβεστη αξία (net book value)
   * - Αγνοεί πάγια που είναι fully_depreciated ή disposed
   */
  calculateAnnualDepreciation(asset: FixedAsset, fiscalYear: number): DepreciationRecord {
    const openingAccumulatedDepreciation = asset.accumulatedDepreciation;
    const depreciableBase = asset.acquisitionCost - asset.residualValue;

    // Pro-rata: μήνες χρήσης μέσα στο τρέχον φορολογικό έτος
    const monthsApplied = calculateMonthsInYear(
      asset.depreciationStartDate,
      asset.fullyDepreciatedDate,
      asset.disposalDate,
      fiscalYear
    );

    // Ετήσια απόσβεση (αναλογία μηνών)
    let annualDepreciation = roundToTwo(
      depreciableBase * (asset.depreciationRate / 100) * (monthsApplied / 12)
    );

    // Cap: δεν μπορεί να υπερβεί τη remaining αξία
    const remainingValue = depreciableBase - openingAccumulatedDepreciation;
    annualDepreciation = Math.min(annualDepreciation, Math.max(0, remainingValue));
    annualDepreciation = roundToTwo(annualDepreciation);

    const closingAccumulatedDepreciation = roundToTwo(
      openingAccumulatedDepreciation + annualDepreciation
    );
    const closingNetBookValue = roundToTwo(
      asset.acquisitionCost - closingAccumulatedDepreciation
    );

    return {
      recordId: '', // To be set by caller or repository
      assetId: asset.assetId,
      fiscalYear,
      acquisitionCost: asset.acquisitionCost,
      openingAccumulatedDepreciation,
      annualDepreciation,
      closingAccumulatedDepreciation,
      closingNetBookValue,
      appliedRate: asset.depreciationRate,
      monthsApplied,
      journalEntryId: null,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Μαζική εκτέλεση αποσβέσεων — τέλος χρήσης
   *
   * Φέρνει όλα τα ενεργά πάγια, υπολογίζει αποσβέσεις, αποθηκεύει records.
   */
  async bookDepreciations(fiscalYear: number): Promise<DepreciationRecord[]> {
    // Fetch active assets
    const assetsResult = await this.repository.listFixedAssets({
      status: 'active',
    });

    const records: DepreciationRecord[] = [];

    for (const asset of assetsResult.items) {
      // Αγνόησε πάγια που αγοράστηκαν μετά τη λήξη του φορολογικού έτους
      if (parseInt(asset.depreciationStartDate.substring(0, 4), 10) > fiscalYear) {
        continue;
      }

      const record = this.calculateAnnualDepreciation(asset, fiscalYear);

      // Αγνόησε μηδενικές αποσβέσεις
      if (record.annualDepreciation <= 0) continue;

      // Αποθήκευση στη βάση
      const { id } = await this.repository.createDepreciationRecord(record);

      // Ενημέρωση παγίου
      const newAccumulated = roundToTwo(
        asset.accumulatedDepreciation + record.annualDepreciation
      );
      const newNetBookValue = roundToTwo(asset.acquisitionCost - newAccumulated);
      const isFullyDepreciated = newNetBookValue <= asset.residualValue;

      await this.repository.updateFixedAsset(asset.assetId, {
        accumulatedDepreciation: newAccumulated,
        netBookValue: newNetBookValue,
        status: isFullyDepreciated ? 'fully_depreciated' : 'active',
        ...(isFullyDepreciated
          ? { fullyDepreciatedDate: `${fiscalYear}-12-31` }
          : {}),
      });

      records.push({ ...record, recordId: id });
    }

    return records;
  }

  /**
   * Υπολογισμός αποτελέσματος εκποίησης
   *
   * @param asset - Πάγιο στοιχείο
   * @param salePrice - Τιμή πώλησης (0 = διαγραφή)
   * @param disposalDate - Ημερομηνία εκποίησης
   * @returns DisposalResult
   */
  calculateDisposal(
    asset: FixedAsset,
    salePrice: number,
    disposalDate: string
  ): DisposalResult {
    const netBookValue = asset.netBookValue;
    const gain = roundToTwo(Math.max(0, salePrice - netBookValue));
    const loss = roundToTwo(Math.max(0, netBookValue - salePrice));

    const disposalType: DisposalResult['disposalType'] =
      salePrice > 0 ? 'sale' : 'write_off';

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
   * Πρόβλεψη μελλοντικών αποσβέσεων (1–5 χρόνια)
   *
   * @param asset - Πάγιο στοιχείο (current state)
   * @param years - Πλήθος ετών πρόβλεψης (max 5)
   * @returns DepreciationRecord[] (simulated, χωρίς recordId)
   */
  forecastDepreciations(asset: FixedAsset, years: number): DepreciationRecord[] {
    const maxYears = Math.min(years, 5);
    const records: DepreciationRecord[] = [];

    // Clone asset state for simulation
    let simulatedAccumulated = asset.accumulatedDepreciation;
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < maxYears; i++) {
      const forecastYear = currentYear + 1 + i;
      const depreciableBase = asset.acquisitionCost - asset.residualValue;
      const remainingValue = roundToTwo(depreciableBase - simulatedAccumulated);

      if (remainingValue <= 0) break;

      let annualDepreciation = roundToTwo(
        depreciableBase * (asset.depreciationRate / 100)
      );
      annualDepreciation = Math.min(annualDepreciation, remainingValue);
      annualDepreciation = roundToTwo(annualDepreciation);

      const closingAccumulated = roundToTwo(simulatedAccumulated + annualDepreciation);
      const closingNetBookValue = roundToTwo(asset.acquisitionCost - closingAccumulated);

      records.push({
        recordId: `forecast_${forecastYear}`,
        assetId: asset.assetId,
        fiscalYear: forecastYear,
        acquisitionCost: asset.acquisitionCost,
        openingAccumulatedDepreciation: simulatedAccumulated,
        annualDepreciation,
        closingAccumulatedDepreciation: closingAccumulated,
        closingNetBookValue,
        appliedRate: asset.depreciationRate,
        monthsApplied: 12,
        journalEntryId: null,
        calculatedAt: new Date().toISOString(),
      });

      simulatedAccumulated = closingAccumulated;
    }

    return records;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Υπολογισμός μηνών που ισχύει η απόσβεση μέσα σε ένα φορολογικό έτος
 */
function calculateMonthsInYear(
  startDate: string,
  fullyDepreciatedDate: string | null,
  disposalDate: string | null,
  fiscalYear: number
): number {
  const yearStart = `${fiscalYear}-01-01`;
  const yearEnd = `${fiscalYear}-12-31`;

  // Effective start = max(startDate, yearStart)
  const effectiveStart = startDate > yearStart ? startDate : yearStart;

  // Effective end = min(fullyDepreciatedDate, disposalDate, yearEnd)
  let effectiveEnd = yearEnd;
  if (fullyDepreciatedDate && fullyDepreciatedDate < effectiveEnd) {
    effectiveEnd = fullyDepreciatedDate;
  }
  if (disposalDate && disposalDate < effectiveEnd) {
    effectiveEnd = disposalDate;
  }

  if (effectiveStart > effectiveEnd) return 0;

  const startMonth = parseInt(effectiveStart.substring(5, 7), 10);
  const endMonth = parseInt(effectiveEnd.substring(5, 7), 10);

  return endMonth - startMonth + 1;
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
