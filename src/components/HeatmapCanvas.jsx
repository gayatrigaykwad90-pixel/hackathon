import React, { useEffect, useRef } from 'react'

// NetSpot-like heatmap renderer:
// 1) draw white circles for each reading onto an offscreen canvas using blur
// 2) read intensity (alpha) and map to a continuous color gradient (red->orange->yellow->green)
// 3) draw final colored image to visible canvas
export default function HeatmapCanvas({readings = [], width=800, height=600, opacity=0.95}){
  const canvasRef = useRef()

  useEffect(()=>{
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0,0,width,height)
    if(!readings || readings.length === 0) return

    // offscreen canvas for intensity accumulation
    const off = document.createElement('canvas')
    off.width = width
    off.height = height
    const octx = off.getContext('2d')
    octx.clearRect(0,0,width,height)

    // Draw white circles with blur; weaker signals produce larger, brighter blobs
    for(const r of readings){
      const bars = Math.max(0, Math.min(4, Number(r.bars) || 0))
      // strength: 0 (dead) -> 1 (excellent)
      const strength = bars / 4
      // larger radius for weaker signals to show coverage gaps
      const radius = 24 + (1 - strength) * 120 // tuned for campus map scale
      const blur = Math.max(12, radius * 0.45)

      octx.save()
      octx.beginPath()
      // draw full white circle and blur it; composite 'lighter' accumulates intensity
      octx.fillStyle = 'rgba(255,255,255,0.18)'
      octx.filter = `blur(${blur}px)`
      octx.globalCompositeOperation = 'lighter'
      octx.arc(r.x, r.y, radius, 0, Math.PI*2)
      octx.fill()
      octx.restore()
    }

    // colorize: read intensity and map to gradient
    const src = octx.getImageData(0,0,width,height)
    const dst = ctx.createImageData(width,height)
    const data = src.data
    const out = dst.data
    // precompute gradient stops for speed
    for(let i=0, j=0; i<data.length; i+=4, j+=4){
      // intensity using the alpha channel; since we drew white with rgba alpha, use brightness approximation
      const alpha = data[i+3] / 255 // 0..1
      if(alpha <= 0.003){ out[j]=0; out[j+1]=0; out[j+2]=0; out[j+3]=0; continue }
      // normalize intensity to 0..1
      const t = Math.min(1, alpha * 1.6) // amplify slightly
      const col = lerpColor(t)
      out[j] = col.r
      out[j+1] = col.g
      out[j+2] = col.b
      out[j+3] = Math.round(255 * Math.min(1, t * opacity))
    }

    ctx.clearRect(0,0,width,height)
    ctx.putImageData(dst, 0, 0)

  }, [readings, width, height, opacity])

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',pointerEvents:'none',display:'block'}} />
}

function lerpColor(t){
  const clamp = v=> Math.max(0, Math.min(1, v))
  t = clamp(t)
  // map 0->red (255,77,77), 0.33->orange (255,129,77), 0.66->yellow (255,199,67), 1->green (33,198,91)
  if(t < 0.33){
    const u = t / 0.33
    const r = 255
    const g = Math.round(77 + (129-77)*u)
    const b = Math.round(77 + (77-77)*u)
    return {r,g,b}
  }else if(t < 0.66){
    const u = (t - 0.33) / 0.33
    const r = 255
    const g = Math.round(129 + (199-129)*u)
    const b = Math.round(77 + (67-77)*u)
    return {r,g,b}
  }else{
    const u = (t - 0.66) / 0.34
    const r = Math.round(255 - (255-33)*u)
    const g = Math.round(199 - (199-198)*u)
    const b = Math.round(67 + (91-67)*u)
    return {r,g,b}
  }
}
