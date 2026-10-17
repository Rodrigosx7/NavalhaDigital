export function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null || raw === undefined) return fallback
    return JSON.parse(raw)
  } catch (err) {
    console.warn(`storage.getJSON(${key}) falhou:`, err)
    return fallback
  }
}

export function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn(`storage.setJSON(${key}) falhou:`, err)
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    console.warn(`storage.removeItem(${key}) falhou:`, err)
  }
}
