import * as THREE from 'three'

// Helper to convert heightmap canvas to normal map canvas
function heightToNormalCanvas(heightCanvas, strength = 2.0) {
  const width = heightCanvas.width
  const height = heightCanvas.height
  const ctx = heightCanvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, width, height)
  const src = imgData.data

  const normalCanvas = document.createElement('canvas')
  normalCanvas.width = width
  normalCanvas.height = height
  const normalCtx = normalCanvas.getContext('2d')
  const normalImg = normalCtx.createImageData(width, height)
  const dst = normalImg.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Neighbors (wrapped coordinates for seamless tiling)
      const xL = (x - 1 + width) % width
      const xR = (x + 1) % width
      const yT = (y - 1 + height) % height
      const yB = (y + 1) % height

      const l = src[(y * width + xL) * 4] / 255
      const r = src[(y * width + xR) * 4] / 255
      const t = src[(yT * width + x) * 4] / 255
      const b = src[(yB * width + x) * 4] / 255

      // Finite difference gradients
      const dx = (r - l) * strength
      const dy = (b - t) * strength

      // Normalize normal vector [-dx, -dy, 1.0]
      const len = Math.sqrt(dx * dx + dy * dy + 1.0)
      const nx = -dx / len
      const ny = -dy / len
      const nz = 1.0 / len

      const idx = (y * width + x) * 4
      dst[idx] = Math.floor((nx * 0.5 + 0.5) * 255)     // Red (X)
      dst[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255) // Green (Y)
      dst[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255) // Blue (Z)
      dst[idx + 3] = 255                                // Alpha
    }
  }
  normalCtx.putImageData(normalImg, 0, 0)
  return normalCanvas
}

// Draw noise on context
function drawNoise(ctx, width, height, opacity = 0.05) {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * opacity * 255
    data[i] = Math.max(0, Math.min(255, data[i] + noise))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
  }
  ctx.putImageData(imgData, 0, 0)
}

// Draw scratch lines
function drawScratches(ctx, width, height, count = 20, opacity = 0.1) {
  ctx.save()
  ctx.strokeStyle = `rgba(200, 200, 200, ${opacity})`
  ctx.lineWidth = 1
  for (let i = 0; i < count; i++) {
    ctx.beginPath()
    const x = Math.random() * width
    const y = Math.random() * height
    const len = 5 + Math.random() * 25
    const angle = Math.random() * Math.PI * 2
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }
  ctx.restore()
}

