import { ref, onMounted, onUnmounted } from 'vue'
import { updateIsMobile, getIsMobile } from '../utils'

export const useResponsive = () => {
  const isMobile = ref(getIsMobile())

  const handleResize = () => {
    updateIsMobile()
    isMobile.value = getIsMobile()
  }

  onMounted(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    isMobile
  }
}
