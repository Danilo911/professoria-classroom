/**
 * Exporta as habilidades QSN para PDF, DOC e Excel na pasta Downloads.
 * Uso: node scripts/export-qsn.js
 */
const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')

const DOWNLOADS = path.join(require('os').homedir(), 'Downloads')
const SQL_FILE = path.join(__dirname, '..', 'supabase', 'seed_qsn_skills.sql')

// ===== Parse skills from SQL =====
function parseSkills(sql) {
  const skills = []
  const lines = sql.split('\n')
  let inValues = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('INSERT INTO')) { inValues = true; continue }
    if (!inValues || !trimmed.startsWith('(')) continue
    if (trimmed === ';' || trimmed.startsWith('ON CONFLICT')) continue

    const parts = trimmed.replace(/^\s*\(/, '').replace(/\),?$/, '').split("', '")
    if (parts.length < 6) continue

    skills.push({
      code: parts[0].replace(/^'/, ''),
      description: parts[1],
      component: parts[2],
      grade: parts[3],
      axis: parts[4],
      source: parts[5].replace(/'$/, ''),
    })
  }
  return skills
}

// ===== EXCEL (.xls) =====
function generateExcel(skills) {
  const esc = v => (v || '').replace(/"/g, '""')
  const bom = '\uFEFF'
  const header = 'Código;Componente;Grade;Eixo;Descrição;Fonte'
  const rows = skills.map(s =>
    `"${esc(s.code)}";"${esc(s.component)}";"${esc(s.grade)}";"${esc(s.axis)}";"${esc(s.description)}";"${esc(s.source)}"`
  )
  return bom + header + '\n' + rows.join('\n')
}

// ===== DOC (.doc como HTML) =====
function generateDoc(skills) {
  const rows = skills.map(s => `
    <tr>
      <td>${s.code}</td>
      <td>${s.component}</td>
      <td>${s.grade}</td>
      <td>${s.axis || '-'}</td>
      <td>${s.description}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Habilidades QSN</title>
<style>
body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; margin: 20px; }
h1 { font-size: 16pt; color: #1a1a2e; }
table { border-collapse: collapse; width: 100%; margin-top: 10px; }
th { background: #1a1a2e; color: #fff; padding: 6px 8px; text-align: left; font-size: 9pt; }
td { border: 1px solid #ccc; padding: 4px 8px; vertical-align: top; font-size: 9pt; }
tr:nth-child(even) { background: #f6f6f6; }
</style></head>
<body>
<h1>Habilidades QSN — Quadro de Saberes Necessários de Guarulhos</h1>
<p>Total: ${skills.length} habilidades</p>
<table>
<tr><th>Código</th><th>Componente</th><th>Grade</th><th>Eixo</th><th>Descrição</th></tr>
${rows}
</table>
<p style="margin-top:20px;font-size:8pt;color:#999;text-align:center;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
</body></html>`
}

// ===== PDF =====
function generatePdf(skills, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' })
    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)

    // Title
    doc.fontSize(14).font('Helvetica-Bold').text('Habilidades QSN — Guarulhos', { align: 'center' })
    doc.fontSize(9).font('Helvetica').text(`Total: ${skills.length} habilidades`, { align: 'center' })
    doc.moveDown(0.5)

    const totalW = 750
    const marginLeft = 30
    const cols = [
      { label: 'Código', w: 65 },
      { label: 'Componente', w: 90 },
      { label: 'Grade', w: 65 },
      { label: 'Eixo', w: 75 },
      { label: 'Descrição', w: 385 },
      { label: 'Fonte', w: 30 },
    ]
    const colX = []
    let cx = marginLeft
    for (const c of cols) { colX.push(cx); cx += c.w }

    function drawHeader(y) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#fff')
      doc.rect(marginLeft, y, totalW, 14).fill('#1a1a2e')
      for (let i = 0; i < cols.length; i++) {
        doc.fillColor('#fff').text(cols[i].label, colX[i] + 2, y + 3, { width: cols[i].w - 2 })
      }
      return y + 14
    }

    function drawRow(s, y) {
      const vals = [s.code, s.component, s.grade, s.axis || '-', s.description, s.source]
      const fontSize = 5.5

      // Calculate row height based on longest text
      let maxLines = 1
      for (let i = 0; i < vals.length; i++) {
        const textW = doc.fontSize(fontSize).font('Helvetica').widthOfString(vals[i])
        const lines = Math.max(1, Math.ceil(textW / cols[i].w))
        maxLines = Math.max(maxLines, lines)
      }
      const rowH = Math.max(10, maxLines * 7 + 3)

      if (y + rowH > 575) {
        doc.addPage()
        y = 30
        y = drawHeader(y)
      }

      const bg = skills.indexOf(s) % 2 === 0 ? '#ffffff' : '#f3f3f3'
      doc.rect(marginLeft, y, totalW, rowH).fill(bg)
      doc.fillColor('#000').fontSize(fontSize).font('Helvetica')
      for (let i = 0; i < cols.length; i++) {
        doc.text(vals[i], colX[i] + 2, y + 2, { width: cols[i].w - 2 })
      }
      return y + rowH
    }

    let yy = drawHeader(doc.y)
    for (const s of skills) {
      yy = drawRow(s, yy)
    }

    doc.end()
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

// ===== MAIN =====
async function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf-8')
  const skills = parseSkills(sql)

  console.log(`📊 ${skills.length} habilidades`)

  const paths = {
    xls: path.join(DOWNLOADS, 'qsn_habilidades.xls'),
    doc: path.join(DOWNLOADS, 'qsn_habilidades.doc'),
    pdf: path.join(DOWNLOADS, 'qsn_habilidades.pdf'),
  }

  for (const p of Object.values(paths)) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {}
  }

  fs.writeFileSync(paths.xls, generateExcel(skills), 'utf-8')
  console.log(`✅ Excel: ${paths.xls}`)

  fs.writeFileSync(paths.doc, generateDoc(skills), 'utf-8')
  console.log(`✅ DOC:   ${paths.doc}`)

  await generatePdf(skills, paths.pdf)
  console.log(`✅ PDF:   ${paths.pdf}`)
}

main().catch(console.error)
