import { COLLISION_COVERAGE } from './cellBodies'
import type { LayoutSearchResult, SearchRequest } from './layoutSearch'
import { MAX_JOINT_ACCELERATION, MAX_JOINT_JERK } from './ur20Ik'
import { LAYOUT_PRESETS, REFERENCE_LAYOUT, layoutTarget } from './cellLayout'
import type { PlanningEvidence, PlanningRequest } from './pathPlanning'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptsTelemetry, createCycleEvidence, CYCLE_SAMPLES, isCycleVerified, recordAcceptedSample,
  type CycleEvidence, type MotionTelemetry,
} from './cycleAcceptance'
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
  { id: 'pick', label: 'Pick part', target: 'Twisting three-jaw gripper', duration: 3.8, accent: '#245df3' },
  { id: 'load', label: 'Load CNC', target: 'Machine 01', duration: 6.8, accent: '#245df3' },
  { id: 'unload', label: 'Unload finished part', target: 'Machine 01', duration: 6.4, accent: '#245df3' },
  { id: 'place', label: 'Place finished part', target: 'Outfeed B', duration: 4.2, accent: '#245df3' },
]

const objectDetails: Record<CellObject, { name: string; eyebrow: string; specs: [string, string][] }> = {
  robot: {
    name: 'Universal Robots UR20',
    eyebrow: 'Licensed URDF model',
    specs: [['Payload', '20 kg'], ['Reach', '1,750 mm'], ['EOAT', 'Twisting 3-jaw'], ['TCP', '140 mm']],
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
  const [layout, setLayout] = useState(REFERENCE_LAYOUT)
  const [transferLift, setTransferLift] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchProgress, setSearchProgress] = useState({done:0, total:0})
  const [searchEvidence, setSearchEvidence] = useState<LayoutSearchResult | null>(null)
  const searchRequest = useRef<SearchRequest | null>(null)
  const [planning, setPlanning] = useState(false)
  const [planningEvidence, setPlanningEvidence] = useState<(PlanningEvidence & { revisionKey: string }) | null>(null)
  const planningRequest = useRef<PlanningRequest | null>(null)
  const planningGeneration = useRef(0)
  const [selected, setSelected] = useState<CellObject>('robot')
  const [runState, setRunState] = useState<RunState>('ready')
  const [progress, setProgress] = useState(0)
  const [fixtureShiftMm, setFixtureShiftMm] = useState(0)
  const [previewRepair, setPreviewRepair] = useState<RepairId | null>(null)
  const [appliedRepair, setAppliedRepair] = useState<RepairId | null>(null)
  const [released, setReleased] = useState(false)
  const [showEnvelope, setShowEnvelope] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const waitingMs = useRef(0)
  const telemetry = useRef<MotionTelemetry | null>(null)
  const evidence = useRef<CycleEvidence | null>(null)
  const [runId, setRunId] = useState(0)
  const revisionKey = JSON.stringify({ layout, fixtureShiftMm, appliedRepair, transferLift, version: 'ur20-cycle/v5-cell-contact' })
  const motionToken = `${revisionKey}:${runId}`

  const baselineEvaluation = useMemo(() => evaluateCommissioning({ layout, fixtureShiftMm: 0, repairId: null }), [layout])
  const activeRepair = previewRepair ?? appliedRepair
  const activeEvaluation = useMemo(
    () => evaluateCommissioning({ layout, transferLift, fixtureShiftMm, repairId: activeRepair }),
    [activeRepair, fixtureShiftMm, layout, transferLift],
  )
  const committedEvaluation = useMemo(
    () => evaluateCommissioning({ layout, transferLift, fixtureShiftMm, repairId: appliedRepair }),
    [appliedRepair, fixtureShiftMm, layout, transferLift],
  )
  const motionPlan: MotionPlan = useMemo(() => ({
    infeedApproachTarget: committedEvaluation.approachTarget,
    infeedPickTarget: committedEvaluation.pickTarget,
    outfeedPlaceTarget: layoutTarget(layout, 'outfeed'),
    transferLift,
  }), [committedEvaluation.approachTarget, committedEvaluation.pickTarget, layout, transferLift])
  const motion = sampleMotion(progress, runState, motionPlan)
  const activeStep = getActiveSequenceIndex(progress)
  const isChanged = fixtureShiftMm !== 0
  const isLayoutChanged = layout.id !== REFERENCE_LAYOUT.id
  const isDraft = isChanged || isLayoutChanged || transferLift !== 0
  const checksPassed = activeEvaluation.checks.filter((check) => check.status === 'pass').length
  const details = objectDetails[selected]
  const canRun = committedEvaluation.deployable && previewRepair === null && !released && !planning && !searching
  const canRelease = isDraft && (!isChanged || appliedRepair !== null) && runState === 'complete'
    && isCycleVerified(evidence.current, revisionKey) && committedEvaluation.deployable
    && previewRepair === null && !released && planningEvidence?.revisionKey === revisionKey && planningEvidence.failure === null && planningEvidence.acceptedSamples === CYCLE_SAMPLES + 1
  const isExecutionActive = runState === 'running' || runState === 'paused'

  const activePhase: WorkflowPhase = released || runState === 'complete'
    ? 'Release'
    : isExecutionActive || appliedRepair !== null
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
    let currentProgress = progress
    let lastTick = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - lastTick)
      lastTick = now
      const result = evidence.current
      if (import.meta.env.DEV) {
        Object.assign(window, { __CELLFORGE_CYCLE__: {
          evidence: result, telemetry: telemetry.current, motionToken, currentProgress, waitingMs: waitingMs.current,
        } })
      }
      if (!result || result.revisionKey !== revisionKey) return
      result.elapsedSeconds += elapsed / 1000
      waitingMs.current += elapsed
      if (telemetry.current?.token === motionToken && (telemetry.current.contactFailure || telemetry.current.continuityFailure)) {
        result.failure = telemetry.current.contactFailure || telemetry.current.continuityFailure
        setRunState('failed')
        setToast(result.failure!)
        return
      }
      if (acceptsTelemetry(telemetry.current, motionToken, currentProgress, performance.now())
          && waitingMs.current >= committedEvaluation.cycleSeconds * 1000 / CYCLE_SAMPLES) {
        recordAcceptedSample(result, telemetry.current!)
        if (isCycleVerified(result, revisionKey)) {
          setRunState('complete')
          setToast('Cycle verified · all 1441 sampled UR20 poses accepted')
          return
        }
        currentProgress = result.acceptedSamples / CYCLE_SAMPLES
        setProgress(currentProgress)
        waitingMs.current = Math.min(
          waitingMs.current - committedEvaluation.cycleSeconds * 1000 / CYCLE_SAMPLES,
          committedEvaluation.cycleSeconds * 1000 / CYCLE_SAMPLES,
        )
      } else if (waitingMs.current > 8000) {
        result.failure = `Motion acceptance timed out at ${(currentProgress * 100).toFixed(1)}% · check TCP tracking, solver and joint limits`
        setRunState('failed')
        setToast(result.failure!)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [committedEvaluation.cycleSeconds, runState, motionToken, revisionKey])

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (runState !== 'running' && runState !== 'paused') return

      event.preventDefault()
      toggleExecutionPause()
    }

    window.addEventListener('keydown', handleSpacebar)
    return () => window.removeEventListener('keydown', handleSpacebar)
  }, [runState])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function resetExecution() {
    setSearching(false)
    setSearchEvidence(null)
    planningGeneration.current++
    setPlanning(false)
    setPlanningEvidence(null)
    waitingMs.current = 0
    evidence.current = null
    telemetry.current = null
    setRunId((id) => id + 1)
    setRunState('ready')
    setProgress(0)
    setReleased(false)
  }

  function recordFixtureChange() {
    setTransferLift(0)
    setFixtureShiftMm(180)
    setPreviewRepair(null)
    setAppliedRepair(null)
    resetExecution()
    setSelected('infeed')
    setToast('Revision 08 draft created · Fixture A moved +180 mm')
  }

  function restoreBaseline() {
    setTransferLift(0)
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

  async function findBestLayout() {
    const request = searchRequest.current
    if (!request) { setToast('Search geometry is still loading'); return }
    if (searching || planning || isExecutionActive || released) return
    resetExecution()
    const generation = planningGeneration.current
    setSearching(true)
    let result: LayoutSearchResult
    try {
      result = await request(fixtureShiftMm, () => generation !== planningGeneration.current,
        (done, total) => { if (generation === planningGeneration.current) setSearchProgress({done,total}) })
    } catch (error) {
      if (generation !== planningGeneration.current) return
      setSearching(false)
      setToast(`Search failed: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (generation !== planningGeneration.current) return
    setSearching(false)
    if (result.cancelled || !result.best) {
      setSearchEvidence(result)
      setToast('No passing candidate found · layout unchanged')
      return
    }
    const winner = result.best.candidate
    setLayout(winner.layout)
    setAppliedRepair(winner.repairId)
    setPreviewRepair(null)
    setTransferLift(winner.motionPlan.transferLift ?? 0)
    resetExecution()
    setSearchEvidence(result)
    setToast('Best passing layout and path applied · run to verify actual motion')
  }

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __CELLFORGE_SEARCH__: searchEvidence })
  }, [searchEvidence])

  async function runSimulation() {
    if (planning || searching || released) return
    if (previewRepair) {
      setToast('Apply or discard the preview before running the cycle')
      return
    }

    if (!committedEvaluation.deployable) {
      setToast('Run blocked · resolve P02 clearance first')
      return
    }

    const request = planningRequest.current
    if (!request) { setToast('Planning geometry is still loading'); return }
    const generation = ++planningGeneration.current
    setPlanning(true)
    setPlanningEvidence(null)
    setRunState('ready')
    setProgress(0)
    evidence.current = null
    let rehearsal: PlanningEvidence
    try {
      rehearsal = await request(motionPlan, () => generation !== planningGeneration.current)
    } catch (error) {
      if (generation !== planningGeneration.current) return
      setPlanning(false)
      setToast(`Planning failed: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (generation !== planningGeneration.current) return
    setPlanning(false)
    setPlanningEvidence({ ...rehearsal, revisionKey })
    if (rehearsal.failure || rehearsal.acceptedSamples !== CYCLE_SAMPLES + 1) {
      setToast(rehearsal.failure ?? 'Planning coverage incomplete')
      return
    }
    waitingMs.current = 0
    evidence.current = createCycleEvidence(revisionKey)
    telemetry.current = null
    setRunId((id) => id + 1)
    setProgress(0)
    setRunState('running')
    setToast(`Executing Revision ${isDraft ? '08' : '07'} against the validated motion plan`)
  }

  function toggleExecutionPause() {
    if (runState === 'running') {
      setRunState('paused')
      setToast('Cycle paused · press Space to resume')
      return
    }

    if (runState === 'paused') {
      setRunState('running')
      setToast('Cycle resumed')
    }
  }

  function releaseRevision() {
    if (!canRelease) {
      setToast(isDraft ? 'Release blocked · validate and run this layout first' : 'Record a change to create Revision 08')
      return
    }

    const artifact = {
      schema: 'cellforge.job/v2',
      delivery: { status: 'local-export', runtimeAcknowledged: false },
      layout,
      planningEvidence,
      searchEvidence,
      motionLimits: { jointAccelerationRadS2: MAX_JOINT_ACCELERATION, jointJerkRadS3: MAX_JOINT_JERK },
      cycleEvidence: { ...evidence.current, positionToleranceMm: 18, directionToleranceDegrees: 15, coverage: COLLISION_COVERAGE },
      job: 'OP-1042 · CNC housing',
      revision: 8,
      generatedAt: new Date().toISOString(),
      change: { ...committedEvaluation.revisionDelta, layoutFrom: REFERENCE_LAYOUT, layoutTo: layout },
      motion: {
        approachTarget: committedEvaluation.approachTarget,
        pickTarget: committedEvaluation.pickTarget,
        outfeedPlaceTarget: motionPlan.outfeedPlaceTarget,
        transferLift,
        repairId: appliedRepair,
      },
      validation: {
        status: 'passed',
        method: committedEvaluation.clearanceMethod,
        minimumClearanceMm: committedEvaluation.minimumClearanceMm,
        nominalCycleSeconds: committedEvaluation.cycleSeconds,
        measuredRunSeconds: evidence.current?.elapsedSeconds,
        checks: committedEvaluation.checks,
      },
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cellforge-op-1042-r08.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setReleased(true)
    setToast('Revision 08 released · local artifact exported')
  }

  function selectTrace(entry: CausalTraceEntry) {
    if (entry.layer === 'physical-object' || entry.layer === 'motion-segment') setSelected('infeed')
    if (entry.layer === 'sequence-step') setSelected('robot')
    setToast(entry.label)
  }

  const stateTitle = searching ? `Comparing candidates · ${searchProgress.done}/${searchProgress.total}` : planning ? 'Checking the full path before motion…' : planningEvidence?.failure ? planningEvidence.failure : released
    ? 'Revision 08 released'
    : runState === 'failed'
      ? evidence.current?.failure ?? 'Motion verification failed'
    : runState === 'running'
      ? motion.action
      : runState === 'paused'
        ? `Paused · ${motion.action}`
        : runState === 'complete'
          ? 'Cycle verified · 1441 measured poses'
          : previewRepair
            ? 'Previewing repair candidate'
            : appliedRepair
              ? 'Revision 08 ready to run'
              : isChanged
                ? 'Revision 08 blocked'
                : isDraft ? 'Layout/path candidate · run to verify' : 'Reference layout · run current checks'

  const releaseLabel = released
    ? 'Revision 08 released'
    : canRelease
      ? 'Release revision 08'
      : isDraft
        ? 'Release blocked'
        : 'Revision 07 · recheck required'

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
            <span className={`revision-chip ${!released ? 'draft' : 'validated'}`}>
              REV {released ? '08 · RELEASED' : isDraft ? '08 · DRAFT' : '07 · RECHECK'}
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
          <button className={`deploy-button ${!canRelease && !released ? 'blocked' : ''} ${released ? 'released' : ''}`} onClick={releaseRevision} disabled={released || !isDraft}>
            <Icon name={released ? 'check' : canRelease ? 'download' : 'warning'} size={16} />
            {releaseLabel}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-rail panel">
          <div className="revision-summary">
            <div className="panel-heading">
              <span className="micro-label">ACTIVE REVISION</span>
              <span className={`revision ${isDraft && !released ? 'draft' : ''}`}>REV {isDraft ? '08' : '07'}</span>
            </div>
            <div className="revision-copy">
              <strong>{released ? 'Released revision' : isDraft ? 'Commissioning draft' : 'Reference baseline'}</strong>
              <p>{released ? 'Local export · runtime not connected' : isDraft ? 'Layout candidate · full cycle required' : 'Reference layout · replay to verify'}</p>
              {isChanged && <span>{released ? 'Revision 08 · local export record' : 'Compared with Revision 07'}</span>}
            </div>
          </div>

          <div className="layout-controls">
            <label htmlFor="table-layout">Table placement</label>
            <select id="table-layout" value={layout.id} disabled={isExecutionActive || planning || searching || released} onChange={event => {
              const candidate = LAYOUT_PRESETS.find(value => value.id === event.target.value)!
              setLayout(candidate)
              setTransferLift(0)
              setFixtureShiftMm(0)
              setPreviewRepair(null)
              setAppliedRepair(null)
              resetExecution()
            }}>
              {LAYOUT_PRESETS.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}
            </select>
            <p>{layout.id === 'compact' ? 'Both tables move 150 mm inward on X and Z. Full-path check required.' : 'Original commissioning layout.'}</p>
            <button className="search-layout-button" disabled={isExecutionActive || planning || searching || released} onClick={findBestLayout}>
              {searching ? `Comparing ${searchProgress.done}/${searchProgress.total}…` : 'Find best layout & path'}
            </button>
            {searchEvidence && <p>{searchEvidence.best ? `Selected ${searchEvidence.best.candidate.layout.label.toLowerCase()} · ${searchEvidence.best.candidate.motionPlan.transferLift ? 'raised' : 'standard'} transfer · ${searchEvidence.best.evidence!.simulatedSeconds.toFixed(1)} s rehearsal` : 'No passing candidate · layout unchanged'} · {searchEvidence.candidates.filter(value => value.failure === null).length}/{searchEvidence.candidates.length} passed</p>}
            <p>Transfer height: {transferLift ? '+100 mm' : 'standard'} · joint jerk limit {MAX_JOINT_JERK} rad/s³</p>
            <p role="status">{planning ? 'Rehearsing all 1441 poses…' : planningEvidence ? planningEvidence.failure ?? `Path checked · ${planningEvidence.simulatedSeconds.toFixed(1)} s rehearsal · ${planningEvidence.tcpTravelMeters.toFixed(2)} m TCP travel` : 'Run checks loaded geometry before moving.'}</p>
          </div>
          <div className="section-label"><span>Sequence</span><span>{sequence.length} skills</span></div>
          <ol className="sequence-list">
            {sequence.map((step, index) => {
              const isActive = isExecutionActive && activeStep === index
              const isDone = runState === 'complete' || (isExecutionActive && activeStep > index)
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
            <strong>{runState === 'running' ? 'Executing current revision' : runState === 'paused' ? 'Execution paused · Space to resume' : runState === 'complete' ? 'Cycle evidence captured' : runState === 'failed' ? 'Verification failed · release blocked' : 'Ready · local simulation'}</strong>
          </div>
        </aside>

        <section className="viewport" aria-label="Interactive 3D robotic cell">
          <SceneErrorBoundary>
            <Suspense fallback={<div className="scene-loading"><span /><strong>Loading cell digital twin</strong></div>}>
              <CommissioningScene
                layout={layout}
                planningRequest={planningRequest}
                searchRequest={searchRequest}
                selected={selected}
                onSelect={setSelected}
                telemetry={telemetry}
                motionToken={motionToken}
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
            <span className="view-chip"><Icon name="cube" size={14} />Cell overview · m</span>
            <button className={`view-chip toggle ${showEnvelope ? 'on' : ''}`} onClick={() => setShowEnvelope((current) => !current)}>
              <Icon name="eye" size={14} />Reach envelope
            </button>
            {isChanged && <span className="view-chip delta-chip">REV 07 → 08&nbsp;&nbsp; ΔX +180 mm</span>}
          </div>

          <div className={`commissioning-ribbon ${pathState === 'blocked' || runState === 'failed' || planningEvidence?.failure ? 'has-fault' : ''} ${pathState === 'repaired' ? 'has-repair' : ''}`}>
            <div className="ribbon-state">
              <span className="micro-label">{planningEvidence?.failure ? 'PLANNING BLOCKED' : pathState === 'blocked' ? 'VALIDATION BLOCKED' : previewRepair ? 'REPAIR PREVIEW' : runState === 'paused' ? 'CYCLE PAUSED · SPACE TO RESUME' : runState === 'failed' ? 'MOTION VERIFICATION FAILED' : runState === 'complete' ? 'CYCLE VERIFIED' : 'COMMISSIONING STATE'}</span>
              <strong>{stateTitle}</strong>
            </div>
            <div className="progress-track"><span style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>
            <div className="ribbon-metric"><span>{runState === 'complete' ? 'Measured run' : 'Nominal cycle'}</span><strong>{(runState === 'complete' ? evidence.current?.elapsedSeconds ?? 0 : activeEvaluation.cycleSeconds).toFixed(1)} s</strong></div>
            <div className="ribbon-metric"><span>Clearance</span><strong>{activeEvaluation.minimumClearanceMm} mm</strong></div>
            {released ? (
              <button className="run-button release-action" disabled><Icon name="check" size={16} />Revision released</button>
            ) : previewRepair ? (
              <button className="run-button preview-action" onClick={applyCandidate}><Icon name="check" size={16} />Apply repair</button>
            ) : runState === 'complete' && isDraft ? (
              <button className="run-button release-action" onClick={releaseRevision}><Icon name="download" size={16} />Release Rev 08</button>
            ) : (
              <button
                className="run-button"
                onClick={isExecutionActive ? toggleExecutionPause : runSimulation}
                disabled={!canRun}
                aria-keyshortcuts={isExecutionActive ? 'Space' : undefined}
              >
                <Icon name={canRun ? 'play' : 'warning'} size={16} />
                {searching ? 'Comparing paths…' : planning ? 'Checking path…' : canRun ? (runState === 'running' ? 'Pause · Space' : runState === 'paused' ? 'Resume · Space' : isChanged ? 'Run repaired cycle' : isDraft ? 'Run layout candidate' : 'Replay baseline') : 'Resolve P02'}
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
                  <div key={label}><span>{label}</span><strong>{label === 'Position X' ? `${Math.round((layout.infeed[0] + fixtureShiftMm / 1000) * 1000)} mm` : value}</strong></div>
                ))}
              </div>
              <div className="baseline-evidence">
                <span className="micro-label">P02 PREFLIGHT</span>
                <strong>P02 preflight passes · full path checked on run</strong>
                <p>{baselineEvaluation.cycleSeconds.toFixed(1)} s nominal cycle · 84 mm P02 clearance · {checksPassed}/{activeEvaluation.checks.length} checks passed</p>
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
                  <strong>{released ? 'Verified job exported locally' : appliedRepair ? 'Repair passes preflight checks' : previewRepair ? `${recoveryProposals.find((proposal) => proposal.id === previewRepair)?.label} clears P02` : 'P02 swept envelope enters Fixture A keep-out'}</strong>
                  <p>{released ? `${(evidence.current?.elapsedSeconds ?? 0).toFixed(1)} s measured run and ${activeEvaluation.minimumClearanceMm} mm clearance were attached to the release.` : appliedRepair ? `${activeEvaluation.minimumClearanceMm} mm predicted clearance · ${activeEvaluation.cycleSeconds.toFixed(1)} s cycle. ${runState === 'complete' ? 'The verification run passed and the draft is ready for release.' : 'The repair is saved in the draft and must complete a verification run.'}` : previewRepair ? `${activeEvaluation.minimumClearanceMm} mm predicted clearance · ${activeEvaluation.cycleSeconds.toFixed(1)} s cycle. The commissioned job is unchanged until this candidate is applied.` : 'Fixture A moved 180 mm. The pick remains reachable, but P02 now violates the 50 mm clearance rule.'}</p>
                </div>
              </div>

              <div className="impact-metrics">
                <div><span>Pose delta</span><strong>ΔX +180 mm</strong></div>
                <div><span>Segment</span><strong>P02</strong></div>
                <div><span>{released || runState === 'complete' ? 'P02 scoped' : activeEvaluation.deployable ? 'Predicted' : 'Measured'}</span><strong>{activeEvaluation.minimumClearanceMm} mm</strong></div>
                <div><span>Required</span><strong>50 mm</strong></div>
              </div>

              <div className="section-label"><span>Causal trace</span><span>{appliedRepair ? 'Resolved' : previewRepair ? 'Candidate' : '1 blocker'}</span></div>
              <ol className="causal-trace">
                {activeEvaluation.causalTrace.map((entry) => (
                  <li key={entry.layer} className={entry.status}>
                    <button onClick={() => selectTrace(entry)}>
                      <span className="trace-node" />
                      <span><small>{entry.layer.replace('-', ' ')}</small><strong>{released && entry.layer === 'deployment-gate' ? 'Revision 08 exported locally' : entry.label}</strong></span>
                    </button>
                  </li>
                ))}
              </ol>

              {!appliedRepair && (
                <>
                  <div className="section-label"><span>Recovery options</span><span>Constraint-derived</span></div>
                  <div className="repair-list">
                    {recoveryProposals.map((proposal, index) => {
                      const evaluation = evaluateCommissioning({ layout, transferLift, fixtureShiftMm, repairId: proposal.id })
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
          <div className="baseline-evidence">
            <span className="micro-label">VERIFICATION SCOPE</span>
            <p>1441 measured TCP poses · 18 mm / 15° · joint limits. Full-path rehearsal and live swept bounds cover non-adjacent robot links, CNC, tables, stock, scanner housing, floor and boundary panels. Connected joints and named grasp/support contacts are excluded. Approximate geometry; protective-field logic, grasp forces and hardware acknowledgement are not checked.</p>
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <div><span className="status-dot" />{released ? 'Local export OP-1042-r08 · no runtime acknowledgement' : 'Simulation runtime ready'}</div>
        <div>Robot <strong>UR20</strong></div>
        <div>Controller <strong>Local prototype</strong></div>
        <div className="statusbar-spacer" />
        <div>Revision <strong>{released ? '08 released' : isDraft ? '08 draft' : '07 recheck required'}</strong></div>
        <div className="coordinate-readout">X {fixtureShiftMm.toFixed(1)}&nbsp;&nbsp; Y 0000.0&nbsp;&nbsp; Z 0000.0</div>
      </footer>

      {toast && <div className="toast" role="status"><span className="status-dot" />{toast}</div>}
    </main>
  )
}
