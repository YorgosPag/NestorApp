/**
 * Report Aggregator Types — Public + Internal Firestore doc shapes
 *
 * SSoT for all report domain interfaces and minimal Firestore document shapes.
 * Extracted from report-data-aggregator.ts for SRP and reuse.
 *
 * @module services/report-engine/report-aggregator.types
 * @see ADR-265 (Enterprise Reports System)
 */

import type { EVMResult } from './evm-calculator';
import type { AgingBucketResult } from './aging-calculator';

// ============================================================================
// PUBLIC — Filter
// ============================================================================

export interface ReportFilter {
  companyId: string;
  projectId?: string;
  buildingId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================================================
// PUBLIC — Domain Result Interfaces
// ============================================================================

export interface TopBuyerItem {
  name: string;
  totalValue: number;
  unitCount: number;
}

export interface ContactsReportData {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPersona: Record<string, number>;
  byCity: Record<string, number>;
  newInPeriod: number;
  topBuyers: TopBuyerItem[];
  completenessRate: number;
  generatedAt: string;
}

export interface ProjectProgressItem {
  name: string;
  progress: number;
}

export interface BuildingProgressItem {
  name: string;
  progress: number;
  projectName: string;
}

export interface PricePerSqmItem {
  building: string;
  pricePerSqm: number;
}

export interface BOQVarianceItem {
  building: string;
  estimated: number;
  actual: number;
}

export interface ProjectsReportData {
  totalProjects: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalPortfolioValue: number;
  averageProgress: number;
  totalUnits: number;
  unitsByCommercialStatus: Record<string, number>;
  revenueByProject: Record<string, number>;
  projectNames: Record<string, string>;
  projectProgress: ProjectProgressItem[];
  buildingNames: Record<string, string>;
  buildingProgress: BuildingProgressItem[];
  unitsByBuilding: Record<string, Record<string, number>>;
  pricePerSqmByBuilding: PricePerSqmItem[];
  boqVarianceByBuilding: BOQVarianceItem[];
  energyClassDistribution: Record<string, number>;
  unitsByType: Record<string, number>;
  generatedAt: string;
}

export interface SalesReportData {
  totalRevenue: number;
  pipelineValue: number;
  soldUnits: number;
  forSaleUnits: number;
  conversionRate: number;
  averagePaymentCoverage: number;
  totalOverdueInstallments: number;
  totalOutstanding: number;
  chequesByStatus: Record<string, number>;
  legalPhases: Record<string, number>;
  agingBuckets: AgingBucketResult[];
  generatedAt: string;
}

export interface CrmReportData {
  totalOpportunities: number;
  pipelineByStage: Record<string, number>;
  pipelineValueByStage: Record<string, number>;
  wonCount: number;
  lostCount: number;
  winRate: number;
  avgDealValue: number;
  leadsBySource: Record<string, number>;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  overdueTasks: number;
  tasksByAssignee: Record<string, number>;
  totalCommunications: number;
  communicationsByChannel: Record<string, number>;
  communicationsByDirection: Record<string, number>;
  generatedAt: string;
}

export interface SpacesReportData {
  parking: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byZone: Record<string, number>;
    byBuilding: Record<string, number>;
    utilizationRate: number;
    totalValue: number;
    soldCount: number;
    salesRate: number;
  };
  storage: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byBuilding: Record<string, number>;
    utilizationRate: number;
    totalArea: number;
    totalValue: number;
    avgPricePerSqm: number;
    soldCount: number;
    salesRate: number;
  };
  linkedSpaces: number;
  unlinkedSpaces: number;
  generatedAt: string;
}

export interface ConstructionReportData {
  evmByBuilding: Record<string, EVMResult>;
  milestonesByStatus: Record<string, number>;
  totalMilestones: number;
  completedMilestones: number;
  phasesCount: number;
  averagePhaseProgress: number;
  boqEstimatedTotal: number;
  boqActualTotal: number;
  boqVariance: number;
  generatedAt: string;
}

export interface ComplianceReportData {
  totalWorkers: number;
  totalHoursLogged: number;
  totalOvertimeHours: number;
  totalStamps: number;
  attendanceRate: number;
  checkInsByMethod: Record<string, number>;
  workersByInsuranceClass: Record<string, number>;
  generatedAt: string;
}

export interface FinancialReportData {
  totalReceivables: number;
  totalCollected: number;
  collectionRate: number;
  agingBuckets: AgingBucketResult[];
  portfolioEVM: EVMResult | null;
  generatedAt: string;
}

export type ReportDomain =
  | 'contacts' | 'projects' | 'sales' | 'crm'
  | 'spaces' | 'construction' | 'compliance' | 'financial';

export interface ReportDataEnvelope {
  domain: ReportDomain;
  generatedAt: string;
  filter: ReportFilter;
  data: ContactsReportData | ProjectsReportData | SalesReportData
    | CrmReportData | SpacesReportData | ConstructionReportData
    | ComplianceReportData | FinancialReportData;
}

// ============================================================================
// INTERNAL — Minimal Firestore doc shapes for report queries
// ============================================================================

export interface ContactDoc {
  type?: string;
  status?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  personas?: Array<{ personaType?: string }>;
  addresses?: Array<{ city?: string }>;
  createdAt?: string;
}

export interface ProjectDoc {
  status?: string;
  type?: string;
  totalValue?: number;
  progress?: number;
  name?: string;
}

export interface UnitDoc {
  project?: string;
  buildingId?: string;
  type?: string;
  commercialStatus?: string;
  areas?: { gross?: number };
  energy?: { class?: string };
  commercial?: {
    askingPrice?: number;
    finalPrice?: number;
    buyerName?: string;
    legalPhase?: string;
    paymentSummary?: {
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      paidPercentage: number;
      overdueInstallments: number;
    };
  };
}

export interface BuildingDoc {
  name?: string;
  status?: string;
  progress?: number;
  totalArea?: number;
  totalValue?: number;
  projectId?: string;
}

export interface BOQItemDoc {
  buildingId?: string;
  estimatedQuantity?: number;
  actualQuantity?: number;
  materialUnitCost?: number;
  laborUnitCost?: number;
  equipmentUnitCost?: number;
}

export interface OpportunityDoc {
  stage?: string;
  estimatedValue?: number;
  source?: string;
}

export interface TaskDoc {
  status?: string;
  priority?: string;
  dueDate?: string;
  assignedTo?: string;
}

export interface CommunicationDoc {
  type?: string;
  direction?: string;
}

export interface ParkingDoc {
  status?: string;
  type?: string;
  price?: number;
  buildingId?: string;
  locationZone?: string;
}

export interface StorageDoc {
  status?: string;
  type?: string;
  area?: number;
  price?: number;
  buildingId?: string;
}

export interface AttendanceDoc {
  eventType?: string;
  method?: string;
  contactId?: string;
  timestamp?: string;
}

export interface EmploymentDoc {
  contactId?: string;
  totalHoursWorked?: number;
  overtimeHours?: number;
  stampsCount?: number;
  insuranceClassNumber?: number;
}

export interface ChequeDoc {
  status?: string;
  amount?: number;
}
