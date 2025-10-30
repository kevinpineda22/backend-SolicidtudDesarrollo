# 📚 Documentación del Backend - Sistema de Solicitudes de Desarrollo

## 🏗️ Arquitectura del Proyecto

Este proyecto backend sigue una arquitectura MVC (Model-View-Controller) organizada en módulos especializados para mejor mantenibilidad.

---

## 📂 Estructura de Controladores

### 📧 `notificacionController.js` (467 líneas)
**Responsabilidad:** Gestión de notificaciones por email y flujo de aprobaciones

#### Funciones:
- **`notificarSolicitud`**  
  Envía correos electrónicos al jefe inmediato y al equipo de desarrollo cuando se crea una nueva solicitud.  
  📬 *Incluye archivos adjuntos y detalles completos de la solicitud*

- **`procesarDecision`**  
  Procesa la decisión de aprobación o rechazo mediante POST con token de seguridad.  
  ✅ *Actualiza estado y notifica a todas las partes involucradas*

- **`aprobarRechazarSolicitud`**  
  Maneja los clics en enlaces de aprobación/rechazo desde emails.  
  🔗 *Endpoint GET con respuesta HTML visual*

---

### 📋 `solicitudesController.js` (106 líneas)
**Responsabilidad:** CRUD y consultas de solicitudes de desarrollo

#### Funciones:
- **`getDashboardData`**  
  Obtiene todas las solicitudes, actividades no archivadas y sprints para el dashboard.  
  🎯 *Endpoint principal para cargar la vista administrativa*

- **`updateSolicitudField`**  
  Actualiza cualquier campo de una solicitud (estado, asignación, prioridad, comentarios).  
  🔄 *Función genérica para ediciones*

- **`getSolicitudProgress`**  
  Calcula y retorna estadísticas de progreso de tareas asociadas a una solicitud.  
  📊 *Incluye: total, completadas, en progreso, pendientes y porcentaje*

---

### 📝 `actividadesController.js` (358 líneas)
**Responsabilidad:** Gestión completa del tablero Kanban y tareas

#### Funciones:
- **`addKanbanTask`**  
  Crea nuevas tareas con validación y limpieza de datos.  
  ➕ *Soporta asociación a solicitudes y sprints*

- **`updateKanbanTaskStatus`**  
  Actualiza estado y/o datos de una tarea.  
  🔄 *Incluye sincronización automática con el estado de la solicitud padre*

- **`deleteKanbanTask`**  
  Elimina una tarea y re-sincroniza la solicitud asociada.  
  🗑️ *Incluye logs para auditoría*

- **`getArchivedTasks`**  
  Obtiene todas las tareas archivadas con información de sprint.  
  📦 *Para vista de histórico*

- **`toggleArchivarTarea`**  
  Archiva o desarchivar tareas terminadas.  
  🔐 *Solo permite archivar tareas en estado "Terminado"*

- **`syncTaskWithSolicitud`** *(auxiliar)*  
  Sincroniza automáticamente el estado de la solicitud según el estado de sus tareas.  
  ⚙️ *Lógica de estados: En Desarrollo → En Soporte → Completado*

---

### 🏃 `sprintsController.js` (264 líneas)
**Responsabilidad:** CRUD completo de sprints de desarrollo

#### Funciones:
- **`getAllSprints`**  
  Lista todos los sprints con contador de tareas asociadas.  
  📋 *Ordenados por fecha de creación descendente*

- **`getSprintById`**  
  Obtiene detalles completos de un sprint específico con todas sus tareas.  
  🔍 *Incluye relaciones con actividades*

- **`createSprint`**  
  Crea un nuevo sprint con validaciones de fechas y estado.  
  ✨ *Auto-desactiva otros sprints si se crea uno activo*

- **`updateSprint`**  
  Actualiza datos de un sprint existente.  
  📝 *Validaciones de fechas y gestión de sprint activo único*

- **`deleteSprint`**  
  Elimina un sprint con validación de tareas asociadas.  
  ⚠️ *Previene eliminación si tiene tareas asignadas*

---

### 🔗 `solicitudController.js` (39 líneas)
**Responsabilidad:** Archivo índice para compatibilidad

#### Funcionalidad:
- Re-exporta todas las funciones de los controladores especializados
- Mantiene compatibilidad con importaciones existentes
- Permite refactorización sin breaking changes

```javascript
// Importación unificada (backward compatible)
import { notificarSolicitud } from './controllers/solicitudController.js';

// O importación directa desde controlador específico
import { notificarSolicitud } from './controllers/notificacionController.js';
```

---

## �️ Rutas API Actualizadas

### Archivo: `solicitudRoutes.js`

#### Flujo de Solicitudes
```javascript
POST   /api/solicitudes/notificar          // Notificar nueva solicitud
GET    /api/solicitudes/approve            // Aprobar/rechazar por link
POST   /api/solicitudes/decision           // Procesar decisión con token
```

#### Dashboard y Gestión
```javascript
GET    /api/solicitudes/dashboard          // Cargar datos del dashboard
PUT    /api/solicitudes/update-field       // Actualizar campo de solicitud
GET    /api/solicitudes/:codigo/progress   // Obtener progreso de solicitud
```

#### Actividades (Kanban)
```javascript
POST   /api/actividades/add                // Crear nueva tarea
PUT    /api/actividades/update-status      // Actualizar tarea (con sync)
DELETE /api/actividades/:taskId            // Eliminar tarea
GET    /api/actividades/archivadas         // Listar tareas archivadas
PUT    /api/actividades/:taskId/archivo    // Archivar/desarchivar tarea
```

#### Sprints
```javascript
GET    /api/sprints                        // Listar todos los sprints
GET    /api/sprints/:sprintId              // Obtener sprint específico
POST   /api/sprints/create                 // Crear nuevo sprint
PUT    /api/sprints/:sprintId              // Actualizar sprint
DELETE /api/sprints/:sprintId              // Eliminar sprint
```

---

## 🎯 Beneficios de la Refactorización

| Antes | Después |
|-------|---------|
| ❌ 1 archivo de 1500+ líneas | ✅ 5 archivos especializados |
| ❌ Difícil de navegar | ✅ Organización clara por dominio |
| ❌ Mezcla de responsabilidades | ✅ Separación de concerns |
| ❌ Difícil de testear | ✅ Funciones aisladas testeables |
| ❌ Conflictos en colaboración | ✅ Archivos independientes |

---

## 🔐 Compatibilidad

✅ **Frontend sin cambios necesarios** - Todas las rutas permanecen iguales  
✅ **Backward compatible** - El archivo índice mantiene importaciones antiguas  
✅ **Sin breaking changes** - Refactorización interna transparente  

---

## 📝 Notas de Desarrollo

- **Fecha de refactorización:** Octubre 30, 2025
