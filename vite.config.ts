import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const jobDir = path.resolve(projectRoot, '.chatgpt-jobs')

function runPythonModule(inputText: string): Promise<string> {
  const modulePath = fileURLToPath(new URL('./MyPython.py', import.meta.url))
  const pythonCommand = process.platform === 'win32' ? 'pythonw' : 'python'

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, ['-X', 'utf8', modulePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python exited with code ${code}`))
        return
      }

      resolve(stdout.trim())
    })

    child.stdin.end(inputText)
  })
}

async function readJobState(jobId: string) {
  const jobPath = path.resolve(jobDir, `${jobId}.json`)

  try {
    const content = await readFile(jobPath, 'utf8')
    const parsed = JSON.parse(content) as {
      status?: 'pending' | 'done' | 'error'
      result?: string
      error?: string
    }

    return {
      status: parsed.status ?? 'pending',
      result: parsed.result ?? '',
      error: parsed.error ?? '',
    }
  } catch {
    return {
      status: 'pending' as const,
      result: '',
      error: '',
    }
  }
}

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'python-execution-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const requestUrl = new URL(req.url ?? '/', 'http://localhost')

          if (requestUrl.pathname === '/api/execute') {
            if (req.method !== 'POST') {
              next()
              return
            }

            let body = ''

            req.on('data', (chunk) => {
              body += chunk
            })

            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}') as { text?: string }
                const jobId = await runPythonModule(parsed.text ?? '')

                sendJson(res, 200, { jobId })
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Python execution failed'
                sendJson(res, 500, { error: message })
              }
            })

            return
          }

          if (requestUrl.pathname === '/api/result') {
            if (req.method !== 'GET') {
              next()
              return
            }

            const jobId = requestUrl.searchParams.get('jobId')?.trim()
            if (!jobId) {
              sendJson(res, 400, { error: 'Missing jobId' })
              return
            }

            try {
              const state = await readJobState(jobId)
              sendJson(res, 200, state)
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to read job state'
              sendJson(res, 500, { error: message })
            }

            return
          }

          next()
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src'),
    },
  },
})