import { BASE } from './api'

/**
 * 图片上传服务（§4.8.5 / 粘贴上传）
 * 编辑器粘贴图片 → 直传后端 /api/uploads/image → 返回图库（Supabase Storage）公网 URL
 * 后端要求登录（全局 JWT 守卫），未登录返回 401
 */

export interface UploadResult {
  url: string
  error?: string
}

/**
 * 上传图片文件，成功返回可直接写入 Markdown 的 URL
 * @param file 图片文件（File / Blob）
 * @param filename 原文件名（后端按扩展名白名单校验）
 * @param token 登录 token，未登录传 null（后端将返回 401）
 */
export async function uploadImage(file: File | Blob, filename: string, token: string | null): Promise<string> {
  const fd = new FormData()
  fd.append('file', file, filename)
  const res = await fetch(`${BASE}/uploads/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('请先登录后再上传图片')
    let msg = `上传失败（${res.status}）`
    try {
      const data = (await res.json()) as UploadResult
      if (data?.error) msg = data.error
    } catch {
      /* 忽略 */
    }
    throw new Error(msg)
  }
  const data = (await res.json()) as UploadResult
  if (!data?.url) throw new Error(data?.error || '上传失败')
  return data.url
}
