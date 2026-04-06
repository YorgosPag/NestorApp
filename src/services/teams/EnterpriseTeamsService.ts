/**
 * Enterprise Teams Management Service — Main class, DB ops, cache, singleton.
 * @see enterprise-teams-types.ts — type definitions
 * @see enterprise-teams-defaults.ts — fallback data factories
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import type {
  EnterpriseTeam, EnterpriseTeamMember, EnterpriseOrganizationChart,
  EnterprisePosition, EnterpriseTeamsConfiguration,
} from './enterprise-teams-types';
import {
  createFallbackConfiguration, createFallbackTeams, createFallbackTeamMembers,
  createFallbackOrganizationChart, createFallbackPositions, createDefaultPosition,
  createDefaultRolePermissions, createDefaultDisplaySettings,
  createDefaultComplianceSettings, createDefaultFeatureFlags,
} from './enterprise-teams-defaults';

export * from './enterprise-teams-types';
export * from './enterprise-teams-defaults';

const logger = createModuleLogger('EnterpriseTeamsService');

class EnterpriseTeamsService {
  private static instance: EnterpriseTeamsService | null = null;

  private db: Firestore | null = null;
  private teamsCache = new Map<string, { teams: EnterpriseTeam[]; cachedAt: number; ttl: number }>();
  private membersCache = new Map<string, { members: EnterpriseTeamMember[]; cachedAt: number; ttl: number }>();
  private orgChartCache = new Map<string, { chart: EnterpriseOrganizationChart; cachedAt: number; ttl: number }>();
  private configCache = new Map<string, { config: EnterpriseTeamsConfiguration; cachedAt: number; ttl: number }>();

  private readonly cacheTtl = {
    teams: 10 * 60 * 1000,       // 10 min
    members: 5 * 60 * 1000,      // 5 min
    orgChart: 15 * 60 * 1000,    // 15 min
    config: 30 * 60 * 1000,      // 30 min
    permissions: 30 * 60 * 1000, // 30 min
  };

  private constructor() {}

  public static getInstance(): EnterpriseTeamsService {
    if (!EnterpriseTeamsService.instance) {
      EnterpriseTeamsService.instance = new EnterpriseTeamsService();
    }
    return EnterpriseTeamsService.instance;
  }

  private async ensureFirebaseConnection(): Promise<void> {
    if (this.db) return;

    try {
      const app = initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });

      this.db = getFirestore(app);
      logger.info('Enterprise Teams Service: Firebase connection established');
    } catch (error) {
      logger.warn('Enterprise Teams Service: Firebase connection failed, using fallback mode', error);
    }
  }

  // --- Configuration Loading ---

  async loadTeamsConfiguration(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeamsConfiguration> {
    const cacheKey = `${organizationId}-${tenantId || 'default'}`;

    const cached = this.configCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.config;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const config = await this.loadConfigFromDatabase(organizationId, tenantId);

        this.configCache.set(cacheKey, {
          config,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.config,
        });

        logger.info(`Enterprise teams configuration loaded: ${organizationId}${tenantId ? ` (tenant: ${tenantId})` : ''}`);
        return config;
      }
    } catch (error) {
      logger.warn('Enterprise Teams Service: Database load failed, using fallback', error);
    }

    const fallbackConfig = createFallbackConfiguration(organizationId, tenantId);

    this.configCache.set(cacheKey, {
      config: fallbackConfig,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.config,
    });

    return fallbackConfig;
  }

  private async loadConfigFromDatabase(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeamsConfiguration> {
    const teams = await this.loadTeamsFromDatabase(organizationId, tenantId);
    const orgChart = await this.loadOrganizationChartFromDatabase(organizationId, tenantId);
    const positions = await this.loadPositionsFromDatabase(organizationId, tenantId);

    return {
      configId: `teams-${organizationId}-${tenantId || 'default'}`,
      version: '1.0.0',
      organizationId,
      tenantId,
      teams,
      positions,
      organizationChart: orgChart,
      rolePermissions: createDefaultRolePermissions(),
      displaySettings: createDefaultDisplaySettings(),
      complianceSettings: createDefaultComplianceSettings(),
      automationRules: [],
      lastUpdated: new Date(),
      updatedBy: SYSTEM_IDENTITY.ID,
      features: createDefaultFeatureFlags(),
    };
  }

  // --- Teams ---

  async getTeams(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeam[]> {
    const cacheKey = `teams-${organizationId}-${tenantId || 'default'}`;

    const cached = this.teamsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.teams;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const teams = await this.loadTeamsFromDatabase(organizationId, tenantId);

        this.teamsCache.set(cacheKey, {
          teams,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.teams,
        });

        return teams;
      }
    } catch (error) {
      logger.warn('Teams loading failed, using fallback', error);
    }

    const fallbackTeams = createFallbackTeams(organizationId, tenantId);

    this.teamsCache.set(cacheKey, {
      teams: fallbackTeams,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.teams,
    });

    return fallbackTeams;
  }

  private async loadTeamsFromDatabase(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeam[]> {
    const firestore = this.db;
    if (!firestore) {
      throw new Error('EnterpriseTeamsService not initialized');
    }

    const teamsQuery = tenantId
      ? query(
          collection(firestore, COLLECTIONS.TEAMS),
          where('organizationId', '==', organizationId),
          where('tenantId', '==', tenantId),
          where('isActive', '==', true),
          orderBy('name')
        )
      : query(
          collection(firestore, COLLECTIONS.TEAMS),
          where('organizationId', '==', organizationId),
          where('isActive', '==', true),
          orderBy('name')
        );

    const teamsSnapshot = await getDocs(teamsQuery);

    const teams: EnterpriseTeam[] = [];
    teamsSnapshot.forEach((docSnap) => {
      teams.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as EnterpriseTeam);
    });

    return teams;
  }

  // --- Team Members ---

  async getTeamMembers(
    teamId: string,
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeamMember[]> {
    const cacheKey = `members-${teamId}-${organizationId}-${tenantId || 'default'}`;

    const cached = this.membersCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.members;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const members = await this.loadTeamMembersFromDatabase(teamId, organizationId, tenantId);

        this.membersCache.set(cacheKey, {
          members,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.members,
        });

        return members;
      }
    } catch (error) {
      logger.warn('Team members loading failed, using fallback', error);
    }

    const fallbackMembers = createFallbackTeamMembers(teamId, organizationId);

    this.membersCache.set(cacheKey, {
      members: fallbackMembers,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.members,
    });

    return fallbackMembers;
  }

  private async loadTeamMembersFromDatabase(
    teamId: string,
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseTeamMember[]> {
    const firestore = this.db;
    if (!firestore) {
      throw new Error('EnterpriseTeamsService not initialized');
    }

    const membersQuery = tenantId
      ? query(
          collection(firestore, COLLECTIONS.CONTACTS),
          where('type', '==', 'employee'),
          where('department', '==', teamId),
          where('organizationId', '==', organizationId),
          where('tenantId', '==', tenantId),
          where('isActive', '==', true),
          orderBy('displayName')
        )
      : query(
          collection(firestore, COLLECTIONS.CONTACTS),
          where('type', '==', 'employee'),
          where('department', '==', teamId),
          where('organizationId', '==', organizationId),
          where('isActive', '==', true),
          orderBy('displayName')
        );

    const membersSnapshot = await getDocs(membersQuery);

    const members: EnterpriseTeamMember[] = [];
    membersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      members.push({
        id: docSnap.id,
        employeeId: data.employeeId || docSnap.id,
        displayName: data.displayName || data.firstName + ' ' + data.lastName,
        role: data.role || data.position || 'Team Member',
        department: data.department || teamId,
        position: data.position || createDefaultPosition(),
        level: data.level || 'mid',
        responsibilities: data.responsibilities || [],
        skills: data.skills || [],
        directReports: data.directReports || [],
        isActive: data.isActive !== false,
        availabilityStatus: data.availabilityStatus || 'available',
        startDate: normalizeToDate(data.startDate) ?? new Date(),
        lastUpdated: normalizeToDate(data.lastUpdated) ?? new Date(),
        updatedBy: data.updatedBy || 'system',
        privacyLevel: data.privacyLevel || 'internal',
        gdprConsent: data.gdprConsent !== false,
        dataRetentionPolicy: data.dataRetentionPolicy || 'standard',
        organizationId: data.organizationId || organizationId,
        ...(tenantId && { tenantId }),
      } as EnterpriseTeamMember);
    });

    return members;
  }

  // --- Organization Chart ---

  async getOrganizationChart(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseOrganizationChart> {
    const cacheKey = `orgchart-${organizationId}-${tenantId || 'default'}`;

    const cached = this.orgChartCache.get(cacheKey);
    if (cached && this.isCacheValid(cached.cachedAt, cached.ttl)) {
      return cached.chart;
    }

    try {
      await this.ensureFirebaseConnection();

      if (this.db) {
        const chart = await this.loadOrganizationChartFromDatabase(organizationId, tenantId);

        this.orgChartCache.set(cacheKey, {
          chart,
          cachedAt: Date.now(),
          ttl: this.cacheTtl.orgChart,
        });

        return chart;
      }
    } catch (error) {
      logger.warn('Organization chart loading failed, using fallback', error);
    }

    const fallbackChart = createFallbackOrganizationChart(organizationId, tenantId);

    this.orgChartCache.set(cacheKey, {
      chart: fallbackChart,
      cachedAt: Date.now(),
      ttl: this.cacheTtl.orgChart,
    });

    return fallbackChart;
  }

  private async loadOrganizationChartFromDatabase(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterpriseOrganizationChart> {
    const firestore = this.db;
    if (!firestore) {
      throw new Error('EnterpriseTeamsService not initialized');
    }

    const chartPath = tenantId
      ? `organization_charts/tenants/${tenantId}/${organizationId}/current`
      : `organization_charts/organizations/${organizationId}/current`;

    const chartDoc = await getDoc(doc(firestore, chartPath));

    if (!chartDoc.exists()) {
      throw new Error(`Organization chart not found: ${chartPath}`);
    }

    const chartData = chartDoc.data();
    const teams = await this.loadTeamsFromDatabase(organizationId, tenantId);
    const positions = await this.loadPositionsFromDatabase(organizationId, tenantId);

    return {
      id: chartDoc.id,
      name: chartData.name || `${organizationId} Organization Chart`,
      version: chartData.version || '1.0.0',
      rootTeamId: chartData.rootTeamId || teams[0]?.id || 'default-team',
      teams,
      positions,
      reportingStructure: chartData.reportingStructure || [],
      effectiveDate: normalizeToDate(chartData.effectiveDate) ?? new Date(),
      isActive: chartData.isActive !== false,
      complianceStatus: chartData.complianceStatus || 'compliant',
      organizationId,
      ...(tenantId && { tenantId }),
    };
  }

  private async loadPositionsFromDatabase(
    organizationId: string,
    tenantId?: string
  ): Promise<EnterprisePosition[]> {
    const firestore = this.db;
    if (!firestore) {
      throw new Error('EnterpriseTeamsService not initialized');
    }

    const positionsQuery = tenantId
      ? query(
          collection(firestore, COLLECTIONS.ROLES),
          where('organizationId', '==', organizationId),
          where('tenantId', '==', tenantId),
          where('isApproved', '==', true)
        )
      : query(
          collection(firestore, COLLECTIONS.ROLES),
          where('organizationId', '==', organizationId),
          where('isApproved', '==', true)
        );

    const positionsSnapshot = await getDocs(positionsQuery);

    const positions: EnterprisePosition[] = [];
    positionsSnapshot.forEach((docSnap) => {
      positions.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as EnterprisePosition);
    });

    return positions;
  }

  // --- Cache ---

  private isCacheValid(cachedAt: number, ttl: number): boolean {
    return Date.now() - cachedAt < ttl;
  }

  clearCache(): void {
    this.teamsCache.clear();
    this.membersCache.clear();
    this.orgChartCache.clear();
    this.configCache.clear();
    logger.info('Enterprise teams service cache cleared');
  }

  async warmCache(organizationId: string, tenantId?: string): Promise<void> {
    logger.info(`Warming teams cache for ${organizationId}${tenantId ? ` (tenant: ${tenantId})` : ''}`);

    await Promise.allSettled([
      this.getTeams(organizationId, tenantId),
      this.getOrganizationChart(organizationId, tenantId),
      this.loadTeamsConfiguration(organizationId, tenantId),
    ]);

    logger.info('Teams cache warmed successfully');
  }
}

export const enterpriseTeamsService = EnterpriseTeamsService.getInstance();

export default enterpriseTeamsService;
