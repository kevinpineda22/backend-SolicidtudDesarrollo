// controllers/sprintsController.js
import supabase from '../supabaseCliente.js';

/**
 * GET /api/sprints
 * Obtiene todos los sprints
 */
export const getAllSprints = async (req, res) => {
    try {
        const { data: sprints, error } = await supabase
            .from('sprints_desarrollo')
            .select(`
                *,
                tareas:actividades_ds(count)
            `)
            .order('fecha_creacion', { ascending: false });

        if (error) throw error;

        res.status(200).json({ 
            success: true, 
            sprints: sprints || []
        });
    } catch (error) {
        console.error('Error al obtener sprints:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener sprints', 
            error: error.message 
        });
    }
};

/**
 * GET /api/sprints/:sprintId
 * Obtiene un sprint específico por ID
 */
export const getSprintById = async (req, res) => {
    const { sprintId } = req.params;

    try {
        const { data: sprint, error } = await supabase
            .from('sprints_desarrollo')
            .select(`
                *,
                tareas:actividades_ds(*)
            `)
            .eq('id', sprintId)
            .single();

        if (error) throw error;

        if (!sprint) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sprint no encontrado' 
            });
        }

        res.status(200).json({ 
            success: true, 
            sprint 
        });
    } catch (error) {
        console.error('Error al obtener sprint:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener sprint', 
            error: error.message 
        });
    }
};

/**
 * POST /api/sprints/create
 * Crea un nuevo sprint
 */
export const createSprint = async (req, res) => {
    const { 
        nombre, 
        objetivo, 
        fecha_inicio, 
        fecha_fin, 
        estado = 'planificado' 
    } = req.body;

    // Validaciones básicas
    if (!nombre || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ 
            success: false, 
            message: 'Nombre, fecha de inicio y fecha de fin son obligatorios.' 
        });
    }

    // Validar que la fecha de fin sea posterior a la de inicio
    if (new Date(fecha_fin) <= new Date(fecha_inicio)) {
        return res.status(400).json({ 
            success: false, 
            message: 'La fecha de fin debe ser posterior a la fecha de inicio.' 
        });
    }

    // Validar estados permitidos
    const estadosPermitidos = ['planificado', 'activo', 'completado'];
    if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({ 
            success: false, 
            message: 'Estado no válido. Debe ser: planificado, activo o completado.' 
        });
    }

    try {
        // Si se está creando un sprint activo, desactivar otros sprints activos
        if (estado === 'activo') {
            await supabase
                .from('sprints_desarrollo')
                .update({ estado: 'completado' })
                .eq('estado', 'activo');
        }

        const { data, error } = await supabase
            .from('sprints_desarrollo')
            .insert([{
                nombre: nombre.trim(),
                objetivo: objetivo?.trim() || null,
                fecha_inicio,
                fecha_fin,
                estado,
                fecha_creacion: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({ 
            success: true, 
            message: 'Sprint creado exitosamente.',
            sprint: data
        });
    } catch (error) {
        console.error('Error al crear sprint:', error);
        
        // Manejar errores específicos
        if (error.code === '23505') {
            return res.status(409).json({ 
                success: false, 
                message: 'Ya existe un sprint con ese nombre.' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Error al crear sprint', 
            error: error.message 
        });
    }
};

/**
 * PUT /api/sprints/:sprintId
 * Actualiza un sprint existente
 */
export const updateSprint = async (req, res) => {
    const { sprintId } = req.params;
    const { 
        nombre, 
        objetivo, 
        fecha_inicio, 
        fecha_fin, 
        estado 
    } = req.body;

    try {
        const { data: existingSprint, error: checkError } = await supabase
            .from('sprints_desarrollo')
            .select('*')
            .eq('id', sprintId)
            .single();

        if (checkError || !existingSprint) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sprint no encontrado.' 
            });
        }

        // Preparar datos de actualización
        const updateData = {};
        
        if (nombre !== undefined) updateData.nombre = nombre.trim();
        if (objetivo !== undefined) updateData.objetivo = objetivo?.trim() || null;
        if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio;
        if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin;
        if (estado !== undefined) {
            // Validar estados permitidos
            const estadosPermitidos = ['planificado', 'activo', 'completado'];
            if (!estadosPermitidos.includes(estado)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Estado no válido. Debe ser: planificado, activo o completado.' 
                });
            }
            updateData.estado = estado;
        }

        // Validar fechas si se proporcionan ambas
        if (updateData.fecha_inicio && updateData.fecha_fin) {
            if (new Date(updateData.fecha_fin) <= new Date(updateData.fecha_inicio)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'La fecha de fin debe ser posterior a la fecha de inicio.' 
                });
            }
        }

        // Si se está cambiando a activo, desactivar otros sprints activos
        if (updateData.estado === 'activo' && existingSprint.estado !== 'activo') {
            await supabase
                .from('sprints_desarrollo')
                .update({ estado: 'completado' })
                .eq('estado', 'activo')
                .neq('id', sprintId);
        }

        // Actualizar el sprint
        const { data, error } = await supabase
            .from('sprints_desarrollo')
            .update(updateData)
            .eq('id', sprintId)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({ 
            success: true, 
            message: 'Sprint actualizado exitosamente.',
            sprint: data
        });

    } catch (error) {
        console.error('Error al actualizar sprint:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al actualizar sprint', 
            error: error.message 
        });
    }
};

/**
 * DELETE /api/sprints/:sprintId
 * Elimina un sprint (con validaciones)
 */
export const deleteSprint = async (req, res) => {
    const { sprintId } = req.params;

    try {
        // Verificar si el sprint existe
        const { data: existingSprint, error: checkError } = await supabase
            .from('sprints_desarrollo')
            .select('*')
            .eq('id', sprintId)
            .single();

        if (checkError || !existingSprint) {
            return res.status(404).json({ 
                success: false, 
                message: 'Sprint no encontrado.' 
            });
        }

        // Verificar si hay tareas asociadas
        const { data: associatedTasks, error: tasksError } = await supabase
            .from('actividades_ds')
            .select('id')
            .eq('sprint_id', sprintId);

        if (tasksError) throw tasksError;

        if (associatedTasks && associatedTasks.length > 0) {
            return res.status(409).json({ 
                success: false, 
                message: `No se puede eliminar el sprint. Tiene ${associatedTasks.length} tarea(s) asociada(s). Mueve las tareas a otro sprint o elimínalas primero.`,
                associatedTasks: associatedTasks.length
            });
        }

        // Eliminar el sprint
        const { error: deleteError } = await supabase
            .from('sprints_desarrollo')
            .delete()
            .eq('id', sprintId);

        if (deleteError) throw deleteError;

        res.status(200).json({ 
            success: true, 
            message: 'Sprint eliminado exitosamente.',
            deletedSprint: existingSprint
        });

    } catch (error) {
        console.error('Error al eliminar sprint:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar sprint', 
            error: error.message 
        });
    }
};
