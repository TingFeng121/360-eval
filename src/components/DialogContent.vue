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
          <span>每组设置一对被评价人和评价人，支持添加多组</span>
        </div>
        <div class="peer-groups">
          <div v-for="(group, index) in taskForm.peer.groups" :key="group.key" class="peer-group">
            <div class="group-header">
              <span class="group-label">第 {{ index + 1 }} 组</span>
              <el-button v-if="taskForm.peer.groups.length > 1" text @click="$emit('removePeerGroup', index)" class="group-remove">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="group-content">
              <el-form-item label="被评价人" class="half-item">
                <el-select v-model="group.target_id" placeholder="选择被评价人" filterable clearable @change="$emit('validatePeerGroup', group)">
                  <el-option v-for="user in getAvailableTargets(group)" :key="user.id" :label="user.name" :value="user.id">
                    <span>{{ user.name }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="评价人" class="half-item">
                <el-select v-model="group.reviewer_ids" placeholder="选择评价人" filterable multiple clearable>
                  <el-option v-for="user in (getAvailableReviewers ? getAvailableReviewers(group) : employeeList)" :key="user.id" :label="user.name" :value="user.id">
                    <span>{{ user.name }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </div>
          </div>
        </div>
        <el-button type="primary" text @click="$emit('addPeerGroup')" class="add-group-btn">
          <el-icon><Plus /></el-icon>
          添加一组被评关系
        </el-button>
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
import { InfoFilled, Close, Plus } from '@element-plus/icons-vue'

defineProps({
  period: Object,
  taskForm: Object,
  employeeList: Array,
  leaderList: Array,
  roleTagType: Function,
  roleName: Function,
  getAvailableTargets: Function,
  getAvailableReviewers: Function
})

defineEmits(['changeEvalType', 'removePeerGroup', 'validatePeerGroup', 'addPeerGroup'])
</script>