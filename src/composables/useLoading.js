import { ref } from 'vue'

export const useLoading = () => {
  const loading = ref(false)
  const error = ref(null)

  const wrapPromise = async (fn) => {
    loading.value = true
    error.value = null

    try {
      return await fn()
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    wrapPromise
  }
}
