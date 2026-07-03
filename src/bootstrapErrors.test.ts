import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  findMissingDependencies,
  formatMissingDependencyError,
  isMissingDependencyError,
  tryAutoInstallDependencies,
} from './bootstrapErrors.js'

describe('isMissingDependencyError', () => {
  test('识别 bun 的 Cannot find package 错误', () => {
    const err = new Error(
      "Cannot find package 'turndown' from '/path/to/src/wiki/ingest.ts'",
    )
    expect(isMissingDependencyError(err)).toBe(true)
  })

  test('识别 Cannot find module 错误', () => {
    const err = new Error("Cannot find module 'some-dep'")
    expect(isMissingDependencyError(err)).toBe(true)
  })

  test('识别 bun ResolveMessage（非 Error 实例，仅带 message 属性）', () => {
    const resolveMessageLike = {
      message: "Cannot find package 'marked' from '/x/src/wiki/llm.ts'",
      name: 'ResolveMessage',
    }
    expect(isMissingDependencyError(resolveMessageLike)).toBe(true)
  })

  test('普通错误返回 false', () => {
    expect(isMissingDependencyError(new Error('boom'))).toBe(false)
    expect(isMissingDependencyError('string error')).toBe(false)
    expect(isMissingDependencyError(null)).toBe(false)
  })
})

describe('formatMissingDependencyError', () => {
  test('包含中文指引和 bun install 命令', () => {
    const err = new Error("Cannot find package 'turndown' from '/x/y.ts'")
    const msg = formatMissingDependencyError(err, '/path/to/claudeme')
    expect(msg).toContain('依赖缺失')
    expect(msg).toContain('bun install')
    expect(msg).toContain('/path/to/claudeme')
    expect(msg).toContain('turndown')
  })
})

describe('findMissingDependencies', () => {
  let dir: string

  beforeEach(async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    dir = mkdtempSync(join(tmpdir(), 'claudeme-deps-'))
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        version: '0.0.0',
        dependencies: { 'dep-installed': '*', 'dep-missing': '^1.0.0' },
      }),
    )
    // 只安装其中一个依赖
    mkdirSync(join(dir, 'node_modules', 'dep-installed'), { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', 'dep-installed', 'package.json'),
      '{"name":"dep-installed"}',
    )
  })

  afterEach(async () => {
    const { rmSync } = await import('fs')
    rmSync(dir, { recursive: true, force: true })
  })

  test('检出缺失的依赖，忽略已安装的', () => {
    const missing = findMissingDependencies(dir)
    expect(missing).toEqual(['dep-missing'])
  })

  test('全部安装时返回空数组', async () => {
    const { mkdirSync, writeFileSync } = await import('fs')
    const { join } = await import('path')
    mkdirSync(join(dir, 'node_modules', 'dep-missing'), { recursive: true })
    writeFileSync(
      join(dir, 'node_modules', 'dep-missing', 'package.json'),
      '{"name":"dep-missing"}',
    )
    expect(findMissingDependencies(dir)).toEqual([])
  })

  test('package.json 不存在时返回空数组（不阻断启动）', async () => {
    const { mkdtempSync, rmSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const empty = mkdtempSync(join(tmpdir(), 'claudeme-nopkg-'))
    expect(findMissingDependencies(empty)).toEqual([])
    rmSync(empty, { recursive: true, force: true })
  })

  test('file: 协议的本地依赖不误报为缺失', async () => {
    const { writeFileSync } = await import('fs')
    const { join } = await import('path')
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        dependencies: { 'local-shim': 'file:./shims/local-shim' },
      }),
    )
    // file: 依赖缺失时同样会被报出——bun install 能修复它（创建符号
    // 链接）。若 install 后仍无法解析，CLAUDEME_BOOTSTRAP_RETRY 防线
    // 保证同一进程只重试一次，不会死循环
    const missing = findMissingDependencies(dir)
    expect(missing).toEqual(['local-shim'])
  })
})

describe('tryAutoInstallDependencies', () => {
  let dir: string

  beforeEach(async () => {
    const { mkdtempSync, writeFileSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    dir = mkdtempSync(join(tmpdir(), 'claudeme-install-'))
    // 最小可安装的 package.json（无依赖，bun install 秒完成）
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'claudeme-test-fixture', version: '0.0.0' }),
    )
  })

  afterEach(async () => {
    const { rmSync } = await import('fs')
    rmSync(dir, { recursive: true, force: true })
  })

  test('在有效项目目录成功执行 bun install，返回 true', () => {
    const result = tryAutoInstallDependencies(dir)
    expect(result.success).toBe(true)
  })

  test('目录不含 package.json 时返回 false 且不抛异常', async () => {
    const { mkdtempSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const empty = mkdtempSync(join(tmpdir(), 'claudeme-empty-'))
    const result = tryAutoInstallDependencies(empty)
    expect(result.success).toBe(false)
    const { rmSync } = await import('fs')
    rmSync(empty, { recursive: true, force: true })
  })
})
