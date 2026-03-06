import { supabase } from '../lib/supabase'

const APP_URL = 'https://identity.northr.ai'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

interface IdentityBlock {
  profile_key: string; label: string; emoji: string; content: string; sort_order: number; last_edited_at?: string
}

const ICONS: Record<string, string> = {
  briefcase: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'pen-tool': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
}

function getDefaultBlocks(): IdentityBlock[] {
  return [
    { profile_key: 'business', label: 'Business', emoji: 'briefcase', content: '', sort_order: 1 },
    { profile_key: 'personal', label: 'Personal', emoji: 'heart', content: '', sort_order: 2 },
    { profile_key: 'voice', label: 'My Voice', emoji: 'pen-tool', content: '', sort_order: 3 },
    { profile_key: 'full', label: 'Full Me', emoji: 'globe', content: '', sort_order: 4 },
  ]
}

function wordCount(t: string): number { return t.trim() ? t.trim().split(/\s+/).length : 0 }

function relativeTime(ts: number): string {
  const d = Date.now() - ts; const m = Math.floor(d/60000)
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'
  const h = Math.floor(m/60); if (h < 24) return h + 'h ago'
  return Math.floor(h/24) + 'd ago'
}

async function syncBlocks(token: string): Promise<IdentityBlock[]> {
  const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/identity_blocks?order=sort_order&select=profile_key,label,emoji,content,sort_order,last_edited_at', { headers })
    if (resp.ok) {
      const blocks = await resp.json()
      if (blocks && blocks.length > 0) {
        await chrome.storage.local.set({ identity_blocks: blocks, last_synced_at: Date.now() })
        return blocks
      }
    }
  } catch (e) { console.error('[Northr] Sync failed:', e) }
  return []
}

let currentBlocks: IdentityBlock[] = []
let editingKey: string | null = null

function renderGrid() {
  const grid = document.getElementById('blocks-grid')!
  grid.innerHTML = ''

  currentBlocks.forEach(block => {
    const wc = wordCount(block.content)
    const isEmpty = wc === 0
    const card = document.createElement('div')
    card.className = 'block-card' + (isEmpty ? ' empty' : '')
    card.innerHTML = '<div class="block-icon">' + (ICONS[block.emoji] || '') + '</div><div class="block-label">' + block.label + '</div><div class="block-meta">' + (isEmpty ? 'empty' : wc + ' words') + '</div><div class="block-edit">edit</div>'

    card.addEventListener('click', () => openEditor(block.profile_key))
    grid.appendChild(card)
  })
}

function openEditor(key: string) {
  const block = currentBlocks.find(b => b.profile_key === key)
  if (!block) return
  editingKey = key
  document.getElementById('edit-title')!.textContent = 'Edit: ' + block.label
  const ta = document.getElementById('edit-textarea') as HTMLTextAreaElement
  ta.value = block.content
  document.getElementById('edit-area')!.style.display = 'block'
  ta.focus()
}

function closeEditor() {
  editingKey = null
  document.getElementById('edit-area')!.style.display = 'none'
}

async function saveBlock() {
  if (!editingKey) return
  const ta = document.getElementById('edit-textarea') as HTMLTextAreaElement
  const block = currentBlocks.find(b => b.profile_key === editingKey)
  if (!block) return
  block.content = ta.value
  await chrome.storage.local.set({ identity_blocks: currentBlocks })
  renderGrid()
  closeEditor()
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
    const email = emailInput.value.trim(); const password = passwordInput.value
    if (!email || !password) { errorEl.textContent = 'Please enter email and password'; return }
    loginBtn.textContent = 'Signing in...'; (loginBtn as HTMLButtonElement).disabled = true; errorEl.textContent = ''
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { errorEl.textContent = error.message; loginBtn.textContent = 'Sign In'; (loginBtn as HTMLButtonElement).disabled = false }
    else {
      loginBtn.textContent = 'Syncing...'
      // Clear old v1 data
      await chrome.storage.local.remove(['identity_facts', 'facts_by_profile', 'cached_profiles', 'identity_context'])
      if (data.session?.access_token) {
        const blocks = await syncBlocks(data.session.access_token)
        if (blocks.length === 0) await chrome.storage.local.set({ identity_blocks: getDefaultBlocks(), last_synced_at: Date.now() })
      }
      window.location.reload()
    }
  })
}

async function showMainView(user: any) {
  document.getElementById('login-view')!.style.display = 'none'
  document.getElementById('main-view')!.style.display = 'block'

  // Load blocks — try fresh sync first
  const local = await chrome.storage.local.get(['identity_blocks', 'last_synced_at', 'sync_mode'])

  // Auto-sync from Supabase if logged in
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      // Clear old v1 data if still present
      await chrome.storage.local.remove(['identity_facts', 'facts_by_profile', 'cached_profiles', 'identity_context'])
      const freshBlocks = await syncBlocks(session.access_token)
      if (freshBlocks.length > 0) {
        currentBlocks = freshBlocks
      } else {
        currentBlocks = local.identity_blocks && local.identity_blocks.length > 0 ? local.identity_blocks : getDefaultBlocks()
      }
    } else {
      currentBlocks = local.identity_blocks && local.identity_blocks.length > 0 ? local.identity_blocks : getDefaultBlocks()
    }
  } catch {
    currentBlocks = local.identity_blocks && local.identity_blocks.length > 0 ? local.identity_blocks : getDefaultBlocks()
  }
  renderGrid()

  // Sync info
  const syncInfo = document.getElementById('sync-info')!
  syncInfo.textContent = local.last_synced_at ? 'Last synced: ' + relativeTime(local.last_synced_at) : 'Last synced: never'

  // Mode badge
  if (local.sync_mode === 'cloud') {
    const badge = document.getElementById('mode-badge')!
    badge.innerHTML = '<span class="mode-icon">\u2601\uFE0F</span><div><div class="mode-label" style="color:#8ab4f8;">Cloud sync</div><div class="mode-desc">Real-time sync enabled</div></div>'
  }

  // Edit handlers
  document.getElementById('edit-close')!.addEventListener('click', closeEditor)
  document.getElementById('edit-save')!.addEventListener('click', saveBlock)

  // Refresh
  document.getElementById('refresh-btn')!.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn')! as HTMLButtonElement
    btn.textContent = '\u21BB Syncing...'; btn.disabled = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const blocks = await syncBlocks(session.access_token)
        if (blocks.length > 0) currentBlocks = blocks
      }
    } catch {}
    btn.textContent = '\u21BB Refresh'; btn.disabled = false
    renderGrid()
    document.getElementById('sync-info')!.textContent = 'Last synced: just now'
  })

  document.getElementById('dashboard-btn')!.addEventListener('click', () => { chrome.tabs.create({ url: APP_URL + '/dashboard' }) })
  document.getElementById('logout-btn')!.addEventListener('click', async () => { await supabase.auth.signOut(); await chrome.storage.local.clear(); window.location.reload() })
}

init()
