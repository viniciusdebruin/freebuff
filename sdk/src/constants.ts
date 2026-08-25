import { env, IS_DEV, IS_TEST, IS_PROD } from '@codebuff/common/env'

import { getRuntimeAppUrlFromEnv } from './env'

export { IS_DEV, IS_TEST, IS_PROD }

export const CODEBUFF_BINARY = 'codebuff'

/** True when this SDK is embedded in the Freebuff-only CLI build. */
export const IS_FREEBUFF = process.env.FREEBUFF_MODE === 'true'

/** Keep authenticated API requests on the canonical Codebuff origin. */
const normalizeWebsiteUrl = (url: string): string =>
  url
    .replace(/\/$/, '')
    .replace(/^https:\/\/codebuff\.com(?=\/|$)/i, 'https://www.codebuff.com')

/** URL baked in at bundle time (CLI / local dev shell). */
const bundledWebsiteUrl = normalizeWebsiteUrl(env.NEXT_PUBLIC_CODEBUFF_APP_URL)

/**
 * Resolve the Codebuff backend base URL at call time. Remote hosts that bundle
 * the SDK (Convex Node actions, Next server routes) must not rely on the
 * bundle-time value: esbuild can inline a dev-machine localhost URL that the
 * remote runtime cannot reach. Deployment env wins when present.
 */
export function getWebsiteUrl(): string {
  return normalizeWebsiteUrl(getRuntimeAppUrlFromEnv() ?? bundledWebsiteUrl)
}

/** @deprecated Prefer {@link getWebsiteUrl} for runtime resolution. */
export const WEBSITE_URL = bundledWebsiteUrl
