/**
 * SceneStatistics
 * Manages scene statistics and performance monitoring
 */

import type { SceneModel } from '../types/scene';

interface SceneStats {
  totalUpdates: number;
  reactUpdates: number;
  rendererUpdates: number;
  skippedUpdates: number;
  lastUpdateTime: number;
  lastUpdateSource: string;
}

export class SceneStatistics {
  private stats: SceneStats = {
    totalUpdates: 0,
    reactUpdates: 0,
    rendererUpdates: 0,
    skippedUpdates: 0,
    lastUpdateTime: 0,
    lastUpdateSource: 'none'
  };

  incrementTotalUpdates(): void {
    this.stats.totalUpdates++;
    this.stats.lastUpdateTime = Date.now();
  }

  incrementReactUpdates(): void {
    this.stats.reactUpdates++;
  }

  incrementRendererUpdates(): void {
    this.stats.rendererUpdates++;
  }

  incrementSkippedUpdates(): void {
    this.stats.skippedUpdates++;
  }

  setLastUpdateSource(source: string): void {
    this.stats.lastUpdateSource = source;
  }

  getStats(
    sceneVersion: number,
    currentScene: SceneModel | null,
    hasRenderer: boolean,
    hasReactCallback: boolean,
    updateInProgress: boolean
  ) {
    return {
      ...this.stats,
      currentSceneVersion: sceneVersion,
      hasScene: !!currentScene,
      entityCount: currentScene?.entities?.length || 0,
      hasRenderer,
      hasReactCallback,
      updateInProgress
    };
  }

  reset(): void {
    this.stats = {
      totalUpdates: 0,
      reactUpdates: 0,
      rendererUpdates: 0,
      skippedUpdates: 0,
      lastUpdateTime: 0,
      lastUpdateSource: 'none'
    };
  }
}
