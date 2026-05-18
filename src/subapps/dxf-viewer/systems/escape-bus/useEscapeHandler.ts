'use client';

/**
 * ADR-364 — `useEscapeHandler` React hook
 *
 * Thin wrapper around `escapeBus.register()`. The handler ref pattern lets
 * callers supply inline closures without re-registering the bus on every
 * render — only the closure refs update.
 *
 * Pass `null` to skip registration (e.g. when a tool is inactive and you'd
 * rather not run `canHandle()` at all). The bus still skips inactive handlers
 * via `canHandle()`, but a `null` skip avoids walking the Map at all and
 * keeps the handler-count introspection accurate.
 */

import { useEffect, useRef } from 'react';
import { escapeBus } from './EscapeCommandBus';
import type { EscapeHandler } from './types';

export interface UseEscapeHandlerOptions {
  readonly id: string;
  readonly priority: number;
  readonly canHandle: () => boolean;
  readonly handle: () => boolean;
  readonly allowWhenEditable?: boolean;
}

export function useEscapeHandler(options: UseEscapeHandlerOptions | null): void {
  const ref = useRef<UseEscapeHandlerOptions | null>(options);
  ref.current = options;

  const id = options?.id ?? null;
  const priority = options?.priority ?? null;
  const allowWhenEditable = options?.allowWhenEditable === true;

  useEffect(() => {
    if (id === null || priority === null) return;
    const handler: EscapeHandler = {
      id,
      priority,
      allowWhenEditable,
      canHandle: () => ref.current?.canHandle() ?? false,
      handle: () => ref.current?.handle() ?? false,
    };
    const unregister = escapeBus.register(handler);
    return unregister;
  }, [id, priority, allowWhenEditable]);
}
