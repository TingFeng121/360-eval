import express from 'express'
import { chromium } from 'playwright'

const app = express()
app.use(express.json())

let browser = null
let page = null

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome'
    })
  }
  return browser
}

async function getPage() {
  const browser = await initBrowser()
  if (!page || page.isClosed()) {
    page = await browser.newPage()
  }
  return page
}

app.post('/mcp/avigate', async (req, res) => {
  try {
    const { url } = req.body
    const p = await getPage()
    await p.goto(url, { waitUntil: 'networkidle' })
    res.json({ success: true, url: p.url() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/mcp/clickText', async (req, res) => {
  try {
    const { text } = req.body
    const p = await getPage()

    const elements = await p.getByText(text, { exact: false }).all()
    if (elements.length === 0) {
      return res.status(404).json({ error: `文本 "${text}" 未找到` })
    }

    await elements[0].click()
    await p.waitForTimeout(500)

    res.json({ success: true, clicked: text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/mcp/clickSelector', async (req, res) => {
  try {
    const { selector } = req.body
    const p = await getPage()
    await p.click(selector)
    await p.waitForTimeout(500)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/mcp/fillInput', async (req, res) => {
  try {
    const { selector, value } = req.body
    const p = await getPage()
    await p.fill(selector, value)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/mcp/findText', async (req, res) => {
  try {
    const { text } = req.query
    const p = await getPage()
    const content = await p.content()
    const found = content.includes(text)
    res.json({ found, text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/mcp/currentPage', async (req, res) => {
  try {
    const p = await getPage()
    res.json({
      url: p.url(),
      title: await p.title()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/mcp/consoleLogs', async (req, res) => {
  try {
    const p = await getPage()
    const logs = await p.evaluate(() => {
      return window.__consoleLogs || []
    })
    res.json({ logs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/mcp/wait', async (req, res) => {
  try {
    const { ms } = req.body
    await new Promise(r => setTimeout(r, ms))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/mcp/screenshot', async (req, res) => {
  try {
    const p = await getPage()
    const buffer = await p.screenshot()
    res.set('Content-Type', 'image/png')
    res.send(buffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/mcp/close', async (req, res) => {
  try {
    if (page) {
      await page.close()
      page = null
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = 9999
app.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}`)
  console.log('Available endpoints:')
  console.log('  POST /mcp/navigate     - 导航到URL')
  console.log('  POST /mcp/clickText    - 点击包含指定文本的元素')
  console.log('  POST /mcp/clickSelector - 点击CSS选择器元素')
  console.log('  POST /mcp/fillInput    - 填写输入框')
  console.log('  GET  /mcp/findText     - 查找页面文本')
  console.log('  GET  /mcp/currentPage  - 获取当前页面信息')
  console.log('  GET  /mcp/consoleLogs  - 获取控制台日志')
  console.log('  POST /mcp/wait         - 等待毫秒')
  console.log('  GET  /mcp/screenshot   - 截图')
  console.log('  POST /mcp/close        - 关闭页面')
})
