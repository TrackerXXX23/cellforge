import { COLLISION_COVERAGE } from './cellBodies'
import type { LayoutSearchResult, SearchRequest } from './layoutSearch'
import { MAX_JOINT_ACCELERATION, MAX_JOINT_JERK } from './ur20Ik'
import { COMPACT_LAYOUT, REFERENCE_LAYOUT, layoutTarget } from './cellLayout'
import type { PlanningEvidence, PlanningRequest } from './pathPlanning'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptsTelemetry, createCycleEvidence, CYCLE_SAMPLES, isCycleVerified, recordAcceptedSample,
  type CycleEvidence, type MotionTelemetry,
} from './cycleAcceptance'
import {
  evaluateCommissioning,
  type RepairId,
} from './commissioning'
import type { MotionPlan } from './simulation'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import type { CellObject, RunState } from './types'

const CommissioningScene = lazy(() =>
  import('./Scene').then((module) => ({ default: module.CommissioningScene })),
)

const processStages = ['Picking stock', 'Loading CNC', 'Machining', 'Unloading', 'Complete'] as const
type ScenarioId = 'normal' | 'moved' | 'blocked'

const scenarios: { id: ScenarioId; label: string; description: string }[] = [
  { id: 'normal', label: 'Normal run', description: 'Known working closer-table layout.' },
  { id: 'moved', label: 'Moved fixture', description: 'Fixture A is 180 mm out of position.' },
  { id: 'blocked', label: 'Blocked layout', description: 'Reference tables collide on the full path.' },
]

