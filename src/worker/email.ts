import type { Env } from './env.ts';

/** The sign-in email: a link that works once, for 15 minutes. */
export async function sendLoginEmail(env: Env, to: string, link: string): Promise<void> {
  const text = [
    'Open this link to sign in to Read Hebrew:',
    '',
    link,
    '',
    'It works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.',
  ].join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#17150f">
<p style="font-size:18px;margin:0 0 16px">Sign in to Read Hebrew</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#17150f;color:#faf8f3;text-decoration:none;padding:12px 22px;border-radius:22px;font-weight:600">Open Read Hebrew</a></p>
<p style="color:#5e594e;font-size:14px;line-height:1.5;margin:0">This link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.</p>
</div>`;
  await env.EMAIL.send({
    to,
    from: { email: env.EMAIL_FROM, name: 'Read Hebrew' },
    subject: 'Your Read Hebrew sign-in link',
    text,
    html,
  });
}
