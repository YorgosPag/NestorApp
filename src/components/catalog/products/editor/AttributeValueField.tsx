'use client';
/**
 * **Ένα πεδίο ιδιότητας στον επεξεργαστή** (ADR-923 §5.10.4 Β3).
 *
 * - Ιδιότητα **αυτού** του επιπέδου ⇒ επεξεργαστής τιμής (στη θέση κανάλι × γλώσσα) + «Δεν εφαρμόζεται / Άγνωστο» (Δ5).
 * - **Άξονας** ⇒ μόνο ανάγνωση με λόγο: ο επεξεργαστής ανοίγει πάντα αποθηκευμένο μέλος, και η τιμή άξονα είναι η
 *   ταυτότητά του (Akeneo `ImmutableVariantAxesValues` — ADR-923 §5.10.5).
 * - Ιδιότητα **προγόνου** ⇒ η τιμή του **γκρι** + «Ορίζεται στο …» με σύνδεσμο (Δ1: αυστηρή κληρονομιά, χωρίς υπέρβαση).
 * Σήμα «απαιτείται για {κανάλι}» από τις απαιτήσεις της οικογένειας· «ανά γλώσσα / ανά κανάλι» από τη θέση.
 *
 * @module components/catalog/products/editor/AttributeValueField
 */

import { ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleButton } from '@/components/ui/toggle-button';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { NO_VALUE_REASONS, type CatalogValueHolder, type NoValueReason } from '@/subapps/catalog/types/product';
import { writeHolderValue, writeNoValueReason } from '@/subapps/catalog/values/holder-edit';
import type { ResolvedValues } from '@/subapps/catalog/values/resolve-inherited';
import { readSlot } from '@/subapps/catalog/values/value-shape';
import { formatAttributeValue } from '@/subapps/catalog/values/value-text-codec';

import { issuesUnder, useIssueMessage } from '../../shared/CatalogIssues';
import { CHANNEL_KEYS } from '../../shared/catalog-labels';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import { AttributeValueEditor } from '../../values/AttributeValueEditor';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';

export interface AttributeValueFieldProps {
  readonly attributeId: string;
  readonly attribute: AttributeRecord;
  readonly required: boolean;
  readonly isAxis: boolean;
  readonly holder: CatalogValueHolder;
  /** Ο αποθηκευμένος φορέας — η άρση του λόγου απουσίας επαναφέρει τις τιμές του (ο διακόπτης αντιστρέφεται). */
  readonly saved: CatalogValueHolder;
  readonly resolved: ResolvedValues;
  /** `null` ⇒ ανήκει σε αυτό το επίπεδο· αλλιώς ο πρόγονος που την ορίζει. */
  readonly inheritedFrom: { readonly id: string; readonly name: string } | null;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly onHolder: (holder: CatalogValueHolder) => void;
  readonly onOpen: (id: string) => void;
}

const REASON_KEYS: Readonly<Record<NoValueReason, string>> = { notApplicable: 'values.noValue.notApplicable', unknown: 'values.noValue.unknown' };

function FieldHeader({ props, id }: { readonly props: AttributeValueFieldProps; readonly id: string }) {
  const { t, text } = useCatalogText();
  const { attribute } = props;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Label htmlFor={id}>{text(attribute.labels, attribute.code)}</Label>
      {props.required ? <Badge variant="outline">{t('values.requiredFor', { channel: t(CHANNEL_KEYS[props.scope.channel]) })}</Badge> : null}
      {attribute.localizable ? <span className="text-xs text-muted-foreground">{t('values.perLanguage')}</span> : null}
      {attribute.scopable ? <span className="text-xs text-muted-foreground">{t('values.perChannel')}</span> : null}
    </span>
  );
}

