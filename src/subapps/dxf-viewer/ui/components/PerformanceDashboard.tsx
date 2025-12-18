/**
 * 📊 DXF PERFORMANCE DASHBOARD
 *
 * Enterprise performance monitoring dashboard που εμφανίζει
 * real-time metrics, alerts, και optimization recommendations.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  MemoryStick,
  Zap,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Settings,
  BarChart3
} from 'lucide-react';
import { usePerformanceOptimization } from '../../hooks/performance/usePerformanceOptimization';
import type { PerformanceMetrics } from '../../performance/DxfPerformanceOptimizer';

interface PerformanceDashboardProps {
  /** Show in compact mode */
  compact?: boolean;
  /** Dashboard position */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Enable auto-hide when performance is optimal */
  autoHide?: boolean;
  /** Show detailed metrics */
  showDetails?: boolean;
}

/**
 * 📊 Main Performance Dashboard Component
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  compact = false,
  position = 'top-right',
  autoHide = false,
  showDetails = true
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [status, controls] = usePerformanceOptimization();

  // Auto-hide logic
  useEffect(() => {
    if (autoHide && status.isOptimal && status.alerts.length === 0) {
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [autoHide, status.isOptimal, status.alerts.length]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 right-4 z-50 bg-gray-900 bg-opacity-90 rounded-full p-2 shadow-lg hover:bg-opacity-100 transition-all duration-200"
        title="Show Performance Dashboard"
      >
        <Activity className="h-4 w-4 text-green-400" />
      </button>
    );
  }

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }[position];

  if (compact) {
    return <CompactDashboard status={status} controls={controls} positionClasses={positionClasses} />;
  }

  return (
    <div className={`fixed ${positionClasses} z-50 bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 min-w-[320px] max-w-[400px]`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-200">Performance Monitor</h3>
          <PerformanceGradeBadge grade={status.grade} />
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowOptimizations(!showOptimizations)}
            className="p-1 rounded hover:bg-gray-800 transition-colors"
            title="Toggle optimizations"
          >
            <Settings className="h-3 w-3 text-gray-400" />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded hover:bg-gray-800 transition-colors"
            title="Hide dashboard"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Current Metrics */}
        <CurrentMetrics metrics={status.metrics} />

        {/* Performance Alerts */}
        {status.alerts.length > 0 && (
          <PerformanceAlerts alerts={status.alerts} onClearAlerts={controls.clearAlerts} />
        )}

        {/* Quick Actions */}
        <QuickActions controls={controls} recommendations={status.recommendations} />

        {/* Optimization Panel */}
        {showOptimizations && (
          <OptimizationPanel
            recommendations={status.recommendations}
            onApplyOptimization={controls.applyOptimization}
            onApplyAll={controls.applyAllOptimizations}
          />
        )}

        {/* Performance History Chart */}
        {showDetails && status.history.length > 0 && (
          <PerformanceChart history={status.history} />
        )}
      </div>
    </div>
  );
};

/**
 * 📱 Compact Dashboard Version
 */
const CompactDashboard: React.FC<{
  status: any;
  controls: any;
  positionClasses: string;
}> = ({ status, controls, positionClasses }) => {
  return (
    <div className={`fixed ${positionClasses} z-50 bg-gray-900 bg-opacity-90 backdrop-blur-sm rounded-lg p-2 shadow-xl border border-gray-700`}>
      <div className="flex items-center space-x-3 text-xs">
        <div className="flex items-center">
          <Zap className={`h-3 w-3 mr-1 ${getFpsColor(status.metrics?.fps || 0)}`} />
          <span className={getFpsColor(status.metrics?.fps || 0)}>
            {status.metrics?.fps || 0} FPS
          </span>
        </div>
        <div className="flex items-center">
          <MemoryStick className={`h-3 w-3 mr-1 ${getMemoryColor(status.metrics?.memoryUsage || 0)}`} />
          <span className={getMemoryColor(status.metrics?.memoryUsage || 0)}>
            {(status.metrics?.memoryUsage || 0).toFixed(1)} MB
          </span>
        </div>
        {status.alerts.length > 0 && (
          <AlertTriangle className="h-3 w-3 text-yellow-400 animate-pulse" />
        )}
      </div>
    </div>
  );
};

/**
 * 🏆 Performance Grade Badge
 */
