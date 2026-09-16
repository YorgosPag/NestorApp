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
 * | στάση `settled` | «η συναλλαγή ολοκληρώθηκε» — **κανένας** αριθμός (ADR-864 Φ2) |
 *
 * 🔒 **Κλειστή διάθεση** (ADR-864 Φ2): ίδιο πλήθος — ο κριτής είναι **ένας** — **και** μία
 * γραμμή ότι αυτοί οι άνθρωποι **δεν** βλέπουν την αγγελία. Είναι το πλεονέκτημα της
 * ιδιωτικής φάσης των μεγάλων (Compass Private Exclusives: *δοκιμάζεις τη ζήτηση πριν
 * βγεις δημόσια*), ειπωμένο **με αριθμό** αντί για εκτίμηση πράκτορα.
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
import type { JudgedInterestStance, PlaceInterest } from '@/lib/demand/demand-interest';
import type { MarketingAudience } from '@/constants/marketing-audiences';
import type { PlaceInterestState } from '@/hooks/demand/usePlaceInterest';

/**
 * Ποια εξήγηση συνοδεύει κάθε στάση. **`Record` πάνω σε κλειστό σύνολο**: τέταρτη
 * στάση δεν μεταγλωττίζεται χωρίς να αποφασίσει κάποιος **τι λέει** στον άνθρωπο —
 * αλλιώς θα προσγειωνόταν σιωπηλά με τη φωνή του `offered`.
 */
const WHY_KEY: Readonly<Record<JudgedInterestStance, string | null>> = {
  offered: null,
  partial: 'property-market:demand.interest.partialWhy',
  dormant: 'property-market:demand.interest.dormantWhy',
};

/** Ποια πρόταση λέει το πλήθος — «αυτό ακριβώς» ή «κάτι σαν αυτό». */
const COUNT_KEY: Readonly<Record<JudgedInterestStance, string>> = {
  offered: 'property-market:demand.interest.offered',
  partial: 'property-market:demand.interest.dormant',
  dormant: 'property-market:demand.interest.dormant',
};

export function PlaceInterestPanel({
  interest,
  audience,
}: {
  interest: PlaceInterestState;
  /** Το κοινό της καταχώρησης — **ήδη ερμηνευμένο** από το `marketingAudienceOf` (Α3). */
  audience: MarketingAudience;
}): React.ReactElement | null {
  const { t, isNamespaceReady } = useTranslation(['property-market']);

  // ⚠️ **Η αποτυχία δεν ζωγραφίζει «0».** Δες {@link PlaceInterestState}: μια πεσμένη
  // κλήση δεν είναι μέτρηση της αγοράς. Η φόρτωση λέει ότι φορτώνει· η αποτυχία λέει
  // ότι απέτυχε. Καμία από τις δύο δεν λέει «κανείς δεν σε ψάχνει».
  //
  // 🔴 ADR-777 §8.39/§8.40 — **«ΦΟΡΤΩΝΕΙ» ΣΗΜΑΙΝΕΙ ΔΥΟ ΠΡΑΓΜΑΤΑ, ΚΑΙ ΤΑ ΔΥΟ ΕΙΝΑΙ ΦΟΡΤΩΣΗ.**
  //
  // Η οθόνη `/properties/[id]` είναι η **μόνη** από τις επτά καταναλώτριες που δεν
  // μπορεί να πάρει route slice: η κλειστότητά της έχει **112** ανεπίλυτες δυναμικές
  // `t()` σε άσχετα υποσυστήματα (επαφές · συσχετίσεις · αποθήκευση), και ο generator
  // **αρνείται** — σωστά. Άρα εκεί το `property-market` φορτώνεται **ασύγχρονα**, και η
  // γραμμή «Κοιτάμε ποιος ψάχνει…» θα έβγαινε **ωμό κλειδί** όσο κρατούσε η φόρτωση.
  //
  // 🔑 **Λείπουν τα δεδομένα ή λείπουν οι λέξεις — και στις δύο περιπτώσεις το πανέλ δεν
  // έχει τίποτα να πει ακόμη.** Γι' αυτό είναι **μία** συνθήκη, όχι δύο. Και γι' αυτό δεν
  // επιστρέφει `null`: όσο δεν ξέρουμε τις λέξεις κρατάμε τη **θέση** με σκελετό, ώστε να
  // μη ζωγραφιστεί ούτε ωμό κλειδί (CHECK 3.51) ούτε κενό που θα αναπηδούσε αμέσως μετά
  // (`no-navigation-flash`, ADR-267/300 — η **ίδια** βλάβη από την ανάποδη).
  //
  // ⚠️ Η ετοιμότητα έρχεται από το **hook** και κρίνεται στο **render** — όχι σε
  // `useEffect`, που θα ήταν ακριβώς η κλάση Κ1 που απαγορεύει το CHECK 3.51.
  if (!isNamespaceReady || interest.state === 'loading') {
    return (
      <p className="text-sm text-muted-foreground">
        {isNamespaceReady ? (
          t('property-market:demand.interest.loading')
        ) : (
          <span className="block h-4 w-48 animate-pulse rounded bg-muted" aria-hidden />
        )}
      </p>
    );
  }

  if (interest.state === 'unavailable') {
    return (
      <p className="text-sm text-muted-foreground">
        {t('property-market:demand.interest.unavailable')}
      </p>
    );
  }

  // 🔴 **ADR-864 Φ2 — η στάση στενεύεται ΠΡΙΝ από κάθε αριθμό.** Ο τύπος δεν δίνει
  //    `disclosure` σε ολοκληρωμένη συναλλαγή: «0» ή «κάτω από κατώφλι» θα ήταν ψέματα.
  if (interest.interest.stance === 'settled') {
    return (
      <InterestFrame>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('property-market:demand.interest.settled')}
        </p>
      </InterestFrame>
    );
  }

  return <CountedInterest interest={interest.interest} audience={audience} />;
}

