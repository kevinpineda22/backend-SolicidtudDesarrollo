// routes/solicitudRoutes.js
import express from 'express';
import { 
    notificarSolicitud, aprobarRechazarSolicitud, 
    getDashboardData, updateSolicitudField, 
    addKanbanTask, updateKanbanTaskStatus 
} from '../controllers/solicitudController.js';

const router = express.Router();

// --- RUTAS DEL FLUJO INICIAL ---
router.post('/solicitudes/notificar', notificarSolicitud);
router.get('/solicitudes/approve', aprobarRechazarSolicitud); 

// --- RUTAS DEL PANEL DE ADMINISTRACIÓN ---
// 1. Obtener todos los datos necesarios para el Dashboard/Kanban
router.get('/solicitudes/dashboard', getDashboardData);

// 2. Actualizar cualquier campo (Estado, Asignación, Prioridad DS, Comentarios DS)
router.put('/solicitudes/update-field', updateSolicitudField);

// --- RUTAS DE ACTIVIDADES (KANBAN) ---
// 3. Agregar una nueva tarea
router.post('/actividades/add', addKanbanTask);

// 4. Actualizar el estado de una tarea Kanban
router.put('/actividades/update-status', updateKanbanTaskStatus);


export default router;