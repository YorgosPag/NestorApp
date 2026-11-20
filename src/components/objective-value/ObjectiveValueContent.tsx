'use client';

/**
 * **Ο δημόσιος υπολογιστής αντικειμενικής αξίας** (ADR-898 Φ2) — θέση → ακίνητο → ό,τι μετρά → αποτέλεσμα.
 *
 * 🔑 **Ένας κάτοχος της κατάστασης**: το πρόχειρο (`ObjectiveValueDraft`) και η θέση ζουν εδώ· το αποτέλεσμα και οι
 * ερωτήσεις είναι **παράγωγα** (`useMemo` πάνω στη μηχανή), ποτέ δεύτερη αποθηκευμένη αλήθεια που θα μπορούσε να
 * μείνει πίσω. Κάθε πλήκτρο ξαναϋπολογίζει — η μηχανή είναι καθαρή και φθηνή.
 *
 * 🔑 **Σήμερα = ημέρα αγοράς Αθήνας** (`marketDayOf`), η ημερομηνία αποτίμησης για την παλαιότητα.
 *
 * 🔑 **ΣΕ από την πηγή ⇒ καμία ερώτηση** (ADR-898 Φ5): όταν τα δεδομένα ζωνών δίνουν αριθμό για την επιλεγμένη τιμή
 * (ζώνη ή δηλωμένο μέτωπο), μπαίνει αυτός και η ερώτηση φεύγει — το αποτέλεσμα λέει από πού ήρθε. Πίνακας PDF ή κενό ⇒
 * η ερώτηση μένει (με σύνδεσμο στον πίνακα).
 *
 * 🔑 **Προέλευση ανά είσοδο** (ADR-947 Φ1β): κι αυτή **παράγωγο** — πρόχειρο ↔ ό,τι εφάρμοσε η προσυμπλήρωση ↔ θέση
 * (`deriveInputProvenance`). Τη μοιράζει ΕΝΑ πλαίσιο (`ObjectiveValueProvenanceProvider`) σε κάθε σήμα.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';
import { draftToInput, INITIAL_DRAFT, relevantQuestions, type ObjectiveValueDraft, type UpdateDraft } from '@/lib/objective-value/objective-value-draft';
import { deriveInputProvenance } from '@/lib/objective-value/objective-value-input-provenance';
import { objectiveValueReturnHref, type ObjectiveValueReturn } from '@/lib/objective-value/objective-value-return';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';
import type { ObjectiveValueResult as EngineResult } from '@/lib/objective-value/objective-value-types';

import { ObjectiveValueAdjustments } from './ObjectiveValueAdjustments';
import { ObjectiveValueFaq } from './ObjectiveValueFaq';
import { ObjectiveValueLocation } from './ObjectiveValueLocation';
import { ObjectiveValueProperty } from './ObjectiveValueProperty';
import {
  ObjectiveValueOverrideSummary,
  ObjectiveValueProvenanceBadge,
  ObjectiveValueProvenanceProvider,
  ObjectiveValueQuestionProvenance,
} from './ObjectiveValueProvenanceBadge';
import { ObjectiveValueQuestions } from './ObjectiveValueQuestions';
import { ObjectiveValueResult } from './ObjectiveValueResult';
import { useObjectiveValueLocation, type ObjectiveValueLocationState } from './useObjectiveValueLocation';
import { useObjectiveValuePrefill } from './useObjectiveValuePrefill';

// 🔴 ADR-744 §18 — το route slice φτάνει στον φυλλομετρητή ΜΟΝΟ από client component (όχι από το `page.tsx`).
import routeSlice from '@/i18n/generated/routes/ergaleia__antikeimeniki-axia.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'objective-value';

/**
 * **«← Πίσω στο ακίνητό σας»** (ADR-947 Φ1β) — όταν ο υπολογιστής ανοίγει από το ακίνητο του ιδιοκτήτη. Η διαδρομή
 * χτίζεται από τον βοηθό διαδρομών, ποτέ από τη διεύθυνση (`objective-value-return.ts`): μόνο μέσα στην εφαρμογή.
 */
function BackLink({ back }: { readonly back: ObjectiveValueReturn | null }) {
  const { t } = useTranslation([NS]);
  if (back === null) return null;
  return (
    <nav aria-label={t(`${NS}:page.backLabel`)}>
      <Link href={objectiveValueReturnHref(back)} className={`inline-flex items-center gap-1 text-sm ${VISIBLE_LINK_CLASS}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t(`${NS}:page.backToProperty`)}
      </Link>
    </nav>
  );
}

function PageHeader() {
  const { t } = useTranslation([NS]);
  return (
    <header className="flex flex-col gap-2">
      <h1 className="m-0 text-2xl font-semibold text-foreground">{t(`${NS}:page.title`)}</h1>
      <p className="m-0 text-base text-foreground">{t(`${NS}:page.intro`)}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:page.scope`)}</p>
    </header>
  );
}

/**
 * **Ό,τι βλέπει η μηχανή** — το πρόχειρο με την τιμή ζώνης της θέσης και, όταν η πηγή τον δίνει, τον ΣΕ της (ADR-898 Φ5).
 * Παράγωγα μόνο: αποτέλεσμα, ερωτήσεις, και ο ΣΕ της πηγής **όταν μετρά** (για τη γραμμή προέλευσης).
 */
