export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  ownerUid: string;
  restaurantId: string;
  restaurantName: string;
  customerUid: string;
  customerEmail: string;
  customerName: string;
  dishId: string;
  dishName: string;
  dishImageUrl: string;
  categoryId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  status: OrderStatus;
  createdAtMs: number;
  updatedAtMs: number;
  deliveredAtMs: number | null;
  rating: number | null;
  reviewText: string;
}

export const activeOrderStatuses: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
];

export const historicalOrderStatuses: OrderStatus[] = ['delivered', 'cancelled'];

export const orderStatusLabelMap: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  preparing: 'En preparacion',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

