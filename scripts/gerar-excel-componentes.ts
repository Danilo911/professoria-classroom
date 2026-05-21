/**
 * Gera planilhas Excel formatadas para cada componente do QSN Fundamental.
 *
 * Uso: npx tsx scripts/gerar-excel-componentes.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

const INPUT_CSV = path.resolve(__dirname, '..', 'supabase', 'qsn_fundamental_estruturado.csv')
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'planilhas_componentes')

// Color palette for UTEs
const UTE_COLORS: string[] = [
  '4472C4', // blue
  'ED7D31', // orange
  '70AD47', // green
  'FFC000', // gold
  '5B9BD5', // light blue
  'A5A5A5', // gray
  '264478', // dark blue
  '9B59B6', // purple
  '1ABC9C', // teal
  'E74C3C', // red
  'F39C12', // yellow-orange
  '2ECC71', // emerald
  '3498DB', // sky blue
  'E91E63', // pink
  '00BCD4', // cyan
  'FF5722', // deep orange
  '795548', // brown
  '607D8B', // blue-gray
]

interface Record {
  ComponenteCurricular: string
  Eixo: string
  UTE: string
  SABER: string
  APR: string
}

function escapeCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

function componentSlug(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function createWorkbook(records: Record[], componentName: string): void {
  const wb = XLSX.utils.book_new()

  // ===== Sheet 1: Dados =====
  const headerRow = ['ComponenteCurricular', 'Eixo', 'UTE', 'SABER', 'APR']
  const dataRows = records.map(r => [r.ComponenteCurricular, r.Eixo, r.UTE, r.SABER, r.APR])

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

  // Column widths
  ws['!cols'] = [
    { wch: 22 }, // Componente
    { wch: 35 }, // Eixo
    { wch: 40 }, // UTE
    { wch: 60 }, // SABER
    { wch: 80 }, // APR
  ]

  // Freeze header row
  ws['!freeze'] = { x: 0, y: 1 }

  // Build UTE->color mapping
  const uniqueUTEs = [...new Set(records.map(r => r.UTE))]
  const uteColorMap: Record<string, string> = {}
  uniqueUTEs.forEach((ute, idx) => {
    uteColorMap[ute] = UTE_COLORS[idx % UTE_COLORS.length]
  })

  // Apply colors to data cells (row 2 onwards, column C = UTE)
  // xlsx uses 0-indexed rows and cols
  if (!ws['!rows']) ws['!rows'] = []
  
  // Style the header
  const headerStyle = {
    fill: { fgColor: { rgb: '2F5496' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'FFFFFF' } },
      bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
      left: { style: 'thin', color: { rgb: 'FFFFFF' } },
      right: { style: 'thin', color: { rgb: 'FFFFFF' } },
    },
  }

  // Apply header style
  for (let c = 0; c < 5; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellAddr]) {
      ws[cellAddr].s = headerStyle
    }
  }

  // Apply row colors based on UTE
  for (let i = 0; i < records.length; i++) {
    const r = i + 1 // data row index
    const ute = records[i].UTE
    const color = uteColorMap[ute] || 'FFFFFF'

    // Alternating lighter version for readability
    const lighterColor = lightenColor(color, 0.7)

    for (let c = 0; c < 5; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c })
      if (!ws[cellAddr]) continue
      ws[cellAddr].s = {
        fill: { fgColor: { rgb: c === 2 ? color : lighterColor } },
        font: { sz: 10 },
        alignment: {
          vertical: 'center',
          wrapText: true,
          ...(c === 0 ? { horizontal: 'center' } : {}),
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
  ws['!autofilter'] = { ref: `A1:E${records.length + 1}` }

  XLSX.utils.book_append_sheet(wb, ws, 'Dados')

  // ===== Sheet 2: Legenda =====
  const legendData = uniqueUTEs.map((ute, idx) => {
    const count = records.filter(r => r.UTE === ute).length
    return [ute, count, '']
  })
  legendData.unshift(['UTE', 'Qtd APRs', ''])

  const wsLegend = XLSX.utils.aoa_to_sheet(legendData)
  wsLegend['!cols'] = [
    { wch: 50 },
    { wch: 12 },
    { wch: 10 },
  ]

  // Header row for legend
  for (let c = 0; c < 2; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c })
    if (wsLegend[cellAddr]) {
      wsLegend[cellAddr].s = {
        fill: { fgColor: { rgb: '2F5496' } },
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        alignment: { horizontal: 'center', vertical: 'center' },
      }
    }
  }

  // Color cells in legend
  for (let i = 0; i < uniqueUTEs.length; i++) {
    const r = i + 1
    const color = uteColorMap[uniqueUTEs[i]]
    for (let c = 0; c < 2; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c })
      if (wsLegend[cellAddr]) {
        wsLegend[cellAddr].s = {
          fill: { fgColor: { rgb: color } },
          font: { bold: c === 0, sz: 10, color: { rgb: isLight(color) ? '000000' : 'FFFFFF' } },
          alignment: { vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'D9D9D9' } },
            bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
            left: { style: 'thin', color: { rgb: 'D9D9D9' } },
            right: { style: 'thin', color: { rgb: 'D9D9D9' } },
          },
        }
      }
    }
  }

  // Legend title
  wsLegend['!freeze'] = { x: 0, y: 1 }

  XLSX.utils.book_append_sheet(wb, wsLegend, 'Legenda')

  // ===== Save =====
  const slug = componentSlug(componentName)
  const filename = `qsn_${slug}.xlsx`
  const filepath = path.join(OUTPUT_DIR, filename)
  XLSX.writeFile(wb, filepath)
  console.log(`  ✅ ${filename} (${records.length} registros, ${uniqueUTEs.length} UTEs)`)
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

function main() {
  console.log('=== Gerar Planilhas Excel — QSN Fundamental ===\n')

  // Read CSV
  const csvContent = fs.readFileSync(INPUT_CSV, 'utf-8').replace(/^\uFEFF/, '')
  const lines = csvContent.split('\n')
  const header = lines[0].split(';').map(h => h.replace(/^"|"$/g, '').trim())

  const records: Record[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    // Parse CSV with semicolons, handling quoted fields
    const parts = parseCSVLine(lines[i])
    if (parts.length >= 5) {
      records.push({
        ComponenteCurricular: parts[0],
        Eixo: parts[1],
        UTE: parts[2],
        SABER: parts[3],
        APR: parts[4],
      })
    }
  }

  console.log(`Total de registros: ${records.length}`)

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Deduplicate (same UTE + SABER + APR within component)
  const dedupKeys = new Set<string>()
  const deduped = records.filter(r => {
    const key = `${r.ComponenteCurricular}|${r.UTE}|${r.SABER}|${r.APR}`
    if (dedupKeys.has(key)) return false
    dedupKeys.add(key)
    return true
  })
  console.log(`Após dedup: ${deduped.length} (removidas ${records.length - deduped.length} duplicadas)`)

  // Group by component
  const byComponent: Record<string, Record[]> = {}
  for (const r of deduped) {
    if (!byComponent[r.ComponenteCurricular]) byComponent[r.ComponenteCurricular] = []
    byComponent[r.ComponenteCurricular].push(r)
  }

  console.log('\nGerando planilhas...\n')

  for (const [component, compRecords] of Object.entries(byComponent)) {
    createWorkbook(compRecords, component)
  }

  console.log(`\n📁 Planilhas salvas em: ${OUTPUT_DIR}`)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ';' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

main()
