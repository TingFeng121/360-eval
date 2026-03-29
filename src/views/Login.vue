<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">360度评价管理系统</h1>
      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            :prefix-icon="User"
            size="large"
            class="login-input"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            size="large"
            show-password
            class="login-input"
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import api from '../supabase'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }

  loading.value = true
  try {
    const res = await api.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (err) {
    ElMessage.error(err.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  padding: var(--space-md);
}

.login-card {
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  padding: var(--space-xl);
  width: 100%;
  max-width: 380px;
}

.login-title {
  text-align: center;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-xl);
  font-family: var(--font-family);
}

.login-input {
  width: 100%;
}

.login-input :deep(.el-input__wrapper) {
  background: #f5f5f5;
  border-radius: var(--radius-sm);
  box-shadow: none;
  padding: 12px 16px;
  height: 48px;
}

.login-input :deep(.el-input__wrapper:hover) {
  box-shadow: none;
}

.login-input :deep(.el-input__wrapper.is-focus) {
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.login-input :deep(.el-input__inner) {
  font-size: var(--font-sm);
}

.login-input :deep(.el-input__prefix) {
  color: var(--color-text-secondary);
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: var(--font-md);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.login-btn:hover {
  background: #1e4fd8;
  border-color: #1e4fd8;
}

@media (max-width: 768px) {
  .login-card {
    padding: var(--space-lg);
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  }

  .login-title {
    font-size: var(--font-md);
    margin-bottom: var(--space-lg);
  }

  .login-btn {
    height: 44px;
    font-size: var(--font-sm);
  }
}
</style>
