'use client';

/**
 * ADR-833 §1.3 — Ο host των δύο εντολών `.xlsx`: **ένα** κρυφό `<input type="file">` και οι δύο
 * listeners της κορδέλας. Mirror του `AttachImageHost` (ADR-736 §6) — ίδιο ιδίωμα:
 * action → EventBus → `input.click()`.
 *
 * ## 🔴 ΕΝΑ input, ΔΥΟ εντολές — και ο λόγος δεν είναι η οικονομία
 * Το `accept` είναι το ίδιο (`.xlsx,.xlsm`) και ο επιλογέας είναι μοντικός: δύο κρυφά inputs θα
 * σήμαιναν δύο δρόμοι που μπορούν να είναι **ταυτόχρονα ανοιχτοί** στη σκέψη του κώδικα, ενώ
 * στην οθόνη υπάρχει πάντα ένας. Η **πρόθεση** ταξιδεύει σε ref, όχι σε δεύτερο DOM κόμβο.
 *
 * ## ⚠️ Η πρόθεση διαβάζεται σε event time
 * Το `pendingRef` γράφεται από τον listener και διαβάζεται από το `onChange` — ποτέ σε render.
 * Ο χρήστης μπορεί να πατήσει «Άνοιγμα», να ακυρώσει τον επιλογέα, και μετά «Εισαγωγή»: μια
 * τιμή κλεισμένη σε render θα εκτελούσε την **προηγούμενη** πρόθεση πάνω στο νέο αρχείο.
 *
 * Δεν αποδίδει τίποτα ορατό — η απόφαση ζει στο `useTableXlsxImport`, το κουμπί στην κορδέλα.
 *
 * @see ./useTableXlsxImport.ts — τι γίνεται με το αρχείο
 * @see ../ribbon/hooks/bridge/table-format-field-routing.ts — ο εκπομπός των δύο συμβάντων
 */

import React from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { useTableXlsxImport, TABLE_XLSX_ACCEPT } from './useTableXlsxImport';
import type { UseTableXlsxImportParams } from './useTableXlsxImport';

/** Ποια από τις δύο εντολές άνοιξε τον επιλογέα. */
type XlsxIntent = 'open' | 'import';

export function TableXlsxImportHost(props: UseTableXlsxImportParams): React.JSX.Element {
  const { onOpenFilePicked, onImportFilePicked } = useTableXlsxImport(props);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const intentRef = React.useRef<XlsxIntent>('open');

  React.useEffect(() => {
    const openOff = EventBus.on('dxf:table-open-xlsx-requested', () => {
      intentRef.current = 'open';
      inputRef.current?.click();
    });
    const importOff = EventBus.on('dxf:table-import-xlsx-requested', () => {
      intentRef.current = 'import';
      inputRef.current?.click();
    });
    return () => {
      openOff();
      importOff();
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="file"
      accept={TABLE_XLSX_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Ο επιλογέας μηδενίζεται ΠΑΝΤΑ: αλλιώς η δεύτερη επιλογή του ΙΔΙΟΥ αρχείου δεν
        // εκπέμπει `change` και το κουμπί μοιάζει νεκρό (η κλασική παγίδα του file input).
        e.target.value = '';
        if (!file) return;
        void (intentRef.current === 'open' ? onOpenFilePicked(file) : onImportFilePicked(file));
      }}
    />
  );
}
