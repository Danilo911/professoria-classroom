import { GoogleGenAI } from '@google/genai'
import { generateWithOpenCode } from './opencode'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GROQ_QWEN_MODEL = 'qwen/qwen3-32b'
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'

export interface GeminiReportRequest {
  type: 'descriptive_report' | 'class_council' | 'parent_meeting' | 'pedagogical_suggestion' | 'referral'
  studentName?: string
  className?: string
  period?: string
  observations?: string
  referralType?: string
  qsnSkills?: { code: string; description: string; component: string; axis?: string; grade: string }[]
  preferredProvider?: 'opencode' | 'groq' | 'gemini'
}

export interface GeminiGierRequest {
  imageBase64?: string
  mimeType?: string
  textDescription?: string
}

export interface GeminiGierResponse {
  extractedText: string
  component: string
  ute: string
  saber: string
  apr: string
  description: string
}

const SYSTEM_PROMPTS = {
  descriptive_report: `Você é um assistente pedagógico especializado na rede municipal de Guarulhos-SP. Seu papel é redigir um parecer descritivo individual do aluno, em português do Brasil, com tom extremamente profissional, empático, construtivo e formal.
Siga rigorosamente as seguintes diretrizes:

1. FOCO NO DESENVOLVIMENTO INTEGRAL:
   - Descrever o percurso de aprendizagem do aluno de forma construtiva e humanizada, destacando suas conquistas cognitivas, sociais, afetivas e motoras.
   - Apresentar as dificuldades observadas não como rótulos ou falhas, mas de forma construtiva como "áreas em processo de consolidação", "desafios que requerem maior acompanhamento" ou "oportunidades de desenvolvimento".
   - Identificar e valorizar as potencialidades, interesses e pontos fortes do aluno (ex: boa participação oral, criatividade, solidariedade com os colegas).

2. USO DO QSN (Quadro de Saberes Necessários de Guarulhos):
   - Referenciar habilidades ou objetivos do QSN contextualmente no texto para evidenciar o progresso acadêmico.
   - REGRA CRÍTICA: O QSN não trabalha com códigos alfanuméricos. NUNCA cite códigos de habilidades (ex: EF12LP01). Descreva a habilidade de forma textual e fluida no corpo do parecer.
   - NUNCA cite habilidades exclusivas de Libras ou Língua de Sinais, pois são de competência de especialistas, exceto se houver indicação específica e contextual do aluno.

3. ESTRUTURA DO TEXTO (3 a 5 parágrafos):
   - Parágrafo 1 (Aspectos Socioemocionais e Convivência): Descrever o perfil de relacionamento do aluno com os colegas e professores, participação em sala, autonomia e engajamento social.
   - Parágrafo 2 (Desenvolvimento Linguístico e Linguagem): Detalhar os progressos na leitura, escrita, expressão oral e interpretação de textos.
   - Parágrafo 3 (Raciocínio Lógico e Investigativo): Detalhar a compreensão de conceitos matemáticos, resolução de problemas e curiosidade científica.
   - Parágrafos Adicionais/Encerramento: Indicar aspectos que necessitam de intervenção ou acompanhamento mais próximo e sugerir formas práticas e acolhedoras para que a família colabore no desenvolvimento escolar da criança em casa.

4. ESTILO E LINGUAGEM:
   - Utilizar linguagem formal, técnica e clara. Evitar jargões desnecessariamente complexos para que a família compreenda perfeitamente o documento, mas mantendo a sofisticação e elegância profissional.`,

  class_council: `Você é um assistente pedagógico especializado na gestão de aprendizagem de Guarulhos-SP. Gere uma análise técnica para o conselho de classe de uma turma, em português do Brasil. O documento deve incluir:
- Uma análise geral do desempenho e da maturidade acadêmica da turma
- Pontos fortes coletivos evidenciados no período
- Principais desafios pedagógicos e disciplinares identificados
- Sugestões práticas de intervenções pedagógicas e estratégias de recuperação contínua
- Dados qualitativos e insights prontos para serem apresentados em reuniões pedagógicas`,

  parent_meeting: `Você é um professor e orientador pedagógico. Gere um roteiro estruturado para reunião de pais individualizada ou coletiva, em português do Brasil. O roteiro deve conter:
- Uma abertura acolhedora, empática e que estabeleça parceria com a família
- Destaque dos pontos positivos e progressos observados no aluno
- Apresentação cuidadosa e profissional dos aspectos que precisam de atenção no desenvolvimento
- Sugestões práticas e simples de como os pais podem ajudar na rotina em casa
- Um encerramento motivador que reforce a importância da parceria entre a escola e a família`,

  pedagogical_suggestion: `Você é um assessor pedagógico especializado na BNCC e no QSN (Quadro de Saberes Necessários de Guarulhos-SP). Gere sugestões pedagógicas detalhadas e aplicáveis para o professor, em português do Brasil. O texto deve incluir:
- Atividades práticas, dinâmicas e envolventes para aplicar em sala de aula
- Referência clara às habilidades trabalhadas (descrevendo-as textualmente, sem códigos alfanuméricos)
- Materiais necessários para a execução
- Adaptações de inclusão detalhadas para alunos com necessidades educacionais especiais (como autismo, TDAH, deficiência visual/auditiva)
- Estratégias e critérios formativos de avaliação das atividades`,

  referral: `Você é um professor titular da rede municipal de Guarulhos-SP redigindo um documento formal de encaminhamento para avaliação especializada (médica, psicológica, fonoaudiológica ou multidisciplinar).
Redija o corpo do texto de forma extremamente profissional, objetiva, formal e baseada em evidências observáveis, em português do Brasil, seguindo as seguintes regras obrigatórias:

1. PROIBIÇÃO DE DIAGNÓSTICO: Como docente, você NÃO tem competência clínica para diagnosticar ou levantar suspeitas médicas diretas.
   - NUNCA use termos de diagnóstico ou suspeita direta no corpo do texto, tais como "suspeita de TDAH", "suspeita de TEA", "suspeita de TOD", "autista", "hiperativo", "apresenta transtorno", etc.
   - Em vez disso, descreva detalhadamente os SINTOMAS, TRAÇOS e CARACTERÍSTICAS observados de forma puramente descritiva e empírica.
     * Exemplo para TDAH: descreva como desatenção (dificuldade de foco em tarefas, dispersão fácil, cometer erros por distração, dificuldades para seguir instruções passo a passo), hiperatividade (inquietação motora constante, mexer mãos/pés, dificuldade em permanecer sentado na carteira, falar excessivamente) e impulsividade (dificuldade em esperar a sua vez, responder antes que a pergunta seja concluída, interromper conversas/atividades alheias).
     * Exemplo para TEA: descreva como dificuldades de interação social, padrões rígidos de comportamento ou dificuldades de comunicação/fala.

2. ESTRUTURA DO TEXTO (3 a 4 parágrafos bem definidos):
   - Parágrafo 1 (Apresentação Geral e Comportamento): Descreva o perfil geral do aluno em sala de aula, sua energia, envolvimento inicial e a presença de dificuldades atencionais ou de autorregulação que impactam seu foco e permanência nas atividades.
   - Parágrafo 2 (Evidências e Exemplos Concretos): Descreva detalhadamente os comportamentos, traços e características observados com exemplos práticos do cotidiano escolar (ex: agitação motora em determinada aula, desatenção ao seguir instruções, interrupção de colegas, dispersão constante, perda de materiais). Divirta-se nos detalhes de forma objetiva e sem rotular.
   - Parágrafo 3 (Estratégias Pedagógicas Utilizadas): Relate quais estratégias e intervenções pedagógicas o professor já implementou em sala de aula para tentar minimizar essas dificuldades (ex: mudança de assento para a frente da sala, fragmentação de tarefas em etapas menores, feedbacks constantes, estímulos visuais ou rotinas estruturadas).
   - Parágrafo 4 (Conclusão e Encaminhamento): Explique que, mesmo com as adaptações pedagógicas realizadas, o aluno continua apresentando barreiras significativas em sua aprendizagem e desenvolvimento socioemocional. Conclua justificando que este encaminhamento visa uma avaliação diagnóstica aprofundada por profissionais especializados (e equipe multidisciplinar) para fundamentar intervenções conjuntas mais eficazes.

3. ESTILO E LINGUAGEM:
   - Linguagem altamente formal, respeitosa, técnica e impessoal.
   - Evite linguagem coloquial, termos genéricos ou julgamentos de valor morais sobre o aluno.
   - Não inclua o cabeçalho (nome do aluno, turma, escola, etc.) no corpo do texto, pois o sistema já adiciona isso automaticamente. Comece o texto diretamente pelo corpo do relatório.`,
}

