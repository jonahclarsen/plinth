import {fileURLToPath} from 'node:url'
import {defineConfig} from '@playwright/test'
import base from '../performance/playwright.config'
export default defineConfig({...base,testDir:'.',testMatch:'validation.spec.ts',reporter:[['json',{outputFile:fileURLToPath(new URL('../../.local/preview-results/validation.json',import.meta.url))}],['list']]})
