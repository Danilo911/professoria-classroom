import { NextRequest, NextResponse } from 'next/server'
import { analyzeGier, type GeminiGierRequest } from '@/lib/gemini'
import { GeminiGierRequestSchema } from '@/lib/validation'

// Simple in-memory rate limiter for public endpoint
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 7 * 24 * 60 * 60 * 1000 // 1 week in ms
const RATE_LIMIT_MAX = 5 // 5 requests per week per IP

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || '127.0.0.1'
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = getClientIp(request)
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (entry && now < entry.resetAt) {
      if (entry.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000 / 60)
        return NextResponse.json(
          { error: `Limite semanal atingido (${RATE_LIMIT_MAX} consultas). Tente novamente em ${retryAfter} minutos.` },
          { status: 429, headers: { 'Retry-After': String(retryAfter * 60) } }
        )
      }
      entry.count++
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    }

    const body = await request.json()

    // Validate input
    const parsed = GeminiGierRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Dados invalidos' }, { status: 400 })
    }

    const result = await analyzeGier(body as GeminiGierRequest)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Public GIER error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao analisar atividade' },
      { status: 500 }
    )
  }
}
