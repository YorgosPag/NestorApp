'use client';
/**
 * ADR-650 M8β/Γ — «Αυτόματες γραμμές ασυνέχειας»: το σύστημα προτείνει, ο μηχανικός εγκρίνει.
 *
 * Ο δρόμος του Civil 3D («Extract feature lines from surface») και του CloudCompare: η μηχανή
 * διαβάζει την ΙΔΙΑ επιφάνεια που ήδη βλέπει ο χρήστης, βρίσκει πού σπάει το έδαφος και το
 * ΠΡΟΤΕΙΝΕΙ — δεν το γράφει. Καμία από τις δύο δεν βάζει feature line μόνη της, και το §9
 * (human-certifier) το απαγορεύει ρητά: χωρίς το κλικ «Προσθήκη», ο πίνακας σημείων μένει άθικτος.
 *
 * Deterministic, χωρίς LLM — μηδέν κόστος (ίδια πειθαρχία με το M5α «καμπανάκι», του οποίου
 * το pattern «τρέξε → δες → δράσε» ακολουθεί αυτούσιο αυτό το section).
 *
 * Το κλικ σε γραμμή πάει τη ΖΩΝΤΑΝΗ όψη στην υποψήφια — μέσω του κοινού {@link focusReviewTarget}
 * (2Δ EventBus / 3Δ κάμερα) — και τη σημειώνει ως «αυτήν κοιτάω», ώστε να ξεχωρίζει ταυτόχρονα εδώ
 * ΚΑΙ στον καμβά (2Δ overlay + 3Δ layer). Δύο ανεξάρτητες σημάνσεις ανά υποψήφια, ποτέ μία: το
 * τσεκάρισμα λέει «θα γραφτεί», το κλικ λέει «τη βλέπω» — βλ. `AutoBreaklineState`.
 *
 * i18n: κάθε string μέσω `t()` (N.11). Styles: κοινό CSS module (N.3). Semantic (N.4).
 */

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import {
  detectAutoBreaklines,
  acceptAutoBreaklines,
} from '../../../systems/topography/auto-breaklines';
import {
  autoBreaklineStore,
  useAutoBreaklineState,
  selectedCandidates,
} from '../../../systems/topography/auto-breaklines/auto-breakline-store';
import type { AutoBreaklineCandidate } from '../../../systems/topography/auto-breaklines/auto-breakline-types';
import { mmToMetreString } from '../../../systems/topography/qa/topo-qa-format';
import { focusReviewTarget, reviewFocusExtent } from '../../../systems/coordination/review-focus';
import { resolveAutoBreaklineCandidateWorld } from '../../../bim-3d/coordination/auto-breakline-world';
import styles from './TopographyPanel.module.css';

/**
 * Περιθώριο (canonical mm) γύρω από την υποψήφια όταν εστιάζει η όψη (~5 μ).
 *
 * Μικρότερο από το 15 μ του QA με λόγο: το QA δείχνει ένα ΣΗΜΕΙΟ και χρειάζεται γείτονες για να
 * κριθεί· η υποψήφια είναι ολόκληρη ΓΡΑΜΜΗ — το πλαίσιό της ορίζεται από το ίδιο της το μήκος και
 * το περιθώριο απλώς την ξεκολλάει από την άκρη της οθόνης.
 */
const FOCUS_PAD_MM = 5_000;

/**
 * Πήγαινε την ενεργή όψη στην υποψήφια και σημείωσέ την ως «αυτήν κοιτάω» (ADR-650 M8β/Γ).
 *
 * Η σήμανση γίνεται ΠΡΩΤΗ και ανεπιφύλακτα: ακόμη κι όταν η 3Δ δεν μπορεί να λύσει υψόμετρο (άρα
 * η κάμερα δεν κουνιέται), ο μηχανικός πάτησε αυτή τη γραμμή και η λίστα οφείλει να το λέει.
 * Δένοντας τη σήμανση σε ένα επιτυχημένο ζουμ, το κλικ θα έμοιαζε να μην έκανε απολύτως τίποτα.
 */
function focusCandidate(candidate: AutoBreaklineCandidate): void {
  /**
   * ΠΡΩΤΟ άλμα αυτού του πάσου ή επόμενο; Διαβάζεται ΠΡΙΝ το `focus`, που το επικαλύπτει.
   *
   * Το πρώτο κλικ δεν έχει κλίμακα άξια διατήρησης (ο μηχανικός μπορεί να βλέπει όλο το οικόπεδο)
   * → πλαισιώνει την υποψήφια και ΟΡΙΖΕΙ κλίμακα. Από εκεί και πέρα η κλίμακα είναι ΔΙΚΗ ΤΟΥ: κάθε
   * επόμενη γραμμή απλώς μετατοπίζει την όψη στο ζουμ που έχει επιλέξει. Το πάσο μηδενίζεται
   * ακριβώς όταν μηδενίζεται και η σήμανση — νέα «Ανίχνευση» ή «Καθαρισμός».
   */
  const preserveZoom = autoBreaklineStore.getFocusedId() !== null;
  autoBreaklineStore.focus(candidate.id);

  const extent = reviewFocusExtent(candidate.vertices, FOCUS_PAD_MM);
  if (!extent) return; // μη πεπερασμένες συντεταγμένες — φώτισε τη γραμμή, μη μετακινήσεις τίποτα

  // Thunk: η 3Δ μετατροπή διαβάζει projector + datum και σε κάτοψη είναι καθαρή σπατάλη. Είναι ο
  // ΙΔΙΟΣ resolver που χρησιμοποιεί το 3Δ layer, ώστε η γραμμή της λίστας και η γραμμή στο έδαφος
  // να μη δείχνουν ποτέ διαφορετικό σημείο.
  focusReviewTarget(extent, () => resolveAutoBreaklineCandidateWorld(candidate, extent.centre), preserveZoom);
}

