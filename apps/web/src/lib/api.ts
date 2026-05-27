export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface ApiError {
  error: { code: string; message: string; details?: { field: string; message: string }[] }
}

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
    public status?: number
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

// Attempt a silent token refresh using the httpOnly refresh cookie.
// Returns the new accessToken or null if refresh failed.
async function tryRefreshToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!res.ok) return null
    const { accessToken } = await res.json()
    // Update Zustand store without importing it (avoid circular deps)
    const { useAuthStore } = await import('@/store/auth')
    const state = useAuthStore.getState()
    if (state.user) state.setAuth(state.user, accessToken)
    return accessToken as string
  } catch {
    return null
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  })

  if (res.status === 204) return undefined as T

  // On 401: try to refresh the token once, then retry the original request
  // Nu reîncercăm pe rutele de autentificare — nu are sens să refreshezi token la login greșit
  const isAuthPath = path.startsWith('/api/v1/auth/')
  if (res.status === 401 && !isAuthPath) {
    const newToken = await tryRefreshToken()
    if (newToken) {
      const retryOptions = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers as Record<string, string> ?? {}),
          Authorization: `Bearer ${newToken}`,
        },
      }
      const retryRes = await fetch(`${API_URL}${path}`, {
        credentials: 'include',
        ...retryOptions,
      })
      if (retryRes.status === 204) return undefined as T
      const retryData = await retryRes.json()
      if (!retryRes.ok) {
        const err = (retryData as ApiError).error
        throw new ApiRequestError(err.code, err.message, err.details, retryRes.status)
      }
      return retryData as T
    }
  }

  const data = await res.json()

  if (!res.ok) {
    const body = data as Record<string, unknown>
    const err = (typeof body?.error === 'object' && body.error !== null) ? body.error as Record<string, unknown> : null
    throw new ApiRequestError(
      err ? String(err.code ?? 'ERROR') : String(body?.error ?? 'ERROR'),
      err ? String(err.message ?? 'A apărut o eroare.') : String(body?.message ?? body?.error ?? 'A apărut o eroare.'),
      err ? err.details as { field: string; message: string }[] | undefined : undefined,
      res.status,
    )
  }

  return data as T
}

export const api = {
  auth: {
    register: (body: { name: string; email: string; password: string }) =>
      request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<{ user: User; accessToken: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    logout: () => request('/api/v1/auth/logout', { method: 'POST', body: '{}' }),

    refresh: () =>
      request<{ accessToken: string }>('/api/v1/auth/refresh', { method: 'POST', body: '{}' }),

    verifyEmail: (token: string) =>
      request('/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

    forgotPassword: (email: string) =>
      request('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    resetPassword: (token: string, password: string) =>
      request('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  },

  users: {
    me: (accessToken: string) =>
      request<User>('/api/v1/users/me', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      }),
    deleteAccount: (accessToken: string) =>
      request<{ ok: boolean }>('/api/v1/users/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
      }),
  },

  billing: {
    getSubscription: (accessToken: string) =>
      request<{ subscription: Subscription | null }>('/api/v1/billing/subscription', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    createCheckout: (accessToken: string, plan: 'monthly' | 'annual') =>
      request<{ url: string }>('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      }),

    createPortal: (accessToken: string) =>
      request<{ url: string }>('/api/v1/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),
  },

  ai: {
    getSettings: (accessToken: string) =>
      request<{ settings: AiSettings }>('/api/v1/ai/settings', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    analyzeStyle: (accessToken: string) =>
      request<{ writingStyle: string }>('/api/v1/ai/analyze-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: '{}',
      }),

    updateSettings: (accessToken: string, data: { isActive?: boolean; timerMinutes?: number; systemPrompt?: string; knowledgeBase?: string; writingStyle?: string }) =>
      request<{ settings: AiSettings }>('/api/v1/ai/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify(data),
      }),

    getBlacklist: (accessToken: string) =>
      request<{ phones: string[] }>('/api/v1/ai/blacklist', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    addBlacklist: (accessToken: string, phoneNumber: string) =>
      request<{ ok: boolean }>('/api/v1/ai/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ phoneNumber }),
      }),

    removeBlacklist: (accessToken: string, phone: string) =>
      request<void>(`/api/v1/ai/blacklist/${phone}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    getConversations: (accessToken: string) =>
      request<{ conversations: Conversation[] }>('/api/v1/ai/conversations', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    getMessages: (accessToken: string, phone: string) =>
      request<{ messages: ConversationMessage[] }>(`/api/v1/ai/conversations/${phone}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    clearConversation: (accessToken: string, phone: string) =>
      request<void>(`/api/v1/ai/conversations/${phone}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),
  },

  admin: {
    getUsers: (accessToken: string) =>
      request<{ users: AdminUser[] }>('/api/v1/admin/users', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    setAgentActive: (accessToken: string, userId: string, isActive: boolean) =>
      request<{ ok: boolean }>(`/api/v1/admin/users/${userId}/agent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      }),
  },

  notifications: {
    list: (accessToken: string) =>
      request<{ notifications: AppNotification[]; unreadCount: number }>('/api/v1/admin/notifications', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    markAllRead: (accessToken: string) =>
      request<{ ok: boolean }>('/api/v1/admin/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: '{}',
      }),
  },

  whatsapp: {
    getSession: (accessToken: string) =>
      request<{ session: WhatsappSession | null }>('/api/v1/whatsapp/session', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      }),

    connect: (accessToken: string) =>
      request<{ qrCode: string }>('/api/v1/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: '{}',
      }),

    disconnect: (accessToken: string) =>
      request('/api/v1/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
        body: '{}',
      }),
  },
}

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: string
  createdAt: string
  updatedAt: string
}

export interface WhatsappSession {
  id: string
  userId: string
  phoneNumber: string | null
  status: 'disconnected' | 'pairing' | 'connected'
  pairingCode: string | null
  pairingCodeExpiresAt: number | null
  connectedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface AiSettings {
  id: string
  userId: string
  isActive: boolean
  adminDisabled: boolean
  timerMinutes: number
  systemPrompt: string
  knowledgeBase: string
  writingStyle: string
  pauseUntil: number | null
  createdAt: number
  updatedAt: number
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: number
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  trialEndsAt: number | null
  currentPeriodEndsAt: number | null
  sessionStatus: string | null
  sessionPhone: string | null
  agentActive: boolean | null
  agentTimerMinutes: number | null
}

export interface AppNotification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  readAt: number | null
  createdAt: number
}

export interface Subscription {
  id: string
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string | null
  plan: 'monthly' | 'annual' | null
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
  trialEndsAt: number | null
  currentPeriodEndsAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Conversation {
  contactPhone: string
  lastMessage: string
  lastAt: number
  count: number
  fromMe: boolean
}

export interface ConversationMessage {
  id: string
  userId: string
  contactPhone: string
  fromMe: boolean
  body: string
  waTimestamp: number
  createdAt: number
}
