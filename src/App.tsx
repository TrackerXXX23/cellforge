import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  evaluateCommissioning,
  recoveryProposals,
  type CausalTraceEntry,
  type RepairId,
} from './commissioning'
import { getActiveSequenceIndex, sampleMotion, type MotionPlan } from './simulation'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { CellObject, RunState, SequenceStep } from './types'

const CommissioningScene = lazy(() =>
  import('./Scene').then((module) => ({ default: module.CommissioningScene })),
)

const sequence: SequenceStep[] = [
  { id: 'locate', label: 'Locate raw part', target: 'Infeed A', duration: 2.8, accent: '#65706e' },
  { id: 'pick', label: 'Pick part', target: 'Robotiq 2F-85', duration: 3.8, accent: '#245df3' },
  { id: 'load', label: 'Load CNC', target: 'Machine 01', duration: 6.8, accent: '#245df3' },
  { id: 'unload', label: 'Unload finished part', target: 'Machine 01', duration: 6.4, accent: '#245df3' },
  { id: 'place', label: 'Place finished part', target: 'Outfeed B', duration: 4.2, accent: '#245df3' },
]

const baselineEvaluation = evaluateCommissioning({ fixtureShiftMm: 0, repairId: null })

const objectDetails: Record<CellObject, { name: string; eyebrow: string; specs: [string, string][] }> = {
  robot: {
    name: 'Universal Robots UR20',
    eyebrow: 'Licensed URDF model',
    specs: [['Payload', '20 kg'], ['Reach', '1,750 mm'], ['EOAT', 'Robotiq 2F-85'], ['TCP', '156 mm']],
  },
  cnc: {
    name: 'CNC mill · Machine 01',
    eyebrow: 'CellForge-authored GLB',
    specs: [['Door', 'Discrete I/O'], ['Vise', 'Pneumatic fixture'], ['Cycle', '42.0 s'], ['Frame', 'cnc_work']],
  },
  infeed: {
    name: 'Raw-part fixture A',
    eyebrow: 'Material flow',
    specs: [['Slots', '6'], ['Position X', '−1,550 mm'], ['Detection', 'Vision'], ['Frame', 'infeed_a']],
  },
  outfeed: {
    name: 'Finished-part fixture B',
    eyebrow: 'Material flow',
    specs: [['Slots', '6'], ['Occupied', '3'], ['Mode', 'Indexed'], ['Frame', 'outfeed_b']],
  },
}

const workflowPhases = ['Configure', 'Validate', 'Run', 'Release'] as const
type WorkflowPhase = (typeof workflowPhases)[number]

