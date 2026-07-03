/**
 * ClaudeMe 启动期依赖错误识别与自愈
 *
 * bun link 全局安装的用户 `git pull` 后若新版本引入了新依赖，
 * 模块图加载会抛 "Cannot find package 'xxx'"。ClaudeMe 的目标是
 * "升级只需 git pull"——所以这里不只是提示，而是自动执行
 * `bun install` 并让调用方重启进程，全程无需用户干预。
 */

import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const MISSING_DEP_PATTERNS = [
  /cannot find package '([^']+)'/i,
  /cannot find module '([^']+)'/i,
] as const

/**
 * 主动检测 package.json 声明的 dependencies 是否都已安装。
 *
 * 为什么不依赖捕获 import 错误：bun 对静态 import 的解析发生在
 * transpile 阶段，抛出的 ResolveMessage 无法被上层 try/catch 稳定
 * 捕获（进程直接报错退出）。所以必须在加载主模块图之前主动检查。
 *
 * 任何读取/解析失败都返回空数组——检测只能锦上添花，绝不阻断启动。
 */
export function findMissingDependencies(projectRoot: string): string[] {
  try {
    const pkgPath = join(projectRoot, 'package.json')
    if (!existsSync(pkgPath)) return []
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const deps = Object.keys(pkg.dependencies ?? {})
    return deps.filter(
      name => !existsSync(join(projectRoot, 'node_modules', name)),
    )
  } catch {
    return []
  }
}

function extractPackageName(message: string): string | null {
  for (const pattern of MISSING_DEP_PATTERNS) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

/** 从错误对象提取 message（兼容 bun 的 ResolveMessage —— 它不是 Error 实例） */
function getErrorMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return null
}

/** 判断是否为"依赖包缺失"类错误（bun ResolveMessage / node MODULE_NOT_FOUND） */
export function isMissingDependencyError(err: unknown): boolean {
  const message = getErrorMessage(err)
  if (message === null) return false
  return extractPackageName(message) !== null
}

/** 生成用户可读的中文修复指引（自动安装失败时的兜底） */
export function formatMissingDependencyError(
  err: unknown,
  projectRoot: string,
): string {
  const message = getErrorMessage(err) ?? String(err)
  const pkgName = extractPackageName(message) ?? '未知依赖'
  return [
    `✗ 依赖缺失：找不到包 "${pkgName}"，且自动安装未成功。`,
    '',
    '请手动执行：',
    `  cd ${projectRoot}`,
    '  bun install',
    '',
    '然后重新启动 claudeme。',
  ].join('\n')
}

export interface AutoInstallResult {
  readonly success: boolean
  readonly error?: string
}

/**
 * 在项目根目录同步执行 `bun install`。
 *
 * 用于依赖缺失时的自愈：成功后调用方应重启进程以重新加载模块图。
 * 失败（无 package.json、bun 缺失、网络错误等）返回 success:false，
 * 由调用方降级为手动指引，绝不抛异常打断启动。
 */
export function tryAutoInstallDependencies(
  projectRoot: string,
): AutoInstallResult {
  if (!existsSync(join(projectRoot, 'package.json'))) {
    return { success: false, error: 'package.json 不存在' }
  }
  try {
    process.stderr.write(
      '⏳ 检测到依赖缺失，正在自动执行 bun install（首次升级后需要一点时间）…\n',
    )
    execFileSync('bun', ['install'], {
      cwd: projectRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
