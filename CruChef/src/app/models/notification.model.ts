export type NotificationAudience = 'owner' | 'user';

export interface AppNotification {
  id: string;
  recipientUid: string;
  audience: NotificationAudience;
  type: string;
  title: string;
  message: string;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  dishName: string;
  read: boolean;
  createdAtMs: number;
}
