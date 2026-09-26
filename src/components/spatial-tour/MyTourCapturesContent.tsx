'use client';

/**
 * @fileoverview **«ΟΙ ΛΗΨΕΙΣ ΜΟΥ»** — ανά ακίνητο: άδεια (ως πότε · για ποια δουλειά) + ανέβασμα + τα ανεβάσματά μου.
 * @related ADR-884 Φ0.5 · §4.5 (Κ3α) · `app/(me)/tour-captures/page.tsx` · `TourCaptureInbox` (το ΙΔΙΟ με τον υπεύθυνο)
 * @module components/spatial-tour/MyTourCapturesContent
 *
 * 🔑 **Κανένα δεύτερο συστατικό ανεβάσματος**: ο φωτογράφος χρησιμοποιεί τα **ίδια** εισερχόμενα με τον υπεύθυνο —
 * ο διακομιστής του δείχνει **μόνο** τις δικές του λήψεις (`listTourCaptures`). Ανενεργή άδεια (έληξε · ανακλήθηκε)
 * φαίνεται **με όνομα** και χωρίς φόρμα: ξέρει ότι πρέπει να ζητήσει νέα πρόσκληση.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { MyTourCaptureGrant } from '@/server/spatial-tour/tour-capture-list';

import { MY_CAPTURES_KEYS, STANDING_KEY } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourCaptureInbox } from './TourCaptureInbox';

// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ποτέ `import()`, ποτέ σε Server Component):
//    χωρίς αυτό το artifact υπάρχει, οι πύλες είναι πράσινες, και η σελίδα βάφει ωμά κλειδιά.
import routeSlice from '@/i18n/generated/routes/tour-captures.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function MyTourCapturesContent({ grants }: { readonly grants: readonly MyTourCaptureGrant[] }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t(MY_CAPTURES_KEYS.title)}</h1>
        <p className="text-sm text-muted-foreground">{t(MY_CAPTURES_KEYS.description)}</p>
      </header>
      {grants.length === 0
        ? <p className="text-sm text-muted-foreground">{t(MY_CAPTURES_KEYS.empty)}</p>
        : grants.map((grant) => <GrantCard key={`${grant.subject.kind}:${grant.subject.id}`} grant={grant} />)}
    </main>
  );
}

function GrantCard({ grant }: { readonly grant: MyTourCaptureGrant }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {grant.propertyLabel ?? t(MY_CAPTURES_KEYS.unnamedProperty)}
          <Badge variant={grant.standing === 'active' ? 'default' : 'outline'}>{t(STANDING_KEY[grant.standing])}</Badge>
        </CardTitle>
        <CardDescription>
          {t(MY_CAPTURES_KEYS.until, { date: formatDate(grant.expiresAt) })} · {t(MY_CAPTURES_KEYS.for, { reason: grant.reason })}
        </CardDescription>
      </CardHeader>
      {grant.standing === 'active' && (
        <CardContent>
          <TourCaptureInbox subject={grant.subject} />
        </CardContent>
      )}
    </Card>
  );
}
