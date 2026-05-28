import { useState, useRef, useCallback } from 'react'

type Status = 'idle' | 'loading' | 'listening' | 'uploading' | 'error'

interface UseSpeechRecognitionReturn {
  status: Status
  error: string | null
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  isSupported: boolean
}

let whisperPipeline: any = null
let whisperLoading: Promise<any> | null = null

const isBraveBrowser = (): boolean => {
  if (typeof window === 'undefined') return false
  const nav = navigator as any
  return !!(
    nav.brave?.isBrave ||
    nav.userAgentData?.brands?.some((b: any) => b.brand === 'Brave') ||
    /Brave/.test(navigator.userAgent || '')
  )
}

async function loadWhisper(): Promise<any> {
  if (whisperPipeline) return whisperPipeline
  if (whisperLoading) return whisperLoading

  whisperLoading = (async () => {
    try {
      const { pipeline, env } = await import('@xenova/transformers')
      env.allowLocalModels = false

      let useCache = false
      try {
        useCache = typeof window !== 'undefined' && 'caches' in window && window.caches !== undefined
      } catch {}
      env.useBrowserCache = useCache

      const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
      whisperPipeline = pipe
      return pipe
    } catch (err) {
      whisperLoading = null
      throw err
    }
  })()

  return whisperLoading
}

