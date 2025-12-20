/* eslint-disable */
// @ts-nocheck
"use client";

import { useState, useCallback, useRef } from 'react';

interface UseHistoryStackOptions {
  max?: number;
  debounceMs?: number;
  onValueChange: (value: string) => void;
}

export function useHistoryStack(
  initialValue: string | undefined,
  options: UseHistoryStackOptions
) {
  const { max = 100, debounceMs = 250, onValueChange } = options;

  const [stack, setStack] = useState<string[]>([initialValue || ""]);
  const [index, setIndex] = useState(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentValue = stack[index];

  const push = useCallback((newValue: string) => {
    setStack(prevStack => {
      setIndex(prevIndex => {
        const newStack = [...prevStack.slice(0, prevIndex + 1), newValue];
        const trimmedStack = newStack.length > max ? newStack.slice(-max) : newStack;
        return Math.min(prevIndex + 1, trimmedStack.length - 1);
      });
      const newStack = [...prevStack.slice(0, index + 1), newValue];
      return newStack.length > max ? newStack.slice(-max) : newStack;
    });
  }, [index, max]);

  const setValue = useCallback((newValue: string) => {
    onValueChange(newValue);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      push(newValue);
    }, debounceMs);
  }, [onValueChange, push, debounceMs]);

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