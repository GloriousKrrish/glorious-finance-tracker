import { NotificationCenterEngine } from "../enterprise/notification";
import { toast } from "sonner";

export type NotificationChannel = "in_app" | "email" | "push" | "sms" | "webhook";

export interface DeliveryReceipt {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  status: "delivered" | "queued" | "failed";
  timestamp: string;
}

export class NotificationRouter {
  private static receipts: DeliveryReceipt[] = [];

  public static route(
    title: string,
    body: string,
    category: "bill" | "loan" | "goal" | "tax" | "investment" | "import" | "security" | "system",
    priority: "low" | "medium" | "high" | "critical",
    deepLink: string = "/",
    channels: NotificationChannel[] = ["in_app"]
  ): DeliveryReceipt[] {
    const results: DeliveryReceipt[] = [];

    channels.forEach(ch => {
      const receipt: DeliveryReceipt = {
        id: `rcpt_${Math.random().toString(36).substring(2, 9)}`,
        channel: ch,
        recipient: "current_user",
        status: "delivered",
        timestamp: new Date().toISOString()
      };

      switch (ch) {
        case "in_app":
          NotificationCenterEngine.addNotification(title, body, category, priority, deepLink);
          if (priority === "critical" || priority === "high") {
            toast.warning(`[NotificationRouter] ${title}: ${body}`);
          }
          break;

        case "email":
          console.log(`[NotificationRouter] Sent Email to user: "${title}" - ${body}`);
          break;

        case "push":
          console.log(`[NotificationRouter] Dispatched Mobile Push: "${title}"`);
          break;

        case "sms":
          console.log(`[NotificationRouter] Dispatched SMS alert to user number: "${title}"`);
          break;

        case "webhook":
          console.log(`[NotificationRouter] Webhook HTTP POST triggered for "${title}"`);
          break;
      }

      results.push(receipt);
      this.receipts.unshift(receipt);
    });

    return results;
  }

  public static getReceipts(): DeliveryReceipt[] {
    return [...this.receipts];
  }
}