/** Το πλαίσιο του πάνελ — **ένα** σημείο για επιφάνεια, ετικέτα και κεφαλίδα. */
function InterestFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  return (
    <section
      aria-label={t('property-market:demand.interest.heading')}
      className="rounded-md border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {t('property-market:demand.interest.heading')}
      </h3>
      {children}
    </section>
  );
}

/** Ακίνητο που **κρίθηκε** απέναντι στη ζήτηση — αριθμός, εξήγηση, εμβέλεια, ιδιωτικότητα. */
function CountedInterest({
  interest,
  audience,
}: {
  interest: Extract<PlaceInterest, { disclosure: unknown }>;
  audience: MarketingAudience;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { stance, disclosure } = interest;
  const { count, minCount } = disclosure;
  const whyKey = WHY_KEY[stance];
  // 🔒 Μόνο πάνω σε **ισχυρό** ισχυρισμό: στο `dormant`/`partial` η εξήγηση ήδη λέει ότι
  //    το ακίνητο δεν διατίθεται — δεύτερη γραμμή για το κοινό θα ήταν θόρυβος.
  const closedReach = audience !== 'public' && stance === 'offered' && count !== null && count > 0;

  return (
    <InterestFrame>
      {count === null ? (
        <p className="mt-2 text-sm text-foreground">
          {t('property-market:demand.interest.hidden', { minCount })}
        </p>
      ) : count === 0 ? (
        <p className="mt-2 text-sm text-foreground">
          {t('property-market:demand.interest.none')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-foreground">{t(COUNT_KEY[stance], { count })}</p>
      )}

      {/* Η εξήγηση της αδυναμίας συνοδεύει **μόνο** τον ισχυρισμό που είναι αδύναμος:
          σε σιωπή ή μηδέν δεν υπάρχει τίποτα να εξασθενήσει. */}
      {whyKey !== null && count !== null && count > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{t(whyKey)}</p>
      ) : null}

      {closedReach ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t('property-market:demand.interest.closedReach')}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        {t('property-market:demand.interest.privacy')}
      </p>
    </InterestFrame>
  );
}
