import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Bundle the hearing-simulation audio clip (M4A/AAC) as a hashed asset so
  // `import ... from './assets/audio/hearing-sim.m4a'` resolves to a served URL.
  assetsInclude: ['**/*.m4a'],
})
