export default defineAppConfig({
  // 全部页面注册（第一个为启动页）
  pages: [
    'pages/index/index',
    'pages/training/plan',
    'pages/training/prep',
    'pages/training/session',
    'pages/review/review',
    'pages/history/history',
    'pages/diet/diet',
    'pages/supplement/supplement',
    'pages/knowledge/knowledge'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#0C1014',
    navigationBarTitleText: '铁日 IronDay',
    navigationBarTextStyle: 'white'
  },
  // 底部标签栏：4 个 tab，深色主题 + 蓝紫选中色 + 图标
  tabBar: {
    color: '#93A1B0',
    selectedColor: '#8B9DFF',
    backgroundColor: '#0C1014',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'static/tab/home.png',
        selectedIconPath: 'static/tab/home-on.png'
      },
      {
        pagePath: 'pages/training/plan',
        text: '训练',
        iconPath: 'static/tab/barbell.png',
        selectedIconPath: 'static/tab/barbell-on.png'
      },
      {
        pagePath: 'pages/diet/diet',
        text: '饮食',
        iconPath: 'static/tab/apple.png',
        selectedIconPath: 'static/tab/apple-on.png'
      },
      {
        pagePath: 'pages/supplement/supplement',
        text: '补给',
        iconPath: 'static/tab/pill.png',
        selectedIconPath: 'static/tab/pill-on.png'
      }
    ]
  }
})
