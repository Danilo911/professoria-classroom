/**
 * Extrai habilidades curriculares dos PDFs do QSN (Guarulhos) usando Gemini Flash.
 *
 * Uso: npx tsx scripts/extract-qsn.ts
 *
 * PDFs esperados na pasta RAIZ do projeto (gerenciamento de sala/):
 *   - Educação Infantil_digital.pdf
 *   - Ensino Fundamental_digital.pdf
 *   - EJA_digital.pdf
 *   - Introdutório_digital.pdf
 *
 * Para continuar de onde parou em caso de erro: basta rodar de novo.
 * O script salva progresso incrementalmente em supabase/seed_qsn_skills.sql
 */

import * as fs from 'fs'
import * as path from 'path'
import { GoogleGenAI } from '@google/genai'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// ===== CONFIG =====
const CHUNK_SIZE = 16000      // caracteres por chamada (maior = menos chamadas)
const DELAY_MS = 2000          // delay entre chunks
const MAX_RETRIES = 5          // tentativas por chunk em caso de 429

const PDF_DIR = path.resolve(__dirname, '..', '..')
const PROGRESS_FILE = path.resolve(__dirname, '..', 'supabase', 'seed_qsn_skills.sql')

const PDF_FILES = [
  'Educação Infantil_digital.pdf',
  'Ensino Fundamental_digital.pdf',
  'EJA_digital.pdf',
  'Introdutório_digital.pdf',
]

// ===== LOAD .ENV.LOCAL =====
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ===== HELPERS =====

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function splitChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    let end = start + maxChars
    if (end < text.length) {
      const bp = text.lastIndexOf('\n\n', end)
      end = (bp > start + maxChars / 2) ? bp : (text.lastIndexOf('\n', end) > start + maxChars / 2 ? text.lastIndexOf('\n', end) : end)
    }
    chunks.push(text.slice(start, end))
    start = end
  }
  return chunks
}

async function callWithRetry(ai: GoogleGenAI, prompt: string): Promise<any[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })

      const raw = response.text || '[]'
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const data = JSON.parse(cleaned)

      if (!Array.isArray(data)) {
        console.log(`   ⚠️  Resposta não é array, ignorando`)
        return []
      }
      return data
    } catch (err: any) {
      const msg = err?.message || String(err)
      // Tenta extrair tempo de espera do erro 429
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        const waitMatch = msg.match(/(\d+(?:\.\d+)?)\s*s/i)
        const waitSec = waitMatch ? parseFloat(waitMatch[1]) + 1 : attempt * 10
        console.log(`   ⏳ Quota excedida — aguardando ${waitSec.toFixed(0)}s (tentativa ${attempt}/${MAX_RETRIES})...`)
        await sleep(waitSec * 1000)
        continue
      }
      // Erro diferente — relança
      throw err
    }
  }
  console.log(`   ⚠️  Máximo de tentativas excedido — pulando este trecho`)
  return []
}

// ===== MAIN =====

