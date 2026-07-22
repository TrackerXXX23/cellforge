import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { CYCLE_DURATION_SECONDS, getActiveSequenceIndex, sampleMotion } from './simulation'
import type { CellObject, CommissioningCheck, RunState, SequenceStep } from './types'

const CommissioningScene = lazy(() =>
  import('./Scene').then((module) => ({ default: module.CommissioningScene })),
)

const sequence: SequenceStep[] = [
  { id: 'locate', label: 'Locate raw part', target: 'Infeed A', duration: 1.8, accent: '#6472ca' },
  { id: 'pick', label: 'Pick part', target: 'Parallel gripper', duration: 2.4, accent: '#245df3' },
  { id: 'load', label: 'Load CNC', target: 'Machine 01', duration: 4.2, accent: '#1e7c75' },
  { id: 'unload', label: 'Unload finished part', target: 'Machine 01', duration: 4.0, accent: '#3a8e67' },
  { id: 'place', label: 'Place finished part', target: 'Outfeed B', duration: 2.4, accent: '#7b9566' },
]

const objectDetails: Record<CellObject, { name: string; eyebrow: string; specs: [string, string][] }> = {
  robot: {
    name: 'CF–12 collaborative arm',
    eyebrow: 'Motion device',
    specs: [['Payload', '12.5 kg'], ['Reach', '1,300 mm'], ['TCP', 'Parallel grip'], ['Frame', 'robot_base']],
  },
  cnc: {
    name: 'CNC mill · Machine 01',
    eyebrow: 'Process equipment',
    specs: [['Door', 'Discrete I/O'], ['Chuck', 'PLC handshake'], ['Cycle', '42.0 s'], ['Frame', 'cnc_work']],
  },
  infeed: {
    name: 'Raw-part fixture A',
    eyebrow: 'Material flow',
    specs: [['Slots', '6'], ['Pitch', '420 mm'], ['Detection', 'Vision'], ['Frame', 'infeed_a']],
  },
  outfeed: {
    name: 'Finished-part fixture B',
    eyebrow: 'Material flow',
    specs: [['Slots', '6'], ['Occupied', '3'], ['Mode', 'Indexed'], ['Frame', 'outfeed_b']],
  },
}