export function buildReportPrompt(request: GeminiReportRequest): string {
  const systemPrompt = SYSTEM_PROMPTS[request.type]

  let referralSection = ''
  if (request.type === 'referral' && request.referralType) {
    const labels: Record<string, string> = {
      tea: 'Suspeita de TEA (Transtorno do Espectro Autista)',
      tod: 'Suspeita de TOD (Transtorno Opositivo-Desafiador)',
      tdah: 'Suspeita de TDAH (Déficit de Atenção / Hiperatividade)',
      fono: 'Avaliação Fonoaudiológica',
      dentista: 'Avaliação Odontológica',
      oftalmo: 'Avaliação Oftalmológica',
      psicologo: 'Avaliação Psicológica',
      multi: 'Equipe Multidisciplinar',
      outro: 'Outro encaminhamento',
    }
    referralSection = `\n\nContexto — motivo do encaminhamento (NÃO incluir no corpo do texto): ${labels[request.referralType] || request.referralType}`
  }

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
${request.observations ? `- Observações adicionais: ${request.observations}` : ''}${referralSection}${qsnSection}

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
  const userMsg = 'Contexto:' + (prompt.split('\n\nContexto:')[1] || prompt)

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

// ==================== GROQ QWEN ====================

async function generateWithGroqQwen(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY não configurada')

  const systemMsg = prompt.split('\n\nContexto:')[0]
  const userMsg = 'Contexto:' + (prompt.split('\n\nContexto:')[1] || prompt)

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_QWEN_MODEL,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq Qwen error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ==================== REPORT (provider order: based on preferredProvider) ====================

export async function generateReport(request: GeminiReportRequest): Promise<{ content: string; provider: string }> {
  const prompt = buildReportPrompt(request)

  let lastError: Error | null = null

  const providers: { key: string; fn: (p: string) => Promise<string>; name: string }[] = [
    { key: 'GROQ_API_KEY', fn: generateWithGroq, name: 'groq' },
    { key: 'GROQ_API_KEY', fn: generateWithGroqQwen, name: 'groq-qwen' },
    { key: 'OPENCODE_GO_API_KEY', fn: generateWithOpenCode, name: 'opencode' },
    { key: 'GEMINI_API_KEY', fn: generateWithGemini, name: 'gemini' },
  ]

  // Reorder based on preferredProvider
  if (request.preferredProvider) {
    const idx = providers.findIndex(p => p.name === request.preferredProvider)
    if (idx > 0) {
      const [preferred] = providers.splice(idx, 1)
      providers.unshift(preferred)
    }
  }

  for (const provider of providers) {
    if (!process.env[provider.key]) continue
    try {
      const text = await provider.fn(prompt)
      if (text) return { content: text, provider: provider.name }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`${provider.name} falhou:`, lastError.message)
    }
  }

  if (lastError) throw lastError
  throw new Error('Nenhuma chave de API configurada (OPENCODE_GO_API_KEY, GROQ_API_KEY ou GEMINI_API_KEY)')
}

const GIER_PROMPT_BASE = 'Analise esta atividade escolar aplicada para a turma toda. Identifique: 1) O texto completo da atividade (extraia da imagem se houver), 2) O componente curricular, 3) A Unidade Temática Específica (UTE) correspondente, 4) O SABER (apenas a descrição do saber/objetivo, SEM códigos), 5) A APRENDIZAGEM (APR) específica trabalhada nesta atividade, 6) Uma descrição pedagógica geral para o GIER (Registro de Itinerário Educacional e de Resultados) relatando o que foi trabalhado coletivamente com a turma. Responda em JSON com as chaves: extractedText, component, ute, saber, apr, description. Responda APENAS o JSON, sem markdown ou texto adicional.'

const GIER_PROMPT_TEXT = 'Analise esta descrição de atividade escolar aplicada para a turma toda. Identifique: 1) O componente curricular, 2) A Unidade Temática Específica (UTE) correspondente, 3) O SABER (apenas a descrição do saber/objetivo, SEM códigos), 4) A APRENDIZAGEM (APR) específica trabalhada nesta atividade, 5) Uma descrição pedagógica geral para o GIER (Registro de Itinerário Educacional e de Resultados) relatando o que foi trabalhado coletivamente com a turma. Responda em JSON com as chaves: extractedText, component, ute, saber, apr, description. Responda APENAS o JSON, sem markdown ou texto adicional.'

async function analisarComGroqGier(request: GeminiGierRequest, modelOverride?: string): Promise<GeminiGierResponse> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY não configurada')

  let messages: any[]

  if (request.imageBase64 && request.mimeType) {
    const desc = request.textDescription ? `\n\nDescrição fornecida pelo professor: ${request.textDescription}` : ''
    const isPdf = request.mimeType === 'application/pdf'
    const mimeMap: Record<string, string> = { 'image/jpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp', 'image/gif': 'image/gif', 'application/pdf': 'application/pdf' }
    const mime = mimeMap[request.mimeType] || 'image/jpeg'

    if (isPdf) {
      messages = [{ role: 'user', content: `${GIER_PROMPT_BASE}${desc}\n\nO arquivo enviado é um PDF em base64.` }]
    } else {
      messages = [{
        role: 'user',
        content: [
          { type: 'text', text: `${GIER_PROMPT_BASE}${desc}` },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${request.imageBase64}` } },
        ],
      }]
    }
  } else if (request.textDescription) {
    messages = [{ role: 'user', content: `${GIER_PROMPT_BASE}\n\nAtividade: ${request.textDescription}` }]
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
      model: modelOverride || (request.imageBase64 && request.mimeType !== 'application/pdf' ? GROQ_VISION_MODEL : GROQ_MODEL),
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
      ute: parsed.ute || '',
      saber: parsed.saber || '',
      apr: parsed.apr || '',
      description: parsed.description || '',
    }
  } catch {
    return {
      extractedText: text,
      component: 'Não identificado',
      ute: 'Não identificada',
      saber: 'Não identificado',
      apr: 'Não identificada',
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
      ute: parsed.ute || '',
      saber: parsed.saber || '',
      apr: parsed.apr || '',
      description: parsed.description || '',
    }
  } catch {
    return {
      extractedText: text,
      component: 'Não identificado',
      ute: 'Não identificada',
      saber: 'Não identificado',
      apr: 'Não identificada',
      description: text,
    }
  }
}

export async function analyzeGier(request: GeminiGierRequest): Promise<GeminiGierResponse> {
  let lastError: Error | null = null
  const hasImage = !!(request.imageBase64 && request.mimeType)

  // 1. Com imagem → Groq Llama 4 Scout (visão)
  if (hasImage && process.env.GROQ_API_KEY) {
    try {
      return await analisarComGroqGier(request)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('Groq Vision GIER falhou, tentando texto:', lastError.message)
    }
  }

  // 2. Groq Llama 3.3-70b (texto)
  if (process.env.GROQ_API_KEY) {
    try {
      const textReq = hasImage ? { textDescription: request.textDescription } : request
      return await analisarComGroqGier(textReq as GeminiGierRequest, GROQ_MODEL)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('Groq Llama GIER falhou:', lastError.message)
    }
  }

  // 3. Groq Qwen 3-32b (texto)
  if (process.env.GROQ_API_KEY) {
    try {
      const textReq = hasImage ? { textDescription: request.textDescription } : request
      return await analisarComGroqGier(textReq as GeminiGierRequest, GROQ_QWEN_MODEL)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('Groq Qwen GIER falhou:', lastError.message)
    }
  }

  // 4. OpenCode Qwen 3.5 Plus (texto)
  if (process.env.OPENCODE_GO_API_KEY) {
    try {
      const prompt = hasImage
        ? `${GIER_PROMPT_BASE}${request.textDescription ? '\n\nDescrição fornecida pelo professor: ' + request.textDescription : ''}`
        : `${GIER_PROMPT_TEXT}\n\nAtividade: ${request.textDescription}`
      const text = await generateWithOpenCode(prompt)
      if (text) return parseGierResponse(text)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn('OpenCode GIER falhou:', lastError.message)
    }
  }

  // 5. Fallback Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      let contents: string | Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = ''

      if (request.imageBase64 && request.mimeType) {
        const desc = request.textDescription ? `\n\nDescrição fornecida pelo professor: ${request.textDescription}` : ''
        contents = [
          { text: `${GIER_PROMPT_BASE}${desc}` },
          { inlineData: { data: request.imageBase64, mimeType: request.mimeType } },
        ]
      } else if (request.textDescription) {
        contents = `${GIER_PROMPT_TEXT}\n\nAtividade: ${request.textDescription}`
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
      throw err
    }
  }

  if (lastError) throw lastError
  throw new Error('Nenhuma chave de API configurada (GROQ_API_KEY, OPENCODE_GO_API_KEY ou GEMINI_API_KEY)')
}
