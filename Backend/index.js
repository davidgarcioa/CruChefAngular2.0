const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');
const dishRoutes = require('./routes/dish.routes');
const orderRoutes = require('./routes/order.routes');

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

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
