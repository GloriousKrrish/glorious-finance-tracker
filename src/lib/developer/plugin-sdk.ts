import type { State } from "../store";
import { SelectorEngine } from "../financial-engine";
import { NotificationRouter } from "../automation/notification-router";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  permissions: string[];
  enabled: boolean;
}

export interface WidgetRegistration {
  id: string;
  title: string;
  componentName: string;
  workspaceId: string;
}

export class PluginSDK {
  private static registeredPlugins: Map<string, PluginManifest> = new Map();
  private static registeredWidgets: WidgetRegistration[] = [];

  public static registerPlugin(manifest: PluginManifest): void {
    console.log(`[PluginSDK] Registered extension plugin: ${manifest.name} (v${manifest.version})`);
    this.registeredPlugins.set(manifest.id, manifest);
  }

  public static registerWidget(widget: WidgetRegistration): void {
    this.registeredWidgets.push(widget);
  }

  /**
   * Safe metric reader for plugins. Reads exclusively via SelectorEngine.
   */
  public static getPluginMetrics(state: State, workspaceId: string) {
    const dashboard = SelectorEngine.getDashboard(state);
    const healthIndex = SelectorEngine.getFinancialHealthIndex(state);
    const netWorthTrend = SelectorEngine.getNetWorthTimeSeries(state);

    return {
      totalNetWorth: dashboard.netWorth,
      totalAssets: dashboard.totalAssets,
      totalLiabilities: dashboard.totalLiabilities,
      financialHealthIndex: healthIndex,
      netWorthTrend
    };
  }

  /**
   * Safe notification trigger for plugins.
   */
  public static triggerPluginNotification(pluginId: string, title: string, body: string): void {
    const plugin = this.registeredPlugins.get(pluginId);
    const pluginName = plugin ? plugin.name : pluginId;
    NotificationRouter.route(
      `[Plugin: ${pluginName}] ${title}`,
      body,
      "system",
      "normal",
      "/developer",
      ["in_app"]
    );
  }

  public static getPlugins(): PluginManifest[] {
    return Array.from(this.registeredPlugins.values());
  }

  public static getWidgets(): WidgetRegistration[] {
    return [...this.registeredWidgets];
  }
}
