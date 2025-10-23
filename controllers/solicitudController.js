// controllers/solicitudController.js
import { sendEmail, buildApprovalEmailBody, updateSolicitudStatus } from '../services/emailService.js';
import supabase from '../supabaseCliente.js'; // Necesario para consultas directas si fuera el caso

/**
 * POST /api/solicitudes/notificar
 * Maneja la notificación al jefe y al equipo de desarrollo después de que el frontend inserta el registro.
 */
export const notificarSolicitud = async (req, res) => {
  const { solicitud, destinatarios } = req.body;

  if (!solicitud || !solicitud.token || !solicitud.codigo_requerimiento) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos (solicitud, token o código).' });
  }

  try {
    const baseURL = req.protocol + '://' + req.get('host');

    // Correo al equipo de desarrollo (desarrollo@merkahorrosas.com)
    const developmentEmailBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Nueva Solicitud de Desarrollo Recibida</h2>
        <p><strong>Código:</strong> ${solicitud.codigo_requerimiento}</p>
        <p><strong>Solicitante:</strong> ${solicitud.nombre_completo} (${solicitud.correo_electronico})</p>
        <p><strong>Área:</strong> ${solicitud.area_proceso}</p>
        <p><strong>Proyecto:</strong> ${solicitud.nombre_proyecto}</p>
        <p><strong>Objetivo:</strong> ${solicitud.objetivo_justificacion}</p>
        <p><strong>Descripción:</strong> ${solicitud.descripcion_requerimiento}</p>
        <p><strong>Prioridad:</strong> ${solicitud.prioridad}</p>
        <p><strong>Jefe Inmediato:</strong> ${solicitud.correo_jefe_inmediato}</p>
        ${solicitud.archivos_adjuntos.length > 0 ? `
          <p><strong>Archivos Adjuntos:</strong></p>
          <ul>
            ${solicitud.archivos_adjuntos.map(file => `<li><a href="${file.url}">${file.nombre}</a></li>`).join('')}
          </ul>
        ` : ''}
        <p>Esta solicitud está pendiente de aprobación por el jefe inmediato.</p>
      </div>
    `;

    await sendEmail(
      'desarrollo@merkahorrosas.com',
      `[DS] Nueva Solicitud: ${solicitud.codigo_requerimiento}`,
      developmentEmailBody
    );

    // Correo al jefe inmediato con enlaces de aprobación/rechazo
    const approvalEmailBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Aprobación Requerida: Solicitud ${solicitud.codigo_requerimiento}</h2>
        <p><strong>Solicitante:</strong> ${solicitud.nombre_completo}</p>
        <p><strong>Proyecto:</strong> ${solicitud.nombre_proyecto}</p>
        <p><strong>Descripción:</strong> ${solicitud.descripcion_requerimiento}</p>
        <p><strong>Prioridad:</strong> ${solicitud.prioridad}</p>
        <p>Por favor, revisa la solicitud y decide si aprobar o rechazar:</p>
        <p>
          <a href="${baseURL}/api/solicitudes/aprobar-rechazar?code=${solicitud.codigo_requerimiento}&action=approve&token=${solicitud.token}" 
             style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
            Aprobar
          </a>
          <a href="${baseURL}/api/solicitudes/aprobar-rechazar?code=${solicitud.codigo_requerimiento}&action=reject&token=${solicitud.token}" 
             style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Rechazar
          </a>
        </p>
        ${solicitud.archivos_adjuntos.length > 0 ? `
          <p><strong>Archivos Adjuntos:</strong></p>
          <ul>
            ${solicitud.archivos_adjuntos.map(file => `<li><a href="${file.url}">${file.nombre}</a></li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;

    await sendEmail(
      solicitud.correo_jefe_inmediato,
      `[DS] Aprobación Requerida: ${solicitud.codigo_requerimiento}`,
      approvalEmailBody
    );

    // Correo de confirmación al solicitante
    await sendEmail(
      solicitud.correo_electronico,
      `[DS] Confirmación de Envío: ${solicitud.codigo_requerimiento}`,
      `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Confirmación de Solicitud Enviada</h2>
          <p>Tu solicitud <strong>${solicitud.codigo_requerimiento}</strong> ha sido enviada con éxito.</p>
          <p>Se ha notificado al jefe inmediato (${solicitud.correo_jefe_inmediato}) para su aprobación.</p>
          <p>Recibirás una notificación una vez que se tome una decisión.</p>
        </div>
      `
    );

    res.status(200).json({ success: true, message: 'Solicitud notificada correctamente y correos enviados.' });
  } catch (error) {
    console.error('Error al procesar solicitud:', error);
    res.status(500).json({ success: false, message: 'Fallo interno del servidor.', error: error.message });
  }
};

export const procesarDecision = async (req, res) => {
  const { token, codigo, decision, observacion } = req.body;

  if (!token || !codigo || !decision) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos: token, código o decisión.' });
  }

  if (!['Aprobada - Pendiente de Análisis', 'Rechazada'].includes(decision)) {
    return res.status(400).json({ success: false, message: 'Decisión inválida.' });
  }

  try {
    // 1. Validar el token y obtener la solicitud
    const { data: solicitud, error: fetchError } = await supabase
      .from('solicitudes_desarrollo')
      .select('*')
      .eq('codigo_requerimiento', codigo)
      .eq('token', token)
      .single();

    if (fetchError || !solicitud) {
      return res.status(400).json({ success: false, message: 'Solicitud no encontrada o token inválido.' });
    }

    // 2. Verificar que la solicitud esté pendiente de aprobación
    if (solicitud.estado !== 'Pendiente de Aprobación') {
      return res.status(400).json({ success: false, message: 'La solicitud ya ha sido procesada.' });
    }

    // 3. Actualizar el estado de la solicitud
    const { error: updateError } = await supabase
      .from('solicitudes_desarrollo')
      .update({
        estado: decision,
        observacion_decision: observacion || null,
        fecha_decision: new Date().toISOString()
      })
      .eq('codigo_requerimiento', codigo)
      .eq('token', token);

    if (updateError) throw updateError;

    // 4. Enviar notificaciones
    const notificationBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Solicitud ${codigo} ${decision === 'Aprobada - Pendiente de Análisis' ? 'Aprobada' : 'Rechazada'}</h2>
        <p><strong>Solicitante:</strong> ${solicitud.nombre_completo}</p>
        <p><strong>Proyecto:</strong> ${solicitud.nombre_proyecto}</p>
        <p><strong>Estado:</strong> ${decision}</p>
        ${observacion ? `<p><strong>Observación:</strong> ${observacion}</p>` : ''}
        <p>Fecha de decisión: ${new Date().toLocaleString('es-CO')}</p>
      </div>
    `;

    // Notificar al solicitante y al equipo de desarrollo
    await Promise.all([
      sendEmail(
        solicitud.correo_electronico,
        `[DS] Decisión sobre Solicitud: ${codigo}`,
        notificationBody
      ),
      sendEmail(
        'desarrollo@merkahorrosas.com',
        `[DS] Decisión sobre Solicitud: ${codigo}`,
        notificationBody
      )
    ]);

    res.status(200).json({
      success: true,
      message: `Solicitud ${codigo} ${decision === 'Aprobada - Pendiente de Análisis' ? 'aprobada' : 'rechazada'} con éxito.`
    });
  } catch (error) {
    console.error('Error al procesar la decisión:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.', error: error.message });
  }
};
/**
 * GET /api/solicitudes/approve?code=XXX&action=approve/reject
 * Maneja el clic del jefe inmediato para aprobar o rechazar la solicitud.
 */
