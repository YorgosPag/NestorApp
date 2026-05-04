/**
 * Procurement Hooks — Barrel Export
 * @module hooks/procurement
 * @see ADR-267: Lightweight Procurement Module
 */

export { usePurchaseOrders, type POFilters } from './usePurchaseOrders';
export { usePurchaseOrderForm, type POFormState } from './usePurchaseOrderForm';
export { useSupplierMetrics, useSupplierComparison } from './useSupplierMetrics';
export { usePOSupplierContacts } from './usePOSupplierContacts';
export { useProcurementDashboard, type ProcurementDashboardStats, type CategorySpend, type MonthlyPoint } from './useProcurementDashboard';
export { useFrameworkAgreements } from './useFrameworkAgreements';
