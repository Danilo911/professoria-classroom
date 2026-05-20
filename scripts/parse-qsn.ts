/**
 * Parse QSN PDFs → SQL para curriculum_skills
 * Extrai saberes/aprendizagens sem usar IA, apenas parser heurístico.
 *
 * Uso: npx tsx scripts/parse-qsn.ts
 *
 * PDFs esperados na pasta RAIZ do projeto (gerenciamento de sala/):
 *   - Educação Infantil_digital.pdf
 *   - Ensino Fundamental_digital.pdf
 *   - EJA_digital.pdf
 *   - Introdutório_digital.pdf
 */

import * as fs from 'fs'
import * as path from 'path'

const { PDFParse } = require('pdf-parse')

const PDF_DIR = path.resolve(__dirname, '..', '..')
const CSV_FILE = path.resolve(__dirname, '..', 'supabase', 'qsn_skills.csv')
const OUTPUT_FILE = path.resolve(__dirname, '..', 'supabase', 'seed_qsn_skills.sql')

const PDF_FILES = [
  'Educação Infantil_digital.pdf',
  'Ensino Fundamental_digital.pdf',
  'EJA_digital.pdf',
  'Introdutório_digital.pdf',
]

// Mapeamento de componentes curriculares (normalizado)
const COMPONENT_KEYWORDS: Record<string, string> = {
  'LÍNGUA PORTUGUESA': 'Língua Portuguesa',
  'LÍNGUA PORTUGUESA COMO SEGUNDA LÍNGUA PARA SURDOS': 'Língua Portuguesa (Surdos)',
  'MATEMÁTICA': 'Matemática',
  'CIÊNCIAS': 'Ciências',
  'HISTÓRIA': 'História',
  'GEOGRAFIA': 'Geografia',
  'ARTE': 'Arte',
  'EDUCAÇÃO FÍSICA': 'Educação Física',
  'INGLÊS': 'Inglês',
  'ENSINO RELIGIOSO': 'Ensino Religioso',
}

// Campos de experiência (Educação Infantil)
const EI_CAMPOS = [
  'O EU, O OUTRO E O NÓS',
  'CORPO, GESTOS E MOVIMENTOS',
  'TRAÇOS, SONS, CORES E FORMAS',
  'ESCUTA, FALA, PENSAMENTO E IMAGINAÇÃO',
  'ESPAÇOS, TEMPOS, QUANTIDADES, RELAÇÕES E TRANSFORMAÇÕES',
]

interface Skill {
  code: string
  description: string
  component: string
  grade: string
  axis: string
  source: string
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function componentFromText(line: string): string | null {
  const upper = line.toUpperCase().trim()
  for (const [key, val] of Object.entries(COMPONENT_KEYWORDS)) {
    if (upper === key || upper.startsWith(key + ' ') || upper.startsWith(key + '\t')) return val
  }
  if (/^LÍNGUA PORTUGUESA/.test(upper) && !upper.includes('SEGUNDA')) return 'Língua Portuguesa'
  return null
}

async function extractText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath)
  const doc = new PDFParse({ data: buf })
  const result = await doc.getText()
  const pages: any[] = result.pages || []
  return pages.map((p: any) => p.text || '').join('\n\n')
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============== PARSER ENSINO FUNDAMENTAL (mais complexo) ==============

