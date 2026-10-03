/**
 * **`/cases/[engagementId]` — μία υπόθεση, μέσω της συμμετοχής του θεατή** (ADR-901 Φ2).
 *
 * 🔑 Η διεύθυνση φέρει τη **συμμετοχή** (`eng_…`), όχι την υπόθεση: το δικαίωμα είναι αυτό που κρίνει ο server
 * (`decideEngagement`, ανά αίτημα). ⚠️ `params` = `Promise` (Next 15). Καμία `generateMetadata`: το `(me)/layout`
 * δηλώνει `noindex` για όλο το group — η υπόθεση κουβαλά νομικά έγγραφα ανθρώπων.
 *
 * @module app/(me)/cases/[engagementId]/page
 */

import { EngagedCaseContent } from '@/components/conveyance/my-cases/EngagedCaseContent';

interface EngagedCasePageProps {
  readonly params: Promise<{ readonly engagementId: string }>;
}

export default async function EngagedCasePage({ params }: EngagedCasePageProps) {
  const { engagementId } = await params;

  return <EngagedCaseContent engagementId={engagementId} />;
}
