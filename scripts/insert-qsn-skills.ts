/**
 * Insere as habilidades QSN no Supabase.
 * Uso: npx tsx scripts/insert-qsn-skills.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) process.env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found')
  process.exit(1)
}

const sql = fs.readFileSync(path.resolve(__dirname, '..', 'supabase', 'seed_qsn_skills.sql'), 'utf-8')

// Parse skill entries from SQL
const skills: any[] = []
const linePattern = /^\s*\((?:"([^"]*)"|'([^']*)'),\s*(?:"([^"]*)"|'([^']*)'),\s*(?:"([^"]*)"|'([^']*)'),\s*(?:"([^"]*)"|'([^']*)'),\s*(?:"([^"]*)"|'([^']*)'),\s*(?:"([^"]*)"|'([^']*)')\s*\)/gm
let match

// Simpler approach: split by lines and parse
const lines = sql.split('\n')
let inValues = false

for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed.startsWith('INSERT INTO')) {
    inValues = true
    continue
  }
  if (!inValues) continue
  if (trimmed === ';' || trimmed.startsWith('ON CONFLICT') || trimmed.startsWith('--')) continue
  if (!trimmed.startsWith('(')) continue

  // Parse: ('code', 'description', 'component', 'grade', 'axis', 'source')
  const parts = trimmed.replace(/^\s*\(/, '').replace(/\),?$/, '').split("', '")
  if (parts.length < 6) continue

  const code = parts[0].replace(/^'/, '')
  const description = parts[1]
  const component = parts[2]
  const grade = parts[3]
  const axis = parts[4]
  const source = parts[5].replace(/'$/, '')

  skills.push({ code, description, component, grade, axis, source })
}

console.log(`📊 Parsed ${skills.length} skills from SQL`)

if (skills.length === 0) {
  console.log('❌ No skills to insert')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Delete existing QSN skills
  console.log('🔄 Deleting existing QSN skills...')
  const { error: delError, count } = await supabase
    .from('curriculum_skills')
    .delete({ count: 'exact' })
    .eq('source', 'qsn')

  if (delError) {
    console.error('❌ Delete error:', delError.message)
    process.exit(1)
  }
  console.log(`   Deleted ${count} existing skills`)

  // Insert in batches
  const BATCH_SIZE = 100
  console.log(`🔄 Inserting ${skills.length} skills in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < skills.length; i += BATCH_SIZE) {
    const batch = skills.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('curriculum_skills')
      .upsert(batch, { onConflict: 'code', ignoreDuplicates: false })

    if (error) {
      console.error(`   ❌ Batch ${i / BATCH_SIZE + 1}:`, error.message)
      process.exit(1)
    }
    process.stdout.write(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(skills.length / BATCH_SIZE)}\r`)
  }

  console.log('\n🎉 All skills inserted successfully!')

  // Verify
  const { count: total, error: countError } = await supabase
    .from('curriculum_skills')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'qsn')

  if (countError) {
    console.log(`   Count error: ${countError.message}`)
  } else {
    console.log(`📊 Total QSN skills in database: ${total}`)
  }
}

main().catch(console.error)