export function generateFloorTextures() {
  const size = 512
  
  // Height map canvas for normal mapping
  const heightCanvas = document.createElement('canvas')
  heightCanvas.width = size
  heightCanvas.height = size
  const hCtx = heightCanvas.getContext('2d')
  
  // Base height (neutral gray)
  hCtx.fillStyle = '#808080'
  hCtx.fillRect(0, 0, size, size)
  
  // Draw grid panels (4x4 tiles)
  const tileSize = size / 4
  hCtx.lineWidth = 4
  hCtx.strokeStyle = '#202020' // bevel indent
  
  for (let i = 0; i <= 4; i++) {
    hCtx.beginPath()
    hCtx.moveTo(i * tileSize, 0)
    hCtx.lineTo(i * tileSize, size)
    hCtx.stroke()
    
    hCtx.beginPath()
    hCtx.moveTo(0, i * tileSize)
    hCtx.lineTo(size, i * tileSize)
    hCtx.stroke()
  }
  
  // Draw rivets/screws on the corners of tiles
  hCtx.fillStyle = '#c0c0c0' // bump out
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * tileSize
      const y = j * tileSize
      const offsets = [12, tileSize - 12]
      offsets.forEach(ox => {
        offsets.forEach(oy => {
          hCtx.beginPath()
          hCtx.arc(x + ox, y + oy, 3, 0, Math.PI * 2)
          hCtx.fill()
          // Inner indentation of rivet
          hCtx.fillStyle = '#404040'
          hCtx.beginPath()
          hCtx.arc(x + ox, y + oy, 1.5, 0, Math.PI * 2)
          hCtx.fill()
          hCtx.fillStyle = '#c0c0c0' // restore
        })
      })
    }
  }

  // Draw scratches on heightmap
  drawScratches(hCtx, size, size, 40, 0.05)
  
  // Create normal map
  const normalCanvas = heightToNormalCanvas(heightCanvas, 3.0)
  
  // Diffuse Map (Color)
  const diffuseCanvas = document.createElement('canvas')
  diffuseCanvas.width = size
  diffuseCanvas.height = size
  const dCtx = diffuseCanvas.getContext('2d')
  
  dCtx.fillStyle = '#141822' // Cyberpunk dark slate
  dCtx.fillRect(0, 0, size, size)
  
  // Highlight bevels on panels
  dCtx.lineWidth = 2
  dCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      dCtx.strokeRect(i * tileSize + 1, j * tileSize + 1, tileSize - 2, tileSize - 2)
    }
  }
  
  // Draw dark panel seams
  dCtx.strokeStyle = '#050608'
  dCtx.lineWidth = 4
  for (let i = 0; i <= 4; i++) {
    dCtx.beginPath()
    dCtx.moveTo(i * tileSize, 0)
    dCtx.lineTo(i * tileSize, size)
    dCtx.stroke()
    
    dCtx.beginPath()
    dCtx.moveTo(0, i * tileSize)
    dCtx.lineTo(size, i * tileSize)
    dCtx.stroke()
  }

  // Draw rivets in color
  dCtx.fillStyle = '#222836'
  dCtx.strokeStyle = '#3e485e'
  dCtx.lineWidth = 1
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * tileSize
      const y = j * tileSize
      const offsets = [12, tileSize - 12]
      offsets.forEach(ox => {
        offsets.forEach(oy => {
          dCtx.beginPath()
          dCtx.arc(x + ox, y + oy, 3, 0, Math.PI * 2)
          dCtx.fill()
          dCtx.stroke()
        })
      })
    }
  }
  
  // Add metal grain noise and scratches
  drawNoise(dCtx, size, size, 0.03)
  drawScratches(dCtx, size, size, 60, 0.08)

  // Roughness Map (White = rough, Black = shiny)
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')
  
  rCtx.fillStyle = '#666666' // base roughness ~0.4
  rCtx.fillRect(0, 0, size, size)
  
  // Seams are rougher
  rCtx.lineWidth = 4
  rCtx.strokeStyle = '#b3b3b3' // 0.7 roughness
  for (let i = 0; i <= 4; i++) {
    rCtx.beginPath()
    rCtx.moveTo(i * tileSize, 0)
    rCtx.lineTo(i * tileSize, size)
    rCtx.stroke()
    rCtx.beginPath()
    rCtx.moveTo(0, i * tileSize)
    rCtx.lineTo(size, i * tileSize)
    rCtx.stroke()
  }
  drawScratches(rCtx, size, size, 50, 0.2)
  
  // Metalness Map (White = metallic, Black = dielectric)
  const metalCanvas = document.createElement('canvas')
  metalCanvas.width = size
  metalCanvas.height = size
  const mCtx = metalCanvas.getContext('2d')
  mCtx.fillStyle = '#e6e6e6' // 0.9 metalness
  mCtx.fillRect(0, 0, size, size)
  
  // Seams are dirty (non-metallic)
  mCtx.lineWidth = 4
  mCtx.strokeStyle = '#1a1a1a' // 0.1 metalness
  for (let i = 0; i <= 4; i++) {
    mCtx.beginPath()
    mCtx.moveTo(i * tileSize, 0)
    mCtx.lineTo(i * tileSize, size)
    mCtx.stroke()
    mCtx.beginPath()
    mCtx.moveTo(0, i * tileSize)
    mCtx.lineTo(size, i * tileSize)
    mCtx.stroke()
  }
  
  // Convert all to THREE.CanvasTextures
  const diffuseTex = new THREE.CanvasTexture(diffuseCanvas)
  const normalTex = new THREE.CanvasTexture(normalCanvas)
  const roughTex = new THREE.CanvasTexture(roughCanvas)
  const metalTex = new THREE.CanvasTexture(metalCanvas)
  
  // Repeat settings for seamless tiling
  const repeat = 5
  ;[diffuseTex, normalTex, roughTex, metalTex].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeat, repeat)
  })
  
  return { map: diffuseTex, normalMap: normalTex, roughnessMap: roughTex, metalnessMap: metalTex }
}

