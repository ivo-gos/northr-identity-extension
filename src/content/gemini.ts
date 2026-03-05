// Content script for Gemini (gemini.google.com)
import { createNorthrProfileMenu, log } from './shared'

function findEditor(): HTMLElement | null {
  return document.querySelector('.ql-editor[contenteditable="true"]') as HTMLElement
    || document.querySelector('rich-textarea [contenteditable="true"]') as HTMLElement
    || document.querySelector('[contenteditable="true"]') as HTMLElement
}

function init() {
  const check = setInterval(() => {
    const editor = findEditor()
    if (editor) {
      createNorthrProfileMenu(findEditor, 'gemini')
      clearInterval(check)
    }
  }, 1000)
}

init()
log('Gemini content script loaded')
