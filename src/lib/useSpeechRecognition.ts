import { useState, useRef, useCallback } from 'react'

type Status = 'idle' | 'loading' | 'listening' | 'error'

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

async function loadWhisper(): Promise<any> {
  if (whisperPipeline) return whisperPipeline
  if (whisperLoading) return whisperLoading

  whisperLoading = (async () => {
    const { pipeline, env } = await import('@xenova/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
    whisperPipeline = pipe
    return pipe
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
  const useWhisperRef = useRef(false)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStatus('idle')
  }, [])

  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return false

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.interimResults = false
      recognition.continuous = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        onResult(transcript)
        setStatus('idle')
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Microfone bloqueado')
          onError?.('Microfone bloqueado')
          setStatus('error')
        } else if (event.error === 'no-speech') {
          setError('Nenhuma fala detectada')
          setStatus('idle')
        } else if (event.error === 'network') {
          useWhisperRef.current = true
          recognitionRef.current = null
          startWhisper()
        } else if (event.error !== 'aborted') {
          setError('Erro no reconhecimento')
          onError?.('Erro no reconhecimento')
          setStatus('error')
        }
      }

      recognition.onend = () => {
        if (status === 'listening') setStatus('idle')
      }

      recognitionRef.current = recognition
      recognition.start()
      setStatus('listening')
      setError(null)
      return true
    } catch {
      return false
    }
  }, [onResult, onError, status])

  const startWhisper = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const pipe = await loadWhisper()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
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
          const msg = err instanceof Error ? err.message : 'Erro ao transcrever áudio'
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
      const msg = err instanceof Error ? err.message : 'Erro ao carregar modelo de voz'
      setError(msg)
      onError?.(msg)
      setStatus('error')
    }
  }, [onResult, onError])

  const startListening = useCallback(() => {
    if (!useWhisperRef.current) {
      const ok = startWebSpeech()
      if (ok) return
    }
    startWhisper()
  }, [startWebSpeech, startWhisper])

  const toggleListening = useCallback(() => {
    if (status === 'listening' || status === 'loading') {
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
  const audioContext = new AudioContext({ sampleRate: 16000 })
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    return new Float32Array(channelData)
  } finally {
    await audioContext.close()
  }
}

export { useSpeechRecognition }
