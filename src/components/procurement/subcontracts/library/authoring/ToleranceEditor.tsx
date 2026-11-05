'use client';

/**
 * **Οι ζώνες ανοχής μιας παραμέτρου** — το playbook της ρήτρας (ADR-928 §5.2.1 · §5.22).
 *
 * 🔑 Τέσσερα όρια με ανθρώπινες λέξεις (ελάχιστο επιτρεπτό · ελεύθερα από · ελεύθερα έως · μέγιστο επιτρεπτό), ο
 *    **χάρακας** (απαγορεύεται | θέλει έγκριση | ελεύθερα | ★) και από κάτω η **ίδια** φράση που θα διαβάσει ο εγκρίνων
 *    (`tolerance-text`). Ο συντάκτης βλέπει το αποτέλεσμα, όχι τέσσερα κουτιά.
 * 🔑 Οι επιλογές ζώνης εξαρτώνται από το είδος, όπως στον κριτή: εύρος μόνο για ποσοστό/ποσό/ημέρες, επιλογές μόνο για
 *    `enum`. Τα πεδία είναι τα ίδια ακέραιου μοντέλου (`PercentField` · `MoneyField` · `CountField`) — καμία `* 100` εδώ.
 * 🔑 Ο χάρακας είναι SVG με χαρακτηριστικά (όχι inline styles, N.3)· οι ζώνες έχουν **και** λέξη (ADR-771).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { EnumSelect } from '@/components/ui/enum-select';
import { CountField, MoneyField, PercentField, type ScaledFieldProps } from '@/components/ui/numeric-field';
import { documentLocaleOf } from '@/subapps/procurement/subcontracts/document/document-locale';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { numericValueOf } from '@/subapps/procurement/subcontracts/clauses/tolerance-verdict';
import { toleranceTextOf } from '@/subapps/procurement/subcontracts/library/tolerance-text';
import { toleranceRulerOf, type RulerZone } from '@/subapps/procurement/subcontracts/library/tolerance-ruler';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import type { ClauseParameterDefinition, ClauseParameterTolerance, NumericTolerance, OptionTolerance } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import { EditorField } from '../../editor/EditorField';
import { FieldIssues } from '../../editor/FieldIssues';
import { useToleranceWords } from '../ClauseText';

type ToleranceMode = 'none' | 'fixed' | 'numeric' | 'options';
type OptionZone = 'free' | 'approval' | 'forbidden';
const OPTION_ZONES: readonly OptionZone[] = ['free', 'approval', 'forbidden'];

interface ToleranceEditorProps {
  readonly id: string;
  readonly definition: ClauseParameterDefinition;
  readonly onChange: (next: ClauseParameterDefinition) => void;
  readonly issues: readonly SubcontractIssue[];
}

function modesOf(definition: ClauseParameterDefinition): readonly ToleranceMode[] {
  if (numericValueOf(definition.preferred) !== null) return ['none', 'fixed', 'numeric'];
  return definition.kind === 'enum' ? ['none', 'fixed', 'options'] : ['none', 'fixed'];
}

/** Νέα ζώνη ενός τρόπου, με αφετηρία την προτιμώμενη (που οφείλει να είναι ελεύθερη). */
function toleranceOf(mode: ToleranceMode, definition: ClauseParameterDefinition): ClauseParameterTolerance | null {
  if (mode === 'none') return null;
  if (mode === 'fixed') return { kind: 'fixed' };
  if (mode === 'options') return { kind: 'options', acceptable: definition.preferred.kind === 'enum' ? [definition.preferred.value] : [], forbidden: [] };
  const preferred = numericValueOf(definition.preferred);
  return { kind: 'numeric', acceptable: { min: preferred, max: preferred }, walkAway: { min: null, max: null } };
}

const RULER_FILL: Readonly<Record<RulerZone, string>> = {
  forbidden: 'fill-destructive/40',
  approval: 'fill-[hsl(var(--bg-warning))]',
  free: 'fill-[hsl(var(--bg-success))]',
};

function ToleranceRulerView({ definition }: { readonly definition: ClauseParameterDefinition }) {
  const { t } = useTranslation('procurement');
  const ruler = toleranceRulerOf(definition);
  if (!ruler) return null;
  return (
    <figure className="m-0 space-y-1">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-4 w-full rounded" role="img" aria-label={t('subcontracts.library.authoring.tolerance.ruler')}>
        {ruler.segments.map((segment, index) => (
          <rect key={index} x={segment.from * 100} y={0} width={(segment.to - segment.from) * 100} height={10} className={RULER_FILL[segment.zone]} />
        ))}
        {ruler.preferredAt !== null && <rect x={ruler.preferredAt * 100 - 0.6} y={0} width={1.2} height={10} className="fill-foreground" />}
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(['forbidden', 'approval', 'free'] as const).map((zone) => <span key={zone}>{t(`subcontracts.library.authoring.tolerance.zones.${zone}`)}</span>)}
        {ruler.preferredAt !== null && <span>★ {t('subcontracts.library.parameters.preferred')}</span>}
      </figcaption>
    </figure>
  );
}

type Bound = 'walkMin' | 'freeMin' | 'freeMax' | 'walkMax';
const BOUNDS: readonly Bound[] = ['walkMin', 'freeMin', 'freeMax', 'walkMax'];

