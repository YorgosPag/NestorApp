export default function LightLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen w-full bg-background">
      <main className="w-full max-w-full">
        {children}
      </main>
    </div>
  );
}