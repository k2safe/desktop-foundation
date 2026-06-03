# Boundary Guide

## 底座负责

- 桌面 shell 和布局模板。
- 登录页壳和登录页模板。
- 表格、筛选、表单、弹窗、抽屉、反馈、空状态、状态标签等通用组件。
- 主题 token、主题预设和模板 runtime。
- bridge：HTTP、session、storage、secure storage、文件、桌面能力、更新能力。
- Tauri command 契约和默认 capability。
- CI wrapper、doctor、打包产物整理、manifest 和 release plan 生成。

## 产品负责

- 产品名称、品牌、图标、菜单、路由、页面信息架构。
- 业务接口、业务模型、业务权限、业务数据状态。
- 登录 API、用户信息、角色展示、租户或组织切换。
- 打包签名、公证、release 上传、私有更新鉴权。
- 具体页面里的业务交互和业务校验。

## 模板能力边界

模板是轻量选择，不是强绑定主题包。产品可以通过 adapter 选择：

- 主布局：侧边栏、顶部菜单、紧凑布局。
- 登录页：左右分栏、居中卡片、品牌面板。
- 表格密度：default、compact、spacious。
- 表单布局：单列、双列、分组卡片。
- 弹窗尺寸：sm、md、lg、fullscreen-like。

如果多个产品都会用到一种布局或组件风格，把它沉淀到底座模板；如果只是单个产品想突出品牌差异，产品侧通过 theme token、`className` 和业务页面布局处理。

## 判断规则

- 影响多个项目的视觉或交互规范：回到底座做通用模板。
- 只影响一个产品的文案、字段、接口、权限、表单项：产品侧做。
- 需要访问本地能力、更新、文件、secure storage：优先走 bridge adapter。
- 需要改底座组件源码才能完成业务页面：先检查是否缺少通用 prop、slot 或 className，再决定是否扩展底座。
