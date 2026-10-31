'use client';

import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import { LazyHarnessRoutes } from '@/utils/lazyHarnessRoutes';

// ADR-280 §11.8 Β4.3 — από το μητρώο (`lazyHarnessRoutes`): το chunk φέρνει τα κείμενά του. `'use client'` γιατί ένας server
// component δεν μπαίνει με τελεία σε client module· ο φρουρός διαβάζει μόνο `NODE_ENV`, που ενσωματώνεται και στον client.
const ContactMutationHarness = LazyHarnessRoutes.HarnessContactMutation;

export default function ContactMutationHarnessPage() {
  if (!isTestHarnessRouteEnabled()) {
    notFound();
  }

  return <ContactMutationHarness />;
}
