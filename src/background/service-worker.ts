// Background service worker — handles sync and install

import { supabase } from '../lib/supabase'

const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

// Pro users: refresh every 5 minutes; Free users: every 30 minutes (just in case)
chrome.alarms.create('refresh-identity', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'refresh-identity') return

  const { sync_mode } = await chrome.storage.local.get('sync_mode')

  // Only auto-refresh for pro/cloud users
  if (sync_mode !== 'cloud') return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }

    const resp = await fetch(SUPABASE_URL + '/rest/v1/identity_facts?status=eq.confirmed&order=importance.desc&limit=200&select=id,content,category,importance,fact_type,context_tag,status', { headers })
    if (resp.ok) {
      const facts = await resp.json()
      await chrome.storage.local.set({ identity_facts: facts, last_synced_at: Date.now() })
      console.log('[Northr] Cloud sync complete:', facts.length, 'facts')
    }
  } catch (err) {
    console.error('[Northr] Background sync failed:', err)
  }
})

// On install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://identity.northr.ai/signup?source=extension' })
  }
})

// Listen for sync requests from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REFRESH_IDENTITY') {
    sendResponse({ success: true })
    return true
  }
})
