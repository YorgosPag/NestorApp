'use client';

/**
 * **Το σήμα προέλευσης μιας εισόδου** (ADR-947 Δ2 · Φ1β) — «από πού ήρθε αυτή η τιμή;» με ένα κλικ: η πηγή, το
 * άρθρο του νόμου όπου μετρά, και για παράκαμψη η αρχική τιμή με **επαναφορά**.
 *
 * 🔑 **Ένα σύστημα, μία διαδρομή**: η προέλευση έρχεται από το `deriveInputProvenance` μέσω πλαισίου
 * ({@link ObjectiveValueProvenanceProvider}) που στήνει **μόνο** ο υπολογιστής. Οι κοινές ερωτήσεις
 * (`ObjectiveValueQuestion`) αποδίδονται και στην οθόνη «Βελτίωσε την αγγελία σου» και στον πίνακα κτιρίου — εκεί
 * δεν υπάρχει πλαίσιο, άρα **κανένα** σήμα, χωρίς prop που θα έπρεπε να θυμάται κάθε καταναλωτής.
 *
 * 🔑 **Το σκέλος διακρίνεται χωρίς χρώμα** (CHECK 3.41): εικονίδιο **και** λέξη σε κάθε σήμα.
 *
 * 🔑 **Το άρθρο έρχεται από τη μηχανή** (`lawRefOf` → `factors[].ref`), ποτέ από δεύτερη λίστα — και όταν ο
 * συντελεστής βγήκε 1, το σήμα το λέει αντί να σιωπά.
 */

import React, { createContext, useContext } from 'react';
import { Database, Home, PenLine, Scale, Undo2 } from 'lucide-react';

import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate, formatNumber } from '@/lib/intl-formatting';
import { frontageLabel } from '@/lib/listings/frontage-label';
import type { ConditionalQuestion, UpdateDraft } from '@/lib/objective-value/objective-value-draft';
import {
  lawRefOf,
  type CalculatorAssumption,
  type ObjectiveValueInputKey,
  type ObjectiveValueInputSource,
  type ObjectiveValueInputValue,
  type ObjectiveValueProvenance,
  type ObjectiveValueScalarInput,
} from '@/lib/objective-value/objective-value-input-provenance';
import { formatCommercialityFactor } from '@/lib/objective-value/objective-value-zone';
import type { ObjectiveValueResult } from '@/lib/objective-value/objective-value-types';

const NS = 'objective-value';
const P = `${NS}:provenance`;

interface ProvenanceContextValue {
  readonly provenance: ObjectiveValueProvenance;
  readonly result: ObjectiveValueResult;
  readonly update: UpdateDraft;
  /** Ο ΣΕ της πηγής όταν μετρά — για το κείμενο «ΣΕ {factor}, από τα δεδομένα ζωνών». */
  readonly sourcedCommercialityFactor: number | null;
}

const ProvenanceContext = createContext<ProvenanceContextValue | null>(null);

/** Το στήνει **μόνο** ο υπολογιστής (`ObjectiveValueContent`). */
export const ObjectiveValueProvenanceProvider = ProvenanceContext.Provider;

/** Το πλαίσιο, ή `null` εκτός υπολογιστή. */
function useObjectiveValueProvenance(): ProvenanceContextValue | null {
  return useContext(ProvenanceContext);
}

/** Ποια είσοδος — τα επίπεδα της κατοικίας με δείκτη. */
type ProvenanceInputRef =
  | { readonly input: ObjectiveValueScalarInput | 'zonePrice' | 'commercialityFactor'; readonly level?: undefined }
  | { readonly input: 'levelFloor' | 'levelArea'; readonly level: number };

function sourceOf(provenance: ObjectiveValueProvenance, ref: ProvenanceInputRef): ObjectiveValueInputSource | null {
  switch (ref.input) {
    case 'zonePrice':
      return provenance.zonePrice;
    case 'commercialityFactor':
      return provenance.commercialityFactor;
    case 'levelFloor':
      return provenance.levels[ref.level]?.floor ?? null;
    case 'levelArea':
      return provenance.levels[ref.level]?.area ?? null;
    default:
      return provenance.fields[ref.input];
  }
}

