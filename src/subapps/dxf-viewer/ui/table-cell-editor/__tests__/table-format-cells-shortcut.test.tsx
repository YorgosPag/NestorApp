/**
 * 🔴 ADR-739 §61 — **`Ctrl+1`: ένα πλήκτρο, δύο νόμιμοι ιδιοκτήτες.**
 *
 * ## Τι κλειδώνεται, και γιατί το πρώτο test είναι ΜΕΤΡΗΣΗ και όχι έλεγχος
 * Η αναφορά της Φάσης Ε ισχυριζόταν ότι το `Ctrl+1` «είναι ήδη πιασμένο από την Παλέτα
 * Ιδιοτήτων», δηλαδή ότι υπάρχει **σύγκρουση**. Ο συλλογισμός που το ανέτρεψε («ο φύλακας
 * `INPUT`/`TEXTAREA` υπάρχει ήδη, και ο δρομέας κελιού είναι `<textarea>`, άρα το πλήκτρο δεν
 * κάνει τίποτα — τρύπα, όχι σύγκρουση») ήταν **ανεπαλήθευτος**: στηριζόταν στο ότι το `e.target`
 * ενός `keydown` με `capture` στο `window` είναι το **εστιασμένο** πεδίο και όχι το `window`.
 *
 * Το `Κ0` το μετρά με πραγματικό DOM. Είναι η τέταρτη φορά σε αυτή την εκστρατεία που ένας
 * ισχυρισμός στέλνεται στον έλεγχο· οι τρεις προηγούμενοι κατέρρευσαν.
 *
 * @see ../table-format-cells-shortcut.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import {
  __resetTableFormatCellsDialogForTests,
  closeTableFormatCellsDialog,
  getTableFormatCellsRequest,
  openTableFormatCellsDialog,
} from '../../../state/table-format-cells-dialog-store';
import {
  __resetTableFormatPortForTests,
  setTableFormatPort,
} from '../table-format-port';
import { claimTableFormatCellsShortcut } from '../table-format-cells-shortcut';
import { fakeTableFormatPort } from './fake-table-format-port';
import type { FormatTarget } from '../table-format-snapshot';
import type { PersistedTableModel } from '../../../types/table';

beforeEach(() => {
  __resetTableFormatCellsDialogForTests();
  __resetTableFormatPortForTests();
});

function target(): FormatTarget {
  return {
    model: {} as PersistedTableModel,
    style: {} as FormatTarget['style'],
    scope: { kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } },
    layerColors: [],
  };
}

// ── Κ0. Η ΜΕΤΡΗΣΗ ───────────────────────────────────────────────────────────

describe('Κ0 — 🔴 Η ΜΕΤΡΗΣΗ: τι βλέπει ο φύλακας εστίασης με δρομέα σε κελί', () => {
  it('το `e.target` ενός window-capture `keydown` ΕΙΝΑΙ το εστιασμένο `<textarea>`', () => {
    const { getByTestId } = render(<textarea data-testid="cell" defaultValue="" />);
    const field = getByTestId('cell') as HTMLTextAreaElement;
    field.focus();

    const seen: string[] = [];
    const listener = (e: KeyboardEvent): void => {
      seen.push((e.target as HTMLElement).tagName);
    };
    window.addEventListener('keydown', listener, { capture: true });
    field.dispatchEvent(new KeyboardEvent('keydown', {
      key: '1', ctrlKey: true, bubbles: true,
    }));
    window.removeEventListener('keydown', listener, { capture: true });

    // ⇒ Ο φύλακας `INPUT`/`TEXTAREA`/`contentEditable` του `useCanvasSectionUI` **έβγαινε
    // νωρίς**, άρα πριν το §61 το `Ctrl+1` μέσα σε κελί δεν έκανε **απολύτως τίποτα**.
    // Δεν ήταν σύγκρουση δύο συμβάσεων· ήταν τρύπα.
    expect(seen).toEqual(['TEXTAREA']);
  });
});

// ── Κ1-Κ4. Η ΔΙΕΚΔΙΚΗΣΗ ─────────────────────────────────────────────────────

describe('§61 — ποιος παίρνει το `Ctrl+1`', () => {
  it('Κ1 — χωρίς θύρα ⇒ ΔΕΝ το παίρνει (μένει στην Παλέτα Ιδιοτήτων, όπως σήμερα)', () => {
    expect(claimTableFormatCellsShortcut()).toBe(false);
    expect(getTableFormatCellsRequest()).toBeNull();
  });

  it('Κ2 — θύρα ΧΩΡΙΣ στόχο ⇒ ΔΕΝ το παίρνει — το κριτήριο είναι ο δρομέας, όχι η ύπαρξη θύρας', () => {
    // 🔑 Η διάκριση δεν είναι σχολαστικότητα: η θύρα υπάρχει όσο ζει ο **καμβάς**, όχι όσο ζει η
    // συνεδρία πίνακα (τεκμηριωμένη διόρθωση στο `setTableFormatPort`, 2026-08-07). Ένας φύλακας
    // «υπάρχει θύρα ⇒ υπάρχει συνεδρία» θα ήταν μονίμως αληθής — δηλαδή κανένας φύλακας.
    setTableFormatPort(fakeTableFormatPort({ formatTarget: () => null }));
    expect(claimTableFormatCellsShortcut()).toBe(false);
    expect(getTableFormatCellsRequest()).toBeNull();
  });

  it('Κ3 — με στόχο ⇒ το παίρνει και ανοίγει τον διάλογο ΧΩΡΙΣ να δηλώσει καρτέλα', () => {
    const t = target();
    setTableFormatPort(fakeTableFormatPort({ formatTarget: () => t }));
    expect(claimTableFormatCellsShortcut()).toBe(true);
    expect(getTableFormatCellsRequest()?.target).toBe(t);
  });

  it('Κ3β — ανοίγει στην ΤΕΛΕΥΤΑΙΑ καρτέλα που είδε ο χρήστης (Excel)', () => {
    openTableFormatCellsDialog({ target: target(), tab: 'border' });
    closeTableFormatCellsDialog();
    setTableFormatPort(fakeTableFormatPort({ formatTarget: () => target() }));
    claimTableFormatCellsShortcut();
    expect(getTableFormatCellsRequest()?.tab).toBe('border');
  });

  it('Κ4 — 🔴 ΔΕΥΤΕΡΗ ΠΑΤΗΜΑΤΙΑ: καταναλώνει και ΔΕΝ ξανασπέρνει το προσχέδιο', () => {
    const t = target();
    setTableFormatPort(fakeTableFormatPort({ formatTarget: () => t }));
    claimTableFormatCellsShortcut();
    const id = getTableFormatCellsRequest()?.id;

    // Μνήμη χεριού: «δεν έγινε τίποτα;» — και ξαναπατά. Ένα φρέσκο αίτημα εδώ θα έδινε νέο `id`,
    // δηλαδή νέο instance διαλόγου, δηλαδή **σιωπηλή απώλεια** ό,τι είχε ήδη ρυθμίσει.
    expect(claimTableFormatCellsShortcut()).toBe(true);
    expect(getTableFormatCellsRequest()?.id).toBe(id);
  });

  it('Κ4β — και ΔΕΝ πέφτει στην Παλέτα Ιδιοτήτων: `true`, ώστε το «τίποτα» να μην γίνει «κάτι άσχετο»', () => {
    setTableFormatPort(fakeTableFormatPort({
      formatTarget: () => { throw new Error('δεν έπρεπε να ρωτηθεί: ο διάλογος είναι ήδη ανοιχτός'); },
    }));
    openTableFormatCellsDialog({ target: target() });
    expect(claimTableFormatCellsShortcut()).toBe(true);
  });
});

// ── Π. Η ΑΓΚΥΡΑ ΤΗΣ ΣΕΙΡΑΣ ──────────────────────────────────────────────────

/**
 * 🔴 **Η ΠΑΓΙΔΑ ΤΗΣ ΣΕΙΡΑΣ ΚΛΑΔΩΝ, ΚΛΕΙΔΩΜΕΝΗ.**
 *
 * Ο κανόνας «ο πρώτος ιδιοκτήτης που ταιριάζει κερδίζει» (μοντέλο `when` clauses του VS Code)
 * είναι **σειρά**, όχι λογική: αν το `Ctrl+1` μπει **μετά** τον φύλακα εστίασης, η διεκδίκηση
 * δεν εκτελείται ποτέ με δρομέα σε κελί — και **δεν** θα υπάρξει κανένα σφάλμα, καμία
 * προειδοποίηση, καμία κόκκινη σουίτα. Είναι κατά γράμμα η ίδια παγίδα που χτύπησε τέσσερις
 * φορές στο `table-cell-key-intent.ts:346` (§56/§57/§58/§59).
 *
 * Η άγκυρα διαβάζει την **πραγματική πηγή** και όχι αντίγραφο: ένα fixture θα κλείδωνε τη σειρά
 * ενός αρχείου που δεν εκτελείται.
 */
describe('Π — η σειρά των κλάδων στον ΕΝΑ καλούντα', () => {
  const source = readFileSync(
    join(__dirname, '..', '..', '..', 'hooks', 'canvas', 'useCanvasSectionUI.ts'),
    'utf8',
  );

  it('Π1 — ο κλάδος `Ctrl+1` προηγείται του φύλακα `INPUT`/`TEXTAREA`', () => {
    const claim = source.indexOf('claimTableFormatCellsShortcut()');
    const guard = source.indexOf("target.tagName === 'TEXTAREA'");
    expect(claim).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(guard);
  });

  it('Π2 — η ΑΛΛΗ κατεύθυνση επιβιώνει: αν δεν το πάρει κανείς, ανοίγει η Παλέτα Ιδιοτήτων', () => {
    expect(source).toContain('if (!claimTableFormatCellsShortcut()) PropertiesPaletteStore.toggle();');
  });

  it('Π3 — το `F11` μένει ΠΙΣΩ από τον φύλακα: δεν έχει δεύτερο ιδιοκτήτη, δεν αλλάζει', () => {
    const guard = source.indexOf("target.tagName === 'TEXTAREA'");
    expect(source.indexOf("e.key === 'F11'")).toBeGreaterThan(guard);
  });
});
