import "@desktop-foundation/ui-react/styles.css";
import { useState } from "react";
import { DebugPanel, DesktopAppShell } from "@desktop-foundation/app-shell";
import {
  AddressText,
  AmountText,
  Badge,
  Button,
  ColumnSettings,
  DataTable,
  DateRangePicker,
  DesktopLayout,
  Input,
  PageHeader,
  ProgressBar,
  SearchInput,
  Select,
  StatusTag,
  useDisclosure,
  useTablePreferences,
  type DesktopMenuItem,
  type TableColumn
} from "@desktop-foundation/ui-react";
import { demoTheme } from "./theme";

interface OrderRow {
  id: string;
  merchant: string;
  amount: string;
  address: string;
  status: string;
}

const menus: DesktopMenuItem[] = [
  { id: "dashboard", label: "工作台", href: "#dashboard", active: true },
  {
    id: "operations",
    label: "运营",
    children: [
      { id: "orders", label: "订单列表", href: "#orders" },
      { id: "merchants", label: "商户管理", href: "#merchants" }
    ]
  },
  {
    id: "system",
    label: "系统",
    children: [
      { id: "users", label: "用户权限", href: "#users" },
      { id: "settings", label: "系统设置", href: "#settings" }
    ]
  }
];

const rows: OrderRow[] = [
  { id: "D20260601001", merchant: "Acme", amount: "128.00", address: "0x8f3a3f24d1cc9086e31c6f971d976e724d42a9fe", status: "success" },
  { id: "D20260601002", merchant: "Northwind", amount: "256.50", address: "0x68292bd6a1f2f4c58a07bdb51f933cfd2a78e190", status: "pending" }
];

const columns: TableColumn<OrderRow>[] = [
  { key: "id", header: "订单号", accessor: "id", sortable: true, sticky: "left", minWidth: 150 },
  { key: "merchant", header: "商户", accessor: "merchant", sortable: true, minWidth: 120 },
  {
    key: "amount",
    header: "金额",
    render: (row) => <AmountText value={row.amount} currency="USD" sign="never" />,
    sortValue: (row) => Number(row.amount),
    sortable: true,
    align: "right",
    minWidth: 120
  },
  { key: "address", header: "地址", render: (row) => <AddressText value={row.address} copyable />, minWidth: 220 },
  { key: "status", header: "状态", render: (row) => <StatusTag status={row.status} /> }
];

export function App() {
  const [range, setRange] = useState({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const debug = useDisclosure();
  const { columnSettings, visibleColumns, sort, density, setColumnSettings, setSort, setDensity } = useTablePreferences({
    key: "demo-admin:orders-table",
    columns,
    defaultSort: { key: "id", direction: "desc" }
  });

  return (
    <DesktopAppShell
      theme={demoTheme}
      client={{
        product: "demo-admin",
        apiBaseURL: "http://127.0.0.1:8891"
      }}
    >
      <DesktopLayout
        brand={{ name: "Demo Admin" }}
        menus={menus}
        user={{ name: "Admin", role: "Owner" }}
        topbarRight={
          <>
            <Badge tone="success">Online</Badge>
            <Button variant="outline" size="sm" onClick={debug.show}>Debug</Button>
          </>
        }
      >
        <PageHeader title="工作台" description="一个不带业务记忆的桌面后台示例。" actions={<Button>新建</Button>} />
        <ProgressBar value={64} label="今日处理进度" />
        <DataTable
          title="最近订单"
          description="表格、筛选和分页由底座组件组合。"
          columns={visibleColumns}
          rows={rows}
          rowKey="id"
          selectable
          selectedRowKeys={selectedRowKeys}
          sort={sort}
          sortMode="client"
          density={density}
          actions={
            <>
              <Select
                value={density}
                options={[
                  { value: "compact", label: "紧凑" },
                  { value: "default", label: "默认" },
                  { value: "comfortable", label: "宽松" }
                ]}
                onChange={(event) => setDensity(event.target.value as typeof density)}
              />
              <ColumnSettings columns={columnSettings} onChange={setColumnSettings} />
            </>
          }
          batchActions={
            <>
              <Button variant="outline" size="sm">
                导出
              </Button>
              <Button variant="danger" size="sm">
                批量关闭
              </Button>
            </>
          }
          onSelectedRowKeysChange={setSelectedRowKeys}
          onSortChange={setSort}
          filters={
            <>
              <SearchInput placeholder="搜索订单号" />
              <Input placeholder="商户名称" />
              <Select
                placeholder="订单状态"
                options={[
                  { value: "success", label: "成功" },
                  { value: "pending", label: "处理中" }
                ]}
              />
              <DateRangePicker value={range} onChange={setRange} />
            </>
          }
          pagination={{ page: 1, pageSize: 10, total: 2, onPageChange: () => undefined }}
        />
      </DesktopLayout>
      <DebugPanel open={debug.open} onClose={debug.hide} appVersion="0.1.0" environment="demo" />
    </DesktopAppShell>
  );
}