const isOverride = (source: ObjectiveValueInputSource): boolean => source.kind === 'user' && source.overrides !== null;

function variantOf(source: ObjectiveValueInputSource): BadgeVariantProps['variant'] {
  if (isOverride(source)) return 'warning';
  return source.kind === 'property' || source.kind === 'openData' ? 'muted' : 'outline';
}

function SourceIcon({ source }: { readonly source: ObjectiveValueInputSource }) {
  const props = { className: 'mr-1 h-3 w-3', 'aria-hidden': true } as const;
  switch (source.kind) {
    case 'property':
      return <Home {...props} />;
    case 'openData':
      return <Database {...props} />;
    case 'assumption':
      return <Scale {...props} />;
    case 'user':
      return <PenLine {...props} />;
  }
}

function useBadgeLabel(): (source: ObjectiveValueInputSource) => string {
  const { t } = useTranslation([NS]);
  return (source) => {
    switch (source.kind) {
      case 'property':
        return t(`${P}.badge.property`);
      case 'openData':
        return t(`${P}.badge.openData`);
      case 'assumption':
        return t(`${P}.badge.assumption`);
      case 'user':
        return source.overrides === null ? t(`${P}.badge.user`) : t(`${P}.badge.override`);
    }
  };
}

/** Το κείμενο κάθε υπόθεσης — τα **υπάρχοντα** κλειδιά της αγγελίας και του κτιρίου, ποτέ δεύτερη διατύπωση. */
function useAssumptionText(): (assumption: CalculatorAssumption) => string {
  const { t } = useTranslation([NS]);
  return (assumption) => {
    switch (assumption) {
      case 'areaWithoutCommon':
        return t(`${NS}:listing.assumptions.areaWithoutCommon`);
      case 'parkingDefaultArea':
        return t(`${NS}:building.assumptions.parkingDefaultArea`);
      case 'commercialityUnknown':
        return t(`${NS}:questions.commercialityFactor.assumed`);
    }
  };
}

/** Η αρχική τιμή στη γλώσσα της οθόνης — ο καλών δίνει το λεξιλόγιο του πεδίου (όροφος, είδος, πρόσοψη, ημερομηνία). */
type FormatOriginal = (value: ObjectiveValueInputValue) => string;

function useDefaultFormat(): FormatOriginal {
  const { t } = useTranslation([NS]);
  return (value) => {
    if (typeof value === 'boolean') return value ? t(`${NS}:questions.yes`) : t(`${NS}:questions.no`);
    return typeof value === 'number' ? formatNumber(value) : value;
  };
}

interface DetailProps {
  readonly source: ObjectiveValueInputSource;
  readonly input: ObjectiveValueInputKey;
  readonly context: ProvenanceContextValue;
  readonly formatOriginal: FormatOriginal;
}

/** Από πού ήρθε — μία πρόταση ανά σκέλος, και η απόδοση της άδειας όταν η πηγή είναι ανοιχτά δεδομένα. */
function SourceDetail({ source, input, context, formatOriginal }: DetailProps) {
  const { t } = useTranslation([NS]);
  const assumptionText = useAssumptionText();
  switch (source.kind) {
    case 'property':
      return <p className="m-0">{t(`${P}.detail.property`)}</p>;
    case 'assumption':
      return <p className="m-0">{assumptionText(source.assumption)}</p>;
    case 'user':
      return source.overrides === null ? (
        <p className="m-0">{t(`${P}.detail.user`)}</p>
      ) : (
        <p className="m-0">{t(`${P}.detail.override`, { original: formatOriginal(source.overrides.original) })}</p>
      );
    case 'openData': {
      const factor = context.sourcedCommercialityFactor;
      const text =
        input === 'commercialityFactor' && factor !== null
          ? t(`${NS}:questions.commercialityFactor.fromSource`, { factor: formatCommercialityFactor(factor) })
          : t(`${P}.detail.zonePrice`);
      return (
        <>
          <p className="m-0">{text}</p>
          <OpenDataAttribution source={source.source} />
        </>
      );
    }
  }
}

