'use client';

/**
 * ADR-782 §25 — το χειριστήριο του υποβάθρου, **σε δικό του mount**.
 *
 * ## 🔴 Τι διόρθωσε: ένα έργο χωρίς ορόφους δεν μπορούσε να δει χάρτη **ποτέ**
 * Ο διακόπτης και οι ρυθμίσεις ζούσαν **μέσα** στο `<nav>` του `FloorTabBar`, που κάνει
 * `return null` όταν το έργο δεν έχει κτίριο/ορόφους. Χάνονταν έτσι **και τα τρία** μαζί: το
 * κουμπί, η ένδειξη προέλευσης και **ο λόγος άρνησης** — δηλαδή το ακριβώς αντίθετο από τη
 * γραπτή αρχή του `basemap-availability`: *«η άρνηση είναι απάντηση, όχι σιωπή»*. Δεν υπήρχε
 * ούτε σβηστός διακόπτης να ρωτήσει ο χρήστης.
 *
 * Το υπόβαθρο **δεν έχει καμία εννοιολογική σχέση με τους ορόφους**: απαντά «πού είναι το έργο
 * πάνω στη Γη», ερώτημα ανά **έργο**. Μοιραζόταν τη μοίρα τους μόνο λόγω θέσης στο δέντρο. Οι
 * μεγάλοι συμφωνούν: το `Manage ▸ Project Location` του **Revit** και το `Project Location` του
 * **ArchiCAD** είναι project-level και δεν εξαρτώνται από την ύπαρξη Levels — ένα έργο αποκτά
 * τοποθεσία **πριν** αποκτήσει ορόφους, που είναι η φυσιολογική σειρά.
 *
 * ## ⚠️ Δεν αντιγράφηκε τίποτα — **μετακόμισε**
 * Η προφανής «διόρθωση» θα ήταν δεύτερο σημείο απόδοσης για τις περιπτώσεις χωρίς ορόφους. Αυτό
 * θα ήταν **δύο επιφάνειες για ένα ερώτημα** (ADR-749): δύο κουμπιά που μπορούν να διαφωνήσουν
 * για το αν ο χάρτης είναι διαθέσιμος. Το mount είναι **ένα**, και μετακινήθηκε ένα σκαλί ψηλότερα
 * — στη γραμμή πλαισίου (`ViewerContextStrip`), που ζει όσο ζει ο θεατής.
 *
 * ## Δεύτερος λόγος, ανεξάρτητος: το `role="tablist"` δέχεται **μόνο** `role="tab"`
 * Ένα `role="group"` με δύο κουμπιά μέσα σε `tablist` παραβιάζει τα *required owned elements* του
 * ARIA (κανόνας `aria-required-children`). Δηλαδή η παλιά θέση ήταν λάθος **και** για τον
 * αναγνώστη οθόνης, ανεξάρτητα από τους ορόφους.
 *
 * ⚠️ **Δύο αδελφά κουμπιά, όχι ένθετα** (§18): κουμπί μέσα σε κουμπί είναι άκυρο HTML και ο
 * αναγνώστης οθόνης δεν μπορεί να τα ξεχωρίσει. Το `role="group"` τα ανακοινώνει ως **ένα**
 * χειριστήριο και ζει εδώ, γιατί εδώ ζουν και τα δύο.
 *
 * @see ./ViewerContextStrip.tsx — το σημείο προσάρτησης
 * @see ../../systems/basemap/basemap-availability.ts — «η άρνηση είναι απάντηση»
 */

import React, { useSyncExternalStore } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { CONTEXT_STRIP_CHIP_CLASS } from './context-strip-chip';
import { BasemapSettingsPopover } from './BasemapSettingsPopover';
import {
  getProjectAnchorRefusal,
  type BasemapAvailability,
} from '../../systems/basemap/basemap-availability';
import {
  getBasemapAvailability,
  subscribeBasemapAvailability,
} from '../../systems/basemap/basemap-frame';
import { ANCHOR_REFUSAL_HINT_KEY } from '../../systems/basemap/basemap-anchor-labels';
import {
  isBasemapTruncated,
  subscribeTileFidelity,
} from '../../systems/basemap/basemap-fidelity-report';
import {
  getBasemapState,
  subscribeBasemap,
  toggleBasemapEnabled,
} from '../../systems/basemap/basemap-store';

