# UI Theme

UI 主题采用 CSS variables 作为底层协议。React 的 `ThemeProvider` 只负责把产品 preset 转成 `--df-*` 变量。

## Token Groups

- `brand`: 产品名称、logo、mark。
- `colors`: 主色、背景、文字、边框、状态色。
- `radius`: 控件圆角。
- `shadow`: 阴影层级。
- `typography`: 字体。
- `density`: `compact`、`default`、`comfortable`。

## Product Preset Example

```ts
import type { DesktopTheme } from "@desktop-foundation/ui-react";

export const productTheme: DesktopTheme = {
  id: "product",
  brand: {
    name: "Product"
  },
  colors: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    dark: "#111827",
    background: "#f3f4f6",
    surface: "#ffffff",
    elevated: "#ffffff",
    border: "#e5e7eb",
    text: "#111827",
    mutedText: "#6b7280",
    danger: "#dc2626",
    warning: "#d97706",
    success: "#059669",
    info: "#2563eb"
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px"
  },
  density: "default"
};
```

## Template Runtime

Theme templates are intentionally lightweight. A template combines theme tokens, app shell layout, login layout, and surface density; product teams still own business pages, data, and copy.

Current built-in template ids:

| Id | Shell | Login | Surface | Best for |
| --- | --- | --- | --- | --- |
| `default` | sidebar | split | crisp | neutral internal desktop apps |
| `admin` | sidebar | brand-split | dense | admin consoles similar to CoinPay |
| `command` | sidebar | workbench | dense | operations and monitoring tools |
| `merchant` | topnav | centered | glass | merchant-facing SaaS surfaces |
| `ledger` | topnav | centered | crisp | finance, reconciliation, ledger tables |
| `studio` | topnav | split | glass | lighter product and settings workspaces |
| `dark` | topnav | workbench | dense | dark command-center products |

Use `createThemeTemplateRuntime(templateId, overrides)` when a product wants to select one template and then override brand, colors, radius, density, or layout fields without editing component internals.

Login variants stay intentionally small:

- `split`: form panel plus dark visual area.
- `brand-split`: CoinPay-style admin login, with a wider form/brand panel and stronger right-side product stage.
- `centered`: simple centered login card.
- `workbench`: operational login surface for command-center products.

Business-only fields such as tenant code, Google OTP, or invite token should be added through `DesktopLoginPage.extraFields`; they should not be baked into the foundation template.

## Rules

- 组件只能读取 `--df-*` token。
- 业务项目不依赖组件内部 class 结构。
- 第一版默认 light theme，token 结构保留 dark mode。
- 密度影响控件高度、表格行高、布局间距。
