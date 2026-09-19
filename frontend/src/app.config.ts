export default defineAppConfig({
  pages: [
    'pages/workspace/index',
    'pages/blog/index',
    'pages/blog/project',
    'pages/blog/note',
    'pages/blog/projects',
    'pages/settings/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'MYO Space',
    navigationBarTextStyle: 'black',
    backgroundColor: '#ffffff'
  }
  // 注：底部 TabBar 已移除（2026-09-08），导航收敛到顶栏：
  // 工作区 ↔ 公开博客 ↔ 设置，通过页面内链接与 reLaunch 切换
})
