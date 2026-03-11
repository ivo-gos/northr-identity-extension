import { supabase } from '../lib/supabase'

const APP_URL = 'https://identity.northr.ai'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

interface IdentityBlock { profile_key: string; label: string; emoji: string; content: string; sort_order: number }
interface Workspace { id: string; name: string; emoji: string; icon?: string; status: string }
interface Project { id: string; name: string; status: string; workspace_id: string }
interface Snapshot { id: string; platform: string; summary: string; created_at: string; message_count: number }

const ICONS: Record<string, string> = {
  briefcase: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'pen-tool': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="m16 3 5 5-8.5 8.5H8v-4.5z"/><path d="M15 4l5 5"/><line x1="2" y1="22" x2="8" y2="16"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
}

function getDefaultBlocks(): IdentityBlock[] {
  return [
    { profile_key: 'business', label: 'Business', emoji: 'briefcase', content: '', sort_order: 1 },
    { profile_key: 'personal', label: 'Personal', emoji: 'heart', content: '', sort_order: 2 },
    { profile_key: 'voice', label: 'My Voice', emoji: 'pen-tool', content: '', sort_order: 3 },
    { profile_key: 'full', label: 'Full Me', emoji: 'globe', content: '', sort_order: 4 },
  ]
}

function wc(t: string): number { return t.trim() ? t.trim().split(/\s+/).length : 0 }
function relTime(ts: number): string { const d = Date.now()-ts, m = Math.floor(d/60000); if (m<1) return 'just now'; if (m<60) return m+'m ago'; const h = Math.floor(m/60); if (h<24) return h+'h ago'; return Math.floor(h/24)+'d ago' }

const WS_ICONS: Record<string, string> = {
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  chart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  briefcase: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  target: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  zap: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
}

function wsIconHtml(ws: Workspace): string {
  if (ws.icon && WS_ICONS[ws.icon]) return WS_ICONS[ws.icon]
  return ''
}

function wsLabel(ws: Workspace): string {
  const prefix = (ws.icon && WS_ICONS[ws.icon]) ? '\u25C6 ' : (ws.emoji ? ws.emoji + ' ' : '')
  return prefix + ws.name
}

async function authHeaders(): Promise<Record<string, string> | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }
  } catch { return null }
}

async function apiFetch(path: string): Promise<any> {
  const h = await authHeaders(); if (!h) return null
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: h })
  return r.ok ? r.json() : null
}

async function apiPatch(path: string, body: any): Promise<any> {
  const h = await authHeaders(); if (!h) return null
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { method: 'PATCH', headers: { ...h, 'Prefer': 'return=representation' }, body: JSON.stringify(body) })
  return r.ok ? r.json() : null
}

async function apiEdgeFn(name: string, body: any): Promise<any> {
  const h = await authHeaders(); if (!h) return null
  const r = await fetch(SUPABASE_URL + '/functions/v1/' + name, { method: 'POST', headers: h, body: JSON.stringify(body) })
  return r.ok ? r.json() : null
}

async function syncBlocks(token: string): Promise<IdentityBlock[]> {
  const h = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/identity_blocks?order=sort_order&select=profile_key,label,emoji,content,sort_order,last_edited_at', { headers: h })
    if (r.ok) { const b = await r.json(); if (b?.length > 0) { await chrome.storage.local.set({ identity_blocks: b, last_synced_at: Date.now() }); return b } }
  } catch {}
  return []
}

// ═══════════════════ PRO SUBSCRIPTION CHECK ═══════════════════

async function checkSubscription(forceRefresh = false): Promise<{ isPro: boolean; plan: string; status: string }> {
  try {
    // Check cache first (1-hour TTL, skip if force refresh)
    if (!forceRefresh) {
      const cached = await chrome.storage.local.get(['subscriptionStatus', 'subscriptionCheckedAt'])
      if (cached.subscriptionStatus && cached.subscriptionCheckedAt && (Date.now() - cached.subscriptionCheckedAt < 1 * 60 * 60 * 1000)) {
        const s = cached.subscriptionStatus
        const pro = s.status === 'active' || s.status === 'trialing'
        return { isPro: pro, plan: pro ? 'pro' : 'free', status: s.status || 'free' }
      }
    }

    // Fetch fresh
    const result = await apiEdgeFn('check-subscription', {})
    if (result) {
      await chrome.storage.local.set({ subscriptionStatus: result, subscriptionCheckedAt: Date.now() })
      if (result.status === 'active' || result.status === 'trialing') {
        return { isPro: true, plan: 'pro', status: result.status }
      }
    }
    return { isPro: false, plan: 'free', status: result?.status || 'free' }
  } catch {
    return { isPro: false, plan: 'free', status: 'free' }
  }
}

// ═══════════════════ STATE ═══════════════════

