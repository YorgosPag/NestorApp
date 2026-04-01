/**
 * =============================================================================
 * BrokerageInlineForm — Inline Add/Edit form for brokerage agreements
 * =============================================================================
 *
 * @module components/projects/tabs/brokerage/BrokerageInlineForm
 * @enterprise ADR-230 / SPEC-230B
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import type {
  ExclusivityType,
  CommissionType,
  ExclusivityValidationResult,
} from '@/types/brokerage';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { InlineFormState, UnitSummary } from './brokerage-form-types';

// =============================================================================
// PROPS
// =============================================================================

interface BrokerageInlineFormProps {
  form: InlineFormState;
  updateForm: <K extends keyof InlineFormState>(key: K, value: InlineFormState[K]) => void;
  isEditMode: boolean;
  projectName: string;
  units: UnitSummary[];
  propertyNameMap: Map<string, string>;
  saving: boolean;
  canSave: boolean | string;
  formError: string;
  validationResult: ExclusivityValidationResult | null;
  isValidating: boolean;
  onAgentSelect: (contact: ContactSummary | null) => void;
  onCreateNew: (() => void) | undefined;
  onSave: () => void;
  onCancel: () => void;
  t: (key: string, params?: Record<string, string>) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BrokerageInlineForm({
  form,
  updateForm,
  isEditMode,
  projectName,
  units,
  propertyNameMap,
  saving,
  canSave,
  formError,
  validationResult,
  isValidating,
  onAgentSelect,
  onCreateNew,
  onSave,
  onCancel,
  t,
}: BrokerageInlineFormProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();

  function resolvePropertyNames(params: Record<string, string>): Record<string, string> {
    const resolved = { ...params };
    if (resolved.propertyName && propertyNameMap.has(resolved.propertyName)) {
      resolved.propertyName = propertyNameMap.get(resolved.propertyName) ?? resolved.propertyName;
    }
    if (resolved.propertyNames) {
      resolved.propertyNames = resolved.propertyNames
        .split(', ')
        .map((id) => propertyNameMap.get(id) ?? id)
        .join(', ');
    }
    return resolved;
  }

  return (
    <article className="rounded-lg border bg-muted/30 p-2 space-y-2">
      <header className="flex items-center justify-between">
        <h4 className={typography.heading.sm}>
          {isEditMode ? t('sales.legal.editAgreement') : t('sales.legal.addAgreement')}
          {projectName && (
            <span className={cn("ml-2 font-normal", typography.special.tertiary)}>
              — {projectName}
            </span>
          )}
        </h4>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className={iconSizes.sm} />
        </Button>
      </header>

      {/* Validation Messages */}
      {isValidating && (
        <p className={typography.special.secondary}>{t('sales.legal.validating')}</p>
      )}
      {!isValidating && validationResult && validationResult.issues.length > 0 && (
        <ul className="space-y-1">
          {validationResult.issues.map((issue, idx) => (
            <li
              key={idx}
              className={cn("flex items-start gap-2 rounded border p-2", typography.body.sm,
                issue.severity === 'error'
                  ? 'border-destructive text-destructive'
                  : `${getStatusColor('construction', 'border')} ${getStatusColor('construction', 'text')}`
              )}
            >
              {issue.severity === 'error'
                ? <ShieldAlert className={`${iconSizes.sm} mt-0.5 shrink-0`} />
                : <AlertTriangle className={`${iconSizes.sm} mt-0.5 shrink-0`} />
              }
              <span>{(() => {
                const resolved = resolvePropertyNames(issue.messageParams);
                return t(issue.messageKey, resolved)
                  .replace(/\{\{(\w+)\}\}/g, (_, key: string) => resolved[key] ?? '');
              })()}</span>
            </li>
          ))}
        </ul>
      )}
      {formError && (
        <p className={cn("flex items-center gap-2 rounded border border-destructive p-2 text-destructive", typography.body.sm)}>
          <ShieldAlert className={`${iconSizes.sm} shrink-0`} />
          {formError}
        </p>
      )}

      {/* Agent selection */}
      <fieldset className="space-y-1">
        <ContactSearchManager
          selectedContactId={form.agentContactId}
          onContactSelect={onAgentSelect}
          label={t('sales.legal.selectAgent')}
          placeholder={t('sales.legal.selectAgent')}
          disabled={isEditMode}
          onCreateNew={isEditMode ? undefined : onCreateNew}
        />
      </fieldset>

      {/* Scope */}
      <fieldset className="space-y-1">
        <Label className={typography.label.sm}>{t('sales.legal.selectScope')}</Label>
        <Select
          value={form.scope}
          onValueChange={(v) => updateForm('scope', v as 'project' | 'unit')}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">{t('sales.legal.scopeProject')}</SelectItem>
            <SelectItem value="unit">{t('sales.legal.scopeUnit')}</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>

      {/* Unit — conditional */}
      {form.scope === 'unit' && (
        <fieldset className="space-y-1">
          <Label className={typography.label.sm}>{t('sales.legal.selectProperty')}</Label>
          <Select value={form.propertyId} onValueChange={(v) => updateForm('propertyId', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t('sales.legal.selectProperty')} />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      )}

      {/* Exclusivity */}
      <fieldset className="space-y-1">
        <Label className={typography.label.sm}>{t('sales.legal.exclusivity')}</Label>
        <Select
          value={form.exclusivity}
          onValueChange={(v) => updateForm('exclusivity', v as ExclusivityType)}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exclusive">{t('sales.legal.exclusive')}</SelectItem>
            <SelectItem value="non_exclusive">{t('sales.legal.nonExclusive')}</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>

      {/* Commission */}
      <fieldset className="grid grid-cols-2 gap-2">
        <nav className="space-y-1">
          <Label className={typography.label.sm}>{t('sales.legal.commissionType')}</Label>
          <Select
            value={form.commissionType}
            onValueChange={(v) => updateForm('commissionType', v as CommissionType)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">{t('sales.legal.commissionPercentage')}</SelectItem>
              <SelectItem value="fixed">{t('sales.legal.commissionFixed')}</SelectItem>
            </SelectContent>
          </Select>
        </nav>
        <nav className="space-y-1">
          <Label className={typography.label.sm}>{t('sales.legal.commission')}</Label>
          {form.commissionType === 'percentage' ? (
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.commissionPercentage}
              onChange={(e) => updateForm('commissionPercentage', e.target.value)}
              placeholder="2"
              className="h-9"
            />
          ) : (
            <Input
              type="number"
              min={0}
              step={100}
              value={form.commissionFixedAmount}
              onChange={(e) => updateForm('commissionFixedAmount', e.target.value)}
              placeholder="5000"
              className="h-9"
            />
          )}
        </nav>
      </fieldset>

      {/* Dates */}
      <fieldset className="grid grid-cols-2 gap-2">
        <nav className="space-y-1">
          <Label className={typography.label.sm}>{t('sales.legal.startDate')}</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e) => updateForm('startDate', e.target.value)}
            className="h-9"
          />
        </nav>
        <nav className="space-y-1">
          <Label className={typography.label.sm}>
            {t('sales.legal.endDate')}
            <span className={cn("ml-1", typography.special.tertiary)}>({t('sales.legal.indefinite')})</span>
          </Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e) => updateForm('endDate', e.target.value)}
            className="h-9"
          />
        </nav>
      </fieldset>

      {/* Notes */}
      <fieldset className="space-y-1">
        <Label className={typography.label.sm}>{t('sales.legal.notes')}</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => updateForm('notes', e.target.value)}
          rows={2}
          className="resize-none"
        />
      </fieldset>

      {/* Actions */}
      <footer className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          {t('buttons.cancel')}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || !canSave}>
          {saving ? '...' : t('buttons.save')}
        </Button>
      </footer>
    </article>
  );
}
