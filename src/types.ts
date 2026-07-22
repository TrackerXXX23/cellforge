export type RunState = 'ready' | 'running' | 'complete'

export type CellObject = 'robot' | 'cnc' | 'infeed' | 'outfeed'

export interface CommissioningCheck {
  id: string
  label: string
  detail: string
  status: 'pass' | 'warn' | 'fail'
}

export interface SequenceStep {
  id: string
  label: string
  target: string
  duration: number
  accent: string
}
