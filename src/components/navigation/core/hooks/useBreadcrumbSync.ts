'use client';

import { useEffect } from 'react';
import { useNavigation } from '../NavigationContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { PropertyHierarchyResponse } from '@/app/api/properties/[id]/hierarchy/route';

// ============================================================================
// ENTITY DESCRIPTOR — discriminated union per entity type
// ============================================================================

export type BreadcrumbProjectEntity = {
  type: 'project';
  id: string | undefined;
  name: string;
  companyId?: string;
  linkedCompanyId?: string | null;
  company?: string;
};

export type BreadcrumbBuildingEntity = {
  type: 'building';
  id: string | undefined;
  name: string;
  projectId: string;
};

export type BreadcrumbPropertyEntity = {
  type: 'property';
  id: string | undefined;
  name: string;
};

/** Pre-fetched hierarchy data — avoids double fetch when component already has the data. */
export type BreadcrumbPropertyResolvedEntity = {
  type: 'property-resolved';
  /** property.id — stable dep for the effect */
  id: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  building: { id: string; name: string } | null | undefined;
  property: { id: string; name: string };
};

export type BreadcrumbSpaceEntity = {
  type: 'space';
  id: string | undefined;
  name: string;
  spaceType: 'parking' | 'storage';
  buildingId?: string;
  projectId?: string;
};

export type BreadcrumbEntity =
  | BreadcrumbProjectEntity
  | BreadcrumbBuildingEntity
  | BreadcrumbPropertyEntity
  | BreadcrumbPropertyResolvedEntity
  | BreadcrumbSpaceEntity;

export interface UseBreadcrumbSyncOptions {
  /** Required for type === 'space'. Pass from useFirestoreBuildings(). */
  buildings?: Array<{ id: string; name: string; projectId?: string }>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Centralizes breadcrumb sync across all entity pages.
 * Each entity type uses the correct resolution strategy:
 *   - project   → NavigationContext projects (bootstrap-resolved company name)
 *   - building  → NavigationContext projects (project → company chain)
 *   - property  → Hierarchy API (Admin SDK, bypasses client rules)
 *   - space     → options.buildings + NavigationContext projects/companies
 *
 * @see ADR-016
 */
export function useBreadcrumbSync(
  entity: BreadcrumbEntity | null,
  options?: UseBreadcrumbSyncOptions,
): void {
  const { projects, syncBreadcrumb } = useNavigation();
  const buildings = options?.buildings;

  useEffect(() => {
    if (!entity?.id) return;

    // ── PROJECT ──────────────────────────────────────────────────────────────
    if (entity.type === 'project') {
      const navProject = projects.find(p => p.id === entity.id);
      const companyId = navProject?.linkedCompanyId || entity.linkedCompanyId || entity.companyId || '';
      const companyName = navProject?.company || entity.company || companyId;
      syncBreadcrumb({
        company: { id: companyId, name: companyName },
        project: { id: entity.id, name: entity.name },
        currentLevel: 'projects',
      });
      return;
    }

    // ── BUILDING ─────────────────────────────────────────────────────────────
    if (entity.type === 'building') {
      const project = projects.find(p => p.id === entity.projectId);
      if (!project) return;
      const companyId = project.linkedCompanyId || project.companyId;
      const companyName = project.company || companyId;
      syncBreadcrumb({
        company: { id: companyId, name: companyName },
        project: { id: project.id, name: project.name },
        building: { id: entity.id, name: entity.name },
        currentLevel: 'buildings',
      });
      return;
    }

    // ── PROPERTY-RESOLVED — data already fetched by caller, no extra request ──
    if (entity.type === 'property-resolved') {
      if (!entity.company || !entity.project) return;
      syncBreadcrumb({
        company: { id: entity.company.id, name: entity.company.name },
        project: { id: entity.project.id, name: entity.project.name },
        building: entity.building
          ? { id: entity.building.id, name: entity.building.name }
          : undefined,
        property: { id: entity.property.id, name: entity.property.name },
        currentLevel: 'properties',
      });
      return;
    }

    // ── PROPERTY — hierarchy API (Admin SDK, tenant-safe) ────────────────────
    if (entity.type === 'property') {
      let cancelled = false;

      async function syncFromHierarchy() {
        try {
          const data = await apiClient.get<PropertyHierarchyResponse>(
            API_ROUTES.PROPERTIES.HIERARCHY(encodeURIComponent(entity!.id!)),
          );
          if (cancelled || !data.company || !data.project) return;
          syncBreadcrumb({
            company: { id: data.company.id, name: data.company.name },
            project: { id: data.project.id, name: data.project.name },
            building: data.building
              ? { id: data.building.id, name: data.building.name }
              : undefined,
            property: { id: data.property.id, name: data.property.name },
            currentLevel: 'properties',
          });
        } catch {
          // Graceful — breadcrumb won't sync but page still works
        }
      }

      syncFromHierarchy();
      return () => { cancelled = true; };
    }

    // ── SPACE (parking / storage) ─────────────────────────────────────────────
    if (entity.type === 'space') {
      if (!buildings?.length || !projects.length) return;

      const building =
        (entity.buildingId ? buildings.find(b => b.id === entity.buildingId) : undefined) ??
        (entity.projectId ? buildings.find(b => b.projectId === entity.projectId) : undefined);

      if (!building?.projectId) return;
      const project = projects.find(p => p.id === building.projectId);
      if (!project) return;

      const companyId = project.linkedCompanyId || project.companyId;
      const companyName = project.company || companyId;
      syncBreadcrumb({
        company: { id: companyId, name: companyName },
        project: { id: project.id, name: project.name },
        building: { id: building.id, name: building.name },
        space: { id: entity.id, name: entity.name, type: entity.spaceType },
        currentLevel: 'spaces',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.id, entity?.type, projects, syncBreadcrumb, buildings]);
}
