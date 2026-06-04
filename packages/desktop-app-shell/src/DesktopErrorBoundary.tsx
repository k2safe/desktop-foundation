import { Component, type ErrorInfo, type ReactNode } from "react";
import { DesktopError, normalizeDesktopError } from "@desktop-foundation/bridge";
import { Button, ErrorState, useLocale } from "@desktop-foundation/ui-react";

export interface DesktopErrorBoundaryFallbackProps {
  error: DesktopError;
  reset: () => void;
}

export interface DesktopErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: DesktopErrorBoundaryFallbackProps) => ReactNode);
  onError?: (error: DesktopError, info: ErrorInfo) => void;
  resetKeys?: readonly unknown[];
}

interface DesktopErrorBoundaryState {
  error: DesktopError | null;
}

function resetKeysChanged(previous?: readonly unknown[], next?: readonly unknown[]) {
  if (previous === next) return false;
  if (!previous || !next || previous.length !== next.length) return true;
  return previous.some((value, index) => value !== next[index]);
}

function DefaultDesktopErrorFallback({ error, reset }: DesktopErrorBoundaryFallbackProps) {
  const { t } = useLocale();

  return (
    <ErrorState
      title={t("errorBoundary.title")}
      description={error.message || t("errorBoundary.description")}
      action={
        <Button size="sm" variant="outline" onClick={reset}>
          {t("errorBoundary.reset")}
        </Button>
      }
    />
  );
}

export class DesktopErrorBoundary extends Component<DesktopErrorBoundaryProps, DesktopErrorBoundaryState> {
  state: DesktopErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): DesktopErrorBoundaryState {
    return {
      error: normalizeDesktopError(error, {
        code: "RENDER_ERROR",
        kind: "unknown",
        message: "Application render failed",
        retryable: false
      })
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(
      normalizeDesktopError(error, {
        code: "RENDER_ERROR",
        kind: "unknown",
        message: "Application render failed",
        retryable: false
      }),
      info
    );
  }

  componentDidUpdate(previousProps: DesktopErrorBoundaryProps) {
    if (this.state.error && resetKeysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    if (typeof this.props.fallback === "function") {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    return <DefaultDesktopErrorFallback error={this.state.error} reset={this.reset} />;
  }
}
