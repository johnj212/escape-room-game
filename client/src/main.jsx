import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// No <React.StrictMode>: React 19 StrictMode's mount→unmount→remount cycle
// races @react-three/fiber v9's async WebGPU `gl` factory — the frame loop
// cancels against a stale root and the scene freezes on its first frame
// (verified empirically 2026-07-07; see docs/R3F-WEBGPU-NOTES.md).
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
