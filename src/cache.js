// API 缓存模块
class ApiCache {
  constructor() {
    this.cache = new Map()
    this.cacheDuration = 5 * 60 * 1000 // 5分钟缓存
    this.userCache = null
    this.userCacheTime = 0
  }

  // 生成缓存键
  getKey(method, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${JSON.stringify(params[k])}`)
      .join('&')
    return `${method}:${paramStr}`
  }

  // 获取缓存
  get(method, params = {}) {
    const key = this.getKey(method, params)
    const item = this.cache.get(key)
    
    if (!item) return null
    
    // 检查是否过期
    if (Date.now() - item.timestamp > this.cacheDuration) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }

  // 设置缓存
  set(method, params = {}, data) {
    const key = this.getKey(method, params)
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    // 限制缓存大小
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.keys())[0]
      this.cache.delete(oldestKey)
    }
  }

  // 清除缓存
  clear(method = null) {
    if (method) {
      // 清除特定方法的所有缓存
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${method}:`)) {
          this.cache.delete(key)
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear()
    }
  }

  // 用户信息缓存
  setUser(user) {
    this.userCache = user
    this.userCacheTime = Date.now()
  }

  getUser() {
    if (!this.userCache) return null
    if (Date.now() - this.userCacheTime > 60 * 1000) { // 1分钟
      this.userCache = null
      return null
    }
    return this.userCache
  }

  // 清除用户缓存
  clearUser() {
    this.userCache = null
    this.userCacheTime = 0
  }
}

// 创建全局缓存实例
export const apiCache = new ApiCache()