'use client';

/**
 * Εμβέλεια σύμβασης-πλαισίου: Είδη (υλικά ∪ κατηγορίες ΑΤΟΕ) · Έργα — ADR-923 §5.11 «3γ», Βήμα 2.
 * Η σημασιολογία ζει στο `agreement-scope-form`· εδώ μόνο η παρουσίαση.
 */

import { useId } from 'react';
import { MultiCombobox } from '@/components/ui/multi-combobox';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AgreementScopeOptions } from '@/hooks/procurement/useAgreementScopeOptions';
import type { ScopeOption } from '@/lib/procurement/scope-options';
import { SCOPE_MODES, scopeFormIssues, type AgreementScopeForm, type ScopeMode } from './agreement-scope-form';

const NS = 'hub.frameworkAgreements.form.scope';

interface AgreementScopeFieldsProps {
  readonly value: AgreementScopeForm;
  readonly onChange: (next: AgreementScopeForm) => void;
  readonly options: AgreementScopeOptions;
}

interface ModeSwitchProps {
  readonly value: ScopeMode;
  readonly onChange: (mode: ScopeMode) => void;
  readonly labelledBy: string;
  readonly labels: Record<ScopeMode, string>;
}

function ModeSwitch({ value, onChange, labelledBy, labels }: ModeSwitchProps) {
  return (
    <SegmentedControl value={value} onValueChange={onChange} aria-labelledby={labelledBy}>
      {SCOPE_MODES.map((mode) => (
        <SegmentedControlItem key={mode} value={mode}>
          {labels[mode]}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

interface PickerProps {
  readonly label: string;
  readonly values: readonly string[];
  readonly onChange: (values: string[]) => void;
  readonly options: readonly ScopeOption[];
  readonly placeholder: string;
  readonly emptyMessage: string;
}

function ScopePicker({ label, values, onChange, options, placeholder, emptyMessage }: PickerProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <MultiCombobox
        value={[...values]}
        onChange={onChange}
        options={[...options]}
        placeholder={placeholder}
        emptyMessage={emptyMessage}
        ariaLabel={label}
      />
    </div>
  );
}

function ScopeError({ message }: { readonly message: string }) {
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function ItemsScope({ value, onChange, options }: AgreementScopeFieldsProps) {
  const { t } = useTranslation('procurement');
  const labelId = useId();
  const { itemsEmpty } = scopeFormIssues(value);
  return (
    <fieldset className="space-y-2">
      <legend id={labelId} className="text-sm font-medium">{t(`${NS}.items.label`)}</legend>
      <ModeSwitch
        value={value.itemsMode}
        onChange={(itemsMode) => onChange({ ...value, itemsMode })}
        labelledBy={labelId}
        labels={{ all: t(`${NS}.items.all`), selected: t(`${NS}.items.selected`) }}
      />
      {value.itemsMode === 'selected' && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ScopePicker
              label={t(`${NS}.items.materials`)}
              values={value.materialIds}
              onChange={(materialIds) => onChange({ ...value, materialIds })}
              options={options.materialOptions}
              placeholder={t(`${NS}.items.materialsPlaceholder`)}
              emptyMessage={t(`${NS}.items.noMaterials`)}
            />
            <ScopePicker
              label={t(`${NS}.items.categories`)}
              values={value.categoryCodes}
              onChange={(categoryCodes) => onChange({ ...value, categoryCodes })}
              options={options.categoryOptions}
              placeholder={t(`${NS}.items.categoriesPlaceholder`)}
              emptyMessage={t(`${NS}.items.noCategories`)}
            />
          </section>
          <p className="text-xs text-muted-foreground">{t(`${NS}.items.unionHint`)}</p>
          {itemsEmpty && <ScopeError message={t(`${NS}.items.empty`)} />}
        </>
      )}
    </fieldset>
  );
}

function ProjectsScope({ value, onChange, options }: AgreementScopeFieldsProps) {
  const { t } = useTranslation('procurement');
  const labelId = useId();
  const { projectsEmpty } = scopeFormIssues(value);
  return (
    <fieldset className="space-y-2">
      <legend id={labelId} className="text-sm font-medium">{t(`${NS}.projects.label`)}</legend>
      <ModeSwitch
        value={value.projectsMode}
        onChange={(projectsMode) => onChange({ ...value, projectsMode })}
        labelledBy={labelId}
        labels={{ all: t(`${NS}.projects.all`), selected: t(`${NS}.projects.selected`) }}
      />
      {value.projectsMode === 'selected' && (
        <>
          <ScopePicker
            label={t(`${NS}.projects.label`)}
            values={value.projectIds}
            onChange={(projectIds) => onChange({ ...value, projectIds })}
            options={options.projectOptions}
            placeholder={t(`${NS}.projects.placeholder`)}
            emptyMessage={t(`${NS}.projects.none`)}
          />
          {projectsEmpty && <ScopeError message={t(`${NS}.projects.empty`)} />}
        </>
      )}
    </fieldset>
  );
}

export function AgreementScopeFields(props: AgreementScopeFieldsProps) {
  const { t } = useTranslation('procurement');
  return (
    <section className="space-y-3 rounded-md border p-3" aria-label={t(`${NS}.title`)}>
      <header className="space-y-1">
        <h3 className="text-sm font-medium">{t(`${NS}.title`)}</h3>
        <p className="text-xs text-muted-foreground">{t(`${NS}.hint`)}</p>
      </header>
      <ItemsScope {...props} />
      <ProjectsScope {...props} />
    </section>
  );
}
