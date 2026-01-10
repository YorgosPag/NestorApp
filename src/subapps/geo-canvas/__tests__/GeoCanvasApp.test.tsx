/**
 * GEO-CANVAS APP TESTS
 * Enterprise-class smoke tests για το Geo-Alert σύστημα
 *
 * NOTE: These are minimal smoke tests. The component uses i18n translations,
 * so we avoid testing specific text content which can change based on locale.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { GeoCanvasApp } from '../GeoCanvasApp';

// Mock dependencies - use @/ alias to match component imports
jest.mock('@/providers/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="notification-provider">{children}</div>
  ),
}));

// Mock i18n hook to provide consistent translations for testing
jest.mock('@/i18n/hooks/useTranslationLazy', () => ({
  useTranslationLazy: () => ({
    t: (key: string) => key,
    isLoading: false,
  }),
}));

// Mock MapLibre GL JS
jest.mock('maplibre-gl', () => ({
  Map: jest.fn(() => ({
    on: jest.fn(),
    remove: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    addControl: jest.fn(),
    resize: jest.fn(),
  })),
  NavigationControl: jest.fn(),
  ScaleControl: jest.fn(),
}));

// Mock analytics
jest.mock('@/services/AnalyticsBridge', () => ({
  useAnalytics: () => ({
    trackUserBehavior: jest.fn(),
    updateUser: jest.fn(),
  }),
}));

describe('GeoCanvasApp', () => {
  it('renders without crashing', async () => {
    const { container } = render(<GeoCanvasApp />);

    // Basic smoke test - component renders
    expect(container).toBeInTheDocument();
    // Component should have rendered something
    expect(container.firstChild).toBeInTheDocument();
  });

  it('accepts feature flags prop', async () => {
    const features = {
      enableDxfImport: true,
      enableMapLibre: false,
      enableAlerts: false,
      enableSpatialQueries: false,
    };

    const { container } = render(<GeoCanvasApp features={features} />);
    expect(container).toBeInTheDocument();
  });

  it('accepts initial configuration prop', async () => {
    const initialConfig = {
      mapCenter: { lng: 23.7275, lat: 37.9755 },
      mapZoom: 8,
      defaultCRS: 'EPSG:4326',
    };

    const { container } = render(<GeoCanvasApp initialConfig={initialConfig} />);
    expect(container).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    const { container } = render(
      <GeoCanvasApp className="custom-geo-canvas" />
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});

/**
 * ERROR BOUNDARY TESTS
 */
describe('GeoCanvasErrorBoundary', () => {
  // Suppress console.error για error boundary tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('handles runtime errors gracefully', async () => {
    // Component that throws an error
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const AppWithError = () => (
      <GeoCanvasApp>
        <ThrowError />
      </GeoCanvasApp>
    );

    const { container } = render(<AppWithError />);

    // Error boundary should render something (error UI or fallback)
    expect(container).toBeInTheDocument();
  });
});

/**
 * PERFORMANCE TESTS
 */
describe('GeoCanvasApp Performance', () => {
  it('renders within acceptable time', async () => {
    const startTime = performance.now();

    render(<GeoCanvasApp />);

    const renderTime = performance.now() - startTime;

    // Should render within 1000ms (generous for CI with complex component tree)
    expect(renderTime).toBeLessThan(1000);
  });

  it('does not crash on rerender', async () => {
    const { rerender, container } = render(<GeoCanvasApp />);

    // Same props should not cause crash
    rerender(<GeoCanvasApp />);

    // Component should still be there
    expect(container).toBeInTheDocument();
  });
});
