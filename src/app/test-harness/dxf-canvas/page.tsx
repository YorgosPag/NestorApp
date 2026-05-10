import { notFound } from 'next/navigation';
import DxfCanvasHarness from './DxfCanvasHarness';

export default function DxfCanvasTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DxfCanvasHarness />;
}
