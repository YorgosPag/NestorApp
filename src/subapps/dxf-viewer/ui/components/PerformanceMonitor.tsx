/**
 * @module PerformanceMonitor
 * @description Real-time performance monitoring για conference demo
 * Shows FPS, memory usage, render times
 */

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, Zap, Database } from 'lucide-react';
import { getPerformanceMetrics } from '../../utils/performance';
import { layoutUtilities } from '@/styles/design-tokens';

interface PerformanceStats {
  fps: number;
  memory: number;
  renderCount: number;
  slowRenders: number;
  avgRenderTime: number;
}

interface PerformanceMonitorProps {
  show?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

const PerformanceMonitorComponent: React.FC<PerformanceMonitorProps> = ({
  show = true,
  position = 'bottom-right',
  compact = false,
}) => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    memory: 0,
    renderCount: 0,
    slowRenders: 0,
    avgRenderTime: 0,
  });

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const renderTimes = useRef<number[]>([]);

  useEffect(() => {
    if (!show) return;

    let animationId: number;

    const updateStats = () => {
      const now = performance.now();
      const delta = now - lastTime.current;

      frameCount.current++;

      // Calculate FPS every second
      if (delta >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / delta);
        frameCount.current = 0;
        lastTime.current = now;

        const metrics = getPerformanceMetrics();

        // Calculate average render time
        const avgRenderTime = renderTimes.current.length > 0
          ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
          : 0;

        // Count slow renders (> 16.67ms για 60fps)
        const slowRenders = renderTimes.current.filter(t => t > 16.67).length;

        setStats({
          fps,
          memory: metrics.memory,
          renderCount: renderTimes.current.length,
          slowRenders,
          avgRenderTime,
        });

        // Reset render times για next second
        renderTimes.current = [];
      }

      animationId = requestAnimationFrame(updateStats);
    };

    animationId = requestAnimationFrame(updateStats);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [show]);

  if (!show) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }[position];

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getMemoryColor = (memory: number) => {
    if (memory < 50) return 'text-green-400';
    if (memory < 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (compact) {
    return (
      <div
        className={`fixed ${positionClasses} z-50 bg-gray-900 bg-opacity-90 backdrop-blur-sm rounded-lg p-2 shadow-xl border border-gray-700`}
      >
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center">
            <Zap className={`h-3 w-3 mr-1 ${getFpsColor(stats.fps)}`} />
            <span className={getFpsColor(stats.fps)}>{stats.fps} FPS</span>
          </div>
          <div className="flex items-center">
            <Database className={`h-3 w-3 mr-1 ${getMemoryColor(stats.memory)}`} />
            <span className={getMemoryColor(stats.memory)}>{stats.memory.toFixed(1)} MB</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed ${positionClasses} z-50 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-gray-700 min-w-[200px]`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300 flex items-center">
          <Activity className="h-3 w-3 mr-1" />
          Performance Monitor
        </h3>
      </div>

      <div className="space-y-2">
        {/* FPS */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">FPS</span>
          <div className="flex items-center">
            <div className={`text-xs font-mono ${getFpsColor(stats.fps)}`}>
              {stats.fps}
            </div>
            <div className="ml-2 w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${getFpsColor(stats.fps).replace('text-', 'bg-')}`}
                style={{ width: layoutUtilities.percentage(Math.min((stats.fps / 60) * 100, 100)) }}
              />
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Memory</span>
          <div className="flex items-center">
            <div className={`text-xs font-mono ${getMemoryColor(stats.memory)}`}>
              {stats.memory.toFixed(1)} MB
            </div>
            <div className="ml-2 w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${getMemoryColor(stats.memory).replace('text-', 'bg-')}`}
                style={{ width: layoutUtilities.percentage(Math.min((stats.memory / 200) * 100, 100)) }}
              />
            </div>
          </div>
        </div>

        {/* Render Time */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Render</span>
          <div className="text-xs font-mono text-gray-300">
            {stats.avgRenderTime.toFixed(2)} ms
          </div>
        </div>

        {/* Slow Renders */}
        {stats.slowRenders > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Slow</span>
            <div className="text-xs font-mono text-yellow-400">
              {stats.slowRenders} frames
            </div>
          </div>
        )}
      </div>

      {/* Performance Grade */}
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Grade</span>
          <span className={`text-xs font-bold ${
            stats.fps >= 55 && stats.memory < 100 && stats.avgRenderTime < 16.67
              ? 'text-green-400'
              : stats.fps >= 30 && stats.memory < 150
              ? 'text-yellow-400'
              : 'text-red-400'
          }`}>
            {stats.fps >= 55 && stats.memory < 100 && stats.avgRenderTime < 16.67
              ? 'Excellent'
              : stats.fps >= 30 && stats.memory < 150
              ? 'Good'
              : 'Needs Optimization'}
          </span>
        </div>
      </div>
    </div>
  );
};

// Export με memo για performance
export const PerformanceMonitor = React.memo(PerformanceMonitorComponent);

/**
 * Hook για tracking component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStart = useRef<number>();

  useEffect(() => {
    renderStart.current = performance.now();

    return () => {
      if (renderStart.current) {
        const renderTime = performance.now() - renderStart.current;

        // Track render time
        if ((window as Window & { __renderTimes?: number[] }).__renderTimes) {
          (window as Window & { __renderTimes: number[] }).__renderTimes.push(renderTime);
        } else {
          (window as Window & { __renderTimes: number[] }).__renderTimes = [renderTime];
        }

        // Log slow renders
        if (renderTime > 16.67 && process.env.NODE_ENV === 'development') {
          console.warn(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`);
        }
      }
    };
  });
}