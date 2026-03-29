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
  let result = await http.post('/navigate', { url: LOCAL_URL })
  console.log('   导航结果:', result)
  await http.post('/wait', { ms: 3000 })

  console.log('2. 获取当前页面信息...')
  let pageInfo = await http.get('/currentPage')
  console.log('   当前页面:', pageInfo)

  console.log('3. 尝试查找登录页元素...')
  await http.post('/wait', { ms: 1000 })

  console.log('4. 填写登录表单...')
  try {
    await http.post('/fillInput', { selector: 'input[placeholder="请输入账号"]', value: 'admin' })
    console.log('   账号填写成功')
  } catch (e) {
    console.log('   账号填写失败:', e.message)
  }

  try {
    await http.post('/fillInput', { selector: 'input[placeholder="请输入密码"]', value: '123456' })
    console.log('   密码填写成功')
  } catch (e) {
    console.log('   密码填写失败:', e.message)
  }

  console.log('5. 点击登录按钮...')
  try {
    await http.post('/clickText', { text: '登录' })
    console.log('   登录按钮点击成功')
  } catch (e) {
    console.log('   登录按钮点击失败:', e.message)
  }

  await http.post('/wait', { ms: 5000 })

  pageInfo = await http.get('/currentPage')
  console.log('   登录后当前页面:', pageInfo)

  console.log('6. 进入修改密码页面...')
  try {
    await http.post('/clickText', { text: '修改密码' })
    console.log('   修改密码点击成功')
  } catch (e) {
    console.log('   修改密码点击失败:', e.message)
  }

  await http.post('/wait', { ms: 2000 })

  pageInfo = await http.get('/currentPage')
  console.log('   修改密码页面:', pageInfo)

  console.log('7. 填写修改密码表单...')
  try {
    await http.post('/fillInput', { selector: 'input[placeholder="请输入当前密码"]', value: 'wrong_password' })
    await http.post('/fillInput', { selector: 'input[placeholder="请输入新密码"]', value: 'new_password_123' })
    await http.post('/fillInput', { selector: 'input[placeholder="请再次输入新密码"]', value: 'new_password_123' })
    console.log('   表单填写成功')
  } catch (e) {
    console.log('   表单填写失败:', e.message)
  }

  console.log('8. 点击确认修改...')
  try {
    await http.post('/clickText', { text: '确认修改' })
    console.log('   确认修改点击成功')
  } catch (e) {
    console.log('   确认修改点击失败:', e.message)
  }

  await http.post('/wait', { ms: 3000 })

  const logs = await http.get('/consoleLogs')
  console.log('   控制台日志:', logs.logs || [])

  console.log('\n=== 测试完成 ===')
  await http.post('/close')
}

testChangePassword().catch(console.error)
