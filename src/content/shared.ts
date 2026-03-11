// Northr Identity — Content Script v5 (Passive Identity Extraction)

const LOG_PREFIX = '[Northr]'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

export function log(...args: any[]) { console.log(LOG_PREFIX, ...args) }

// Inject minimal CSS for icon animations
if (!document.getElementById('northr-styles')) {
  const style = document.createElement('style'); style.id = 'northr-styles'
  style.textContent = '@keyframes northr-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
  document.head.appendChild(style)
}

// ═══════════════════ TYPES ═══════════════════

interface IdentityBlock { profile_key: string; label: string; emoji: string; content: string; sort_order: number; last_edited_at?: string }
interface SessionSummary { summary: string; key_decisions: string[]; next_steps: string[]; open_questions: string[] }
interface Project { id: string; name: string; status: string; workspace_id?: string }
interface Workspace { id: string; name: string; emoji: string; icon?: string; status: string }
type Platform = 'chatgpt' | 'claude' | 'gemini'

interface MergeResult { profileKey: string; label: string; emoji: string; updatedContent: string; snippet: string; hasChanges: boolean }

// ═══════════════════ ICONS (thin 1.2 stroke) ═══════════════════

const ICONS: Record<string, string> = {
  briefcase: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  'pen-tool': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="m16 3 5 5-8.5 8.5H8v-4.5z"/><path d="M15 4l5 5"/><line x1="2" y1="22" x2="8" y2="16"/></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
}

const BLOCK_EMOJIS: Record<string, string> = {
  business: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  personal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  voice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m16 3 5 5-8.5 8.5H8v-4.5z"/><path d="M15 4l5 5"/><line x1="2" y1="22" x2="8" y2="16"/></svg>'
}

// UI icons (inline SVGs matching the thin-stroke design language)
const UI_ICONS: Record<string, string> = {
  save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  loader: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:northr-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  checkCircle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  alertTri: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  arrow: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
}

// Workspace icon mapping (icon column → SVG, fallback to emoji)
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

function wsIcon(ws: Workspace): string {
  if (ws.icon && WS_ICONS[ws.icon]) return '<span style="display:inline-flex;align-items:center;color:#999;">' + WS_ICONS[ws.icon] + '</span>'
  return ws.emoji || ''
}

// ═══════════════════ DEFAULTS & THEMES ═══════════════════

function getDefaultBlocks(): IdentityBlock[] {
  return [
    { profile_key: 'business', label: 'Business', emoji: 'briefcase', content: '', sort_order: 1 },
    { profile_key: 'personal', label: 'Personal', emoji: 'heart', content: '', sort_order: 2 },
    { profile_key: 'voice', label: 'My Voice', emoji: 'pen-tool', content: '', sort_order: 3 },
    { profile_key: 'full', label: 'Full Me', emoji: 'globe', content: '', sort_order: 4 },
  ]
}

const THEMES: Record<Platform, Record<string, string>> = {
  chatgpt: { bg:'#2f2f2f',text:'#ececec',accent:'#10a37f',hover:'#3a3a3a',border:'#444444',muted:'#888888',dot:'#ffffff',dotBg:'rgba(47,47,47,0.75)',cardBg:'#363636',selected:'#10a37f' },
  claude: { bg:'#2b2a27',text:'#e8e4dd',accent:'#d97706',hover:'#3a3937',border:'#444240',muted:'#9a958e',dot:'#ffffff',dotBg:'rgba(43,42,39,0.75)',cardBg:'#343330',selected:'#d97706' },
  gemini: { bg:'#1e1f20',text:'#e3e3e3',accent:'#8ab4f8',hover:'#2c2d2e',border:'#3c4043',muted:'#9aa0a6',dot:'#ffffff',dotBg:'rgba(30,31,32,0.75)',cardBg:'#28292a',selected:'#8ab4f8' }
}

// ═══════════════════ SUPABASE ═══════════════════

async function getAuthToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.storage.local.get(null, all => {
      for (const [k, v] of Object.entries(all)) {
        if (k.includes('auth-token') && typeof v === 'string') {
          try { const p = JSON.parse(v); if (p.access_token) { resolve(p.access_token); return } } catch {}
        }
      }
      resolve(null)
    })
  })
}

async function supaFetch(path: string, opts: RequestInit = {}): Promise<any> {
  const token = await getAuthToken()
  if (!token) return null
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { ...opts, headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...(opts.headers || {}) } })
  if (!r.ok) { log('DB error:', r.status); return null }
  return r.json()
}

async function supaEdgeFn(name: string, body: any): Promise<any> {
  const token = await getAuthToken()
  if (!token) return null
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/' + name, { method: 'POST', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { log('Edge fn error:', name, r.status); return null }
    return r.json()
  } catch (e) { log('Edge fn fail:', e); return null }
}

// merge-block-update has verify_jwt = false, so no auth needed
async function callMergeBlock(currentContent: string, transcript: string, profileLabel: string): Promise<{ updatedContent: string; snippet: string; changed: boolean } | null> {
  try {
    const r = await fetch(SUPABASE_URL + '/functions/v1/merge-block-update', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentContent, transcript, profileLabel })
    })
    if (!r.ok) { log('Merge error:', r.status); return null }
    return r.json()
  } catch (e) { log('Merge fail:', e); return null }
}

// ═══════════════════ LOCAL STORAGE ═══════════════════

async function getLocal(keys: string[]): Promise<Record<string, any>> { return new Promise(r => chrome.storage.local.get(keys, r)) }

async function getBlocks(): Promise<IdentityBlock[]> {
  const { identity_blocks } = await getLocal(['identity_blocks'])
  try {
    const token = await getAuthToken()
    if (token) {
      const b = await supaFetch('identity_blocks?order=sort_order&select=profile_key,label,emoji,content,sort_order,last_edited_at')
      if (b && b.length > 0) { await chrome.storage.local.set({ identity_blocks: b, last_synced_at: Date.now() }); return b }
    }
  } catch {}
  return (identity_blocks && identity_blocks.length > 0) ? identity_blocks : getDefaultBlocks()
}

function wc(t: string): number { return (!t || !t.trim()) ? 0 : t.trim().split(/\s+/).length }
function fmtBlock(b: IdentityBlock): string { return '[About me - ' + b.label + ']\n' + b.content + '\n[End]\n\n' }
function esc(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

// ═══════════════════ WORKSPACE + PROJECT FETCH ═══════════════════

async function fetchWorkspaces(): Promise<Workspace[]> { return (await supaFetch('workspaces?status=eq.active&order=name')) || [] }
async function fetchProjects(wsId: string): Promise<Project[]> { return (await supaFetch('projects?workspace_id=eq.' + wsId + '&status=eq.active&order=name&select=id,name,status,workspace_id')) || [] }

async function getSmartDefaults(p: Platform): Promise<{ workspaceId?: string, projectId?: string }> {
  const { lastSave } = await getLocal(['lastSave'])
  return (lastSave && lastSave[p]) ? lastSave[p] : {}
}

async function saveSmartDefaults(p: Platform, wsId: string, projId: string) {
  const { lastSave = {} } = await getLocal(['lastSave'])
  lastSave[p] = { workspaceId: wsId, projectId: projId }
  await chrome.storage.local.set({ lastSave })
}

// ═══════════════════ EDITOR ═══════════════════

function getEditorContent(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value
  return el.innerText || el.textContent || ''
}

function setEditorContent(el: HTMLElement, text: string) {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    if (s) s.call(el, text); else el.value = text
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    el.focus(); const sel = window.getSelection(); const rng = document.createRange()
    rng.selectNodeContents(el); sel?.removeAllRanges(); sel?.addRange(rng)
    document.execCommand('insertText', false, text)
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }))
  }
}

