<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="modelValue"
        class="bottom-sheet-overlay"
        @click="handleOverlayClick"
      />
    </Transition>

    <Transition name="sheet">
      <div v-if="modelValue" class="bottom-sheet">
        <div class="sheet-handle" />

        <div class="sheet-header" v-if="title">
          <span class="sheet-title">{{ title }}</span>
          <button class="sheet-close" @click="close">✕</button>
        </div>

        <div class="sheet-body">
          <slot />
        </div>

        <div class="sheet-footer" v-if="$slots.footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: Boolean,
  title: String,
  closeOnOverlay: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue'])
const close = () => emit('update:modelValue', false)
const handleOverlayClick = () => {
  if (props.closeOnOverlay) close()
}
</script>

<style scoped>
.bottom-sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26,26,46,0.5);
  backdrop-filter: blur(2px);
  z-index: 1000;
}

.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 16px 16px 0 0;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-handle {
  width: 36px;
  height: 4px;
  background: #e0ddd6;
  border-radius: 2px;
  margin: 12px auto 0;
  flex-shrink: 0;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  flex-shrink: 0;
}

.sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.sheet-close {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0,0,0,0.06);
  border-radius: 50%;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  -webkit-overflow-scrolling: touch;
}

.sheet-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.sheet-footer :deep(.el-button) {
  width: 100%;
  height: 44px;
  margin: 0;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
</style>