export function generateWallTextures() {
  const size = 512
  
  // Height map for wall normal
  const heightCanvas = document.createElement('canvas')
  heightCanvas.width = size
  heightCanvas.height = size
  const hCtx = heightCanvas.getContext('2d')
  
  hCtx.fillStyle = '#808080'
  hCtx.fillRect(0, 0, size, size)
  
  // Horizontal wall panels
  const panelHeight = size / 8
  hCtx.lineWidth = 3
  hCtx.strokeStyle = '#303030' // Grooves
  
  for (let i = 0; i <= 8; i++) {
    hCtx.beginPath()
    hCtx.moveTo(0, i * panelHeight)
    hCtx.lineTo(size, i * panelHeight)
    hCtx.stroke()
  }
  
  // Vertical panel seams
  for (let i = 0; i <= 4; i++) {
    hCtx.beginPath()
    hCtx.moveTo(i * 128, 0)
    hCtx.lineTo(i * 128, size)
    hCtx.stroke()
  }

  // Draw technical panels
  hCtx.fillStyle = '#505050' // inset
  for (let j = 0; j < 8; j += 2) {
    hCtx.fillRect(32, j * panelHeight + 10, 64, panelHeight - 20)
    hCtx.fillRect(288, j * panelHeight + 10, 64, panelHeight - 20)
  }
  
  const normalCanvas = heightToNormalCanvas(heightCanvas, 2.5)
  
  // Diffuse
  const diffuseCanvas = document.createElement('canvas')
  diffuseCanvas.width = size
  diffuseCanvas.height = size
  const dCtx = diffuseCanvas.getContext('2d')
  
  dCtx.fillStyle = '#0a0d14' // Very dark cyberpunk metal wall
  dCtx.fillRect(0, 0, size, size)
  
  // Draw panel highlights and lines
  dCtx.lineWidth = 3
  dCtx.strokeStyle = '#020305'
  for (let i = 0; i <= 8; i++) {
    dCtx.beginPath()
    dCtx.moveTo(0, i * panelHeight)
    dCtx.lineTo(size, i * panelHeight)
    dCtx.stroke()
  }
  for (let i = 0; i <= 4; i++) {
    dCtx.beginPath()
    dCtx.moveTo(i * 128, 0)
    dCtx.lineTo(i * 128, size)
    dCtx.stroke()
  }
  
  // Fill details in alternative color
  dCtx.fillStyle = '#10141f'
  dCtx.strokeStyle = '#181e2e'
  dCtx.lineWidth = 1
  for (let j = 0; j < 8; j += 2) {
    dCtx.fillRect(32, j * panelHeight + 10, 64, panelHeight - 20)
    dCtx.strokeRect(32, j * panelHeight + 10, 64, panelHeight - 20)
    dCtx.fillRect(288, j * panelHeight + 10, 64, panelHeight - 20)
    dCtx.strokeRect(288, j * panelHeight + 10, 64, panelHeight - 20)
  }
  
  drawNoise(dCtx, size, size, 0.02)
  drawScratches(dCtx, size, size, 30, 0.05)
  
  // Roughness
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')
  rCtx.fillStyle = '#808080' // roughness ~ 0.5
  rCtx.fillRect(0, 0, size, size)
  
  // Details are glossier
  rCtx.fillStyle = '#333333' // 0.2 roughness
  for (let j = 0; j < 8; j += 2) {
    rCtx.fillRect(32, j * panelHeight + 10, 64, panelHeight - 20)
    rCtx.fillRect(288, j * panelHeight + 10, 64, panelHeight - 20)
  }
  
  // Metalness
  const metalCanvas = document.createElement('canvas')
  metalCanvas.width = size
  metalCanvas.height = size
  const mCtx = metalCanvas.getContext('2d')
  mCtx.fillStyle = '#cccccc' // 0.8 metalness
  mCtx.fillRect(0, 0, size, size)
  
  const diffuseTex = new THREE.CanvasTexture(diffuseCanvas)
  const normalTex = new THREE.CanvasTexture(normalCanvas)
  const roughTex = new THREE.CanvasTexture(roughCanvas)
  const metalTex = new THREE.CanvasTexture(metalCanvas)
  
  const repeatX = 4
  const repeatY = 2
  ;[diffuseTex, normalTex, roughTex, metalTex].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
  })
  
  return { map: diffuseTex, normalMap: normalTex, roughnessMap: roughTex, metalnessMap: metalTex }
}