// ═══════════════════ TOAST ═══════════════════

function showToast(msg: string, theme: Record<string, string>) {
  const e = document.getElementById('northr-toast'); if (e) e.remove()
  const t = document.createElement('div'); t.id = 'northr-toast'
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+theme.bg+';color:'+theme.text+';padding:10px 20px;border-radius:10px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.4);border:1px solid '+theme.border+';transition:opacity 0.3s;opacity:0;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);'
  t.textContent = msg; document.body.appendChild(t)
  requestAnimationFrame(() => { t.style.opacity = '1' })
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300) }, 3000)
}

// ═══════════════════ CONVERSATION EXTRACTION ═══════════════════

export function detectPlatform(): Platform | 'other' {
  const u = window.location.hostname
  if (u.includes('chat.openai.com') || u.includes('chatgpt.com')) return 'chatgpt'
  if (u.includes('claude.ai')) return 'claude'
  if (u.includes('gemini.google.com')) return 'gemini'
  return 'other'
}

export function countUserMessages(): number {
  const p = detectPlatform()
  if (p === 'chatgpt') return document.querySelectorAll('[data-message-author-role="user"]').length
  if (p === 'claude') return document.querySelectorAll('[data-testid="user-message"]').length
  if (p === 'gemini') return Math.floor(document.querySelectorAll('message-content, [class*="message-content"]').length / 2)
  return 0
}

function extractConversation(p: Platform): string {
  let c = ''
  if (p === 'chatgpt') { document.querySelectorAll('[data-message-author-role]').forEach(t => { const r = t.getAttribute('data-message-author-role'); const tx = t.textContent?.trim()||''; if(tx) c += (r==='user'?'You':'AI')+': '+tx+'\n\n' }) }
  else if (p === 'claude') { document.querySelectorAll('[data-testid="user-message"], [data-testid="ai-message"]').forEach(m => { const isUser = m.getAttribute('data-testid') === 'user-message'; const tx = m.textContent?.trim()||''; if(tx) c += (isUser?'You':'AI')+': '+tx+'\n\n' }); if (!c) { document.querySelectorAll('[class*="Message"], [class*="message"]').forEach(m => { const h = m.querySelector('[data-testid="user-message"]')!==null; const tx = m.textContent?.trim()||''; if(tx) c += (h?'You':'AI')+': '+tx+'\n\n' }) } }
  else if (p === 'gemini') { let u = true; document.querySelectorAll('message-content, [class*="message-content"]').forEach(m => { const tx = m.textContent?.trim()||''; if(tx) { c += (u?'You':'AI')+': '+tx+'\n\n'; u=!u } }) }
  return c
}

function extractUserMessages(p: Platform): string {
  let msgs: string[] = []
  if (p === 'chatgpt') { document.querySelectorAll('[data-message-author-role="user"]').forEach(t => { const tx = t.textContent?.trim()||''; if (tx) msgs.push(tx) }) }
  else if (p === 'claude') { document.querySelectorAll('[data-testid="user-message"]').forEach(m => { const tx = m.textContent?.trim()||''; if (tx) msgs.push(tx) }) }
  else if (p === 'gemini') { let u = true; document.querySelectorAll('message-content, [class*="message-content"]').forEach(m => { const tx = m.textContent?.trim()||''; if (tx) { if (u) msgs.push(tx); u = !u } }) }
  return msgs.join('\n\n')
}

// ═══════════════════ SESSION API ═══════════════════

async function summarizeSession(conv: string, platform: string): Promise<SessionSummary | null> {
  return await supaEdgeFn('summarize-session', { conversation: conv.slice(-8000), platform, messageCount: countUserMessages() })
}

async function saveSnapshot(data: any): Promise<any> {
  return await supaEdgeFn('save-snapshot', data)
}

// ═══════════════════ SAVE BANNER ═══════════════════

let bannerInjected = false, bannerDismissed = false

async function isProUser(): Promise<boolean> {
  const { subscriptionStatus } = await getLocal(['subscriptionStatus'])
  if (subscriptionStatus && (subscriptionStatus.status === 'active' || subscriptionStatus.status === 'trialing')) return true
  return false
}

async function injectSaveBanner(platform: Platform) {
  if (bannerInjected || bannerDismissed) return
  bannerInjected = true

  const pro = await isProUser()
  const b = document.createElement('div'); b.id = 'northr-save-banner'
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(26,26,26,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#e2e8f0;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 20px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.08);transition:transform 0.3s;transform:translateY(-100%);'

  if (pro) {
    b.innerHTML = '<span style="display:flex;align-items:center;color:#e2e8f0;">'+UI_ICONS.save+' <span style="margin-left:6px;">Save this session?</span></span><button id="northr-sb" style="background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Save \u25BE</button><button id="northr-sd" style="background:transparent;color:#888;border:none;font-size:16px;cursor:pointer;padding:4px 8px;">\u2715</button>'
  } else {
    b.innerHTML = '<span style="display:flex;align-items:center;color:#e2e8f0;">'+UI_ICONS.save+' <span style="margin-left:6px;">Save this session? Project context is a Pro feature.</span></span><button id="northr-sb" style="background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Start free trial</button><button id="northr-sd" style="background:transparent;color:#888;border:none;font-size:12px;cursor:pointer;padding:4px 8px;">Not now</button>'
  }

  document.body.appendChild(b)
  requestAnimationFrame(() => { b.style.transform = 'translateY(0)' })
  document.getElementById('northr-sd')!.addEventListener('click', () => { bannerDismissed = true; b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300) })

  if (pro) {
    document.getElementById('northr-sb')!.addEventListener('click', () => { b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300); openSaveFlow(platform) })
  } else {
    document.getElementById('northr-sb')!.addEventListener('click', () => { window.open('https://identity.northr.ai/settings?upgrade=true', '_blank'); b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300) })
  }
}

// ═══════════════════ IDENTITY EXTRACTION BANNER ═══════════════════

let identityBannerInjected = false, identityBannerDismissed = false

