/**
 * ADR-651 Φάση Β — wiring specs της «Πινακίδας».
 *
 * Πιάνει τα κλασικά κενά ενός νέου placement tool: ToolType χωρίς entry στο exhaustive
 * `TOOL_DEFINITIONS` (σπάει το build), ribbon κουμπί που δεν δρομολογείται σε tool, i18n
 * κλειδιά που λείπουν από EL ή EN (N.11), και placement που δεν καταλήγει σε `BlockEntity`.
 */

import el from '@/i18n/locales/el/dxf-viewer-shell.json';
import en from '@/i18n/locales/en/dxf-viewer-shell.json';
import { TOOL_DEFINITIONS } from '../../../systems/tools/tool-definitions';
import { INSERT_TAB } from '../../../ui/ribbon/data/insert-tab';
import { buildBlockEntityFromDef } from '../../../bim/block-library/place-block-from-library';
import { TITLE_BLOCK_EL } from '../../templates/defaults/title-blocks';
import { buildTitleBlockDef } from '../title-block-def';

describe('title-block — tool registry', () => {
  it('το ToolType «title-block» έχει entry στο exhaustive registry', () => {
    const tool = TOOL_DEFINITIONS['title-block'];
    expect(tool).toBeDefined();
    expect(tool.id).toBe('title-block');
    expect(tool.category).toBe('drawing');
    expect(tool.requiresCanvas).toBe(true);
    // Συνεχής τοποθέτηση (πολλές πινακίδες χωρίς re-arm), όπως κάθε single-click tool.
    expect(tool.allowsContinuous).toBe(true);
  });
});

describe('title-block — ribbon', () => {
  const panel = INSERT_TAB.panels.find((p) => p.id === 'titleBlock');

  it('το κουμπί «Πινακίδα» ζει στην καρτέλα Εισαγωγή και δρομολογείται ως tool', () => {
    expect(panel).toBeDefined();
    const command = panel?.rows[0]?.buttons[0]?.command;
    expect(command?.commandKey).toBe('title-block');
    // Χωρίς `action` ⇒ ο RibbonLargeButton καλεί onToolChange(commandKey) — όχι side-action.
    expect(command?.action).toBeUndefined();
    expect(command?.icon).toBe('title-block');
  });
});

describe('title-block — i18n (N.11)', () => {
  it('τα κλειδιά υπάρχουν σε EL ΚΑΙ EN', () => {
    for (const bundle of [el, en] as const) {
      expect(bundle.tools.titleBlock.statusPosition).toBeTruthy();
      expect(bundle.tools.titleBlock.errorNoTemplate).toBeTruthy();
      expect(bundle.ribbon.panels.titleBlock).toBeTruthy();
      expect(bundle.ribbon.commands.titleBlock).toBeTruthy();
      expect(bundle.ribbon.commands.titleBlockTooltip).toBeTruthy();
    }
  });
});

describe('title-block — placement', () => {
  it('ο ορισμός τοποθετείται ως ΕΝΑ BlockEntity (επιλέξιμο/μετακινούμενο ως σύνολο)', () => {
    const def = buildTitleBlockDef(TITLE_BLOCK_EL, { project: { name: 'Οικία' } }, {
      scaleFactor: 50,
      layout: { paper: { size: 'A3', orientation: 'landscape' }, withFrame: false, withStampBox: false, stampLabel: '' },
    });
    const entity = buildBlockEntityFromDef(def, { position: { x: 1000, y: 2000 } });

    expect(entity.type).toBe('block');
    expect(entity.name).toBe(def.name);
    expect(entity.position).toEqual({ x: 1000, y: 2000 });
    expect(entity.entities.length).toBe(def.localMembers.length);
    // Τα members μένουν σε BLOCK-LOCAL space — μόνο το instance φέρει τη θέση.
    expect(entity.entities.every((m) => m.id !== '')).toBe(true);
  });
});
