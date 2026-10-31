import 'server-only';

/**
 * @fileoverview **404 ΜΕ ΛΟΓΙΑ** — ο σύνδεσμος/QR που δεν δείχνει πουθενά (ADR-923 §5.12).
 * @related ADR-853 §18 (Ε-Η) · `app/(auth)/case-invite/[token]/not-found.tsx` (το πρότυπο)
 * @module app/(auth)/supply-request/[token]/not-found
 */

import { SupplyAccessContent } from '@/components/supply-access/SupplyAccessContent';

export default function SupplyRequestNotFound(): React.ReactElement {
  return <SupplyAccessContent door="link" view={{ kind: 'refused', reason: 'invitation-unknown' }} />;
}
