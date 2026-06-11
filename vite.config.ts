import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Use a relative base so the build works when served from a GitHub Pages
  // project subpath (e.g. https://user.github.io/repo-name/).
  base: './',
  plugins: [react()],
})
