import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  FALLBACK_FREEBUFF_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
  FREEBUFF_GLM_V52_MODEL_ID,
  FREEBUFF_MIMO_V25_MODEL_ID,
  FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
} from '@codebuff/common/constants/freebuff-models'

import * as auth from '../auth'
import {
  getAutoAcceptFollowups,
  getAutoAcceptFollowupsDelaySeconds,
  getAutoStartNextSession,
  loadFreebuffModelPreference,
  loadSettings,
  saveSettings,
  saveFreebuffModelPreference,
} from '../settings'

let testConfigDir: string | undefined
let getConfigDirSpy: ReturnType<typeof spyOn> | undefined

afterEach(() => {
  getConfigDirSpy?.mockRestore()
  getConfigDirSpy = undefined
  if (testConfigDir) {
    fs.rmSync(testConfigDir, { recursive: true, force: true })
    testConfigDir = undefined
  }
})

describe('freebuff model preference', () => {
  test('referral-only GLM does not replace the remembered picker model', () => {
    testConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'freebuff-settings-test-'),
    )
    getConfigDirSpy = spyOn(auth, 'getConfigDir').mockReturnValue(testConfigDir)

    saveFreebuffModelPreference(FALLBACK_FREEBUFF_MODEL_ID)
    saveFreebuffModelPreference(FREEBUFF_GLM_V52_MODEL_ID)

    expect(loadFreebuffModelPreference()).toBe(FALLBACK_FREEBUFF_MODEL_ID)
  })

  test('keeps a saved pick exactly as chosen, for every catalog row', () => {
    testConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'freebuff-settings-test-'),
    )
    getConfigDirSpy = spyOn(auth, 'getConfigDir').mockReturnValue(testConfigDir)

    // Two tests lived here, both asserting a stored V4 Pro pick was rewritten
    // to Flash on every launch. That migration is GONE as of 2026-08-21 along
    // with the supersedes notice driving it — Pro is now the cheapest premium
    // row and the catalog's first entry, so steering off it would be backwards.
    //
    // Written directly, with no migration marker, exactly like a real
    // pre-upgrade settings file — which is the case that would silently rewrite
    // if a notice came back.
    fs.writeFileSync(
      path.join(testConfigDir, 'settings.json'),
      JSON.stringify({ freebuffModel: FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID }),
    )
    expect(loadFreebuffModelPreference()).toBe(
      FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
    )

    // And a round-trip through save/load leaves every selectable row alone. The
    // property is "the picker is the user's decision, not ours" — asserted
    // across the catalog rather than on one row, because the failure mode is a
    // notice added for ONE model quietly acquiring this behaviour.
    for (const id of [
      FREEBUFF_DEEPSEEK_V4_PRO_MODEL_ID,
      FREEBUFF_DEEPSEEK_V4_FLASH_MODEL_ID,
      FREEBUFF_MIMO_V25_MODEL_ID,
    ]) {
      saveFreebuffModelPreference(id)
      expect(loadFreebuffModelPreference()).toBe(id)
    }
  })
})

describe('automation settings', () => {
  test('uses safe defaults and persists automation preferences', () => {
    testConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'freebuff-settings-test-'),
    )
    getConfigDirSpy = spyOn(auth, 'getConfigDir').mockReturnValue(testConfigDir)

    expect(getAutoStartNextSession()).toBe(false)
    expect(getAutoAcceptFollowups()).toBe(true)
    expect(getAutoAcceptFollowupsDelaySeconds()).toBe(60)

    saveSettings({
      autoStartNextSession: true,
      autoAcceptFollowups: false,
      autoAcceptFollowupsDelaySeconds: 15,
    })

    expect(getAutoStartNextSession()).toBe(true)
    expect(getAutoAcceptFollowups()).toBe(false)
    expect(getAutoAcceptFollowupsDelaySeconds()).toBe(15)
    expect(loadSettings().autoAcceptFollowupsDelaySeconds).toBe(15)
  })

  test('rejects unsafe followup delay values when loading settings', () => {
    testConfigDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'freebuff-settings-test-'),
    )
    getConfigDirSpy = spyOn(auth, 'getConfigDir').mockReturnValue(testConfigDir)
    fs.writeFileSync(
      path.join(testConfigDir, 'settings.json'),
      JSON.stringify({
        autoStartNextSession: 'yes',
        autoAcceptFollowupsDelaySeconds: 9999,
      }),
    )

    expect(getAutoStartNextSession()).toBe(false)
    expect(getAutoAcceptFollowupsDelaySeconds()).toBe(60)
  })
})