async function main() {
  console.log('=== Extrator de Habilidades QSN/BNCC ===\n')

  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY não encontrada no .env.local')
    console.log('   Adicione: GEMINI_API_KEY=sua-chave-do-google-ai-studio')
    process.exit(1)
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  const allSkills: any[] = []

  const { PDFParse } = require('pdf-parse')

  for (const pdfFile of PDF_FILES) {
    const pdfPath = path.join(PDF_DIR, pdfFile)
    if (!fs.existsSync(pdfPath)) {
      console.log(`⚠️  Arquivo não encontrado: ${pdfFile} (pulando)`)
      continue
    }

    console.log(`\n📄 ${pdfFile}`)

    const pdfBuffer = fs.readFileSync(pdfPath)
    const doc = new PDFParse({ data: pdfBuffer })
    const result = await doc.getText()
    const text = result.pages.map((p: any) => p.text).join('\n\n')
    console.log(`   ${text.length} caracteres`)

    let grade = 'Geral'
    let source = 'qsn'
    if (pdfFile.includes('Infantil')) grade = 'Educação Infantil'
    else if (pdfFile.includes('Fundamental')) grade = 'Ensino Fundamental'
    else if (pdfFile.includes('EJA')) grade = 'EJA'
    else if (pdfFile.includes('Introdutório')) { grade = 'Introdutório'; source = 'bncc' }

    const chunks = splitChunks(text, CHUNK_SIZE)
    console.log(`   ${chunks.length} partes`)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      process.stdout.write(`   [${i + 1}/${chunks.length}] Analisando...`)

      const prompt = `Você é um especialista em currículo educacional brasileiro (BNCC).

Analise o texto curricular abaixo e extraia TODAS as habilidades/objetivos de aprendizagem.

Retorne APENAS um array JSON. Cada objeto deve ter:
- "code": código da habilidade (ex: EF01LP01, EI02EO01). Se não houver código, gere um único baseado no componente e ano.
- "description": descrição completa
- "component": componente curricular (Língua Portuguesa, Matemática, Ciências, Arte, Educação Física, História, Geografia, Ensino Religioso, Inglês)
- "grade": "${grade}"
- "axis": eixo/unidade temática (ex: Oralidade, Números). Vazio se não houver.
- "source": "${source}"

FORMATO EXATO:
[{"code":"...","description":"...","component":"...","grade":"${grade}","axis":"...","source":"${source}"}]

Se não encontrar nenhuma habilidade, retorne [].

--- TEXTO ---
${chunk}`

      const skills = await callWithRetry(ai, prompt)
      allSkills.push(...skills)
      console.log(` ${skills.length} habilidades`)

      // Salva progresso parcial a cada PDF
      if (i < chunks.length - 1) await sleep(DELAY_MS)
    }

    // Salva progresso após cada PDF completo
    saveSql(allSkills)
  }

  // ===== FINAL =====
  console.log(`\n📊 Total bruto: ${allSkills.length}`)

  if (allSkills.length === 0) {
    console.log('❌ Nenhuma habilidade extraída.')
    process.exit(1)
  }

  // Deduplica
  const seen = new Set<string>()
  const unique = allSkills.filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true })
  console.log(`📊 Únicas: ${unique.length}`)

  // Preview
  console.log('\n📋 Preview:')
  unique.slice(0, 5).forEach((s, i) => console.log(`   ${i + 1}. [${s.code}] ${(s.description || '').slice(0, 80)}...`))

  // Gera SQL final
  saveSql(unique)

  console.log(`\n📄 SQL salvo em: ${PROGRESS_FILE}`)

  // --insert
  if (process.argv.includes('--insert')) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local')
      process.exit(1)
    }
    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log('\n🔄 Inserindo no Supabase...')
    for (let i = 0; i < unique.length; i += 50) {
      const batch = unique.slice(i, i + 50)
      const { error } = await supabase.from('curriculum_skills').upsert(
        batch.map(s => ({ code: s.code, description: s.description, component: s.component, grade: s.grade, axis: s.axis || null, source: s.source })),
        { onConflict: 'code' }
      )
      if (error) console.error(`   ❌ Lote ${i / 50 + 1}:`, error.message)
      else console.log(`   ✅ Lote ${i / 50 + 1}/${Math.ceil(unique.length / 50)}`)
      await sleep(500)
    }
    console.log('🎉 Concluído!')
  }
}

function saveSql(skills: any[]) {
  const seen = new Set<string>()
  const unique = skills.filter(s => { if (seen.has(s.code)) return false; seen.add(s.code); return true })

  const lines = unique.map(s => {
    const esc = (v: string) => (v || '').replace(/'/g, "''")
    return `  ('${esc(s.code)}', '${esc(s.description)}', '${esc(s.component)}', '${esc(s.grade)}', '${esc(s.axis)}', '${esc(s.source)}')`
  })

  const sql = `-- Habilidades QSN/BNCC — Gerado: ${new Date().toISOString()}\n-- Total: ${unique.length}\n\nDELETE FROM curriculum_skills WHERE source = 'qsn';\n\nINSERT INTO curriculum_skills (code, description, component, grade, axis, source) VALUES\n${lines.join(',\n')}\nON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, component = EXCLUDED.component, grade = EXCLUDED.grade, axis = EXCLUDED.axis, source = EXCLUDED.source;\n`

  fs.writeFileSync(PROGRESS_FILE, sql)
}

main().catch(console.error)
