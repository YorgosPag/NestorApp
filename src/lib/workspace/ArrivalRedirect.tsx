'use client';

/**
 * @fileoverview **Η άφιξη από το δίχτυ** — ανακατεύθυνση πελάτη που κρατά το fragment του αιτήματος.
 * @module lib/workspace/ArrivalRedirect
 * @see ./arrival-address (ο κανόνας και η μέτρηση) · ADR-787 §5.3 ιβ · ADR-840 §7.7
 *
 * 🔑 Ο server χτίζει τον προορισμό (διαδρομή χώρου + ερώτημα)· ο πελάτης προσθέτει το **μόνο** που ο server δεν
 *    βλέπει ποτέ, το `#…`. Η ανακατεύθυνση ήταν **ήδη** πελάτη (το `redirect()` κάτω από το `(app)/loading.tsx`
 *    απαντά 200 και εκτελείται στον browser) — εδώ αλλάζει μόνο ότι δεν πετά πια το fragment.
 *
 * ⚠️ `replace`, όχι `push`: η διεύθυνση χωρίς χώρο δεν είναι σελίδα· το «πίσω» δεν πρέπει να ξαναπέφτει στο δίχτυ.
 * ⚠️ Μία φορά ανά mount (ref) — το StrictMode τρέχει το effect δύο φορές στον dev.
 */

import { useEffect, useRef } from 'react';

import { StaticPageLoading } from '@/core/states';
import { useRouter } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { withFragment } from '@/lib/workspace/arrival-address';

interface ArrivalRedirectProps {
  /** Ο προορισμός, **ήδη** με πρόθεμα χώρου και ερώτημα — τον χτίζει ο server (`workspaceDestinationFor`). */
  readonly to: string;
}

export function ArrivalRedirect({ to }: ArrivalRedirectProps) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    router.replace(
      declaredHref(
        'ADR-840 §7.7 — προορισμός του διχτυού, χτισμένος ολόκληρος από τον server (`workspaceDestinationFor`) + το fragment του αιτήματος',
        withFragment(to, window.location.hash),
      ),
    );
  }, [router, to]);

  return <StaticPageLoading />;
}
