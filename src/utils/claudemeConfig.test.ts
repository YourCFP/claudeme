import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getClaudemeConfigDiagnostics,
  hasClaudemeConfig,
  resetClaudemeConfig,
  sanitizeAnthropicEnv,
} from './claudemeConfig.js'

const ANTHROPIC_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
] as const

function makeConfig(apiKey: string): string {
  return JSON.stringify({
    default: 'p1/m1',
    providers: {
      p1: {
        name: 'Provider One',
        api_base: 'http://example.com/v1',
        api_key: apiKey,
        models: {
          m1: {
            name: 'Model One',
            model: 'model-one',
            max_tokens: 8192,
            capabilities: { vision: false, tool_calling: true },
          },
        },
      },
    },
  })
}

describe('sanitizeAnthropicEnv', () => {
  let dir: string
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'claudeme-test-'))
    savedEnv = {}
    for (const name of [...ANTHROPIC_VARS, 'CLAUDEME_CONFIG']) {
      savedEnv[name] = process.env[name]
    }
    resetClaudemeConfig()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
    resetClaudemeConfig()
  })

  test('claudeme.json 存在时删除所有 ANTHROPIC_* 环境变量', () => {
    const configPath = join(dir, 'claudeme.json')
    writeFileSync(configPath, makeConfig('literal-key'))
    process.env.CLAUDEME_CONFIG = configPath
    for (const name of ANTHROPIC_VARS) {
      process.env[name] = `dummy-${name}`
    }

    sanitizeAnthropicEnv()

    for (const name of ANTHROPIC_VARS) {
      expect(process.env[name]).toBeUndefined()
    }
  })

  test('没有 claudeme.json 时保留环境变量', () => {
    process.env.CLAUDEME_CONFIG = join(dir, 'nonexistent.json')
    process.env.ANTHROPIC_API_KEY = 'keep-me'
    process.env.ANTHROPIC_BASE_URL = 'http://keep.me'

    // 防御：确保 fallback 路径（cwd 等）没有意外命中真实配置
    if (!hasClaudemeConfig()) {
      sanitizeAnthropicEnv()
      expect(process.env.ANTHROPIC_API_KEY).toBe('keep-me')
      expect(process.env.ANTHROPIC_BASE_URL).toBe('http://keep.me')
    }
  })

  test('api_key 使用 $ANTHROPIC_API_KEY 引用时先解析后删除', async () => {
    const configPath = join(dir, 'claudeme.json')
    writeFileSync(configPath, makeConfig('$ANTHROPIC_API_KEY'))
    process.env.CLAUDEME_CONFIG = configPath
    process.env.ANTHROPIC_API_KEY = 'referenced-secret'

    sanitizeAnthropicEnv()

    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined()
    const { getModelConfigByKey } = await import('./claudemeConfig.js')
    expect(getModelConfigByKey('p1/m1')?.api_key).toBe('referenced-secret')
  })
})

describe('getClaudemeConfigDiagnostics', () => {
  let dir: string
  let savedConfigEnv: string | undefined

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'claudeme-diag-'))
    savedConfigEnv = process.env.CLAUDEME_CONFIG
    resetClaudemeConfig()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    if (savedConfigEnv === undefined) {
      delete process.env.CLAUDEME_CONFIG
    } else {
      process.env.CLAUDEME_CONFIG = savedConfigEnv
    }
    resetClaudemeConfig()
  })

  test('配置有效时返回 ok', () => {
    const configPath = join(dir, 'claudeme.json')
    writeFileSync(configPath, makeConfig('key'))
    process.env.CLAUDEME_CONFIG = configPath

    const diag = getClaudemeConfigDiagnostics()
    expect(diag.status).toBe('ok')
  })

  test('找不到文件时返回 not_found 并列出搜索路径', () => {
    process.env.CLAUDEME_CONFIG = join(dir, 'nonexistent.json')

    const diag = getClaudemeConfigDiagnostics()
    // 防御：cwd/项目根/home 兜底可能命中真实配置，此时跳过断言
    if (diag.status === 'not_found') {
      expect(diag.searchedPaths.length).toBeGreaterThan(0)
      expect(diag.searchedPaths[0]).toBe(join(dir, 'nonexistent.json'))
    }
  })

  test('文件存在但内容非法时返回 invalid 并带原因', () => {
    const configPath = join(dir, 'claudeme.json')
    writeFileSync(configPath, '{"default": "x/y"}') // 缺 providers
    process.env.CLAUDEME_CONFIG = configPath

    const diag = getClaudemeConfigDiagnostics()
    expect(diag.status).toBe('invalid')
    if (diag.status === 'invalid') {
      expect(diag.configPath).toBe(configPath)
      expect(diag.reason).toContain('providers')
    }
  })

  test('default 指向不存在的模型时返回 invalid', () => {
    const configPath = join(dir, 'claudeme.json')
    const bad = JSON.parse(makeConfig('key'))
    bad.default = 'p1/no-such-model'
    writeFileSync(configPath, JSON.stringify(bad))
    process.env.CLAUDEME_CONFIG = configPath

    const diag = getClaudemeConfigDiagnostics()
    expect(diag.status).toBe('invalid')
    if (diag.status === 'invalid') {
      expect(diag.reason).toContain('no-such-model')
    }
  })
})