const PerformanceGradeBadge: React.FC<{ grade: string }> = ({ grade }) => {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'bg-green-900 text-green-300 border-green-700';
      case 'good': return 'bg-blue-900 text-blue-300 border-blue-700';
      case 'fair': return 'bg-yellow-900 text-yellow-300 border-yellow-700';
      case 'poor': return 'bg-red-900 text-red-300 border-red-700';
      default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getGradeColor(grade)}`}>
      {grade.toUpperCase()}
    </span>
  );
};

/**
 * 📊 Current Metrics Display
 */
const CurrentMetrics: React.FC<{ metrics: PerformanceMetrics | null }> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="text-center text-gray-400 text-sm py-4">
        <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
        Initializing performance monitoring...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* FPS */}
      <MetricCard
        icon={<Zap className="h-4 w-4" />}
        label="FPS"
        value={metrics.fps}
        unit=""
        color={getFpsColor(metrics.fps)}
        trend={getTrend(metrics.fps, 60)}
      />

      {/* Memory */}
      <MetricCard
        icon={<MemoryStick className="h-4 w-4" />}
        label="Memory"
        value={metrics.memoryUsage}
        unit="MB"
        color={getMemoryColor(metrics.memoryUsage)}
        trend={getTrend(metrics.memoryUsage, 100, true)}
      />

      {/* Render Time */}
      <MetricCard
        icon={<BarChart3 className="h-4 w-4" />}
        label="Render"
        value={metrics.renderTime}
        unit="ms"
        color={getRenderTimeColor(metrics.renderTime)}
        trend={getTrend(metrics.renderTime, 16.67, true)}
      />

      {/* Canvas Elements */}
      <MetricCard
        icon={<Activity className="h-4 w-4" />}
        label="Elements"
        value={metrics.canvasElements}
        unit=""
        color="text-gray-300"
        trend={null}
      />
    </div>
  );
};

/**
 * 📈 Metric Card Component
 */
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: string;
  trend: 'up' | 'down' | null;
}> = ({ icon, label, value, unit, color, trend }) => {
  return (
    <div className="bg-gray-800 bg-opacity-50 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <div className={color}>
          {icon}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-mono ${color}`}>
          {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}
          {unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
        </span>
        {trend && (
          <div className={`${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 🚨 Performance Alerts
 */
const PerformanceAlerts: React.FC<{
  alerts: any[];
  onClearAlerts: () => void;
}> = ({ alerts, onClearAlerts }) => {
  return (
    <div className="bg-red-950 bg-opacity-50 border border-red-900 rounded p-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1">
          <AlertTriangle className="h-3 w-3 text-red-400" />
          <span className="text-xs font-medium text-red-300">Performance Alerts</span>
        </div>
        <button
          onClick={onClearAlerts}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1">
        {alerts.slice(0, 3).map((alert, index) => (
          <div key={index} className="text-xs text-red-300">
            • {alert.message}
          </div>
        ))}
        {alerts.length > 3 && (
          <div className="text-xs text-red-400">
            +{alerts.length - 3} more alerts
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ⚡ Quick Actions
 */
const QuickActions: React.FC<{
  controls: any;
  recommendations: any[];
}> = ({ controls, recommendations }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex space-x-2">
        <button
          onClick={controls.measurePerformance}
          className="flex items-center space-x-1 px-2 py-1 bg-blue-900 bg-opacity-50 text-blue-300 text-xs rounded hover:bg-opacity-70 transition-colors"
          title="Measure performance"
        >
          <RefreshCcw className="h-3 w-3" />
          <span>Test</span>
        </button>
        {recommendations.length > 0 && (
          <button
            onClick={controls.applyAllOptimizations}
            className="flex items-center space-x-1 px-2 py-1 bg-green-900 bg-opacity-50 text-green-300 text-xs rounded hover:bg-opacity-70 transition-colors"
            title="Apply all optimizations"
          >
            <Zap className="h-3 w-3" />
            <span>Optimize</span>
          </button>
        )}
      </div>
      <span className="text-xs text-gray-400">
        {recommendations.length} recommendations
      </span>
    </div>
  );
};

/**
 * 💡 Optimization Panel
 */
const OptimizationPanel: React.FC<{
  recommendations: any[];
  onApplyOptimization: (id: string) => Promise<boolean>;
  onApplyAll: () => Promise<void>;
}> = ({ recommendations, onApplyOptimization, onApplyAll }) => {
  if (recommendations.length === 0) {
    return (
      <div className="bg-green-950 bg-opacity-30 border border-green-900 rounded p-2">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 text-green-400" />
          <span className="text-xs text-green-300">All optimizations applied!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded p-2">
      <div className="text-xs font-medium text-gray-300 mb-2">Optimization Recommendations:</div>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {recommendations.map((rec, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex-1 mr-2">
              <div className="text-xs text-gray-300">{rec.description}</div>
              <div className="text-xs text-gray-500">{rec.estimatedImprovement}</div>
            </div>
            <button
              onClick={() => onApplyOptimization(rec.id)}
              className="px-2 py-1 bg-blue-900 bg-opacity-50 text-blue-300 text-xs rounded hover:bg-opacity-70 transition-colors"
            >
              Apply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 📈 Performance History Chart (Simple)
 */
const PerformanceChart: React.FC<{ history: PerformanceMetrics[] }> = ({ history }) => {
  const maxFPS = Math.max(...history.map(m => m.fps), 60);
  const chartData = history.slice(-20); // Last 20 measurements

  return (
    <div className="bg-gray-800 bg-opacity-30 rounded p-2">
      <div className="text-xs font-medium text-gray-300 mb-2">FPS History (Last 20s)</div>
      <div className="flex items-end justify-between h-8 space-x-0.5">
        {chartData.map((metrics, index) => {
          const height = (metrics.fps / maxFPS) * 100;
          const color = getFpsBarColor(metrics.fps);

          return (
            <div
              key={index}
              className={`flex-1 ${color} rounded-sm`}
              style={{ height: `${height}%` }}
              title={`${metrics.fps} FPS`}
            />
          );
        })}
      </div>
      <div className="text-xs text-gray-500 mt-1 flex justify-between">
        <span>-20s</span>
        <span>now</span>
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getFpsColor(fps: number): string {
  if (fps >= 55) return 'text-green-400';
  if (fps >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function getFpsBarColor(fps: number): string {
  if (fps >= 55) return 'bg-green-400';
  if (fps >= 30) return 'bg-yellow-400';
  return 'bg-red-400';
}

function getMemoryColor(memory: number): string {
  if (memory < 100) return 'text-green-400';
  if (memory < 256) return 'text-yellow-400';
  return 'text-red-400';
}

function getRenderTimeColor(time: number): string {
  if (time < 16.67) return 'text-green-400';
  if (time < 33) return 'text-yellow-400';
  return 'text-red-400';
}

function getTrend(current: number, optimal: number, inverted = false): 'up' | 'down' | null {
  if (!optimal) return null;

  const isGood = inverted ? current < optimal : current > optimal * 0.9;
  return isGood ? 'up' : 'down';
}

export default PerformanceDashboard;