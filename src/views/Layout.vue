<template>
  <div class="layout" :class="{ 'sidebar-collapsed': sidebarCollapsed, 'sidebar-open': sidebarOpen && isMobile }">
    <div v-if="sidebarOpen && isMobile" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <header class="top-header">
      <div class="header-left">
        <button class="hamburger-btn" @click="toggleSidebar">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
        <h1 class="system-title">
          <span class="title-icon">360</span>
          <span class="title-text">评价系统</span>
        </h1>
      </div>

      <div class="header-right">
        <el-dropdown trigger="click" @command="handleCommand">
          <div class="user-avatar">
            <span class="avatar-text">{{ userInitials }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <div class="dropdown-header">
                <span class="user-name">{{ user.name }}</span>
                <el-tag :type="roleType" size="small">{{ roleName }}</el-tag>
              </div>
              <el-dropdown-item command="password">
                <el-icon><Lock /></el-icon>修改密码
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <aside class="sidebar" :class="{ 'sidebar-active': sidebarOpen && isMobile }">
      <div class="sidebar-header">
        <div class="logo-icon">
          <span class="logo-text">360</span>
        </div>
        <div class="logo-info">
          <span class="logo-text-full">360度评价</span>
          <span class="logo-subtitle">管理系统</span>
        </div>
      </div>

      <nav class="nav">
        <router-link to="/" class="nav-item" exact @click="closeSidebar">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </router-link>
        <router-link to="/tasks" class="nav-item" @click="closeSidebar">
          <el-icon><Document /></el-icon>
          <span>评价任务</span>
        </router-link>
        <router-link to="/my-score" class="nav-item" v-if="user.role === 'employee'" @click="closeSidebar">
          <el-icon><DataAnalysis /></el-icon>
          <span>我的评分</span>
        </router-link>
        <router-link to="/questions" class="nav-item" v-if="user.role === 'admin' || user.role === 'guest'" @click="closeSidebar">
          <el-icon><EditPen /></el-icon>
          <span>题目管理</span>
        </router-link>
        <router-link to="/summary" class="nav-item" v-if="user.role === 'admin' || user.role === 'guest'" @click="closeSidebar">
          <el-icon><DataLine /></el-icon>
          <span>数据汇总</span>
        </router-link>
        <router-link to="/users" class="nav-item" v-if="user.role === 'admin' || user.role === 'guest'" @click="closeSidebar">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </router-link>
        <router-link to="/system" class="nav-item" v-if="user.role === 'admin' || user.role === 'guest'" @click="closeSidebar">
          <el-icon><Tools /></el-icon>
          <span>系统管理</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="period-select">
          <el-select v-model="currentQuarter" @change="handlePeriodChange" size="default" placeholder="季度">
            <el-option label="Q1" :value="1" />
            <el-option label="Q2" :value="2" />
            <el-option label="Q3" :value="3" />
            <el-option label="Q4" :value="4" />
          </el-select>
          <el-select v-model="currentPeriod" @change="handlePeriodChange" size="default" placeholder="年份">
            <el-option v-for="y in years" :key="y" :label="`${y}年`" :value="y" />
          </el-select>
        </div>
      </div>
    </aside>

    <main class="main">
      <div class="content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <nav class="bottom-nav">
      <router-link to="/" class="bottom-nav-item" exact>
        <el-icon><HomeFilled /></el-icon>
        <span>首页</span>
      </router-link>
      <router-link to="/tasks" class="bottom-nav-item">
        <el-icon><Document /></el-icon>
        <span>评价</span>
      </router-link>
      <router-link to="/summary" class="bottom-nav-item" v-if="user.role === 'admin' || user.role === 'guest'">
        <el-icon><DataLine /></el-icon>
        <span>数据</span>
      </router-link>
      <router-link to="/users" class="bottom-nav-item" v-if="user.role === 'admin' || user.role === 'guest'">
        <el-icon><User /></el-icon>
        <span>用户</span>
      </router-link>
      <router-link to="/my-score" class="bottom-nav-item">
        <el-icon><UserFilled /></el-icon>
        <span>我的</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  HomeFilled, Document, Setting, User, DataAnalysis, DataLine,
  EditPen, Tools, Lock, SwitchButton, UserFilled
} from '@element-plus/icons-vue'
import api, { getCurrentUser } from '../supabase'