function boundValue(tolerance: NumericTolerance, bound: Bound): number | null {
  if (bound === 'walkMin') return tolerance.walkAway.min;
  if (bound === 'freeMin') return tolerance.acceptable.min;
  return bound === 'freeMax' ? tolerance.acceptable.max : tolerance.walkAway.max;
}

function withBound(tolerance: NumericTolerance, bound: Bound, value: number | null): NumericTolerance {
  if (bound === 'walkMin') return { ...tolerance, walkAway: { ...tolerance.walkAway, min: value } };
  if (bound === 'freeMin') return { ...tolerance, acceptable: { ...tolerance.acceptable, min: value } };
  if (bound === 'freeMax') return { ...tolerance, acceptable: { ...tolerance.acceptable, max: value } };
  return { ...tolerance, walkAway: { ...tolerance.walkAway, max: value } };
}

function BoundField({ definition, ...props }: ScaledFieldProps & { readonly definition: ClauseParameterDefinition }) {
  if (definition.kind === 'percent') return <PercentField {...props} />;
  if (definition.kind === 'money') return <MoneyField {...props} />;
  return <CountField {...props} />;
}

function NumericBounds({ id, definition, tolerance, onChange }: { readonly id: string; readonly definition: ClauseParameterDefinition; readonly tolerance: NumericTolerance; readonly onChange: (next: NumericTolerance) => void }) {
  const { t } = useTranslation('procurement');
  return (
    <span className="grid grid-cols-[repeat(auto-fill,minmax(min(9rem,100%),1fr))] gap-3">
      {BOUNDS.map((bound) => (
        <EditorField key={bound} id={`${id}-${bound}`} label={t(`subcontracts.library.authoring.tolerance.bounds.${bound}`)}>
          <BoundField id={`${id}-${bound}`} definition={definition} nullable value={boundValue(tolerance, bound)} onValueChange={(value) => onChange(withBound(tolerance, bound, value))} placeholder={t('subcontracts.library.authoring.tolerance.noLimit')} />
        </EditorField>
      ))}
    </span>
  );
}

const zoneOfOption = (tolerance: OptionTolerance, key: string): OptionZone =>
  tolerance.acceptable.includes(key) ? 'free' : tolerance.forbidden.includes(key) ? 'forbidden' : 'approval';

function withOptionZone(tolerance: OptionTolerance, key: string, zone: OptionZone): OptionTolerance {
  const acceptable = tolerance.acceptable.filter((candidate) => candidate !== key);
  const forbidden = tolerance.forbidden.filter((candidate) => candidate !== key);
  return { kind: 'options', acceptable: zone === 'free' ? [...acceptable, key] : acceptable, forbidden: zone === 'forbidden' ? [...forbidden, key] : forbidden };
}

function OptionZones({ id, definition, tolerance, onChange }: { readonly id: string; readonly definition: ClauseParameterDefinition; readonly tolerance: OptionTolerance; readonly onChange: (next: OptionTolerance) => void }) {
  const { t } = useTranslation('procurement');
  return (
    <ul className="m-0 list-none space-y-2 p-0">
      {(definition.options ?? []).map((option, index) => (
        <li key={option.key} className="grid grid-cols-[1fr_minmax(8rem,12rem)] items-center gap-2">
          <label htmlFor={`${id}-option-${index}`} className="text-sm">{localizedIn(option.label, 'el') || option.key}</label>
          <EnumSelect id={`${id}-option-${index}`} value={zoneOfOption(tolerance, option.key)} values={OPTION_ZONES} onValueChange={(zone) => onChange(withOptionZone(tolerance, option.key, zone))} getLabel={(zone) => t(`subcontracts.library.authoring.tolerance.zones.${zone}`)} />
        </li>
      ))}
    </ul>
  );
}

export function ToleranceEditor({ id, definition, onChange, issues }: ToleranceEditorProps) {
  const { t, i18n } = useTranslation('procurement');
  const words = useToleranceWords();
  const tolerance = definition.tolerance;
  const mode: ToleranceMode = tolerance === null ? 'none' : tolerance.kind;
  const set = (next: ClauseParameterTolerance | null) => onChange({ ...definition, tolerance: next });
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t('subcontracts.library.authoring.tolerance.title')}</legend>
      <EditorField id={`${id}-mode`} label={t('subcontracts.library.authoring.tolerance.mode')}>
        <EnumSelect id={`${id}-mode`} value={mode} values={modesOf(definition)} onValueChange={(next) => set(toleranceOf(next, definition))} getLabel={(value) => t(`subcontracts.library.authoring.tolerance.modes.${value}`)} />
      </EditorField>
      {tolerance?.kind === 'numeric' && <NumericBounds id={id} definition={definition} tolerance={tolerance} onChange={set} />}
      {tolerance?.kind === 'options' && <OptionZones id={id} definition={definition} tolerance={tolerance} onChange={set} />}
      <ToleranceRulerView definition={definition} />
      <p className="m-0 text-sm">{words(toleranceTextOf(definition, documentLocaleOf(resolveHumanLanguage(i18n.language))))}</p>
      <FieldIssues issues={issues} />
    </fieldset>
  );
}
