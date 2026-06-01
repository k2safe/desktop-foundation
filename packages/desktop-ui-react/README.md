# @desktop-foundation/ui-react

桌面后台类产品的通用 React UI 包。

## Goals

- 组件只依赖通用 token。
- 主题通过 CSS variables 注入。
- 布局壳只接收品牌、菜单、用户和插槽。
- 业务项目只写业务页面，不重复写登录页、侧边栏、页头、表格状态。

## Import

```tsx
import "@desktop-foundation/ui-react/styles.css";
import { ThemeProvider, DesktopLayout, Button } from "@desktop-foundation/ui-react";
```

## Theme

```tsx
<ThemeProvider theme={theme}>
  <DesktopLayout brand={brand} menus={menus} user={user}>
    {children}
  </DesktopLayout>
</ThemeProvider>
```

## Component Groups

- primitives: `Button`、`Input`、`PasswordInput`、`Textarea`、`Select`、`Combobox`、`Checkbox`、`RadioGroup`、`Switch`、`Modal`、`Drawer`、`Tabs`、`Toast`。
- forms: `FormField`、`FormRow`、`FormSection`、`FilePicker`。
- layout: `LoginShell`、`DesktopLayout`、`PageHeader`、`ContentPanel`、`SettingsSection`。
- data: `Table`、`DataTable`、`Pagination`、`FilterBar`、`SearchInput`、`DateRangePicker`、`ColumnSettings`、`StatusTag`、`AmountText`、`AddressText`、`CopyableText`、`SecretBlock`。
- feedback: `ErrorState`、`OfflineBanner`、`ProgressBar`。

## Table Preferences

`useTablePreferences` can persist table column visibility, column order, column width, sort state, density, and page size by key.
