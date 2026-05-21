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

// 获取当前用户（优先从 Supabase session，其次从缓存）
async function getLocalUser() {
  // 先尝试从 Supabase Auth 获取 session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (session) {
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
  
  // 如果没有 Supabase session，尝试从缓存获取用户（临时token登录情况）
  const cachedUser = apiCache.getUser()
  if (cachedUser) {
    // 尝试从数据库获取最新的用户信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', cachedUser.id)
      .single()
      
    if (profile) {
      const user = {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        name: profile.name,
        department: profile.department,
        permissions: parsePermissions(profile.permissions)
      }
      
      // 更新缓存
      apiCache.setUser(user)
      
      // 返回临时token
      return {
        user: user,
        token: btoa(JSON.stringify({ 
          userId: profile.id, 
          expires: Date.now() + 86400000 
        }))
      }
    }
  }
  
  return null
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
  // 登录 (使用自定义密码验证)
  async login(username, password) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      throw new Error('用户名不存在')
    }

    const storedHash = profile.password_hash
    const inputHash = hashPassword(password)

    const user = {
      id: profile.id,
      username: profile.username,
      role: profile.role,
      name: profile.name,
      department: profile.department,
      permissions: parsePermissions(profile.permissions)
    }

    // 如果没有 password_hash，先尝试通过 Supabase Auth 登录
    if (!storedHash) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email || `${username}@test.com`,
        password: password
      })

      if (authError) {
        throw new Error('登录失败：' + authError.message)
      }

      // 登录成功后，同步存储 password_hash 到 profiles
      await supabase
        .from('profiles')
        .update({ password_hash: inputHash })
        .eq('id', profile.id)

      // 保存用户信息到缓存
      apiCache.setUser(user)
      
      return { token: authData.session.access_token, user }
    }

    if (storedHash !== inputHash) {
      throw new Error('密码错误')
    }

    // password_hash 验证通过，尝试获取 Supabase Auth session
    const { data: existingSession } = await supabase.auth.getSession()
    if (existingSession?.session?.refresh_token) {
      try {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: existingSession.session.refresh_token
        })
        if (!refreshError && refreshedData.session) {
          apiCache.setUser(user)
          return { token: refreshedData.session.access_token, user }
        }
      } catch (e) {
        // ignore refresh error
      }
    }

    // 尝试使用 Supabase Auth 登录（可能是新用户或 session 已过期）
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email || `${username}@test.com`,
      password: password
    })

    if (!authError && authData?.session) {
      apiCache.setUser(user)
      return { token: authData.session.access_token, user }
    }

    // 如果 Supabase Auth 登录失败，但 password_hash 验证通过，仍然允许登录
    // 这种情况发生在管理员修改密码但 Supabase Auth 密码未同步时
    console.warn('Supabase Auth登录失败，使用自定义认证:', authError?.message)
    
    // 创建一个临时token（基于用户ID生成）
    const tempToken = btoa(JSON.stringify({ 
      userId: profile.id, 
      expires: Date.now() + 86400000 
    }))
    
    apiCache.setUser(user)
    return { token: tempToken, user }
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
    const { data: authData, error: authError } = await supabase.auth.signUp({
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

    // 创建 profile（包含password_hash）
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        username: username,
        name: userData.name,
        role: userData.role,
        department: userData.department,
        permissions: userData.permissions || { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false },
        password_hash: hashPassword(password)
      })

    if (profileError) throw profileError

    return { id: authData.user.id }
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
        permissions: userData.permissions || { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false },
        password_hash: hashPassword(userData.password)
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

    // 处理密码更新
    if (userData.password) {
      updateData.password_hash = hashPassword(userData.password)
      
      // 检查是否是临时token（base64编码的JSON）
      const isTempToken = session.token.length < 200 && session.token.indexOf('.') === -1
      
      // 只有使用真实Supabase token时才调用边缘函数同步密码
      if (!isTempToken) {
        try {
          const updateResponse = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.token}`
            },
            body: JSON.stringify({
              userId: id,
              newPassword: userData.password
            })
          })
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}))
            console.warn('Supabase Auth密码同步失败:', errorData.error || updateResponse.statusText)
          }
        } catch (e) {
          console.warn('调用密码同步函数失败:', e.message)
        }
      } else {
        console.warn('使用临时token，跳过Supabase Auth密码同步')
      }
    } else if (userData.password_hash) {
      updateData.password_hash = userData.password_hash
    }

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

    // 先获取关联的任务 ID
    const { data: relatedTasks } = await supabase
      .from('evaluation_tasks')
      .select('id')
      .or(`target_user_id.eq.${id},reviewer_user_id.eq.${id}`)

    const taskIds = relatedTasks?.map(t => t.id) || []

    // 删除关联的答案
    if (taskIds.length > 0) {
      const { error: answerError } = await supabase
        .from('answers')
        .delete()
        .in('task_id', taskIds)

      if (answerError) throw new Error('删除关联答案失败：' + answerError.message)
    }

    // 删除关联的评价任务
    if (taskIds.length > 0) {
      const { error: taskError } = await supabase
        .from('evaluation_tasks')
        .delete()
        .in('id', taskIds)

      if (taskError) throw new Error('删除关联任务失败：' + taskError.message)
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
      .neq('id', 0)

    if (error) throw error

    return { message: '所有答案已清空' }
  },

  async importAnswers(jsonStr) {
    await requireAuth()
    const session = await getLocalUser()
    
    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    try {
      const data = JSON.parse(jsonStr);
      if (!data.answers || !Array.isArray(data.answers)) {
        throw new Error('格式错误：缺少 answers 数组');
      }

      const users = await this.getUsers(false);
      const usernameToId = {};
      users.forEach(u => usernameToId[u.username] = u.id);

      const tasks = await this.getTasks();
      const taskMap = {};
      tasks.forEach(t => taskMap[`${t.target_user_id}_${t.reviewer_user_id}_${t.eval_type}`] = t.id);

      const questions = await this.getQuestions();
      const questionTextToId = {};
      const normalizeText = (str) => String(str || '').trim().replace(/\s+/g, ' ');
      questions.forEach(q => questionTextToId[normalizeText(q.content)] = q.id);

      const answersToInsert = [];
      let skipCount = 0;
      const errors = [];
      let matchDetails = { total: 0, matched: 0, noTarget: 0, noReviewer: 0, noTask: 0, noQuestion: 0 };

      for (const item of data.answers) {
        matchDetails.total++;
        const targetId = usernameToId[item.target_username];
        const reviewerId = usernameToId[item.reviewer_username];
        const evalType = item.eval_type;
        const taskKey = `${targetId}_${reviewerId}_${evalType}`;
        const taskId = taskMap[taskKey];

        if (!targetId) {
          errors.push(`用户不存在: ${item.target_username}`)
          matchDetails.noTarget++;
          skipCount++;
          continue;
        }
        if (!reviewerId) {
          errors.push(`评价人不存在: ${item.reviewer_username}`)
          matchDetails.noReviewer++;
          skipCount++;
          continue;
        }
        if (!taskId) {
          errors.push(`任务不存在: ${item.target_username}/${item.reviewer_username}/${item.eval_type}`)
          matchDetails.noTask++;
          skipCount++;
          continue;
        }

        const task = tasks.find(t => t.id === taskId);
        let questionId = null;

        if (task?.snapshot_data?.questions && task.snapshot_data.questions.length > 0) {
          const snapshotQuestion = task.snapshot_data.questions.find(q =>
            normalizeText(q.content) === normalizeText(item.question_content)
          );
          questionId = snapshotQuestion?.id;
        }

        if (!questionId) {
          questionId = questionTextToId[normalizeText(item.question_content)];
        }

        if (!questionId) {
          errors.push(`题目不存在: ${item.question_content}`)
          matchDetails.noQuestion++;
          skipCount++;
          continue;
        }

        matchDetails.matched++;

        answersToInsert.push({
          task_id: taskId,
          question_id: questionId,
          score: item.score,
          reason: item.reason || ''
        });
      }

      if (answersToInsert.length === 0) {
        const uniqueErrors = [...new Set(errors)].slice(0, 5).join('\n')
        const detailMsg = `总数据:${matchDetails.total}, 匹配成功:${matchDetails.matched}, 无任务:${matchDetails.noTask}, 无题目:${matchDetails.noQuestion}`
        throw new Error(`没有可导入的有效数据。\n${detailMsg}\n${uniqueErrors}${errors.length > 5 ? '\n...还有更多错误' : ''}`);
      }

      // 使用 upsert 插入/更新答案，保留未导入的题目答案
      const { error: upsertError } = await supabase
        .from('answers')
        .upsert(answersToInsert, { onConflict: 'task_id,question_id' });

      if (upsertError) {
        console.error('插入失败:', upsertError);
        throw upsertError;
      }

      // 更新任务状态为已完成
      const importedTaskIds = [...new Set(answersToInsert.map(a => a.task_id))]
      const { error: updateError } = await supabase
        .from('evaluation_tasks')
        .update({ status: 'completed' })
        .in('id', importedTaskIds)

      if (updateError) {
        console.warn('更新任务状态失败:', updateError);
      }

      apiCache.clear('getTasks');

      return { 
        message: `导入成功：${answersToInsert.length} 条${skipCount > 0 ? `，跳过 ${skipCount} 条无效数据` : ''}` 
      };
    } catch (e) {
      throw new Error('导入失败: ' + e.message);
    }
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
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email

      if (!email) {
        throw new Error('无法获取用户邮箱信息，请重新登录')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: oldPassword
      })

      if (signInError) {
        if (signInError.message.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut()
          throw new Error('登录状态已过期，请重新登录后再试')
        }
        throw new Error('原密码错误')
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw new Error('密码修改失败：' + updateError.message)
      }

      return { message: '密码修改成功' }
    } catch (err) {
      if (err.message.includes('Invalid Refresh Token')) {
        await supabase.auth.signOut()
        throw new Error('登录状态已过期，请重新登录后再试')
      }
      throw err
    }
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
      period = { year: 2026, quarter: 1 }
    } else {
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

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSelf !== true) {
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

    // 四舍五入保留1位小数
    const round1 = (num) => Math.round((num || 0) * 10) / 10

    // 计算各类型总分
    const calcTypeScore = (evalType) => {
      const typeTasks = taskMap[evalType]
      if (!typeTasks || typeTasks.length === 0) return null

      const taskIds = typeTasks.map(t => t.id)
      const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))

      if (typeAnswers.length === 0) return null
      return round1(typeAnswers.reduce((s, a) => s + a.score, 0) / typeAnswers.length)
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

    const total = totalWeight > 0 ? round1(totalScore / totalWeight) : 0

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
            round1(scores.reduce((s, a) => s + a, 0) / scores.length)
          )
          avgScore = round1(reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length)
        } else {
          avgScore = round1(dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length)
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
        total_score: total
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

    const taskIds = tasks.map(t => t.id)
    const questionIds = questions.map(q => q.id)

    // 批量获取该维度下所有题目的答案（避免 N+1 查询）
    const { data: answers } = await supabase
      .from('answers')
      .select('score')
      .in('task_id', taskIds)
      .in('question_id', questionIds)

    if (!answers || answers.length === 0) return null

    const totalScore = answers.reduce((s, a) => s + a.score, 0)
    const answerCount = answers.length

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

    // 插入/更新答案 - 批量操作
    const answerRecords = answers.map(a => ({
      task_id: taskId,
      question_id: a.questionId,
      score: a.score,
      reason: a.reason || ''
    }))

    // 批量 upsert 插入答案
    const { error: upsertError } = await supabase
      .from('answers')
      .upsert(answerRecords, { onConflict: 'task_id,question_id' })

    if (upsertError) throw upsertError

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

  // 暂存答案（不提交）
  async saveAnswers(taskId, answers) {
    await requireAuth()
    const session = await getLocalUser()

    const { data: task, error: taskError } = await supabase
      .from('evaluation_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError) throw taskError
    if (task.reviewer_user_id !== session.user.id) {
      throw new Error('只能填写分配给你的评价任务')
    }

    const answerRecords = answers.map(a => ({
      task_id: taskId,
      question_id: a.questionId,
      score: a.score,
      reason: a.reason || ''
    }))

    const { error: upsertError } = await supabase
      .from('answers')
      .upsert(answerRecords, { onConflict: 'task_id,question_id' })

    if (upsertError) throw upsertError

    const { error: updateError } = await supabase
      .from('evaluation_tasks')
      .update({ status: 'saved' })
      .eq('id', taskId)

    if (updateError) throw updateError

    apiCache.clear('getTasks')

    return { message: '评价已暂存' }
  },

  // 获取权重配置（带缓存）
  async getWeight() {
    const cached = apiCache.get('getWeight')
    if (cached) return cached

    const { data, error } = await supabase
      .from('weight_config')
      .select('*')
      .eq('id', 1)
      .single()

    let weight
    if (error || !data) {
      weight = { self_weight: 0.2, peer_weight: 0.3, leader_weight: 0.5, score_type: '10' }
    } else {
      weight = data
    }

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

    apiCache.clear('getWeight')

    return { message: '权重配置更新成功' }
  },

  // 获取AI配置（带缓存）
  async getAIConfig() {
    const cached = apiCache.get('getAIConfig')
    if (cached) return cached

    const { data, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('id', 1)
      .single()

    let config
    if (error || !data) {
      config = {
        enabled: false,
        provider: 'openai',
        api_url: 'https://api.openai.com/v1',
        api_key: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 4000
      }
    } else {
      config = data
    }

    apiCache.set('getAIConfig', {}, config)

    return config
  },

  // 更新AI配置
  async updateAIConfig(config) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    const { error } = await supabase
      .from('ai_config')
      .upsert({
        id: 1,
        enabled: config.enabled,
        provider: config.provider,
        api_url: config.api_url,
        api_key: config.api_key,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.max_tokens
      })

    if (error) throw error

    apiCache.clear('getAIConfig')

    return { message: 'AI配置更新成功' }
  },

  // 获取用户评价详情（用于AI分析）
  async getUserEvaluationDetail(userId) {
    await requireAuth()

    const period = await this.getCurrentPeriod()

    const { data: tasks } = await supabase
      .from('evaluation_tasks')
      .select('id, eval_type, status, target_user_id, reviewer_user_id')
      .eq('target_user_id', userId)
      .eq('year', period.year)
      .eq('quarter', period.quarter)

    if (!tasks || tasks.length === 0) {
      return { user: null, evaluations: [], scores: {} }
    }

    const taskIds = tasks.map(t => t.id)

    const { data: answers } = await supabase
      .from('answers')
      .select('task_id, question_id, score, comment')
      .in('task_id', taskIds)

    const questionIds = [...new Set(answers.map(a => a.question_id))]
    const { data: questions } = await supabase
      .from('questions')
      .select('id, content, type, dimension_id')
      .in('id', questionIds)

    const { data: dimensions } = await supabase
      .from('dimensions')
      .select('id, name')

    const { data: reviewerProfiles } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('id', tasks.map(t => t.reviewer_user_id))

    const reviewerMap = {}
    reviewerProfiles.forEach(r => { reviewerMap[r.id] = r })

    const questionMap = {}
    questions.forEach(q => { questionMap[q.id] = q })

    const dimensionMap = {}
    dimensions.forEach(d => { dimensionMap[d.id] = d })

    const evaluations = []
    const scores = { self: [], peer: [], leader: [] }

    tasks.forEach(task => {
      const taskAnswers = answers.filter(a => a.task_id === task.id)
      const reviewer = reviewerMap[task.reviewer_user_id]

      const evalItem = {
        type: task.eval_type,
        reviewer_name: reviewer?.name || '未知',
        reviewer_role: reviewer?.role || '',
        status: task.status,
        answers: taskAnswers.map(a => ({
          question: questionMap[a.question_id]?.content || '',
          question_type: questionMap[a.question_id]?.type || '',
          dimension: dimensionMap[questionMap[a.question_id]?.dimension_id]?.name || '',
          score: a.score,
          comment: a.comment || ''
        }))
      }

      evaluations.push(evalItem)

      taskAnswers.forEach(a => {
        if (scores[task.eval_type]) {
          scores[task.eval_type].push(a.score)
        }
      })
    })

    const { data: user } = await supabase
      .from('profiles')
      .select('name, department, role')
      .eq('id', userId)
      .single()

    return { user, evaluations, scores }
  },

  // AI分析评价数据
  async analyzeEvaluation(userId) {
    await requireAuth()

    const config = await this.getAIConfig()
    if (!config.enabled || !config.api_url || !config.api_key) {
      throw new Error('AI功能未启用或配置不完整')
    }

    const detail = await this.getUserEvaluationDetail(userId)
    if (!detail.user) {
      throw new Error('未找到用户评价数据')
    }

    const selfAvg = detail.scores.self.length ? (detail.scores.self.reduce((a,b) => a+b, 0) / detail.scores.self.length).toFixed(1) : 0
    const peerAvg = detail.scores.peer.length ? (detail.scores.peer.reduce((a,b) => a+b, 0) / detail.scores.peer.length).toFixed(1) : 0
    const leaderAvg = detail.scores.leader.length ? (detail.scores.leader.reduce((a,b) => a+b, 0) / detail.scores.leader.length).toFixed(1) : 0

    const evalSummary = detail.evaluations.map(e => {
      const type = e.type === 'self' ? '自评' : e.type === 'peer' ? '同事' : '领导'
      const avg = e.answers.length ? (e.answers.reduce((sum, a) => sum + a.score, 0) / e.answers.length).toFixed(1) : '0'
      return `${type}(${e.reviewer_name}): ${avg}分`
    }).join('; ')

    const prompt = `你是一个专业的360度评价分析师。

【分析任务】
根据以下员工360评价数据，撰写一份专业的人事测评分析报告。

【员工信息】
姓名：${detail.user.name}，部门：${detail.user.department || '未填写'}，岗位：${detail.user.role}

【评分数据】
自评${detail.scores.self.length}题均分${selfAvg}，他评${detail.scores.peer.length}题均分${peerAvg}，领导评${detail.scores.leader.length}题均分${leaderAvg}

【达标标准】
6分为及格线

请直接输出以下格式的分析报告，不要包含任何思考过程、计算步骤或英文说明：

一、员工360评分总览
（写出各维度得分、平均分、评分差值分析）

二、各题目达标判定
（对照6分标准，逐项列出达标/未达标情况）

三、三维评价差异分析
（分析自评偏差原因、领导关注点、同事共识、隐藏问题）

四、核心优势与现存短板
（按能力层、态度层、协作层、执行力层分别总结）

五、个性化提升改进方案
（给出可执行措施、能力提升建议、团队协作优化建议、管理者辅导建议）

六、综合评级与任用建议
（给出评级结果、是否需要绩效辅导、岗位适配度，培养方向）

语言要求：全程中文，格式规范，可直接作为人事测评报告使用。
`.trim()

    const response = await fetch(`${config.api_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: '你是一个专业的360度评价分析师。你的任务是根据用户提供的评价数据，直接输出专业的人事测评分析报告。你必须严格遵守以下规则：1. 只输出最终报告，不要输出任何思考过程、计算步骤、英文说明或调试信息。2. 必须全程使用中文。3. 报告格式必须严格按照用户指定的六个部分输出。4. 语言必须专业、正式、严谨，可直接作为人事测评报告使用。禁止输出任何思考过程。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: Math.max(config.max_tokens || 4000, 2000),
        temperature: Math.min(Math.max(config.temperature || 0.7, 0), 1)
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || error.message || 'AI分析失败')
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    let content = choice?.message?.content || ''

    if (!content && choice?.message?.reasoning) {
      const reasoning = choice.message.reasoning
      const sections = reasoning.split(/(?=[一二三四五六])/)
      let extractedContent = ''
      for (const section of sections) {
        if (/[一二三四五六]、/.test(section)) {
          extractedContent += section + '\n'
        }
      }
      if (extractedContent.trim()) {
        content = extractedContent.trim()
      }
    }

    if (!content) {
      throw new Error('AI返回内容为空，请稍后重试')
    }
    
    return {
      summary: content || 'AI分析失败，请稍后重试',
      rawData: detail
    }
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

    // 四舍五入保留1位小数
    const round1 = (num) => Math.round((num || 0) * 10) / 10

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

        return answerCount > 0 ? round1(totalScore / answerCount) : null
      }

      const selfScore = calcTypeScore('self')
      const peerScore = calcTypeScore('peer')
      const leaderScore = calcTypeScore('leader')

      const calcDimScores = (dimId, evalType) => {
        const typeTasks = taskMap[evalType]
        if (!typeTasks || typeTasks.length === 0) return null
        const taskIds = typeTasks.map(t => t.id)
        const typeAnswers = allAnswers.filter(a => taskIds.includes(a.task_id))
        const key = `${dimId}_${evalType}`
        const questionIds = questionMap[key] || []
        if (questionIds.length === 0) return null
        const dimAnswers = typeAnswers.filter(a => questionIds.includes(a.question_id))
        if (dimAnswers.length === 0) return null
        if (evalType === 'peer') {
          const taskAnswerMap = {}
          dimAnswers.forEach(answer => {
            if (!taskAnswerMap[answer.task_id]) taskAnswerMap[answer.task_id] = []
            taskAnswerMap[answer.task_id].push(answer.score)
          })
          const reviewerScores = Object.values(taskAnswerMap).map(scores =>
            scores.reduce((s, a) => s + a, 0) / scores.length
          )
          return reviewerScores.reduce((s, a) => s + a, 0) / reviewerScores.length
        } else {
          return dimAnswers.reduce((s, a) => s + a.score, 0) / dimAnswers.length
        }
      }

      const dimensionScores = (dimensions || []).map(dim => {
        const self = calcDimScores(dim.id, 'self')
        const peer = calcDimScores(dim.id, 'peer')
        const leader = calcDimScores(dim.id, 'leader')
        const weighted = (self || 0) * weight.self_weight +
                         (peer || 0) * weight.peer_weight +
                         (leader || 0) * weight.leader_weight
        return { dimension_name: dim.name, score: round1(weighted) }
      })

      const dimensionTotal = dimensionScores.length > 0
        ? round1(dimensionScores.reduce((s, a) => s + a.score, 0) / dimensionScores.length)
        : null

      const hasTypeScore = selfScore !== null || peerScore !== null || leaderScore !== null
      const typeTotal = hasTypeScore
        ? round1(
            (selfScore || 0) * weight.self_weight +
            (peerScore || 0) * weight.peer_weight +
            (leaderScore || 0) * weight.leader_weight
          )
        : null

      const total = dimensionTotal !== null && dimensionTotal > 0
        ? dimensionTotal
        : (typeTotal !== null ? typeTotal : 0)

      return {
        user_id: user.id,
        user_name: user.name,
        department: user.department,
        self_score: selfScore !== null ? round1(selfScore) : null,
        peer_score: peerScore !== null ? round1(peerScore) : null,
        leader_score: leaderScore !== null ? round1(leaderScore) : null,
        total_score: total,
        dimension_scores: dimensionScores,
        dimensions: {
          self: (dimensions || []).map(dim => {
            const s = calcDimScores(dim.id, 'self')
            return { dimension_name: dim.name, score: s !== null ? round1(s) : null }
          }),
          peer: (dimensions || []).map(dim => {
            const s = calcDimScores(dim.id, 'peer')
            return { dimension_name: dim.name, score: s !== null ? round1(s) : null }
          }),
          leader: (dimensions || []).map(dim => {
            const s = calcDimScores(dim.id, 'leader')
            return { dimension_name: dim.name, score: s !== null ? round1(s) : null }
          })
        }
      }
    })

    const sortedResults = results
      .filter(r => r.total_score !== null && r.total_score !== undefined)
      .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }))
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

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSelf !== true) {
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

      const result = (self ?? 0) * weight.self_weight +
                     (peer ?? 0) * weight.peer_weight +
                     (leader ?? 0) * weight.leader_weight

      return result
    }

    // 计算综合总分：6个维度最终得分的算术平均，保留1位小数
    const dimFinalScores = dimensions.map((_, idx) => calcDimFinalScore(idx))
    const totalFinalScore = dimFinalScores.reduce((s, a) => s + a, 0) / dimensions.length

    return {
      user,
      period,
      total_score: Math.round(totalFinalScore * 10) / 10,
      dimension_scores: dimensions.map((dim, idx) => ({
        dimension_name: dim.name,
        score: Math.round(calcDimFinalScore(idx) * 10) / 10
      })),
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

    if (session.user.role === 'employee' && isOwnData && session.user.permissions?.viewSelf !== true) {
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

    // 计算各维度最终得分（加权）
    const dimensionScores = dimensions.map(dim => {
      const s = selfDims.find(d => d.dimension_name === dim.name)?.score
      const p = peerDims.find(d => d.dimension_name === dim.name)?.score
      const l = leaderDims.find(d => d.dimension_name === dim.name)?.score
      const weighted = (s || 0) * weight.self_weight +
                       (p || 0) * weight.peer_weight +
                       (l || 0) * weight.leader_weight
      return { dimension_name: dim.name, score: Math.round(weighted * 10) / 10 }
    })

    return {
      user,
      period: { year, quarter },
      self_score: selfScore !== null ? Math.round(selfScore * 10) / 10 : null,
      peer_score: peerScore !== null ? Math.round(peerScore * 10) / 10 : null,
      leader_score: leaderScore !== null ? Math.round(leaderScore * 10) / 10 : null,
      total_score: Math.round(total * 10) / 10,
      dimension_scores: dimensionScores,
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
  },

  // 导出详细计算明细
  async exportScoreDetail(year, quarter, userId = null) {
    await requireAuth()
    const session = await getLocalUser()

    if (session.user.role !== 'admin') {
      throw new Error('权限不足')
    }

    if (!userId) {
      throw new Error('请选择导出用户')
    }

    const weight = await this.getWeight()

    const [profilesData, dimensionsData, tasksData, answersData, questionsData] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('dimensions').select('*').order('sort_order'),
      supabase.from('evaluation_tasks')
        .select('*')
        .eq('target_user_id', userId)
        .eq('year', year)
        .eq('quarter', quarter)
        .in('status', ['completed', 'saved']),
      supabase.from('answers').select('*'),
      supabase.from('questions').select('*, dimensions(name, sort_order)').order('dimension_id').order('sort_order')
    ])

    const profiles = profilesData.data || []
    const dimensions = dimensionsData.data || []
    const tasks = tasksData.data || []
    const answers = answersData.data || []
    const questions = questionsData.data || []

    const profileMap = new Map(profiles.map(profile => [profile.id, profile]))
    const targetUser = profileMap.get(userId)
    if (!targetUser) {
      throw new Error('未找到用户')
    }

    const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10
    const safeText = (value) => (value === null || value === undefined ? '' : String(value))
    const uniqueValues = (values) => Array.from(new Set((values || []).filter(Boolean)))
    const normalizeScore = (value) => {
      const numeric = Number(value)
      return Number.isFinite(numeric) ? numeric : null
    }
    const typeQuestions = {
      self: questions.filter(question => question.type === 'self').sort((left, right) => (left.dimensions?.sort_order || 0) - (right.dimensions?.sort_order || 0) || (left.sort_order || 0) - (right.sort_order || 0)),
      peer: questions.filter(question => question.type === 'peer').sort((left, right) => (left.dimensions?.sort_order || 0) - (right.dimensions?.sort_order || 0) || (left.sort_order || 0) - (right.sort_order || 0)),
      leader: questions.filter(question => question.type === 'leader').sort((left, right) => (left.dimensions?.sort_order || 0) - (right.dimensions?.sort_order || 0) || (left.sort_order || 0) - (right.sort_order || 0))
    }

    const taskByType = {
      self: tasks.filter(task => task.eval_type === 'self'),
      peer: tasks.filter(task => task.eval_type === 'peer'),
      leader: tasks.filter(task => task.eval_type === 'leader')
    }

    const answerByTask = new Map()
    answers.forEach(answer => {
      if (!answerByTask.has(answer.task_id)) {
        answerByTask.set(answer.task_id, [])
      }
      answerByTask.get(answer.task_id).push(answer)
    })

    const avgFromScores = (scores) => {
      const validScores = (scores || []).filter(score => score !== null && score !== undefined && score !== '')
      if (validScores.length === 0) {
        return ''
      }
      return round1(validScores.reduce((sum, score) => sum + Number(score || 0), 0) / validScores.length)
    }

    const taskQuestionScores = (taskList, questionId) => {
      const values = []
      taskList.forEach(task => {
        const taskAnswers = answerByTask.get(task.id) || []
        const answer = taskAnswers.find(item => item.question_id === questionId)
        if (answer !== undefined) {
          const score = normalizeScore(answer.score)
          if (score !== null) {
            values.push(score)
          }
        }
      })
      return values
    }

    const taskQuestionReasons = (taskList, questionId) => {
      const reasons = []
      taskList.forEach(task => {
        const taskAnswers = answerByTask.get(task.id) || []
        const answer = taskAnswers.find(item => item.question_id === questionId)
        if (answer?.reason) {
          reasons.push(answer.reason)
        }
      })
      return uniqueValues(reasons).join('；')
    }

    const peerGroups = []
    const peerGroupMap = new Map()
    taskByType.peer.forEach(task => {
      const reviewerId = task.reviewer_user_id || task.reviewer_name || 'unknown'
      if (!peerGroupMap.has(reviewerId)) {
        peerGroupMap.set(reviewerId, [])
      }
      peerGroupMap.get(reviewerId).push(task)
    })
    Array.from(peerGroupMap.entries()).forEach(([reviewerId, reviewerTasks]) => {
      const reviewerProfile = profileMap.get(reviewerId) || {}
      peerGroups.push({
        id: reviewerId,
        name: reviewerProfile.name || reviewerTasks[0]?.reviewer_name || '未知评价人',
        tasks: reviewerTasks
      })
    })
    peerGroups.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))

    const peerReviewerQuestionScores = (reviewerTasks, questionId) => {
      const taskScores = []
      reviewerTasks.forEach(task => {
        const answersForTask = answerByTask.get(task.id) || []
        const answer = answersForTask.find(item => item.question_id === questionId)
        if (answer !== undefined) {
          taskScores.push(Number(answer.score) || 0)
        }
      })
      return avgFromScores(taskScores)
    }

    const dimensionQuestionIds = (type) => {
      const map = new Map()
      typeQuestions[type].forEach(question => {
        const name = question.dimension_name || question.dimensions?.name || ''
        if (!name) {
          return
        }
        if (!map.has(name)) {
          map.set(name, [])
        }
        map.get(name).push(question.id)
      })
      return map
    }

    const calcTypeDimensionScore = (type, dimensionName) => {
      const questionIds = dimensionQuestionIds(type).get(dimensionName) || []
      if (questionIds.length === 0) {
        return ''
      }

      if (type === 'peer') {
        const reviewerScores = peerGroups.map(group => {
          const scores = []
          group.tasks.forEach(task => {
            const answersForTask = answerByTask.get(task.id) || []
            const values = questionIds.map(questionId => {
              const answer = answersForTask.find(item => item.question_id === questionId)
              if (answer === undefined) {
                return null
              }
              const score = normalizeScore(answer.score)
              return score === null ? null : score
            }).filter(value => value !== null)
            if (values.length > 0) {
              scores.push(avgFromScores(values))
            }
          })
          return avgFromScores(scores)
        }).filter(score => score !== '')
        return avgFromScores(reviewerScores)
      }

      const typeTasks = taskByType[type]
      const taskScores = typeTasks.map(task => {
        const answersForTask = answerByTask.get(task.id) || []
        const values = questionIds.map(questionId => {
          const answer = answersForTask.find(item => item.question_id === questionId)
          if (answer === undefined) {
            return null
          }
          const score = normalizeScore(answer.score)
          return score === null ? null : score
        }).filter(value => value !== null)
        return avgFromScores(values)
      }).filter(score => score !== '')
      return avgFromScores(taskScores)
    }

    const buildOverallScore = (type) => {
      const typeTasks = taskByType[type]
      if (typeTasks.length === 0) {
        return ''
      }

      if (type === 'peer') {
        const reviewerScores = peerGroups.map(group => {
          const scores = []
          group.tasks.forEach(task => {
            const answersForTask = answerByTask.get(task.id) || []
            const values = answersForTask
              .map(answer => normalizeScore(answer.score))
              .filter(value => value !== null)
            if (values.length > 0) {
              scores.push(avgFromScores(values))
            }
          })
          return avgFromScores(scores)
        }).filter(score => score !== '')
        return avgFromScores(reviewerScores)
      }

      const scores = []
      typeTasks.forEach(task => {
        const answersForTask = answerByTask.get(task.id) || []
        const values = answersForTask
          .map(answer => normalizeScore(answer.score))
          .filter(value => value !== null)
        if (values.length > 0) {
          scores.push(avgFromScores(values))
        }
      })
      return avgFromScores(scores)
    }

    const buildWeightedTotal = (selfScore, peerScore, leaderScore) => {
      const parts = [
        { value: selfScore, weight: Number(weight.self_weight || 0) },
        { value: peerScore, weight: Number(weight.peer_weight || 0) },
        { value: leaderScore, weight: Number(weight.leader_weight || 0) }
      ].filter(part => part.value !== '' && part.value !== null && part.value !== undefined)

      if (parts.length === 0) {
        return ''
      }

      const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0)
      if (totalWeight === 0) {
        return ''
      }

      const totalScore = parts.reduce((sum, part) => sum + Number(part.value || 0) * part.weight, 0)
      return round1(totalScore / totalWeight)
    }

    const buildRows = (type) => {
      const headers = type === 'peer'
        ? ['维度', '题号', '题目', '评分标准', ...peerGroups.map(group => group.name), '平均分']
        : ['维度', '题号', '题目', '评分标准', '得分', '备注']
      const rows = typeQuestions[type].map((question, index) => {
        const dimensionName = question.dimension_name || question.dimensions?.name || ''
        if (type === 'peer') {
          const reviewerScores = peerGroups.map(group => peerReviewerQuestionScores(group.tasks, question.id))
          const avgScore = avgFromScores(reviewerScores)
          return [dimensionName, index + 1, safeText(question.content), safeText(question.scoring_criteria), ...reviewerScores, avgScore]
        }

        const taskList = taskByType[type]
        return [
          dimensionName,
          index + 1,
          safeText(question.content),
          safeText(question.scoring_criteria),
          avgFromScores(taskQuestionScores(taskList, question.id)),
          taskQuestionReasons(taskList, question.id)
        ]
      })

      return { headers, rows }
    }
    const selfSheet = buildRows('self')
    const peerSheet = buildRows('peer')
    const leaderSheet = buildRows('leader')

    const summaryDimensionNames = Array.from(new Set([
      ...Array.from(dimensionQuestionIds('self').keys()),
      ...Array.from(dimensionQuestionIds('peer').keys()),
      ...Array.from(dimensionQuestionIds('leader').keys())
    ]))

    // 按照 dimensions 的 sort_order 排序，确保与系统雷达图顺序一致
    const dimensionNameToSortOrder = new Map(dimensions.map(d => [d.name, d.sort_order]))
    summaryDimensionNames.sort((a, b) => {
      const orderA = dimensionNameToSortOrder.get(a) || 0
      const orderB = dimensionNameToSortOrder.get(b) || 0
      return orderA - orderB
    })

    const summaryRows = summaryDimensionNames.map(dimensionName => {
      const selfScore = calcTypeDimensionScore('self', dimensionName)
      const peerScore = calcTypeDimensionScore('peer', dimensionName)
      const leaderScore = calcTypeDimensionScore('leader', dimensionName)
      return [
        dimensionName,
        selfScore,
        peerScore,
        leaderScore,
        buildWeightedTotal(selfScore, peerScore, leaderScore)
      ]
    })

    if (summaryRows.length === 0) {
      const selfScore = buildOverallScore('self')
      const peerScore = buildOverallScore('peer')
      const leaderScore = buildOverallScore('leader')
      summaryRows.push(['综合', selfScore, peerScore, leaderScore, buildWeightedTotal(selfScore, peerScore, leaderScore)])
    }
    const radarRows = summaryRows
      .filter(row => row[0] !== '综合')
      .map(row => [
        targetUser.name,
        targetUser.department || '',
        row[0],
        row[1],
        row[2],
        row[3],
        row[4]
      ])

    return {
      user: {
        id: targetUser.id,
        name: targetUser.name || '',
        department: targetUser.department || ''
      },
      period: {
        year,
        quarter
      },
      weights: weight,
      sheets: {
        self: selfSheet,
        peer: peerSheet,
        leader: leaderSheet,
        summary: {
          headers: ['维度', '自评', '他评', '领导评', '综合得分'],
          rows: summaryRows,
          radarHeaders: ['员工', '部门', '维度', '自评', '他评', '领导评', '综合得分'],
          radarRows
        }
      }
    }
  }
}
export const createUserWithoutLogin = async (username, password, userData) => {
  const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: 'isolated-auth-storage'
    }
  })
  const email = `${username}@test.com`

  // 先检查 profiles 表中是否已存在该用户名
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (existingProfile) {
    throw new Error('该用户名已存在，请使用其他用户名')
  }

  // 创建 Auth 用户
  const { data: authData, error: authError } = await isolatedClient.auth.signUp({
    email: email,
    password: password
  })

  if (authError) {
    if (authError.message.includes('already') || authError.code === 'user_already_exists') {
      throw new Error('该用户名在认证系统中已存在（可能是之前的创建操作中途失败），请尝试其他用户名或联系管理员')
    }
    throw authError
  }
  if (!authData.user) throw new Error('用户创建失败')

  // 创建 profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      username: username,
      name: userData.name,
      role: userData.role,
      department: userData.department,
      permissions: JSON.parse(userData.permissions || '{"viewSelf":true,"viewPeer":false,"viewLeader":false,"viewSummary":false}'),
      password_hash: hashPassword(password)
    })

  if (profileError) {
    throw new Error('用户已创建但profile同步失败，请联系管理员清理后重试。错误: ' + profileError.message)
  }

  // 清除隔离客户端的session，防止影响当前登录状态
  await isolatedClient.auth.signOut()

  return { id: authData.user.id }
}

// 导出 getScore 函数供 MyScore.vue 使用
export const getScore = api.getScore

export { apiCache }
export default api
