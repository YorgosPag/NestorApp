/**
 * Χ — **ΚΟΥΜΠΙ ΧΩΡΙΣ ΧΕΙΡΙΣΤΗ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ** στη γραμμή εργαλείων (ADR-329 §3.9).
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-12 στον κώδικα**: το `CompactToolbarActions` ζωγράφιζε κάθε ενέργεια που το
 * config δήλωνε διαθέσιμη, **χωρίς να ρωτά αν ο καταναλωτής έδωσε χειριστή**. Η λίστα ακινήτων περνούσε
 * `onExport={() => {}}` · `onRefresh={() => {}}` · `onSettings={() => {}}` και **κανέναν** χειριστή για εισαγωγή ·
 * προεπισκόπηση · κοινοποίηση · αναφορές · διαχείριση αγαπημένων · βοήθεια ⇒ δέκα ζωντανά κουμπιά που δεν έκαναν
 * τίποτα. Κτίρια · αποθήκες · στάθμευση περνούσαν `() => logger.info(…)`: το ίδιο ψέμα με άλλη γραφή.
 *
 * 🔑 Δύο κανόνες, και οι δύο **δομικοί**:
 *  • ενέργεια που **δεν υλοποιείται** σε αυτή τη λίστα ⇒ **δεν ζωγραφίζεται** (το config λέει «επιτρέπεται», ο
 *    χειριστής λέει «υπάρχει» — χρειάζονται και τα δύο)·
 *  • νέο · επεξεργασία · διαγραφή χωρίς χειριστή ⇒ **ανενεργά** (υπάρχουν, αλλά όχι σε κάδο/αρχείο) — αμετάβλητο.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | ο φρουρός ξεχνά τον χειριστή (`enabled` μόνο) | Χ1 |
 * | ο φρουρός ξεχνά το config (`onClick` μόνο) | Χ3 |
 * | το «+» χωρίς χειριστή παύει να ζωγραφίζεται | Χ4 |
 * | τα αγαπημένα ξαναγίνονται `logger.info` | Χ1 · Χ5 |
 * | καταναλωτής ξαναπερνά `() => {}` / `() => logger.info(…)` | Χ6 |
 */

/* global describe, it, expect, jest */

import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import { CompactToolbarActions } from '../CompactToolbarActions';
import { propertiesToolbarConfig, communicationsConfig } from '../configs';
import type { CompactToolbarConfig } from '../types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type ActionsProps = Parameters<typeof CompactToolbarActions>[0];

/** Το όνομα προσβασιμότητας κάθε κουμπιού είναι το κλειδί του tooltip του (το `getTooltip` εδώ είναι ταυτότητα). */
function renderActions(props: Partial<ActionsProps> & { config: CompactToolbarConfig }) {
  return render(
    <TooltipProvider>
      <CompactToolbarActions getTooltip={(key) => key} {...props} />
    </TooltipProvider>,
  );
}

const button = (tooltipKey: string) => screen.queryByRole('button', { name: tooltipKey });

/** Κάθε προαιρετική ενέργεια που το config των ακινήτων δηλώνει διαθέσιμη. */
const OPTIONAL_TOOLTIPS = (['favorites', 'export', 'import', 'refresh', 'preview', 'copy', 'share', 'reports', 'settings', 'favoritesManagement', 'help'] as const)
  .map((action) => propertiesToolbarConfig.tooltips[action]);

