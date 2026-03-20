/**
 * TEMPORARY — minimal test endpoint. DELETE after testing.
 */

import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({ ok: true, time: Date.now() });
}
