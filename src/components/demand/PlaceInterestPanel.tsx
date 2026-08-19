'use client';

/**
 * **«N ΑΝΘΡΩΠΟΙ ΨΑΧΝΟΥΝ ΑΚΙΝΗΤΟ ΣΑΝ ΤΟ ΔΙΚΟ ΣΑΣ»** — το δόλωμα του §12.6, στην οθόνη.
 *
 * @related ADR-777 §7 (Α9 · Α12 · Α14) · §8.22 · SPEC-777A §14.2 · SPEC-777B §12.6 · §12.7
 * @module components/demand/PlaceInterestPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΦΟΡΕΣΕΙ ΤΗ ΦΩΝΗ ΑΛΛΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κατάσταση | Τι λέει η οθόνη |
 * |---|---|
 * | `count > 0`, στάση `offered` | «N ζητούν **αυτό ακριβώς** το ακίνητο» |
 * | `count > 0`, στάση `dormant`/`partial` | «N ψάχνουν **κάτι σαν** το δικό σας» **+ γιατί** |
 * | `count === 0` | «κανείς αυτή τη στιγμή» — **υπαρκτή πληροφορία** |
 * | `count === null` | «δεν λέμε αριθμό κάτω από {minCount}» |
 *
 * 🔑 **Η δεύτερη γραμμή είναι ΟΛΟΚΛΗΡΗ η τιμιότητα του χαρακτηριστικού.** Για κλειστό
 * ακίνητο δεν έχουμε δηλωμένο ούτε είδος συμφωνίας ούτε τιμή, άρα η σύγκριση έγινε
 * **μόνο** πάνω σε *τι είναι* και *πού είναι*. Ο αριθμός είναι **αληθής και πιο
 * αδύναμος** — και αν τον λέγαμε με τη φωνή του πρώτου, θα υποσχόμασταν αγοραστές που
 * ίσως δεν φτάνουν την τιμή που ο ιδιοκτήτης δεν έχει καν σκεφτεί.
 *
 * ⚠️ **Καμία ταυτότητα, κανένα κριτήριο, καμία ημερομηνία, κανένα ποσό** φτάνει ποτέ
 * εδώ: το `/api/demand/interest` επιστρέφει **μόνο** `stance` + `disclosure`. Ούτε η
 * λογιστική — το `interested` της είναι ο ωμός αριθμός που το κατώφλι υπάρχει για να
 * κρύψει (§12.7α).
 *
 * 🏆 **Καμία πύλη ακινήτων δεν το κάνει** (έρευνα 2026-08-12). Το *Make Me Move* της
 * Zillow ζητούσε από τον **ιδιοκτήτη** να κάνει την πρώτη κίνηση, και καταργήθηκε. Εδώ
 * την κάνει η **αγορά**.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { InterestStance } from '@/lib/demand/demand-interest';
import type { PlaceInterestState } from '@/hooks/demand/usePlaceInterest';

/**
 * Ποια εξήγηση συνοδεύει κάθε στάση. **`Record` πάνω σε κλειστό σύνολο**: τέταρτη
 * στάση δεν μεταγλωττίζεται χωρίς να αποφασίσει κάποιος **τι λέει** στον άνθρωπο —
 * αλλιώς θα προσγειωνόταν σιωπηλά με τη φωνή του `offered`.
 */
const WHY_KEY: Readonly<Record<InterestStance, string | null>> = {
  offered: null,
  partial: 'search-results:demand.interest.partialWhy',
  dormant: 'search-results:demand.interest.dormantWhy',
};

/** Ποια πρόταση λέει το πλήθος — «αυτό ακριβώς» ή «κάτι σαν αυτό». */
const COUNT_KEY: Readonly<Record<InterestStance, string>> = {
  offered: 'search-results:demand.interest.offered',
  partial: 'search-results:demand.interest.dormant',
  dormant: 'search-results:demand.interest.dormant',
};

export function PlaceInterestPanel({
  interest,
}: {
  interest: PlaceInterestState;
}): React.ReactElement | null {
  const { t } = useTranslation(['search-results']);

  // ⚠️ **Η αποτυχία δεν ζωγραφίζει «0».** Δες {@link PlaceInterestState}: μια πεσμένη
  // κλήση δεν είναι μέτρηση της αγοράς. Η φόρτωση λέει ότι φορτώνει· η αποτυχία λέει
  // ότι απέτυχε. Καμία από τις δύο δεν λέει «κανείς δεν σε ψάχνει».
  if (interest.state === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('search-results:demand.interest.loading')}
      </p>
    );
  }

  if (interest.state === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('search-results:demand.interest.unavailable')}
      </p>
    );
  }

  const { stance, disclosure } = interest.interest;
  const { count, minCount } = disclosure;
  const whyKey = WHY_KEY[stance];

  return (
    <section
      aria-label={t('search-results:demand.interest.heading')}
      className="rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t('search-results:demand.interest.heading')}
      </h3>

      {count === null ? (
        <p className="mt-2 text-sm text-foreground">
          {t('search-results:demand.interest.hidden', { minCount })}
        </p>
      ) : count === 0 ? (
        <p className="mt-2 text-sm text-foreground">
          {t('search-results:demand.interest.none')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground">{t(COUNT_KEY[stance], { count })}</p>
      )}

      {/* Η εξήγηση της αδυναμίας συνοδεύει **μόνο** τον ισχυρισμό που είναι αδύναμος:
          σε σιωπή ή μηδέν δεν υπάρχει τίποτα να εξασθενήσει. */}
      {whyKey !== null && count !== null && count > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{t(whyKey)}</p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        {t('search-results:demand.interest.privacy')}
      </p>
    </section>
  );
}
