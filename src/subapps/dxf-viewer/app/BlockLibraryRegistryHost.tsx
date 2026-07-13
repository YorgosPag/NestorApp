'use client';

/**
 * ADR-652 M2 — always-on feeder του cloud block store.
 *
 * Το palette «Τα Blocks μου» πρέπει να δείχνει τη μόνιμη βιβλιοθήκη ΑΝΕΞΑΡΤΗΤΑ από το αν
 * έγινε import σε αυτή τη συνεδρία — άρα η συνδρομή στο `block_library` δεν μπορεί να ζει
 * μέσα στο panel (που είναι κλειστό τις περισσότερες φορές). Αυτός ο null-rendering host
 * κρατά ΕΝΑΝ listener για όλη τη ζωή του viewer και σπρώχνει κάθε αλλαγή στο
 * `block-library-cloud-store` (ο μοναδικός writer του).
 *
 * Mirror του `UserMaterialRegistryHost` (ADR-413): μηδέν high-frequency subscriptions →
 * συμβατό με ADR-040 CHECK 6B/6C. Mount: `DxfViewerTopBar`.
 *
 * @see ../bim/block-library/block-library-cloud-store.ts — ο store που τροφοδοτεί
 * @see ../bim/services/BlockLibraryService.ts — η Firestore συνδρομή
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createBlockLibraryService } from '../bim/services/BlockLibraryService';
import { setCloudBlockItems } from '../bim/block-library/block-library-cloud-store';

export interface BlockLibraryRegistryHostProps {
  readonly projectId?: string;
}

export function BlockLibraryRegistryHost({
  projectId,
}: BlockLibraryRegistryHostProps): React.ReactElement | null {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  React.useEffect(() => {
    if (!companyId || !userId) return;
    const service = createBlockLibraryService({ companyId, userId, projectId });
    return service.subscribeBlocks(
      (items) => setCloudBlockItems(items),
      () => {
        // Αποτυχία συνδρομής → κρατάμε το τελευταίο γνωστό snapshot (το palette δεν αδειάζει).
      },
    );
  }, [companyId, userId, projectId]);

  return null;
}
