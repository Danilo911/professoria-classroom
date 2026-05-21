import { z } from 'zod'

export const GeminiGierRequestSchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  textDescription: z.string().optional(),
}).refine(
  data => data.imageBase64 || data.textDescription,
  { message: 'Imagem ou texto é obrigatório' }
)

export const GeminiReportRequestSchema = z.object({
  type: z.enum(['descriptive_report', 'class_council', 'parent_meeting', 'pedagogical_suggestion']),
  studentName: z.string().optional(),
  className: z.string().optional(),
  period: z.string().optional(),
  observations: z.string().optional(),
  classId: z.string().optional(),
})

export const SaveGierSchema = z.object({
  class_id: z.string().min(1, 'Selecione uma turma'),
  gier_description: z.string().min(1, 'Descrição é obrigatória'),
  ocr_extracted_text: z.string().optional(),
  ai_interpretation: z.object({
    component: z.string(),
    ute: z.string(),
    saber: z.string(),
    apr: z.string(),
    description: z.string(),
  }).optional(),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
})
