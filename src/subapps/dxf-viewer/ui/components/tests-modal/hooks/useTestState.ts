/**
 * 🎯 useTestState Hook
 * Manages test execution state (running, completed, active tab)
 */

import { useState } from 'react';
import type { TestState, TabType } from '../types/tests.types';

export function useTestState(): TestState {
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>('automated');

  const startTest = (id: string) => {
    setRunningTests(prev => new Set(prev).add(id));
  };

  const completeTest = (id: string) => {
    setRunningTests(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    setCompletedTests(prev => new Set(prev).add(id));
  };

  const failTest = (id: string) => {
    setRunningTests(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  return {
    runningTests,
    completedTests,
    activeTab,
    setActiveTab,
    startTest,
    completeTest,
    failTest
  };
}