/** Πού μετρά στον νόμο — από την ανάλυση της μηχανής. */
function LawDetail({ input, level, result }: { readonly input: ObjectiveValueInputKey; readonly level?: number; readonly result: ObjectiveValueResult }) {
  const { t } = useTranslation([NS]);
  const law = lawRefOf(input, result, level);
  if (law.kind === 'none') return null;
  if (law.kind === 'neutral') return <p className="m-0 text-muted-foreground">{t(`${P}.law.neutral`)}</p>;
  const factor = formatNumber(law.factor, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return <p className="m-0 text-muted-foreground">{t(`${P}.law.applied`, { ref: law.ref, factor })}</p>;
}

function RevertButton({ source, update }: { readonly source: ObjectiveValueInputSource; readonly update: UpdateDraft }) {
  const { t } = useTranslation([NS]);
  if (source.kind !== 'user' || source.overrides === null) return null;
  const { revert } = source.overrides;
  return (
    <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => update(revert)}>
      <Undo2 className="mr-1 h-4 w-4" aria-hidden />
      {t(`${P}.detail.revert`)}
    </Button>
  );
}

type BadgeProps = ProvenanceInputRef & { readonly formatOriginal?: FormatOriginal };

/** Το σήμα — τίποτα εκτός υπολογιστή ή για είσοδο χωρίς προέλευση. */
export function ObjectiveValueProvenanceBadge({ formatOriginal, ...ref }: BadgeProps) {
  const context = useObjectiveValueProvenance();
  const label = useBadgeLabel();
  const defaultFormat = useDefaultFormat();
  const source = context === null ? null : sourceOf(context.provenance, ref);
  if (context === null || source === null) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Badge variant={variantOf(source)}>
            <SourceIcon source={source} />
            {label(source)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-w-[calc(100vw-2rem)] flex-col gap-2 text-sm">
        <SourceDetail source={source} input={ref.input} context={context} formatOriginal={formatOriginal ?? defaultFormat} />
        <LawDetail input={ref.input} level={ref.level} result={context.result} />
        <RevertButton source={source} update={context.update} />
      </PopoverContent>
    </Popover>
  );
}

/** Ποια είσοδος απαντά κάθε ερώτηση — ολικός πίνακας· `null` = καμία προέλευση πέρα από τον άνθρωπο. */
const QUESTION_INPUT: Readonly<Record<ConditionalQuestion, ObjectiveValueInputKey | null>> = {
  frontage: 'frontage',
  hasCentralHeating: 'hasCentralHeating',
  hasElevator: 'hasElevator',
  commercialityFactor: 'commercialityFactor',
  ageYears: 'permitDate',
  plotUtilisation: null,
};

/** Το σήμα μιας ερώτησης, με την αρχική τιμή στο λεξιλόγιο της ερώτησης (πρόσοψη · ημερομηνία). */
export function ObjectiveValueQuestionProvenance({ question }: { readonly question: ConditionalQuestion }) {
  const { t } = useTranslation([NS, 'properties-enums']);
  const input = QUESTION_INPUT[question];
  switch (input) {
    case 'frontage':
      return <ObjectiveValueProvenanceBadge input="frontage" formatOriginal={(value) => frontageLabel(t, String(value))} />;
    case 'permitDate':
      return <ObjectiveValueProvenanceBadge input="permitDate" formatOriginal={(value) => formatCalendarDate(String(value))} />;
    case 'hasCentralHeating':
    case 'hasElevator':
    case 'commercialityFactor':
      return <ObjectiveValueProvenanceBadge input={input} />;
    default:
      return null;
  }
}

/** «Αλλάξατε N στοιχεία του ακινήτου · Επαναφορά όλων» — μόνο όταν υπάρχει έστω μία παράκαμψη (Sketch · Webflow). */
export function ObjectiveValueOverrideSummary() {
  const { t } = useTranslation([NS]);
  const context = useObjectiveValueProvenance();
  if (context === null || context.provenance.revertAll === null) return null;
  const { revertAll, overrideCount } = context.provenance;
  return (
    <>
      <p className="m-0 text-sm text-foreground">{t(`${P}.summary.changed`, { count: overrideCount })}</p>
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => context.update(revertAll)}>
        <Undo2 className="mr-1 h-4 w-4" aria-hidden />
        {t(`${P}.summary.revertAll`)}
      </Button>
    </>
  );
}
