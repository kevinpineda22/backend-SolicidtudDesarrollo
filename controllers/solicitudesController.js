// controllers/solicitudesController.js
import supabase from '../supabaseCliente.js';

/**
 * GET /api/solicitudes/dashboard
 * Obtiene todos los datos para el dashboard (solicitudes, actividades, sprints)
 */
export const getDashboardData = async (req, res) => {
    try {
        const { data: solicitudes, error: reqError } = await supabase
            .from('solicitudes_desarrollo')
            .select('*, responsable_asignado, prioridad_asignada, observaciones_ds') 
            .order('fecha_creacion', { ascending: false });

        if (reqError) throw reqError;

        // ✅ FILTRAR SOLO TAREAS NO ARCHIVADAS
        const { data: actividades, error: actError } = await supabase
            .from('actividades_ds')
            .select(`
                *, 
                sprint:sprints_desarrollo(id, nombre, estado)
            `)
            .or('archivado.is.null,archivado.eq.false')
            .order('fecha_creacion', { ascending: true });

        if (actError) throw actError;

        // Obtener sprints
        const { data: sprints, error: sprintsError } = await supabase
            .from('sprints_desarrollo')
            .select('*')
            .order('fecha_creacion', { ascending: false });

        if (sprintsError) throw sprintsError;

        // Mapear actividades para incluir nombre del sprint
        const actividadesConSprint = actividades.map(actividad => ({
            ...actividad,
            sprint_nombre: actividad.sprint?.nombre || null
        }));

        res.status(200).json({ 
            solicitudes, 
            actividades: actividadesConSprint,
            sprints: sprints || []
        });
    } catch (error) {
        console.error('Error al obtener datos del dashboard:', error);
        res.status(500).json({ success: false, message: 'Fallo al cargar datos del dashboard.', error: error.message });
    }
};

/**
 * PUT /api/solicitudes/update-field
 * Actualiza cualquier campo de una solicitud
 */
export const updateSolicitudField = async (req, res) => {
    const { codigo_requerimiento, campo, valor } = req.body;

    // 💡 SANIDAD: Asegura que el valor vacío sea NULL para la DB
    const cleanValor = valor === '' ? null : valor;

    const updatePayload = { [campo]: cleanValor };

    // Lógica para registrar fechas clave
    if (campo === 'estado' && valor === 'En Análisis') {
        updatePayload.fecha_inicio_analisis = new Date().toISOString();
    }

    try {
        const { error } = await supabase
            .from('solicitudes_desarrollo')
            .update(updatePayload)
            .eq('codigo_requerimiento', codigo_requerimiento);

        if (error) throw error;
        res.status(200).json({ success: true, message: `${campo} actualizado correctamente.` });
    } catch (error) {
        console.error(`Error al actualizar campo ${campo}:`, error);
        res.status(500).json({ success: false, message: `Fallo al actualizar el campo ${campo}.`, error: error.message });
    }
};

/**
 * GET /api/solicitudes/:codigo_requerimiento/progress
 * Obtiene estadísticas de progreso de una solicitud
 */
export const getSolicitudProgress = async (req, res) => {
    const { codigo_requerimiento } = req.params;

    try {
        // Obtener la solicitud
        const { data: solicitud, error: reqError } = await supabase
            .from('solicitudes_desarrollo')
            .select('*')
            .eq('codigo_requerimiento', codigo_requerimiento)
            .single();

        if (reqError) throw reqError;

        // Obtener todas las tareas asociadas
        const { data: tasks, error: tasksError } = await supabase
            .from('actividades_ds')
            .select('estado_actividad, nombre_actividad, responsable_ds')
            .eq('solicitud_codigo', codigo_requerimiento);

        if (tasksError) throw tasksError;

        // Calcular estadísticas de progreso
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.estado_actividad === 'Terminado').length;
        const inProgressTasks = tasks.filter(t => ['En Curso', 'Revisión'].includes(t.estado_actividad)).length;
        const pendingTasks = tasks.filter(t => t.estado_actividad === 'Por Hacer').length;

        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        res.status(200).json({
            solicitud,
            tasks,
            stats: {
                total: totalTasks,
                completed: completedTasks,
                inProgress: inProgressTasks,
                pending: pendingTasks,
                progressPercentage
            }
        });

    } catch (error) {
        console.error('Error al obtener progreso:', error);
        res.status(500).json({ success: false, message: 'Error al obtener progreso', error: error.message });
    }
};
