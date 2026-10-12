# fitness-app —— 健身训练小程序

基于 Taro 4.x + React 18 + TypeScript 构建的微信小程序项目骨架（编译器使用 Vite，CSS 预处理器使用 Sass）。

## 环境要求

- Node.js >= 20（模板默认按现代 Node 运行）
- npm 11.x（其他包管理工具也可，本项目默认使用 npm）
- 微信开发者工具（导入项目根目录，appid 当前为占位 `touristappid`，见 `project.config.json`）

## 快速开始

```bash
# 1. 安装依赖（在项目根目录执行）
npm install

# 2. 开发模式（监听文件变化，产出 dist/ 供微信开发者工具预览）
npm run dev:weapp

# 3. 生产构建
npm run build:weapp
```

构建成功后，用微信开发者工具「导入项目」选择本目录（`miniprogramRoot` 指向 `dist/`）即可预览。

## 项目结构

```
fitness-app/
├── config/                  # Taro 编译配置
│   ├── index.ts             #   通用配置（编译器 Vite、designWidth 750 等）
│   ├── dev.ts               #   开发环境配置
│   └── prod.ts              #   生产环境配置
├── src/
│   ├── app.ts               # 应用入口
│   ├── app.config.ts        # 全局配置（页面注册、tabBar、窗口样式）
│   ├── app.scss             # 全局样式
│   ├── index.html           # H5 模板
│   ├── pages/               # 页面目录
│   │   ├── index/           #   首页（今日训练概览占位）
│   │   ├── training/        #   训练：plan（计划列表）、session（训练进行/记录）
│   │   ├── diet/            #   饮食模块（拍照记录卡路里入口）
│   │   ├── supplement/      #   补给管理
│   │   └── knowledge/       #   知识库（上传/下载/管理）
│   ├── services/
│   │   └── request.ts       # Taro.request 轻封装（baseURL 占位、统一错误处理骨架）
│   └── types/
│       └── models.ts        # 核心领域模型 TS 接口草案
├── types/                   # 全局类型声明（global.d.ts）
├── project.config.json      # 微信开发者工具项目配置（appid: touristappid 占位）
├── babel.config.js          # babel-preset-taro 配置
├── tsconfig.json            # TypeScript 配置
└── package.json
```

## 页面清单

| 页面路径 | 说明 | tabBar |
| --- | --- | --- |
| `pages/index/index` | 首页：今日训练概览（占位） | 是（首页） |
| `pages/training/plan` | 训练计划列表（占位） | 是（训练） |
| `pages/training/session` | 训练进行 / 记录页（占位） | 否 |
| `pages/diet/diet` | 饮食模块：拍照记录卡路里入口（占位） | 是（饮食） |
| `pages/supplement/supplement` | 补给管理（占位） | 是（补给） |
| `pages/knowledge/knowledge` | 知识库：上传 / 下载 / 管理（占位） | 否 |

说明：

- tabBar 暂只配置了文字，未配置图标；后续补充图标时在 `src/app.config.ts` 的 `tabBar.list` 中为每项添加 `iconPath` / `selectedIconPath` 即可。
- `src/types/models.ts` 为领域模型草案（TrainingPlan、Cycle、SessionRecord、Exercise、Goal、DietRecord、SupplementPlan、HealthReport、KnowledgeEntry），待与业务对齐后调整。
