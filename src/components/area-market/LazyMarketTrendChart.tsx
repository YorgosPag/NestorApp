'use client';

/**
 * **Ο ΕΝΑΣ φορτωτής του γραφήματος τάσης** — `next/dynamic` χωρίς SSR, με τη ζώνη αναμονής του κελύφους (ADR-890 §13).
 *
 * 🔑 Το recharts **και** τα κλειδιά των ετικετών του γραφήματος μένουν έξω από το αρχικό bundle και το route slice
 * της σελίδας περιοχής (SEO, ADR-890 §5.5 · CHECK 3.34). Δύο καταναλωτές (συμβόλαια, ζητούμενες) ⇒ ένας ορισμός.
 */

import dynamic from 'next/dynamic';
import React from 'react';

import { ChartBandPending } from '@/components/ui/chart-card/ChartBandPending';

export const LazyMarketTrendChart = dynamic(() => import('./MarketTrendChart'), {
  ssr: false,
  loading: () => <ChartBandPending size="sm" captioned />,
});
