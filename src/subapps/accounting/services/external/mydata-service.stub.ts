/**
 * @fileoverview myDATA Service Stub — Placeholder for ΑΑΔΕ Integration
 * @description Stub implementation — throws "not configured" until ΑΑΔΕ credentials are set
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-003 myDATA Integration
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { IMyDataService } from '../../types/interfaces';
import type { MyDataSubmission, ReceivedDocument, MyDataConfig } from '../../types/mydata';
import type { ExpenseCategory, PeriodRange } from '../../types/common';

// ============================================================================
// MYDATA SERVICE STUB
// ============================================================================

const NOT_CONFIGURED_MSG = '[myDATA] Η σύνδεση με το myDATA δεν έχει ρυθμιστεί. Απαιτούνται ΑΑΔΕ credentials (Subscription Key + ΑΦΜ).';

/**
 * myDATA Service Stub
 *
 * Placeholder implementation — all methods throw until the service
 * is properly configured with ΑΑΔΕ production/test credentials.
 *
 * Will be replaced with a real implementation in a future phase
 * once Giorgos provides myDATA subscription keys.
 */
export class MyDataServiceStub implements IMyDataService {

  async submitInvoice(_invoiceId: string): Promise<MyDataSubmission> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async cancelInvoice(_invoiceId: string, _mark: string): Promise<MyDataSubmission> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async classifyReceivedDocument(
    _mark: string,
    _classification: ExpenseCategory
  ): Promise<MyDataSubmission> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async fetchReceivedDocuments(_dateRange: PeriodRange): Promise<ReceivedDocument[]> {
    throw new Error(NOT_CONFIGURED_MSG);
  }

  async getConfig(): Promise<MyDataConfig> {
    throw new Error(NOT_CONFIGURED_MSG);
  }
}
