// Northr Identity — Content Script Shared Module (Compact UI)

const LOG_PREFIX = '[Northr]'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

export function log(...args: any[]) { console.log(LOG_PREFIX, ...args) }

// ── Types ──

interface SituationProfile {
  id: string; name: string; emoji: string; description: string
  sort_order: number; is_default?: boolean
  categories?: string[]; fact_types?: string[]; max_facts?: number
}

interface IdentityFact {
  id?: string; content: string; category: string; importance?: number
  fact_type?: string; context_tag?: string; status?: string; validated?: boolean
}

type Platform = 'chatgpt' | 'claude' | 'gemini'

// ── Context tag labels ──

const TAG_GROUP_LABELS: Record<string, string> = {
  'identity': 'Who I Am', 'business_goal': 'Business Goals',
  'personal_goal': 'Personal Goals', 'family_goal': 'Family Goals',
  'tool': 'Tools I Use', 'communication_style': 'How I Communicate',
  'ai_preference': 'How I Want AI to Respond', 'work_relationship': 'My Team',
  'personal_relationship': 'My People', 'family': 'My Family',
  'value': 'What I Value', 'decision_style': 'How I Make Decisions',
  'constraint': 'Current Constraints', 'creative': 'Creative Preferences',
  'personal': 'About Me', 'professional': 'Professional',
  'goals': 'Goals', 'relationships': 'Relationships', 'preferences': 'Preferences',
}

// ── Platform themes ──

const THEMES: Record<Platform, Record<string, string>> = {
  chatgpt: { bg:'#2f2f2f',text:'#ececec',accent:'#10a37f',hover:'#3a3a3a',border:'#444444',separator:'#444444',muted:'#888888',dot:'#ffffff',dotBg:'#2f2f2f',warn:'#f59e0b' },
  claude: { bg:'#2b2a27',text:'#e8e4dd',accent:'#d97706',hover:'#3a3937',border:'#444240',separator:'#444240',muted:'#9a958e',dot:'#ffffff',dotBg:'#2b2a27',warn:'#f59e0b' },
  gemini: { bg:'#1e1f20',text:'#e3e3e3',accent:'#8ab4f8',hover:'#2c2d2e',border:'#3c4043',separator:'#3c4043',muted:'#9aa0a6',dot:'#ffffff',dotBg:'#1e1f20',warn:'#f59e0b' }
}

// ── Default profiles ──

function getDefaultProfiles(): SituationProfile[] {
  return [
    { id:'_advice', name:'Getting advice', emoji:'\uD83D\uDCA1', description:'Professional + goals + preferences', sort_order:1, categories:['professional','goals','preferences'], fact_types:['identity','business_goal','value','decision_style','ai_preference'], max_facts:20 },
    { id:'_delegate', name:'Delegating work', emoji:'\uD83D\uDCCB', description:'Professional + preferences + goals', sort_order:2, categories:['professional','preferences','goals'], fact_types:['identity','communication_style','tool','work_relationship','business_goal'], max_facts:22 },
    { id:'_brainstorm', name:'Brainstorming', emoji:'\uD83E\uDDE0', description:'Professional + goals', sort_order:3, categories:['professional','goals'], fact_types:['identity','business_goal','creative','value'], max_facts:15 },
    { id:'_personal', name:'Personal help', emoji:'\uD83D\uDCAC', description:'Personal + relationships', sort_order:4, categories:['personal','relationships'], fact_types:['identity','family','personal_relationship','personal_goal','family_goal'], max_facts:20 },
    { id:'_writing', name:'Writing as me', emoji:'\u270D\uFE0F', description:'Personal + professional + preferences', sort_order:5, categories:['personal','professional','preferences'], fact_types:['identity','communication_style','ai_preference','creative','value'], max_facts:15 },
    { id:'_decision', name:'Making a decision', emoji:'\uD83D\uDCCA', description:'Professional + goals + personal', sort_order:6, categories:['professional','goals','personal'], fact_types:['identity','business_goal','value','decision_style','constraint'], max_facts:18 },
    { id:'_full', name:'Full context', emoji:'\uD83C\uDF10', description:'All identity facts', sort_order:99, is_default:false, categories:['all'], max_facts:50 }
  ]
}

