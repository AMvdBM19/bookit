import { NextRequest, NextResponse } from 'next/server';
import { loadCatalog } from '../../catalog-loader';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const catalog = await loadCatalog(slug);
  if (!catalog) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(catalog);
}
