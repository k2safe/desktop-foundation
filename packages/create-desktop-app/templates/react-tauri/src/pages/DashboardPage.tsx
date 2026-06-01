import {
  Badge,
  Button,
  ContentPanel,
  DataTable,
  EmptyState,
  StatusTag,
  type TableColumn
} from "@desktop-foundation/ui-react";

interface DemoRow {
  id: string;
  name: string;
  status: string;
}

const rows: DemoRow[] = [
  { id: "1", name: "Example record", status: "active" }
];

const columns: TableColumn<DemoRow>[] = [
  { key: "id", header: "ID", accessor: "id", width: 80 },
  { key: "name", header: "Name", accessor: "name" },
  { key: "status", header: "Status", render: (row) => <StatusTag status={row.status} /> }
];

export function DashboardPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ContentPanel
        title="Product workspace"
        description="Replace this page with product routes and business screens."
        actions={<Badge tone="success">Ready</Badge>}
      >
        <EmptyState
          title="Start building"
          description="Use desktop-foundation components for layout, forms, tables, and feedback states."
          action={<Button>Primary action</Button>}
        />
      </ContentPanel>

      <DataTable title="Example table" columns={columns} rows={rows} rowKey="id" />
    </div>
  );
}
