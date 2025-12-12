'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DxfViewerErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DXF Viewer Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-6">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              DXF Viewer Error
            </h1>
            <p className="text-gray-600 mb-4">
              Κάτι πήγε στραβά στη φόρτωση του DXF Viewer.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || 'Άγνωστο σφάλμα'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className={`px-4 py-2 bg-blue-600 text-white rounded-lg ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON} transition-colors`}
            >
              Επαναφόρτωση
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DxfViewerErrorBoundary;