function injectIdentityBanner(platform: Platform, isFirstTime: boolean) {
  if (identityBannerInjected || identityBannerDismissed) return
  identityBannerInjected = true
  const b = document.createElement('div'); b.id = 'northr-identity-banner'
  const msg = isFirstTime
    ? 'I learned a few things about you from this conversation. Save them so every AI tool knows who you are?'
    : 'I noticed some things about you. Save to your identity?'
  const btnLabel = isFirstTime ? 'Yes, show me what you found \u2192' : 'Review what I found \u2192'
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(26,26,26,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#e2e8f0;display:flex;align-items:center;justify-content:center;gap:12px;padding:'+(isFirstTime?'14px 20px':'10px 20px')+';font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.08);transition:transform 0.3s;transform:translateY(-100%);'
  b.innerHTML = '<span style="display:flex;align-items:center;gap:8px;color:#e2e8f0;">'+UI_ICONS.user+' '+msg+'</span><button id="northr-id-yes" style="background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">'+btnLabel+'</button><button id="northr-id-no" style="background:transparent;color:#888;border:none;font-size:12px;cursor:pointer;padding:4px 8px;white-space:nowrap;">'+(isFirstTime?'Maybe later':'Not now')+'</button>'
  document.body.appendChild(b)
  requestAnimationFrame(() => { b.style.transform = 'translateY(0)' })

  document.getElementById('northr-id-no')!.addEventListener('click', () => {
    identityBannerDismissed = true
    chrome.storage.local.set({ lastIdentityOffer: Date.now() })
    b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300)
  })
  document.getElementById('northr-id-yes')!.addEventListener('click', () => {
    b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300)
    openIdentityExtractionFlow(platform)
  })
}

// ═══════════════════ IDENTITY EXTRACTION FLOW ═══════════════════

async function openIdentityExtractionFlow(platform: Platform) {
  const ov = document.createElement('div'); ov.id = 'northr-overlay'
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;transition:opacity 0.2s;opacity:0;'
  document.body.appendChild(ov)
  requestAnimationFrame(() => { ov.style.opacity = '1' })

  const pan = document.createElement('div')
  pan.style.cssText = 'background:rgba(26,26,26,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:#e2e8f0;border-radius:16px;padding:24px;width:440px;max-height:80vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);'
  pan.innerHTML = '<div style="text-align:center;padding:32px 0;"><div style="display:flex;justify-content:center;margin-bottom:12px;color:#999;">'+UI_ICONS.loader+'</div><div style="color:#999;font-size:13px;">Analyzing your conversation for identity signals...</div></div>'
  ov.appendChild(pan)

  // Get current blocks and user messages
  const blocks = await getBlocks()
  const userMessages = extractUserMessages(platform)
  if (!userMessages) { pan.innerHTML = errHtml('Could not extract conversation.'); document.getElementById('northr-xerr')?.addEventListener('click', () => closeOverlay(ov)); return }

  // Call merge-block-update for each of the 3 blocks
  const targetBlocks = [
    { profileKey: 'business', label: 'Business', emoji: 'briefcase' },
    { profileKey: 'personal', label: 'Personal', emoji: 'heart' },
    { profileKey: 'voice', label: 'My Voice', emoji: 'pen-tool' },
  ]

  const transcript = userMessages.slice(-8000)
  const mergeResults: MergeResult[] = []

  for (const tb of targetBlocks) {
    const existing = blocks.find(b => b.profile_key === tb.profileKey)
    const currentContent = existing?.content || ''
    const result = await callMergeBlock(currentContent, transcript, tb.label)
    if (result) {
      mergeResults.push({
        profileKey: tb.profileKey,
        label: tb.label,
        emoji: tb.emoji,
        updatedContent: result.updatedContent,
        snippet: result.snippet,
        hasChanges: result.changed === true
      })
    }
  }

  const changedBlocks = mergeResults.filter(r => r.hasChanges)
  if (changedBlocks.length === 0) {
    pan.innerHTML = '<div style="text-align:center;padding:32px 0;"><div style="display:flex;justify-content:center;margin-bottom:12px;color:#999;">'+UI_ICONS.checkCircle+'</div><div style="color:#999;font-size:13px;">No new identity signals found in this conversation.</div></div><div style="text-align:center;margin-top:12px;"><button id="northr-xerr" style="background:#333;color:#ccc;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;">Close</button></div>'
    document.getElementById('northr-xerr')?.addEventListener('click', () => closeOverlay(ov))
    // Still record the offer so we don't nag
    chrome.storage.local.set({ lastIdentityOffer: Date.now() })
    return
  }

  buildIdentityReviewPanel(pan, ov, platform, changedBlocks, blocks)
}

// ═══════════════════ CROSS-BLOCK CONTENT DETECTION ═══════════════════

const BUSINESS_TERMS = /\b(revenue|team|clients?|strategy|tools?|saas|b2b|pipeline|ops|operations|sales|marketing|pricing|roi|kpi|okr|sprint|roadmap|mvp|churn|mrr|arr|fundrais|investor|equity|valuation|cap table|runway|burn rate|hiring|onboard|vendor|partner|contract|invoice|margin|profit|quota)\b/i
const PERSONAL_TERMS = /\b(family|kids?|children|wife|husband|partner|girlfriend|boyfriend|hobbies?|hobby|birthday|relocat|moving to|vacation|travel|health|fitness|gym|meditation|diet|relationship|wedding|divorce|parent|mom|dad|brother|sister|dog|cat|pet)\b/i
const VOICE_TERMS = /\b(writing style|tone|lowercase|uppercase|formal|casual|sentences|paragraphs|communicate|emoji|profanity|direct|verbose|concise|formatting|bullet points|headers|em dash|exclamation)\b/i

function detectMisroute(profileKey: string, snippet: string, updatedContent: string): boolean {
  const text = (snippet + ' ' + updatedContent).toLowerCase()
  if (profileKey === 'personal') {
    // Personal block getting business content?
    const bizHits = (text.match(BUSINESS_TERMS) || []).length
    const persHits = (text.match(PERSONAL_TERMS) || []).length
    return bizHits > 2 && persHits === 0
  }
  if (profileKey === 'voice') {
    // Voice block getting business content?
    const bizHits = (text.match(BUSINESS_TERMS) || []).length
    const voiceHits = (text.match(VOICE_TERMS) || []).length
    return bizHits > 2 && voiceHits === 0
  }
  if (profileKey === 'business') {
    // Business block getting personal content?
    const persHits = (text.match(PERSONAL_TERMS) || []).length
    const bizHits = (text.match(BUSINESS_TERMS) || []).length
    return persHits > 2 && bizHits === 0
  }
  return false
}

// ═══════════════════ IDENTITY REVIEW PANEL ═══════════════════

