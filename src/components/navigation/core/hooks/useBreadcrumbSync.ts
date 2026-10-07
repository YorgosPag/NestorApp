'use client';

import { useEffect, useRef } from 'react';
import { useNavigation } from '../NavigationContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { PropertyHierarchyResponse } from '@/app/api/properties/[id]/hierarchy/route';
import { breadcrumbCompanyName, projectBreadcrumbTrail } from './breadcrumb-company-name';

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

/**
 * Το **περιεχόμενο** ενός περιγραφικού ως σταθερό κλειδί εξάρτησης: ίδια πεδία ⇒ ίδιο κλειδί, όποια κι αν είναι η
 * ταυτότητα του αντικειμένου (οι σελίδες το φτιάχνουν inline σε κάθε render). Τα περιγραφικά είναι μικρά, επίπεδα
 * (το `property-resolved` ένα επίπεδο βαθύτερα) και μόνο από κείμενα — η σειριοποίηση είναι αμελητέα.
 */
export function breadcrumbEntityKey(entity: BreadcrumbEntity | null): string | null {
  return entity === null ? null : JSON.stringify(entity);
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
  const { projects, companies, syncBreadcrumb, selectProperty } = useNavigation();
  const buildings = options?.buildings;
  // Όσα ΕΜΦΑΝΙΖΟΝΤΑΙ είναι και εξαρτήσεις — **όλα**, όχι όσα θυμήθηκε κάποιος να απαριθμήσει. Η λίστα ήταν
  // χειρόγραφη (`id`, `type`, `name`, εταιρεία του έργου) και της έλειπαν ο γονέας του χώρου (`buildingId`,
  // `projectId`), το έργο του κτιρίου και ολόκληρη η ιεραρχία του `property-resolved`: θέση που άλλαζε κτίριο
  // κρατούσε ίδια ταυτότητα και όνομα ⇒ το breadcrumb έμενε στο ΠΑΛΙΟ κτίριο (ADR-898 §21.6 Ε7). Το κλειδί
  // παράγεται πλέον από το ίδιο το περιγραφικό, άρα νέο πεδίο δεν μπορεί να ξεχαστεί.
  const entityKey = breadcrumbEntityKey(entity);

  // 🔴 Το ακίνητο που ΕΦΥΓΕ καθαρίζει το επίπεδό του (ADR-329 §3.9). Το `if (!entity?.id) return`
  //    παρακάτω άφηνε το breadcrumb στο τελευταίο ακίνητο: αποεπιλογή, ή άνοιγμα κάδου/αρχείου, και
  //    η κεφαλίδα συνέχιζε να ονομάζει ακίνητο που η οθόνη δεν δείχνει πια.
  //    ⚠️ Μόνο για ακίνητο: οι άλλοι τύποι έρχονται `null` όσο φορτώνουν, και εκεί το «κράτα ό,τι
  //    είχες» είναι η σωστή συμπεριφορά (καμία αναλαμπή στη σελίδα της οντότητας).
  const showedProperty = useRef(false);
  useEffect(() => {
    const showsProperty = entity?.type === 'property' || entity?.type === 'property-resolved';
    if (entity === null && showedProperty.current) selectProperty(null);
    showedProperty.current = showsProperty;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, selectProperty]);

  useEffect(() => {
    if (!entity?.id) return;

    // ── PROJECT ──────────────────────────────────────────────────────────────
    if (entity.type === 'project') {
      const navProject = projects.find(p => p.id === entity.id);
      const companyId = navProject?.linkedCompanyId || entity.linkedCompanyId || entity.companyId || '';
      const companyName = breadcrumbCompanyName({
        companyId,
        candidates: [navProject?.company, entity.company],
        companies,
      });
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
      syncBreadcrumb({
        ...projectBreadcrumbTrail(project, companies),
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

      syncBreadcrumb({
        ...projectBreadcrumbTrail(project, companies),
        building: { id: building.id, name: building.name },
        space: { id: entity.id, name: entity.name, type: entity.spaceType },
        currentLevel: 'spaces',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, projects, companies, syncBreadcrumb, buildings]);
}
