import { NextResponse } from 'next/server';
import { getOverview } from '@/lib/chain';

export async function GET() {
  try {
    const data = await getOverview();
    return NextResponse.json(data, { status: data.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to fetch overview' }, { status: 500 });
  }
}
