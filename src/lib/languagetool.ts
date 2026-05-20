interface LanguageToolMatch {
  message: string
  shortMessage: string
  offset: number
  length: number
  replacements: { value: string }[]
  rule: { id: string; description: string }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
  language: { name: string; code: string }
}

interface Correction {
  original: string
  replacement: string
  message: string
}

interface CheckResult {
  corrected: string
  corrections: Correction[]
}

export async function checkGrammar(text: string, language = 'pt-BR'): Promise<CheckResult> {
  if (!text || text.trim().length < 3) {
    return { corrected: text, corrections: [] }
  }

  try {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        text,
        language,
        enabledOnly: 'false',
      }),
    })

    if (!res.ok) {
      console.warn(`LanguageTool error (${res.status}): ${await res.text()}`)
      return { corrected: text, corrections: [] }
    }

    const data: LanguageToolResponse = await res.json()

    if (!data.matches || data.matches.length === 0) {
      return { corrected: text, corrections: [] }
    }

    const corrections: Correction[] = []
    let result = text

    // Apply fixes from last to first to preserve offsets
    const sorted = [...data.matches]
      .filter(m => (m.replacements?.length ?? 0) > 0)
      .sort((a, b) => b.offset - a.offset)

    for (const match of sorted) {
      const replacement = match.replacements[0].value
      const original = result.slice(match.offset, match.offset + match.length)

      if (original !== replacement) {
        result = result.slice(0, match.offset) + replacement + result.slice(match.offset + match.length)
        corrections.push({
          original,
          replacement,
          message: match.message,
        })
      }
    }

    return { corrected: result, corrections }
  } catch (err) {
    console.warn('LanguageTool request failed:', err instanceof Error ? err.message : err)
    return { corrected: text, corrections: [] }
  }
}
