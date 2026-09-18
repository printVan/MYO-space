/**
 * marked@4.3.0 类型声明（锁定版本无内置类型）
 * 仅声明本项目实际使用的 API：marked.parse / marked.setOptions
 */
declare module 'marked' {
  export const marked: {
    parse(md: string): string
    setOptions(options: { gfm?: boolean; breaks?: boolean }): void
  }
  export default marked
}
