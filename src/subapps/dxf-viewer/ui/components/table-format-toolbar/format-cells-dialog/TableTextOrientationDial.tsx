'use client';

/**
 * 🔴 ADR-739 §60 — **ο ΕΠΙΛΟΓΕΑΣ ΓΩΝΙΑΣ**: το ημικύκλιο του Excel, με σύρσιμο, πληκτρολόγιο και
 * αριθμητικό πεδίο — και τα τρία να γράφουν την **ίδια** τιμή.
 *
 * ## Γιατί ημικύκλιο και όχι σκέτο πεδίο αριθμού
 * Το «−45» δεν λέει τίποτα σε κανέναν πριν το δει. Το Excel το έλυσε το 1993 με έναν δείκτη που
 * **δείχνει** το αποτέλεσμα, και η λύση δεν έχει ξεπεραστεί: ο χρήστης σέρνει μέχρι να του
 * αρέσει και το νούμερο ακολουθεί. Ένα πεδίο μόνο του θα ήταν παλινδρόμηση σε σχέση με ένα
 * χειριστήριο τριάντα ετών.
 *
 * ## 🔴 Η ΕΜΒΕΛΕΙΑ ΕΙΝΑΙ ±90 ΠΡΟΣΗΜΑΣΜΕΝΕΣ — και το SSoT είναι το μοντέλο
 * Το φράγμα έρχεται από το {@link MAX_TABLE_TEXT_ROTATION_DEG} και το κόψιμο από την **ίδια**
 * {@link clampTableTextRotationDeg} που τροφοδοτεί μέτρηση, τοποθέτηση, ζωγράφο και εξαγωγή.
 * Ένα τοπικό `Math.min/max` εδώ θα ήταν έκτος ορισμός της ίδιας έννοιας — και η διαφωνία του θα
 * ήταν κείμενο που ζωγραφίζεται σε άλλη γωνία από αυτήν που δείχνει ο δείκτης.
 *
 * ⚠️ **Η στρογγυλοποίηση ζει ΕΔΩ, όχι στο SSoT**: το μοντέλο δέχεται 45,5° και η διάταξη το τιμά.
 * Το χειριστήριο δίνει **ακέραιες** μοίρες γιατί αυτό δίνει και το Excel — σύμβαση της
 * επιφάνειας. Στρογγυλοποίηση μέσα στο `clamp` θα κβάντιζε σιωπηλά κάθε γωνία που ήρθε από
 * αρχείο ή από τύπο.
 *
 * ## 🔴 ΤΟ `role="slider"` ΕΙΝΑΙ Η ΠΡΟΔΙΑΓΡΑΦΗ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ
 * Ένα SVG με `onPointerDown` και τίποτε άλλο είναι **αόρατο** στο πληκτρολόγιο και στον
 * αναγνώστη οθόνης — δηλαδή η ελεύθερη γωνία θα υπήρχε μόνο για όποιον έχει ποντίκι. Με
 * `role="slider"` + `aria-valuenow`/`aria-valuetext` ανακοινώνεται σαν αυτό που είναι, και τα
 * βέλη κάνουν ό,τι κάνουν παντού. Το αριθμητικό πεδίο δίπλα **δεν** το αντικαθιστά: είναι η
 * τρίτη είσοδος (πληκτρολόγηση ακριβούς τιμής), όπως στο Excel.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableTextOrientationDial
 * @see bim/table/table-rotation-ops.ts — το φράγμα και το κόψιμο (SSoT)
 */