function buildIdentityReviewPanel(pan: HTMLElement, ov: HTMLElement, platform: Platform, mergeResults: MergeResult[], allBlocks: IdentityBlock[]) {
  pan.innerHTML = ''

  // Header
  const hdr = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;')
  hdr.innerHTML = '<span style="font-size:15px;font-weight:700;">Identity Update</span>'
  const xBtn = el('button', 'background:none;border:none;color:#666;font-size:18px;cursor:pointer;'); xBtn.textContent = '\u2715'
  xBtn.addEventListener('click', () => { chrome.storage.local.set({ lastIdentityOffer: Date.now() }); closeOverlay(ov) })
  hdr.appendChild(xBtn); pan.appendChild(hdr)

  // Subtitle
  const sub = el('div', 'font-size:12px;color:#999;margin-bottom:16px;')
  sub.textContent = 'From your conversation, I picked up:'; pan.appendChild(sub)

  // Per-block state
  const blockEditors: Record<string, HTMLTextAreaElement> = {}
  const blockAccepted: Record<string, boolean> = {}
  const blockWordCounts: Record<string, HTMLElement> = {}

  mergeResults.forEach(mr => {
    const misrouted = detectMisroute(mr.profileKey, mr.snippet, mr.updatedContent)
    blockAccepted[mr.profileKey] = !misrouted // auto-uncheck if misrouted

    const card = el('div', 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:8px;' + (misrouted ? 'opacity:0.4;' : ''))

    // Block header with checkbox, emoji, label, and word count
    const cardHdr = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px;')

    // Accept/reject checkbox
    const cb = document.createElement('input') as HTMLInputElement
    cb.type = 'checkbox'; cb.checked = !misrouted
    cb.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:#10b981;flex-shrink:0;'
    cardHdr.appendChild(cb)

    const emojiSpan = el('span', 'display:flex;align-items:center;color:#999;'); emojiSpan.innerHTML = BLOCK_EMOJIS[mr.profileKey] || ''
    const labelSpan = el('span', 'font-size:13px;font-weight:600;'); labelSpan.textContent = mr.label
    cardHdr.appendChild(emojiSpan); cardHdr.appendChild(labelSpan)

    // Word count badge
    const wordCount = wc(mr.updatedContent)
    const wcBadge = el('span', 'font-size:10px;margin-left:auto;padding:2px 6px;border-radius:4px;' + (wordCount > 500 ? 'background:rgba(234,179,8,0.2);color:#eab308;' : 'color:#666;'))
    wcBadge.textContent = wordCount + ' / 500w'
    blockWordCounts[mr.profileKey] = wcBadge
    cardHdr.appendChild(wcBadge)

    card.appendChild(cardHdr)

    // Word count warning if over 500
    const warningEl = el('div', 'font-size:11px;color:#eab308;padding:4px 0;display:' + (wordCount > 500 ? 'block' : 'none') + ';')
    warningEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">'+UI_ICONS.alertTri+' This update would push ' + mr.label + ' to ' + wordCount + ' words. Consider editing before saving.</span>'
    warningEl.id = 'northr-wc-warn-' + mr.profileKey
    card.appendChild(warningEl)

    // Misroute warning
    if (misrouted) {
      const mrWarn = el('div', 'font-size:11px;color:#f97316;padding:4px 0;')
      mrWarn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">'+UI_ICONS.alertTri+' This looks like it belongs in a different block. Unchecked by default.</span>'
      card.appendChild(mrWarn)
    }

    // Snippet (what changed)
    const snippetEl = el('div', 'font-size:12px;color:#aaa;font-style:italic;margin-bottom:8px;')
    snippetEl.textContent = '"' + mr.snippet + '"'
    card.appendChild(snippetEl)

    // Expand toggle
    const toggleBtn = el('button', 'background:none;border:none;color:#666;font-size:11px;cursor:pointer;padding:0;')
    toggleBtn.textContent = 'View full updated block \u25BE'
    card.appendChild(toggleBtn)

    // Editable textarea (hidden by default)
    const ta = document.createElement('textarea')
    ta.value = mr.updatedContent
    ta.style.cssText = 'width:100%;min-height:80px;background:rgba(34,34,34,0.8);color:#e2e8f0;border:1px solid rgba(68,68,68,0.6);border-radius:8px;padding:8px;font-size:11px;font-family:inherit;resize:vertical;outline:none;line-height:1.5;margin-top:8px;display:none;'
    card.appendChild(ta)
    blockEditors[mr.profileKey] = ta

    // Update word count on edit
    ta.addEventListener('input', () => {
      const w = wc(ta.value)
      wcBadge.textContent = w + ' / 500w'
      wcBadge.style.cssText = 'font-size:10px;margin-left:auto;padding:2px 6px;border-radius:4px;' + (w > 500 ? 'background:rgba(234,179,8,0.2);color:#eab308;' : 'color:#666;')
      const warn = document.getElementById('northr-wc-warn-' + mr.profileKey)
      if (warn) { warn.style.display = w > 500 ? 'block' : 'none'; warn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">'+UI_ICONS.alertTri+' ' + mr.label + ' is at ' + w + ' words. Consider trimming to stay under 500.</span>' }
    })

    let expanded = false
    toggleBtn.addEventListener('click', () => {
      expanded = !expanded
      ta.style.display = expanded ? 'block' : 'none'
      toggleBtn.textContent = expanded ? 'Hide full block \u25B4' : 'View full updated block \u25BE'
    })

    // Checkbox toggle — dim card when unchecked
    cb.addEventListener('change', () => {
      blockAccepted[mr.profileKey] = cb.checked
      card.style.opacity = cb.checked ? '1' : '0.4'
    })

    pan.appendChild(card)
  })

  // Divider
  pan.appendChild(el('div', 'height:1px;background:rgba(255,255,255,0.06);margin:16px 0;'))

  // Actions
  const acts = el('div', 'display:flex;gap:8px;')
  const saveBtn = document.createElement('button'); saveBtn.textContent = '\u2713 Save to my identity'
  saveBtn.style.cssText = 'flex:1;background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;'
  const discBtn = document.createElement('button'); discBtn.textContent = '\u2715 Not now'
  discBtn.style.cssText = 'background:rgba(51,51,51,0.8);color:#999;border:none;border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer;'
  discBtn.addEventListener('click', () => { chrome.storage.local.set({ lastIdentityOffer: Date.now() }); closeOverlay(ov) })
  acts.appendChild(saveBtn); acts.appendChild(discBtn); pan.appendChild(acts)

  // Save handler — only save accepted blocks
  saveBtn.addEventListener('click', async () => {
    const accepted = mergeResults.filter(mr => blockAccepted[mr.profileKey])
    if (accepted.length === 0) { chrome.storage.local.set({ lastIdentityOffer: Date.now() }); closeOverlay(ov); return }

    saveBtn.textContent = 'Saving...'; (saveBtn as HTMLButtonElement).disabled = true

    let savedCount = 0
    for (const mr of accepted) {
      let finalContent = blockEditors[mr.profileKey]?.value || mr.updatedContent
      // Ensure clean paragraph spacing — no triple+ newlines, always double between sections
      finalContent = finalContent.replace(/\n{3,}/g, '\n\n').trim()
      const res = await supaFetch('identity_blocks?profile_key=eq.' + mr.profileKey, {
        method: 'PATCH',
        body: JSON.stringify({ content: finalContent, last_edited_at: new Date().toISOString() })
      })
      if (res) savedCount++
    }

    // Regenerate Full Me by concatenating all 3 blocks
    try {
      const freshBlocks = await supaFetch('identity_blocks?profile_key=in.(business,personal,voice)&select=profile_key,content')
      if (freshBlocks) {
        const biz = freshBlocks.find((b: any) => b.profile_key === 'business')?.content || ''
        const pers = freshBlocks.find((b: any) => b.profile_key === 'personal')?.content || ''
        const voice = freshBlocks.find((b: any) => b.profile_key === 'voice')?.content || ''
        const fullMe = '\u2500\u2500 Business \u2500\u2500\n' + biz + '\n\n\u2500\u2500 Personal \u2500\u2500\n' + pers + '\n\n\u2500\u2500 My Voice \u2500\u2500\n' + voice
        await supaFetch('identity_blocks?profile_key=eq.full', {
          method: 'PATCH',
          body: JSON.stringify({ content: fullMe, last_edited_at: new Date().toISOString() })
        })
      }
    } catch (e) { log('Full Me regen failed:', e) }

    // Update local cache
    try {
      const updated = await supaFetch('identity_blocks?order=sort_order&select=profile_key,label,emoji,content,sort_order,last_edited_at')
      if (updated) await chrome.storage.local.set({ identity_blocks: updated, last_synced_at: Date.now() })
    } catch {}

    // Record the offer timestamp
    chrome.storage.local.set({ lastIdentityOffer: Date.now() })

    // Show confirmation
    pan.innerHTML = '<div style="text-align:center;padding:32px 0;"><div style="display:flex;justify-content:center;margin-bottom:12px;color:#10b981;">'+UI_ICONS.checkCircle+'</div><div style="font-size:14px;font-weight:600;">Identity updated!</div><div style="font-size:12px;color:#999;margin-top:6px;">' + savedCount + ' block' + (savedCount !== 1 ? 's' : '') + ' saved. Your AI will know you better next conversation.</div><a href="https://identity.northr.ai/dashboard" target="_blank" style="color:#888;font-size:12px;text-decoration:none;margin-top:12px;display:inline-block;">View your profile \u2192</a></div>'
    setTimeout(() => closeOverlay(ov), 4000)
  })
}

// ═══════════════════ IDENTITY EXTRACTION QUALIFICATION ═══════════════════

async function shouldOfferIdentityExtraction(): Promise<{ qualified: boolean; isFirstTime: boolean }> {
  const token = await getAuthToken()
  if (!token) return { qualified: false, isFirstTime: false }

  // Check nag suppression
  const { lastIdentityOffer } = await getLocal(['lastIdentityOffer'])
  if (lastIdentityOffer) {
    const daysSince = (Date.now() - lastIdentityOffer) / (1000 * 60 * 60 * 24)
    if (daysSince < 7) return { qualified: false, isFirstTime: false }
  }

  // Get blocks and check word count
  const blocks = await getBlocks()
  const threeBlocks = blocks.filter(b => b.profile_key !== 'full')
  const totalWords = threeBlocks.reduce((sum, b) => sum + wc(b.content), 0)

  // Don't nag if already comprehensive (1200 words across 3 blocks)
  if (totalWords >= 1200) return { qualified: false, isFirstTime: false }

  const isFirstTime = totalWords === 0
  const isThin = totalWords < 500

  return { qualified: isFirstTime || isThin, isFirstTime }
}

// ═══════════════════ SAVE FLOW ═══════════════════

function closeOverlay(o: HTMLElement) { o.style.opacity = '0'; setTimeout(() => o.remove(), 200) }

async function openSaveFlow(platform: Platform) {
  const ov = document.createElement('div'); ov.id = 'northr-overlay'
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;transition:opacity 0.2s;opacity:0;'
  document.body.appendChild(ov)
  requestAnimationFrame(() => { ov.style.opacity = '1' })

  const pan = document.createElement('div')
  pan.style.cssText = 'background:rgba(26,26,26,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:#e2e8f0;border-radius:16px;padding:24px;width:440px;max-height:80vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);'
  pan.innerHTML = '<div style="text-align:center;padding:32px 0;"><div style="display:flex;justify-content:center;margin-bottom:12px;color:#999;">'+UI_ICONS.loader+'</div><div style="color:#999;font-size:13px;">Analyzing conversation...</div></div>'
  ov.appendChild(pan)

  const conv = extractConversation(platform)
  if (!conv) { pan.innerHTML = errHtml('Could not extract conversation.'); document.getElementById('northr-xerr')?.addEventListener('click', () => closeOverlay(ov)); return }

  const result = await summarizeSession(conv, platform)
  if (!result) { pan.innerHTML = errHtml('Analysis failed.'); document.getElementById('northr-xerr')?.addEventListener('click', () => closeOverlay(ov)); return }

  const workspaces = await fetchWorkspaces()
  const defaults = await getSmartDefaults(platform)
  buildReviewPanel(pan, ov, platform, result, workspaces, defaults)
}

function errHtml(msg: string): string {
  return '<div style="text-align:center;padding:24px;color:#999;">'+msg+'</div><div style="text-align:center;margin-top:12px;"><button id="northr-xerr" style="background:#333;color:#ccc;border:none;border-radius:8px;padding:8px 20px;cursor:pointer;">Close</button></div>'
}

// ═══════════════════ REVIEW PANEL ═══════════════════

async function buildReviewPanel(pan: HTMLElement, ov: HTMLElement, platform: Platform, data: SessionSummary, workspaces: Workspace[], defaults: { workspaceId?: string, projectId?: string }) {
  // State
  let selWsId = defaults.workspaceId || (workspaces.length > 0 ? workspaces[0].id : '')
  let selProjId = defaults.projectId || ''
  let newWsName = '', newProjName = '', isNewWs = workspaces.length === 0, isNewProj = workspaces.length === 0
  let projects: Project[] = []

  const S = 'width:100%;background:rgba(34,34,34,0.8);color:#e2e8f0;border:1px solid rgba(68,68,68,0.6);border-radius:8px;padding:8px 10px;font-size:12px;outline:none;font-family:inherit;'

  pan.innerHTML = ''

  // ── Header ──
  const hdr = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;')
  hdr.innerHTML = '<span style="font-size:15px;font-weight:700;">Save Session</span>'
  const xBtn = el('button', 'background:none;border:none;color:#666;font-size:18px;cursor:pointer;'); xBtn.textContent = '\u2715'
  xBtn.addEventListener('click', () => closeOverlay(ov)); hdr.appendChild(xBtn); pan.appendChild(hdr)

  // ── Workspace ──
  const wsLabel = el('label', 'font-size:11px;color:#888;display:block;margin-bottom:4px;'); wsLabel.textContent = 'Workspace'; pan.appendChild(wsLabel)

  const wsSelect = document.createElement('select'); wsSelect.style.cssText = S + (isNewWs ? 'display:none;' : '')
  workspaces.forEach(w => { const o = document.createElement('option'); o.value = w.id; const prefix = (w.icon && WS_ICONS[w.icon]) ? '\u25C6 ' : (w.emoji ? w.emoji + ' ' : ''); o.textContent = prefix + w.name; if (w.id === selWsId) o.selected = true; wsSelect.appendChild(o) })
  const newWsOpt = document.createElement('option'); newWsOpt.value = '__new__'; newWsOpt.textContent = '+ Create new workspace'
  if (isNewWs) newWsOpt.selected = true; wsSelect.appendChild(newWsOpt)
  pan.appendChild(wsSelect)

  const wsInput = document.createElement('input'); wsInput.type = 'text'; wsInput.placeholder = 'Workspace name...'
  wsInput.style.cssText = S + 'margin-top:6px;' + (isNewWs ? '' : 'display:none;')
  pan.appendChild(wsInput)

  // ── Project ──
  const projLabel = el('label', 'font-size:11px;color:#888;display:block;margin-bottom:4px;margin-top:12px;'); projLabel.textContent = 'Project'; pan.appendChild(projLabel)

  const projSelect = document.createElement('select'); projSelect.style.cssText = S + (isNewProj ? 'display:none;' : '')
  projSelect.innerHTML = '<option>Loading...</option>'
  pan.appendChild(projSelect)

  const projInput = document.createElement('input'); projInput.type = 'text'; projInput.placeholder = 'Project name...'
  projInput.style.cssText = S + 'margin-top:6px;' + (isNewProj ? '' : 'display:none;')
  pan.appendChild(projInput)

  // ── Divider ──
  pan.appendChild(el('div', 'height:1px;background:rgba(255,255,255,0.06);margin:16px 0;'))

  // ── Summary ──
  const sumLabel = el('label', 'font-size:11px;color:#888;display:block;margin-bottom:4px;'); sumLabel.textContent = 'Summary'; pan.appendChild(sumLabel)
  const sumTA = document.createElement('textarea'); sumTA.id = 'northr-sum'; sumTA.value = data.summary
  sumTA.style.cssText = S + 'min-height:60px;resize:vertical;line-height:1.5;'; pan.appendChild(sumTA)

  // ── Lists ──
  pan.appendChild(buildList('Key decisions', data.key_decisions, 'northr-kd'))
  pan.appendChild(buildList('Next steps', data.next_steps, 'northr-ns'))
  pan.appendChild(buildList('Open questions', data.open_questions, 'northr-oq'))

  // ── Actions ──
  const acts = el('div', 'display:flex;gap:8px;margin-top:16px;')
  const saveBtn = document.createElement('button'); saveBtn.textContent = '\u2713 Save to project'
  saveBtn.style.cssText = 'flex:1;background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;'
  const discBtn = document.createElement('button'); discBtn.textContent = '\u2715 Discard'
  discBtn.style.cssText = 'background:rgba(51,51,51,0.8);color:#999;border:none;border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer;'
  discBtn.addEventListener('click', () => closeOverlay(ov))
  acts.appendChild(saveBtn); acts.appendChild(discBtn); pan.appendChild(acts)

  // ── Load projects helper ──
  async function loadProj(wsId: string) {
    projSelect.innerHTML = '<option>Loading...</option>'
    projects = await fetchProjects(wsId)
    projSelect.innerHTML = ''
    projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name; if (p.id === selProjId) o.selected = true; projSelect.appendChild(o) })
    const newO = document.createElement('option'); newO.value = '__new__'; newO.textContent = '+ New project'; projSelect.appendChild(newO)
    if (projects.length === 0) {
      // No projects in this workspace — show text input directly
      isNewProj = true; projSelect.style.display = 'none'; projInput.style.display = 'block'
    } else {
      isNewProj = false; projSelect.style.display = 'block'; projInput.style.display = 'none'
      if (!selProjId) selProjId = projects[0].id
    }
  }

  // ── Workspace events ──
  wsSelect.addEventListener('change', () => {
    if (wsSelect.value === '__new__') {
      isNewWs = true; isNewProj = true
      wsInput.style.display = 'block'; wsInput.focus()
      projSelect.style.display = 'none'; projInput.style.display = 'block'
    } else {
      isNewWs = false; wsInput.style.display = 'none'
      selWsId = wsSelect.value; selProjId = ''
      loadProj(wsSelect.value)
    }
  })
  wsInput.addEventListener('input', () => { newWsName = wsInput.value })

  // ── Project events ──
  projSelect.addEventListener('change', () => {
    if (projSelect.value === '__new__') {
      isNewProj = true; projInput.style.display = 'block'; projInput.focus()
    } else {
      isNewProj = false; projInput.style.display = 'none'; selProjId = projSelect.value
    }
  })
  projInput.addEventListener('input', () => { newProjName = projInput.value })

  // ── Save ──
  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = 'Saving...'; (saveBtn as HTMLButtonElement).disabled = true

    const payload: any = {
      platform,
      summary: (document.getElementById('northr-sum') as HTMLTextAreaElement).value,
      key_decisions: listVals('northr-kd'),
      next_steps: listVals('northr-ns'),
      open_questions: listVals('northr-oq'),
      messageCount: countUserMessages()
    }

    // Workspace: pass name or ID to edge function (server handles creation)
    if (isNewWs && newWsName.trim()) {
      payload.workspaceName = newWsName.trim()
    } else if (selWsId) {
      payload.workspaceId = selWsId
    }

    // Project
    if (isNewProj && newProjName.trim()) { payload.projectName = newProjName.trim() }
    else if (selProjId) { payload.projectId = selProjId }

    log('Saving:', JSON.stringify(payload))
    const res = await saveSnapshot(payload)

    if (res) {
      const name = isNewProj ? newProjName : (projects.find(p => p.id === selProjId)?.name || newProjName || 'project')
      const finalProjectId = res.projectId || selProjId
      if (finalProjectId && selWsId) await saveSmartDefaults(platform, selWsId, finalProjectId)

      // Track session count for 5th-session identity suggestion
      trackSessionAndSuggestIdentity(platform)

      // Auto-populate Foundation if empty (first session defines the project)
      if (finalProjectId) {
        try {
          const proj = await supaFetch('projects?id=eq.' + finalProjectId + '&select=id,foundation')
          if (proj && proj[0] && (!proj[0].foundation || !proj[0].foundation.trim())) {
            const summary = (document.getElementById('northr-sum') as HTMLTextAreaElement).value
            if (summary.trim()) {
              await supaFetch('projects?id=eq.' + finalProjectId, {
                method: 'PATCH',
                body: JSON.stringify({ foundation: summary.trim() })
              })
              log('Foundation auto-set for project', finalProjectId)
            }
          }
        } catch (e) { log('Foundation auto-set failed:', e) }
      }

      pan.innerHTML = '<div style="text-align:center;padding:32px 0;"><div style="display:flex;justify-content:center;margin-bottom:12px;color:#10b981;">'+UI_ICONS.checkCircle+'</div><div style="font-size:14px;font-weight:600;">Saved to "'+esc(name)+'"</div><a href="https://identity.northr.ai/dashboard" target="_blank" style="color:#888;font-size:12px;text-decoration:none;margin-top:8px;display:inline-block;">View in dashboard \u2192</a></div>'
      setTimeout(() => closeOverlay(ov), 3000)
    } else { saveBtn.textContent = 'Failed \u2014 try again'; (saveBtn as HTMLButtonElement).disabled = false }
  })

  // ── Init ──
  if (isNewWs) {
    // Zero workspaces: both inputs visible, focus workspace name
    setTimeout(() => wsInput.focus(), 100)
  } else if (selWsId) {
    loadProj(selWsId)
  }
}

