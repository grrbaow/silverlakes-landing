import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendOtpEmail } from '@/lib/resend';
import { candidateDomains, isDisposableEmail } from '@/lib/disposable-email';
import { fetchDomainOverrides } from '@/lib/domain-rules';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Block temporary / disposable mailboxes so access can't be gained anonymously.
  // Static list + admin-managed overrides (sl_disposable_overrides); allow wins.
  const overrides = await fetchDomainOverrides(candidateDomains(normalizedEmail));
  if (isDisposableEmail(normalizedEmail, overrides)) {
    return NextResponse.json(
      { error: 'Please use a permanent work or personal email address. Temporary or disposable email addresses are not accepted for data room access.' },
      { status: 400 }
    );
  }

  // Rate limit: max 3 OTPs per email per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('sl_email_verifications')
    .select('*', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Too many requests. Try again in an hour.' }, { status: 429 });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabaseAdmin.from('sl_email_verifications').insert({
    email: normalizedEmail,
    token: hashedOtp,
    expires_at: expiresAt,
  });

  await sendOtpEmail(normalizedEmail, otp);

  return NextResponse.json({ success: true });
}
