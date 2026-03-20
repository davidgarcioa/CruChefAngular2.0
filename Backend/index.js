const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// --- CONFIGURACIÓN DE FIREBASE ---
// 1. Asegúrate de que el archivo JSON que descargaste esté en esta misma carpeta
// 2. Cámbiale el nombre a "firebase-key.json" para que coincida con la línea de abajo
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// ---------------------------------

// MIDDLEWARES (Configuraciones de paso)
app.use(cors()); // Esto evita el error de "CORS" cuando Angular intente entrar
app.use(express.json()); // Esto permite que el servidor entienda datos que le envíes

// RUTA DE PRUEBA: Si entras a http://localhost:3000 verás este mensaje
app.get('/', (req, res) => {
  res.send('🚀 El servidor de CruChef está vivo');
});

// RUTA PARA ANGULAR: Aquí es donde Angular pedirá los datos
app.get('/api/recetas', async (req, res) => {
  try {
    const snapshot = await db.collection('recetas').get();
    const recetas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(recetas);
  } catch (error) {
    res.status(500).send("Error en Firebase: " + error.message);
  }
});

// ENCENDER EL SERVIDOR
app.listen(3000, () => {
  console.log("✅ Servidor corriendo en el puerto 3000");
});