function useCalculatorEvaluation(draft: ObjectiveValueDraft, location: ObjectiveValueLocationState, today: string) {
  const { commerciality, zonePrice } = location;
  const sourceFactor = commerciality.kind === 'factor' ? commerciality.value : null;
  const effective = useMemo<ObjectiveValueDraft>(
    () => ({
      ...draft,
      zonePrice,
      ...(sourceFactor === null ? {} : { commercialityFactor: sourceFactor, commercialityAssumed: false }),
    }),
    [draft, zonePrice, sourceFactor],
  );
  const result = useMemo(() => computeObjectiveValue(draftToInput(effective, today)), [effective, today]);
  const asked = useMemo(() => relevantQuestions(effective, today), [effective, today]);
  const questions = useMemo(
    () => (sourceFactor === null ? asked : asked.filter((question) => question !== 'commercialityFactor')),
    [asked, sourceFactor],
  );
  return {
    result,
    questions,
    commercialityAssumed: effective.commercialityAssumed && questions.includes('commercialityFactor'),
    // Η γραμμή προέλευσης μόνο όταν ο ΣΕ ΜΕΤΡΑ για αυτό το ακίνητο (π.χ. όχι πάνω από τον Γ' όροφο).
    sourcedFactor: sourceFactor !== null && asked.includes('commercialityFactor') ? sourceFactor : null,
  };
}

interface ProvenanceArgs {
  readonly draft: ObjectiveValueDraft;
  readonly prefill: Partial<ObjectiveValueDraft> | null;
  readonly location: ObjectiveValueLocationState;
  readonly result: EngineResult;
  readonly update: UpdateDraft;
  readonly sourcedFactor: number | null;
}

/** Η προέλευση όλων των εισόδων + ό,τι χρειάζεται το σήμα — ένα αντικείμενο για το πλαίσιο, σταθερό ανάμεσα σε αποδόσεις. */
function useCalculatorProvenance({ draft, prefill, location, result, update, sourcedFactor }: ProvenanceArgs) {
  const { lookup, zonePrice } = location;
  const zonePriceFromSource = lookup.kind === 'answered' && lookup.verdict.kind === 'ready';
  const provenance = useMemo(
    () =>
      deriveInputProvenance({
        draft,
        prefill,
        location: { zonePrice, zonePriceFromSource, sourcedCommercialityFactor: sourcedFactor },
      }),
    [draft, prefill, zonePrice, zonePriceFromSource, sourcedFactor],
  );
  return useMemo(
    () => ({ provenance, result, update, sourcedCommercialityFactor: sourcedFactor }),
    [provenance, result, update, sourcedFactor],
  );
}

export function ObjectiveValueContent() {
  const [draft, setDraft] = useState<ObjectiveValueDraft>(INITIAL_DRAFT);
  const update = useCallback((patch: Partial<ObjectiveValueDraft>) => setDraft((current) => ({ ...current, ...patch })), []);
  const location = useObjectiveValueLocation();
  const today = useMemo(() => marketDayOf(Date.now()), []);
  // ADR-898 Φ3 — από αγγελία: ό,τι ξέρει ήδη η αγγελία, ώστε να μένουν μόνο οι ερωτήσεις που άφησε ανοιχτές.
  const prefill = useObjectiveValuePrefill(update, location.pick);
  // Η τιμή ζώνης ανήκει στη θέση (ζώνη · δηλωμένο μέτωπο · χειροκίνητη)· το πρόχειρο την παίρνει τη στιγμή του υπολογισμού.
  const { result, questions, commercialityAssumed, sourcedFactor } = useCalculatorEvaluation(draft, location, today);
  const provenance = useCalculatorProvenance({ draft, prefill: prefill?.draft ?? null, location, result, update, sourcedFactor });

  // `busy={false}` ΡΗΤΑ (ADR-797 §Φ.Ρ.3): η σελίδα δεν φορτώνει αρχικά δεδομένα (η τιμή ζώνης ζητείται όταν ο
  // επισκέπτης δώσει θέση) — αλλά είναι στο εύρος του CHECK 3.94, που ζητά `aria-busy="false"` ως μάρτυρα ετοιμότητας.
  return (
    <ObjectiveValueProvenanceProvider value={provenance}>
      <ShellSurface as="main" measure="wide" busy={false} className="gap-y-6 py-4">
        <BackLink back={prefill?.back ?? null} />
        <PageHeader />
        {/* Πλέγμα διάταξης μόνο (καμία σημασιολογία): οι ενότητες με επικεφαλίδα είναι τα βήματα μέσα του. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <ObjectiveValueLocation location={location} />
            <ObjectiveValueProperty draft={draft} update={update} />
            <ObjectiveValueQuestions
              questions={questions}
              draft={draft}
              update={update}
              today={today}
              commerciality={location.commerciality}
              renderProvenance={(question) => <ObjectiveValueQuestionProvenance question={question} />}
            />
            <ObjectiveValueAdjustments draft={draft} update={update} />
          </div>
          <aside className="lg:sticky lg:top-4">
            <ObjectiveValueResult
              result={result}
              commercialityAssumed={commercialityAssumed}
              sourcedCommercialityFactor={sourcedFactor}
              commercialityProvenance={<ObjectiveValueProvenanceBadge input="commercialityFactor" />}
              overrides={<ObjectiveValueOverrideSummary />}
            />
          </aside>
        </div>
        <ObjectiveValueFaq />
      </ShellSurface>
    </ObjectiveValueProvenanceProvider>
  );
}
