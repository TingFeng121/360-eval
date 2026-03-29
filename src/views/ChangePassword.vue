<template>
  <div class="change-password">
    <div class="change-password-card">
      <h2>修改密码</h2>
      <el-form :model="form" label-position="top" class="password-form">
        <el-form-item label="当前密码">
          <el-input v-model="form.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.newPassword" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirmPassword" type="password" show-password placeholder="请再次输入新密码" @keyup.enter="handleSubmit" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" class="submit-btn">确认修改</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import api, { getCurrentUser } from '../supabase'

const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const handleSubmit = async () => {
  if (!form.oldPassword) return ElMessage.warning('请输入当前密码')
  if (!form.newPassword) return ElMessage.warning('请输入新密码')
  if (form.newPassword !== form.confirmPassword) return ElMessage.warning('两次密码输入不一致')
  if (form.newPassword.length < 6) return ElMessage.warning('密码长度至少6位')

  try {
    const user = await getCurrentUser()
    if (!user) return ElMessage.error('用户未登录')

    await api.changePassword(user.id, form.oldPassword, form.newPassword)
    ElMessage.success('密码修改成功，请重新登录')
    setTimeout(() => {
      api.logout()
      window.location.href = '/login'
    }, 1500)
  } catch (err) {
    ElMessage.error(err.message || '修改失败')
  }
}
</script>

<style scoped>
.change-password {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: var(--padding-md);
}

.change-password-card {
  background: white;
  border-radius: var(--border-radius-lg);
  padding: var(--padding-xl);
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.change-password h2 {
  margin: 0 0 var(--margin-xl) 0;
  font-size: var(--font-size-xl);
  text-align: center;
  color: var(--text-primary);
}

.password-form {
  margin-top: var(--margin-lg);
}

.password-form :deep(.el-form-item) {
  margin-bottom: var(--margin-lg);
}

.password-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-regular);
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  margin-top: var(--margin-md);
}

@media screen and (max-width: 480px) {
  .change-password-card {
    padding: var(--padding-lg);
    border-radius: var(--border-radius-base);
  }

  .change-password h2 {
    font-size: var(--font-size-lg);
  }

  .submit-btn {
    height: 40px;
    font-size: 15px;
  }
}
</style>
