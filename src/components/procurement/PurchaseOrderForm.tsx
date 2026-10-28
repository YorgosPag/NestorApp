'use client';

/**
 * PurchaseOrderForm — Create / Edit PO form
 *
 * Two-column layout on desktop, single column on mobile.
 * Auto-calculated totals, inline validation.
 *
 * @see ADR-267 §Phase A
 */

import { useCallback, useId, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormActions } from '@/components/ui/form/FormActions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/design-system';
import { Save, X, AlertCircle } from 'lucide-react';
import { PO_VAT_RATES } from '@/types/procurement';
import type { PurchaseOrder, POVatRate } from '@/types/procurement';
import { usePurchaseOrderForm, usePOPricing } from '@/hooks/procurement';
import { POTotalsSummary } from './POTotalsSummary';
import { PORepricingNotice } from './PORepricingNotice';
import { PORepricingDialog } from './PORepricingDialog';
import { ApiClientError } from '@/lib/api/api-client-types';
import { PO_PRICING_CONFLICT_CODE } from '@/config/versioning-config';
import { useMaterials } from '@/hooks/procurement/useMaterials';
import { PurchaseOrderItemsTable } from './PurchaseOrderItemsTable';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { POProjectSelector, POSupplierSelector, POBuildingSelector } from './POEntitySelectors';
import { PODeliveryAddressField } from './PODeliveryAddressField';
import type { FirestoreProject } from '@/hooks/useFirestoreProjects';
import { formatAddressLine } from '@/types/project/address-helpers';
import type { PurchaseOrderSaveResult } from '@/services/procurement/procurement-mutation-gateway';

/**
 * ADR-923 «3γ» Α9: ο server αρνήθηκε (409) γιατί οι όροι άλλαξαν μετά την προεπισκόπηση. Η φόρμα
 * έχει ήδη τη νέα τιμολόγηση (ζωντανή συνδρομή συμβάσεων) — εξηγεί, ώστε ο άνθρωπος να ξαναδεί.
 */
async function saveOrExplainConflict<T>(save: () => Promise<T>, conflictMessage: string): Promise<T> {
  try {
    return await save();
  } catch (caught) {
    if (caught instanceof ApiClientError && caught.errorCode === PO_PRICING_CONFLICT_CODE) throw new Error(conflictMessage);
    throw caught;
  }
}

interface PurchaseOrderFormProps {
  existingPO?: PurchaseOrder | null;
  initialProjectId?: string;
  /** Always called after a successful save — `created` or `updated` (ADR-923 «3γ» Α13). */
  onSuccess?: (saved: PurchaseOrderSaveResult) => void;
  onCancel?: () => void;
}

