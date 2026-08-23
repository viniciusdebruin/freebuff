import type {
  AgentRoute,
  ProviderProfile,
  RouteRequest,
  RouteRule,
  TaskKind,
} from './types.js'

function assertSteps(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new Error('maxSteps must be an integer between 1 and 200')
  }
}

export class AgentRouter {
  private readonly profiles: Map<string, ProviderProfile>
  private readonly rules: Map<TaskKind, RouteRule>

  constructor(profiles: ProviderProfile[], rules: RouteRule[]) {
    this.profiles = new Map(profiles.map(profile => [profile.name, profile]))
    this.rules = new Map()
    for (const rule of rules) {
      assertSteps(rule.maxSteps)
      if (!this.profiles.has(rule.profile)) throw new Error(`Unknown route profile: ${rule.profile}`)
      for (const fallback of rule.fallbacks ?? []) {
        if (!this.profiles.has(fallback)) throw new Error(`Unknown fallback profile: ${fallback}`)
      }
      this.rules.set(rule.kind, rule)
    }
  }

  route(request: RouteRequest): AgentRoute {
    const rule = this.rules.get(request.kind)
    const selectedName = request.preferredProfile ?? rule?.profile
    if (!selectedName) throw new Error(`No route configured for task kind: ${request.kind}`)
    const profile = this.profiles.get(selectedName)
    if (!profile) throw new Error(`Unknown requested profile: ${selectedName}`)

    const maxSteps = request.maxSteps ?? rule?.maxSteps ?? profile.maxSteps ?? 40
    assertSteps(maxSteps)
    const fallbackNames = (rule?.fallbacks ?? []).filter(name => name !== selectedName)
    return {
      kind: request.kind,
      profile,
      maxSteps,
      fallbacks: fallbackNames.map(name => this.profiles.get(name)!).filter(Boolean),
    }
  }
}

export function createDefaultRules(profiles: ProviderProfile[]): RouteRule[] {
  const names = new Set(profiles.map(profile => profile.name))
  const firstAvailable = (...candidates: string[]): string | undefined => candidates.find(name => names.has(name))
  const quick = firstAvailable('quick', 'default')
  const implementation = firstAvailable('coding', 'default', 'quick')
  const review = firstAvailable('review', 'coding', 'default')
  const research = firstAvailable('research', 'default', 'coding')
  const rules: RouteRule[] = []
  if (quick) rules.push({ kind: 'quick', profile: quick, maxSteps: 12 })
  if (implementation) rules.push({ kind: 'implementation', profile: implementation, maxSteps: 80, fallbacks: quick ? [quick] : [] })
  if (review) rules.push({ kind: 'review', profile: review, maxSteps: 40, fallbacks: implementation && implementation !== review ? [implementation] : [] })
  if (research) rules.push({ kind: 'research', profile: research, maxSteps: 50, fallbacks: quick && quick !== research ? [quick] : [] })
  return rules
}
