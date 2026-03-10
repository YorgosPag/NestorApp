/**
 * @fileoverview Sales-to-Accounting Bridge — Barrel Exports (ADR-198)
 */

export { SalesAccountingBridge } from './sales-accounting-bridge';
export type {
  SalesAccountingEvent,
  SalesAccountingEventType,
  SalesAccountingResult,
  DepositInvoiceEvent,
  FinalSaleInvoiceEvent,
  CreditInvoiceEvent,
} from './types';
export { notifyAccountingOffice } from './accounting-notification';
