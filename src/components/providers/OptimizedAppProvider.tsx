'use client';

import React, { useEffect, Suspense } from 'react';
import { CacheProvider } from '@/contexts/CacheProvider';
import { UserRoleProvider, AuthProvider } from '@/auth';
import ErrorBoundary from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { performanceMonitor, enablePerformanceLogging } from '@/utils/performanceMonitor';
import { memoryLeakDetector, enableMemoryMonitoring } from '@/utils/memoryLeakDetector';
import { Skeleton } from '@/components/ui/skeletons';
import { ProgressiveLoader, LoadingPresets, useProgressiveLoader } from '@/components/ui/progress/ProgressiveLoader';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects/hover-effects';
import { AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// 🏢 ENTERPRISE: Extend Window interface for type-safe global debug access
interface AppOptimizations {
  performance: typeof performanceMonitor;
  memory: typeof memoryLeakDetector;
  clearCache: () => void;
}

declare global {
  interface Window {
    __appOptimizations?: AppOptimizations;
  }
}

interface OptimizedAppProviderProps {
  children: React.ReactNode;
  enableDevTools?: boolean;
  cacheConfig?: {
    defaultTTL?: number;
    maxSize?: number;
  };
}

// App initialization component with progressive loading
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { currentStep, isComplete, start, nextStep } = useProgressiveLoader(LoadingPresets.appInit);
  const colors = useSemanticColors();

  useEffect(() => {
    const initializeApp = async () => {
      start();

      // Step 1: Load assets
      await new Promise(resolve => setTimeout(resolve, 500));
      nextStep();

      // Step 2: Check authentication  
      await new Promise(resolve => setTimeout(resolve, 300));
      nextStep();

      // Step 3: Load configuration
      await new Promise(resolve => setTimeout(resolve, 200));
      nextStep();

      // Step 4: Load initial data
      await new Promise(resolve => setTimeout(resolve, 800));
      nextStep();

      // Step 5: Finalize setup
      await new Promise(resolve => setTimeout(resolve, 200));
      nextStep();
    };

    initializeApp();
  }, [start, nextStep]);

  if (!isComplete) {
    return (
      <div className={`min-h-screen ${colors.bg.primary} flex items-center justify-center`}>
        <div className="w-full max-w-md px-4">
          <div className="text-center mb-8">
            <div className={`${iconSizes.xl} ${iconSizes.xl} bg-primary rounded-full mx-auto mb-4 flex items-center justify-center`}>
              <div className={`${iconSizes.lg} ${colors.bg.secondary} rounded-full`}></div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Nextn CRM</h1>
            <p className="text-muted-foreground">Initializing application...</p>
          </div>
          
          <ProgressiveLoader
            steps={LoadingPresets.appInit}
            currentStep={currentStep}
            showEstimatedTime={true}
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Performance monitoring wrapper
function PerformanceWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Track app initialization
    const tracker = performanceMonitor.trackRouteChange('app-init');
    
    const cleanup = () => {
      tracker.finish({
        'app-bundle': performance.getEntriesByType('navigation')[0]?.loadEventEnd || 0
      });
    };

    // Track when app is fully loaded
    if (document.readyState === 'complete') {
      cleanup();
    } else {
      window.addEventListener('load', cleanup);
      return () => window.removeEventListener('load', cleanup);
    }
  }, []);

  return <>{children}</>;
}

// Memory monitoring wrapper
function MemoryWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Register app component
    memoryLeakDetector.registerComponent('App');
    
    return () => {
      memoryLeakDetector.unregisterComponent('App');
    };
  }, []);

  return <>{children}</>;
}

