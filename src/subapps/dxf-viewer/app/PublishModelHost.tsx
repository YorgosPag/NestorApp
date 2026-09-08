'use client';

/**
 * ADR-845 Φ4.2β/Βήμα Γ — lifecycle owner του χειριστηρίου **δημοσίευσης 3D μοντέλου**.
 *
 * Mirror του `ExportHost`/`StampHost` (ADR-505/651): thin gate που ακούει το σήμα του ribbon
 * (`dxf:publish-model-requested`) και mount-άρει τον διάλογο **ΜΟΝΟ** όσο είναι ανοιχτός.
 *
 * 🔑 **Ο ΔΕΥΤΕΡΟΣ ΠΡΟΟΡΙΣΜΟΣ ΤΗΣ ΙΔΙΑΣ ΣΥΝΑΡΜΟΛΟΓΗΣΗΣ** — τα ζωντανά υλικά έρχονται από το
 * **κοινό** `useExportDeps`, το ίδιο που τροφοδοτεί το κατέβασμα. Δύο αντίγραφα εκείνων των
 * κανόνων *(ενεργό κτήριο · όροφοι · κτήρια)* θα σήμαιναν ότι η δημοσίευση μπορεί να στείλει
 * **άλλο κτήριο** από αυτό που κατεβάζει ο ίδιος άνθρωπος, σιωπηλά.
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas subscriptions.
 *
 * @see ../ui/components/publish-model/PublishModelDialog — το σώμα του χειριστηρίου
 */

import * as React from 'react';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { useExportDeps } from './dialog-hosts/useExportDeps';
import { PublishModelDialog } from '../ui/components/publish-model/PublishModelDialog';

export interface PublishModelHostProps {
  /** Ενεργό κτήριο του ξενιστή — **εφεδρεία** όταν το ενεργό επίπεδο δεν φέρει δικό του. */
  readonly buildingId?: string;
}

export function PublishModelHost({ buildingId }: PublishModelHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:publish-model-requested');
  if (!open) return null;
  return <PublishModelBody buildingId={buildingId} onClose={close} />;
}

/**
 * ⚠️ **Χωριστό σώμα, όπως στον `ExportHost`**: το `useExportDeps` ανοίγει συνδρομές Firestore,
 * και ένας always-mounted host θα τις κρατούσε ζωντανές **πάντα**. Το gate είναι πάνω από τα
 * hooks, όχι μέσα τους.
 */
function PublishModelBody({ buildingId, onClose }: {
  readonly buildingId?: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { activeBuildingId, collect } = useExportDeps(buildingId);

  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onClose(); },
    [onClose],
  );

  return (
    <PublishModelDialog
      open
      onOpenChange={handleOpenChange}
      activeBuildingId={activeBuildingId}
      collectDeps={collect}
    />
  );
}
