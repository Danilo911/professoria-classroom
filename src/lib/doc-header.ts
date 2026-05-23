/**
 * Shared utility functions for generating document headers and other common patterns.
 */

interface TeacherInfo {
  full_name?: string
  school?: {
    name?: string
    city?: string
    state?: string
  }
}

/**
 * Gera o cabeçalho padrão da Prefeitura Municipal de Guarulhos
 * para documentos oficiais (pareceres, encaminhamentos, etc.)
 */
export function gerarCabecalhoEscola(teacher: TeacherInfo): string {
  const schoolCity = teacher?.school?.city || 'Guarulhos'
  const schoolName = teacher?.school?.name || ''

  let lines = ''
  lines += `PREFEITURA MUNICIPAL DE ${schoolCity.toUpperCase()}\n`
  lines += `SECRETARIA MUNICIPAL DE EDUCAÇÃO\n`
  if (schoolName) {
    lines += `EPG ${schoolName.toUpperCase()}\n`
  }
  lines += `\n`
  return lines
}

/**
 * Adiciona o cabeçalho ao conteúdo se ele ainda não começar com 'PREFEITURA'
 */
export function ensureHeader(content: string, teacher: TeacherInfo): string {
  if (content.startsWith('PREFEITURA')) return content
  return `${gerarCabecalhoEscola(teacher)}\n${content}`
}
