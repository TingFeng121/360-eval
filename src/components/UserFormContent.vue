<template>
  <div class="user-form">
    <el-form :model="form" label-position="top" class="form-content">
      <el-form-item label="账号" required>
        <el-input
          v-model="form.username"
          placeholder="请输入账号"
          :disabled="isEdit"
          size="large"
        >
          <template #prefix>
            <el-icon><User /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="密码" :required="!isEdit">
        <el-input
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
          size="large"
          show-password
        >
          <template #prefix>
            <el-icon><Lock /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="姓名" required>
        <el-input
          v-model="form.name"
          placeholder="请输入姓名"
          size="large"
        >
          <template #prefix>
            <el-icon><Avatar /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="部门">
        <el-input
          v-model="form.department"
          placeholder="请输入部门"
          size="large"
        >
          <template #prefix>
            <el-icon><OfficeBuilding /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="角色" required>
        <el-select v-model="form.role" placeholder="请选择角色" size="large" class="full-select">
          <el-option label="员工" value="employee">
            <div class="role-option">
              <el-tag size="small" type="success">员工</el-tag>
              <span>普通员工账号</span>
            </div>
          </el-option>
          <el-option label="领导" value="leader">
            <div class="role-option">
              <el-tag size="small" type="warning">领导</el-tag>
              <span>部门领导账号</span>
            </div>
          </el-option>
          <el-option label="管理员" value="admin">
            <div class="role-option">
              <el-tag size="small" type="danger">管理员</el-tag>
              <span>系统管理员账号</span>
            </div>
          </el-option>
          <el-option label="访客" value="guest">
            <div class="role-option">
              <el-tag size="small" type="info">访客</el-tag>
              <span>访客账号</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { User, Lock, Avatar, OfficeBuilding } from '@element-plus/icons-vue'

defineProps({
  isEdit: Boolean,
  form: {
    type: Object,
    required: true
  }
})

const showPassword = ref(false)
</script>

<style scoped>
.user-form {
  padding: 0 var(--space-xs);
}

.form-content :deep(.el-form-item) {
  margin-bottom: var(--space-md);
}

.form-content :deep(.el-form-item__label) {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  padding-bottom: var(--space-xs);
}

.form-content :deep(.el-input__wrapper) {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  box-shadow: none;
  padding: 12px 16px;
  height: 48px;
}

.form-content :deep(.el-input__wrapper:hover) {
  box-shadow: none;
}

.form-content :deep(.el-input__wrapper.is-focus) {
  background: #ffffff;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.form-content :deep(.el-input__inner) {
  font-size: var(--font-sm);
}

.form-content :deep(.el-input__prefix) {
  color: var(--color-text-secondary);
  margin-right: var(--space-sm);
}

.full-select {
  width: 100%;
}

.full-select :deep(.el-input__wrapper) {
  height: 48px;
  line-height: 48px;
}

.full-select :deep(.el-select__caret) {
  color: var(--color-text-secondary);
}

.role-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

@media (max-width: 768px) {
  .user-form {
    padding: 0;
  }
}
</style>
