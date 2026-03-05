import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Northr Supabase project credentials
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      async getItem(key: string) {
        const result = await chrome.storage.local.get(key)
        return result[key] || null
      },
      async setItem(key: string, value: string) {
        await chrome.storage.local.set({ [key]: value })
      },
      async removeItem(key: string) {
        await chrome.storage.local.remove(key)
      }
    }
  }
})
