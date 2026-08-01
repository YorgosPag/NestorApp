/**
 * ADR-739 Φ.Δ βήμα 4 — **ο χώρος ονομάτων της γραμμής εντολών είναι ΕΝΑΣ, τα μητρώα δύο.**
 *
 * ## Γιατί αυτό το test είναι το τίμημα του δεύτερου μητρώου
 * Το `CommandActionRegistry` γεννήθηκε επειδή το `CommandAliasRegistry` χαρτογραφεί
 * `alias → ToolType` και δεν μπορεί να εκφράσει «ενέργησε πάνω στην επιλογή». Δύο μητρώα
 * όμως μοιράζονται **έναν** χώρο ονομάτων: ό,τι πληκτρολογεί ο χρήστης. Η αστοχία δεν θα
 * ήταν σφάλμα μεταγλώττισης ούτε εξαίρεση — θα ήταν **σιωπή**: κάποιος προσθέτει `TE` ως
 * συντόμευση του `TEXT`, ο εκτελεστής ρωτά πρώτα τις ενέργειες, και η εντολή `TEXT` παύει
 * να λειτουργεί για πάντα χωρίς να το δει κανείς.
 *
 * Είναι η ίδια απάντηση που δίνει το VS Code στο ίδιο πρόβλημα (`when`-clause contexts:
 * δηλωτικά keybindings αντί για σκορπισμένα `if`) — και το «έξυπνο ερώτημα» της έρευνας
 * αυτού του βήματος: **η δήλωση είναι δεδομένα, άρα η σύγκρουση είναι ελέγξιμη**.
 *
 * ⚠️ Αν αυτό το test γίνει κόκκινο, ΜΗΝ το χαλαρώσεις. Μετονόμασε το alias.
 *
 * @see systems/command-line/CommandActionRegistry.ts
 * @see systems/command-line/CommandAliasRegistry.ts
 */

import { getAllAliases } from '../CommandAliasRegistry';
import {
  getAllCommandActionAliases,
  getMatchingCommandActions,
  resolveCommandAction,
  registerCommandAction,
  runCommandAction,
  __resetCommandActionRunnersForTests,
} from '../CommandActionRegistry';

beforeEach(() => {
  __resetCommandActionRunnersForTests();
});

describe('ο χώρος ονομάτων της γραμμής εντολών', () => {
  it('🔴 ΜΗΔΕΝΙΚΗ ΤΟΜΗ μεταξύ aliases εργαλείων και aliases ενεργειών', () => {
    const toolAliases = new Set(getAllAliases().map((e) => e.alias.toUpperCase()));
    const collisions = getAllCommandActionAliases()
      .map((e) => e.alias.toUpperCase())
      .filter((alias) => toolAliases.has(alias));

    expect(collisions).toEqual([]);
  });

  it('φύλακας κατά σιωπηλά κενής σύγκρισης — και τα δύο μητρώα είναι μη κενά', () => {
    expect(getAllAliases().length).toBeGreaterThan(100);
    expect(getAllCommandActionAliases().length).toBeGreaterThan(0);
  });

  it('κανένα alias ενέργειας δεν είναι κενό ή με κενά διαστήματα', () => {
    for (const { alias } of getAllCommandActionAliases()) {
      expect(alias).toBe(alias.trim().toUpperCase());
      expect(alias.length).toBeGreaterThan(0);
    }
  });
});

describe('resolveCommandAction', () => {
  it.each(['TABLEDIT', 'tabledit', '  tabledit  ', 'TE', 'te'])(
    '«%s» ⇒ table.edit (case-insensitive + trim, όπως τα aliases εργαλείων)',
    (input) => {
      expect(resolveCommandAction(input)).toBe('table.edit');
    },
  );

  it('άγνωστο alias ⇒ null (ώστε ο εκτελεστής να δοκιμάσει τα εργαλεία)', () => {
    expect(resolveCommandAction('L')).toBeNull();
    expect(resolveCommandAction('ΑΝΥΠΑΡΚΤΟ')).toBeNull();
  });
});

describe('runCommandAction — ο εκτελεστής', () => {
  it('χωρίς εγγεγραμμένο εκτελεστή ⇒ false, και τίποτα δεν εκτελείται', () => {
    expect(runCommandAction('table.edit')).toBe(false);
  });

  it('με εκτελεστή που ΔΕΝ μπορεί τώρα ⇒ false, το `run` δεν καλείται', () => {
    const run = jest.fn();
    registerCommandAction('table.edit', { canRun: () => false, run });
    expect(runCommandAction('table.edit')).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('με εκτελεστή που μπορεί ⇒ true και εκτελείται ακριβώς μία φορά', () => {
    const run = jest.fn();
    registerCommandAction('table.edit', { canRun: () => true, run });
    expect(runCommandAction('table.edit')).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('το `canRun` ρωτιέται ΤΗ ΣΤΙΓΜΗ της εντολής, όχι στην εγγραφή', () => {
    let ready = false;
    const run = jest.fn();
    registerCommandAction('table.edit', { canRun: () => ready, run });

    expect(runCommandAction('table.edit')).toBe(false);
    ready = true;
    expect(runCommandAction('table.edit')).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('η αποδέσμευση σβήνει τον εκτελεστή· δεύτερη κλήση της είναι αβλαβής', () => {
    const release = registerCommandAction('table.edit', { canRun: () => true, run: jest.fn() });
    release();
    release();
    expect(runCommandAction('table.edit')).toBe(false);
  });

  it('🔴 StrictMode: καθυστερημένη αποδέσμευση ΔΕΝ σβήνει τον νεότερο εκτελεστή', () => {
    const first = { canRun: () => true, run: jest.fn() };
    const second = { canRun: () => true, run: jest.fn() };

    const releaseFirst = registerCommandAction('table.edit', first);
    registerCommandAction('table.edit', second);
    // Το διπλό effect του React StrictMode: ο πρώτος αποδεσμεύεται ΑΦΟΥ ο δεύτερος έχει
    // ήδη εγγραφεί. Μια αφελής `delete` θα άφηνε την εντολή νεκρή.
    releaseFirst();

    expect(runCommandAction('table.edit')).toBe(true);
    expect(second.run).toHaveBeenCalledTimes(1);
    expect(first.run).not.toHaveBeenCalled();
  });
});

describe('getMatchingCommandActions — autocomplete', () => {
  it('κενό πρόθεμα ⇒ καμία υπόδειξη (δεν ξεχειλίζει το popover)', () => {
    expect(getMatchingCommandActions('')).toEqual([]);
  });

  it('«TAB» ⇒ προτείνει TABLEDIT', () => {
    expect(getMatchingCommandActions('TAB').map((e) => e.alias)).toContain('TABLEDIT');
  });

  it('πρόθεμα που δεν ταιριάζει ⇒ κενό', () => {
    expect(getMatchingCommandActions('ZZZ')).toEqual([]);
  });
});