function parseFundamental(text: string): Skill[] {
  const skills: Skill[] = []
  const lines = text.split('\n')

  let currentComponent = ''
  let currentAxis = ''
  let currentGrade = ''
  let seqCounter: Record<string, number> = {}

  function addSkill(desc: string, grade: string) {
    if (!currentComponent || !desc) return
    const key = `${currentComponent}-${grade || 'Geral'}`
    seqCounter[key] = (seqCounter[key] || 0) + 1
    const seq = seqCounter[key]
    const compSlug = slug(currentComponent).slice(0, 4)
    const gradeSlug = grade ? grade.replace(/[^0-9]/g, '') : '00'
    const code = `${compSlug}-${gradeSlug}-${String(seq).padStart(3, '0')}`
    skills.push({
      code,
      description: desc.trim(),
      component: currentComponent,
      grade: grade || 'Geral',
      axis: currentAxis,
      source: 'qsn',
    })
  }

  // Ano ranges mapping
  const YEAR_RANGES: [string, string][] = [
    ['1º E 2º ANOS', '1º Ano'],
    ['2º E 3º ANOS', '2º Ano'],
    ['3º E 4º ANOS', '3º Ano'],
    ['4º E 5º ANOS', '4º Ano'],
  ]

  let saberBuffer = ''
  let currentYears: string[] = []
  let inSaber = false
  let inSaberDescription = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    if (!line) continue

    // Detect component header (all caps, short, from our list)
    const comp = componentFromText(line)
    if (comp) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentYears.join('/') || currentGrade)
        saberBuffer = ''
        inSaber = false
        inSaberDescription = false
      }
      currentComponent = comp
      currentAxis = ''
      currentGrade = ''
      currentYears = []
      continue
    }

    if (!currentComponent) continue

    // Detect year range headers
    const yrLine = normalizeText(line)
    const matchedYears: string[] = []
    for (const [pattern, grade] of YEAR_RANGES) {
      if (yrLine.includes(pattern) || yrLine.includes(pattern.replace('º', 'o'))) {
        matchedYears.push(grade)
      }
    }
    if (matchedYears.length > 0) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentYears.join('/') || currentGrade)
        saberBuffer = ''
        inSaber = false
        inSaberDescription = false
      }
      currentYears = matchedYears
      continue
    }

    // Detect axis/dimension (all caps line that's not a component, not year range, not page number)
    const isAllCaps = line === line.toUpperCase() && line.length > 5 && line.length < 120
    const isPageNum = /^\d+$/.test(line) || line.includes('PROPOSTA CURRICULAR QSN')
    if (isAllCaps && !isPageNum && !comp && !/^[º\d]/.test(line)) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentYears.join('/') || currentGrade)
        saberBuffer = ''
        inSaber = false
        inSaberDescription = false
      }
      // Check if it's a known axis or a dimension-like header
      if (line.length < 80 && !line.includes('(continuação)')) {
        currentAxis = line
      }
      continue
    }

    // Detect SABER:
    if (line.startsWith('SABER:')) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentYears.join('/') || currentGrade)
      }
      saberBuffer = line.replace(/^SABER:\s*/, '')
      inSaber = true
      inSaberDescription = true
      continue
    }

    // Continue SABER content
    if (inSaber && inSaberDescription) {
      const continuation = line.replace(/^\(continuação\)\s*/i, '')
      if (continuation && continuation.length > 3 && !continuation.startsWith('SABER:')) {
        saberBuffer += ' ' + continuation
      }
      continue
    }
  }

  // Last saber
  if (inSaber && saberBuffer) {
    addSkill(saberBuffer, currentYears.join('/') || currentGrade)
  }

  return skills
}

// ============== PARSER EDUCAÇÃO INFANTIL ==============

function parseInfantil(text: string): Skill[] {
  const skills: Skill[] = []
  const lines = text.split('\n')

  let currentCampo = ''
  let currentFaixa = ''
  let seqCounter: Record<string, number> = {}

  function addSkill(desc: string, faixa: string) {
    if (!desc) return
    const key = `EI-${faixa || 'Geral'}`
    seqCounter[key] = (seqCounter[key] || 0) + 1
    const seq = seqCounter[key]
    const faixaSlug = faixa ? slug(faixa).slice(0, 3) : 'GER'
    const code = `EI-${faixaSlug}-${String(seq).padStart(3, '0')}`
    skills.push({
      code,
      description: desc.trim(),
      component: 'Educação Infantil',
      grade: faixa || 'Geral',
      axis: currentCampo,
      source: 'qsn',
    })
  }

  const FAIXAS = ['BEBÊS', 'CRIANÇAS BEM PEQUENAS', 'CRIANÇAS PEQUENAS']

  let saberBuffer = ''
  let inSaber = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Detect campo (section header that matches EI campos)
    const upperLine = line.toUpperCase()
    for (const campo of EI_CAMPOS) {
      if (upperLine === campo || upperLine.startsWith(campo + ' ') || upperLine.startsWith(campo + '\t')) {
        if (inSaber && saberBuffer) {
          addSkill(saberBuffer, currentFaixa)
          saberBuffer = ''
          inSaber = false
        }
        currentCampo = campo.charAt(0) + campo.slice(1).toLowerCase()
        currentFaixa = ''
        continue
      }
    }

    if (!currentCampo) continue

    // Detect faixa etária
    const faixaMatch = FAIXAS.find(f => line === f || line.startsWith(f + ' ') || line.startsWith(f + '\t'))
    if (faixaMatch) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentFaixa)
        saberBuffer = ''
        inSaber = false
      }
      currentFaixa = faixaMatch
      continue
    }

    // Detect SABER:
    if (line.startsWith('SABER:')) {
      if (inSaber && saberBuffer) {
        addSkill(saberBuffer, currentFaixa)
      }
      saberBuffer = line.replace(/^SABER:\s*/, '')
      inSaber = true
      continue
    }

    // Continue SABER content
    if (inSaber && line.length > 3 && !line.startsWith('SABER:') && !line.includes('(continuação)')) {
      saberBuffer += ' ' + line
    }
  }

  if (inSaber && saberBuffer) {
    addSkill(saberBuffer, currentFaixa)
  }

  return skills
}

