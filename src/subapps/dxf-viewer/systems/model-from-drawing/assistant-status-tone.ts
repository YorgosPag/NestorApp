/**
 * ADR-911 Φ3β — κατάσταση πρότασης → τόνος ζώνης. ΕΝΑΣ πίνακας, δύο αναγνώστες: το φύλλο του
 * καμβά και το υπόμνημα του πάνελ. Αν ζούσε σε καθέναν χωριστά, το «πράσινο στο σχέδιο» του
 * πάνελ θα μπορούσε να δείχνει άλλο πράγμα από το πράσινο του σχεδίου.
 *
 * ΚΑΘΑΡΟ (pure).
 */

import type { WallProposalStatus } from '../../bim/model-from-drawing/wall-proposal';
import type { PreviewZoneTone } from '../region-preview/preview-zone-style';

export const ASSISTANT_STATUS_TONE: Readonly<Record<WallProposalStatus, PreviewZoneTone>> = {
  ready: 'accept',
  'needs-decision': 'decide',
  rejected: 'reject',
  existing: 'existing',
};

/** Οι καταστάσεις με τη σειρά που τις διαβάζει ο άνθρωπος στο πάνελ. */
export const ASSISTANT_STATUS_ORDER: readonly WallProposalStatus[] = [
  'ready',
  'needs-decision',
  'rejected',
  'existing',
];