const router = useRouter()
const route = useRoute()
const user = ref({})
const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)
const isMobile = ref(false)

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
const currentPeriod = ref(currentYear)
const currentQuarter = ref(Math.ceil((new Date().getMonth() + 1) / 3))

const pageTitles = {
  '/': '首页',
  '/my-score': '我的评分',
  '/tasks': '评价任务',
  '/weight': '权重配置',
  '/questions': '题目管理',
  '/summary': '数据汇总',
  '/users': '用户管理',
  '/system': '系统管理',
  '/password': '修改密码'
}

const pageTitle = computed(() => {
  const path = route.path
  for (const [key, value] of Object.entries(pageTitles)) {
    if (path === key || (key !== '/' && path.startsWith(key))) {
      return value
    }
  }
  return '360度评价系统'
})

const userInitials = computed(() => {
  if (!user.value.name) return '?'
  return user.value.name.slice(0, 1).toUpperCase()
})

const roleName = computed(() => {
  const map = { admin: '管理员', leader: '领导', employee: '员工', guest: '访客' }
  return map[user.value.role] || '员工'
})

const roleType = computed(() => {
  const map = { admin: 'danger', leader: 'warning', employee: 'success' }
  return map[user.value.role] || 'info'
})

const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = () => {
  if (isMobile.value) {
    sidebarOpen.value = false
  }
}

const handleCommand = (command) => {
  if (command === 'logout') {
    handleLogout()
  } else if (command === 'password') {
    router.push('/password')
  }
}

const handlePeriodChange = async () => {
  try {
    await api.setCurrentPeriod(currentPeriod.value, currentQuarter.value)
    ElMessage.success(`已切换到 ${currentPeriod.value}年第${currentQuarter.value}季度`)
    window.location.reload()
  } catch (err) {
    ElMessage.error(err.message || '切换失败')
  }
}

const handleLogout = async () => {
  await api.logout()
  router.push('/login')
}

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
  if (isMobile.value) {
    sidebarOpen.value = false
  } else {
    sidebarOpen.value = true
  }
}

onMounted(async () => {
  handleResize()
  window.addEventListener('resize', handleResize)

  const currentUser = await getCurrentUser()
  user.value = currentUser || {}

  const period = await api.getCurrentPeriod()
  currentPeriod.value = period.year
  currentQuarter.value = period.quarter
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 320px;
  width: 100vw;
  background: var(--bg-color);
  overflow-x: hidden;
}

.top-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-lg);
  z-index: 1000;
  box-shadow: 0 1px 0 var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--padding-md);
}

.hamburger-btn {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  background: transparent;
  border: none;
  cursor: pointer;
  gap: 5px;
  transition: all var(--transition-fast);
}

.hamburger-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.hamburger-btn:active {
  transform: scale(0.95);
}

.hamburger-line {
  width: 22px;
  height: 2px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 2px;
  transition: all var(--transition-fast);
}

.sidebar-open .hamburger-btn .hamburger-line:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}

.sidebar-open .hamburger-btn .hamburger-line:nth-child(2) {
  opacity: 0;
}

.sidebar-open .hamburger-btn .hamburger-line:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

.system-title {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  margin: 0;
}

.title-icon {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  color: #fff;
}

.title-text {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
}

.user-avatar {
  display: flex;
  align-items: center;
  gap: var(--padding-xs);
  cursor: pointer;
  padding: var(--padding-xs);
  border-radius: var(--border-radius-base);
  transition: all var(--transition-fast);
}

.user-avatar:hover {
  background: rgba(255, 255, 255, 0.08);
}

.avatar-text {
  width: 32px;
  height: 32px;
  background: var(--color-primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  font-weight: 600;
  font-size: var(--font-sm);
}

.dropdown-header {
  padding: var(--padding-md);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: var(--padding-xs);
}

.dropdown-header .user-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: var(--font-size-base);
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: var(--padding-sm);
  font-size: var(--font-size-sm);
  padding: var(--padding-sm) var(--padding-md);
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--color-sidebar);
  display: flex;
  flex-direction: column;
  z-index: 1001;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-active {
  transform: translateX(0);
}

.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.sidebar-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-md);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
}

.logo-info {
  display: none;
}

.nav {
  flex: 1;
  padding: var(--padding-sm) 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0 var(--space-md);
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: all var(--transition-fast);
  cursor: pointer;
  margin: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  height: 44px;
  position: relative;
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: rgba(255, 255, 255, 0.85);
}

