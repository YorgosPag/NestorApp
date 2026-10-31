import 'server-only';

/**
 * @fileoverview **404 ΜΕ ΛΟΓΙΑ** — η πρόσκληση προμήθειας που δεν δείχνει πουθενά (ADR-923 §5.12).
 * @related ADR-853 §18 (Ε-Η) · `app/(auth)/case-invite/[token]/not-found.tsx` (το πρότυπο)
 * @module app/(auth)/supply-invite/[token]/not-found
 */

import { SupplyAccessContent } from '@/components/supply-access/SupplyAccessContent';

export default function SupplyInviteNotFound(): React.ReactElement {
  return <SupplyAccessContent door="invitation" view={{ kind: 'refused', reason: 'invitation-unknown' }} />;
}
