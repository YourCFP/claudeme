/**
 * ClaudeMe 启动期配置检查
 *
 * 没有有效 claudeme.json 时快速失败并给出明确的中文指引，
 * 避免静默 fallback 到 Anthropic 原生路径（onboarding preflight
 * 连接 api.anthropic.com 等），产生令人困惑的报错。
 */

import type { ClaudemeConfigDiagnostics } from './claudemeConfig.js'

/**
 * 根据诊断结果生成用户可读的错误信息。
 * 配置有效时返回 null（不阻断启动）。
 */
export function formatClaudemeConfigError(
  diag: ClaudemeConfigDiagnostics,
): string | null {
  if (diag.status === 'ok') return null

  const lines: string[] = []

  if (diag.status === 'not_found') {
    lines.push('✗ 未找到 claudeme.json 配置文件，ClaudeMe 无法启动。')
    lines.push('')
    lines.push('请在项目根目录执行：')
    lines.push('  cp claudeme.example.json claudeme.json')
    lines.push('然后编辑 claudeme.json 填入你的 API Key。')
    lines.push('')
    lines.push('已尝试以下路径：')
    for (const p of diag.searchedPaths) {
      lines.push(`  - ${p}`)
    }
    lines.push('')
    lines.push('提示：也可通过 CLAUDEME_CONFIG 环境变量指定配置文件的绝对路径，')
    lines.push('或将配置放到 ~/.config/claudeme/claudeme.json 以便任意目录启动。')
  } else {
    lines.push(`✗ claudeme.json 配置无效：${diag.reason}`)
    lines.push('')
    lines.push(`  配置文件：${diag.configPath}`)
    lines.push('')
    lines.push('请对照 claudeme.example.json 检查格式（新版为 providers 分组结构）。')
  }

  return lines.join('\n')
}
