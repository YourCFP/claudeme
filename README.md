# ClaudeMe

> 基于 Claude Code，极简、不闹心的终端 AI 编程助手。解绑官方 SDK，支持任意 OpenAI Compatible API，零确认开干。

![Preview](preview.png)

**Claude + Me = ClaudeMe**——不只是编程工具，是终端里的另一个你。

编码只是起点。ClaudeMe 的终极目标是成为你的**赛博分身**：它记住你的习惯、理解你的意图、用你的风格写代码、替你做决策。你给它足够的权限和记忆，它就能像你一样思考和行动——一个 24 小时在线的、住在终端里的数字镜像。

现阶段，它先把编程这件事做到极致：不限模型、不要代理、不烦你确认。

## 为什么做 ClaudeMe

Claude Code 很强，但：

- 🔒 **绑死官方 API** —— 必须用 Anthropic 账号，国内直连不了
- 🌐 **需要代理** —— 网络不稳定时体验极差
- 🇺🇸 **全英文交互** —— 对中文用户不够友好
- 🐢 **反复确认** —— 每个工具调用都弹权限确认，打断心流

**ClaudeMe 的目标：拥有 Claude Code 全部编程能力，同时做到——**

- ✅ **不限制** —— 解绑 Anthropic SDK，接任意 OpenAI Compatible API
- ✅ **不代理** —— 直连国内大模型平台，零延迟
- ✅ **随时随地都能用** —— 不依赖科学上网，开箱即用
- ✅ **中文交互** —— 界面、提示、Tips 全中文化
- ✅ **零确认** —— 默认跳过所有权限确认，启动即全自动
- ✅ **易用、好用、能用** —— 一个配置文件搞定多厂商多模型

## 核心特性

| 特性 | 说明 |
|------|------|
| 🔌 OpenAI Compatible | 支持任何兼容 OpenAI 格式的 API（阿里云、火山引擎、Moonshot、DeepSeek…） |
| 🔄 多厂商多模型 | 按厂商分组配置，每个厂商只需一次 API Key；`/model` 命令按厂商分组展示 |
| ⏵⏵ 零确认模式 | 默认 Bypass Permissions，无需 `--dangerously-skip-permissions`，告别反复弹窗 |
| 🛠️ 完整工具链 | 文件读写、Bash 执行、代码搜索、Web 搜索、MCP 服务器… |
| 🧠 Agent 能力 | 多 Agent 并行、子任务编排、Plan 模式、自动化工作流 |
| 📦 Skills 生态 | 内置丰富 Skills，支持自定义扩展 |
| 🎨 中文 UI | Spinner、Tips、提示信息全面中文化 |
| ⚡ 极速体验 | Bun 运行时，启动快、响应快 |

## 快速开始

### 环境要求

- [Bun](https://bun.sh) 1.3.5+
- Node.js 24+

### 安装

```bash
git clone git@github.com:zrt-ai-lab/claudeme.git
cd claudeme
bun install
```

### 配置

```bash
# 复制示例配置
cp claudeme.example.json claudeme.json

# 编辑 claudeme.json，填入你的 API Key
# 支持直接写 key 或用 $ENV_VAR 引用环境变量
```

配置按厂商分组，每个厂商只需写一次 `api_base` 和 `api_key`：

```json
{
  "default": "my-provider/opus",
  "providers": {
    "my-provider": {
      "name": "我的API平台",
      "api_base": "https://your-api-provider.com/v1",
      "api_key": "$CLAUDEME_API_KEY",
      "models": {
        "opus": {
          "name": "Claude 4.6 Opus",
          "model": "claude-opus",
          "max_tokens": 32000,
          "capabilities": { "vision": true, "tool_calling": true }
        },
        "sonnet": {
          "name": "Claude 4.6 Sonnet",
          "model": "claude-sonnet",
          "max_tokens": 32000,
          "capabilities": { "vision": true, "tool_calling": true }
        }
      }
    },
    "deepseek": {
      "name": "DeepSeek",
      "api_base": "https://api.deepseek.com/v1",
      "api_key": "$DEEPSEEK_API_KEY",
      "models": {
        "v3": {
          "name": "DeepSeek V3",
          "model": "deepseek-chat",
          "max_tokens": 32000,
          "capabilities": { "vision": false, "tool_calling": true }
        }
      }
    }
  }
}
```

模型使用 `厂商/模型` 的复合 key 引用，如 `my-provider/opus`、`deepseek/v3`。

### 运行

```bash
bun run dev
```

启动后即处于 **Bypass Permissions** 模式，所有工具调用自动放行，不会弹确认。

### 切换模型

在 ClaudeMe 内输入 `/model`，模型按厂商分组展示：

```
── 我的API平台 ─────────────────────────
Claude 4.6 Opus       claude-opus · 视觉+工具
Claude 4.6 Sonnet     claude-sonnet · 视觉+工具
── DeepSeek ────────────────────────────
DeepSeek V3           deepseek-chat · 工具
```

## 与 Claude Code 共存

ClaudeMe 和原版 Claude Code 共享 `~/.claude/` 配置目录（包括 `settings.json`、CLAUDE.md 等），可以在同一台机器上同时安装，互不干扰。

区别在于：
- **原版 Claude Code** 需要手动传 `--dangerously-skip-permissions` 才能跳过确认
- **ClaudeMe** 默认就是 Bypass Permissions，无需任何 flag

## 项目状态

🚀 **v1.0.1** —— 持续迭代中

**当前阶段**：极致的 AI 编程终端——多厂商多模型、零确认、中文原生。

**下一步**：个性化记忆、偏好学习、自主工作流——让 ClaudeMe 越来越像你。

目标是让每个开发者都拥有一个住在终端里的数字分身，不受网络限制、不受平台绑定、不受打断。

## License

MIT
