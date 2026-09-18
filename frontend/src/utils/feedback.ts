import { createDiscreteApi } from 'naive-ui'

/**
 * Naive-UI 消息反馈（仅 H5 端使用，§7 UI组件库）
 * createDiscreteApi 无需 Provider，可在任意位置调用
 */
export const { message, dialog } = createDiscreteApi(['message', 'dialog'])
