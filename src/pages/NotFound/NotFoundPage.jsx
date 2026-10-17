import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import { Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="container" style={{ padding: '120px 0', textAlign: 'center' }}>
      <Compass size={64} style={{ color: 'var(--color-accent-gold)', marginBottom: 24 }} />
      <span className="eyebrow">Erro 404</span>
      <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: '12px 0' }}>
        Página não encontrada
      </h1>
      <p style={{ fontStyle: 'italic', color: 'var(--color-brown-500)', marginBottom: 28, fontSize: '1.05rem' }}>
        Parece que você se perdeu pelo caminho. Vamos voltar para a cadeira.
      </p>
      <Link to="/">
        <Button size="lg">Voltar ao início</Button>
      </Link>
    </div>
  )
}
