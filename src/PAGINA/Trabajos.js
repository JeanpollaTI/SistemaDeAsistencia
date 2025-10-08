// Archivo: Trabajos.js

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Agregamos useCallback
// 1. IMPORTACIÓN ACTUALIZADA: Usamos nuestro apiClient centralizado.
import apiClient from '../api/apiClient';
import * as XLSX from 'xlsx';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Trabajos.css';
import Notificacion from './Notificacion';
import ConfirmacionModal from './ConfirmacionModal';
import logoImage from './Logoescuela.png'; // Asegúrate que esta ruta sea correcta

// --- CONSTANTES DE CONFIGURACIÓN ---
const NUM_BIMESTRES = 3;
const DIAS_INICIALES = 30; // Valor por defecto de días si no hay registro

// --- Sub-componente: Modal para Criterios de Evaluación (Definido al final del archivo original, lo movemos aquí para su uso) ---
const ModalCriterios = ({ criteriosExistentes, onGuardar, onClose, setNotificacion }) => {
    const [criterios, setCriterios] = useState(criteriosExistentes || []);
    const [nombre, setNombre] = useState('');
    const [porcentaje, setPorcentaje] = useState('');

    const totalPorcentaje = criterios.reduce((acc, curr) => acc + (Number(curr.porcentaje) || 0), 0);

    const addCriterio = () => {
      const porciento = parseInt(porcentaje, 10);
      if (nombre && !isNaN(porciento) && porciento > 0 && totalPorcentaje + porciento <= 100) {
        setCriterios([...criterios, { nombre, porcentaje: porciento }]);
        setNombre('');
        setPorcentaje('');
      } else {
        setNotificacion({ mensaje: 'Verifica los datos. El total no debe exceder 100%.', tipo: 'error' });
      }
    };

    const removeCriterio = (index) => setCriterios(criterios.filter((_, i) => i !== index));

    const handleGuardar = () => {
      if (totalPorcentaje !== 100) {
        setNotificacion({ mensaje: 'La suma de porcentajes debe ser exactamente 100%.', tipo: 'error' });
        return;
      }
      onGuardar(criterios);
      onClose();
    };

    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Definir Criterios de Evaluación</h2>
          {criterios.map((c, index) => (
            <div key={index} className="criterio-item">
              <span>{c.nombre} - <strong>{c.porcentaje}%</strong></span>
              <button onClick={() => removeCriterio(index)}>X</button>
            </div>
          ))}
          <div className="criterio-form">
            <input type="text" placeholder="Nombre (Ej: Tareas)" value={nombre} onChange={e => setNombre(e.target.value)} />
            <input type="number" placeholder="Porcentaje (Ej: 40)" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
            <button className="btn" onClick={addCriterio}>Añadir</button>
          </div>
          <div className={`criterio-total ${totalPorcentaje > 100 ? 'error' : ''}`}>
            <strong>Total: {totalPorcentaje}% / 100%</strong>
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleGuardar}>Guardar Criterios</button>
          </div>
        </div>
      </div>
    );
};


