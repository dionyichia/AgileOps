import { useEffect, useRef } from 'react'

const W = 2048
const H = 2048
const FPS = 15

export function NoiseCanvas({ opacity = 0.06 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = W
    canvas.height = H

    let frame: number
    let last = 0

    const draw = (ts: number) => {
      frame = requestAnimationFrame(draw)
      if (ts - last < 1000 / FPS) return
      last = ts

      const imageData = ctx.createImageData(W, H)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 255) | 0
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
      ctx.putImageData(imageData, 0, 0)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[15]"
      style={{ opacity, mixBlendMode: 'screen' }}
    />
  )
}
