/** 打卡 / 今日会话按北京时间切日（避免 Vercel UTC 把凌晨并到前一天） */
export const APP_TZ = 'Asia/Shanghai'

export function todayStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 对 YYYY-MM-DD 民事日期做加减（与时区无关） */
export function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + Number(deltaDays || 0)))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
