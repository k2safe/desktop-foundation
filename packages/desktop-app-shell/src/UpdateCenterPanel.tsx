import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  AppUpdateCheckResult,
  AppUpdateInstallResult,
  AppUpdateState,
  DesktopClient,
  DownloadFileResult
} from "@desktop-foundation/bridge";
import { Button, CodeBlock, MetricGrid, PageHeader, StatusTag } from "@desktop-foundation/ui-react";
import { useDesktopClient } from "./DesktopClientProvider";

export type UpdateCenterAction = "check" | "download" | "install" | "releasePage";

export interface UpdateCenterPanelLabels {
  title: ReactNode;
  description: ReactNode;
  check: ReactNode;
  download: ReactNode;
  install: ReactNode;
  releasePage: ReactNode;
  status: ReactNode;
  version: ReactNode;
  package: ReactNode;
  checksum: ReactNode;
  currentVersion: ReactNode;
  noUpdate: ReactNode;
  noPackage: ReactNode;
  checksumRequired: ReactNode;
  checksumVerified: ReactNode;
  checksumNotRequired: ReactNode;
  idleMessage: ReactNode;
  checkingMessage: ReactNode;
  updateAvailableMessage: ReactNode;
  updateUnavailableMessage: ReactNode;
  downloadedMessage: ReactNode;
  installingMessage: ReactNode;
  releasePageMessage: ReactNode;
  rawStateTitle: ReactNode;
}

export interface UpdateCenterPanelProps {
  client?: DesktopClient;
  className?: string;
  labels?: Partial<UpdateCenterPanelLabels>;
  showHeader?: boolean;
  showReleasePageAction?: boolean;
  showRawState?: boolean;
  onStateChange?: (state: AppUpdateState) => void;
  onError?: (error: unknown, action: UpdateCenterAction) => void;
}

const defaultLabels: UpdateCenterPanelLabels = {
  title: "Update center",
  description: "Check, download, and install desktop updates through the foundation update boundary.",
  check: "Check",
  download: "Download",
  install: "Install",
  releasePage: "Release page",
  status: "Status",
  version: "Version",
  package: "Package",
  checksum: "Checksum",
  currentVersion: "Current",
  noUpdate: "No update",
  noPackage: "Not downloaded",
  checksumRequired: "Required",
  checksumVerified: "Verified",
  checksumNotRequired: "Not required",
  idleMessage: "Ready to check for updates.",
  checkingMessage: "Checking for updates...",
  updateAvailableMessage: "A newer version is available.",
  updateUnavailableMessage: "The current version is up to date.",
  downloadedMessage: "Update package downloaded and verified.",
  installingMessage: "Update installer reached the native boundary.",
  releasePageMessage: "Release page opened.",
  rawStateTitle: "Update state"
};

function mergeLabels(labels?: Partial<UpdateCenterPanelLabels>) {
  return { ...defaultLabels, ...labels };
}

