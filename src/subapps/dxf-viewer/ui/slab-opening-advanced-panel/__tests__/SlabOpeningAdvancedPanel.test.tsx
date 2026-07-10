/**
 * ADR-632 Φ5 — Slab-opening Advanced panel + warnings surfacing tests.
 *
 * Επιβεβαιώνει το DoD: το soft warning φαίνεται ως **κείμενο** (role="alert"),
 * όχι μόνο badge dot· και το status readout (managed/detached/manual).
 * `t` mock = identity (k → k), ώστε οι assertions να μη εξαρτώνται από locales.
 */

import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';

import { SlabOpeningAdvancedPanel } from '../SlabOpeningAdvancedPanel';
import { SlabOpeningWarningsSection } from '../sections/SlabOpeningWarningsSection';
import { computeSlabOpeningGeometry } from '../../../bim/geometry/slab-opening-geometry';
import type { SlabOpeningEntity, SlabOpeningParams } from '../../../bim/types/slab-opening-types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const WARN_KEY = 'slabOpening.validation.codeViolations.outlineAtSlabEdge';

function makeOpening(
  paramsOverrides: Partial<SlabOpeningParams> = {},
  violationKeys: readonly string[] = [],
): SlabOpeningEntity {
  const params: SlabOpeningParams = {
    kind: 'well',
    slabId: 'slab-1',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 1000, y: 1000, z: 0 },
        { x: 0, y: 1000, z: 0 },
      ],
    },
    ...paramsOverrides,
  };
  return {
    id: 'slbopn_test',
    type: 'slab-opening',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: {
      hasCodeViolations: violationKeys.length > 0,
      violationKeys,
      lastValidatedAt: null,
    },
    visible: true,
  } as SlabOpeningEntity;
}

afterEach(cleanup);

describe('SlabOpeningWarningsSection', () => {
  it('surfaces το violation key ως κείμενο (role=alert)', () => {
    render(<SlabOpeningWarningsSection opening={makeOpening({}, [WARN_KEY])} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(WARN_KEY);
  });

  it('χωρίς violations → τίποτα (null)', () => {
    const { container } = render(<SlabOpeningWarningsSection opening={makeOpening()} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SlabOpeningAdvancedPanel', () => {
  it('managed opening → status "managed" + warning ορατό', () => {
    const { container } = render(
      <SlabOpeningAdvancedPanel opening={makeOpening({ autoStairId: 'stair-1' }, [WARN_KEY])} />,
    );
    expect(container.textContent).toContain('slabOpeningAdvancedPanel.status.managed');
    expect(screen.getByRole('alert').textContent).toContain(WARN_KEY);
  });

  it('detached (Override) opening → status "detached"', () => {
    const { container } = render(
      <SlabOpeningAdvancedPanel
        opening={makeOpening({ autoStairId: 'stair-1', autoStairDetached: true })}
      />,
    );
    expect(container.textContent).toContain('slabOpeningAdvancedPanel.status.detached');
  });

  it('manual opening → status "manual", χωρίς alert', () => {
    const { container } = render(<SlabOpeningAdvancedPanel opening={makeOpening()} />);
    expect(container.textContent).toContain('slabOpeningAdvancedPanel.status.manual');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
