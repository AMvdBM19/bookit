import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Public — active templates for the wizard picker. RLS (read_active_templates)
// restricts the anon client to is_active = true rows.
export async function GET() {
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from('industry_templates')
    .select('slug, label, icon, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[templates:active] error:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }

  return NextResponse.json({ templates: templates ?? [] });
}
