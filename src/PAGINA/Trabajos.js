import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import logoImage from './Logoescuela.png';
import ConfirmacionModal from './ConfirmacionModal';
import BrandingModal from '../COMPONENTE/BrandingModal';


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
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '900px', maxWidth: '95vw', padding: '40px' }}>
                <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '20px' }}>Asignar Nombre a Trabajo</h2>
                <p style={{ textAlign: 'center', marginBottom: '2.5rem', color: '#ccc', fontSize: '1.2rem' }}>
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
                        border: '1px solid #ccc',
                        backgroundColor: '#ffffff', /* WHITE BACKGROUND */
                        color: '#000000', /* BLACK TEXT */
                        fontWeight: 'bold'
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

    const location = useLocation();
    const [highlightedAlumnoId, setHighlightedAlumnoId] = useState(null);

    useEffect(() => {
        const fetchGrupos = async () => {
            const token = localStorage.getItem('token');
            const userId = user?._id || user?.id;

            if (!token || !userId) {
                setLoading(false);
                setError("No se pudo identificar al usuario.");
                return;
            }

            const config = { headers: { Authorization: `Bearer ${token}` } };
            try {
                const url = '/grupos/mis-grupos?populate=alumnos,profesoresAsignados.profesor';
                const res = await axios.get(`${API_URL}${url}`, config);
                const sortedData = Array.isArray(res.data) ? res.data.map(g => ({
                    ...g,
                    alumnos: Array.isArray(g.alumnos) ? [...g.alumnos].sort((a, b) => {
                        const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', 'es', { sensitivity: 'base' });
                        if (resP !== 0) return resP;
                        const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', 'es', { sensitivity: 'base' });
                        if (resM !== 0) return resM;
                        return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
                    }) : []
                })) : [];
                setGrupos(sortedData);
            } catch (err) {
                setError("No se pudieron cargar los grupos.");
                console.error("Error fetching groups:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGrupos();
    }, [user]);

    // 🌟 NUEVO: Efecto para auto-seleccionar grupo/asignatura desde URL
    useEffect(() => {
        if (!loading && grupos.length > 0) {
            const params = new URLSearchParams(location.search);
            const gId = params.get('grupoId');
            const asig = params.get('asignatura');
            const aId = params.get('alumnoId');

            if (gId && asig) {
                const targetGrupo = grupos.find(g => String(g._id) === String(gId));
                if (targetGrupo) {
                    handleSeleccionarGrupo(targetGrupo, asig);
                    if (aId) setHighlightedAlumnoId(aId);
                }
            }
        }
    }, [loading, grupos, location.search]);

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
            <h2 style={{ color: '#00CBCB' }}>No tienes grupos asignados.</h2>
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
                    --main-color: #007A7A; /* Teal/Aqua formal */
                    --danger-color: #d32f2f; /* Rojo formal */
                    --success-color: #27ae60; /* Verde formal */
                    --warning-color: #f39c12; /* Naranja/Amarillo de advertencia */

                    --body-font: 'Poppins', sans-serif;
                    --font-semi-bold: 600;
                    background-color: var(--dark-color);
                    color: var(--text-color);
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
                    margin-bottom: 0.8rem;
                    border-bottom: 1px solid var(--dark-color-alt);
                    padding-bottom: 0.6rem;
                    width: 100%;
                }
                .grupo-componente .main-header h1 {
                    font-size: 2.5rem;
                }
                .grupo-componente .main-header h2 {
                    font-size: 1.25rem;
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

                .grupo-componente .btn-compact {
                    padding: 0.4rem 0.8rem !important;
                    font-size: 0.8rem !important;
                    height: 32px !important;
                    line-height: 1 !important;
                    border-radius: 6px !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 5px !important;
                    font-weight: 500 !important;
                    transition: all 0.2s ease-in-out !important;
                }
                .grupo-componente .btn-compact:hover {
                    transform: translateY(-1px) !important;
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
                    width: 100%; height: 100vh;
                    background-color: var(--dark-color);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    padding: 0;
                    box-sizing: border-box;
                    overflow: hidden; /* 🌟 FIX: Outer scroll removed */
                }

                /* ESTILOS EXCLUSIVOS PARA Trabajos.js               */
                /* ================================================= */

                /* --- FUENTES Y VARIABLES GLOBALES --- */
                .grupo-componente {
                    --main-color: #007A7A; /* Teal/Aqua formal */
                    --danger-color: #d32f2f; /* Rojo formal */
                    --success-color: #27ae60; /* Verde formal */
                    --warning-color: #f39c12; /* Naranja/Amarillo de advertencia */

                    --body-font: 'Poppins', sans-serif;
                    --font-semi-bold: 600;
                    background-color: var(--dark-color);
                    color: var(--text-color);
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
                .notificacion-flotante.exito { background-color: var(--main-color); color: white; border: 1px solid #005f5f; }
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
                    border: 1px solid var(--border-color);
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
                    border-bottom: 1px solid var(--border-color);
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
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-color);
                    padding: 10px 12px;
                    font-size: 1rem;
                    font-weight: 400;
                    box-sizing: border-box;
                }
                .grupo-componente .criterio-form input:focus {
                    border-color: var(--main-color);
                    box-shadow: 0 0 3px rgba(0, 122, 122, 0.8);
                    background-color: var(--dark-color-alt);
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
                    margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);
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
                    border-color: var(--border-color);
                    padding: 0.8rem 1.5rem;
                }
                .grupo-componente .modal-actions .btn-cancel:hover {
                    background-color: var(--dark-color);
                    transform: none;
                }



                .grupo-componente .modal-content.asistencia-modal-content {
                    background-color: var(--dark-color-alt);
                    border-radius: 12px;
                    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.6);
                    padding: 0;
                    width: 98vw;
                    height: 96vh;
                    max-width: 98vw;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }

                .grupo-componente .bimestre-selector {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 0.8rem;
                    padding: 6px 20px;
                    border-bottom: 1px solid var(--border-color);
                }
                .grupo-componente .bimestre-selector-buttons {
                    display: flex;
                    gap: 10px;
                }
                .grupo-componente .bimestre-selector .btn {
                    padding: 5px 12px;
                    font-size: 0.85rem;
                    border-radius: 6px;
                }
                .grupo-componente .zoom-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 6px;
                    padding: 3px 8px;
                }
                .grupo-componente .zoom-controls .btn-zoom {
                    background: none;
                    border: none;
                    color: #ccc;
                    font-size: 0.85rem;
                    cursor: pointer;
                    width: 26px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .grupo-componente .zoom-controls .btn-zoom:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: #fff;
                }
                .grupo-componente .zoom-controls span {
                    font-size: 0.8rem;
                    color: #aaa;
                    font-weight: 500;
                    min-width: 40px;
                    text-align: center;
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
                    box-shadow: 0 0 8px rgba(0, 122, 122, 0.7);
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
                    min-height: 40px;
                }

                .grupo-componente .highlight-row {
                    background-color: rgba(0, 203, 203, 0.15) !important;
                    outline: 2px solid var(--main-color);
                    transition: all 0.5s ease;
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
                    grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
                    gap: 4px;
                    align-items: center;
                    padding: 5px 0;
                }

                .grupo-componente .cuadrito-calificacion {
                    width: 30px; 
                    height: 30px;
                    line-height: 40px; /* Centrado vertical del texto */
                    background-color: var(--light-gray-color);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-color);
                    text-align: center;
                    font-weight: 600;
                    font-family: var(--body-font);
                    font-size: 0.8rem;
                    padding: 0;
                    line-height: 1;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .grupo-componente .cuadrito-calificacion::placeholder {
                    color: var(--text-color);
                    opacity: 0.5;
                    font-size: 0.9em;
                }
                .grupo-componente .cuadrito-calificacion:focus {
                    outline: 2px solid var(--main-color);
                    background-color: var(--dark-color-alt);
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
                    font-size: 0.9rem;
                }
                .grupo-componente .btn-agregar-dias:hover {
                    transform: scale(1.05);
                    background-color: #4b6587;
                }

                /* --- TASK HEADERS --- */
                .grupo-componente .task-header-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
                    gap: 4px;
                    margin-bottom: 5px;
                    padding-right: 28px; /* Corrected space for the +5 button */
                }

                .grupo-componente .task-header-cell {
                    width: 28px;
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
                    box-shadow: 0 0 5px rgba(0, 122, 122, 0.5); /* Sombra al enfocar */
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
                    color: white;
                    font-weight: 700;
                    border: none;
                    border-radius: 8px;
                    line-height: 1;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    transition: all 0.2s;
                    margin-left: 10px;
                }
                .grupo-componente .criterio-form .btn:hover {
                    background-color: #00cbcb;
                    transform: translateY(-2px);
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
                    background-color: #00cbcb;
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
                    box-shadow: 0 0 10px rgba(0, 122, 122, 0.4);
                }

                .grupo-componente .sticky-context {
                    position: relative;
                    z-index: 200;
                    background-color: var(--dark-color);
                    padding-bottom: 5px;
                    border-bottom: 2px solid #00CBCB; /* Teal más brillante para visibilidad */
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    flex-shrink: 0;
                }
                .grupo-componente .tabla-global-container {
                    overflow-x: auto;
                    overflow-y: auto;
                    padding: 0 0 40px 0; /* Eliminado el padding lateral que causaba el filtrado visual */
                    flex-grow: 1; /* fills remaining height */
                    border-bottom: 1px solid var(--border-color);
                    position: relative;
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
                    border-bottom: 1px solid var(--border-color);
                    border-right: 1px solid var(--border-color);
                    text-align: center;
                    vertical-align: middle;
                }
                .grupo-componente .tabla-global th {
                    background-color: var(--light-gray-color);
                    color: var(--title-color);
                    font-weight: 600;
                    font-size: 0.9rem;
                    position: sticky;
                    top: 0;
                    z-index: 100; /* Horizontal headers */
                    height: 50px;
                    box-shadow: 0 2px 2px rgba(0,0,0,0.1); 
                }
                .grupo-componente .tabla-global th.alumno-col {
                    text-align: left;
                    min-width: 250px;
                    padding-left: 15px;
                    position: sticky;
                    left: 40px; 
                    top: 0; 
                    z-index: 250; /* Mayor que el resto de headers */
                    background-color: var(--light-gray-color) !important;
                    color: var(--title-color) !important;
                    border-right: 2px solid var(--border-color); 
                    box-shadow: 6px 0 10px -2px rgba(0,0,0,0.5); 
                }
                .grupo-componente .tabla-global td.alumno-col {
                    text-align: left;
                    padding-left: 15px;
                    position: sticky;
                    left: 40px; 
                    background-color: var(--dark-color-alt) !important;
                    z-index: 150; 
                    border-right: 2px solid var(--border-color);
                    font-weight: 500;
                    color: var(--text-color) !important;
                    box-shadow: 6px 0 10px -2px rgba(0,0,0,0.5); 
                }
                .grupo-componente .tabla-global .num-col {
                    position: sticky;
                    left: 0;
                    z-index: 250; 
                    top: 0;
                    background-color: var(--light-gray-color) !important;
                    color: var(--title-color) !important;
                    border-right: 1px solid var(--border-color);
                }
                .grupo-componente .tabla-global tbody td:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 150; 
                    background-color: var(--dark-color-alt) !important;
                    color: var(--text-color) !important;
                    border-right: 1px solid var(--border-color);
                }
                
                /* 🌟 OFFSETS FOR TECNOLOGIA (Approx +50px for Obs column) */
                .grupo-componente .tabla-global.with-obs th.alumno-col,
                .grupo-componente .tabla-global.with-obs td.alumno-col {
                    left: 90px !important;
                }
                
                .grupo-componente .tabla-global .obs-col {
                    position: sticky;
                    left: 40px;
                    z-index: 250; 
                    background-color: var(--light-gray-color) !important;
                    color: var(--title-color) !important;
                    border-right: 1px solid var(--border-color);
                    width: 50px;
                }
                .grupo-componente .tabla-global tbody td.obs-col-body {
                     position: sticky;
                     left: 40px;
                     z-index: 150;
                     background-color: var(--dark-color-alt) !important;
                     border-right: 1px solid var(--border-color);
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
                    background-color: rgba(0, 122, 122, 0.1);
                }
                /* Asegurar que las columnas fijas no sean transparentes al hover */
                .grupo-componente .tabla-global tr:hover td.alumno-col,
                .grupo-componente .tabla-global tr:hover td:first-child,
                .grupo-componente .tabla-global tr:hover td.obs-col-body {
                    background-color: var(--dark-color) !important; 
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
                    font-size: 0.8rem;
                    color: var(--main-color);
                    margin-top: 4px;
                    max-width: 100px;
                    overflow: visible;
                    white-space: normal;
                    line-height: 1.1;
                    text-align: center;
                    word-wrap: break-word;
                    font-weight: 500;
                }
                .grupo-componente .tabla-header-task .task-num {
                    font-size: 0.85rem;
                    opacity: 0.8;
                }

                @media (max-width: 768px) {
                    .grupo-componente .main-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 15px;
                    }
                    .grupo-componente .main-header > div {
                        display: flex;
                        flex-direction: column;
                        width: 100%;
                    }
                    .grupo-componente .main-header .btn {
                        width: 100%;
                        margin-bottom: 5px;
                        margin-left: 0 !important;
                        margin-right: 0 !important;
                    }
                    .grupo-componente .tabla-global th.alumno-col, 
                    .grupo-componente .tabla-global td.alumno-col,
                    .grupo-componente .tabla-global .num-col,
                    .grupo-componente .tabla-global tbody td:first-child,
                    .grupo-componente .tabla-global .obs-col,
                    .grupo-componente .tabla-global tbody td.obs-col-body {
                        position: static !important;
                        box-shadow: none !important;
                    }
                }

                /* 🔒 CORTE CONTROLLER CARD STYLES */
                .corte-controller-card {
                    background: rgba(255, 255, 255, 0.02);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    padding: 6px 16px;
                    margin: 4px 20px 8px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s ease;
                }
                .corte-controller-card.has-corte {
                    border: 1px solid rgba(46, 204, 113, 0.2);
                    background: rgba(46, 204, 113, 0.015);
                }
                .corte-info-sec {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex: 1;
                }
                .corte-status-icon {
                    font-size: 1.2rem;
                }
                .corte-status-details {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .corte-status-details h4 {
                    margin: 0;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #fff;
                    white-space: nowrap;
                }
                .corte-status-details p {
                    margin: 0;
                    font-size: 0.78rem;
                    color: rgba(255, 255, 255, 0.55);
                    line-height: 1.2;
                }
                .corte-actions-sec {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                /* 🔄 MIGRACIÓN MODAL STYLES */
                .migracion-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(8px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 99999;
                    animation: fadeIn 0.2s ease-out;
                }
                .migracion-modal-content {
                    background: rgba(20, 20, 20, 0.85);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    width: 500px;
                    max-width: 90%;
                    padding: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                    color: #fff;
                    animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .migracion-modal-header {
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    padding-bottom: 15px;
                }
                .migracion-modal-header h3 {
                    margin: 0;
                    font-size: 1.4rem;
                    font-weight: 600;
                    color: #fff;
                }
                .migracion-form-group {
                    margin-bottom: 20px;
                }
                .migracion-form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.8);
                }
                .migracion-select {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 10px 12px;
                    color: #fff;
                    font-size: 0.95rem;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .migracion-select:focus {
                    border-color: #8e44ad;
                }
                .migracion-select option {
                    background: #1e1e1e;
                    color: #fff;
                }
                .migracion-options-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 15px;
                    margin-bottom: 25px;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 15px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .migracion-warning {
                    background: rgba(231, 76, 60, 0.15);
                    border: 1px solid rgba(231, 76, 60, 0.3);
                    border-radius: 8px;
                    padding: 12px 15px;
                    color: #e74c3c;
                    font-size: 0.8rem;
                    line-height: 1.4;
                    margin-bottom: 25px;
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                }
                .migracion-warning span {
                    font-size: 1.2rem;
                    flex-shrink: 0;
                    margin-top: -2px;
                }
                .migracion-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
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
    const [error, setError] = useState(null);
    const [schoolConfig, setSchoolConfig] = useState(null);
    const [brandingModal, setBrandingModal] = useState({ visible: false, onConfirm: null, title: '' });
    // 🌟 ESTADO AGREGADO: Para controlar cuándo y qué tarea necesita un nombre.
    const [tareaPorNombrar, setTareaPorNombrar] = useState(null);
    // 🌟 ESTADO AGREGADO: Para el modal de confirmación personalizado
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
    // 🌟 ESTADO AGREGADO: Criterio seleccionado para vista masiva (null = vista lista, string = vista tabla)
    const [criterioSeleccionadoGlobal, setCriterioSeleccionadoGlobal] = useState(null);
    // 🌟 ESTADO AGREGADO: Zoom (Escala)
    const [zoomLevel, setZoomLevel] = useState(1);
    const [hasChanges, setHasChanges] = useState(false);
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

    // 🌟 ESTADOS NUEVOS PARA CORTES Y MIGRACIÓN
    const [cortes, setCortes] = useState({});
    const [isMigrarModalOpen, setIsMigrarModalOpen] = useState(false);
    const [isCorteLoading, setIsCorteLoading] = useState(false);
    const [migracionConfig, setMigracionConfig] = useState({
        origenBimestre: '1',
        destinoBimestre: '2',
        accionConflictos: 'merge', // 'merge' o 'overwrite'
        accionOrigen: 'keep' // 'keep' o 'clear'
    });

    // 🌟 ESTADO AGREGADO: Historial para Deshacer/Rehacer (Undo/Redo)
    const [history, setHistory] = useState({ past: [], future: [] });

    // 🌟 MEMOIZED SORTED ALUMNOS
    // Fixes the issue where students shuffle randomly during render or updates.
    const sortedAlumnos = useMemo(() => {
        if (!grupo || !grupo.alumnos) return [];
        return [...grupo.alumnos].sort((a, b) => {
            const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', 'es', { sensitivity: 'base' });
            if (resP !== 0) return resP;
            const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', 'es', { sensitivity: 'base' });
            if (resM !== 0) return resM;
            return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
        });
    }, [grupo]);
  
    // --- LÓGICA PARA EVITAR SALIR SIN GUARDAR ---
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    const handleConfirmarVolver = () => {
        if (hasChanges) {
            setShowUnsavedWarning(true);
        } else {
            onVolver();
        }
    };

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
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        
        // 🎯 FIX: Se incluye numTareas para evitar pérdida de configuración al guardar criterios
        const payload = { 
            grupoId: grupo._id, 
            asignatura, 
            criterios: nuevosCriterios, 
            calificaciones,
            numTareas 
        };

        try {
            await axios.post(`${API_URL}/calificaciones`, payload, config);
            setHasChanges(false);
            setNotificacion({ mensaje: 'Criterios actualizados y guardados correctamente.', tipo: 'exito' });
        } catch (error) {
            console.error("Error auto-guardando criterios:", error);
            setNotificacion({ mensaje: 'Criterios actualizados localmente, pero error al guardar en servidor.', tipo: 'warning' });
        }
    }, [grupo._id, asignatura, calificaciones, numTareas, setCriteriosPorBimestre, setModalCriterios, setNotificacion]);

    const getPeriodCount = () => {
        if (!schoolConfig) return 3;
        switch (schoolConfig.evaluationPeriod) {
            case 'Bimestre': return 5;
            case 'Trimestre':
            case 'Cuatrimestre': return 3;
            case 'Semestre': return 2;
            default: return 3;
        }
    };

    const getPeriodLabel = (index) => {
        const type = schoolConfig?.evaluationPeriod || 'Trimestre';
        const label = type === 'Bimestre' ? 'Bim' : (type === 'Semestre' ? 'Sem' : 'Trim');
        return `${label} ${index + 1}`;
    };


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
                setCortes(res.data?.cortes || {});

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

                // Fetch School Config
                const schoolRes = await axios.get(`${API_URL}/schools/${user.school_id}`, config);
                setSchoolConfig(schoolRes.data);

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
        
        setHasChanges(true);
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
        setHasChanges(true);
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
        
        setHasChanges(true);
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
        
        setHasChanges(true);
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
  
        setHasChanges(true);
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
            setHasChanges(false);
            setNotificacion({ mensaje: '¡Calificaciones guardadas con éxito!', tipo: 'exito' });
        } catch (error) {
            setNotificacion({ mensaje: 'Error al guardar las calificaciones.', tipo: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // 🌟 FUNCIONES PARA MIGRACIÓN Y GESTIÓN DE CORTES
    const handleMigrarCalificaciones = async (configuracion) => {
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const payload = {
            grupoId: grupo._id,
            asignatura,
            origenBimestre: Number(configuracion.origenBimestre),
            destinoBimestre: Number(configuracion.destinoBimestre),
            accionConflictos: configuracion.accionConflictos,
            accionOrigen: configuracion.accionOrigen
        };

        try {
            const res = await axios.post(`${API_URL}/calificaciones/migrar`, payload, config);
            const fetchedCriterios = {
                1: res.data.data?.criterios?.[1] || [],
                2: res.data.data?.criterios?.[2] || [],
                3: res.data.data?.criterios?.[3] || [],
            };
            setCriteriosPorBimestre(fetchedCriterios);
            setCalificaciones(res.data.data?.calificaciones || {});
            setCortes(res.data.data?.cortes || {});
            
            setHasChanges(false);
            setIsMigrarModalOpen(false);
            setNotificacion({ mensaje: res.data.msg || 'Calificaciones migradas exitosamente.', tipo: 'exito' });
        } catch (error) {
            console.error("Error al migrar calificaciones:", error);
            setNotificacion({ 
                mensaje: error.response?.data?.msg || 'Error al migrar las calificaciones.', 
                tipo: 'error' 
            });
        }
    };

    const handleGestionarCorte = async (trimestre, accion) => {
        setIsCorteLoading(true);
        const token = localStorage.getItem('token');
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const payload = {
            grupoId: grupo._id,
            asignatura,
            trimestre: Number(trimestre),
            accion
        };

        try {
            const res = await axios.post(`${API_URL}/calificaciones/corte`, payload, config);
            setCortes(res.data.data?.cortes || {});
            setNotificacion({ mensaje: res.data.msg || 'Operación de corte exitosa.', tipo: 'exito' });
        } catch (error) {
            console.error("Error al gestionar corte:", error);
            setNotificacion({ 
                mensaje: error.response?.data?.msg || 'Error al gestionar el corte.', 
                tipo: 'error' 
            });
        } finally {
            setIsCorteLoading(false);
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
        const maxTareas = numTareas[criterioNombre] || 10; // 🎯 FIX: Default to 10 to avoid 0 average if uninitialized

        const notasValidas = Object.keys(tareas)
            .filter(index => parseInt(index) < maxTareas) // Solo tareas visibles
            .map(index => tareas[index])
            .filter(entrada => entrada && typeof entrada.nota === 'number')
            .map(entrada => entrada.nota);

        if (notasValidas.length === 0) return 0;
        const total = notasValidas.reduce((sum, nota) => sum + nota, 0);
        return total / notasValidas.length;
    };

    // 🌟 Nueva función de redondeo según reglas del usuario (Refinada para precisión)
    const redondearCalificacion = (val) => {
        if (typeof val !== 'number' || val <= 0) return 0;
        // Paso 1: Redondear a una decimal primero (ej. 9.499 -> 9.5)
        // Esto evita errores de precisión de coma flotante
        const valUnaDecimal = Math.round(val * 10) / 10;

        // Paso 2: Excepción: 5.0 a 5.9 se queda en 5
        if (valUnaDecimal >= 5 && valUnaDecimal < 6) return 5;

        // Paso 3: Redondeo estándar para el resto (>=6), .5 sube
        return Math.max(5, Math.round(valUnaDecimal));
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
        const promedioRedondeado = redondearCalificacion(promedioFinal);
        return promedioRedondeado;
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
    const generateSubjectReport = async (brandingData = {}) => {
        const doc = new jsPDF();

        const schoolName = schoolConfig?.name || 'Escuela Secundaria';
        const schoolLogo = brandingData.logoUrl || schoolConfig?.config?.logoUrl || logoImage;
        const schoolDirector = brandingData.directorName || schoolConfig?.directorName || '';

        // --- LOGO Y ENCABEZADO (Reutilizado de Calificaciones.js) ---
        const margin = 14;
        const pageWidth = doc.internal.pageSize.width;

        if (user?.role !== 'profesor') {
            const img = new Image();
            img.src = schoolLogo;
            await img.decode().catch(() => { });
            const logoWidth = 25;
            const logoHeight = (img.height * logoWidth) / img.width;
            doc.addImage(schoolLogo, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);
        }

        doc.setFontSize(12);
        let yPos = margin + 5;
        doc.text(schoolName, margin, yPos);
        yPos += 7;
        doc.setFont(undefined, 'bold');
        doc.text('Reporte de Calificaciones por Asignatura', margin, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 7;

        if (user?.role !== 'profesor') {
            doc.text(`Director(a): ${schoolDirector || localStorage.getItem('current_director_name') || 'N/A'}`, margin, yPos);
            yPos += 7;
        }

        doc.text(`Grupo: ${grupo.nombre} - Asignatura: ${asignatura}`, margin, yPos);
        yPos += 7;
        // 🌟 AGREGADO: Nombre del docente
        const nombreDocente = user ? `${user.nombre} ${user.apellidoPaterno || ''} ${user.apellidoMaterno || ''}`.trim() : 'Docente';
        doc.text(`Docente: ${nombreDocente}`, margin, yPos);
        yPos += 5;

        // --- TABLA ---
        const isTec = asignatura?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('tecnologia');
        const tableHeaders = [isTec ? ['Nombre del Alumno', 'Obs.', 'T1', 'T2', 'T3', 'Promedio Final'] : ['Nombre del Alumno', 'T1', 'T2', 'T3', 'Promedio Final']];

        const tableBody = [...grupo.alumnos].sort((a, b) => {
            const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', 'es', { sensitivity: 'base' });
            if (resP !== 0) return resP;
            const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', 'es', { sensitivity: 'base' });
            if (resM !== 0) return resM;
            return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
        }).map(alumno => {
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
            const final = count > 0 ? redondearCalificacion(suma / count) : 0;

            const rowData = [
                nombreCompleto,
                p1 > 0 ? p1 : '-',
                p2 > 0 ? p2 : '-',
                p3 > 0 ? p3 : '-',
                final > 0 ? final : '-'
            ];

            if (isTec) {
                const obs = calificaciones[alumno._id]?.[bimestreActivo]?.OBSERVACIONES || '';
                rowData.splice(1, 0, obs); // Insert Obs at index 1
            }

            return rowData;
        });

        autoTable(doc, {
            startY: yPos,
            head: tableHeaders,
            body: tableBody,
            theme: 'grid',
            styles: { halign: 'center', cellPadding: 2.5 },
            headStyles: { fillColor: [0, 203, 203], textColor: 255 }, // Color aqua
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
                confirmText={confirmModal.confirmText || "Sí, Eliminar Todo"}
                cancelText={confirmModal.cancelText || "Cancelar"}
            />
  
            <ConfirmacionModal
                isOpen={showUnsavedWarning}
                onClose={() => setShowUnsavedWarning(false)}
                onConfirm={() => {
                    setHasChanges(false);
                    setShowUnsavedWarning(false);
                    onVolver();
                }}
                mensaje="Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?"
                confirmText="Salir sin guardar"
                cancelText="Seguir calificando"
            />

            {/* 🔄 MODAL PARA MIGRACIÓN DE CALIFICACIONES */}
            {isMigrarModalOpen && (
                <div className="migracion-modal-overlay">
                    <div className="migracion-modal-content">
                        <div className="migracion-modal-header">
                            <span style={{ fontSize: '1.8rem' }}>🔄</span>
                            <h3>Migrar Calificaciones</h3>
                        </div>

                        <div className="migracion-form-group">
                            <label>Trimestre de Origen (Desde donde se copiarán los datos):</label>
                            <select
                                className="migracion-select"
                                value={migracionConfig.origenBimestre}
                                onChange={(e) => setMigracionConfig({ ...migracionConfig, origenBimestre: e.target.value })}
                            >
                                {Array.from({ length: getPeriodCount() }).map((_, i) => (
                                    <option key={i+1} value={i+1}>{getPeriodLabel(i)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="migracion-form-group">
                            <label>Trimestre de Destino (Hacia donde se enviarán):</label>
                            <select
                                className="migracion-select"
                                value={migracionConfig.destinoBimestre}
                                onChange={(e) => setMigracionConfig({ ...migracionConfig, destinoBimestre: e.target.value })}
                            >
                                {Array.from({ length: getPeriodCount() }).map((_, i) => (
                                    <option key={i+1} value={i+1}>{getPeriodLabel(i)}</option>
                                ))}
                            </select>
                        </div>

                        <div className="migracion-options-grid">
                            <div className="migracion-form-group" style={{ marginBottom: '10px' }}>
                                <label>Acción sobre el Trimestre Origen:</label>
                                <select
                                    className="migracion-select"
                                    value={migracionConfig.accionOrigen}
                                    onChange={(e) => setMigracionConfig({ ...migracionConfig, accionOrigen: e.target.value })}
                                >
                                    <option value="keep">Copiar (Mantener calificaciones en origen)</option>
                                    <option value="clear">Mover (Limpiar origen después de migrar)</option>
                                </select>
                            </div>

                            <div className="migracion-form-group" style={{ marginBottom: 0 }}>
                                <label>Resolución de Conflictos (Si el destino ya tiene datos):</label>
                                <select
                                    className="migracion-select"
                                    value={migracionConfig.accionConflictos}
                                    onChange={(e) => setMigracionConfig({ ...migracionConfig, accionConflictos: e.target.value })}
                                >
                                    <option value="merge">Combinar (Solo copiar donde esté vacío)</option>
                                    <option value="overwrite">Sobrescribir (Reemplazar todo en destino)</option>
                                </select>
                            </div>
                        </div>

                        {migracionConfig.origenBimestre === migracionConfig.destinoBimestre ? (
                            <div className="migracion-warning" style={{ background: 'rgba(230, 126, 34, 0.15)', borderColor: 'rgba(230, 126, 34, 0.3)', color: '#f39c12' }}>
                                <span>⚠️</span>
                                <div>El trimestre de origen y destino no pueden ser el mismo. Seleccione trimestres diferentes.</div>
                            </div>
                        ) : (migracionConfig.accionOrigen === 'clear' || migracionConfig.accionConflictos === 'overwrite') ? (
                            <div className="migracion-warning">
                                <span>⚠️</span>
                                <div>
                                    <strong>¡Atención!</strong> esta acción {migracionConfig.accionOrigen === 'clear' ? 'borrará las calificaciones de origen' : ''} 
                                    {migracionConfig.accionOrigen === 'clear' && migracionConfig.accionConflictos === 'overwrite' ? ' y ' : ''}
                                    {migracionConfig.accionConflictos === 'overwrite' ? 'sobrescribirá las calificaciones de destino' : ''}. 
                                    Esta acción no se puede deshacer.
                                </div>
                            </div>
                        ) : null}

                        <div className="migracion-actions">
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setIsMigrarModalOpen(false)}
                                style={{ backgroundColor: '#7f8c8d', borderColor: '#7f8c8d', color: 'white' }}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="btn" 
                                onClick={() => {
                                    setConfirmModal({
                                        isOpen: true,
                                        message: "¿Está seguro de que desea migrar las calificaciones con la configuración seleccionada?",
                                        confirmText: "Sí, Migrar",
                                        cancelText: "Cancelar",
                                        onConfirm: () => {
                                            handleMigrarCalificaciones(migracionConfig);
                                        }
                                    });
                                }}
                                disabled={migracionConfig.origenBimestre === migracionConfig.destinoBimestre}
                                style={{ 
                                    backgroundColor: migracionConfig.origenBimestre === migracionConfig.destinoBimestre ? '#95a5a6' : '#8e44ad', 
                                    borderColor: migracionConfig.origenBimestre === migracionConfig.destinoBimestre ? '#95a5a6' : '#8e44ad', 
                                    color: 'white',
                                    cursor: migracionConfig.origenBimestre === migracionConfig.destinoBimestre ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Migrar Datos
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Contenido principal del panel de calificaciones */}
            <div className="asistencia-modal-content">
                <div className="sticky-context">
                    <header className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '6px 20px' }}>
                        <h2>Calificaciones: {grupo.nombre} - {asignatura}</h2>
                        <div>
                            {/* Botones de Acción Nuevos */}
                            <div style={{ display: 'inline-flex', gap: '5px', marginRight: '15px', verticalAlign: 'middle', alignItems: 'center' }}>
                                <button
                                    className="btn btn-compact"
                                    style={{ backgroundColor: '#95a5a6', color: 'white', opacity: history.past.length === 0 ? 0.5 : 1, cursor: history.past.length === 0 ? 'not-allowed' : 'pointer' }}
                                    onClick={handleUndo}
                                    disabled={history.past.length === 0}
                                    title="Deshacer (Ctrl+Z)"
                                >
                                    <FaArrowLeft />
                                </button>
                                <button
                                    className="btn btn-compact"
                                    style={{ backgroundColor: '#95a5a6', color: 'white', opacity: history.future.length === 0 ? 0.5 : 1, cursor: history.future.length === 0 ? 'not-allowed' : 'pointer' }}
                                    onClick={handleRedo}
                                    disabled={history.future.length === 0}
                                    title="Rehacer"
                                >
                                    <FaArrowRight />
                                </button>
                            </div>
                            <button className="btn btn-compact" onClick={() => {
                                if (user?.role === 'profesor') {
                                    generateSubjectReport({});
                                } else {
                                    setBrandingModal({
                                        visible: true,
                                        title: 'Reporte de Asignatura',
                                        onConfirm: (brandingData) => generateSubjectReport(brandingData)
                                    });
                                }
                            }} style={{ marginRight: '10px', backgroundColor: '#2980b9', borderColor: '#2980b9', color: 'white' }}>
                                📄 Reporte PDF
                            </button>
                            <button className="btn btn-compact" onClick={handleLimpiarCalificaciones} style={{ marginRight: '10px', backgroundColor: '#c0392b', borderColor: '#c0392b', color: 'white' }}>
                                🗑️ Limpiar Calificaciones
                            </button>


                            {/* Botón para abrir el modal de criterios */}
                            <button className="btn btn-compact" onClick={() => setModalCriterios(true)}>Criterios</button>
                            <button 
                                className="btn btn-compact" 
                                onClick={() => {
                                    setMigracionConfig({
                                        origenBimestre: String(bimestreActivo),
                                        destinoBimestre: String(bimestreActivo === getPeriodCount() ? 1 : bimestreActivo + 1),
                                        accionConflictos: 'merge',
                                        accionOrigen: 'keep'
                                    });
                                    setIsMigrarModalOpen(true);
                                }} 
                                style={{ marginLeft: '10px', backgroundColor: '#8e44ad', borderColor: '#8e44ad', color: 'white' }}
                                title="Migrar calificaciones entre trimestres"
                            >
                                🔄 Migrar Calificaciones
                            </button>
                            <button className="btn btn-cancel btn-compact" onClick={handleConfirmarVolver} style={{ marginLeft: '10px' }}>Cerrar</button>
                        </div>
                    </header>

                    <div className="bimestre-selector">
                        <div className="bimestre-selector-buttons">
                            {(() => {
                                const buttons = [];
                                const count = getPeriodCount();
                                for (let i = 1; i <= count; i++) {
                                    buttons.push(
                                        <button
                                            key={i}
                                            className={`btn ${bimestreActivo === i ? 'btn-primary' : ''}`}
                                            onClick={() => { setBimestreActivo(i); setCriterioSeleccionadoGlobal(null); }}
                                        >
                                            {getPeriodLabel(i - 1)}
                                        </button>
                                    );
                                }
                                return buttons;
                            })()}
                        </div>
                        <div className="zoom-controls">
                            <button className="btn-zoom" onClick={handleZoomOut} title="Alejar">🔍 -</button>
                            <span>{Math.round(zoomLevel * 100)}%</span>
                            <button className="btn-zoom" onClick={handleZoomIn} title="Acercar">🔍 +</button>
                        </div>
                    </div>

                    {/* 🔒 PANEL DE GESTIÓN DE CORTES OFICIALES */}
                    {(() => {
                        const hasCorte = cortes[bimestreActivo] && cortes[bimestreActivo].fecha;
                        const fechaCorte = hasCorte ? formatFechaTooltip(cortes[bimestreActivo].fecha) : null;
                        const totalPorcentaje = criteriosActivos.reduce((acc, c) => acc + (c.porcentaje || 0), 0);
                        const periodLabel = schoolConfig?.evaluationPeriod || 'Trimestre';
                        const currentPeriodName = `${periodLabel} ${bimestreActivo}`;

                        return (
                            <div className={`corte-controller-card ${hasCorte ? 'has-corte' : ''}`}>
                                <div className="corte-info-sec">
                                    <div className="corte-status-icon">
                                        {hasCorte ? '🔒' : '🔓'}
                                    </div>
                                    <div className="corte-status-details">
                                        <h4>Corte Oficial: {currentPeriodName}</h4>
                                        {hasCorte ? (
                                            <p>Las calificaciones de la boleta fueron congeladas el <strong>{fechaCorte}</strong>. Las modificaciones posteriores se guardan de forma dinámica.</p>
                                        ) : (
                                            <p>Sin corte oficial. Las calificaciones de los alumnos son completamente dinámicas.</p>
                                        )}
                                        {totalPorcentaje !== 100 && !hasCorte && (
                                            <p style={{ color: '#e67e22', fontWeight: '500' }}>
                                                ⚠️ La suma de criterios debe ser exactamente 100% para realizar un corte (Actual: {totalPorcentaje}%).
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="corte-actions-sec">
                                    {isCorteLoading ? (
                                        <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Procesando...</span>
                                    ) : hasCorte ? (
                                        <button 
                                            className="btn btn-compact" 
                                            onClick={() => {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    message: `¿Está seguro de que desea REVERTIR el corte oficial del ${currentPeriodName}? Esto eliminará el promedio congelado y todas las calificaciones volverán a ser dinámicas en las boletas.`,
                                                    confirmText: "Sí, Revertir",
                                                    cancelText: "Cancelar",
                                                    onConfirm: () => {
                                                        handleGestionarCorte(bimestreActivo, 'eliminar');
                                                    }
                                                });
                                            }}
                                            style={{ backgroundColor: '#d35400', borderColor: '#d35400', color: 'white' }}
                                        >
                                            🔓 Revertir Corte
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn btn-compact" 
                                            onClick={() => {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    message: `¿Está seguro de que desea REALIZAR el corte oficial del ${currentPeriodName}? Se calculará y guardará el promedio ponderado de todos los alumnos en este momento. Este promedio será el oficial impreso en las boletas.`,
                                                    confirmText: "Congelar",
                                                    cancelText: "Cancelar",
                                                    onConfirm: () => {
                                                        handleGestionarCorte(bimestreActivo, 'crear');
                                                    }
                                                });
                                            }}
                                            disabled={totalPorcentaje !== 100}
                                            style={{ 
                                                backgroundColor: totalPorcentaje !== 100 ? '#7f8c8d' : '#27ae60', 
                                                borderColor: totalPorcentaje !== 100 ? '#7f8c8d' : '#27ae60', 
                                                color: 'white',
                                                cursor: totalPorcentaje !== 100 ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            🔒 Congelar Promedios
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 🌟 SELECTOR DE CRITERIOS (TABS) */}
                    {criteriosActivos.length > 0 && (
                        <div className="tabs-criterios" style={{ marginBottom: 0 }}>
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
                </div>

                {criteriosActivos.length > 0 ? (
                    <>
                        {/* --- VISTA 1: TABLA MASIVA (SI HAY UN CRITERIO SELECCIONADO) --- */}
                        {criterioSeleccionadoGlobal ? (
                            <div className="tabla-global-container" style={{ fontSize: `${zoomLevel}rem` }}>
                                <table className={`tabla-global ${asignatura?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('tecnologia') ? 'with-obs' : ''}`}>
                                    <thead>
                                        <tr>
                                            <th className="num-col" style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}>#</th>
                                            {asignatura?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('tecnologia') && <th className="obs-col">Obs.</th>}
                                            <th className="alumno-col" style={{ width: '250px', minWidth: '250px' }}>Alumno</th>
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
                                                            <span className="task-num">T{tareaIndex + 1}</span>
                                                            {nombreTarea && (
                                                                <span className="task-name">{nombreTarea}</span>
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
                                                {asignatura?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('tecnologia') && (
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
                                                <td style={{ fontWeight: 'bold', color: redondearCalificacion(calcularPromedioCriterio(alumno._id, bimestreActivo, criterioSeleccionadoGlobal)) >= 6 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                                    {redondearCalificacion(calcularPromedioCriterio(alumno._id, bimestreActivo, criterioSeleccionadoGlobal))}
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
                                                <div className="promedio-final-display-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', minWidth: '90px' }}>
                                                    <div className="promedio-final-display" style={{ color: calcularPromedioBimestre(alumno._id, bimestreActivo) >= 6 ? '#27ae60' : '#d32f2f', fontWeight: 'bold' }}>
                                                        Prom: {calcularPromedioBimestre(alumno._id, bimestreActivo)}
                                                    </div>
                                                    {(() => {
                                                        const frozenGrade = cortes[bimestreActivo]?.promedios?.[alumno._id];
                                                        if (frozenGrade !== undefined && frozenGrade !== null) {
                                                            const currentGrade = Number(calcularPromedioBimestre(alumno._id, bimestreActivo)) || 0;
                                                            const diff = Number((currentGrade - frozenGrade).toFixed(1));
                                                            const diffColor = diff > 0 ? '#2ecc71' : (diff < 0 ? '#e74c3c' : '#7f8c8d');
                                                            const diffText = diff > 0 ? `+${diff}` : `${diff}`;
                                                            
                                                            return (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', marginTop: '2px' }}>
                                                                    <span style={{ color: '#aaa' }}>Boleta: {frozenGrade}</span>
                                                                    {diff !== 0 && (
                                                                        <span style={{ 
                                                                            backgroundColor: diffColor, 
                                                                            color: 'white', 
                                                                            borderRadius: '3px', 
                                                                            padding: '1px 4px', 
                                                                            fontWeight: 'bold',
                                                                            fontSize: '0.65rem'
                                                                        }}>
                                                                            {diffText}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                            {/* Desplegable en Vista General */}
                                            {criterioAbierto?.alumnoId === alumno._id && (
                                                <div className={`bimestre-desplegable desplegado`}>


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

                {brandingModal.visible && (
                    <BrandingModal
                        initialData={{
                            directorName: schoolConfig?.directorName || localStorage.getItem('current_director_name') || '',
                            logoUrl: schoolConfig?.config?.logoUrl || '',
                            defaultLogo: logoImage
                        }}
                        onConfirm={(data) => {
                            setBrandingModal({ ...brandingModal, visible: false });
                            brandingModal.onConfirm(data);
                        }}
                        onClose={() => setBrandingModal({ ...brandingModal, visible: false })}
                        title={brandingModal.title}
                    />
                )}
            </div>
    );
};

const getSafeId = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    const id = obj.id || obj._id;
    return id ? String(id) : String(obj);
};

// ======================================
// --- 4. Componente: Lista de Grupos (Original) ---
// ======================================
const ListaDeGrupos = ({ grupos, user, onSeleccionarGrupo }) => {
    const currentUserId = getSafeId(user);

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
                            const misAsignaciones = grupo.profesoresAsignados.filter(asig => {
                                // 1. Intentar matching por ID robusto
                                const assignedId = getSafeId(asig.profesor);
                                const idMatch = assignedId && currentUserId && (assignedId === currentUserId);

                                // 2. Intentar matching por Email (Backup robusto si falla el ID)
                                const assignedEmail = asig.profesor?.email?.toLowerCase();
                                const userEmail = user?.email?.toLowerCase();
                                const emailMatch = assignedEmail && userEmail && (assignedEmail === userEmail);

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

            {/* BrandingModal removed from here and moved to PanelCalificaciones scope */}
        </div>
    );
};

export default Trabajos;