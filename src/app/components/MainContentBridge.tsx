'use client';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface MainContentBridgeProps {
  children: React.ReactNode;
}

/**
 * 🌉 BRIDGE-BASED Main Content Wrapper
 *
 * Converts bg-background hardcoded usage to Bridge API
 * Part of Phase 1 App Shell Migration
 */
export function MainContentBridge({ children }: MainContentBridgeProps) {
  const colors = useSemanticColors();

  return (
    <main className={`flex-1 overflow-y-auto overflow-x-hidden ${colors.bg.primary}/95 w-full max-w-full`}>
      {children}
    </main>
  );
}