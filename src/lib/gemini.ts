import { GoogleGenAI } from '@google/genai'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'

export interface GeminiReportRequest {
  type: 'descriptive_report' | 'class_council' | 'parent_meeting' | 'pedagogical_suggestion'
  studentName?: string
  className?: string
  period?: string
  observations?: string
  qsnSkills?: { code: string; description: string; component: string; axis?: string; grade: string }[]
}

export interface GeminiGierRequest {
  imageBase64?: string
  mimeType?: string
  textDescription?: string
  qsnSkills?: { code: string; description: string; component: string; axis?: string; grade: string }[]
}

export interface GeminiGierResponse {
  extractedText: string
  component: string
  skill: string
  description: string
}

const SYSTEM_PROMPTS = {
  descriptive_report: `Você é um assistente pedagógico especializado na rede municipal de Guarulhos-SP. Gere um parecer descritivo individual profissional e empático, em português do Brasil. O texto deve:
- Descrever o desenvolvimento do aluno de forma construtiva
- Referenciar habilidades do QSN (Quadro de Saberes Necessários de Guarulhos) quando relevante
- NÃO utilizar códigos de habilidades — o QSN trabalha apenas com descrições textuais
- NÃO citar habilidades de Libras/Língua de Sinais (são de competência do professor especialista de inclusão)
- Incluir pontos fortes e áreas que precisam de atenção
- Ter entre 3-5 parágrafos
- Usar linguagem acessível para pais e responsáveis`,

  class_council: `Você é um assistente pedagógico especializado. Gere uma análise de conselho de classe para uma turma, em português do Brasil. Inclua:
- Visão geral do desempenho da turma
- Pontos fortes coletivos
- Desafios identificados
- Sugestões de intervenções pedagógicas
- Dados que podem ser apresentados em reunião`,

  parent_meeting: `Você é um assistente pedagógico. Gere um roteiro para reunião de pais, em português do Brasil. Inclua:
- Abertura acolhedora
- Pontos positivos do aluno
- Aspectos que precisam de atenção
- Sugestões de como os pais podem ajudar em casa
- Encerramento motivador`,

  pedagogical_suggestion: `Você é um assistente pedagógico especializado em BNCC. Gere sugestões pedagógicas, em português do Brasil. Inclua:
- Atividades práticas e envolventes
- Habilidades da BNCC trabalhadas
- Materiais necessários
- Adaptações para alunos com necessidades especiais
- Critérios de avaliação`,
}

function buildReportPrompt(request: GeminiReportRequest): string {
  const systemPrompt = SYSTEM_PROMPTS[request.type]

  let qsnSection = ''
  if (request.qsnSkills && request.qsnSkills.length > 0) {
    const skillsByComponent: Record<string, { description: string; axis?: string }[]> = {}
    for (const skill of request.qsnSkills) {
      if (!skillsByComponent[skill.component]) skillsByComponent[skill.component] = []
      skillsByComponent[skill.component].push({ description: skill.description, axis: skill.axis })
    }
    const lines: string[] = ['Habilidades do QSN (Quadro de Saberes Necessários de Guarulhos) aplicáveis a esta turma:']
    for (const [component, skills] of Object.entries(skillsByComponent)) {
      const examples = skills.slice(0, 10).map(s =>
        `  - ${s.axis ? `[${s.axis}] ` : ''}${s.description.substring(0, 150)}`
      ).join('\n')
      lines.push(`\n${component} (${skills.length} habilidades):\n${examples}`)
    }
    lines.push('\nIMPORTANTE: O QSN não utiliza códigos de habilidades. Ao citar uma habilidade no relatório, use apenas a descrição textual, sem códigos alfanuméricos.')
    qsnSection = '\n\n' + lines.join('\n')
  }

  const context = `
Contexto:
- Tipo de relatório: ${request.type}
${request.studentName ? `- Aluno: ${request.studentName}` : ''}
${request.className ? `- Turma: ${request.className}` : ''}
${request.period ? `- Período: ${request.period}` : ''}
${request.observations ? `- Observações adicionais: ${request.observations}` : ''}${qsnSection}

Gere o relatório solicitado seguindo as diretrizes acima.`

  return `${systemPrompt}\n\n${context}`
}

// ==================== GEMINI ====================

async function generateWithGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY não configurada')

  const ai = new GoogleGenAI({ apiKey: key })
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  })
  return response.text || ''
}

// ==================== GROQ ====================

async function generateWithGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY não configurada')

  const systemMsg = prompt.split('\n\nContexto:')[0]
  const userMsg = 'Contexto:' + prompt.split('\n\nContexto:')[1] || prompt

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ==================== REPORT (Gemini → Groq fallback) ====================

export async function generateReport(request: GeminiReportRequest): Promise<{ content: string; provider: string }> {
  const prompt = buildReportPrompt(request)

  let lastError: Error | null = null

  // Tenta Gemini primeiro
  if (process.env.GEMINI_API_KEY) {
    try {
      const text = await generateWithGemini(prompt)
      if (text) return { content: text, provider: 'gemini' }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('Gemini falhou, tentando Groq:', lastError.message)
    }
  }

  // Fallback para Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const text = await generateWithGroq(prompt)
      if (text) return { content: text, provider: 'groq' }
    } catch (err) {
      throw err
    }
  }

  if (lastError) throw lastError
  throw new Error('Nenhuma chave de API configurada (GEMINI_API_KEY ou GROQ_API_KEY)')
}

