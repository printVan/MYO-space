import { db } from '@/db'
import { renderMarkdown } from './markdown'
import { exportProjectNotes } from './search'
import type { Note } from '@/types/models'

/**
 * 导出功能（§4.7）
 * - 单篇/项目导出 .md（GFM 格式）
 * - 单篇导出 PDF（html-pdf-js 前端导出，实现采用 html2pdf.js）
 * - 单篇/项目导出静态 HTML，可直接部署静态博客
 * - 项目导出 Git 仓库 zip（仅导出最新文件，不含内部快照历史；isomorphic-git 动态按需加载）
 */

function triggerDownload(content: Blob | string, filename: string, mime: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

/** 导出单篇 Markdown */
export function exportNoteMd(note: Note): void {
  const title = note.title.endsWith('.md') ? note.title : `${note.title}.md`
  triggerDownload(note.content, safeName(title), 'text/markdown;charset=utf-8')
}

/** 导出单篇静态 HTML */
export function exportNoteHtml(note: Note): void {
  const html = buildPageHtml(note.title, note.content)
  const name = note.title.endsWith('.md') ? note.title.replace(/\.md$/i, '') : note.title
  triggerDownload(html, `${safeName(name)}.html`, 'text/html;charset=utf-8')
}

/** 导出项目全部 Markdown（zip 打包，保持目录结构） */
export async function exportProjectMdZip(projectId: string): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const items = await exportProjectNotes(projectId)
  const zip = new JSZip()
  for (const { note, path } of items) {
    zip.file(path, note.content)
  }
  // 附带 README
  const project = await db.projects.get(projectId)
  if (project) {
    zip.file('README.md', `# ${project.name}\n\n${project.description}\n`)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${safeName(project?.name ?? 'project')}-notes.zip`, 'application/zip')
}

/** 导出项目静态 HTML（可部署为静态博客） */
export async function exportProjectHtmlZip(projectId: string): Promise<void> {
  const { default: JSZip } = await import('jszip')
  const items = await exportProjectNotes(projectId)
  const project = await db.projects.get(projectId)
  const zip = new JSZip()
  for (const { note, path } of items) {
    const htmlPath = path.replace(/\.md$/i, '') + '.html'
    zip.file(htmlPath, buildPageHtml(note.title, note.content, project?.name))
  }
  const index = buildIndexHtml(project, items.map((i) => i.path))
  zip.file('index.html', index)
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${safeName(project?.name ?? 'project')}-static-site.zip`, 'application/zip')
}

/** 导出单篇 PDF（html2pdf.js 前端生成） */
export async function exportNotePdf(note: Note): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default
  // 创建隐藏渲染容器
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;padding:32px;background:#fff;z-index:-1'
  container.className = 'markdown-body'
  container.innerHTML = `<h1 style="border-bottom:1px solid #d8dee4;padding-bottom:8px;margin-bottom:16px">${escapeHtml(note.title)}</h1>` + renderMarkdown(note.content)
  document.body.appendChild(container)
  try {
    await html2pdf().set({
      margin: 12,
      filename: `${safeName(note.title)}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 794 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(container).save()
  } finally {
    document.body.removeChild(container)
  }
}

/** 导出项目 Git 仓库 zip 功能已移除（v1.1 精简）：普通用户只需 Markdown/HTML 打包，不再依赖 isomorphic-git + lightning-fs */

function buildPageHtml(title: string, content: string, projectName?: string): string {
  const md = content || ''
  const body = renderMarkdown(md)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}${projectName ? ` · ${escapeHtml(projectName)}` : ''}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.7.0/github-markdown.css">
<style>
body { margin: 0; background: #ffffff; color: #24292f; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif; }
.page { max-width: 900px; margin: 0 auto; padding: 32px 24px 64px; }
h1.doc-title { border-bottom: 1px solid #d8dee4; padding-bottom: 8px; margin-bottom: 24px; }
</style>
</head>
<body>
<div class="page">
<h1 class="doc-title">${escapeHtml(title)}</h1>
<div class="markdown-body">${body}</div>
</div>
</body>
</html>`
}

function buildIndexHtml(project: { name: string; description: string } | undefined, paths: string[]): string {
  const list = paths.map((p) => {
    const htmlPath = p.replace(/\.md$/i, '') + '.html'
    const name = p.split('/').pop() || p
    return `<li><a href="${htmlPath}">${escapeHtml(name)}</a></li>`
  }).join('\n')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(project?.name ?? '博客')}</title>
<style>
body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; color: #24292f; }
a { color: #0969da; text-decoration: none; }
a:hover { text-decoration: underline; }
ul { line-height: 1.9; }
</style>
</head>
<body>
<h1>${escapeHtml(project?.name ?? '博客')}</h1>
<p>${escapeHtml(project?.description ?? '')}</p>
<ul>${list}</ul>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
