/**
 * @jest-environment node
 *
 * ⚓ ADR-784 §12 — a catalog keeps its free height AFTER the rows, never inside the cards.
 *
 * Measured 2026-10-18 (contacts grid, 2400 px): a catalog stretched by its flex parent to 893 px with
 * `align-content: normal` split the free space over two rows ⇒ cards 424/444 px holding 72–176 px of content.
 */

import { gridPatterns } from '@/styles/design-tokens/modules/layout';

const CATALOGS = ['media', 'tile', 'chip', 'full'] as const;

describe('catalog row packing', () => {
  it.each(CATALOGS)('cards.%s packs its rows at the start', (key) => {
    expect(gridPatterns.cards[key].split(/\s+/)).toContain('content-start');
  });

  it('Tailwind emits it as align-content — not a class that is green in a test and dead on screen', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postcss = require('postcss');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tailwind = require('tailwindcss');
    const raw = `<div class="${gridPatterns.cards.tile}"></div>`;
    const result = await postcss([
      tailwind({ content: [{ raw, extension: 'html' }], theme: {}, plugins: [] }),
    ]).process('@tailwind utilities;', { from: undefined });
    expect(result.css).toMatch(/align-content:\s*flex-start/);
  }, 30_000);
});
