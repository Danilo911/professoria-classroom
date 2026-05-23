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

/**
 * Retorna o primeiro e último dia de um mês no formato YYYY-MM-DD.
 * Usa America/Sao_Paulo para determinar a data correta.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const pad = String(month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const padEnd = String(lastDay).padStart(2, '0')
  return {
    start: `${year}-${pad}-01`,
    end: `${year}-${pad}-${padEnd}`,
  }
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
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
