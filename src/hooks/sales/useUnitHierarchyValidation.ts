/**
 * @fileoverview Real-time unit hierarchy validation for sales dialogs
 * @description Validates the full hierarchy chain: Company → Project → Building → Floor.
 *
 * Architecture:
 * - Unit-level data (buildingId, floorId) comes from the `unit` prop — no extra fetch.
 * - Upstream chain (building→project→company) uses firestoreQueryService.subscribeDoc
 *   (real-time onSnapshot) — same pattern as useContactEmailWatch.
 * - RealtimeService events trigger re-evaluation for cross-tab updates.
 *
 * Hierarchy order (top-down):
 *   1. Company (project.linkedCompanyId — ADR-232 business link)
 *   2. Project (building.projectId)
 *   3. Building (unit.buildingId)
 *   4. Floor (unit.floorId)
 *
 * @pattern subscribeDoc + RealtimeService — canonical centralized pattern
 * @see ADR-197 §2.9 (Sales Dialogs)
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { RealtimeService } from '@/services/realtime';
import type { Unit } from '@/types/unit';

// ============================================================================
// TYPES
// ============================================================================

/** Individual validation check result */
interface HierarchyCheck {
  /** i18n key for the error message */
  i18nKey: string;
}

/** Full hierarchy validation state */
export interface HierarchyValidationState {
  /** Whether the entire hierarchy is valid (all 4 checks pass) */
  isValid: boolean;
  /** Loading state (upstream subscriptions resolving) */
  loading: boolean;
  /** Failed checks — in hierarchy order (Company → Project → Building → Floor) */
  errors: HierarchyCheck[];
  /** Resolved hierarchy IDs */
  hierarchy: {
    companyId: string | null;
    projectId: string | null;
    buildingId: string | null;
    floorId: string | null;
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Real-time hierarchy validation for a unit.
 *
 * Checks (in hierarchy order):
 * 1. Company — project.companyId must exist
 * 2. Project — building.projectId must exist
 * 3. Building — unit.buildingId must exist
 * 4. Floor — unit.floorId must exist
 *
 * @param unit - The unit object (from parent component — always fresh)
 * @param enabled - Whether validation is active (tie to dialog `open` state)
 */
export function useUnitHierarchyValidation(
  unit: Unit,
  enabled = true
): HierarchyValidationState {
  // ── Unit-level: read directly from prop (no subscription needed) ──
  const buildingId = unit.buildingId || null;
  // 🔒 ADR-232: Only floorId (document reference) counts as valid floor link.
  // Legacy numeric floor is NOT sufficient for sales operations.
  const floorId = unit.floorId || null;
  const hasFloor = !!floorId;

  // ── Upstream chain state ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [buildingResolved, setBuildingResolved] = useState(false);
  const [projectResolved, setProjectResolved] = useState(false);

  // Force re-subscribe counter (incremented by RealtimeService events)
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  // ── Level 2: Subscribe to Building document → projectId ──
  useEffect(() => {
    if (!buildingId || !enabled) {
      setProjectId(null);
      setCompanyId(null);
      setBuildingResolved(true);
      setProjectResolved(true);
      return;
    }

    setBuildingResolved(false);

    const unsubscribe = firestoreQueryService.subscribeDoc<Record<string, unknown>>(
      'BUILDINGS',
      buildingId,
      (data) => {
        const pid = (data?.projectId as string) || null;
        setProjectId(pid);
        setBuildingResolved(true);

        if (!pid) {
          setCompanyId(null);
          setProjectResolved(true);
        }
      },
      () => {
        setProjectId(null);
        setCompanyId(null);
        setBuildingResolved(true);
        setProjectResolved(true);
      }
    );

    return () => unsubscribe();
  }, [buildingId, enabled, tick]);

  // ── Level 3: Subscribe to Project document → companyId ──
  useEffect(() => {
    if (!projectId || !enabled) {
      setCompanyId(null);
      setProjectResolved(!projectId ? true : false);
      return;
    }

    setProjectResolved(false);

    const unsubscribe = firestoreQueryService.subscribeDoc<Record<string, unknown>>(
      'PROJECTS',
      projectId,
      (data) => {
        // 🏢 ADR-232: Check linkedCompanyId (business link), NOT companyId (tenant key)
        const cid = (data?.linkedCompanyId as string) || null;
        setCompanyId(cid);
        setProjectResolved(true);
      },
      () => {
        setCompanyId(null);
        setProjectResolved(true);
      }
    );

    return () => unsubscribe();
  }, [projectId, enabled, tick]);

  // ── RealtimeService: listen for hierarchy changes across tabs ──
  useEffect(() => {
    if (!enabled) return;

    const unsubs = [
      RealtimeService.subscribe('ENTITY_LINKED', bump),
      RealtimeService.subscribe('ENTITY_UNLINKED', bump),
      RealtimeService.subscribe('BUILDING_UPDATED', bump),
      RealtimeService.subscribe('BUILDING_PROJECT_LINKED', bump),
      RealtimeService.subscribe('PROJECT_UPDATED', bump),
      RealtimeService.subscribe('CASCADE_PROPAGATED', bump),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [enabled, bump]);

  // ── Compute validation result ──
  const loading = enabled && (!buildingResolved || !projectResolved);

  const errors = useMemo(() => {
    if (loading) return [];

    const result: HierarchyCheck[] = [];

    // Hierarchy order: Company → Project → Building → Floor
    if (buildingId && projectId && !companyId) {
      result.push({ i18nKey: 'sales.errors.noCompany' });
    }
    if (buildingId && !projectId) {
      result.push({ i18nKey: 'sales.errors.noProject' });
    }
    if (!buildingId) {
      result.push({ i18nKey: 'sales.errors.noBuilding' });
    }
    if (!hasFloor) {
      result.push({ i18nKey: 'sales.errors.noFloor' });
    }

    return result;
  }, [loading, buildingId, hasFloor, projectId, companyId]);

  const isValid = !loading && !!buildingId && !!hasFloor && !!projectId && !!companyId;

  return {
    isValid,
    loading,
    errors,
    hierarchy: {
      companyId,
      projectId,
      buildingId,
      floorId,
    },
  };
}