function Icon({ name, size = 18 }: { name: 'play' | 'cube' | 'check' | 'warning' | 'download' | 'eye' | 'arrow'; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    play: <path d="m8 5 11 7-11 7V5Z" />,
    cube: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5" /></>,
    check: <path d="m5 12 4 4 10-10" />,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M5 19h14" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
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
  const [fixtureShiftMm, setFixtureShiftMm] = useState(0)
  const [previewRepair, setPreviewRepair] = useState<RepairId | null>(null)
  const [appliedRepair, setAppliedRepair] = useState<RepairId | null>(null)
  const [released, setReleased] = useState(false)
  const [showEnvelope, setShowEnvelope] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const startedAt = useRef(0)

  const activeRepair = previewRepair ?? appliedRepair
  const activeEvaluation = useMemo(
    () => evaluateCommissioning({ fixtureShiftMm, repairId: activeRepair }),
    [activeRepair, fixtureShiftMm],
  )
  const committedEvaluation = useMemo(
    () => evaluateCommissioning({ fixtureShiftMm, repairId: appliedRepair }),
    [appliedRepair, fixtureShiftMm],
  )
  const motionPlan: MotionPlan = useMemo(() => ({
    infeedApproachTarget: committedEvaluation.approachTarget,
    infeedPickTarget: committedEvaluation.pickTarget,
  }), [committedEvaluation.approachTarget, committedEvaluation.pickTarget])
  const motion = sampleMotion(progress, runState, motionPlan)
  const activeStep = getActiveSequenceIndex(progress)
  const isChanged = fixtureShiftMm !== 0
  const checksPassed = activeEvaluation.checks.filter((check) => check.status === 'pass').length
  const details = objectDetails[selected]
  const canRun = committedEvaluation.deployable && previewRepair === null && !released
  const canRelease = isChanged && appliedRepair !== null && runState === 'complete' && !released

  const activePhase: WorkflowPhase = released || runState === 'complete'
    ? 'Release'
    : runState === 'running' || appliedRepair !== null
      ? 'Run'
      : isChanged
        ? 'Validate'
        : 'Configure'

  const pathState = !isChanged
    ? 'baseline'
    : previewRepair
      ? 'preview'
      : appliedRepair
        ? 'repaired'
        : 'blocked'

  useEffect(() => {
    if (runState !== 'running') return

    let frame = 0
    let lastProgressUpdate = 0
    startedAt.current = performance.now() - progress * committedEvaluation.cycleSeconds * 1000

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt.current) / (committedEvaluation.cycleSeconds * 1000))
      if (nextProgress >= 1 || now - lastProgressUpdate >= 1000 / 30) {
        setProgress(nextProgress)
        lastProgressUpdate = now
      }

      if (nextProgress >= 1) {
        setRunState('complete')
        setToast(`Repaired cycle verified · ${committedEvaluation.cycleSeconds.toFixed(1)} s`)
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [committedEvaluation.cycleSeconds, runState])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function resetExecution() {
    setRunState('ready')
    setProgress(0)
    setReleased(false)
  }

  function recordFixtureChange() {
    setFixtureShiftMm(180)
    setPreviewRepair(null)
    setAppliedRepair(null)
    resetExecution()
    setSelected('infeed')
    setToast('Revision 08 draft created · Fixture A moved +180 mm')
  }

  function restoreBaseline() {
    setFixtureShiftMm(0)
    setPreviewRepair(null)
    setAppliedRepair(null)
    resetExecution()
    setSelected('infeed')
    setToast('Fixture A restored to the commissioned Revision 07 pose')
  }

  function previewCandidate(id: RepairId) {
    setPreviewRepair(id)
    resetExecution()
    setSelected('infeed')
    const proposal = recoveryProposals.find((candidate) => candidate.id === id)
    setToast(`Previewing ${proposal?.label.toLowerCase() ?? 'repair candidate'}`)
  }

  function applyCandidate() {
    if (!previewRepair) return
    const proposal = recoveryProposals.find((candidate) => candidate.id === previewRepair)
    setAppliedRepair(previewRepair)
    setPreviewRepair(null)
    resetExecution()
    setSelected('robot')
    setToast(`${proposal?.label ?? 'Repair'} added to Revision 08`)
  }

  function runSimulation() {
    if (previewRepair) {
      setToast('Apply or discard the preview before running the cycle')
      return
    }

    if (!committedEvaluation.deployable) {
      setToast('Run blocked · resolve P02 clearance first')
      return
    }

    setProgress(0)
    setRunState('running')
    setToast(`Executing Revision ${isChanged ? '08' : '07'} against the validated motion plan`)
  }

  function releaseRevision() {
    if (!canRelease) {
      setToast(isChanged ? 'Release blocked · validate and run the repaired cycle first' : 'Record a change to create Revision 08')
      return
    }

    const artifact = {
      schema: 'cellforge.job/v1',
      job: 'OP-1042 · CNC housing',
      revision: 8,
      generatedAt: new Date().toISOString(),
      change: committedEvaluation.revisionDelta,
      motion: {
        approachTarget: committedEvaluation.approachTarget,
        pickTarget: committedEvaluation.pickTarget,
        repairId: appliedRepair,
      },
      validation: {
        status: 'passed',
        method: committedEvaluation.clearanceMethod,
        minimumClearanceMm: committedEvaluation.minimumClearanceMm,
        cycleSeconds: committedEvaluation.cycleSeconds,
        checks: committedEvaluation.checks,
      },
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cellforge-op-1042-r08.json'
    link.click()
    URL.revokeObjectURL(url)
    setReleased(true)
    setToast('Revision 08 released · deployment artifact acknowledged')
  }

  function selectTrace(entry: CausalTraceEntry) {
    if (entry.layer === 'physical-object' || entry.layer === 'motion-segment') setSelected('infeed')
    if (entry.layer === 'sequence-step') setSelected('robot')
    setToast(entry.label)
  }

  const stateTitle = released
    ? 'Revision 08 released'
    : runState === 'running'
      ? motion.action
      : runState === 'complete'
        ? 'Repaired cycle verified'
        : previewRepair
          ? 'Previewing repair candidate'
          : appliedRepair
            ? 'Revision 08 ready to run'
            : isChanged
              ? 'Revision 08 blocked'
              : 'Revision 07 is commissioned'

  const releaseLabel = released
    ? 'Revision 08 released'
    : canRelease
      ? 'Release revision 08'
      : isChanged
        ? 'Release blocked'
        : 'Revision 07 validated'

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

        <div className="workflow-header">
          <div className="job-identity">
            <div>
              <span className="micro-label">CELLS / CNC-01</span>
              <strong>OP-1042 · CNC housing</strong>
            </div>
            <span className={`revision-chip ${isChanged && !released ? 'draft' : 'validated'}`}>
              REV {released ? '08 · RELEASED' : isChanged ? '08 · DRAFT' : '07 · VALIDATED'}
            </span>
          </div>
          <ol className="workflow-phases" aria-label="Commissioning workflow">
            {workflowPhases.map((phase) => {
              const phaseIndex = workflowPhases.indexOf(phase)
              const activeIndex = workflowPhases.indexOf(activePhase)
              return (
                <li key={phase} className={`${phase === activePhase ? 'active' : ''} ${phaseIndex < activeIndex ? 'complete' : ''}`}>
                  <span>{phaseIndex + 1}</span>{phase}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="header-actions">
          <button className={`deploy-button ${isChanged && !canRelease ? 'blocked' : ''} ${!isChanged || released ? 'released' : ''}`} onClick={releaseRevision} disabled={released || !isChanged}>
            <Icon name={!isChanged || released ? 'check' : canRelease ? 'download' : 'warning'} size={16} />
            {releaseLabel}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-rail panel">
          <div className="revision-summary">
            <div className="panel-heading">
              <span className="micro-label">ACTIVE REVISION</span>
              <span className={`revision ${isChanged && !released ? 'draft' : ''}`}>REV {isChanged ? '08' : '07'}</span>
            </div>
            <div className="revision-copy">
              <strong>{released ? 'Released revision' : isChanged ? 'Commissioning draft' : 'Commissioned baseline'}</strong>
              <p>{released ? 'SimRT acknowledged · evidence attached' : isChanged ? '1 layout change · 1 affected path' : 'Validated 21 Jul · 14:32'}</p>
              {isChanged && <span>{released ? 'Revision 08 · immutable release record' : 'Compared with Revision 07'}</span>}
            </div>
          </div>

          <div className="section-label"><span>Sequence</span><span>{sequence.length} skills</span></div>
          <ol className="sequence-list">
            {sequence.map((step, index) => {
              const isActive = runState === 'running' && activeStep === index
              const isDone = runState === 'complete' || (runState === 'running' && activeStep > index)
              const isAffected = isChanged && step.id === 'pick'
              const isResolved = isAffected && appliedRepair !== null
              return (
                <li key={step.id} className={`${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${isAffected && !isResolved ? 'affected' : ''} ${isResolved ? 'resolved' : ''}`}>
                  <span className="step-track" style={{ '--step-color': step.accent } as React.CSSProperties}>
                    {isDone ? <Icon name="check" size={12} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="step-copy">
                    <strong>{step.label}</strong>
                    <small>{isAffected ? (isResolved ? 'P02 repaired for Revision 08' : 'Blocked by P02 clearance') : step.target}</small>
                  </span>
                  <time>{step.duration.toFixed(1)}s</time>
                </li>
              )
            })}
          </ol>

          <div className="runtime-bridge">
            <div><span className={`pulse-dot ${runState === 'running' ? 'running' : ''}`} /><span>Deterministic runtime</span></div>
            <strong>{runState === 'running' ? 'Executing current revision' : runState === 'complete' ? 'Cycle evidence captured' : 'Ready · local simulation'}</strong>
          </div>
        </aside>

        <section className="viewport" aria-label="Interactive 3D robotic cell">
          <SceneErrorBoundary>
            <Suspense fallback={<div className="scene-loading"><span /><strong>Loading cell digital twin</strong></div>}>
              <CommissioningScene
                selected={selected}
                onSelect={setSelected}
                progress={progress}
                runState={runState}
                faultInjected={false}
                showEnvelope={showEnvelope}
                fixtureShiftMm={fixtureShiftMm}
                baselinePath={baselineEvaluation.pathPoints}
                activePath={activeEvaluation.pathPoints}
                pathState={pathState}
                showRevisionGhost={isChanged}
                motionPlan={motionPlan}
              />
            </Suspense>
          </SceneErrorBoundary>

          <div className="viewport-meta">
            <span className="view-chip"><Icon name="cube" size={14} />Tool tracking · mm</span>
            <button className={`view-chip toggle ${showEnvelope ? 'on' : ''}`} onClick={() => setShowEnvelope((current) => !current)}>
              <Icon name="eye" size={14} />Reach envelope
            </button>
            {isChanged && <span className="view-chip delta-chip">REV 07 → 08&nbsp;&nbsp; ΔX +180 mm</span>}
          </div>

          <div className={`commissioning-ribbon ${pathState === 'blocked' ? 'has-fault' : ''} ${pathState === 'repaired' ? 'has-repair' : ''}`}>
            <div className="ribbon-state">
              <span className="micro-label">{pathState === 'blocked' ? 'VALIDATION BLOCKED' : previewRepair ? 'REPAIR PREVIEW' : runState === 'complete' ? 'CYCLE VERIFIED' : 'COMMISSIONING STATE'}</span>
              <strong>{stateTitle}</strong>
            </div>
            <div className="progress-track"><span style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>
            <div className="ribbon-metric"><span>Cycle</span><strong>{activeEvaluation.cycleSeconds.toFixed(1)} s</strong></div>
            <div className="ribbon-metric"><span>Clearance</span><strong>{activeEvaluation.minimumClearanceMm} mm</strong></div>
            {released ? (
              <button className="run-button release-action" disabled><Icon name="check" size={16} />Revision released</button>
            ) : previewRepair ? (
              <button className="run-button preview-action" onClick={applyCandidate}><Icon name="check" size={16} />Apply repair</button>
            ) : runState === 'complete' && isChanged ? (
              <button className="run-button release-action" onClick={releaseRevision}><Icon name="download" size={16} />Release Rev 08</button>
            ) : (
              <button className="run-button" onClick={runSimulation} disabled={!canRun}>
                <Icon name={canRun ? 'play' : 'warning'} size={16} />{canRun ? (runState === 'running' ? 'Restart cycle' : isChanged ? 'Run repaired cycle' : 'Replay baseline') : 'Resolve P02'}
              </button>
            )}
          </div>
        </section>

        <aside className="right-rail panel">
          {!isChanged ? (
            <>
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
              <div className="baseline-evidence">
                <span className="micro-label">COMMISSIONED EVIDENCE</span>
                <strong>Revision 07 passes all gates</strong>
                <p>{baselineEvaluation.cycleSeconds.toFixed(1)} s cycle · 84 mm minimum clearance · {checksPassed}/{activeEvaluation.checks.length} checks passed</p>
              </div>
              <div className="change-action">
                <span className="micro-label">RECORD A FLOOR CHANGE</span>
                <strong>Fixture A measured +180 mm on X</strong>
                <p>Compare the measured pose with the commissioned revision before running the cell.</p>
                <button onClick={recordFixtureChange}>Update fixture position <Icon name="arrow" size={15} /></button>
              </div>
            </>
          ) : (
            <>
              <div className="panel-heading impact-heading">
                <div>
                  <span className="micro-label">{released ? 'REVISION 08 · RELEASED' : appliedRepair ? 'REVISION 08 · REPAIRED' : previewRepair ? 'REPAIR PREVIEW · NOT APPLIED' : 'BLOCKING FINDING · V-014'}</span>
                  <strong>{released ? 'Runtime acknowledged the repaired job' : appliedRepair ? 'Repair passes commissioning gates' : previewRepair ? `${recoveryProposals.find((proposal) => proposal.id === previewRepair)?.label} clears P02` : 'P02 swept envelope enters Fixture A keep-out'}</strong>
                  <p>{released ? `${activeEvaluation.cycleSeconds.toFixed(1)} s cycle evidence and ${activeEvaluation.minimumClearanceMm} mm clearance were attached to the release.` : appliedRepair ? `${activeEvaluation.minimumClearanceMm} mm predicted clearance · ${activeEvaluation.cycleSeconds.toFixed(1)} s cycle. ${runState === 'complete' ? 'The verification run passed and the draft is ready for release.' : 'The repair is saved in the draft and must complete a verification run.'}` : previewRepair ? `${activeEvaluation.minimumClearanceMm} mm predicted clearance · ${activeEvaluation.cycleSeconds.toFixed(1)} s cycle. The commissioned job is unchanged until this candidate is applied.` : 'Fixture A moved 180 mm. The pick remains reachable, but P02 now violates the 50 mm clearance rule.'}</p>
                </div>
              </div>

              <div className="impact-metrics">
                <div><span>Pose delta</span><strong>ΔX +180 mm</strong></div>
                <div><span>Segment</span><strong>P02</strong></div>
                <div><span>{released || runState === 'complete' ? 'Verified' : activeEvaluation.deployable ? 'Predicted' : 'Measured'}</span><strong>{activeEvaluation.minimumClearanceMm} mm</strong></div>
                <div><span>Required</span><strong>50 mm</strong></div>
              </div>

              <div className="section-label"><span>Causal trace</span><span>{appliedRepair ? 'Resolved' : previewRepair ? 'Candidate' : '1 blocker'}</span></div>
              <ol className="causal-trace">
                {activeEvaluation.causalTrace.map((entry) => (
                  <li key={entry.layer} className={entry.status}>
                    <button onClick={() => selectTrace(entry)}>
                      <span className="trace-node" />
                      <span><small>{entry.layer.replace('-', ' ')}</small><strong>{released && entry.layer === 'deployment-gate' ? 'Revision 08 released to SimRT' : entry.label}</strong></span>
                    </button>
                  </li>
                ))}
              </ol>

              {!appliedRepair && (
                <>
                  <div className="section-label"><span>Recovery options</span><span>Constraint-derived</span></div>
                  <div className="repair-list">
                    {recoveryProposals.map((proposal, index) => {
                      const evaluation = evaluateCommissioning({ fixtureShiftMm, repairId: proposal.id })
                      const selectedProposal = previewRepair === proposal.id
                      return (
                        <button key={proposal.id} className={`repair-card ${selectedProposal ? 'selected' : ''}`} onClick={() => previewCandidate(proposal.id)}>
                          <span className="repair-label">{index === 0 ? 'RECOMMENDED · NO PHYSICAL CHANGE' : 'ALTERNATE PATH'}</span>
                          <strong>{proposal.label}</strong>
                          <p>{proposal.description}</p>
                          <span className="repair-metrics">
                            <span><small>Clearance</small><strong>{evaluation.minimumClearanceMm} mm</strong></span>
                            <span><small>Cycle</small><strong>+{evaluation.revisionDelta.cycleDeltaSeconds.toFixed(1)} s</strong></span>
                            <span><small>Waypoints</small><strong>{proposal.changedWaypointIds.length}</strong></span>
                          </span>
                          <span className="repair-cta">{selectedProposal ? 'Previewing in cell' : 'Preview repair'} <Icon name="arrow" size={14} /></span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {appliedRepair && (
                <div className="repair-applied">
                  <span className="micro-label">{released ? 'RELEASE RECORD' : 'REPAIR APPLIED'}</span>
                  <strong>{recoveryProposals.find((proposal) => proposal.id === appliedRepair)?.label}</strong>
                  <p>{released ? `OP-1042-r08 · ${activeEvaluation.revisionDelta.modifiedWaypointIds.length} changed revision fields · validation evidence attached.` : runState === 'complete' ? `${activeEvaluation.revisionDelta.modifiedWaypointIds.length} revision fields changed. Complete cycle evidence is ready for release.` : `${activeEvaluation.revisionDelta.modifiedWaypointIds.length} revision fields changed. Run the complete cycle before release.`}</p>
                </div>
              )}

              {!released && <button className="restore-link" onClick={restoreBaseline}>Restore Revision 07 fixture position</button>}
            </>
          )}
        </aside>
      </section>

      <footer className="statusbar">
        <div><span className="status-dot" />{released ? 'Runtime acknowledged OP-1042-r08' : 'Simulation runtime ready'}</div>
        <div>Robot <strong>UR20</strong></div>
        <div>Controller <strong>SimRT 4.8</strong></div>
        <div className="statusbar-spacer" />
        <div>Revision <strong>{released ? '08 released' : isChanged ? '08 draft' : '07 validated'}</strong></div>
        <div className="coordinate-readout">X {fixtureShiftMm.toFixed(1)}&nbsp;&nbsp; Y 0000.0&nbsp;&nbsp; Z 0000.0</div>
      </footer>

      {toast && <div className="toast" role="status"><span className="status-dot" />{toast}</div>}
    </main>
  )
}
