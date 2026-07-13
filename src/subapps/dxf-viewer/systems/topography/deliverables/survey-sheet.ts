/**
 * ADR-650 M7 — οι ίδιοι πίνακες, ως ΓΕΩΜΕΤΡΙΑ μέσα στο σχέδιο (ο δρόμος του CAD).
 *
 * Δεν γράφεται δεύτερη μηχανή διάταξης: ο πίνακας χτίζεται με το ΥΠΑΡΧΟΝ `buildScheduleTable`
 * (ADR-622, `DetailPrimitive[]` σε sheet-mm) — το ίδιο που ζωγραφίζει τα φύλλα οπλισμού και την
 * πινακίδα σχεδίου (ADR-651). Ο μετασχηματισμός σε entities γίνεται από το τρίτο backend
 * (`detailPrimitivesToEntities`), οπότε preview === PDF === in-scene παραμένει μία αλήθεια.
 *
 * ⚠️ Ο πίνακας ΣΥΝΤΕΤΑΓΜΕΝΩΝ δεν μπαίνει στο σχέδιο όταν τα σημεία είναι πολλά: ένα σχέδιο με
 * 3.000 γραμμές κειμένου δεν είναι σχέδιο. Αυτό είναι και η πρακτική των μεγάλων (Civil 3D):
 * στο διάγραμμα μπαίνει ο πίνακας ΚΟΡΥΦΩΝ του οικοπέδου· η πλήρης λίστα σημείων είναι ΑΡΧΕΙΟ.
 * Η παράλειψη ΔΕΝ είναι σιωπηλή — επιστρέφεται ως `droppedCoordinates` και η UI το λέει.
 */

// Απευθείας από τα pure formatters, ΟΧΙ από το barrel των exporters: ο δρόμος «πίνακας μέσα στο
// σχέδιο» δεν πρέπει να σέρνει jsPDF/exceljs στο bundle (ούτε στα tests) — δεν τα χρειάζεται.
import type { ExportableTableSection, ScheduleColumnDef } from '../../../bim/schedule/types';
import type { HeaderTranslator } from '../../../bim/schedule/exporters/csv-exporter';
import { formatCellForDisplay } from '../../../bim/schedule/exporters/value-formatters';
import {
  buildScheduleTable,
  type ScheduleColumn,
} from '../../../bim/structural/detail-sheet/detail-sheet-schedule-table';
import type { DetailPrimitive } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import type { SurveyDeliverables } from './build-survey-deliverables';

/** Πλάτος του «φύλλου» πινάκων σε sheet-mm (ίδιο με το max πλάτος πινακίδας, ISO 5457). */
export const SHEET_WIDTH_MM = 180;

/** Πάνω από τόσες γραμμές, ο πίνακας συντεταγμένων μένει ΜΟΝΟ στα αρχεία (βλ. σχόλιο αρχείου). */
export const MAX_IN_SCENE_COORDINATE_ROWS = 60;

const HEADING_MM = 3.6;
const HEADING_OFFSET_MM = 5;
const ROW_H_MM = 7.5;
/** Το `buildScheduleTable` αφήνει 11mm πάνω pad (καθαρίζει την επικεφαλίδα) + header + total rule. */
const TABLE_CHROME_MM = 11 + ROW_H_MM * 2.5;
const SECTION_GAP_MM = 6;
const HEADING_HEX = '#222222';

/** Ισοκατανεμημένα x-anchors· η στοίχιση έρχεται από τον ορισμό της στήλης. */
function toSheetColumns(columns: readonly ScheduleColumnDef[]): ScheduleColumn[] {
  const last = Math.max(columns.length - 1, 1);
  return columns.map((c, i) => ({ frac: i / last, align: c.align }));
}

function heading(text: string, y: number): DetailPrimitive {
  return {
    kind: 'text',
    position: { x: 0, y: y + HEADING_OFFSET_MM },
    text,
    heightMm: HEADING_MM,
    colorHex: HEADING_HEX,
    align: 'left',
    bold: true,
  };
}

export interface SurveySheet {
  readonly primitives: readonly DetailPrimitive[];
  /** Συνολικό ύψος σε sheet-mm — το datum του y-flip προς τη σκηνή. */
  readonly heightMm: number;
}

/** Οι ενότητες, στοιβαγμένες κάθετα σε ένα φύλλο sheet-mm. */
export function buildSurveySheet(
  sections: readonly ExportableTableSection[],
  translateHeader: HeaderTranslator,
): SurveySheet {
  const primitives: DetailPrimitive[] = [];
  let y = 0;

  for (const section of sections) {
    const { columns, rows } = section.table;
    const height = TABLE_CHROME_MM + rows.length * ROW_H_MM;

    primitives.push(heading(section.title, y));
    primitives.push(
      ...buildScheduleTable({
        region: { x: 0, y, w: SHEET_WIDTH_MM, h: height },
        columns: toSheetColumns(columns),
        header: columns.map((c) => translateHeader(c.i18nKey)),
        rows: rows.map((row) =>
          columns.map((c) => formatCellForDisplay(row.cells[c.key] ?? null, c.valueType)),
        ),
        total: [],
      }),
    );

    y += height + SECTION_GAP_MM;
  }

  return { primitives, heightMm: Math.max(y, 1) };
}

export interface InSceneSections {
  readonly sections: readonly ExportableTableSection[];
  /** true ⇒ ο πίνακας συντεταγμένων ήταν πολύ μεγάλος και έμεινε μόνο στα αρχεία. */
  readonly droppedCoordinates: boolean;
}

/**
 * Ποιοι πίνακες αξίζουν να μπουν ΜΕΣΑ στο σχέδιο. Ο πίνακας συντεταγμένων είναι πάντα ο πρώτος
 * (`sections[0]`, όταν υπάρχουν σημεία) — αν ξεπερνά το όριο γραμμών, κόβεται από το σχέδιο και
 * μένει στον φάκελο αρχείων.
 */
export function selectInSceneSections(
  deliverables: SurveyDeliverables,
  maxCoordinateRows: number = MAX_IN_SCENE_COORDINATE_ROWS,
): InSceneSections {
  const sections = deliverables.sections.filter((section, i) => {
    const isCoordinateTable = i === 0 && !deliverables.warnings.includes('no-points');
    return !isCoordinateTable || section.table.rows.length <= maxCoordinateRows;
  });
  return {
    sections,
    droppedCoordinates: sections.length < deliverables.sections.length,
  };
}
