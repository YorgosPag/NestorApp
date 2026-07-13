'use client';

/**
 * ADR-651 Φάση Θ — always-on feeder της **βιβλιοθήκης προτύπων πινακίδας**.
 *
 * Ο ένας και μοναδικός writer του `title-block-library-store`: κρατά ΕΝΑ live merge listener
 * (γραφείο + έργο + δικά μου) για όλη τη ζωή του viewer και σπρώχνει κάθε αλλαγή στον store.
 *
 * **Γιατί ζωντανή συνδρομή και όχι fetch-on-open**: αυτό ΕΙΝΑΙ το must-have #1 — μόλις το
 * γραφείο διορθώσει το master πρότυπο, η αλλαγή φτάνει σε **κάθε ανοιχτό έργο** που το
 * δείχνει, χωρίς refresh (ArchiCAD Master Layout semantics). Ένα fetch-μία-φορά θα έδειχνε
 * μπαγιάτικη πινακίδα μέχρι το επόμενο reload.
 *
 * Mirror του {@link BlockLibraryRegistryHost} (ADR-652 M2): null-rendering, μηδέν
 * high-frequency subscriptions ⇒ συμβατό με ADR-040 CHECK 6B/6C.
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createTextTemplateLibraryService } from '../text-engine/templates/text-template-library.service';
import { setTitleBlockLibrary } from '../text-engine/title-block/title-block-library-store';

export interface TitleBlockLibraryHostProps {
  readonly projectId?: string;
}

export function TitleBlockLibraryHost({
  projectId,
}: TitleBlockLibraryHostProps): React.ReactElement | null {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  React.useEffect(() => {
    if (!companyId || !userId) return;
    const service = createTextTemplateLibraryService({ companyId, userId, projectId });
    return service.subscribe(
      (templates) => setTitleBlockLibrary(templates),
      () => {
        // Αποτυχία συνδρομής ⇒ κρατάμε το τελευταίο γνωστό snapshot: ο χρήστης συνεχίζει με
        // τα built-in presets, η πινακίδα ΠΟΤΕ δεν μπλοκάρει (ίδια αρχή με τη Φάση Β/Ε/Η).
      },
    );
  }, [companyId, userId, projectId]);

  return null;
}
