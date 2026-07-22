import { Component, type ErrorInfo, type ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  children: ReactNode
}

interface SceneErrorBoundaryState {
  error: Error | null
}

export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CellForge digital twin failed to load.', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="scene-error" role="alert">
          <strong>Digital twin unavailable</strong>
          <span>The UR5e asset could not be loaded.</span>
          <button type="button" onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      )
    }

    return this.props.children
  }
}
