import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WidgetErrorBoundary] Unhandled error caught in widget:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="card-luxe flex flex-col items-center justify-center p-6 text-center border-destructive/20 bg-destructive/5 min-h-[150px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-3">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h4 className="font-display text-sm font-semibold text-foreground">
            {this.props.title || "Widget Unavailable"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
            An error occurred while loading this section. Your other financial data remains secure.
          </p>
        </Card>
      );
    }

    return this.props.children;
  }
}
