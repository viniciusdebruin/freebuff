/**
 * The Mimo provider currently uses an older AI SDK model specification. Keep
 * that compatibility warning out of the interactive Freebuff terminal while
 * leaving Codebuff diagnostics and all non-AI-SDK output untouched.
 */
export function configureAiSdkWarningLogging(): void {
  if (process.env.FREEBUFF_MODE !== 'true') {
    return
  }

  const globals = globalThis as { AI_SDK_LOG_WARNINGS?: false }
  globals.AI_SDK_LOG_WARNINGS = false
}
