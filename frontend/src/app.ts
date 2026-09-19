import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useThemeStore } from '@/stores/theme'
import { usePreferenceStore } from '@/stores/preference'
import { useProjectStore } from '@/stores/project'
import { useAccountStore } from '@/stores/account'
import { ensureDefaultProjects } from '@/services/projects'
import './app.scss'

const pinia = createPinia()

const App = createApp({
  setup() {
    // 应用启动初始化：主题、偏好、项目列表、账号状态
    const themeStore = useThemeStore()
    const prefStore = usePreferenceStore()
    const projectStore = useProjectStore()
    const accountStore = useAccountStore()
    void (async () => {
      await prefStore.init()
      await themeStore.init()
      await accountStore.init()
      await ensureDefaultProjects()
      await projectStore.init()
    })()
    return {}
  }
})

App.use(pinia)

export default App
