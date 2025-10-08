// controllers/solicitudController.js
import { sendEmail, buildApprovalEmailBody, updateSolicitudStatus } from '../services/emailService.js';
import supabase from '../supabaseCliente.js'; // Necesario para consultas directas si fuera el caso

/**
 * POST /api/solicitudes/notificar
 * Maneja la notificación al jefe y al equipo de desarrollo después de que el frontend inserta el registro.
 */
export const notificarSolicitud = async (req, res) => {
    const { solicitud, destinatarios } = req.body;
    
    try {
        // La URL base es necesaria para construir los enlaces de aprobación dinámicamente
        const baseURL = req.protocol + '://' + req.get('host');

        const approvalBody = buildApprovalEmailBody(solicitud, baseURL);

        // Enviar correo al jefe y al equipo de desarrollo
        const emailResult = await sendEmail(
            destinatarios.join(', '), 
            `[DS] Aprobación Requerida: ${solicitud.codigo_requerimiento}`,
            approvalBody
        );

        if (!emailResult.success) {
             // Devolvemos 500 ya que la notificación es crítica para el flujo
             return res.status(500).json({ success: false, message: 'Fallo al enviar el correo de notificación al jefe.' });
        }
        
        // Opcional: Notificación simple al solicitante (confirmación)
        await sendEmail(
            solicitud.correo_electronico,
            `[DS] Confirmación de Envío: ${solicitud.codigo_requerimiento}`,
            `<p>Tu solicitud ha sido enviada con éxito para aprobación del jefe inmediato (${solicitud.correo_jefe_inmediato}).</p>`
        );


        res.status(200).json({ success: true, message: 'Solicitud notificada correctamente y correos enviados.' });
    } catch (error) {
        console.error('Error al procesar solicitud:', error);
        res.status(500).json({ success: false, message: 'Fallo interno del servidor.', error: error.message });
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

// 1. OBTENER TODOS LOS DATOS PARA EL DASHBOARD
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
            .select('*')
            .order('fecha_creacion', { ascending: true });

        if (actError) throw actError;

        res.status(200).json({ solicitudes, actividades });
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

// 3. AGREGAR UNA NUEVA TAREA KANBAN
export const addKanbanTask = async (req, res) => {
    // 💡 SANIDAD: Desestructuramos todos los campos y los limpiamos de strings vacíos
    const { 
        solicitud_codigo: rawSolicitud, nombre_actividad, descripcion, 
        responsable_ds: rawResponsable, prioridad, fecha_limite: rawFechaLimite
    } = req.body;

    const code = rawSolicitud && rawSolicitud.trim() !== '' ? rawSolicitud.trim() : null;
    const responsable = rawResponsable && rawResponsable.trim() !== '' ? rawResponsable.trim() : null;
    const fechaLimite = rawFechaLimite && rawFechaLimite.trim() !== '' ? rawFechaLimite.trim() : null;


    if (!nombre_actividad) {
         return res.status(400).json({ success: false, message: 'El nombre de la actividad es obligatorio.' });
    }

    try {
        const { data, error } = await supabase
            .from('actividades_ds')
            .insert([{
                solicitud_codigo: code,
                nombre_actividad,
                descripcion: descripcion || null, // Permite NULL si el frontend no envía descripción
                responsable_ds: responsable,
                prioridad: prioridad || 'Media',
                fecha_limite: fechaLimite, // Ahora será NULL si estaba vacío
                estado_actividad: 'Por Hacer' 
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, message: 'Tarea Kanban agregada.', data: data[0] });
    } catch (error) {
        console.error('Error al agregar tarea Kanban:', error);
        res.status(500).json({ success: false, message: 'Fallo al agregar tarea.', error: error.message });
    }
};

// 4. ACTUALIZAR ESTADO/DATOS DE TAREA KANBAN (DND y Modal de Detalle)
export const updateKanbanTaskStatus = async (req, res) => {
    const { 
        taskId, newStatus, nombre_actividad, descripcion, 
        responsable_ds, prioridad, fecha_limite
    } = req.body;

    // 1. Prepara el payload con sanidad para los campos opcionales/fechas
    const updatePayload = {};

    // DND: Actualización de Estado (si se proporciona)
    if (newStatus) {
        updatePayload.estado_actividad = newStatus;
    }
    
    // 💡 EDICIÓN: Actualización de campos (solo si existen en el body)
    if (nombre_actividad !== undefined) updatePayload.nombre_actividad = nombre_actividad || null;
    if (descripcion !== undefined) updatePayload.descripcion = descripcion || null;
    if (responsable_ds !== undefined) updatePayload.responsable_ds = responsable_ds || null;
    if (prioridad !== undefined) updatePayload.prioridad = prioridad;
    
    // 💡 CORRECCIÓN CRÍTICA PARA FECHAS
    if (fecha_limite !== undefined) {
        updatePayload.fecha_limite = fecha_limite || null;
    }

    if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron campos válidos para actualizar.' });
    }

    try {
        const { error } = await supabase
            .from('actividades_ds')
            .update(updatePayload)
            .eq('id', taskId);

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Tarea Kanban actualizada.' });
    } catch (error) {
        console.error('Error al actualizar tarea Kanban:', error);
        res.status(500).json({ success: false, message: 'Fallo al actualizar tarea.', error: error.message });
    }
};