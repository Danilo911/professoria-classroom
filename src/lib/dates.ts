const DEFAULT_TZ = 'America/Sao_Paulo'

function getTimezone(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_TIMEZONE) {
    return process.env.NEXT_PUBLIC_TIMEZONE
  }
  return DEFAULT_TZ
}

export function getTodayISO(): string {
  const now = new Date()
  const tz = getTimezone()
  const str = now.toLocaleString('en-US', { timeZone: tz })
  const [datePart] = str.split(',')
  const [month, day, year] = datePart.split('/').map(Number)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}
