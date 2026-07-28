'use client';
/**
 * ADR-720 — «τι ακριβώς θα εισαχθεί», σε μία θέση.
 *
 * Ο οδηγός λέει αυτό το ίδιο πράγμα σε **δύο** βήματα: στην αντιστοίχιση στηλών (ζωντανή
 * προεπισκόπηση, αλλάζει σε κάθε dropdown) και στην επιβεβαίωση (τελευταία ματιά πριν το κλικ).
 * Ήταν ήδη δύο σχεδόν-ίδια μπλοκ πριν από αυτό το ADR· με την προσθήκη της υψομετρικής διάκρισης
 * θα γίνονταν δύο **πραγματικά** δίδυμα των τεσσάρων γραμμών — δηλαδή sibling clone (N.18), και
 * εγγυημένη απόκλιση την πρώτη φορά που κάποιος διορθωνόταν. Ένα component, δύο call sites.
 *
 * ── Τι λέει, και γιατί έτσι ────────────────────────────────────────────────────────────────────
 * Πριν το ADR-720 ο οδηγός έγραφε «33 σημεία · 60 γραμμές θα παραλειφθούν». Ήταν ακριβές ως προς
 * τον μηχανισμό και εντελώς λάθος ως προς τη συνέπεια: οι 60 «γραμμές» ήταν οι κορυφές του
 * οικοπέδου. Τώρα γράφει «93 σημεία (33 με υψόμετρο / 60 δισδιάστατα)» και **τίποτα δεν
 * παραλείπεται**.
 *
 * Η υψομετρική γραμμή εμφανίζεται **μόνο** όταν υπάρχει πράγματι δισδιάστατο σημείο. Σε ένα
 * κανονικό πλήρες αρχείο, «(93 με υψόμετρο / 0 δισδιάστατα)» θα ήταν θόρυβος — και ένας δείκτης
 * που ανάβει πάντα παύει να διαβάζεται.
 *
 * Ο επεξηγηματικός σημειωτής (`planimetricNote`) είναι **ρητός, όχι γκρίζα ψιλά γράμματα**
 * (ρητή απαίτηση Giorgio): λέει και τα δύο μισά — ότι τα δισδιάστατα **μπαίνουν** (ορατά, με έλξη)
 * και ότι **δεν** συμμετέχουν στην επιφάνεια. Η μισή πρόταση θα διαβαζόταν είτε ως «χάθηκαν» είτε
 * ως «όλα καλά», και καμία από τις δύο δεν είναι αλήθεια.
 *
 * @see ../../../systems/topography/topo-point-elevation — `describeElevationCoverage` (η μέτρηση)
 * @see docs/centralized-systems/reference/adrs/ADR-720-survey-points-without-elevation.md
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import type { ElevationCoverage } from '../../../systems/topography/topo-point-elevation';
import styles from './TopoImportWizard.module.css';

interface Props {
  readonly coverage: ElevationCoverage;
  /** Γραμμές που δεν διαβάστηκαν καθόλου (χωρίς X/Y) — **όχι** «χωρίς υψόμετρο» (ADR-720). */
  readonly skippedCount: number;
  /**
   * `summary` στο βήμα επιβεβαίωσης (έντονο, «# σημεία έτοιμα για εισαγωγή»), `status` στη
   * ζωντανή προεπισκόπηση της αντιστοίχισης. Ίδια δεδομένα, άλλος τόνος φωνής.
   */
  readonly tone: 'preview' | 'confirm';
}

export function TopoImportPointSummary({ coverage, skippedCount, tone }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const isConfirm = tone === 'confirm';
  const countKey = isConfirm ? 'topography.import.confirmCount' : 'topography.import.previewCount';

  return (
    <>
      <p className={isConfirm ? styles.summary : styles.status}>
        {t(countKey, { count: coverage.total })}
        {coverage.planimetricOnly > 0 && (
          ` ${t('topography.import.previewElevationSplit', {
            withElevation: coverage.withElevation,
            planimetric: coverage.planimetricOnly,
          })}`
        )}
      </p>

      {coverage.planimetricOnly > 0 && (
        <p className={styles.note}>
          {t('topography.import.planimetricNote', {
            withElevation: coverage.withElevation,
            planimetric: coverage.planimetricOnly,
          })}
        </p>
      )}

      {skippedCount > 0 && (
        <p className={styles.status}>
          {t('topography.import.previewSkipped', { count: skippedCount })}
        </p>
      )}
    </>
  );
}
