'use client';

import React from 'react';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

/**
 * DxfBreadcrumb — Ιεραρχία τοποθεσίας σχεδίου
 *
 * Εμφανίζει: Εταιρεία → Έργο → Κτίριο → Όροφος
 * πάνω από τα Panel Tabs στο floating sidebar.
 *
 * Χρησιμοποιεί τα ήδη υπάρχοντα δεδομένα από τον ProjectHierarchyContext
 * (επιλέγονται κατά το DXF import wizard).
 *
 * Informational display — ΟΧΙ clickable (δεν βγαίνουμε από DXF Viewer).
 * Αν δεν υπάρχουν δεδομένα → return null (μηδενικό visual footprint).
 *
 * @pattern Matches HierarchicalDestinationSelector breadcrumb (lines 210-254)
 */
export function DxfBreadcrumb(): React.ReactElement | null {
  const { selectedCompany, selectedProject, selectedBuilding, selectedFloor } = useProjectHierarchy();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  // Αν δεν υπάρχει τίποτα επιλεγμένο, δεν εμφανίζουμε τίποτα
  if (!selectedCompany && !selectedProject && !selectedBuilding && !selectedFloor) {
    return null;
  }

  const CompanyIcon = NAVIGATION_ENTITIES.company.icon;
  const ProjectIcon = NAVIGATION_ENTITIES.project.icon;
  const BuildingIcon = NAVIGATION_ENTITIES.building.icon;
  const FloorIcon = NAVIGATION_ENTITIES.floor.icon;

  return (
    <nav
      className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${quick.borderB} px-3 py-1.5`}
      aria-label="Τοποθεσία σχεδίου"
    >
      <ol className={`flex items-center flex-wrap ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>
        {selectedCompany && (
          <li className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            <CompanyIcon className={`${PANEL_LAYOUT.ICON.SMALL} ${NAVIGATION_ENTITIES.company.color}`} />
            <span className={colors.text.secondary}>{selectedCompany.companyName}</span>
          </li>
        )}

        {selectedCompany && selectedProject && (
          <li className={colors.text.muted} aria-hidden="true">→</li>
        )}

        {selectedProject && (
          <li className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            <ProjectIcon className={`${PANEL_LAYOUT.ICON.SMALL} ${NAVIGATION_ENTITIES.project.color}`} />
            <span className={colors.text.secondary}>{selectedProject.name}</span>
          </li>
        )}

        {selectedProject && selectedBuilding && (
          <li className={colors.text.muted} aria-hidden="true">→</li>
        )}

        {selectedBuilding && (
          <li className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            <BuildingIcon className={`${PANEL_LAYOUT.ICON.SMALL} ${NAVIGATION_ENTITIES.building.color}`} />
            <span className={colors.text.secondary}>{selectedBuilding.name}</span>
          </li>
        )}

        {selectedBuilding && selectedFloor && (
          <li className={colors.text.muted} aria-hidden="true">→</li>
        )}

        {selectedFloor && (
          <li className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
            <FloorIcon className={`${PANEL_LAYOUT.ICON.SMALL} ${NAVIGATION_ENTITIES.floor.color}`} />
            <span className={colors.text.secondary}>{selectedFloor.name}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
