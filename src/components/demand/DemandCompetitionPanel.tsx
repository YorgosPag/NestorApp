'use client';

/**
 * **«Πόσοι άλλοι ζητούν το ίδιο»** — το δεύτερο σκέλος του §12.6.
 *
 * @related ADR-777 §7 (Α9 · Α12) · SPEC-777A §14.2 (επίπεδο Γ) · SPEC-777B §12.6 · §12.7
 * @module components/demand/DemandCompetitionPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ Η ΜΙΑ ΕΙΝΑΙ ΣΙΩΠΗ ΜΕ ΕΞΗΓΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κατάσταση | Τι λέει η οθόνη |
 * |---|---|
 * | `count > 0` | «άλλοι N ψάχνουν κάτι παρόμοιο» |
 * | `count === 0` | «κανένας άλλος» — **υπαρκτή πληροφορία**, όχι απουσία |
 * | `count === null` | «δεν λέμε αριθμό κάτω από {minCount}» — **και εξηγούμε γιατί** |
 *
 * 🔑 **Το `null` ΔΕΝ σημαίνει «κανένας», και η διάκριση είναι όλη η ιδιωτικότητα.**
 * Το `demand-aggregate.ts` το γράφει: *«το `null` εδώ σημαίνει “δεν το λέμε”, όχι
 * “κανένας”»*. Μια οθόνη που τα ένωνε θα έλεγε «κανένας άλλος» σε άνθρωπο που στην
 * πραγματικότητα έχει **τέσσερις** ανταγωνιστές — δηλαδή θα του έδινε λάθος εικόνα
 * της αγοράς **για να προστατεύσει** αυτούς τους τέσσερις, ενώ η σωστή απάντηση
 * είναι να πει ότι **σιωπά**.
 *
 * 🏆 **Δεν βρέθηκε πύλη ακινήτων που να δηλώνει κατώφλι αποκάλυψης καθόλου.** Το
 * *Make Me Move* του Zillow — το πλησιέστερο ανάλογο — δούλευε **ανάποδα** (δήλωνε ο
 * ιδιοκτήτης) και **καταργήθηκε**. Το κατώφλι **5** είναι το χαμηλότερο καθιερωμένο
 * της στατιστικής απόκρυψης (5 / 10 / 11 — το CMS απαγορεύει κελιά κάτω από 11).
 *
 * ⚠️ **Καμία ταυτότητα, κανένα κριτήριο, καμία ημερομηνία** φτάνει ποτέ εδώ: το
 * `/api/demand/competition` επιστρέφει **μόνο** το {@link DemandDisclosure}. Ούτε καν
 * η λογιστική — το `counted` της είναι ο ωμός αριθμός που το κατώφλι υπάρχει για να
 * κρύψει (§12.7α).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CompetitionState } from '@/hooks/demand/useDemandAnswer';

export function DemandCompetitionPanel({
  competition,
}: {
  competition: CompetitionState;
}): React.ReactElement | null {
  const { t } = useTranslation(['search-results']);

  // ⚠️ **Η αποτυχία δεν ζωγραφίζει τίποτα, ΠΟΤΕ «0».** Μια πεσμένη κλήση δεν είναι
  // μέτρηση της αγοράς, και ένα «κανένας άλλος» εκεί θα ήταν ψέμα με σιγουριά — το
  // ίδιο σχήμα «0 = κανείς δεν κοίταξε» που κυνηγούν οι πύλες, στραμμένο στον χρήστη.
  if (competition.state !== 'ready') return null;

  const { count, minCount } = competition.disclosure;

  return (
    <section
      aria-label={t('search-results:demand.competition.heading')}
      className="rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t('search-results:demand.competition.heading')}
      </h3>

      {count === null ? (
        <>
          <p className="mt-2 text-sm text-foreground">
            {t('search-results:demand.competition.hidden', { minCount })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('search-results:demand.competition.hiddenWhy')}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-foreground">
          {count === 0
            ? t('search-results:demand.competition.none')
            : t('search-results:demand.competition.count', { count })}
        </p>
      )}
    </section>
  );
}
