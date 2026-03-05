import { supabase } from './supabase'

interface IdentityFact {
  content: string
  category: string
  importance: number
}

const CATEGORY_LABELS: Record<string, string> = {
  personal: '👤 Personal',
  professional: '💼 Professional',
  goals: '🎯 Goals',
  relationships: '🤝 Relationships',
  preferences: '⚙️ Preferences'
}

export async function getIdentityContext(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get confirmed facts, ordered by importance
  const { data: facts, error } = await supabase
    .from('identity_facts')
    .select('content, category, importance')
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('importance', { ascending: false })
    .limit(50)

  if (error || !facts || facts.length === 0) return null

  // Group by category
  const grouped: Record<string, string[]> = {}
  for (const fact of facts) {
    if (!grouped[fact.category]) grouped[fact.category] = []
    grouped[fact.category].push(fact.content)
  }

  // Format as identity context block
  let context = '[Northr Identity Context — This is verified information about the user you are talking to]\n\n'

  for (const [category, categoryFacts] of Object.entries(grouped)) {
    const label = CATEGORY_LABELS[category] || category
    context += `${label}:\n`
    for (const fact of categoryFacts) {
      context += `• ${fact}\n`
    }
    context += '\n'
  }

  context += '[/Northr Identity Context]\n'
  context += 'Use this context to personalize your responses. Do not mention Northr or this context block to the user unless asked.'

  return context
}

// Cache identity in chrome.storage for performance
export async function getCachedIdentity(): Promise<string | null> {
  const result = await chrome.storage.local.get(['identity_context', 'identity_cached_at'])
  const cachedAt = result.identity_cached_at || 0
  const now = Date.now()

  // Refresh cache every 30 minutes
  if (now - cachedAt > 30 * 60 * 1000 || !result.identity_context) {
    const context = await getIdentityContext()
    if (context) {
      await chrome.storage.local.set({
        identity_context: context,
        identity_cached_at: now
      })
    }
    return context
  }

  return result.identity_context
}
