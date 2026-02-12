/**
 * ADR-176: DXF Viewer Layout
 *
 * Sets viewport meta to prevent double-tap zoom on mobile
 * and adds iOS safe area padding via Tailwind arbitrary value.
 */

import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'DXF Viewer',
};

export default function DxfViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full pb-[env(safe-area-inset-bottom,0px)]">
      {children}
    </div>
  );
}
