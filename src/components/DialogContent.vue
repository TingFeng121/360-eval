<template>
  <div class="dialog-tip">
    <el-icon class="tip-icon"><InfoFilled /></el-icon>
    <span>将为 {{ period.year }}年第{{ period.quarter }}季度创建评价任务</span>
  </div>

  <el-form :model="taskForm" label-position="top" class="task-form">
    <el-form-item label="评价类型">
      <el-select v-model="taskForm.eval_type" placeholder="请选择评价类型" @change="$emit('changeEvalType')" class="type-select">
        <el-option label="自评" value="self">
          <div class="eval-type-option">
            <el-tag size="small" type="info">自评</el-tag>
            <span>员工自我评价</span>
          </div>
        </el-option>
        <el-option label="他评" value="peer">
          <div class="eval-type-option">
            <el-tag size="small" type="success">他评</el-tag>
            <span>同事间互相评价</span>
          </div>
        </el-option>
        <el-option label="领导评" value="leader">
          <div class="eval-type-option">
            <el-tag size="small" type="warning">领导评</el-tag>
            <span>上级领导评价</span>
          </div>
        </el-option>
      </el-select>
    </el-form-item>

    <transition name="fade-slide">
      <div v-if="taskForm.eval_type === 'self'" class="form-section">
        <div class="section-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>被评价人将对自己填写自评问卷</span>
        </div>
        <el-form-item label="被评价人">
          <el-select v-model="taskForm.self.target_ids" placeholder="请选择被评价人" filterable multiple clearable class="full-select">
            <el-option v-for="user in employeeList" :key="user.id" :label="user.name" :value="user.id">
              <div class="user-option">
                <span>{{ user.name }}</span>
                <el-tag size="small" :type="roleTagType(user.role)">{{ roleName(user.role) }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </div>
    </transition>

    <transition name="fade-slide">
      <div v-if="taskForm.eval_type === 'peer'" class="form-section">
        <div class="section-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>选择一个评价人对多个被评价人进行批量评价</span>
        </div>
        <el-form-item label="评价人">
          <el-select v-model="taskForm.peer.reviewer_id" placeholder="选择评价人" filterable clearable class="full-select">
            <el-option v-for="user in employeeList" :key="user.id" :label="user.name" :value="user.id">
              <div class="user-option">
                <span>{{ user.name }}</span>
                <el-tag size="small" :type="roleTagType(user.role)">{{ roleName(user.role) }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="被评价人">
          <el-select v-model="taskForm.peer.target_ids" placeholder="选择被评价人（可多选）" filterable multiple clearable class="full-select">
            <el-option v-for="user in availablePeerTargets" :key="user.id" :label="user.name" :value="user.id">
              <div class="user-option">
                <span>{{ user.name }}</span>
                <el-tag size="small" :type="roleTagType(user.role)">{{ roleName(user.role) }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </div>
    </transition>

    <transition name="fade-slide">
      <div v-if="taskForm.eval_type === 'leader'" class="form-section">
        <div class="section-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>该领导将对所选成员逐一完成评价</span>
        </div>
        <el-form-item label="评价人（领导）" class="half-item">
          <el-select v-model="taskForm.leader.reviewer_id" placeholder="选择评价人" filterable clearable>
            <el-option v-for="user in leaderList" :key="user.id" :label="user.name" :value="user.id">
              <div class="user-option">
                <span>{{ user.name }}</span>
                <el-tag size="small" :type="roleTagType(user.role)">{{ roleName(user.role) }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="被评价人">
          <el-select v-model="taskForm.leader.target_ids" placeholder="选择被评价人" filterable multiple clearable>
            <el-option v-for="user in employeeList" :key="user.id" :label="user.name" :value="user.id">
              <div class="user-option">
                <span>{{ user.name }}</span>
                <el-tag size="small" :type="roleTagType(user.role)">{{ roleName(user.role) }}</el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </div>
    </transition>
  </el-form>
</template>

<script setup>
import { computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  period: Object,
  taskForm: Object,
  employeeList: Array,
  leaderList: Array,
  roleTagType: Function,
  roleName: Function
})

defineEmits(['changeEvalType'])

const availablePeerTargets = computed(() => {
  return props.employeeList.filter(u => u.id !== props.taskForm.peer.reviewer_id)
})
</script>