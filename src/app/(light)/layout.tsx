import { COLOR_BRIDGE } from '@/design-system/color-bridge';

export default function LightLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`min-h-screen w-full ${COLOR_BRIDGE.bg.primary}`}>
      <main className="w-full max-w-full">
        {children}
      </main>
    </div>
  );
}