let currentBlocks: IdentityBlock[] = []
let editingKey: string | null = null
let workspaces: Workspace[] = []
let projectsByWs: Record<string, Project[]> = {}
let selectedProjectId: string | null = null
let activeTab: 'identity' | 'projects' = 'identity'
let isPro = false

// ═══════════════════ IDENTITY TAB ═══════════════════

function renderGrid() {
  const grid = document.getElementById('blocks-grid')!; grid.innerHTML = ''
  currentBlocks.forEach(b => {
    const w = wc(b.content), empty = w === 0
    const card = document.createElement('div'); card.className = 'block-card' + (empty ? ' empty' : '')
    card.innerHTML = '<div class="block-icon">'+(ICONS[b.emoji]||'')+'</div><div class="block-label">'+b.label+'</div><div class="block-meta">'+(empty?'empty':w+' words')+'</div><div class="block-edit">edit</div>'
    card.addEventListener('click', () => openEditor(b.profile_key))
    grid.appendChild(card)
  })
}

function openEditor(key: string) {
  const b = currentBlocks.find(x => x.profile_key === key); if (!b) return
  editingKey = key
  document.getElementById('edit-title')!.textContent = 'Edit: ' + b.label
  ;(document.getElementById('edit-textarea') as HTMLTextAreaElement).value = b.content
  document.getElementById('edit-area')!.style.display = 'block'
}
function closeEditor() { editingKey = null; document.getElementById('edit-area')!.style.display = 'none' }
async function saveBlock() {
  if (!editingKey) return
  const b = currentBlocks.find(x => x.profile_key === editingKey); if (!b) return
  const newContent = (document.getElementById('edit-textarea') as HTMLTextAreaElement).value
  b.content = newContent
  await chrome.storage.local.set({ identity_blocks: currentBlocks })
  const res = await apiPatch('identity_blocks?profile_key=eq.' + editingKey, {
    content: newContent,
    last_edited_at: new Date().toISOString()
  })
  if (!res) { console.error('[Northr] Failed to save block to database') }
  renderGrid(); closeEditor()
  document.getElementById('sync-info')!.textContent = 'Last synced: just now'
}

// ═══════════════════ PROJECTS TAB ═══════════════════

async function loadProjectsData() {
  workspaces = (await apiFetch('workspaces?status=eq.active&order=name')) || []
  projectsByWs = {}
  for (const ws of workspaces) {
    projectsByWs[ws.id] = (await apiFetch('projects?workspace_id=eq.' + ws.id + '&status=eq.active&order=name&select=id,name,status,workspace_id')) || []
  }
}

function renderProjectsTree() {
  const tree = document.getElementById('projects-tree')!; tree.innerHTML = ''
  const controls = document.getElementById('inject-controls')!

  if (workspaces.length === 0) {
    tree.innerHTML = '<div class="empty-projects">No workspaces yet.<br>Save a session from any AI chat to create one,<br>or <a href="https://identity.northr.ai/dashboard" target="_blank" style="color:#888;">create on dashboard</a>.</div>'
    controls.style.display = 'none'
    return
  }

  workspaces.forEach(ws => {
    const projects = projectsByWs[ws.id] || []
    const group = document.createElement('div'); group.className = 'ws-group'
    const header = document.createElement('div'); header.className = 'ws-header'
    const chevron = document.createElement('span'); chevron.className = 'ws-chevron open'; chevron.textContent = '\u25B6'
    const emoji = document.createElement('span'); emoji.className = 'ws-emoji'
    const iconSvg = wsIconHtml(ws)
    if (iconSvg) { emoji.innerHTML = iconSvg; emoji.style.cssText = 'display:inline-flex;align-items:center;color:#999;' }
    else { emoji.textContent = ws.emoji }
    const name = document.createElement('span'); name.className = 'ws-name'; name.textContent = ws.name
    const count = document.createElement('span'); count.className = 'ws-count'; count.textContent = projects.length + ' project' + (projects.length !== 1 ? 's' : '')
    header.appendChild(chevron); header.appendChild(emoji); header.appendChild(name); header.appendChild(count)
    group.appendChild(header)

    const list = document.createElement('div'); list.className = 'proj-list'
    projects.forEach(proj => {
      const item = document.createElement('div'); item.className = 'proj-item'
      if (selectedProjectId === proj.id) item.classList.add('selected')
      const dot = document.createElement('span'); dot.className = 'proj-dot'
      const pname = document.createElement('span'); pname.className = 'proj-name'; pname.textContent = proj.name
      item.appendChild(dot); item.appendChild(pname)
      item.addEventListener('click', () => {
        selectedProjectId = (selectedProjectId === proj.id) ? null : proj.id
        renderProjectsTree()
        updateInjectControls()
      })
      list.appendChild(item)
    })
    group.appendChild(list)

    header.addEventListener('click', () => {
      const isOpen = chevron.classList.contains('open')
      chevron.classList.toggle('open')
      list.style.display = isOpen ? 'none' : 'block'
    })

    tree.appendChild(group)
  })

  updateInjectControls()
}

