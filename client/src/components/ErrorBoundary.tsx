import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="centered-state">
        <div className="state-card" role="alert">
          <AlertTriangle aria-hidden="true" />
          <p className="eyebrow">Falha inesperada</p>
          <h1>Não foi possível exibir esta tela.</h1>
          <p>Recarregue a aplicação. Nenhum detalhe técnico foi exposto.</p>
          <button className="button primary" type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={18} aria-hidden="true" />
            Recarregar
          </button>
        </div>
      </main>
    );
  }
}
