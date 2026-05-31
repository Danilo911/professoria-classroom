'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DuplicarPdfPage() {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/dashboard/ferramentas')} className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: 20 }}>Duplicar PDF</h1>
      </div>
      <iframe
        src="https://duplica-pdf.netlify.app/"
        style={{ width: '100%', flex: 1, border: 'none', borderRadius: 12 }}
        title="Duplicar PDF"
      />
    </div>
  )
}
