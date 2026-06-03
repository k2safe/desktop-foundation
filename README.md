# desktop-foundation

公司级桌面应用底座。

这个仓库只沉淀通用桌面能力，不携带任何业务记忆。产品项目应该只提供品牌、菜单、路由、业务页面和接口封装。

## Packages

- `@desktop-foundation/ui-react`: React UI 组件、布局壳、主题协议。
- `@desktop-foundation/bridge`: TypeScript 客户端 SDK，统一请求、session、storage、secure storage、文件和桌面能力入口。
- `@desktop-foundation/app-shell`: 应用级 Provider 壳，组合主题、反馈、确认框、客户端和 session。
- `@desktop-foundation/create-desktop-app`: 产品桌面端脚手架。
- `@desktop-foundation/theme-presets`: 通用主题预设。
- `desktop-core-rs`: Rust/Tauri command 契约和本地能力 runtime。
- `examples/component-docs`: 零依赖组件文档与视觉冒烟 fixture。

## Docs

- [Product AI Handoff](docs/product-ai-handoff.md)
- [Login Templates](docs/login-templates.md)
- [Tauri Updater Adapter](docs/tauri-updater-adapter.md)
- [Existing Project Migration Case](docs/existing-project-migration-case.md)
- [Product Adapter](docs/product-adapter.md)
- [Product Onboarding Checklist](docs/product-onboarding-checklist.md)
- [Product Integration Kit](integration-kit/README.md)
- [Doctor Reference](docs/doctor.md)
- [Product Integration Example](docs/product-integration-example.md)
- [Product Integration Guide](docs/product-integration.md)
- [Package Consumption](docs/package-consumption.md)
- [Package Boundary](docs/package-boundary.md)
- [UI Theme](docs/ui-theme.md)
- [UI Component Catalog](docs/ui-component-catalog.md)
- [Scaffolding](docs/scaffolding.md)
- [Rust Core](docs/rust-core.md)
- [API Reference](docs/api-reference.md)
- [Security Policy](docs/security-policy.md)
- [CI/CD Capability](docs/ci-cd.md)
- [Demo Gallery](docs/demo-gallery.md)
- [External Demo](docs/external-demo.md)

当前底座已经包含：

- React UI 组件和主题协议
- 应用级 shell、session、auth guard、debug panel
- Web/Tauri bridge
- Rust HTTP transport、窗口、剪贴板、通知
- 文件打开/保存、JSON 导出、HTTP 下载
- secure storage 契约，macOS Keychain、Linux Secret Service、Windows DPAPI、文件 fallback
- 零依赖组件文档页和可选 Playwright 截图入口
- 通用 `desktop-foundation doctor` 接入检查命令
- Tauri native plugin 可选适配层，可用官方插件替换部分 Rust command 能力
- 通用产品接入 DEMO：`examples/demo-product`

## Validation

```bash
pnpm type-check
pnpm build
pnpm smoke:multipart
pnpm visual:regression
cargo test --offline
cargo check -p desktop-core-rs --features tauri,http-reqwest --offline
cargo fmt --check
```

`pnpm smoke:multipart` 会起本地 demo HTTP 服务，验证 `FormData` 上传和 Tauri bridge multipart 序列化。`pnpm visual:regression` 在没有安装 Playwright 时会安全跳过；安装后会输出桌面和移动端截图。`cargo fmt --check` 需要本机 Rust toolchain 安装 `rustfmt` 组件。

## App 使用方式

```tsx
import "@desktop-foundation/ui-react/styles.css";
import { DesktopAppShell } from "@desktop-foundation/app-shell";
import { DesktopLayout } from "@desktop-foundation/ui-react";

export function App() {
  return (
    <DesktopAppShell theme={theme} client={clientConfig}>
      <DesktopLayout brand={brand} menus={menus} user={user}>
        <Routes />
      </DesktopLayout>
    </DesktopAppShell>
  );
}
```

## Boundary

底座可以提供：

- 组件形状
- 主题 token
- 桌面布局
- 登录页壳
- 表格、筛选、反馈状态
- 请求与 session 的通用客户端
- secure storage
- 文件导入导出与下载
- Rust/Tauri 本地能力命令

底座不提供：

- 具体产品名
- 具体业务接口路径
- 具体业务模型
- 具体权限模型
- 具体菜单编码
- 具体路由修正规则
