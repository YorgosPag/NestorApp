/**
 * EntityFilesManager — η **δημόσια** πόρτα του διαχειριστή αρχείων οντότητας (ADR-031 · ADR-191).
 *
 * 🔑 **Ένα στιγμιότυπο ανά οντότητα** (`key` = τύπος + αναγνωριστικό — React: «resetting all state when a prop
 *    changes»). Ως τις 2026-11-23 το ίδιο στιγμιότυπο περνούσε από επαφή σε επαφή και κρατούσε **όλη** την κατάσταση
 *    UI της προηγούμενης: επιλεγμένο αρχείο στην προεπισκόπηση, **μαζική επιλογή** (μια «Διαγραφή επιλεγμένων» στη Β
 *    θα έπαιρνε αναγνωριστικά της Α), αναζήτηση, ζώνη ανεβάσματος. Το remount τα μηδενίζει **όλα μαζί** — και όποιο
 *    κομμάτι κατάστασης προστεθεί αύριο, χωρίς να το θυμηθεί κανείς.
 *    Τα **δεδομένα** τα δένει ξεχωριστά το `useEntityFiles` (`useKeyedState`), για όσους το καλούν απευθείας.
 *
 * @module components/shared/files/EntityFilesManager
 */

'use client';

import React from 'react';
import { EntityFilesManagerSurface, type EntityFilesManagerProps } from './entity-files-manager-surface';

export type { EntityFilesManagerProps };

export function EntityFilesManager(props: EntityFilesManagerProps) {
  return <EntityFilesManagerSurface key={`${props.entityType}:${props.entityId}`} {...props} />;
}
