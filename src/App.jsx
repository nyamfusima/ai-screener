import { useState, useRef, useCallback } from 'react'
import { extractTextFromPDF } from './pdfUtils'
import { extractCandidateInfo, scoreApplicant } from './api'
import './App.css'

const SAMPLE_JD = `We are looking for a Senior Frontend Engineer with 4+ years of experience in React and TypeScript.

The ideal candidate should have:
— Strong knowledge of React hooks, context API, and performance optimisation
— Experience with state management (Redux, Zustand, or similar)
— Proficiency in CSS/Tailwind and responsive design
— Familiarity with REST APIs and GraphQL
— Experience with testing frameworks (Jest, React Testing Library)
— Good communication and ability to work in an agile team`

const AVATAR_COLORS = [
  ['#EEF2FD', '#1b4dcb'],
  ['#EBF5EE', '#1A6B3C'],
  ['#FEF6E7', '#92400E'],
  ['#F5F0FB', '#7C3AED'],
  ['#FEF0F0', '#B91C1C'],
  ['#F0FBF4', '#166534'],
]

// Processing states per file
const STATUS = { READING: 'reading', EXTRACTING: 'extracting', READY: 'ready', ERROR: 'error' }

function ScoreRing({ score }) {
  const color = score >= 75 ? 'var(--pass)' : score >= 55 ? 'var(--warn)' : 'var(--reject)'
  const sz = 54, r = 22
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="score-ring">
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
        <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="score-text">
        <span className="score-num" style={{ color }}>{score}</span>
        <span className="score-pct">%</span>
      </div>
    </div>
  )
}

function Spinner({ size = 16 }) {
  return (
    <span className="inline-spinner" style={{ width: size, height: size, borderWidth: size > 20 ? 2.5 : 1.5 }} />
  )
}

