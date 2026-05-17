/**
 * LayerFiltersSidebar — light RTL smoke test (ADR-358 Phase 11).
 *
 * Smoke-only: verifies the component mounts under the LayerFiltersStore
 * lifecycle without throwing. Behavioural coverage (state machine, engine,
 * io, smart filters) lives in the unit suites.
 */

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import { LayerFiltersSidebar } from '../LayerFiltersSidebar';
import {
  __resetLayerFiltersStoreForTesting,
} from '../../../../stores/LayerFiltersStore';
import { __resetLayerStoreForTesting, setLayers } from '../../../../stores/LayerStore';
import { __resetFilterPersistenceForTesting } from '../../../../services/layer-filter-persistence';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    bg: { hover: '', muted: '' },
    text: { primary: '', muted: '', error: '', warning: '' },
  }),
}));

jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({
    getStatusBorder: () => '',
    getFocusBorder: () => '',
    quick: '',
  }),
}));

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetFilterPersistenceForTesting();
  __resetLayerFiltersStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

describe('LayerFiltersSidebar — smoke', () => {
  it('mounts cleanly with empty LayerStore', () => {
    const { container } = render(<LayerFiltersSidebar projectId={null} projectName="" />);
    expect(container.querySelector('aside')).not.toBeNull();
  });

  it('mounts cleanly with populated LayerStore + projectId', () => {
    setLayers([
      { id: 'A', name: 'A', color: '#000', visible: true, locked: false, category: 'architectural' },
    ]);
    const { container } = render(<LayerFiltersSidebar projectId="p1" projectName="Demo" />);
    expect(container.querySelector('aside')).not.toBeNull();
  });

  it('renders the 3 section <h4> headers', () => {
    setLayers([
      { id: 'A', name: 'A', color: '#000', visible: true, locked: false, category: 'architectural' },
    ]);
    const { container } = render(<LayerFiltersSidebar projectId="p2" projectName="Demo" />);
    const headers = container.querySelectorAll('h4');
    expect(headers.length).toBeGreaterThanOrEqual(3);
  });
});
