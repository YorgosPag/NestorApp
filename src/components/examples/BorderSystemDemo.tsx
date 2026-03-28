'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

// ============================================================================
// 🎨 BORDER SYSTEM DEMONSTRATION
// ============================================================================
//
// ✨ Live demo του Enterprise Border Design System
// Δείχνει όλες τις δυνατότητες και patterns
// Για testing και documentation purposes
//
// ============================================================================

import React, { useState } from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function BorderSystemDemo() {
  const {
    quick,
    getElementBorder,
    getStatusBorder,
    getSeparatorBorder,
    getResponsiveBorder,
    width,
    radius
  } = useBorderTokens();
  const colors = useSemanticColors();

  const [selectedDemo, setSelectedDemo] = useState<'basic' | 'variants' | 'status' | 'responsive'>('basic');

  return (
    <div className={`p-8 space-y-8 ${colors.bg.primary}`}>
      <div className={`${quick.card} p-6`}>
        <h1 className="text-3xl font-bold mb-4 text-foreground">
          🎨 Enterprise Border System Demo
        </h1>
        <p className={cn(colors.text.muted, "mb-6")}>
          Live demonstration του κεντρικοποιημένου border system που ακολουθεί
          τα πρότυπα των Microsoft, Google, Apple.
        </p>

        {/* Navigation */}
        <div className="flex gap-2 mb-6">
          {(['basic', 'variants', 'status', 'responsive'] as const).map((demo) => (
            <button
              key={demo}
              onClick={() => setSelectedDemo(demo)}
              className={selectedDemo === demo ? quick.selected : quick.button}
            >
              {demo.charAt(0).toUpperCase() + demo.slice(1)}
            </button>
          ))}
        </div>

        <hr className={getSeparatorBorder('horizontal')} />
      </div>

      {/* BASIC DEMO */}
      {selectedDemo === 'basic' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">🎯 Basic Quick Borders</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className={`${quick.card} p-4`}>
              <h3 className="font-medium mb-2">Card Border</h3>
              <p className={cn("text-sm", colors.text.muted)}>
                Subtle, non-intrusive border για cards
              </p>
              <code className="text-xs bg-muted p-1 rounded">quick.card</code>
            </div>

            <div className={`${quick.input} p-4`}>
              <h3 className="font-medium mb-2">Input Border</h3>
              <p className={cn("text-sm", colors.text.muted)}>
                Interactive border για form inputs
              </p>
              <code className="text-xs bg-muted p-1 rounded">quick.input</code>
            </div>

            <div className={`${quick.button} p-4`}>
              <h3 className="font-medium mb-2">Button Border</h3>
              <p className={cn("text-sm", colors.text.muted)}>
                Standard button border pattern
              </p>
              <code className="text-xs bg-muted p-1 rounded">quick.button</code>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Border Width Tokens</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(width).map(([name, value]) => (
                <div key={name} className="p-3 border rounded-md" style={{borderWidth: value}}>
                  <strong>{name}</strong>
                  <div className={cn("text-sm", colors.text.muted)}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Border Radius Tokens</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(radius).slice(0, 8).map(([name, value]) => (
                <div
                  key={name}
                  className="p-3 border border-border bg-muted"
                  style={{borderRadius: value}}
                >
                  <strong>{name}</strong>
                  <div className={cn("text-sm", colors.text.muted)}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VARIANTS DEMO */}
      {selectedDemo === 'variants' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">🏗️ Component Variants</h2>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Button Variants</h3>
            <div className="flex gap-4">
              <button className={getElementBorder('button', 'default')}>
                Default Button
              </button>
              <button className={`${getElementBorder('button', 'default')} bg-primary text-primary-foreground`}>
                Primary Button
              </button>
              <button className={getElementBorder('button', 'default')}>
                Ghost Button
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Input Variants</h3>
            <div className="space-y-3 max-w-sm">
              <input
                placeholder="Default input"
                className={`${getElementBorder('input', 'default')} px-3 py-2 w-full ${colors.bg.primary}`}
              />
              <input
                placeholder="Focus state (simulated)"
                className={`${getElementBorder('input', 'focus')} px-3 py-2 w-full ${colors.bg.primary}`}
              />
              <input
                placeholder="Error state"
                className={`${getElementBorder('input', 'error')} px-3 py-2 w-full ${colors.bg.primary}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Modal Border</h3>
            <div className={`${getElementBorder('modal')} p-6 max-w-md bg-card`}>
              <h4 className="font-semibold mb-2">Modal Example</h4>
              <p className={cn("text-sm", colors.text.muted)}>
                Modals typically use shadows instead of borders για clean floating effect.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STATUS DEMO */}
      {selectedDemo === 'status' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">🎨 Status Borders</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`${getStatusBorder('success')} p-4 bg-green-50 dark:bg-green-950/20`}>
              <h3 className="font-medium text-green-800 dark:text-green-300">✅ Success</h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                Operation completed successfully!
              </p>
            </div>

            <div className={`${getStatusBorder('error')} p-4 bg-red-50 dark:bg-red-950/20`}>
              <h3 className="font-medium text-red-800 dark:text-red-300">❌ Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400">
                Something went wrong!
              </p>
            </div>

            <div className={`${getStatusBorder('warning')} p-4 bg-amber-50 dark:bg-amber-950/20`}>
              <h3 className="font-medium text-amber-800 dark:text-amber-300">⚠️ Warning</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Please check your input.
              </p>
            </div>

            <div className={`${getStatusBorder('info')} p-4 bg-blue-50 dark:bg-blue-950/20`}>
              <h3 className="font-medium text-blue-800 dark:text-blue-300">ℹ️ Info</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                Here&apos;s some helpful information.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Interactive States</h3>
            <div className="space-y-3">
              <div className={`${quick.focus} p-3`}>
                <strong>Focus State</strong> - Highlighted border για accessibility
              </div>
              <div className={`${quick.selected} p-3`}>
                <strong>Selected State</strong> - Primary border για selection
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESPONSIVE DEMO */}
      {selectedDemo === 'responsive' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">📱 Responsive Borders</h2>

          <div className="space-y-4">
            <p className={colors.text.muted}>
              Resize your browser to see how borders adapt to different screen sizes.
            </p>

            <div className={`${getResponsiveBorder('card')} p-4`}>
              <h3 className="font-medium mb-2">Responsive Card</h3>
              <p className={cn("text-sm", colors.text.muted)}>
                Border radius και styling αλλάζουν ανάλογα με το μέγεθος οθόνης:
              </p>
              <ul className={cn("text-xs mt-2 space-y-1", colors.text.muted)}>
                <li>📱 Mobile: rounded-lg</li>
                <li>📟 Tablet: rounded-xl</li>
                <li>💻 Desktop: rounded-2xl</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button className={getResponsiveBorder('button')}>
                Responsive Button
              </button>
              <input
                placeholder="Responsive Input"
                className={`${getResponsiveBorder('input')} px-3 py-2 ${colors.bg.primary}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Separators Demo */}
      <hr className={getSeparatorBorder('horizontal')} />

      <div className={`${quick.card} p-4`}>
        <h3 className="font-medium mb-2">✨ Enterprise Achievement</h3>
        <p className={cn("text-sm", colors.text.muted)}>
          🎯 <strong>Single Source of Truth:</strong> Όλα τα borders ελέγχονται από ένα σημείο<br />
          🎨 <strong>Design Consistency:</strong> Semantic naming και predictable patterns<br />
          🏢 <strong>Enterprise Quality:</strong> Type-safe, responsive, accessible<br />
          🚀 <strong>Developer Experience:</strong> IntelliSense support και comprehensive API
        </p>
      </div>
    </div>
  );
}

export default BorderSystemDemo;