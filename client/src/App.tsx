import { Route, Switch } from "wouter";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Header } from "./components/Header";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TrainingPage } from "./pages/TrainingPage";

export default function App() {
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <Header />
        <main>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/treinar" component={TrainingPage} />
            <Route path="/sobre" component={AboutPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>RV Couros · Protótipo acadêmico</span>
            <span>Treinamento com situações e clientes fictícios</span>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