// ── Supabase helpers ──

async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (all) => {
      for (const [key, value] of Object.entries(all)) {
        if (key.includes('auth-token') && typeof value === 'string') {
          try { const p = JSON.parse(value); if (p.access_token) { resolve(p.access_token); return } } catch {}
        }
      }
      resolve(null)
    })
  })
}

async function supaFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAuthToken()
  if (!token) { log('No auth token'); return null }
  const resp = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  if (!resp.ok) { log('Supabase error:', resp.status); return null }
  return resp.json()
}

// ── Local-first data access ──

async function getLocal(keys: string[]): Promise<Record<string, any>> {
  return new Promise((r) => chrome.storage.local.get(keys, r))
}

async function getProfiles(): Promise<SituationProfile[]> {
  const { cached_profiles } = await getLocal(['cached_profiles'])
  return (cached_profiles && cached_profiles.length > 0) ? cached_profiles : getDefaultProfiles()
}

async function getFactsForProfile(profileId: string): Promise<IdentityFact[]> {
  const { sync_mode, facts_by_profile } = await getLocal(['sync_mode', 'facts_by_profile'])
  if (sync_mode === 'cloud' && !profileId.startsWith('_')) {
    try {
      const facts = await supaFetch('rpc/get_profile_facts', { method: 'POST', body: JSON.stringify({ profile_id: profileId }) })
      if (facts && facts.length > 0) return facts
    } catch (e) { log('Cloud fetch failed:', e) }
  }
  if (facts_by_profile && facts_by_profile[profileId]) return facts_by_profile[profileId]
  const { identity_facts } = await getLocal(['identity_facts'])
  if (!identity_facts || !identity_facts.length) return []
  const profiles = await getProfiles()
  const profile = profiles.find((p: SituationProfile) => p.id === profileId)
  if (!profile) return identity_facts
  return filterFactsForProfile(identity_facts, profile)
}

function filterFactsForProfile(allFacts: IdentityFact[], profile: SituationProfile): IdentityFact[] {
  const categories = profile.categories || []
  const factTypes = profile.fact_types || []
  if (categories.includes('all')) {
    return allFacts.filter(f => f.status !== 'superseded' && f.status !== 'rejected')
      .sort((a, b) => (b.importance || 5) - (a.importance || 5)).slice(0, profile.max_facts || 50)
  }
  return allFacts.filter(fact => {
    if (fact.status === 'superseded' || fact.status === 'rejected') return false
    return categories.includes(fact.category)
      || (fact.context_tag ? (categories.includes(fact.context_tag) || factTypes.includes(fact.context_tag)) : false)
      || (fact.fact_type ? factTypes.includes(fact.fact_type) : false)
  }).sort((a, b) => (b.importance || 5) - (a.importance || 5)).slice(0, profile.max_facts || 20)
}

// ── Format identity block ──

function formatIdentityBlock(profileName: string, facts: IdentityFact[]): string {
  const grouped: Record<string, string[]> = {}
  for (const fact of facts) {
    const tag = fact.context_tag || fact.category
    const label = TAG_GROUP_LABELS[tag] || tag.charAt(0).toUpperCase() + tag.slice(1)
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(fact.content)
  }
  let block = '--- About Me (' + profileName + ') ---\n\n'
  for (const [label, items] of Object.entries(grouped)) {
    block += label + ':\n'
    for (const item of items) { block += '\u2022 ' + item + '\n' }
    block += '\n'
  }
  block += '--- End ---\n\n'
  return block
}

// ── Editor helpers ──

function getEditorContent(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
  return el.innerText || el.textContent || ''
}

function setEditorContent(el: HTMLElement, text: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    if (setter) setter.call(el, text); else el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel?.removeAllRanges()
    sel?.addRange(range)
    document.execCommand('insertText', false, text)
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }))
  }
}

// ── Toast notifications ──

