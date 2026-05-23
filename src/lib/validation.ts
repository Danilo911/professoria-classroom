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
  type: z.enum(['descriptive_report', 'class_council', 'parent_meeting', 'pedagogical_suggestion', 'referral']),
  studentName: z.string().optional(),
  className: z.string().optional(),
  period: z.string().optional(),
  observations: z.string().optional(),
  classId: z.string().optional(),
  provider: z.string().optional(),
  qsnSkills: z.array(z.object({
    code: z.string(),
    description: z.string(),
    component: z.string(),
    axis: z.string().optional(),
    grade: z.string(),
  })).optional(),
})

export const ReferralRequestSchema = z.object({
  studentName: z.string().min(1, 'Nome do aluno é obrigatório'),
  referralType: z.string().min(1, 'Tipo de encaminhamento é obrigatório'),
  className: z.string().optional(),
  observations: z.string().optional(),
  classId: z.string().optional(),
  provider: z.string().optional(),
})

export const PlanilhaRequestSchema = z.object({
  fileBase64: z.string().min(1, 'Arquivo não enviado'),
  fileName: z.string().optional(),
})

export const AddStudentRequestSchema = z.object({
  classId: z.string().min(1, 'classId é obrigatório'),
  fullName: z.string().min(1, 'fullName é obrigatório'),
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
