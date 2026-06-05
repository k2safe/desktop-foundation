import type { CSSProperties, ReactNode } from "react";
import { useLocale } from "../../locale";
import { cn } from "../../utils/cn";
import { Button, type ButtonProps } from "../primitives/Button";
import { CopyableText, type DataTableProps, DataTable, FilterBar, StatusTag, type StatusTagProps } from "../data";
import { Drawer, type DrawerProps } from "../primitives/Drawer";
import { PageHeader } from "../layout/PageHeader";

export interface AdminPageShellProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function AdminPageShell({ title, description, eyebrow, actions, toolbar, footer, children, className, bodyClassName }: AdminPageShellProps) {
  return (
    <section className={cn("df-admin-page", className)}>
      <PageHeader title={title} description={description} eyebrow={eyebrow} actions={actions} />
      {toolbar ? <div className="df-admin-page__toolbar">{toolbar}</div> : null}
      <div className={cn("df-admin-page__body", bodyClassName)}>{children}</div>
      {footer ? <div className="df-admin-page__footer">{footer}</div> : null}
    </section>
  );
}

export interface AdminToolbarProps {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminToolbar({ title, description, children, actions, className }: AdminToolbarProps) {
  return (
    <div className={cn("df-admin-toolbar", className)}>
      {title || description ? (
        <div className="df-admin-toolbar__copy">
          {title ? <div className="df-admin-toolbar__title">{title}</div> : null}
          {description ? <div className="df-admin-toolbar__description">{description}</div> : null}
        </div>
      ) : null}
      {children ? <div className="df-admin-toolbar__content">{children}</div> : null}
      {actions ? <div className="df-admin-toolbar__actions">{actions}</div> : null}
    </div>
  );
}

export interface AdminFilterBarProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminFilterBar({ children, actions, className }: AdminFilterBarProps) {
  return (
    <FilterBar className={cn("df-admin-filter-bar", className)} actions={actions}>
      {children}
    </FilterBar>
  );
}

export interface AdminDataTableProps<T> extends DataTableProps<T> {
  wrapperClassName?: string;
}

export function AdminDataTable<T>({ wrapperClassName, density = "compact", ...props }: AdminDataTableProps<T>) {
  return (
    <div className={cn("df-admin-data-table", wrapperClassName)}>
      <DataTable {...props} density={density} />
    </div>
  );
}

export interface AdminMetricCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function AdminMetricCard({ label, value, hint, trend, icon, tone = "neutral", className }: AdminMetricCardProps) {
  return (
    <section className={cn("df-admin-metric-card", `df-admin-metric-card--${tone}`, className)}>
      <div className="df-admin-metric-card__header">
        <div className="df-admin-metric-card__label">{label}</div>
        {icon ? <div className="df-admin-metric-card__icon">{icon}</div> : null}
      </div>
      <div className="df-admin-metric-card__value">{value}</div>
      {hint || trend ? (
        <div className="df-admin-metric-card__footer">
          {hint ? <span>{hint}</span> : null}
          {trend ? <span className="df-admin-metric-card__trend">{trend}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

export interface AdminStatusPillProps extends Omit<StatusTagProps, "status"> {
  status: string | boolean;
}

export function AdminStatusPill({ status, label, tone }: AdminStatusPillProps) {
  const normalized = typeof status === "boolean" ? (status ? "active" : "disabled") : status;
  return <StatusTag status={normalized} label={label} tone={tone} />;
}

export interface AdminDrawerProps extends Omit<DrawerProps, "className" | "style"> {
  width?: number | string;
  className?: string;
}

function drawerWidth(value?: number | string): string | undefined {
  if (typeof value === "number") return `${value}px`;
  return value;
}

export function AdminDrawer({ width = 640, className, ...props }: AdminDrawerProps) {
  const style = { width: drawerWidth(width) } as CSSProperties;
  return <Drawer {...props} className={cn("df-admin-drawer", className)} style={style} />;
}

export interface AdminDetailGridRow {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export interface AdminDetailGridProps {
  rows: AdminDetailGridRow[];
  columns?: 1 | 2;
  className?: string;
}

export function AdminDetailGrid({ rows, columns = 1, className }: AdminDetailGridProps) {
  return (
    <dl className={cn("df-admin-detail-grid", `df-admin-detail-grid--${columns}`, className)}>
      {rows.map((row, index) => (
        <div className="df-admin-detail-grid__row" key={index}>
          <dt>{row.label}</dt>
          <dd>
            <span>{row.value ?? "-"}</span>
            {row.hint ? <small>{row.hint}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface AdminMonoProps {
  children?: ReactNode;
  copyValue?: string;
  className?: string;
}

export function AdminMono({ children, copyValue, className }: AdminMonoProps) {
  const value = String(children ?? copyValue ?? "-");
  return (
    <span className={cn("df-admin-mono", className)}>
      {copyValue ? <CopyableText value={copyValue}>{value}</CopyableText> : <span className="df-admin-mono__value">{value}</span>}
    </span>
  );
}

export interface AdminCellTextProps {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function AdminCellText({ title, description, meta, className }: AdminCellTextProps) {
  return (
    <span className={cn("df-admin-cell-text", className)}>
      <span className="df-admin-cell-text__title">{title}</span>
      {description ? <span className="df-admin-cell-text__description">{description}</span> : null}
      {meta ? <span className="df-admin-cell-text__meta">{meta}</span> : null}
    </span>
  );
}

export interface AdminFormActionsProps {
  submitLabel?: ReactNode;
  cancelLabel?: ReactNode;
  savingLabel?: ReactNode;
  saving?: boolean;
  form?: string;
  submitVariant?: ButtonProps["variant"];
  onSubmit?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function AdminFormActions({
  submitLabel,
  cancelLabel,
  savingLabel,
  saving,
  form,
  submitVariant = "primary",
  onSubmit,
  onCancel,
  className
}: AdminFormActionsProps) {
  const { t } = useLocale();
  return (
    <div className={cn("df-admin-form-actions", className)}>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
      ) : null}
      <Button type={form ? "submit" : "button"} form={form} variant={submitVariant} loading={saving} onClick={onSubmit}>
        {saving ? savingLabel ?? t("common.loading") : submitLabel ?? t("common.save", undefined, "Save")}
      </Button>
    </div>
  );
}
