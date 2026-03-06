// Northr Identity — Content Script (Narrative Block Profiles v2)

const LOG_PREFIX = '[Northr]'
const SUPABASE_URL = 'https://ogymhddaeetmxmbtbxne.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9neW1oZGRhZWV0bXhtYnRieG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxMzUsImV4cCI6MjA4Nzk3MTEzNX0.sZEMegD6VROBNJqkPAnSEgbSYSit1Yx_ZcQ_35nisug'

export function log(...args: any[]) { console.log(LOG_PREFIX, ...args) }

// ── Types ──

interface IdentityBlock {
  profile_key: string
  label: string
  emoji: string
  content: string
  sort_order: number
  last_edited_at?: string
}

type Platform = 'chatgpt' | 'claude' | 'gemini'

// ── SVG Icons (outlined/stroke style) ──

const ICONS: Record<string, string> = {
  briefcase: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'pen-tool': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
  globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
}

// ── Default blocks ──

function getDefaultBlocks(): IdentityBlock[] {
  return [
    { profile_key: 'business', label: 'Business', emoji: 'briefcase', content: '', sort_order: 1 },
    { profile_key: 'personal', label: 'Personal', emoji: 'heart', content: '', sort_order: 2 },
    { profile_key: 'voice', label: 'My Voice', emoji: 'pen-tool', content: '', sort_order: 3 },
    { profile_key: 'full', label: 'Full Me', emoji: 'globe', content: '', sort_order: 4 },
  ]
}

// ── Platform themes ──

const THEMES: Record<Platform, Record<string, string>> = {
  chatgpt: { bg:'#2f2f2f',text:'#ececec',accent:'#10a37f',hover:'#3a3a3a',border:'#444444',muted:'#888888',dot:'#ffffff',dotBg:'#2f2f2f',cardBg:'#363636',selected:'#10a37f' },
  claude: { bg:'#2b2a27',text:'#e8e4dd',accent:'#d97706',hover:'#3a3937',border:'#444240',muted:'#9a958e',dot:'#ffffff',dotBg:'#2b2a27',cardBg:'#343330',selected:'#d97706' },
  gemini: { bg:'#1e1f20',text:'#e3e3e3',accent:'#8ab4f8',hover:'#2c2d2e',border:'#3c4043',muted:'#9aa0a6',dot:'#ffffff',dotBg:'#1e1f20',cardBg:'#28292a',selected:'#8ab4f8' }
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

// ── Data access ──

async function getLocal(keys: string[]): Promise<Record<string, any>> {
  return new Promise((r) => chrome.storage.local.get(keys, r))
}

async function getBlocks(): Promise<IdentityBlock[]> {
  const { identity_blocks } = await getLocal(['identity_blocks'])

  // Always try Supabase first if we have an auth token
  try {
    const token = await getAuthToken()
    if (token) {
      const blocks = await supaFetch('identity_blocks?order=sort_order&select=profile_key,label,emoji,content,sort_order,last_edited_at')
      if (blocks && blocks.length > 0) {
        await chrome.storage.local.set({ identity_blocks: blocks, last_synced_at: Date.now() })
        return blocks
      }
    }
  } catch (e) { log('Supabase fetch failed, using local:', e) }

  // Fallback: use locally cached blocks
  if (identity_blocks && identity_blocks.length > 0) return identity_blocks
  return getDefaultBlocks()
}

function wordCount(text: string): number {
  if (!text || !text.trim()) return 0
  return text.trim().split(/\s+/).length
}

// ── Injection format ──

function formatBlock(block: IdentityBlock): string {
  return '[About me - ' + block.label + ']\n' + block.content + '\n[End]\n\n'
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

// ── Toast ──

function showToast(msg: string, theme: Record<string, string>) {
  const e = document.getElementById('northr-toast'); if (e) e.remove()
  const t = document.createElement('div'); t.id = 'northr-toast'
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:'+theme.bg+';color:'+theme.text+';padding:10px 20px;border-radius:10px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 4px 20px rgba(0,0,0,0.4);border:1px solid '+theme.border+';transition:opacity 0.3s;opacity:0;max-width:360px;text-align:center;'
  t.textContent = msg; document.body.appendChild(t)
  requestAnimationFrame(() => { t.style.opacity = '1' })
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300) }, 3000)
}

