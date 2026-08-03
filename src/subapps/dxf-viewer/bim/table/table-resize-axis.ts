/**
 * Ο **άξονας** μιας χειρονομίας αλλαγής μεγέθους πίνακα — μία λέξη, ένα αρχείο.
 *
 * Ζει χωριστά (και στο `bim/`, όχι στο `ui/`) επειδή τον χρειάζονται **και οι δύο** πλευρές:
 * η χειρονομία (`ui/table-cell-editor/table-axis-resize-drag`) και η καθαρή ένδειξη
 * (`bim/table/table-resize-readout`). Δηλωμένος στη μία, εισαγόμενος από την άλλη, θα ήταν
 * εισαγωγή `bim → ui` — δηλαδή ο κώδικας σχεδίου θα εξαρτιόταν από τη διεπαφή, ακριβώς η
 * κατεύθυνση που το subapp κρατά καθαρή.
 *
 * @module subapps/dxf-viewer/bim/table/table-resize-axis
 */

export type TableResizeAxis = 'column' | 'row';
