import { useState } from "react";
import { Button, DataTable, DateRangePicker, DetailDrawer, Input, SearchInput, Select, useTablePreferences } from "@desktop-foundation/ui-react";
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
    key: "demo-product:orders-table",
    columns: orderColumns,
    defaultSort: { key: "createdAt", direction: "desc" }
  });

  return (
    <>
      <DataTable
        title="订单中心"
        description="产品项目只负责业务字段和交互，表格能力来自底座组件。"
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
        filters={
          <>
            <SearchInput placeholder="搜索订单号" />
            <Input placeholder="商户名称" />
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
          </>
        }
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
        batchActions={
          <>
            <Button variant="outline" size="sm" onClick={() => void client.files.exportJson("selected-orders.json", selectedRowKeys, { directory: "/tmp" })}>
              导出
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedRowKeys([])}>
              清空
            </Button>
          </>
        }
        pagination={{ page: 1, pageSize: 10, total: orders.length, onPageChange: () => undefined }}
      />
      <DetailDrawer
        open={Boolean(selectedRow)}
        title={selectedRow?.merchant ?? ""}
        subtitle={selectedRow?.id}
        rows={[
          { label: "渠道", value: selectedRow?.channel },
          { label: "状态", value: selectedRow?.status },
          { label: "金额", value: selectedRow ? `$${selectedRow.amount.toFixed(2)} ${selectedRow.currency}` : null },
          { label: "创建时间", value: selectedRow?.createdAt }
        ]}
        actions={[
          { id: "copy", label: "复制订单号", onClick: () => void client.desktop.copyText(selectedRow?.id ?? "") },
          { id: "notify", label: "发送通知", onClick: () => void client.desktop.notify({ title: "订单已选中", body: selectedRow?.id }) }
        ]}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
}
