'use client';

/**
 * ADR-750 Φ6 — **το proxy preview**: η καρδιά του διαλόγου και το μόνο πραγματικά νέο χειριστήριο.
 *
 * Οκτώ θέσεις, τρεις οπτικές καταστάσεις, δύο τρόποι να πατηθούν.
 *
 * ## 🔴 `role="toolbar"` + `aria-pressed`, ΟΧΙ `role="menu"` (ADR §9.2)
 * Εδώ ο χρήστης εναλλάσσει **κατάσταση** σε οπτικό πλέγμα — δεν εκτελεί εντολές που κλείνουν.
 * Το APG αποκλείει ρητά το μενού για επιλογή κατάστασης· ζητά toggle buttons. Είναι ακριβώς η
 * αντίστροφη απάντηση από την Α21 (οι 13 εντολές του dropdown), με το **ίδιο** κριτήριο: «είναι
 * κάτι που *είσαι* ή κάτι που *κάνεις*;».
 *
 * ## 🔑 Οι τρεις καταστάσεις χαρτογραφούνται σε ΤΡΕΙΣ τιμές του `aria-pressed`
 * ```
 *   absent            →  false    (καμία ρητή γραμμή — ισχύει η κληρονομιά)
 *   uniform, ορατή    →  true     (η ΠΡΑΓΜΑΤΙΚΗ γραμμή ζωγραφίζεται στη ζώνη)
 *   mixed             →  "mixed"  (η ARIA έχει λέξη γι' αυτό· ο αναγνώστης λέει «μερικώς»)
 * ```
 * Ένα widget δύο καταστάσεων **λέει ψέματα** σε επιλογή 3×3 όπου μερικές μόνο ακμές έχουν
 * περίγραμμα: ό,τι κι αν διαλέξει, το πρώτο κλικ του χρήστη καταστρέφει πληροφορία που δεν
 * ήξερε ότι υπήρχε.
 *
 * ⚠️ **`uniform` με ΑΟΡΑΤΟ μολύβι** (Α14, «ρητά καμία γραμμή») εμφανίζεται σαν `absent`: δεν
 * υπάρχει τέταρτη οπτική κατάσταση στα μετρημένα στιγμιότυπα, και δεν επινοείται εδώ. Η
 * διάκριση παραμένει προσβάσιμη με τη χειρονομία («Καμία» + κλικ ⇒ ρητά καμία· δεύτερο κλικ
 * του ίδιου ⇒ επιστροφή στην κληρονομιά).
 *
 * ## Η ζώνη είναι ΚΑΙ η ίδια χειριστήριο — και γι' αυτό είναι `aria-hidden`
 * Κλικ μέσα στο κουτί εναλλάσσει την **πλησιέστερη** γραμμή: το ιδίωμα του Excel, γραμμένο
 * ρητά στο κείμενο βοήθειας από κάτω. Είναι όμως **συντόμευση δείκτη** για ό,τι κάνουν ήδη τα
 * οκτώ κουμπιά: ένα κουμπί που η ενέργειά του εξαρτάται από τις συντεταγμένες του κλικ δεν
 * μπορεί να ανακοινωθεί σωστά. Κρύβεται από τον αναγνώστη (και από το `Tab`) αντί να του
 * υποσχεθεί κάτι που δεν μπορεί να τηρήσει.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableBorderProxyWidget
 * @see bim/table/table-border-dialog-positions.ts — διαθεσιμότητα + τρέχουσα κατάσταση
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { buildLinetypeThumbnailFromPattern } from '../../../../rendering/linetype-thumbnail';
import type {
  TableBorderDialogPositionId,
  TableBorderDialogPositionSlot,
} from '../../../../bim/table/table-border-dialog-positions';
import type { TableBorderSpec } from '../../../../types/table-edges';
import { tableLinePreviewStrokeWidth } from '../TableLinePreview';
import {
  TABLE_BORDER_DIALOG_EDGE_KEY,
  TABLE_BORDER_DIALOG_KEY,
} from './table-format-cells-labels';
import {
  TABLE_BORDER_PROXY_BOX,
  nearestTableBorderDialogPosition,
  tableBorderProxyLine,
  tableBorderProxyLineLength,
} from './table-border-proxy-geometry';
import styles from './TableFormatCellsDialog.module.css';

/** Τα τρία κουμπιά **αριστερά** της ζώνης, από πάνω προς τα κάτω (μετρημένη διάταξη Excel). */
const SIDE_COLUMN: readonly TableBorderDialogPositionId[] = ['top', 'insideH', 'bottom'];
/** Τα πέντε κουμπιά **κάτω** από τη ζώνη, από αριστερά προς τα δεξιά. */
const BOTTOM_ROW: readonly TableBorderDialogPositionId[] = [
  'diagonal:down',
  'left',
  'insideV',
  'right',
  'diagonal:up',
];

