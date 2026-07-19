const RESEND_API_URL = 'https://api.resend.com/emails'

export function getResendApiKey() {
  return process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY || ''
}

export function getResendFromAddress() {
  return process.env.AUTH_RESEND_FROM
    || process.env.RESEND_FROM
    || '西语背单词 <onboarding@resend.dev>'
}

export async function sendResendEmail({ to, subject, html, text }) {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    return { ok: false, error: '邮箱服务尚未配置' }
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getResendFromAddress(),
        to,
        subject,
        html,
        text,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('[resend]', response.status, body)
      return { ok: false, error: '邮件发送失败，请稍后再试' }
    }

    return { ok: true }
  } catch (err) {
    console.error('[resend]', err)
    return { ok: false, error: '邮件发送失败，请稍后再试' }
  }
}
