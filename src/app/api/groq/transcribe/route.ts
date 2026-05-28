import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 })
    }

    const fd = new FormData()
    fd.append('file', audio, 'recording.webm')
    fd.append('model', 'whisper-large-v3-turbo')
    fd.append('language', 'pt')
    fd.append('response_format', 'json')
    fd.append('temperature', '0')

    let res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: fd,
    })

    if (!res.ok) {
      fd.set('model', 'whisper-large-v3')
      res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: fd,
      })
    }

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Groq transcription error (${res.status}): ${err}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error('Groq transcribe error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao transcrever áudio' },
      { status: 500 }
    )
  }
}
