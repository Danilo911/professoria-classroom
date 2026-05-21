-- Adiciona 'referral' ao CHECK constraint de type na tabela ai_reports
ALTER TABLE public.ai_reports DROP CONSTRAINT IF EXISTS ai_reports_type_check;
ALTER TABLE public.ai_reports ADD CONSTRAINT ai_reports_type_check CHECK (type IN ('descriptive_report','class_council','parent_meeting','pedagogical_suggestion','progress_summary','referral'));
