import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/index.css'
import { supabase } from './supabase'
import { apiCache } from './cache'
import App from './App.vue'
import Login from './views/Login.vue'
import Layout from './views/Layout.vue'
import Dashboard from './views/Dashboard.vue'
import UserManage from './views/UserManage.vue'
import TaskManage from './views/TaskManage.vue'
import Evaluation from './views/Evaluation.vue'
import WeightConfig from './views/WeightConfig.vue'
import Summary from './views/Summary.vue'
import MyScore from './views/MyScore.vue'
import QuestionManage from './views/QuestionManage.vue'
import ChangePassword from './views/ChangePassword.vue'
import SystemManage from './views/SystemManage.vue'
import BatchEvaluation from './views/BatchEvaluation.vue'

const routes = [
  { path: '/login', component: Login },
  { 
    path: '/', 
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      { path: '', component: Dashboard },
      { path: 'users', component: UserManage, meta: { role: 'admin' } },
      { path: 'tasks', component: TaskManage },
      { path: 'evaluation/:taskId', component: Evaluation },
      { path: 'weight', component: WeightConfig, meta: { role: 'admin' } },
      { path: 'summary', component: Summary, meta: { role: 'admin' } },
      { path: 'my-score', component: MyScore },
      { path: 'questions', component: QuestionManage, meta: { role: 'admin' } },
      { path: 'password', component: ChangePassword },
      { path: 'system', component: SystemManage, meta: { role: 'admin' } },
      { path: 'batch-evaluation', component: BatchEvaluation }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 用户角色缓存（避免每次路由都查数据库）
let userRoleCache = new Map()

router.beforeEach(async (to, from, next) => {
  // 检查 Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  
  // 同时检查缓存中的用户信息（支持临时token登录）
  const cachedUser = apiCache.getUser()

  // 如果需要认证但既没有session也没有缓存用户，重定向到登录页
  if (to.meta.requiresAuth && !session && !cachedUser) {
    next('/login')
  } else if (to.meta.role) {
    // 获取用户ID（优先从session，其次从缓存）
    const userId = session?.user?.id || cachedUser?.id
    let userRole = userRoleCache.get(userId)

    // 如果缓存没有，从数据库获取并存入
    if (!userRole) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (!profile) {
        next('/')
        return
      }
      userRole = profile.role
      userRoleCache.set(userId, userRole)
    }

    if (userRole !== to.meta.role) {
      next('/')
    } else {
      next()
    }
  } else {
    next()
  }
})

// 登出时清除角色缓存
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    userRoleCache.clear()
  }
})

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
