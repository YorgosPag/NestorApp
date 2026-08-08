/**
 * ADR-739 §64 — **ο ΕΝΑΣ αδρανής σκελετός props** του `TableHeaderContextMenu` για tests.
 *
 * ## Γιατί εξήχθη (και δεν αντιγράφηκε)
 * Το §64 χρειάστηκε να μοντάρει το ίδιο μενού σε **δεύτερη** σουίτα (η άγκυρα «η γραμμή
 * υποχωρεί στον διάλογο»). Ο σκελετός είναι ~50 γραμμές αδρανών χειριστών — δηλαδή ακριβώς
 * το μέγεθος που το **CHECK 3.28** (jscpd, `min-tokens: 50`) μετρά ως κλώνο. Η αντιγραφή θα
 * ήταν sibling clone γεννημένος **μέσα στο ίδιο commit** που τον απαγορεύει (N.18).
 *
 * ⚠️ Κάθε χειριστής είναι **αδρανής επίτηδες**: αυτές οι σουίτες δοκιμάζουν τον **κύκλο ζωής**
 * των επιφανειών, όχι τις πράξεις. Όποιο test θέλει να δει πράξη περνά δικό του `jest.fn()`
 * με spread πάνω από τον σκελετό (`{...headerMenuProps, onToggleFormat}`), όπως ήδη κάνει το
 * `table-format-toolbar.test.tsx`.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/__tests__/table-header-menu-props.fixture
 */

import type { TableFormatSnapshot, TableToggleFormatState } from '../TableFormatToolbar';

const noop = (): void => {};

const NO_FORMAT: TableToggleFormatState = { active: false, mixed: false, explicit: false };

/** Ό,τι χρειάζεται το `TableHeaderContextMenu` με αδρανείς χειριστές. */
export const headerMenuProps = {
  onInsertBefore: noop,
  onInsertAfter: noop,
  onDelete: noop,
  resolveState: () => ({ label: 'B', axisLabel: 'B', count: 1, canInsert: true, canDelete: true }),
  resolveFormat: (): TableFormatSnapshot => ({
    bold: NO_FORMAT,
    italic: NO_FORMAT,
    underline: NO_FORMAT,
    textColor: {
      current: '#111111', mixed: false, explicit: false, inheritedColor: '#111111', inheritedMixed: false,
      drawingColors: [],
    },
    fillColor: {
      current: undefined, mixed: false, explicit: false, inheritedColor: undefined, inheritedMixed: false,
      drawingColors: [],
    },
    canReset: false,
  }),
  onStepTextHeight: noop,
  onResetFormat: noop,
  // ADR-739 Φ.Ε/Φ4 + Φ4β — τα δύο χρώματα του ίδιου μενού.
  onSetTextColor: noop,
  onSetFillColor: noop,
  // ADR-739 §55 — τα τρία τμήματα (τυπογραφία / αριθμός / στοίχιση)· αδρανή εδώ, δοκιμάζονται
  // στο `table-toolbar-extras.test.ts` και στο `table-format-snapshot-readers.test.ts`.
  resolveToolbar: () => ({
    fonts: { family: { current: undefined, mixed: false }, size: { current: undefined, mixed: false } },
    fontNames: [],
    numberFormat: { current: null, explicit: false },
    align: null,
  }),
  onSetFormatField: noop,
  /**
   * ADR-750 Φ5 — το dropdown περιγραμμάτων ως **μία** απάντηση (Φ3/Φ5 refactor).
   *
   * `resolvePencil: () => null` ⇒ η ζώνη σχεδίασης δεν αποδίδεται καθόλου: αυτές οι σουίτες
   * δοκιμάζουν τη γραμμή μορφοποίησης, όχι το μολύβι, και μια ζώνη με εφευρημένο μολύβι θα
   * ήταν θόρυβος σε κάθε `getByRole` τους. Το μολύβι έχει δική του σουίτα.
   */
  resolveBorderMenu: () => ({
    canReset: false,
    canClearDiagonals: false,
    onApply: noop,
    onReset: noop,
    onApplyDiagonal: noop,
    resolvePencil: () => null,
  }),
  // ADR-755 — το split button συγχώνευσης· ίδιο σχήμα «μία απάντηση» με τα περιγράμματα.
  resolveMergeMenu: () => ({
    state: { merged: false, canMerge: true },
    onApply: noop,
  }),
};
