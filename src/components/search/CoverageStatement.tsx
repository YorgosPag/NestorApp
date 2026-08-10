'use client';

/**
 * **Η δήλωση κάλυψης της οθόνης 1** — «τι μπορούμε να απαντήσουμε σήμερα».
 *
 * @related ADR-777 §7 (Α3 · Α5 κανόνας 27) · SPEC-777-RESEARCH §25.7
 *
 * 🏆 **Το σημείο όπου ξεπερνάμε την πρακτική της αγοράς.** Zillow · Idealista ·
 * Spitogatos δηλώνουν κάλυψη με **χειρόγραφο κείμενο** («σε όλη την Ελλάδα») που
 * τίποτα δεν το συγκρίνει με τα δεδομένα — η ίδια κατηγορία με τις δύο λίστες
 * namespace της CHECK 3.34 που απέκλιναν κατά **63** χωρίς καμία πύλη να τις ρωτήσει.
 * Εδώ η πρόταση **παράγεται από τη ζωντανή προσφορά**: δεν υπάρχει δεύτερο αντίγραφο
 * να αποκλίνει.
 *
 * ⚠️ **Τυπώνεται ΠΑΝΤΑ**, και στις τρεις καταστάσεις — όπως η μπάρα λογιστικής της
 * οθόνης 2 τυπώνεται ακόμη και στο μηδέν. Μια κάλυψη που σιωπά όταν είναι κακή είναι
 * ακριβώς η πύλη που τυπώνει «0 παραβιάσεις» επειδή δεν κοίταξε.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingCoverage } from '@/lib/listings/listing-coverage';

interface CoverageStatementProps {
  readonly coverage: ListingCoverage;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Κατάσταση → κλειδί. **Εξαντλητικό `switch`, καμία προεπιλογή.**
 *
 * 🔑 Μια νέα κατάσταση στο {@link CoverageState} **σπάει τη μεταγλώττιση εδώ**, αντί
 * να πέσει σιωπηλά σε ένα γενικό κείμενο που θα ήταν λάθος για την καινούρια.
 */
function coverageKey(coverage: ListingCoverage): string {
  switch (coverage.state) {
    case 'no-supply':
      return 'search-results:landing.coverage.noSupply';
    case 'no-location':
      return 'search-results:landing.coverage.noLocation';
    case 'partial':
      return 'search-results:landing.coverage.partial';
  }
}

export function CoverageStatement({ coverage, loading, error }: CoverageStatementProps) {
  const { t } = useTranslation(['search-results']);

  return (
    <section aria-live="polite" className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {t('search-results:landing.coverage.heading')}
      </h2>

      {/*
        🔴 Η σειρά είναι συμβόλαιο, ίδια με το `coverageStateOf`: όσο δεν έχουμε
        μετρήσει, ΔΕΝ δηλώνουμε κάλυψη. Μια πρόταση «καμία αγγελία» τυπωμένη ενώ η
        ανάγνωση φορτώνει ακόμη θα ήταν αριθμητικά αληθής για ένα άδειο array και
        **ψευδής** για τον κόσμο — το σχήμα «0 = κανείς δεν κοίταξε», στην οθόνη.
      */}
      {loading ? (
        <p className="mt-1 text-base text-foreground">
          {t('search-results:landing.coverage.loading')}
        </p>
      ) : error ? (
        <p role="alert" className="mt-1 text-base text-destructive">
          {t('search-results:landing.coverage.error')}
        </p>
      ) : (
        <p className="mt-1 text-base text-foreground">
          {t(coverageKey(coverage), {
            total: coverage.ledger.total,
            mapped: coverage.ledger.mapped,
            unmapped: coverage.ledger.unmapped,
          })}
        </p>
      )}
    </section>
  );
}
