import 'server-only';

/**
 * @fileoverview **404 ΜΕ ΛΟΓΙΑ** — ο σύνδεσμος πρόσκλησης αγοραστή που δεν δείχνει πουθενά (ADR-916 Φ-Β2).
 * @related ADR-853 §18 (Ε-Η) · `app/(auth)/case-invite/[token]/not-found.tsx` (το πρότυπο) · `CORE_REFUSAL_IS_NOT_FOUND`
 * @module app/(auth)/handover-invite/[token]/not-found
 */

import { HandoverInviteContent } from '@/components/handover-invite/HandoverInviteContent';

export default function HandoverInviteNotFound(): React.ReactElement {
  return <HandoverInviteContent view={{ kind: 'refused', reason: 'invitation-unknown' }} />;
}
