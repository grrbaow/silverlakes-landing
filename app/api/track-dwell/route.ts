// Build 6.2 — dwell-time beacon receiver.
// Records HOW LONG the viewer kept a document open. Identity comes ONLY from the
// verified session cookie (never the body), so a viewer can only log time against their
// own session. Trivial/implausible durations are ignored. Written with the service role.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ ok: false }, { status: 401 });

  // sendBeacon delivers a Blob; read the body ONCE as text, then parse (req.json()
  // consumes the stream, so a text() fallback after it can't work).
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(await req.text()); } catch { /* empty or non-JSON body */ }

  const file_path = String(body.file_path || '').slice(0, 500);
  const duration_ms = Math.max(0, Math.min(24 * 3600 * 1000, parseInt(String(body.duration_ms)) || 0));
  if (!file_path || duration_ms < 1000) return NextResponse.json({ ok: true }); // ignore noise

  const pages = body.pages ? Math.max(0, Math.min(100000, parseInt(String(body.pages)) || 0)) : null;
  try {
    await supabaseAdmin.from('sl_doc_views').insert({
      email: session.email,                       // <-- isolation: session, not body
      file_path,
      duration_ms,
      pages,
      closed_reason: String(body.reason || 'close').slice(0, 20),
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });
  } catch (e) {
    console.error('track-dwell insert failed:', e);   // a beacon must never surface an error
  }

  return NextResponse.json({ ok: true });
}
