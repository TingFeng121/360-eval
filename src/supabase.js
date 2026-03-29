import { createClient } from '@supabase/supabase-js'
import { apiCache } from './cache'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
})

// 全局缓存的用户列表
let cachedUsers = null
let cachedUsersTime = 0
let cachedQuestions = null
let cachedQuestionsTime = 0
let cachedDimensions = null
let cachedDimensionsTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟

// =====================================================
// API 封装 (替代原来的 api.js)
// =====================================================

// 密码处理
function hashPassword(password) {
  return btoa(unescape(encodeURIComponent(password + '_360eval')))
}

// Supabase Auth 会自动存储 session 到 localStorage
// 我们只需要从 Supabase 获取当前 session
async function getLocalUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  
  // 获取用户 profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
    
  if (!profile) {
    await supabase.auth.signOut()
    return null
  }
  
  const user = {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    name: profile.name,
    department: profile.department,
    permissions: parsePermissions(profile.permissions)
  }

  return {
    user: user,
    token: session.access_token
  }
}

function parsePermissions(perm) {
  if (!perm) return { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  if (typeof perm === 'object') return perm
  try {
    return JSON.parse(perm)
  } catch {
    return { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  }
}

function clearLocalUser() {
  supabase.auth.signOut()
}

// 获取当前用户（带缓存）
export async function getCurrentUser() {
  // 检查缓存
  const cached = apiCache.getUser()
  if (cached) return cached
  
  // 直接从 Supabase 获取 session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
    
  const user = profile ? {
    id: profile.id,
    username: profile.username,
    role: profile.role,
    name: profile.name,
    department: profile.department,
    permissions: profile.permissions
  } : null
  
  // 缓存用户信息
  if (user) apiCache.setUser(user)
  
  return user
}

// 获取 token
export async function getToken() {
  const session = await getLocalUser()
  return session?.token || null
}

// 认证检查
async function requireAuth() {
  const session = await getLocalUser()
  if (!session) {
    throw new Error('请先登录')
  }
  return session
}

// =====================================================
// API 接口
// =====================================================

export const api = {
  // 登录 (使用 Supabase Auth)
  async login(username, password) {
    // 先通过 username 查询 profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      throw new Error('用户名不存在')
    }

    // 尝试使用 email 登录 (Supabase Auth 使用邮箱)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email || `${username}@test.com`,
      password: password
    })

    if (authError) {
      throw new Error('密码错误')
    }

    const user = {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      name: profile.name,
      department: profile.department,
      permissions: profile.permissions
    }
    
    return { token: authData.session.access_token, user }
  },

  // 登出
  async logout() {
    await supabase.auth.signOut()
    clearLocalUser()
    // 清除所有缓存
    apiCache.clear()
    cachedUsers = null
    cachedUsersTime = 0
  },

  // 注册 (仅管理员可用)
  async register(username, password, userData) {
    const session = await await requireAuth()
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    // 创建 Auth 用户（使用 signUp）
    const { data, error } = await supabase.auth.signUp({
      email: `${username}@test.com`,
      password: password,
      options: {
        data: {
          username: username,
          name: userData.name,
          role: userData.role,
          department: userData.department
        }
      }
    })

    if (error) throw error

    return { id: data.user.id }
  },

  // 获取用户列表（带缓存）
  async getUsers(useCache = true) {
    await requireAuth()
    
    // 检查缓存
    if (useCache && cachedUsers && Date.now() - cachedUsersTime < CACHE_DURATION) {
      return cachedUsers
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('role', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw error
    
    // 更新缓存
    cachedUsers = data
    cachedUsersTime = Date.now()
    
    return data
  },
  
  // 清除用户缓存
  clearUsersCache() {
    cachedUsers = null
    cachedUsersTime = 0
  },

  // 创建用户
  async createUser(userData) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    // 检查用户名是否存在
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', userData.username)
      .single()

    if (existing) {
      throw new Error('用户名已存在')
    }

    // 创建 Auth 用户（使用 signUp，需要用户确认邮件）
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: `${userData.username}@test.com`,
      password: userData.password,
      options: {
        data: {
          username: userData.username,
          name: userData.name,
          role: userData.role,
          department: userData.department
        }
      }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error('用户创建失败')

    // 创建 profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: userData.username,
        name: userData.name,
        role: userData.role,
        department: userData.department,
        permissions: userData.permissions || { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
      })

    if (profileError) throw profileError

    return { id: authData.user.id }
  },

  // 更新用户
  async updateUser(id, userData) {
    await requireAuth()
    const session = await getLocalUser()
    
    // 权限检查
    if (session.user.role !== 'admin' && id !== session.user.id) {
      throw new Error('权限不足')
    }

    const updateData = {
      username: userData.username,
      name: userData.name,
      department: userData.department,
      permissions: userData.permissions
    }

    if (session.user.role === 'admin') {
      updateData.role = userData.role
    }

    // 密码更新需要通过 Supabase 控制台或邮箱重置
    // 前端 anon key 无法修改密码

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    // 如果是更新自己，刷新本地存储
    if (id === session.user.id) {
      // 用户更新自己的信息后，Supabase session 会自动保持
    }

    return { message: '用户更新成功' }
  },

  // 删除用户
  async deleteUser(id) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    if (id === session.user.id) {
      throw new Error('不能删除自己的账号')
    }

    // 删除 profile（Auth 用户保留，因为前端无法删除）
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)
    
    if (profileError) throw profileError

    return { message: '用户删除成功' }
  },

  // 获取所有维度
  async getDimensions() {
    const { data, error } = await supabase
      .from('dimensions')
      .select('*')
      .order('sort_order')
    if (error) throw error
    return data
  },

  // 创建维度
  async createDimension(dimension) {
    await requireAuth()
    const session = await getLocalUser()
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }
    const { data, error } = await supabase
      .from('dimensions')
      .insert([dimension])
      .select()
      .single()
    if (error) throw error
    return data
  },

  // 更新维度
  async updateDimension(id, updates) {
    await requireAuth()
    const session = await getLocalUser()
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }
    const { error } = await supabase
      .from('dimensions')
      .update(updates)
      .eq('id', id)
    if (error) throw error
    return { message: '维度更新成功' }
  },

  // 删除维度
  async deleteDimension(id) {
    await requireAuth()
    const session = await getLocalUser()
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }
    const { error } = await supabase
      .from('dimensions')
      .delete()
      .eq('id', id)
    if (error) throw error
    return { message: '维度删除成功' }
  },

  // 批量保存维度（用于排序和启用状态更新）
  async saveDimensions(dimensions) {
    await requireAuth()
    const session = await getLocalUser()
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }
    const { error } = await supabase
      .from('dimensions')
      .upsert(dimensions, { onConflict: 'id' })
    if (error) throw error
    return { message: '维度保存成功' }
  },

  // 删除题目（仅管理员）
  async deleteQuestion(id) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { message: '题目删除成功' }
  },

  // 清空所有题目（仅管理员）
  async clearAllQuestions() {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    try {
      // 先删除所有答案（因为答案表有外键依赖题目表）
      await supabase.from('answers').delete().neq('id', 0)
      
      // 再删除所有题目
      const { error } = await supabase
        .from('questions')
        .delete()
        .neq('id', 0)
  
      if (error) throw error
      
      // 清除缓存
      this.clearUsersCache()
      apiCache.clear('getQuestions')
  
      return { message: '所有题目已清空' }
    } catch (error) {
      throw new Error('清空失败: ' + error.message)
    }
  },

  // 清空所有任务（仅管理员）
  async clearAllTasks() {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('evaluation_tasks')
      .delete()
      .neq('id', 0) // 删除所有

    if (error) throw error
    
    // 清除任务缓存
    apiCache.clear('getTasks')

    return { message: '所有任务已清空' }
  },

  // 清空所有答案（仅管理员）
  async clearAllAnswers() {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('answers')
      .delete()
      .neq('id', 0) // 删除所有

    if (error) throw error

    return { message: '所有答案已清空' }
  },

  // 初始化导入题目（先清空再导入，覆盖模式）
  async importQuestionsOverwrite(jsonStr) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    try {
      const data = JSON.parse(jsonStr);
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('格式错误');
      }
      
      // 验证题目数量
      const selfCount = data.questions.filter(q => q.type === 'self').length;
      const peerCount = data.questions.filter(q => q.type === 'peer').length;
      const leaderCount = data.questions.filter(q => q.type === 'leader').length;
      
      if (selfCount !== 18 || peerCount !== 18 || leaderCount !== 18) {
        throw new Error('题目数量不对，每种类型需18题');
      }

      // 先删除所有答案（因为答案表有外键依赖题目表）
      await supabase.from('answers').delete().neq('id', 0)
      
      // 再删除所有题目
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .neq('id', 0)
      
      if (deleteError) throw deleteError

      // 导入维度
      if (data.dimensions && data.dimensions.length > 0) {
        const { error: dimError } = await supabase
          .from('dimensions')
          .upsert(data.dimensions, { onConflict: 'id' })
        if (dimError) throw dimError
      }
      
      // 重新编号后导入题目（移除dimension_name，因为数据库表中没有这个列）
      const newQuestions = data.questions.map((q, index) => ({
        id: index + 1,
        dimension_id: q.dimension_id,
        type: q.type,
        content: q.content,
        sort_order: q.sort_order
      }));
      
      const { error: qError } = await supabase
        .from('questions')
        .insert(newQuestions) // 使用 insert 而不是 upsert
      if (qError) throw qError
      
      // 清除缓存
      apiCache.clear('getQuestions')
      
      return { message: '导入成功（已覆盖现有题目）' };
    } catch (e) {
      throw new Error('导入失败: ' + e.message);
    }
  },

  // 修改密码
  async changePassword(id, oldPassword, newPassword) {
    await requireAuth()
    const session = await getLocalUser()
    
    // 非管理员需要验证原密码
    if (session.user.role !== 'admin') {
      // 验证原密码
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: `${session.user.username}@test.com`,
        password: oldPassword
      })
      
      if (signInError) {
        throw new Error('原密码错误')
      }
    }

    // 更新密码 - 通过重新注册方式（有限制）
    // 注意：前端无法直接修改密码，需要用户通过邮箱链接重置
    // 这里简化处理：仅更新 profile，不修改 Auth 密码
    return { message: '密码修改功能需要通过邮箱重置链接完成' }
  },

  // 获取当前季度（带缓存）
  async getCurrentPeriod() {
    // 检查缓存
    const cached = apiCache.get('getCurrentPeriod')
    if (cached) return cached
    
    const { data, error } = await supabase
      .from('current_period')
      .select('*')
      .eq('id', 1)
      .single()

    let period
    if (error || !data) {
      // 直接返回2026年Q1，因为数据库中的任务是2026年的
      console.log('getCurrentPeriod: no data in current_period table, returning 2026 Q1')
      period = { year: 2026, quarter: 1 }
    } else {
      console.log('getCurrentPeriod: found data:', data)
      period = { year: data.year, quarter: data.quarter }
    }
    
    // 缓存结果
    apiCache.set('getCurrentPeriod', {}, period)
    
    return period
  },

  // 设置当前季度
  async setCurrentPeriod(year, quarter) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('current_period')
      .upsert({ id: 1, year, quarter })

    if (error) throw error

    apiCache.clear('getCurrentPeriod')
    apiCache.clear('getTasks')

    return { message: '季度已切换' }
  },

  // 获取题目（带缓存）
  async getQuestions(type) {
    // 检查缓存
    const cacheKey = type || 'all'
    const cached = apiCache.get('getQuestions', { type: cacheKey })
    if (cached) return cached
    
    let query = supabase
      .from('questions')
      .select('*, dimensions(name)')
      .order('dimension_id', { ascending: true })
      .order('sort_order', { ascending: true })

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) throw error

    const result = data.map(q => ({
      ...q,
      dimension_name: q.dimensions?.name || ''
    }))
    
    // 缓存结果
    apiCache.set('getQuestions', { type: cacheKey }, result)
    
    return result
  },

  // 获取题目（按类型）
  async getQuestionsByType(type) {
    return this.getQuestions(type)
  },

  // 获取雷达图数据（优化版）
  async getRadar(userId, currentUser) {
    await requireAuth()
    const session = await getLocalUser()

    const targetUserId = userId || session.user.id
    const isOwnData = targetUserId === session.user.id

    if (session.user.role === 'employee' && !isOwnData) {
      throw new Error('权限不足')
    }

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSummary !== true) {
      throw new Error('权限不足')
    }

    const period = await this.getCurrentPeriod()
    const weight = await this.getWeight()

    // 并行获取基础数据
    const [userData, dimensionsData, tasksData] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetUserId).single(),
      supabase.from('dimensions').select('*').order('sort_order'),
      supabase.from('evaluation_tasks')
        .select('*')
        .eq('target_user_id', targetUserId)
        .eq('status', 'completed')
    ])

    if (!userData.data) throw new Error('用户不存在')
    const user = userData.data
    const dimensions = dimensionsData.data || []
    const tasks = tasksData.data || []

    if (dimensions.length === 0) {
      return { user, period, radar: [] }
    }

    // 获取所有任务ID
    const allTaskIds = tasks.map(t => t.id)
    
    // 批量获取所有答案
    let allAnswers = []
    if (allTaskIds.length > 0) {
      const { data: answersData } = await supabase
        .from('answers')
        .select('task_id, question_id, score')
        .in('task_id', allTaskIds)
      allAnswers = answersData || []
    }

    // 获取所有题目（按维度和类型分组）
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, dimension_id, type')
    
    const questionMap = {}
    allQuestions?.forEach(q => {
      const key = `${q.dimension_id}_${q.type}`
      if (!questionMap[key]) questionMap[key] = []
      questionMap[key].push(q.id)
    })

    // 按类型分组任务
    const taskMap = {
      self: tasks.filter(t => t.eval_type === 'self'),
      peer: tasks.filter(t => t.eval_type === 'peer'),
      leader: tasks.filter(t => t.eval_type === 'leader')
    }

    // 计算各类型总分
    const calcTypeScore = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) return null

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))

      if (typeAnswers.length === 0) return null
      return typeAnswers.reduce((s, a) => s + a.score, 0) / typeAnswers.length
    }

    const selfScore = calcTypeScore('self')
    const peerScore = calcTypeScore('peer')
    const leaderScore = calcTypeScore('leader')

    // 计算总分（加权平均，只计算有数据的类型）
    let totalWeight = 0
    let totalScore = 0

    if (selfScore !== null) {
      totalScore += selfScore * weight.self_weight
      totalWeight += weight.self_weight
    }
    if (peerScore !== null) {
      totalScore += peerScore * weight.peer_weight
      totalWeight += weight.peer_weight
    }
    if (leaderScore !== null) {
      totalScore += leaderScore * weight.leader_weight
      totalWeight += weight.leader_weight
    }

    const total = totalWeight > 0 ? totalScore / totalWeight : 0

    // 计算各维度得分
    const calcDimensionScores = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) {
        return dimensions.map(dim => ({ dimension_name: dim.name, score: null }))
      }

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))

      return dimensions.map(dim => {
        const key = `${dim.id}_${evalType}`
        const questionIds = questionMap[key] || []

        if (questionIds.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        const dimAnswers = typeAnswers.filter(a => questionIds.includes(a.question_id))
        if (dimAnswers.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        let avgScore
        if (evalType === 'peer') {
          const taskAnswerMap = {}
          dimAnswers.forEach(answer => {
            if (!taskAnswerMap[answer.task_id]) taskAnswerMap[answer.task_id] = []
            taskAnswerMap[answer.task_id].push(answer.score)
          })
          const reviewerScores = Object.values(taskAnswerMap).map(scores =>
            scores.reduce((s, a) => s + a, 0) / scores.length
          )
          avgScore = reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length
        } else {
          avgScore = dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length
        }

        return { dimension_name: dim.name, score: avgScore }
      })
    }

    const selfDims = calcDimensionScores('self')
    const peerDims = calcDimensionScores('peer')
    const leaderDims = calcDimensionScores('leader')

    return {
      user,
      period,
      scores: {
        self_score: selfScore,
        peer_score: peerScore,
        leader_score: leaderScore,
        total_score: Math.round(total * 10) / 10
      },
      dimensions: {
        self: selfDims,
        peer: peerDims,
        leader: leaderDims
      }
    }
  },

  // 获取特定维度的得分
  async getDimensionScore(userId, evalType, dimensionId) {
    const { data: tasks } = await supabase
      .from('evaluation_tasks')
      .select('id')
      .eq('target_user_id', userId)
      .eq('eval_type', evalType)
      .eq('status', 'completed')

    if (!tasks || tasks.length === 0) return null

    // 获取该维度下的所有题目ID
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('dimension_id', dimensionId)
      .eq('type', evalType)

    if (!questions || questions.length === 0) return null

    const questionIds = questions.map(q => q.id)
    
    // 获取该维度下所有题目的答案
    let totalScore = 0
    let answerCount = 0
    
    for (const task of tasks) {
      const { data: answers } = await supabase
        .from('answers')
        .select('score')
        .eq('task_id', task.id)
        .in('question_id', questionIds)
      
      if (answers && answers.length > 0) {
        totalScore += answers.reduce((s, a) => s + a.score, 0)
        answerCount += answers.length
      }
    }
    
    return answerCount > 0 ? totalScore / answerCount : null
  },

  // 重置所有数据（初始化系统）
  async resetAllData() {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    try {
      // 按依赖顺序删除所有数据（不能并行，因为有外键约束）
      // 1. 先删除答案（依赖题目和任务）
      await supabase.from('answers').delete().neq('id', 0)
      
      // 2. 删除任务（依赖用户）
      await supabase.from('evaluation_tasks').delete().neq('id', 0)
      
      // 3. 删除题目（依赖维度）
      await supabase.from('questions').delete().neq('id', 0)
      
      // 4. 删除维度
      await supabase.from('dimensions').delete().neq('id', 0)
      
      // 注意：profiles 表不能删除，因为与 Auth 关联
      // 注意：weight_config 和 current_period 表保留配置
      
      // 清除所有缓存
      apiCache.clear()
      this.clearUsersCache()
      
      return { message: '所有评价数据已重置，系统已初始化' }
    } catch (error) {
      throw new Error('重置失败: ' + error.message)
    }
  },

  // 更新题目
  async updateQuestion(id, updates) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', id)

    if (error) throw error

    return { message: '题目更新成功' }
  },

  // 创建题目
  async createQuestion(question) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { data, error } = await supabase
      .from('questions')
      .insert([question])
      .select()
      .single()

    if (error) throw error
    return data
  },

  // 保存题目（批量）
  async saveQuestions(questions) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    // 过滤掉 dimension_name 字段（数据库表中没有这个列）
    const cleanQuestions = questions.map(q => ({
      id: q.id,
      dimension_id: q.dimension_id,
      type: q.type,
      content: q.content,
      sort_order: q.sort_order
    }))

    const { error } = await supabase
      .from('questions')
      .upsert(cleanQuestions, { onConflict: 'id' })

    if (error) throw error

    return { message: '题目保存成功' }
  },

  // 导出题目
  async exportQuestions() {
    await requireAuth()
    const { data: dimensions } = await supabase.from('dimensions').select('*').order('sort_order')
    const { data: questions } = await supabase.from('questions').select('*').order('dimension_id').order('sort_order')
    
    return JSON.stringify({
      version: '1.0',
      exportTime: new Date().toISOString(),
      dimensions: dimensions,
      questions: questions
    }, null, 2)
  },

  // 导入题目
  async importQuestions(jsonStr) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    try {
      const data = JSON.parse(jsonStr);
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('格式错误');
      }
      
      // 验证题目数量
      const selfCount = data.questions.filter(q => q.type === 'self').length;
      const peerCount = data.questions.filter(q => q.type === 'peer').length;
      const leaderCount = data.questions.filter(q => q.type === 'leader').length;
      
      if (selfCount !== 18 || peerCount !== 18 || leaderCount !== 18) {
        throw new Error('题目数量不对，每种类型需18题');
      }

      // 导入维度
      if (data.dimensions && data.dimensions.length > 0) {
        const { error: dimError } = await supabase
          .from('dimensions')
          .upsert(data.dimensions, { onConflict: 'id' })
        if (dimError) throw dimError
      }
      
      // 导入题目
      const { error: qError } = await supabase
        .from('questions')
        .upsert(data.questions, { onConflict: 'id' })
      if (qError) throw qError
      
      return { message: '导入成功' };
    } catch (e) {
      throw new Error('导入失败: ' + e.message);
    }
  },

  // 获取任务列表（优化版）
  async getTasks() {
    const session = await requireAuth()
    const period = await this.getCurrentPeriod()
    
    // 使用缓存键
    const cacheKey = `tasks_${session.user.id}_${period.year}_${period.quarter}`
    const cached = apiCache.get('getTasks', { userId: session.user.id, period })
    if (cached) return cached

    // 查询当前周期的任务
    let query = supabase
      .from('evaluation_tasks')
      .select('*')
      .eq('year', period.year)
      .eq('quarter', period.quarter)

    // 权限控制：谁能看到什么任务
    if (session.user.role === 'employee') {
      query = query.eq('reviewer_user_id', session.user.id)
    } else if (session.user.role === 'leader') {
      query = query.or(`target_user_id.eq.${session.user.id},reviewer_user_id.eq.${session.user.id}`)
    }

    const { data, error } = await query
    if (error) {
      console.error('getTasks error:', error)
      throw error
    }

    // 获取所有涉及的用户ID
    const userIds = new Set()
    data.forEach(t => {
      userIds.add(t.target_user_id)
      userIds.add(t.reviewer_user_id)
    })
    
    // 批量获取用户信息（使用缓存）
    const users = await this.getUsers()
    const profileMap = {}
    users.forEach(p => profileMap[p.id] = p)

    const result = data.map(t => ({
      ...t,
      target_name: profileMap[t.target_user_id]?.name || '',
      reviewer_name: profileMap[t.reviewer_user_id]?.name || ''
    }))
    
    // 缓存结果
    apiCache.set('getTasks', { userId: session.user.id, period }, result)
    
    return result
  },

  // 创建评价任务
  async createTask(targetUserId, evalType, reviewerUserIds) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const period = await this.getCurrentPeriod()

    // 检查是否有重复评价任务（同一被评价人+评价人组合）
    const existingTasks = await supabase
      .from('evaluation_tasks')
      .select('*')
      .eq('target_user_id', targetUserId)
      .eq('eval_type', evalType)
      .eq('year', period.year)
      .eq('quarter', period.quarter)
      .in('reviewer_user_id', reviewerUserIds)

    if (existingTasks.data && existingTasks.data.length > 0) {
      const existingReviewers = existingTasks.data.map(t => t.reviewer_user_id)
      const duplicates = reviewerUserIds.filter(id => existingReviewers.includes(id))
      throw new Error(`评价人 ${duplicates.join(', ')} 已对此人完成过评价，不可重复创建`)
    }

    // 获取当前题目并创建快照
    const { data: currentQuestions } = await supabase
      .from('questions')
      .select('*, dimensions(name)')
      .eq('type', evalType)
      .order('dimension_id', { ascending: true })
      .order('sort_order', { ascending: true })

    const snapshotData = {
      questions: currentQuestions || [],
      createdAt: new Date().toISOString(),
      period: period
    }

    const reviewers = evalType === 'self' ? [targetUserId] : reviewerUserIds

    const tasks = reviewers.map(reviewerUserId => ({
      eval_type: evalType,
      target_user_id: targetUserId,
      reviewer_user_id: reviewerUserId,
      year: period.year,
      quarter: period.quarter,
      status: 'pending',
      snapshot_data: snapshotData
    }))

    const { error } = await supabase
      .from('evaluation_tasks')
      .insert(tasks)

    if (error) throw error

    apiCache.clear('getTasks')

    return { message: '评价任务创建成功' }
  },

  // 获取任务详情
  async getTaskDetail(taskId) {
    await requireAuth()
    const session = await getLocalUser()

    // 获取任务
    const { data: task, error: taskError } = await supabase
      .from('evaluation_tasks')
      .select(`
        *,
        target:profiles!evaluation_tasks_target_user_id_fkey(name),
        reviewer:profiles!evaluation_tasks_reviewer_user_id_fkey(name)
      `)
      .eq('id', taskId)
      .single()

    if (taskError) throw taskError

    // 权限检查
    if (session.user.role === 'employee') {
      if (task.target_user_id !== session.user.id && task.reviewer_user_id !== session.user.id) {
        throw new Error('权限不足')
      }
    }

    // 优先使用快照中的题目，如果没有则从当前题目表获取
    let questions = []
    if (task.snapshot_data && task.snapshot_data.questions && task.snapshot_data.questions.length > 0) {
      questions = task.snapshot_data.questions
    } else {
      const { data } = await supabase
        .from('questions')
        .select('*, dimensions(name)')
        .eq('type', task.eval_type)
        .order('dimension_id', { ascending: true })
        .order('sort_order', { ascending: true })
      questions = data || []
    }

    // 获取答案
    const { data: answers } = await supabase
      .from('answers')
      .select('*')
      .eq('task_id', taskId)

    const answerMap = {}
    answers?.forEach(a => answerMap[a.question_id] = a)

    return {
      task: {
        ...task,
        target_name: task.target?.name || '',
        reviewer_name: task.reviewer?.name || ''
      },
      questions: questions.map(q => ({
        ...q,
        dimension_name: q.dimensions?.name || ''
      })),
      answers: answerMap
    }
  },

  // 提交答案
  async submitAnswers(taskId, answers) {
    await requireAuth()
    const session = await getLocalUser()

    // 验证任务归属
    const { data: task, error: taskError } = await supabase
      .from('evaluation_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError) throw taskError
    if (task.reviewer_user_id !== session.user.id) {
      throw new Error('只能填写分配给你的评价任务')
    }

    // 插入/更新答案
    const answerRecords = answers.map(a => ({
      task_id: taskId,
      question_id: a.questionId,
      score: a.score,
      reason: a.reason || ''
    }))

    // 使用 upsert 插入答案
    for (const answer of answerRecords) {
      const { error } = await supabase
        .from('answers')
        .upsert(answer, { onConflict: 'task_id,question_id' })
      
      if (error) throw error
    }

    // 更新任务状态
    const { error: updateError } = await supabase
      .from('evaluation_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)

    if (updateError) throw updateError

    apiCache.clear('getTasks')

    return { message: '评价提交成功' }
  },

  // 获取权重配置（带缓存）
  async getWeight() {
    // 检查缓存
    const cached = apiCache.get('getWeight')
    if (cached) return cached
    
    const { data, error } = await supabase
      .from('weight_config')
      .select('*')
      .eq('id', 1)
      .single()

    let weight
    if (error || !data) {
      weight = { self_weight: 0.3, peer_weight: 0.3, leader_weight: 0.4, score_type: '10' }
    } else {
      weight = data
    }
    
    // 缓存结果
    apiCache.set('getWeight', {}, weight)
    
    return weight
  },

  // 更新权重配置
  async updateWeight(weight) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('weight_config')
      .upsert({
        id: 1,
        self_weight: weight.self_weight,
        peer_weight: weight.peer_weight,
        leader_weight: weight.leader_weight,
        score_type: weight.score_type
      })

    if (error) throw error

    apiCache.del('getWeight')

    return { message: '权重配置更新成功' }
  },

  // 获取统计结果 (管理员) - 优化版
  async getSummary() {
    const cached = apiCache.get('getSummary')
    if (cached) return cached

    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const period = await this.getCurrentPeriod()
    const weight = await this.getWeight()

    // 批量获取所有员工用户（排除管理员和领导）
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'employee')
      .order('name', { ascending: true })

    if (!users || users.length === 0) return []

    // 获取所有用户的任务（批量查询）
    const userIds = users.map(u => u.id)
    const { data: allTasks } = await supabase
      .from('evaluation_tasks')
      .select('id, target_user_id, eval_type, status')
      .in('target_user_id', userIds)
      .eq('status', 'completed')

    // 获取所有答案（包含question_id用于按维度计算）
    const taskIds = allTasks?.map(t => t.id) || []
    let allAnswers = []
    if (taskIds.length > 0) {
      const { data: answersData } = await supabase
        .from('answers')
        .select('task_id, question_id, score')
        .in('task_id', taskIds)
      allAnswers = answersData || []
    }

    // 获取所有题目和维度
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, dimension_id, type')
    
    const { data: dimensions } = await supabase
      .from('dimensions')
      .select('*')
      .order('sort_order')

    // 按用户和类型分组任务
    const taskMap = {}
    allTasks?.forEach(task => {
      const key = `${task.target_user_id}_${task.eval_type}`
      if (!taskMap[key]) taskMap[key] = []
      taskMap[key].push(task)
    })

    // 按任务分组答案
    const answerMap = {}
    allAnswers.forEach(answer => {
      if (!answerMap[answer.task_id]) answerMap[answer.task_id] = []
      answerMap[answer.task_id].push(answer)
    })

    // 题目映射：dimension_id_type -> [question_ids]
    const questionMap = {}
    allQuestions?.forEach(q => {
      const key = `${q.dimension_id}_${q.type}`
      if (!questionMap[key]) questionMap[key] = []
      questionMap[key].push(q)
    })

    // 计算每个用户的得分
    const results = users.map(user => {
      // 计算各类型总分（用于显示）
      const calcTypeScore = (evalType) => {
        const key = `${user.id}_${evalType}`
        const typeTasks = taskMap[key] || []
        if (typeTasks.length === 0) return null
        
        let totalScore = 0
        let answerCount = 0
        
        typeTasks.forEach(task => {
          const taskAnswers = answerMap[task.id] || []
          if (taskAnswers.length > 0) {
            totalScore += taskAnswers.reduce((s, a) => s + a.score, 0)
            answerCount += taskAnswers.length
          }
        })
        
        return answerCount > 0 ? totalScore / answerCount : null
      }

      // 计算各维度的各类型得分
      const calcDimScores = (dimId, evalType) => {
        const key = `${dimId}_${evalType}`
        const typeTasks = taskMap[`${user.id}_${evalType}`] || []
        const dimQuestions = questionMap[key] || []
        
        if (typeTasks.length === 0 || dimQuestions.length === 0) return null
        
        const questionIds = dimQuestions.map(q => q.id)
        
        if (evalType === 'peer') {
          // 他评：先按每个评价人计算平均分，再对所有评价人求平均
          const reviewerScores = []
          typeTasks.forEach(task => {
            const taskAnswers = answerMap[task.id] || []
            const dimAnswers = taskAnswers.filter(a => questionIds.includes(a.question_id))
            if (dimAnswers.length > 0) {
              const avg = dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length
              reviewerScores.push(avg)
            }
          })
          return reviewerScores.length > 0 
            ? reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length 
            : null
        } else {
          // 自评和领导评：直接计算平均分
          let totalScore = 0
          let answerCount = 0
          typeTasks.forEach(task => {
            const taskAnswers = answerMap[task.id] || []
            const dimAnswers = taskAnswers.filter(a => questionIds.includes(a.question_id))
            if (dimAnswers.length > 0) {
              totalScore += dimAnswers.reduce((s, a) => s + a.score, 0)
              answerCount += dimAnswers.length
            }
          })
          return answerCount > 0 ? totalScore / answerCount : null
        }
      }

      const selfScore = calcTypeScore('self')
      const peerScore = calcTypeScore('peer')
      const leaderScore = calcTypeScore('leader')

      // 计算每个维度的最终得分
      const dimFinalScores = (dimensions || []).map(dim => {
        const self = calcDimScores(dim.id, 'self')
        const peer = calcDimScores(dim.id, 'peer')
        const leader = calcDimScores(dim.id, 'leader')
        
        return (self || 0) * weight.self_weight + 
               (peer || 0) * weight.peer_weight + 
               (leader || 0) * weight.leader_weight
      })

      // 综合总分 = 6个维度最终得分的算术平均，保留1位小数
      const total = dimFinalScores.length > 0
        ? dimFinalScores.reduce((s, a) => s + a, 0) / dimFinalScores.length
        : 0

      return {
        user_id: user.id,
        user_name: user.name,
        department: user.department,
        self_score: selfScore,
        peer_score: peerScore,
        leader_score: leaderScore,
        total_score: Math.round(total * 10) / 10
      }
    })

    const sortedResults = results.sort((a, b) => b.total_score - a.total_score)
    apiCache.set('getSummary', sortedResults)
    return sortedResults
  },

  // 获取个人得分（优化版）
  async getScore(userId) {
    await requireAuth()
    const session = await getLocalUser()

    const targetUserId = userId || session.user.id
    const isOwnData = targetUserId === session.user.id

    if (session.user.role === 'employee' && !isOwnData) {
      throw new Error('权限不足')
    }

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSummary !== true) {
      throw new Error('权限不足')
    }

    const period = await this.getCurrentPeriod()
    const weight = await this.getWeight()

    // 并行获取基础数据
    const [userData, dimensionsData, tasksData] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetUserId).single(),
      supabase.from('dimensions').select('*').order('sort_order'),
      supabase.from('evaluation_tasks')
        .select('*')
        .eq('target_user_id', targetUserId)
        .eq('status', 'completed')
    ])

    if (!userData.data) throw new Error('用户不存在')
    const user = userData.data
    const dimensions = dimensionsData.data || []
    const tasks = tasksData.data || []

    // 按类型分组任务
    const taskMap = {
      self: tasks.filter(t => t.eval_type === 'self'),
      peer: tasks.filter(t => t.eval_type === 'peer'),
      leader: tasks.filter(t => t.eval_type === 'leader')
    }

    // 获取所有任务ID
    const allTaskIds = tasks.map(t => t.id)
    
    // 批量获取所有答案
    let allAnswers = []
    if (allTaskIds.length > 0) {
      const { data: answersData } = await supabase
        .from('answers')
        .select('task_id, question_id, score')
        .in('task_id', allTaskIds)
      allAnswers = answersData || []
    }

    // 获取所有题目（按维度和类型分组）
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, dimension_id, type')
    
    const questionMap = {}
    allQuestions?.forEach(q => {
      const key = `${q.dimension_id}_${q.type}`
      if (!questionMap[key]) questionMap[key] = []
      questionMap[key].push(q.id)
    })

    // 计算各类型总分
    const calcTypeScore = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) return null
      
      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))
      
      if (typeAnswers.length === 0) return null
      return typeAnswers.reduce((s, a) => s + a.score, 0) / typeAnswers.length
    }

    const selfScore = calcTypeScore('self')
    const peerScore = calcTypeScore('peer')
    const leaderScore = calcTypeScore('leader')

    // 计算总分（加权平均，只计算有数据的类型）
    let totalWeight = 0
    let totalScore = 0

    if (selfScore !== null) {
      totalScore += selfScore * weight.self_weight
      totalWeight += weight.self_weight
    }
    if (peerScore !== null) {
      totalScore += peerScore * weight.peer_weight
      totalWeight += weight.peer_weight
    }
    if (leaderScore !== null) {
      totalScore += leaderScore * weight.leader_weight
      totalWeight += weight.leader_weight
    }

    const total = totalWeight > 0 ? totalScore / totalWeight : 0

    // 计算各维度得分（批量处理）
    // 他评特殊处理：先按每个评价人计算平均分，再对所有评价人求平均
    const calcDimensionScores = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) {
        return dimensions.map(dim => ({ dimension_name: dim.name, score: null }))
      }

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))
      
      // 按维度分组计算得分
      return dimensions.map(dim => {
        const key = `${dim.id}_${evalType}`
        const questionIds = questionMap[key] || []
        
        if (questionIds.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        const dimAnswers = typeAnswers.filter(a => questionIds.includes(a.question_id))
        if (dimAnswers.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        let avgScore
        if (evalType === 'peer') {
          // 他评：先按每个评价人（任务）计算平均分，再对所有评价人求平均
          const taskAnswerMap = {}
          dimAnswers.forEach(answer => {
            if (!taskAnswerMap[answer.task_id]) taskAnswerMap[answer.task_id] = []
            taskAnswerMap[answer.task_id].push(answer.score)
          })
          
          // 计算每个评价人的平均分
          const reviewerScores = Object.values(taskAnswerMap).map(scores => 
            scores.reduce((s, a) => s + a, 0) / scores.length
          )
          
          // 对所有评价人的平均分再求平均
          avgScore = reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length
        } else {
          // 自评和领导评：直接计算所有答案的平均分
          avgScore = dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length
        }
        
        return { dimension_name: dim.name, score: avgScore }
      })
    }

    const selfDims = calcDimensionScores('self')
    const peerDims = calcDimensionScores('peer')
    const leaderDims = calcDimensionScores('leader')

    // 计算单维度最终得分（加权）
    const calcDimFinalScore = (dimIdx) => {
      const self = selfDims[dimIdx]?.score
      const peer = peerDims[dimIdx]?.score
      const leader = leaderDims[dimIdx]?.score
      
      return (self || 0) * weight.self_weight + 
             (peer || 0) * weight.peer_weight + 
             (leader || 0) * weight.leader_weight
    }

    // 计算综合总分：6个维度最终得分的算术平均，保留1位小数
    const dimFinalScores = dimensions.map((_, idx) => calcDimFinalScore(idx))
    const totalFinalScore = dimFinalScores.reduce((s, a) => s + a, 0) / dimensions.length

    return {
      user,
      period,
      scores: {
        self_score: selfScore,
        peer_score: peerScore,
        leader_score: leaderScore,
        total_score: Math.round(totalFinalScore * 10) / 10
      },
      dimensions: {
        self: selfDims,
        peer: peerDims,
        leader: leaderDims
      }
    }
  },

  // 获取指定季度的个人得分（用于历史对比）
  async getScoreByPeriod(userId, year, quarter) {
    await requireAuth()
    const session = await getLocalUser()

    const targetUserId = userId || session.user.id
    const isOwnData = targetUserId === session.user.id

    if (session.user.role === 'employee' && !isOwnData) {
      throw new Error('权限不足')
    }

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSummary !== true) {
      throw new Error('权限不足')
    }

    const weight = await this.getWeight()

    // 并行获取基础数据
    const [userData, dimensionsData] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', targetUserId).single(),
      supabase.from('dimensions').select('*').order('sort_order')
    ])

    if (!userData.data) throw new Error('用户不存在')
    const user = userData.data
    const dimensions = dimensionsData.data || []

    // 获取指定季度的已完成任务
    const periodStart = `${year}-${(quarter - 1) * 3 + 1}-01`
    const periodEnd = quarter === 4 ? `${year + 1}-01-01` : `${year}-${quarter * 3 + 1}-01`

    const { data: tasks } = await supabase
      .from('evaluation_tasks')
      .select('*')
      .eq('target_user_id', targetUserId)
      .eq('status', 'completed')
      .gte('completed_at', periodStart)
      .lt('completed_at', periodEnd)

    const allTasks = tasks || []

    // 按类型分组任务
    const taskMap = {
      self: allTasks.filter(t => t.eval_type === 'self'),
      peer: allTasks.filter(t => t.eval_type === 'peer'),
      leader: allTasks.filter(t => t.eval_type === 'leader')
    }

    // 获取所有任务ID
    const allTaskIds = allTasks.map(t => t.id)

    // 批量获取所有答案
    let allAnswers = []
    if (allTaskIds.length > 0) {
      const { data: answersData } = await supabase
        .from('answers')
        .select('task_id, question_id, score')
        .in('task_id', allTaskIds)
      allAnswers = answersData || []
    }

    // 获取所有题目（按维度和类型分组）
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, dimension_id, type')

    const questionMap = {}
    allQuestions?.forEach(q => {
      const key = `${q.dimension_id}_${q.type}`
      if (!questionMap[key]) questionMap[key] = []
      questionMap[key].push(q.id)
    })

    // 计算各类型总分
    const calcTypeScore = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) return null

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))

      if (typeAnswers.length === 0) return null
      return typeAnswers.reduce((s, a) => s + a.score, 0) / typeAnswers.length
    }

    const selfScore = calcTypeScore('self')
    const peerScore = calcTypeScore('peer')
    const leaderScore = calcTypeScore('leader')

    // 计算总分（加权平均，只计算有数据的类型）
    let totalWeight = 0
    let totalScore = 0

    if (selfScore !== null) {
      totalScore += selfScore * weight.self_weight
      totalWeight += weight.self_weight
    }
    if (peerScore !== null) {
      totalScore += peerScore * weight.peer_weight
      totalWeight += weight.peer_weight
    }
    if (leaderScore !== null) {
      totalScore += leaderScore * weight.leader_weight
      totalWeight += weight.leader_weight
    }

    const total = totalWeight > 0 ? totalScore / totalWeight : 0

    // 计算各维度得分
    const calcDimensionScores = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) {
        return dimensions.map(dim => ({ dimension_name: dim.name, score: null }))
      }

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))

      return dimensions.map(dim => {
        const key = `${dim.id}_${evalType}`
        const questionIds = questionMap[key] || []

        if (questionIds.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        const dimAnswers = typeAnswers.filter(a => questionIds.includes(a.question_id))
        if (dimAnswers.length === 0) {
          return { dimension_name: dim.name, score: null }
        }

        let avgScore
        if (evalType === 'peer') {
          const taskAnswerMap = {}
          dimAnswers.forEach(answer => {
            if (!taskAnswerMap[answer.task_id]) taskAnswerMap[answer.task_id] = []
            taskAnswerMap[answer.task_id].push(answer.score)
          })
          const reviewerScores = Object.values(taskAnswerMap).map(scores =>
            scores.reduce((s, a) => s + a, 0) / scores.length
          )
          avgScore = reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length
        } else {
          avgScore = dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length
        }

        return { dimension_name: dim.name, score: avgScore }
      })
    }

    const selfDims = calcDimensionScores('self')
    const peerDims = calcDimensionScores('peer')
    const leaderDims = calcDimensionScores('leader')

    return {
      user,
      period: { year, quarter },
      scores: {
        self_score: selfScore,
        peer_score: peerScore,
        leader_score: leaderScore,
        total_score: Math.round(total * 10) / 10
      },
      dimensions: {
        self: selfDims,
        peer: peerDims,
        leader: leaderDims
      }
    }
  },

  // 数据导出 (管理员)
  async exportAllData() {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const [users, dimensions, questions, tasks, answers, weight, period] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('dimensions').select('*').order('sort_order'),
      supabase.from('questions').select('*').order('dimension_id').order('sort_order'),
      supabase.from('evaluation_tasks').select('*'),
      supabase.from('answers').select('*'),
      this.getWeight(),
      this.getCurrentPeriod()
    ])

    return JSON.stringify({
      exportTime: new Date().toISOString(),
      users: users.data,
      dimensions: dimensions.data,
      questions: questions.data,
      tasks: tasks.data,
      answers: answers.data,
      weight,
      currentPeriod: period
    }, null, 2)
  },

  // 数据导入 (管理员)
  async importAllData(jsonStr) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const data = JSON.parse(jsonStr)

    if (data.dimensions) {
      await supabase.from('dimensions').upsert(data.dimensions)
    }
    if (data.questions) {
      await supabase.from('questions').upsert(data.questions)
    }
    if (data.weight) {
      await supabase.from('weight_config').upsert({ id: 1, ...data.weight })
    }
    if (data.currentPeriod) {
      await supabase.from('current_period').upsert({ id: 1, ...data.currentPeriod })
    }

    return { message: '数据导入成功' }
  }
}

// 创建用户但不影响当前登录状态（用于管理员创建用户）
export const createUserWithoutLogin = async (username, password, userData) => {
  // 创建独立的 Supabase 客户端实例
  const isolatedClient = createClient(supabaseUrl, supabaseAnonKey)

  // 创建 Auth 用户
  const { data: authData, error: authError } = await isolatedClient.auth.signUp({
    email: `${username}@test.com`,
    password: password,
    options: {
      data: {
        username: username,
        name: userData.name,
        role: userData.role,
        department: userData.department
      }
    }
  })

  if (authError) throw authError
  if (!authData.user) throw new Error('用户创建失败')

  return { id: authData.user.id }
}

// 导出 getScore 函数供 MyScore.vue 使用
export const getScore = api.getScore

export { apiCache }
export default api
