/**
 * 📊 StandaloneTestsTab Component
 *
 * Tab για standalone test scripts (coordinate reversibility, grid workflow)
 */

import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import type { TestState, StandaloneTestHandlers } from '../types/tests.types';

interface StandaloneTestsTabProps {
  testState: TestState;
  standaloneTests: StandaloneTestHandlers;
}

export const StandaloneTestsTab: React.FC<StandaloneTestsTabProps> = ({
  testState,
  standaloneTests
}) => {
  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          📊 Standalone Test Scripts
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Coordinate Reversibility */}
          <button
            onClick={standaloneTests.handleRunCoordinateReversibility}
            disabled={testState.runningTests.has('coordinate-reversibility')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all text-left ${
              testState.runningTests.has('coordinate-reversibility')
                ? 'bg-yellow-500/10 border-yellow-500/30 cursor-wait'
                : testState.completedTests.has('coordinate-reversibility')
                ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700 hover:border-gray-500'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {testState.runningTests.has('coordinate-reversibility') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('coordinate-reversibility') ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Play className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white text-sm leading-tight">🔄 Coordinate Reversibility</div>
              <div className="text-xs text-gray-400 mt-1">Tests screenToWorld(worldToScreen(p)) == p</div>
            </div>
          </button>

          {/* Grid Workflow */}
          <button
            onClick={standaloneTests.handleRunGridWorkflow}
            disabled={testState.runningTests.has('grid-workflow')}
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all text-left ${
              testState.runningTests.has('grid-workflow')
                ? 'bg-yellow-500/10 border-yellow-500/30 cursor-wait'
                : testState.completedTests.has('grid-workflow')
                ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700 hover:border-gray-500'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {testState.runningTests.has('grid-workflow') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('grid-workflow') ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <Play className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white text-sm leading-tight">📐 Grid Workflow Test</div>
              <div className="text-xs text-gray-400 mt-1">CAD QA standards (5 categories)</div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="text-xs text-yellow-300">
          <strong>⚠️ Work in Progress:</strong> Some standalone tests need refactoring to export runnable functions. Check console for status.
        </div>
      </div>
    </>
  );
};
