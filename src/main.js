import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/index.css'
import { supabase } from './supabase'
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
      { path: 'system', component: SystemManage, meta: { role: 'admin' } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  // 检查 Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (to.meta.requiresAuth && !session) {
    next('/login')
  } else if (to.meta.role) {
    // 获取用户 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
      
    if (!profile || profile.role !== to.meta.role) {
      next('/')
    } else {
      next()
    }
  } else {
    next()
  }
})

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
