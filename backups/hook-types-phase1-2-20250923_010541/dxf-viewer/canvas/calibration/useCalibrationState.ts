import { useState, useRef, useCallback } from 'react';
import type { ClickTest, CalibrationState, CalibrationActions } from './types';

export interface CalibrationStateHook {
  state: CalibrationState;
  actions: CalibrationActions;
  clickIdRef: React.MutableRefObject<number>;
}

export function useCalibrationState(): CalibrationStateHook {
  const [clickTests, setClickTests] = useState<ClickTest[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [testEntityInjected, setTestEntityInjected] = useState(false);
  const clickIdRef = useRef(0);

  const addClickTest = useCallback((test: ClickTest) => {
    clickIdRef.current = test.id;
    setClickTests(prev => [...prev.slice(-9), test]);
  }, []);

  const clearTests = useCallback(() => {
    setClickTests([]);
    setTestEntityInjected(false);
  }, []);

  const toggleGrid = useCallback((show: boolean) => {
    setShowGrid(show);
  }, []);

  const toggleDetails = useCallback((show: boolean) => {
    setShowDetails(show);
  }, []);

  const markEntityInjected = useCallback((injected: boolean) => {
    setTestEntityInjected(injected);
  }, []);

  const state: CalibrationState = {
    clickTests,
    showGrid,
    showDetails,
    testEntityInjected,
  };

  const actions: CalibrationActions = {
    addClickTest,
    clearTests,
    setShowGrid: toggleGrid,
    setShowDetails: toggleDetails,
    setTestEntityInjected: markEntityInjected,
  };

  return {
    state,
    actions,
    clickIdRef,
  };
}