export default function App() {
  const [step, setStep] = useState('setup')
  const [jobDesc, setJobDesc] = useState(SAMPLE_JD)
  const [applicants, setApplicants] = useState([])
  const [threshold, setThreshold] = useState(60)
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef(null)
  const nextId = useRef(1)

  // ── PDF ingestion ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (files) => {
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!pdfs.length) return

    // Add placeholder entries immediately so the user sees progress
    const placeholders = pdfs.map((file) => ({
      id: nextId.current++,
      name: file.name.replace(/\.pdf$/i, ''),
      role: '',
      text: '',
      fileName: file.name,
      status: STATUS.READING,
      error: null,
    }))

    setApplicants((prev) => [...prev, ...placeholders])

    // Process each file independently so they update as they finish
    placeholders.forEach(async (placeholder, idx) => {
      const file = pdfs[idx]
      const updateApplicant = (patch) =>
        setApplicants((prev) =>
          prev.map((a) => (a.id === placeholder.id ? { ...a, ...patch } : a))
        )

      try {
        // Step 1: Extract text from PDF
        updateApplicant({ status: STATUS.READING })
        const text = await extractTextFromPDF(file)

        // Step 2: Ask Claude to pull name + role out of the text
        updateApplicant({ status: STATUS.EXTRACTING })
        const info = await extractCandidateInfo(text)

        updateApplicant({
          name: info.name || placeholder.name,
          role: info.role || 'Unknown Role',
          text,
          status: STATUS.READY,
        })
      } catch (e) {
        updateApplicant({ status: STATUS.ERROR, error: e.message })
      }
    })
  }, [])

  const onFileInput = (e) => processFiles(e.target.files)

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  const removeApplicant = (id) => setApplicants((p) => p.filter((a) => a.id !== id))

  // ── Screening run ──────────────────────────────────────────────────────────
  const runScreening = async () => {
    const ready = applicants.filter((a) => a.status === STATUS.READY)
    setError('')
    setStep('running')
    setProgress(0)
    const scored = []

    for (let i = 0; i < ready.length; i++) {
      const applicant = ready[i]
      setProgressLabel(`Scoring ${applicant.name}`)
      try {
        const result = await scoreApplicant(applicant, jobDesc)
        scored.push({ ...applicant, ...result })
      } catch (e) {
        scored.push({ ...applicant, score: 0, summary: 'Could not analyse this application.', matched_skills: [], missing_skills: [] })
        setError(`Could not analyse ${applicant.name}: ${e.message}`)
      }
      setProgress(Math.round(((i + 1) / ready.length) * 100))
    }

    setResults(scored.sort((a, b) => b.score - a.score))
    setStep('results')
  }

  const statusOf = (score) => score >= threshold + 15 ? 'pass' : score >= threshold ? 'warn' : 'reject'
  const passCount = results.filter((r) => r.score >= threshold).length
  const rejectCount = results.filter((r) => r.score < threshold).length
  const readyCount = applicants.filter((a) => a.status === STATUS.READY).length
  const processingCount = applicants.filter((a) => [STATUS.READING, STATUS.EXTRACTING].includes(a.status)).length
  const canRun = jobDesc.trim().length > 20 && readyCount > 0 && processingCount === 0

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect width="20" height="20" rx="5" fill="var(--navy)" />
            <path d="M5 14l4-8 4 8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 11h5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="brand-name">HireFilter</span>
        </div>
        <div className="header-divider" />
        <span className="header-subtitle">AI Application Screener</span>
        <div className="header-right">
          {step === 'results' && (
            <>
              <span className="chip pass">✓ {passCount} qualified</span>
              <span className="chip reject">✕ {rejectCount} rejected</span>
            </>
          )}
          <span className="chip neutral">threshold · {threshold}%</span>
        </div>
      </header>

      <main className="main">

        {/* ── Setup ── */}
        {step === 'setup' && (
          <div className="fade-up">
            <div className="page-header">
              <h1 className="page-title">New screening run</h1>
              <p className="page-sub">Upload candidate CVs as PDFs — Claude extracts and scores each one automatically.</p>
            </div>

            <div className="two-col">

              {/* Job Description */}
              <div className="card">
                <div className="mono-label">Job description</div>
                <textarea
                  rows={14}
                  placeholder="Paste the full job description here…"
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* CV Upload panel */}
              <div className="card upload-panel">
                <div className="card-row-header">
                  <span className="mono-label">
                    CV uploads · {applicants.length}
                    {processingCount > 0 && (
                      <span className="processing-badge">
                        <Spinner size={11} />
                        {processingCount} processing
                      </span>
                    )}
                  </span>
                  <button className="btn-add" onClick={() => fileInputRef.current?.click()}>
                    + Upload PDF{applicants.length > 0 ? 's' : 's'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={onFileInput}
                  />
                </div>

                {/* Drop zone */}
                <div
                  className={`drop-zone ${dragOver ? 'drag-over' : ''} ${applicants.length > 0 ? 'drop-zone--compact' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                  <div className="drop-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="drop-label">
                    {applicants.length > 0 ? 'Drop more PDFs here' : 'Drop CV PDFs here'}
                  </div>
                  <div className="drop-hint">or click to browse · multiple files supported</div>
                </div>

                {/* Applicant list */}
                {applicants.length > 0 && (
                  <div className="applicant-list">
                    {applicants.map((a, i) => {
                      const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length]
                      const initials = a.name
                        .split(' ')
                        .filter(Boolean)
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || '?'

                      return (
                        <div key={a.id} className={`applicant-row ${a.status === STATUS.ERROR ? 'applicant-row--error' : ''}`}>
                          {/* Avatar / spinner */}
                          {[STATUS.READING, STATUS.EXTRACTING].includes(a.status) ? (
                            <div className="avatar avatar--loading">
                              <Spinner size={14} />
                            </div>
                          ) : a.status === STATUS.ERROR ? (
                            <div className="avatar" style={{ background: 'var(--reject-bg)', color: 'var(--reject)', fontSize: 14 }}>!</div>
                          ) : (
                            <div className="avatar" style={{ background: bg, color: fg }}>{initials}</div>
                          )}

                          <div className="applicant-info">
                            <div className="applicant-name">{a.name}</div>
                            <div className="applicant-role">
                              {a.status === STATUS.READING && 'Extracting PDF text…'}
                              {a.status === STATUS.EXTRACTING && 'Identifying candidate…'}
                              {a.status === STATUS.READY && a.role}
                              {a.status === STATUS.ERROR && (
                                <span style={{ color: 'var(--reject)' }}>Failed: {a.error}</span>
                              )}
                            </div>
                          </div>

                          {/* File name badge */}
                          <span className="file-badge">{a.fileName}</span>

                          <button
                            className="remove-btn"
                            onClick={() => removeApplicant(a.id)}
                            aria-label={`Remove ${a.name}`}
                          >✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="card controls-row">
              <div className="threshold-block">
                <div className="mono-label" style={{ marginBottom: 8 }}>Rejection threshold</div>
                <div className="threshold-row">
                  <input
                    type="range" min="30" max="90"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                  />
                  <span className="threshold-val">{threshold}%</span>
                  <span className="threshold-hint">Applications below this are auto-rejected</span>
                </div>
              </div>
              <div className="run-block">
                <div style={{ textAlign: 'right' }}>
                  <div className="run-count">{readyCount} candidate{readyCount !== 1 ? 's' : ''} ready</div>
                  {processingCount > 0 && (
                    <div className="run-processing">{processingCount} still processing…</div>
                  )}
                </div>
                <button className="btn-run" onClick={runScreening} disabled={!canRun}>
                  Run screening →
                </button>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
          </div>
        )}

        {/* ── Running ── */}
        {step === 'running' && (
          <div className="running-state fade-up">
            <div className="spinner-lg" />
            <div>
              <div className="running-label">{progressLabel || 'Starting…'}</div>
              <div className="running-pct">{progress}% complete</div>
            </div>
            <div className="progress-outer">
              <div className="progress-inner" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {step === 'results' && (
          <div className="fade-up">
            <div className="results-header">
              <div>
                <h1 className="page-title">Screening complete</h1>
                <p className="page-sub">{passCount} of {results.length} candidates met the {threshold}% threshold.</p>
              </div>
              <button
                className="btn-ghost"
                onClick={() => { setStep('setup'); setResults([]); setApplicants([]); setError('') }}
              >← New run</button>
            </div>

            <div className="stats-grid">
              {[
                ['Total reviewed', results.length, 'var(--navy)'],
                ['Qualified', passCount, 'var(--pass)'],
                ['Rejected', rejectCount, 'var(--reject)'],
              ].map(([label, val, color]) => (
                <div key={label} className="stat-card">
                  <div className="mono-label">{label}</div>
                  <div className="stat-val" style={{ color }}>{val}</div>
                </div>
              ))}
            </div>

            <div className="results-divider" />

            <div className="results-list">
              {results.map((r, i) => {
                const st = statusOf(r.score)
                const accentColor = { pass: 'var(--pass)', warn: 'var(--warn)', reject: 'var(--reject)' }[st]
                const labelMap = { pass: 'Qualified', warn: 'Borderline', reject: 'Rejected' }
                return (
                  <div key={r.id} className={`result-card ${st}`} style={{ borderLeftColor: accentColor }}>
                    <ScoreRing score={r.score} />
                    <div className="result-body">
                      <div className="result-name-row">
                        <span className="result-name">{r.name}</span>
                        <span className="result-role">{r.role}</span>
                        <span className={`chip ${st}`}>{labelMap[st]}</span>
                        <span className="result-rank">#{i + 1}</span>
                      </div>
                      <p className="result-summary">{r.summary}</p>
                      <div className="result-tags">
                        {(r.matched_skills ?? []).slice(0, 5).map((s) => (
                          <span key={s} className="tag match">✓ {s}</span>
                        ))}
                        {(r.missing_skills ?? []).slice(0, 5).map((s) => (
                          <span key={s} className="tag miss">✕ {s}</span>
                        ))}
                      </div>
                      {r.fileName && (
                        <div className="result-file">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {r.fileName}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}
          </div>
        )}
      </main>
    </div>
  )
}
