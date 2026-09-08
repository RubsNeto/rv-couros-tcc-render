import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export function NotFoundPage() {
  return (
    <div className="centered-state">
      <div className="state-card">
        <p className="eyebrow">Erro 404</p>
        <h1>Página não encontrada.</h1>
        <p>O endereço informado não faz parte deste protótipo.</p>
        <Link className="button primary" href="/">
          <ArrowLeft size={18} aria-hidden="true" />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
