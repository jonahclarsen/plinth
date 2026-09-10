import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import ports from './port.json' with { type: 'json' }
export default defineConfig({ plugins: [svelte()], server: { port: ports.port, strictPort: true }, clearScreen: false })
