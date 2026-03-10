import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { FaTrash, FaPencilAlt, FaPlus, FaTimes, FaCheck } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Grupo.css';
import Notificacion from './Notificacion';
import ConfirmacionModal from './ConfirmacionModal';
import logoImage from './Logoescuela.png'; // Asegúrate que esta ruta sea correcta

// --- URL de la API desde variables de entorno para Vercel ---
// CORRECCIÓN: Eliminado '/api' para coincidir con Home.js y la estructura del backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// --- CONSTANTES DE CONFIGURACIÓN ---
const NUM_BIMESTRES = 3;
const DIAS_INICIALES = 30;

function Grupo({ user }) {
  // --- ESTADOS ---
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [materiasDb, setMateriasDb] = useState([]); // NUEVO: Estado para materias globales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', asesor: '', alumnos: [] });
  const [alumnoInput, setAlumnoInput] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', emailPadre: '', telefonoPadre: '' });
  const [asistencia, setAsistencia] = useState({});
  const [diasPorBimestre, setDiasPorBimestre] = useState({});
  const [bimestreAbierto, setBimestreAbierto] = useState({});
  const [bimestreActivo, setBimestreActivo] = useState(1); // NUEVO: Estado global
  const [asignaciones, setAsignaciones] = useState({});
  const [editingAlumno, setEditingAlumno] = useState(null);
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: '' });
  const [grupoParaEliminar, setGrupoParaEliminar] = useState(null);
  const [alumnoParaEliminar, setAlumnoParaEliminar] = useState(null);
  const [archivoXLS, setArchivoXLS] = useState(null);
  const [nombreGrupoImport, setNombreGrupoImport] = useState('');
  const [asignaturaActual, setAsignaturaActual] = useState(null); // Para saber qué asignatura se está evaluando

  // --- LÓGICA DE CARGA DE DATOS ---
  useEffect(() => {
    if (!user) { setLoading(false); setError("Información de usuario no disponible."); return; }

    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setError("No autorizado. Por favor, inicia sesión."); setLoading(false); return; }

      const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };

      try {
        // --- ROBUST SCHOOL ID FETCH ---
        let schoolId = user.school_id;
        if (!schoolId) {
          try {
            const profileRes = await axios.get(`${API_URL}/auth/mi-perfil`, axiosConfig);
            schoolId = profileRes.data.school_id;
          } catch (profileErr) {
            console.error("Error fetching profile for school_id:", profileErr);
          }
        }

        if (!schoolId) {
          setError("Tu cuenta no tiene una institución asignada. Por favor, realiza la REPARACIÓN en la sección de Calificaciones.");
          setLoading(false);
          return;
        }

        if (user.role === 'admin') {
          const [gruposRes, profesoresRes, materiasRes] = await Promise.all([
            axios.get(`${API_URL}/grupos`, axiosConfig),
            axios.get(`${API_URL}/profesores`, axiosConfig),
            axios.get(`${API_URL}/api/materias`, axiosConfig)
          ]);

          // Verificar si el middleware devolvió SCHOOL_REQUIRED
          if (gruposRes.data?.error === "SCHOOL_REQUIRED") {
            setError("SCHOOL_REQUIRED");
            setLoading(false);
            return;
          }

          const sortedGrupos = Array.isArray(gruposRes.data) ? gruposRes.data.sort((a, b) =>
            a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
          ) : [];
          setGrupos(sortedGrupos);
          setProfesores(profesoresRes.data || []);
          setMateriasDb(materiasRes.data || []);
        } else if (user.role === 'profesor') {
          const gruposRes = await axios.get(`${API_URL}/grupos/mis-grupos`, axiosConfig);

          if (gruposRes.data?.error === "SCHOOL_REQUIRED") {
            setError("SCHOOL_REQUIRED");
            setLoading(false);
            return;
          }

          const sortedGrupos = Array.isArray(gruposRes.data) ? gruposRes.data.sort((a, b) =>
            a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
          ) : [];
          setGrupos(sortedGrupos);
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

  // --- LÓGICA DE MODALES Y NOTIFICACIONES ---
  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    setNotificacion({ visible: true, mensaje, tipo });
  };

  const abrirModal = async (tipo, data = null, asignatura = null) => {
    if (tipo === 'gestionarGrupo') {
      setGrupoSeleccionado(data);
      if (data) { setNuevoGrupo(structuredClone(data)); }
      else { setNuevoGrupo({ nombre: '', asesor: '', alumnos: [] }); }
      setModalVisible('gestionarGrupo');
    } else if (tipo === 'asignar') {
      setGrupoSeleccionado(data);
      const asignacionesIniciales = {};
      // Agrupar asignaturas por profesor
      data.profesoresAsignados.forEach(asig => {
        // CORRECCIÓN: Manejar tanto objetos poblados como IDs directos
        const assignedId = asig.profesor?.id || asig.profesor?._id || asig.profesor;
        if (assignedId) {
          const profId = String(assignedId);
          if (!asignacionesIniciales[profId]) {
            asignacionesIniciales[profId] = [];
          }
          asignacionesIniciales[profId].push(asig.asignatura);
        }
      });
      setAsignaciones(asignacionesIniciales);
      setModalVisible('asignar');
    } else if (tipo === 'asistencia') {
      setGrupoSeleccionado(data);
      setAsignaturaActual(asignatura); // Guardar la asignatura actual

      // Validar que el usuario tenga asignada esa materia (doble check)
      // Validar que el usuario tenga asignada esa materia (doble check)
      const misAsignaciones = data.profesoresAsignados.filter(asig => {
        const assignedId = asig.profesor?.id || asig.profesor?._id || asig.profesor;
        const idMatch = String(assignedId) === String(user.id);

        const assignedEmail = asig.profesor?.email;
        const emailMatch = assignedEmail && user.email && (assignedEmail === user.email);

        return idMatch || emailMatch;
      });

      const tieneAsignatura = misAsignaciones.some(a => a.asignatura === asignatura);

      if (!tieneAsignatura) {
        return mostrarNotificacion("No tienes asignada esta materia para este grupo.", "error");
      }

      try {
        const res = await axios.get(`${API_URL}/asistencia?grupoId=${data._id}&asignatura=${asignatura}`, getAxiosConfig());
        const asistenciaData = res.data;
        if (asistenciaData) {
          setAsistencia(asistenciaData.registros || {});
          const counts = {};
          for (let i = 1; i <= NUM_BIMESTRES; i++) {
            counts[i] = asistenciaData.diasPorBimestre?.[i] || DIAS_INICIALES;
          }
          setDiasPorBimestre(counts);
        } else {
          setAsistencia({});
          const counts = {};
          for (let i = 1; i <= NUM_BIMESTRES; i++) {
            counts[i] = DIAS_INICIALES;
          }
          setDiasPorBimestre(counts);
        }
        setModalVisible('asistencia');
      } catch (error) {
        mostrarNotificacion("Error al cargar datos de asistencia.", "error");
      }
    } else if (tipo === 'editarAlumno') {
      setEditingAlumno(data);
      setAlumnoInput({
        nombre: data.nombre,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno || '',
        emailPadre: data.emailPadre || '',
        telefonoPadre: data.telefonoPadre || ''
      });
      setModalVisible('editarAlumno');
    } else if (tipo === 'importar') {
      setModalVisible('importar');
    }
  };

  const cerrarModal = () => {
    setModalVisible(null);
    setGrupoSeleccionado(null);
    setNuevoGrupo({ nombre: '', asesor: '', alumnos: [] });
    setAlumnoInput({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', emailPadre: '' });
    setBimestreAbierto({});
    setAsignaciones({});
    setEditingAlumno(null);
    setArchivoXLS(null);
    setNombreGrupoImport('');
    setAsignaturaActual(null);
  };

  // --- FUNCIONES CRUD Y LÓGICA ---
  const getAxiosConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const handleAgregarAlumno = () => {
    if (!alumnoInput.nombre.trim() || !alumnoInput.apellidoPaterno.trim()) {
      return mostrarNotificacion('Nombre y Apellido Paterno son obligatorios.', 'error');
    }
    const alumnoId = `new-${Date.now()}`;
    const nuevoAlumno = { _id: alumnoId, ...alumnoInput };
    setNuevoGrupo(prev => ({ ...prev, alumnos: [...prev.alumnos, nuevoAlumno].sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno)) }));
    setAlumnoInput({ nombre: '', apellidoPaterno: '', apellidoMaterno: '', emailPadre: '' });
  };

  const handleUpdateAlumno = () => {
    if (!editingAlumno) return;
    setNuevoGrupo(prev => ({
      ...prev,
      alumnos: prev.alumnos.map(a => a._id === editingAlumno._id ? { ...a, ...alumnoInput } : a).sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno))
    }));
    setModalVisible('gestionarGrupo');
    setEditingAlumno(null);
    mostrarNotificacion("Alumno actualizado correctamente.");
  };

  const handleDeleteAlumno = (alumno) => {
    setAlumnoParaEliminar(alumno);
  };

  const confirmarEliminacionAlumno = () => {
    if (!alumnoParaEliminar) return;
    setNuevoGrupo(prev => ({ ...prev, alumnos: prev.alumnos.filter(a => a._id !== alumnoParaEliminar._id) }));
    setAlumnoParaEliminar(null);
    mostrarNotificacion("Alumno eliminado de la lista.");
  };

  const handleGuardarGrupo = async () => {
    if (!nuevoGrupo.nombre.trim()) return mostrarNotificacion("El nombre del grupo es requerido.", 'error');
    try {
      const response = await axios.post(`${API_URL}/grupos`, nuevoGrupo, getAxiosConfig());
      setGrupos(prev => [...prev, response.data]);
      mostrarNotificacion(`Grupo "${nuevoGrupo.nombre}" guardado.`);
      cerrarModal();
    } catch (error) {
      console.error("Error al guardar grupo:", error);
      mostrarNotificacion(error.response?.data?.error || error.message || 'Error al guardar.', 'error');
    }
  };

  const handleUpdateGrupo = async () => {
    if (!grupoSeleccionado) return;
    try {
      const response = await axios.put(`${API_URL}/grupos/${grupoSeleccionado._id}`, nuevoGrupo, getAxiosConfig());
      setGrupos(prev => prev.map(g => g._id === grupoSeleccionado._id ? response.data : g));
      mostrarNotificacion(`Grupo "${nuevoGrupo.nombre}" actualizado.`);
      cerrarModal();
    } catch (error) {
      console.error("Error al actualizar grupo:", error);
      mostrarNotificacion(error.response?.data?.error || error.message || 'Error al actualizar.', 'error');
    }
  };

  const handleGuardarAsignacion = async () => {
    if (!grupoSeleccionado) return;

    // Aplanar el objeto de asignaciones a un array de objetos { profesor, asignatura }
    const asignacionesParaEnviar = [];
    Object.keys(asignaciones).forEach(profesorId => {
      const materias = asignaciones[profesorId];
      if (Array.isArray(materias)) {
        materias.forEach(materia => {
          if (materia) {
            asignacionesParaEnviar.push({
              profesor: profesorId,
              asignatura: materia
            });
          }
        });
      }
    });

    try {
      const response = await axios.put(`${API_URL}/grupos/${grupoSeleccionado._id}/asignar-profesores`, { asignaciones: asignacionesParaEnviar }, getAxiosConfig());
      setGrupos(grupos.map(g => g._id === grupoSeleccionado._id ? response.data : g));
      mostrarNotificacion("Asignación guardada.");
      cerrarModal();
    } catch (error) {
      mostrarNotificacion("Error al guardar la asignación.", 'error');
    }
  };

  const handleEliminarGrupo = (grupo) => setGrupoParaEliminar(grupo);

  const confirmarEliminacionGrupo = async () => {
    if (!grupoParaEliminar) return;
    try {
      await axios.delete(`${API_URL}/grupos/${grupoParaEliminar._id}`, getAxiosConfig());
      setGrupos(grupos.filter(g => g._id !== grupoParaEliminar._id));
      mostrarNotificacion(`Grupo "${grupoParaEliminar.nombre}" eliminado.`);
    } catch (error) {
      mostrarNotificacion(error.response?.data?.error || 'Error al eliminar.', 'error');
    } finally {
      setGrupoParaEliminar(null);
    }
  };

  const exportarXLS = (grupo) => {
    if (!grupo || !grupo.alumnos || grupo.alumnos.length === 0) return mostrarNotificacion("Este grupo no tiene alumnos para exportar.", "error");

    const alumnosOrdenados = [...grupo.alumnos].sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));

    const datosParaExportar = alumnosOrdenados.map((a, i) => ({
      'N°': i + 1,
      'Nombre(s)': a.nombre,
      'Apellido Paterno': a.apellidoPaterno,
      'Apellido Materno': a.apellidoMaterno || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');
    worksheet['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 25 }, { wch: 25 }];
    XLSX.writeFile(workbook, `Lista_${grupo.nombre.replace(/ /g, '_')}.xlsx`);
  };

  const handleMarcarAsistencia = (alumnoId, bimestre, diaIndex) => {
    const key = `${alumnoId}-b${bimestre}-d${diaIndex}`;
    const estados = ['', 'P', 'F', 'J', 'R']; // NUEVO: Incluye 'R' (Retardo)
    const estadoActual = asistencia[key]?.estado || '';
    const siguienteEstadoIndex = (estados.indexOf(estadoActual) + 1) % estados.length;
    const nuevoEstado = estados[siguienteEstadoIndex];

    setAsistencia(prev => {
      const newState = { ...prev };
      if (nuevoEstado) {
        newState[key] = {
          estado: nuevoEstado,
          fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        };
      } else {
        delete newState[key];
      }
      return newState;
    });
  };

  const agregarDias = (bimestre) => {
    setDiasPorBimestre(prev => ({ ...prev, [bimestre]: (prev[bimestre] || DIAS_INICIALES) + 5 }));
  };

  const guardarAsistencia = async () => {
    if (!grupoSeleccionado || !asignaturaActual) return;

    try {
      await axios.put(`${API_URL}/asistencia`, {
        grupoId: grupoSeleccionado._id,
        asignatura: asignaturaActual,
        registros: asistencia,
        diasPorBimestre
      }, getAxiosConfig());

      mostrarNotificacion("Asistencia guardada exitosamente.");
      cerrarModal();
    } catch (error) {
      mostrarNotificacion("Error al guardar la asistencia.", 'error');
    }
  };

  // 🌟 ESTADO Y HANDLERS PARA TOOLTIP DE FECHA EDITABLE
  const [hoveredCell, setHoveredCell] = useState(null); // { alumnoId, bimestre, diaIndex, x, y }
  const [editingDate, setEditingDate] = useState(null); // { alumnoId, bimestre, diaIndex, fecha }
  // const closeTooltipTimer = useRef(null); // YA NO SE USA TIMER

  // Efecto para cerrar al dar click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Si el click NO es en el tooltip Y NO es en un cuadrito (para evitar cerrar al cambiar de celda)
      if (hoveredCell && !event.target.closest('.custom-tooltip') && !event.target.closest('.cuadrito')) {
        setHoveredCell(null);
        setEditingDate(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [hoveredCell]);

  const handleMouseEnterCell = (e, alumnoId, bimestre, diaIndex, fecha) => {
    if (!fecha) return; // Solo mostrar si hay fecha (celda con asistencia)

    const rect = e.target.getBoundingClientRect();
    setHoveredCell({
      alumnoId,
      bimestre,
      diaIndex,
      fecha,
      x: rect.left + window.scrollX + (rect.width / 2),
      y: rect.top + window.scrollY // Justo en el borde superior
    });
  };

  const handleMouseLeaveCell = () => {
    // YA NO CERRAMOS AL SALIR DEL MOUSE
    // El usuario pidió que se quede hasta dar click fuera
  };

  const handleMouseEnterTooltip = () => {
    // No action needed
  };

  const handleMouseLeaveTooltip = () => {
    // No action needed
  };

  const handleEditDateClick = () => {
    if (hoveredCell) {
      // Convertir fecha 'DD/MM/YYYY' a 'YYYY-MM-DD' para el input date
      const parts = hoveredCell.fecha.split('/');
      // Asumiendo formato DD/MM/YYYY o DD/MMM/YYYY. 
      // Si es DD/MMM/YYYY (ej: 03/dic/2025), necesitamos mapear meses.
      // La función actual usa 'short' para mes: 'dic', 'ene', etc.
      // Simplificación: Usaremos un input texto o date. Si es date, necesitamos parsear bien.
      // Dado que guardamos como string locale, mejor editamos como tal o intentamos parsear.
      // Para simplificar y evitar problemas de locale, usaremos un input date standard y al guardar formateamos igual.

      // Intentar parsear la fecha actual del tooltip
      // El formato guardado es: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      // Ej: "03 dic 2025" (depende del navegador/OS).
      // Para edición robusta, mejor guardar ISO en paralelo o simplemente permitir cambiarla a HOY u otra fecha.
      // Vamos a usar un input date vacio por defecto o intentar aproximar.

      setEditingDate({ ...hoveredCell, nuevaFecha: '' });
    }
  };

  const handleUpdateFecha = (nuevaFechaISO) => {
    if (!editingDate || !nuevaFechaISO) return;

    // Formatear la nueva fecha al estilo visual deseado
    const [year, month, day] = nuevaFechaISO.split('-');
    const dateObj = new Date(year, month - 1, day);
    const fechaFormateada = dateObj.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

    const key = `${editingDate.alumnoId}-b${editingDate.bimestre}-d${editingDate.diaIndex}`;

    setAsistencia(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        fecha: fechaFormateada
      }
    }));

    setEditingDate(null);
    setHoveredCell(null); // Cerrar tooltip
  };
  const handleToggleBimestre = (alumnoId, bimIndex) => {
    setBimestreAbierto(prev => ({ [alumnoId]: prev[alumnoId] === bimIndex ? null : bimIndex }));
  };

  const calcularTotales = useMemo(() => (alumnoId, bimestre, asistenciaData, diasData) => {
    let presentes = 0;
    let faltas = 0;
    let justificados = 0;
    let retardos = 0; // NUEVO
    const diasDelBimestre = (diasData || diasPorBimestre)[bimestre] || DIAS_INICIALES;
    for (let i = 1; i <= diasDelBimestre; i++) {
      const key = `${alumnoId}-b${bimestre}-d${i}`;
      const registro = (asistenciaData || asistencia)[key];
      if (registro?.estado === 'P' || registro?.estado === 'J') presentes++; // P y J cuentan como asistencia
      if (registro?.estado === 'R') { presentes++; retardos++; } // Ajuste: Retardo 'R' cuenta como asistencia (Presente) y se suma a Retardos.
      if (registro?.estado === 'F') faltas++;
      if (registro?.estado === 'J') justificados++;
    }
    return { presentes, faltas, justificados, retardos };
  }, [asistencia, diasPorBimestre]);

  const handleAddAsignatura = (profesorId, nuevaAsignatura) => {
    console.log("Adding asignatura:", { profesorId, nuevaAsignatura }); // DEBUG LOG
    if (!nuevaAsignatura) return;

    setAsignaciones(prev => {
      const current = prev[profesorId] || [];
      if (current.includes(nuevaAsignatura)) {
        console.warn("Materia ya asignada:", nuevaAsignatura);
        return prev;
      }
      const newState = { ...prev, [profesorId]: [...current, nuevaAsignatura] };
      console.log("New asignaciones state:", newState);
      return newState;
    });
  };

  const handleRemoveAsignatura = (profesorId, asignaturaToRemove) => {
    setAsignaciones(prev => {
      const current = prev[profesorId] || [];
      const updated = current.filter(a => a !== asignaturaToRemove);
      if (updated.length === 0) {
        const newState = { ...prev };
        delete newState[profesorId];
        return newState;
      }
      return { ...prev, [profesorId]: updated };
    });
  };

  const handleFileChange = (e) => {
    setArchivoXLS(e.target.files[0]);
  };

  const handleImportarAlumnos = () => {
    if (!nombreGrupoImport.trim()) {
      return mostrarNotificacion('Por favor, ingresa un nombre para el grupo.', 'error');
    }
    if (!archivoXLS) {
      return mostrarNotificacion('Por favor, selecciona un archivo XLS.', 'error');
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const alumnosImportados = json.slice(1).map(row => ({
          nombre: row[1] || '',
          apellidoPaterno: row[2] || '',
          apellidoMaterno: row[3] || '',
        })).filter(a => a.nombre && a.apellidoPaterno);

        if (alumnosImportados.length === 0) {
          return mostrarNotificacion('No se encontraron alumnos válidos en el archivo. Asegúrate de que las columnas son: N°, Nombre(s), Apellido Paterno, Apellido Materno.', 'error');
        }
        const grupoParaGuardar = { nombre: nombreGrupoImport, alumnos: alumnosImportados };

        const response = await axios.post(`${API_URL}/grupos`, grupoParaGuardar, getAxiosConfig());
        setGrupos(prev => [...prev, response.data]);
        mostrarNotificacion(`Grupo "${nombreGrupoImport}" importado con ${alumnosImportados.length} alumnos.`);
        cerrarModal();
      } catch (error) {
        console.error("Error al importar archivo:", error);
        mostrarNotificacion('Hubo un error al procesar el archivo.', 'error');
      }
    };
    reader.readAsBinaryString(archivoXLS);
  };

  // ... código anterior (imports, estados, etc.)

  const generarPDF = async (grupo, asignatura) => {
    if (!asignatura) {
      return mostrarNotificacion("No se especificó la asignatura para el PDF.", "error");
    }

    try {
      const res = await axios.get(`${API_URL}/asistencia?grupoId=${grupo._id}&asignatura=${asignatura}`, getAxiosConfig());
      const asistenciaData = res.data?.registros || {};
      const diasData = res.data?.diasPorBimestre || {};

      const doc = new jsPDF();

      // --- INICIO DE CAMBIOS PARA LOGO Y ESTILOS ---
      const img = new Image();
      img.src = logoImage;
      await img.decode(); // Esperar a que la imagen se cargue

      const logoWidth = 25; // Ancho del logo en mm
      const logoHeight = (img.height * logoWidth) / img.width; // Calcular altura para mantener proporción
      const margin = 14;
      const pageWidth = doc.internal.pageSize.width;

      doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

      doc.setFontSize(12);

      // 1. Inicializar la posición Y
      let yPos = margin + 5;

      // 2. Primera línea: Escuela
      doc.text('Escuela Secundaria No. 9 "Amado Nervo"', margin, yPos);

      // 3. Aumentar la posición Y para la siguiente línea (menos que 10 para evitar superposición con el logo)
      yPos += 7;

      // 4. Segunda línea: Reporte de Asistencia (ahora está en 'yPos')
      doc.text(`Reporte de Asistencia - Grupo: ${grupo.nombre}`, margin, yPos);

      // 5. Aumentar la posición Y para la siguiente línea
      yPos += 7; // Usar 7mm entre líneas para mantenerlas juntas

      // 6. Tercera línea: Asignatura (ahora está en 'yPos')
      doc.text(`Asignatura: ${asignatura}`, margin, yPos);

      // 7. AUMENTO CLAVE: Añadir un espacio adicional (e.g., 7mm) para que el texto NO toque la tabla.
      yPos += 7; // Espacio entre el texto de "Asignatura" y el inicio de la tabla

      const head = [
        [
          { content: 'Nombre Completo', rowSpan: 2, styles: { fillColor: [212, 175, 55] } },
          { content: 'Trimestre 1', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
          { content: 'Trimestre 2', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
          { content: 'Trimestre 3', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
        ],
        [
          { content: 'Asist.', styles: { fillColor: [40, 167, 69] } }, // Verde
          { content: 'Faltas', styles: { fillColor: [220, 53, 69] } }, // Rojo
          { content: 'Asist.', styles: { fillColor: [40, 167, 69] } },
          { content: 'Faltas', styles: { fillColor: [220, 53, 69] } },
          { content: 'Asist.', styles: { fillColor: [40, 167, 69] } },
          { content: 'Faltas', styles: { fillColor: [220, 53, 69] } },
        ]
      ];

      const tableRows = [];
      const alumnosOrdenados = [...grupo.alumnos].sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));

      alumnosOrdenados.forEach(alumno => {
        const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;
        const totalesBim1 = calcularTotales(alumno._id, 1, asistenciaData, diasData);
        const totalesBim2 = calcularTotales(alumno._id, 2, asistenciaData, diasData);
        const totalesBim3 = calcularTotales(alumno._id, 3, asistenciaData, diasData);

        const alumnoData = [
          nombreCompleto,
          totalesBim1.presentes,
          totalesBim1.faltas,
          totalesBim2.presentes,
          totalesBim2.faltas,
          totalesBim3.presentes,
          totalesBim3.faltas,
        ];
        tableRows.push(alumnoData);
      });

      autoTable(doc, {
        head: head,
        body: tableRows,
        // *** CORRECCIÓN CLAVE: Usar la posición Y calculada con el espacio extra. ***
        startY: yPos,
        headStyles: {
          halign: 'center',
          valign: 'middle',
          textColor: [255, 255, 255], // Letra blanca para que resalte
          lineWidth: 0.1,
          lineColor: [255, 255, 255]
        },
        styles: {
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'left' }
        }
      });
      // --- FIN DE CAMBIOS ---

      doc.save(`Asistencia_${grupo.nombre.replace(/ /g, '_')}_${asignatura.replace(/ /g, '_')}.pdf`);
      mostrarNotificacion("PDF generado exitosamente.");

    } catch (error) {
      console.error("Error al generar PDF:", error);
      mostrarNotificacion("Error al cargar los datos de asistencia para el PDF.", "error");
    }
  };

  // ... resto del componente (handleAsignacionChange, handleFileChange, etc.)

  if (loading) return (
    <div className="grupo-componente" style={{ paddingTop: '100px', textAlign: 'center' }}>
      <p className="loading-message">Cargando...</p>
    </div>
  );

  if (error) {
    if (error === "SCHOOL_REQUIRED") {
      return (
        <div className="grupo-componente" style={{ padding: '50px', textAlign: 'center' }}>
          <div className="card shadow p-5" style={{ maxWidth: '600px', margin: 'auto' }}>
            <h2 className="text-warning">Configuración Requerida</h2>
            <p>Para acceder a la gestión de grupos, primero debes inicializar tu institución.</p>
            <p className="small text-muted">Ve a la sección de <strong>Calificaciones</strong> y usa el botón de reparación.</p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/calificaciones'}>
              Ir a Calificaciones
            </button>
          </div>
        </div>
      );
    }
    return <div className="grupo-componente"><p className="error-message">{error}</p></div>;
  }
  if (!user) return <div className="grupo-componente"><p className="error-message">No se puede mostrar la información.</p></div>;

  return (
    <div className="grupo-componente">
      {notificacion.visible && <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} onClose={() => setNotificacion({ visible: false })} />}
      <ConfirmacionModal isOpen={!!grupoParaEliminar} onClose={() => setGrupoParaEliminar(null)} onConfirm={confirmarEliminacionGrupo} mensaje={`¿Seguro que deseas eliminar el grupo "${grupoParaEliminar?.nombre}"?`} />
      <ConfirmacionModal isOpen={!!alumnoParaEliminar} onClose={() => setAlumnoParaEliminar(null)} onConfirm={confirmarEliminacionAlumno} mensaje={`¿Seguro que deseas eliminar al alumno "${alumnoParaEliminar?.nombre}" de la lista?`} />

      <div className="page-container">
        {user.role === 'admin' && (
          <div className="admin-view">
            <header className="main-header">
              <h1>Gestión de Grupos</h1>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => abrirModal('gestionarGrupo')}>Crear Grupo</button>
                <button className="btn btn-secondary" onClick={() => abrirModal('importar')}>Importar Alumnos XLS</button>
              </div>
            </header>
            <h3 className="subtitulo">TODOS LOS GRUPOS EXISTENTES</h3>
            <table className="grupos-table">
              <thead>
                <tr>
                  <th>Nombre del Grupo</th>
                  <th>Asesor</th>
                  <th>N° Alumnos</th>
                  <th>Profesores y Asignaturas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => (
                  <tr key={grupo._id}>
                    <td data-label="Grupo">{grupo.nombre}</td>
                    <td data-label="Asesor">{grupo.asesor || 'Sin Asignar'}</td>
                    <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                    <td data-label="Asignaciones">
                      {grupo.profesoresAsignados && grupo.profesoresAsignados.length > 0
                        ? <ul className="asignacion-lista">
                          {[...grupo.profesoresAsignados]
                            .sort((a, b) => a.asignatura.localeCompare(b.asignatura))
                            .map((asig, index) => (
                              <li key={index}>
                                {asig.profesor?.nombre || 'Profesor Eliminado'}
                                <span className="asignatura-text"> - {asig.asignatura}</span>
                              </li>
                            ))}
                        </ul>
                        : 'Sin asignar'}
                    </td>
                    <td className="acciones-cell">
                      <button className="btn btn-warning" onClick={() => abrirModal('gestionarGrupo', grupo)}>Editar</button>
                      <button className="btn btn-secondary" onClick={() => abrirModal('asignar', grupo)}>Asignar</button>
                      <button className="btn btn-export" onClick={() => exportarXLS(grupo)}>XLS</button>
                      <button className="btn btn-danger" onClick={() => handleEliminarGrupo(grupo)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {user.role === 'profesor' && (
          <div className="profesor-view">
            <header className="main-header"><h1>Mis Grupos Asignados</h1></header>
            <table className="grupos-table">
              <thead>
                <tr>
                  <th>Nombre del Grupo</th>
                  <th>N° Alumnos</th>
                  <th>Mi Asignatura</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.flatMap(grupo => {
                  // Filtrar todas las asignaciones para este profesor
                  // Filtrar todas las asignaciones para este profesor
                  const misAsignaciones = grupo.profesoresAsignados.filter(asig => {
                    const assignedId = asig.profesor?.id || asig.profesor?._id || asig.profesor;
                    const idMatch = String(assignedId) === String(user.id);

                    const assignedEmail = asig.profesor?.email;
                    const emailMatch = assignedEmail && user.email && (assignedEmail === user.email);

                    return idMatch || emailMatch;
                  });

                  // Retornar una fila por cada asignatura asignada
                  return misAsignaciones.map((asignacion, index) => (
                    <tr key={`${grupo._id}-${index}`}>
                      <td data-label="Grupo">{grupo.nombre}</td>
                      <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                      <td data-label="Mi Asignatura">{asignacion.asignatura}</td>
                      <td className="acciones-cell">
                        <button className="btn btn-primary" onClick={() => abrirModal('asistencia', grupo, asignacion.asignatura)}>Tomar Asistencia</button>
                        <button className="btn btn-export" onClick={() => generarPDF(grupo, asignacion.asignatura)}>PDF</button>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
        {(modalVisible === 'gestionarGrupo') && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>{grupoSeleccionado ? 'Editar Grupo' : 'Crear Nuevo Grupo'}</h2>
              <div className="modal-body-grid">
                <div className="modal-column-left">
                  <input type="text" placeholder="Nombre del Grupo (Ej: 1A)" value={nuevoGrupo.nombre} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value })} style={{ marginBottom: '10px' }} />
                  <input type="text" placeholder="Nombre del Asesor (Opcional)" value={nuevoGrupo.asesor || ''} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, asesor: e.target.value })} />
                  <div className="alumno-form">
                    <h4 className="form-subtitle">Agregar Nuevo Alumno</h4>
                    <div className="alumno-form-inputs">
                      <input type="text" placeholder="Nombre(s)" value={alumnoInput.nombre} onChange={(e) => setAlumnoInput({ ...alumnoInput, nombre: e.target.value })} />
                      <input type="text" placeholder="Apellido Paterno" value={alumnoInput.apellidoPaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoPaterno: e.target.value })} />
                      <input type="text" placeholder="Apellido Materno" value={alumnoInput.apellidoMaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoMaterno: e.target.value })} />
                      <input type="email" placeholder="Correo del Padre/Alumno" value={alumnoInput.emailPadre} onChange={(e) => setAlumnoInput({ ...alumnoInput, emailPadre: e.target.value })} />
                      <input type="text" placeholder="Teléfono (Opcional)" value={alumnoInput.telefonoPadre || ''} onChange={(e) => setAlumnoInput({ ...alumnoInput, telefonoPadre: e.target.value })} />
                    </div>
                    <div className="alumno-form-actions">
                      <button className="btn btn-add" onClick={handleAgregarAlumno}>Agregar Alumno</button>
                    </div>
                  </div>
                </div>

                <div className="modal-column-right">
                  <div className="alumnos-list">
                    <div className="alumnos-count-header">Alumnos en el grupo: {nuevoGrupo.alumnos.length}</div>
                    <ul>
                      {nuevoGrupo.alumnos.map((a, index) => (
                        <li key={a._id}>
                          <span className="alumno-nombre-display">
                            <strong>{a.matricula || '---'}</strong> - {`${index + 1}. ${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`}
                            <br />
                            <small style={{ color: '#666' }}>{a.emailPadre || 'Sin correo'} | {a.telefonoPadre || 'Sin tel'}</small>
                          </span>
                          <div className="alumno-actions">
                            <button className="btn-edit-alumno" onClick={() => abrirModal('editarAlumno', a)}><FaPencilAlt /></button>
                            <button className="btn-delete-alumno" onClick={() => handleDeleteAlumno(a)}><FaTrash /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={grupoSeleccionado ? handleUpdateGrupo : handleGuardarGrupo}>
                  {grupoSeleccionado ? 'Guardar Cambios' : 'Guardar Grupo'}
                </button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {modalVisible === 'editarAlumno' && (
          <div className="modal-backdrop">
            <div className="modal-content modal-sm">
              <h2>Editar Alumno</h2>
              <div className="alumno-form">
                <div className="alumno-form-inputs">
                  <input type="text" placeholder="Nombre(s)" value={alumnoInput.nombre} onChange={(e) => setAlumnoInput({ ...alumnoInput, nombre: e.target.value })} />
                  <input type="text" placeholder="Apellido Paterno" value={alumnoInput.apellidoPaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoPaterno: e.target.value })} />
                  <input type="text" placeholder="Apellido Materno" value={alumnoInput.apellidoMaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoMaterno: e.target.value })} />
                  <input type="email" placeholder="Correo del Padre/Alumno" value={alumnoInput.emailPadre} onChange={(e) => setAlumnoInput({ ...alumnoInput, emailPadre: e.target.value })} />
                  <input type="text" placeholder="Teléfono del Padre (Opcional)" value={alumnoInput.telefonoPadre || ''} onChange={(e) => setAlumnoInput({ ...alumnoInput, telefonoPadre: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleUpdateAlumno}>Actualizar</button>
                <button className="btn btn-cancel" onClick={() => { setModalVisible('gestionarGrupo'); setEditingAlumno(null); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {modalVisible === 'asignar' && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>Asignar Profesores a "{grupoSeleccionado?.nombre}"</h2>
              <div className="profesores-list">
                {profesores.map((profesor, index) => {
                  if (!profesor) return null;
                  // Use id (from toJSON) or _id, otherwise fallback
                  const pId = profesor.id || profesor._id;
                  const profId = pId ? String(pId) : `unknown-${index}`;

                  return (
                    <div key={profId} className="asignacion-row-container">
                      <div className="profesor-header">
                        <strong>{profesor.nombre || 'Sin Nombre'}</strong>
                      </div>
                      <div className="asignaturas-asignadas">
                        {asignaciones[profId] && asignaciones[profId]
                          .map((asig, idx) => (
                            <div key={idx} className="asignatura-tag">
                              {asig}
                              <button className="btn-remove-tag" onClick={() => handleRemoveAsignatura(profId, asig)}><FaTimes /></button>
                            </div>
                          ))}
                      </div>
                      <div className="add-asignatura-container">
                        <select
                          className="asignatura-select-add"
                          onChange={(e) => {
                            handleAddAsignatura(profId, e.target.value);
                            // e.target.value = ""; // No need with controlled comp
                          }}
                          value=""
                        >
                          <option value="" disabled>Agregar asignatura...</option>
                          {/* REVERTIDO: Solo mostrar las materias asignadas al perfil del profesor seleccionado */}
                          {profesor.asignaturas && profesor.asignaturas.length > 0 ? (
                            profesor.asignaturas
                              .map(asig => (
                                <option key={asig} value={asig}>{asig}</option>
                              ))
                          ) : (
                            <option disabled>Este profesor no tiene materias asignadas</option>
                          )}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleGuardarAsignacion}>Guardar Cambios</button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
        {modalVisible === 'asistencia' && (
          <div className="modal-backdrop">
            <div className="modal-content asistencia-modal-content">
              <h2>Toma de Asistencia: {grupoSeleccionado?.nombre} - {asignaturaActual}</h2>

              {/* NUEVO: Selector de Trimestre Global */}
              <div className="bimestre-selector">
                {[1, 2, 3].map(bim => (
                  <button
                    key={bim}
                    className={`btn ${bimestreActivo === bim ? 'btn-primary' : 'btn-cancel'}`}
                    onClick={() => setBimestreActivo(bim)}
                  >
                    Trimestre {bim}
                  </button>
                ))}
              </div>

              <div className="asistencia-grid">
                <div className="tabla-global-container" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  <table className="tabla-global">
                    <thead>
                      <tr>
                        <th className="num-col" style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}>#</th>
                        <th className="matricula-col" style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}>ID</th>
                        <th className="alumno-col" style={{ width: '250px', minWidth: '250px' }}>Alumno</th>
                        <th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Totales</th>
                        {Array.from({ length: diasPorBimestre[bimestreActivo] || DIAS_INICIALES }).map((_, i) => (
                          <th key={i} style={{ width: '30px', minWidth: '30px', textAlign: 'center', fontSize: '0.8rem' }}>{i + 1}</th>
                        ))}
                        <th style={{ width: '40px', minWidth: '40px' }}>
                          <button className="btn-agregar-dias" onClick={() => agregarDias(bimestreActivo)} title="Agregar días">+5</button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupoSeleccionado?.alumnos.sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno)).map((alumno, index) => {
                        const totales = calcularTotales(alumno._id, bimestreActivo, asistencia, diasPorBimestre);
                        return (
                          <tr key={alumno._id}>
                            <td className="num-col" style={{ textAlign: 'center' }}>{index + 1}</td>
                            <td className="matricula-col" style={{ textAlign: 'center', fontWeight: 'bold' }}>{alumno.matricula || '---'}</td>
                            <td className="alumno-col">
                              {alumno.apellidoPaterno} {alumno.apellidoMaterno || ''} {alumno.nombre}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: 'var(--success-color)' }}>✅ {totales.presentes}</span>
                                <span style={{ color: 'var(--danger-color)' }}>❌ {totales.faltas}</span>
                                <span style={{ color: 'var(--warning-color)' }}>⚠️ {totales.justificados}</span>
                                <span style={{ color: '#ff9800' }}>🕒 {totales.retardos}</span>
                              </div>
                            </td>
                            {Array.from({ length: diasPorBimestre[bimestreActivo] || DIAS_INICIALES }).map((_, diaIndex) => {
                              const key = `${alumno._id}-b${bimestreActivo}-d${diaIndex + 1}`;
                              const registro = asistencia[key];
                              return (
                                <td key={diaIndex} style={{ padding: '2px', textAlign: 'center' }}>
                                  <div
                                    className={`cuadrito estado-${registro?.estado.toLowerCase() || ''}`}
                                    style={{ margin: '0 auto' }}
                                    onClick={() => handleMarcarAsistencia(alumno._id, bimestreActivo, diaIndex + 1)}
                                    onMouseEnter={(e) => handleMouseEnterCell(e, alumno._id, bimestreActivo, diaIndex + 1, registro?.fecha)}
                                    onMouseLeave={handleMouseLeaveCell}
                                  >
                                    {registro?.estado || ''}
                                  </div>
                                </td>
                              );
                            })}
                            <td></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 🌟 RENDERIZADO DEL TOOLTIP PERSONALIZADO */}
                {hoveredCell && (
                  <div
                    className="custom-tooltip"
                    style={{
                      top: hoveredCell.y - 50, // Mucho más arriba (encima del nombre)
                      left: hoveredCell.x - 20,
                      transform: 'translateX(-50%) translateY(-100%)',
                      zIndex: 3000
                    }}
                    onMouseEnter={handleMouseEnterTooltip}
                    onMouseLeave={handleMouseLeaveTooltip}
                  >
                    {editingDate && editingDate.alumnoId === hoveredCell.alumnoId && editingDate.diaIndex === hoveredCell.diaIndex ? (
                      <div className="edit-date-container">
                        <input
                          type="date"
                          className="edit-date-input"
                          autoFocus
                          onChange={(e) => setEditingDate({ ...editingDate, nuevaFecha: e.target.value })}
                        />
                        <button className="btn-save-date" onClick={() => handleUpdateFecha(editingDate.nuevaFecha)}>
                          <FaCheck />
                        </button>
                        <button className="btn-save-date" style={{ color: '#d32f2f' }} onClick={() => { setEditingDate(null); setHoveredCell(null); }}>
                          <FaTimes />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="tooltip-date-text">{hoveredCell.fecha}</span>
                        <button className="btn-edit-date" onClick={handleEditDateClick}>
                          <FaPencilAlt />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={guardarAsistencia}>Guardar Asistencia</button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
        {modalVisible === 'importar' && (
          <div className="modal-backdrop">
            <div className="modal-content modal-sm">
              <h2>Importar Grupo desde XLS</h2>
              <div className="import-form">
                <input
                  type="text"
                  placeholder="Nombre del nuevo grupo"
                  value={nombreGrupoImport}
                  onChange={(e) => setNombreGrupoImport(e.target.value)}
                />
                <label htmlFor="xls-file-input" className="file-input-label">
                  {archivoXLS ? archivoXLS.name : 'Seleccionar archivo .xls o .xlsx'}
                </label>
                <input
                  id="xls-file-input"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleImportarAlumnos}>Importar y Crear Grupo</button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

export default Grupo;