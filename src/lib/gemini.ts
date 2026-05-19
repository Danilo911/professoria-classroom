import { GoogleGenAI } from '@google/genai'

function getAI() {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY não configurada')
  return new GoogleGenAI({ apiKey: key })
}

export const GEMINI_MODEL = 'gemini-2.0-flash'

export interface GeminiReportRequest {
  type: 'descriptive_report' | 'class_council' | 'parent_meeting' | 'pedagogical_suggestion'
  studentName?: string
  className?: string
  period?: string
  observations?: string
}

export interface GeminiGierRequest {
  imageBase64?: string
  mimeType?: string
  textDescription?: string
}

export interface GeminiGierResponse {
  extractedText: string
  component: string
  skill: string
  description: string
}

const SYSTEM_PROMPTS = {
  descriptive_report: `Você é um assistente pedagógico especializado em educação básica brasileira. Gere um parecer descritivo individual profissional e empático, em português do Brasil. O texto deve:
- Descrever o desenvolvimento do aluno de forma construtiva
- Mencionar habilidades da BNCC quando relevante
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

export async function generateReport(request: GeminiReportRequest): Promise<string> {
  const prompt = buildReportPrompt(request)

  const response = await getAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  })

  return response.text || 'Não foi possível gerar o relatório. Tente novamente.'
}

function buildReportPrompt(request: GeminiReportRequest): string {
  const systemPrompt = SYSTEM_PROMPTS[request.type]

  const context = `
Contexto:
- Tipo de relatório: ${request.type}
${request.studentName ? `- Aluno: ${request.studentName}` : ''}
${request.className ? `- Turma: ${request.className}` : ''}
${request.period ? `- Período: ${request.period}` : ''}
${request.observations ? `- Observações adicionais: ${request.observations}` : ''}

Gere o relatório solicitado seguindo as diretrizes acima.`

  return `${systemPrompt}\n\n${context}`
}

export async function analyzeGier(request: GeminiGierRequest): Promise<GeminiGierResponse> {
  let contents: string | Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = ''

  if (request.imageBase64 && request.mimeType) {
    contents = [
      { text: 'Analise esta atividade escolar extraída de uma imagem/PDF. Identifique: 1) O texto completo da atividade, 2) O componente curricular, 3) A habilidade BNCC correspondente (com código), 4) Uma descrição pedagógica para o GIER (Registro de Itinerário Educacional e de Resultados). Responda em JSON com as chaves: extractedText, component, skill, description. Responda APENAS o JSON, sem markdown ou texto adicional.' },
      { inlineData: { data: request.imageBase64, mimeType: request.mimeType } },
    ]
  } else if (request.textDescription) {
    contents = `Analise esta descrição de atividade escolar. Identifique: 1) O componente curricular, 2) A habilidade BNCC correspondente (com código), 3) Uma descrição pedagógica para o GIER. Responda em JSON com as chaves: extractedText, component, skill, description. Responda APENAS o JSON, sem markdown ou texto adicional.\n\nAtividade: ${request.textDescription}`
  } else {
    throw new Error('Nenhuma imagem ou texto fornecido')
  }

  const response = await getAI().models.generateContent({
    model: GEMINI_MODEL,
    contents,
  })

  const text = response.text || '{}'
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
