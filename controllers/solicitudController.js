// controllers/solicitudController.js
/**
 * Archivo de �ndice que re-exporta todos los controladores
 * Este archivo mantiene la compatibilidad con importaciones existentes
 * mientras organiza la l�gica en archivos separados.
 */

// Re-exportar controladores de notificaciones
export { 
    notificarSolicitud, 
    aprobarRechazarSolicitud, 
    procesarDecision 
} from './notificacionController.js';

// Re-exportar controladores de solicitudes
export { 
    getDashboardData, 
    updateSolicitudField, 
    getSolicitudProgress 
} from './solicitudesController.js';

// Re-exportar controladores de actividades
export { 
    addKanbanTask, 
    updateKanbanTaskStatus, 
    deleteKanbanTask,
    toggleArchivarTarea, 
    getArchivedTasks 
} from './actividadesController.js';

// Re-exportar controladores de sprints
export { 
    createSprint, 
    updateSprint, 
    deleteSprint, 
    getSprintById, 
    getAllSprints 
} from './sprintsController.js';
