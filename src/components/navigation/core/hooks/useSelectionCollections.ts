'use client';

/**
 * **Οι συλλογές της τρέχουσας επιλογής** του ιεραρχικού πλοηγητή — SSoT.
 *
 * Τα `NavigationTree` και `MobileNavigation` υπολόγιζαν **αυτούσια** τα ίδια δύο `useMemo`
 * (κλώνος 28 γραμμών, CHECK 3.28 — ADR-744 §26), και το `useDesktopNavData` είχε τρίτο αντίγραφο
 * του πρώτου. Ζουν πλέον εδώ, μία φορά, και τα ζητούν και οι τρεις.
 *
 * ⚠️ Το `useDesktopNavData.buildingProperties` **ΔΕΝ** είναι ίδιο και δεν περνά από εδώ:
 * διαβάζει realtime (`getPropertiesForBuilding`) και αφαιρεί τις αποθήκες, γιατί η προβολή
 * desktop τις δείχνει σε δική τους καρτέλα.
 *
 * @module components/navigation/core/hooks/useSelectionCollections
 */

import { useMemo } from 'react';
import { useNavigation } from '../NavigationContext';

/** Τα κτίρια του επιλεγμένου έργου (realtime) — κενό χωρίς επιλογή. */
export function useProjectBuildings() {
  const { selectedProject, getBuildingsForProject } = useNavigation();
  return useMemo(() => {
    if (!selectedProject) return [];
    return getBuildingsForProject(selectedProject.id);
  }, [selectedProject, getBuildingsForProject]);
}

/**
 * Τα ακίνητα του επιλεγμένου κτιρίου: **όλων** των ορόφων του **και** όσα κρέμονται
 * απευθείας από το κτίριο. Οι όροφοι είναι δομικοί κόμβοι — δεν είναι επίπεδο πλοήγησης.
 */
export function useBuildingProperties() {
  const { selectedBuilding } = useNavigation();
  return useMemo(() => {
    if (!selectedBuilding) return [];
    const floorProperties = selectedBuilding.floors?.flatMap(floor => floor.properties) || [];
    const directProperties = selectedBuilding.properties || [];
    return [...floorProperties, ...directProperties];
  }, [selectedBuilding]);
}
