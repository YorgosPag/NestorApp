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
 * Η συναρμολόγηση *(σήμα → gate → `useExportDeps` → διάλογος)* ζει στον κοινό `PublishDialogHost`
 * από τότε που απέκτησε δεύτερο προορισμό, την κάτοψη (ADR-909 Β2.5).
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas subscriptions.
 *
 * @see ../ui/components/publish-model/PublishModelDialog — το σώμα του χειριστηρίου
 */

import * as React from 'react';

import { PublishDialogHost } from './dialog-hosts/PublishDialogHost';
import { PublishModelDialog } from '../ui/components/publish-model/PublishModelDialog';

export interface PublishModelHostProps {
  /** Ενεργό κτήριο του ξενιστή — **εφεδρεία** όταν το ενεργό επίπεδο δεν φέρει δικό του. */
  readonly buildingId?: string;
}

export function PublishModelHost({ buildingId }: PublishModelHostProps): React.ReactElement {
  return <PublishDialogHost event="dxf:publish-model-requested" Dialog={PublishModelDialog} buildingId={buildingId} />;
}
