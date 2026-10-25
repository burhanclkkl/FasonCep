import { compatibleApi } from './api-health.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontend = fileURLToPath(new URL('..', import.meta.url))
const backend = path.resolve(frontend, '../backend')
const apiUrl = 'http://127.0.0.1:8765'
let apiProcess
let viteProcess
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  viteProcess?.kill('SIGTERM')
  apiProcess?.kill('SIGTERM')
  process.exitCode = code
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
async function healthy() {
  try {
    return await compatibleApi(apiUrl)
  } catch (error) {
    if (error.message === 'OUTDATED_API') throw new Error('API eski sürümde. Açık backend terminalinde Ctrl+C ile durdurun, sonra npm run dev komutunu tekrar çalıştırın.')
    return false
  }
}
try {
  if (!(await healthy())) {
    const candidates = ['.venv', '.venv312'].map(dir => path.join(backend, dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'))
    const python = candidates.find(candidate => existsSync(candidate) && spawnSync(candidate, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)']).status === 0)
    if (!python) throw new Error('Python 3.10+ sanal ortamı bulunamadı. README.md içindeki ilk kurulumu tamamlayın.')
    const check = spawnSync(python, ['-c', 'import uvicorn, fastapi, pydantic, argon2'], { cwd: backend })
    if (check.status !== 0) throw new Error(`API paketleri eksik. Backend klasöründe çalıştırın: ${python} -m pip install -r requirements.txt`)
    console.log('\nFasonCep API başlatılıyor…')
    apiProcess = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8765', '--reload'], { cwd: backend, stdio: 'inherit' })
    apiProcess.on('error', error => { console.error(error.message); stop(1) })
    apiProcess.on('exit', code => { if (!stopping) { console.error('API kapandı. Yukarıdaki hata çıktısını kontrol edin.'); stop(code || 1) } })
    let ready = false
    for (let attempt = 0; attempt < 50 && !stopping; attempt++) {
      if (await healthy()) { ready = true; break }
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (stopping) process.exitCode = 1
    else if (!ready) throw new Error('API başlatılamadı. 8765 portunu ve yukarıdaki hata çıktısını kontrol edin.')
  } else console.log('\nÇalışan FasonCep API bağlantısı hazır.')
  if (!stopping) {
    viteProcess = spawn(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', ...process.argv.slice(2)], { cwd: frontend, stdio: 'inherit' })
    viteProcess.on('error', error => { console.error(error.message); stop(1) })
    viteProcess.on('exit', code => stop(code || 0))
  }
} catch (error) {
  console.error(`\n${error.message}\n`)
  stop(1)
}
