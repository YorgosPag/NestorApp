import 'server-only';

/**
 * @fileoverview **404 ΜΕ ΛΟΓΙΑ** — ο σύνδεσμος πρόσκλησης φωτογράφου που δεν δείχνει πουθενά (ADR-884 Κ3α).
 * @related ADR-853 §18 (Ε-Η) · `app/(auth)/invite/[token]/not-found.tsx` (το πρότυπο) · `INVITE_REFUSAL_IS_NOT_FOUND`
 * @module app/(auth)/tour-invite/[token]/not-found
 *
 * 🔑 **Η ΙΔΙΑ οθόνη με τις υπόλοιπες αρνήσεις**: οι τρεις λόγοι που φτάνουν εδώ (`link-invalid` · `link-foreign` ·
 * `invitation-unknown`) λένε στον άνθρωπο το ίδιο πράγμα — αυτός ο σύνδεσμος δεν αντιστοιχεί σε πρόσκληση.
 */

import { TourCaptureInviteContent } from '@/components/spatial-tour/TourCaptureInviteContent';

export default function TourCaptureInviteNotFound(): React.ReactElement {
  return <TourCaptureInviteContent view={{ kind: 'refused', reason: 'invitation-unknown' }} />;
}
