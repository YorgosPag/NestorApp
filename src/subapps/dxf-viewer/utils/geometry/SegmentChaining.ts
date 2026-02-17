/**
 * Segment chaining utilities for connecting geometric segments
 * 🏢 ADR-186: Updated with configurable force-connect tolerances for JOIN operations
 */

import type { Point2D } from '../../rendering/types/Types';
import { Segment, samePoint, nearPoint, debugSegments } from './GeometryUtils';
import type { AnySceneEntity } from '../../types/scene';
// 🏢 ADR-065: Centralized Distance Calculation
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-186: Centralized JOIN Tolerances
import { JOIN_TOLERANCES } from '../../config/tolerance-config';

// Connection result for force-connect algorithm
interface ConnectionCandidate {
  seg: Segment & { index: number };
  point: 'start' | 'end';
  distance: number;
  target: 'head' | 'tail';
}

export interface ChainResult {
  chain: Point2D[];
  unusedSegments: number;
  success: boolean;
  /** Minimum gap distance between closest unconnected endpoints (when chain fails) */
  minGapDistance?: number;
}

/**
 * Chain segments together using greedy algorithm.
 *
 * @param segs - Segments to chain
 * @param originalEntities - Original entities (for debug)
 * @param forceConnectTolerances - Custom tolerance array for force-connect (default: DEFAULT_CHAIN)
 *   For JOIN operations, pass JOIN_TOLERANCES.FORCE_CONNECT for generous matching.
 */
