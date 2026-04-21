'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface EditFocusTarget {
  id: string;
  label: string;
  submit: () => void | Promise<void>;
  cancel: () => void;
  loading?: boolean;
}

interface ContactEditFocusContextValue {
  focus: EditFocusTarget | null;
  setFocus: React.Dispatch<React.SetStateAction<EditFocusTarget | null>>;
}

const ContactEditFocusContext = createContext<ContactEditFocusContextValue | null>(null);

export function ContactEditFocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = useState<EditFocusTarget | null>(null);
  const value = useMemo<ContactEditFocusContextValue>(() => ({ focus, setFocus }), [focus]);
  return (
    <ContactEditFocusContext.Provider value={value}>
      {children}
    </ContactEditFocusContext.Provider>
  );
}

export function useContactEditFocus(): ContactEditFocusContextValue {
  const ctx = useContext(ContactEditFocusContext);
  if (!ctx) {
    const noop = () => {};
    return {
      focus: null,
      setFocus: noop as React.Dispatch<React.SetStateAction<EditFocusTarget | null>>,
    };
  }
  return ctx;
}

interface RegisterTarget {
  id: string;
  label: string;
  submit: () => void | Promise<void>;
  cancel: () => void;
  loading?: boolean;
}

export function useRegisterEditFocus(target: RegisterTarget | null): void {
  const { setFocus } = useContactEditFocus();
  const targetRef = useRef<RegisterTarget | null>(target);
  targetRef.current = target;

  const id = target?.id ?? null;
  const label = target?.label ?? '';
  const loading = target?.loading ?? false;

  const stableSubmit = useCallback(() => {
    const current = targetRef.current;
    return current ? current.submit() : undefined;
  }, []);

  const stableCancel = useCallback(() => {
    const current = targetRef.current;
    if (current) current.cancel();
  }, []);

  useEffect(() => {
    if (!id) return;
    setFocus({ id, label, loading, submit: stableSubmit, cancel: stableCancel });
    return () => {
      setFocus((prev) => (prev?.id === id ? null : prev));
    };
  }, [id, label, loading, setFocus, stableSubmit, stableCancel]);
}
