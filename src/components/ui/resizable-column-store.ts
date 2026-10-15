/**
 * @fileoverview **ΠΟΣΟ ΠΛΑΤΙΑ ΕΙΝΑΙ ΜΙΑ ΣΤΗΛΗ ΠΟΥ ΣΕΡΝΕΤΑΙ** — ο κατασκευαστής του ΕΝΟΣ κατόχου πλάτους + απόκρυψης.
 * @related `./resizable-persistence.ts` (**πότε** γράφεται: μόνο στο τέλος μιας χειρονομίας) · `@/lib/storage`
 *   (`safeGetItem`/`safeSetItem` — SSR-safe, quota-safe) · καταναλωτές: η στήλη κατόψεων της περιήγησης (ADR-884) ·
 *   ο επιθεωρητής της κάτοψης ακινήτων (ADR-840 Σ3)
 * @module components/ui/resizable-column-store
 *
 * Ζούσε γραμμένο μέσα στο store της περιήγησης· ο επιθεωρητής ακινήτων χρειάστηκε **ακριβώς** την ίδια λογική, άρα
 * έγινε ένα σημείο (N.0.2). Κάθε καταναλωτής δίνει **τι** (όρια) και **πού** (κλειδί).
 *
 * 🔑 **Όχι `useDefaultLayout` της βιβλιοθήκης** (ADR-724 §5.3): θα γινόταν δεύτερος κάτοχος, και αποθηκεύει **ποσοστά** —
 *   25% δίνει άλλο πλάτος σε άλλη οθόνη. Εδώ ζουν **px**.
 * 🔑 **Η αποθηκευμένη τιμή είναι ιστορικό, όχι αλήθεια**: μπορεί να γράφτηκε από άλλη έκδοση ή να αλλοιώθηκε ⇒ ελέγχεται
 *   και κόβεται στα όρια σε **κάθε** ανάγνωση. Αλλοιωμένη ⇒ προεπιλογή, ποτέ σφάλμα.
 * 🔑 **Η απόκρυψη θυμάται και το πλάτος**: «εμφάνιση» επαναφέρει τη στήλη εκεί που ήταν (VS Code · Figma).
 */

import { clamp } from '@/lib/geometry/scalar';
import { safeGetItem, safeSetItem } from '@/lib/storage';

/**
 * Όρια σε px — τα **ίδια** για το σύρσιμο (`minSize`/`maxSize` του panel) και για την ανάγνωση: ό,τι επιτρέπει το χέρι το
 * θυμάται και η αποθήκευση.
 */
export interface ColumnWidthBounds {
  readonly widthMin: number;
  readonly widthDefault: number;
  readonly widthMax: number;
}

export interface ColumnLayout {
  readonly width: number;
  readonly collapsed: boolean;
}

export interface ColumnLayoutStore {
  readonly bounds: ColumnWidthBounds;
  /** Ό,τι κι αν βρεθεί στην αποθήκευση ⇒ έγκυρη διάταξη, μέσα στα όρια. */
  readonly parse: (raw: unknown) => ColumnLayout;
  readonly read: () => ColumnLayout;
  /**
   * Καταγράφει ό,τι **μέτρησε** το DOM στο τέλος μιας χειρονομίας. `0` px ⇒ η στήλη συμπτύχθηκε: κρατιέται το
   * προηγούμενο πλάτος, ώστε η «εμφάνιση» να επιστρέψει εκεί.
   */
  readonly write: (measuredWidth: number) => ColumnLayout;
}

export function createColumnLayoutStore(storageKey: string, bounds: ColumnWidthBounds): ColumnLayoutStore {
  const fallback: ColumnLayout = { width: bounds.widthDefault, collapsed: false };
  const clampWidth = (width: number): number => Math.round(clamp(width, bounds.widthMin, bounds.widthMax));

  const parse = (raw: unknown): ColumnLayout => {
    if (typeof raw !== 'object' || raw === null) return fallback;
    const { width, collapsed } = raw as { readonly width?: unknown; readonly collapsed?: unknown };
    return {
      width: typeof width === 'number' && Number.isFinite(width) ? clampWidth(width) : fallback.width,
      collapsed: collapsed === true,
    };
  };

  const read = (): ColumnLayout => parse(safeGetItem<unknown>(storageKey, null));

  const write = (measuredWidth: number): ColumnLayout => {
    const previous = read();
    const next = measuredWidth < 1
      ? { width: previous.width, collapsed: true }
      : { width: clampWidth(measuredWidth), collapsed: false };
    if (next.width !== previous.width || next.collapsed !== previous.collapsed) safeSetItem(storageKey, next);
    return next;
  };

  return { bounds, parse, read, write };
}
