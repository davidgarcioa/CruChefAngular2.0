const svgToDataUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const dishIllustration = (emoji, base, accent) =>
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

const CATEGORY_IMAGE_KEYS = {
  burgers: 'burger',
  pizza: 'pizza',
  tacos: 'tacos',
  sushi: 'sushi',
  pasta: 'pasta',
  chicken: 'chicken',
  combo: 'combo',
  desserts: 'dessert',
  drinks: 'drink',
  breakfast: 'breakfast',
  salads: 'salad',
};

const DISH_IMAGE_MAP = {
  plate: dishIllustration('\uD83C\uDF7D\uFE0F', '#ffb566', '#9b4c33'),
  burger: dishIllustration('\uD83C\uDF54', '#f0be68', '#7d5233'),
  pizza: dishIllustration('\uD83C\uDF55', '#ef9d52', '#d24b36'),
  sushi: dishIllustration('\uD83C\uDF63', '#ff9a6e', '#2b293c'),
  dessert: dishIllustration('\uD83C\uDF70', '#ff8a8d', '#924337'),
  tacos: dishIllustration('\uD83C\uDF2E', '#f1b94b', '#b86a25'),
  combo: dishIllustration('\uD83C\uDF71', '#84b0ff', '#35507a'),
  pasta: dishIllustration('\uD83C\uDF5D', '#f4d085', '#aa6734'),
  chicken: dishIllustration('\uD83C\uDF57', '#ffc37a', '#b55b2d'),
  drink: dishIllustration('\uD83E\uDD64', '#9fc8ff', '#3c5b96'),
  breakfast: dishIllustration('\uD83E\uDD5E', '#ffd58c', '#936236'),
  salad: dishIllustration('\uD83E\uDD57', '#9fe0a2', '#43764d'),
};

function getCategoryImageKey(categoryId) {
  return CATEGORY_IMAGE_KEYS[categoryId] || 'plate';
}

function getDishImageUrl(imageKey) {
  return DISH_IMAGE_MAP[imageKey] || DISH_IMAGE_MAP.plate;
}

module.exports = {
  getCategoryImageKey,
  getDishImageUrl,
};
