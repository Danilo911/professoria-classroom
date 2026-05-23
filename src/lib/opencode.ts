// OpenCode Zen — provedor OpenAI-compatível
// Endpoint: https://opencode.ai/zen/v1/chat/completions
// Modelo gratuito: deepseek-v4-flash-free

const OPENCODE_ZEN_URL = 'https://opencode.ai/zen/v1/chat/completions'
const OPENCODE_ZEN_MODEL = 'deepseek-v4-flash-free'

export async function generateWithOpenCode(prompt: string): Promise<string> {
  const key = process.env.OPENCODE_ZEN_API_KEY
  if (!key) throw new Error('OPENCODE_ZEN_API_KEY não configurada')

  const systemMsg = prompt.split('\n\nContexto:')[0]
  const userMsg = 'Contexto:' + prompt.split('\n\nContexto:')[1] || prompt

  const res = await fetch(OPENCODE_ZEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENCODE_ZEN_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenCode Zen error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