export type TableBorderDialogSnapshot = ReadonlyMap<
  TableBorderDialogPositionId,
  TableBorderDialogPositionSlot
>;

export interface TableBorderProxyWidgetProps {
  readonly snapshot: TableBorderDialogSnapshot;
  readonly onToggle: (id: TableBorderDialogPositionId) => void;
}

export function TableBorderProxyWidget({
  snapshot, onToggle,
}: TableBorderProxyWidgetProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');

  const available = useMemo(
    () => [...snapshot.entries()].filter(([, slot]) => slot.available).map(([id]) => id),
    [snapshot],
  );

  const onZoneClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const svg = event.currentTarget.querySelector('svg');
      const rect = svg?.getBoundingClientRect();
      // Μηδενικό ορθογώνιο = μη μετρήσιμη ζώνη (jsdom, ή κρυφός διάλογος): καμία μαντεψιά.
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const nearest = nearestTableBorderDialogPosition(
        {
          x: ((event.clientX - rect.left) / rect.width) * TABLE_BORDER_PROXY_BOX.width,
          y: ((event.clientY - rect.top) / rect.height) * TABLE_BORDER_PROXY_BOX.height,
        },
        available,
      );
      if (nearest) onToggle(nearest);
    },
    [available, onToggle],
  );

  const renderButton = (id: TableBorderDialogPositionId): React.ReactElement => (
    <EdgeToggle key={id} id={id} slot={snapshot.get(id)} onToggle={onToggle} />
  );

  return (
    <div
      className={styles.widget}
      role="toolbar"
      aria-label={t(`${TABLE_BORDER_DIALOG_KEY}.border.section`)}
    >
      <div className={styles.widgetSideColumn}>{SIDE_COLUMN.map(renderButton)}</div>

      <button
        type="button"
        className={styles.zoneButton}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onZoneClick}
      >
        <ProxyZone snapshot={snapshot} text={t(`${TABLE_BORDER_DIALOG_KEY}.border.previewText`)} />
      </button>

      <div className={styles.widgetBottomRow}>{BOTTOM_ROW.map(renderButton)}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά
// ──────────────────────────────────────────────────────────────────────────────

/** Η τιμή του `aria-pressed` για μια θέση — η **μία** μετάφραση κατάστασης → ARIA. */
function pressedValue(slot: TableBorderDialogPositionSlot | undefined): boolean | 'mixed' {
  if (!slot) return false;
  if (slot.state.kind === 'mixed') return 'mixed';
  return slot.state.kind === 'uniform' && slot.state.spec.visible;
}

/** Το ορατό μολύβι μιας θέσης· `null` όταν δεν υπάρχει γραμμή να ζωγραφιστεί. */
function visibleSpec(slot: TableBorderDialogPositionSlot | undefined): TableBorderSpec | null {
  if (!slot || slot.state.kind !== 'uniform') return null;
  return slot.state.spec.visible ? slot.state.spec : null;
}

interface EdgeToggleProps {
  readonly id: TableBorderDialogPositionId;
  readonly slot: TableBorderDialogPositionSlot | undefined;
  readonly onToggle: (id: TableBorderDialogPositionId) => void;
}

/**
 * Ένα από τα οκτώ κουμπιά.
 *
 * Το όνομα είναι **κείμενο μέσα στο κουμπί** (κρυφό οπτικά) και όχι `aria-label`, ώστε η
 * ένδειξη «μεικτό» να μπορεί να **προστεθεί** στο όνομα: με `aria-label` θα έπρεπε να
 * συντεθεί σε συμβολοσειρά κώδικα, δηλαδή σε σημείο που κανένα locale δεν ελέγχει.
 */
function EdgeToggle({ id, slot, onToggle }: EdgeToggleProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const available = slot?.available ?? false;
  const pressed = pressedValue(slot);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={available ? undefined : true}
      className={cn(styles.edgeButton, pressed === true && styles.edgeButtonPressed)}
      onClick={() => {
        if (available) onToggle(id);
      }}
    >
      <EdgeGlyph id={id} active={pressed !== false} />
      <span className="sr-only">
        {t(TABLE_BORDER_DIALOG_EDGE_KEY[id])}
        {pressed === 'mixed' ? ` ${t(`${TABLE_BORDER_DIALOG_KEY}.mixedEdge`)}` : ''}
      </span>
    </button>
  );
}

/** Πλάτος/ύψος του εικονιδίου ενός κουμπιού, σε μονάδες `viewBox`. */
const GLYPH = { width: 20, height: 16 } as const;

