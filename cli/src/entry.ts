#!/usr/bin/env bun

import { configureAiSdkWarningLogging } from './utils/ai-sdk-warnings'
import {
  isTerminalCommandBrokerInvocation,
  serveTerminalCommandBroker,
} from './utils/terminal-command-broker'

configureAiSdkWarningLogging()

if (isTerminalCommandBrokerInvocation(process.argv)) {
  await serveTerminalCommandBroker()
} else {
  await import('./index')
}