// ============== PARSER EJA ==============

// Componentes/macrocampos da EJA (mais amplos que Fundamental)
const EJA_COMPONENT_KEYWORDS: Record<string, string> = {
  'CORPOREIDADE E RELAÇÕES SOCIAIS': 'Corporeidade e Relações Sociais',
  'LINGUAGENS': 'Linguagens',
  'MATEMÁTICA': 'Matemática',
  'CIÊNCIAS DA NATUREZA': 'Ciências da Natureza',
  'CIÊNCIAS HUMANAS': 'Ciências Humanas',
  'A LIBRAS/LÍNGUA PORTUGUESA COMO SEGUNDA LÍNGUA PARA SURDOS': 'Libras/Língua Portuguesa (Surdos)',
}

// Eixos da EJA (identificados por all-caps headers que não são componentes)
const EJA_AXIS_KEYWORDS = [
  'LEITURA',
  'ESCRITA',
  'ORALIDADE',
  'ANÁLISE LINGUÍSTICA/SEMIÓTICA',
  'LEITURA E ESCUTA',
  'PRODUÇÃO DE TEXTOS/ESCRITA',
  'CONHECIMENTOS LINGUÍSTICOS',
  'LIBRAS: EMISSÃO E RECEPÇÃO',
  'LEITURA E ESCRITA',
  'NÚMEROS',
  'ÁLGEBRA',
  'GEOMETRIA',
  'GRANDEZAS E MEDIDAS',
  'PROBABILIDADE E ESTATÍSTICA',
  'MATÉRIA E ENERGIA',
  'VIDA E EVOLUÇÃO',
  'TERRA E UNIVERSO',
  'CONEXÕES E ESCALAS: CIRCULAÇÃO DE PESSOAS, PRODUTOS E CULTURAS',
  'MUNDO DO TRABALHO E FORMAS DE ORGANIZAÇÃO POLÍTICA, SOCIAL E CULTURAL',
  'NATUREZA, AMBIENTE, QUALIDADE DE VIDA E SUSTENTABILIDADE',
  'O SUJEITO, SEU TEMPO E SEU LUGAR NO MUNDO',
  'IDENTIDADE E DIVERSIDADE',
  'LINGUAGENS E CULTURAS',
  'MUNDO DO TRABALHO',
  'AS LINGUAGENS',
  'AS TECNOLOGIAS',
  'CORPOREIDADE E',
  'BRINCADEIRAS E JOGOS',
  'ESPORTES',
  'GINÁSTICAS',
  'DANÇAS',
  'ARTES VISUAIS, MÚSICA, TEATRO, DANÇA',
  'CONHECIMENTO SOBRE O CORPO',
  'CULTURA INGLESA',
  'CULTURA PORTUGUESA',
  'E A ARTE',
  'E A LÍNGUA E',
  'E AS CIÊNCIAS',
  'E O MUNDO',
  'E OS SABERES',
  'DO TRABALHO',
  'DA NATUREZA',
  'E EXPRESSÕES MATEMÁTICAS',
  'RELATIVOS À NATUREZA E SOCIEDADE',
  'O EDUCANDO',
  'O EDUCANDO E',
  'O EDUCANDO E A',
  'O EDUCANDO, SUA',
  'DIMENSÃO INTERCULTURAL',
  'TECNOLOGIAS NA EDUCAÇÃO',
  'PLANEJAMENTO E INFORMÁTICA NA EDUCAÇÃO',
  'ALIMENTAÇÃO E SUPRIMENTOS DA EDUCAÇÃO',
  'FORMAS, REGISTROS E REPRESENTAÇÕES DA HISTÓRIA E DA GEOGRAFIA:',
]

