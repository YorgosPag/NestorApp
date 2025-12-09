import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) return new Response('Missing image url', { status: 400 });

  try {
    const imageResponse = await fetch(url);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new ImageResponse(
      (
        <div tw="relative w-full h-full">
          <img src={url} alt="" tw="w-full h-full object-cover" />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e) {
    return new Response('Image failed', { status: 500 });
  }
}