async function analisarComGroqGier(request: GeminiGierRequest): Promise<GeminiGierResponse> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY não configurada')

  let prompt = 'Analise esta atividade escolar aplicada para a turma toda. Identifique: 1) O texto completo da atividade (extraia da imagem se houver), 2) O componente curricular, 3) A habilidade do QSN (Quadro de Saberes Necessários de Guarulhos) correspondente (apenas a descrição, SEM códigos), 4) Uma descrição pedagógica geral para o GIER (Registro de Itinerário Educacional e de Resultados) relatando o que foi trabalhado coletivamente com a turma. Responda em JSON com as chaves: extractedText, component, skill, description. Responda APENAS o JSON, sem markdown ou texto adicional.'

  if (request.qsnSkills && request.qsnSkills.length > 0) {
    const skillsText = request.qsnSkills.slice(0, 30).map(s => `• ${s.component}: ${s.description.slice(0, 120)}`).join('\n')
    prompt += `\n\nHabilidades do QSN disponíveis para esta turma (escolha a mais adequada e use apenas a descrição, sem o código):\n${skillsText}`
  }

  let messages: any[]

  if (request.imageBase64 && request.mimeType) {
    const desc = request.textDescription ? `\n\nDescrição fornecida pelo professor: ${request.textDescription}` : ''
    const isPdf = request.mimeType === 'application/pdf'
    const mimeMap: Record<string, string> = { 'image/jpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp', 'image/gif': 'image/gif', 'application/pdf': 'application/pdf' }
    const mime = mimeMap[request.mimeType] || 'image/jpeg'

    if (isPdf) {
      messages = [{ role: 'user', content: `${prompt}${desc}\n\nO arquivo enviado é um PDF em base64.` }]
    } else {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: `${prompt}${desc}` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${request.imageBase64}` } },
        ],
      }]
    }
  } else if (request.textDescription) {
    messages = [{ role: 'user', content: `${prompt}\n\nAtividade: ${request.textDescription}` }]
  } else {
    throw new Error('Nenhuma imagem ou texto fornecido')
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.imageBase64 && request.mimeType !== 'application/pdf' ? GROQ_VISION_MODEL : GROQ_MODEL,
      messages,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || '{}'
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      extractedText: parsed.extractedText || '',
      component: parsed.component || '',
      skill: parsed.skill || '',
      description: parsed.description || '',
    }
  } catch {
    return {
      extractedText: text,
      component: 'Não identificado',
      skill: 'Não identificada',
      description: text,
    }
  }
}

function parseGierResponse(text: string): GeminiGierResponse {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return {
      extractedText: parsed.extractedText || '',
      component: parsed.component || '',
      skill: parsed.skill || '',
      description: parsed.description || '',
    }
  } catch {
    return {
      extractedText: text,
      component: 'Não identificado',
      skill: 'Não identificada',
      description: text,
    }
  }
}

export async function analyzeGier(request: GeminiGierRequest): Promise<GeminiGierResponse> {
  let lastError: Error | null = null

  let qsnContext = ''
  if (request.qsnSkills && request.qsnSkills.length > 0) {
    const skillsText = request.qsnSkills.slice(0, 30).map(s => `• ${s.component}: ${s.description.slice(0, 120)}`).join('\n')
    qsnContext = `\n\nHabilidades do QSN disponíveis para esta turma (escolha a mais adequada e use apenas a descrição, sem o código):\n${skillsText}`
  }

  // Tenta Gemini primeiro
  if (process.env.GEMINI_API_KEY) {
    try {
      let contents: string | Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = ''

      if (request.imageBase64 && request.mimeType) {
        const desc = request.textDescription ? `\n\nDescrição fornecida pelo professor: ${request.textDescription}` : ''
        contents = [
          { text: `Analise esta atividade escolar aplicada para a turma toda. Identifique: 1) O texto completo da atividade, 2) O componente curricular, 3) A habilidade do QSN (Quadro de Saberes Necessários de Guarulhos) correspondente (apenas a descrição, SEM códigos), 4) Uma descrição pedagógica geral para o GIER (Registro de Itinerário Educacional e de Resultados) relatando o que foi trabalhado coletivamente com a turma. Responda em JSON com as chaves: extractedText, component, skill, description. Responda APENAS o JSON, sem markdown ou texto adicional.${qsnContext}${desc}` },
          { inlineData: { data: request.imageBase64, mimeType: request.mimeType } },
        ]
      } else if (request.textDescription) {
        contents = `Analise esta descrição de atividade escolar aplicada para a turma toda. Identifique: 1) O componente curricular, 2) A habilidade do QSN (Quadro de Saberes Necessários de Guarulhos) correspondente (apenas a descrição, SEM códigos), 3) Uma descrição pedagógica geral para o GIER (Registro de Itinerário Educacional e de Resultados) relatando o que foi trabalhado coletivamente com a turma. Responda em JSON com as chaves: extractedText, component, skill, description. Responda APENAS o JSON, sem markdown ou texto adicional.${qsnContext}\n\nAtividade: ${request.textDescription}`
      } else {
        throw new Error('Nenhuma imagem ou texto fornecido')
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
      })

      return parseGierResponse(response.text || '{}')
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('Gemini GIER falhou, tentando Groq:', lastError.message)
    }
  }

  // Fallback para Groq
  if (process.env.GROQ_API_KEY) {
    try {
      return await analisarComGroqGier(request)
    } catch (err) {
      throw err
    }
  }

  if (lastError) throw lastError
  throw new Error('Nenhuma chave de API configurada (GEMINI_API_KEY ou GROQ_API_KEY)')
}
