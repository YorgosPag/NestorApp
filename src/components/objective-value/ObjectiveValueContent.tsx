'use client';

/**
 * **Ο δημόσιος υπολογιστής αντικειμενικής αξίας** (ADR-898 Φ2) — θέση → ακίνητο → ό,τι μετρά → αποτέλεσμα.
 *
 * 🔑 **Ένας κάτοχος της κατάστασης**: το πρόχειρο (`ObjectiveValueDraft`) και η θέση ζουν εδώ· το αποτέλεσμα και οι
 * ερωτήσεις είναι **παράγωγα** (`useMemo` πάνω στη μηχανή), ποτέ δεύτερη αποθηκευμένη αλήθεια που θα μπορούσε να
 * μείνει πίσω. Κάθε πλήκτρο ξαναϋπολογίζει — η μηχανή είναι καθαρή και φθηνή.
 *
 * 🔑 **Σήμερα = ημέρα αγοράς Αθήνας** (`marketDayOf`), η ημερομηνία αποτίμησης για την παλαιότητα.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { ShellSurface } from '@/core/containers/ShellSurface';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { marketDayOf } from '@/lib/listings/listing-stats';
import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';
import { draftToInput, INITIAL_DRAFT, relevantQuestions, type ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';

import { ObjectiveValueAdjustments } from './ObjectiveValueAdjustments';
import { ObjectiveValueFaq } from './ObjectiveValueFaq';
import { ObjectiveValueLocation } from './ObjectiveValueLocation';
import { ObjectiveValueProperty } from './ObjectiveValueProperty';
import { ObjectiveValueQuestions } from './ObjectiveValueQuestions';
import { ObjectiveValueResult } from './ObjectiveValueResult';
import { useObjectiveValueLocation } from './useObjectiveValueLocation';
import { useObjectiveValuePrefill } from './useObjectiveValuePrefill';

// 🔴 ADR-744 §18 — το route slice φτάνει στον φυλλομετρητή ΜΟΝΟ από client component (όχι από το `page.tsx`).
import routeSlice from '@/i18n/generated/routes/ergaleia__antikeimeniki-axia.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NS = 'objective-value';

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

export function ObjectiveValueContent() {
  const [draft, setDraft] = useState<ObjectiveValueDraft>(INITIAL_DRAFT);
  const update = useCallback((patch: Partial<ObjectiveValueDraft>) => setDraft((current) => ({ ...current, ...patch })), []);
  const location = useObjectiveValueLocation();
  const today = useMemo(() => marketDayOf(Date.now()), []);
  // ADR-898 Φ3 — από αγγελία: ό,τι ξέρει ήδη η αγγελία, ώστε να μένουν μόνο οι ερωτήσεις που άφησε ανοιχτές.
  useObjectiveValuePrefill(update, location.pick);

  // Η τιμή ζώνης ανήκει στη θέση (ζώνη · δηλωμένο μέτωπο · χειροκίνητη)· το πρόχειρο την παίρνει τη στιγμή του υπολογισμού.
  const effective = useMemo(() => ({ ...draft, zonePrice: location.zonePrice }), [draft, location.zonePrice]);
  const result = useMemo(() => computeObjectiveValue(draftToInput(effective, today)), [effective, today]);
  const questions = useMemo(() => relevantQuestions(effective, today), [effective, today]);

  return (
    <ShellSurface as="main" measure="wide" className="gap-y-6 py-4">
      <PageHeader />
      {/* Πλέγμα διάταξης μόνο (καμία σημασιολογία): οι ενότητες με επικεφαλίδα είναι τα βήματα μέσα του. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <ObjectiveValueLocation location={location} />
          <ObjectiveValueProperty draft={draft} update={update} />
          <ObjectiveValueQuestions questions={questions} draft={draft} update={update} today={today} />
          <ObjectiveValueAdjustments draft={draft} update={update} />
        </div>
        <aside className="lg:sticky lg:top-4">
          <ObjectiveValueResult
            result={result}
            commercialityAssumed={draft.commercialityAssumed && questions.includes('commercialityFactor')}
          />
        </aside>
      </div>
      <ObjectiveValueFaq />
    </ShellSurface>
  );
}
