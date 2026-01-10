/**
 * GEO-CANVAS APP TESTS
 * Enterprise-class tests για το Geo-Alert σύστημα
 *
 * Tests verify:
 * 1. Component renders with correct semantic structure
 * 2. Props are accepted and handled correctly
 * 3. Accessible controls are present
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach, beforeAll } from '@jest/globals';

// Mock PerformanceObserver (required by some dependencies)
beforeAll(() => {
  global.PerformanceObserver = class PerformanceObserver {
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  } as unknown as typeof PerformanceObserver;
});

// Mock external dependencies
jest.mock('maplibre-gl', () => ({
  Map: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    off: jest.fn(),
    remove: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    addControl: jest.fn(),
    resize: jest.fn(),
    getCenter: jest.fn(() => ({ lng: 0, lat: 0 })),
    getZoom: jest.fn(() => 10),
  })),
  NavigationControl: jest.fn(),
  ScaleControl: jest.fn(),
}));

import { GeoCanvasApp } from '../GeoCanvasApp';

describe('GeoCanvasApp', () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  beforeEach(() => {
    console.warn = jest.fn();
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
    console.error = originalError;
    console.log = originalLog;
  });

  describe('Layout Structure', () => {
    it('renders main content area', async () => {
      render(<GeoCanvasApp />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('renders navigation toolbar', async () => {
      render(<GeoCanvasApp />);

      await waitFor(() => {
        expect(screen.getByRole('toolbar')).toBeInTheDocument();
      });
    });

    it('renders heading element', async () => {
      render(<GeoCanvasApp />);

      await waitFor(() => {
        const headings = screen.getAllByRole('heading', { level: 1 });
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Props Handling', () => {
    it('accepts feature flags prop', async () => {
      const features = {
        enableDxfImport: true,
        enableMapLibre: false,
        enableAlerts: true,
        enableSpatialQueries: false,
      };

      render(<GeoCanvasApp features={features} />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('accepts initial configuration prop', async () => {
      const initialConfig = {
        mapCenter: { lng: 23.7275, lat: 37.9755 },
        mapZoom: 8,
        defaultCRS: 'EPSG:4326',
      };

      render(<GeoCanvasApp initialConfig={initialConfig} />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('accepts className prop', async () => {
      const { container } = render(<GeoCanvasApp className="custom-class" />);

      await waitFor(() => {
        expect(container.firstChild).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has combobox controls for selections', async () => {
      render(<GeoCanvasApp />);

      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        expect(comboboxes.length).toBeGreaterThan(0);
      });
    });

    it('has button controls', async () => {
      render(<GeoCanvasApp />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });
});
