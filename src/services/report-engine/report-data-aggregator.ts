/**
 * Report Data Aggregator — Firestore Queries -> Aggregated Report Data
 * Server-only: uses getAdminFirestore(). Zero N+1 queries.
 * @see ADR-265 §3
 */
import 'server-only';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { tallyBy, sumBy, sumByKey, countBy, rate, avg, groupByKey } from '@/utils/collection-utils';
import { computeEVM } from './evm-calculator';
import type { EVMResult } from './evm-calculator';
import { computeAgingBuckets } from './aging-calculator';
import type { BOQItem } from '@/types/boq';
import type { ConstructionPhase } from '@/types/building/construction';
import type { BuildingMilestone } from '@/types/building/milestone';
import type {
  ReportFilter, ContactsReportData, ProjectsReportData, SalesReportData,
  CrmReportData, SpacesReportData, ConstructionReportData, ComplianceReportData,
  FinancialReportData, ContactDoc, ProjectDoc, UnitDoc, BuildingDoc, BOQItemDoc,
  OpportunityDoc, TaskDoc, CommunicationDoc, ParkingDoc, StorageDoc,
  AttendanceDoc, EmploymentDoc, ChequeDoc,
} from './report-aggregator.types';
import {
  buildNameMap, buildRevenueByProject, buildUnitsByBuilding,
  buildPricePerSqm, buildBOQVariance, buildTopBuyers, computeCompleteness,
  buildOverdueInstallments,
} from './report-aggregator.helpers';

const logger = createModuleLogger('ReportDataAggregator');

export class ReportDataAggregator {
  private static readonly logger = logger;

  /** Contacts & Customers report */
  static async getContactsReport(filter: ReportFilter): Promise<ContactsReportData> {
    const db = getAdminFirestore();
    const cid = filter.companyId;

    const [contactsSnap, unitsSnap] = await Promise.all([
      db.collection(COLLECTIONS.CONTACTS).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.UNITS).where('companyId', '==', cid).get(),
    ]);