// ═══════════════════ LIST HELPERS ═══════════════════

function el(tag: string, css: string): HTMLElement { const e = document.createElement(tag); e.style.cssText = css; return e }

function buildList(label: string, items: string[], gid: string): HTMLElement {
  const wrap = el('div', 'margin-top:12px;')
  const lbl = el('label', 'font-size:11px;color:#888;display:block;margin-bottom:4px;'); lbl.textContent = label; wrap.appendChild(lbl)
  const list = el('div', 'display:flex;flex-direction:column;gap:4px;'); list.id = gid
  items.forEach(item => list.appendChild(listRow(item)))
  wrap.appendChild(list)
  const addBtn = el('button', 'background:none;border:none;color:#666;font-size:11px;cursor:pointer;padding:4px 0;'); addBtn.textContent = '+ add'
  addBtn.addEventListener('click', () => { const r = listRow(''); list.appendChild(r); (r.querySelector('input') as HTMLInputElement)?.focus() })
  wrap.appendChild(addBtn)
  return wrap
}

function listRow(val: string): HTMLElement {
  const row = el('div', 'display:flex;gap:4px;align-items:center;'); row.className = 'nli'
  const dot = el('span', 'color:#666;font-size:11px;'); dot.textContent = '\u2022'
  const inp = document.createElement('input'); inp.className = 'nli-inp'; inp.value = val
  inp.style.cssText = 'flex:1;background:rgba(34,34,34,0.8);color:#e2e8f0;border:1px solid rgba(68,68,68,0.6);border-radius:6px;padding:6px 8px;font-size:12px;outline:none;'
  const del = el('button', 'background:none;border:none;color:#666;cursor:pointer;font-size:14px;padding:2px 4px;'); del.textContent = '\u2715'
  del.addEventListener('click', () => row.remove())
  row.appendChild(dot); row.appendChild(inp); row.appendChild(del)
  return row
}

