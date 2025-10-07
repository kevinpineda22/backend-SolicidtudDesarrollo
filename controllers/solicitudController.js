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