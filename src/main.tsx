// by 0xclub
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/AuthProvider.tsx'
import { PWAInstallPrompt } from './components/PWAInstallPrompt.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <PWAInstallPrompt />
    </AuthProvider>
  </StrictMode>,
)
