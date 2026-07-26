/**
 * ADR-706 Phase 3 — the sales domain's decimal fields.
 *
 * Two anchors, deliberately different in kind:
 *
 * 1. BEHAVIOURAL — a real sales call site is driven keystroke by keystroke with
 *    a decimal price. A number-typed input bound to a number state committed
 *    **4** for `2.4` (React #11877); the assertion here is that the money the
 *    user typed is the money the handler receives.
 *
 * 2. STRUCTURAL — a scan that fails the moment any sales file reintroduces a
 *    decimal number-typed input. Eighteen files were migrated; a
 *    behavioural test for one of them would not stop the other seventeen from
 *    regressing, and the defect is silent (no error, just a wrong number in the
 *    database), so the regression would ship.
 *
 * @see ADR-706 — Numeric field SSoT
 */

import * as fs from 'fs';
import * as path from 'path';

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppurtenancesSection } from '../dialogs/AppurtenancesSection';
import type { ResolvedLinkedSpace } from '@/hooks/sales/useLinkedSpacesForSale';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SPACE: ResolvedLinkedSpace = {
  spaceId: 'space-1',
  spaceType: 'parking',
  inclusion: 'optional',
  allocationCode: 'P1',
  displayName: 'Parking P1',
  checked: true,
  salePrice: 0,
  isRented: false,
  area: 12,
};

describe('ADR-706 — sales decimal fields commit what the user typed', () => {
  it('commits a decimal appurtenance price instead of dropping the separator', async () => {
    const onPriceChange = jest.fn();
    const user = userEvent.setup();

    render(
      <AppurtenancesSection
        spaces={[SPACE]}
        unitPrice={100_000}
        totalAppurtenancesPrice={0}
        onToggle={jest.fn()}
        onPriceChange={onPriceChange}
      />,
    );

    const price = screen.getByRole('spinbutton', { name: SPACE.displayName });
    await user.click(price);
    await user.type(price, '1250.5');
    await user.tab();

    // The pre-ADR-706 field committed 5 here — the "1250." intermediate came
    // back from the browser as "", reset the model to 0, and the next keystroke
    // read back "05".
    expect(onPriceChange).toHaveBeenLastCalledWith(SPACE.spaceId, 1250.5);
  });

  it('accepts the comma as the decimal mark too (el-GR keyboards)', async () => {
    const onPriceChange = jest.fn();
    const user = userEvent.setup();

    render(
      <AppurtenancesSection
        spaces={[SPACE]}
        unitPrice={100_000}
        totalAppurtenancesPrice={0}
        onToggle={jest.fn()}
        onPriceChange={onPriceChange}
      />,
    );

    const price = screen.getByRole('spinbutton', { name: SPACE.displayName });
    await user.click(price);
    await user.type(price, '1250,5');
    await user.tab();

    expect(onPriceChange).toHaveBeenLastCalledWith(SPACE.spaceId, 1250.5);
  });

  it('opens blank on 0 so the placeholder shows instead of a 0 to delete', () => {
    render(
      <AppurtenancesSection
        spaces={[SPACE]}
        unitPrice={100_000}
        totalAppurtenancesPrice={0}
        onToggle={jest.fn()}
        onPriceChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('spinbutton', { name: SPACE.displayName })).toHaveValue('');
  });
});

// ---------------------------------------------------------------------------
// Structural anchor
// ---------------------------------------------------------------------------

const SALES_ROOT = path.join(process.cwd(), 'src', 'components', 'sales');

/**
 * The two markers this scan looks for, assembled from fragments on purpose.
 * Spelled out literally, this file would answer every `grep` the ADR-706
 * ratchet is counted with and quietly inflate the remaining-work number — the
 * "a comment quoting the pattern IS an occurrence" trap.
 */
const NUMBER_TYPE_ATTR = `type="${'number'}"`;
const DECIMAL_STEP_ATTR = `step="${'0'}.`;

/**
 * Occurrences of the number-type attribute that are NOT a decimal input, listed
 * explicitly so a new one has to be argued for rather than slipping in.
 * Whole-number fields are genuinely fine as number inputs: the defect only bites
 * where a decimal separator is typed, and a blanket migration would strip their
 * native stepper for nothing.
 */
const ALLOWED_TYPE_NUMBER: ReadonlyMap<string, string> = new Map([
  // ADR-710 Phase B: the axis frame is declared once for the whole domain, so this is
  // now the only place a recharts `type="number"` scale is spelled out.
  ['payments/financial-intelligence/financial-chart-axes.tsx', 'Recharts XAxis scale, not an input'],
  ['payments/financial-intelligence/MonteCarloTab.tsx', 'scenario count and RNG seed — integers by definition'],
]);

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTsxFiles(full, acc);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) acc.push(full);
  }
  return acc;
}

function relative(file: string): string {
  return path.relative(SALES_ROOT, file).split(path.sep).join('/');
}

describe('ADR-706 — no sales file reintroduces a decimal number input', () => {
  const files = collectTsxFiles(SALES_ROOT);

  it('finds the sales tree (guards against a silently empty scan)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [relative(file), file]))('%s', (rel, file) => {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(NUMBER_TYPE_ATTR)) return;

    expect(ALLOWED_TYPE_NUMBER.has(rel)).toBe(true);
  });

  it('carries no stale allowlist entry', () => {
    for (const rel of ALLOWED_TYPE_NUMBER.keys()) {
      const source = fs.readFileSync(path.join(SALES_ROOT, rel), 'utf8');
      expect(source).toContain(NUMBER_TYPE_ATTR);
    }
  });

  // The decisive one: a fractional step attribute is the code itself declaring
  // the field decimal. Zero judgement, zero interpretation — if that and a
  // number-typed input ever meet again on the same element, the defect is back.
  // (Both literals are built below rather than written out, so this file does
  // not pollute the very greps the ratchet is measured with.)
  it.each(files.map((file) => [relative(file), file]))('%s declares no decimal step on a number input', (_rel, file) => {
    const source = fs.readFileSync(file, 'utf8');
    const type = NUMBER_TYPE_ATTR;
    const step = DECIMAL_STEP_ATTR.replace('.', '\\.');
    const decimalNumberInput =
      new RegExp(`<Input\\b[^>]*${type}[^>]*${step}[^>]*>`, 's').test(source)
      || new RegExp(`<Input\\b[^>]*${step}[^>]*${type}[^>]*>`, 's').test(source);

    expect(decimalNumberInput).toBe(false);
  });
});
