"use client"

import * as React from "react"
import type { Toast, ToastOptions } from "@/types/toast"
import { generateToastId } from "@/lib/toast-utils"
import { listeners, memoryState, dispatch } from './toast-store';

interface ToastContextType {
    toasts: Toast[]
    addToast: (options: ToastOptions) => { id: string, dismiss: () => void, update: (props: Partial<Toast>) => void }
    removeToast: (id: string) => void
    removeAllToasts: () => void
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);
  
  const addToast = React.useCallback((options: ToastOptions) => {
    const id = generateToastId();
    const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });
    const update = (props: Partial<Toast>) => dispatch({ type: 'UPDATE_TOAST', toast: { ...props, id } });

    const newToast: Toast = {
      ...options,
      id,
      createdAt: new Date(),
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    };
    
    dispatch({ type: 'ADD_TOAST', toast: newToast });

    return { id, dismiss, update };
  }, []);

  const removeToast = React.useCallback((id: string) => {
    dispatch({ type: 'DISMISS_TOAST', toastId: id });
  }, []);

  const removeAllToasts = React.useCallback(() => {
    dispatch({ type: 'REMOVE_ALL_TOASTS' });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, addToast, removeToast, removeAllToasts }}>
      {children}
    </ToastContext.Provider>
  );
}
