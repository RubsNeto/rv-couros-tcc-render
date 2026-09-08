import { Info, MessageSquareText } from "lucide-react";
import { Link, useLocation } from "wouter";

export function Header() {
  const [location] = useLocation();
  return (
    <header className="site-header">
      <div className="brand-strip" aria-hidden="true" />
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="RV Couros — página inicial">
          <img src="/rv-logo.png" alt="" width="46" height="46" />
          <span>
            <strong>RV Couros</strong>
            <small>Treinamento Comercial com IA</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link
            href="/treinar"
            className={location === "/treinar" ? "nav-link active" : "nav-link"}
            aria-current={location === "/treinar" ? "page" : undefined}
          >
            <MessageSquareText size={17} aria-hidden="true" />
            Treinar
          </Link>
          <Link
            href="/sobre"
            className={location === "/sobre" ? "nav-link active" : "nav-link"}
            aria-current={location === "/sobre" ? "page" : undefined}
          >
            <Info size={17} aria-hidden="true" />
            Sobre
          </Link>
        </nav>
      </div>
    </header>
  );
}
