// app.js
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import supabase from './supabaseCliente.js';
import solicitudRoutes from './routes/solicitudRoutes.js'; 


dotenv.config();

const allowedOrigins = [
  'http://localhost:5173',
  'https://merkahorro.com',
  'https://www.merkahorro.com',
];

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS no permitido'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intenta más tarde.' },
});
app.use(globalLimiter);

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

