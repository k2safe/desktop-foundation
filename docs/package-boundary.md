# Package Boundary

## desktop-ui-react

负责桌面后台类产品的通用 UI：

- 基础组件
- 表单组件
- 数据展示组件
- 页面壳组件
- 反馈状态组件
- 主题协议

不负责：

- 业务接口
- 业务字段
- 业务权限
- 业务路由
- 产品专属菜单逻辑

## desktop-bridge

负责 TypeScript 调用桌面能力的统一入口：

- HTTP request
- session
- local storage
- secure storage
- desktop capability
- file dialogs, export, download
- app update capability
- events
- error shape

不负责：

- 具体 API path
- 具体登录 payload
- 具体返回模型

## desktop-app-shell

负责产品入口的应用级组合：

- theme provider
- toast provider
- confirm provider
- desktop client provider
- session provider
- auth guard
- standard login controller
- permission and feature guards
- debug panel
- request/mutation hooks

不负责：

- 具体登录接口
- 具体用户模型
- 具体路由库
- 具体权限模型
- 具体菜单生成规则

## create-desktop-app

负责生成干净的产品桌面端起点和自动化入口：

- React entry
- Tauri shell
- theme preset
- menu config
- desktop client config
- Tauri desktop client bootstrap
- placeholder page
- CI command wrapper
- optional GitHub Actions invocation examples

不负责：

- 业务 API wrapper
- 业务模型
- 权限规则
- 产品 dashboard
- 菜单编码映射
- 项目 release credentials
- signing / notarization / artifact upload policy
- 产品专属 smoke tests

## theme-presets

负责提供通用主题起点：

- default
- admin
- merchant
- command
- ledger
- studio
- dark

不负责具体产品品牌资产。

## desktop-core-rs

Rust/Tauri core 负责本地能力和安全边界：

- request transport
- token/session persistence
- secure storage
- file/dialog/window/system capabilities
- request diagnostics

不负责任何业务语义。
