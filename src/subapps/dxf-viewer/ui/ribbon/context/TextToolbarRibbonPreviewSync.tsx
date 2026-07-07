'use client';

/**
 * ADR-557 — live-preview reactivity bridge: text-toolbar store → RibbonFieldStore.
 *
 * The ribbon Text-Editor bridge reads the toolbar store via a GETTER (ADR-040
 * anti-cascade: subscribing there would re-render DxfViewerContent on every field
 * change). So when the grip-drag publisher (`useTextGripRibbonSync` → `setPreview`)
 * writes live `fontHeight` / `widthFactor` / `rotation` during a resize/rotate drag,
 * nothing pulses the per-key `RibbonFieldStore` subscribers → the combobox leaves would
 * only refresh on the next React commit (the mouse-up), never during the drag.
 *
 * This null micro-leaf subscribes to EXACTLY those 3 live fields and, from a BATCHED
 * post-commit effect, calls `notifyRibbonFieldReaders()` so the moved field(s) re-render
 * frame-for-frame (the store's signature cache gates the notify to the field that
 * actually moved). Two deliberate design points:
 *   1. A dedicated leaf — so ONLY this null component re-renders at drag frequency, never
 *      the selection host or the orchestrator (ADR-040 micro-leaf doctrine).
 *   2. The notify runs in a React effect (store-subscription driven), NOT synchronously
 *      from the canvas-side grip effect. A direct cross-tree poke re-enters
 *      `RibbonEditableCombobox`'s draft-sync effect outside React's batch and overflows
 *      the update depth ("Maximum update depth exceeded") — the effect path stays batched.
 */

import React, { useEffect } from 'react';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { notifyRibbonFieldReaders } from './RibbonFieldStore';

export const TextToolbarRibbonPreviewSyncMount = React.memo(
  function TextToolbarRibbonPreviewSyncMount() {
    const fontHeight = useTextToolbarStore((s) => s.fontHeight);
    const widthFactor = useTextToolbarStore((s) => s.widthFactor);
    const rotation = useTextToolbarStore((s) => s.rotation);
    useEffect(() => {
      notifyRibbonFieldReaders();
    }, [fontHeight, widthFactor, rotation]);
    return null;
  },
);
