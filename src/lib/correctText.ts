let correctionId = 0

interface LanguageToolMatch {
  message: string
  offset: number
  length: number
  replacements: { value: string }[]
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

export async function correctText(text: string): Promise<string> {
  if (!text || text.trim().length < 3) return text

  try {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'pt-BR', enabledOnly: 'false' }),
    })

    if (!res.ok) return text

    const data: LanguageToolResponse = await res.json()
    if (!data.matches?.length) return text

    let result = text
    const sorted = data.matches
      .filter(m => m.replacements?.length > 0)
      .sort((a, b) => b.offset - a.offset)

    for (const match of sorted) {
      const replacement = match.replacements[0].value
      const original = result.slice(match.offset, match.offset + match.length)
      if (original !== replacement) {
        result = result.slice(0, match.offset) + replacement + result.slice(match.offset + match.length)
      }
    }

    return result
  } catch {
    return text
  }
}

export function scheduleCorrection(
  text: string,
  onResult: (corrected: string) => void,
  delay = 600,
): void {
  const id = ++correctionId
  setTimeout(() => {
    correctText(text).then(corrected => {
      if (corrected !== text) onResult(corrected)
    })
  }, delay)
}
