/**
 * @fileoverview Cash Flow Forecast — Barrel Exports
 * @module services/cash-flow
 * @see ADR-268 Phase 8
 */

export type {
  CashFlowScenario,
  RecurringFrequency,
  RecurringCategory,
  RecurringPayment,
  CashFlowConfig,
  CashFlowMonthRow,
  ScenarioProjection,
  ActualVsForecast,
  PDCCalendarCheque,
  PDCCalendarDay,
  CashFlowAlertType,
  CashFlowAlertSeverity,
  CashFlowAlert,
  AlertThresholds,
  CashFlowFilter,
  CashFlowAPIResponse,
  RawCashFlowData,
} from './cash-flow.types';

export {
  SCENARIO_RATES,
  SCENARIO_DELAY_DAYS,
  DEFAULT_CASH_FLOW_CONFIG,
  DEFAULT_ALERT_THRESHOLDS,
} from './cash-flow.types';

export {
  buildAllScenarios,
  generateMonthKeys,
  formatMonthKey,
  monthLabel,
} from './cash-flow-projection-engine';

export {
  computeActualVsForecast,
  buildPDCCalendar,
  generateAlerts,
} from './cash-flow-analysis';
