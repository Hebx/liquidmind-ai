import { NextResponse } from 'next/server';
import { getChainHead } from '@/lib/chain';

export async function GET() {
  try {
    const data = await getChainHead();
    return NextResponse.json(data, { status: data.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to fetch chain head' }, { status: 500 });
  }
}
