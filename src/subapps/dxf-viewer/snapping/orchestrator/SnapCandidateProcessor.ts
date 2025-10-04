/**
 * SnapCandidateProcessor
 * Processes and sorts snap candidates to determine the best result
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';

export class SnapCandidateProcessor {
  private candidateIndex = 0;

  processResults(
    cursorPoint: Point2D, 
    candidates: SnapCandidate[], 
    settings: ProSnapSettings
  ): ProSnapResult {
    if (candidates.length === 0) {
      return this.createEmptyResult(cursorPoint);
    }

    // Ταξινόμηση candidates κατά priority και απόσταση
    const sortedCandidates = this.sortCandidates(candidates);
    
    // Hysteresis για σταθεροποίηση της επιλογής
    let bestCandidate = sortedCandidates[0];
    
    if (settings.tabCycling && this.candidateIndex > 0) {
      const cycleIndex = this.candidateIndex % sortedCandidates.length;
      bestCandidate = sortedCandidates[cycleIndex];
    }

    return {
      found: true,
      snapPoint: bestCandidate,
      allCandidates: sortedCandidates,
      originalPoint: cursorPoint,
      snappedPoint: bestCandidate.point,
      activeMode: bestCandidate.type,
      timestamp: Date.now()
    };
  }

  private sortCandidates(candidates: SnapCandidate[]): SnapCandidate[] {
    return candidates.sort((a, b) => {
      // Πρώτα κατά priority (μικρότερο = υψηλότερη προτεραιότητα)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // Μετά κατά απόσταση
      return a.distance - b.distance;
    });
  }

  private createEmptyResult(cursorPoint: Point2D): ProSnapResult {
    return {
      found: false,
      snapPoint: null,
      allCandidates: [],
      originalPoint: cursorPoint,
      snappedPoint: cursorPoint,
      activeMode: null,
      timestamp: Date.now()
    };
  }

  cycleCandidates(): void {
    this.candidateIndex = (this.candidateIndex + 1) % 10; // Arbitrary limit
  }

  resetCandidateIndex(): void {
    this.candidateIndex = 0;
  }

  getCandidateIndex(): number {
    return this.candidateIndex;
  }
}