.nav-item.router-link-active.router-link-exact-active {
  background: var(--color-sidebar-active);
  color: var(--color-primary);
}

.nav-item.router-link-active.router-link-exact-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}

.nav-item .el-icon {
  font-size: 20px;
}

.nav-item span {
  display: inline;
  margin-left: var(--space-sm);
  white-space: nowrap;
}

.nav-divider {
  padding: var(--padding-md) var(--padding-lg) var(--padding-xs);
  margin-top: var(--padding-sm);
}

.nav-divider span {
  color: rgba(255, 255, 255, 0.35);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.nav-upload {
  display: block;
}

.sidebar-footer {
  padding: var(--space-md);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--color-sidebar);
  flex-shrink: 0;
}

.period-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
}

.period-select :deep(.el-select) {
  width: 100%;
}

.period-select :deep(.el-select__wrapper) {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
  border-radius: var(--radius-sm) !important;
}

.period-select :deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.7) !important;
  text-align: center;
  font-size: 12px;
}

.period-select :deep(.el-select__caret) {
  color: rgba(255, 255, 255, 0.5) !important;
}

.period-select :deep(.el-select .el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}

.period-select :deep(.el-select .el-select__caret) {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
}

.main {
  flex: 1;
  flex-shrink: 0;
  margin-top: var(--header-height);
  margin-left: var(--sidebar-width);
  width: calc(100% - var(--sidebar-width));
  min-height: calc(100vh - var(--header-height));
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-x: hidden;
  box-sizing: border-box;
}

.content {
  flex: 1;
  flex-shrink: 0;
  padding: var(--padding-lg);
  min-height: calc(100vh - var(--header-height));
  width: 100%;
  overflow-x: auto;
}

.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottom-nav-height);
  background: var(--card-bg);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
  z-index: 999;
  justify-content: space-around;
  align-items: center;
  padding: 0 var(--padding-xs);
  border-top: 1px solid var(--border-color);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--padding-xs);
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 10px;
  transition: all var(--transition-fast);
  min-width: 60px;
  min-height: 50px;
  border-radius: var(--border-radius-base);
}

.bottom-nav-item .el-icon {
  font-size: 22px;
  margin-bottom: 2px;
}

.bottom-nav-item.router-link-exact-active {
  color: var(--color-primary);
}

.bottom-nav-item.router-link-exact-active .el-icon {
  transform: scale(1.1);
}

.bottom-nav-item:active {
  transform: scale(0.95);
  background: var(--info-bg);
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media screen and (max-width: 1200px) {
  :root {
    --sidebar-width: 130px;
  }

  .title-text {
    display: none;
  }

  .logo-subtitle {
    display: none;
  }
}

@media screen and (max-width: 768px) {
  .hamburger-btn {
    display: flex;
  }

  .sidebar {
    width: 280px;
    transform: translateX(-100%);
  }

  .sidebar-overlay {
    display: block;
  }

  .main {
    margin-left: 0;
    width: 100vw;
  }

  .content {
    padding: var(--padding-base);
    padding-bottom: calc(var(--bottom-nav-height) + var(--padding-lg));
  }

  .bottom-nav {
    display: flex;
    animation: slideUp 0.3s ease;
  }

  .bottom-nav::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: var(--border-color);
    border-radius: 2px;
    top: 6px;
  }

  .period-select {
    display: none;
  }

  .system-title {
    flex-direction: row;
  }

  .title-icon {
    padding: var(--padding-xs);
  }

  .title-text {
    display: inline;
    font-size: var(--font-size-base);
  }

  .avatar-text {
    width: 32px;
    height: 32px;
    font-size: var(--font-size-sm);
  }

  .nav-item {
    padding: var(--padding-md);
  }

  .nav-item .el-icon {
    font-size: 22px;
    width: 28px;
  }

  .nav-item span {
    font-size: var(--font-size-base);
  }
}

@media screen and (max-width: 480px) {
  .top-header {
    padding: 0 var(--padding-sm);
  }

  .header-left {
    gap: var(--padding-sm);
  }

  .title-icon {
    display: none;
  }

  .title-text {
    font-size: var(--font-size-sm);
  }

  .content {
    padding: var(--padding-sm);
    padding-bottom: calc(var(--bottom-nav-height) + var(--padding-base));
  }

  .bottom-nav-item {
    min-width: 50px;
    font-size: 9px;
  }

  .bottom-nav-item .el-icon {
    font-size: 20px;
  }
}
</style>