import React, { useCallback, useId, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import {
  MAX_TABLE_TEXT_ROTATION_DEG,
  clampTableTextRotationDeg,
} from '../../../../bim/table/table-rotation-ops';
import { TABLE_FORMAT_CELLS_KEY } from './table-format-cells-labels';
import styles from './TableFormatCellsDialog.module.css';

/** Γεωμετρία του ημικυκλίου σε συντεταγμένες SVG. Καθαροί αριθμοί, καμία μονάδα οθόνης. */
const DIAL = { cx: 8, cy: 60, r: 84, size: { w: 100, h: 124 } } as const;

/** Το βήμα των βελών, και το μεγάλο βήμα (`PageUp`/`PageDown`) — οι συμβάσεις του APG. */
const ARROW_STEP = 1;
const PAGE_STEP = 15;

/**
 * Ο δείκτης όταν η τιμή είναι **ανάμεικτη**: κανένας.
 *
 * `0` θα ήταν ψέμα («όλα οριζόντια») στην ακριβώς πιο επικίνδυνη στιγμή — ένα σύρσιμο από εκεί
 * ισοπεδώνει γωνίες που ο χρήστης δεν ήξερε ότι υπάρχουν.
 */
const MIXED_POINTER_DEG = 0;

export interface TableTextOrientationDialProps {
  /** Η τρέχουσα γωνία σε μοίρες· `null` ⇒ ανάμεικτος στόχος. */
  readonly value: number | null;
  readonly onChange: (deg: number) => void;
}

export function TableTextOrientationDial(
  props: TableTextOrientationDialProps,
): React.ReactElement {
  const { value, onChange } = props;
  const { t } = useTranslation('dxf-viewer');
  const inputId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const deg = value ?? MIXED_POINTER_DEG;
  const commit = useCallback(
    (next: number) => onChange(Math.round(clampTableTextRotationDeg(next))),
    [onChange],
  );

  /**
   * Η γωνία **από το σημείο του δείκτη**, στο σύστημα του SVG.
   *
   * `atan2(cy - y, x - cx)`: ο άξονας y του SVG δείχνει προς τα **κάτω**, οπότε η αναστροφή
   * είναι υποχρεωτική — χωρίς αυτήν το σύρσιμο προς τα πάνω θα έδινε αρνητική γωνία, δηλαδή ο
   * δείκτης θα κινούνταν αντίθετα από το χέρι.
   */
  const angleFromPointer = useCallback((clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * DIAL.size.w;
    const y = ((clientY - rect.top) / rect.height) * DIAL.size.h;
    return (Math.atan2(DIAL.cy - y, x - DIAL.cx) * 180) / Math.PI;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>): void => {
      // `setPointerCapture`: το σύρσιμο συνεχίζεται **έξω** από το SVG, όπως σε κάθε slider.
      // Χωρίς αυτό, ο δείκτης «κολλάει» μόλις ο χρήστης βγει από το ημικύκλιο — δηλαδή ακριβώς
      // στη γωνία που προσπαθεί να φτάσει.
      event.currentTarget.setPointerCapture(event.pointerId);
      const next = angleFromPointer(event.clientX, event.clientY);
      if (next !== null) commit(next);
    },
    [angleFromPointer, commit],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>): void => {
      if (event.buttons === 0) return;
      const next = angleFromPointer(event.clientX, event.clientY);
      if (next !== null) commit(next);
    },
    [angleFromPointer, commit],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>): void => {
      const step = KEY_STEP[event.key];
      if (step === undefined) return;
      event.preventDefault();
      commit(step === 'min' ? -MAX_TABLE_TEXT_ROTATION_DEG
        : step === 'max' ? MAX_TABLE_TEXT_ROTATION_DEG
          : deg + step);
    },
    [commit, deg],
  );

  const rad = (deg * Math.PI) / 180;
  const tipX = DIAL.cx + DIAL.r * Math.cos(rad);
  const tipY = DIAL.cy - DIAL.r * Math.sin(rad);

  return (
    <div className={styles.dialRow}>
      <svg
        ref={svgRef}
        role="slider"
        tabIndex={0}
        aria-label={t(`${TABLE_FORMAT_CELLS_KEY}.alignment.orientation`)}
        aria-valuemin={-MAX_TABLE_TEXT_ROTATION_DEG}
        aria-valuemax={MAX_TABLE_TEXT_ROTATION_DEG}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? t(`${TABLE_FORMAT_CELLS_KEY}.mixed`) : undefined}
        viewBox={`0 0 ${DIAL.size.w} ${DIAL.size.h}`}
        className={styles.dial}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      >
        {/* Οι υποδιαιρέσεις κάθε 15°, όπως του Excel: αναφορά για το μάτι, ποτέ χειριστήριο. */}
        {TICK_DEGREES.map((tick) => {
          const tickRad = (tick * Math.PI) / 180;
          return (
            <line
              key={tick}
              x1={DIAL.cx + (DIAL.r - 10) * Math.cos(tickRad)}
              y1={DIAL.cy - (DIAL.r - 10) * Math.sin(tickRad)}
              x2={DIAL.cx + DIAL.r * Math.cos(tickRad)}
              y2={DIAL.cy - DIAL.r * Math.sin(tickRad)}
              className={styles.dialTick}
            />
          );
        })}
        <line
          x1={DIAL.cx}
          y1={DIAL.cy}
          x2={tipX}
          y2={tipY}
          className={value === null ? styles.dialPointerMixed : styles.dialPointer}
        />
        <circle cx={DIAL.cx} cy={DIAL.cy} r={3} className={styles.dialHub} />
      </svg>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={inputId}>
          {t(`${TABLE_FORMAT_CELLS_KEY}.alignment.degrees`)}
        </label>
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={-MAX_TABLE_TEXT_ROTATION_DEG}
          max={MAX_TABLE_TEXT_ROTATION_DEG}
          step={1}
          className={styles.degreesInput}
          value={value === null ? '' : String(value)}
          placeholder={t(`${TABLE_FORMAT_CELLS_KEY}.mixed`)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            // Κενό πεδίο ⇒ **καμία** εγγραφή: ο χρήστης που σβήνει για να πληκτρολογήσει «−45»
            // περνά αναγκαστικά από το κενό, και ένα `0` εκεί θα ίσιωνε το κείμενο μπροστά του.
            if (event.target.value !== '' && Number.isFinite(parsed)) commit(parsed);
          }}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Οι υποδιαιρέσεις κάθε 15° από −90 έως +90 — παραγόμενες, ποτέ γραμμένες μία-μία. */
const TICK_DEGREES: readonly number[] = Array.from(
  { length: (2 * MAX_TABLE_TEXT_ROTATION_DEG) / PAGE_STEP + 1 },
  (_unused, index) => -MAX_TABLE_TEXT_ROTATION_DEG + index * PAGE_STEP,
);

/**
 * Πλήκτρο → μεταβολή. Χάρτης και όχι αλυσίδα `if`, για τον λόγο που τον γράφει ήδη το
 * `table-format-command-keys.ts`: η επόμενη προσθήκη ξεχνά μια περίπτωση και το πλήκτρο σιωπά.
 *
 * ⚠️ `ArrowUp` = **+1** και `ArrowRight` = **+1**: η θετική γωνία γέρνει προς τα πάνω-δεξιά
 * (ECMA-376 / Excel), οπότε και τα δύο βέλη δείχνουν προς την ίδια κατεύθυνση του δείκτη.
 */
const KEY_STEP: Readonly<Record<string, number | 'min' | 'max' | undefined>> = {
  ArrowUp: ARROW_STEP,
  ArrowRight: ARROW_STEP,
  ArrowDown: -ARROW_STEP,
  ArrowLeft: -ARROW_STEP,
  PageUp: PAGE_STEP,
  PageDown: -PAGE_STEP,
  Home: 'min',
  End: 'max',
};
