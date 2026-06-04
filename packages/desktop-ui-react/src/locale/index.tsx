import { createContext, useContext, useMemo, type ReactNode } from "react";

export type LocaleCode = "zh-CN" | "en-US" | (string & {});
export type LocaleMessageValue = string | number;
export type LocaleMessageValues = Record<string, LocaleMessageValue>;
export type LocaleDictionary = Record<string, string>;

export interface LocaleContextValue {
  locale: LocaleCode;
  messages: LocaleDictionary;
  t: (key: string, values?: LocaleMessageValues, fallback?: string) => string;
}

export interface LocaleProviderProps {
  locale?: LocaleCode;
  messages?: LocaleDictionary;
  dictionaries?: Record<string, LocaleDictionary>;
  children: ReactNode;
}

export const zhCNMessages: LocaleDictionary = {
  "access.deniedDescription": "当前账号没有访问此功能的权限。",
  "access.deniedTitle": "无权访问",
  "common.apply": "应用",
  "common.cancel": "取消",
  "common.clear": "清空",
  "common.close": "关闭",
  "common.confirm": "确认",
  "common.copy": "复制",
  "common.copied": "已复制",
  "common.hide": "隐藏",
  "common.loading": "加载中",
  "common.next": "下一页",
  "common.previous": "上一页",
  "common.show": "显示",
  "combobox.empty": "暂无选项",
  "combobox.search": "搜索",
  "command.close": "关闭命令面板",
  "command.empty": "暂无命令",
  "command.group": "命令",
  "command.search": "搜索命令",
  "command.title": "命令",
  "dataTable.selected": "已选择 {count} 项",
  "dateRange.end": "结束日期",
  "dateRange.start": "开始日期",
  "debug.clearRequests": "清空请求",
  "debug.noRequests": "暂无请求记录。",
  "debug.requests": "请求",
  "debug.runtime": "运行时",
  "debug.session": "会话",
  "debug.title": "调试面板",
  "debug.unknown": "未知",
  "layout.editProfile": "编辑个人信息",
  "layout.logout": "退出登录",
  "layout.mainMenu": "主菜单",
  "layout.topMenu": "顶部菜单",
  "layout.user": "用户",
  "login.account": "账号",
  "login.accountPlaceholder": "账号或邮箱",
  "login.brandPanelSubtitle": "使用产品账号继续。",
  "login.brandPanelTitle": "登录",
  "login.brandPanelVisualDescription": "品牌、登录文案、业务字段和认证逻辑都留在产品适配层。",
  "login.brandPanelVisualTitle": "一个底座，业务归产品。",
  "login.centerCardSubtitle": "登录后继续。",
  "login.centerCardTitle": "欢迎回来",
  "login.continue": "继续",
  "login.password": "密码",
  "login.passwordPlaceholder": "密码",
  "login.remember": "记住我",
  "login.secureDesktop": "安全桌面",
  "login.signIn": "登录",
  "login.splitSubtitle": "进入桌面工作区。",
  "login.splitTitle": "登录",
  "login.splitVisualDescription": "可复用的桌面壳，用于安全的产品流程、本地能力和版本更新。",
  "login.splitVisualTitle": "面向桌面的业务操作。",
  "login.workbenchSubtitle": "打开桌面命令工作区。",
  "login.workbenchTitle": "操作员登录",
  "login.workbenchVisualDescription": "高密度布局、本地 bridge 能力、更新检查和产品自有认证。",
  "login.workbenchVisualTitle": "为高频运营工作而建。",
  "modal.close": "关闭",
  "offline.message": "当前网络不可用",
  "pagination.next": "下一页",
  "pagination.previous": "上一页",
  "search.label": "搜索",
  "search.placeholder": "搜索",
  "settings.sections": "设置分组",
  "status.active": "启用",
  "status.danger": "失败",
  "status.disabled": "停用",
  "status.enabled": "启用",
  "status.error": "异常",
  "status.failed": "失败",
  "status.inactive": "停用",
  "status.normal": "正常",
  "status.online": "在线",
  "status.pending": "处理中",
  "status.processing": "处理中",
  "status.queued": "队列中",
  "status.reviewing": "需复核",
  "status.running": "运行中",
  "status.success": "成功",
  "status.succeeded": "成功",
  "status.warning": "需复核",
  "table.emptyTitle": "暂无数据",
  "table.selectAll": "选择全部",
  "table.selectRow": "选择行 {key}",
  "toast.close": "关闭通知",
  "toast.region": "通知",
  "columns.settings": "列设置",
  "columns.reset": "全部显示",
  "columns.moveUp": "上移",
  "columns.moveDown": "下移",
  "error.title": "出现错误",
  "filePicker.choose": "选择文件",
  "filePicker.empty": "未选择文件"
};

