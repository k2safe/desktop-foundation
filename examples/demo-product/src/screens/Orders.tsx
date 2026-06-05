import { useMemo, useState } from "react";
import { PermissionGuard } from "@desktop-foundation/app-shell";
import {
  AdminDataTable,
  AdminDetailGrid,
  AdminDrawer,
  AdminFilterBar,
  AdminFormActions,
  AdminMetricCard,
  AdminPageShell,
  Button,
  ContentPanel,
  DateRangePicker,
  Input,
  SearchInput,
  Select,
  useLocale,
  useTablePreferences
} from "@desktop-foundation/ui-react";
import type { DesktopClient } from "@desktop-foundation/bridge";
import { createOrderColumns, orders, type OrderRow } from "../data";

export interface OrdersProps {
  client: DesktopClient;
}

export function Orders({ client }: OrdersProps) {
  const { t, format } = useLocale();
  const [range, setRange] = useState({});
  const [lastAction, setLastAction] = useState(t("product.orders.action.idle"));
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<OrderRow | null>(null);
  const orderColumns = useMemo(() => createOrderColumns(t), [t]);
  const selectedOrders = useMemo(() => orders.filter((order) => selectedRowKeys.includes(order.id)), [selectedRowKeys]);
  const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
  const pendingCount = orders.filter((order) => order.status === "pending").length;
  const riskCount = orders.filter((order) => order.status === "warning" || order.status === "danger").length;
  const selectedAmount = selectedOrders.reduce((sum, order) => sum + order.amount, 0);
  const { visibleColumns, sort, density, setSort, setDensity } = useTablePreferences({
    key: "product-demo:orders-table",
    columns: orderColumns,
    defaultSort: { key: "createdAt", direction: "desc" }
  });

  async function refreshOrders() {
    setLastAction(t("product.orders.action.refreshing"));
    await client.desktop.notify({ title: t("product.orders.title"), body: t("product.orders.action.refreshed") });
    setLastAction(t("product.orders.action.refreshed"));
  }

  async function exportRows(fileName: string, rows: unknown) {
    const path = await client.files.exportJson(fileName, rows, { directory: "/tmp" });
    setLastAction(t("product.orders.action.exported", { path }));
  }

  async function notifySelection() {
    const count = selectedRowKeys.length;
    await client.desktop.notify({ title: t("product.orders.title"), body: t("product.orders.action.notified", { count }) });
    setLastAction(t("product.orders.action.notified", { count }));
  }

  return (
    <AdminPageShell
      className="demo-orders-page"
      title={t("product.orders.title")}
      description={t("product.orders.description")}
      actions={
        <Select
          value={density}
          options={[
            { value: "compact", label: t("product.orders.density.compact") },
            { value: "default", label: t("product.orders.density.default") },
            { value: "comfortable", label: t("product.orders.density.comfortable") }
          ]}
          onChange={(event) => setDensity(event.target.value as typeof density)}
        />
      }
    >
      <div className="demo-orders-metrics">
        <AdminMetricCard label={t("product.orders.metric.total")} value={orders.length} hint={t("product.orders.metric.totalHint")} icon={<span>O</span>} tone="primary" />
        <AdminMetricCard label={t("product.orders.metric.amount")} value={format.currency(totalAmount, "USD")} hint="USD" icon={<span>$</span>} tone="success" />
        <AdminMetricCard label={t("product.orders.metric.pending")} value={pendingCount} hint={t("product.orders.metric.pendingHint")} icon={<span>P</span>} tone="warning" />
        <AdminMetricCard label={t("product.orders.metric.risk")} value={riskCount} hint={t("product.orders.metric.riskHint")} icon={<span>R</span>} tone="danger" />
      </div>
      <ContentPanel
        className="demo-orders-workbench"
        title={t("product.orders.workbenchTitle")}
        description={t("product.orders.workbenchDescription")}
        actions={
          <Button variant="outline" size="sm" onClick={() => void notifySelection()} disabled={!selectedRowKeys.length}>
            {t("product.orders.notifySelected")}
          </Button>
        }
      >
        <div className="demo-orders-workbench-grid">
          <div>
            <span>{t("product.orders.selectedCount")}</span>
            <strong>{selectedRowKeys.length}</strong>
          </div>
          <div>
            <span>{t("product.orders.selectedAmount")}</span>
            <strong>{format.currency(selectedAmount, "USD")}</strong>
          </div>
          <div>
            <span>{t("product.orders.lastAction")}</span>
            <strong>{lastAction}</strong>
          </div>
        </div>
      </ContentPanel>
      <AdminFilterBar
        className="demo-orders-filter"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refreshOrders()}>
              {t("product.orders.refresh")}
            </Button>
            <PermissionGuard permission="orders:export">
              <Button size="sm" onClick={() => void exportRows("orders.json", orders)}>
                {t("product.orders.export")}
              </Button>
            </PermissionGuard>
          </>
        }
      >
        <SearchInput placeholder={t("product.orders.search")} />
        <Input placeholder={t("product.orders.customer")} />
        <Select
          placeholder={t("product.orders.status")}
          options={[
            { value: "success", label: t("status.success") },
            { value: "pending", label: t("status.pending") },
            { value: "warning", label: t("status.warning") },
            { value: "danger", label: t("status.danger") }
          ]}
        />
        <DateRangePicker value={range} onChange={setRange} />
      </AdminFilterBar>
      <AdminDataTable
        title={t("product.orders.tableTitle")}
        description={t("product.orders.tableDescription")}
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
              <Button variant="outline" size="sm" onClick={() => void exportRows("selected-orders.json", selectedOrders)}>
                {t("product.orders.export")}
              </Button>
            </PermissionGuard>
            <Button variant="outline" size="sm" onClick={() => void notifySelection()}>
              {t("product.orders.notifySelected")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedRowKeys([]);
                setLastAction(t("product.orders.action.cleared"));
              }}
            >
              {t("product.orders.clear")}
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
            submitLabel={t("product.orders.notify")}
            cancelLabel={t("product.orders.close")}
            onCancel={() => setSelectedRow(null)}
            onSubmit={() => void client.desktop.notify({ title: t("product.orders.title"), body: selectedRow?.id })}
            submitVariant="outline"
          />
        }
        onClose={() => setSelectedRow(null)}
      >
        <AdminDetailGrid
          rows={[
            { label: t("product.orders.column.id"), value: selectedRow?.id },
            { label: t("product.orders.column.source"), value: selectedRow?.channel },
            { label: t("product.orders.column.status"), value: selectedRow?.status },
            { label: t("product.orders.column.amount"), value: selectedRow ? `$${selectedRow.amount.toFixed(2)} ${selectedRow.currency}` : null },
            { label: t("product.orders.column.createdAt"), value: selectedRow?.createdAt }
          ]}
        />
        <div className="df-admin-inline-actions">
          <Button variant="outline" size="sm" onClick={() => void client.desktop.copyText(selectedRow?.id ?? "")}>
            {t("product.orders.copyId")}
          </Button>
          <Button size="sm" onClick={() => void client.desktop.notify({ title: t("product.orders.title"), body: selectedRow?.id })}>
            {t("product.orders.desktopNotify")}
          </Button>
        </div>
      </AdminDrawer>
    </AdminPageShell>
  );
}
