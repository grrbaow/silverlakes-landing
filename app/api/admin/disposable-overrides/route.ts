import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('sl_disposable_overrides')
    .select('*')
    .order('added_at', { ascending: false });

  return NextResponse.json({ overrides: data || [] });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domain, action, notes } = await req.json();
  if (!domain) return NextResponse.json({ error: 'Domain required' }, { status: 400 });
  if (action !== 'block' && action !== 'allow') {
    return NextResponse.json({ error: 'Action must be block or allow' }, { status: 400 });
  }

  // Normalize: strip a leading @ and any local part, lowercase (store the domain only).
  const value = domain.toLowerCase().trim().replace(/^@/, '').split('@').pop() ?? '';
  if (!value.includes('.')) return NextResponse.json({ error: 'Enter a valid domain, e.g. tempmail.com' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('sl_disposable_overrides')
    .upsert({ domain: value, action, notes }, { onConflict: 'domain' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await supabaseAdmin.from('sl_disposable_overrides').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
