import { execFileSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  findMissingDependencies,
  formatMissingDependencyError,
  isMissingDependencyError,
  tryAutoInstallDependencies,
} from './bootstrapErrors'
import { ensureBootstrapMacro } from './bootstrapMacro'

ensureBootstrapMacro()

// ClaudeMe 升级自愈：目标是"升级只需 git pull"。
// bun link 用户 pull 后新版本可能引入新依赖。bun 对静态 import 的
// 解析错误发生在 transpile 阶段、无法被 try/catch 稳定捕获，所以在
// 加载主模块图【之前】主动比对 package.json vs node_modules，缺了就
// 自动 bun install 并重启进程，全程无需用户干预。
// 防死循环：CLAUDEME_BOOTSTRAP_RETRY 标记保证只重试一次。

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const alreadyRetried = process.env.CLAUDEME_BOOTSTRAP_RETRY === '1'

/** 自动安装成功后以相同参数重启进程，透传子进程退出码 */
function restartAfterInstall(): never {
  process.stderr.write('✓ 依赖安装完成，正在启动 claudeme…\n\n')
  try {
    execFileSync(process.execPath, [...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, CLAUDEME_BOOTSTRAP_RETRY: '1' },
    })
    process.exit(0)
  } catch (execErr) {
    const status = (execErr as { status?: number }).status
    process.exit(typeof status === 'number' ? status : 1)
  }
}

// ─── 第一道防线：加载模块图之前主动检测 ───
if (!alreadyRetried) {
  const missing = findMissingDependencies(projectRoot)
  if (missing.length > 0) {
    process.stderr.write(
      `检测到 ${missing.length} 个依赖缺失（${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' …' : ''}），可能是 git pull 后未同步依赖。\n`,
    )
    if (tryAutoInstallDependencies(projectRoot).success) {
      restartAfterInstall()
    }
    process.stderr.write(
      `✗ 自动安装失败。请手动执行：\n  cd ${projectRoot}\n  bun install\n然后重新启动 claudeme。\n`,
    )
    process.exit(1)
  }
}

// ─── 第二道防线：动态 import 阶段的缺包兜底 ───
try {
  await import('./entrypoints/cli.tsx')
} catch (err) {
  if (!isMissingDependencyError(err)) throw err
  if (!alreadyRetried && tryAutoInstallDependencies(projectRoot).success) {
    restartAfterInstall()
  }
  process.stderr.write(`${formatMissingDependencyError(err, projectRoot)}\n`)
  process.exit(1)
}
