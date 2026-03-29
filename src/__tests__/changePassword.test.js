import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn()
  }
}

async function changePassword(id, oldPassword, newPassword) {
  const { data: { session } } = await mockSupabase.auth.getSession()
  const email = session?.user?.email

  if (!email) {
    throw new Error('无法获取用户邮箱信息，请重新登录')
  }

  const { error: signInError } = await mockSupabase.auth.signInWithPassword({
    email: email,
    password: oldPassword
  })

  if (signInError) {
    throw new Error('原密码错误')
  }

  const { error: updateError } = await mockSupabase.auth.updateUser({
    password: newPassword
  })

  if (updateError) {
    throw new Error('密码修改失败：' + updateError.message)
  }

  return { message: '密码修改成功' }
}

describe('密码修改功能测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('changePassword', () => {
    it('TC-001: session为空时应抛出"无法获取用户邮箱信息"', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      })

      await expect(
        changePassword('user-id', 'old', 'new')
      ).rejects.toThrow('无法获取用户邮箱信息')
    })

    it('TC-002: 原密码错误时应抛出"原密码错误"', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { email: 'test@test.com' } } }
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      })

      await expect(
        changePassword('user-id', 'wrong-password', 'new-password')
      ).rejects.toThrow('原密码错误')
    })

    it('TC-003: 原密码正确时应成功修改密码', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { email: 'test@test.com' } } }
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: {}, session: {} },
        error: null
      })
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      })

      const result = await changePassword('user-id', 'old-password', 'new-password')

      expect(result.message).toBe('密码修改成功')
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password' })
    })

    it('TC-004: updateUser失败时应抛出"密码修改失败"', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { email: 'test@test.com' } } }
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: {} },
        error: null
      })
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: null,
        error: { message: 'Failed to update user' }
      })

      await expect(
        changePassword('user-id', 'old-password', 'new-password')
      ).rejects.toThrow('密码修改失败')
    })

    it('TC-005: 应使用session中的email', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { email: 'admin@test.com' } } }
      })
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: {} },
        error: null
      })
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: {} },
        error: null
      })

      await changePassword('user-id', 'old', 'new')

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'old'
      })
    })
  })
})
