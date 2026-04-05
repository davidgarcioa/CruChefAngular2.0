import { Category } from '../models/category.model';
import { Dish } from '../models/dish.model';

export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
}

export interface DishImageOption {
  key: string;
  label: string;
  emoji: string;
  imageUrl: string;
}

const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const dishIllustration = (emoji: string, base: string, accent: string): string =>
  svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="180" viewBox="0 0 220 180">
      <defs>
        <linearGradient id="badge" x1="10%" y1="5%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
        <radialGradient id="shine" cx="35%" cy="25%" r="60%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.55)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="110" cy="145" rx="70" ry="18" fill="rgba(0,0,0,0.22)" />
      <circle cx="110" cy="88" r="58" fill="url(%23badge)" />
      <circle cx="110" cy="88" r="58" fill="url(%23shine)" />
      <text x="110" y="106" text-anchor="middle" font-size="74">${emoji}</text>
    </svg>
  `);

export const ownerNavigationItems: NavigationItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
  { label: 'Ordenes', route: '/orders', icon: 'receipt_long' },
  { label: 'Restaurantes', route: '/restaurants', icon: 'storefront' },
  { label: 'Historial', route: '/history', icon: 'history' },
  { label: 'Cambiar rol', route: '/select-role', icon: 'switch_account' },
];

export const userNavigationItems: NavigationItem[] = [
  { label: 'Menu', route: '/user', icon: 'restaurant_menu' },
  { label: 'Pedidos', route: '/user/orders', icon: 'receipt_long' },
  { label: 'Historial', route: '/user/history', icon: 'history' },
  { label: 'Cambiar rol', route: '/select-role', icon: 'switch_account' },
];

export const categories: Category[] = [
  { id: 'all', name: 'Todas', icon: '\uD83C\uDF7D\uFE0F', imageKey: 'plate' },
  { id: 'burgers', name: 'Burger', icon: '\uD83C\uDF54', imageKey: 'burger' },
  { id: 'pizza', name: 'Pizza', icon: '\uD83C\uDF55', imageKey: 'pizza' },
  { id: 'tacos', name: 'Tacos', icon: '\uD83C\uDF2E', imageKey: 'tacos' },
  { id: 'sushi', name: 'Sushi', icon: '\uD83C\uDF63', imageKey: 'sushi' },
  { id: 'pasta', name: 'Pastas', icon: '\uD83C\uDF5D', imageKey: 'pasta' },
  { id: 'chicken', name: 'Pollo', icon: '\uD83C\uDF57', imageKey: 'chicken' },
  { id: 'combo', name: 'Combos', icon: '\uD83C\uDF71', imageKey: 'combo' },
  { id: 'desserts', name: 'Postres', icon: '\uD83C\uDF70', imageKey: 'dessert' },
  { id: 'drinks', name: 'Bebidas', icon: '\uD83E\uDD64', imageKey: 'drink' },
  { id: 'breakfast', name: 'Desayunos', icon: '\uD83E\uDD5E', imageKey: 'breakfast' },
  { id: 'salads', name: 'Ensaladas', icon: '\uD83E\uDD57', imageKey: 'salad' },
];

export const dishImageOptions: DishImageOption[] = [
  {
    key: 'plate',
    label: 'Generico',
    emoji: '\uD83C\uDF7D\uFE0F',
    imageUrl: dishIllustration('\uD83C\uDF7D\uFE0F', '#ffb566', '#9b4c33'),
  },
  {
    key: 'burger',
    label: 'Hamburguesa',
    emoji: '\uD83C\uDF54',
    imageUrl: dishIllustration('\uD83C\uDF54', '#f0be68', '#7d5233'),
  },
  {
    key: 'pizza',
    label: 'Pizza',
    emoji: '\uD83C\uDF55',
    imageUrl: dishIllustration('\uD83C\uDF55', '#ef9d52', '#d24b36'),
  },
  {
    key: 'sushi',
    label: 'Sushi',
    emoji: '\uD83C\uDF63',
    imageUrl: dishIllustration('\uD83C\uDF63', '#ff9a6e', '#2b293c'),
  },
  {
    key: 'dessert',
    label: 'Postre',
    emoji: '\uD83C\uDF70',
    imageUrl: dishIllustration('\uD83C\uDF70', '#ff8a8d', '#924337'),
  },
  {
    key: 'tacos',
    label: 'Tacos',
    emoji: '\uD83C\uDF2E',
    imageUrl: dishIllustration('\uD83C\uDF2E', '#f1b94b', '#b86a25'),
  },
  {
    key: 'combo',
    label: 'Combo',
    emoji: '\uD83C\uDF71',
    imageUrl: dishIllustration('\uD83C\uDF71', '#84b0ff', '#35507a'),
  },
  {
    key: 'pasta',
    label: 'Pasta',
    emoji: '\uD83C\uDF5D',
    imageUrl: dishIllustration('\uD83C\uDF5D', '#f4d085', '#aa6734'),
  },
  {
    key: 'chicken',
    label: 'Pollo',
    emoji: '\uD83C\uDF57',
    imageUrl: dishIllustration('\uD83C\uDF57', '#ffc37a', '#b55b2d'),
  },
  {
    key: 'drink',
    label: 'Bebida',
    emoji: '\uD83E\uDD64',
    imageUrl: dishIllustration('\uD83E\uDD64', '#9fc8ff', '#3c5b96'),
  },
  {
    key: 'breakfast',
    label: 'Desayuno',
    emoji: '\uD83E\uDD5E',
    imageUrl: dishIllustration('\uD83E\uDD5E', '#ffd58c', '#936236'),
  },
  {
    key: 'salad',
    label: 'Ensalada',
    emoji: '\uD83E\uDD57',
    imageUrl: dishIllustration('\uD83E\uDD57', '#9fe0a2', '#43764d'),
  },
];

export const dishImageMap = Object.fromEntries(
  dishImageOptions.map((option) => [option.key, option.imageUrl]),
) as Record<string, string>;

export const categoryMap = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<string, Category>;

export const getDishImageUrl = (imageKey: string): string =>
  dishImageMap[imageKey] ?? dishImageOptions[0].imageUrl;

export const getCategoryImageKey = (categoryId: string): string =>
  categoryMap[categoryId]?.imageKey ?? 'plate';

export const getCategoryImageUrl = (categoryId: string): string =>
  getDishImageUrl(getCategoryImageKey(categoryId));

export const defaultDishes: Dish[] = [
  {
    id: 'dish-1',
    name: 'Hamburguesa',
    price: 24000,
    rating: 5,
    ratingCount: 12,
    ratingTotal: 60,
    restaurant: "Restaurante Ivon's",
    restaurantId: 'demo-restaurant-1',
    restaurantName: "Restaurante Ivon's",
    categoryId: 'burgers',
    imageKey: getCategoryImageKey('burgers'),
    imageUrl: getCategoryImageUrl('burgers'),
  },
  {
    id: 'dish-2',
    name: 'Pizza',
    price: 24000,
    rating: 5,
    ratingCount: 9,
    ratingTotal: 45,
    restaurant: "Restaurante Ivon's",
    restaurantId: 'demo-restaurant-1',
    restaurantName: "Restaurante Ivon's",
    categoryId: 'pizza',
    imageKey: getCategoryImageKey('pizza'),
    imageUrl: getCategoryImageUrl('pizza'),
  },
  {
    id: 'dish-3',
    name: 'Sushi',
    price: 24000,
    rating: 4,
    ratingCount: 7,
    ratingTotal: 28,
    restaurant: "Restaurante Ivon's",
    restaurantId: 'demo-restaurant-1',
    restaurantName: "Restaurante Ivon's",
    categoryId: 'sushi',
    imageKey: getCategoryImageKey('sushi'),
    imageUrl: getCategoryImageUrl('sushi'),
  },
  {
    id: 'dish-4',
    name: 'Postre',
    price: 24000,
    rating: 4,
    ratingCount: 5,
    ratingTotal: 20,
    restaurant: 'Pasteleria CruChef',
    restaurantId: 'demo-restaurant-2',
    restaurantName: 'Pasteleria CruChef',
    categoryId: 'desserts',
    imageKey: getCategoryImageKey('desserts'),
    imageUrl: getCategoryImageUrl('desserts'),
  },
  {
    id: 'dish-5',
    name: 'Tacos',
    price: 22000,
    rating: 5,
    ratingCount: 11,
    ratingTotal: 55,
    restaurant: 'Taqueria Central',
    restaurantId: 'demo-restaurant-3',
    restaurantName: 'Taqueria Central',
    categoryId: 'tacos',
    imageKey: getCategoryImageKey('tacos'),
    imageUrl: getCategoryImageUrl('tacos'),
  },
];

export const emptyDishes: Dish[] = [];
