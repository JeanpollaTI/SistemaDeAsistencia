import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import logoImage from './Logoescuela.png';
import ConfirmacionModal from './ConfirmacionModal';


// La URL de la API se obtiene de las variables de entorno para Vercel/Render


const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';


// ======================================
// --- 1. Componente de Notificación (Integrado) ---
// ======================================
function Notificacion({ mensaje, tipo, onClose }) {
    useEffect(() => {
        if (mensaje) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [mensaje, onClose]);

    if (!mensaje) return null;

    const claseTipo = tipo === 'exito' ? 'exito' : 'error';

    // CLAVE: Usamos un z-index alto para la notificación
    return <div className={`notificacion-flotante ${claseTipo}`}>{mensaje}</div>;
}


// ======================================
// --- COMPONENTE NUEVO: Modal para Nombre de Tarea ---
// Se abre una vez por columna (tareaIndex) para asignar el nombre a todos.
// ======================================
const ModalNombreTarea = ({ criterioNombre, tareaIndex, nombreActual, onGuardar, onClose, onEliminar }) => {
    const [nombreTarea, setNombreTarea] = useState(nombreActual || '');

    const handleSave = () => {
        if (nombreTarea.trim()) {
            onGuardar(nombreTarea, criterioNombre, tareaIndex);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1060 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ textAlign: 'center' }}>Asignar Nombre a Trabajo</h3>
                <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#ccc', fontSize: '0.9rem' }}>
                    Asignarás el nombre a la **Tarea {tareaIndex + 1}** del criterio **{criterioNombre}** para **todos** los alumnos.
                </p>

                <input
                    type="text"
                    placeholder={`Nombre del Trabajo ${tareaIndex + 1}`}
                    value={nombreTarea}
                    onChange={e => setNombreTarea(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '1.5rem',
                        fontSize: '1.1rem',
                        borderRadius: '6px',
                        border: '1px solid #555',
                        backgroundColor: '#333',
                        color: 'white',
                    }}
                />

                <div className="modal-actions" style={{ justifyContent: 'space-between', marginTop: '0' }}>
                    <button className="btn btn-cancel" onClick={onClose}>Cancelar</button>
                    {nombreActual && (
                        <button
                            className="btn btn-danger"
                            onClick={() => onEliminar(criterioNombre, tareaIndex)}
                            style={{ backgroundColor: '#d32f2f', color: 'white', border: 'none' }}
                        >
                            Eliminar
                        </button>
                    )}
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={!nombreTarea.trim()}
                    >
                        Guardar Nombre
                    </button>
                </div>
            </div>
        </div>
    );
};


// ======================================
// --- COMPONENTE NUEVO: Celda de Calificación (CORREGIDO) ---
// La corrección es la línea 91, que ahora solo pide el nombre si !tareaData.nombre
// ======================================
const CriterioCell = React.memo(({
    alumnoId,
    bimestreActivo,
    criterioNombre,
    tareaIndex,
    calificaciones,
    handleCalificacionChange,
    formatFechaTooltip,
    setTareaPorNombrar,

    rowIndex, // 🌟 NEW PROP: Row index per student
    colIndex,  // 🌟 NEW PROP: Column index per task
    onPasteValues // 🌟 NEW PROP: Handler del padre para updates masivos
}) => {
    // La estructura de la data es: { nota: X, fecha: Y, nombre: Z }
    const entrada = calificaciones[alumnoId]?.[bimestreActivo]?.[criterioNombre]?.[tareaIndex];
    const tareaData = entrada || {};

    const handleChange = (e) => {
        const valor = e.target.value;
        handleCalificacionChange(alumnoId, bimestreActivo, criterioNombre, tareaIndex, valor);
    };

    // Ajustamos el Tooltip para mostrar el nombre
    const fechaFormatted = formatFechaTooltip(tareaData.fecha);
    const tooltipText = tareaData.nombre ?
        `${tareaData.nombre} (${tareaIndex + 1})\nFecha: ${fechaFormatted}` :
        `Tarea ${tareaIndex + 1}: ${fechaFormatted}`;

    // 🌟 Keyboard Navigation Logic
    const handleKeyDown = (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            let nextRow = rowIndex;
            let nextCol = colIndex;

            if (e.key === 'ArrowUp') nextRow = rowIndex - 1; // Allow going up freely (checked by getElementById)
            if (e.key === 'ArrowDown') nextRow = rowIndex + 1;
            if (e.key === 'ArrowLeft') nextCol = colIndex - 1; // Allow negative for Obs column
            if (e.key === 'ArrowRight') nextCol = colIndex + 1;

            const nextId = `cell-${nextRow}-${nextCol}`;
            const nextElement = document.getElementById(nextId);
            if (nextElement) {
                nextElement.focus();
                // Optional: Select text when focusing
                setTimeout(() => nextElement.select(), 0);
            }
        }
    };

    // 🌟 Manejo del Pegado (Paste)
    const handlePaste = (e) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('Text');
        if (!clipboardData) return;

        // Parsear filas y columnas
        // Excel usa \t para separar columnas y \n para filas
        const rows = clipboardData.split(/\r?\n/).filter(r => r.trim() !== '');
        if (rows.length === 0) return;

        const matrix = rows.map(row => row.split('\t'));

        // Necesitamos notificar al padre para que haga el update masivo
        // Pasamos: mi posición (rowIndex, colIndex) y la matriz de datos
        if (onPasteValues) {
            onPasteValues(rowIndex, colIndex, matrix);
        }
    };

    return (
        <input
            id={`cell-${rowIndex}-${colIndex}`} // 🌟 Unique ID for navigation
            type="number"
            min="5" max="10" step="0.1"
            className="cuadrito-calificacion"
            placeholder=""
            value={tareaData.nota ?? ''}
            title={tooltipText}
            onChange={handleChange}
            onKeyDown={handleKeyDown} // 🌟 Attach handler
            onPaste={handlePaste}     // 🌟 Paste handler
            onBlur={() => {
                // Validación al perder foco: Si es número válido y < 5, ajustar a 5
                if (typeof tareaData.nota === 'number' && tareaData.nota > 0 && tareaData.nota < 5) {
                    handleCalificacionChange(alumnoId, bimestreActivo, criterioNombre, tareaIndex, 5);
                }
            }}
        />
    );
});


