# AdminKit

AdminKit 是管理端真实业务页面的标准布局层。它沉淀运营后台常见页面形状，不包含产品接口、路由、权限模型或业务字段。

优先在 `ops-admin` 模板下使用：

```tsx
import { createThemeTemplateRuntime } from "@desktop-foundation/theme-presets";

const template = createThemeTemplateRuntime("ops-admin", {
  brand: { name: "Product Admin" }
});
```

## Components

- `AdminPageShell`: 页面标题、描述、右侧动作和主体区。
- `AdminToolbar`: 页面内工具条，用于局部说明、视图切换和操作。
- `AdminFilterBar`: 紧凑筛选区，默认横向排列。
- `AdminDataTable`: 管理端表格入口，默认 `density="compact"`。
- `AdminMetricCard`: 工作台指标卡，克制边框和轻阴影。
- `AdminStatusPill`: 状态小标签，复用底座状态色。
- `AdminDrawer`: 管理端右侧抽屉，默认宽度 640px。
- `AdminDetailGrid`: 抽屉或详情页内的字段摘要网格。
- `AdminMono`: 编号、地址、hash 等等宽文本。
- `AdminCellText`: 表格单元格主副文本结构。
- `AdminFormActions`: 抽屉和表单底部操作区。

## List Page Shape

```tsx
import { AdminDataTable, AdminFilterBar, AdminPageShell, Button, SearchInput, Select } from "@desktop-foundation/ui-react";

export function OrdersPage() {
  return (
    <AdminPageShell title="订单中心" description="高频运营列表页。">
      <AdminFilterBar
        actions={
          <>
            <Button variant="outline" size="sm">刷新</Button>
            <Button size="sm">导出</Button>
          </>
        }
      >
        <SearchInput placeholder="搜索订单号 / 商户" />
        <Select placeholder="状态" options={statusOptions} />
      </AdminFilterBar>
      <AdminDataTable columns={columns} rows={rows} rowKey="id" pagination={pagination} />
    </AdminPageShell>
  );
}
```

## Drawer Shape

```tsx
<AdminDrawer
  open={open}
  title="商户详情"
  footer={<AdminFormActions submitLabel="保存" onCancel={close} />}
  onClose={close}
>
  <AdminDetailGrid rows={detailRows} />
</AdminDrawer>
```

## Rules

- 不要把品牌色铺满页面、表头或卡片背景。
- 宽表格使用 `AdminDataTable` 或底座 `Table/DataTable`，不要让页面整体横向滚动。
- 筛选项保持紧凑横排；复杂高级筛选放抽屉或弹窗。
- 详情编辑优先使用 `AdminDrawer`，不要在页面里自建移动端式弹层。
- 金额、编号、hash、状态字段优先使用 `AmountText`、`AdminMono`、`AdminStatusPill`、`AdminCellText`。