function shortHash(value?: string) {
  if (!value) return "";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function fileNameFromPath(value?: string) {
  if (!value) return undefined;
  return value.split(/[\\/]/).filter(Boolean).at(-1) ?? value;
}

function formatBytes(value?: number) {
  if (typeof value !== "number") return undefined;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function updateMessageFromCheck(result: AppUpdateCheckResult, labels: UpdateCenterPanelLabels) {
  return result.available ? labels.updateAvailableMessage : labels.updateUnavailableMessage;
}

function updateMessageFromDownload(result: DownloadFileResult, labels: UpdateCenterPanelLabels) {
  const fileName = fileNameFromPath(result.path);
  const bytes = formatBytes(result.bytes);
  if (fileName && bytes) return `${labels.downloadedMessage} ${fileName} (${bytes})`;
  return labels.downloadedMessage;
}

function updateMessageFromInstall(result: AppUpdateInstallResult | void, labels: UpdateCenterPanelLabels) {
  return result?.message ?? labels.installingMessage;
}

function UpdateCenterPanelWithProvider(props: Omit<UpdateCenterPanelProps, "client">) {
  const client = useDesktopClient();
  return <UpdateCenterPanelContent {...props} client={client} />;
}

function UpdateCenterPanelContent({
  client,
  className,
  labels: labelsOverride,
  showHeader = true,
  showReleasePageAction = true,
  showRawState = false,
  onStateChange,
  onError
}: UpdateCenterPanelProps & { client: DesktopClient }) {
  const labels = useMemo(() => mergeLabels(labelsOverride), [labelsOverride]);
  const [state, setState] = useState<AppUpdateState>(() => client.updates.getState());
  const [message, setMessage] = useState<ReactNode>(labels.idleMessage);
  const [busyAction, setBusyAction] = useState<UpdateCenterAction | null>(null);
  const update = state.update;

  function refreshState() {
    const nextState = client.updates.getState();
    setState(nextState);
    onStateChange?.(nextState);
    return nextState;
  }

  async function run<T>(
    action: UpdateCenterAction,
    pendingMessage: ReactNode,
    task: () => Promise<T>,
    successMessage: (result: T) => ReactNode
  ) {
    setBusyAction(action);
    setMessage(pendingMessage);
    try {
      const result = await task();
      setMessage(successMessage(result));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(errorMessage);
      onError?.(error, action);
      return undefined;
    } finally {
      refreshState();
      setBusyAction(null);
    }
  }

  useEffect(() => {
    const nextState = client.updates.getState();
    setState(nextState);
    onStateChange?.(nextState);
  }, [client, onStateChange]);

  const metrics = [
    {
      id: "status",
      label: labels.status,
      value: <StatusTag status={state.status} tone={state.status === "error" ? "danger" : undefined} />,
      hint: state.installMessage
    },
    {
      id: "version",
      label: labels.version,
      value: update?.version ?? labels.noUpdate,
      hint: state.currentVersion ? `${labels.currentVersion}: ${state.currentVersion}` : undefined
    },
    {
      id: "package",
      label: labels.package,
      value: fileNameFromPath(state.downloadedPath) ?? labels.noPackage,
      hint: formatBytes(state.downloadedBytes)
    },
    {
      id: "checksum",
      label: labels.checksum,
      value: state.downloadedSha256
        ? labels.checksumVerified
        : update?.sha256
          ? labels.checksumRequired
          : labels.checksumNotRequired,
      hint: shortHash(state.downloadedSha256 ?? update?.sha256)
    }
  ];

  return (
    <div className={className} style={{ display: "grid", gap: 16 }}>
      {showHeader ? <PageHeader title={labels.title} description={labels.description} /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Button
          size="sm"
          loading={busyAction === "check"}
          disabled={Boolean(busyAction)}
          onClick={() =>
            void run("check", labels.checkingMessage, () => client.updates.checkForUpdate(), (result) =>
              updateMessageFromCheck(result, labels)
            )
          }
        >
          {labels.check}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busyAction === "download"}
          disabled={Boolean(busyAction) || !update?.downloadUrl}
          onClick={() =>
            void run("download", labels.download, () => client.updates.downloadUpdate(update), (result) =>
              updateMessageFromDownload(result, labels)
            )
          }
        >
          {labels.download}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busyAction === "install"}
          disabled={Boolean(busyAction) || !state.downloadedPath}
          onClick={() =>
            void run("install", labels.install, () => client.updates.installUpdate(update), (result) =>
              updateMessageFromInstall(result, labels)
            )
          }
        >
          {labels.install}
        </Button>
        {showReleasePageAction ? (
          <Button
            size="sm"
            variant="ghost"
            loading={busyAction === "releasePage"}
            disabled={Boolean(busyAction) || (!update?.releasePageUrl && !update?.downloadUrl)}
            onClick={() =>
              void run("releasePage", labels.releasePage, () => client.updates.openUpdatePage(update), () => labels.releasePageMessage)
            }
          >
            {labels.releasePage}
          </Button>
        ) : null}
      </div>
      <MetricGrid columns={4} metrics={metrics} />
      {message ? <CodeBlock>{message}</CodeBlock> : null}
      {showRawState ? <CodeBlock title={labels.rawStateTitle}>{JSON.stringify(state, null, 2)}</CodeBlock> : null}
    </div>
  );
}

export function UpdateCenterPanel(props: UpdateCenterPanelProps) {
  if (props.client) return <UpdateCenterPanelContent {...props} client={props.client} />;
  return <UpdateCenterPanelWithProvider {...props} />;
}
