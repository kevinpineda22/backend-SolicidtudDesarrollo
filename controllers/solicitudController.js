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

    // Prepara el payload de actualización
    const updatePayload = { [campo]: valor };

    // Añade la fecha de inicio de análisis si el campo es estado
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
    const { solicitud_codigo, nombre_actividad, responsable_ds } = req.body;

    try {
        const { data, error } = await supabase
            .from('actividades_ds')
            .insert([{
                solicitud_codigo,
                nombre_actividad,
                responsable_ds,
                estado_actividad: 'Por Hacer' // Siempre inicia en Por Hacer
            }])
            .select();

        if (error) throw error;
        res.status(201).json({ success: true, message: 'Tarea Kanban agregada.', data: data[0] });
    } catch (error) {
        console.error('Error al agregar tarea Kanban:', error);
        res.status(500).json({ success: false, message: 'Fallo al agregar tarea.', error: error.message });
    }
};

// 4. ACTUALIZAR EL ESTADO DE UNA TAREA KANBAN (DRAG AND DROP)
export const updateKanbanTaskStatus = async (req, res) => {
    const { taskId, newStatus } = req.body;

    try {
        const { error } = await supabase
            .from('actividades_ds')
            .update({ estado_actividad: newStatus })
            .eq('id', taskId);

        if (error) throw error;
        res.status(200).json({ success: true, message: 'Estado de tarea Kanban actualizado.' });
    } catch (error) {
        console.error('Error al actualizar estado de tarea Kanban:', error);
        res.status(500).json({ success: false, message: 'Fallo al actualizar estado de tarea.', error: error.message });
    }
};