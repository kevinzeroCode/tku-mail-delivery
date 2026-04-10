'use client'
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Button } from 'antd'

export interface SignaturePadRef {
  isEmpty: () => boolean
  toDataURL: () => string
  clear: () => void
}

interface Props {
  width?: number
  height?: number
}

const SignaturePad = forwardRef<SignaturePadRef, Props>(function SignaturePad(
  { height = 180 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const hasDrawn  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })

  const getPos = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    drawing.current  = true
    hasDrawn.current = true
    lastPos.current  = getPos(e)
  }, [])

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
    lastPos.current = pos
  }, [])

  const stopDraw = useCallback(() => { drawing.current = false }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    canvas.addEventListener('mousedown',  startDraw)
    canvas.addEventListener('mousemove',  draw)
    canvas.addEventListener('mouseup',    stopDraw)
    canvas.addEventListener('mouseleave', stopDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove',  draw,      { passive: false })
    canvas.addEventListener('touchend',   stopDraw)
    return () => {
      canvas.removeEventListener('mousedown',  startDraw)
      canvas.removeEventListener('mousemove',  draw)
      canvas.removeEventListener('mouseup',    stopDraw)
      canvas.removeEventListener('mouseleave', stopDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove',  draw)
      canvas.removeEventListener('touchend',   stopDraw)
    }
  }, [startDraw, draw, stopDraw])

  useImperativeHandle(ref, () => ({
    isEmpty:  () => !hasDrawn.current,
    toDataURL: () => canvasRef.current!.toDataURL('image/png'),
    clear,
  }))

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={560}
        height={height}
        style={{
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          cursor: 'crosshair',
          width: '100%',
          background: '#fff',
          touchAction: 'none',
          display: 'block',
        }}
      />
      <div style={{ marginTop: 6, textAlign: 'right' }}>
        <Button size="small" onClick={clear}>清除</Button>
      </div>
    </div>
  )
})

export default SignaturePad
