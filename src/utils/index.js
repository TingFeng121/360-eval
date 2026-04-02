// Role/type mapping utilities
export const roleName = (role) => {
  const map = { admin: '管理员', leader: '领导', employee: '员工', guest: '访客' }
  return map[role] || role
}

export const roleTagType = (role) => {
  const map = { admin: 'danger', leader: 'warning', employee: 'success' }
  return map[role] || 'info'
}

export const evalTypeName = (type) => {
  const map = { self: '自评', peer: '他评', leader: '领导评' }
  return map[type] || type
}

// Permission utilities
export const parsePermissions = (perm) => {
  if (!perm) return { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  if (typeof perm === 'object') return perm
  try {
    return JSON.parse(perm)
  } catch {
    return { viewSelf: true, viewPeer: false, viewLeader: false, viewSummary: false }
  }
}

// Number utilities
export const round1 = (num) => Math.round((num || 0) * 10) / 10

// Password utilities
export const hashPassword = (password) => {
  return btoa(unescape(encodeURIComponent(password + '_360eval')))
}

// Responsive utilities
let isMobileValue = false

export const checkIsMobile = () => {
  return window.innerWidth <= 768
}

export const getIsMobile = () => isMobileValue

export const updateIsMobile = () => {
  isMobileValue = checkIsMobile()
}

// Date/period utilities
export const getPeriodStart = (year, quarter) => {
  return `${year}-${(quarter - 1) * 3 + 1}-01`
}

export const getPeriodEnd = (year, quarter) => {
  return quarter === 4 ? `${year + 1}-01-01` : `${year}-${quarter * 3 + 1}-01`
}

export const getCurrentPeriod = () => {
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return { year, quarter }
}

// Evaluation type constants
export const EVAL_TYPES = {
  SELF: 'self',
  PEER: 'peer',
  LEADER: 'leader'
}

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  LEADER: 'leader',
  EMPLOYEE: 'employee'
}

// Status constants
export const TASK_STATUSES = {
  PENDING: 'pending',
  SAVED: 'saved',
  COMPLETED: 'completed'
}

// Dimension constants
export const DIMENSION_LABELS = {
  communication: '沟通能力',
  teamwork: '团队合作',
  professionalism: '职业素养',
  innovation: '创新能力',
  efficiency: '工作效率',
  leadership: '领导能力'
}
