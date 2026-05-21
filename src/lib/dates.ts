const DEFAULT_TZ = 'America/Sao_Paulo'

export function getBrasiliaTZ(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TIMEZONE) {
    return process.env.NEXT_PUBLIC_TIMEZONE
  }
  return DEFAULT_TZ
}

export function getTodayISO(): string {
  const now = new Date()
  const tz = getBrasiliaTZ()
  const str = now.toLocaleString('en-US', { timeZone: tz })
  const [datePart] = str.split(',')
  const [month, day, year] = datePart.split('/').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatDateTimeBR(isoStr: string): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('pt-BR', {
    timeZone: getBrasiliaTZ(),
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
