'use client';

/**
 * @fileoverview **Η απάντηση του §12.6, συναρμολογημένη** — δύο πηγές, μία ετυμηγορία.
 * @related ADR-777 §7 (Α9 · Α5) · SPEC-777B §12.6 · lib/demand/demand-answer.ts
 * @module hooks/demand/useDemandAnswer
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΥΟ ΠΗΓΕΣ, ΚΑΙ ΓΙΑΤΙ Η ΜΙΑ ΠΕΡΝΑΕΙ ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §12.6 ζητά **δύο** πράγματα, και έχουν **αντίθετο** καθεστώς ορατότητας:
 *
 * | Σκέλος | Πηγή | Γιατί εκεί |
 * |---|---|---|
 * | *«τι υπάρχει **κοντά**»* | `usePublicListings` — **πελάτης** | οι αγγελίες είναι δημόσιες· `read: if true` |
 * | *«**πόσοι άλλοι** ζητούν το ίδιο»* | `/api/demand/competition` — **διακομιστής** | ο κανόνας δίνει `read` **μόνο** στον `authorUserId`· ο πελάτης **δομικά** δεν βλέπει ζητήσεις άλλων |
 *
 * 🔑 **Η ασυμμετρία δεν είναι ατέλεια — είναι το επίπεδο Γ σε εφαρμογή.** Το
 * `demand-aggregate.ts` το γράφει: το άθροισμα *«παράγεται· δεν γράφεται»*, και
 * φεύγει **μόνο** από μία διαδρομή που εφαρμόζει το k-κατώφλι πριν πει αριθμό.
 *
 * ⚠️ **Ο ανταγωνισμός φορτώνει ΞΕΧΩΡΙΣΤΑ, και η απάντηση δεν τον περιμένει.** Το
 * πρώτο σκέλος (*«με +20.000 € υπάρχουν 6»*) είναι **τοπικός υπολογισμός** πάνω σε
 * δεδομένα που ήδη κατέβηκαν· το δεύτερο είναι κλήση δικτύου. Αν τα δέναμε, μια αργή
 * ή αποτυχημένη κλήση θα κρατούσε όμηρο **ολόκληρη** την απάντηση — δηλαδή ο χρήστης
 * δεν θα έβλεπε το κύριο περιεχόμενο επειδή αργεί το δευτερεύον.
 */

import { useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/lib/api/enterprise-api-client';
import { todayLocalDate, nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  answerDemand,
  knowledgeFromListings,
  type DemandAnswer,
} from '@/lib/demand/demand-answer';
import { DEMAND_DISCLOSURE, type DemandDisclosure } from '@/lib/demand/demand-aggregate';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('useDemandAnswer');

/** Η ίδια η απάντηση, με ρητή κατάσταση φόρτωσης. */
export type DemandAnswerState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly answer: DemandAnswer }
  | { readonly state: 'error'; readonly message: string };

/**
 * Το δεύτερο σκέλος, **χωριστά**.
 *
 * 🔑 **Το `unavailable` ΔΕΝ είναι «κανένας».** Μια αποτυχία δικτύου δεν είναι
 * πληροφορία για την αγορά, και μια οθόνη που δείχνει «0 άλλοι» επειδή έπεσε μια
 * κλήση **λέει ψέματα με σιγουριά** — το ίδιο σχήμα με το «0 = κανείς δεν κοίταξε»
 * που κυνηγούν οι πύλες, μεταφερμένο στον χρήστη.
 */
export type CompetitionState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly disclosure: DemandDisclosure }
  | { readonly state: 'unavailable' };

interface CompetitionResponse {
  readonly disclosure: DemandDisclosure;
}

/**
 * **Ζήτηση → τι υπάρχει σήμερα.**
 *
 * ⚠️ **Ο ανταγωνισμός μέσα στο `answer` είναι ΠΑΝΤΑ το ουδέτερο** («δεν το λέμε»),
 * και ο πραγματικός έρχεται από το {@link useDemandCompetition}. Δεν είναι διπλή
 * αναπαράσταση: η {@link answerDemand} είναι **καθαρή** και δέχεται τις άλλες
 * ζητήσεις ως όρισμα — ο πελάτης **δεν έχει καμία**, και το να του επιτρέπαμε να
 * περάσει κάτι εκεί θα υπονοούσε ότι μπορεί να τις δει.
 */
export function useDemandAnswer(demand: PropertyDemand | null): DemandAnswerState {
  const { listings, loading, error } = usePublicListings();

  return useMemo<DemandAnswerState>(() => {
    if (demand === null || loading) return { state: 'loading' };
    if (error !== null) return { state: 'error', message: error };

    return {
      state: 'ready',
      answer: answerDemand({
        demand,
        listings,
        // ✅ Ο **δεσμός επιπέδου Α** αντλείται πλέον από τις ίδιες τις αγγελίες: μια
        // ζήτηση Ζ3/Ζ5 έχει με τι να συγκριθεί. 🔶 Τα άλλα **δύο** κενά μένουν
        // (διαθεσιμότητα · αποστάσεις POI) και η μηχανή τα λέει **ονομαστικά**
        // (`availability-unknown` / `proximity-unknown`) αντί να υποθέσει.
        knowledge: knowledgeFromListings(listings),
        // Ο πελάτης δεν βλέπει ζητήσεις άλλων· βλ. {@link useDemandCompetition}.
        otherDemands: [],
        todayDate: todayLocalDate(),
        nowIso: nowISO(),
      }),
    };
  }, [demand, listings, loading, error]);
}

/**
 * **«Πόσοι άλλοι ζητούν το ίδιο»** — από τον διακομιστή, ήδη λογοκριμένο.
 *
 * ⚠️ Ζητά **ταυτότητα ζήτησης**, ποτέ κριτήρια: αλλιώς η διαδρομή θα ήταν ελεύθερο
 * ερωτητήριο πάνω στη ζήτηση όλης της χώρας, δηλαδή δωρεάν ανασύνθεση του **Ε2**.
 */
export function useDemandCompetition(demandId: string | null): CompetitionState {
  const [state, setState] = useState<CompetitionState>({ state: 'loading' });

  useEffect(() => {
    if (demandId === null || demandId.trim() === '') {
      setState({ state: 'unavailable' });
      return;
    }

    let alive = true;
    setState({ state: 'loading' });

    apiClient
      .get<CompetitionResponse>(
        `/api/demand/competition?demandId=${encodeURIComponent(demandId)}`,
      )
      .then((payload) => {
        if (alive) setState({ state: 'ready', disclosure: payload.disclosure });
      })
      .catch((cause: unknown) => {
        logger.warn('Ο ανταγωνισμός δεν φορτώθηκε', {
          data: { demandId },
          error: cause instanceof Error ? cause.message : String(cause),
        });
        // ⚠️ **Ποτέ `count: 0`.** Βλ. {@link CompetitionState} — μια αποτυχία δικτύου
        // δεν είναι μέτρηση της αγοράς.
        if (alive) setState({ state: 'unavailable' });
      });

    // Η σημαία ακυρώνει την **εγγραφή**, όχι την κλήση: μια απάντηση που φτάνει αφού
    // ο χρήστης έφυγε από την οθόνη θα έγραφε σε αποσυναρμολογημένο component.
    return () => {
      alive = false;
    };
  }, [demandId]);

  return state;
}

/** Το κατώφλι που ισχύει για τον ανταγωνισμό — ώστε η σιωπή να είναι **εξηγήσιμη**. */
export const COMPETITION_MIN_COUNT = DEMAND_DISCLOSURE['area-market'].minCount;