// ── UI: Dot indicator + Bottom-center 2x2 grid menu ──

let menuCreated = false, menuOpen = false
let menuEl: HTMLElement | null = null, dotEl: HTMLElement | null = null
let selectedKey: string | null = null

export function createNorthrProfileMenu(findEditorFn: () => HTMLElement | null, platform: Platform) {
  if (menuCreated) return
  menuCreated = true
  const theme = THEMES[platform]

  // ── Dot indicator ──
  const dot = document.createElement('div'); dot.id = 'northr-dot'
  dot.style.cssText = 'position:fixed;bottom:24px;right:24px;width:28px;height:28px;border-radius:50%;background:'+theme.dotBg+';border:2px solid '+theme.dot+'30;cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:all 0.2s;opacity:0.5;box-shadow:0 1px 6px rgba(0,0,0,0.2);'
  dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+theme.dot+'">N</text></svg>'
  dot.title = 'Northr Identity (\u2318I)'
  dot.addEventListener('mouseenter', () => { dot.style.opacity = '1'; dot.style.transform = 'scale(1.15)' })
  dot.addEventListener('mouseleave', () => { if (!menuOpen) dot.style.opacity = '0.5'; dot.style.transform = 'scale(1)' })
  dot.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu() })
  document.body.appendChild(dot); dotEl = dot

  // ── Menu container ──
  const menu = document.createElement('div'); menu.id = 'northr-menu'
  menu.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:'+theme.bg+';color:'+theme.text+';border:1px solid '+theme.border+';border-radius:16px;padding:12px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;z-index:2147483647;box-shadow:0 8px 40px rgba(0,0,0,0.4);display:none;flex-direction:column;gap:8px;transition:opacity 0.15s,transform 0.15s;opacity:0;width:300px;'
  menu.addEventListener('click', (e) => e.stopPropagation())
  document.body.appendChild(menu); menuEl = menu

  loadMenu(platform, findEditorFn)

  document.addEventListener('click', () => { if (menuOpen) closeMenu() })
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); toggleMenu(); return }
    if (e.key === 'Escape' && menuOpen) { closeMenu(); return }
    if (menuOpen && e.key >= '1' && e.key <= '4') {
      const cards = menuEl?.querySelectorAll('[data-block-key]') as NodeListOf<HTMLElement>
      if (cards && cards[parseInt(e.key)-1]) cards[parseInt(e.key)-1].click()
    }
    if (menuOpen && e.key === 'Enter' && selectedKey) {
      const injectBtn = document.getElementById('northr-inject-btn')
      if (injectBtn) injectBtn.click()
    }
  })

  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) { lastUrl = window.location.href; resetDot(platform) }
  }).observe(document.body, { childList: true, subtree: true })

  log('Northr v2 ready (\u2318I to open)')
}

function toggleMenu() { if (menuOpen) closeMenu(); else openMenu() }

function openMenu() {
  if (!menuEl || !dotEl) return
  menuEl.style.display = 'flex'
  dotEl.style.opacity = '1'
  requestAnimationFrame(() => { menuEl!.style.opacity = '1'; menuEl!.style.transform = 'translateX(-50%) translateY(0)' })
  menuOpen = true
}

function closeMenu() {
  if (!menuEl || !dotEl) return
  menuEl.style.opacity = '0'; menuEl.style.transform = 'translateX(-50%) translateY(12px)'
  dotEl.style.opacity = '0.5'
  setTimeout(() => { menuEl!.style.display = 'none' }, 150)
  menuOpen = false
}

function resetDot(platform: Platform) {
  if (!dotEl) return
  dotEl.style.border = '2px solid ' + THEMES[platform].dot + '30'
  dotEl.style.opacity = '0.5'
  dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="'+THEMES[platform].dot+'">N</text></svg>'
}

