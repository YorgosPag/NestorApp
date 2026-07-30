'use client';

/**
 * Σελίδα συγκατάθεσης OAuth (ADR-738)
 *
 * Ζει στο route group `(auth)` για τον ίδιο λόγο με το `/login`: ο χρήστης
 * μπορεί να φτάσει εδώ χωρίς πλήρη στοίβα providers, και η οθόνη δεν χρειάζεται
 * τίποτα από το app shell.
 *
 * Η σελίδα είναι λεπτή σκόπιμα: διαβάζει τις παραμέτρους και παραδίδει. Όλη η
 * λογική — και όλη η άμυνα — ζει στο `OAuthConsentCard` και, κυρίως, στον
 * server (`authorize-request-store`).
 *
 * @module app/(auth)/oauth/consent/page
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { OAuthConsentCard } from '@/components/oauth/OAuthConsentCard';

function ConsentPageBody(): React.ReactElement {
  const params = useSearchParams();

  return (
    <OAuthConsentCard
      requestHandle={params.get('request')}
      initialError={params.get('error')}
    />
  );
}

export default function OAuthConsentPage(): React.ReactElement {
  return (
    <section className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={null}>
        <ConsentPageBody />
      </Suspense>
    </section>
  );
}
