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
  // ⚠️ Ούτε `min-h-screen … justify-center` ούτε `p-4` εδώ (ADR-797 ΦΑΣΗ Β): και τα
  // δύο τα κατέχει πλέον το `<main>` του `(auth)/layout.tsx` — το κεντράρισμα ήταν
  // **δεύτερη, ταυτόσημη** δήλωση, και το `p-4` ήταν η **μόνη** αυθεντία του κενού
  // σε αυτή τη γειτονιά, δηλαδή σωστό αλλά χειρόγραφο και ασύμφωνο με το `p-6` που
  // έγραφαν οι διπλανές γειτονιές. Ένας ιδιοκτήτης, ρευστή τιμή.
  return (
    <Suspense fallback={null}>
      <ConsentPageBody />
    </Suspense>
  );
}