function explainFailure(failure: string) {
  if (failure.includes('Self swept contact: base_link_inertia / upper_arm_link')) {
    const sample = failure.match(/sample (\d+)/)?.[1]
    return `The robot's upper arm enters the base clearance zone${sample ? ` at measured pose ${sample}` : ''}.`
  }
  if (failure.includes('contact')) return `The checked motion makes contact: ${failure.replace(/^.*?:\s*/, '')}.`
  if (failure.includes('timed out')) return 'Motion evidence stopped updating before the cell completed the job.'
  return failure
}

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
  const [layout, setLayout] = useState(COMPACT_LAYOUT)
  const [scenario, setScenario] = useState<ScenarioId>('normal')
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
  const [showMachineInterior, setShowMachineInterior] = useState(false)
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
  const activeStep = runState === 'complete' ? 4 : progress < 0.305 ? 0 : progress < 0.52 ? 1 : progress < 0.61 ? 2 : progress < 0.86 ? 3 : 4
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

  function chooseScenario(nextScenario: ScenarioId) {
    setScenario(nextScenario)
    setLayout(nextScenario === 'blocked' ? REFERENCE_LAYOUT : COMPACT_LAYOUT)
    setTransferLift(0)
    setFixtureShiftMm(nextScenario === 'moved' ? 180 : 0)
    setPreviewRepair(null)
    setAppliedRepair(null)
    resetExecution()
    setSelected(nextScenario === 'moved' ? 'infeed' : 'robot')
    setToast(scenarios.find((candidate) => candidate.id === nextScenario)?.description ?? 'Scenario loaded')
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
    setScenario(fixtureShiftMm === 0 ? 'normal' : 'moved')
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

  const stateTitle = searching ? `Finding a working layout · ${searchProgress.done}/${searchProgress.total}` : planning ? 'Checking the complete path before motion…' : runState === 'failed'
    ? 'The cell stopped before completing the job'
    : runState === 'running'
      ? processStages[activeStep]
      : runState === 'paused'
        ? `Paused during ${processStages[activeStep].toLowerCase()}`
        : runState === 'complete'
          ? 'Part complete · measured motion accepted'
          : searchEvidence?.best || appliedRepair
            ? 'Working layout found · ready to run'
            : scenario === 'moved'
              ? 'Fixture moved · path needs recovery'
              : scenario === 'blocked'
                ? 'Blocked layout loaded · run to see the conflict'
                : 'Ready to build one CNC part'

  const failureReason = planningEvidence?.failure
    ? explainFailure(planningEvidence.failure)
    : evidence.current?.failure
      ? explainFailure(evidence.current.failure)
      : !committedEvaluation.deployable
        ? `Fixture A leaves ${committedEvaluation.minimumClearanceMm} mm at the P02 approach. The cell requires 50 mm.`
        : null

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
          <div><div className="brand-name">CELLFORGE</div><div className="brand-subtitle">Robot cell rehearsal</div></div>
        </div>
        <div className="job-identity"><strong>Build a CNC housing</strong><span>OP-1042 · one part</span></div>
        <div className={`cell-health ${failureReason || runState === 'failed' ? 'attention' : runState === 'complete' ? 'complete' : ''}`}>
          <span className="status-dot" />{runState === 'complete' ? 'Job complete' : failureReason ? 'Needs attention' : 'Cell ready'}
        </div>
      </header>

      <section className="workspace">
        <aside className="operator-panel">
          <div className="operator-intro">
            <p>Choose a cell setup, then watch the robot load, machine, and unload one part.</p>
          </div>

          <fieldset className="scenario-picker" disabled={isExecutionActive || planning || searching}>
            <legend>Scenario</legend>
            {scenarios.map((candidate) => (
              <button key={candidate.id} className={scenario === candidate.id ? 'selected' : ''} onClick={() => chooseScenario(candidate.id)}>
                <span>{candidate.label}</span><small>{candidate.description}</small>
              </button>
            ))}
          </fieldset>

          <div className="process-heading"><span>Part journey</span><strong>{Math.round(progress * 100)}%</strong></div>
          <ol className="process-rail">
            {processStages.map((stage, index) => {
              const done = runState === 'complete' || activeStep > index
              const active = (isExecutionActive || runState === 'complete') && activeStep === index
              return <li key={stage} className={`${done ? 'done' : ''} ${active ? 'active' : ''}`}><span>{done ? <Icon name="check" size={13} /> : index + 1}</span><strong>{stage}</strong></li>
            })}
          </ol>

          {(failureReason || scenario === 'moved') && !appliedRepair && (
            <div className="recovery-card" role="alert">
              <Icon name="warning" size={20} />
              <div><strong>{failureReason ? 'This setup cannot run safely' : 'Fixture A no longer matches the saved path'}</strong><p>{failureReason ?? 'The fixture moved 180 mm. Find a new layout and path before running.'}</p></div>
              <button onClick={findBestLayout} disabled={searching || planning || isExecutionActive}>{searching ? `Checking ${searchProgress.done}/${searchProgress.total}` : 'Find working layout'}</button>
            </div>
          )}
          {searchEvidence?.best && <div className="recovery-success"><Icon name="check" size={17} /><span><strong>Working layout applied</strong><small>Bounded search passed the complete rehearsal. Run it to capture measured motion.</small></span></div>}

          <details className="technical-details">
            <summary>Technical details</summary>
            <div className="technical-content">
              <div className="technical-row"><span>Revision</span><strong>{released ? '08 · local export' : isDraft ? '08 · draft' : '07 · baseline'}</strong></div>
              <div className="technical-row"><span>Layout</span><strong>{layout.label}</strong></div>
              <div className="technical-row"><span>P02 clearance</span><strong>{activeEvaluation.minimumClearanceMm} mm / 50 mm</strong></div>
              <div className="technical-row"><span>Accepted checks</span><strong>{checksPassed}/{activeEvaluation.checks.length}</strong></div>
              <div className="technical-row"><span>Motion evidence</span><strong>{planningEvidence?.failure ?? (planningEvidence ? `${planningEvidence.acceptedSamples} poses rehearsed` : 'Run required')}</strong></div>
              <div className="component-detail"><small>Selected in the cell</small><strong>{details.name}</strong><span>{details.eyebrow}</span></div>
              <button className="technical-toggle" onClick={() => setShowEnvelope((current) => !current)}><Icon name="eye" size={15} />{showEnvelope ? 'Hide reach envelope' : 'Show reach envelope'}</button>
              <button className="export-button" onClick={releaseRevision} disabled={!canRelease || released}><Icon name={released ? 'check' : 'download'} size={15} />{releaseLabel}</button>
              <p className="scope-note">1441 measured TCP poses · joint limits · non-adjacent robot links · CNC, tables, stock, scanner, floor and boundary contacts. Approximate geometry; no protective-field logic, grasp forces, hardware acknowledgement, or physical stock removal.</p>
            </div>
          </details>
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
                showMachineInterior={showMachineInterior}
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
            <span className="view-chip"><Icon name="cube" size={14} />Live cell</span>
            <button className={`view-chip toggle ${showMachineInterior ? 'on' : ''}`} onClick={() => { setShowMachineInterior((current) => !current); setSelected('cnc') }}><Icon name="eye" size={14} />{showMachineInterior ? 'Close machine view' : 'Machine interior'}</button>
          </div>

          <div className={`control-deck ${failureReason ? 'has-fault' : ''} ${runState === 'complete' ? 'is-complete' : ''}`}>
            <div className="run-status"><span>{planning ? 'Safety check' : runState === 'running' ? `Stage ${activeStep + 1} of 5` : runState === 'paused' ? 'Cycle paused' : runState === 'complete' ? 'Measured cycle accepted' : 'Operator status'}</span><strong>{stateTitle}</strong><div className="progress-track"><span style={{ width: `${progress * 100}%` }} /></div></div>
            <div className="run-actions">
              <button className="primary-run" onClick={runSimulation} disabled={!canRun || isExecutionActive}><Icon name="play" size={18} />{runState === 'complete' ? 'Run again' : planning ? 'Checking path…' : 'Run cell'}</button>
              <button onClick={toggleExecutionPause} disabled={!isExecutionActive} aria-keyshortcuts="Space">{runState === 'paused' ? 'Resume' : 'Pause'}</button>
              <button onClick={resetExecution} disabled={planning || searching}>Reset</button>
            </div>
          </div>
        </section>
      </section>

      <footer className="statusbar">
        <div><span className="status-dot" />Local simulation · engineering aid</div><div className="statusbar-spacer" /><div>Robot <strong>UR20</strong></div><div>Cycle <strong>{activeEvaluation.cycleSeconds.toFixed(1)} s nominal</strong></div>
      </footer>

      {toast && <div className="toast" role="status"><span className="status-dot" />{toast}</div>}
    </main>
  )
}