function showToast(msg: string, theme: Record<string, string>) {
  const e = document.getElementById('northr-toast'); if (e) e.remove()
  const t = document.createElement('div'); t.id = 'northr-toast'
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+theme.bg+';color:'+theme.text+';padding:10px 20px;border-radius:10px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.4);border:1px solid '+theme.border+';transition:opacity 0.3s;opacity:0;max-width:360px;text-align:center;'
  t.textContent = msg; document.body.appendChild(t)
  requestAnimationFrame(() => { t.style.opacity = '1' })
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300) }, 3000)
}

// ── Compact UI: Dot indicator + Bottom-center menu ──

let menuCreated = false, menuOpen = false
let menuEl: HTMLElement | null = null, dotEl: HTMLElement | null = null

export function createNorthrProfileMenu(findEditorFn: () => HTMLElement | null, platform: Platform) {
  if (menuCreated) return
  menuCreated = true
  const theme = THEMES[platform]

  // ── Subtle dot indicator (bottom-right corner) ──
  const dot = document.createElement('div'); dot.id = 'northr-dot'
  dot.style.cssText = 'position:fixed;bottom:24px;right:24px;width:28px;height:28px;border-radius:50%;background:'+theme.dotBg+';border:2px solid '+theme.dot+'30;cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:all 0.2s;opacity:0.5;box-shadow:0 1px 6px rgba(0,0,0,0.2);'
  dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+theme.dot+'">N</text></svg>'
  dot.title = 'Northr Identity (\u2318I)'
  dot.addEventListener('mouseenter', () => { dot.style.opacity = '1'; dot.style.transform = 'scale(1.15)' })
  dot.addEventListener('mouseleave', () => { if (!menuOpen) dot.style.opacity = '0.5'; dot.style.transform = 'scale(1)' })
  dot.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu() })
  document.body.appendChild(dot); dotEl = dot

  // ── Bottom-center compact menu bar ──
  const menu = document.createElement('div'); menu.id = 'northr-menu'
  menu.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:'+theme.bg+';color:'+theme.text+';border:1px solid '+theme.border+';border-radius:14px;padding:6px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 8px 40px rgba(0,0,0,0.35);display:none;flex-direction:column;gap:1px;max-height:380px;overflow-y:auto;transition:opacity 0.15s,transform 0.15s;opacity:0;min-width:260px;max-width:300px;'
  menu.addEventListener('click', (e) => e.stopPropagation())
  document.body.appendChild(menu); menuEl = menu

  loadMenu(platform, findEditorFn)

  // ── Close on outside click ──
  document.addEventListener('click', () => { if (menuOpen) closeMenu() })

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); toggleMenu(); return }
    if (e.key === 'Escape' && menuOpen) { closeMenu(); return }
    if (menuOpen && e.key >= '1' && e.key <= '9') {
      const rows = menuEl?.querySelectorAll('[data-profile-idx]')
      if (rows && rows[parseInt(e.key)-1]) (rows[parseInt(e.key)-1] as HTMLElement).click()
    }
  })

  // ── SPA navigation reset ──
  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) { lastUrl = window.location.href; resetDot(platform) }
  }).observe(document.body, { childList: true, subtree: true })

  log('Northr compact menu ready (\u2318I to open)')
}

function toggleMenu() { if (menuOpen) closeMenu(); else openMenu() }

function openMenu() {
  if (!menuEl || !dotEl) return
  menuEl.style.display = 'flex'
  dotEl.style.opacity = '1'
  requestAnimationFrame(() => {
    menuEl!.style.opacity = '1'
    menuEl!.style.transform = 'translateX(-50%) translateY(0)'
  })
  menuOpen = true
}

function closeMenu() {
  if (!menuEl || !dotEl) return
  menuEl.style.opacity = '0'
  menuEl.style.transform = 'translateX(-50%) translateY(12px)'
  dotEl.style.opacity = '0.5'
  setTimeout(() => { menuEl!.style.display = 'none' }, 150)
  menuOpen = false
}

function resetDot(platform: Platform) {
  if (!dotEl) return
  const theme = THEMES[platform]
  dotEl.style.border = '2px solid ' + theme.dot + '30'
  dotEl.style.opacity = '0.5'
  dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+theme.dot+'">N</text></svg>'
}

