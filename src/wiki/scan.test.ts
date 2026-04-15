import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const tempRootPrefix = join(tmpdir(), 'wiki-scan-test-')

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now()
  while (!check()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition')
    }
    await Bun.sleep(20)
  }
}

describe('scanBackground', () => {
  let sourceDir: string
  let wikiDir: string
  let previousConfigPath: string | undefined
  let previousWikiDir: string | undefined

  beforeEach(async () => {
    mock.module('./llm.js', () => ({
      llmStructuredCall: async (_system: string, userMessage: string) => {
        await Bun.sleep(50)
        const titleMatch = userMessage.match(/素材标题:\s*(.+)/)
        const title = titleMatch?.[1]?.trim() || 'Untitled'
        return {
          source_summary: {
            title,
            summary: `Summary for ${title}`,
            tags: ['test'],
          },
          entities: [],
          topics: [],
        }
      },
      llmTextCall: async () => '',
    }))

    const tempRoot = mkdtempSync(tempRootPrefix)
    sourceDir = join(tempRoot, 'source')
    wikiDir = join(tempRoot, 'wiki')
    mkdirSync(sourceDir, { recursive: true })

    previousConfigPath = process.env.CLAUDEME_CONFIG
    previousWikiDir = process.env.WIKI_DIR

    process.env.CLAUDEME_CONFIG = join(tempRoot, 'claudeme.json')
    process.env.WIKI_DIR = wikiDir

    writeFileSync(
      process.env.CLAUDEME_CONFIG,
      JSON.stringify({ wiki: { sources: [sourceDir] } }, null, 2),
      'utf-8',
    )

    for (let index = 0; index < 105; index += 1) {
      writeFileSync(
        join(sourceDir, `doc-${index}.md`),
        `# Document ${index}\n\n${'content '.repeat(20)}${index}`,
        'utf-8',
      )
    }

    const scanModule = await import('./scan.js')
    scanModule.stopScan()
    scanModule.clearScanProgress()
  })

  afterEach(async () => {
    const scanModule = await import('./scan.js')
    scanModule.stopScan()
    scanModule.clearScanProgress()

    if (previousConfigPath === undefined) {
      delete process.env.CLAUDEME_CONFIG
    } else {
      process.env.CLAUDEME_CONFIG = previousConfigPath
    }

    if (previousWikiDir === undefined) {
      delete process.env.WIKI_DIR
    } else {
      process.env.WIKI_DIR = previousWikiDir
    }

    const currentWikiDir = wikiDir
    if (currentWikiDir && existsSync(currentWikiDir)) {
      rmSync(join(currentWikiDir, '..'), { recursive: true, force: true })
    }
  })

  test('reports the full scan total during a multi-batch background run', async () => {
    const scanModule = await import('./scan.js')

    scanModule.scanBackground({ concurrency: 1, batchSize: 100 })

    await waitFor(() => {
      const progress = scanModule.readScanProgress()
      return progress?.current === 1
    })

    const progress = scanModule.readScanProgress()
    expect(progress?.status).toBe('running')
    expect(progress?.total).toBe(105)

    scanModule.stopScan()
    await waitFor(() => scanModule.readScanProgress()?.status === 'done', 10000)

    const completedProgress = scanModule.readScanProgress()
    expect(completedProgress?.summary).toContain('剩余')
    expect(completedProgress?.summary).toContain('本批处理 1')

    const rawArticlesDir = join(wikiDir, 'raw', 'articles')
    expect(existsSync(rawArticlesDir)).toBe(true)

    const articleFiles = existsSync(rawArticlesDir)
      ? (await readdir(rawArticlesDir)).filter(name => name.endsWith('.md'))
      : []

    expect(articleFiles.length).toBeLessThan(105)
  })

  test('stop halts an in-progress background scan', async () => {
    const scanModule = await import('./scan.js')

    scanModule.scanBackground({ concurrency: 1, batchSize: 100 })

    await waitFor(() => scanModule.readScanProgress()?.current === 1)

    const stopped = scanModule.stopScan()
    expect(stopped).toBe(true)

    await waitFor(() => scanModule.readScanProgress()?.status === 'done', 10000)

    const progressAfterStop = scanModule.readScanProgress()
    expect(progressAfterStop?.summary).toContain('已取消')

    await Bun.sleep(250)

    const settledProgress = scanModule.readScanProgress()
    expect(settledProgress?.current).toBe(progressAfterStop?.current)
    expect(settledProgress?.summary).toContain('已取消')

    const rawArticlesDir = join(wikiDir, 'raw', 'articles')
    const articleFiles = existsSync(rawArticlesDir)
      ? (await readdir(rawArticlesDir)).filter(name => name.endsWith('.md'))
      : []

    expect(articleFiles.length).toBeLessThan(105)
  })
})
