import { NextRequest, NextResponse } from 'next/server'
import { analyzeGier, type GeminiGierRequest } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body: GeminiGierRequest = await request.json()

    if (!body.imageBase64 && !body.textDescription) {
      return NextResponse.json({ error: 'Imagem ou texto é obrigatório' }, { status: 400 })
    }

    const result = await analyzeGier(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Public GIER error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao analisar atividade' },
      { status: 500 }
    )
  }
}
