import { describe, expect, test } from 'bun:test'
import { formatClaudemeConfigError } from './claudemeStartupCheck.js'

describe('formatClaudemeConfigError', () => {
  test('ok 状态返回 null，不阻断启动', () => {
    expect(
      formatClaudemeConfigError({ status: 'ok', configPath: '/x/claudeme.json' }),
    ).toBeNull()
  })

  test('not_found 时包含指引和搜索路径', () => {
    const msg = formatClaudemeConfigError({
      status: 'not_found',
      searchedPaths: ['/a/claudeme.json', '/b/claudeme.json'],
    })
    expect(msg).toContain('未找到 claudeme.json')
    expect(msg).toContain('cp claudeme.example.json claudeme.json')
    expect(msg).toContain('/a/claudeme.json')
    expect(msg).toContain('/b/claudeme.json')
    expect(msg).toContain('CLAUDEME_CONFIG')
  })

  test('invalid 时包含文件路径和具体原因', () => {
    const msg = formatClaudemeConfigError({
      status: 'invalid',
      configPath: '/x/claudeme.json',
      reason: 'missing "default" or "providers" field',
    })
    expect(msg).toContain('配置无效')
    expect(msg).toContain('/x/claudeme.json')
    expect(msg).toContain('providers')
  })
})