function updateInjectControls() {
  const controls = document.getElementById('inject-controls')!
  controls.style.display = 'block'
  const blockSel = document.getElementById('inject-block-select') as HTMLSelectElement
  blockSel.innerHTML = ''
  currentBlocks.forEach(b => {
    if (wc(b.content) > 0) {
      const o = document.createElement('option'); o.value = b.profile_key; o.textContent = b.label + ' (' + wc(b.content) + 'w)'
      blockSel.appendChild(o)
    }
  })
  const projSel = document.getElementById('inject-project-select') as HTMLSelectElement
  projSel.innerHTML = '<option value="">None (identity only)</option>'
  workspaces.forEach(ws => {
    const projects = projectsByWs[ws.id] || []
    projects.forEach(p => {
      const o = document.createElement('option'); o.value = p.id; o.textContent = wsLabel(ws) + ' / ' + p.name
      if (selectedProjectId === p.id) o.selected = true
      projSel.appendChild(o)
    })
  })
}

// ═══════════════════ CONTEXT INJECTION + AUTO SESSION SAVE ═══════════════════

async function injectContext() {
  const blockKey = (document.getElementById('inject-block-select') as HTMLSelectElement).value
  const projId = (document.getElementById('inject-project-select') as HTMLSelectElement).value
  const block = currentBlocks.find(b => b.profile_key === blockKey)
  if (!block || !block.content) return

  const btn = document.getElementById('inject-context-btn')! as HTMLButtonElement
  btn.textContent = 'Injecting...'; btn.disabled = true

  let text = '[About me - ' + block.label + ']\n' + block.content + '\n[End]\n\n'

  if (projId) {
    const ctx = await apiEdgeFn('get-project-context', { projectId: projId })
    if (ctx && ctx.injection) {
      text += ctx.injection + '\n'
    }
  }

  let injected = false
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'INJECT_TEXT', text })
      injected = true
    }
  } catch (e) { console.error('[Northr] Inject failed:', e) }

  // Auto-save session snapshot if a project is selected
  if (injected && projId) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_CONVERSATION' }, async (response: any) => {
          if (chrome.runtime.lastError || !response?.conversation) return
          await apiEdgeFn('save-snapshot', {
            platform: response.platform || 'unknown',
            summary: 'Session with ' + block.label + ' identity injected',
            key_decisions: [],
            next_steps: [],
            open_questions: [],
            messageCount: response.messageCount || 0,
            projectId: projId,
            injected: true
          })
        })
      }
    } catch (e) { console.error('[Northr] Auto-save failed:', e) }
  }

  btn.textContent = projId ? 'Injected + Saved \u2713' : 'Injected \u2713'; btn.disabled = false
  setTimeout(() => { btn.textContent = 'Inject \u2192'; }, 2000)
}

// ═══════════════════ TABS ═══════════════════

function switchTab(tab: 'identity' | 'projects') {
  activeTab = tab
  document.getElementById('tab-identity')!.classList.toggle('active', tab === 'identity')
  document.getElementById('tab-projects')!.classList.toggle('active', tab === 'projects')
  document.getElementById('identity-panel')!.style.display = tab === 'identity' ? 'block' : 'none'
  document.getElementById('projects-panel')!.style.display = tab === 'projects' ? 'block' : 'none'

  if (tab === 'projects' && workspaces.length === 0) {
    loadProjectsData().then(() => renderProjectsTree())
  }
}

// ═══════════════════ INIT ═══════════════════

async function init() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    document.getElementById('loading-view')!.style.display = 'none'
    if (user) showMainView(user); else showLoginView()
  } catch {
    document.getElementById('loading-view')!.style.display = 'none'
    showLoginView()
  }
}

function showLoginView() {
  document.getElementById('login-view')!.style.display = 'block'
  document.getElementById('main-view')!.style.display = 'none'
  const loginBtn = document.getElementById('login-btn')!, emailIn = document.getElementById('email') as HTMLInputElement, passIn = document.getElementById('password') as HTMLInputElement, errEl = document.getElementById('login-error')!
  const enter = (e: KeyboardEvent) => { if (e.key === 'Enter') loginBtn.click() }
  emailIn.addEventListener('keydown', enter); passIn.addEventListener('keydown', enter)
  loginBtn.addEventListener('click', async () => {
    const email = emailIn.value.trim(), pass = passIn.value
    if (!email || !pass) { errEl.textContent = 'Enter email and password'; return }
    loginBtn.textContent = 'Signing in...'; (loginBtn as HTMLButtonElement).disabled = true; errEl.textContent = ''
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) { errEl.textContent = error.message; loginBtn.textContent = 'Sign In'; (loginBtn as HTMLButtonElement).disabled = false }
    else {
      loginBtn.textContent = 'Syncing...'
      await chrome.storage.local.remove(['identity_facts', 'facts_by_profile', 'cached_profiles', 'identity_context'])
      if (data.session?.access_token) { const b = await syncBlocks(data.session.access_token); if (!b.length) await chrome.storage.local.set({ identity_blocks: getDefaultBlocks(), last_synced_at: Date.now() }) }
      window.location.reload()
    }
  })
}

