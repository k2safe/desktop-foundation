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
pnpm visual:regression
```

If Playwright is installed, screenshots are captured into `examples/component-docs/__screenshots__`. Without Playwright, the script exits successfully and reports that screenshot capture was skipped.

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

## Rules

- Components must use `--df-*` CSS variables for visual decisions.
- Components must not include product-specific API, routes, menu codes, or permission logic.
- Components should expose controlled props first.
- Components should support `className` when practical.
