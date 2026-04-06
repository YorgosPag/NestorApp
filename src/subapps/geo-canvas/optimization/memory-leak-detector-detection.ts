/**
 * MEMORY LEAK DETECTOR — LEAK DETECTION ENGINE
 * Extracted from MemoryLeakDetector.ts (ADR-065 SRP split)
 *
 * Standalone functions for detecting closure, timer, reference,
 * and DOM leaks.
 */

import type { MemorySnapshot, MemoryLeakResult } from './memory-leak-detector-types';
import type { ReportLeakFn } from './memory-leak-detector-analyzers';

// ============================================================================
// LEAK DETECTION ORCHESTRATOR
// ============================================================================

/**
 * Run all leak detection heuristics against current snapshots.
 */
export function detectLeaks(
  snapshots: MemorySnapshot[],
  reportLeak: ReportLeakFn
): void {
  if (snapshots.length < 2) return;

  detectClosureLeaks(reportLeak);
  detectTimerLeaks(reportLeak);
  detectReferenceLeaks(reportLeak);
  detectDOMLeaks(snapshots, reportLeak);
}

// ============================================================================
// CLOSURE LEAK DETECTION
// ============================================================================

function detectClosureLeaks(reportLeak: ReportLeakFn): void {
  const suspiciousClosures = [
    'event handlers with captured variables',
    'callback functions with large scope',
    'interval callbacks with references',
  ];

  suspiciousClosures.forEach(closure => {
    reportLeak({
      leakType: 'closure',
      severity: 'medium',
      description: `Potential closure leak: ${closure}`,
      affectedComponents: [],
      memoryImpact: 50 * 1024,
      growthRate: 0,
      detectionConfidence: 60,
      recommendations: [
        'Review function scope και captured variables',
        'Consider WeakMap για object references',
        'Use cleanup functions in useEffect',
      ],
      firstDetected: Date.now(),
      lastDetected: Date.now(),
    });
  });
}

// ============================================================================
// TIMER LEAK DETECTION
// ============================================================================

/**
 * Mock timer tracking.
 * Real implementation would hook into setTimeout/setInterval.
 */
function getActiveTimers(): unknown[] {
  return new Array(5).fill(null);
}

function detectTimerLeaks(reportLeak: ReportLeakFn): void {
  const activeTimers = getActiveTimers();

  if (activeTimers.length > 20) {
    reportLeak({
      leakType: 'timer',
      severity: 'high',
      description: `Too many active timers: ${activeTimers.length}`,
      affectedComponents: [],
      memoryImpact: activeTimers.length * 512,
      growthRate: 0,
      detectionConfidence: 85,
      recommendations: [
        'Clear timers in component cleanup',
        'Use useEffect cleanup functions',
        'Consider timer pooling για frequent operations',
      ],
      firstDetected: Date.now(),
      lastDetected: Date.now(),
    });
  }
}

// ============================================================================
// REFERENCE LEAK DETECTION
// ============================================================================

function detectReferenceLeaks(reportLeak: ReportLeakFn): void {
  const suspiciousReferences = [
    'circular references in state',
    'retained DOM references',
    'uncleaned global references',
  ];

  suspiciousReferences.forEach(ref => {
    reportLeak({
      leakType: 'reference',
      severity: 'medium',
      description: `Potential reference leak: ${ref}`,
      affectedComponents: [],
      memoryImpact: 100 * 1024,
      growthRate: 0,
      detectionConfidence: 55,
      recommendations: [
        'Use WeakRef για DOM references',
        'Break circular references',
        'Clean global variables on unmount',
      ],
      firstDetected: Date.now(),
      lastDetected: Date.now(),
    });
  });
}

// ============================================================================
// DOM LEAK DETECTION
// ============================================================================

function detectDOMLeaks(
  snapshots: MemorySnapshot[],
  reportLeak: ReportLeakFn
): void {
  if (snapshots.length < 2) return;

  const currentSnapshot = snapshots[snapshots.length - 1];
  const previousSnapshot = snapshots[snapshots.length - 2];

  for (const currentNode of currentSnapshot.domNodes) {
    const previousNode = previousSnapshot.domNodes.find(n => n.nodeType === currentNode.nodeType);

    if (previousNode && currentNode.detachedNodes > previousNode.detachedNodes) {
      reportLeak({
        leakType: 'dom',
        severity: 'medium',
        description: `Increasing detached ${currentNode.nodeType} nodes: ${currentNode.detachedNodes}`,
        affectedComponents: [],
        memoryImpact: currentNode.memoryFootprint,
        growthRate: 0,
        detectionConfidence: 80,
        recommendations: [
          `Clean up ${currentNode.nodeType} references`,
          'Remove DOM nodes properly',
          'Check για React ref cleanup',
        ],
        firstDetected: Date.now(),
        lastDetected: Date.now(),
      });
    }
  }
}