export function generateReactorTextures() {
  const size = 512
  
  // Height map (ribs)
  const heightCanvas = document.createElement('canvas')
  heightCanvas.width = size
  heightCanvas.height = size
  const hCtx = heightCanvas.getContext('2d')
  
  hCtx.fillStyle = '#808080'
  hCtx.fillRect(0, 0, size, size)
  
  hCtx.lineWidth = 12
  hCtx.strokeStyle = '#202020'
  for (let i = 0; i <= size; i += 64) {
    hCtx.beginPath()
    hCtx.moveTo(0, i)
    hCtx.lineTo(size, i)
    hCtx.stroke()
  }
  
  const normalCanvas = heightToNormalCanvas(heightCanvas, 3.0)
  
  // Diffuse
  const diffuseCanvas = document.createElement('canvas')
  diffuseCanvas.width = size
  diffuseCanvas.height = size
  const dCtx = diffuseCanvas.getContext('2d')
  
  dCtx.fillStyle = '#0f1115'
  dCtx.fillRect(0, 0, size, size)
  
  dCtx.lineWidth = 12
  dCtx.strokeStyle = '#050608'
  for (let i = 0; i <= size; i += 64) {
    dCtx.beginPath()
    dCtx.moveTo(0, i)
    dCtx.lineTo(size, i)
    dCtx.stroke()
  }
  
  drawNoise(dCtx, size, size, 0.02)
  drawScratches(dCtx, size, size, 20, 0.05)
  
  // Roughness
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = size
  roughCanvas.height = size
  const rCtx = roughCanvas.getContext('2d')
  rCtx.fillStyle = '#737373' // 0.45 roughness
  rCtx.fillRect(0, 0, size, size)
  
  // Metalness
  const metalCanvas = document.createElement('canvas')
  metalCanvas.width = size
  metalCanvas.height = size
  const mCtx = metalCanvas.getContext('2d')
  mCtx.fillStyle = '#b3b3b3'
  mCtx.fillRect(0, 0, size, size)
  
  const diffuseTex = new THREE.CanvasTexture(diffuseCanvas)
  const normalTex = new THREE.CanvasTexture(normalCanvas)
  const roughTex = new THREE.CanvasTexture(roughCanvas)
  const metalTex = new THREE.CanvasTexture(metalCanvas)
  
  ;[diffuseTex, normalTex, roughTex, metalTex].forEach(tex => {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 2)
  })
  
  return { map: diffuseTex, normalMap: normalTex, roughnessMap: roughTex, metalnessMap: metalTex }
}
