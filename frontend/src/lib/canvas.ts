import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

/** CanvasTexture yang digambar ulang saat deps berubah dan/atau tiap intervalMs. */
export function useCanvasTexture(w: number, h: number, draw: Draw, deps: unknown[], intervalMs?: number) {
  const { tex, ctx } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return { tex: t, ctx: c.getContext('2d')! }
  }, [w, h])
  useEffect(() => {
    const run = () => { draw(ctx, w, h); tex.needsUpdate = true }
    run()
    if (!intervalMs) return
    const id = window.setInterval(run, intervalMs)
    return () => window.clearInterval(id)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r)
}