function listVals(gid: string): string[] {
  return Array.from(document.querySelectorAll('#'+gid+' .nli-inp') as NodeListOf<HTMLInputElement>).map(i => i.value.trim()).filter(v => v.length > 0)
}

// ═══════════════════ SESSION MONITORING ═══════════════════

export function startSessionMonitoring(platform: Platform) {
  let identityCheckDone = false

  setInterval(async () => {
    if (bannerInjected && identityBannerInjected) return
    if (bannerDismissed && identityBannerDismissed) return

    try {
      chrome.runtime.sendMessage({ type: 'MESSAGE_COUNT_UPDATE', count: countUserMessages() })
      chrome.runtime.sendMessage({ type: 'CHECK_SHOW_BANNER' }, async (show: boolean) => {
        if (chrome.runtime.lastError) return

        if (!identityCheckDone && show) {
          identityCheckDone = true
          const { qualified, isFirstTime } = await shouldOfferIdentityExtraction()

          if (qualified && isFirstTime) {
            // First-time user: show identity offer ONLY, skip session save
            injectIdentityBanner(platform, true)
          } else if (qualified) {
            // Returning user with thin blocks: show session save first
            if (!bannerInjected && !bannerDismissed) injectSaveBanner(platform)
            // Then show identity offer after a delay
            setTimeout(() => {
              if (!identityBannerInjected && !identityBannerDismissed) {
                injectIdentityBanner(platform, false)
              }
            }, 5000)
          } else {
            // Not qualified for identity: just show session save
            if (!bannerInjected && !bannerDismissed) injectSaveBanner(platform)
          }
        } else if (show && !bannerInjected && !bannerDismissed) {
          // Fallback: show session save if identity check already done
          injectSaveBanner(platform)
        }
      })
    } catch {}
  }, 30000)
}

