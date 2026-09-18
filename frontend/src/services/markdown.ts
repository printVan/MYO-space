import { marked } from 'marked' // marked@4：函数式 API，无 ES 私有字段（v11 的 #parseMarkdown 会被 babel-preset-taro 转坏导致生产构建运行时白屏）
import DOMPurify from 'dompurify'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

/**
 * GFM Markdown 渲染（§4.2.3）
 * 严格遵循 GFM：任务列表、表格、脚注、代码块、行内代码、引用
 * marked@4 默认 gfm:true（表格/删除线/任务列表/自动链接），breaks:true 保留软换行
 */
marked.setOptions({ gfm: true, breaks: true })

/** 渲染 Markdown 为 HTML，并对代码块做 prism 高亮
 *  XSS 防护（BUG-01）：输出经 DOMPurify 消毒；
 *  无 DOM 环境（微信小程序 rich-text / SSR）跳过消毒（rich-text 自带渲染隔离） */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md || '')
  const highlighted = highlightCode(raw)
  if (typeof window !== 'undefined' && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(highlighted, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target', 'rel'],
    })
  }
  return highlighted
}

/** 对 <pre><code class="language-xxx"> 应用 Prism 高亮 */
function highlightCode(html: string): string {
  return html.replace(/<pre><code class="language-([\w+-]+)">([\s\S]*?)<\/code><\/pre>/g, (_, lang: string, code: string) => {
    const language = Prism.languages[lang] ? lang : 'markup'
    try {
      const decoded = decodeHtmlEntities(code)
      const highlighted = Prism.highlight(decoded, Prism.languages[language], language)
      return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>`
    } catch {
      return `<pre><code class="language-${lang}">${code}</code></pre>`
    }
  })
}

function decodeHtmlEntities(str: string): string {
  const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (!textarea) return str
  textarea.innerHTML = str
  return textarea.value
}
