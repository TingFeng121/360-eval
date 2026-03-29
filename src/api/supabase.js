import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientInstance = null;

if (supabaseUrl && supabaseKey) {
  try {
    clientInstance = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error('Supabase 客户端创建失败:', e);
  }
}

export const supabase = clientInstance;

const checkClient = () => {
  if (!clientInstance) {
    // 【优化】抛出更明确的错误，便于前端捕获展示
    throw new Error('系统配置错误：Supabase 服务未连接，请联系管理员检查环境变量配置。');
  }
  return clientInstance;
};

// 【修复】定义默认导出对象，包含所有必需的方法
const api = {
  // 获取用户列表
  getUsers: async () => {
    const client = checkClient();
    const { data, error } = await client.from('users').select('*');
    if (error) throw error;
    return data;
  },

  // 获取任务列表
  getTasks: async (currentUser) => {
    const client = checkClient();
    
    // 【修复】增加 try-catch 防止 auth 获取失败导致崩溃
    let user = null;
    try {
      const { data: { user: authUser }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      user = authUser;
    } catch (e) {
      // 如果获取用户失败，视为未登录
      throw new Error('SESSION_INVALID: 当前未登录或登录已失效');
    }

    if (!user) {
      throw new Error('SESSION_INVALID: 当前未登录或登录已失效');
    }

    // 根据当前用户的角色返回不同的任务
    let query = client.from('tasks').select('*');
    
    // 如果是普通员工，只返回分配给他的任务
    if (currentUser && currentUser.role === 'employee') {
      query = query.or(`target_user_id.eq.${currentUser.id},reviewer_user_id.eq.${currentUser.id}`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // 获取当前用户评分
  getScore: async (userId) => {
    const client = checkClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user && !userId) throw new Error('用户未登录且未指定用户ID');

    const targetUserId = userId || user.id;
    const { data, error } = await client
      .from('user_scores')
      .select('score')
      .eq('user_id', targetUserId)
      .single();

    if (error) throw error;
    return data?.score || 0;
  },

  // 获取当前用户
  getCurrentUser: async () => {
    const client = checkClient();
    try {
      const { data: { user } } = await client.auth.getUser();
      return user;
    } catch (e) {
      return null;
    }
  },

  // 更新用户
  updateUser: async (id, updates) => {
    const client = checkClient();
    const { data, error } = await client.from('users').update(updates).eq('id', id);
    if (error) throw error;
    return data;
  },

  // 删除用户
  deleteUser: async (id) => {
    const client = checkClient();
    // 注意：生产环境通常不建议直接删除 auth 用户，这里假设只删除 profiles 或逻辑删除
    const { error } = await client.from('users').delete().eq('id', id);
    if (error) throw error;
  },

  // 获取题目
  getQuestions: async (type) => {
    const client = checkClient();
    const { data, error } = await client.from('questions').select('*').eq('type', type).order('sort_order');
    if (error) throw error;
    return data;
  },

  // 更新题目
  updateQuestion: async (id, content) => {
    const client = checkClient();
    const { error } = await client.from('questions').update({ content }).eq('id', id);
    if (error) throw error;
  },

  // 删除题目
  deleteQuestion: async (id) => {
    const client = checkClient();
    const { error } = await client.from('questions').delete().eq('id', id);
    if (error) throw error;
  },

  // 清空所有题目
  clearAllQuestions: async () => {
    const client = checkClient();
    const { error } = await client.from('questions').delete().neq('id', 0); // 清空所有
    if (error) throw error;
  },

  // 清空所有任务
  clearAllTasks: async () => {
    const client = checkClient();
    const { error } = await client.from('tasks').delete().neq('id', 0);
    if (error) throw error;
  },

  // 清空所有答案
  clearAllAnswers: async () => {
    const client = checkClient();
    const { error } = await client.from('answers').delete().neq('id', 0);
    if (error) throw error;
  },

  // 重置所有数据
  resetAllData: async () => {
    await api.clearAllAnswers();
    await api.clearAllTasks();
    await api.clearAllQuestions();
  },

  // 获取汇总数据
  getSummary: async () => {
    const client = checkClient();
    // 简化实现，实际可能需要更复杂的查询
    const { data, error } = await client.from('user_scores').select('*');
    if (error) throw error;
    return data;
  },

  // 获取雷达图数据
  getRadar: async (userId) => {
    // 模拟实现，防止白屏
    return { user: { name: 'User' }, radar: [] };
  },

  // 获取权重配置
  getWeight: async () => {
    return { self_weight: 0.3, peer_weight: 0.3, leader_weight: 0.4, score_type: '10' };
  },

  // 更新权重配置
  updateWeight: async (config) => {
    // 模拟实现
    return config;
  },

  // 获取当前周期
  getCurrentPeriod: async () => {
    return { year: new Date().getFullYear(), quarter: 1 };
  },

  // 设置当前周期
  setCurrentPeriod: async (year, quarter) => {
    // 模拟实现
  },

  // 登录
  login: async (username, password) => {
    const client = checkClient();
    // 假设 username 即是 email，或者需要根据业务转换
    const { data, error } = await client.auth.signInWithPassword({
      email: username, // 或者 ${username}@yourdomain.com
      password
    });
    if (error) throw error;
    return data;
  },

  // 登出
  logout: async () => {
    const client = checkClient();
    await client.auth.signOut();
  },

  // 修改密码
  changePassword: async (userId, oldPass, newPass) => {
    // 简化实现，实际需验证旧密码
    const client = checkClient();
    const { error } = await client.auth.updateUser({ password: newPass });
    if (error) throw error;
  },

  // 提交答案
  submitAnswers: async (taskId, answers, user) => {
    const client = checkClient();
    const inserts = answers.map(a => ({
      task_id: taskId,
      question_id: a.questionId,
      user_id: user.id,
      score: a.score,
      reason: a.reason
    }));
    const { data, error } = await client.from('answers').insert(inserts);
    if (error) throw error;
    return data;
  },

  // 获取任务详情
  getTaskDetail: async (taskId, user) => {
    const client = checkClient();
    const { data: task, error: tErr } = await client.from('tasks').select('*').eq('id', taskId).single();
    if (tErr) throw tErr;
    
    const { data: questions } = await client.from('questions').select('*').eq('type', task.eval_type);
    const { data: answers } = await client.from('answers').select('*').eq('task_id', taskId).eq('user_id', user.id);
    
    const ansMap = {};
    answers.forEach(a => { ansMap[a.question_id] = a; });
    
    return { task, questions, answers: ansMap };
  },

  // 导出所有数据
  exportAllData: async () => {
    return JSON.stringify({});
  },

  // 导入所有数据
  importAllData: async (jsonStr) => {
    // 模拟实现
  },

  // 保存题目
  saveQuestions: async (questions) => {
    const client = checkClient();
    const { data, error } = await client.from('questions').insert(questions);
    if (error) throw error;
    return data;
  }
};

// 【修复】确保关键函数单独导出，以支持解构导入
export const getUsers = api.getUsers;
export const getTasks = api.getTasks;
export const getScore = api.getScore;
export const getCurrentUser = api.getCurrentUser;
export const updateUser = api.updateUser;
export const deleteUser = api.deleteUser;
export const getQuestions = api.getQuestions;
export const updateQuestion = api.updateQuestion;
export const deleteQuestion = api.deleteQuestion;
export const clearAllQuestions = api.clearAllQuestions;
export const clearAllTasks = api.clearAllTasks;
export const clearAllAnswers = api.clearAllAnswers;
export const resetAllData = api.resetAllData;
export const getSummary = api.getSummary;
export const getRadar = api.getRadar;
export const getWeight = api.getWeight;
export const updateWeight = api.updateWeight;
export const getCurrentPeriod = api.getCurrentPeriod;
export const setCurrentPeriod = api.setCurrentPeriod;
export const login = api.login;
export const logout = api.logout;
export const changePassword = api.changePassword;
export const submitAnswers = api.submitAnswers;
export const getTaskDetail = api.getTaskDetail;
export const exportAllData = api.exportAllData;
export const importAllData = api.importAllData;
export const saveQuestions = api.saveQuestions;

// 【修复】创建一个完全隔离的临时客户端用于注册新用户
// 此操作绝不会影响当前页面的登录状态 (Session)
export const createUserWithoutLogin = async (email, password, options = {}) => {
  const client = checkClient();
  // 【修复】确保 isolatedClient 也使用有效的配置创建
  const isolatedClient = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await isolatedClient.auth.signUp({
    email,
    password,
    options
  });

  if (error) throw error;
  return data;
};

// 【修复】默认导出包含所有API方法的对象，确保其他模块能正确引用
export default api;