// ======================================
// --- 2. Componente Principal: Trabajos ---
// Se encarga de manejar el modal de criterios y las notificaciones para toda la pantalla.
// ======================================
function Trabajos({ user }) {

    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
    const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState(null);

    // Estados levantados de PanelCalificaciones
    const [modalCriterios, setModalCriterios] = useState(false);
    const [criteriosPorBimestre, setCriteriosPorBimestre] = useState({ 1: [], 2: [], 3: [] });
    const [notificacion, setNotificacion] = useState({ mensaje: null, tipo: '' });

    useEffect(() => {
        const fetchGrupos = async () => {
            const token = localStorage.getItem('token');
            const userId = user?._id || user?.id;

            if (!token || !userId) {
                setLoading(false);
                setError("Error de autenticación: Usuario o token no disponible.");
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            try {
                const url = '/grupos/mis-grupos?populate=alumnos,profesoresAsignados.profesor';
                const res = await axios.get(`${API_URL}${url}`, config);
                setGrupos(res.data);
            } catch (err) {
                setError("No se pudieron cargar los grupos.");
                console.error("Error fetching groups:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGrupos();
    }, [user]);

    const handleSeleccionarGrupo = (grupo, asignatura) => {
        setGrupoSeleccionado(grupo);
        setAsignaturaSeleccionada(asignatura);
        // Resetea el estado de criterios para el nuevo grupo/asignatura
        setCriteriosPorBimestre({ 1: [], 2: [], 3: [] });
    };

    const handleVolver = () => {
        setGrupoSeleccionado(null);
        setAsignaturaSeleccionada(null);
    };

    if (loading) return <div className="trabajos-container grupo-componente" style={{ textAlign: 'center', paddingTop: '10rem' }}><p style={{ color: '#E9E9E9' }}>Cargando tus grupos...</p></div>;
    if (error) return <div className="trabajos-container grupo-componente error-mensaje" style={{ textAlign: 'center', paddingTop: '10rem' }}><p>{error}</p></div>;
    if (!grupos || grupos.length === 0) return (
        <div className="trabajos-container grupo-componente" style={{ textAlign: 'center', paddingTop: '10rem' }}>
            <h2 style={{ color: '#f39c12' }}>No tienes grupos asignados.</h2>
            <p style={{ marginTop: '1rem' }}>Solicita al administrador que te asigne grupos y materias.</p>
        </div>
    );


    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

                /* ================================================= */
                /* ESTILOS EXCLUSIVOS PARA Trabajos.js               */
                /* ================================================= */

                /* --- FUENTES Y VARIABLES GLOBALES --- */
                .grupo-componente {
                    --dark-color: #191D28;
                    --dark-color-alt: #1E222D;
                    --main-color: #b9972b; /* Tono Dorado/Amarillo formal */
                    --title-color: #FFFFFF;
                    --text-color: #E9E9E9;
                    --danger-color: #d32f2f; /* Rojo formal */
                    --success-color: #27ae60; /* Verde formal */
                    --warning-color: #f39c12; /* Naranja/Amarillo de advertencia */

                    --body-font: 'Poppins', sans-serif;
                    --font-semi-bold: 600;
                    background-color: var(--dark-color);
                    min-height: 100vh;
                }
                /* ... Estilos restantes ... */
                /* CLAVE: Aseguramos que el overlay del modal de criterios esté por encima del Panel */
                .grupo-componente .modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 1050; /* Z-INDEX ALTO */
                }
                .notificacion-flotante {
                    /* ... estilos ... */
                    z-index: 2000; /* Z-INDEX MÁS ALTO PARA NOTIFICACIONES */
                    /* ... estilos ... */
                }
                /* ... Estilos restantes (deben ser los mismos que en el ejemplo anterior) ... */
                /* ESTILOS DE TABLA Y BOTONES (SE MANTIENEN IGUAL) */
                .grupo-componente {
                    font-family: var(--body-font);
                    color: var(--text-color);
                }

                .grupo-componente .trabajos-container {
                    padding-top: 8rem;
                    padding-bottom: 2rem;
                    max-width: 95%; /* 🌟 AUMENTO: Usar más espacio de pantalla (antes 1200px) */
                    margin: 0 auto;
                    padding-left: 1rem;
                    padding-right: 1rem;
                }

                .grupo-componente h1, h2, h3 {
                    color: var(--title-color);
                    font-weight: var(--font-semi-bold);
                }

                .grupo-componente .main-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    border-bottom: 2px solid var(--dark-color-alt);
                    padding-bottom: 1.5rem;
                    width: 100%;
                }
                .grupo-componente .main-header h1 {
                    font-size: 2.5rem;
                }
                .grupo-componente .main-header h2 {
                    font-size: 1.8rem;
                }

                .grupo-componente .subtitulo {
                    text-align: center;
                    margin-bottom: 3rem;
                    font-size: 1.4rem;
                    color: var(--main-color);
                }

                /* --- BOTONES --- */
                .grupo-componente .btn {
                    display: inline-block;
                    padding: 0.8rem 1.5rem;
                    border-radius: .5rem;
                    font-weight: 500;
                    transition: all .3s;
                    cursor: pointer;
                    color: var(--text-color);
                    background-color: #3C414C;
                    border: 1px solid #555;
                }
                .grupo-componente .btn:hover {
                    filter: brightness(1.1);
                    transform: translateY(-2px);
                    border-color: var(--main-color);
                }
                .grupo-componente .btn-primary {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    border-color: var(--main-color);
                    font-weight: 600;
                }
                .grupo-componente .btn-cancel {
                    background-color: #2c3e50;
                    color: white;
                    border-color: #2c3e50;
                }
                .grupo-componente .btn-secondary {
                    background-color: #34495e;
                    color: white;
                    border-color: #34495e;
                }
                .grupo-componente .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    filter: none;
                }

                /* --- TABLA DE SELECCIÓN DE GRUPO --- */
                .grupo-componente .grupos-table-wrapper {
                    display: flex;
                    justify-content: center;
                    width: 100%;
                }
                .grupo-componente .grupos-table {
                    width: 90%;
                    max-width: 800px;
                    margin-top: 2rem;
                    border-collapse: separate;
                    border-spacing: 0;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                    border-radius: 12px;
                    overflow: hidden;
                }
                .grupo-componente .grupos-table thead th {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    padding: 18px 25px;
                    text-align: left;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .grupo-componente .grupos-table tbody td {
                    padding: 15px 25px;
                    border-bottom: 1px solid #333;
                    color: var(--text-color);
                }
                .grupo-componente .grupos-table tbody tr {
                    background-color: var(--dark-color-alt);
                    transition: background-color 0.3s;
                }
                .grupo-componente .grupos-table tbody tr:hover {
                    background-color: #2a2f3c;
                }
                .grupo-componente .grupos-table tbody tr:last-of-type td {
                    border-bottom: none;
                }
                .grupo-componente .grupos-table .acciones-cell {
                    display: flex;
                    gap: 10px;
                }
                .grupo-componente .grupos-table .btn-primary {
                    padding: 0.6rem 1.2rem;
                    font-size: 0.9rem;
                }

                /* ================================================= */
                /* ESTILOS PARA EL PANEL DE CALIFICACIÓN TIPO ASISTENCIA */
                /* ================================================= */

                .grupo-componente .modal-backdrop-solid {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background-color: var(--dark-color);
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    z-index: 1000;
                    padding: 5rem 1rem 2rem 1rem;
                    box-sizing: border-box;
                    overflow-y: auto;
                }

                /* ESTILOS EXCLUSIVOS PARA Trabajos.js               */
                /* ================================================= */

                /* --- FUENTES Y VARIABLES GLOBALES --- */
                .grupo-componente {
                    --dark-color: #191D28;
                    --dark-color-alt: #1E222D;
                    --main-color: #b9972b; /* Tono Dorado/Amarillo formal */
                    --title-color: #FFFFFF;
                    --text-color: #E9E9E9;
                    --danger-color: #d32f2f; /* Rojo formal */
                    --success-color: #27ae60; /* Verde formal */
                    --warning-color: #f39c12; /* Naranja/Amarillo de advertencia */

                    --body-font: 'Poppins', sans-serif;
                    --font-semi-bold: 600;
                    background-color: var(--dark-color);
                    min-height: 100vh;
                }

                /* Base de Modales y Notificaciones (Mantenidas) */
                .grupo-componente .modal-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex; justify-content: center; align-items: center;
                    z-index: 1050;
                }
                .notificacion-flotante {
                    position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2000;
                    padding: 12px 25px; border-radius: 8px; font-weight: 600; font-size: 1rem;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); opacity: 0; visibility: hidden;
                    animation: fadeInOut 3.5s ease-in-out forwards;
                }
                .notificacion-flotante.exito { background-color: var(--success-color); color: var(--dark-color); border: 1px solid #1a8a49; }
                .notificacion-flotante.error { background-color: var(--danger-color); color: var(--title-color); border: 1px solid #a32222; }
                @keyframes fadeInOut {
                    0% { opacity: 0; visibility: hidden; transform: translate(-50%, -20px); }
                    5% { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
                    90% { opacity: 1; visibility: visible; transform: translate(-50%, 0); }
                    100% { opacity: 0; visibility: hidden; transform: translate(-50%, -20px); }
                }

                /* Estilos de Contenedor y Títulos (Mantenidos) */
                .grupo-componente .trabajos-container { padding-top: 8rem; padding-bottom: 2rem; max-width: 98%; margin: 0 auto; padding-left: 1rem; padding-right: 1rem; }
                .grupo-componente h1, h2, h3 { color: var(--title-color); font-weight: var(--font-semi-bold); }
                .grupo-componente .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 2px solid var(--dark-color-alt); padding-bottom: 1.5rem; width: 100%; }
                .grupo-componente .main-header h1 { font-size: 2.5rem; }
                .grupo-componente .main-header h2 { font-size: 1.8rem; }
                .grupo-componente .subtitulo { text-align: center; margin-bottom: 3rem; font-size: 1.4rem; color: var(--main-color); }

                /* --- ESTILOS DE BOTONES BASE --- */
                .grupo-componente .btn {
                    display: inline-block; padding: 0.8rem 1.5rem; border-radius: .5rem;
                    font-weight: 500; transition: all .3s; cursor: pointer; color: var(--text-color);
                    background-color: #3C414C; border: 1px solid #555;
                }
                .grupo-componente .btn:hover {
                    filter: brightness(1.1); transform: translateY(-2px); border-color: var(--main-color);
                }
                .grupo-componente .btn-primary {
                    background-color: var(--main-color); color: var(--dark-color);
                    border-color: var(--main-color); font-weight: 600;
                }
                .grupo-componente .btn-cancel {
                    background-color: #2c3e50; color: white; border-color: #2c3e50;
                }
                .grupo-componente .btn-secondary {
                    background-color: #34495e; color: white; border-color: #34495e;
                }
                .grupo-componente .btn:disabled {
                    opacity: 0.6; cursor: not-allowed; transform: none; filter: none;
                }

                /* Estilos de asistencia (Mantenidos) */
                .grupo-componente .modal-backdrop-solid {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: var(--dark-color); display: flex;
                    justify-content: center; align-items: flex-start;
                    z-index: 1000; padding: 5rem 1rem 2rem 1rem; box-sizing: border-box;
                    overflow-y: auto;
                }
                /* ... otros estilos de asistencia (cuadritos, etc.) ... */


                /* ================================================= */
                /* 🎨 MODAL DE CRITERIOS (ENFOQUE EN FORMULARIO Y BOTONES) */
                /* ================================================= */

                .grupo-componente .modal-content {
                    background-color: var(--dark-color-alt);
                    padding: 2.5rem; border-radius: 12px; width: 90%;
                    max-width: 550px; /* Reducido para centralizar */
                    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
                }
                .grupo-componente .modal-content h2 {
                    text-align: center;
                    margin-bottom: 1.5rem;
                    font-size: 1.8rem;
                }
                .grupo-componente .modal-content .bimestre-selector {
                    justify-content: center;
                    border-bottom: none;
                    padding: 0;
                }
                .grupo-componente .modal-content .bimestre-selector .btn {
                    padding: 0.6rem 1.2rem;
                    font-weight: 500;
                    background-color: var(--dark-color);
                    color: var(--text-color);
                    border: 1px solid #444;
                    box-shadow: none;
                    transition: all 0.2s;
                }
                .grupo-componente .modal-content .bimestre-selector .btn-primary {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    border-color: var(--main-color);
                    font-weight: 700;
                }

                /* Listado de Criterios */
                .grupo-componente h3 {
                    margin-top: 1rem;
                    font-size: 1.3rem;
                    border-bottom: 1px solid #333;
                    padding-bottom: 10px;
                }
                .grupo-componente .criterio-item {
                    background-color: var(--dark-color);
                    border-left: 5px solid var(--main-color);
                    margin-bottom: 8px;
                }
                .grupo-componente .criterio-item button {
                    color: var(--danger-color);
                    background: none; border: none; cursor: pointer;
                    line-height: 1; font-size: 1.4rem;
                    transition: color 0.2s;
                }
                .grupo-componente .criterio-item button:hover {
                    color: #ff5252;
                }

                /* 📌 Formulario de Adición de Criterios (Mejora clave) */
                .grupo-componente .criterio-form {
                    display: flex;
                    gap: 15px; /* Espaciado cómodo */
                    margin: 2rem 0 1.5rem 0;
                    align-items: center;
                }
                .grupo-componente .criterio-form input {
                    /* Estilo base de input más formal */
                    background: var(--dark-color);
                    border: 1px solid #444;
                    border-radius: 6px;
                    color: var(--text-color);
                    padding: 10px 12px;
                    font-size: 1rem;
                    font-weight: 400;
                    box-sizing: border-box;
                }
                .grupo-componente .criterio-form input:focus {
                    border-color: var(--main-color);
                    box-shadow: 0 0 3px rgba(185, 151, 43, 0.8);
                    background-color: #242935;
                }
                .grupo-componente .criterio-form input[type="text"] {
                    flex-grow: 2; /* El nombre toma la mayor parte del espacio */
                    max-width: none;
                }

                /* Wrapper para el input de porcentaje */
                .grupo-componente .porcentaje-wrapper {
                    position: relative;
                    flex-grow: 0;
                    width: 100px; /* Ancho fijo para el porcentaje */
                }
                .grupo-componente .porcentaje-wrapper::after {
                    content: '%';
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #666;
                    pointer-events: none;
                }
                .grupo-componente .criterio-form input[type="number"] {
                    padding-right: 30px;
                    text-align: right;
                }

                /* Botón Añadir */
                .grupo-componente .criterio-form .btn {
                    padding: 10px 15px;
                    font-weight: 600;
                    line-height: 1.4;
                    border-radius: 6px;
                    white-space: nowrap;
                }

                /* Total del Bimestre y Acciones */
                .grupo-componente .criterio-total {
                    text-align: right; font-size: 1.1rem; font-weight: bold;
                    margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #444;
                }
                .grupo-componente .modal-actions {
                    margin-top: 1.5rem;
                }
                .grupo-componente .modal-actions .btn-primary {
                    padding: 0.8rem 1.5rem;
                    transform: none; /* Asegurar que no se mueva en el hover aquí */
                }
                .grupo-componente .modal-actions .btn-cancel {
                    background-color: transparent;
                    color: var(--text-color);
                    border-color: #555;
                    padding: 0.8rem 1.5rem;
                }
                .grupo-componente .modal-actions .btn-cancel:hover {
                    background-color: #2a2f3c;
                    transform: none;
                }



                .grupo-componente .modal-content.asistencia-modal-content {
                    background-color: var(--dark-color-alt);
                    border-radius: 12px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
                    padding: 20px;
                    width: 98%;
                    max-width: 98%;
                    margin: 0;
                    padding-bottom: 8rem; /* 🌟 FIX: Extra space for Save button on Tablets/Mobile */
                }

                .grupo-componente .bimestre-selector {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 2rem;
                    padding: 10px 20px;
                    border-bottom: 1px solid #333;
                }
                .grupo-componente .bimestre-selector .btn {
                    padding: 10px 20px;
                    font-size: 1rem;
                }

                .grupo-componente .asistencia-grid {
                    padding: 1rem 0;
                }

                .grupo-componente .asistencia-body {
                    max-height: 65vh;
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .grupo-componente .asistencia-row {
                    display: grid;
                    grid-template-columns: 350px 1fr 100px; /* Reduced first column width */
                    align-items: center;
                    padding: 10px 20px;
                    background-color: var(--dark-color);
                    border-radius: 8px;
                    border-bottom: 1px solid var(--dark-color-alt);
                    margin-bottom: 5px;
                }
                .grupo-componente .asistencia-row:hover {
                    background-color: #2a2f3c;
                }

                .grupo-componente .alumno-nombre {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-weight: 500;
                    font-size: 1.1rem;
                    color: var(--title-color);
                }

                .grupo-componente .bimestres-container {
                    display: flex;
                    flex-grow: 1;
                    justify-content: flex-start;
                    gap: 10px;
                    flex-wrap: wrap; /* Allow wrapping */
                }

                .grupo-componente .bimestre-header-btn {
                    text-align: center;
                    padding: 6px 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.3s;
                    background-color: var(--dark-color-alt);
                    color: var(--text-color);
                    font-size: 0.85rem;
                    white-space: nowrap;
                    border: 1px solid #444;
                }
                .grupo-componente .bimestre-header-btn:hover {
                    border-color: var(--main-color);
                    filter: brightness(1.2);
                }
                .grupo-componente .bimestre-header-btn.activo {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    font-weight: bold;
                    border-color: var(--main-color);
                    box-shadow: 0 0 8px rgba(185, 151, 43, 0.7);
                }

                .grupo-componente .promedio-final-display {
                    width: 120px;
                    flex-shrink: 0;
                    text-align: right;
                    font-weight: bold;
                    font-size: 1.2rem;
                    color: var(--main-color);
                }

                .grupo-componente .bimestre-desplegable {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.4s ease-out, padding 0.4s ease-out, margin 0.4s ease-out;
                    padding: 0 20px;
                    margin: 0;
                    background-color: var(--dark-color-alt);
                    border-radius: 8px;
                    grid-column: 1 / -1;
                }
                .grupo-componente .bimestre-desplegable.desplegado {
                    max-height: 500px;
                    padding: 20px;
                    margin: 5px 0 10px 0;
                }

                .grupo-componente .criterio-resumen-wrapper {
                    display: flex;
                    justify-content: center;
                    width: 100%;
                    margin-bottom: 20px;
                }
                .grupo-componente .criterio-resumen {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    font-weight: bold;
                    padding: 12px 25px;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 500px;
                    text-align: center;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                }
                .grupo-componente .criterio-resumen .criterio-info {
                    flex-grow: 1;
                    text-align: left;
                    font-size: 1rem;
                }
                .grupo-componente .criterio-resumen .criterio-prom {
                    font-size: 1.3em;
                    margin-left: 10px;
                }

                /* Responsive adjustments for mobile */
                @media (max-width: 768px) {
                    .grupo-componente .asistencia-row {
                        grid-template-columns: 1fr auto !important; /* Stack name and average */
                        grid-template-areas: 
                            "nombre promedio"
                            "bimestres bimestres";
                        gap: 10px;
                        padding: 15px;
                    }
                    .grupo-componente .alumno-nombre {
                        grid-area: nombre;
                        font-size: 1rem;
                        white-space: normal; /* Allow wrapping */
                    }
                    .grupo-componente .promedio-final-display {
                        grid-area: promedio;
                        text-align: right;
                        width: auto;
                    }
                    .grupo-componente .bimestres-container {
                        grid-area: bimestres;
                        width: 100%;
                        overflow-x: auto;
                        padding-bottom: 5px;
                        justify-content: flex-start; /* Start align for scroll */
                    }
                    .grupo-componente .bimestre-header-btn {
                        flex-shrink: 0; /* Prevent shrinking */
                    }
                }

                .grupo-componente .cuadritos-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                    gap: 8px;
                    align-items: center;
                    padding: 10px 0;
                }

                .grupo-componente .cuadrito-calificacion {
                    width: 70px; /* Ancho ligeramente mayor */
                    height: 42px; /* Altura suficiente para ver el texto completo */
                    line-height: 40px; /* Centrado vertical del texto */
                    background-color: #4a4a4a;
                    border: 1px solid #777;
                    border-radius: 6px;
                    color: white;
                    text-align: center;
                    font-weight: 600;
                    font-family: var(--body-font);
                    font-size: 1.1rem; /* Importante: tamaño legible */
                    padding: 0; /* Evitar padding interno que desplace el texto */
                    transition: all 0.2s;
                }
                .grupo-componente .cuadrito-calificacion::placeholder {
                    color: #999;
                    font-size: 0.9em;
                }
                .grupo-componente .cuadrito-calificacion:focus {
                    outline: 2px solid var(--main-color);
                    background-color: #5f5f5f;
                }
                .grupo-componente .cuadrito-calificacion::-webkit-outer-spin-button,
                .grupo-componente .cuadrito-calificacion::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                .grupo-componente .btn-agregar-dias {
                    background-color: #34495e;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    width: 60px;
                    height: 38px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s, background-color 0.2s;
                    font-size: 1.1rem;
                }
                .grupo-componente .btn-agregar-dias:hover {
                    transform: scale(1.05);
                    background-color: #4b6587;
                }

                /* --- TASK HEADERS --- */
                .grupo-componente .task-header-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                    gap: 8px;
                    margin-bottom: 5px;
                    padding-right: 68px; /* Space for the +5 button */
                }

                .grupo-componente .task-header-cell {
                    width: 60px;
                    font-size: 0.7rem;
                    text-align: center;
                    color: #aaa;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    transition: color 0.2s;
                }
                .grupo-componente .task-header-cell:hover {
                    color: var(--main-color);
                    font-weight: bold;
                }
                .grupo-componente .task-header-cell.named {
                    color: var(--main-color);
                    font-weight: 600;
                }

                /* --- MODAL DE CRITERIOS (CON NUEVOS ESTILOS) --- */
                .grupo-componente .modal-content {
                    background-color: var(--dark-color-alt);
                    padding: 2.5rem; border-radius: 12px; width: 90%;
                    max-width: 900px; /* Wider for PC */
                    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                }
                /* New Grid Layout for Modal Content */
                .grupo-componente .modal-grid-layout {
                    display: grid;
                    grid-template-columns: 1.2fr 0.8fr;
                    gap: 2rem;
                    margin-top: 1rem;
                }
                @media (max-width: 768px) {
                    .grupo-componente .modal-grid-layout {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                }
                .grupo-componente .modal-content h2 {
                    text-align: center;
                    margin-bottom: 2rem;
                    font-size: 1.6rem;
                }

                .grupo-componente .modal-actions {
                    display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;
                }

                .grupo-componente .criterio-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: var(--dark-color);
                    padding: 12px 20px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 5px solid var(--main-color);
                }
                .grupo-componente .criterio-item span {
                    font-size: 1rem;
                }
                .grupo-componente .criterio-item span strong {
                    color: var(--main-color);
                    font-size: 1.1rem;
                }
                .grupo-componente .criterio-item button {
                    color: var(--danger-color);
                    width: 30px;
                    height: 30px;
                    font-size: 1.5rem;
                }

                /* MEJORA: Formulario de adición de criterios */
                .grupo-componente .criterio-form {
                    display: flex;
                    gap: 10px; /* Reducimos el espacio */
                    margin: 2rem 0 1rem 0;
                    align-items: center;
                }
                /* MEJORA: Inputs más grandes y visualmente impactantes */
                .grupo-componente .criterio-form input {
                    background: var(--dark-color);
                    border: 2px solid #555; /* Borde más grueso */
                    border-radius: 8px;
                    color: var(--text-color);
                    padding: 14px 12px; /* Mayor padding vertical */
                    box-sizing: border-box;
                    font-size: 1.05rem; /* Letra un poco más grande */
                    font-weight: 500;
                }
                .grupo-componente .criterio-form input:focus {
                    border-color: var(--main-color);
                    box-shadow: 0 0 5px rgba(185, 151, 43, 0.5); /* Sombra al enfocar */
                }

                .grupo-componente .porcentaje-wrapper {
                    position: relative;
                    flex-grow: 1;
                    max-width: 120px; /* Reducimos el ancho para que el botón "Añadir" quepa mejor */
                }
                .grupo-componente .porcentaje-wrapper::after {
                    content: '%';
                    position: absolute;
                    right: 15px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #888;
                    pointer-events: none;
                }
                .grupo-componente .criterio-form input[type="number"] {
                    padding-right: 35px;
                    text-align: center; /* Centramos el porcentaje */
                }
                /* MEJORA: Botón Añadir más llamativo y con el color principal */
                .grupo-componente .criterio-form .btn {
                    padding: 14px 25px; /* Más ancho para que no se vea apretado */
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    font-weight: 700; /* Botón de acción principal muy visible */
                    border: none;
                    border-radius: 8px;
                    line-height: 1;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3); /* Sombra más suave */
                    transition: background-color 0.2s, transform 0.2s;
                    margin-left: 10px; /* Separación extra */
                }
                .grupo-componente .criterio-form .btn:hover {
                    background-color: #d4b03f;
                    transform: none
                }
                .grupo-componente .criterio-total {
                    text-align: right; font-size: 1.3rem; font-weight: bold;
                    margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #444;
                    color: var(--text-color);
                }
                .grupo-componente .criterio-total.error {
                    color: var(--danger-color);
                }
                .grupo-componente .criterio-total strong {
                    color: var(--main-color);
                }
                .grupo-componente .criterio-total.error strong {
                    color: var(--danger-color);
                }

                .grupo-componente .aviso-criterios {
                    text-align: center; padding: 3rem; background-color: var(--dark-color);
                    border-radius: 12px; margin: 2rem;
                    border: 2px dashed var(--warning-color);
                    box-shadow: 0 0 15px rgba(243, 156, 18, 0.2);
                }
                .grupo-componente .aviso-criterios p {
                    margin-bottom: 2rem; font-size: 1.2rem; color: var(--warning-color);
                }

                /* --- ESTILOS DE SCROLLBAR (Mejorados) --- */
                .grupo-componente .asistencia-body::-webkit-scrollbar {
                    display: none;
                }
                .grupo-componente .asistencia-body {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .grupo-componente .modal-backdrop-solid::-webkit-scrollbar {
                    width: 8px;
                }
                .grupo-componente .modal-backdrop-solid::-webkit-scrollbar-track {
                    background: var(--dark-color-alt);
                }
                .grupo-componente .modal-backdrop-solid::-webkit-scrollbar-thumb {
                    background-color: var(--main-color);
                    border-radius: 10px;
                    border: 2px solid var(--dark-color-alt);
                }
                .grupo-componente .modal-backdrop-solid::-webkit-scrollbar-thumb:hover {
                    background-color: #d4b03f;
                }

                /* --- VISTA GLOBAL DE CRITERIOS (TABLA MASIVA) --- */
                .grupo-componente .tabs-criterios {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    padding: 0 20px;
                    flex-wrap: wrap;
                    border-bottom: 1px solid #444;
                    padding-bottom: 10px;
                }
                .grupo-componente .tab-criterio {
                    padding: 8px 20px;
                    background-color: transparent;
                    border: 1px solid #444;
                    border-radius: 20px;
                    color: var(--text-color);
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                    font-size: 0.95rem;
                }
                .grupo-componente .tab-criterio:hover {
                    background-color: #2a2f3c;
                    border-color: var(--main-color);
                    color: var(--main-color);
                }
                .grupo-componente .tab-criterio.activo {
                    background-color: var(--main-color);
                    color: var(--dark-color);
                    font-weight: 700;
                    border-color: var(--main-color);
                    box-shadow: 0 0 10px rgba(185, 151, 43, 0.4);
                }

                .grupo-componente .tabla-global-container {
                    overflow-x: auto;
                    padding: 0 20px 40px 20px;
                    max-height: 75vh; /* 🌟 FIX: Limit height for vertical scroll */
                    overflow-y: auto; /* 🌟 FIX: Enable vertical scroll */
                    border-bottom: 1px solid #444;
                }
                .grupo-componente .tabla-global {
                    width: 100%;
                    border-collapse: separate; /* Necesario para sticky headers */
                    border-spacing: 0;
                    min-width: 800px;
                }
                .grupo-componente .tabla-global th,
                .grupo-componente .tabla-global td {
                    padding: 8px 5px;
                    border-bottom: 1px solid #444;
                    border-right: 1px solid #444;
                    text-align: center;
                    vertical-align: middle;
                }
                .grupo-componente .tabla-global th {
                    background-color: #2c3e50;
                    color: white;
                    font-weight: 600;
                    font-size: 0.9rem;
                    position: sticky;
                    top: 0;
                    z-index: 100; /* 🌟 FIX: Higher z-index to stay on top */
                    height: 50px;
                    box-shadow: 0 2px 2px rgba(0,0,0,0.1); /* Optional shadow */
                }
                .grupo-componente .tabla-global th.alumno-col {
                    text-align: left;
                    min-width: 280px;
                    padding-left: 15px;
                    position: sticky;
                    left: 40px; /* 🌟 Offset for Number Column */
                    z-index: 110; /* 🌟 FIX: Even higher z-index (Top + Left Sticky) */
                    border-right: 2px solid #666;
                }
                .grupo-componente .tabla-global td.alumno-col {
                    text-align: left;
                    padding-left: 15px;
                    position: sticky;
                    left: 40px; /* 🌟 Offset for Number Column */
                    background-color: var(--dark-color-alt);
                    z-index: 10;
                    border-right: 2px solid #666;
                    font-weight: 500;
                    color: var(--text-color);
                }
                .grupo-componente .tabla-global .num-col {
                    position: sticky;
                    left: 0;
                    z-index: 31; /* Higher than alumno body, lower than alumno header? Same level */
                    background-color: #2c3e50;
                    border-right: 1px solid #444;
                }
                .grupo-componente .tabla-global tbody td:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 11;
                    background-color: var(--dark-color-alt);
                    border-right: 1px solid #444;
                }
                
                /* 🌟 OFFSETS FOR TECNOLOGIA (Approx +50px for Obs column) */
                .grupo-componente .tabla-global.with-obs th.alumno-col,
                .grupo-componente .tabla-global.with-obs td.alumno-col {
                    left: 90px !important;
                }
                
                .grupo-componente .tabla-global .obs-col {
                    position: sticky;
                    left: 40px;
                    z-index: 31;
                    background-color: #2c3e50;
                    border-right: 1px solid #444;
                    width: 50px;
                }
                .grupo-componente .tabla-global tbody td.obs-col-body {
                     position: sticky;
                     left: 40px;
                     z-index: 11;
                     background-color: var(--dark-color-alt);
                     border-right: 1px solid #444;
                     padding: 0;
                }
                .grupo-componente .tabla-global tbody td.obs-col-body input {
                    width: 100%;
                    height: 100%;
                    border: none;
                    background: transparent;
                    color: var(--warning-color);
                    text-align: center;
                    font-size: 1.2rem;
                }
                .grupo-componente .tabla-global tr:hover td {
                    background-color: rgba(185, 151, 43, 0.05);
                }
                /* Asegurar que la primera columna mantenga el color al hover de la fila */
                .grupo-componente .tabla-global tr:hover td.alumno-col {
                    background-color: #2a2f3c; 
                }

                .grupo-componente .tabla-header-task {
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                }
                .grupo-componente .tabla-header-task:hover .task-num {
                    color: var(--main-color);
                    text-decoration: underline;
                }
                .grupo-componente .tabla-header-task .task-name {
                    font-size: 0.7rem;
                    color: var(--main-color);
                    margin-bottom: 2px;
                    max-width: 80px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .grupo-componente .tabla-header-task .task-num {
                    font-size: 1rem;
                }
             `}</style>
            <div className="trabajos-container grupo-componente">
                {!grupoSeleccionado ? (
                    <ListaDeGrupos grupos={grupos} user={user} onSeleccionarGrupo={handleSeleccionarGrupo} />
                ) : (
                    <PanelCalificaciones
                        grupo={grupoSeleccionado}
                        asignatura={asignaturaSeleccionada}
                        onVolver={handleVolver}
                        setModalCriterios={setModalCriterios} // Pasa la función para abrir el modal
                        criteriosPorBimestre={criteriosPorBimestre} // Pasa el estado para consumo
                        setCriteriosPorBimestre={setCriteriosPorBimestre} // Pasa la función para actualizar
                        setNotificacion={setNotificacion} // Pasa la función para notificar
                        user={user} // ✅ CORRECCIÓN: Pasar la prop user para eliminar el error de compilación
                        modalCriterios={modalCriterios} // 🌟 PASAMOS EL ESTADO DEL MODAL AL HIJO
                    />
                )}
            </div>
            {/* 1. Notificación en el nivel superior */}
            <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} onClose={() => setNotificacion({ mensaje: null, tipo: '' })} />

            {/* 2. El Modal de Criterios ahora se maneja dentro de PanelCalificaciones para tener acceso a los datos */}
        </>
    );
}


// ======================================
// --- 3. Sub-componente: Panel Principal de Calificaciones (MODIFICADO) ---
// ======================================
const PanelCalificaciones = ({
    grupo,
    asignatura,
    onVolver,
    setModalCriterios,
    criteriosPorBimestre,
    setCriteriosPorBimestre,
    setNotificacion,
    user, // ✅ CORRECCIÓN: Recibir la prop user
    modalCriterios // 🌟 Recibimos el estado de visibilidad del modal
}) => {
    const [bimestreActivo, setBimestreActivo] = useState(1);
    const [calificaciones, setCalificaciones] = useState({});
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [criterioAbierto, setCriterioAbierto] = useState(null);
    const [numTareas, setNumTareas] = useState({});
    // 🌟 ESTADO AGREGADO: Para controlar cuándo y qué tarea necesita un nombre.
    const [tareaPorNombrar, setTareaPorNombrar] = useState(null);
    // 🌟 ESTADO AGREGADO: Para el modal de confirmación personalizado
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    // 🌟 ESTADO AGREGADO: Criterio seleccionado para vista masiva (null = vista lista, string = vista tabla)
    const [criterioSeleccionadoGlobal, setCriterioSeleccionadoGlobal] = useState(null);
    // 🌟 ESTADO AGREGADO: Zoom (Escala)
    const [zoomLevel, setZoomLevel] = useState(1);

    // 🌟 ESTADO AGREGADO: Historial para Deshacer/Rehacer (Undo/Redo)
    const [history, setHistory] = useState({ past: [], future: [] });

    // 🌟 MEMOIZED SORTED ALUMNOS
    // Fixes the issue where students shuffle randomly during render or updates.
    const sortedAlumnos = useMemo(() => {
        if (!grupo || !grupo.alumnos) return [];
        return [...grupo.alumnos].sort((a, b) =>
            a.apellidoPaterno.localeCompare(b.apellidoPaterno, 'es', { sensitivity: 'base' })
        );
    }, [grupo]);

    // 🌟 FUNCIONES UNDO/REDO
    const saveToHistory = () => {
        setHistory(curr => ({
            past: [...curr.past, calificaciones],
            future: []
        }));
    };

    const handleUndo = () => {
        setHistory(curr => {
            if (curr.past.length === 0) return curr;
            const previous = curr.past[curr.past.length - 1];
            const newPast = curr.past.slice(0, -1);
            return {
                past: newPast,
                future: [calificaciones, ...curr.future]
            };
        });
        setCalificaciones(history.past[history.past.length - 1]);
        setNotificacion({ mensaje: 'Cambio deshecho.', tipo: 'info' });
    };

    const handleRedo = () => {
        setHistory(curr => {
            if (curr.future.length === 0) return curr;
            const next = curr.future[0];
            const newFuture = curr.future.slice(1);
            return {
                past: [...curr.past, calificaciones],
                future: newFuture
            };
        });
        setCalificaciones(history.future[0]);
        setNotificacion({ mensaje: 'Cambio rehecho.', tipo: 'info' });
    };

    // Obtener los criterios del bimestre activo
    const criteriosActivos = criteriosPorBimestre[bimestreActivo] || [];

    // 🌟 Manejador para guardar criterios que viene del Modal (Auto-save)
    const handleGuardarCriterios = useCallback(async (nuevosCriterios) => {
        setCriteriosPorBimestre(nuevosCriterios);
        setModalCriterios(false);
        setNotificacion({ mensaje: 'Guardando nuevos criterios...', tipo: 'info' });

        // AUTO-SAVE: Invocamos guardarCalificaciones inmediatamente con los nuevos criterios
        // Reutilizamos la lógica de guardarCalificaciones pero pasamos los criterios explícitamente
        // ya que el estado criteriosPorBimestre podría no haberse actualizado aún en este closure.
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const payload = { grupoId: grupo._id, asignatura, criterios: nuevosCriterios, calificaciones };

        try {
            await axios.post(`${API_URL}/calificaciones`, payload, config);
            setNotificacion({ mensaje: 'Criterios actualizados y guardados correctamente.', tipo: 'exito' });
        } catch (error) {
            console.error("Error auto-guardando criterios:", error);
            setNotificacion({ mensaje: 'Criterios actualizados localmente, pero error al guardar en servidor.', tipo: 'warning' });
        }
    }, [grupo._id, asignatura, calificaciones, setCriteriosPorBimestre, setModalCriterios, setNotificacion]);


    useEffect(() => {
        const fetchGrupos = async () => {
            const token = localStorage.getItem('token');
            const userId = user?._id || user?.id; // Este uso es ahora correcto
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (!token || !userId) {
                setIsLoadingData(false);
                setNotificacion({ mensaje: 'Error de autenticación: Token no disponible.', tipo: 'error' });
                return;
            }

            try {
                const url = `${API_URL}/calificaciones?grupoId=${grupo._id}&asignatura=${asignatura}`;
                const res = await axios.get(url, config);

                // AJUSTE CLAVE: Se actualizan los criterios en el padre (Trabajos)
                const fetchedCriterios = {
                    1: res.data?.criterios?.[1] || [],
                    2: res.data?.criterios?.[2] || [],
                    3: res.data?.criterios?.[3] || [],
                };
                setCriteriosPorBimestre(fetchedCriterios);

                setCalificaciones(res.data?.calificaciones || {});

                // Lógica de numTareas (se mantiene igual, ajustando para la nueva estructura)
                const allCriterios = [...fetchedCriterios[1], ...fetchedCriterios[2], ...fetchedCriterios[3]];

                const initialNumTareas = allCriterios.reduce((acc, criterio) => {
                    let maxIndex = 0;
                    Object.values(res.data?.calificaciones || {}).forEach(alumnoCal => {
                        Object.values(alumnoCal).forEach(bimestreCal => {
                            const tareas = bimestreCal[criterio.nombre];
                            if (tareas) {
                                const currentMax = Math.max(...Object.keys(tareas).map(Number));
                                if (currentMax >= maxIndex) maxIndex = currentMax + 1;
                            }
                        });
                    });
                    acc[criterio.nombre] = Math.max(10, maxIndex + 5);
                    return acc;
                }, {});

                setNumTareas(initialNumTareas);

                // Abrir el modal de criterios si el bimestre 1 no tiene ninguno.
                // if (fetchedCriterios[1]?.length === 0) {
                //     setModalCriterios(true);
                // }
            } catch (error) {
                // Notificación de error si la carga falla
                setNotificacion({ mensaje: 'Error al cargar los datos de calificaciones.', tipo: 'error' });
            } finally {
                setIsLoadingData(false);
            }
        };
        if (grupo && asignatura) fetchGrupos();
        // Dependencias ajustadas
    }, [grupo, asignatura, setCriteriosPorBimestre, setModalCriterios, setNotificacion, user]);


    // 🌟 FUNCIÓN CLAVE: Asigna el nombre de la tarea a todos los alumnos en la columna.
    const handleGuardarNombreTarea = (tareaNombre, criterioNombre, tareaIndex) => {
        if (!tareaNombre.trim()) return;

        const nuevoNombre = tareaNombre.trim();
        const alumnosIds = grupo.alumnos.map(a => a._id);

        saveToHistory(); // 🌟 Guardar antes de renombrar tarea

        setCalificaciones(prev => {
            const nextCalificaciones = { ...prev };

            alumnosIds.forEach(alumnoId => {
                const alumnoCal = nextCalificaciones[alumnoId] || {};
                const bimestreCal = alumnoCal[bimestreActivo] || {};
                const criterioCal = bimestreCal[criterioNombre] || {};
                const tareaCal = criterioCal[tareaIndex] || {};

                // Mantenemos la nota y la fecha si ya existen, y solo agregamos/actualizamos el nombre.
                const notaExistente = tareaCal?.nota !== undefined ? tareaCal.nota : null;

                nextCalificaciones[alumnoId] = {
                    ...alumnoCal,
                    [bimestreActivo]: {
                        ...bimestreCal,
                        [criterioNombre]: {
                            ...criterioCal,
                            [tareaIndex]: {
                                nota: notaExistente, // Mantenemos la nota
                                fecha: tareaCal?.fecha || new Date().toISOString(), // Mantenemos la fecha o la actual si hay nota
                                nombre: nuevoNombre // 🎯 Guardamos el nombre aquí para todos los alumnos
                            }
                        },
                    },
                };
            });
            return nextCalificaciones;
        });

        setTareaPorNombrar(null); // Cerrar el modal
        setNotificacion({ mensaje: `Se asignó el nombre "${nuevoNombre}" a la Tarea ${tareaIndex + 1}.`, tipo: 'exito' });
    };

    // 🌟 MANEJO DE OBSERVACIONES (TECNOLOGIA)
    const handleObservacionChange = (alumnoId, bimestre, val) => {
        setCalificaciones(prev => ({
            ...prev,
            [alumnoId]: {
                ...prev[alumnoId],
                [bimestre]: {
                    ...prev[alumnoId]?.[bimestre],
                    OBSERVACIONES: val
                }
            }
        }));
    };

    // 🌟 FUNCIÓN NUEVA: Eliminar nombre y calificaciones de una columna
    const handleEliminarTarea = (criterioNombre, tareaIndex) => {
        const alumnosIds = grupo.alumnos.map(a => a._id);

        saveToHistory(); // 🌟 Guardar antes de eliminar tarea

        setCalificaciones(prev => {
            const nextCalificaciones = { ...prev };
            alumnosIds.forEach(alumnoId => {
                if (nextCalificaciones[alumnoId]?.[bimestreActivo]?.[criterioNombre]?.[tareaIndex]) {
                    // Opción A: Eliminar completamente la entrada
                    delete nextCalificaciones[alumnoId][bimestreActivo][criterioNombre][tareaIndex];

                    // Opción B: Si quisieras solo borrar el nombre pero dejar la nota, harías:
                    // nextCalificaciones[alumnoId][bimestreActivo][criterioNombre][tareaIndex].nombre = null;
                }
            });
            return nextCalificaciones;
        });

        setTareaPorNombrar(null);
        setNotificacion({ mensaje: `Se eliminó la Tarea ${tareaIndex + 1} y sus calificaciones.`, tipo: 'exito' });
    };

    // 🌟 FUNCIÓN RENOMBRE SEGURO: Actualizar keys en calificaciones cuando cambia el nombre del criterio
    const handleRenameCriterio = (bimestre, oldName, newName) => {
        if (oldName === newName) return;
        setCalificaciones(prev => {
            const nextCalificaciones = { ...prev };
            Object.keys(nextCalificaciones).forEach(alumnoId => {
                const aluBim = nextCalificaciones[alumnoId]?.[bimestre];
                if (aluBim && aluBim[oldName]) {
                    // Mover datos a la nueva key
                    aluBim[newName] = aluBim[oldName];
                    delete aluBim[oldName];
                    // También actualizar el nombre registrado dentro de las tareas si fuera necesario (opcional)
                }
            });
            return nextCalificaciones;
        });
    };


    // 🌟 FUNCIÓN BULK: Actualizar múltiples calificaciones a la vez (Optimizada)
    const handleBulkCalificacionUpdate = (updates) => {
        // updates: [{ alumnoId, bimestre, criterioNombre, tareaIndex, valor }]
        if (!updates || updates.length === 0) return;

        saveToHistory(); // 🌟 Guardar estado actual antes de pegar

        setCalificaciones(prev => {
            const nextCalificaciones = { ...prev };

            updates.forEach(update => {
                const { alumnoId, bimestre, criterioNombre, tareaIndex, valor } = update;
                const notaFloat = valor === '' ? null : parseFloat(valor);

                // Validaciones básicas, igual que en individual
                if (notaFloat !== null && (isNaN(notaFloat) || notaFloat < 0 || notaFloat > 10)) return;

                const alumnoCal = nextCalificaciones[alumnoId] || {};
                const bimestreCal = alumnoCal[bimestre] || {};
                const criterioCal = bimestreCal[criterioNombre] || {};
                const tareaCal = criterioCal[tareaIndex] || {};

                // Mantenemos datos anteriores (fecha y nombre)
                const datosAnteriores = tareaCal;

                nextCalificaciones[alumnoId] = {
                    ...alumnoCal,
                    [bimestre]: {
                        ...bimestreCal,
                        [criterioNombre]: {
                            ...criterioCal,
                            [tareaIndex]: {
                                nota: notaFloat,
                                fecha: datosAnteriores.fecha || new Date().toISOString(),
                                nombre: datosAnteriores.nombre // Preservar nombre
                            },
                        },
                    },
                };
            });

            return nextCalificaciones;
        });

        const count = updates.length;
        setNotificacion({ mensaje: `Se pegaron ${count} calificaciones correctamente.`, tipo: 'exito' });
    };

    // 🌟 ZOOM HANDLERS
    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.6));

    // Lógica de manipulación de calificaciones (MODIFICADA para preservar el nombre)
    const handleCalificacionChange = (alumnoId, bimestre, criterioNombre, tareaIndex, valor) => {
        const notaFloat = valor === '' ? null : parseFloat(valor);
        if (notaFloat !== null && (isNaN(notaFloat) || notaFloat < 0 || notaFloat > 10)) return;

        // Obtenemos el nombre y la fecha del trabajo si ya existen para no perderlos
        const datosAnteriores = calificaciones[alumnoId]?.[bimestre]?.[criterioNombre]?.[tareaIndex] || {};

        // Si se ingresa una nota, usamos la fecha anterior o la actual, si se borra, es null.
        const nuevaEntrada = notaFloat === null ? null : {
            nota: notaFloat,
            fecha: datosAnteriores.fecha || new Date().toISOString(),
            nombre: datosAnteriores.nombre // Mantenemos el nombre si ya fue asignado
        };

        saveToHistory(); // 🌟 Guardar para deshacer cambios manuales

        setCalificaciones(prev => ({
            ...prev,
            [alumnoId]: {
                ...prev[alumnoId],
                [bimestre]: {
                    ...prev[alumnoId]?.[bimestre],
                    [criterioNombre]: {
                        ...prev[alumnoId]?.[bimestre]?.[criterioNombre],
                        [tareaIndex]: nuevaEntrada,
                    },
                },
            },
        }));
    };

    const guardarCalificaciones = async () => {
        setIsSaving(true);
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        // Envía el objeto de criterios completo, separado por bimestre, que viene del estado del padre.
        const payload = {
            grupoId: grupo._id,
            asignatura,
            criterios: criteriosPorBimestre,
            calificaciones,
            numTareas // 🎯 Enviamos configuración de tareas visibles
        };
        try {
            await axios.post(`${API_URL}/calificaciones`, payload, config);
            setNotificacion({ mensaje: '¡Calificaciones guardadas con éxito!', tipo: 'exito' });
        } catch (error) {
            setNotificacion({ mensaje: 'Error al guardar las calificaciones.', tipo: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // 🌟 COORDINADOR DE PEGADO: Recibe desde la celda y orquesta los updates
    const handlePasteFromCell = (startRowIndex, startColIndex, matrix) => {
        // Necesitamos la lista de alumnos ORDENADA exactamente igual que en el render
        // Esta misma lógica de ordenamiento se usa en el map del JSX
        const alumnosOrdenados = sortedAlumnos;

        // Determinar si estamos en vista global (tabla) o vista lista (cuadritos)
        // La prop 'criterioNombre' se infiere.
        //   - En Vista Global: usamos criterioSeleccionadoGlobal
        //   - En Vista Lista: usamos criterioAbierto.criterioNombre (pero ojo, el paste solo funciona si la celda está visible)

        // PROBLEMA: CriterioCell ya tiene 'criterioNombre' en sus props, pero aqui en el padre necesitamos saberlo.
        // SOLUCION: CriterioCell no pasa el criterio, solo coords. Pero el padre sabe el contexto?
        // En Vista Global, criterio es 'criterioSeleccionadoGlobal'.
        // En Vista Lista, puede ser cualquiera porque cada alumno tiene desplegables independientes? 
        // No, el paste se hace en UN input especifico.
        // Mejor: Que CriterioCell pase tambien el criterioNombre en el callback.

        // REFACTOR RAPIDO: No puedo cambiar CriterioCell firma facil sin ver todo.
        // PERO: handlePasteFromCell puede ser un wrapper que YA trae el nombre del criterio pre-configurado si lo paso como closure o prop.
        // O mejor: Que CriterioCell reciba 'onPasteValues' y le pase (rowIndex, colIndex, matrix). 
        // El Padre debe saber en cual criterio estamos.

        // Vemos el JSX. 
        // En Vista Global: CriterioCell recibe criterioNombre={criterioSeleccionadoGlobal}
        // En Vista Lista: CriterioCell recibe criterioNombre={criterioAbierto.criterioNombre}

        // Por ende, la función onPasteValues debería ser agnóstica del criterio O recibirlo.
        // Vamos a modificar CriterioCell para que devuelva el criterioNombre tambien? 
        // No, mejor simplificamos: pasamos una funcion arrow al CriterioCell que ya tenga el criterio "quemado" (curried).
    };

    const calcularPromedioCriterio = (alumnoId, bimestre, criterioNombre) => {
        const tareas = calificaciones[alumnoId]?.[bimestre]?.[criterioNombre] || {};
        const maxTareas = numTareas[criterioNombre] || 0;

        const notasValidas = Object.keys(tareas)
            .filter(index => parseInt(index) < maxTareas) // Solo tareas visibles
            .map(index => tareas[index])
            .filter(entrada => entrada && typeof entrada.nota === 'number')
            .map(entrada => entrada.nota);

        if (notasValidas.length === 0) return 0;
        const total = notasValidas.reduce((sum, nota) => sum + nota, 0);
        return total / notasValidas.length;
    };

    const calcularPromedioBimestre = (alumnoId, bimestre) => {
        const criteriosDelBimestre = criteriosPorBimestre[bimestre] || [];
        if (criteriosDelBimestre.length === 0) return 0;

        let sumaPonderada = 0;
        let pesoTotalAplicable = 0;

        criteriosDelBimestre.forEach(criterio => {
            // Verificar si este criterio tiene calificaciones válidas (números reales) EN TAREAS VISIBLES
            const tareas = calificaciones[alumnoId]?.[bimestre]?.[criterio.nombre] || {};
            const maxTareas = numTareas[criterio.nombre] || 0;

            // Filtrar por índice visible y por validez de nota
            const validNotesCount = Object.keys(tareas)
                .filter(index => parseInt(index) < maxTareas && tareas[index] && typeof tareas[index].nota === 'number')
                .length;

            if (validNotesCount > 0) {
                const promCriterio = calcularPromedioCriterio(alumnoId, bimestre, criterio.nombre);
                sumaPonderada += promCriterio * (criterio.porcentaje / 100);
                pesoTotalAplicable += (criterio.porcentaje / 100);
            }
        });

        // Si no hay ningún criterio con notas, retornamos 0 (o podría ser '-' visualmente, pero aquí necesitamos número)
        if (pesoTotalAplicable === 0) return 0;

        // Regla de tres simple: Si sumaPonderada es a pesoTotalAplicable, X es a 1 (100%)
        const promedioFinal = sumaPonderada / pesoTotalAplicable;

        // "La calificación mínima sea 5, no menos"
        // Si hay promedio (es decir, hubo calificaciones), el mínimo es 5.
        const promedioRedondeado = Math.round(promedioFinal); // Redondeo estándar
        return Math.max(5, promedioRedondeado); // Restaurada la restricción de mínimo 5
    };

    const formatFechaTooltip = (fechaISO) => {
        if (!fechaISO) return "Sin calificar";
        try {
            return new Date(fechaISO).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return "Fecha inválida"; }
    };

    const handleToggleCriterio = (alumnoId, criterioNombre) => {
        const esElMismo = criterioAbierto?.alumnoId === alumnoId && criterioAbierto?.criterioNombre === criterioNombre;
        setCriterioAbierto(esElMismo ? null : { alumnoId, criterioNombre });
    };

    const agregarTareas = (criterioNombre) => {
        setNumTareas(prev => ({ ...prev, [criterioNombre]: (prev[criterioNombre] || 10) + 5 }));
    };

    // 🌟 FUNCIÓN NUEVA: Generar Reporte PDF de la Asignatura
    const generateSubjectReport = async () => {
        const doc = new jsPDF();

        // --- LOGO Y ENCABEZADO (Reutilizado de Calificaciones.js) ---
        const img = new Image();
        img.src = logoImage;
        await img.decode();
        const logoWidth = 25, margin = 14;
        const logoHeight = (img.height * logoWidth) / img.width;
        const pageWidth = doc.internal.pageSize.width;
        doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

        doc.setFontSize(12);
        let yPos = margin + 5;
        doc.text('Escuela Secundaria No. 9 "Amado Nervo"', margin, yPos);
        yPos += 7;
        doc.setFont(undefined, 'bold');
        doc.text('Reporte de Calificaciones por Asignatura', margin, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 7;
        doc.text(`Grupo: ${grupo.nombre}`, margin, yPos);
        yPos += 7;
        doc.text(`Asignatura: ${asignatura}`, margin, yPos);
        yPos += 7;
        // 🌟 AGREGADO: Nombre del docente
        const nombreDocente = user ? `${user.nombre} ${user.apellidoPaterno || ''} ${user.apellidoMaterno || ''}`.trim() : 'Docente';
        doc.text(`Docente: ${nombreDocente}`, margin, yPos);
        yPos += 5;

        // --- TABLA ---
        const tableHeaders = [['Nombre del Alumno', 'T1', 'T2', 'T3', 'Promedio Final']];

        const tableBody = grupo.alumnos.sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno)).map(alumno => {
            const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;

            // Calcular promedios
            const p1 = calcularPromedioBimestre(alumno._id, 1);
            const p2 = calcularPromedioBimestre(alumno._id, 2);
            const p3 = calcularPromedioBimestre(alumno._id, 3);

            // Calcular final
            let suma = 0;
            let count = 0;
            if (p1 > 0) { suma += parseFloat(p1); count++; }
            if (p2 > 0) { suma += parseFloat(p2); count++; }
            if (p3 > 0) { suma += parseFloat(p3); count++; }
            const final = count > 0 ? Math.round(suma / count) : 0;

            return [
                nombreCompleto,
                p1 > 0 ? p1 : '-',
                p2 > 0 ? p2 : '-',
                p3 > 0 ? p3 : '-',
                final > 0 ? final : '-'
            ];
        });

        autoTable(doc, {
            startY: yPos,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { halign: 'center', cellPadding: 2.5 },
            headStyles: { fillColor: [185, 151, 43], textColor: 255 }, // Color dorado del tema
            columnStyles: { 0: { halign: 'left' } }
        });

        doc.save(`Reporte_${grupo.nombre}_${asignatura.replace(/\s/g, '_')}.pdf`);
    };

    // 🌟 FUNCIÓN NUEVA: Limpiar Calificaciones
    const handleLimpiarCalificaciones = () => {
        setConfirmModal({
            isOpen: true,
            message: `¿Estás SEGURO de que quieres eliminar TODAS las calificaciones de ${asignatura} para el grupo ${grupo.nombre}? Esta acción NO se puede deshacer.`,
            onConfirm: async () => {
                const token = localStorage.getItem('token');
                const config = { headers: { Authorization: `Bearer ${token}` } };

                try {
                    const calificacionesVacias = {};
                    const payload = {
                        grupoId: grupo._id,
                        asignatura,
                        criterios: criteriosPorBimestre,
                        calificaciones: calificacionesVacias
                    };

                    await axios.post(`${API_URL}/calificaciones`, payload, config);

                    setCalificaciones({});
                    setNotificacion({ mensaje: 'Se han eliminado todas las calificaciones de esta asignatura.', tipo: 'exito' });
                    setConfirmModal({ isOpen: false, message: '', onConfirm: null }); // Cerrar modal

                } catch (error) {
                    console.error("Error al limpiar calificaciones:", error);
                    setNotificacion({ mensaje: 'Error al intentar limpiar las calificaciones.', tipo: 'error' });
                    setConfirmModal({ isOpen: false, message: '', onConfirm: null }); // Cerrar modal en error también
                }
            }
        });
    };




    if (isLoadingData) return <div className="trabajos-container grupo-componente" style={{ textAlign: 'center', paddingTop: '10rem' }}><p style={{ color: '#E9E9E9' }}>Cargando datos del grupo...</p></div>;


    return (
        <div className="modal-backdrop-solid grupo-componente">
            {/* 🌟 Invocación del ModalNombreTarea */}
            {tareaPorNombrar && (
                <ModalNombreTarea
                    criterioNombre={tareaPorNombrar.criterioNombre}
                    tareaIndex={tareaPorNombrar.tareaIndex}
                    nombreActual={tareaPorNombrar.nombreActual} // Pasar nombre actual
                    onGuardar={handleGuardarNombreTarea}
                    onEliminar={handleEliminarTarea} // Pasar función de eliminar
                    onClose={() => setTareaPorNombrar(null)}
                />
            )}

            {/* 🌟 Modal de Confirmación Personalizado */}
            <ConfirmacionModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                mensaje={confirmModal.message}
                confirmText="Sí, Eliminar Todo"
            />



            {/* Contenido principal del panel de calificaciones */}
            <div className="asistencia-modal-content">
                <header className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 20px' }}>
                    <h2>Calificaciones: {grupo.nombre} - {asignatura}</h2>
                    <div>
                        {/* Botones de Acción Nuevos */}
                        <div style={{ display: 'inline-flex', gap: '5px', marginRight: '15px', verticalAlign: 'middle' }}>
                            <button
                                className="btn"
                                style={{ padding: '0 12px', height: '35px', backgroundColor: '#95a5a6', color: 'white', opacity: history.past.length === 0 ? 0.5 : 1, cursor: history.past.length === 0 ? 'not-allowed' : 'pointer' }}
                                onClick={handleUndo}
                                disabled={history.past.length === 0}
                                title="Deshacer (Ctrl+Z)"
                            >
                                <FaArrowLeft />
                            </button>
                            <button
                                className="btn"
                                style={{ padding: '0 12px', height: '35px', backgroundColor: '#95a5a6', color: 'white', opacity: history.future.length === 0 ? 0.5 : 1, cursor: history.future.length === 0 ? 'not-allowed' : 'pointer' }}
                                onClick={handleRedo}
                                disabled={history.future.length === 0}
                                title="Rehacer"
                            >
                                <FaArrowRight />
                            </button>
                        </div>
                        <button className="btn" onClick={generateSubjectReport} style={{ marginRight: '10px', backgroundColor: '#2980b9', borderColor: '#2980b9', color: 'white' }}>
                            📄 Reporte PDF
                        </button>
                        <button className="btn" onClick={handleLimpiarCalificaciones} style={{ marginRight: '10px', backgroundColor: '#c0392b', borderColor: '#c0392b', color: 'white' }}>
                            🗑️ Limpiar Calificaciones
                        </button>


                        {/* Botón para abrir el modal de criterios */}
                        <button className="btn" onClick={() => setModalCriterios(true)}>Criterios</button>
                        <button className="btn btn-cancel" onClick={onVolver} style={{ marginLeft: '10px' }}>Cerrar</button>
                    </div>
                </header>

                {/* 🌟 ZOOM CONTROLS */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '20px', marginBottom: '10px', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={handleZoomOut} style={{ padding: '5px 10px' }}>🔍 -</button>
                    <span style={{ alignSelf: 'center', color: '#ccc' }}>{Math.round(zoomLevel * 100)}%</span>
                    <button className="btn btn-secondary" onClick={handleZoomIn} style={{ padding: '5px 10px' }}>🔍 +</button>
                </div>
                <div className="bimestre-selector">
                    {[1, 2, 3].map(bim => (
                        <button key={bim} className={`btn ${bimestreActivo === bim ? 'btn-primary' : ''}`} onClick={() => { setBimestreActivo(bim); setCriterioSeleccionadoGlobal(null); }}>Trimestre {bim}</button>
                    ))}
                </div>

                {/* 🌟 SELECTOR DE CRITERIOS (TABS) */}
                {criteriosActivos.length > 0 && (
                    <div className="tabs-criterios">
                        <div
                            className={`tab-criterio ${criterioSeleccionadoGlobal === null ? 'activo' : ''}`}
                            onClick={() => setCriterioSeleccionadoGlobal(null)}
                        >
                            📋 Vista General
                        </div>
                        {criteriosActivos.map(crit => (
                            <div
                                key={crit.nombre}
                                className={`tab-criterio ${criterioSeleccionadoGlobal === crit.nombre ? 'activo' : ''}`}
                                onClick={() => setCriterioSeleccionadoGlobal(crit.nombre)}
                            >
                                {crit.nombre} ({crit.porcentaje}%)
                            </div>
                        ))}
                    </div>
                )}

                {criteriosActivos.length > 0 ? (
                    <>
                        {/* --- VISTA 1: TABLA MASIVA (SI HAY UN CRITERIO SELECCIONADO) --- */}
                        {criterioSeleccionadoGlobal ? (
                            <div className="tabla-global-container" style={{ fontSize: `${zoomLevel}rem` }}>
                                <table className={`tabla-global ${asignatura === 'Tecnologia' ? 'with-obs' : ''}`}>
                                    <thead>
                                        <tr>
                                            <th className="num-col" style={{ width: '40px', textAlign: 'center' }}>#</th>
                                            {asignatura === 'Tecnologia' && <th className="obs-col">Obs.</th>}
                                            <th className="alumno-col">Alumno</th>
                                            {/* Columnas de Tareas */}
                                            {Array.from({ length: numTareas[criterioSeleccionadoGlobal] || 10 }).map((_, tareaIndex) => {
                                                // Buscar nombre de tarea (scan all students)
                                                // 🌟 OPTIMIZATION: Look at the first student's record since names are synced.
                                                // Falls back to scanning if first student has no entry, but much safer/stable.
                                                const primerAlumnoId = sortedAlumnos[0]?._id;
                                                const nombreTarea = calificaciones[primerAlumnoId]?.[bimestreActivo]?.[criterioSeleccionadoGlobal]?.[tareaIndex]?.nombre
                                                    || Object.values(calificaciones).find(
                                                        alumnoCal => alumnoCal?.[bimestreActivo]?.[criterioSeleccionadoGlobal]?.[tareaIndex]?.nombre
                                                    )?.[bimestreActivo]?.[criterioSeleccionadoGlobal]?.[tareaIndex]?.nombre;

                                                return (
                                                    <th key={tareaIndex}>
                                                        <div
                                                            className="tabla-header-task"
                                                            title={nombreTarea || `Clic para nombrar Tarea ${tareaIndex + 1}`}
                                                            onClick={() => setTareaPorNombrar({
                                                                criterioNombre: criterioSeleccionadoGlobal,
                                                                tareaIndex,
                                                                nombreActual: nombreTarea
                                                            })}
                                                        >
                                                            {/* 🌟 CAMBIO: Si tiene nombre, mostrar SOLO el nombre con fuente más grande. Si no, T + numero */}
                                                            {nombreTarea ? (
                                                                <span className="task-name" style={{ fontSize: '0.85rem', whiteSpace: 'normal', lineHeight: '1.2' }}>{nombreTarea}</span>
                                                            ) : (
                                                                <span className="task-num">T{tareaIndex + 1}</span>
                                                            )}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                            <th style={{ width: '80px', color: '#f39c12' }}>Prom</th>
                                            {/* Botón +5 en el header */}
                                            <th>
                                                <button
                                                    className="btn btn-agregar-dias"
                                                    style={{ width: '40px', height: '30px', padding: 0, fontSize: '0.9rem' }}
                                                    onClick={() => agregarTareas(criterioSeleccionadoGlobal)}
                                                    title="Agregar 5 columnas más"
                                                >
                                                    +5
                                                </button>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedAlumnos.map((alumno, index) => (
                                            <tr key={alumno._id}>
                                                <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                                                {asignatura === 'Tecnologia' && (
                                                    <td className="obs-col-body">
                                                        <input
                                                            id={`cell-${index}--1`}
                                                            type="text"
                                                            maxLength="3"
                                                            placeholder="..."
                                                            value={calificaciones[alumno._id]?.[bimestreActivo]?.OBSERVACIONES || ''}
                                                            onChange={(e) => handleObservacionChange(alumno._id, bimestreActivo, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                                                    e.preventDefault();
                                                                    let nextRow = index;
                                                                    let nextCol = -1;
                                                                    if (e.key === 'ArrowUp') nextRow = index - 1;
                                                                    if (e.key === 'ArrowDown') nextRow = index + 1;
                                                                    if (e.key === 'ArrowLeft') return;
                                                                    if (e.key === 'ArrowRight') nextCol = 0;

                                                                    const nextId = `cell-${nextRow}-${nextCol}`;
                                                                    const el = document.getElementById(nextId);
                                                                    if (el) { el.focus(); setTimeout(() => el.select(), 0); }
                                                                }
                                                            }}
                                                            style={{ textAlign: 'center', width: '100%', border: 'none', background: 'transparent', color: 'var(--warning-color)' }}
                                                        />
                                                    </td>
                                                )}
                                                <td className="alumno-col">
                                                    {`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}
                                                </td>
                                                {/* Celdas de Calificación */}
                                                {Array.from({ length: numTareas[criterioSeleccionadoGlobal] || 10 }).map((_, tareaIndex) => (
                                                    <td key={tareaIndex}>
                                                        <CriterioCell
                                                            alumnoId={alumno._id}
                                                            bimestreActivo={bimestreActivo}
                                                            criterioNombre={criterioSeleccionadoGlobal}
                                                            tareaIndex={tareaIndex}
                                                            calificaciones={calificaciones}
                                                            handleCalificacionChange={handleCalificacionChange}
                                                            formatFechaTooltip={formatFechaTooltip}
                                                            setTareaPorNombrar={setTareaPorNombrar}

                                                            rowIndex={index} // 🌟 Passed stable index from map
                                                            colIndex={tareaIndex} // 🌟 Pass column index
                                                            onPasteValues={(rIndex, cIndex, matrix) => {
                                                                const alumnosOrdenados = sortedAlumnos;
                                                                const updates = [];

                                                                matrix.forEach((rowVals, rOffset) => {
                                                                    const targetRow = rIndex + rOffset;
                                                                    if (targetRow < alumnosOrdenados.length) {
                                                                        const targetAlumno = alumnosOrdenados[targetRow];
                                                                        rowVals.forEach((valStr, cOffset) => {
                                                                            const targetCol = cIndex + cOffset;
                                                                            // Verificar si la tarea existe (cols limit)
                                                                            const maxTareas = numTareas[criterioSeleccionadoGlobal] || 10;
                                                                            if (targetCol < maxTareas) {
                                                                                updates.push({
                                                                                    alumnoId: targetAlumno._id,
                                                                                    bimestre: bimestreActivo,
                                                                                    criterioNombre: criterioSeleccionadoGlobal,
                                                                                    tareaIndex: targetCol,
                                                                                    valor: valStr
                                                                                });
                                                                            }
                                                                        });
                                                                    }
                                                                });
                                                                handleBulkCalificacionUpdate(updates);
                                                            }}
                                                        />
                                                    </td>
                                                ))}
                                                {/* Promedio del Alumno para este criterio */}
                                                <td style={{ fontWeight: 'bold', color: calcularPromedioCriterio(alumno._id, bimestreActivo, criterioSeleccionadoGlobal) >= 6 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                                    {calcularPromedioCriterio(alumno._id, bimestreActivo, criterioSeleccionadoGlobal).toFixed(1)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* --- VISTA 2: LISTA DE ALUMNOS (ORIGINAL - VISTA GENERAL) --- */
                            <div className="asistencia-grid">
                                <div className="asistencia-body">
                                    {sortedAlumnos.map((alumno, index) => (
                                        <React.Fragment key={alumno._id}>
                                            <div className="asistencia-row">
                                                <div className="alumno-nombre">{`${index + 1}. ${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}</div>
                                                <div className="bimestres-container">
                                                    {criteriosActivos.map(criterio => (
                                                        <div
                                                            key={criterio.nombre}
                                                            className={`bimestre-header-btn ${criterioAbierto?.alumnoId === alumno._id && criterioAbierto?.criterioNombre === criterio.nombre ? 'activo' : ''}`}
                                                            onClick={() => handleToggleCriterio(alumno._id, criterio.nombre)}
                                                        >
                                                            {criterio.nombre} ({criterio.porcentaje}%)
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="promedio-final-display" style={{ color: calcularPromedioBimestre(alumno._id, bimestreActivo) >= 6 ? '#27ae60' : '#d32f2f' }}>
                                                    Prom: {calcularPromedioBimestre(alumno._id, bimestreActivo)}
                                                </div>
                                            </div>
                                            {/* Desplegable en Vista General */}
                                            {criterioAbierto?.alumnoId === alumno._id && (
                                                <div className={`bimestre-desplegable desplegado`}>
                                                    <div className="criterio-resumen-wrapper">
                                                        <div className="criterio-resumen">
                                                            <span className="criterio-info">
                                                                {criterioAbierto.criterioNombre} ({criteriosActivos.find(c => c.nombre === criterioAbierto.criterioNombre)?.porcentaje}%)
                                                            </span>
                                                            <span className="criterio-prom" style={{ color: calcularPromedioCriterio(alumno._id, bimestreActivo, criterioAbierto.criterioNombre) >= 6 ? 'var(--dark-color)' : 'var(--danger-color)' }}>
                                                                Prom: {calcularPromedioCriterio(alumno._id, bimestreActivo, criterioAbierto.criterioNombre).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="cuadritos-grid">
                                                        {/* 🌟 HEADER ROW PARA TAREAS */}
                                                        <div className="task-header-row" style={{ gridColumn: '1 / -1' }}>
                                                            {Array.from({ length: numTareas[criterioAbierto.criterioNombre] || 10 }).map((_, tareaIndex) => {
                                                                // Buscar si alguna calificación en esta columna tiene nombre
                                                                // 🌟 OPTIMIZATION: Look up locally if possible or scan safely
                                                                const primerAlumnoId = sortedAlumnos[0]?._id;
                                                                const nombreTarea = calificaciones[primerAlumnoId]?.[bimestreActivo]?.[criterioAbierto.criterioNombre]?.[tareaIndex]?.nombre
                                                                    || Object.values(calificaciones).find(
                                                                        alumnoCal => alumnoCal?.[bimestreActivo]?.[criterioAbierto.criterioNombre]?.[tareaIndex]?.nombre
                                                                    )?.[bimestreActivo]?.[criterioAbierto.criterioNombre]?.[tareaIndex]?.nombre;

                                                                return (
                                                                    <div
                                                                        key={tareaIndex}
                                                                        className={`task-header-cell ${nombreTarea ? 'named' : ''}`}
                                                                        title={nombreTarea || `Tarea ${tareaIndex + 1}`}
                                                                        onClick={() => setTareaPorNombrar({
                                                                            criterioNombre: criterioAbierto.criterioNombre,
                                                                            tareaIndex,
                                                                            nombreActual: nombreTarea
                                                                        })}
                                                                    >
                                                                        {nombreTarea || `T${tareaIndex + 1}`}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* 🌟 Uso del nuevo componente CriterioCell */}
                                                        {Array.from({ length: numTareas[criterioAbierto.criterioNombre] || 10 }).map((_, tareaIndex) => (
                                                            <CriterioCell
                                                                key={tareaIndex}
                                                                alumnoId={alumno._id}
                                                                bimestreActivo={bimestreActivo}
                                                                criterioNombre={criterioAbierto.criterioNombre}
                                                                tareaIndex={tareaIndex}
                                                                calificaciones={calificaciones}
                                                                handleCalificacionChange={handleCalificacionChange}
                                                                formatFechaTooltip={formatFechaTooltip}
                                                                setTareaPorNombrar={setTareaPorNombrar}
                                                                rowIndex={0} // Fila única en vista lista
                                                                colIndex={tareaIndex} // Indice para navegar izquierda/derecha
                                                                onPasteValues={(rIndex, cIndex, matrix) => {
                                                                    // En vista LISTA, el 'rowIndex' es relativo al alumno (siempre 0 o irrelevante si no cruzamos alumnos) via props?
                                                                    // No, CriterioCell no recibe rowIndex en este loop, asi que es undefined.
                                                                    // Para simplificar, en vista lista solo soportaremos pegar HORIZONTALMENTE (misma fila).
                                                                    // O soportar vertical si calculamos el index.
                                                                    // Dado que esta vista es "un alumno desplegado", pegar verticalmente no tiene sentido visual directo (saltaría al sig alumno cerrado?).
                                                                    // LIMITACIÓN: En vista lista, solo pegamos en la fila actual.

                                                                    const updates = [];
                                                                    matrix.forEach((rowVals, rOffset) => {
                                                                        if (rOffset === 0) { // Solo primera fila del pegado
                                                                            rowVals.forEach((valStr, cOffset) => {
                                                                                const targetCol = cIndex + cOffset;
                                                                                const maxTareas = numTareas[criterioAbierto.criterioNombre] || 10;
                                                                                if (targetCol < maxTareas) {
                                                                                    updates.push({
                                                                                        alumnoId: alumno._id,
                                                                                        bimestre: bimestreActivo,
                                                                                        criterioNombre: criterioAbierto.criterioNombre,
                                                                                        tareaIndex: targetCol,
                                                                                        valor: valStr
                                                                                    });
                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                    handleBulkCalificacionUpdate(updates);
                                                                }}
                                                            />
                                                        ))}
                                                        <button className="btn btn-agregar-dias" onClick={() => agregarTareas(criterioAbierto.criterioNombre)}>+5</button>
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="aviso-criterios"><p>⚠️ Por favor, define los criterios de evaluación para el **Trimestre {bimestreActivo}**.</p></div>
                )}
                <div className="modal-actions" style={{ padding: '0 20px' }}>
                    <button className="btn btn-primary" onClick={guardarCalificaciones} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Calificaciones'}</button>
                </div>

                {modalCriterios && (
                    <ModalCriterios
                        criteriosPorBimestre={criteriosPorBimestre}
                        onGuardar={handleGuardarCriterios} // Usamos la nueva función de auto-save
                        onRename={handleRenameCriterio} // 🌟 Prop para renombrar sin perder datos
                        onClose={() => setModalCriterios(false)}
                        setNotificacion={setNotificacion}
                    />
                )}
            </div>
        </div>
    );
};

// ======================================
// --- 4. Componente: Lista de Grupos (Original) ---
// ======================================
const ListaDeGrupos = ({ grupos, user, onSeleccionarGrupo }) => {
    const userId = user?._id || user?.id;

    return (
        <>
            <header className="main-header" style={{ justifyContent: 'center', paddingTop: '0' }}><h1>Gestión de Calificaciones</h1></header>
            <h3 className="subtitulo">Selecciona un grupo y asignatura para calificar</h3>

            <div className="grupos-table-wrapper">
                <table className="grupos-table">
                    <thead><tr><th>Grupo</th><th>Mi Asignatura</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {grupos.flatMap(grupo => {
                            // Filtrar todas las asignaciones para este profesor con comparación robusta
                            // Filtrar todas las asignaciones para este profesor con comparación robusta
                            const misAsignaciones = grupo.profesoresAsignados.filter(asig => {
                                // 1. Intentar matching por ID (id o _id)
                                const assignedId = asig.profesor?.id || asig.profesor?._id || asig.profesor;
                                const idMatch = String(assignedId) === String(userId);

                                // 2. Intentar matching por Email (Backup robusto si falla el ID)
                                const assignedEmail = asig.profesor?.email;
                                const userEmail = user?.email;
                                const emailMatch = assignedEmail && userEmail && (assignedEmail === userEmail);

                                // console.log(`[DEBUG] G:${grupo.nombre} | Asig:${asig.asignatura} | ID_MATCH:${idMatch} | EMAIL_MATCH:${emailMatch}`);
                                return idMatch || emailMatch;
                            });

                            // Retornar una fila por cada asignatura asignada
                            return misAsignaciones.map((asignacion, index) => (
                                <tr key={`${grupo._id}-${index}`}>
                                    <td>{grupo.nombre}</td>
                                    <td>{asignacion.asignatura}</td>
                                    <td className="acciones-cell">
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => onSeleccionarGrupo(grupo, asignacion.asignatura)}
                                        >
                                            Calificar
                                        </button>
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
};

// ======================================
// --- 5. Componente: Modal para Criterios de Evaluación (Original) ---
// ======================================
const ModalCriterios = ({ criteriosPorBimestre, onGuardar, onRename, onClose, setNotificacion }) => {
    // 1. Estado para manejar los criterios internamente, clonando el prop inicial.
    const [criteriosLocales, setCriteriosLocales] = useState(criteriosPorBimestre || { 1: [], 2: [], 3: [] });
    // 2. Estado para el bimestre actualmente seleccionado en el modal.
    const [bimestreActivo, setBimestreActivo] = useState(1);
    const [nombre, setNombre] = useState('');
    const [porcentaje, setPorcentaje] = useState('');

    // 🌟 Estado para edición
    const [editingIndex, setEditingIndex] = useState(null);
    const [originalNameEditing, setOriginalNameEditing] = useState(null);

    // Criterios del bimestre activo
    const criteriosDelBimestre = criteriosLocales[bimestreActivo] || [];
    const totalPorcentaje = criteriosDelBimestre.reduce((acc, curr) => acc + (Number(curr.porcentaje) || 0), 0);

    // Función para cambiar de bimestre SIN validar el actual (navegación libre)
    const handleSetBimestre = (bim) => {
        setBimestreActivo(bim);
    };

    // Función para añadir un criterio al bimestre activo
    const addCriterio = () => {
        const porciento = parseInt(porcentaje, 10);

        // 🌟 CORRECCIÓN: Si estamos editando, restar el valor anterior del total para validar
        const currentTotal = editingIndex !== null
            ? totalPorcentaje - (criteriosDelBimestre[editingIndex].porcentaje || 0)
            : totalPorcentaje;

        if (!nombre.trim() || isNaN(porciento) || porciento <= 0 || currentTotal + porciento > 100) {
            setNotificacion({
                mensaje: 'Verifica los datos. El porcentaje debe ser positivo y el total no debe exceder 100%.',
                tipo: 'error'
            });
            return;
        }

        if (criteriosDelBimestre.some((c, i) => i !== editingIndex && c.nombre.toLowerCase() === nombre.trim().toLowerCase())) {
            setNotificacion({
                mensaje: 'Ya existe un criterio con ese nombre en este trimestre.',
                tipo: 'error'
            });
            return;
        }

        const nuevoCriterio = { nombre: nombre.trim(), porcentaje: porciento };

        if (editingIndex !== null) {
            // 🌟 MODIFICAR EXISTENTE
            setCriteriosLocales(prev => {
                const updatedList = [...criteriosDelBimestre];
                updatedList[editingIndex] = nuevoCriterio;
                return { ...prev, [bimestreActivo]: updatedList };
            });

            // Si el nombre cambió, notificar al padre para migrar calificaciones
            if (originalNameEditing && originalNameEditing !== nuevoCriterio.nombre && onRename) {
                onRename(bimestreActivo, originalNameEditing, nuevoCriterio.nombre);
            }

            setEditingIndex(null);
            setOriginalNameEditing(null);
            setNotificacion({ mensaje: 'Criterio actualizado. Se conservaron las calificaciones.', tipo: 'exito' });
        } else {
            // 🌟 AGREGAR NUEVO
            setCriteriosLocales(prev => ({
                ...prev,
                [bimestreActivo]: [...criteriosDelBimestre, nuevoCriterio]
            }));
        }

        setNombre('');
        setPorcentaje('');
    };

    const handleEdit = (index) => {
        const c = criteriosDelBimestre[index];
        setNombre(c.nombre);
        setPorcentaje(c.porcentaje);
        setEditingIndex(index);
        setOriginalNameEditing(c.nombre);
    };



    // Función para eliminar un criterio del bimestre activo
    const removeCriterio = (index) => {
        const nuevosCriterios = criteriosDelBimestre.filter((_, i) => i !== index);
        setCriteriosLocales(prev => ({
            ...prev,
            [bimestreActivo]: nuevosCriterios
        }));
    };

    // Función principal de guardado
    const handleGuardar = () => {
        for (const [bimestre, criterios] of Object.entries(criteriosLocales)) {
            const totalBimestre = criterios.reduce((acc, curr) => acc + (Number(curr.porcentaje) || 0), 0);
            if (criterios.length > 0 && totalBimestre !== 100) {
                setNotificacion({
                    mensaje: `ERROR: El Trimestre ${bimestre} debe sumar exactamente 100% para guardar. Actualmente suma ${totalBimestre}%.`,
                    tipo: 'error'
                });
                return;
            }
        }

        onGuardar(criteriosLocales);
        onClose();
        setNotificacion({ mensaje: 'Criterios de evaluación actualizados.', tipo: 'exito' });
    };

    // Función para copiar los criterios de un bimestre anterior (ej. 1 -> 2)
    const handleCopiarCriterios = (bimestreOrigen, bimestreDestino) => {
        const criteriosOrigen = criteriosLocales[bimestreOrigen];
        if (!criteriosOrigen || criteriosOrigen.length === 0) {
            setNotificacion({ mensaje: `No hay criterios definidos en el Trimestre ${bimestreOrigen}.`, tipo: 'error' });
            return;
        }

        const totalOrigen = criteriosOrigen.reduce((acc, curr) => acc + (Number(curr.porcentaje) || 0), 0);
        if (totalOrigen !== 100) {
            setNotificacion({ mensaje: `El Trimestre ${bimestreOrigen} debe sumar 100% antes de ser copiado.`, tipo: 'error' });
            return;
        }

        setCriteriosLocales(prev => ({
            ...prev,
            [bimestreDestino]: criteriosOrigen.map(c => ({ ...c }))
        }));
        setBimestreActivo(bimestreDestino);
        setNotificacion({ mensaje: `Criterios del Trimestre ${bimestreOrigen} copiados a Trimestre ${bimestreDestino}.`, tipo: 'exito' });
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
            {/* WRAPPER CLAVE: Aplicamos la clase grupo-componente aquí para heredar estilos */}
            <div className="grupo-componente" style={{ display: 'contents' }}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h2>Definir Criterios de Evaluación por Trimestre</h2>

                    <div className="bimestre-selector" style={{ justifyContent: 'center', borderBottom: 'none' }}>
                        {[1, 2, 3].map(bim => (
                            <button
                                key={bim}
                                className={`btn ${bimestreActivo === bim ? 'btn-primary' : 'btn-cancel'}`}
                                onClick={() => handleSetBimestre(bim)}
                            >
                                Trimestre {bim}
                            </button>
                        ))}
                    </div>

                    {/* 🌟 LAYOUT HORIZONTAL (GRID) */}
                    <div className="modal-grid-layout">
                        {/* COLUMNA IZQUIERDA: LISTA DE CRITERIOS */}
                        <div className="modal-col-left">
                            <h3 style={{ marginTop: 0 }}>Criterios para Trimestre {bimestreActivo}</h3>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                                {criteriosDelBimestre.map((c, index) => (
                                    <div key={index} className="criterio-item">
                                        <span>{c.nombre} - <strong>{c.porcentaje}%</strong></span>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <button
                                                onClick={() => handleEdit(index)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    marginLeft: '10px',
                                                    marginRight: '5px',
                                                    fontSize: '1.2rem'
                                                }}
                                                title="Editar (Conserva Calificaciones)"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => removeCriterio(index)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '1.2rem',
                                                    color: '#e74c3c'
                                                }}
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {criteriosDelBimestre.length === 0 && <p style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>No hay criterios definidos para este Trimestre.</p>}
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: ACCIONES Y FORMULARIO */}
                        <div className="modal-col-right">
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #444', paddingBottom: '1rem' }}>
                                {bimestreActivo > 1 && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => handleCopiarCriterios(bimestreActivo - 1, bimestreActivo)}
                                        disabled={criteriosDelBimestre.length > 0 || criteriosLocales[bimestreActivo - 1]?.length === 0}
                                        title={criteriosDelBimestre.length > 0 ? "Elimina los criterios actuales para copiar." : `Copia criterios de Bimestre ${bimestreActivo - 1}`}
                                        style={{ width: '100%', fontSize: '0.9rem' }}
                                    >
                                        <span role="img" aria-label="copiar">📋</span> Copiar del T{bimestreActivo - 1}
                                    </button>
                                )}
                            </div>

                            <div className="criterio-form" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                {/* 🌟 UX MEASURE: Hide inputs if 100% complete and not editing */}
                                {totalPorcentaje === 100 && editingIndex === null ? (
                                    <div style={{ textAlign: 'center', marginTop: '10px', color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                        (Trimestre al 100%)
                                    </div>
                                ) : (
                                    <>
                                        <label style={{ fontSize: '0.9rem', marginBottom: '5px', color: '#aaa' }}>{editingIndex !== null ? 'Editar Criterio:' : 'Nuevo Criterio:'}</label>
                                        <input
                                            type="text"
                                            placeholder="Nombre (Ej: Tareas)"
                                            value={nombre}
                                            onChange={e => setNombre(e.target.value)}
                                            style={{ marginBottom: '10px' }}
                                            onKeyDown={(e) => e.key === 'Enter' && addCriterio()}
                                        />
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div className="porcentaje-wrapper" style={{ flexGrow: 1 }}>
                                                <input
                                                    type="number"
                                                    placeholder="%"
                                                    min="1"
                                                    max="100"
                                                    value={porcentaje}
                                                    onChange={e => setPorcentaje(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && addCriterio()}
                                                />
                                            </div>
                                            <button
                                                className="btn"
                                                onClick={addCriterio}
                                                disabled={(editingIndex === null && (totalPorcentaje + (parseInt(porcentaje) || 0) > 100)) || !nombre.trim() || !porcentaje}
                                                style={{ flexGrow: 1, backgroundColor: editingIndex !== null ? '#f39c12' : 'var(--main-color)' }}
                                            >
                                                {editingIndex !== null ? 'Actualizar' : 'Añadir'}
                                            </button>
                                        </div>
                                        {editingIndex !== null && (
                                            <button
                                                className="btn-cancel"
                                                onClick={() => { setEditingIndex(null); setNombre(''); setPorcentaje(''); }}
                                                style={{ marginTop: '5px', width: '100%', borderRadius: '6px', fontSize: '0.9rem', padding: '5px' }}
                                            >
                                                Cancelar Edición
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className={`criterio-total ${totalPorcentaje !== 100 ? 'error' : 'success'}`}
                                style={{
                                    padding: '15px',
                                    marginTop: '20px',
                                    borderRadius: '8px',
                                    backgroundColor: totalPorcentaje === 100 ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                                    border: `1px solid ${totalPorcentaje === 100 ? '#27ae60' : '#e74c3c'}`,
                                    color: totalPorcentaje === 100 ? '#27ae60' : '#e74c3c',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Total T{bimestreActivo}</div>
                                <strong style={{ fontSize: '1.5rem' }}>{totalPorcentaje}%</strong>
                                <span style={{ fontSize: '1rem', color: '#888' }}> / 100%</span>
                                {totalPorcentaje !== 100 && (
                                    <div style={{ fontSize: '0.9em', marginTop: '10px', fontWeight: '500' }}>
                                        {totalPorcentaje < 100 ? `Falta asignar: ${100 - totalPorcentaje}%` : `Excede por: ${totalPorcentaje - 100}%`}
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions" style={{ marginTop: 'auto', paddingTop: '20px' }}>
                                <button type="button" className="btn btn-cancel" onClick={() => onClose()} style={{ marginRight: '10px' }}>Cerrar</button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleGuardar}
                                    style={{ opacity: (criteriosDelBimestre.length > 0 && totalPorcentaje !== 100) ? 0.5 : 1 }}
                                >
                                    Guardar Todos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Trabajos;