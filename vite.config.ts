import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

function runPythonModule(inputText: string): Promise<string> {
  const modulePath = fileURLToPath(new URL('./MyPython.py', import.meta.url))

  return new Promise((resolve, reject) => {
    const child = spawn('python', ['-X', 'utf8', modulePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
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

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'python-execution-api',
      configureServer(server) {
        server.middlewares.use('/api/execute', async (req, res, next) => {
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
              const result = await runPythonModule(parsed.text ?? '')

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ result }))
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Python execution failed'

              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: message }))
            }
          })
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