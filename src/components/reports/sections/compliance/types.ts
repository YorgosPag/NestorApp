/**
 * @module reports/sections/compliance/types
 * @enterprise ADR-265 Phase 12 — Compliance & Labor view-model types
 */

export interface ComplianceReportPayload {
  totalWorkers: number;
  totalHoursLogged: number;
  totalOvertimeHours: number;
  totalStamps: number;
  attendanceRate: number;
  checkInsByMethod: Record<string, number>;
  workersByInsuranceClass: Record<string, number>;
  generatedAt: string;
}