function isEjaAllCapsHeader(line: string): boolean {
  const upper = line.toUpperCase()
  if (line !== upper) return false
  if (line.length < 5 || line.length > 80) return false

  // Skip page headers, metadata, institutional text
  const skip = ['PROPOSTA CURRICULAR', 'EDUCAÇÃO DE JOVENS E ADULTOS', 'SECRETARIA', 'PREFEITURA',
    'PREFEITO', 'SECRETÁRIO', 'DIRETOR', 'DIRETORA', 'SUBSECRETÁRIO', 'CURRICULAR',
    'SUMÁRIO', 'INTRODUÇÃO', 'APRESENTAÇÃO', 'REFERÊNCIAS']
  for (const s of skip) {
    if (line.includes(s)) return false
  }

  // Skip citations/numbers
  if (/^\d+/.test(line) || /^\d{4}[;,]/.test(line) || /^\d{4}\);/.test(line)) return false
  if (/^[A-ZÁÉÍÓÚÃÕÊ]+,\s+\d{4}/.test(line)) return false

  // Skip bibliographic references
  if (/[A-ZÇÃÁÉÍÓÚÊÕ]+,?\s+\d{4}/.test(line) && (line.includes(';') || line.includes('.') || line.includes(')'))) return false

  return true
}

function parseEJA(text: string): Skill[] {
  const skills: Skill[] = []
  const lines = text.split('\n')

  let currentComponent = 'EJA'
  let currentAxis = ''
  let seqCounter: Record<string, number> = {}
  let inTable = false
  let lastSkillBuffer = ''

  // Páginas iniciais têm sumário, introdução, referencial teórico — ignorar até encontrar primeira tabela
  const tableStart = text.indexOf('CICLO I \tCICLO II')
  const firstTableLine = tableStart >= 0 ? text.substring(0, tableStart).split('\n').length : 0

  // Ignorar tudo após REFERÊNCIAS (bibliografia)
  const refsIdx = text.toUpperCase().lastIndexOf('REFERÊNCIAS')
  const refsLine = refsIdx >= 0 ? text.substring(0, refsIdx).split('\n').length : lines.length

  function addSkill(desc: string) {
    if (!desc || desc.length < 10) return
    // Remove leading page numbers
    const clean = desc.replace(/^\d+\s+/, '').replace(/\s+\d+\s*$/, '').trim()
    if (clean.length < 10) return

    const key = `EJA-${currentAxis || 'Geral'}`
    seqCounter[key] = (seqCounter[key] || 0) + 1
    const seq = seqCounter[key]
    const axisSlug = currentAxis ? slug(currentAxis).slice(0, 4) : 'GER'
    const code = `EJA-${axisSlug}-${String(seq).padStart(3, '0')}`
    skills.push({
      code,
      description: clean,
      component: currentComponent,
      grade: 'EJA',
      axis: currentAxis,
      source: 'qsn',
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue

    // Stop at bibliography
    if (i >= refsLine) break

    // Skip intro pages
    if (i < firstTableLine - 5 && !inTable) continue

    // Detect component header
    const upperLine = line.toUpperCase()
    let compMatched = false
    for (const [key, val] of Object.entries(EJA_COMPONENT_KEYWORDS)) {
      if (upperLine === key || upperLine.startsWith(key + ' ') || upperLine.startsWith(key + '\t')) {
        currentComponent = val
        currentAxis = ''
        inTable = false
        compMatched = true
        break
      }
    }
    if (compMatched) continue

    // Detect table header
    if (line.includes('CICLO I') && line.includes('CICLO II')) {
      inTable = true
      continue
    }

    if (!inTable) continue

    // Detect axis header (all caps within table)
    if (isEjaAllCapsHeader(line)) {
      currentAxis = line
      continue
    }

    // Skip page headers and artifacts
    if (line.includes('PROPOSTA CURRICULAR') || line.includes('EDUCAÇÃO DE JOVENS E ADULTOS') || /^\d+$/.test(line)) {
      continue
    }

    // Remove leading/trailing page numbers
    const cleanLine = line.replace(/^\d+\s+/, '').replace(/\s+\d+\s*$/, '').trim()
    if (!cleanLine || cleanLine.length < 10) continue

    // Skip citation lines
    if (/^\w+,\s+\d{4}/.test(cleanLine) || /^\w+;/.test(cleanLine)) continue

    // Accumulate lines until we hit a period boundary
    const endsSentence = /[.!?](\s*)$/.test(cleanLine)
    const startsLower = /^[a-zà-ú]/.test(cleanLine)
    const isVeryShort = cleanLine.length < 35

    if (lastSkillBuffer) {
      // Continuation of previous line (lowercase start, or very short, or no period on previous)
      lastSkillBuffer += ' ' + cleanLine
      if (endsSentence) {
        addSkill(lastSkillBuffer)
        lastSkillBuffer = ''
      }
      continue
    }

    // No existing buffer
    if (endsSentence) {
      addSkill(cleanLine)
    } else {
      lastSkillBuffer = cleanLine
    }
  }

  // Last skill
  if (lastSkillBuffer) {
    addSkill(lastSkillBuffer)
  }

  return skills
}

// ============== MAIN ==============

function escapeSql(v: string): string {
  return (v || '').replace(/'/g, "''")
}

function generateSql(skills: Skill[]): string {
  const seen = new Set<string>()
  const unique = skills.filter(s => {
    if (seen.has(s.code)) return false
    seen.add(s.code)
    return true
  })

  if (unique.length === 0) return ''

  const lines = unique.map(s =>
    `  ('${escapeSql(s.code)}', '${escapeSql(s.description)}', '${escapeSql(s.component)}', '${escapeSql(s.grade)}', '${escapeSql(s.axis)}', '${escapeSql(s.source)}')`
  )

  return `-- Habilidades QSN — Gerado: ${new Date().toISOString()}\n-- Total: ${unique.length}\n\nDELETE FROM curriculum_skills WHERE source = 'qsn';\n\nINSERT INTO curriculum_skills (code, description, component, grade, axis, source) VALUES\n${lines.join(',\n')}\nON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, component = EXCLUDED.component, grade = EXCLUDED.grade, axis = EXCLUDED.axis, source = EXCLUDED.source;\n`
}

async function main() {
  console.log('=== Parsing QSN PDFs ===\n')

  const allSkills: Skill[] = []

  for (const pdfFile of PDF_FILES) {
    const pdfPath = path.join(PDF_DIR, pdfFile)
    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️  ${pdfFile} — não encontrado, pulando`)
      continue
    }

    console.log(`📄 ${pdfFile}...`)

    const text = await extractText(pdfPath)
    console.log(`   ${text.length} caracteres`)

    let skills: Skill[] = []

    if (pdfFile.includes('Infantil')) {
      skills = parseInfantil(text)
    } else if (pdfFile.includes('Fundamental')) {
      skills = parseFundamental(text)
    } else if (pdfFile.includes('EJA')) {
      skills = parseEJA(text)
    } else if (pdfFile.includes('Introdutório')) {
      // Introdutório é BNCC — pula
      console.log(`   ⏭️  Introdutório é BNCC, pulando`)
      continue
    }

    console.log(`   ${skills.length} habilidades extraídas`)
    allSkills.push(...skills)
  }

  console.log(`\n📊 Total bruto: ${allSkills.length}`)

  // Deduplica
  const seen = new Set<string>()
  const unique = allSkills.filter(s => {
    const key = `${s.description}|${s.component}|${s.grade}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  console.log(`📊 Únicas (por conteúdo): ${unique.length}`)

  // Preview
  console.log('\n📋 Preview (primeiras 10):')
  unique.slice(0, 10).forEach(s =>
    console.log(`   [${s.code}] ${s.component} — ${s.grade} — ${(s.description || '').slice(0, 80)}...`)
  )

  // Gera SQL
  const sql = generateSql(unique)
  if (sql) {
    fs.writeFileSync(OUTPUT_FILE, sql)
    console.log(`\n📄 SQL salvo em: ${OUTPUT_FILE}`)
  } else {
    console.log('\n❌ Nenhuma habilidade extraída.')
  }
}

main().catch(console.error)
