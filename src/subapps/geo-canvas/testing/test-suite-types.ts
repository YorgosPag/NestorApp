/**
 * TEST SUITE — TYPE DEFINITIONS
 * Geo-Alert System - Phase 7: Complete Testing Framework
 *
 * All type definitions for the Comprehensive Testing Suite.
 * Extracted from TestSuite.ts per ADR-065 (SRP compliance).
 */

// ============================================================================
// CORE TEST TYPES
// ============================================================================

/**
 * Test result metadata
 */
export interface TestResult {
  testName: string;
  category: TestCategory;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration: number;
  details: string;
  error?: Error;
  metadata: {
    phase: string;
    subsystem: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    coverage: number;
  };
}

/**
 * Test categories aligned με Geo-Alert phases
 */
export type TestCategory =
  | 'transformation'    // Phase 2: DXF Transformation
  | 'mapping'          // Phase 3: MapLibre Integration
  | 'database'         // Phase 4: PostGIS Database
  | 'alerts'           // Phase 5: Alert Engine
  | 'ui'               // Phase 6: Design System
  | 'performance'      // Phase 7: Performance
  | 'integration'      // Cross-system tests
  | 'e2e';             // End-to-end workflows

/**
 * Test suite configuration
 */
export interface TestSuiteConfig {
  enableParallel: boolean;
  timeout: number;
  retryCount: number;
  coverage: {
    enabled: boolean;
    threshold: number;
  };
  performance: {
    maxDuration: number;
    memoryThreshold: number;
  };
  categories: TestCategory[];
  mockMode: boolean;
}

/**
 * Test execution context
 */
export interface TestContext {
  startTime: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  warningTests: number;
  totalDuration: number;
  coverage: number;
  results: TestResult[];
}

// ============================================================================
// DOMAIN-SPECIFIC TEST TYPES
// ============================================================================

/**
 * DXF Control Point for transformation tests
 */
export interface DxfControlPoint {
  dxf: { x: number; y: number };
  geo: { lat: number; lng: number };
}

/**
 * Map click event for coordinate tests
 */
export interface MapClickEvent {
  lngLat: { lat: number; lng: number };
}

/**
 * Transformation update data
 */
export interface TransformationUpdate {
  dxf: { x: number; y: number };
  geo: { lat: number; lng: number };
}

/**
 * Viewport configuration for synchronization tests
 */
export interface ViewportConfig {
  zoom: number;
  center: { lat: number; lng: number };
}

/**
 * Database connection configuration
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
}

/**
 * Alert rule configuration for tests
 */
export interface TestAlertRule {
  type: string;
  condition: string;
  value: string | string[];
}

/**
 * Test event for detection simulation
 */
export interface TestDetectionEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Notification configuration for tests
 */
export interface TestNotification {
  channel: string;
  priority: string;
  message: string;
}

/**
 * Responsive viewport for layout tests
 */
export interface ResponsiveViewport {
  width: number;
  height: number;
  name: string;
}
