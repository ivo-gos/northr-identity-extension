import { supabase } from '../lib/supabase'

const APP_URL = 'https://identity.northr.ai'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + ' min ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  return Math.floor(hrs / 24) + 'd ago'
}

async function initialSync(userId: string, token: string) {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }

  // Fetch all confirmed facts
  let facts: any[] = []
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/identity_facts?status=eq.confirmed&order=importance.desc&limit=200&select=id,content,category,importance,fact_type,context_tag,status', { headers })
    if (resp.ok) facts = await resp.json()
  } catch (e) { console.error('[Northr] Fact sync failed:', e) }

  // Fetch profiles
  let profiles: any[] = []
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/situation_profiles?order=sort_order', { headers })
    if (resp.ok) profiles = await resp.json()
  } catch {}

  // Store locally
  const toStore: Record<string, any> = {
    identity_facts: facts,
    last_synced_at: Date.now(),
    sync_mode: 'local',
    tier: 'free'
  }
  if (profiles.length > 0) toStore.cached_profiles = profiles

  // Pre-filter facts per profile
  const defaultProfiles = profiles.length > 0 ? profiles : getDefaultProfilesForSync()
  const factsByProfile: Record<string, any[]> = {}
  for (const p of defaultProfiles) {
    factsByProfile[p.id] = filterForProfile(facts, p)
  }
  toStore.facts_by_profile = factsByProfile

  await chrome.storage.local.set(toStore)
  return { factsCount: facts.length }
}

function getDefaultProfilesForSync() {
  return [
    { id:'_advice', categories:['professional','goals','preferences'], fact_types:['identity','business_goal','value','decision_style','ai_preference'], max_facts:20 },
    { id:'_delegate', categories:['professional','preferences','goals'], fact_types:['identity','communication_style','tool','work_relationship','business_goal'], max_facts:22 },
    { id:'_brainstorm', categories:['professional','goals'], fact_types:['identity','business_goal','creative','value'], max_facts:15 },
    { id:'_personal', categories:['personal','relationships'], fact_types:['identity','family','personal_relationship','personal_goal','family_goal'], max_facts:20 },
    { id:'_writing', categories:['personal','professional','preferences'], fact_types:['identity','communication_style','ai_preference','creative','value'], max_facts:15 },
    { id:'_decision', categories:['professional','goals','personal'], fact_types:['identity','business_goal','value','decision_style','constraint'], max_facts:18 },
    { id:'_full', categories:['all'], max_facts:50 },
  ]
}

function filterForProfile(allFacts: any[], profile: any): any[] {
  const cats = profile.categories || []
  const types = profile.fact_types || []
  if (cats.includes('all')) return allFacts.filter((f: any) => f.status !== 'superseded' && f.status !== 'rejected').slice(0, profile.max_facts || 50)
  return allFacts.filter((f: any) => {
    if (f.status === 'superseded' || f.status === 'rejected') return false
    return cats.includes(f.category) || (f.context_tag && (cats.includes(f.context_tag) || types.includes(f.context_tag))) || (f.fact_type && types.includes(f.fact_type))
  }).sort((a: any, b: any) => (b.importance||5) - (a.importance||5)).slice(0, profile.max_facts || 20)
}

async function init() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    document.getElementById('loading-view')!.style.display = 'none'
    if (user) showMainView(user)
    else showLoginView()
  } catch {
    document.getElementById('loading-view')!.style.display = 'none'
    showLoginView()
  }
}

function showLoginView() {
  document.getElementById('login-view')!.style.display = 'block'
  document.getElementById('main-view')!.style.display = 'none'

  const loginBtn = document.getElementById('login-btn')!
  const emailInput = document.getElementById('email') as HTMLInputElement
  const passwordInput = document.getElementById('password') as HTMLInputElement
  const errorEl = document.getElementById('login-error')!

  const handleEnter = (e: KeyboardEvent) => { if (e.key === 'Enter') loginBtn.click() }
  emailInput.addEventListener('keydown', handleEnter)
  passwordInput.addEventListener('keydown', handleEnter)

  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim()
    const password = passwordInput.value
    if (!email || !password) { errorEl.textContent = 'Please enter email and password'; return }

    loginBtn.textContent = 'Signing in...'
    ;(loginBtn as HTMLButtonElement).disabled = true
    errorEl.textContent = ''

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      errorEl.textContent = error.message
      loginBtn.textContent = 'Sign In'
      ;(loginBtn as HTMLButtonElement).disabled = false
    } else {
      // Do initial sync on login
      loginBtn.textContent = 'Syncing identity...'
      try {
        const token = data.session?.access_token
        if (token && data.user) await initialSync(data.user.id, token)
      } catch (e) { console.error('[Northr] Initial sync error:', e) }
      window.location.reload()
    }
  })
}

async function showMainView(user: any) {
  document.getElementById('login-view')!.style.display = 'none'
  document.getElementById('main-view')!.style.display = 'block'

  // Load stats from local storage first (fast), then optionally from Supabase
  const local = await chrome.storage.local.get(['identity_facts', 'last_synced_at', 'sync_mode', 'tier'])
  const factCount = local.identity_facts?.length || 0

  // Try profile stats from Supabase
  try {
    const { data: profile } = await supabase.from('profiles')
      .select('facts_count, confirmed_facts_count, accuracy_score')
      .eq('id', user.id).single()
    if (profile) {
      document.getElementById('accuracy-score')!.textContent = Math.round(profile.accuracy_score || 0) + '%'
      document.getElementById('facts-count')!.textContent = (profile.confirmed_facts_count || factCount) + '/' + (profile.facts_count || factCount)
    } else {
      document.getElementById('accuracy-score')!.textContent = factCount > 0 ? '100%' : '0%'
      document.getElementById('facts-count')!.textContent = factCount + '/' + factCount
    }
  } catch {
    document.getElementById('accuracy-score')!.textContent = factCount > 0 ? '100%' : '0%'
    document.getElementById('facts-count')!.textContent = factCount + '/' + factCount
  }

  // Sync info
  const syncInfo = document.getElementById('sync-info')!
  if (local.last_synced_at) {
    syncInfo.textContent = 'Last synced: ' + relativeTime(local.last_synced_at)
  } else {
    syncInfo.textContent = 'Last synced: never'
  }

  // Mode badge
  const badge = document.getElementById('mode-badge')!
  if (local.sync_mode === 'cloud') {
    badge.innerHTML = '<span class="mode-icon">\u2601\uFE0F</span><div><div class="mode-label" style="color:#3b82f6;">Cloud sync active</div><div class="mode-desc">Real-time sync enabled</div></div>'
  }

  // Refresh button — full re-sync
  document.getElementById('refresh-btn')!.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn')! as HTMLButtonElement
    btn.textContent = '\u21BB Syncing...'
    btn.disabled = true

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token && session.user) {
        await initialSync(session.user.id, session.access_token)
      }
    } catch (e) { console.error('[Northr] Refresh failed:', e) }

    btn.textContent = '\u21BB Refresh'
    btn.disabled = false
    window.location.reload()
  })

  document.getElementById('dashboard-btn')!.addEventListener('click', () => {
    chrome.tabs.create({ url: APP_URL + '/dashboard' })
  })

  document.getElementById('logout-btn')!.addEventListener('click', async () => {
    await supabase.auth.signOut()
    await chrome.storage.local.clear()
    window.location.reload()
  })
}

init()