async function loadMenu(platform: Platform, findEditorFn: () => HTMLElement | null) {
  if (!menuEl) return
  const theme = THEMES[platform]
  selectedKey = null

  const blocks = await getBlocks()

  // Header
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const header = document.createElement('div')
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:0 2px 4px;'
  header.innerHTML = '<span style="font-weight:600;font-size:12px;color:'+theme.muted+';">Northr Identity</span><span style="font-size:10px;color:'+theme.muted+'50;">'+(isMac?'\u2318':'Ctrl+')+'I</span>'
  menuEl.appendChild(header)

  // 2x2 grid
  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;'

  const previewEl = document.createElement('div')
  previewEl.id = 'northr-preview'
  previewEl.style.cssText = 'font-size:11px;color:'+theme.muted+';padding:4px 2px;min-height:28px;line-height:1.4;display:none;'

  blocks.forEach((block, idx) => {
    const wc = wordCount(block.content)
    const isEmpty = wc === 0
    const card = document.createElement('div')
    card.dataset.blockKey = block.profile_key
    card.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border-radius:10px;background:'+theme.cardBg+';border:2px solid transparent;cursor:pointer;transition:all 0.15s;'+(isEmpty?'opacity:0.4;':'')
    card.innerHTML = '<div style="color:'+theme.text+';opacity:0.7;">'+(ICONS[block.emoji]||'')+'</div><div style="font-size:12px;font-weight:600;">'+block.label+'</div><div style="font-size:10px;color:'+theme.muted+';">'+(isEmpty?'empty':wc+'w')+'</div>'

    card.addEventListener('mouseenter', () => { if (selectedKey !== block.profile_key) card.style.background = theme.hover })
    card.addEventListener('mouseleave', () => { if (selectedKey !== block.profile_key) card.style.background = theme.cardBg })

    card.addEventListener('click', () => {
      if (isEmpty) { showToast('This block is empty. Add content on your dashboard.', theme); return }
      // Deselect all
      const allCards = grid.querySelectorAll('[data-block-key]') as NodeListOf<HTMLElement>
      allCards.forEach(c => { c.style.border = '2px solid transparent'; c.style.background = theme.cardBg })
      // Select this one
      selectedKey = block.profile_key
      card.style.border = '2px solid ' + theme.selected
      card.style.background = theme.hover
      // Show preview
      const preview = block.content.substring(0, 80).replace(/\n/g, ' ')
      previewEl.textContent = '"' + preview + (block.content.length > 80 ? '...' : '') + '"'
      previewEl.style.display = 'block'
      // Enable inject button
      const btn = document.getElementById('northr-inject-btn') as HTMLElement
      if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto' }
    })

    grid.appendChild(card)
  })
  menuEl.appendChild(grid)

  // Preview area
  menuEl.appendChild(previewEl)

  // Inject button
  const injectBtn = document.createElement('div')
  injectBtn.id = 'northr-inject-btn'
  injectBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:10px;background:'+theme.text+';color:'+theme.bg+';font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;opacity:0.3;pointer-events:none;'
  injectBtn.textContent = 'Inject \u2192'
  injectBtn.addEventListener('mouseenter', () => { if (selectedKey) injectBtn.style.opacity = '0.85' })
  injectBtn.addEventListener('mouseleave', () => { if (selectedKey) injectBtn.style.opacity = '1' })

  injectBtn.addEventListener('click', async () => {
    if (!selectedKey) return
    const blocks = await getBlocks()
    const block = blocks.find(b => b.profile_key === selectedKey)
    if (!block || !block.content) { showToast('Block is empty.', theme); return }

    const editor = findEditorFn()
    if (!editor) { showToast('Editor not found.', theme); return }

    const text = formatBlock(block)
    const current = getEditorContent(editor)
    setEditorContent(editor, text + current)

    closeMenu()
    showToast(block.label + ' identity injected \u2014 ' + wordCount(block.content) + ' words', theme)

    // Pulse dot green
    if (dotEl) {
      dotEl.style.border = '2px solid #10b981'; dotEl.style.opacity = '1'
      dotEl.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><text x="1" y="10" font-size="11" font-weight="700" font-family="system-ui" fill="#10b981">\u2713</text></svg>'
      setTimeout(() => resetDot(platform), 4000)
    }
  })

  menuEl.appendChild(injectBtn)

  // Footer link
  const footer = document.createElement('div')
  footer.style.cssText = 'text-align:center;font-size:10px;color:'+theme.muted+'50;padding-top:2px;'
  footer.innerHTML = '<a href="https://identity.northr.ai" target="_blank" style="color:'+theme.muted+';text-decoration:none;">identity.northr.ai</a>'
  menuEl.appendChild(footer)
}

export function watchForNavigation() { /* handled inside createNorthrProfileMenu */ }
