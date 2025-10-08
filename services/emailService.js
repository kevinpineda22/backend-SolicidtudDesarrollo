// services/emailService.js

import nodemailer from "nodemailer";
import supabase from '../supabaseCliente.js';
import 'dotenv/config'; 

// Configuración del Transporter usando tus variables de entorno existentes
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true", // false para STARTTLS en puerto 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Función genérica para enviar correos.
 */
export const sendEmail = async (to, subject, htmlContent) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: htmlContent,
        });
        return { success: true };
    } catch (error) {
        console.error("Error al enviar el correo:", error);
        return { success: false, error: error.message };
    }
};

/**
 * Construye el cuerpo HTML para el correo de aprobación del jefe.
 */
export const buildApprovalEmailBody = (solicitud, baseURL) => {
    const code = solicitud.codigo_requerimiento;
    
    // Enlaces de aprobación/rechazo
    // Usamos las rutas definidas en routes/solicitudRoutes.js
    const approvalLink = {
        approve: `${baseURL}/api/solicitudes/approve?code=${code}&action=approve`,
        reject: `${baseURL}/api/solicitudes/approve?code=${code}&action=reject`
    };

    // 💡 CORRECCIÓN CRÍTICA AQUÍ: Garantizar que la cadena a parsear no sea null/undefined o vacía.
    const filesString = solicitud.archivos_adjuntos || '[]'; 
    
    // Intentamos parsear la cadena JSON. Si falla, usamos un array vacío.
    let filesArray;
    try {
        filesArray = JSON.parse(filesString);
    } catch (e) {
        console.error("Error parsing archivos_adjuntos JSON:", e);
        filesArray = [];
    }
    
    const filesList = filesArray.length > 0
        ? filesArray.map(f => `<li><a href="${f.url}" target="_blank">${f.nombre}</a></li>`).join('')
        : '<li>No se adjuntaron archivos.</li>';
        
    return `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
            <h1 style="color: #007bff;">🚨 Solicitud: ${code} - ${solicitud.nombre_proyecto}</h1>
            <p><strong>De:</strong> ${solicitud.nombre_completo} (${solicitud.correo_electronico})</p>
            <p><strong>Prioridad:</strong> <span style="font-weight: bold; color: ${solicitud.prioridad === 'Alta' ? '#dc3545' : '#ffc107'};">${solicitud.prioridad}</span></p>
            <hr/>
            
            <h2>Objetivo y Justificación</h2>
            <p>${solicitud.objetivo_justificacion}</p>
            
            <h3>Descripción del Requerimiento</h3>
            <p>${solicitud.descripcion_requerimiento}</p>

            <h3>Archivos Adjuntos</h3>
            <ul style="list-style: disc; padding-left: 20px;">${filesList}</ul>
            <hr/>

            <h2 style="color: #28a745;">✅ Acción Requerida (Jefe Inmediato)</h2>
            <div style="margin-top: 20px;">
                <a href="${approvalLink.approve}" 
                   style="background-color: #28aa45; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 15px;">
                   ✅ APROBAR
                </a>
                <a href="${approvalLink.reject}" 
                   style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                   ❌ RECHAZAR
                </a>
            </div>
            <p style="margin-top: 20px; font-size: 0.8em; color: #666;">Si el botón no funciona, copie el enlace en su navegador.</p>
        </div>
    `;
};

/**
 * Actualiza el estado de la solicitud en Supabase.
 */
export const updateSolicitudStatus = async (code, status) => {
    const { error } = await supabase
        .from('solicitudes_desarrollo')
        .update({ estado: status, fecha_actualizacion: new Date().toISOString() })
        .eq('codigo_requerimiento', code);

    if (error) throw error;
    return true;
};