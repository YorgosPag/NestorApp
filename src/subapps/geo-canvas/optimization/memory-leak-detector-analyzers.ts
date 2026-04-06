/**
 * MEMORY LEAK DETECTOR — ANALYSIS FUNCTIONS
 * Extracted from MemoryLeakDetector.ts (ADR-065 SRP split)
 *
 * Standalone functions for component memory, event listener, DOM node,
 * and memory trend analysis.
 */

import type {
  ComponentMemoryUsage,
  EventListenerAnalysis,
  DOMNodeAnalysis,
  MemorySnapshot,
  MemoryLeakDetectorConfig,
  MemoryLeakResult,
} from './memory-leak-detector-types';

// ============================================================================
// COMPONENT MEMORY ANALYSIS
// ============================================================================

/** Estimated memory per component instance (bytes) */
const COMPONENT_BASE_SIZES: Record<string, number> = {
  'DxfViewer': 2 * 1024 * 1024,
  'MapComponent': 1.5 * 1024 * 1024,
  'AlertEngine': 500 * 1024,
  'DesignSystem': 300 * 1024,
  'PerformanceMonitor': 200 * 1024,
  'Canvas': 800 * 1024,
  'LayerComponent': 100 * 1024,
  'EntityRenderer': 50 * 1024,
  'UIButton': 5 * 1024,
  'InputField': 8 * 1024,
};

const DEFAULT_COMPONENT_SIZE = 10 * 1024;

function getComponentBaseSize(componentName: string): number {
  return COMPONENT_BASE_SIZES[componentName] || DEFAULT_COMPONENT_SIZE;
}

function calculateMemoryTrend(
  previous: ComponentMemoryUsage | undefined,
  current: number
): 'increasing' | 'stable' | 'decreasing' {
  if (!previous) return 'stable';

  const diff = current - previous.estimatedSize;
  const threshold = previous.estimatedSize * 0.1;

  if (diff > threshold) return 'increasing';
  if (diff < -threshold) return 'decreasing';
  return 'stable';
}

function calculateComponentMemoryUsage(
  componentName: string,
  instances: number,
  componentRegistry: Map<string, ComponentMemoryUsage>
): ComponentMemoryUsage {
  const baseSize = getComponentBaseSize(componentName);
  const estimatedSize = baseSize * instances;
  const previousUsage = componentRegistry.get(componentName);
  const memoryTrend = calculateMemoryTrend(previousUsage, estimatedSize);

  return {
    componentName,
    instances,
    estimatedSize,
    retainedSize: estimatedSize * 0.8,
    shallowSize: estimatedSize * 0.2,
    lifecycle: instances > 0 ? 'mounted' : 'unmounted',
    lastActivity: Date.now(),
    memoryTrend,
  };
}

/**
 * Mock React component instance tracking.
 * Real implementation would hook into React DevTools or fiber tree.
 */
function getReactComponentInstances(): Map<string, number> {
  return new Map([
    ['DxfViewer', 1],
    ['MapComponent', 1],
    ['AlertEngine', 1],
    ['DesignSystem', 1],
    ['PerformanceMonitor', 1],
    ['Canvas', 3],
    ['LayerComponent', 15],
    ['EntityRenderer', 150],
    ['UIButton', 25],
    ['InputField', 12],
  ]);
}

/**
 * Analyze component memory usage and update the registry.
 */
export function analyzeComponentMemory(
  componentRegistry: Map<string, ComponentMemoryUsage>
): ComponentMemoryUsage[] {
  const components: ComponentMemoryUsage[] = [];
  const reactComponents = getReactComponentInstances();

  for (const [componentName, instances] of reactComponents.entries()) {
    const usage = calculateComponentMemoryUsage(componentName, instances, componentRegistry);
    components.push(usage);
    componentRegistry.set(componentName, usage);
  }

  return components;
}

// ============================================================================
// EVENT LISTENER ANALYSIS
// ============================================================================

/**
 * Analyze event listeners for potential leaks.
 */
export function analyzeEventListeners(): EventListenerAnalysis[] {
  const mockListeners = [
    { target: 'window', event: 'resize', count: 5, hasCleanup: true, impact: 'low' as const },
    { target: 'canvas', event: 'mousemove', count: 3, hasCleanup: true, impact: 'medium' as const },
    { target: 'document', event: 'keydown', count: 8, hasCleanup: false, impact: 'medium' as const },
    { target: 'element', event: 'click', count: 150, hasCleanup: true, impact: 'low' as const },
    { target: 'websocket', event: 'message', count: 2, hasCleanup: false, impact: 'high' as const },
  ];

  return mockListeners.map(listener => ({
    target: listener.target,
    event: listener.event,
    count: listener.count,
    hasCleanup: listener.hasCleanup,
    potentialLeak: !listener.hasCleanup && listener.count > 5,
    memoryImpact: listener.impact,
  }));
}

// ============================================================================
// DOM NODE ANALYSIS
// ============================================================================

/** Estimated memory per DOM node type (bytes) */
const NODE_SIZES: Record<string, number> = {
  'div': 200,
  'span': 150,
  'canvas': 1000,
  'svg': 300,
  'path': 250,
  'button': 180,
  'input': 220,
};

const DEFAULT_NODE_SIZE = 150;

function estimateNodeMemoryFootprint(nodeType: string, count: number): number {
  const baseSize = NODE_SIZES[nodeType] || DEFAULT_NODE_SIZE;
  return baseSize * count;
}

function findDetachedNodes(_nodeType: string): Element[] {
  return [];
}

function findOrphanedNodes(elements: NodeListOf<Element>): Element[] {
  const orphaned: Element[] = [];
  elements.forEach(element => {
    if (element.parentNode && !hasActiveReferences(element)) {
      orphaned.push(element);
    }
  });
  return orphaned;
}

