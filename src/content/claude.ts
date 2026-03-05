// Content script for Claude (claude.ai)
import { createNorthrProfileMenu, log } from './shared'

function findEditor(): HTMLElement | null {
  return document.querySelector('div.ProseMirror[contenteditable="true"]') as HTMLElement
    || document.querySelector('[contenteditable="true"].ProseMirror') as HTMLElement
    || document.querySelector('fieldset [contenteditable="true"]') as HTMLElement
    || document.querySelector('[contenteditable="true"]') as HTMLElement
}

function init() {
  const check = setInterval(() => {
    const editor = findEditor()
    if (editor) {
      createNorthrProfileMenu(findEditor, 'claude')
      clearInterval(check)
    }
  }, 1000)
}

init()
log('Claude content script loaded')
