'use client';

/**
 * **Οι μάρκες του προμηθευτή** (ADR-923 §16): αίτηση με απόδειξη και η κατάσταση κάθε μάρκας.
 *
 * 🔑 Το «σε ισχύ» και το «έληξε» παράγονται εδώ από την ίδια κρίση με τον διακομιστή (`activeBrandGrant`).
 *
 * @module components/catalog/settings/SupplierBrandClaimsPanel
 */

import React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDate } from '@/lib/intl-formatting';
import { activeBrandGrant } from '@/subapps/catalog/public/supplier-brand-claim-rules';
import { MAX_BRAND_NAME_LENGTH, type SupplierBrandClaimRecord, type SupplierBrandRelation } from '@/subapps/catalog/types/supplier-brand-claim';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import { useSupplierEvidenceUpload } from './use-supplier-evidence-upload';

const CLAIMS_URL = '/api/catalog/supplier-brand-claims';

const RELATION_KEYS: Readonly<Record<SupplierBrandRelation, string>> = {
  manufacturer: 'supplierBrands.manufacturer',
  'authorized-representative': 'supplierBrands.representative',
};

function useBrandClaims() {
  const [claims, setClaims] = React.useState<readonly SupplierBrandClaimRecord[]>([]);
  const reload = React.useCallback(() => {
    apiClient.get<{ claims: readonly SupplierBrandClaimRecord[] }>(CLAIMS_URL).then((body) => setClaims(body.claims)).catch(() => setClaims([]));
  }, []);
  React.useEffect(reload, [reload]);
  return { claims, reload };
}

function ClaimState({ claim }: { readonly claim: SupplierBrandClaimRecord }): React.JSX.Element {
  const { t } = useCatalogText();
  const grant = activeBrandGrant(claim, Date.now());
  if (grant !== null) return <>{t('supplierBrands.active', { date: formatDate(grant.validUntil) })}</>;
  if (claim.status === 'pending-review') return <>{t('supplierBrands.pending')}</>;
  if (claim.status === 'rejected') return <>{t('supplierBrands.rejected')}</>;
  if (claim.status === 'revoked') return <>{t('supplierBrands.revoked')}</>;
  return <>{t('supplierBrands.expired', { date: claim.grant === null ? '' : formatDate(claim.grant.validUntil) })}</>;
}

export function SupplierBrandClaimsPanel(): React.JSX.Element {
  const { t } = useCatalogText();
  const { claims, reload } = useBrandClaims();
  const [brandName, setBrandName] = React.useState('');
  const [relation, setRelation] = React.useState<SupplierBrandRelation>('authorized-representative');
  const inputId = React.useId();
  const nameId = React.useId();
  const { busy, failed, onFile } = useSupplierEvidenceUpload(
    (evidenceFileId) => apiClient.post(CLAIMS_URL, { brandName, relation, evidenceFileId }),
    () => { setBrandName(''); reload(); },
  );

  return (
    <section className="flex flex-col gap-3 rounded-md border p-4">
      <header>
        <h2 className="m-0 text-base font-semibold">{t('supplierBrands.title')}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t('supplierBrands.lead')}</p>
      </header>
      {claims.length === 0
        ? <p className="m-0 text-sm text-muted-foreground">{t('supplierBrands.empty')}</p>
        : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
            {claims.map((claim) => (
              <li key={claim.id}>
                {claim.brandName} · {t(RELATION_KEYS[claim.relation])} · <ClaimState claim={claim} />
                {claim.status === 'rejected' && claim.reviewNote !== null && <span className="text-muted-foreground"> · {claim.reviewNote}</span>}
              </li>
            ))}
          </ul>
        )}
      {failed && <Alert variant="destructive" withIcon><AlertDescription>{t('supplierBrands.failed')}</AlertDescription></Alert>}
      <p className="m-0 flex flex-col gap-1">
        <Label htmlFor={nameId}>{t('supplierBrands.brandName')}</Label>
        <Input id={nameId} value={brandName} maxLength={MAX_BRAND_NAME_LENGTH} disabled={busy} onChange={(event) => setBrandName(event.target.value)} />
      </p>
      <Select value={relation} disabled={busy} onValueChange={(value) => setRelation(value as SupplierBrandRelation)}>
        <SelectTrigger aria-label={t('supplierBrands.relation')}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="manufacturer">{t('supplierBrands.manufacturer')}</SelectItem>
          <SelectItem value="authorized-representative">{t('supplierBrands.representative')}</SelectItem>
        </SelectContent>
      </Select>
      <p className="m-0 flex flex-col gap-1 text-sm">
        <label htmlFor={inputId}>{t('supplierBrands.document')}</label>
        <input id={inputId} type="file" accept="application/pdf" disabled={busy || brandName.trim() === ''} onChange={onFile} />
      </p>
      {busy && <p role="status" className="m-0 text-sm text-muted-foreground">{t('supplierBrands.uploading')}</p>}
    </section>
  );
}
