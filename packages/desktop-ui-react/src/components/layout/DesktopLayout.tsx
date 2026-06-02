import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Button } from "../primitives/Button";

export interface DesktopUser {
  name?: string;
  account?: string;
  role?: string;
  avatar?: ReactNode;
}

export interface DesktopMenuItem {
  id: string;
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  children?: DesktopMenuItem[];
}

export interface DesktopLayoutBrand {
  name: string;
  logo?: ReactNode;
  mark?: ReactNode;
}

export type DesktopLayoutVariant = "sidebar" | "topnav";

export interface DesktopLayoutProps {
  brand: DesktopLayoutBrand;
  menus: DesktopMenuItem[];
  variant?: DesktopLayoutVariant;
  user?: DesktopUser;
  topbarLeft?: ReactNode;
  topbarRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  logoutLabel?: string;
  onLogout?: () => void;
  onMenuSelect?: (item: DesktopMenuItem) => void;
}

function MenuEntry({ item, depth = 0, onSelect }: { item: DesktopMenuItem; depth?: number; onSelect?: (item: DesktopMenuItem) => void }) {
  const hasChildren = Boolean(item.children?.length);
  const content = (
    <>
      {item.icon ? <span className="df-sidebar__item-icon">{item.icon}</span> : null}
      <span className="df-sidebar__item-label">{item.label}</span>
    </>
  );

  return (
    <li className={cn("df-sidebar__node", hasChildren && "has-children")}>
      {hasChildren ? (
        <>
          <div className="df-sidebar__group-label">{content}</div>
          <ul className="df-sidebar__group">
            {item.children?.map((child) => (
              <MenuEntry key={child.id} item={child} depth={depth + 1} onSelect={onSelect} />
            ))}
          </ul>
        </>
      ) : (
        <a
          className={cn("df-sidebar__item", item.active && "is-active", item.disabled && "is-disabled")}
          href={item.disabled ? undefined : item.href}
          aria-current={item.active ? "page" : undefined}
          onClick={(event) => {
            if (item.disabled) {
              event.preventDefault();
              return;
            }
            onSelect?.(item);
          }}
        >
          {content}
        </a>
      )}
    </li>
  );
}

export function Sidebar({ brand, menus, footer, onMenuSelect }: Pick<DesktopLayoutProps, "brand" | "menus" | "footer" | "onMenuSelect">) {
  return (
    <aside className="df-sidebar">
      <div className="df-sidebar__brand">
        {brand.logo ?? brand.mark ? <span className="df-sidebar__logo">{brand.logo ?? brand.mark}</span> : null}
        {!brand.logo ? <span className="df-sidebar__brand-name">{brand.name}</span> : null}
      </div>
      <nav className="df-sidebar__nav" aria-label="主菜单">
        <ul className="df-sidebar__list">
          {menus.map((item) => (
            <MenuEntry key={item.id} item={item} onSelect={onMenuSelect} />
          ))}
        </ul>
      </nav>
      {footer ? <div className="df-sidebar__footer">{footer}</div> : null}
    </aside>
  );
}

function hasActiveChild(item: DesktopMenuItem): boolean {
  return Boolean(item.active || item.children?.some((child) => hasActiveChild(child)));
}