export const aprobarRechazarSolicitud = async (req, res) => {
    const { code, action } = req.query;

    if (!code || (action !== 'approve' && action !== 'reject')) {
        return res.status(400).send('<h1 style="color:red;">Error de Parámetros</h1><p>Enlace de aprobación inválido.</p>');
    }

    const estado = action === 'approve' ? 'Aprobada - Pendiente de Análisis' : 'Rechazada';
    const verb = action === 'approve' ? 'APROBADA' : 'RECHAZADA';
    const color = action === 'approve' ? 'green' : 'red';

    try {
        await updateSolicitudStatus(code, estado);
        
        // Opcional: Añadir lógica para notificar al Solicitante y al equipo de Desarrollo sobre la decisión final.

        res.status(200).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: ${color};">¡Solicitud ${code} ${verb} con éxito!</h1>
                <p>El estado del requerimiento ha sido actualizado a: <strong>${estado}</strong>.</p>
                <p>El equipo de Desarrollo y el solicitante serán notificados.</p>
            </div>
        `);
    } catch (error) {
        res.status(500).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">Error interno del servidor</h1>
                <p>No se pudo procesar la acción. Por favor, contacta a TI. Error: ${error.message}</p>
            </div>
        `);
    }
};

// 1. OBTENER TODOS LOS DATOS PARA EL DASHBOARD (ACTUALIZADO CON SPRINTS)
export const getDashboardData = async (req, res) => {
    try {
        const { data: solicitudes, error: reqError } = await supabase
            .from('solicitudes_desarrollo')
            // Aseguramos que se seleccionan todas las columnas de gestión
            .select('*, responsable_asignado, prioridad_asignada, observaciones_ds') 
            .order('fecha_creacion', { ascending: false });

        if (reqError) throw reqError;

        const { data: actividades, error: actError } = await supabase
            .from('actividades_ds')
            .select(`
                *, 
                sprint:sprints_desarrollo(id, nombre, estado)
            `)
            .order('fecha_creacion', { ascending: true });

        if (actError) throw actError;

        // 🆕 OBTENER SPRINTS
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

// 2. ACTUALIZAR CUALQUIER CAMPO DE UNA SOLICITUD
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

// 3. AGREGAR UNA NUEVA TAREA KANBAN (ACTUALIZADO CON SPRINT)
export const addKanbanTask = async (req, res) => {
    // 💡 SANIDAD: Desestructuramos todos los campos y los limpiamos de strings vacíos
    const { 
        solicitud_codigo: rawSolicitud, nombre_actividad, descripcion, 
        responsable_ds: rawResponsable, prioridad, fecha_limite: rawFechaLimite,
        tipo_tarea, sprint_id: rawSprintId // 🆕 AGREGAR CAMPO DE SPRINT
    } = req.body;

    // 🔧 DEBUG: Agregar logs para ver qué está llegando
    console.log('📋 Datos recibidos en addKanbanTask:');
    console.log('- rawSprintId:', rawSprintId, 'Type:', typeof rawSprintId);
    console.log('- Todos los datos del body:', req.body);

    const code = rawSolicitud && rawSolicitud.trim() !== '' ? rawSolicitud.trim() : null;
    const responsable = rawResponsable && rawResponsable.trim() !== '' ? rawResponsable.trim() : null;
    const fechaLimite = rawFechaLimite && rawFechaLimite.trim() !== '' ? rawFechaLimite.trim() : null;
    
    // 🔧 CORRECCIÓN: Manejar correctamente sprint_id que puede ser número, string o null
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
            sprint_id: sprintId // 🆕 INCLUIR EL SPRINT
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

// 4. ACTUALIZAR ESTADO/DATOS DE TAREA KANBAN (DND y Modal de Detalle)
export const updateKanbanTaskStatus = async (req, res) => {
    const { 
        taskId, newStatus, nombre_actividad, descripcion, 
        responsable_ds, prioridad, fecha_limite, sprint_id // 🆕 AGREGAR SPRINT_ID
    } = req.body;

    console.log('📥 Payload recibido en updateKanbanTaskStatus:', {
        taskId, newStatus, nombre_actividad, descripcion, 
        responsable_ds, prioridad, fecha_limite, sprint_id
    });

    // 1. Prepara el payload con sanidad para los campos opcionales/fechas
    const updatePayload = {};

    // DND: Actualización de Estado (si se proporciona)
    if (newStatus) {
        updatePayload.estado_actividad = newStatus;
        console.log('🔄 Actualizando estado a:', newStatus);
    }
    
    // 💡 EDICIÓN: Actualización de campos (solo si existen en el body)
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
    
    // 💡 CORRECCIÓN CRÍTICA PARA FECHAS
    if (fecha_limite !== undefined) {
        updatePayload.fecha_limite = fecha_limite || null;
        console.log('📅 Actualizando fecha límite:', fecha_limite);
    }

    // 🔧 CORRECCIÓN CRÍTICA: MANEJO DEL SPRINT_ID EN EDICIÓN
    if (sprint_id !== undefined) {
        console.log('🏃‍♂️ Procesando sprint_id:', sprint_id, 'Type:', typeof sprint_id);
        
        // Si viene como null, string vacío, o número, manejarlo correctamente
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

        // Actualizar la tarea
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

        // 🔄 NUEVA LÓGICA: Sincronización automática con solicitudes
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

// 🆕 FUNCIÓN SIMPLIFICADA: Sincronización con estados reducidos
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
            
            // 🔑 LÓGICA SIMPLIFICADA DE ESTADOS
            
            // Si todas las tareas principales están terminadas
            if (principalStatuses.length > 0 && principalStatuses.every(status => status === 'Terminado')) {
                if (tareasSoporte.length > 0) {
                    // Hay tareas de soporte
                    if (soporteStatuses.some(status => ['En Curso', 'Revisión'].includes(status))) {
                        newSolicitudStatus = 'En Soporte';
                    } else if (soporteStatuses.every(status => status === 'Terminado')) {
                        newSolicitudStatus = 'Completado';
                    } else {
                        newSolicitudStatus = 'En Soporte'; // Soporte pendiente
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

// 🆕 NUEVA FUNCIÓN: API para obtener estadísticas de progreso
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

// 🆕 NUEVA FUNCIÓN: Eliminar tarea Kanban
export const deleteKanbanTask = async (req, res) => {
    const { taskId } = req.params;

    if (!taskId) {
        return res.status(400).json({ success: false, message: 'ID de tarea es obligatorio.' });
    }

    try {
        // Primero obtener la tarea para logs y sincronización
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

// 🆕 ==================== CONTROLADORES DE SPRINTS ====================

// OBTENER TODOS LOS SPRINTS
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

// OBTENER UN SPRINT ESPECÍFICO POR ID
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

// CREAR UN NUEVO SPRINT
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
        if (error.code === '23505') { // Violación de restricción única
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

// ACTUALIZAR UN SPRINT EXISTENTE
export const updateSprint = async (req, res) => {
    const { sprintId } = req.params;
    const { 
        nombre, 
        objetivo, 
        fecha_inicio, 
        fecha_fin, 
        estado 
    } = req.body;

    // Validar que el sprint existe
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

// ELIMINAR UN SPRINT (CON VALIDACIONES)
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

// 🆕 NUEVA FUNCIÓN: Obtener tareas archivadas
export const getArchivedTasks = async (req, res) => {
    try {
        const { data: tareasArchivadas, error } = await supabase
            .from('actividades_ds')
            .select(`
                *, 
                sprint:sprints_desarrollo(id, nombre, estado)
            `)
            .eq('archivado', true) // 🔑 Solo tareas ARCHIVADAS
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

// 🆕 NUEVA FUNCIÓN: Archivar/Desarchivar tarea
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
        // Obtener la tarea actual
        const { data: currentTask, error: fetchError } = await supabase
            .from('actividades_ds')
            .select('nombre_actividad, estado_actividad, archivado')
            .eq('id', taskId)
            .single();

        if (fetchError) throw fetchError;

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

        if (updateError) throw updateError;

        const action = archivar ? 'archivada' : 'desarchivada';
        console.log(`📦 Tarea ${action}: ${currentTask.nombre_actividad}`);

        res.status(200).json({ 
            success: true, 
            message: `Tarea ${action} exitosamente.`,
            data: data
        });

    } catch (error) {
        console.error('Error al cambiar estado de archivo:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al procesar la solicitud', 
            error: error.message 
        });
    }
};