// ═══════════════════ IDENTITY MENU (one-click inject) ═══════════════════

let menuCreated = false, menuOpen = false
let menuEl: HTMLElement | null = null, dotEl: HTMLElement | null = null
let currentPlatform: Platform = 'chatgpt'

export function createNorthrProfileMenu(findEditorFn: () => HTMLElement | null, platform: Platform) {
  if (menuCreated) return
  menuCreated = true; currentPlatform = platform
  const theme = THEMES[platform]

  // ── Dot ──
  const dot = document.createElement('div'); dot.id = 'northr-dot'
  dot.style.cssText = 'position:fixed;bottom:24px;right:24px;width:28px;height:28px;border-radius:50%;background:'+theme.dotBg+';backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:all 0.2s;opacity:0.5;box-shadow:0 1px 6px rgba(0,0,0,0.2);'
  dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+theme.dot+'">N</text></svg>'
  dot.title = 'Northr Identity (\u2318I)'
  dot.addEventListener('mouseenter', () => { dot.style.opacity = '1'; dot.style.transform = 'scale(1.15)' })
  dot.addEventListener('mouseleave', () => { if (!menuOpen) dot.style.opacity = '0.5'; dot.style.transform = 'scale(1)' })
  dot.addEventListener('click', e => { e.stopPropagation(); toggleMenu() })
  document.body.appendChild(dot); dotEl = dot

  // ── Menu ──
  const bgR = parseInt(theme.bg.slice(1,3),16), bgG = parseInt(theme.bg.slice(3,5),16), bgB = parseInt(theme.bg.slice(5,7),16)
  const menu = document.createElement('div'); menu.id = 'northr-menu'
  menu.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:rgba('+bgR+','+bgG+','+bgB+',0.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:'+theme.text+';border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:12px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 8px 40px rgba(0,0,0,0.4);display:none;flex-direction:column;gap:8px;transition:opacity 0.15s,transform 0.15s;opacity:0;width:300px;'
  menu.addEventListener('click', e => e.stopPropagation())
  document.body.appendChild(menu); menuEl = menu

  loadMenu(platform, findEditorFn)

  document.addEventListener('click', () => { if (menuOpen) closeMenu() })
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); toggleMenu(); return }
    if (e.key === 'Escape' && menuOpen) { closeMenu(); return }
    if (menuOpen && e.key >= '1' && e.key <= '4') {
      const cards = menuEl?.querySelectorAll('[data-bk]') as NodeListOf<HTMLElement>
      if (cards && cards[parseInt(e.key)-1]) cards[parseInt(e.key)-1].click()
    }
  })

  new MutationObserver(() => { if (window.location.href !== lastUrl) { lastUrl = window.location.href; resetDot(platform) } }).observe(document.body, { childList: true, subtree: true })
  log('Northr v5 ready')
}

let lastUrl = ''

function toggleMenu() { if (menuOpen) closeMenu(); else openMenu() }
function openMenu() { if (!menuEl || !dotEl) return; menuEl.style.display = 'flex'; dotEl.style.opacity = '1'; requestAnimationFrame(() => { menuEl!.style.opacity = '1'; menuEl!.style.transform = 'translateX(-50%) translateY(0)' }); menuOpen = true }
function closeMenu() { if (!menuEl || !dotEl) return; menuEl.style.opacity = '0'; menuEl.style.transform = 'translateX(-50%) translateY(12px)'; dotEl.style.opacity = '0.5'; setTimeout(() => { menuEl!.style.display = 'none' }, 150); menuOpen = false }
function resetDot(p: Platform) { if (!dotEl) return; const t = THEMES[p]; dotEl.style.border = '1px solid rgba(255,255,255,0.1)'; dotEl.style.opacity = '0.5'; dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+t.dot+'">N</text></svg>' }

