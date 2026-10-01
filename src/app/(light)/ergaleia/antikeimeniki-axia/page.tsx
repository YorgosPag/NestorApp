/**
 * `/ergaleia/antikeimeniki-axia` — **ο δημόσιος υπολογιστής αντικειμενικής αξίας** (ADR-898 Φ2).
 *
 * 🔑 **Στατική σελίδα**: κανένα δεδομένο ανά αίτημα. Η τιμή ζώνης ζητείται από τον browser για το σημείο που βάζει ο
 * επισκέπτης (`GET /api/market/value-zone`), και ο υπολογισμός γίνεται εκεί με τη **μία** μηχανή του νόμου
 * (`lib/objective-value`). Ο διακομιστής στέλνει μόνο το κέλυφος, τα κείμενα και το JSON-LD.
 *
 * 🔑 **SEO**: `metadata` + canonical, JSON-LD (`WebApplication` · `HowTo` · `FAQPage` · `BreadcrumbList`) μέσα στο HTML
 * που στέλνεται. ⚠️ Ο ευρετηριασμός ολόκληρου του ιστότοπου είναι σήμερα κλειστός (`public/robots.txt` =
 * `Disallow: /`) — απόφαση έναρξης λειτουργίας (ADR-890 §5.5), όχι αυτής της σελίδας.
 */

import React, { Suspense } from 'react';

import { ObjectiveValueContent } from '@/components/objective-value/ObjectiveValueContent';
import { JsonLdScript } from '@/components/seo/JsonLdScript';
import { StaticPageLoading } from '@/core/states';
import { objectiveValueMetadata, objectiveValueStructuredData } from '@/services/objective-value/objective-value-seo';

export const metadata = objectiveValueMetadata();

export default function ObjectiveValuePage() {
  const structuredData = objectiveValueStructuredData();
  return (
    <>
      {structuredData === null ? null : <JsonLdScript data={structuredData} />}
      <Suspense fallback={<StaticPageLoading />}>
        <ObjectiveValueContent />
      </Suspense>
    </>
  );
}