function showSuccess(platform: Platform, emoji: string, profileName: string, factCount: number) {
  if (!dotEl) return
  // Briefly pulse the dot green
  dotEl.style.border = '2px solid #10b981'
  dotEl.style.opacity = '1'
  dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="#10b981">\u2713</text></svg>'
  showToast(emoji + ' ' + profileName + ' \u2014 ' + factCount + ' facts injected', THEMES[platform])
  setTimeout(() => resetDot(platform), 4000)
}

async function loadMenu(platform: Platform, findEditorFn: () => HTMLElement | null) {
  if (!menuEl) return
  const theme = THEMES[platform]

  // Header
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  menuEl.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px 4px;"><span style="font-weight:600;font-size:12px;color:'+theme.muted+';">Northr Identity</span><span style="font-size:10px;color:'+theme.muted+'60;">'+(isMac?'\u2318':'Ctrl+')+'I</span></div>'

  const profiles = await getProfiles()
  const st = await getLocal(['recent_profile_ids','identity_facts','facts_by_profile'])
  const recentIds: string[] = st.recent_profile_ids || []
  const allFacts: IdentityFact[] = st.identity_facts || []
  const fbp: Record<string,IdentityFact[]> = st.facts_by_profile || {}

  const counts: Record<string,number> = {}
  for (const p of profiles) {
    counts[p.id] = fbp[p.id] ? fbp[p.id].length : (allFacts.length ? filterFactsForProfile(allFacts, p).length : 0)
  }

  const sorted = [...profiles].sort((a,b) => {
    const aR=recentIds.indexOf(a.id), bR=recentIds.indexOf(b.id)
    if (aR>=0 && bR>=0) return aR-bR; if (aR>=0) return -1; if (bR>=0) return 1
    return a.sort_order - b.sort_order
  })
  const recentCount = sorted.filter(p => recentIds.includes(p.id)).length

  let idx = 0
  for (const profile of sorted) {
    if (idx === recentCount && recentCount > 0) {
      const s = document.createElement('div')
      s.style.cssText = 'height:1px;background:'+theme.separator+';margin:2px 8px;'
      menuEl.appendChild(s)
    }
    if (profile.id === '_full') {
      const s = document.createElement('div')
      s.style.cssText = 'height:1px;background:'+theme.separator+';margin:2px 8px;'
      menuEl.appendChild(s)
    }

    const count = counts[profile.id] ?? 0
    const isEmpty = count === 0
    const cHtml = isEmpty
      ? '<span style="font-size:10px;color:'+theme.warn+';">0</span>'
      : '<span style="font-size:10px;color:'+theme.muted+';">'+count+'</span>'

    const row = document.createElement('div')
    row.dataset.profileIdx = String(idx)
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background 0.12s;'+(isEmpty?'opacity:0.45;':'')
    row.innerHTML = '<span style="font-size:14px;width:20px;text-align:center;">'+profile.emoji+'</span><span style="flex:1;font-size:12px;">'+profile.name+'</span>'+cHtml+'<span style="font-size:10px;color:'+theme.muted+'40;">'+String(idx+1)+'</span>'
    row.title = profile.description || ''
    row.addEventListener('mouseenter', () => { row.style.background = theme.hover })
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })

    row.addEventListener('click', async () => {
      closeMenu()
      if (isEmpty) { showToast('No facts match this profile yet.', theme); return }

      showToast(profile.emoji + ' Loading...', theme)
      try {
        const facts = await getFactsForProfile(profile.id)
        if (!facts || facts.length === 0) { showToast('No facts for this profile yet.', theme); return }

        const block = formatIdentityBlock(profile.name, facts)
        const editor = findEditorFn()
        if (!editor) { showToast('Editor not found.', theme); return }

        const current = getEditorContent(editor)
        setEditorContent(editor, block + current)

        showSuccess(platform, profile.emoji, profile.name, facts.length)

        const updatedRecent = [profile.id, ...recentIds.filter((id: string) => id !== profile.id)].slice(0, 5)
        await chrome.storage.local.set({ recent_profile_ids: updatedRecent })
      } catch (err) { log('Error:', err); showToast('Error loading profile.', theme) }
    })

    menuEl.appendChild(row); idx++
  }
}

export function watchForNavigation() { /* handled inside createNorthrProfileMenu */ }
