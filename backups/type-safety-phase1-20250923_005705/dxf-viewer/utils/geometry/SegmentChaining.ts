/**
 * Segment chaining utilities for connecting geometric segments
 */

import { Point2D, Segment, samePoint, nearPoint, debugSegments } from './GeometryUtils';

export interface ChainResult {
  chain: Point2D[];
  unusedSegments: number;
  success: boolean;
}

/**
 * Chain segments together using greedy algorithm
 */
export function chainSegments(segs: Segment[], originalEntities: any[] = []): Point2D[] | null {
  if (segs.length === 0) return [];
  
  const used = new Array(segs.length).fill(false);
  const chain: Point2D[] = [];

  // Debug: log all segments before chaining
  debugSegments(segs, "Input");

  // Start from an arbitrary segment
  let idx = 0;
  used[idx] = true;
  chain.push(segs[idx].start, segs[idx].end);
  
  console.log(`🔗 Starting chain with segment [${idx}]: (${segs[idx].start.x.toFixed(3)}, ${segs[idx].start.y.toFixed(3)}) → (${segs[idx].end.x.toFixed(3)}, ${segs[idx].end.y.toFixed(3)})`);

  let extended = true;
  let iteration = 0;
  
  while (extended) {
    extended = false;
    iteration++;
    const chainTail = chain[chain.length - 1];
    const chainHead = chain[0];
    
    console.log(`🔄 Iteration ${iteration}: Chain has ${chain.length} vertices, tail:(${chainTail.x.toFixed(3)}, ${chainTail.y.toFixed(3)}), head:(${chainHead.x.toFixed(3)}, ${chainHead.y.toFixed(3)})`);

    // Try to connect at the tail
    for (let i = 0; i < segs.length; i++) {
      if (!used[i]) {
        const seg = segs[i];
        const tailToStart = Math.sqrt((chainTail.x - seg.start.x) ** 2 + (chainTail.y - seg.start.y) ** 2);
        const tailToEnd = Math.sqrt((chainTail.x - seg.end.x) ** 2 + (chainTail.y - seg.end.y) ** 2);
        
        // Try exact match first
        if (samePoint(chainTail, seg.start)) {
          console.log(`  ✅ Connected segment [${i}] to tail: tail→start (exact, dist: ${tailToStart.toFixed(6)})`);
          chain.push(seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        if (samePoint(chainTail, seg.end)) {
          console.log(`  ✅ Connected segment [${i}] to tail: tail→end (exact, dist: ${tailToEnd.toFixed(6)})`);
          chain.push(seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        
        // Try gap tolerance connections
        if (nearPoint(chainTail, seg.start)) {
          console.log(`  ✅ Connected segment [${i}] to tail: tail→start (gap, dist: ${tailToStart.toFixed(6)})`);
          chain.push(seg.start, seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        if (nearPoint(chainTail, seg.end)) {
          console.log(`  ✅ Connected segment [${i}] to tail: tail→end (gap, dist: ${tailToEnd.toFixed(6)})`);
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
        const headToStart = Math.sqrt((chainHead.x - seg.start.x) ** 2 + (chainHead.y - seg.start.y) ** 2);
        const headToEnd = Math.sqrt((chainHead.x - seg.end.x) ** 2 + (chainHead.y - seg.end.y) ** 2);
        
        // Try exact match first
        if (samePoint(chainHead, seg.end)) {
          console.log(`  ✅ Connected segment [${i}] to head: head→end (exact, dist: ${headToEnd.toFixed(6)})`);
          chain.unshift(seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        if (samePoint(chainHead, seg.start)) {
          console.log(`  ✅ Connected segment [${i}] to head: head→start (exact, dist: ${headToStart.toFixed(6)})`);
          chain.unshift(seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
        
        // Try gap tolerance connections
        if (nearPoint(chainHead, seg.end)) {
          console.log(`  ✅ Connected segment [${i}] to head: head→end (gap, dist: ${headToEnd.toFixed(6)})`);
          chain.unshift(seg.end, seg.start);
          used[i] = true;
          extended = true;
          continue;
        }
        if (nearPoint(chainHead, seg.start)) {
          console.log(`  ✅ Connected segment [${i}] to head: head→start (gap, dist: ${headToStart.toFixed(6)})`);
          chain.unshift(seg.start, seg.end);
          used[i] = true;
          extended = true;
          continue;
        }
      }
    }
    
    if (!extended) {
      console.log(`🛑 No more connections found after ${iteration} iterations`);
    }
  }

  // Check for unused segments and try force-connect
  const unusedCount = used.filter(u => !u).length;
  if (unusedCount > 0) {
    console.warn(`❌ ${unusedCount} segments remain unconnected. Trying force-connect...`);
    console.log('🔍 Chain vertices before force-connect:', chain.length);
    console.log('🔍 Unused segments:');
    
    const unusedSegs = segs
      .map((seg, i) => ({ ...seg, index: i }))
      .filter((seg, i) => !used[i]);
    
    unusedSegs.forEach((seg) => {
      console.log(`  [${seg.index}] start:(${seg.start.x.toFixed(3)}, ${seg.start.y.toFixed(3)}) end:(${seg.end.x.toFixed(3)}, ${seg.end.y.toFixed(3)})`);
    });

    // Debug: Check distances from chain endpoints to unused segments
    if (chain.length > 0 && unusedSegs.length > 0) {
      const chainStart = chain[0];
      const chainEnd = chain[chain.length - 1];
      console.log(`Chain endpoints: start:(${chainStart.x.toFixed(3)}, ${chainStart.y.toFixed(3)}) end:(${chainEnd.x.toFixed(3)}, ${chainEnd.y.toFixed(3)})`);
      
      unusedSegs.forEach((seg) => {
        const distToStart = Math.min(
          Math.hypot(chainStart.x - seg.start.x, chainStart.y - seg.start.y),
          Math.hypot(chainStart.x - seg.end.x, chainStart.y - seg.end.y)
        );
        const distToEnd = Math.min(
          Math.hypot(chainEnd.x - seg.start.x, chainEnd.y - seg.start.y),
          Math.hypot(chainEnd.x - seg.end.x, chainEnd.y - seg.end.y)
        );
        console.log(`  [${seg.index}] distances: to chain start = ${distToStart.toFixed(3)}, to chain end = ${distToEnd.toFixed(3)}`);
      });
    }
    
    // Try force-connect with increasing distance tolerance
    const tolerances = [0.2, 0.5, 1.0, 2.0];
    for (const tolerance of tolerances) {
      const forceResult = tryForceConnect(chain, unusedSegs, tolerance);
      if (forceResult) {
        console.log(`✅ Force-connect successful with tolerance ${tolerance}!`);
        return forceResult;
      }
    }
    
    console.warn(`❌ Even force-connect failed. Segments are too disconnected.`);
    return null;
  }
  
  console.log(`✅ Successfully chained ${segs.length} segments into ${chain.length} vertices`);
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
  
  console.log(`🔧 Trying force-connect for ${unusedSegs.length} unused segments (max distance: ${maxForceDistance})`);
  
  const extendedChain = [...chain];
  const remaining = [...unusedSegs];
  
  while (remaining.length > 0) {
    const chainTail = extendedChain[extendedChain.length - 1];
    const chainHead = extendedChain[0];
    
    let bestConnection: {
      seg: any;
      point: string;
      distance: number;
      target: string;
    } | null = null;
    
    // Find closest unused segment to either head or tail
    for (const seg of remaining) {
      const tailToStart = Math.sqrt((chainTail.x - seg.start.x) ** 2 + (chainTail.y - seg.start.y) ** 2);
      const tailToEnd = Math.sqrt((chainTail.x - seg.end.x) ** 2 + (chainTail.y - seg.end.y) ** 2);
      const headToStart = Math.sqrt((chainHead.x - seg.start.x) ** 2 + (chainHead.y - seg.start.y) ** 2);
      const headToEnd = Math.sqrt((chainHead.x - seg.end.x) ** 2 + (chainHead.y - seg.end.y) ** 2);
      
      const connections = [
        { seg, point: 'start', distance: tailToStart, target: 'tail' },
        { seg, point: 'end', distance: tailToEnd, target: 'tail' },
        { seg, point: 'start', distance: headToStart, target: 'head' },
        { seg, point: 'end', distance: headToEnd, target: 'head' }
      ];
      
      for (const conn of connections) {
        if (conn.distance <= maxForceDistance && (!bestConnection || conn.distance < bestConnection.distance)) {
          bestConnection = conn;
        }
      }
    }
    
    if (!bestConnection) {
      console.log(`❌ No force-connect possible within ${maxForceDistance} units`);
      return null;
    }
    
    // Apply the best connection
    const seg = bestConnection.seg;
    console.log(`🔧 Force-connecting segment [${seg.index}] to ${bestConnection.target} (${bestConnection.point}, dist: ${bestConnection.distance.toFixed(3)})`);
    
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
  
  console.log(`✅ Force-connected all segments! Final chain: ${extendedChain.length} vertices`);
  return extendedChain;
}