// OpenCode Go — provedor OpenAI-compatível
// Endpoint: https://opencode.ai/zen/go/v1/chat/completions
// Modelo: qwen3.5-plus

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_GO_MODEL = 'qwen3.5-plus'

export async function generateWithOpenCode(prompt: string): Promise<string> {
  const key = process.env.OPENCODE_GO_API_KEY
  if (!key) throw new Error('OPENCODE_GO_API_KEY não configurada')

  const systemMsg = prompt.split('\n\nContexto:')[0]
  const userMsg = 'Contexto:' + (prompt.split('\n\nContexto:')[1] || prompt)

  const res = await fetch(OPENCODE_GO_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENCODE_GO_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenCode Go error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
