'use client';

/**
 * ADR-345 Fase 5.5 — Host wrapper for SymbolPickerDialog from the ribbon
 * text editor contextual tab (Insert › Symbol button).
 *
 * Renders null when no level is active (services = null) to avoid mounting
 * the dialog tree without required services.
 */

import React from 'react';
import { SymbolPickerDialog } from './SymbolPickerDialog';
import { useDxfTextServices } from './hooks/useDxfTextServices';

interface DxfSymbolPickerHostProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DxfSymbolPickerHost({ open, onOpenChange }: DxfSymbolPickerHostProps) {
  const services = useDxfTextServices();
  if (!services) return null;

  return <SymbolPickerDialog open={open} onOpenChange={onOpenChange} />;
}
