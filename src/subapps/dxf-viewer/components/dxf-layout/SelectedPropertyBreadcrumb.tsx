'use client';

/**
 * Το breadcrumb του **επιλεγμένου ακινήτου** μέσα στη γραμμή πλαισίου του θεατή
 * (mount: `ViewerContextStrip`, δεξιά άκρη).
 *
 * ## SSoT — καμία δεύτερη υλοποίηση
 * Αυτό το αρχείο **δεν ζωγραφίζει** breadcrumb και **δεν λύνει** ιεραρχία. Είναι μόνο ο
 * προσαρμογέας «επιλεγμένη περιοχή → ακίνητο»· όλα τα υπόλοιπα είναι τα ίδια που τρέχει η
 * σελίδα «Διαχείριση Ακινήτων» (ADR-016):
 * - **ιεραρχία** → {@link useBreadcrumbSync} (`type: 'property'`, Hierarchy API)
 * - **απόδοση**  → {@link NavigationBreadcrumb} (Εταιρεία → Έργο → Κτίριο → Ακίνητο)
 *
 * ## Πότε αποδίδεται
 * Μόνο όταν η κύρια επιλογή είναι περιοχή **συνδεδεμένη με ακίνητο** *και* το
 * `NavigationContext` έχει ήδη λύσει **αυτό** το ακίνητο. Το δεύτερο σκέλος δεν είναι
 * διακοσμητικό: το context είναι καθολικό, οπότε όσο τρέχει το αίτημα κρατά ακόμη το
 * προηγούμενο ακίνητο — και χωρίς τον έλεγχο η γραμμή θα ονόμαζε ακίνητο που δεν είναι επιλεγμένο.
 *
 * Η επιλογή αλλάζει με κλικ (χαμηλή συχνότητα)· καμία εγγραφή σε store υψηλής συχνότητας
 * (ADR-040).
 */

import React from 'react';
import { NavigationBreadcrumb } from '@/components/navigation/components/NavigationBreadcrumb';
import { useNavigation } from '@/components/navigation/core/NavigationContext';
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useUniversalSelection } from '../../systems/selection';

export const SelectedPropertyBreadcrumb: React.FC = () => {
  const { overlays } = useOverlayStore();
  const selectedId = useUniversalSelection().getPrimaryId();
  const overlay = selectedId ? overlays[selectedId] : undefined;
  const propertyId = overlay?.linked?.propertyId;

  useBreadcrumbSync(
    propertyId ? { type: 'property', id: propertyId, name: overlay?.label ?? '' } : null,
  );

  const { selectedProperty } = useNavigation();
  if (!propertyId || selectedProperty?.id !== propertyId) return null;

  // `ml-auto`: δεξιά άκρη της λωρίδας· `shrink-0`: όταν οι όροφοι πληθαίνουν, κυλούν εκείνοι.
  return <NavigationBreadcrumb className="ml-auto shrink-0 whitespace-nowrap" />;
};
