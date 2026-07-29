import { notFound } from 'next/navigation';
import { isTestHarnessRouteEnabled } from '@/config/test-harness-access';
import DxfCanvasHarness from './DxfCanvasHarness';

export default function DxfCanvasTestPage() {
  if (!isTestHarnessRouteEnabled()) notFound();
  return <DxfCanvasHarness />;
}