    const contacts = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() as ContactDoc }));
    const units = unitsSnap.docs.map(d => d.data() as UnitDoc);

    const inPeriod = contacts.filter(c => {
      if (!filter.dateFrom || !filter.dateTo || !c.createdAt) return false;
      return c.createdAt >= filter.dateFrom && c.createdAt <= filter.dateTo;
    });

    const personas: Record<string, number> = {};
    for (const c of contacts) {
      for (const p of c.personas ?? []) {
        if (p.personaType) personas[p.personaType] = (personas[p.personaType] || 0) + 1;
      }
    }

    const cities: Record<string, number> = {};
    for (const c of contacts) {
      const city = c.addresses?.[0]?.city;
      if (city) cities[city] = (cities[city] || 0) + 1;
    }

    const topBuyers = buildTopBuyers(units, contacts);
    const completeness = computeCompleteness(contacts);

    this.logger.info('Contacts report generated', { total: contacts.length });

    return {
      total: contacts.length,
      byType: tallyBy(contacts, c => c.type ?? 'unknown'),
      byStatus: tallyBy(contacts, c => c.status ?? 'unknown'),
      byPersona: personas,
      byCity: cities,
      newInPeriod: inPeriod.length,
      topBuyers,
      completenessRate: completeness,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Projects & Buildings report */
  static async getProjectsReport(filter: ReportFilter): Promise<ProjectsReportData> {
    const db = getAdminFirestore();
    const cid = filter.companyId;

    const [projectsSnap, unitsSnap, buildingsSnap, boqSnap] = await Promise.all([
      db.collection(COLLECTIONS.PROJECTS).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.UNITS).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.BUILDINGS).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.BOQ_ITEMS).where('companyId', '==', cid).get(),
    ]);

    const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as ProjectDoc }));
    const units = unitsSnap.docs.map(d => d.data() as UnitDoc);
    const buildings = buildingsSnap.docs.map(d => ({ id: d.id, ...d.data() as BuildingDoc }));
    const boqItems = boqSnap.docs.map(d => d.data() as BOQItemDoc);

    const projectNames = buildNameMap(projects);
    const buildingNames = buildNameMap(buildings);
    const projectNameById = new Map(projects.map(p => [p.id, p.name ?? p.id]));

    const revenueByProject = buildRevenueByProject(units, projectNames);

    const totalValue = sumBy(projects, p => p.totalValue ?? 0);
    const avgProgress = projects.length > 0
      ? avg(sumBy(projects, p => p.progress ?? 0), projects.length)
      : 0;

    this.logger.info('Projects report generated', {
      projects: projects.length, buildings: buildings.length, units: units.length,
    });

    return {
      totalProjects: projects.length,
      byStatus: tallyBy(projects, p => p.status ?? 'unknown'),
      byType: tallyBy(projects, p => p.type ?? 'unknown'),
      totalPortfolioValue: totalValue,
      averageProgress: Math.round(avgProgress),
      totalUnits: units.length,
      unitsByCommercialStatus: tallyBy(units, u => u.commercialStatus ?? 'unknown'),
      revenueByProject,
      projectNames,
      projectProgress: projects.map(p => ({ name: p.name ?? p.id, progress: p.progress ?? 0 })),
      buildingNames,
      buildingProgress: buildings.map(b => ({
        name: b.name ?? b.id,
        progress: b.progress ?? 0,
        projectName: projectNameById.get(b.projectId ?? '') ?? '',
      })),
      unitsByBuilding: buildUnitsByBuilding(units, buildingNames),
      pricePerSqmByBuilding: buildPricePerSqm(units, buildingNames),
      boqVarianceByBuilding: buildBOQVariance(boqItems, buildingNames),
      energyClassDistribution: tallyBy(units, u => u.energy?.class ?? 'unknown'),
      unitsByType: tallyBy(units, u => u.type ?? 'unknown'),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Sales & Financial report */
  static async getSalesReport(filter: ReportFilter): Promise<SalesReportData> {
    const db = getAdminFirestore();

    const unitsSnap = await db.collection(COLLECTIONS.UNITS)
      .where('companyId', '==', filter.companyId).get();
    const units = unitsSnap.docs.map(d => d.data() as UnitDoc);

    const sold = units.filter(u => u.commercialStatus === 'sold');
    const forSale = units.filter(u => u.commercialStatus === 'for_sale');

    const totalRevenue = sumBy(sold, u => u.commercial?.finalPrice ?? 0);
    const pipelineValue = sumBy(forSale, u => u.commercial?.askingPrice ?? 0);

    const unitsWithPayment = units.filter(u => u.commercial?.paymentSummary);
    const avgCoverage = unitsWithPayment.length > 0
      ? avg(
          sumBy(unitsWithPayment, u => u.commercial?.paymentSummary?.paidPercentage ?? 0),
          unitsWithPayment.length,
        )
      : 0;

    const totalOverdue = sumBy(units, u => u.commercial?.paymentSummary?.overdueInstallments ?? 0);
    const totalOutstanding = sumBy(units, u => u.commercial?.paymentSummary?.remainingAmount ?? 0);

    // Cheques
    const chequesSnap = await db.collection(COLLECTIONS.CHEQUES)
      .where('companyId', '==', filter.companyId).get();
    const cheques = chequesSnap.docs.map(d => d.data() as ChequeDoc);

    // Legal phases from units
    const legalPhases: Record<string, number> = {};
    for (const u of units) {
      const phase = u.commercial?.legalPhase;
      if (phase) legalPhases[phase] = (legalPhases[phase] || 0) + 1;
    }

    const fakeInstallments = buildOverdueInstallments(units);

    this.logger.info('Sales report generated', { sold: sold.length, forSale: forSale.length });

    return {
      totalRevenue,
      pipelineValue,
      soldUnits: sold.length,
      forSaleUnits: forSale.length,
      conversionRate: rate(sold.length, sold.length + forSale.length),
      averagePaymentCoverage: Math.round(avgCoverage * 100) / 100,
      totalOverdueInstallments: totalOverdue,
      totalOutstanding,
      chequesByStatus: tallyBy(cheques, c => c.status ?? 'unknown'),
      legalPhases,
      agingBuckets: computeAgingBuckets(fakeInstallments),
      generatedAt: new Date().toISOString(),
    };
  }

  /** CRM & Pipeline report */
  static async getCrmReport(filter: ReportFilter): Promise<CrmReportData> {
    const db = getAdminFirestore();
    const cid = filter.companyId;

    const [oppsSnap, tasksSnap, commsSnap] = await Promise.all([
      db.collection(COLLECTIONS.OPPORTUNITIES).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.TASKS).where('companyId', '==', cid).get(),
      db.collection(COLLECTIONS.COMMUNICATIONS).where('companyId', '==', cid).get(),
    ]);

    const opps = oppsSnap.docs.map(d => d.data() as OpportunityDoc);
    const tasks = tasksSnap.docs.map(d => d.data() as TaskDoc);
    const comms = commsSnap.docs.map(d => d.data() as CommunicationDoc);

    const won = countBy(opps, o => o.stage === 'closed_won');
    const lost = countBy(opps, o => o.stage === 'closed_lost');
    const wonOpps = opps.filter(o => o.stage === 'closed_won');
    const avgDeal = wonOpps.length > 0
      ? avg(sumBy(wonOpps, o => o.estimatedValue ?? 0), wonOpps.length)
      : 0;

    const today = new Date().toISOString().slice(0, 10);
    const overdue = countBy(tasks, t =>
      t.status !== 'completed' && t.dueDate !== undefined && t.dueDate < today,
    );

    this.logger.info('CRM report generated', { opps: opps.length, tasks: tasks.length });

    return {
      totalOpportunities: opps.length,
      pipelineByStage: tallyBy(opps, o => o.stage ?? 'unknown'),
      pipelineValueByStage: sumByKey(opps, o => o.stage ?? 'unknown', o => o.estimatedValue ?? 0),
      wonCount: won,
      lostCount: lost,
      winRate: rate(won, won + lost),
      avgDealValue: Math.round(avgDeal),
      leadsBySource: tallyBy(opps, o => o.source ?? 'unknown'),
      totalTasks: tasks.length,
      tasksByStatus: tallyBy(tasks, t => t.status ?? 'unknown'),
      tasksByPriority: tallyBy(tasks, t => t.priority ?? 'unknown'),
      overdueTasks: overdue,
      tasksByAssignee: tallyBy(tasks, t => t.assignedTo ?? 'unassigned'),
      totalCommunications: comms.length,
      communicationsByChannel: tallyBy(comms, c => c.type ?? 'unknown'),
      communicationsByDirection: tallyBy(comms, c => c.direction ?? 'unknown'),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Spaces (Parking + Storage) report */
  static async getSpacesReport(filter: ReportFilter): Promise<SpacesReportData> {
    const db = getAdminFirestore();

    const parkingSnap = await db.collection(COLLECTIONS.PARKING_SPACES)
      .where('companyId', '==', filter.companyId).get();
    const parking = parkingSnap.docs.map(d => d.data() as ParkingDoc);

    const storageSnap = await db.collection(COLLECTIONS.STORAGE)
      .where('companyId', '==', filter.companyId).get();
    const storage = storageSnap.docs.map(d => d.data() as StorageDoc);

    const parkingOccupied = countBy(parking, p => p.status === 'occupied' || p.status === 'sold');
    const storageOccupied = countBy(storage, s => s.status === 'occupied' || s.status === 'sold');
    const parkingSold = countBy(parking, p => p.status === 'sold');
    const storageSold = countBy(storage, s => s.status === 'sold');

    const storageTotalArea = sumBy(storage, s => s.area ?? 0);
    const storageTotalValue = sumBy(storage, s => s.price ?? 0);

    // Linked vs unlinked: spaces that have a buildingId are "linked"
    const linkedParking = countBy(parking, p => !!p.buildingId);
    const linkedStorage = countBy(storage, s => !!s.buildingId);
    const totalSpaces = parking.length + storage.length;
    const linkedSpaces = linkedParking + linkedStorage;

    this.logger.info('Spaces report generated', { parking: parking.length, storage: storage.length });

    return {
      parking: {
        total: parking.length,
        byStatus: tallyBy(parking, p => p.status ?? 'unknown'),
        byType: tallyBy(parking, p => p.type ?? 'unknown'),
        byZone: tallyBy(parking, p => p.locationZone ?? 'unknown'),
        byBuilding: tallyBy(parking, p => p.buildingId ?? 'unassigned'),
        utilizationRate: rate(parkingOccupied, parking.length),
        totalValue: sumBy(parking, p => p.price ?? 0),
        soldCount: parkingSold,
        salesRate: rate(parkingSold, parking.length),
      },
      storage: {
        total: storage.length,
        byStatus: tallyBy(storage, s => s.status ?? 'unknown'),
        byType: tallyBy(storage, s => s.type ?? 'unknown'),
        byBuilding: tallyBy(storage, s => s.buildingId ?? 'unassigned'),
        utilizationRate: rate(storageOccupied, storage.length),
        totalArea: storageTotalArea,
        totalValue: storageTotalValue,
        avgPricePerSqm: storageTotalArea > 0 ? Math.round(storageTotalValue / storageTotalArea) : 0,
        soldCount: storageSold,
        salesRate: rate(storageSold, storage.length),
      },
      linkedSpaces,
      unlinkedSpaces: totalSpaces - linkedSpaces,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Construction & Timeline report (includes EVM) */
  static async getConstructionReport(filter: ReportFilter): Promise<ConstructionReportData> {
    const db = getAdminFirestore();

    let phasesQuery = db.collection(COLLECTIONS.CONSTRUCTION_PHASES)
      .where('companyId', '==', filter.companyId);
    if (filter.buildingId) {
      phasesQuery = phasesQuery.where('buildingId', '==', filter.buildingId);
    }
    const phasesSnap = await phasesQuery.get();
    const phases = phasesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as ConstructionPhase);

    let milestonesQuery = db.collection(COLLECTIONS.BUILDING_MILESTONES)
      .where('companyId', '==', filter.companyId);
    if (filter.buildingId) {
      milestonesQuery = milestonesQuery.where('buildingId', '==', filter.buildingId);
    }
    const milestonesSnap = await milestonesQuery.get();
    const milestones = milestonesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as BuildingMilestone);

    let boqQuery = db.collection(COLLECTIONS.BOQ_ITEMS)
      .where('companyId', '==', filter.companyId);
    if (filter.buildingId) {
      boqQuery = boqQuery.where('buildingId', '==', filter.buildingId);
    }
    const boqSnap = await boqQuery.get();
    const boqItems = boqSnap.docs.map(d => ({ id: d.id, ...d.data() }) as BOQItem);

    // EVM per building
    const phasesByBuilding = groupByKey(phases, p => p.buildingId);
    const boqByBuilding = groupByKey(boqItems, i => i.buildingId);
    const milestonesByBuilding = groupByKey(milestones, m => m.buildingId);

    const evmByBuilding: Record<string, EVMResult> = {};
    for (const buildingId of Object.keys(phasesByBuilding)) {
      evmByBuilding[buildingId] = computeEVM(
        boqByBuilding[buildingId] ?? [],
        phasesByBuilding[buildingId],
        milestonesByBuilding[buildingId] ?? [],
      );
    }

    // BOQ totals
    let boqEstimated = 0;
    let boqActual = 0;
    for (const buildingId of Object.keys(evmByBuilding)) {
      boqEstimated += evmByBuilding[buildingId].budgetAtCompletion;
      boqActual += evmByBuilding[buildingId].actualCost;
    }

    const avgProgress = phases.length > 0
      ? Math.round(avg(sumBy(phases, p => p.progress), phases.length))
      : 0;

    const completedMs = countBy(milestones, m => m.status === 'completed');

    this.logger.info('Construction report generated', {
      phases: phases.length,
      milestones: milestones.length,
      boqItems: boqItems.length,
    });

    return {
      evmByBuilding,
      milestonesByStatus: tallyBy(milestones, m => m.status),
      totalMilestones: milestones.length,
      completedMilestones: completedMs,
      phasesCount: phases.length,
      averagePhaseProgress: avgProgress,
      boqEstimatedTotal: boqEstimated,
      boqActualTotal: boqActual,
      boqVariance: boqActual - boqEstimated,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Compliance & Labor report (EFKA + attendance data) */
  static async getComplianceReport(filter: ReportFilter): Promise<ComplianceReportData> {
    const db = getAdminFirestore();

    const attendanceSnap = await db.collection(COLLECTIONS.ATTENDANCE_EVENTS)
      .where('companyId', '==', filter.companyId).get();
    const attendance = attendanceSnap.docs.map(d => d.data() as AttendanceDoc);

    const employmentSnap = await db.collection(COLLECTIONS.EMPLOYMENT_RECORDS)
      .where('companyId', '==', filter.companyId).get();
    const employment = employmentSnap.docs.map(d => d.data() as EmploymentDoc);

    const checkIns = attendance.filter(a => a.eventType === 'check_in');
    const checkOuts = attendance.filter(a => a.eventType === 'check_out');
    const attendanceRate = checkIns.length > 0
      ? rate(checkOuts.length, checkIns.length)
      : 0;

    const uniqueWorkers = new Set(employment.map(e => e.contactId).filter(Boolean));

    this.logger.info('Compliance report generated', {
      attendance: attendance.length,
      employment: employment.length,
    });

    return {
      totalWorkers: uniqueWorkers.size,
      totalHoursLogged: sumBy(employment, e => e.totalHoursWorked ?? 0),
      totalOvertimeHours: sumBy(employment, e => e.overtimeHours ?? 0),
      totalStamps: sumBy(employment, e => e.stampsCount ?? 0),
      attendanceRate,
      checkInsByMethod: tallyBy(checkIns, a => a.method ?? 'unknown'),
      workersByInsuranceClass: tallyBy(employment, e => String(e.insuranceClassNumber ?? 0)),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Financial overview report (aging + portfolio EVM) */
  static async getFinancialReport(filter: ReportFilter): Promise<FinancialReportData> {
    const db = getAdminFirestore();

    // Receivables from units
    const unitsSnap = await db.collection(COLLECTIONS.UNITS)
      .where('companyId', '==', filter.companyId).get();
    const units = unitsSnap.docs.map(d => d.data() as UnitDoc);

    const totalReceivables = sumBy(units, u => u.commercial?.paymentSummary?.totalAmount ?? 0);
    const totalCollected = sumBy(units, u => u.commercial?.paymentSummary?.paidAmount ?? 0);

    const installmentsForAging = buildOverdueInstallments(units);

    // Portfolio EVM — aggregate from construction report
    let portfolioEVM: EVMResult | null = null;
    try {
      const constructionData = await this.getConstructionReport(filter);
      const evmResults = Object.values(constructionData.evmByBuilding);
      if (evmResults.length > 0) {
        portfolioEVM = {
          budgetAtCompletion: sumBy(evmResults, e => e.budgetAtCompletion),
          plannedValue: sumBy(evmResults, e => e.plannedValue),
          earnedValue: sumBy(evmResults, e => e.earnedValue),
          actualCost: sumBy(evmResults, e => e.actualCost),
          costVariance: sumBy(evmResults, e => e.costVariance),
          scheduleVariance: sumBy(evmResults, e => e.scheduleVariance),
          cpi: 0,
          spi: 0,
          estimateAtCompletion: 0,
          toCompletePI: 0,
          cpiHealth: 'green',
          spiHealth: 'green',
          sCurveData: [],
        };
        // Recompute indices from aggregated totals
        const { earnedValue: ev, actualCost: ac, plannedValue: pv, budgetAtCompletion: bac } = portfolioEVM;
        portfolioEVM.cpi = ac > 0 ? ev / ac : 0;
        portfolioEVM.spi = pv > 0 ? ev / pv : 0;
        portfolioEVM.estimateAtCompletion = portfolioEVM.cpi > 0 ? bac / portfolioEVM.cpi : bac;
        const tcpiDenom = bac - ac;
        portfolioEVM.toCompletePI = tcpiDenom > 0 ? (bac - ev) / tcpiDenom : 99.99;
        const { getTrafficLight } = await import('./evm-calculator');
        portfolioEVM.cpiHealth = getTrafficLight(portfolioEVM.cpi);
        portfolioEVM.spiHealth = getTrafficLight(portfolioEVM.spi);
      }
    } catch (err) {
      this.logger.warn('Failed to compute portfolio EVM', { error: String(err) });
    }

    this.logger.info('Financial report generated', { totalReceivables, totalCollected });

    return {
      totalReceivables,
      totalCollected,
      collectionRate: rate(totalCollected, totalReceivables),
      agingBuckets: computeAgingBuckets(installmentsForAging),
      portfolioEVM,
      generatedAt: new Date().toISOString(),
    };
  }
}
