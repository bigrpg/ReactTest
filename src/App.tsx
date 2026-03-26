import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './App.css'

function App() {
  const [leftWidth, setLeftWidth] = useState(42)
  const [rightTopHeight, setRightTopHeight] = useState(62)
  const [leftHidden, setLeftHidden] = useState(false)
  const [bottomHidden, setBottomHidden] = useState(false)
  const [editorValue, setEditorValue] = useState('')
  const [executionResult, setExecutionResult] = useState('等待执行结果...')
  const dragRef = useRef<null | { type: 'vertical' | 'horizontal' }>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const lastLeftWidthRef = useRef(leftWidth)
  const lastRightTopHeightRef = useRef(rightTopHeight)

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const shell = shellRef.current

      if (!shell || !dragRef.current) {
        return
      }

      const rect = shell.getBoundingClientRect()

      if (dragRef.current.type === 'vertical') {
        const nextWidth = ((event.clientX - rect.left) / rect.width) * 100
        setLeftWidth(Math.min(65, Math.max(25, nextWidth)))
      }

      if (dragRef.current.type === 'horizontal') {
        const rightPane = shell.querySelector<HTMLElement>('.workspace__right')

        if (!rightPane) {
          return
        }

        const rightRect = rightPane.getBoundingClientRect()
        const nextHeight = ((event.clientY - rightRect.top) / rightRect.height) * 100
        setRightTopHeight(Math.min(80, Math.max(25, nextHeight)))
      }
    }

    const handlePointerUp = () => {
      dragRef.current = null
      document.body.classList.remove('is-dragging')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  useEffect(() => {
    if (!leftHidden && leftWidth > 0) {
      lastLeftWidthRef.current = leftWidth
    }
  }, [leftHidden, leftWidth])

  useEffect(() => {
    if (!bottomHidden && rightTopHeight > 0) {
      lastRightTopHeightRef.current = rightTopHeight
    }
  }, [bottomHidden, rightTopHeight])

  const startDrag = (type: 'vertical' | 'horizontal') => {
    if (type === 'vertical' && leftHidden) {
      return
    }

    if (type === 'horizontal' && bottomHidden) {
      return
    }

    dragRef.current = { type }
    document.body.classList.add('is-dragging')
  }

  const toggleLeftPane = () => {
    setLeftHidden((current) => {
      if (current) {
        setLeftWidth(lastLeftWidthRef.current)
        return false
      }

      lastLeftWidthRef.current = leftWidth
      setLeftWidth(0)
      return true
    })
  }

  const toggleBottomPane = () => {
    setBottomHidden((current) => {
      if (current) {
        setRightTopHeight(lastRightTopHeightRef.current)
        return false
      }

      lastRightTopHeightRef.current = rightTopHeight
      setRightTopHeight(100)
      return true
    })
  }

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  const pollExecutionResult = (jobId: string) => {
    activeJobIdRef.current = jobId
    stopPolling()

    const scheduleNextPoll = () => {
      pollTimerRef.current = window.setTimeout(async () => {
        try {
          const response = await fetch(`/api/result?jobId=${encodeURIComponent(jobId)}`)

          if (!response.ok) {
            throw new Error(`请求失败：${response.status}`)
          }

          const data = (await response.json()) as {
            status?: 'pending' | 'done' | 'error'
            result?: string
            error?: string
          }

          if (activeJobIdRef.current !== jobId) {
            return
          }

          if (data.status === 'done') {
            setExecutionResult(data.result ?? '执行完成，但没有返回内容。')
            stopPolling()
            return
          }

          if (data.status === 'error') {
            setExecutionResult(data.error ?? '执行失败')
            stopPolling()
            return
          }

          setExecutionResult('任务已提交，正在等待 ChatGPT 返回...')
          scheduleNextPoll()
        } catch (error) {
          if (activeJobIdRef.current !== jobId) {
            return
          }

          const message = error instanceof Error ? error.message : '执行失败'
          setExecutionResult(message)
          stopPolling()
        }
      }, 1000)
    }

    scheduleNextPoll()
  }

  async function OnClickExeBtn() {
    try {
      stopPolling()
      setExecutionResult('任务已提交，正在等待 ChatGPT 返回...')

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: editorValue }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `请求失败：${response.status}`)
      }

      const data = (await response.json()) as { jobId?: string }

      if (!data.jobId) {
        throw new Error('未收到任务标识')
      }

      pollExecutionResult(data.jobId)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      setExecutionResult(message)
      stopPolling()
    }
  }

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [])

  const workspaceStyle = {
    '--left-width': `${leftWidth}%`,
    '--left-opacity': leftHidden ? '0' : '1',
    '--left-pointer-events': leftHidden ? 'none' : 'auto',
  } as CSSProperties

  const rightPaneStyle = {
    '--right-top-height': `${rightTopHeight}%`,
    '--bottom-opacity': bottomHidden ? '0' : '1',
    '--bottom-pointer-events': bottomHidden ? 'none' : 'auto',
  } as CSSProperties

  return (
    <main className="shell" ref={shellRef}>
      <section className="workspace" style={workspaceStyle}>
        <section className={`workspace__panel workspace__panel--left${leftHidden ? ' workspace__panel--hidden' : ''}`}>
          <div className="panel__header">
            <span>左侧窗口</span>
          </div>
          <div className="panel__body panel__body--empty">
            <p>这里预留给左侧内容。</p>
          </div>
        </section>

        <div
          className="splitter splitter--vertical"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整左右窗口大小"
          onPointerDown={() => startDrag('vertical')}
        />
        <button
          type="button"
          className="splitter__toggle splitter__toggle--vertical"
          onClick={toggleLeftPane}
          aria-label={leftHidden ? '显示左侧窗口' : '隐藏左侧窗口'}
        >
          <span className="splitter__toggle-icon">{leftHidden ? '⟩' : '⟨'}</span>
        </button>

        <section className="workspace__right" style={rightPaneStyle}>
          <section className={`workspace__panel workspace__panel--top${bottomHidden ? ' workspace__panel--expanded' : ''}`}>
            <div className="panel__header">
              <span>编辑区</span>
            </div>
            <textarea
              className="editor"
              placeholder="在这里输入文本..."
              aria-label="文本编辑框"
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
            />
          </section>

          <div
            className="splitter splitter--horizontal"
            role="separator"
            aria-orientation="horizontal"
            aria-label="调整右侧上下窗口大小"
            onPointerDown={() => startDrag('horizontal')}
          />
          <button
            type="button"
            className="splitter__toggle splitter__toggle--horizontal"
            onClick={toggleBottomPane}
            aria-label={bottomHidden ? '显示下方窗口' : '隐藏下方窗口'}
          >
            <span className="splitter__toggle-icon">{bottomHidden ? '⌄' : '⌃'}</span>
          </button>

          <section className={`workspace__panel workspace__panel--bottom${bottomHidden ? ' workspace__panel--hidden' : ''}`}>
            <div className="panel__header panel__header--action">
              <span>执行结果</span>
              <button type="button" className="run-button" onClick={OnClickExeBtn}>
                执行
              </button>
            </div>
            <div className="panel__body panel__body--bottom">
              <p>{executionResult}</p>
            </div>
          </section>
        </section>
      </section>
    </main>
  )
}

export default App