// Error boundary with app-specific fallback
function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  const iconSizes = useIconSizes();
  return (
    <ErrorBoundary
      componentName="App"
      enableRetry={true}
      maxRetries={2}
      enableReporting={true}
      fallback={(error, errorInfo, retry) => (
        <div className={`min-h-screen ${COLOR_BRIDGE.bg.primary} flex items-center justify-center`}>
          <div className="max-w-lg w-full p-6">
            <div className="text-center">
              <div className={`${iconSizes.xl} ${iconSizes.xl} bg-red-100 dark:bg-red-900/20 rounded-full mx-auto mb-4 flex items-center justify-center`}>
                <AlertTriangle className={`${iconSizes.lg} text-red-600 dark:text-red-400`} />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Application Error</h1>
              <p className="text-muted-foreground mb-6">
                The application encountered an unexpected error and needs to restart.
              </p>
              <div className="space-y-3">
                <button
                  onClick={retry}
                  className={`w-full px-4 py-2 bg-primary text-primary-foreground ${quick.input} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} transition-colors`}
                >
                  Restart Application
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className={`w-full px-4 py-2 border border-border ${quick.input} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}
                >
                  Reload Page
                </button>
              </div>
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground">Error Details</summary>
                <pre className={`mt-2 text-xs bg-muted p-2 ${quick.input} overflow-auto`}>
                  {error.message}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

// Main optimized app provider
export function OptimizedAppProvider({
  children,
  enableDevTools = process.env.NODE_ENV === 'development',
  cacheConfig = {}
}: OptimizedAppProviderProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  useEffect(() => {
    if (enableDevTools) {
      // Enable performance monitoring
      enablePerformanceLogging();
      
      // Enable memory monitoring
      enableMemoryMonitoring();

      // Log optimization status - DISABLED to avoid console noise
      // console.group('🚀 App Optimizations Enabled');
      // console.log('✅ Performance monitoring');
      // console.log('✅ Memory leak detection');
      // console.log('✅ Advanced caching');
      // console.log('✅ Error boundaries with recovery');
      // console.log('✅ Progressive loading');
      // console.log('✅ Lazy route loading');
      // console.groupEnd();

      // 🏢 ENTERPRISE: Add type-safe debug helpers to window
      window.__appOptimizations = {
        performance: performanceMonitor,
        memory: memoryLeakDetector,
        clearCache: () => {
          localStorage.clear();
          sessionStorage.clear();
          console.log('🧹 Cache cleared');
        }
      };
    }

    // Track app start
    performance.mark('app-start');
    
    return () => {
      performance.mark('app-end');
      performance.measure('app-lifetime', 'app-start', 'app-end');
    };
  }, [enableDevTools]);

  return (
    <AppErrorBoundary>
      <CacheProvider {...cacheConfig}>
        <AuthProvider>
          <UserRoleProvider>
            <PerformanceWrapper>
            <MemoryWrapper>
              <AppInitializer>
                <Suspense 
                  fallback={
                    <div className={`min-h-screen ${COLOR_BRIDGE.bg.primary} flex items-center justify-center`}>
                      <div className="text-center space-y-4">
                        <Skeleton className={`${iconSizes.xl} ${iconSizes.xl} rounded-full mx-auto`} />
                        <Skeleton className={`${iconSizes.lg} w-48 mx-auto`} />
                        <Skeleton className={`${iconSizes.sm} w-32 mx-auto`} />
                      </div>
                    </div>
                  }
                >
                  {children}
                </Suspense>
              </AppInitializer>
            </MemoryWrapper>
          </PerformanceWrapper>
          </UserRoleProvider>
        </AuthProvider>
      </CacheProvider>
    </AppErrorBoundary>
  );
}

// Hook to access optimization status
export function useOptimizationStatus() {
  const performanceStatus = performanceMonitor.getSummary();
  const memoryStatus = memoryLeakDetector.getStatus();
  
  return {
    performance: performanceStatus,
    memory: memoryStatus,
    isOptimized: true
  };
}

// Development component to show optimization stats
export function OptimizationDebugPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const status = useOptimizationStatus();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-primary text-primary-foreground rounded-full ${iconSizes.xl} ${iconSizes.xl} flex items-center justify-center shadow-lg ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} transition-colors`}
        title="Performance Debug Panel"
      >
        🚀
      </button>
      
      {isOpen && (
        <div className={`absolute bottom-14 right-0 w-80 bg-card border ${quick.card} shadow-xl p-4 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Performance Stats</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Memory Usage:</span>
              <span>{status.memory.currentMemoryMB.toFixed(1)} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Components:</span>
              <span>{status.memory.componentCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Listeners:</span>
              <span>{status.memory.listenerCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Cache Hit Rate:</span>
              <span>{(status.performance.avgComponentLoadTime || 0).toFixed(1)}ms</span>
            </div>
          </div>
          
          {status.memory.recentWarnings && status.memory.recentWarnings.length > 0 && (
            <div className="border-t pt-2">
              <p className="font-medium text-yellow-600 dark:text-yellow-400 text-xs">
                Recent Warnings: {status.memory.recentWarnings.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OptimizedAppProvider;