describe('Χ — προαιρετική ενέργεια χωρίς χειριστή', () => {
  it('🔴 Χ1 — το config τις δηλώνει ΟΛΕΣ, κανείς δεν έδωσε χειριστή ⇒ ΚΑΜΙΑ δεν ζωγραφίζεται', () => {
    renderActions({ config: propertiesToolbarConfig, onNewItem: jest.fn(), onEditItem: jest.fn(), onDeleteItems: jest.fn() });

    expect(OPTIONAL_TOOLTIPS.filter((tooltip) => button(tooltip) !== null)).toEqual([]);
    expect(button(communicationsConfig.tooltips.archive)).toBeNull();
  });

  it('🔴 Χ2 — με χειριστή ζωγραφίζεται, και το κλικ ΦΤΑΝΕΙ', async () => {
    const onExport = jest.fn();
    renderActions({ config: propertiesToolbarConfig, onExport });

    await userEvent.click(screen.getByRole('button', { name: propertiesToolbarConfig.tooltips.export }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('🔴 Χ3 — χειριστής ΧΩΡΙΣ δήλωση στο config ⇒ δεν ζωγραφίζεται (χρειάζονται και τα δύο)', () => {
    const config: CompactToolbarConfig = {
      ...propertiesToolbarConfig,
      availableActions: { ...propertiesToolbarConfig.availableActions, export: false },
    };
    renderActions({ config, onExport: jest.fn() });

    expect(button(config.tooltips.export)).toBeNull();
  });

  it('✅ Χ4 — νέο · επεξεργασία · διαγραφή χωρίς χειριστή μένουν ΟΡΑΤΑ και ανενεργά (κάδος/αρχείο)', () => {
    renderActions({ config: propertiesToolbarConfig, hasSelectedContact: true });

    for (const action of ['newItem', 'editItem', 'deleteItems'] as const) {
      expect(screen.getByRole('button', { name: propertiesToolbarConfig.tooltips[action] })).toBeDisabled();
    }
  });

  it('🔴 Χ5 — αγαπημένα · αρχειοθέτηση: ο χειριστής παίρνει την ΕΠΙΛΟΓΗ, και χωρίς επιλογή το κουμπί είναι ανενεργό', async () => {
    const onFavorites = jest.fn();
    const onArchive = jest.fn();
    const { rerender } = renderActions({ config: communicationsConfig, onFavorites, onArchive });
    expect(screen.getByRole('button', { name: communicationsConfig.tooltips.favorites })).toBeDisabled();
    expect(screen.getByRole('button', { name: communicationsConfig.tooltips.archive })).toBeDisabled();

    rerender(
      <TooltipProvider>
        <CompactToolbarActions
          getTooltip={(key) => key}
          config={communicationsConfig}
          selectedItems={['a', 'b']}
          onFavorites={onFavorites}
          onArchive={onArchive}
        />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: communicationsConfig.tooltips.favorites }));
    await userEvent.click(screen.getByRole('button', { name: communicationsConfig.tooltips.archive }));

    expect(onFavorites).toHaveBeenCalledWith(['a', 'b']);
    expect(onArchive).toHaveBeenCalledWith(['a', 'b']);
  });
});

/**
 * Ο φρουρός κλείνει το «χωρίς χειριστή»· **δεν** μπορεί να δει χειριστή που υπάρχει και δεν κάνει τίποτα. Αυτό
 * είναι ανάγνωση πηγαίου: κάθε αρχείο που αναφέρει τη γραμμή εργαλείων, για κάθε προαιρετική ενέργεια.
 *
 * ⚠️ `onNewItem` · `onEditItem` · `onDeleteItems` **δεν** σαρώνονται εδώ — δες το changelog του ADR-329 (2026-10-12).
 */
describe('Χ — κανένας καταναλωτής δεν περνά ψεύτικο χειριστή', () => {
  const SRC = path.resolve(__dirname, '../../../..');
  const FAKE_HANDLER = /\bon(?:Export|Import|Refresh|Preview|Copy|Share|Reports|Settings|FavoritesManagement|Help|Favorites|Archive)=\{\s*\([^)]*\)\s*=>\s*(?:\{\s*\}|undefined|void 0|null|logger\.\w+\()/g;

  function toolbarConsumers(dir: string, found: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) toolbarConsumers(full, found);
      else if (entry.name.endsWith('.tsx') && fs.readFileSync(full, 'utf8').includes('CompactToolbar')) found.push(full);
    }
    return found;
  }

  it('🔴 Χ6 — `() => {}` · `() => undefined` · `() => logger.info(…)` δεν δίνονται σε ενέργεια της γραμμής εργαλείων', () => {
    const consumers = toolbarConsumers(SRC);
    expect(consumers.length).toBeGreaterThan(8);

    const offenders = consumers.flatMap((file) =>
      (fs.readFileSync(file, 'utf8').match(FAKE_HANDLER) ?? []).map((hit) => `${path.relative(SRC, file).replace(/\\/g, '/')} · ${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
