export function fimAtendimento(reserva) {
  const total = Number(reserva.dataHora.slice(11, 13)) * 60 + Number(reserva.dataHora.slice(14, 16)) + reserva.duracaoTotalMinutos
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