export const enUSMessages: LocaleDictionary = {
  "access.deniedDescription": "Your account does not have access to this feature.",
  "access.deniedTitle": "Access denied",
  "common.apply": "Apply",
  "common.cancel": "Cancel",
  "common.clear": "Clear",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.copy": "Copy",
  "common.copied": "Copied",
  "common.hide": "Hide",
  "common.loading": "Loading",
  "common.next": "Next",
  "common.previous": "Previous",
  "common.show": "Show",
  "combobox.empty": "No options",
  "combobox.search": "Search",
  "command.close": "Close command palette",
  "command.empty": "No commands",
  "command.group": "Commands",
  "command.search": "Search commands",
  "command.title": "Command",
  "dataTable.selected": "{count} selected",
  "dateRange.end": "End date",
  "dateRange.start": "Start date",
  "debug.clearRequests": "Clear requests",
  "debug.noRequests": "No requests recorded.",
  "debug.requests": "Requests",
  "debug.runtime": "Runtime",
  "debug.session": "Session",
  "debug.title": "Debug Panel",
  "debug.unknown": "unknown",
  "layout.editProfile": "Edit profile",
  "layout.logout": "Log out",
  "layout.mainMenu": "Main menu",
  "layout.topMenu": "Top menu",
  "layout.user": "User",
  "login.account": "Account",
  "login.accountPlaceholder": "Account or email",
  "login.brandPanelSubtitle": "Use your product account to continue.",
  "login.brandPanelTitle": "Sign in",
  "login.brandPanelVisualDescription": "Keep brand, login copy, business fields, and authentication inside the product adapter.",
  "login.brandPanelVisualTitle": "One foundation, product-owned business.",
  "login.centerCardSubtitle": "Sign in to continue.",
  "login.centerCardTitle": "Welcome back",
  "login.continue": "Continue",
  "login.password": "Password",
  "login.passwordPlaceholder": "Password",
  "login.remember": "Remember me",
  "login.secureDesktop": "Secure desktop",
  "login.signIn": "Sign in",
  "login.splitSubtitle": "Access the desktop workspace.",
  "login.splitTitle": "Sign in",
  "login.splitVisualDescription": "A reusable shell for secure product workflows, local capabilities, and release updates.",
  "login.splitVisualTitle": "Desktop-ready operations.",
  "login.workbenchSubtitle": "Open the desktop command workspace.",
  "login.workbenchTitle": "Operator sign in",
  "login.workbenchVisualDescription": "Dense layouts, local bridge capabilities, update checks, and product-owned authentication.",
  "login.workbenchVisualTitle": "Built for repeated operational work.",
  "modal.close": "Close",
  "offline.message": "Network unavailable",
  "pagination.next": "Next",
  "pagination.previous": "Previous",
  "search.label": "Search",
  "search.placeholder": "Search",
  "settings.sections": "Settings sections",
  "status.active": "Active",
  "status.danger": "Failed",
  "status.disabled": "Disabled",
  "status.enabled": "Enabled",
  "status.error": "Error",
  "status.failed": "Failed",
  "status.inactive": "Inactive",
  "status.normal": "Normal",
  "status.online": "Online",
  "status.pending": "Pending",
  "status.processing": "Processing",
  "status.queued": "Queued",
  "status.reviewing": "Needs review",
  "status.running": "Running",
  "status.success": "Success",
  "status.succeeded": "Succeeded",
  "status.warning": "Needs review",
  "table.emptyTitle": "No data",
  "table.selectAll": "Select all",
  "table.selectRow": "Select row {key}",
  "toast.close": "Close notification",
  "toast.region": "Notifications",
  "columns.settings": "Column settings",
  "columns.reset": "Show all",
  "columns.moveUp": "Move up",
  "columns.moveDown": "Move down",
  "error.title": "Something went wrong",
  "filePicker.choose": "Choose file",
  "filePicker.empty": "No file selected"
};

export const builtinLocaleDictionaries: Record<string, LocaleDictionary> = {
  "zh-CN": zhCNMessages,
  "en-US": enUSMessages
};

function formatMessage(template: string, values?: LocaleMessageValues) {
  if (!values) return template;
  return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

function createLocaleContextValue(locale: LocaleCode, messages: LocaleDictionary): LocaleContextValue {
  return {
    locale,
    messages,
    t: (key, values, fallback) => formatMessage(messages[key] ?? fallback ?? key, values)
  };
}

const defaultLocaleContext = createLocaleContextValue("zh-CN", zhCNMessages);
const LocaleContext = createContext<LocaleContextValue>(defaultLocaleContext);

export function LocaleProvider({ locale = "zh-CN", messages, dictionaries, children }: LocaleProviderProps) {
  const value = useMemo(() => {
    const mergedMessages = {
      ...zhCNMessages,
      ...(builtinLocaleDictionaries[locale] ?? {}),
      ...(dictionaries?.[locale] ?? {}),
      ...(messages ?? {})
    };
    return createLocaleContextValue(locale, mergedMessages);
  }, [dictionaries, locale, messages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
