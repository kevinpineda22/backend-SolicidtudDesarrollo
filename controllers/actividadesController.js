// controllers/actividadesController.js
import supabase from '../supabaseCliente.js';

/**
 * POST /api/actividades/add
 * Agrega una nueva tarea Kanban
 */
export const addKanbanTask = async (req, res) => {
    const { 
        solicitud_codigo: rawSolicitud, nombre_actividad, descripcion, 
        responsable_ds: rawResponsable, prioridad, fecha_limite: rawFechaLimite,
        tipo_tarea, sprint_id: rawSprintId
    } = req.body;

    console.log('📋 Datos recibidos en addKanbanTask:');
    console.log('- rawSprintId:', rawSprintId, 'Type:', typeof rawSprintId);
    console.log('- Todos los datos del body:', req.body);

    const code = rawSolicitud && rawSolicitud.trim() !== '' ? rawSolicitud.trim() : null;
    const responsable = rawResponsable && rawResponsable.trim() !== '' ? rawResponsable.trim() : null;
    const fechaLimite = rawFechaLimite && rawFechaLimite.trim() !== '' ? rawFechaLimite.trim() : null;
    
    // Manejar correctamente sprint_id que puede ser número, string o null
    let sprintId = null;
    if (rawSprintId !== null && rawSprintId !== undefined && rawSprintId !== '') {
        if (typeof rawSprintId === 'string') {
            const trimmedSprintId = rawSprintId.trim();
            sprintId = trimmedSprintId !== '' ? parseInt(trimmedSprintId) : null;
        } else if (typeof rawSprintId === 'number') {
            sprintId = rawSprintId;
        }
    }

    console.log('✅ Sprint ID procesado:', sprintId, 'Type:', typeof sprintId);

    if (!nombre_actividad) {
         return res.status(400).json({ success: false, message: 'El nombre de la actividad es obligatorio.' });
    }

    try {
        const insertData = {
            solicitud_codigo: code,
            nombre_actividad,
            descripcion: descripcion || null,
            responsable_ds: responsable,
            prioridad: prioridad || 'Media',
            fecha_limite: fechaLimite,
            estado_actividad: 'Por Hacer',
            tipo_tarea: tipo_tarea || 'desarrollo',
            sprint_id: sprintId
        };

        console.log('💾 Datos que se insertarán:', insertData);

        const { data, error } = await supabase
            .from('actividades_ds')
            .insert([insertData])
            .select();

        if (error) throw error;
        
        console.log('✅ Tarea creada exitosamente:', data[0]);
        res.status(201).json({ success: true, message: 'Tarea Kanban agregada.', data: data[0] });
    } catch (error) {
        console.error('❌ Error al agregar tarea Kanban:', error);
        res.status(500).json({ success: false, message: 'Fallo al agregar tarea.', error: error.message });
    }
};

/**
 * PUT /api/actividades/update-status
 * Actualiza estado/datos de tarea Kanban (DND y Modal de Detalle)
 */
export const updateKanbanTaskStatus = async (req, res) => {
    const { 
        taskId, newStatus, nombre_actividad, descripcion, 
        responsable_ds, prioridad, fecha_limite, sprint_id
    } = req.body;

    console.log('📥 Payload recibido en updateKanbanTaskStatus:', {
        taskId, newStatus, nombre_actividad, descripcion, 
        responsable_ds, prioridad, fecha_limite, sprint_id
    });

    const updatePayload = {};

    // DND: Actualización de Estado (si se proporciona)
    if (newStatus) {
        updatePayload.estado_actividad = newStatus;
        console.log('🔄 Actualizando estado a:', newStatus);
    }
    
    // Actualización de campos (solo si existen en el body)
    if (nombre_actividad !== undefined) {
        updatePayload.nombre_actividad = nombre_actividad || null;
        console.log('📝 Actualizando nombre:', nombre_actividad);
    }
    
    if (descripcion !== undefined) {
        updatePayload.descripcion = descripcion || null;
        console.log('📄 Actualizando descripción:', descripcion);
    }
    
    if (responsable_ds !== undefined) {
        updatePayload.responsable_ds = responsable_ds || null;
        console.log('👤 Actualizando responsable:', responsable_ds);
    }
    
    if (prioridad !== undefined) {
        updatePayload.prioridad = prioridad;
        console.log('⚡ Actualizando prioridad:', prioridad);
    }
    
    if (fecha_limite !== undefined) {
        updatePayload.fecha_limite = fecha_limite || null;
        console.log('📅 Actualizando fecha límite:', fecha_limite);
    }

    // Manejo del sprint_id en edición
    if (sprint_id !== undefined) {
        console.log('🏃‍♂️ Procesando sprint_id:', sprint_id, 'Type:', typeof sprint_id);
        
        let processedSprintId = null;
        
        if (sprint_id !== null && sprint_id !== undefined && sprint_id !== '') {
            if (typeof sprint_id === 'string') {
                const trimmed = sprint_id.trim();
                processedSprintId = trimmed !== '' ? parseInt(trimmed) : null;
            } else if (typeof sprint_id === 'number') {
                processedSprintId = sprint_id;
            }
        }
        
        updatePayload.sprint_id = processedSprintId;
        console.log('✅ Sprint ID procesado y asignado:', processedSprintId);
    }

    if (Object.keys(updatePayload).length === 0) {
        console.log('❌ No hay campos para actualizar');
        return res.status(400).json({ success: false, message: 'No se proporcionaron campos válidos para actualizar.' });
    }

    try {
        console.log('💾 Enviando payload a Supabase:', updatePayload);

        const { data: updatedTask, error } = await supabase
            .from('actividades_ds')
            .update(updatePayload)
            .eq('id', taskId)
            .select('solicitud_codigo, estado_actividad, sprint_id, nombre_actividad')
            .single();

        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw error;
        }

        console.log('✅ Tarea actualizada exitosamente:', updatedTask);

        // Sincronización automática con solicitudes
        if (newStatus && updatedTask.solicitud_codigo) {
            console.log('🔄 Sincronizando con solicitud:', updatedTask.solicitud_codigo);
            await syncTaskWithSolicitud(updatedTask.solicitud_codigo, newStatus);
        }

        res.status(200).json({ 
            success: true, 
            message: 'Tarea Kanban actualizada exitosamente.',
            data: updatedTask 
        });
    } catch (error) {
        console.error('❌ Error al actualizar tarea Kanban:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Fallo al actualizar tarea.', 
            error: error.message 
        });
    }
};

