'use client';

/**
 * 🔴 ADR-751 Φ8.γ — **«Άνοιγμα εντοπισμένου συνδέσμου…»**: οι διευθύνσεις του πίνακα, χωρίς
 * ποντίκι.
 *
 * ## Το προηγούμενο: VS Code, όχι Excel (έρευνα 2026-08-04)
 * Το ερευνητικό εύρημα ήταν ότι **ο ηγέτης της αγοράς έχει κενό**: το Excel δεν προσφέρει
 * **καμία** συντόμευση για άνοιγμα υπερσυνδέσμου — ο μόνος δρόμος χωρίς ποντίκι είναι
 * `Shift+F10` και μετά βέλη μέσα στο μενού. Τα Google Sheets δίνουν `Alt+Enter`, αλλά μόνο
 * για το **τρέχον** κελί: πρέπει πρώτα να ξέρεις πού είναι ο σύνδεσμος.
 *
 * Το VS Code λύνει ακριβώς το δικό μας πρόβλημα — σύνδεσμοι **εντοπισμένοι μέσα σε
 * περιεχόμενο που δεν είναι DOM** — με το `Open Detected Link…` (`Ctrl+Shift+O`): μια λίστα
 * **όλων** των συνδέσμων της οθόνης, με αναζήτηση. Δεν χρειάζεται να ξέρεις πού είναι.
 *
 * ## Γιατί ΚΕΝΤΡΑΡΙΣΜΕΝΗ και όχι αγκυρωμένη στον δείκτη
 * Ο αδελφός `SelectionCyclingPopover` αγκυρώνεται σε `clientX/clientY`, και σωστά: γεννιέται
 * από χειρονομία **ποντικιού**. Και οι δύο πηγές αυτής της λίστας είναι **πληκτρολόγιο** —
 * δεν υπάρχει σημείο να αγκυρωθεί. Δες την κεφαλίδα του store.
 *
 * ## Τι δείχνει κάθε γραμμή, και με ποια σειρά
 * `κείμενο του χρήστη` · `ενέργεια` · `πού` — και το «πού» είναι η **κεφαλίδα της στήλης**
 * όταν υπάρχει (`E-mail`, `Τηλέφωνο`), αλλιώς η αναφορά κελιού (`B3`). Ο άνθρωπος ψάχνει
 * «το τηλέφωνο του Παπαδόπουλου», όχι «το κελί B7»· η αναφορά μένει ως εφεδρεία γιατί είναι
 * η **μόνη** σταθερή ονομασία σε πίνακα χωρίς κεφαλίδες.
 *
 * @module subapps/dxf-viewer/ui/components/TableLinkPicker
 * @see state/table-link-picker-store.ts — η κατάσταση
 * @see systems/selection/SelectionCyclingPopover.tsx — ο αδελφός με ποντίκι
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
import {
  closeTableLinkPicker,
  getTableLinkPicker,
  subscribeTableLinkPicker,
} from '../../state/table-link-picker-store';
import { openCellLink } from '../../bim/table/table-link-interaction-2d';
import { LINK_ACTION_KEY } from '../../bim/table/table-link-labels';
import type { TableCellLinkEntry } from '../../bim/table/table-cell-link-index';

export function TableLinkPicker() {
  const state = useSyncExternalStore(
    subscribeTableLinkPicker,
    getTableLinkPicker,
    getTableLinkPicker,
  );

  /**
   * ⚠️ Το `Esc` δηλώνεται **έξω** από τη συνθήκη μονταρίσματος, γιατί τα hooks δεν επιτρέπεται
   * να είναι υπό συνθήκη — και το `canHandle` το κάνει **αδρανές** όσο η λίστα είναι κλειστή,
   * ακριβώς όπως απαιτεί ρητά η προειδοποίηση του `escape-priority`. Ένας handler που
   * απαντούσε πάντα θα κατανάλωνε **κάθε** `Esc` της εφαρμογής.
   */
  useEscapeHandler({
    id: 'table-link-picker/close',
    // Όσο η λίστα είναι ανοιχτή ο χρήστης απαντά σε ερώτηση: ο καμβάς είναι μπλοκαρισμένος,
    // που είναι ακριβώς η σημασία του P1000 (δες `escape-priority`).
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => getTableLinkPicker() !== null,
    handle: () => {
      closeTableLinkPicker();
      return true;
    },
  });

  if (!state || typeof document === 'undefined') return null;
  return createPortal(<TableLinkPickerBody state={state} />, document.body);
}

