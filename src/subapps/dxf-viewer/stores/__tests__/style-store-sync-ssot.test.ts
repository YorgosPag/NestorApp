/// <reference types="jest" />
/**
 * @file style-store-sync-ssot.test.ts
 * @description SSoT regression guard for the single "settings → legacy style
 * store" writers. The cardinal property under test: each writer performs a
 * FULL-state write (no silent partial that could let a second writer stomp
 * advanced fields — the exact hazard that motivated this centralization).
 */

import {
  syncToolStyleStoreFromSettings,
  syncTextStyleStoreFromSettings,
  syncCompletionStyleStoreFromSettings,
  syncGripStyleStoreFromSettings,
} from '../style-store-sync';
import { syncGripStyleStoreFromSettings as gripWriterDirect } from '../grip-style-sync';
import { toolStyleStore } from '../ToolStyleStore';
import { textStyleStore } from '../TextStyleStore';
import { completionStyleStore } from '../CompletionStyleStore';
import { withOpacity } from '../../config/color-config';
import { DEFAULT_LINE_SETTINGS } from '../../settings-core/defaults';
import type { LineSettings } from '../../settings-core/types';
import type { TextStyleSyncInput } from '../style-store-sync';

describe('style-store-sync SSoT writers', () => {
  describe('syncToolStyleStoreFromSettings', () => {
    it('writes EVERY mapped field (full, non-lossy) — not a partial subset', () => {
      // Pollute first so every assertion proves the writer touched the field.
      toolStyleStore.set({
        enabled: true,
        strokeColor: '#sentinel',
        fillColor: '#sentinel',
        lineWidth: -1,
        opacity: -1,
      });

      const input: LineSettings = {
        ...DEFAULT_LINE_SETTINGS,
        enabled: false,
        color: '#123456',
        lineWidth: 7,
        opacity: 0.5,
        lineType: 'solid',
      };
      syncToolStyleStoreFromSettings(input);

      const s = toolStyleStore.get();
      expect(s.enabled).toBe(false);
      expect(s.strokeColor).toBe('#123456');
      expect(s.lineWidth).toBe(7);
      expect(s.opacity).toBe(0.5);
      expect(s.fillColor).toBe(withOpacity('#123456', 0));
      expect(s.lineType).toBe('solid');
    });
  });

  describe('syncTextStyleStoreFromSettings', () => {
    it('writes EVERY mapped field incl. derived textDecoration + opacity/100', () => {
      const input: TextStyleSyncInput = {
        enabled: true,
        fontFamily: 'Test Sans',
        fontSize: 9,
        color: '#abcdef',
        isBold: true,
        isItalic: true,
        isUnderline: true,
        isStrikethrough: true,
        isSuperscript: true,
        isSubscript: false,
        opacity: 80, // percent → store stores 0.8
      };
      syncTextStyleStoreFromSettings(input);

      const s = textStyleStore.get();
      expect(s.enabled).toBe(true);
      expect(s.fontFamily).toBe('Test Sans');
      expect(s.fontSize).toBe(9);
      expect(s.color).toBe('#abcdef');
      expect(s.fontWeight).toBe('bold');
      expect(s.fontStyle).toBe('italic');
      expect(s.textDecoration).toBe('underline line-through');
      expect(s.opacity).toBeCloseTo(0.8);
      expect(s.isSuperscript).toBe(true);
      expect(s.isSubscript).toBe(false);
    });

    it('maps no decorations → "none"', () => {
      syncTextStyleStoreFromSettings({
        enabled: true,
        fontFamily: 'X',
        fontSize: 1,
        color: '#000',
        isUnderline: false,
        isStrikethrough: false,
        opacity: 100,
      });
      expect(textStyleStore.get().textDecoration).toBe('none');
    });
  });

  describe('syncCompletionStyleStoreFromSettings', () => {
    it('writes EVERY mapped field incl. the completion-only dash/cap/join set', () => {
      const input: LineSettings = {
        ...DEFAULT_LINE_SETTINGS,
        enabled: true,
        color: '#0f0f0f',
        lineWidth: 3,
        opacity: 0.9,
        lineType: 'dashed',
        dashScale: 2,
        lineCap: 'butt',
        lineJoin: 'bevel',
        dashOffset: 5,
        breakAtCenter: true,
      };
      syncCompletionStyleStoreFromSettings(input);

      const s = completionStyleStore.get();
      expect(s.enabled).toBe(true);
      expect(s.color).toBe('#0f0f0f');
      expect(s.fillColor).toBe(withOpacity('#0f0f0f', 0));
      expect(s.lineWidth).toBe(3);
      expect(s.opacity).toBe(0.9);
      expect(s.lineType).toBe('dashed');
      expect(s.dashScale).toBe(2);
      expect(s.lineCap).toBe('butt');
      expect(s.lineJoin).toBe('bevel');
      expect(s.dashOffset).toBe(5);
      expect(s.breakAtCenter).toBe(true);
    });
  });

  describe('grip writer re-export', () => {
    it('re-exports the SINGLE grip writer (no second implementation)', () => {
      // Identity: the barrel export must be the very same function as the leaf.
      expect(syncGripStyleStoreFromSettings).toBe(gripWriterDirect);
    });
  });
});