/** Ό,τι χρειάζεται ο διακόπτης για να ανακοινώσει τον εαυτό του — καμία απόφαση εμφάνισης. */
interface BasemapToggleState {
  readonly availability: BasemapAvailability;
  /** Αναμμένος **και** με πού να καθίσει ο χάρτης. */
  readonly active: boolean;
  readonly unavailable: boolean;
  /** Ο λόγος, έτοιμος για ανάγνωση — ονομασμένος αν υπάρχει, γενικός αν δεν υπάρχει ακόμη. */
  readonly unavailableLabel: string;
  /**
   * Ο χάρτης ζωγραφίζεται, αλλά **λείπουν** τμήματα που η προβολή δεν αποδίδει πιστά (§27.9).
   *
   * ⚠️ Είναι **τρίτη** κατάσταση, όχι απόχρωση της `unavailable`: εκεί ο χάρτης δεν υπάρχει
   * καθόλου και η θεραπεία είναι γεωαναφορά· εδώ ο χάρτης υπάρχει και η θεραπεία είναι
   * **μεγέθυνση**. Δύο διαφορετικές θεραπείες δεν επιτρέπεται να μοιράζονται ένα σήμα.
   */
  readonly truncated: boolean;
}

/**
 * Η **κατάσταση** του διακόπτη, χωριστά από την εμφάνισή του — ίδιος χωρισμός με
 * `useFloorTabs`/`FloorTabBar` δίπλα: εδώ «τι ισχύει», εκεί «πώς φαίνεται».
 */
function useBasemapToggleState(): BasemapToggleState {
  const { t } = useTranslation('dxf-viewer-shell');
  const availability = useSyncExternalStore(
    subscribeBasemapAvailability,
    getBasemapAvailability,
    getBasemapAvailability,
  );
  const { enabled } = useSyncExternalStore(subscribeBasemap, getBasemapState, getBasemapState);

  // Ο λόγος ζει στο ΙΔΙΟ store με τη διαθεσιμότητα, οπότε η υπάρχουσα εγγραφή τον καλύπτει.
  const refusal = useSyncExternalStore(
    subscribeBasemapAvailability,
    getProjectAnchorRefusal,
    getProjectAnchorRefusal,
  );

  // Εγγραφή **απευθείας** στην αναφορά πιστότητας και όχι μέσω `basemap-invalidation`: εκείνο
  // απαριθμεί τι προκαλεί ζωγραφική, ενώ αυτό είναι αποτέλεσμά της (δες την επικεφαλίδα του
  // `basemap-fidelity-report`). Ο ζωγράφος αναφέρει ανά καρέ· το boolean κάνει το React να
  // ξαναρενδάρει μόνο όταν αλλάζει η **απάντηση**, όχι όταν αλλάζει το πλήθος.
  const truncated = useSyncExternalStore(
    subscribeTileFidelity,
    isBasemapTruncated,
    isBasemapTruncated,
  );

  const unavailable = availability === 'unknown';
  const active = enabled && !unavailable;

  return {
    availability,
    unavailable,
    active,
    truncated: active && truncated,
    // ⚠️ Η γενική υπόδειξη μένει ως **πάτωμα**, όχι ως εναλλακτική στιλ: όσο η ανάγνωση εκκρεμεί
    // (ή απέτυχε) δεν υπάρχει διαπιστωμένος λόγος, και το να ονομάσουμε έναν θα ήταν εφεύρεση.
    unavailableLabel: refusal ? t(ANCHOR_REFUSAL_HINT_KEY[refusal]) : t('basemap.unavailableHint'),
  };
}

