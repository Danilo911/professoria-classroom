import * as fs from 'fs'
import * as path from 'path'

const INPUT_FILE = path.resolve(__dirname, '..', '..', 'tmp-fundamental.txt')
const OUTPUT_CSV = path.resolve(__dirname, '..', 'supabase', 'qsn_fundamental_estruturado.csv')

const SECTIONS: [number, number, string, string][] = [
  [240, 996,  'Cultura de Paz',        'O educando — Cultura de Paz e Educação em Direitos Humanos'],
  [997, 1521, 'Educação Digital',       'O educando e as tecnologias'],
  [1522, 2499,'Língua Portuguesa',      'Comunicação e Expressão'],
  [2500, 4749,'Libras',                 'Surdo — Libras'],
  [4750, 5427,'Inglês',                 'Língua Inglesa'],
  [5428, 6000,'Arte',                   'Arte'],
  [6001, 6579,'Educação Física',        'Educação Física'],
  [6580, 7571,'Matemática',             'Matemática'],
  [7867, 8119,'Geografia',              'Natureza e Sociedade'],
  [8120, 8388,'História',               'Natureza e Sociedade'],
  [8389, 9134,'Ciências',               'Natureza e Sociedade'],
]

interface Record {
  component: string
  eixo: string
  ute: string
  saber: string
  apr: string
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function escapeCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

const LINES = fs.readFileSync(INPUT_FILE, 'utf-8').split('\n')

// Pre-scan: find all year-range table header lines
const yearRangeLines = new Set<number>()
for (let i = 0; i < LINES.length; i++) {
  if (/1[º°]\s*E\s*2[º°]\s*ANOS/.test(LINES[i])) {
    yearRangeLines.add(i)
  }
}

function isUTEHeader(line: string): boolean {
  const t = line.trim()
  if (!t || t.length < 4 || t.length > 120) return false
  if (t !== t.toUpperCase()) return false
  if (!/[A-ZÁÉÍÓÚÃÕÊÂ]{4,}/.test(t)) return false
  if (/^\d+$/.test(t)) return false
  if (t.includes('PROPOSTA CURRICULAR QSN') || t.includes('ENSINO FUNDAMENTAL')) return false
  if (/^[1-5][º°]/.test(t)) return false
  if (/[a-z]/.test(t)) return false  
  return true
}

// Find all UTE panels (UTE header + year-range line)
type UTEPanel = { ute: string; lineIdx: number }
function findUTEPanels(): UTEPanel[] {
  const panels: UTEPanel[] = []
  for (const yrLine of yearRangeLines) {
    for (let j = yrLine - 1; j >= Math.max(0, yrLine - 4); j--) {
      const t = LINES[j].trim()
      if (isUTEHeader(t)) {
        panels.push({ ute: t, lineIdx: j })
        break
      }
    }
  }
  return panels
}

const UTE_PANELS = findUTEPanels()

function getPanelIndex(lineIdx: number): number {
  for (let p = UTE_PANELS.length - 1; p >= 0; p--) {
    if (UTE_PANELS[p].lineIdx <= lineIdx) return p
  }
  return -1
}

// Portuguese infinitive verb: first word of line ends with -ar/-er/-ir/-or
// This catches all APR-starting verbs like Manusear, Reconhecer, Organizar, Ler, etc.
const INFINITIVE_RE = /^[A-ZÁÉÍÓÚÃÕÊÂ][a-záéíóúãõêâ]{1,}[rR]\b/

function isInfinitiveStart(t: string): boolean {
  return INFINITIVE_RE.test(t)
}

function isIntroText(t: string): boolean {
  if (t.length > 400) return true
  if (/(?:^Para\s+(?:o trabalho|que|tanto|a compreensão)|^É\s+(?:fundamental|essencial|importante|preciso)|^Destacamos|^Além\s+disso|^Neste\s+trabalho|^Importância\s+do\s+trabalho|^Considerando\s+as?\s+seguintes|^1[º°]\s+ao\s+3[º°]|^4[º°]\s+e\s+5[º°]|^A\s+seguir|^Programa\s+de|SECRETARIA\s+DE EDUCAÇÃO|Prefeitura|Prefeito|Secretário|ASSESSORIA TÉCNICA|Diagramação|Produção Editorial)/i.test(t)) return true
  return false
}

function parse(): Record[] {
  const records: Record[] = []

  for (const [start, end, component, eixo] of SECTIONS) {
    console.log(`\n=== ${component} (linhas ${start}-${end}) ===`)

    let currentUTE = ''
    let currentSaber = ''
    let saberLines: string[] = []
    let inSaber = false
    let saberDone = false
    let currentAprLines: string[] = []
    let waitingForUTE = false
    let utelineCount = 0
    let saberCount = 0
    let aprCount = 0

    function emitApr() {
      if (currentAprLines.length === 0 || !currentSaber) return
      const apr = normalize(currentAprLines.join(' '))
      if (apr.length > 5 && apr.length < 400 && !isIntroText(apr)) {
        records.push({ component, eixo, ute: currentUTE, saber: currentSaber, apr })
        aprCount++
      }
      currentAprLines = []
    }

    function finishSaber() {
      if (saberLines.length > 0) {
        currentSaber = normalize(saberLines.join(' '))
        saberLines = []
        saberDone = true
        saberCount++
      }
    }

    for (let i = start - 1; i < end && i < LINES.length; i++) {
      const raw = LINES[i]
      const line = raw.trim()
      if (!line) continue

      // Skip page numbers and boilerplate
      if (/^\d+$/.test(line)) continue
      if (line.includes('PROPOSTA CURRICULAR QSN') || line.includes('ENSINO FUNDAMENTAL')) continue
      if (line.includes('SECRETARIA DE EDUCAÇÃO')) continue

      // Detect UTE header via pre-scanned panels
      const panelIdx = getPanelIndex(i)
      if (panelIdx >= 0 && UTE_PANELS[panelIdx].lineIdx === i) {
        const panelUTE = UTE_PANELS[panelIdx].ute
        // Only reset if it's a different UTE block
        if (panelUTE !== currentUTE || saberDone || saberLines.length > 0) {
          emitApr()
          finishSaber()
          currentUTE = panelUTE
          currentSaber = ''
          saberLines = []
          inSaber = false
          saberDone = false
          currentAprLines = []
          waitingForUTE = false
          utelineCount++
        }
        // Skip the year-range line
        if (yearRangeLines.has(i + 1)) i++
        continue
      }

      // If we're waiting for the next UTE, skip everything
      if (waitingForUTE) continue
      if (!currentUTE) continue

      // Detect SABER
      if (/^SABER\s*:/.test(line)) {
        emitApr()
        finishSaber()
        saberLines = [line.replace(/^SABER\s*:\s*/, '')]
        inSaber = true
        saberDone = false
        continue
      }

      // Accumulating SABER description
      if (inSaber) {
        const cont = line
        // Check if this line is actually an APR starting (verb in infinitive)
        if (isInfinitiveStart(cont) && saberLines.length > 0 && saberLines[saberLines.length - 1].endsWith('.')) {
          finishSaber()
          inSaber = false
        } else if (isIntroText(cont)) {
          // This is intro text, not SABER continuation
          finishSaber()
          waitingForUTE = true
          continue
        } else {
          saberLines.push(cont)
          continue
        }
      }

      // Past SABER — collecting APR items
      if (!saberDone) continue

      const trimmed = line.trim()

      // APR must start with infinitive verb or be a natural sentence start
      const isNewApr = isInfinitiveStart(trimmed) && currentAprLines.length > 0

      // Check for intro text masquerading as APR
      if (!isInfinitiveStart(trimmed) && !startsWithCapital(trimmed)) {
        // Continuation of previous APR
        if (currentAprLines.length > 0) {
          currentAprLines.push(trimmed)
        }
        continue
      }

      if (isIntroText(trimmed)) {
        emitApr()
        waitingForUTE = true
        continue
      }

      if (isNewApr) {
        emitApr()
        currentAprLines = [trimmed]
      } else if (currentAprLines.length === 0) {
        // Only start collecting if it looks like APR
        if (isInfinitiveStart(trimmed) || startsWithCapital(trimmed)) {
          currentAprLines = [trimmed]
        }
      } else {
        currentAprLines.push(trimmed)
      }
    }

    // Flush last APR
    emitApr()
    finishSaber()

    console.log(`  UTEs: ${utelineCount}, SABERs: ${saberCount}, APR items: ${aprCount}`)
  }

  return records
}

function startsWithCapital(t: string): boolean {
  const c = t[0]
  return /[A-ZÁÉÍÓÚÃÕÊÂ]/.test(c)
}

function main() {
  console.log('=== Parser QSN Fundamental Estruturado (v2) ===\n')
  console.log(`Arquivo: ${INPUT_FILE}`)
  console.log(`Total de linhas: ${LINES.length}`)
  console.log(`UTEs detectadas: ${UTE_PANELS.length}`)

  const records = parse()

  console.log(`\n=== RESULTADO FINAL ===`)
  console.log(`Total de registros: ${records.length}`)

  const byComponent: Record<string, number> = {}
  for (const r of records) {
    byComponent[r.component] = (byComponent[r.component] || 0) + 1
  }
  console.log('\nPor componente:')
  for (const [comp, count] of Object.entries(byComponent)) {
    console.log(`  ${comp}: ${count}`)
  }

  // Write CSV
  const header = 'ComponenteCurricular;Eixo;UTE;SABER;APR'
  const rows = records.map(r => [escapeCsv(r.component), escapeCsv(r.eixo), escapeCsv(r.ute), escapeCsv(r.saber), escapeCsv(r.apr)].join(';'))
  const csv = '\uFEFF' + header + '\n' + rows.join('\n')
  fs.writeFileSync(OUTPUT_CSV, csv, 'utf-8')
  console.log(`\n📄 CSV salvo: ${OUTPUT_CSV}`)

  // Preview first 15
  console.log('\n📋 Preview:')
  records.slice(0, 15).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.component}] ${r.ute.slice(0, 30)} → ${r.apr.slice(0, 70)}...`)
  })
}

main()