function TopNavigationEntry({ item, onSelect }: { item: DesktopMenuItem; onSelect?: (item: DesktopMenuItem) => void }) {
  const hasChildren = Boolean(item.children?.length);
  const active = hasActiveChild(item);
  const content = (
    <>
      {item.icon ? <span className="df-topnav__item-icon">{item.icon}</span> : null}
      <span className="df-topnav__item-label">{item.label}</span>
    </>
  );

  if (hasChildren) {
    return (
      <li className={cn("df-topnav__node", "has-children", active && "is-active")}>
        <button className={cn("df-topnav__item", active && "is-active")} type="button" disabled={item.disabled}>
          {content}
          <span className="df-topnav__chevron" aria-hidden="true" />
        </button>
        <ul className="df-topnav__dropdown">
          {item.children?.map((child) => (
            <li key={child.id}>
              <a
                className={cn("df-topnav__dropdown-item", child.active && "is-active", child.disabled && "is-disabled")}
                href={child.disabled ? undefined : child.href}
                aria-current={child.active ? "page" : undefined}
                onClick={(event) => {
                  if (child.disabled) {
                    event.preventDefault();
                    return;
                  }
                  onSelect?.(child);
                }}
              >
                {child.icon ? <span className="df-topnav__item-icon">{child.icon}</span> : null}
                <span>{child.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <li className={cn("df-topnav__node", active && "is-active")}>
      <a
        className={cn("df-topnav__item", item.active && "is-active", item.disabled && "is-disabled")}
        href={item.disabled ? undefined : item.href}
        aria-current={item.active ? "page" : undefined}
        onClick={(event) => {
          if (item.disabled) {
            event.preventDefault();
            return;
          }
          onSelect?.(item);
        }}
      >
        {content}
      </a>
    </li>
  );
}

export function TopNavigation({ menus, onMenuSelect }: Pick<DesktopLayoutProps, "menus" | "onMenuSelect">) {
  return (
    <nav className="df-topnav" aria-label="顶部菜单">
      <ul className="df-topnav__list">
        {menus.map((item) => (
          <TopNavigationEntry key={item.id} item={item} onSelect={onMenuSelect} />
        ))}
      </ul>
    </nav>
  );
}

export function Topbar({
  user,
  left,
  right,
  brand,
  menus,
  logoutLabel = "退出登录",
  onLogout,
  onMenuSelect
}: {
  user?: DesktopUser;
  left?: ReactNode;
  right?: ReactNode;
  brand?: DesktopLayoutBrand;
  menus?: DesktopMenuItem[];
  logoutLabel?: string;
  onLogout?: () => void;
  onMenuSelect?: (item: DesktopMenuItem) => void;
}) {
  const initial = (user?.name || user?.account || "U").slice(0, 1).toUpperCase();

  return (
    <header className="df-topbar">
      <div className="df-topbar__left">
        {brand ? (
          <div className="df-topbar__brand">
            {brand.logo ?? brand.mark ? <span className="df-topbar__brand-logo">{brand.logo ?? brand.mark}</span> : null}
            {!brand.logo ? <span className="df-topbar__brand-name">{brand.name}</span> : null}
          </div>
        ) : null}
        {menus ? <TopNavigation menus={menus} onMenuSelect={onMenuSelect} /> : null}
        {left}
      </div>
      <div className="df-topbar__right">
        {right}
        {user ? (
          <div className="df-user-chip">
            <span className="df-user-chip__avatar">{user.avatar ?? initial}</span>
            <span className="df-user-chip__meta">
              <span className="df-user-chip__name">{user.name || user.account}</span>
              {user.role ? <span className="df-user-chip__role">{user.role}</span> : null}
            </span>
          </div>
        ) : null}
        {onLogout ? (
          <Button variant="ghost" size="sm" onClick={onLogout}>
            {logoutLabel}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

export function DesktopLayout({
  brand,
  menus,
  variant = "sidebar",
  user,
  topbarLeft,
  topbarRight,
  footer,
  children,
  className,
  logoutLabel,
  onLogout,
  onMenuSelect
}: DesktopLayoutProps) {
  const topnav = variant === "topnav";

  return (
    <div className={cn("df-desktop-layout", `df-desktop-layout--${variant}`, className)}>
      {topnav ? null : <Sidebar brand={brand} menus={menus} footer={footer} onMenuSelect={onMenuSelect} />}
      <div className="df-desktop-layout__main">
        <Topbar
          user={user}
          left={topbarLeft}
          right={topbarRight}
          brand={topnav ? brand : undefined}
          menus={topnav ? menus : undefined}
          logoutLabel={logoutLabel}
          onLogout={onLogout}
          onMenuSelect={onMenuSelect}
        />
        <main className="df-desktop-layout__content">{children}</main>
      </div>
    </div>
  );
}
