'use client';

/**
 * Το breadcrumb **θέσης** του θεατή μέσα στη γραμμή πλαισίου (mount: `ViewerContextStrip`,
 * δεξιά άκρη): «σε ποιο κτίριο δουλεύω» και, όταν επιλεγεί περιοχή, «ποιο ακίνητο είναι».
 *
 * | Κατάσταση | Αποδίδει |
 * |---|---|
 * | ενεργό επίπεδο κτιρίου, καμία περιοχή | Εταιρεία → Έργο → Κτίριο |
 * | επιλεγμένη περιοχή συνδεδεμένη με ακίνητο | Εταιρεία → Έργο → Κτίριο → Ακίνητο |
 * | ούτε κτίριο ούτε ακίνητο | τίποτα |
 *
 * Ο **όροφος** δεν είναι κρίκος: το κοινό breadcrumb δεν έχει τέτοιο επίπεδο (ADR-016) και
 * τον δείχνουν ήδη οι καρτέλες του `FloorTabBar`, στην ίδια γραμμή.
 *
 * ## SSoT — καμία δεύτερη υλοποίηση
 * Αυτό το αρχείο **δεν ζωγραφίζει** breadcrumb και **δεν λύνει** ιεραρχία. Είναι μόνο ο
 * προσαρμογέας «κατάσταση θεατή → περιγραφικό οντότητας»· όλα τα υπόλοιπα είναι τα ίδια που
 * τρέχουν οι σελίδες «Κτίρια» και «Διαχείριση Ακινήτων» (ADR-016):
 * - **ιεραρχία** → {@link useBreadcrumbSync} (`type: 'property'` ή `'building'`)
 * - **απόδοση**  → {@link NavigationBreadcrumb}
 * - **ποιο κτίριο** → {@link useActiveBuildingId} (ADR-845 §7.15)
 *
 * ## Γιατί ο έλεγχος «το context λέει ό,τι ζήτησα»
 * Το `NavigationContext` είναι καθολικό: όσο τρέχει το αίτημα κρατά ακόμη την προηγούμενη
 * οντότητα. Χωρίς τον έλεγχο η γραμμή θα ονόμαζε ακίνητο ή κτίριο που δεν είναι το τρέχον.
 *
 * Επίπεδο και επιλογή αλλάζουν με κλικ (χαμηλή συχνότητα)· καμία εγγραφή σε store υψηλής
 * συχνότητας (ADR-040).
 */

import React from 'react';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import {
  useBreadcrumbSync,
  type BreadcrumbEntity,
} from '@/components/navigation/core/hooks/useBreadcrumbSync';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import { useActiveBuildingId } from '../../systems/levels/hooks/useActiveBuildingId';
import { useUniversalSelection } from '../../systems/selection';

/** Το ακίνητο της επιλεγμένης περιοχής — ή `null` αν δεν υπάρχει τέτοια σύνδεση. */
function useSelectedPropertyEntity(): BreadcrumbEntity | null {
  const { overlays } = useOverlayStore();
  const selectedId = useUniversalSelection().getPrimaryId();
  const overlay = selectedId ? overlays[selectedId] : undefined;
  const propertyId = overlay?.linked?.propertyId;
  return propertyId ? { type: 'property', id: propertyId, name: overlay?.label ?? '' } : null;
}

/** Το κτίριο που δουλεύουμε — ή `null` όσο δεν είναι γνωστό το ίδιο ή το έργο του. */
function useActiveBuildingEntity(): BreadcrumbEntity | null {
  const { levels, currentLevelId } = useLevels();
  const buildingId = useActiveBuildingId(levels, currentLevelId);
  const { getBuildingById } = useNavigation();
  const building = buildingId ? getBuildingById(buildingId) : undefined;
  if (!building?.projectId) return null;
  return { type: 'building', id: building.id, name: building.name, projectId: building.projectId };
}

export const ViewerLocationBreadcrumb: React.FC = () => {
  const propertyEntity = useSelectedPropertyEntity();
  const buildingEntity = useActiveBuildingEntity();
  // Το ειδικότερο κερδίζει: η περιοχή λέει περισσότερα από το κτίριό της.
  const entity = propertyEntity ?? buildingEntity;

  useBreadcrumbSync(entity);

  const { selectedProperty, selectedBuilding } = useNavigation();
  if (!entity) return null;
  const resolved = entity.type === 'property'
    ? selectedProperty?.id === entity.id
    : !selectedProperty && selectedBuilding?.id === entity.id;
  if (!resolved) return null;

  // `ml-auto`: δεξιά άκρη της λωρίδας· `shrink-0`: όταν οι όροφοι πληθαίνουν, κυλούν εκείνοι.
  return <NavigationBreadcrumb className="ml-auto shrink-0 whitespace-nowrap" />;
};
