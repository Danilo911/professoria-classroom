'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Check, X, FileText, Minus, Calendar } from 'lucide-react'
import { getClassStudents, getSessionsByRange, createAttendanceSession, saveAttendanceRecords, completeSession, getClassHolidays, upsertHoliday, deleteHoliday } from '@/lib/db'
import { getClasses } from '@/lib/db'
import { useToast } from '@/lib/toast'
import { getTodayISO, formatDateBR } from '@/lib/dates'
import type { Student, Class, AttendanceSession } from '@/types'

type Status = 'present' | 'absent' | 'justified'

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

function formatDayHeader(date: string): { day: string; date: string } {
  const d = new Date(date + 'T12:00:00')
  const day = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit' })
  return { day, date: dateStr }
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function ChamadaPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [attendance, setAttendance] = useState<Record<string, Record<string, Status>>>({})
  const [transferredDate, setTransferredDate] = useState<Record<string, string>>({})
  const [holidays, setHolidays] = useState<Set<string>>(new Set())
  const [transferMenu, setTransferMenu] = useState<{ studentId: string; x: number; y: number } | null>(null)
  const [transferDateInput, setTransferDateInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingHolidays, setSavingHolidays] = useState(false)
  const [lastSaved, setLastSaved] = useState<Record<string, Record<string, Status>>>({})
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    return { year: today.getFullYear(), month: today.getMonth() }
  })
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const { toast } = useToast()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holidayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const monthPickerRef = useRef<HTMLDivElement>(null)

  const today = getTodayISO()

  useEffect(() => {
    getClasses().then(data => {
      setClasses(data)
      if (data.length > 0) setSelectedClass(data[0].id)
      else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (selectedClass) loadData(selectedClass)
  }, [selectedClass, currentMonth])

  useEffect(() => {
    if (selectedClass) {
      const key = `chamada_transferred_${selectedClass}`
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}')
        setTransferredDate(saved)
      } catch { setTransferredDate({}) }
    }
  }, [selectedClass])

  useEffect(() => {
    if (selectedClass) {
      const key = `chamada_transferred_${selectedClass}`
      try { localStorage.setItem(key, JSON.stringify(transferredDate)) } catch {}
    }
  }, [transferredDate, selectedClass])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setTransferMenu(null)
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) setShowMonthPicker(false)
    }
    if (transferMenu || showMonthPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [transferMenu, showMonthPicker])

  async function loadData(classId: string) {
    setLoading(true)
    const { start, end } = getMonthRange(currentMonth.year, currentMonth.month)
    const [studentsData, sessionsData, holidaysData] = await Promise.all([
      getClassStudents(classId),
      getSessionsByRange(classId, start, end),
      getClassHolidays(classId, start, end),
    ])
    setStudents(studentsData)
    setSessions(sessionsData)
    setHolidays(new Set(holidaysData))

    const allDates: string[] = []
    const d = new Date(start + 'T12:00:00')
    const endD = new Date(end + 'T12:00:00')
    while (d <= endD) {
      if (!isWeekend(d.toISOString().split('T')[0])) allDates.push(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
    setDates(allDates)

    const map: Record<string, Record<string, Status>> = {}
    for (const st of studentsData) {
      map[st.id] = {}
      for (const date of allDates) map[st.id][date] = 'present'
    }
    for (const session of sessionsData) {
      for (const record of (session.records || [])) {
        if (map[record.student_id]) {
          map[record.student_id][session.date] = (record.status === 'late' ? 'justified' : record.status) as Status
        }
      }
    }
    setAttendance(map)
    setLastSaved(JSON.parse(JSON.stringify(map)))
    setLoading(false)
  }

  function changeMonth(delta: number) {
    setCurrentMonth(prev => {
      let newMonth = prev.month + delta
      let newYear = prev.year
      if (newMonth > 11) { newMonth = 0; newYear++ }
      if (newMonth < 0) { newMonth = 11; newYear-- }
      return { year: newYear, month: newMonth }
    })
  }

  function cycleStatus(studentId: string, date: string) {
    const tDate = transferredDate[studentId]
    if (date > today || (tDate && date >= tDate)) return
    const order: Status[] = ['present', 'absent', 'justified']
    const curr = attendance[studentId]?.[date] || 'present'
    const next = order[(order.indexOf(curr) + 1) % order.length]
    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [date]: next }
    }))
  }

  function openTransferMenu(studentId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setTransferMenu({ studentId, x: rect.left, y: rect.bottom + 4 })
    setTransferDateInput(transferredDate[studentId] || today)
  }

  function confirmTransfer() {
    if (!transferMenu) return
    const { studentId } = transferMenu
    if (transferDateInput) {
      setTransferredDate(prev => ({ ...prev, [studentId]: transferDateInput }))
      toast('Aluno marcado como transferido', 'info')
    }
    setTransferMenu(null)
  }

  function removeTransfer(studentId: string) {
    setTransferredDate(prev => {
      const next = { ...prev }
      delete next[studentId]
      return next
    })
    setTransferMenu(null)
    toast('Aluno restaurado', 'info')
  }

  function toggleHoliday(date: string) {
    const wasHoliday = holidays.has(date)
    setHolidays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
    toast(wasHoliday ? 'Feriado removido' : 'Dia marcado como feriado', 'info')
    if (holidayTimeoutRef.current) clearTimeout(holidayTimeoutRef.current)
    holidayTimeoutRef.current = setTimeout(async () => {
      setSavingHolidays(true)
      try {
        if (!wasHoliday) {
          await upsertHoliday(selectedClass, date)
        } else {
          await deleteHoliday(selectedClass, date)
        }
      } catch {
        toast('Erro ao salvar feriado', 'error')
      } finally {
        setSavingHolidays(false)
      }
    }, 500)
  }

  const saveAttendance = useCallback(async () => {
    if (!selectedClass || students.length === 0 || saving) return

    const changedDates = dates.filter(date => {
      if (date > today || holidays.has(date)) return false
      return students.some(st => {
        const tDate = transferredDate[st.id]
        if (tDate && date >= tDate) return false
        return attendance[st.id]?.[date] !== lastSaved[st.id]?.[date]
      })
    })
    if (changedDates.length === 0) return

    setSaving(true)
    try {
      let savedCount = 0
      for (const date of changedDates) {
        let session = sessions.find(s => s.date === date)
        if (!session) {
          const hasNonPresent = students.some(st => {
            const tDate = transferredDate[st.id]
            if (tDate && date >= tDate) return false
            return attendance[st.id]?.[date] !== 'present'
          })
          if (!hasNonPresent) continue
          session = await createAttendanceSession(selectedClass, date)
        }

        const records = students
          .filter(st => {
            const tDate = transferredDate[st.id]
            return !(tDate && date >= tDate)
          })
          .map(st => ({ student_id: st.id, status: (attendance[st.id]?.[date] === 'justified' ? 'late' : attendance[st.id]?.[date]) || 'present' }))
          .filter(r => r.status !== 'present')
        if (records.length > 0) {
          await saveAttendanceRecords(session.id, records)
          await completeSession(session.id)
          savedCount++
        }
      }

      setLastSaved(JSON.parse(JSON.stringify(attendance)))
      if (savedCount > 0) toast(`${savedCount} dia(s) salvo(s)`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedClass, students, dates, attendance, lastSaved, sessions, today, saving, toast, transferredDate])

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => saveAttendance(), 5000)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [attendance, saveAttendance])

  function getStudentStats(studentId: string) {
    const tDate = transferredDate[studentId]
    const relevantDates = (tDate ? dates.filter(d => d < tDate) : dates).filter(d => !holidays.has(d))
    if (relevantDates.length === 0) return { present: 0, absent: 0, justified: 0, total: 0, pct: 0, effectiveAbsent: 0 }
    const statuses = relevantDates.map(d => attendance[studentId]?.[d] || 'present')
    const present = statuses.filter(s => s === 'present').length
    const absent = statuses.filter(s => s === 'absent').length
    const justified = statuses.filter(s => s === 'justified').length
    const total = present + absent + justified
    const effectiveAbsent = absent + justified
    const pct = total > 0 ? Math.round((present / total) * 100) : 100
    return { present, absent, justified, total, pct, effectiveAbsent }
  }

  function getBuscaAtivaAlert(studentId: string): string | null {
    const tDate = transferredDate[studentId]
    const relevantDates = (tDate ? dates.filter(d => d < tDate) : dates).filter(d => !holidays.has(d))
    const statuses = relevantDates.map(d => attendance[studentId]?.[d] || 'present')

    // Check 3 consecutive absences
    let consecutive = 0
    for (const s of statuses) {
      if (s === 'absent') {
        consecutive++
        if (consecutive >= 3) return '3 faltas consecutivas'
      } else {
        consecutive = 0
      }
    }

    // Check 5 total absences in the month
    const totalAbsent = statuses.filter(s => s === 'absent').length
    if (totalAbsent >= 5) return `${totalAbsent} faltas no mês`

    return null
  }

  const cellColors: Record<Status, string> = { present: '#22c55e', absent: '#ef4444', justified: '#f59e0b' }
  const cellBg: Record<Status, string> = { present: '#22c55e15', absent: '#ef444415', justified: '#f59e0b15' }

  const isFutureMonth = currentMonth.year > new Date().getFullYear() ||
    (currentMonth.year === new Date().getFullYear() && currentMonth.month > new Date().getMonth())

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Carregando...</div>

  const alerts = students
    .map(st => ({ student: st, alert: getBuscaAtivaAlert(st.id) }))
    .filter(a => a.alert !== null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px, 4vw, 24px)', marginBottom: 4 }}>Chamada</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selectedClass ? classes.find(c => c.id === selectedClass)?.name : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Salvando...</span>}
          {!saving && <span className="mobile-hidden" style={{ fontSize: 12, color: 'var(--success)' }}>✓ Salvo</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ maxWidth: 220, flex: '1 1 160px', minWidth: 140 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }} ref={monthPickerRef}>
          <button className="btn btn-icon btn-ghost" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
          <span
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            style={{ fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {MONTHS[currentMonth.month].slice(0, 3)} {currentMonth.year} ▾
          </span>
          <button className="btn btn-icon btn-ghost" onClick={() => changeMonth(1)} disabled={isFutureMonth}><ChevronRight size={16} /></button>
          {showMonthPicker && (
            <div style={{
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
              padding: 8, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, minWidth: 200,
            }}>
              {MONTHS.map((m, i) => (
                <button key={i} onClick={() => { setCurrentMonth({ year: currentMonth.year, month: i }); setShowMonthPicker(false) }}
                  style={{
                    padding: '6px 8px', fontSize: 12, border: 'none', borderRadius: 4, cursor: 'pointer',
                    background: i === currentMonth.month ? 'var(--primary)' : 'transparent',
                    color: i === currentMonth.month ? 'white' : 'var(--text-primary)',
                    fontWeight: i === currentMonth.month ? 600 : 400,
                  }}>
                  {m}
                </button>
              ))}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setCurrentMonth(p => ({ ...p, year: p.year - 1 }))} className="btn btn-sm btn-ghost">◂ {currentMonth.year - 1}</button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>{currentMonth.year}</span>
                <button onClick={() => setCurrentMonth(p => ({ ...p, year: p.year + 1 }))} className="btn btn-sm btn-ghost">{currentMonth.year + 1} ▸</button>
              </div>
            </div>
          )}
        </div>
        <div className="legend-bar mobile-hidden" style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Falta</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} /> Justificado</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} /> Presente</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} /> Feriado</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum aluno matriculado nesta turma.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 2, borderBottom: '2px solid var(--border)', minWidth: 180 }}>Aluno</th>
                  {dates.map(date => {
                    const { day, date: dayNum } = formatDayHeader(date)
                    const isFuture = date > today
                    const isToday = date === today
                    const isHoliday = holidays.has(date)
                    return (
                      <th key={date} onClick={() => !isFuture && toggleHoliday(date)} style={{
                        padding: '6px 4px', textAlign: 'center', fontWeight: 500, fontSize: 11,
                        borderBottom: '2px solid var(--border)', minWidth: 44,
                        background: isHoliday ? 'rgba(59, 130, 246, 0.15)' : isToday ? 'var(--primary-light)' : 'var(--bg-secondary)',
                        color: isFuture ? 'var(--text-muted)' : isHoliday ? '#3b82f6' : undefined,
                        cursor: isFuture ? 'default' : 'pointer',
                      }} title={isHoliday ? 'Clique para remover feriado' : 'Clique para marcar como feriado'}>
                        <div style={{ fontSize: 10, color: isHoliday ? '#3b82f6' : 'var(--text-muted)', textTransform: 'uppercase' }}>{day}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{dayNum}</div>
                        {isHoliday && <div style={{ fontSize: 8, marginTop: 2 }}>🏖</div>}
                      </th>
                    )
                  })}
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 60 }}>Faltas</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 60 }}>Just.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, borderBottom: '2px solid var(--border)', background: 'var(--bg-secondary)', minWidth: 60 }}>%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => {
                  const stats = getStudentStats(st.id)
                  const tDate = transferredDate[st.id]
                  return (
                    <tr key={st.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500, position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              onClick={(e) => openTransferMenu(st.id, e)}
                              style={{ cursor: 'pointer', color: tDate ? 'var(--text-muted)' : undefined, textDecoration: tDate ? 'line-through' : undefined }}
                              title={tDate ? `Transferido em ${formatDateBR(tDate)}` : 'Clique para marcar como transferido'}
                            >
                              {st.full_name}
                            </span>
                            {getBuscaAtivaAlert(st.id) && (
                              <span style={{
                                fontSize: 9, padding: '1px 6px', borderRadius: 8,
                                background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 700, whiteSpace: 'nowrap',
                              }} title="Busca Ativa">
                                ⚠
                              </span>
                            )}
                          </div>
                          {tDate && (
                            <span style={{ fontSize: 10, color: 'var(--danger)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {formatDateBR(tDate)}
                            </span>
                          )}
                        </div>
                      </td>
                      {dates.map(date => {
                        const isTransfered = !!(tDate && date >= tDate)
                        const isHoliday = holidays.has(date)
                        const status = isTransfered || isHoliday ? null : (attendance[st.id]?.[date] || 'present')
                        const isFuture = date > today
                        return (
                          <td key={date} style={{ padding: '4px', textAlign: 'center', borderBottom: '1px solid var(--border)', cursor: isFuture || isTransfered || isHoliday ? 'default' : 'pointer', opacity: isFuture ? 0.4 : 1 }}>
                            <button
                              onClick={() => !isFuture && !isTransfered && !isHoliday && cycleStatus(st.id, date)}
                              disabled={isTransfered || isHoliday}
                              style={{
                                width: 28, height: 28, borderRadius: 6, border: 'none',
                                background: isHoliday ? 'rgba(59, 130, 246, 0.15)' : isTransfered ? 'var(--bg-secondary)' : cellBg[status as Status],
                                color: isHoliday ? '#3b82f6' : isTransfered ? 'var(--text-muted)' : cellColors[status as Status],
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: isFuture || isTransfered || isHoliday ? 'default' : 'pointer',
                                fontSize: 14,
                              }}
                              title={isHoliday ? 'Feriado' : isTransfered ? `Transferido desde ${formatDateBR(tDate!)}` : status === 'present' ? 'Presente' : status === 'absent' ? 'Falta' : 'Justificado'}
                            >
                              {isHoliday ? '🏖' : isTransfered ? <Minus size={16} /> : status === 'present' ? <Check size={16} /> : status === 'absent' ? <X size={16} /> : <FileText size={16} />}
                            </button>
                          </td>
                        )
                      })}
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', color: stats.effectiveAbsent > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {stats.effectiveAbsent}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', color: stats.justified > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                        {stats.justified}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', color: stats.pct >= 75 ? 'var(--success)' : stats.pct >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                        {stats.total === 0 ? '-' : `${stats.pct}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {alerts.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>Busca Ativa — {alerts.length} aluno(s)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {alerts.map(a => (
                  <span key={a.student.id} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontWeight: 500,
                  }}>
                    {a.student.full_name.split(' ')[0]} — {a.alert}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {transferMenu && (
        <div ref={menuRef} style={{
          position: 'fixed', left: transferMenu.x, top: transferMenu.y,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 12, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          minWidth: 220,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            {students.find(s => s.id === transferMenu.studentId)?.full_name}
          </p>
          {transferredDate[transferMenu.studentId] ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Transferido em: {formatDateBR(transferredDate[transferMenu.studentId])}
              </p>
              <button onClick={() => removeTransfer(transferMenu.studentId)}
                className="btn btn-sm" style={{ width: '100%', background: 'var(--danger-light)', color: 'var(--danger)' }}>
                Restaurar aluno
              </button>
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Data da transferência:</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Calendar size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="date"
                    value={transferDateInput}
                    onChange={e => setTransferDateInput(e.target.value)}
                    max={today}
                    className="input"
                    style={{ paddingLeft: 28, fontSize: 13 }}
                  />
                </div>
              </div>
              <button onClick={confirmTransfer} className="btn btn-sm btn-primary" style={{ width: '100%', marginTop: 8 }}>
                Confirmar transferência
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
