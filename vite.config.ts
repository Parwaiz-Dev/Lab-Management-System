import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Exclude Rust build artifacts from Vite's file watcher.
      // On Windows, compiled DLLs in target/ are locked by the OS during
      // the Rust build, causing EBUSY crashes when Vite tries to watch them.
      ignored: ['**/src-tauri/target/**'],
    },
  },
})
