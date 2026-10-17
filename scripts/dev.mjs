import { spawn } from 'node:child_process'

const children = []
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code }
const api = spawn(process.execPath, ['server/index.mjs'], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] })
children.push(api)
api.on('error', error => { console.error(error.message); stop(1) })
api.on('exit', code => stop(code ?? 1))
api.once('message', message => {
  if (message !== 'ready') return
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { stdio: 'inherit' })
  children.push(vite)
  vite.on('error', error => { console.error(error.message); stop(1) })
  vite.on('exit', code => stop(code ?? 1))
})
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
