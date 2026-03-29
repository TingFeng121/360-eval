import axios from 'axios'

const BASE = 'http://localhost:9999/mcp'

const http = {
  get: (path, params) => axios.get(`${BASE}${path}`, { params }).then(r => r.data).catch(e => e.response?.data || { error: e.message }),
  post: (path, data) => axios.post(`${BASE}${path}`, data).then(r => r.data).catch(e => e.response?.data || { error: e.message })
}

async function testChangePassword() {
  console.log('=== 密码修改功能自动化测试 ===\n')

  const LOCAL_URL = 'http://localhost:5173'

  console.log('1. 启动浏览器并访问登录页...')
  await http.post('/navigate', { url: LOCAL_URL })
  await http.post('/wait', { ms: 2000 })

  console.log('2. 查找登录表单...')
  const accountInput = await http.post('/clickText', { text: '请输入账号' })
  console.log('   点击账号输入框:', accountInput)

  await http.post('/fillInput', { selector: 'input[placeholder="请输入账号"]', value: 'admin' })

  const passwordInput = await http.post('/clickText', { text: '请输入密码' })
  console.log('   点击密码输入框:', passwordInput)

  await http.post('/fillInput', { selector: 'input[placeholder="请输入密码"]', value: '123456' })

  console.log('3. 点击登录按钮...')
  const loginBtn = await http.post('/clickText', { text: '登录' })
  console.log('   登录结果:', loginBtn)
  await http.post('/wait', { ms: 3000 })

  const pageInfo = await http.get('/currentPage')
  console.log('   当前页面:', pageInfo.url)

  console.log('4. 进入修改密码页面...')
  await http.post('/clickText', { text: '修改密码' })
  await http.post('/wait', { ms: 2000 })

  const passwordPage = await http.get('/currentPage')
  console.log('   当前页面:', passwordPage.url)

  console.log('5. 填写修改密码表单（原密码错误场景）...')
  await http.post('/fillInput', { selector: 'input[placeholder="请输入当前密码"]', value: 'wrong_password' })
  await http.post('/fillInput', { selector: 'input[placeholder="请输入新密码"]', value: 'new_password_123' })
  await http.post('/fillInput', { selector: 'input[placeholder="请再次输入新密码"]', value: 'new_password_123' })

  console.log('6. 点击确认修改...')
  await http.post('/clickText', { text: '确认修改' })
  await http.post('/wait', { ms: 3000 })

  const logs = await http.get('/consoleLogs')
  console.log('   控制台日志:', logs.logs || [])

  console.log('\n=== 测试完成 ===')
  await http.post('/close')
}

testChangePassword().catch(console.error)
