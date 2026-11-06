import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL] Uncaught application error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1918] p-6 text-bone">
          <div className="panel max-w-md p-6 text-center shadow-2xl">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="display text-lg font-bold text-accent">Terjadi Kesalahan Antarmuka</h2>
            <p className="mt-2 text-xs text-bone/70 leading-relaxed">
              Sistem mendeteksi kendala pada rendering antarmuka 3D/HUD. Data kantor Anda tetap aman di server.
            </p>
            {this.state.error && (
              <pre className="mt-3 max-h-32 overflow-y-auto rounded-xl bg-black/40 p-2.5 font-mono text-[11px] text-red-300 text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-5 flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="rounded-full bg-accent px-5 py-2 text-xs font-bold text-ink hover:bg-accent-2 transition-colors"
              >
                Muat Ulang Halaman
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