/**
 * Το εικονίδιο ενός κουμπιού: το ίδιο κουτί, με **τη δική του** γραμμή τονισμένη.
 *
 * Η γραμμή δεν ξανασχεδιάζεται ανά θέση — **κλιμακώνεται** από το ίδιο
 * {@link tableBorderProxyLine} που ζωγραφίζει τη ζώνη. Οκτώ χειρόγραφα εικονίδια θα ήταν οκτώ
 * ευκαιρίες να δείχνει το κουμπί άλλη ακμή από αυτήν που πατά.
 */
function EdgeGlyph({
  id, active,
}: {
  readonly id: TableBorderDialogPositionId;
  readonly active: boolean;
}): React.ReactElement {
  const line = tableBorderProxyLine(id);
  const sx = GLYPH.width / TABLE_BORDER_PROXY_BOX.width;
  const sy = GLYPH.height / TABLE_BORDER_PROXY_BOX.height;
  return (
    <svg
      width={GLYPH.width}
      height={GLYPH.height}
      viewBox={`0 0 ${GLYPH.width} ${GLYPH.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={0.5} y={0.5} width={GLYPH.width - 1} height={GLYPH.height - 1}
        fill="none" stroke="currentColor" strokeWidth={0.6} opacity={0.35}
      />
      <line
        x1={line.x1 * sx} y1={line.y1 * sy} x2={line.x2 * sx} y2={line.y2 * sy}
        stroke="currentColor" strokeWidth={1.6} opacity={active ? 1 : 0.65}
      />
    </svg>
  );
}

/**
 * Η ζώνη: γωνιακοί δείκτες, η λέξη «Κείμενο», και οι γραμμές που **πράγματι** ισχύουν.
 *
 * Οι γωνίες είναι δείκτες και όχι κουμπιά (μετρημένο από το στιγμιότυπο): δηλώνουν πού
 * τελειώνει το κελί όταν καμία ακμή δεν έχει περίγραμμα — αλλιώς η ζώνη θα ήταν κενός χώρος.
 */
function ProxyZone({
  snapshot, text,
}: {
  readonly snapshot: TableBorderDialogSnapshot;
  readonly text: string;
}): React.ReactElement {
  const { width, height } = TABLE_BORDER_PROXY_BOX;
  const tick = 8;
  return (
    <svg
      className={styles.zone}
      viewBox={`-6 -6 ${width + 12} ${height + 12}`}
      preserveAspectRatio="none"
    >
      {CORNERS.map(([cx, cy, dx, dy]) => (
        <polyline
          key={`${cx}-${cy}`}
          className={styles.zoneHint}
          points={`${cx * width + dx * tick},${cy * height} ${cx * width},${cy * height} ${cx * width},${cy * height + dy * tick}`}
        />
      ))}
      <text className={styles.zoneText} x={width / 2} y={height / 2} textAnchor="middle" dominantBaseline="middle">
        {text}
      </text>
      {[...snapshot.keys()].map((id) => (
        <ZoneLine key={id} id={id} slot={snapshot.get(id)} />
      ))}
    </svg>
  );
}

/** Οι τέσσερις γωνίες ως `[x, y, dx, dy]` κανονικοποιημένες — δεδομένα, όχι τέσσερα σώματα. */
const CORNERS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 1, 1],
  [1, 0, -1, 1],
  [0, 1, 1, -1],
  [1, 1, -1, -1],
];

/** Η γραμμή μιας θέσης μέσα στη ζώνη — απούσα κατάσταση ⇒ **τίποτα**. */
function ZoneLine({
  id, slot,
}: {
  readonly id: TableBorderDialogPositionId;
  readonly slot: TableBorderDialogPositionSlot | undefined;
}): React.ReactElement | null {
  const line = tableBorderProxyLine(id);
  if (slot?.state.kind === 'mixed') {
    return <line className={styles.edgeMixed} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />;
  }

  const spec = visibleSpec(slot);
  if (!spec) return null;

  // Το μοτίβο κλιμακώνεται στο **μήκος αυτής** της γραμμής, από την ίδια μηχανή thumbnail που
  // χρησιμοποιεί κάθε άλλη προεπισκόπηση: μια σταθερή `strokeDasharray` θα έδειχνε την ίδια
  // διακεκομμένη για κάθε μοτίβο και θα έσπαγε στη διαγώνιο (που είναι 22% μακρύτερη).
  const thumb = buildLinetypeThumbnailFromPattern(
    spec.dashMm ?? [],
    tableBorderProxyLineLength(id),
  );
  return (
    <line
      x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
      stroke={spec.colorHex}
      strokeWidth={tableLinePreviewStrokeWidth(spec.widthMm)}
      strokeDasharray={thumb.dash.length > 0 ? thumb.dash.join(' ') : undefined}
    />
  );
}
