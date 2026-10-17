import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card.jsx'
import { Cabecalho } from '../System/shared.jsx'

export default function ContactPage() {
  return <div className="container sys-page sys-content-copy"><Cabecalho titulo="Informações de atendimento" descricao="Tudo o que você precisa saber para organizar sua visita." /><Card><h2>Horários de cada profissional</h2><p>Os dias e as janelas disponíveis são definidos por cada barbeiro. Consulte as opções ao escolher o profissional e os serviços.</p><h2>Pagamento presencial</h2><p>O valor informado corresponde aos serviços da reserva. O pagamento acontece diretamente na barbearia.</p><h2>Precisa cancelar?</h2><p>Acesse sua conta e cancele uma reserva pendente antes do horário de início. Não há antecedência mínima adicional. O cancelamento permanece no histórico.</p><h2>Alteração de uma reserva</h2><p>Procure o barbeiro responsável antes do início. Ele pode alterar serviços, data ou horário, desde que a reserva esteja pendente e exista disponibilidade.</p><p className="sys-note">O endereço e os canais de contato de uma barbearia real ainda não foram informados neste projeto.</p><div className="sys-actions"><Link className="btn btn--primary" to="/meus-agendamentos">Ver meus agendamentos</Link><Link className="btn btn--secondary" to="/agendar">Nova reserva</Link></div></Card></div>
}
