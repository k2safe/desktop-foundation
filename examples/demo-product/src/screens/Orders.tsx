import { useState } from "react";
import { PermissionGuard } from "@desktop-foundation/app-shell";
import {
  AdminDataTable,
  AdminDetailGrid,
  AdminDrawer,
  AdminFilterBar,
  AdminFormActions,
  AdminPageShell,
  Button,
  DateRangePicker,
  Input,
  SearchInput,
  Select,
  useTablePreferences
} from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { orderColumns, orders, type OrderRow } from "../data";

export interface OrdersProps {
  client: DesktopClient;
}

export function Orders({ client }: OrdersProps) {
  const [range, setRange] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<OrderRow | null>(null);
  const { visibleColumns, sort, density, setSort, setDensity } = useTablePreferences({
    key: "product-demo:orders-table",
    columns: orderColumns,
    defaultSort: { key: "createdAt", direction: "desc" }
  });

  return (
    <AdminPageShell
      title="订单中心"
      description="产品项目只负责订单字段和交互；管理端页面密度、表格、筛选和抽屉来自底座 AdminKit。"
      actions={
        <Select
          value={density}
          options={[
            { value: "compact", label: "紧凑" },
            { value: "default", label: "默认" },
            { value: "comfortable", label: "宽松" }
          ]}
          onChange={(event) => setDensity(event.target.value as typeof density)}
        />
      }
    >
      <AdminFilterBar
        actions={
          <>
            <Button variant="outline" size="sm">
              刷新
            </Button>
            <PermissionGuard permission="orders:export">
              <Button size="sm" onClick={() => void client.files.exportJson("orders.json", orders, { directory: "/tmp" })}>
                导出
              </Button>
            </PermissionGuard>
          </>
        }
      >
        <SearchInput placeholder="搜索订单号 / 客户" />
        <Input placeholder="客户名称" />
        <Select
          placeholder="状态"
          options={[
            { value: "success", label: "成功" },
            { value: "pending", label: "处理中" },
            { value: "warning", label: "需复核" },
            { value: "danger", label: "失败" }
          ]}
        />
        <DateRangePicker value={range} onChange={setRange} />
      </AdminFilterBar>
      <AdminDataTable
        title="订单列表"
        description="紧凑行高、横向滚动、批量操作和分页是管理端默认形态。"
        columns={visibleColumns}
        rows={orders}
        rowKey="id"
        selectable
        selectedRowKeys={selectedRowKeys}
        sort={sort}
        sortMode="client"
        density={density}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onSortChange={setSort}
        onRowClick={(row) => setSelectedRow(row)}
        batchActions={
          <>
            <PermissionGuard permission="orders:export">
              <Button variant="outline" size="sm" onClick={() => void client.files.exportJson("selected-orders.json", selectedRowKeys, { directory: "/tmp" })}>
                导出
              </Button>
            </PermissionGuard>
            <Button variant="ghost" size="sm" onClick={() => setSelectedRowKeys([])}>
              清空
            </Button>
          </>
        }
        pagination={{ page: 1, pageSize: 10, total: orders.length, onPageChange: () => undefined }}
      />
      <AdminDrawer
        open={Boolean(selectedRow)}
        title={selectedRow?.merchant ?? ""}
        width={620}
        footer={
          <AdminFormActions
            submitLabel="发送通知"
            cancelLabel="关闭"
            onCancel={() => setSelectedRow(null)}
            onSubmit={() => void client.desktop.notify({ title: "订单已选中", body: selectedRow?.id })}
            submitVariant="outline"
          />
        }
        onClose={() => setSelectedRow(null)}
      >
        <AdminDetailGrid
          rows={[
            { label: "订单号", value: selectedRow?.id },
            { label: "来源", value: selectedRow?.channel },
            { label: "状态", value: selectedRow?.status },
            { label: "金额", value: selectedRow ? `$${selectedRow.amount.toFixed(2)} ${selectedRow.currency}` : null },
            { label: "创建时间", value: selectedRow?.createdAt }
          ]}
        />
        <div className="df-admin-inline-actions">
          <Button variant="outline" size="sm" onClick={() => void client.desktop.copyText(selectedRow?.id ?? "")}>
            复制订单号
          </Button>
          <Button size="sm" onClick={() => void client.desktop.notify({ title: "订单已选中", body: selectedRow?.id })}>
            桌面通知
          </Button>
        </div>
      </AdminDrawer>
    </AdminPageShell>
  );
}