function Icon({ name, size = 18 }: { name: 'play' | 'spark' | 'cube' | 'check' | 'warning' | 'download' | 'reset' | 'eye'; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    play: <path d="m8 5 11 7-11 7V5Z" />,
    spark: <path d="m12 2 1.35 5.1L18 9l-4.65 1.9L12 16l-1.35-5.1L6 9l4.65-1.9L12 2Zm6 12 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" />,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 19h14" /></>,
    reset: <><path d="M4 8V4h4" /><path d="M5.2 5.2A8 8 0 1 1 4 14" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export default function App() {
  const [selected, setSelected] = useState<CellObject>('robot')
  const [runState, setRunState] = useState<RunState>('ready')
  const [progress, setProgress] = useState(0)
  const [faultInjected, setFaultInjected] = useState(false)
  const [showEnvelope, setShowEnvelope] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const startedAt = useRef(0)
  const details = objectDetails[selected]

  const checks: CommissioningCheck[] = useMemo(() => [
    { id: 'reach', label: 'Motion boundaries', detail: faultInjected ? 'Shifted infeed target fails the approved workspace' : 'All sampled targets pass workspace and joint gates', status: faultInjected ? 'fail' : 'pass' },
    { id: 'clearance', label: 'Path clearance', detail: faultInjected ? 'Segment P02 passes fixture by 9 mm' : 'Minimum clearance 84 mm', status: faultInjected ? 'warn' : 'pass' },
    { id: 'interlock', label: 'Safety interlocks', detail: 'Door, chuck, and scanner mapped', status: 'pass' },
    { id: 'cycle', label: 'Estimated cycle', detail: faultInjected ? '16.3 s · target ≤ 16.0 s' : '14.8 s · target ≤ 16.0 s', status: faultInjected ? 'warn' : 'pass' },
  ], [faultInjected])

  const passedChecks = checks.filter((check) => check.status === 'pass').length
  const isDeployable = checks.every((check) => check.status === 'pass')
  const activeStep = getActiveSequenceIndex(progress)
  const motion = sampleMotion(progress, runState)

  useEffect(() => {
    if (runState !== 'running') return

    let frame = 0
    startedAt.current = performance.now() - progress * CYCLE_DURATION_SECONDS * 1000

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt.current) / (CYCLE_DURATION_SECONDS * 1000))
      setProgress(nextProgress)

      if (nextProgress >= 1) {
        setRunState('complete')
        setToast('Simulation complete · 14.8 s cycle verified')
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [runState])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function runSimulation() {
    if (!isDeployable) {
      setToast('Cycle blocked · restore the commissioned fixture position first')
      return
    }

    setProgress(0)
    setRunState('running')
    setToast('Digital twin synchronized · executing approved sequence')
  }

  function resetCell() {
    setRunState('ready')
    setProgress(0)
    setFaultInjected(false)
    setToast('Cell returned to commissioned baseline')
  }

  function toggleFault() {
    setFaultInjected((current) => !current)
    setRunState('ready')
    setProgress(0)
    setSelected('infeed')
  }

  function deployArtifact() {
    if (!isDeployable) {
      setToast('Deployment blocked · resolve preflight findings')
      return
    }

    const artifact = {
      schema: 'cellforge.job/v1',
      job: 'OP-1042 · CNC housing',
      generatedAt: new Date().toISOString(),
      cell: { robot: 'CF-12', machine: 'cnc-01', safetyProfile: 'collaborative-a' },
      sequence: sequence.map(({ id, target, duration }) => ({ skill: id, target, expectedDuration: duration })),
      validation: { status: 'passed', checks: checks.map(({ id, status }) => ({ id, status })) },
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cellforge-op-1042.json'
    link.click()
    URL.revokeObjectURL(url)
    setToast('Deployment artifact exported')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <div className="brand-name">CELLFORGE</div>
            <div className="brand-subtitle">Virtual commissioning workbench</div>
          </div>
        </div>

        <div className="job-identity">
          <span className="status-dot" />
          <div>
            <span className="micro-label">ACTIVE JOB</span>
            <strong>OP-1042 · CNC housing</strong>
          </div>
        </div>

        <div className="header-actions">
          <button className="icon-button" onClick={resetCell} title="Reset commissioned cell"><Icon name="reset" /></button>
          <button className={`deploy-button ${!isDeployable ? 'blocked' : ''}`} onClick={deployArtifact}>
            <Icon name="download" size={16} />
            {isDeployable ? 'Export job' : 'Deploy blocked'}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-rail panel">
          <div className="panel-heading">
            <span className="micro-label">JOB INTENT</span>
            <span className="revision">REV 07</span>
          </div>
          <div className="intent-card">
            <div className="intent-icon"><Icon name="spark" /></div>
            <p>Load raw housings from fixture A, run the CNC cycle, then place finished parts in fixture B.</p>
            <span>Planner resolved 5 reusable skills</span>
          </div>

          <div className="section-label"><span>Sequence</span><span>{sequence.length} skills</span></div>
          <ol className="sequence-list">
            {sequence.map((step, index) => {
              const isActive = runState === 'running' && activeStep === index
              const isDone = runState === 'complete' || (runState === 'running' && activeStep > index)
              return (
                <li key={step.id} className={`${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <span className="step-track" style={{ '--step-color': step.accent } as React.CSSProperties}>
                    {isDone ? <Icon name="check" size={12} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="step-copy">
                    <strong>{step.label}</strong>
                    <small>{step.target}</small>
                  </span>
                  <time>{step.duration.toFixed(1)}s</time>
                </li>
              )
            })}
          </ol>

          <div className="runtime-bridge">
            <div><span className="pulse-dot" /><span>Runtime bridge</span></div>
            <strong>Synced 18 ms ago</strong>
          </div>
        </aside>

        <section className="viewport" aria-label="Interactive 3D robotic cell">
          <Suspense fallback={<div className="scene-loading"><span /><strong>Loading digital twin</strong></div>}>
            <CommissioningScene
              selected={selected}
              onSelect={setSelected}
              progress={progress}
              runState={runState}
              faultInjected={faultInjected}
              showEnvelope={showEnvelope}
            />
          </Suspense>

          <div className="viewport-meta">
            <span className="view-chip"><Icon name="cube" size={14} />Perspective · mm</span>
            <button className={`view-chip toggle ${showEnvelope ? 'on' : ''}`} onClick={() => setShowEnvelope((current) => !current)}>
              <Icon name="eye" size={14} />Reach envelope
            </button>
          </div>

          <div className={`commissioning-ribbon ${faultInjected ? 'has-fault' : ''}`}>
            <div className="ribbon-state">
              <span className="micro-label">COMMISSIONING STATE</span>
              <strong>{faultInjected ? 'Review required' : runState === 'running' ? motion.action : runState === 'complete' ? 'Cycle validated' : 'Ready to simulate'}</strong>
            </div>
            <div className="progress-track"><span style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>
            <div className="ribbon-metric"><span>Cycle</span><strong>{runState === 'running' ? `${(progress * CYCLE_DURATION_SECONDS).toFixed(1)} s` : `${CYCLE_DURATION_SECONDS.toFixed(1)} s`}</strong></div>
            <div className="ribbon-metric"><span>Clearance</span><strong>{faultInjected ? '9 mm' : '84 mm'}</strong></div>
            <button className="run-button" onClick={runSimulation} disabled={!isDeployable}>
              <Icon name={isDeployable ? 'play' : 'warning'} size={16} />{!isDeployable ? 'Resolve checks' : runState === 'running' ? 'Restart' : 'Run cycle'}
            </button>
          </div>
        </section>

        <aside className="right-rail panel">
          <div className="panel-heading stacked">
            <span className="micro-label">SELECTED COMPONENT</span>
            <strong>{details.name}</strong>
            <span>{details.eyebrow}</span>
          </div>

          <div className="spec-grid">
            {details.specs.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>

          <div className="section-label"><span>Preflight checks</span><span className={isDeployable ? 'score good' : 'score'}>{passedChecks}/{checks.length}</span></div>
          <ul className="check-list">
            {checks.map((check) => (
              <li key={check.id} className={check.status}>
                <span className="check-icon"><Icon name={check.status === 'pass' ? 'check' : 'warning'} size={14} /></span>
                <span><strong>{check.label}</strong><small>{check.detail}</small></span>
              </li>
            ))}
          </ul>

          <div className="fault-lab">
            <div>
              <span className="micro-label">REAL-WORLD VARIABILITY</span>
              <strong>Shift infeed fixture +180 mm</strong>
              <p>Test whether the commissioned job remains safe after a floor-layout change.</p>
            </div>
            <button className={faultInjected ? 'fault-active' : ''} onClick={toggleFault}>
              {faultInjected ? 'Restore baseline' : 'Inject fault'}
            </button>
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <div><span className="status-dot" />Cell runtime online</div>
        <div>Robot <strong>CF-12</strong></div>
        <div>Controller <strong>SimRT 4.8</strong></div>
        <div className="statusbar-spacer" />
        <div>Scene <strong>cell-cnc-07.glb</strong></div>
        <div className="coordinate-readout">X 0000.0&nbsp;&nbsp; Y 0000.0&nbsp;&nbsp; Z 0000.0</div>
      </footer>

      {toast && <div className="toast" role="status"><span className="status-dot" />{toast}</div>}
    </main>
  )
}