async function loadMenu(platform: Platform, findEditorFn: () => HTMLElement | null) {
  if (!menuEl) return
  const theme = THEMES[platform]
  const blocks = await getBlocks()
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  lastUrl = window.location.href

  // Header
  const hdr = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:0 2px 4px;')
  hdr.innerHTML = '<span style="font-weight:600;font-size:12px;color:'+theme.muted+';">Northr Identity</span><span style="font-size:10px;color:rgba(255,255,255,0.2);">'+(isMac?'\u2318':'Ctrl+')+'I</span>'
  menuEl.appendChild(hdr)

  // Grid — one-click inject
  const grid = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:6px;')

  async function inject(block: IdentityBlock) {
    const editor = findEditorFn(); if (!editor) { showToast('Editor not found.', theme); return }
    setEditorContent(editor, fmtBlock(block) + getEditorContent(editor))
    closeMenu(); showToast(block.label + ' injected \u2014 ' + wc(block.content) + 'w', theme)
    if (dotEl) {
      dotEl.style.border = '1px solid #10b981'; dotEl.style.opacity = '1'
      dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="#10b981">\u2713</text></svg>'
      setTimeout(() => resetDot(platform), 4000)
    }
  }

  blocks.forEach((block, idx) => {
    const w = wc(block.content), empty = w === 0
    const card = document.createElement('div'); card.dataset.bk = block.profile_key
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border-radius:10px;background:rgba(255,255,255,0.04);border:2px solid transparent;cursor:pointer;transition:all 0.15s;position:relative;'+(empty?'opacity:0.4;':'')
    card.innerHTML = '<div style="position:absolute;top:4px;right:6px;font-size:9px;color:rgba(255,255,255,0.2);">'+(idx+1)+'</div><div style="color:'+theme.text+';opacity:0.7;">'+(ICONS[block.emoji]||'')+'</div><div style="font-size:12px;font-weight:600;">'+block.label+'</div><div style="font-size:10px;color:'+theme.muted+';">'+(empty?'empty':w+'w')+'</div>'
    card.addEventListener('mouseenter', () => { card.style.background = 'rgba(255,255,255,0.08)'; if (!empty) card.style.border = '2px solid '+theme.selected+'60' })
    card.addEventListener('mouseleave', () => { card.style.background = 'rgba(255,255,255,0.04)'; card.style.border = '2px solid transparent' })
    card.addEventListener('click', () => { if (empty) showToast('Block empty. Add on dashboard.', theme); else inject(block) })
    grid.appendChild(card)
  })
  menuEl.appendChild(grid)

  // Save session button (always visible, Pro-gated on click)
  const sr = el('div', 'display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.04);cursor:pointer;transition:all 0.15s;margin-top:2px;')
  sr.innerHTML = '<span style="display:flex;align-items:center;color:'+theme.muted+';">'+UI_ICONS.save+'</span><span style="font-size:11px;color:'+theme.muted+';">Save this session</span>'
  sr.addEventListener('mouseenter', () => { sr.style.background = 'rgba(255,255,255,0.08)' })
  sr.addEventListener('mouseleave', () => { sr.style.background = 'rgba(255,255,255,0.04)' })
  sr.addEventListener('click', async () => {
    const msgCount = countUserMessages()
    if (msgCount === 0) { showToast('Have a conversation first, then save it here.', theme); return }
    if (msgCount < 2) { showToast('Chat a bit more \u2014 need 2+ messages in this conversation.', theme); return }
    const pro = await isProUser()
    if (pro) {
      closeMenu(); openSaveFlow(platform)
    } else {
      closeMenu()
      window.open('https://identity.northr.ai/settings?upgrade=true', '_blank')
    }
  })
  menuEl.appendChild(sr)

  // Identity extraction trigger (always visible)
  const ir = el('div', 'display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.04);cursor:pointer;transition:all 0.15s;margin-top:2px;')
  ir.innerHTML = '<span style="display:flex;align-items:center;color:'+theme.muted+';">'+UI_ICONS.user+'</span><span style="font-size:11px;color:'+theme.muted+';">Learn about me</span>'
  ir.addEventListener('mouseenter', () => { ir.style.background = 'rgba(255,255,255,0.08)' })
  ir.addEventListener('mouseleave', () => { ir.style.background = 'rgba(255,255,255,0.04)' })
  ir.addEventListener('click', () => {
    const msgCount = countUserMessages()
    if (msgCount === 0) { showToast('Have a conversation first \u2014 I\'ll learn about you from it.', theme); return }
    if (msgCount < 2) { showToast('Chat a bit more \u2014 need 2+ messages to find identity signals.', theme); return }
    closeMenu(); openIdentityExtractionFlow(platform)
  })
  menuEl.appendChild(ir)

  // Footer
  const ft = el('div', 'text-align:center;font-size:10px;color:rgba(255,255,255,0.15);padding-top:2px;')
  ft.innerHTML = '<a href="https://identity.northr.ai" target="_blank" style="color:rgba(255,255,255,0.25);text-decoration:none;">identity.northr.ai</a>'
  menuEl.appendChild(ft)
}

export function watchForNavigation() {}

// ═══════════════════ MESSAGE HANDLER (for popup inject) ═══════════════════

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'INJECT_TEXT' && msg.text) {
    // Find the editor and inject
    const editors = [
      document.querySelector('#prompt-textarea'),
      document.querySelector('div.ProseMirror[contenteditable="true"]'),
      document.querySelector('div[contenteditable="true"]'),
      document.querySelector('.ql-editor[contenteditable="true"]'),
      document.querySelector('textarea'),
    ]
    const editor = editors.find(e => e !== null) as HTMLElement | null
    if (editor) {
      const current = getEditorContent(editor)
      setEditorContent(editor, msg.text + current)
      sendResponse({ success: true })
    } else {
      sendResponse({ success: false, error: 'Editor not found' })
    }
  }

  // Return conversation data to popup for auto-save
  if (msg.type === 'GET_CONVERSATION') {
    const p = detectPlatform()
    if (p === 'other') { sendResponse({ conversation: null }); return true }
    const conv = extractConversation(p)
    sendResponse({ conversation: conv, platform: p, messageCount: countUserMessages() })
  }

  return true
})

// ═══════════════════ 5TH SESSION IDENTITY SUGGESTION ═══════════════════

async function trackSessionAndSuggestIdentity(platform: Platform) {
  const { northrSessionCount = 0 } = await getLocal(['northrSessionCount'])
  const newCount = northrSessionCount + 1
  await chrome.storage.local.set({ northrSessionCount: newCount })

  // Every 5th session, suggest identity extraction (if qualified)
  if (newCount % 5 === 0) {
    const { qualified } = await shouldOfferIdentityExtraction()
    if (qualified) {
      injectIdentityBanner(platform, false)
    }
  }

  // One-time Pro upgrade nudge at 5th conversation for free users
  if (newCount === 5) {
    const pro = await isProUser()
    const { proNudgeShown } = await getLocal(['proNudgeShown'])
    if (!pro && !proNudgeShown) {
      await chrome.storage.local.set({ proNudgeShown: true })
      setTimeout(() => {
        if (bannerInjected || bannerDismissed) return
        const b = document.createElement('div'); b.id = 'northr-pro-nudge'
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(26,26,26,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#e2e8f0;display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 20px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.08);transition:transform 0.3s;transform:translateY(-100%);'
        b.innerHTML = '<span style="color:#e2e8f0;">You\'re getting value from Northr. Want to save your sessions too?</span><button id="northr-pn-yes" style="background:rgba(255,255,255,0.9);color:#0f0f0f;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">Try Pro free for 7 days</button><button id="northr-pn-no" style="background:transparent;color:#888;border:none;font-size:12px;cursor:pointer;padding:4px 8px;">Not now</button>'
        document.body.appendChild(b)
        requestAnimationFrame(() => { b.style.transform = 'translateY(0)' })
        document.getElementById('northr-pn-no')!.addEventListener('click', () => { b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300) })
        document.getElementById('northr-pn-yes')!.addEventListener('click', () => { window.open('https://identity.northr.ai/settings?upgrade=true', '_blank'); b.style.transform = 'translateY(-100%)'; setTimeout(() => b.remove(), 300) })
      }, 3000)
    }
  }
}
