/**
 * Gera planilha única com todas as disciplinas, APRs com ano atribuído (opção C).
 *
 * Estratégia de anos:
 *   - Dentro de cada SABER, os APRs ciclam em grupos de 4 pelas colunas de ano:
 *     pos%4=0 → 1º E 2º ANOS, pos%4=1 → 2º E 3º ANOS, pos%4=2 → 3º E 4º ANOS, pos%4=3 → 4º E 5º ANOS
 *   - Opção C: cada APR vira 2 registros (um para cada ano do par)
 *
 * Uso: npx tsx scripts/gerar-planilha-unificada.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

const INPUT_CSV = path.resolve(__dirname, '..', 'supabase', 'qsn_fundamental_estruturado.csv')
const OUTPUT_FILE = path.resolve(__dirname, '..', '..', 'qsn_curriculo_completo.xlsx')

const YEAR_PAIRS = [
  '1º E 2º ANOS',
  '2º E 3º ANOS',
  '3º E 4º ANOS',
  '4º E 5º ANOS',
]

const YEAR_PAIR_TO_INDIVIDUAL: Record<string, string[]> = {
  '1º E 2º ANOS': ['1º Ano', '2º Ano'],
  '2º E 3º ANOS': ['2º Ano', '3º Ano'],
  '3º E 4º ANOS': ['3º Ano', '4º Ano'],
  '4º E 5º ANOS': ['4º Ano', '5º Ano'],
}

// Color palette for UTEs
const UTE_COLORS: string[] = [
  '4472C4', 'ED7D31', '70AD47', 'FFC000', '5B9BD5',
  'A5A5A5', '264478', '9B59B6', '1ABC9C', 'E74C3C',
  'F39C12', '2ECC71', '3498DB', 'E91E63', '00BCD4',
  'FF5722', '795548', '607D8B',
]

// Color per year cycle
const YEAR_COLORS: Record<string, string> = {
  '1º Ano': 'DAEEF3',
  '2º Ano': 'E2EFDA',
  '3º Ano': 'FCE4D6',
  '4º Ano': 'D9E2F3',
  '5º Ano': 'FFF2CC',
}

interface FlatRecord {
  component: string
  eixo: string
  ute: string
  saber: string
  apr: string
}

interface ExpandedRecord {
  ComponenteCurricular: string
  Eixo: string
  UTE: string
  SABER: string
  APR: string
  Ciclo: string
  ParDeAnos: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ';' && !inQuotes) { result.push(current); current = '' }
    else current += ch
  }
  result.push(current)
  return result
}

function lightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lr = Math.round(r + (255 - r) * factor)
  const lg = Math.round(g + (255 - g) * factor)
  const lb = Math.round(b + (255 - b) * factor)
  return lr.toString(16).padStart(2, '0') + lg.toString(16).padStart(2, '0') + lb.toString(16).padStart(2, '0')
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155
}

function componentSlug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function main() {
  console.log('=== Gerar Planilha Unificada — QSN Fundamental ===\n')

  // 1. Read CSV
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf-8').replace(/^\uFEFF/, '')
  const lines = csvContent.split('\n').filter(l => l.trim())

  const flatRecords: FlatRecord[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i])
    if (parts.length >= 5) {
      flatRecords.push({
        component: parts[0],
        eixo: parts[1],
        ute: parts[2],
        saber: parts[3],
        apr: parts[4],
      })
    }
  }

  console.log(`Lidos: ${flatRecords.length} registros\n`)

  // 2. Deduplicate
  const dedupKeys = new Set<string>()
  const uniqueRecords = flatRecords.filter(r => {
    const key = `${r.component}|${r.saber}|${r.apr}`
    if (dedupKeys.has(key)) return false
    dedupKeys.add(key)
    return true
  })
  console.log(`Após dedup: ${uniqueRecords.length}`)

  // 3. Assign year pairs (modulo 4 heuristic within each SABER)
  // Group by component + ute + saber, preserving order
  const saberGroups: { key: string; records: FlatRecord[] }[] = []
  const saberMap = new Map<string, FlatRecord[]>()

  for (const r of uniqueRecords) {
    const key = `${r.component}|${r.ute}|${r.saber}`
    if (!saberMap.has(key)) {
      saberMap.set(key, [])
      saberGroups.push({ key, records: saberMap.get(key)! })
    }
    saberMap.get(key)!.push(r)
  }

  console.log(`SABERs únicos: ${saberGroups.length}`)

  // 4. Expand to individual years
  const expandedRecords: ExpandedRecord[] = []

  for (const group of saberGroups) {
    const { records } = group

    for (let pos = 0; pos < records.length; pos++) {
      const r = records[pos]
      const yearPairIdx = pos % 4
      const yearPair = YEAR_PAIRS[yearPairIdx]
      const individualYears = YEAR_PAIR_TO_INDIVIDUAL[yearPair]

      for (const ciclo of individualYears) {
        expandedRecords.push({
          ComponenteCurricular: r.component,
          Eixo: r.eixo,
          UTE: r.ute,
          SABER: r.saber,
          APR: r.apr,
          Ciclo: ciclo,
          ParDeAnos: yearPair,
        })
      }
    }
  }

  console.log(`Expandidos (com anos): ${expandedRecords.length} registros\n`)

  // 5. Group by component for sheets
  const byComponent: Record<string, ExpandedRecord[]> = {}
  for (const r of expandedRecords) {
    if (!byComponent[r.ComponenteCurricular]) byComponent[r.ComponenteCurricular] = []
    byComponent[r.ComponenteCurricular].push(r)
  }

  // 6. Create unified workbook
  const wb = XLSX.utils.book_new()

  // ===== Sheet 0: Índice / Legenda =====
  const indexData: string[][] = [
    ['Componente Curricular', 'APRs', 'UTEs', 'Abrangência'],
  ]
  for (const [comp, recs] of Object.entries(byComponent)) {
    const utes = new Set(recs.map(r => r.UTE)).size
    const ciclos = [...new Set(recs.map(r => r.Ciclo))].sort()
    indexData.push([comp, String(recs.length), String(utes), ciclos.join(', ')])
  }

  const wsIndex = XLSX.utils.aoa_to_sheet(indexData)
  wsIndex['!cols'] = [
    { wch: 25 }, { wch: 10 }, { wch: 8 }, { wch: 40 },
  ]
  wsIndex['!freeze'] = { x: 0, y: 1 }

  // Style index header
  for (let c = 0; c < 4; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsIndex[addr]) {
      wsIndex[addr].s = {
        fill: { fgColor: { rgb: '2F5496' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Color index rows
  const compEntries = Object.entries(byComponent)
  compEntries.forEach(([comp, recs], idx) => {
    const r = idx + 1
    const color = UTE_COLORS[idx % UTE_COLORS.length]
    const lighter = lightenColor(color, 0.8)
    for (let c = 0; c < 4; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (wsIndex[addr]) {
        wsIndex[addr].s = {
          fill: { fgColor: { rgb: c === 0 ? lighter : 'FFFFFF' } },
          font: { bold: c === 0, sz: 10 },
          alignment: { vertical: 'center', wrapText: true },
          border: { top: { style: 'thin', color: { rgb: 'D9D9D9' } }, bottom: { style: 'thin', color: { rgb: 'D9D9D9' } }, left: { style: 'thin', color: { rgb: 'D9D9D9' } }, right: { style: 'thin', color: { rgb: 'D9D9D9' } } },
        }
      }
    }
  })

  XLSX.utils.book_append_sheet(wb, wsIndex, 'Índice')

  // ===== Sheets por componente =====
  const HEADER = ['ComponenteCurricular', 'Ciclo', 'UTE', 'SABER', 'APR']

  for (const [component, recs] of Object.entries(byComponent)) {
    const dataRows = recs.map(r => [r.ComponenteCurricular, r.Ciclo, r.UTE, r.SABER, r.APR])
    const sheetData = [HEADER, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    ws['!cols'] = [
      { wch: 22 },  // Componente
      { wch: 10 },  // Ciclo
      { wch: 42 },  // UTE
      { wch: 60 },  // SABER
      { wch: 80 },  // APR
    ]
    ws['!freeze'] = { x: 0, y: 1 }

    // Build UTE color map
    const uniqueUTEs = [...new Set(recs.map(r => r.UTE))]
    const uteColorMap: Record<string, string> = {}
    uniqueUTEs.forEach((ute, idx) => { uteColorMap[ute] = UTE_COLORS[idx % UTE_COLORS.length] })

    // Style header
    for (let c = 0; c < 5; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[addr]) {
        ws[addr].s = {
          fill: { fgColor: { rgb: '2F5496' } },
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: { top: { style: 'thin', color: { rgb: 'FFFFFF' } }, bottom: { style: 'thin', color: { rgb: 'FFFFFF' } }, left: { style: 'thin', color: { rgb: 'FFFFFF' } }, right: { style: 'thin', color: { rgb: 'FFFFFF' } } },
        }
      }
    }

    // Style data rows
    for (let i = 0; i < recs.length; i++) {
      const r = i + 1
      const ute = recs[i].UTE
      const ciclo = recs[i].Ciclo
      const uteColor = uteColorMap[ute] || 'FFFFFF'
      const cycleBg = YEAR_COLORS[ciclo] || 'FFFFFF'
      const rowLighter = lightenColor(uteColor, 0.85)

      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) continue

        // Cell background: UTE column gets UTE color, Ciclo column gets cycle color, rest get light UTE color
        let bg: string
        if (c === 2) bg = uteColor       // UTE column
        else if (c === 1) bg = cycleBg   // Ciclo column
        else bg = rowLighter

        ws[addr].s = {
          fill: { fgColor: { rgb: bg } },
          font: {
            sz: 10,
            bold: c === 2,
            color: c === 2 ? { rgb: isLight(uteColor) ? '000000' : 'FFFFFF' } : undefined,
          },
          alignment: {
            vertical: 'center',
            wrapText: true,
            horizontal: c <= 1 ? 'center' : 'left',
          },
          border: {
            top: { style: 'thin', color: { rgb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
            left: { style: 'thin', color: { rgb: 'D9D9D9' } },
            right: { style: 'thin', color: { rgb: 'D9D9D9' } },
          },
        }
      }
    }

    // Auto-filter
    ws['!autofilter'] = { ref: `A1:E${recs.length + 1}` }

    // Sheet name (max 31 chars for Excel)
    let sheetName = component
    if (sheetName.length > 31) sheetName = sheetName.substring(0, 28) + '...'

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    console.log(`  ✅ Sheet "${sheetName}": ${recs.length} registros`)
  }

  // 7. Save
  XLSX.writeFile(wb, OUTPUT_FILE)
  console.log(`\n📄 Planilha unificada salva: ${OUTPUT_FILE}`)
  console.log(`   ${expandedRecords.length} registros × ${Object.keys(byComponent).length} disciplinas`)
}

main()
