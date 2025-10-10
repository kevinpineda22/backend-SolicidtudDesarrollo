// routes/solicitudRoutes.js
import express from 'express';
import { 
    notificarSolicitud, aprobarRechazarSolicitud, 
    getDashboardData, updateSolicitudField, 
    addKanbanTask, updateKanbanTaskStatus, getSolicitudProgress,
    deleteKanbanTask, // 🆕 NUEVA IMPORTACIÓN
    // 🆕 IMPORTACIONES PARA SPRINTS
    createSprint, updateSprint, deleteSprint, getSprintById, getAllSprints
} from '../controllers/solicitudController.js';

const router = express.Router();

// --- RUTAS DEL FLUJO INICIAL ---
router.post('/solicitudes/notificar', notificarSolicitud);
router.get('/solicitudes/approve', aprobarRechazarSolicitud); 

// --- RUTAS DEL PANEL DE ADMINISTRACIÓN ---
// 1. Obtener todos los datos necesarios para el Dashboard/Kanban (incluye sprints)
router.get('/solicitudes/dashboard', getDashboardData);

// 2. Actualizar cualquier campo (Estado, Asignación, Prioridad DS, Comentarios DS)
router.put('/solicitudes/update-field', updateSolicitudField);

// 🆕 3. Obtener progreso de tareas asociadas a una solicitud específica
router.get('/solicitudes/:codigo_requerimiento/progress', getSolicitudProgress);

// --- RUTAS DE ACTIVIDADES (KANBAN) ---
// 4. Agregar una nueva tarea
router.post('/actividades/add', addKanbanTask);

// 5. Actualizar el estado de una tarea Kanban (incluye sincronización automática)
router.put('/actividades/update-status', updateKanbanTaskStatus);

// 🆕 6. Eliminar una tarea Kanban
router.delete('/actividades/:taskId', deleteKanbanTask);

// --- 🆕 RUTAS DE SPRINTS ---
// 7. Obtener todos los sprints
router.get('/sprints', getAllSprints);

// 8. Obtener un sprint específico por ID
router.get('/sprints/:sprintId', getSprintById);

// 9. Crear un nuevo sprint
router.post('/sprints/create', createSprint);

// 10. Actualizar un sprint existente
router.put('/sprints/:sprintId', updateSprint);

// 11. Eliminar un sprint (opcional)
router.delete('/sprints/:sprintId', deleteSprint);

export default router;