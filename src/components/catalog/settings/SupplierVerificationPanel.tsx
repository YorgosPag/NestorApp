'use client';

/**
 * @fileoverview **Η επιβεβαίωση του προμηθευτή** (ADR-923 §5.13 Ε1α · Ε1γ): κατάσταση και ανέβασμα της Βεβαίωσης Μητρώου.
 * @module components/catalog/settings/SupplierVerificationPanel
 *
 * Το έγγραφο ανεβαίνει από τον υπάρχοντα αγωγό αρχείων, δεμένο με τον χώρο, και το κρίνει ο διακομιστής. Η δυνατότητα
 * αίτησης έρχεται από τον διακομιστή, δεν υπολογίζεται εδώ. Χρήστης χωρίς δικαίωμα παίρνει 403 και δεν βλέπει το πάνελ.
 */

import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { OwnSupplierReview } from '@/server/catalog/supplier-review.server';
import type { SupplierReviewStatus } from '@/subapps/catalog/types/supplier-verification';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import { SupplierPublicReach } from './SupplierPublicReach';
import { useSupplierEvidenceUpload } from './use-supplier-evidence-upload';

const REVIEW_URL = '/api/catalog/supplier-verification';
const SHOWCASE_URL = '/api/catalog/supplier-showcase';
const PDF_TYPE = 'application/pdf';

const STATUS_KEYS: Readonly<Record<SupplierReviewStatus | 'none', string>> = {
  none: 'supplierVerification.status.none',
  'pending-review': 'supplierVerification.status.pending-review',
  approved: 'supplierVerification.status.approved',
  rejected: 'supplierVerification.status.rejected',
  revoked: 'supplierVerification.status.revoked',
};

type RouteText = OwnSupplierReview['routeKind'] | 'closed' | 'identity-incomplete';

const ROUTE_KEYS: Readonly<Record<RouteText, string>> = {
  closed: 'supplierVerification.route.closed',
  'identity-incomplete': 'supplierVerification.route.identity-incomplete',
  verified: 'supplierVerification.route.verified',
  'ask-registry': 'supplierVerification.route.ask-registry',
  'submit-document': 'supplierVerification.route.submit-document',
  'adopt-legal-name': 'supplierVerification.route.adopt-legal-name',
  'correct-tax-id': 'supplierVerification.route.correct-tax-id',
  'manual-review': 'supplierVerification.route.manual-review',
};

/**
 * Ο δρόμος λέει πώς φτάνει κανείς στην επιβεβαίωση, οπότε σε επιβεβαιωμένο χώρο σιωπά. Εξαίρεση είναι το `verified` του
 * μητρώου, που είναι το μόνο θετικό μήνυμα όταν δεν υπήρξε αίτηση (`null` ⇒ καμία γραμμή).
 * Πρώτα το ελλιπές προφίλ: χωρίς αυτό, χώρος χωρίς ΑΦΜ θα έβλεπε «κλειστή εταιρεία» ή «υποβάλετε» χωρίς πεδίο αρχείου.
 * Μετά η μη εγκρίσιμη διαλογή ελέγχου, που είναι η κλεισμένη εταιρεία.
 */
function routeTextOf(review: OwnSupplierReview): RouteText | null {
  if (review.verified) return review.routeKind === 'verified' ? 'verified' : null;
  if (review.identityIncomplete) return 'identity-incomplete';
  if (review.routeKind === 'manual-review' && !review.canRequest && review.status !== 'approved') return 'closed';
  return review.routeKind;
}

function useOwnReview(): { readonly review: OwnSupplierReview | null; readonly reload: () => void } {
  const [review, setReview] = React.useState<OwnSupplierReview | null>(null);
  const reload = React.useCallback(() => {
    apiClient
      .get<{ review: OwnSupplierReview }>(REVIEW_URL)
      .then((body) => setReview(body.review))
      .catch(() => setReview(null));
  }, []);
  React.useEffect(reload, [reload]);
  return { review, reload };
}

function usePublish(onDone: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const publish = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await apiClient.post(SHOWCASE_URL, {});
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      onDone();
    }
  };
  return { busy, failed, publish };
}

export function SupplierVerificationPanel(): React.ReactElement | null {
  const { t } = useCatalogText();
  const { review, reload } = useOwnReview();
  const { busy, failed, onFile } = useSupplierEvidenceUpload((evidenceFileId) => apiClient.post(REVIEW_URL, { evidenceFileId }), reload);
  const publication = usePublish(reload);
  const inputId = React.useId();
  if (review === null) return null;
  const routeText = routeTextOf(review);

  return (
    <section className="flex flex-col gap-2 rounded-md border p-4">
      <h2 className="m-0 text-base font-semibold">{t('supplierVerification.title')}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t(STATUS_KEYS[review.status ?? 'none'])}</p>
      {review.status === 'rejected' && review.reviewNote !== null && <p className="m-0 text-sm text-foreground">{review.reviewNote}</p>}
      {routeText !== null && <p className="m-0 text-sm text-muted-foreground">{t(ROUTE_KEYS[routeText])}</p>}
      {failed && <Alert variant="destructive" withIcon><AlertDescription>{t('supplierVerification.failed')}</AlertDescription></Alert>}
      {review.canRequest && (
        <p className="m-0 flex flex-col gap-1 text-sm">
          <label htmlFor={inputId}>{t('supplierVerification.document')}</label>
          <input id={inputId} type="file" accept={PDF_TYPE} disabled={busy} onChange={onFile} />
        </p>
      )}
      {busy && <p role="status" className="m-0 text-sm text-muted-foreground">{t('supplierVerification.uploading')}</p>}
      {review.published && <p className="m-0 text-sm text-foreground">{t('supplierVerification.published')}</p>}
      {review.published && <SupplierPublicReach />}
      {publication.failed && <Alert variant="destructive" withIcon><AlertDescription>{t('supplierVerification.publishFailed')}</AlertDescription></Alert>}
      {review.canPublish && (
        <footer>
          <Button type="button" disabled={publication.busy} onClick={() => void publication.publish()}>{t('supplierVerification.publish')}</Button>
        </footer>
      )}
    </section>
  );
}
