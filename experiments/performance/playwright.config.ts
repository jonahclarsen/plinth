import { defineConfig } from '@playwright/test'
import ports from '../../port.json' with {type:'json'}
export default defineConfig({testDir:'.',testMatch:'regression.spec.ts',workers:1,timeout:60000,use:{browserName:'webkit',baseURL:`http://127.0.0.1:${ports.port}`,viewport:{width:1180,height:900}},webServer:{command:`pnpm exec vite preview --host 127.0.0.1 --port ${ports.port}`,url:`http://127.0.0.1:${ports.port}`},reporter:[['json',{outputFile:'test-results/performance/regression.json'}],['list']]})
