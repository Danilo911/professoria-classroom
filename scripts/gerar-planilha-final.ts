/**
 * Limpa artefatos do PDF e gera planilha final com design refinado.
 *
 * Uso: npx tsx scripts/gerar-planilha-final.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'

const INPUT_CSV = path.resolve(__dirname, '..', 'supabase', 'qsn_fundamental_estruturado.csv')
const OUTPUT_FILE = path.resolve(__dirname, '..', '..', 'Currículo_QSN_Ensino_Fundamental.xlsx')

const YEAR_PAIRS = ['1º E 2º ANOS', '2º E 3º ANOS', '3º E 4º ANOS', '4º E 5º ANOS']
const YEAR_PAIR_TO_INDIVIDUAL: Record<string, string[]> = {
  '1º E 2º ANOS': ['1º Ano', '2º Ano'],
  '2º E 3º ANOS': ['2º Ano', '3º Ano'],
  '3º E 4º ANOS': ['3º Ano', '4º Ano'],
  '4º E 5º ANOS': ['4º Ano', '5º Ano'],
}

// ---- Palette ----
const PALETTE = {
  primary: '1B3A5C',
  primaryLight: '2B579A',
  accent: 'E8A838',
  accentGreen: '2E8B57',
  headerBg: '1B3A5C',
  headerFg: 'FFFFFF',
  border: 'D0D5DD',
  altBorder: 'E8EBF0',
  white: 'FFFFFF',
  lightBg: 'F7F8FA',
}

// UTE colors (vibrant but professional)
const UTE_COLORS = [
  '3B82F6', 'F59E0B', '10B981', 'EF4444', '8B5CF6',
  '06B6D4', 'F97316', 'EC4899', '14B8A6', '84CC16',
  '6366F1', 'D946EF', '0EA5E9', 'FB923C', '22C55E',
  'A855F7', 'E11D48', '2DD4BF', 'FBBF24', '64748B',
]

// Ciclo pastel colors
const CICLO_COLORS: Record<string, string> = {
  '1º Ano': 'DBEAFE',
  '2º Ano': 'DCFCE7',
  '3º Ano': 'FEF3C7',
  '4º Ano': 'EDE9FE',
  '5º Ano': 'FCE7F3',
}

const CICLO_HEADER_COLORS: Record<string, string> = {
  '1º Ano': '3B82F6',
  '2º Ano': '22C55E',
  '3º Ano': 'F59E0B',
  '4º Ano': '8B5CF6',
  '5º Ano': 'EC4899',
}

// ---- Interfaces ----
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

// ---- Helpers ----
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (q && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (ch === ';' && !q) { result.push(cur); cur = '' }
    else cur += ch
  }
  result.push(cur)
  return result.map(s => s.trim())
}

function cleanText(s: string): string {
  return s
    .replace(/\s*\(continuação\)\s*/gi, ' ')
    .replace(/\s*\(continuação\s*$/gmi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\.+/g, '.')
    .trim()
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155
}

function lighten(hex: string, f: number): string {
  const r = Math.round(parseInt(hex.slice(0, 2), 16) + (255 - parseInt(hex.slice(0, 2), 16)) * f)
  const g = Math.round(parseInt(hex.slice(2, 4), 16) + (255 - parseInt(hex.slice(2, 4), 16)) * f)
  const b = Math.round(parseInt(hex.slice(4, 6), 16) + (255 - parseInt(hex.slice(4, 6), 16)) * f)
  return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function sheetName(name: string): string {
  if (name.length <= 31) return name
  return name.substring(0, 28) + '…'
}

// ---- Styles ----
function headerStyle() {
  return {
    fill: { fgColor: { rgb: PALETTE.headerBg } },
    font: { bold: true, color: { rgb: PALETTE.headerFg }, sz: 11, name: 'Segoe UI' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: PALETTE.headerBg } },
      bottom: { style: 'medium', color: { rgb: PALETTE.primaryLight } },
      left: { style: 'thin', color: { rgb: PALETTE.headerBg } },
      right: { style: 'thin', color: { rgb: PALETTE.headerBg } },
    },
  }
}

