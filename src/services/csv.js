export function criarCSV(rows) {
  const escape = value => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@\-\t\r\n]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  return '\ufeff' + rows.map(row => row.map(escape).join(';')).join('\r\n')
}
