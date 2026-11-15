import '@fontsource-variable/inter'
import '../styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WidgetApp } from './WidgetApp'
import { ThemeProvider } from '../app/providers/theme-provider'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container #root was not found in widget/index.html')
}

// The transparent window shows the desktop behind rounded corners.
document.documentElement.style.background = 'transparent'
document.body.style.background = 'transparent'

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <WidgetApp />
    </ThemeProvider>
  </StrictMode>
)
