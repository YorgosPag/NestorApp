'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Product Tour System - Context Provider
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Global Tour State Management
 *
 * Features:
 * - Global state for tour management
 * - Persistence via localStorage
 * - Analytics integration hooks
 * - Keyboard navigation support
 *
 * @see ProductTour.types.ts for type definitions
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

import type {
  TourState,
  TourActions,
  TourContextValue,
  TourConfig,
  TourAnalyticsEvent,
  TourAnalyticsData,
} from './ProductTour.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_PREFIX = 'pagonis_tour_dismissed_';

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: TourState = {
  isActive: false,
  currentStepIndex: 0,
  currentTour: null,
  dontShowAgain: false,
  isLoading: false,
};

// =============================================================================
// ACTION TYPES
// =============================================================================

type TourAction =
  | { type: 'START_TOUR'; payload: TourConfig }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; payload: number }
  | { type: 'END_TOUR' }
  | { type: 'SET_DONT_SHOW_AGAIN'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean };

// =============================================================================
// REDUCER
// =============================================================================

function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START_TOUR':
      return {
        ...state,
        isActive: true,
        currentStepIndex: 0,
        currentTour: action.payload,
        dontShowAgain: false,
        isLoading: false,
      };

    case 'NEXT_STEP': {
      if (!state.currentTour) return state;
      const nextIndex = state.currentStepIndex + 1;
      if (nextIndex >= state.currentTour.steps.length) {
        return state; // Don't advance past last step
      }
      return {
        ...state,
        currentStepIndex: nextIndex,
      };
    }

    case 'PREV_STEP': {
      if (!state.currentTour) return state;
      const prevIndex = state.currentStepIndex - 1;
      if (prevIndex < 0) {
        return state; // Don't go before first step
      }
      return {
        ...state,
        currentStepIndex: prevIndex,
      };
    }

    case 'GO_TO_STEP': {
      if (!state.currentTour) return state;
      const index = action.payload;
      if (index < 0 || index >= state.currentTour.steps.length) {
        return state; // Invalid index
      }
      return {
        ...state,
        currentStepIndex: index,
      };
    }

    case 'END_TOUR':
      return {
        ...state,
        isActive: false,
        currentStepIndex: 0,
        currentTour: null,
        dontShowAgain: false,
      };

    case 'SET_DONT_SHOW_AGAIN':
      return {
        ...state,
        dontShowAgain: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

// =============================================================================
// CONTEXT
// =============================================================================

const TourContext = createContext<TourContextValue | null>(null);

TourContext.displayName = 'TourContext';

// =============================================================================
// PROVIDER
// =============================================================================

interface TourProviderProps {
  children: ReactNode;
}

/**
 * 🏢 ENTERPRISE: Tour Context Provider
 *
 * Wraps application to provide global tour state management.
 * Should be placed high in the component tree (e.g., in _app.tsx or layout.tsx).
 *
 * @example
 * ```tsx
 * <TourProvider>
 *   <App />
 * </TourProvider>
 * ```
 */
export function TourProvider({ children }: TourProviderProps) {
  const [state, dispatch] = useReducer(tourReducer, initialState);

  // ==========================================================================
  // ANALYTICS HELPER
  // ==========================================================================

  const trackAnalytics = useCallback(
    (event: TourAnalyticsEvent, additionalData?: Partial<TourAnalyticsData>) => {
      if (!state.currentTour?.onAnalyticsEvent) return;

      const data: TourAnalyticsData = {
        tourId: state.currentTour.tourId,
        stepId: state.currentTour.steps[state.currentStepIndex]?.id,
        stepIndex: state.currentStepIndex,
        totalSteps: state.currentTour.steps.length,
        timestamp: Date.now(),
        ...additionalData,
      };

      state.currentTour.onAnalyticsEvent(event, data);
    },
    [state.currentTour, state.currentStepIndex]
  );

  // ==========================================================================
  // PERSISTENCE HELPERS
  // ==========================================================================

  const getStorageKey = useCallback((persistenceKey: string) => {
    return `${STORAGE_PREFIX}${persistenceKey}`;
  }, []);

  const saveDismissalToStorage = useCallback(
    (persistenceKey: string) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(getStorageKey(persistenceKey), 'true');
      } catch {
        // localStorage not available (SSR, privacy mode, etc.)
      }
    },
    [getStorageKey]
  );

  const checkDismissalFromStorage = useCallback(
    (persistenceKey: string): boolean => {
      if (typeof window === 'undefined') return false;
      try {
        return localStorage.getItem(getStorageKey(persistenceKey)) === 'true';
      } catch {
        return false;
      }
    },
    [getStorageKey]
  );

  const clearDismissalFromStorage = useCallback(
    (persistenceKey: string) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.removeItem(getStorageKey(persistenceKey));
      } catch {
        // localStorage not available
      }
    },
    [getStorageKey]
  );

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const startTour = useCallback((config: TourConfig) => {
    // 🏢 DEBUG: Log tour start
    if (process.env.NODE_ENV === 'development') {
      console.log('[ProductTour] Starting tour:', config.tourId, {
        steps: config.steps.length,
        persistenceKey: config.persistenceKey,
      });
    }

    // Check persistence before starting
    if (config.persistenceKey) {
      const isDismissed = checkDismissalFromStorage(config.persistenceKey);
      if (isDismissed) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[ProductTour] Tour dismissed by user, not starting:', config.tourId);
        }
        return; // User has dismissed this tour before
      }
    }

    dispatch({ type: 'START_TOUR', payload: config });

    // Track analytics
    if (config.onAnalyticsEvent) {
      config.onAnalyticsEvent('tour_started', {
        tourId: config.tourId,
        totalSteps: config.steps.length,
        timestamp: Date.now(),
      });
    }

    // Call first step's onStepEnter
    const firstStep = config.steps[0];
    if (firstStep?.onStepEnter) {
      firstStep.onStepEnter();
    }
  }, [checkDismissalFromStorage]);

  const nextStep = useCallback(() => {
    if (!state.currentTour) return;

    const currentStep = state.currentTour.steps[state.currentStepIndex];
    const nextIndex = state.currentStepIndex + 1;

    // Call current step's onStepExit
    if (currentStep?.onStepExit) {
      currentStep.onStepExit();
    }

    // Track step completion
    trackAnalytics('step_completed');

    if (nextIndex >= state.currentTour.steps.length) {
      // This was the last step - complete the tour
      endTour('complete');
      return;
    }

    dispatch({ type: 'NEXT_STEP' });

    // Call next step's onStepEnter
    const next = state.currentTour.steps[nextIndex];
    if (next?.onStepEnter) {
      next.onStepEnter();
    }

    // Track step viewed
    trackAnalytics('step_viewed', { stepIndex: nextIndex });
  }, [state.currentTour, state.currentStepIndex, trackAnalytics]);

  const prevStep = useCallback(() => {
    if (!state.currentTour) return;

    const currentStep = state.currentTour.steps[state.currentStepIndex];
    const prevIndex = state.currentStepIndex - 1;

    if (prevIndex < 0) return;

    // Call current step's onStepExit
    if (currentStep?.onStepExit) {
      currentStep.onStepExit();
    }

    dispatch({ type: 'PREV_STEP' });

    // Call previous step's onStepEnter
    const prev = state.currentTour.steps[prevIndex];
    if (prev?.onStepEnter) {
      prev.onStepEnter();
    }
  }, [state.currentTour, state.currentStepIndex]);

  const goToStep = useCallback(
    (index: number) => {
      if (!state.currentTour) return;
      if (index < 0 || index >= state.currentTour.steps.length) return;

      const currentStep = state.currentTour.steps[state.currentStepIndex];
      if (currentStep?.onStepExit) {
        currentStep.onStepExit();
      }

      dispatch({ type: 'GO_TO_STEP', payload: index });

      const targetStep = state.currentTour.steps[index];
      if (targetStep?.onStepEnter) {
        targetStep.onStepEnter();
      }
    },
    [state.currentTour, state.currentStepIndex]
  );

  const endTour = useCallback(
    (reason: 'complete' | 'skip' | 'dismiss') => {
      if (!state.currentTour) return;

      // Track analytics
      const eventMap: Record<string, TourAnalyticsEvent> = {
        complete: 'tour_completed',
        skip: 'tour_skipped',
        dismiss: 'tour_dismissed',
      };
      trackAnalytics(eventMap[reason]);

      // Save dismissal if "don't show again" is checked
      if (state.dontShowAgain && state.currentTour.persistenceKey) {
        saveDismissalToStorage(state.currentTour.persistenceKey);
        trackAnalytics('dont_show_again_checked');
      }

      // Call appropriate callback
      const tour = state.currentTour;
      switch (reason) {
        case 'complete':
          tour.onComplete?.();
          break;
        case 'skip':
          tour.onSkip?.();
          break;
        case 'dismiss':
          tour.onDismiss?.();
          break;
      }

      dispatch({ type: 'END_TOUR' });
    },
    [state.currentTour, state.dontShowAgain, trackAnalytics, saveDismissalToStorage]
  );

  const setDontShowAgain = useCallback((value: boolean) => {
    dispatch({ type: 'SET_DONT_SHOW_AGAIN', payload: value });
  }, []);

  const shouldShowTour = useCallback(
    (tourId: string, persistenceKey?: string): boolean => {
      if (!persistenceKey) return true;
      return !checkDismissalFromStorage(persistenceKey);
    },
    [checkDismissalFromStorage]
  );

  const resetTourPersistence = useCallback(
    (persistenceKey: string) => {
      clearDismissalFromStorage(persistenceKey);
    },
    [clearDismissalFromStorage]
  );

  // ==========================================================================
  // KEYBOARD NAVIGATION
  // ==========================================================================

  useEffect(() => {
    if (!state.isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          endTour('dismiss');
          break;
        case 'ArrowRight':
        case 'Enter':
          nextStep();
          break;
        case 'ArrowLeft':
          prevStep();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isActive, endTour, nextStep, prevStep]);

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue = useMemo<TourContextValue>(
    () => ({
      // State
      ...state,

      // Actions
      startTour,
      nextStep,
      prevStep,
      goToStep,
      endTour,
      setDontShowAgain,
      shouldShowTour,
      resetTourPersistence,
    }),
    [
      state,
      startTour,
      nextStep,
      prevStep,
      goToStep,
      endTour,
      setDontShowAgain,
      shouldShowTour,
      resetTourPersistence,
    ]
  );

  return (
    <TourContext.Provider value={contextValue}>
      {children}
    </TourContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * 🏢 ENTERPRISE: Hook to access tour context
 *
 * @throws Error if used outside TourProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { startTour, isActive, currentStepIndex } = useTourContext();
 *   // ...
 * }
 * ```
 */
export function useTourContext(): TourContextValue {
  const context = useContext(TourContext);

  if (!context) {
    throw new Error(
      '🏢 ENTERPRISE: useTourContext must be used within a TourProvider. ' +
        'Wrap your app with <TourProvider> in layout.tsx or _app.tsx'
    );
  }

  return context;
}