/**
 * Función auxiliar: Sincronización con estados reducidos
 */
const syncTaskWithSolicitud = async (solicitudCodigo, taskStatus) => {
    try {
        // Obtener todas las tareas asociadas a esta solicitud con su tipo
        const { data: allTasks, error: tasksError } = await supabase
            .from('actividades_ds')
            .select('estado_actividad, tipo_tarea')
            .eq('solicitud_codigo', solicitudCodigo);

        if (tasksError) throw tasksError;

        // Obtener estado actual de la solicitud
        const { data: currentSolicitud, error: getCurrentError } = await supabase
            .from('solicitudes_desarrollo')
            .select('estado')
            .eq('codigo_requerimiento', solicitudCodigo)
            .single();

        if (getCurrentError) throw getCurrentError;

        let newSolicitudStatus = null;

        if (allTasks && allTasks.length > 0) {
            // Separar tareas por tipo
            const tareasPrincipales = allTasks.filter(t => t.tipo_tarea !== 'soporte' && t.tipo_tarea !== 'cambio');
            const tareasSoporte = allTasks.filter(t => t.tipo_tarea === 'soporte' || t.tipo_tarea === 'cambio');
            
            const principalStatuses = tareasPrincipales.map(t => t.estado_actividad);
            const soporteStatuses = tareasSoporte.map(t => t.estado_actividad);
            
            // Si todas las tareas principales están terminadas
            if (principalStatuses.length > 0 && principalStatuses.every(status => status === 'Terminado')) {
                if (tareasSoporte.length > 0) {
                    // Hay tareas de soporte
                    if (soporteStatuses.some(status => ['En Curso', 'Revisión'].includes(status))) {
                        newSolicitudStatus = 'En Soporte';
                    } else if (soporteStatuses.every(status => status === 'Terminado')) {
                        newSolicitudStatus = 'Completado';
                    } else {
                        newSolicitudStatus = 'En Soporte';
                    }
                } else {
                    // Solo tareas principales, todas terminadas
                    newSolicitudStatus = 'Completado';
                }
            }
            // Si hay tareas principales activas
            else if (principalStatuses.some(status => ['En Curso', 'Revisión', 'Por Hacer'].includes(status))) {
                newSolicitudStatus = 'En Desarrollo';
            }
        }

        // Solo actualizar si hay un cambio de estado necesario
        if (newSolicitudStatus && currentSolicitud.estado !== newSolicitudStatus) {
            const { error: updateError } = await supabase
                .from('solicitudes_desarrollo')
                .update({ 
                    estado: newSolicitudStatus
                })
                .eq('codigo_requerimiento', solicitudCodigo);

            if (updateError) throw updateError;
            
            console.log(`✅ Solicitud ${solicitudCodigo} sincronizada de "${currentSolicitud.estado}" a "${newSolicitudStatus}"`);
        }

    } catch (error) {
        console.error('Error en sincronización:', error);
    }
};

/**
 * DELETE /api/actividades/:taskId
 * Elimina una tarea Kanban
 */
