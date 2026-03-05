// Content script for ChatGPT (chatgpt.com / chat.openai.com)
import { createNorthrProfileMenu, log } from './shared'

function findEditor(): HTMLElement | null {
  return document.querySelector('#prompt-textarea') as HTMLElement
    || document.querySelector('div[contenteditable="true"][id*="prompt"]') as HTMLElement
    || document.querySelector('textarea') as HTMLElement
}

function init() {
  const check = setInterval(() => {
    const editor = findEditor()
    if (editor) {
      createNorthrProfileMenu(findEditor, 'chatgpt')
      clearInterval(check)
    }
  }, 1000)
}

init()
log('ChatGPT content script loaded')
