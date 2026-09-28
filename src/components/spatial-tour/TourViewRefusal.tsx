'use client';

/**
 * @fileoverview **Η ΑΡΝΗΣΗ ΘΕΑΣΗΣ ΜΕ ΔΡΟΜΟ** — «γιατί» + «τι να κάνω» (ADR-884 §9.1 Α5).
 * @related `TourViewSurface.tsx` (`renderRefusal`) · `TourAccessCard.tsx` (η κάρτα αιτήματος της αγγελίας) ·
 *   `workspace-invite/SwitchAccount.tsx` (η κοινή αλλαγή λογαριασμού)
 * @module components/spatial-tour/TourViewRefusal
 *
 * 🏆 **Πρότυπο Google Drive «Χρειάζεστε πρόσβαση»** — και πάνω από αυτό: το Drive δίνει ένα γενικό «ζητήστε πρόσβαση»·
 * εδώ ο άνθρωπος βλέπει **τη δική του** θέση (έληξε · ανακλήθηκε · δεν εγκρίθηκε · εκκρεμεί) και ζητά ξανά **επί τόπου**.
 *
 * 🔑 **ΕΝΑΣ κριτής, όχι δεύτερος**: η πύλη του διακομιστή λέει μόνο «όχι»· το «γιατί» το λέει η **ίδια** κάρτα αιτήματος
 * της αγγελίας (`my-access`), που ήδη ξέρει την προηγούμενη έκβαση. Καμία νέα αιτία στη συνεδρία θέασης, κανένα
 * δεύτερο λεξιλόγιο θέσεων.
 */

import { useAuthOptional } from '@/auth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourViewSessionRefusal } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import { loginHref } from '@/lib/routes/return-path';
import { SwitchAccountButton } from '@/components/workspace-invite/SwitchAccount';

import { TOUR_VIEW_REFUSAL_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import TourAccessCard from './TourAccessCard';
import { VIEWER_KEYS } from './tour-access-labels';

/** «Είστε συνδεδεμένοι ως Χ» + αλλαγή λογαριασμού — η πρόσβαση μπορεί να δόθηκε σε **άλλον** λογαριασμό του ίδιου ανθρώπου. */
function SignedInAs({ email, returnPath }: { readonly email: string; readonly returnPath: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <section className="space-y-2 text-sm">
      <p className="text-muted-foreground">{t(VIEWER_KEYS.signedInAs, { email })}</p>
      <SwitchAccountButton href={loginHref(returnPath)} />
    </section>
  );
}

export function TourViewRefusal({ reason, listingId, returnPath }: {
  readonly reason: TourViewSessionRefusal;
  readonly listingId: string;
  readonly returnPath: string;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const email = useAuthOptional()?.user?.email ?? null;
  const verdict = <p className="text-sm text-destructive" role="alert">{t(TOUR_VIEW_REFUSAL_KEY[reason])}</p>;
  return (
    <section className="space-y-4">
      <TourAccessCard listingId={listingId} returnPath={returnPath} whenHidden={verdict} />
      {email !== null && <SignedInAs email={email} returnPath={returnPath} />}
    </section>
  );
}
