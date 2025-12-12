/**
 * 🔘 TestButton Component
 *
 * Reusable test button με status indicators (running, completed, idle)
 */

import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';

interface TestButtonProps {
  test: {
    id: string;
    name: string;
    description: string;
    action: () => Promise<void>;
  };
  isRunning: boolean;
  isCompleted: boolean;
  onRun: (testId: string, action: () => Promise<void>) => void;
}

export const TestButton: React.FC<TestButtonProps> = ({
  test,
  isRunning,
  isCompleted,
  onRun
}) => {
  return (
    <button
      onClick={() => onRun(test.id, test.action)}
      disabled={isRunning}
      className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all text-left w-full ${
        isRunning
          ? 'bg-yellow-500/10 border-yellow-500/30 cursor-wait'
          : isCompleted
          ? `bg-green-500/10 border-green-500/30 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`
          : `bg-gray-700/50 border-gray-600/50 ${HOVER_BORDER_EFFECTS.GRAY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isRunning ? (
          <div className="animate-spin text-base">⏳</div>
        ) : isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <Play className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm leading-tight">{test.name}</div>
        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{test.description}</div>
      </div>
    </button>
  );
};
