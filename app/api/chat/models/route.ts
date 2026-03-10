import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/ai/providers';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ models: getAvailableModels() });
}