// --- Componente Principal: Trabajos ---
function Trabajos({ user }) {
  // --- ESTADOS ---
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);

  // Estado para la asignatura seleccionada
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState(null);

  // Estados de Modales
  const [asistencia, setAsistencia] = useState({});
  const [diasPorBimestre, setDiasPorBimestre] = useState({});
  const [bimestreAbierto, setBimestreAbierto] = useState({});
  const [asignaciones, setAsignaciones] = useState({});
  const [editingAlumno, setEditingAlumno] = useState(null);
  const [modalVisible, setModalVisible] = useState(null);
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', alumnos: [] });
  const [alumnoInput, setAlumnoInput] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
  const [grupoParaEliminar, setGrupoParaEliminar] = useState(null);
  const [alumnoParaEliminar, setAlumnoParaEliminar] = useState(null);
  const [archivoXLS, setArchivoXLS] = useState(null);
  const [nombreGrupoImport, setNombreGrupoImport] = useState('');
  
  // Estados de Calificaciones
  const [criterios, setCriterios] = useState([]);
  const [calificaciones, setCalificaciones] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [criterioAbierto, setCriterioAbierto] = useState(null);
  const [numTareas, setNumTareas] = useState({});

  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: '' });

  // --- LÓGICA DE UTILIDAD ---
  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    setNotificacion({ visible: true, mensaje, tipo });
  };
  
  const cerrarModal = () => {
    setModalVisible(null);
    setGrupoSeleccionado(null);
    setNuevoGrupo({ nombre: '', alumnos: [] });
    setAlumnoInput({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
    setBimestreAbierto({});
    setAsignaciones({});
    setEditingAlumno(null);
    setArchivoXLS(null);
    setNombreGrupoImport('');
    // Recargar profesores después de una acción CRUD si es necesario
    fetchProfesores(); 
  };
  
  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  
  const fetchProfesores = async () => {
    const token = localStorage.getItem('token');
    const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const res = await apiClient.get('/profesores', axiosConfig);
        setProfesores(res.data);
    } catch (err) {
        console.error("Error fetching professors:", err);
    }
  };


  // --- LÓGICA DE CARGA DE DATOS ---
  useEffect(() => {
    if (!user) { setLoading(false); setError("Información de usuario no disponible."); return; }
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setError("No autorizado. Por favor, inicia sesión."); setLoading(false); return; }
      const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };
      try {
        if (user.role === 'admin') {
          // 2. CÓDIGO ACTUALIZADO: Usando apiClient
          const [gruposRes, profesoresRes] = await Promise.all([
            apiClient.get('/grupos', axiosConfig),
            apiClient.get('/auth/profesores', axiosConfig) // Ruta corregida para profesores
          ]);
          setGrupos(gruposRes.data);
          setProfesores(profesoresRes.data);
        } else if (user.role === 'profesor') {
          // 3. CÓDIGO ACTUALIZADO: Usando apiClient
          const gruposRes = await apiClient.get('/grupos/mis-grupos', axiosConfig);
          setGrupos(gruposRes.data);
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        setError("No se pudieron cargar los datos.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // --- HANDLERS ---
  const handleSeleccionarGrupo = (grupo, asignatura) => {
    setGrupoSeleccionado(grupo);
    setAsignaturaSeleccionada(asignatura);
  };

  const handleVolver = () => {
    setGrupoSeleccionado(null);
    setAsignaturaSeleccionada(null);
  };
  
  // Función para obtener calificaciones de un grupo/materia (reutilizada del componente Calificaciones)
  const fetchCalificaciones = async (grupoId, asignatura) => {
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const res = await apiClient.get(`/calificaciones?grupoId=${grupoId}&asignatura=${asignatura}`, config);
        setCriterios(res.data?.criterios || []);
        setCalificaciones(res.data?.calificaciones || {});
        // Si no hay criterios, abrimos el modal para definirlos
        if (!res.data || !res.data.criterios || res.data.criterios.length === 0) {
          setModalVisible('criterios'); // Usamos 'criterios' como un tipo de modal
        }
    } catch (error) {
        setNotificacion({ mensaje: 'Error al cargar los datos de calificaciones.', tipo: 'error' });
        console.error("Error fetching calificaciones:", error);
    } finally {
        setIsLoadingData(false);
    }
  };


  // --- FUNCIONES CRUD Y LÓGICA ---
  const handleCalificacionChange = (alumnoId, bimestre, criterioNombre, tareaIndex, valor) => {
    const notaFloat = valor === '' ? null : parseFloat(valor);
    if (notaFloat !== null && (isNaN(notaFloat) || notaFloat < 0 || notaFloat > 10)) return;

    const nuevaEntrada = notaFloat === null ? null : {
      nota: notaFloat,
      fecha: new Date().toISOString()
    };

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

  const calcularPromedioCriterio = (alumnoId, bimestre, criterioNombre) => {
    const tareas = calificaciones[alumnoId]?.[bimestre]?.[criterioNombre] || {};
    const notasValidas = Object.values(tareas)
      .filter(entrada => entrada && typeof entrada.nota === 'number')
      .map(entrada => entrada.nota);
    if (notasValidas.length === 0) return 0;
    const total = notasValidas.reduce((sum, nota) => sum + nota, 0);
    return total / notasValidas.length;
  };

  const calcularPromedioBimestre = (alumnoId, bimestre) => {
    if (criterios.length === 0) return 0;
    let promedioPonderado = 0;
    criterios.forEach(criterio => {
      const promedioCriterio = calcularPromedioCriterio(alumnoId, bimestre, criterio.nombre);
      promedioPonderado += promedioCriterio * (criterio.porcentaje / 100);
    });
    return promedioPonderado.toFixed(2);
  };
  
  const formatFechaTooltip = (fechaISO) => {
    if (!fechaISO) return "Sin calificar";
    try {
      return new Date(fechaISO).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return "Fecha inválida";
    }
  };

  const handleToggleCriterio = (alumnoId, criterioNombre) => {
    const esElMismo = criterioAbierto?.alumnoId === alumnoId && criterioAbierto?.criterioNombre === criterioNombre;
    setCriterioAbierto(esElMismo ? null : { alumnoId, criterioNombre });
  };

  const agregarTareas = (criterioNombre) => {
    setNumTareas(prev => ({ ...prev, [criterioNombre]: (prev[criterioNombre] || 10) + 5 }));
  }

  const guardarCalificaciones = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const payload = {
      grupoId: grupoSeleccionado._id,
      asignatura: asignaturaSeleccionada,
      criterios,
      calificaciones // Objeto con las calificaciones por alumno/bimestre/criterio
    };

    try {
      // 4. PETICIÓN ACTUALIZADA
      await apiClient.post(`/calificaciones`, payload, config);
      setNotificacion({ mensaje: '¡Calificaciones guardadas con éxito!', tipo: 'exito' });
    } catch (error) {
      setNotificacion({ mensaje: error.response?.data?.msg || 'Error al guardar las calificaciones. Inténtalo de nuevo.', tipo: 'error' });
      console.error("Error saving calificaciones:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="grupo-componente"><p>Cargando...</p></div>;
  if (error) return <div className="grupo-componente"><p>{error}</p></div>;
  
  // --- RENDERING ---
  
  const PanelCalificaciones = ({ grupo, asignatura, onVolver, criterios, calificaciones, handleCalificacionChange, calcularPromedioCriterio, calcularPromedioBimestre, agregarTareas, numTareas, criterioAbierto, handleToggleCriterio, guardarCalificaciones, isSaving, setModalCriterios, notificacion, formatFechaTooltip }) => (
    <div className="modal-backdrop-solid">
      <Notificacion
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo}
        onClose={() => setNotificacion({ mensaje: null, tipo: '' })}
      />
      <div className="modal-content asistencia-modal-content">
        <header className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 20px' }}>
          <h2>Calificaciones: {grupo.nombre} - {asignatura}</h2>
          <div>
            <button className="btn" onClick={() => setModalCriterios(true)}>Criterios</button>
            <button className="btn btn-cancel" onClick={onVolver}>Cerrar</button>
          </div>
        </header>
        <div className="bimestre-selector" style={{ padding: '10px 20px' }}>
          {Array.from({ length: 3 }, (_, i) => i + 1).map(bim => (
            <button key={bim} className={`btn ${bimestreActivo === bim ? 'btn-primary' : ''}`} onClick={() => setBimestreActivo(bim)}>
              Bimestre {bim}
            </button>
          ))}
        </div>

        {criterios.length > 0 ? (
          <div className="asistencia-grid">
            <div className="asistencia-body">
              {grupo.alumnos.sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno)).map(alumno => {
                const promedioBim = calcularPromedioBimestre(alumno._id, bimestreActivo);
                const isDesplegado = criterioAbierto?.alumnoId === alumno._id;

                return (
                  <React.Fragment key={alumno._id}>
                    <div className="asistencia-row">
                      <div className="alumno-nombre">{`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}</div>
                      <div className="bimestres-container">
                        {criterios.map(criterio => {
                          const isActivo = isDesplegado && criterioAbierto.criterioNombre === criterio.nombre;
                          return (
                            <div
                              key={criterio.nombre}
                              className={`bimestre-header-btn ${isActivo ? 'activo' : ''}`}
                              onClick={() => handleToggleCriterio(alumno._id, criterio.nombre)}
                            >
                              {criterio.nombre} ({criterio.porcentaje}%)
                            </div>
                          );
                        })}
                      </div>
                      <div className="promedio-final-display" style={{ color: promedioBim >= 6 ? '#28a745' : '#dc3545' }}>
                        Promedio: {promedioBim}
                      </div>
                    </div>
                    <div className={`bimestre-desplegable ${isDesplegado ? 'desplegado' : ''}`}>
                      {isDesplegado && (
                        <>
                          <div className="asistencia-totales">
                            <span>Promedio de "{criterioAbierto.criterioNombre}": </span>
                            <span className="total-presentes">
                              {calcularPromedioCriterio(alumno._id, bimestreActivo, criterioAbierto.criterioNombre).toFixed(2)}
                            </span>
                          </div>
                          <div className="cuadritos-grid">
                            {Array.from({ length: numTareas[criterioAbierto.criterioNombre] || 10 }).map((_, tareaIndex) => {
                              const entrada = calificaciones[alumno._id]?.[bimestreActivo]?.[criterioAbierto.criterioNombre]?.[tareaIndex];
                              return (
                                <input
                                  key={tareaIndex}
                                  type="number"
                                  min="0" max="10" step="0.1"
                                  className="cuadrito-calificacion"
                                  placeholder={String(tareaIndex + 1)}
                                  value={entrada?.nota ?? ''}
                                  title={formatFechaTooltip(entrada?.fecha)}
                                  onChange={(e) => handleCalificacionChange(alumno._id, bimestreActivo, criterioAbierto.criterioNombre, tareaIndex, e.target.value)}
                                />
                              );
                            })}
                            <button className="btn-agregar-dias" onClick={() => agregarTareas(criterioAbierto.criterioNombre)}>+5</button>
                          </div>
                        </>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="aviso-criterios" style={{ padding: '2rem' }}>
            <p>⚠️ Por favor, define los criterios de evaluación para comenzar a calificar.</p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={guardarCalificaciones} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Calificaciones'}
          </button>
        </div>
      </div>
      {/* <ModalCriterios ... /> se debe llamar desde el componente principal */}
    </div>
  );
};

// --- Sub-componente: Lista de Grupos ---
const ListaDeGrupos = ({ grupos, user, onSeleccionarGrupo }) => (
  <>
    <header className="main-header"><h1>Calificar Asignaturas</h1></header>
    <h3 className="subtitulo">SELECCIONA UN GRUPO Y MATERIA PARA CALIFICAR</h3>
    <table className="grupos-table">
      <thead><tr><th>Nombre del Grupo</th><th>Mi Asignatura</th><th>Acciones</th></tr></thead>
      <tbody>
        {grupos.map(grupo => {
          // El profesor puede tener varias asignaturas en el mismo grupo
          const misAsignaciones = grupo.profesoresAsignados.filter(asig => asig.profesor?._id === user.id);
          
          return misAsignaciones.map((asig, index) => (
            <tr key={`${grupo._id}-${asig.asignatura}`}>
              <td data-label="Grupo">{grupo.nombre}</td>
              <td data-label="Mi Asignatura">{asig.asignatura}</td>
              <td className="acciones-cell">
                <button
                  className="btn btn-primary"
                  onClick={() => onSeleccionarGrupo(grupo, asig.asignatura)}
                >
                  Calificar {asig.asignatura}
                </button>
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  </>
);


export default Trabajos;