export function PurchaseOrderForm({
  existingPO,
  initialProjectId,
  onSuccess,
  onCancel,
}: PurchaseOrderFormProps) {
  const { t } = useTranslation('procurement');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το πεδίο (ADR-598 G11)
  const formId = `${idBase}-form`;
  const {
    form,
    setField,
    addItem,
    removeItem,
    updateItem,
    validationErrors,
    isValid,
    isEditMode,
    pricingMode,
    setPricingMode,
    save,
  } = usePurchaseOrderForm(existingPO, initialProjectId);

  // ADR-923 «3γ» Α9: στην επεξεργασία η PO κρατά τους όρους της· οι σημερινοί φαίνονται, δεν επιβάλλονται.
  const { pricing, current, drift, agreementTitles, titleOf } = usePOPricing({
    supplierId: form.supplierId,
    projectId: form.projectId,
    items: form.items,
    taxRate: form.taxRate,
    documentDate: existingPO?.dateCreated ?? null,
    stored: existingPO ?? null,
    pricingMode,
  });
  const [repricingOpen, setRepricingOpen] = useState(false);
  const { materials } = useMaterials();

  // ADR-598 «(η)»: ένας δρόμος υποβολής (κλικ + Enter) μέσω του SSoT. Νέα PO = `draft` ⇒ το Enter
  // σε πεδίο (implicit submission της HTML) δημιουργεί πρόχειρο, δεν αποστέλλει τίποτα.
  const { submitting, error, handleSubmit } = useFormSubmission({
    canSubmit: isValid,
    submit: () => saveOrExplainConflict(() => save(existingPO?.id, pricing.totals.total), t('form.pricingConflict')),
    onSuccess,
    errorFallback: t('form.saveFailed'),
    // A new PO navigates to its page: keep the lock until the route changes (no second PO on a 2nd click).
    keepLockedOnSuccess: !isEditMode,
  });

  /**
   * When a project is selected:
   * 1. Set projectId
   * 2. Clear building (belongs to previous project)
   * 3. Auto-fill delivery address if field is empty
   *    Priority: addresses[type=delivery] → addresses[type=site] → legacy address+city
   */
  const handleProjectSelect = useCallback(
    (projectId: string, project?: FirestoreProject) => {
      setField('projectId', projectId);
      setField('buildingId', null);

      if (project && !form.deliveryAddress) {
        const deliveryAddr = project.addresses?.find(
          (a) => a.type === 'delivery'
        );
        if (deliveryAddr) {
          setField('deliveryAddress', formatAddressLine(deliveryAddr));
          return;
        }

        const siteAddr =
          project.addresses?.find((a) => a.type === 'site' && a.isPrimary) ??
          project.addresses?.find((a) => a.type === 'site');
        if (siteAddr) {
          setField('deliveryAddress', formatAddressLine(siteAddr));
          return;
        }

        // Legacy fallback
        const legacyParts = [project.address, project.city].filter(Boolean);
        if (legacyParts.length > 0) {
          setField('deliveryAddress', legacyParts.join(', '));
        }
      }
    },
    [setField, form.deliveryAddress]
  );

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditMode
              ? t('form.editTitle')
              : t('form.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Project */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-project`}>{t('form.project')} <span className="text-destructive">*</span></Label>
              <POProjectSelector
                id={`${idBase}-project`}
                value={form.projectId}
                onSelect={(projectId, project) =>
                  handleProjectSelect(projectId, project ?? undefined)
                }
              />
            </div>

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-supplier`}>{t('form.supplier')} <span className="text-destructive">*</span></Label>
              <POSupplierSelector
                id={`${idBase}-supplier`}
                value={form.supplierId}
                onSelect={(id) => setField('supplierId', id)}
              />
            </div>

            {/* Building (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-building`}>{t('form.building')}</Label>
              <POBuildingSelector
                id={`${idBase}-building`}
                value={form.buildingId ?? ''}
                projectId={form.projectId || null}
                onSelect={(id) => setField('buildingId', id)}
              />
            </div>

            {/* Date needed */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-date-needed`}>{t('form.dateNeeded')}</Label>
              <Input
                id={`${idBase}-date-needed`}
                type="date"
                value={form.dateNeeded}
                onChange={(e) => setField('dateNeeded', e.target.value)}
              />
            </div>

            {/* VAT Rate */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-vat-rate`}>{t('form.vatRate')}</Label>
              <Select
                value={String(form.taxRate)}
                onValueChange={(v) =>
                  setField('taxRate', parseInt(v, 10) as POVatRate)
                }
              >
                <SelectTrigger id={`${idBase}-vat-rate`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_VAT_RATES.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment terms */}
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-payment-terms`}>{t('form.paymentTerms')}</Label>
              <Input
                id={`${idBase}-payment-terms`}
                type="number"
                min={0}
                max={365}
                value={form.paymentTermsDays}
                onChange={(e) => setField('paymentTermsDays', e.target.value)}
                placeholder="30"
              />
            </div>

            {/* Delivery address — type-driven autofill */}
            <div className="md:col-span-2">
              <PODeliveryAddressField
                projectId={form.projectId}
                value={form.deliveryAddress}
                onChange={(v) => setField('deliveryAddress', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.items')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseOrderItemsTable
            items={form.items}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            materials={materials}
          />

          {isEditMode && (
            <PORepricingNotice
              pricingMode={pricingMode}
              drift={drift}
              onReview={() => setRepricingOpen(true)}
              onUndo={() => setPricingMode('carry')}
            />
          )}

          <POTotalsSummary
            totals={pricing.totals}
            taxRate={form.taxRate}
            agreementTitles={agreementTitles}
            ambiguousLineCount={pricing.ambiguousLineIndexes.length}
          />
        </CardContent>
      </Card>

      {drift && (
        <PORepricingDialog
          open={repricingOpen}
          onOpenChange={setRepricingOpen}
          kept={pricing}
          current={current}
          drift={drift}
          descriptions={form.items.map((item) => item.description)}
          titleOf={titleOf}
          onConfirm={() => {
            setPricingMode('redetermine');
            setRepricingOpen(false);
          }}
        />
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-supplier-notes`}>{t('form.supplierNotes')}</Label>
              <Textarea
                id={`${idBase}-supplier-notes`}
                value={form.supplierNotes}
                onChange={(e) => setField('supplierNotes', e.target.value)}
                placeholder={t('form.supplierNotesPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idBase}-internal-notes`}>{t('form.internalNotes')}</Label>
              <Textarea
                id={`${idBase}-internal-notes`}
                value={form.internalNotes}
                onChange={(e) => setField('internalNotes', e.target.value)}
                placeholder={t('form.internalNotesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('form.validationErrors')}
            </span>
          </div>
          <ul className="mt-1 ml-6 list-disc text-sm text-destructive">
            {validationErrors.map((issue) => (
              <li key={`${issue.key}-${issue.line ?? 0}`}>{t(`form.validation.${issue.key}`, { line: issue.line })}</li>
            ))}
          </ul>
        </div>
      )}

      <FormActions
        formId={formId}
        submitLabel={isEditMode ? t('form.save') : t('form.create')}
        pendingLabel={t('form.saving')}
        cancelLabel={t('form.cancel')}
        onCancel={onCancel}
        submitting={submitting}
        submitDisabled={!isValid}
        error={error}
        submitIcon={Save}
        cancelIcon={X}
        className={cn(
          'sticky bottom-0 bg-background/95 py-3 backdrop-blur-sm',
          'md:static md:bg-transparent md:py-0 md:backdrop-blur-none',
        )}
      />
    </form>
  );
}
