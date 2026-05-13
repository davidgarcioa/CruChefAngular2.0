const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');
const dishRoutes = require('./routes/dish.routes');
const orderRoutes = require('./routes/order.routes');
const userRoutes = require('./routes/user.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const publicRoutes = require('./routes/public.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('El servidor de CruChef esta vivo');
});

app.use('/api', healthRoutes);
app.use('/api', dishRoutes);
app.use('/api', orderRoutes);
app.use('/api', userRoutes);
app.use('/api', restaurantRoutes);
app.use('/api', publicRoutes);
app.use('/api', notificationRoutes);

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