function TableLinkPickerBody({
  state,
}: {
  readonly state: NonNullable<ReturnType<typeof getTableLinkPicker>>;
}) {
  const { t } = useTranslation('dxf-viewer');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Το φίλτρο κοιτά **και τα τρία** πεδία που βλέπει ο χρήστης — το κείμενο, την κεφαλίδα
   * στήλης και την αναφορά κελιού. Αναζήτηση μόνο στο κείμενο θα απαντούσε «κανένα» σε
   * κάποιον που πληκτρολογεί «E-mail», δηλαδή ακριβώς αυτό που διαβάζει στην οθόνη.
   */
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return state.links;
    return state.links.filter((entry) =>
      `${entry.span.text} ${entry.columnHeader} ${entry.a1}`.toLocaleLowerCase().includes(needle),
    );
  }, [query, state.links]);

  // Ο δείκτης δεν επιτρέπεται να δείχνει έξω από τη φιλτραρισμένη λίστα: αλλιώς το `Enter`
  // μετά από πληκτρολόγηση θα άνοιγε **τίποτα** — ή, χειρότερα, άλλον σύνδεσμο.
  const index = Math.min(active, Math.max(0, matches.length - 1));

  const choose = useCallback((entry: TableCellLinkEntry | undefined) => {
    if (!entry) return;
    closeTableLinkPicker();
    openCellLink(entry.span.href);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => Math.min(i + 1, matches.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(matches[index]);
      }
      // Το `Escape` **δεν** πιάνεται εδώ: ανήκει στον bus (ADR-364), που είναι ο ΕΝΑΣ
      // διαιτητής. Ένας τοπικός έλεγχος θα ήταν δεύτερος ιδιοκτήτης του ίδιου πλήκτρου.
    },
    [matches, index, choose],
  );

  const title =
    state.scope === 'cell'
      ? t('tableCellLink.pickerTitleCell', { cell: state.links[0]?.a1 ?? '' })
      : t('tableCellLink.pickerTitle');

  return (
    <div
      className="fixed inset-0 z-[var(--z-index-picker-overlay)] flex items-start justify-center bg-black/20 pt-[12vh]"
      onMouseDown={closeTableLinkPicker}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[min(34rem,92vw)] overflow-hidden rounded-md border border-border bg-popover shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
          <h2 className="text-xs font-medium text-popover-foreground">{title}</h2>
          <span className="text-[11px] text-muted-foreground">
            {t('tableCellLink.pickerCount', { count: state.links.length })}
          </span>
        </header>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={t('tableCellLink.pickerPlaceholder')}
          aria-label={t('tableCellLink.pickerPlaceholder')}
          aria-controls="table-link-picker-list"
          className="w-full border-b border-border bg-transparent px-3 py-2 text-xs text-popover-foreground outline-none placeholder:text-muted-foreground"
        />

        {matches.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            {t(state.links.length === 0 ? 'tableCellLink.pickerEmpty' : 'tableCellLink.pickerNoMatch')}
          </p>
        ) : (
          <ul id="table-link-picker-list" role="listbox" aria-label={title} className="max-h-72 overflow-y-auto py-1">
            {matches.map((entry, i) => (
              <li
                key={`${entry.rowId}:${entry.colId}:${entry.span.offsetMm}`}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(entry)}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-xs ${
                  i === index ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{entry.span.text}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t(LINK_ACTION_KEY[entry.span.kind])}
                </span>
                {/* Η κεφαλίδα στήλης είναι το «τι»· η αναφορά κελιού είναι η εφεδρεία, και η
                    ΜΟΝΗ σταθερή ονομασία σε πίνακα χωρίς κεφαλίδες. */}
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {entry.columnHeader || entry.a1}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
