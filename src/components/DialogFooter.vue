<template>
  <div class="dialog-footer">
    <el-button @click="$emit('cancel')" class="btn-cancel">取消</el-button>
    <el-button @click="$emit('confirm')" class="btn-confirm" :disabled="disabled">
      <el-icon><Check /></el-icon>
      确认创建
    </el-button>
  </div>
</template>

<script setup>
import { Check } from '@element-plus/icons-vue'

defineProps({
  disabled: Boolean
})

defineEmits(['cancel', 'confirm'])
</script>