function InheritedValue({ props }: { readonly props: AttributeValueFieldProps }) {
  const { t } = useCatalogText();
  const from = props.inheritedFrom;
  const slots = props.resolved.values.get(props.attributeId)?.slots;
  const shown = formatAttributeValue(props.attribute, readSlot(slots, props.attribute, props.scope.channel, props.scope.locale), props.env.codec);
  if (!from) return null;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{shown || t('values.empty')}</span>
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => props.onOpen(from.id)}>
        {t('values.definedIn', { name: from.name })}<ArrowUpRight className="ml-0.5 h-3 w-3" aria-hidden />
      </Button>
    </span>
  );
}

function NoValueToggle({ props }: { readonly props: AttributeValueFieldProps }) {
  const { t } = useCatalogText();
  const current = props.holder.noValueReasons[props.attributeId] ?? null;
  if (props.isAxis) return null;
  return (
    <span className="inline-flex gap-1" role="group" aria-label={t('values.noValue.label')}>
      {NO_VALUE_REASONS.map((reason) => (
        <ToggleButton key={reason} size="sm" variant="ghost" pressed={current === reason} disabled={props.disabled}
          onClick={() => props.onHolder(writeNoValueReason(props.holder, props.attributeId, current === reason ? null : reason, props.saved))}>
          {t(REASON_KEYS[reason])}
        </ToggleButton>
      ))}
    </span>
  );
}

/**
 * Τα ευρήματα του πεδίου. Όπου ο διακομιστής λέει **ποιος** έχει την τιμή (`holderId` της κράτησης μοναδικότητας),
 * σύνδεσμος σε εκείνο το προϊόν (Akeneo: «already set on product X») — ADR-923 §5.10.5.
 */
function FieldIssueList({ id, issues, onOpen }: { readonly id: string; readonly issues: readonly CatalogIssue[]; readonly onOpen: (id: string) => void }) {
  const { t } = useCatalogText();
  const message = useIssueMessage();
  if (issues.length === 0) return null;
  return (
    <ul id={id} className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-destructive" role="alert">
      {issues.map((issue, index) => {
        const holderId = issue.params?.holderId;
        return (
          <li key={`${issue.path}-${issue.code}-${index}`}>
            {message(issue)}
            {typeof holderId === 'string' ? (
              <Button type="button" variant="link" size="sm" className="ml-1 h-auto p-0 text-xs" onClick={() => onOpen(holderId)}>
                {t('values.openHolder')}<ArrowUpRight className="ml-0.5 h-3 w-3" aria-hidden />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AttributeValueField(props: AttributeValueFieldProps) {
  const { t, text } = useCatalogText();
  const id = `value-${props.attributeId}`;
  const issueId = `${id}-issues`;
  const fieldIssues = [...issuesUnder(props.issues, `values.${props.attributeId}`), ...issuesUnder(props.issues, `noValueReasons.${props.attributeId}`)];
  const reason = props.holder.noValueReasons[props.attributeId] ?? null;
  const value = readSlot(props.holder.values[props.attributeId], props.attribute, props.scope.channel, props.scope.locale);
  return (
    <section className="grid gap-1.5 border-b border-border py-3">
      <FieldHeader props={props} id={id} />
      {props.inheritedFrom ? <InheritedValue props={props} /> : (
        <>
          {reason ? <p className="m-0 text-sm text-muted-foreground">{t(`values.noValue.${reason}Explained`)}</p> : (
            <AttributeValueEditor id={id} label={text(props.attribute.labels, props.attribute.code)} attribute={props.attribute} value={value} env={props.env}
              disabled={props.disabled || props.isAxis} invalid={fieldIssues.length > 0} describedBy={fieldIssues.length > 0 ? issueId : undefined}
              onChange={(next) => props.onHolder(writeHolderValue(props.holder, props.attributeId, props.attribute, props.scope.channel, props.scope.locale, next))} />
          )}
          {props.isAxis ? <p className="m-0 text-xs text-muted-foreground">{t('values.axisLocked')}</p> : null}
          <NoValueToggle props={props} />
        </>
      )}
      <FieldIssueList id={issueId} issues={fieldIssues} onOpen={props.onOpen} />
    </section>
  );
}
