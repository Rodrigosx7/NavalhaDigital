export function onlyDigits(str) {
  return String(str || '').replace(/\D/g, '')
}

export function isValidPhone(str) {
  const digits = onlyDigits(str)
  return digits.length === 10 || digits.length === 11
}

export function formatPhone(str) {
  const digits = onlyDigits(str).slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function isValidName(str) {
  const value = String(str || '').trim()
  return value.length >= 3 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(value)
}

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
