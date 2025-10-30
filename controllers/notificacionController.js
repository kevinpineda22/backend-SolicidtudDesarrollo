// controllers/notificacionController.js
import { sendEmail, buildApprovalEmailBody, updateSolicitudStatus } from '../services/emailService.js';
import supabase from '../supabaseCliente.js';

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

    // 🔧 CORRECCIÓN: Usar la columna archivos_adjuntos de la solicitud directamente
    const archivos = solicitud.archivos_adjuntos || [];
    console.log('📎 Archivos adjuntos encontrados:', archivos.length);

    // Correo al equipo de desarrollo (desarrollo@merkahorrosas.com)
    const developmentEmailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nueva Solicitud de Desarrollo</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #210d65 0%, #89DC00 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">MERKAHORRO</h1>
              <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Desarrollo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              <div style="border-left: 4px solid #89DC00; padding-left: 15px; margin-bottom: 25px;">
                <h2 style="color: #210d65; margin: 0; font-size: 22px;">Nueva Solicitud de Desarrollo Recibida</h2>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Código:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.codigo_requerimiento}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Solicitante:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.nombre_completo} (${solicitud.correo_electronico})
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Área:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.area_proceso}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Proyecto:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.nombre_proyecto}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; vertical-align: top;">
                      <strong style="color: #210d65;">Objetivo:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.objetivo_justificacion}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; vertical-align: top;">
                      <strong style="color: #210d65;">Descripción:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.descripcion_requerimiento}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Prioridad:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <span style="background-color: ${solicitud.prioridad === 'Alta' ? '#dc3545' : solicitud.prioridad === 'Media' ? '#fd7e14' : '#28a745'}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                        ${solicitud.prioridad}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #210d65;">Jefe Inmediato:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #495057;">
                      ${solicitud.correo_jefe_inmediato}
                    </td>
                  </tr>
                </table>
              </div>
              
              ${archivos.length > 0 ? `
                <div style="margin-top: 20px;">
                  <h3 style="color: #210d65; margin-bottom: 10px;">📎 Archivos Adjuntos (${archivos.length}):</h3>
                  <ul style="list-style: none; padding: 0;">
                    ${archivos.map(archivo => `
                      <li style="background-color: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 8px; border-left: 3px solid #89DC00; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                          <div>
                            <a href="${archivo.url}" style="color: #210d65; text-decoration: none; font-weight: 600; font-size: 14px;">📄 ${archivo.nombre}</a>
                            <div style="color: #6c757d; font-size: 12px; margin-top: 4px;">
                              ${archivo.tamaño ? `Tamaño: ${(archivo.tamaño / 1024).toFixed(1)} KB` : ''} 
                              ${archivo.tipo ? `| Tipo: ${archivo.tipo}` : ''}
                            </div>
                          </div>
                          <a href="${archivo.url}" download="${archivo.nombre}" 
                             style="background-color: #89DC00; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold;">
                            Descargar
                          </a>
                        </div>
                      </li>
                    `).join('')}
                  </ul>
                  <div style="background-color: #e7f3ff; padding: 10px; border-radius: 5px; border-left: 3px solid #007bff; margin-top: 10px;">
                    <p style="margin: 0; color: #004085; font-size: 12px;">
                      💡 <strong>Tip:</strong> Haz clic en "Descargar" para obtener una copia local de cada archivo.
                    </p>
                  </div>
                </div>
              ` : `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border-left: 3px solid #6c757d;">
                  <p style="margin: 0; color: #6c757d; font-style: italic;">
                    📎 No se adjuntaron archivos con esta solicitud.
                  </p>
                </div>
              `}
              
              <div style="margin-top: 25px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
                <p style="margin: 0; color: #856404; font-weight: 500;">
                  ⏳ Esta solicitud está pendiente de aprobación por el jefe inmediato.
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #210d65; padding: 20px; text-align: center;">
              <p style="color: white; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Merkahorro - Sistema de Gestión de Desarrollo
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail(
      'desarrollo@merkahorrosas.com',
      `[DS] Nueva Solicitud: ${solicitud.codigo_requerimiento}`,
      developmentEmailBody
    );

    // Correo al jefe inmediato con enlaces de aprobación/rechazo
    const approvalEmailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Aprobación Requerida</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #210d65 0%, #89DC00 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">MERKAHORRO</h1>
              <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Desarrollo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              <div style="border-left: 4px solid #ffc107; padding-left: 15px; margin-bottom: 25px;">
                <h2 style="color: #210d65; margin: 0; font-size: 22px;">⚡ Aprobación Requerida</h2>
                <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 16px;">Solicitud ${solicitud.codigo_requerimiento}</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Solicitante:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.nombre_completo}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                      <strong style="color: #210d65;">Proyecto:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.nombre_proyecto}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; vertical-align: top;">
                      <strong style="color: #210d65;">Descripción:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6; color: #495057;">
                      ${solicitud.descripcion_requerimiento}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #210d65;">Prioridad:</strong>
                    </td>
                    <td style="padding: 8px 0;">
                      <span style="background-color: ${solicitud.prioridad === 'Alta' ? '#dc3545' : solicitud.prioridad === 'Media' ? '#fd7e14' : '#28a745'}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                        ${solicitud.prioridad}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #495057; margin-bottom: 20px; font-size: 16px;">
                  Por favor, revisa la solicitud y decide si aprobar o rechazar:
                </p>
                
                <div style="margin: 20px 0;">
                  <a href="${baseURL}/api/solicitudes/approve?code=${solicitud.codigo_requerimiento}&action=approve&token=${solicitud.token}" 
                     style="display: inline-block; background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 0 10px; font-weight: bold; font-size: 16px; box-shadow: 0 3px 6px rgba(40, 167, 69, 0.3); transition: all 0.3s ease;">
                    ✅ APROBAR
                  </a>
                  <a href="${baseURL}/api/solicitudes/approve?code=${solicitud.codigo_requerimiento}&action=reject&token=${solicitud.token}" 
                     style="display: inline-block; background: linear-gradient(135deg, #dc3545, #e74c3c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; margin: 0 10px; font-weight: bold; font-size: 16px; box-shadow: 0 3px 6px rgba(220, 53, 69, 0.3); transition: all 0.3s ease;">
                    ❌ RECHAZAR
                  </a>
                </div>
              </div>
              
              ${archivos.length > 0 ? `
                <div style="margin-top: 20px;">
                  <h3 style="color: #210d65; margin-bottom: 10px;">📎 Archivos Adjuntos (${archivos.length}):</h3>
                  <ul style="list-style: none; padding: 0;">
                    ${archivos.map(archivo => `
                      <li style="background-color: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 8px; border-left: 3px solid #89DC00; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                          <div>
                            <a href="${archivo.url}" style="color: #210d65; text-decoration: none; font-weight: 600; font-size: 14px;">📄 ${archivo.nombre}</a>
                            <div style="color: #6c757d; font-size: 12px; margin-top: 4px;">
                              ${archivo.tamaño ? `Tamaño: ${(archivo.tamaño / 1024).toFixed(1)} KB` : ''} 
                              ${archivo.tipo ? `| Tipo: ${archivo.tipo}` : ''}
                            </div>
                          </div>
                          <a href="${archivo.url}" download="${archivo.nombre}" 
                             style="background-color: #89DC00; color: white; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 12px; font-weight: bold;">
                            Descargar
                          </a>
                        </div>
                      </li>
                    `).join('')}
                  </ul>
                  <div style="background-color: #e7f3ff; padding: 10px; border-radius: 5px; border-left: 3px solid #007bff; margin-top: 10px;">
                    <p style="margin: 0; color: #004085; font-size: 12px;">
                      💡 <strong>Tip:</strong> Haz clic en "Descargar" para obtener una copia local de cada archivo.
                    </p>
                  </div>
                </div>
              ` : `
                <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border-left: 3px solid #6c757d;">
                  <p style="margin: 0; color: #6c757d; font-style: italic;">
                    📎 No se adjuntaron archivos con esta solicitud.
                  </p>
                </div>
              `}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #210d65; padding: 20px; text-align: center;">
              <p style="color: white; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Merkahorro - Sistema de Gestión de Desarrollo
              </p>
            </div>
          </div>
        </body>
      </html>
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
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmación de Solicitud</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #210d65 0%, #89DC00 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">MERKAHORRO</h1>
                <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Desarrollo</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 30px 20px; text-align: center;">
                <div style="margin-bottom: 25px;">
                  <div style="background-color: #89DC00; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">✅</span>
                  </div>
                  <h2 style="color: #210d65; margin: 0; font-size: 24px;">¡Solicitud Enviada con Éxito!</h2>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; margin: 20px 0;">
                  <h3 style="color: #210d65; margin: 0 0 10px 0;">Código de Solicitud</h3>
                  <p style="font-size: 20px; font-weight: bold; color: #89DC00; margin: 0; background-color: white; padding: 10px; border-radius: 5px; border: 2px solid #89DC00;">
                    ${solicitud.codigo_requerimiento}
                  </p>
                </div>

                ${archivos.length > 0 ? `
                  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; margin: 20px 0; text-align: left;">
                    <h4 style="color: #210d65; margin: 0 0 10px 0;">📎 Archivos Adjuntados (${archivos.length}):</h4>
                    <ul style="list-style: none; padding: 0; margin: 0;">
                      ${archivos.map(archivo => `
                        <li style="padding: 5px 0; border-bottom: 1px solid #dee2e6; color: #495057; font-size: 14px;">
                          📄 ${archivo.nombre} ${archivo.tamaño ? `<span style="color: #6c757d;">(${(archivo.tamaño / 1024).toFixed(1)} KB)</span>` : ''}
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
                
                <div style="text-align: left; margin: 20px 0;">
                  <p style="color: #495057; margin: 10px 0; line-height: 1.6;">
                    📧 Se ha notificado al jefe inmediato <strong>(${solicitud.correo_jefe_inmediato})</strong> para su aprobación.
                  </p>
                  <p style="color: #495057; margin: 10px 0; line-height: 1.6;">
                    📬 Recibirás una notificación una vez que se tome una decisión.
                  </p>
                  <p style="color: #495057; margin: 10px 0; line-height: 1.6;">
                    ⏰ Puedes hacer seguimiento de tu solicitud con el código proporcionado.
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background-color: #210d65; padding: 20px; text-align: center;">
                <p style="color: white; margin: 0; font-size: 12px;">
                  © ${new Date().getFullYear()} Merkahorro - Sistema de Gestión de Desarrollo
                </p>
              </div>
            </div>
          </body>
        </html>
      `
    );

    res.status(200).json({ success: true, message: 'Solicitud notificada correctamente y correos enviados.' });
  } catch (error) {
    console.error('Error al procesar solicitud:', error);
    res.status(500).json({ success: false, message: 'Fallo interno del servidor.', error: error.message });
  }
};

/**
 * POST /api/solicitudes/decision
 * Procesa la decisión (aprobar/rechazar) de una solicitud
 */
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

    // 🔧 CORRECCIÓN: Usar directamente los archivos de la solicitud
    const archivos = solicitud.archivos_adjuntos || [];

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
    const isApproved = decision === 'Aprobada - Pendiente de Análisis';
    const statusIcon = isApproved ? '✅' : '❌';
    const statusColor = isApproved ? '#28a745' : '#dc3545';
    const statusBg = isApproved ? '#d4edda' : '#f8d7da';
    const statusBorder = isApproved ? '#c3e6cb' : '#f5c6cb';

    const notificationBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Decisión sobre Solicitud</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #210d65 0%, #89DC00 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">MERKAHORRO</h1>
              <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Desarrollo</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
              <div style="text-align: center; margin-bottom: 25px;">
                <div style="background-color: ${statusColor}; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 40px; color: white;">${statusIcon}</span>
                </div>
                <h2 style="color: #210d65; margin: 0; font-size: 24px;">
                  Solicitud ${codigo} ${isApproved ? 'Aprobada' : 'Rechazada'}
                </h2>
              </div>
              
              <div style="background-color: ${statusBg}; padding: 20px; border-radius: 8px; border: 1px solid ${statusBorder}; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder};">
                      <strong style="color: #210d65;">Solicitante:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder}; color: #495057;">
                      ${solicitud.nombre_completo}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder};">
                      <strong style="color: #210d65;">Proyecto:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder}; color: #495057;">
                      ${solicitud.nombre_proyecto}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder};">
                      <strong style="color: #210d65;">Estado:</strong>
                    </td>
                    <td style="padding: 8px 0; border-bottom: 1px solid ${statusBorder};">
                      <span style="background-color: ${statusColor}; color: white; padding: 6px 12px; border-radius: 15px; font-size: 14px; font-weight: bold;">
                        ${decision}
                      </span>
                    </td>
                  </tr>
                  ${observacion ? `
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top;">
                        <strong style="color: #210d65;">Observación:</strong>
                      </td>
                      <td style="padding: 8px 0; color: #495057;">
                        ${observacion}
                      </td>
                    </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0;">
                      <strong style="color: #210d65;">Fecha de decisión:</strong>
                    </td>
                    <td style="padding: 8px 0; color: #495057;">
                      ${new Date().toLocaleString('es-CO')}
                    </td>
                  </tr>
                </table>
              </div>

              ${archivos.length > 0 ? `
                <div style="margin-top: 20px;">
                  <h3 style="color: #210d65; margin-bottom: 10px;">📎 Archivos de Referencia (${archivos.length}):</h3>
                  <ul style="list-style: none; padding: 0;">
                    ${archivos.map(archivo => `
                      <li style="background-color: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px; border-left: 3px solid #89DC00;">
                        <a href="${archivo.url}" style="color: #210d65; text-decoration: none; font-weight: 500;">📄 ${archivo.nombre}</a>
                        ${archivo.tamaño ? `<span style="color: #6c757d; font-size: 12px; margin-left: 10px;">(${(archivo.tamaño / 1024).toFixed(1)} KB)</span>` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
              
              ${isApproved ? `
                <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #bee5eb; margin-top: 20px;">
                  <p style="margin: 0; color: #0c5460; font-weight: 500;">
                    🚀 Tu solicitud ha sido aprobada y será asignada al equipo de desarrollo para su análisis.
                  </p>
                </div>
              ` : `
                <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #f5c6cb; margin-top: 20px;">
                  <p style="margin: 0; color: #721c24; font-weight: 500;">
                    📋 Tu solicitud ha sido rechazada. Si tienes dudas, contacta a tu jefe inmediato.
                  </p>
                </div>
              `}
            </div>
            
            <!-- Footer -->
            <div style="background-color: #210d65; padding: 20px; text-align: center;">
              <p style="color: white; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Merkahorro - Sistema de Gestión de Desarrollo
              </p>
            </div>
          </div>
        </body>
      </html>
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
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Error de Parámetros</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #210d65 0%, #dc3545 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">❌ ERROR</h1>
                </div>
                <div style="padding: 30px; text-align: center;">
                  <h2 style="color: #dc3545; margin-bottom: 15px;">Error de Parámetros</h2>
                  <p style="color: #6c757d;">Enlace de aprobación inválido.</p>
                </div>
              </div>
            </body>
          </html>
        `);
    }

    const estado = action === 'approve' ? 'Aprobada - Pendiente de Análisis' : 'Rechazada';
    const verb = action === 'approve' ? 'APROBADA' : 'RECHAZADA';
    const color = action === 'approve' ? '#28a745' : '#dc3545';
    const icon = action === 'approve' ? '✅' : '❌';

    try {
        await updateSolicitudStatus(code, estado);
        
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Solicitud ${verb}</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #210d65 0%, ${color} 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">MERKAHORRO</h1>
                  <p style="color: white; margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Desarrollo</p>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px; text-align: center;">
                  <div style="background-color: ${color}; width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 50px; color: white;">${icon}</span>
                  </div>
                  
                  <h1 style="color: ${color}; margin: 0 0 20px 0; font-size: 28px;">
                    ¡Solicitud ${code} ${verb} con éxito!
                  </h1>
                  
                  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${color}; margin: 20px 0;">
                    <p style="margin: 0; color: #495057; font-size: 16px; line-height: 1.6;">
                      El estado del requerimiento ha sido actualizado a: <br>
                      <strong style="color: ${color}; font-size: 18px;">${estado}</strong>
                    </p>
                  </div>
                  
                  <p style="color: #6c757d; margin: 20px 0; font-size: 14px;">
                    📧 El equipo de Desarrollo y el solicitante serán notificados automáticamente.
                  </p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #210d65; padding: 15px; text-align: center; border-radius: 0 0 10px 10px;">
                  <p style="color: white; margin: 0; font-size: 12px;">
                    © ${new Date().getFullYear()} Merkahorro - Sistema de Gestión de Desarrollo
                  </p>
                </div>
              </div>
            </body>
          </html>
        `);
    } catch (error) {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Error del Servidor</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="max-width: 600px; margin: 50px auto; background-color: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #210d65 0%, #dc3545 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ ERROR INTERNO</h1>
                </div>
                <div style="padding: 30px; text-align: center;">
                  <h2 style="color: #dc3545; margin-bottom: 15px;">Error interno del servidor</h2>
                  <p style="color: #6c757d; margin-bottom: 20px;">No se pudo procesar la acción. Por favor, contacta a TI.</p>
                  <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545;">
                    <p style="margin: 0; color: #721c24; font-size: 14px; word-break: break-word;">
                      Error: ${error.message}
                    </p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `);
    }
};
