import type { Metadata } from 'next';
import { ShowcaseClient } from '@/components/property-showcase/ShowcaseClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Property Showcase',
};

export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ShowcaseClient token={token} />;
}
