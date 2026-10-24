'use client';

/**
 * **Η πρόβλεψη ολοκλήρωσης του κτιρίου** για την οθόνη της υπόσχεσης (ADR-919 §6 · §11).
 *
 * 🔑 Καμία νέα ανάγνωση ή μηχανή: το **ίδιο** `getConstructionData` με το Gantt, το **ίδιο** καθαρό
 * `forecastCompletion` με τον κανόνα ημερομηνίας κατάστασης του P6. Η πρόβλεψη είναι **πρόταση** (Δ1) και δεν
 * αποθηκεύεται ποτέ από εδώ.
 *
 * ⚠️ Το «σήμερα» διαβάζεται **μία** φορά ανά mount: η πρόβλεψη κρίνεται σε ημέρες.
 */

import { useEffect, useState } from 'react';

import { getConstructionData } from '@/components/building-management/construction-services';
import { todayLocalDate } from '@/lib/date-local';
import { forecastCompletion, type CompletionForecast } from '@/services/construction-scheduling/completion-forecast';

export type CompletionForecastState =
  | { readonly status: 'loading'; readonly today: string }
  | { readonly status: 'ready'; readonly today: string; readonly forecast: CompletionForecast };

export function useCompletionForecast(buildingId: string): CompletionForecastState {
  const [today] = useState(todayLocalDate);
  const [state, setState] = useState<CompletionForecastState>({ status: 'loading', today });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', today });
    getConstructionData(buildingId).then(({ phases, tasks }) => {
      if (!cancelled) setState({ status: 'ready', today, forecast: forecastCompletion(phases, tasks, today) });
    });
    return () => {
      cancelled = true;
    };
  }, [buildingId, today]);

  return state;
}