export const deleteKanbanTask = async (req, res) => {
    const { taskId } = req.params;

    if (!taskId) {
        return res.status(400).json({ success: false, message: 'ID de tarea es obligatorio.' });
    }

    try {
        // Obtener la tarea para logs y sincronización
        const { data: taskToDelete, error: fetchError } = await supabase
            .from('actividades_ds')
            .select('solicitud_codigo, nombre_actividad')
            .eq('id', taskId)
            .single();

        if (fetchError) throw fetchError;

        // Eliminar la tarea
        const { error: deleteError } = await supabase
            .from('actividades_ds')
            .delete()
            .eq('id', taskId);

        if (deleteError) throw deleteError;

        // Si la tarea estaba asociada a una solicitud, re-sincronizar el estado
        if (taskToDelete.solicitud_codigo) {
            await syncTaskWithSolicitud(taskToDelete.solicitud_codigo, null);
        }

        console.log(`🗑️ Tarea eliminada: ${taskToDelete.nombre_actividad}`);
        res.status(200).json({ 
            success: true, 
            message: 'Tarea eliminada exitosamente.',
            deletedTask: taskToDelete
        });

    } catch (error) {
        console.error('Error al eliminar tarea Kanban:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Fallo al eliminar tarea.', 
            error: error.message 
        });
    }
};

/**
 * GET /api/actividades/archivadas
 * Obtiene tareas archivadas
 */
export const getArchivedTasks = async (req, res) => {
    try {
        const { data: tareasArchivadas, error } = await supabase
            .from('actividades_ds')
            .select(`
                *, 
                sprint:sprints_desarrollo(id, nombre, estado)
            `)
            .eq('archivado', true)
            .order('fecha_archivado', { ascending: false });

        if (error) throw error;

        const tareasConSprint = tareasArchivadas.map(tarea => ({
            ...tarea,
            sprint_nombre: tarea.sprint?.nombre || null
        }));

        res.status(200).json({ 
            success: true, 
            tareasArchivadas: tareasConSprint
        });
    } catch (error) {
        console.error('Error al obtener tareas archivadas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener tareas archivadas', 
            error: error.message 
        });
    }
};

/**
 * PUT /api/actividades/:taskId/archivo
 * Archivar/Desarchivar tarea
 */
export const toggleArchivarTarea = async (req, res) => {
    const { taskId } = req.params;
    const { archivar = true } = req.body;

    if (!taskId) {
        return res.status(400).json({ 
            success: false, 
            message: 'ID de tarea es obligatorio.' 
        });
    }

    try {
        // Verificar si la columna 'archivado' existe en la tabla
        const { data: columnsCheck, error: columnsError } = await supabase
            .from('actividades_ds')
            .select('archivado')
            .limit(1);

        if (columnsError && columnsError.message.includes('column')) {
            console.error('❌ La columna "archivado" NO existe en la tabla actividades_ds');
            return res.status(500).json({
                success: false,
                message: 'La funcionalidad de archivado requiere una actualización de la base de datos.',
                requiresDBUpdate: true,
                sqlCommand: `
-- Ejecuta este SQL en tu dashboard de Supabase:
ALTER TABLE actividades_ds ADD COLUMN archivado BOOLEAN DEFAULT FALSE;
ALTER TABLE actividades_ds ADD COLUMN fecha_archivado TIMESTAMPTZ;
CREATE INDEX idx_actividades_archivado ON actividades_ds(archivado);
                `.trim()
            });
        }

        // Obtener la tarea actual
        const { data: currentTask, error: fetchError } = await supabase
            .from('actividades_ds')
            .select('nombre_actividad, estado_actividad, archivado')
            .eq('id', taskId)
            .single();

        if (fetchError) {
            console.error('❌ Error al obtener tarea:', fetchError);
            throw fetchError;
        }

        // Validar que solo se puedan archivar tareas terminadas
        if (archivar && currentTask.estado_actividad !== 'Terminado') {
            return res.status(400).json({ 
                success: false, 
                message: 'Solo se pueden archivar tareas que estén en estado "Terminado".' 
            });
        }

        // Actualizar el estado de archivado
        const updateData = {
            archivado: archivar,
            fecha_archivado: archivar ? new Date().toISOString() : null
        };

        const { data, error: updateError } = await supabase
            .from('actividades_ds')
            .update(updateData)
            .eq('id', taskId)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error al actualizar:', updateError);
            throw updateError;
        }

        const action = archivar ? 'archivada' : 'desarchivada';
        console.log(`✅ Tarea ${action}: ${currentTask.nombre_actividad} (ID: ${taskId})`);

        res.status(200).json({ 
            success: true, 
            message: `Tarea ${action} exitosamente.`,
            data: data
        });

    } catch (error) {
        console.error('❌ Error en toggleArchivarTarea:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al procesar la solicitud', 
            error: error.message 
        });
    }
};
