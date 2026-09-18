/**
 * 后端 API 客户端（§3.3 账号鉴权 JWT / §4.8 同步）
 * 本地为真相源，后端仅作同步备份网关
 * 地址来源：构建时注入 TARO_APP_API_BASE（生产部署指向线上域名）；缺省回退本地开发地址
 */

const BASE = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api'
export { BASE }

export interface AuthResult {
  accessToken: string
  user: { id: string; username: string }
}

export interface SyncChange {
  /** 客户端生成的变化 id（幂等去重） */
  id: string
  entity: 'project' | 'folder' | 'note' | 'snapshot' | 'annotation'
  op: 'upsert' | 'delete'
  /** upsert 时携带完整业务对象 */
  data?: Record<string, unknown>
  updatedAt: number
}

async function request<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const res = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })
  if (!res.ok) {
    let msg = `请求失败（${res.status}）`
    try {
      const data = await res.json()
      const m = data?.message
      if (typeof m === 'string') msg = m
      else if (Array.isArray(m) && m.length) msg = m[0]
    } catch {
      /* 忽略解析失败 */
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

export const api = {
  register: (username: string, password: string) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: { username, password } }),

  login: (username: string, password: string) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: { username, password } }),

  me: (token: string) => request<{ id: string; username: string }>('/auth/me', { token }),

  push: (token: string, changes: SyncChange[]) =>
    request<{ accepted: number }>('/sync/push', { method: 'POST', body: { changes }, token }),

  pull: (token: string, since = 0) =>
    request<{ changes: SyncChange[]; serverTime: number }>(`/sync/pull?since=${since}`, { token })
}
