/**
 * 🎨 useBorderTokens — characterization tests
 *
 * Written BEFORE the ADR-584 / N.18 self-clone de-duplication, to lock the
 * exact strings every consumer already renders. The hook is consumed by 30+
 * components and had no test at all, so these tests are the safety net the
 * refactor leans on: they assert observable output, not internal structure.
 *
 * The `quick` ↔ `borderTokens.quick` equality test is the one that earns the
 * refactor — it proves the two objects were byte-identical and therefore safe
 * to collapse onto one constant.
 *
 * @module hooks/__tests__/useBorderTokens
 * @enterprise ADR-584 — token-based clone ratchet (N.18)
 */

import { borderColors, borderWidth } from '@/styles/design-tokens';

import { borderTokens, useBorderTokens } from '../useBorderTokens';

// The hook holds no React state — it is a pure token accessor, so it can be
// called directly without a renderer.
const tokens = useBorderTokens();

const STATUSES = [
  'default',
  'success',
  'warning',
  'error',
  'info',
  'muted',
  'subtle',
] as const;

const DIRECTIONS = ['top', 'bottom', 'left', 'right'] as const;

describe('useBorderTokens — static/hook parity', () => {
  it('exposes the same `quick` map as the static `borderTokens` export', () => {
    expect(tokens.quick).toEqual(borderTokens.quick);
  });

  it('covers every quick shortcut consumers rely on', () => {
    expect(Object.keys(tokens.quick).sort()).toEqual(
      [
        'avatar',
        'borderB',
        'borderL',
        'borderR',
        'borderT',
        'button',
        'card',
        'checkbox',
        'container',
        'dashed',
        'default',
        'error',
        'focus',
        'info',
        'input',
        'modal',
        'muted',
        'none',
        'rounded',
        'selected',
        'separator',
        'separatorH',
        'separatorV',
        'success',
        'table',
        'warning',
      ].sort(),
    );
  });

  it('keeps the input border on --input, not --border (ADR-190)', () => {
    expect(tokens.quick.input).toBe('border border-input rounded-md');
    expect(borderTokens.quick.input).toBe('border border-input rounded-md');
  });
});

describe('getDirectionalBorder', () => {
  it.each(DIRECTIONS)('maps %s to its border-* prefix', (direction) => {
    const prefix = { top: 't', bottom: 'b', left: 'l', right: 'r' }[direction];
    expect(tokens.getDirectionalBorder('success', direction)).toBe(
      `border-${prefix} border-green-500`,
    );
  });

  it.each(STATUSES)('resolves the %s colour', (status) => {
    const expected = {
      default: 'border-border',
      success: 'border-green-500',
      warning: 'border-yellow-500',
      error: 'border-red-500',
      info: 'border-blue-500',
      muted: 'border-border',
      subtle: 'border-border',
    }[status];
    expect(tokens.getDirectionalBorder(status, 'top')).toBe(
      `border-t ${expected}`,
    );
  });
});

describe('getMultiDirectionalBorder', () => {
  it('joins several directions against one colour', () => {
    expect(tokens.getMultiDirectionalBorder('error', ['top', 'left'])).toBe(
      'border-t border-l border-red-500',
    );
  });

  it('preserves the caller-supplied direction order', () => {
    expect(tokens.getMultiDirectionalBorder('info', ['right', 'top'])).toBe(
      'border-r border-t border-blue-500',
    );
  });

  it('degrades to a bare colour class when given no directions', () => {
    expect(tokens.getMultiDirectionalBorder('default', [])).toBe(
      ' border-border',
    );
  });

  it('agrees with getDirectionalBorder for a single direction', () => {
    for (const status of STATUSES) {
      for (const direction of DIRECTIONS) {
        expect(tokens.getMultiDirectionalBorder(status, [direction])).toBe(
          tokens.getDirectionalBorder(status, direction),
        );
      }
    }
  });
});

describe('getCombinedBorder', () => {
  it.each(STATUSES)('returns the bare %s border with no directions', (status) => {
    const expected = {
      default: 'border border-border',
      success: 'border border-green-500',
      warning: 'border border-yellow-500',
      error: 'border border-red-500',
      info: 'border border-blue-500',
      muted: 'border border-border',
      subtle: 'border border-border',
    }[status];
    expect(tokens.getCombinedBorder(status)).toBe(expected);
    expect(tokens.getCombinedBorder(status, [])).toBe(expected);
  });

  it('appends directional borders to the base border', () => {
    expect(tokens.getCombinedBorder('warning', ['bottom'])).toBe(
      'border border-yellow-500 border-b border-yellow-500',
    );
  });

  it('composes the base border with getMultiDirectionalBorder output', () => {
    expect(tokens.getCombinedBorder('info', ['top', 'right'])).toBe(
      `border border-blue-500 ${tokens.getMultiDirectionalBorder('info', ['top', 'right'])}`,
    );
  });
});

