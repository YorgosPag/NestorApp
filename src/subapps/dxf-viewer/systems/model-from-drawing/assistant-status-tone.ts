/**
 * ADR-911 Φ3β — κατάσταση πρότασης → τόνος ζώνης. ΕΝΑΣ πίνακας, δύο αναγνώστες: το φύλλο του
 * καμβά και το υπόμνημα του πάνελ. Αν ζούσε σε καθέναν χωριστά, το «πράσινο στο σχέδιο» του
 * πάνελ θα μπορούσε να δείχνει άλλο πράγμα από το πράσινο του σχεδίου.
 *
 * Φ4-3β: ο ίδιος πίνακας και για τα ανοίγματα — το ΙΔΙΟ λεξιλόγιο τεσσάρων τόνων, όχι πέμπτος.
 *
 * ΚΑΘΑΡΟ (pure).
 */

import type { WallProposalStatus } from '../../bim/model-from-drawing/wall-proposal';
import type { OpeningProposalStatus } from '../../bim/model-from-drawing/opening-proposal';
import type { OpeningPreviewZone } from '../../bim/model-from-drawing/opening-preview';
import type { PreviewZoneTone } from '../region-preview/preview-zone-style';

/**
 * `unconfirmed` (ADR-929 Φ5.2ε) μοιράζεται τον τόνο «θέλει εσένα» με το `needs-decision`: και τα δύο δεν γράφονται
 * μέχρι να αποφασίσει ο άνθρωπος. Τα ξεχωρίζει η ετικέτα του υπομνήματος και ο τόπος της απόφασης (ομάδα πάχους ·
 * λίστα αμφίσημων) — κανένα νέο χρώμα.
 */
export const ASSISTANT_STATUS_TONE: Readonly<Record<WallProposalStatus, PreviewZoneTone>> = {
  ready: 'accept',
  unconfirmed: 'decide',
  'needs-decision': 'decide',
  rejected: 'reject',
  existing: 'existing',
};

/** Οι καταστάσεις με τη σειρά που τις διαβάζει ο άνθρωπος στο πάνελ. */
export const ASSISTANT_STATUS_ORDER: readonly WallProposalStatus[] = [
  'ready',
  'unconfirmed',
  'needs-decision',
  'rejected',
  'existing',
];

/** Πόρτα και παράθυρο έχουν τον ίδιο τόνο («θα δημιουργηθεί»)· τα ξεχωρίζει η ΕΤΙΚΕΤΑ της ζώνης. */
export const OPENING_STATUS_TONE: Readonly<Record<OpeningProposalStatus, PreviewZoneTone>> = {
  door: 'accept',
  window: 'accept',
  'needs-decision': 'decide',
  existing: 'existing',
};

export const OPENING_STATUS_ORDER: readonly OpeningProposalStatus[] = [
  'door',
  'window',
  'needs-decision',
  'existing',
];

/**
 * Ο τόνος μιας ζώνης ανοίγματος — «τι θα συμβεί αν εγκρίνω;». Δύο περιπτώσεις που η κατάσταση
 * μόνη δεν λέει: στοιχείο που ο άνθρωπος απέρριψε («τίποτα»), και «θα γραφτεί» όταν το σχέδιο
 * εγγραφής αρνείται ολόκληρο (`refused`) — και στις δύο ΔΕΝ θα δημιουργηθεί, άρα κόκκινο.
 */
export function openingZoneTone(
  zone: Pick<OpeningPreviewZone, 'status' | 'dismissed'>,
  refused: boolean,
): PreviewZoneTone {
  if (zone.dismissed) return 'reject';
  if (refused && (zone.status === 'door' || zone.status === 'window')) return 'reject';
  return OPENING_STATUS_TONE[zone.status];
}
