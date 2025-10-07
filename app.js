// app.js
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import supabase from './supabaseCliente.js';
import solicitudRoutes from './routes/solicitudRoutes.js'; 


dotenv.config();


const app = express();

// Configurar CORS para permitir solicitudes desde el frontend
app.use(cors({
  origin: '*',  // Permite todas las solicitudes de cualquier origen
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'],  // Cabeceras permitidas
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware para inyectar supabase en req (opcional si lo usas en los controladores)
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Usar las rutas definidas bajo /api
app.use('/api', solicitudRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.status(200).json({ message: 'El ternero se crió correctamente' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

