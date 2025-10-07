// routes/solicitudRoutes.js
import express from 'express';
import { notificarSolicitud, aprobarRechazarSolicitud } from '../controllers/solicitudController.js';

const router = express.Router();

// 1. Endpoint llamado por el frontend después de la inserción exitosa en Supabase
// Ruta: /api/solicitudes/notificar
router.post('/solicitudes/notificar', notificarSolicitud);

// 2. Endpoint llamado por el enlace del correo electrónico del jefe
// Ruta: /api/solicitudes/approve?code=XXX&action=approve
router.get('/solicitudes/approve', aprobarRechazarSolicitud); 

export default router;