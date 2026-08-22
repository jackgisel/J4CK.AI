function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function emailErrorMessage(error: unknown) {
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : ""
    const message = "message" in error ? String(error.message) : ""
    if (
      code === "E_SENDER_NOT_VERIFIED" ||
      code === "E_SENDER_DOMAIN_NOT_AVAILABLE" ||
      message.includes("domain config of sending domain")
    ) {
      return "Cloudflare Email Sending is not enabled for j4ck.ai yet."
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Could not send the email."
}

export async function sendMagicLinkEmail(
  env: Env,
  email: string,
  url: string
) {
  console.info(`[magic-link] ${email}\n${url}`)

  try {
    await env.EMAIL.send({
      to: email,
      from: { name: "j4ck.ai", email: env.EMAIL_FROM },
      subject: "Sign in to j4ck.ai",
      text: `Sign in to j4ck.ai:\n${url}\n\nThis link expires in 10 minutes. If you did not ask for this, ignore the email.`,
      html: `<p>Click to sign in. This link expires in 10 minutes.</p><p><a href="${escapeHtml(url)}">Sign in to j4ck.ai</a></p><p>If you did not ask for this, you can ignore the email.</p>`,
    })
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown"
    console.error(`[magic-link] send failed code=${code}`, error)
    throw new Error(emailErrorMessage(error))
  }
}
