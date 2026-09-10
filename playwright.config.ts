import { defineConfig } from '@playwright/test'
import ports from './port.json' with { type: 'json' }
export default defineConfig({ testDir: './tests', fullyParallel: true, use: {baseURL:`http://127.0.0.1:${ports.port}`, viewport:{width:1180,height:900}}, webServer:{command:'pnpm dev:web',url:`http://127.0.0.1:${ports.port}`,reuseExistingServer:!process.env.CI}, reporter:'list' })
