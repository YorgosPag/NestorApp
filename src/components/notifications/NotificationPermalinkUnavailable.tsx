'use client';

/**
 * @fileoverview **Ο ΜΟΝΙΜΟΣ ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΟΔΗΓΕΙ ΠΟΥΘΕΝΑ** — ίδια οθόνη για «δεν υπάρχει» και «δεν είναι δική σου».
 * @related ADR-848 · server/notifications/notification-permalink.ts
 * @module components/notifications/NotificationPermalinkUnavailable
 *
 * 🔑 **Μία οθόνη για δύο αιτίες, ΣΚΟΠΙΜΑ.** Ένα προωθημένο email ή μια μαντεμένη
 * ταυτότητα δεν πρέπει να μαθαίνει **ούτε** αν η ειδοποίηση υπάρχει (δόγμα Ε-5 §4 —
 * ίδιο με το 404 του layout του χώρου). Το κείμενο λέει στον **ιδιοκτήτη** τη μόνη
 * χρήσιμη κίνηση: ίσως είναι συνδεδεμένος με άλλον λογαριασμό.
 *
 * ⚠️ **Καμία συμβολοσειρά οθόνης δεν ζει εδώ** (N.11).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ `/n/[notificationId]`. Χωρίς αυτή τη γραμμή
// η οθόνη θα έβαφε ωμά κλειδιά στο πρώτο καρέ. ΕΔΩ και όχι στο `page.tsx`: εκείνο είναι
// Server Component, με ΞΕΧΩΡΙΣΤΟ γράφο module. Στατική εισαγωγή, εμβέλεια MODULE.
import routeSlice from '@/i18n/generated/routes/n__notificationId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Link } from '@/lib/workspace/navigation';
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';

registerRouteSlice(routeSlice);

const NS = 'auth';

export function NotificationPermalinkUnavailable(): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    // CHECK 3.63 (ADR-797) `[page-measure]` — το πλάτος της κάρτας auth ζει ονομασμένο
    // στο `layout.cardAuthWidth`, και η ίδια η κάρτα **μία φορά** στο `AuthCardSection`.
    <AuthCardSection gap={3}>
      <h1 className="text-lg font-semibold text-card-foreground">
        {t('auth:emailLink.unavailable.title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('auth:emailLink.unavailable.body')}</p>
      <Link
        href={HOME_REDIRECT_ROUTE}
        className="text-sm font-medium text-card-foreground underline underline-offset-4"
      >
        {t('auth:emailLink.unavailable.home')}
      </Link>
    </AuthCardSection>
  );
}
