'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from '@/lib/workspace/navigation';
import { useSearchParams } from 'next/navigation';
import { RfqBuilder } from '@/subapps/procurement/components/RfqBuilder';
import type { RfqBuilderInitialState } from '@/subapps/procurement/components/RfqBuilder';
import { useRfqCatalogDraft, type RfqCatalogDraftState } from '@/subapps/procurement/hooks/useRfqCatalogDraft';
import { RFQ_CATALOG_PARAM } from '@/lib/navigation/procurement-urls';
import type { RfqCatalogSupplierSent } from '@/subapps/procurement/types/rfq-line';
import { suppliersToOfferAccess, type SupplierWithAccess } from '@/subapps/procurement/components/rfq-builder-lines';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__rfqs__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

/**
 * ⚠️ `next/dynamic` = όριο της κλειστότητας του route slice (CHECK 3.34): το επόμενο βήμα φαίνεται μόνο **μετά** την
 * αποστολή ενός αιτήματος από τη βιτρίνα, άρα τα κείμενά του δεν ανήκουν στην εκκίνηση της φόρμας.
 */
const RfqCatalogSentStep = dynamic(
  () => import('@/subapps/procurement/components/RfqCatalogSentStep').then((mod) => mod.RfqCatalogSentStep),
  { ssr: false },
);

/** Ο τίτλος του RFQ είναι υποχρεωτικός (≤ 200): προσυμπληρώνεται με το SKU, και ο αγοραστής τον αλλάζει ελεύθερα. */
const RFQ_TITLE_MAX = 200;

/** ADR-923 §5.13 Τ6 — το πρόχειρο του καταλόγου πάνω στην κατάσταση από BOQ ή URL. Ποσότητα και μονάδα: του αγοραστή. */
function withCatalogDraft(state: RfqBuilderInitialState | undefined, catalog: RfqCatalogDraftState): RfqBuilderInitialState | undefined {
  if (catalog.status !== 'ready') return state;
  const base = state ?? {};
  return { ...base, title: base.title || catalog.draft.description.slice(0, RFQ_TITLE_MAX), catalogDrafts: [catalog.draft] };
}

function urlInitialState(projectId: string | null, vendorContactId: string | null): RfqBuilderInitialState | undefined {
  if (!projectId && !vendorContactId) return undefined;
  return {
    ...(projectId ? { projectId } : {}),
    ...(vendorContactId ? { invitedVendorIds: [vendorContactId] } : {}),
  };
}

export default function NewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boqItemsParam = searchParams.get('boqItems');
  const projectIdParam = searchParams.get('projectId');
  const vendorContactIdParam = searchParams.get('vendorContactId');
  const catalog = useRfqCatalogDraft(searchParams.get(RFQ_CATALOG_PARAM));

  const [initialState, setInitialState] = useState<RfqBuilderInitialState | undefined>();
  const [loading, setLoading] = useState(!!boqItemsParam);
  const [sent, setSent] = useState<{ rfqId: string; suppliers: SupplierWithAccess[] } | null>(null);

  useEffect(() => {
    if (boqItemsParam) {
      const ids = boqItemsParam.split(',').filter(Boolean);
      fetch('/api/rfqs/from-boq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boqItemIds: ids }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const state: RfqBuilderInitialState = json?.data ?? {};
          if (projectIdParam && !state.projectId) state.projectId = projectIdParam;
          if (vendorContactIdParam) {
            state.invitedVendorIds = [...(state.invitedVendorIds ?? []), vendorContactIdParam];
          }
          setInitialState(state);
        })
        .finally(() => setLoading(false));
    }
  }, [boqItemsParam, projectIdParam, vendorContactIdParam]);

  // Χωρίς BOQ η κατάσταση βγαίνει ΣΥΓΧΡΟΝΑ από το URL. Ως effect έφτανε μετά την πρώτη απόδοση, όταν το `RfqBuilder` είχε
  // ήδη αρχικοποιήσει τη φόρμα του, άρα το `?projectId=` / `?vendorContactId=` χανόταν.
  const builderState = boqItemsParam ? initialState : urlInitialState(projectIdParam, vendorContactIdParam);

  const viewRfq = (id: string) => router.push(`/procurement/rfqs/${id}`);
  // Ε6δ: το επόμενο βήμα το αποφασίζει ό,τι ΣΤΑΛΘΗΚΕ (απάντηση του POST), όχι το πρόχειρο: ο χρήστης μπορεί να έσβησε τη
  // γραμμή καταλόγου. Πρόταση πρόσβασης μόνο για προσκεκλημένο προμηθευτή με SKU της βιτρίνας και ζωντανό σύνδεσμο.
  const handleSuccess = (id: string, catalogSuppliers: readonly RfqCatalogSupplierSent[]) => {
    const suppliers = suppliersToOfferAccess(catalogSuppliers);
    if (suppliers.length > 0) setSent({ rfqId: id, suppliers });
    else viewRfq(id);
  };

  if (loading || catalog.status === 'loading') {
    return (
      <main className="container mx-auto max-w-3xl py-6 flex justify-center">
        <Spinner size="large" />
      </main>
    );
  }

  if (sent !== null) {
    return (
      <main className="container mx-auto max-w-3xl py-6">
        <RfqCatalogSentStep suppliers={sent.suppliers} onViewRfq={() => viewRfq(sent.rfqId)} />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl py-6 space-y-4">
      {catalog.status === 'refused' && (
        <Alert variant="destructive" withIcon>
          <AlertDescription>{catalog.message}</AlertDescription>
        </Alert>
      )}
      <RfqBuilder
        initialState={withCatalogDraft(builderState, catalog)}
        onSuccess={handleSuccess}
        onCancel={() => router.push('/procurement')}
      />
    </main>
  );
}
