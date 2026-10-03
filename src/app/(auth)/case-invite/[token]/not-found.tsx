import 'server-only';

/**
 * @fileoverview **404 ΜΕ ΛΟΓΙΑ** — ο σύνδεσμος πρόσκλησης υπόθεσης που δεν δείχνει πουθενά (ADR-901 Φ3).
 * @related ADR-853 §18 (Ε-Η) · `app/(auth)/tour-invite/[token]/not-found.tsx` (το πρότυπο) · `CORE_REFUSAL_IS_NOT_FOUND`
 * @module app/(auth)/case-invite/[token]/not-found
 */

import { CaseInviteContent } from '@/components/case-invite/CaseInviteContent';

export default function CaseInviteNotFound(): React.ReactElement {
  return <CaseInviteContent view={{ kind: 'refused', reason: 'invitation-unknown' }} />;
}
