'use client';

/**
 * @fileoverview **«Πώς λέγεται το έργο/κτίριο με αυτή την ταυτότητα;»** — ο ΕΝΑΣ επιλυτής ονομάτων στον client.
 * @related ADR-840 §7.6 · ADR-016 (πλοήγηση)
 * @module components/navigation/core/hooks/useHierarchyNames
 *
 * 🔑 **Δεν φέρνει τίποτα.** Τα έργα και τα κτίρια τα κρατά **ήδη** το `NavigationContext` (bootstrap έργων +
 * **μία** ζωντανή συνδρομή κτιρίων, mounted στο `app/(app)/layout.tsx`). Αυτό το hook είναι απλώς η **μία**
 * ερώτηση πάνω τους — μέχρι σήμερα ~12 αρχεία έγραφαν χειρόγραφα `projects.find(p => p.id === x)?.name`.
 *
 * ⚠️ **Δεν επινοεί όνομα.** Άγνωστη ταυτότητα (δεν έφτασε ακόμη, ή διαγράφηκε) ⇒ `null`, και ο καλών
 * αποφασίζει τι δείχνει. Ποτέ η ωμή ταυτότητα στον άνθρωπο.
 * ⚠️ **Δεν ρίχνει εκτός provider** (σε αντίθεση με το `useNavigation`): έξω από το κέλυφος ή σε test, απλώς
 * δεν ξέρει κανένα όνομα.
 */

import { useCallback, useContext, useMemo } from 'react';
import NavigationContext from '../NavigationContext';

export interface HierarchyNames {
  projectName: (projectId: string | null | undefined) => string | null;
  buildingName: (buildingId: string | null | undefined) => string | null;
}

function nameOf(raw: string | null | undefined): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}

export function useHierarchyNames(): HierarchyNames {
  const navigation = useContext(NavigationContext);
  const projects = navigation?.projects;
  const getBuildingById = navigation?.getBuildingById;

  const projectNames = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project.name])),
    [projects],
  );

  const projectName = useCallback(
    (projectId: string | null | undefined) => (projectId ? nameOf(projectNames.get(projectId)) : null),
    [projectNames],
  );

  const buildingName = useCallback(
    (buildingId: string | null | undefined) =>
      buildingId && getBuildingById ? nameOf(getBuildingById(buildingId)?.name) : null,
    [getBuildingById],
  );

  return useMemo(() => ({ projectName, buildingName }), [projectName, buildingName]);
}