async function showMainView(user: any) {
  document.getElementById('login-view')!.style.display = 'none'
  document.getElementById('main-view')!.style.display = 'block'

  // Check subscription status
  // If cached as free but checked more than 5 min ago, force refresh to catch recent Pro activation
  const { subscriptionStatus: cachedSub, subscriptionCheckedAt: checkedAt } = await chrome.storage.local.get(['subscriptionStatus', 'subscriptionCheckedAt'])
  const shouldForce = cachedSub && cachedSub.status === 'free' && checkedAt && (Date.now() - checkedAt > 5 * 60 * 1000)
  const sub = await checkSubscription(shouldForce || false)
  isPro = sub.isPro

  // Hide Projects tab entirely for free users
  const tabProjects = document.getElementById('tab-projects')!
  if (!isPro) {
    tabProjects.style.display = 'none'
  }

  // Sync blocks
  const local = await chrome.storage.local.get(['identity_blocks', 'last_synced_at'])
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      await chrome.storage.local.remove(['identity_facts', 'facts_by_profile', 'cached_profiles', 'identity_context'])
      const fresh = await syncBlocks(session.access_token)
      currentBlocks = fresh.length > 0 ? fresh : (local.identity_blocks?.length > 0 ? local.identity_blocks : getDefaultBlocks())
    } else { currentBlocks = local.identity_blocks?.length > 0 ? local.identity_blocks : getDefaultBlocks() }
  } catch { currentBlocks = local.identity_blocks?.length > 0 ? local.identity_blocks : getDefaultBlocks() }

  renderGrid()

  // Load projects in background (only if Pro)
  if (isPro) {
    loadProjectsData().then(() => { if (activeTab === 'projects') renderProjectsTree() })
  }

  document.getElementById('sync-info')!.textContent = local.last_synced_at ? 'Last synced: ' + relTime(local.last_synced_at) : 'Last synced: never'

  document.getElementById('tab-identity')!.addEventListener('click', () => switchTab('identity'))
  tabProjects.addEventListener('click', () => { if (isPro) switchTab('projects') })

  document.getElementById('edit-close')!.addEventListener('click', closeEditor)
  document.getElementById('edit-save')!.addEventListener('click', saveBlock)
  document.getElementById('inject-context-btn')!.addEventListener('click', injectContext)

  document.getElementById('inject-project-select')!.addEventListener('change', (e) => {
    selectedProjectId = (e.target as HTMLSelectElement).value || null
  })

  document.getElementById('refresh-btn')!.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn')! as HTMLButtonElement
    btn.textContent = '\u21BB Syncing...'; btn.disabled = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) { const b = await syncBlocks(session.access_token); if (b.length > 0) currentBlocks = b }
    } catch {}

    // Force-refresh subscription status (catches new Pro activations)
    const freshSub = await checkSubscription(true)
    isPro = freshSub.isPro
    const tabProjects = document.getElementById('tab-projects')!
    tabProjects.style.display = isPro ? '' : 'none'

    if (isPro) await loadProjectsData()
    btn.textContent = '\u21BB Refresh'; btn.disabled = false
    renderGrid()
    if (isPro && activeTab === 'projects') renderProjectsTree()

    // Update sync info with Pro badge if applicable
    const syncInfo = document.getElementById('sync-info')!
    syncInfo.textContent = 'Last synced: just now'
    if (isPro) {
      syncInfo.innerHTML = '<span style="color:#eab308;font-size:10px;">Pro \u2728</span> \u00B7 ' + syncInfo.textContent
    }
  })

  document.getElementById('dashboard-btn')!.addEventListener('click', () => { chrome.tabs.create({ url: APP_URL + '/dashboard' }) })
  document.getElementById('logout-btn')!.addEventListener('click', async () => { await supabase.auth.signOut(); await chrome.storage.local.clear(); window.location.reload() })

  // Show Pro badge if subscribed
  if (isPro) {
    const syncInfo = document.getElementById('sync-info')!
    syncInfo.innerHTML = '<span style="color:#eab308;font-size:10px;">Pro \u2728</span> \u00B7 ' + syncInfo.textContent
  }
}

init()