export function chainSegments(
  segs: Segment[],
  originalEntities: AnySceneEntity[] = [],
  forceConnectTolerances: readonly number[] = JOIN_TOLERANCES.DEFAULT_CHAIN,
): Point2D[] | null {
  if (segs.length === 0) return [];
  
  const used = new Array(segs.length).fill(false);
  const chain: Point2D[] = [];

  // Debug: log all segments before chaining
  debugSegments(segs, "Input");

  // Start from an arbitrary segment
  let idx = 0;
  used[idx] = true;
  chain.push(segs[idx].start, segs[idx].end);

  let extended = true;
  let iteration = 0;
  
  while (extended) {
    extended = false;
    iteration++;
    const chainTail = chain[chain.length - 1];
    const chainHead = chain[0];

    // Try to connect at the tail
    for (let i = 0; i < segs.length; i++) {
      if (!used[i]) {
        const seg = segs[i];
        const tailToStart = calculateDistance(chainTail, seg.start);
        const tailToEnd = calculateDistance(chainTail, seg.end);

        // Try exact match first
        if (samePoint(chainTail, seg.start)) {

          chain.push(seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        if (samePoint(chainTail, seg.end)) {

          chain.push(seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        
        // Try gap tolerance connections
        if (nearPoint(chainTail, seg.start)) {

          chain.push(seg.start, seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        if (nearPoint(chainTail, seg.end)) {

          chain.push(seg.end, seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
      }
    }

    // Try to connect at the head
    for (let i = 0; i < segs.length; i++) {
      if (!used[i]) {
        const seg = segs[i];
        const headToStart = calculateDistance(chainHead, seg.start);
        const headToEnd = calculateDistance(chainHead, seg.end);

        // Try exact match first
        if (samePoint(chainHead, seg.end)) {

          chain.unshift(seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        if (samePoint(chainHead, seg.start)) {

          chain.unshift(seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        
        // Try gap tolerance connections
        if (nearPoint(chainHead, seg.end)) {

          chain.unshift(seg.end, seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        if (nearPoint(chainHead, seg.start)) {

          chain.unshift(seg.start, seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
      }
    }
    
    if (!extended) {
      // ✅ REMOVED CONSOLE.LOG: Can cause spam in geometry processing loops

    }
  }

  // Check for unused segments and try force-connect
  const unusedCount = used.filter(u => !u).length;
  if (unusedCount > 0) {
    console.warn(`❌ ${unusedCount} segments remain unconnected. Trying force-connect...`);

    const unusedSegs = segs
      .map((seg, i) => ({ ...seg, index: i }))
      .filter((seg, i) => !used[i]);
    
    unusedSegs.forEach((seg) => {

    });

    // Debug: Check distances from chain endpoints to unused segments
    if (chain.length > 0 && unusedSegs.length > 0) {
      const chainStart = chain[0];
      const chainEnd = chain[chain.length - 1];

      unusedSegs.forEach((seg) => {
        const distToStart = Math.min(
          calculateDistance(chainStart, seg.start),
          calculateDistance(chainStart, seg.end)
        );
        const distToEnd = Math.min(
          calculateDistance(chainEnd, seg.start),
          calculateDistance(chainEnd, seg.end)
        );

      });
    }
    
    // Try force-connect with increasing distance tolerance
    // 🏢 ADR-186: Use configurable tolerances (generous for JOIN, tight for auto-chain)
    for (const tolerance of forceConnectTolerances) {
      const forceResult = tryForceConnect(chain, unusedSegs, tolerance);
      if (forceResult) {
        console.log(`[SegmentChaining] Force-connected at tolerance ${tolerance} CAD units`);
        return forceResult;
      }
    }

    // Calculate minimum gap distance for error reporting
    const minGap = computeMinGapDistance(chain, unusedSegs);
    const maxTolerance = forceConnectTolerances[forceConnectTolerances.length - 1];
    console.warn(
      `[SegmentChaining] Force-connect failed. Min gap: ${minGap.toFixed(2)} CAD units, max tolerance: ${maxTolerance}`
    );
    return null;
  }

  return chain;
}

/**
 * Force-connect algorithm: try to connect remaining segments by finding closest endpoints
 */
export function tryForceConnect(
  chain: Point2D[],
  unusedSegs: Array<Segment & { index: number }>,
  maxForceDistance: number = 1.0
): Point2D[] | null {
  if (unusedSegs.length === 0) return chain;

  const extendedChain = [...chain];
  const remaining = [...unusedSegs];
  
  while (remaining.length > 0) {
    const chainTail = extendedChain[extendedChain.length - 1];
    const chainHead = extendedChain[0];
    
    let bestConnection: ConnectionCandidate | null = null;
    
    // Find closest unused segment to either head or tail
    for (const seg of remaining) {
      const tailToStart = calculateDistance(chainTail, seg.start);
      const tailToEnd = calculateDistance(chainTail, seg.end);
      const headToStart = calculateDistance(chainHead, seg.start);
      const headToEnd = calculateDistance(chainHead, seg.end);

      const connections: ConnectionCandidate[] = [
        { seg, point: 'start' as const, distance: tailToStart, target: 'tail' as const },
        { seg, point: 'end' as const, distance: tailToEnd, target: 'tail' as const },
        { seg, point: 'start' as const, distance: headToStart, target: 'head' as const },
        { seg, point: 'end' as const, distance: headToEnd, target: 'head' as const }
      ];
      
      for (const conn of connections) {
        if (conn.distance <= maxForceDistance && (!bestConnection || conn.distance < bestConnection.distance)) {
          bestConnection = conn;
        }
      }
    }
    
    if (!bestConnection) {

      return null;
    }
    
    // Apply the best connection
    const seg = bestConnection.seg;

    if (bestConnection.target === 'tail') {
      if (bestConnection.point === 'start') {
        extendedChain.push(seg.start, seg.end);
      } else {
        extendedChain.push(seg.end, seg.start);
      }
    } else {
      // head
      if (bestConnection.point === 'end') {
        extendedChain.unshift(seg.start, seg.end);
      } else {
        extendedChain.unshift(seg.end, seg.start);
      }
    }
    
    // Remove from remaining
    const segIndex = remaining.indexOf(seg);
    remaining.splice(segIndex, 1);
  }

  return extendedChain;
}

/**
 * Compute the minimum distance between chain endpoints and unused segment endpoints.
 * Used for error reporting when force-connect fails.
 */
function computeMinGapDistance(
  chain: Point2D[],
  unusedSegs: Array<Segment & { index: number }>,
): number {
  if (chain.length === 0 || unusedSegs.length === 0) return Infinity;

  const chainHead = chain[0];
  const chainTail = chain[chain.length - 1];
  let minDist = Infinity;

  for (const seg of unusedSegs) {
    const d1 = calculateDistance(chainTail, seg.start);
    const d2 = calculateDistance(chainTail, seg.end);
    const d3 = calculateDistance(chainHead, seg.start);
    const d4 = calculateDistance(chainHead, seg.end);
    minDist = Math.min(minDist, d1, d2, d3, d4);
  }

  return minDist;
}

/**
 * Chain segments and return detailed result with gap info.
 * Used by EntityMergeService for better error messaging.
 */
export function chainSegmentsDetailed(
  segs: Segment[],
  originalEntities: AnySceneEntity[] = [],
  forceConnectTolerances: readonly number[] = JOIN_TOLERANCES.FORCE_CONNECT,
): ChainResult {
  if (segs.length === 0) {
    return { chain: [], unusedSegments: 0, success: true };
  }

  const result = chainSegments(segs, originalEntities, forceConnectTolerances);

  if (result && result.length >= 2) {
    return { chain: result, unusedSegments: 0, success: true };
  }

  // Failed — compute gap info for error messaging
  // Re-run the initial chain to find unused segments
  const used = new Array(segs.length).fill(false);
  const tempChain: Point2D[] = [];
  used[0] = true;
  tempChain.push(segs[0].start, segs[0].end);

  // Quick greedy pass to find what connected
  let extended = true;
  while (extended) {
    extended = false;
    const tail = tempChain[tempChain.length - 1];
    const head = tempChain[0];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      if (samePoint(tail, segs[i].start) || nearPoint(tail, segs[i].start)) {
        tempChain.push(segs[i].end);
        used[i] = true;
        extended = true;
      } else if (samePoint(tail, segs[i].end) || nearPoint(tail, segs[i].end)) {
        tempChain.push(segs[i].start);
        used[i] = true;
        extended = true;
      } else if (samePoint(head, segs[i].end) || nearPoint(head, segs[i].end)) {
        tempChain.unshift(segs[i].start);
        used[i] = true;
        extended = true;
      } else if (samePoint(head, segs[i].start) || nearPoint(head, segs[i].start)) {
        tempChain.unshift(segs[i].end);
        used[i] = true;
        extended = true;
      }
    }
  }

  const unusedSegs = segs
    .map((seg, i) => ({ ...seg, index: i }))
    .filter((_, i) => !used[i]);

  const minGap = computeMinGapDistance(tempChain, unusedSegs);

  return {
    chain: tempChain,
    unusedSegments: unusedSegs.length,
    success: false,
    minGapDistance: minGap,
  };
}