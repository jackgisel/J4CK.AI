function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export async function sendMagicLinkEmail(
  env: Env,
  email: string,
  url: string
) {
  console.info(`[magic-link] ${email}\n${url}`)

  await env.EMAIL.send({
    to: email,
    from: { name: "j4ck.ai", email: env.EMAIL_FROM },
    subject: "Sign in to j4ck.ai",
    text: `Sign in to j4ck.ai:\n${url}\n\nThis link expires in 10 minutes. If you did not ask for this, ignore the email.`,
    html: `<p>Click to sign in. This link expires in 10 minutes.</p><p><a href="${escapeHtml(url)}">Sign in to j4ck.ai</a></p><p>If you did not ask for this, you can ignore the email.</p>`,
  })
}
