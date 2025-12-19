"use client";

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseHistoryStackOptions {
  max?: number;
  debounceMs?: number;
  onValueChange: (value: string) => void;
}

export function useHistoryStack(
  initialValue: string,
  options: UseHistoryStackOptions
) {
  const { max = 100, debounceMs = 250, onValueChange } = options;
  
  const [stack, setStack] = useState<string[]>([initialValue]);
  const [index, setIndex] = useState(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentValue = stack[index];

  // Callback to push a new state to the history stack
  const push = useCallback((newValue: string) => {
    setStack(prevStack => {
      const newStack = prevStack.slice(0, index + 1);
      newStack.push(newValue);
      
      // Trim stack if it exceeds max size
      if (newStack.length > max) {
        return newStack.slice(newStack.length - max);
      }
      return newStack;
    });
    setIndex(prevIndex => prevIndex + 1);
  }, [index, max]);

  // Debounced setter for frequent changes
  const setValue = useCallback((newValue: string) => {
    // Update the main value immediately
    onValueChange(newValue);

    // Debounce the history update
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
        // We push based on the latest `currentValue` from the state
        // to avoid race conditions with fast typing and undo/redo
        setStack(prevStack => {
            const currentHistoryValue = prevStack[prevStack.length -1];
            if(newValue === currentHistoryValue) return prevStack;

            const newStack = prevStack.slice(0, index + 1);
            newStack.push(newValue);
            setIndex(newStack.length - 1);
            return newStack.length > max ? newStack.slice(1) : newStack;
        })
    }, debounceMs);

  }, [onValueChange, index, max, debounceMs]);
  
  // Effect to sync external changes to the history
  useEffect(() => {
    if (value !== currentValue) {
      push(value);
    }
  }, [value]);

  const undo = useCallback(() => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      onValueChange(stack[newIndex]);
    }
  }, [index, stack, onValueChange]);

  const redo = useCallback(() => {
    if (index < stack.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      onValueChange(stack[newIndex]);
    }
  }, [index, stack, onValueChange]);

  return {
    currentValue,
    setValue,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < stack.length - 1
  };
}