describe('getStatusBorder', () => {
  it('builds default/muted/subtle straight from the design tokens', () => {
    expect(tokens.getStatusBorder('default')).toBe(
      `border-[${borderWidth.default}] border-[${borderColors.default.light}]`,
    );
    expect(tokens.getStatusBorder('muted')).toBe(
      `border-[${borderWidth.default}] border-[${borderColors.muted.light}]`,
    );
    expect(tokens.getStatusBorder('subtle')).toBe(
      `border-[${borderWidth.hairline}] border-[${borderColors.muted.light}]`,
    );
  });

  it('escalates border width with severity', () => {
    expect(tokens.getStatusBorder('critical')).toBe(
      `border-[${borderWidth.thick}] border-[${borderColors.error.light}]`,
    );
    expect(tokens.getStatusBorder('high')).toBe(
      `border-[${borderWidth.medium}] border-[${borderColors.warning.light}]`,
    );
    expect(tokens.getStatusBorder('medium')).toBe(
      `border-[${borderWidth.default}] border-[${borderColors.info.light}]`,
    );
    expect(tokens.getStatusBorder('low')).toBe(
      `border-[${borderWidth.default}] border-[${borderColors.success.light}]`,
    );
  });

  it('falls back to Tailwind classes for the semantic statuses', () => {
    expect(tokens.getStatusBorder('success')).toBe('border border-green-500');
    expect(tokens.getStatusBorder('warning')).toBe('border border-yellow-500');
    expect(tokens.getStatusBorder('error')).toBe('border border-red-500');
    expect(tokens.getStatusBorder('info')).toBe('border border-blue-500');
  });
});

describe('getSeparatorBorder', () => {
  it('draws a top rule for horizontal and a left rule for vertical', () => {
    expect(tokens.getSeparatorBorder('horizontal')).toBe('border-t border-border');
    expect(tokens.getSeparatorBorder('vertical')).toBe('border-l border-border');
  });
});

describe('getResponsiveBorder', () => {
  it.each(['card', 'button', 'input'] as const)('covers %s', (element) => {
    expect(tokens.getResponsiveBorder(element)).toBe('border sm:border lg:border');
  });
});

describe('getElementBorder', () => {
  it('gives inputs a thicker focus and error ring', () => {
    expect(tokens.getElementBorder('input', 'focus')).toBe(
      'border-2 border-blue-500 rounded-md',
    );
    expect(tokens.getElementBorder('input', 'error')).toBe(
      'border-2 border-red-500 rounded-md',
    );
  });

  it('gives buttons their own focus/hover states', () => {
    expect(tokens.getElementBorder('button', 'focus')).toBe('border border-blue-500');
    expect(tokens.getElementBorder('button', 'hover')).toBe('border border-border');
  });

  it('routes interactive states on non-input/button elements to the shared map', () => {
    expect(tokens.getElementBorder('card', 'hover')).toBe('hover:border-border');
    expect(tokens.getElementBorder('card', 'focus')).toBe(
      'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
    );
    expect(tokens.getElementBorder('card', 'selected')).toBe(
      'border-blue-500 bg-blue-50',
    );
  });

  it('falls back to the card border for unknown elements', () => {
    expect(tokens.getElementBorder('container')).toBe(
      tokens.variants.container.className,
    );
    expect(tokens.getElementBorder('modal')).toBe(tokens.variants.modal.className);
    expect(tokens.getElementBorder('card')).toBe(tokens.variants.card.className);
  });
});

describe('getFocusBorder', () => {
  it('gives each element type its documented focus treatment', () => {
    expect(tokens.getFocusBorder('input')).toBe(
      'focus:border-2 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20',
    );
    expect(tokens.getFocusBorder('button')).toBe(
      'focus:ring-2 focus:ring-primary focus:ring-opacity-30',
    );
    expect(tokens.getFocusBorder('select')).toBe(
      'focus:border-2 focus:border-primary focus:ring-1 focus:ring-primary',
    );
    expect(tokens.getFocusBorder('card')).toBe(
      'focus:border-primary focus:ring-1 focus:ring-primary focus:ring-opacity-20',
    );
  });
});

describe('token pass-through', () => {
  it('re-exports the raw scales without reshaping them', () => {
    expect(tokens.width).toBe(borderWidth);
    expect(tokens.colors).toBe(borderColors);
  });

  it('exposes the radius class map as the SSoT for rounded-*', () => {
    expect(tokens.radiusClass.full).toBe('rounded-full');
    expect(tokens.radiusClass.default).toBe('rounded');
    expect(tokens.radiusClass.none).toBe('rounded-none');
  });
});