interface RowProps {
  readonly candidate: AutoBreaklineCandidate;
  readonly approved: boolean;
  /** Η υποψήφια που κοιτάει τώρα ο μηχανικός — ξεχωρίζει ταυτόχρονα εδώ ΚΑΙ στον καμβά. */
  readonly focused: boolean;
}

function CandidateRow({ candidate, approved, focused }: RowProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const label = t('topography.autoBreakline.candidate', {
    length: mmToMetreString(candidate.lengthMm, 1),
    angle: candidate.avgFoldDeg.toFixed(0),
    edges: candidate.edgeCount,
  });

  return (
    <div
      className={`${styles.abItem} ${approved ? '' : styles.abRejected} ${focused ? styles.abItemFocused : ''}`}
      aria-current={focused ? 'true' : undefined}
    >
      <input
        type="checkbox"
        checked={approved}
        onChange={() => autoBreaklineStore.toggle(candidate.id)}
        aria-label={label}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.abFocus}
            onClick={() => focusCandidate(candidate)}
          >
            {label}
            {candidate.closed ? ` ${t('topography.autoBreakline.candidateClosed')}` : ''}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{t('topography.autoBreakline.focusHint')}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function TopoAutoBreaklineSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { report, selected, focusedId } = useAutoBreaklineState();
  const [addedCount, setAddedCount] = React.useState<number | null>(null);

  const onRun = React.useCallback(() => {
    setAddedCount(null);
    autoBreaklineStore.setReport(detectAutoBreaklines('existing'));
  }, []);

  const onClear = React.useCallback(() => {
    setAddedCount(null);
    autoBreaklineStore.reset();
  }, []);

  // §9 — ΤΟ ΜΟΝΟ σημείο όπου γράφεται κάτι στην αποτύπωση, και μόνο ό,τι έχει τσεκάρει ο μηχανικός.
  const onAdd = React.useCallback(() => {
    const created = acceptAutoBreaklines(selectedCandidates(autoBreaklineStore.get()));
    autoBreaklineStore.reset();
    setAddedCount(created.length);
  }, []);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.autoBreakline.title')}</h3>
      <p className={styles.subtitle}>{t('topography.autoBreakline.hint')}</p>

      <div className={styles.row}>
        <button type="button" className={styles.generateButton} onClick={onRun}>
          {t('topography.autoBreakline.run')}
        </button>
        <button
          type="button" className={styles.generateButton}
          onClick={onClear} disabled={report === null}
        >
          {t('topography.autoBreakline.clear')}
        </button>
      </div>

      {addedCount !== null && (
        <p className={styles.status}>{t('topography.autoBreakline.added', { count: addedCount })}</p>
      )}

      {report?.notEnoughData && (
        <p className={styles.status}>{t('topography.autoBreakline.notEnoughData')}</p>
      )}

      {report && !report.notEnoughData && report.candidates.length === 0 && (
        <p className={styles.status}>{t('topography.autoBreakline.none')}</p>
      )}

      {report && report.candidates.length > 0 && (
        <>
          <p className={styles.status}>
            {t('topography.autoBreakline.found', { count: report.candidates.length })}
          </p>
          <div className={styles.row}>
            <button
              type="button" className={styles.generateButton}
              onClick={() => autoBreaklineStore.setAll(true)}
            >
              {t('topography.autoBreakline.selectAll')}
            </button>
            <button
              type="button" className={styles.generateButton}
              onClick={() => autoBreaklineStore.setAll(false)}
            >
              {t('topography.autoBreakline.selectNone')}
            </button>
          </div>

          <ul className={styles.qaList}>
            {report.candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateRow
                  candidate={candidate}
                  approved={selected.has(candidate.id)}
                  focused={candidate.id === focusedId}
                />
              </li>
            ))}
          </ul>

          {report.droppedByCap > 0 && (
            <p className={styles.status}>
              {t('topography.autoBreakline.dropped', { count: report.droppedByCap })}
            </p>
          )}

          <button
            type="button" className={styles.generateButton}
            onClick={onAdd} disabled={selected.size === 0}
          >
            {t('topography.autoBreakline.add', { count: selected.size })}
          </button>
        </>
      )}
    </section>
  );
}