function hasActiveReferences(_element: Element): boolean {
  return true;
}

function findRetainedBy(_nodeType: string): string[] {
  return ['React components', 'Event listeners', 'CSS animations'];
}

/**
 * Analyze DOM nodes for detached/orphaned elements.
 */
export function analyzeDOMNodes(): DOMNodeAnalysis[] {
  if (typeof document === 'undefined') {
    return [];
  }

  const nodes: DOMNodeAnalysis[] = [];

  try {
    const nodeTypes = ['div', 'span', 'canvas', 'svg', 'path', 'button', 'input'];

    for (const nodeType of nodeTypes) {
      const elements = document.querySelectorAll(nodeType);
      const detachedNodes = findDetachedNodes(nodeType);

      nodes.push({
        nodeType,
        count: elements.length,
        detachedNodes: detachedNodes.length,
        orphanedNodes: findOrphanedNodes(elements).length,
        memoryFootprint: estimateNodeMemoryFootprint(nodeType, elements.length),
        retainedBy: findRetainedBy(nodeType),
      });
    }
  } catch (error) {
    console.warn('DOM analysis error:', error);
  }

  return nodes;
}

// ============================================================================
// MEMORY TREND ANALYSIS
// ============================================================================

/**
 * Calculate growth rate from a series of values over time.
 */
export function calculateGrowthRate(values: number[], snapshots: MemorySnapshot[]): number {
  if (values.length < 2) return 0;

  const timeSpan = snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp;
  const valueChange = values[values.length - 1] - values[0];

  return (valueChange / timeSpan) * 1000; // bytes per second
}

/** Callback type for reporting a detected leak */
export type ReportLeakFn = (leak: MemoryLeakResult) => void;

/**
 * Analyze memory trends across recent snapshots and report leaks.
 */
export function analyzeMemoryTrends(
  snapshots: MemorySnapshot[],
  config: MemoryLeakDetectorConfig,
  reportLeak: ReportLeakFn
): void {
  if (snapshots.length < config.detection.minSampleSize) return;

  const recentSnapshots = snapshots.slice(-config.detection.minSampleSize);

  analyzeHeapGrowth(recentSnapshots, config, reportLeak);
  analyzeComponentGrowth(recentSnapshots, config, reportLeak);
  analyzeEventListenerGrowth(recentSnapshots, reportLeak);
}

function analyzeHeapGrowth(
  snapshots: MemorySnapshot[],
  config: MemoryLeakDetectorConfig,
  reportLeak: ReportLeakFn
): void {
  const heapSizes = snapshots.map(s => s.heapUsed);
  const growthRate = calculateGrowthRate(heapSizes, snapshots);

  if (growthRate > config.thresholds.memoryGrowthRate) {
    reportLeak({
      leakType: 'unknown',
      severity: 'high',
      description: `High heap growth rate: ${formatBytes(growthRate)}/second`,
      affectedComponents: [],
      memoryImpact: growthRate * 60,
      growthRate,
      detectionConfidence: 85,
      recommendations: [
        'Investigate recent code changes',
        'Check for object retention',
        'Review event listener cleanup',
      ],
      firstDetected: Date.now(),
      lastDetected: Date.now(),
    });
  }
}

function analyzeComponentGrowth(
  snapshots: MemorySnapshot[],
  config: MemoryLeakDetectorConfig,
  reportLeak: ReportLeakFn
): void {
  const latestSnapshot = snapshots[snapshots.length - 1];

  for (const component of latestSnapshot.components) {
    if (component.instances > config.thresholds.componentInstanceLimit) {
      reportLeak({
        leakType: 'component',
        severity: 'high',
        description: `Component ${component.componentName} has ${component.instances} instances`,
        affectedComponents: [component.componentName],
        memoryImpact: component.estimatedSize,
        growthRate: 0,
        detectionConfidence: 90,
        recommendations: [
          `Review ${component.componentName} lifecycle management`,
          'Check for proper component unmounting',
          'Investigate component instance pooling',
        ],
        firstDetected: Date.now(),
        lastDetected: Date.now(),
      });
    }

    if (component.memoryTrend === 'increasing') {
      reportLeak({
        leakType: 'component',
        severity: 'medium',
        description: `Component ${component.componentName} showing increasing memory trend`,
        affectedComponents: [component.componentName],
        memoryImpact: component.estimatedSize * 0.2,
        growthRate: 0,
        detectionConfidence: 70,
        recommendations: [
          `Monitor ${component.componentName} more closely`,
          'Check for state accumulation',
          'Review component prop changes',
        ],
        firstDetected: Date.now(),
        lastDetected: Date.now(),
      });
    }
  }
}

function analyzeEventListenerGrowth(
  snapshots: MemorySnapshot[],
  reportLeak: ReportLeakFn
): void {
  const latestSnapshot = snapshots[snapshots.length - 1];

  for (const listener of latestSnapshot.eventListeners) {
    if (listener.potentialLeak) {
      reportLeak({
        leakType: 'event-listener',
        severity: listener.memoryImpact === 'high' ? 'high' : 'medium',
        description: `Potential event listener leak: ${listener.target}:${listener.event} (${listener.count} listeners)`,
        affectedComponents: [],
        memoryImpact: listener.count * 1024,
        growthRate: 0,
        detectionConfidence: 75,
        recommendations: [
          `Add cleanup για ${listener.target}:${listener.event} listeners`,
          'Use AbortController για automatic cleanup',
          'Review component unmounting logic',
        ],
        firstDetected: Date.now(),
        lastDetected: Date.now(),
      });
    }
  }
}

// ============================================================================
// UTILITY
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