function dataStyle(bg: string, bold = false, center = false, fg?: string): any {
  return {
    fill: { fgColor: { rgb: bg } },
    font: { sz: 10, name: 'Segoe UI', bold, ...(fg ? { color: { rgb: fg } } : {}) },
    alignment: {
      vertical: 'center',
      wrapText: true,
      horizontal: center ? 'center' : 'left',
    },
    border: {
      top: { style: 'thin', color: { rgb: PALETTE.border } },
      bottom: { style: 'thin', color: { rgb: PALETTE.border } },
      left: { style: 'thin', color: { rgb: PALETTE.border } },
      right: { style: 'thin', color: { rgb: PALETTE.border } },
    },
  }
}

// ---- Main ----
function main() {
  console.log('=== Currículo QSN — Planilha Final ===\n')

  // 1. Read & parse CSV
  const raw = fs.readFileSync(INPUT_CSV, 'utf-8').replace(/^\uFEFF/, '')
  const lines = raw.split('\n').filter(l => l.trim())

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
  console.log(`Lidos: ${flatRecords.length} registros`)

  // 2. Clean text
  let cleaned = 0
  for (const r of flatRecords) {
    const cs = cleanText(r.saber)
    const ca = cleanText(r.apr)
    if (cs !== r.saber) cleaned++
    if (ca !== r.apr) cleaned++
    r.saber = cs
    r.apr = ca
  }
  console.log(`Limpos: ${cleaned} campos com artefatos`)

  // 3. Dedup
  const dedupKeys = new Set<string>()
  const unique = flatRecords.filter(r => {
    const k = `${r.component}|${r.saber}|${r.apr}`
    if (dedupKeys.has(k)) return false
    dedupKeys.add(k)
    return true
  })
  console.log(`Dedup: ${unique.length} registros únicos`)

  // 4. Group by SABER, assign year pairs (modulo 4)
  const saberMap = new Map<string, FlatRecord[]>()
  const saberOrder: string[] = []
  for (const r of unique) {
    const k = `${r.component}|${r.ute}|${r.saber}`
    if (!saberMap.has(k)) {
      saberMap.set(k, [])
      saberOrder.push(k)
    }
    saberMap.get(k)!.push(r)
  }

  // 5. Expand to individual years
  const expanded: ExpandedRecord[] = []
  for (const key of saberOrder) {
    const recs = saberMap.get(key)!
    for (let pos = 0; pos < recs.length; pos++) {
      const pair = YEAR_PAIRS[pos % 4]
      const years = YEAR_PAIR_TO_INDIVIDUAL[pair]
      for (const ciclo of years) {
        expanded.push({
          ComponenteCurricular: recs[pos].component,
          Eixo: recs[pos].eixo,
          UTE: recs[pos].ute,
          SABER: recs[pos].saber,
          APR: recs[pos].apr,
          Ciclo: ciclo,
          ParDeAnos: pair,
        })
      }
    }
  }
  console.log(`Expandidos (c/ anos): ${expanded.length} registros`)

  // 6. Group by component
  const byComp = new Map<string, ExpandedRecord[]>()
  for (const r of expanded) {
    if (!byComp.has(r.ComponenteCurricular)) byComp.set(r.ComponenteCurricular, [])
    byComp.get(r.ComponenteCurricular)!.push(r)
  }
  const compOrder = [...byComp.keys()]

  // 7. Build UTE color maps per component
  const uteColorMaps = new Map<string, Record<string, string>>()
  for (const [comp, recs] of byComp) {
    const map: Record<string, string> = {}
    const utes = [...new Set(recs.map(r => r.UTE))]
    utes.forEach((u, i) => { map[u] = UTE_COLORS[i % UTE_COLORS.length] })
    uteColorMaps.set(comp, map)
  }

  // ========== CREATE WORKBOOK ==========
  const wb = XLSX.utils.book_new()

  const HEADERS = ['ComponenteCurricular', 'Ciclo', 'UTE', 'SABER', 'APR']
  const COL_WIDTHS = [24, 10, 44, 62, 82]

  // ===== INDEX SHEET =====
  {
    // Title section
    const titleRow: any[][] = [
      ['', '', '', ''],
      ['', 'CURRÍCULO QSN', '', ''],
      ['', 'Ensino Fundamental — Quadro de Saberes e Aprendizagens', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
    ]

    const tableHeader = ['Componente Curricular', 'APRs', 'UTEs', 'Abrangência']
    const tableData: any[][] = []
    for (const comp of compOrder) {
      const recs = byComp.get(comp)!
      const utes = new Set(recs.map(r => r.UTE)).size
      const ciclos = [...new Set(recs.map(r => r.Ciclo))].sort().join(', ')
      tableData.push([comp, recs.length, utes, ciclos])
    }

    const totalRow = [`TOTAL`, expanded.length, new Set(expanded.map(r => r.UTE)).size, '']

    const allRows = [...titleRow, tableHeader, ...tableData, [], totalRow]
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    ws['!cols'] = [
      { wch: 5 },   // spacer
      { wch: 40 },  // name
      { wch: 12 },  // APRs
      { wch: 8 },   // UTEs
      { wch: 30 },  // years
    ]

    // Merge title cells
    ws['!merges'] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    ]

    // Title style
    for (let c = 1; c <= 4; c++) {
      const addr1 = XLSX.utils.encode_cell({ r: 1, c })
      const addr2 = XLSX.utils.encode_cell({ r: 2, c })
      if (ws[addr1]) {
        ws[addr1].s = {
          font: { bold: true, sz: 20, color: { rgb: PALETTE.primary }, name: 'Segoe UI' },
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      }
      if (ws[addr2]) {
        ws[addr2].s = {
          font: { sz: 12, color: { rgb: '6B7280' }, name: 'Segoe UI' },
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      }
    }

    // Style table header
    const headerRowIdx = titleRow.length
    for (let c = 1; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c })
      if (ws[addr]) {
        ws[addr].s = {
          fill: { fgColor: { rgb: PALETTE.primary } },
          font: { bold: true, color: { rgb: PALETTE.headerFg }, sz: 10, name: 'Segoe UI' },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: PALETTE.primary } },
            bottom: { style: 'medium', color: { rgb: PALETTE.primary } },
            left: { style: 'medium', color: { rgb: PALETTE.primary } },
            right: { style: 'medium', color: { rgb: PALETTE.primary } },
          },
        }
      }
    }

    // Style table rows
    for (let i = 0; i < compOrder.length; i++) {
      const r = headerRowIdx + 1 + i
      const bg = i % 2 === 0 ? 'F0F4F8' : 'FFFFFF'
      for (let c = 1; c <= 4; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: c === 1 ? (i % 2 === 0 ? 'EBF5FF' : 'F8FAFF') : bg } },
            font: { bold: c <= 2, sz: 10, name: 'Segoe UI' },
            alignment: { vertical: 'center', wrapText: true, horizontal: c === 1 ? 'left' : 'center' },
            border: {
              top: { style: 'thin', color: { rgb: PALETTE.border } },
              bottom: { style: 'thin', color: { rgb: PALETTE.border } },
              left: { style: 'thin', color: { rgb: PALETTE.border } },
              right: { style: 'thin', color: { rgb: PALETTE.border } },
            },
          }
        }
      }
    }

    // Total row style
    const totalRowIdx = headerRowIdx + compOrder.length + 2
    for (let c = 1; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c })
      if (ws[addr]) {
        ws[addr].s = {
          fill: { fgColor: { rgb: PALETTE.primary } },
          font: { bold: true, color: { rgb: PALETTE.headerFg }, sz: 10, name: 'Segoe UI' },
          alignment: { horizontal: c === 1 ? 'left' : 'center', vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: PALETTE.primary } },
            bottom: { style: 'medium', color: { rgb: PALETTE.primary } },
            left: { style: 'medium', color: { rgb: PALETTE.primary } },
            right: { style: 'medium', color: { rgb: PALETTE.primary } },
          },
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Índice')
    console.log('  ✅ Índice')
  }

  // ===== DATA SHEETS =====
  for (const comp of compOrder) {
    const recs = byComp.get(comp)!
    const uteColorMap = uteColorMaps.get(comp)!

    const dataRows = recs.map(r => [r.ComponenteCurricular, r.Ciclo, r.UTE, r.SABER, r.APR])
    const sheetData = [HEADERS, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(sheetData)

    ws['!cols'] = COL_WIDTHS.map(w => ({ wch: w }))
    ws['!freeze'] = { x: 0, y: 1 }

    // Header
    for (let c = 0; c < 5; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[addr]) ws[addr].s = headerStyle()
    }

    // Data rows
    for (let i = 0; i < recs.length; i++) {
      const r = i + 1
      const rec = recs[i]
      const uteColor = uteColorMap[rec.UTE] || '64748B'
      const cicloBg = CICLO_COLORS[rec.Ciclo] || 'F9FAFB'
      const rowBg = lighten(uteColor, 0.88)

      for (let c = 0; c < 5; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) continue

        let bg: string
        let bold = false
        let center = false
        let fg: string | undefined

        if (c === 0) { bg = rowBg; bold = true }
        else if (c === 1) { bg = cicloBg; center = true; bold = true; fg = CICLO_HEADER_COLORS[rec.Ciclo] }
        else if (c === 2) { bg = uteColor; bold = true; fg = isLight(uteColor) ? '1F2937' : 'FFFFFF' }
        else if (c === 3) { bg = rowBg }
        else { bg = lighten(uteColor, 0.93) }

        ws[addr].s = dataStyle(bg, bold, center, fg)
      }
    }

    // Auto-filter
    ws['!autofilter'] = { ref: `A1:E${recs.length + 1}` }

    const sName = sheetName(comp)
    XLSX.utils.book_append_sheet(wb, ws, sName)
    console.log(`  ✅ ${sName} (${recs.length} registros)`)
  }

  // ===== LEGEND SHEET =====
  {
    const legendRows: any[][] = [
      ['', 'LEGENDA', '', '', ''],
      ['', '', '', '', ''],
      ['', 'Cores por Ciclo:', '', '', ''],
      ['', '1º Ano', '', '', ''],
      ['', '2º Ano', '', '', ''],
      ['', '3º Ano', '', '', ''],
      ['', '4º Ano', '', '', ''],
      ['', '5º Ano', '', '', ''],
      ['', '', '', '', ''],
      ['', 'Legenda:', '', '', ''],
      ['', 'Célula colorida = o valor da célula', '', '', ''],
      ['', 'APR = Aprendizagem (o que o educando deve aprender)', '', '', ''],
      ['', 'UTE = Unidade Temática Específica', '', '', ''],
      ['', 'SABER = Objetivo geral do saber', '', '', ''],
    ]

    const ws = XLSX.utils.aoa_to_sheet(legendRows)
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]

    // Title
    for (let c = 1; c <= 4; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true, sz: 16, color: { rgb: PALETTE.primary }, name: 'Segoe UI' },
          alignment: { horizontal: 'center', vertical: 'center' },
        }
      }
    }

    // Ciclo color samples
    const cicloNames = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano']
    for (let i = 0; i < cicloNames.length; i++) {
      const r = 3 + i
      for (let c = 1; c <= 2; c++) {
        const addr1 = XLSX.utils.encode_cell({ r, c: 1 })
        const addr2 = XLSX.utils.encode_cell({ r, c: 2 })
        if (ws[addr1]) {
          ws[addr1].s = {
            fill: { fgColor: { rgb: CICLO_COLORS[cicloNames[i]] } },
            font: { bold: true, sz: 10, name: 'Segoe UI', color: { rgb: CICLO_HEADER_COLORS[cicloNames[i]] } },
            alignment: { vertical: 'center' },
            border: { top: { style: 'thin', color: { rgb: PALETTE.border } }, bottom: { style: 'thin', color: { rgb: PALETTE.border } }, left: { style: 'thin', color: { rgb: PALETTE.border } }, right: { style: 'thin', color: { rgb: PALETTE.border } } },
          }
        }
        if (ws[addr2] && c === 2) {
          ws[addr2].s = {
            font: { sz: 10, name: 'Segoe UI' },
            alignment: { vertical: 'center' },
          }
        }
      }
    }

    // Info text
    for (let i = 0; i < 4; i++) {
      const r = 10 + i
      const addr = XLSX.utils.encode_cell({ r, c: 1 })
      if (ws[addr]) {
        ws[addr].s = {
          font: { sz: 10, name: 'Segoe UI', color: { rgb: '4B5563' } },
          alignment: { vertical: 'center' },
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Legenda')
    console.log('  ✅ Legenda')
  }

  // Save
  XLSX.writeFile(wb, OUTPUT_FILE)
  console.log(`\n📄 Salvo: ${OUTPUT_FILE}`)
  console.log(`   ${expanded.length} registros · ${compOrder.length} disciplinas · ${wb.Sheets.length} abas`)
}

main()
