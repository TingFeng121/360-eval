<template>
  <div class="change-password">
    <h2>修改密码</h2>
    <el-form :model="form" label-width="100px" class="password-form">
      <el-form-item label="当前密码" v-if="!isAdmin">
        <el-input v-model="form.oldPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="form.newPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="确认密码">
        <el-input v-model="form.confirmPassword" type="password" show-password @keyup.enter="handleSubmit" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit">确认修改</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api, { getCurrentUser } from '../supabase'

const user = getCurrentUser() || {}
const isAdmin = computed(() => user.role === 'admin')

const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const handleSubmit = async () => {
  if (!form.newPassword) return ElMessage.warning('请输入新密码')
  if (form.newPassword !== form.confirmPassword) return ElMessage.warning('两次密码输入不一致')
  if (!isAdmin.value && !form.oldPassword) return ElMessage.warning('请输入当前密码')
  if (form.newPassword.length < 6) return ElMessage.warning('密码长度至少6位')

  try {
    if (isAdmin.value) {
      api.updateUser(user.id, { password: form.newPassword })
    } else {
      api.changePassword(user.id, form.oldPassword, form.newPassword)
    }
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
/* ============================================
   页面容器
   ============================================ */
.change-password {
  background: white;
  padding: var(--padding-lg);
  border-radius: var(--border-radius-base);
  max-width: 500px;
  max-width: 100%;
  overflow-x: hidden;
}

.change-password h2 {
  margin: 0 0 var(--margin-lg) 0;
  font-size: var(--font-size-xl);
}

.password-form {
  margin-top: var(--margin-md);
  max-width: 100%;
}

/* ============================================
   响应式 - 平板 (769px - 1024px)
   ============================================ */
@media screen and (max-width: 1024px) {
  .change-password h2 {
    font-size: var(--font-size-lg);
  }
}

/* ============================================
   响应式 - 移动端 (≤768px)
   ============================================ */
@media screen and (max-width: 768px) {
  .change-password {
    padding: var(--padding-md);
  }

  .change-password h2 {
    font-size: var(--font-size-lg);
    margin-bottom: var(--margin-md);
  }

  .password-form :deep(.el-form-item__label) {
    float: none;
    text-align: left;
    padding: 0 0 var(--padding-xs) 0;
  }

  .password-form :deep(.el-form-item__content) {
    display: block;
  }
}

/* ============================================
   响应式 - 超小屏幕 (≤480px)
   ============================================ */
@media screen and (max-width: 480px) {
  .change-password {
    padding: var(--padding-base);
  }

  .change-password h2 {
    font-size: var(--font-size-md);
    margin-bottom: var(--margin-base);
  }
}
</style>
