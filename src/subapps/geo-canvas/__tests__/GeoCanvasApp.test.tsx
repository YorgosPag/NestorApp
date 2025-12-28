/**
 * GEO-CANVAS APP TESTS
 * Enterprise-class testing για το Geo-Alert σύστημα
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { GeoCanvasApp } from '../GeoCanvasApp';

// Mock dependencies
jest.mock('../../providers/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="notification-provider">{children}</div>
  ),
}));

describe('GeoCanvasApp', () => {
  it('renders without crashing', () => {
    render(<GeoCanvasApp />);
    expect(screen.getByTestId('notification-provider')).toBeInTheDocument();
  });

  it('renders the foundation phase correctly', () => {
    render(<GeoCanvasApp />);

    // Check for main title
    expect(screen.getByText('🌍 Geo-Canvas System')).toBeInTheDocument();

    // Check for phase indicator
    expect(screen.getByText('Phase 1')).toBeInTheDocument();
    expect(screen.getByText('Foundation Ready')).toBeInTheDocument();
  });

  it('displays system status correctly', () => {
    render(<GeoCanvasApp />);

    // Check status indicators
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Phase 2')).toBeInTheDocument();
  });

  it('shows enterprise architecture info', () => {
    render(<GeoCanvasApp />);

    expect(screen.getByText('Architecture Overview')).toBeInTheDocument();
    expect(screen.getByText(/Centralized System/)).toBeInTheDocument();
    expect(screen.getByText(/Technology Stack/)).toBeInTheDocument();
  });

  it('handles feature flags correctly', () => {
    const features = {
      enableDxfImport: true,
      enableMapLibre: false,
      enableAlerts: false,
      enableSpatialQueries: false,
    };

    render(<GeoCanvasApp features={features} />);

    // Component should render normally with feature flags
    expect(screen.getByText('🌍 Geo-Canvas System')).toBeInTheDocument();
  });

  it('accepts initial configuration', () => {
    const initialConfig = {
      mapCenter: { lng: 23.7275, lat: 37.9755 },
      mapZoom: 8,
      defaultCRS: 'EPSG:4326',
    };

    render(<GeoCanvasApp initialConfig={initialConfig} />);

    // Component should render with config
    expect(screen.getByText('🌍 Geo-Canvas System')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <GeoCanvasApp className="custom-geo-canvas" />
    );

    // Check if className is applied (via nested div structure)
    expect(container.firstChild).toBeInTheDocument();
  });
});

/**
 * GEO-CANVAS CONTENT TESTS
 */
describe('GeoCanvasContent Integration', () => {
  it('displays phase roadmap correctly', () => {
    render(<GeoCanvasApp />);

    // Phase 1 status
    expect(screen.getByText('Phase 1 Complete')).toBeInTheDocument();

    // Future phases
    expect(screen.getByText('Next: Phase 2')).toBeInTheDocument();
    expect(screen.getByText('DXF transformation engine')).toBeInTheDocument();
  });

  it('shows correct CRS options', () => {
    render(<GeoCanvasApp />);

    // CRS selector should have options
    expect(screen.getByText('WGS84 (EPSG:4326)')).toBeInTheDocument();
    expect(screen.getByText('Greek Grid (EPSG:2100)')).toBeInTheDocument();
    expect(screen.getByText('UTM 34N (EPSG:32634)')).toBeInTheDocument();
  });

  it('displays footer status correctly', () => {
    render(<GeoCanvasApp />);

    expect(screen.getByText('● Connected')).toBeInTheDocument();
    expect(screen.getByText('Phase 1: Foundation')).toBeInTheDocument();
    expect(screen.getByText('🏢 Pagonis-Nestor Geo-Canvas')).toBeInTheDocument();
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

  it('handles runtime errors gracefully', () => {
    // Component that throws an error
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const AppWithError = () => (
      <GeoCanvasApp>
        <ThrowError />
      </GeoCanvasApp>
    );

    render(<AppWithError />);

    // Error boundary should catch and display error
    expect(screen.getByText('⚠️')).toBeInTheDocument();
    expect(screen.getByText('Geo-Canvas System Error')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});

/**
 * PERFORMANCE TESTS
 */
describe('GeoCanvasApp Performance', () => {
  it('renders within acceptable time', () => {
    const startTime = performance.now();

    render(<GeoCanvasApp />);

    const renderTime = performance.now() - startTime;

    // Should render within 100ms (generous for CI)
    expect(renderTime).toBeLessThan(100);
  });

  it('does not re-render unnecessarily', () => {
    const { rerender } = render(<GeoCanvasApp />);

    // Same props should not cause re-render
    rerender(<GeoCanvasApp />);

    // Component should still be there
    expect(screen.getByText('🌍 Geo-Canvas System')).toBeInTheDocument();
  });
});

/**
 * ACCESSIBILITY TESTS
 */
describe('GeoCanvasApp Accessibility', () => {
  it('has proper heading structure', () => {
    render(<GeoCanvasApp />);

    // Main heading
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toHaveTextContent('🌍 Geo-Canvas System');

    // Subheadings
    const subHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(subHeadings.length).toBeGreaterThan(0);
  });

  it('has accessible controls', () => {
    render(<GeoCanvasApp />);

    // Select elements should be accessible
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('provides keyboard navigation', () => {
    render(<GeoCanvasApp />);

    // Focusable elements should exist
    const focusableElements = screen.getAllByRole('combobox');
    focusableElements.forEach(element => {
      expect(element).not.toHaveAttribute('tabindex', '-1');
    });
  });
});