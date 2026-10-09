import { defineConfig } from '@playwright/test'
import ports from './port.json' with { type: 'json' }
export default defineConfig({ testDir: './tests', fullyParallel: true, use: {baseURL:`http://127.0.0.1:${ports.port}`, viewport:{width:1180,height:900}}, webServer:{command:'pnpm dev:web',url:`http://127.0.0.1:${ports.port}`,reuseExistingServer:!process.env.CI}, // On macOS, keep the WebKit raster checks separate from Chromium keyboard/file-picker tests.
 projects:[{name:'webkit-quality',testMatch:'hover-quality.spec.ts',use:{browserName:'webkit'}},{name:'chromium',testIgnore:'hover-quality.spec.ts',dependencies:['webkit-quality']}],reporter:'list' })