function useSpeechRecognition(onResult: (text: string) => void, onError?: (error: string) => void): UseSpeechRecognitionReturn {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const useFallbackRef = useRef(false)
  const startWhisperRef = useRef<(() => Promise<void>) | null>(null)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach(t => t.stop()) } catch {}
      streamRef.current = null
    }
    setStatus('idle')
  }, [])

  // ─── 1. Groq whisper-large-v3 (record → API) ──────────────────────────

  const startGroq = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false
    }

    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      } catch {
        mediaRecorder = new MediaRecorder(stream)
      }
      mediaRecorderRef.current = mediaRecorder

      const chunks: Blob[] = []
      chunksRef.current = chunks

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        // Stop stream tracks immediately so browser mic indicator goes off
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        try {
          setStatus('uploading')
          const mime = mediaRecorder.mimeType || 'audio/webm'
          const blob = new Blob(chunks, { type: mime })

          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')

          const res = await fetch('/api/groq/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
            throw new Error(errData.error || `HTTP ${res.status}`)
          }

          const data = await res.json()
          if (data.text?.trim()) {
            onResult(data.text.trim())
            setStatus('idle')
          } else {
            throw new Error('Texto vazio')
          }
        } catch (err) {
          console.warn('Groq failed, trying local Whisper fallback...', err)
          useFallbackRef.current = true

          try {
            setStatus('loading')
            const pipe = await loadWhisper()
            const mime = mediaRecorder.mimeType || 'audio/webm'
            const blob = new Blob(chunks, { type: mime })
            const arrayBuffer = await blob.arrayBuffer()
            const float32Data = await decodeAudio(arrayBuffer)

            const result = await pipe(float32Data, {
              language: 'portuguese',
              task: 'transcribe',
            })

            if (result && result.text && result.text.trim()) {
              onResult(result.text.trim())
              setStatus('idle')
              setError(null)
            } else {
              throw new Error('Não foi possível transcrever o áudio localmente')
            }
          } catch (localErr) {
            const rawMsg = localErr instanceof Error ? localErr.message : String(localErr)
            let msg = 'Groq indisponível, use o microfone novamente'
            if (isBraveBrowser() || rawMsg.includes('undefined') || rawMsg.includes('null') || rawMsg.includes('convert')) {
              msg = 'O reconhecimento de voz não é suportado no Brave devido a restrições de privacidade nos Shields. Use o Google Chrome ou desative os Brave Shields.'
            } else {
              msg = 'O reconhecimento de voz via API falhou e o reconhecimento local falhou. Tente novamente.'
            }
            setError(msg)
            onError?.(msg)
            setStatus('error')
          }
        }
      }

      mediaRecorder.start()
      setStatus('listening')
      return true
    } catch {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      return false
    }
  }, [onResult, onError])

  // ─── 2. Web Speech API nativa ──────────────────────────────────────────

  const startWebSpeech = useCallback(() => {
    if (isBraveBrowser()) return false

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return false

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        try {
          const transcript = event.results?.[0]?.[0]?.transcript
          if (transcript) {
            onResult(transcript)
          } else {
            setError('Nenhum resultado de áudio detectado')
          }
        } catch {
          setError('Erro ao processar áudio nativo')
        }
        setStatus('idle')
      }

      recognition.onerror = (event: any) => {
        const errType = event?.error
        if (errType === 'not-allowed') {
          setError('Microfone bloqueado')
          onError?.('Microfone bloqueado')
          setStatus('error')
        } else if (errType === 'no-speech') {
          setError('Nenhuma fala detectada')
          setStatus('idle')
        } else if (errType === 'network') {
          useFallbackRef.current = true
          setError('Falha de rede no reconhecimento de voz')
          startWhisperRef.current?.()
        } else if (errType !== 'aborted') {
          setError('Erro no reconhecimento')
          onError?.('Erro no reconhecimento')
          setStatus('error')
        }
      }

      recognition.onend = () => {
        setStatus('idle')
      }

      recognitionRef.current = recognition
      recognition.start()
      setStatus('listening')
      setError(null)
      return true
    } catch {
      return false
    }
  }, [onResult, onError])

  // ─── 3. Whisper Tiny WASM (offline) ────────────────────────────────────

  const startWhisper = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const pipe = await loadWhisper()

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Dispositivos de mídia (microfone) não suportados neste navegador.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      } catch {
        mediaRecorder = new MediaRecorder(stream)
      }

      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        try {
          const mime = mediaRecorder.mimeType || 'audio/webm'
          const blob = new Blob(chunks, { type: mime })
          const arrayBuffer = await blob.arrayBuffer()
          const float32Data = await decodeAudio(arrayBuffer)

          const result = await pipe(float32Data, {
            language: 'portuguese',
            task: 'transcribe',
          })

          if (result && result.text && result.text.trim()) {
            onResult(result.text.trim())
          } else {
            setError('Não foi possível transcrever o áudio')
          }
        } catch (err) {
          const rawMsg = err instanceof Error ? err.message : String(err)
          let msg = 'Erro ao transcrever áudio'
          if (isBraveBrowser() || rawMsg.includes('undefined') || rawMsg.includes('null') || rawMsg.includes('convert')) {
            msg = 'O reconhecimento de voz não é suportado no Brave devido a restrições de privacidade nos Shields. Use o Google Chrome ou desative os Brave Shields.'
          } else {
            msg = rawMsg
          }
          setError(msg)
          onError?.(msg)
        }
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setStatus('idle')
      }

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = chunks
      mediaRecorder.start()
      setStatus('listening')
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err)
      let msg = 'Erro ao carregar modelo de voz'
      if (isBraveBrowser() || rawMsg.includes('undefined') || rawMsg.includes('null') || rawMsg.includes('convert')) {
        msg = 'O reconhecimento de voz local não é suportado no Brave com as proteções ativas. Para usar, desative os Shields do Brave ou use o Chrome.'
      } else {
        msg = rawMsg
      }
      setError(msg)
      onError?.(msg)
      setStatus('error')
    }
  }, [onResult, onError])

  startWhisperRef.current = startWhisper

  const startListening = useCallback(() => {
    // Se o Groq já falhou anteriormente nesta sessão, pula ele e vai direto para a Web Speech ou Whisper
    if (useFallbackRef.current) {
      const ok = startWebSpeech()
      if (ok) return
      startWhisper()
      return
    }

    // 1ª tentativa: Groq (whisper-large-v3 via API)
    startGroq().then((started) => {
      if (started) return
      // 2ª tentativa: Web Speech nativa
      const ok = startWebSpeech()
      if (ok) return
      // 3ª tentativa: Whisper Tiny WASM
      startWhisper()
    })
  }, [startGroq, startWebSpeech, startWhisper])

  const toggleListening = useCallback(() => {
    if (status === 'listening' || status === 'loading' || status === 'uploading') {
      stopListening()
    } else {
      startListening()
    }
  }, [status, startListening, stopListening])

  return {
    status,
    error,
    startListening,
    stopListening,
    toggleListening,
    isSupported: true,
  }
}

async function decodeAudio(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null
  if (!AudioContextClass) {
    throw new Error('Web Audio API não suportada neste navegador.')
  }

  const audioContext = new AudioContextClass({ sampleRate: 16000 })
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    if (!audioBuffer) {
      throw new Error('Falha ao decodificar áudio.')
    }
    const channelData = audioBuffer.getChannelData(0)
    if (!channelData) {
      throw new Error('Dados do canal de áudio não disponíveis.')
    }
    return new Float32Array(channelData)
  } finally {
    await audioContext.close()
  }
}

export { useSpeechRecognition }
