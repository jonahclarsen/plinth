import {defineConfig} from '@playwright/test'
import base from '../performance/playwright.config'
export default defineConfig({...base,testDir:'.',testMatch:'validation.spec.ts',reporter:[['json',{outputFile:'.local/preview-results/validation.json'}],['list']]})