/**
 * Το υπόβαθρο χάρτη — **διακόπτης**, όχι καρτέλα.
 *
 * Δεν αλλάζει ενεργό όροφο: ο χρήστης συνεχίζει να σχεδιάζει κανονικά ενώ βλέπει πού βρίσκεται
 * πάνω στον χάρτη. Γι' αυτό είναι `aria-pressed` (κατάσταση ενός κουμπιού) και **όχι**
 * `role="tab"` με `aria-selected` όπως οι όροφοι — δύο διαφορετικά πράγματα δεν επιτρέπεται να
 * ανακοινώνονται στον αναγνώστη οθόνης με το ίδιο όνομα.
 *
 * ⚠️ Ανενεργό όταν το έργο δεν είναι γεωαναφερμένο, με τον λόγο **μέσα** στην ετικέτα
 * προσβασιμότητας. Ένα ανενεργό κουμπί χωρίς εξήγηση είναι η χειρότερη εκδοχή: ο χρήστης βλέπει
 * λειτουργία που δεν μπορεί να πατήσει και δεν μαθαίνει ποτέ γιατί.
 */
const BasemapToggle: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { availability, active, unavailable, unavailableLabel, truncated } = useBasemapToggleState();

  const stateClass = active
    ? `${colors.bg.info} ${colors.text.inverse}`
    : `${colors.text.muted} ${PANEL_LAYOUT.INTERACTIVE.HOVER}`;

  /**
   * ⚠️ Η περικοπή μπαίνει στο **`aria-label`** και όχι μόνο στο ορατό τσιπάκι: όταν ένα κουμπί
   * φέρει `aria-label`, ο αναγνώστης οθόνης **αγνοεί** το κείμενο των παιδιών του. Ένα badge που
   * υπάρχει μόνο οπτικά θα ήταν απόκρυψη σιωπηλή για ακριβώς τον χρήστη που την υφίσταται
   * περισσότερο — και το §27.9 απαιτεί το αντίθετο.
   */
  const ariaLabel = unavailable
    ? unavailableLabel
    : truncated
      ? t('basemap.truncatedAria')
      : t('basemap.toggleAria');

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={unavailable}
      aria-label={ariaLabel}
      onClick={toggleBasemapEnabled}
      className={`${CONTEXT_STRIP_CHIP_CLASS} ${stateClass} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <MapIcon size={13} aria-hidden="true" />
      <span>{t('basemap.label')}</span>
      {active && availability === 'approximate' && (
        <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.inverse} ${PANEL_LAYOUT.OPACITY['70']}`}>
          {t('basemap.approximateBadge')}
        </span>
      )}
      {/* Δύο τσιπάκια μπορούν να συνυπάρχουν: «κατά προσέγγιση θέση» και «μερικός χάρτης» είναι
          ανεξάρτητα γεγονότα — ένα έργο με άγκυρα από διεύθυνση σε πλήρες zoom-out έχει **και** τα
          δύο, και το να κρύψουμε το ένα θα έκρυβε μισή αλήθεια. */}
      {truncated && (
        <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.inverse} ${PANEL_LAYOUT.OPACITY['70']}`}>
          {t('basemap.truncatedBadge')}
        </span>
      )}
    </button>
  );
};

/**
 * Ο διακόπτης και οι ρυθμίσεις του, ως **ένα** χειριστήριο.
 *
 * ⚠️ `shrink-0`: όταν οι όροφοι είναι πολλοί, εκείνοι κυλούν οριζόντια — ο χάρτης **μένει**. Είναι
 * το πλαίσιο μέσα στο οποίο διαβάζονται όλα τα υπόλοιπα («πού είμαι» πριν από «ποιον όροφο
 * βλέπω», §10), και ένα πλαίσιο που φεύγει από την οθόνη μόλις γεμίσει το κτίριο ορόφους δεν
 * κάνει τη δουλειά του.
 */
export const BasemapControlGroup: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <span
      role="group"
      aria-label={t('basemap.label')}
      className={`shrink-0 flex items-center ${PANEL_LAYOUT.GAP.HALF}`}
    >
      <BasemapToggle />
      <BasemapSettingsPopover />
    </span>
  );
};
