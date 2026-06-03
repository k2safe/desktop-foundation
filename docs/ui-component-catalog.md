# UI Component Catalog

## Primitives

- `Button`
- `IconButton`
- `Input`
- `PasswordInput`
- `Textarea`
- `Select`
- `Combobox`
- `Checkbox`
- `Radio`
- `RadioGroup`
- `Switch`
- `Badge`
- `Card`
- `Modal`
- `ConfirmDialog`
- `ConfirmProvider`
- `Drawer`
- `Tabs`
- `ToastProvider`
- `Tooltip`
- `CommandPalette`
- `EmptyState`
- `LoadingBlock`

## Forms

- `FormField`
- `FormRow`
- `FormSection`
- `FilePicker`

## Layout

- `LoginShell`
- `DesktopLayout`
- `Sidebar`
- `Topbar`
- `PageHeader`
- `ContentPanel`
- `SettingsSection`
- `SettingsPage`
- `DetailDrawer`

## Data

- `Table`
- `DataTable`
- `EditableTable`
- `Pagination`
- `FilterBar`
- `BulkActionBar`
- `MetricGrid`
- `SearchInput`
- `DateRangePicker`
- `ColumnSettings`
- `StatusTag`
- `AmountText`
- `AddressText`
- `CopyableText`
- `SecretBlock`
- `CodeBlock`

Table capabilities:

- Controlled sorting through `sort` and `onSortChange`.
- Optional client sorting through `sortMode="client"`.
- Controlled row selection through `selectedRowKeys`.
- Batch action bar in `DataTable`.
- Column display preferences through `ColumnSettings`.
- Table preference persistence through `useTablePreferences`.
- Column ordering, width, density, and sort preferences.

## Visual Fixture

`examples/component-docs/index.html` is a zero-dependency component documentation page. It renders the core desktop surfaces using the shared CSS class contract, so product teams can inspect the foundation UI without Storybook or a dev server.

Run:

```bash
pnpm visual:regression:update
pnpm visual:regression
```

The visual workflow covers the built-in `default`, `admin`, `command`, `topnav-ops`, `merchant`, `ledger`, `studio`, and `dark` templates at desktop and mobile widths. Update mode writes baselines into `examples/component-docs/__screenshots__`; compare mode writes current captures into `examples/component-docs/__screenshots__/.actual` and fails when a baseline is missing or different. Without Playwright, the script exits successfully and reports that screenshot capture was skipped.

## App Shell

`@desktop-foundation/app-shell` provides:

- `DesktopAppShell`
- `DesktopClientProvider`
- `SessionProvider`
- `AuthGuard`
- `DesktopLoginPage`
- `PermissionGuard`
- `FeatureGuard`
- `DebugPanel`
- `useDesktopClient`
- `useSession`
- `useLogin`
- `useRequest`
- `useMutation`

## Feedback

- `ErrorState`
- `OfflineBanner`
- `ProgressBar`

Feedback usage:

```tsx
const toast = useToast();
toast.notify({ title: "保存成功", tone: "success" });

<OfflineBanner visible={!online} message="当前网络不可用" />
```

`useToast()` exposes `notify` and `dismiss`. `OfflineBanner` uses `visible` to control rendering.

## Rules

- Components must use `--df-*` CSS variables for visual decisions.
- Components must not include product-specific API, routes, menu codes, or permission logic.
- Components should expose controlled props first.
- Components should support `className` when practical.
