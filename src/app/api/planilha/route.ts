import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { PlanilhaRequestSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = PlanilhaRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Arquivo não enviado' }, { status: 400 })
    }

    const { fileBase64, fileName } = body
    const buf = Buffer.from(fileBase64, 'base64')
    console.log('API planilha: recebido', fileName, buf.length, 'bytes')

    const wb = XLSX.read(fileBase64, { type: 'base64' })
    console.log('API planilha: sheets:', wb.SheetNames)

    const names = new Set<string>()

    for (const sheetName of wb.SheetNames) {
      const data: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 })
      console.log(`API planilha: sheet "${sheetName}" ${data.length} linhas`)
      for (let i = 9; i < data.length; i++) {
        const row = data[i]
        const name = row?.[2]
        if (typeof name !== 'string') {
          if (row) console.log(`  linha ${i}: sem nome na coluna 2, cols: ${Object.keys(row).length}`)
          continue
        }
        const trimmed = name.trim()
        if (!trimmed || trimmed.length < 8) continue
        if (/^(Legenda|Assinaturas?|Data|Total|N[º°]|Educando|Acompanhamento|Escola|Secretaria)/i.test(trimmed)) continue
        if (/^\d/.test(trimmed)) continue
        names.add(trimmed)
      }
    }

    console.log('API planilha: nomes encontrados:', names.size)

    if (names.size === 0) {
      return NextResponse.json({ error: 'Nenhum nome encontrado' }, { status: 400 })
    }

    return NextResponse.json({ names: Array.from(names) })
  } catch (err) {
    console.error('API planilha: erro', err)
    return NextResponse.json({ error: 'Erro ao processar planilha: ' + (err instanceof Error ? err.message : 'erro') }, { status: 500 })
  }
}
