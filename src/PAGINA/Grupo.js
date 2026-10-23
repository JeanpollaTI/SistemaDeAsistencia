import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { FaTrash, FaPencilAlt, FaPlus, FaTimes, FaCheck, FaQuestionCircle } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNotification } from '../COMPONENTE/NotificationContext';
import LoadingOverlay from '../COMPONENTE/LoadingOverlay';
import './Grupo.css';
import ConfirmacionModal from './ConfirmacionModal';
import logoImage from './Logoescuela.png'; // Asegúrate que esta ruta sea correcta
import importFormatImg from './formato.png';
import BrandingModal from '../COMPONENTE/BrandingModal';
import GroupPerformanceModal from '../COMPONENTE/GroupPerformanceModal';
import PromoverAlumnosModal from '../COMPONENTE/PromoverAlumnosModal';
import TrabajoSocialModal from '../COMPONENTE/TrabajoSocialModal';

// --- URL de la API desde variables de entorno para Vercel ---
// CORRECCIÓN: Eliminado '/api' para coincidir con Home.js y la estructura del backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// --- CONSTANTES DE CONFIGURACIÓN ---
const NUM_BIMESTRES = 3;
const DIAS_INICIALES = 30;

const DEFAULT_ATTENDANCE_STATUSES = [
  { code: 'P', label: 'Presente', color: '#27ae60', icon: '✅' },
  { code: 'F', label: 'Falta', color: '#d32f2f', icon: '❌' },
  { code: 'J', label: 'Justificante', color: '#00CBCB', icon: '⚠️' },
  { code: 'R', label: 'Retardo', color: '#ff9800', icon: '🕒' }
];

const PRESET_STATUS_COLORS = [
  '#9c27b0', // Púrpura (ej: Orquesta)
  '#e91e63', // Rosa (ej: Enfermería / Salud)
  '#2196f3', // Azul (ej: Taller / Comisiones)
  '#00cbcb', // Turquesa
  '#8bc34a', // Lima
  '#ff5722', // Coral
  '#795548', // Marrón
  '#607d8b', // Gris azulado
  '#e67e22', // Naranja oscuro
  '#16a085'  // Verde mar
];

const sortAlumnosWithStatus = (alumnosList = []) => {
  const reg = [];
  const nuevos = [];

  (alumnosList || []).forEach(a => {
    if (a.esNuevoIngreso) {
      nuevos.push(a);
    } else {
      reg.push(a);
    }
  });

  const sortFn = (a, b) => {
    const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', undefined, { sensitivity: 'base' });
    if (resP !== 0) return resP;
    const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', undefined, { sensitivity: 'base' });
    if (resM !== 0) return resM;
    return (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' });
  };

  reg.sort(sortFn);
  nuevos.sort(sortFn);

  return [...reg, ...nuevos];
};

function Grupo({ user }) {
  const { showAlert } = useNotification();
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [materiasDb, setMateriasDb] = useState([]); // NUEVO: Estado para materias globales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', asesor: '', aula: '', alumnos: [] });
  const [alumnoInput, setAlumnoInput] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    emailPadre: '',
    telefonoPadre: '',
    esNuevoIngreso: false,
    fechaIngreso: '',
    esBaja: false,
    fechaBaja: ''
  });
  const [asistencia, setAsistencia] = useState({});
  const [diasPorBimestre, setDiasPorBimestre] = useState({});
  const [bimestreAbierto, setBimestreAbierto] = useState({});
  const [bimestreActivo, setBimestreActivo] = useState(1); // NUEVO: Estado global
  const [asignaciones, setAsignaciones] = useState({});
  const [editingAlumno, setEditingAlumno] = useState(null);
  const [selectedAlumnoIndex, setSelectedAlumnoIndex] = useState(-1);
  const alumnosListRef = useRef(null);
  const alumnoInputRefs = useRef([]); // Refs for Nombre, ApP, ApM, Email, Tel
  const [grupoParaEliminar, setGrupoParaEliminar] = useState(null);
  const [alumnoParaEliminar, setAlumnoParaEliminar] = useState(null);
  const [archivoXLS, setArchivoXLS] = useState(null);
  const [nombreGrupoImport, setNombreGrupoImport] = useState('');
  const [asignaturaActual, setAsignaturaActual] = useState(null); // Para saber qué asignatura se está evaluando
  const [schoolConfig, setSchoolConfig] = useState(null);
  const [brandingModal, setBrandingModal] = useState({ visible: false, onConfirm: null, title: '' });
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [isPromoverModalOpen, setIsPromoverModalOpen] = useState(false);
  const [currentGroupToAnalyze, setCurrentGroupToAnalyze] = useState(null);
  const [searchTermProfesor, setSearchTermProfesor] = useState('');
  const [expandedTeachersGroups, setExpandedTeachersGroups] = useState({});
  const [attendanceStatuses, setAttendanceStatuses] = useState(() => {
    try {
      const saved = localStorage.getItem('scholaris_custom_attendance_statuses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_ATTENDANCE_STATUSES;
  });
  const [isPincelModalOpen, setIsPincelModalOpen] = useState(false);
  const [isTotalesExpanded, setIsTotalesExpanded] = useState(false);
  const [editingStatusConfig, setEditingStatusConfig] = useState(null);
  const [newStatusInput, setNewStatusInput] = useState({ code: '', label: '', color: '#9c27b0', equivalent: 'P' });
  const [autoSavingStatus, setAutoSavingStatus] = useState('');
  const autoSaveTimerRef = useRef(null);
  const [isSavingGrupo, setIsSavingGrupo] = useState(false);
  const [rowSaveStatus, setRowSaveStatus] = useState({}); // { [id]: 'editing' | 'saving' | 'saved' | 'error' }
  const [fieldSaveStatus, setFieldSaveStatus] = useState({}); // { [field]: 'editing' | 'saving' | 'saved' | 'error' }
  const rowStatusTimersRef = useRef({});
  const fieldStatusTimersRef = useRef({});

  const setTempRowStatus = (rowKey, status, clearAfterMs = 2800) => {
    if (!rowKey) return;
    if (rowStatusTimersRef.current[rowKey]) {
      clearTimeout(rowStatusTimersRef.current[rowKey]);
    }
    setRowSaveStatus(prev => ({ ...prev, [rowKey]: status }));
    if (clearAfterMs > 0) {
      rowStatusTimersRef.current[rowKey] = setTimeout(() => {
        setRowSaveStatus(prev => {
          const next = { ...prev };
          delete next[rowKey];
          return next;
        });
      }, clearAfterMs);
    }
  };

  const setTempFieldStatus = (fieldKey, status, clearAfterMs = 2800) => {
    if (!fieldKey) return;
    if (fieldStatusTimersRef.current[fieldKey]) {
      clearTimeout(fieldStatusTimersRef.current[fieldKey]);
    }
    setFieldSaveStatus(prev => ({ ...prev, [fieldKey]: status }));
    if (clearAfterMs > 0) {
      fieldStatusTimersRef.current[fieldKey] = setTimeout(() => {
        setFieldSaveStatus(prev => {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      }, clearAfterMs);
    }
  };

  // 🌟 ESTADOS PARA MODAL DE LISTA DE ALUMNOS Y MATRÍCULAS Y SUBMÓDULO TRABAJO SOCIAL
  const [modalListaMatriculasGrupo, setModalListaMatriculasGrupo] = useState(null);
  const [modalTrabajoSocialGrupo, setModalTrabajoSocialGrupo] = useState(null);
  const [filtroMatricula, setFiltroMatricula] = useState('');
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const getStatusConfig = (code) => {
    if (!code) return null;
    return attendanceStatuses.find(s => s.code === code) || { code, label: code, color: '#9c27b0' };
  };

  const toggleTeachersExpand = (grupoId) => {
    setExpandedTeachersGroups(prev => ({
      ...prev,
      [grupoId]: !prev[grupoId]
    }));
  };
  
  // --- UTILERÍAS ---
  const getSafeId = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') {
      const trimmed = obj.trim();
      return (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && !trimmed.includes('[object')) ? trimmed : null;
    }
    
    if (typeof obj === 'object') {
      let rawId = obj._id || obj.id;
      if (rawId && typeof rawId === 'object') {
        rawId = rawId._id || rawId.id || (typeof rawId.toString === 'function' ? rawId.toString() : null);
      }
      if (rawId) {
        const str = String(rawId).trim();
        if (str && str !== 'null' && str !== 'undefined' && !str.includes('[object')) return str;
      }
      if (typeof obj.toString === 'function') {
        const str = obj.toString().trim();
        if (str && str !== 'null' && str !== 'undefined' && !str.includes('[object') && str !== '[object Object]') return str;
      }
    }
    
    return null;
  };

  // --- LÓGICA DE CARGA DE DATOS ---
  const location = useLocation();
  const [highlightedAlumnoId, setHighlightedAlumnoId] = useState(null);

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

          const sortedGrupos = Array.isArray(gruposRes.data) ? gruposRes.data.map(g => ({
            ...g,
            alumnos: Array.isArray(g.alumnos) ? sortAlumnosWithStatus(g.alumnos) : []
          })).sort((a, b) =>
            a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
          ) : [];
          setGrupos(sortedGrupos);
          const rawProfs = Array.isArray(profesoresRes.data) ? profesoresRes.data : [];
          setProfesores(rawProfs.filter(p => p && p.role === 'profesor'));
          setMateriasDb(materiasRes.data || []);

          // Fetch School Config if we have schoolId
          if (schoolId) {
            try {
              const schoolRes = await axios.get(`${API_URL}/schools/${schoolId}`, axiosConfig);
              setSchoolConfig(schoolRes.data);
            } catch (schoolErr) {
              console.error("Error fetching school config for PDF generation:", schoolErr);
            }
          }
        } else if (user.role === 'profesor') {
          const gruposRes = await axios.get(`${API_URL}/grupos/mis-grupos`, axiosConfig);

          if (gruposRes.data?.error === "SCHOOL_REQUIRED") {
            setError("SCHOOL_REQUIRED");
            setLoading(false);
            return;
          }

          const sortedGrupos = Array.isArray(gruposRes.data) ? gruposRes.data.map(g => ({
            ...g,
            alumnos: Array.isArray(g.alumnos) ? sortAlumnosWithStatus(g.alumnos) : []
          })).sort((a, b) =>
            a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
          ) : [];
          setGrupos(sortedGrupos);

          // Fetch School Config for professors as well
          if (schoolId) {
            try {
              const schoolRes = await axios.get(`${API_URL}/schools/${schoolId}`, axiosConfig);
              setSchoolConfig(schoolRes.data);
            } catch (schoolErr) {
              console.error("Error fetching school config for PDF generation:", schoolErr);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar datos:", err);
        if (err.response?.status === 403) {
          setError("SUSPENDED");
        } else {
          const detailMsg = err.response?.data?.details ? `: ${err.response.data.details}` : "";
          setError(`No se pudieron cargar los datos${detailMsg}`);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // 🌟 NUEVO: Efecto para auto-abrir modal de asistencia desde URL
  useEffect(() => {
    if (!loading && grupos.length > 0) {
      const params = new URLSearchParams(location.search);
      const gId = params.get('grupoId');
      const asig = params.get('asignatura');
      const aId = params.get('alumnoId');

      if (gId && asig) {
        const targetGrupo = grupos.find(g => String(g._id) === String(gId));
        if (targetGrupo) {
          abrirModal('asistencia', targetGrupo, asig);
          if (aId) setHighlightedAlumnoId(aId);
        }
      }
    }
  }, [loading, grupos, location.search]);

  // --- LÓGICA DE MODALES Y NOTIFICACIONES ---

  const abrirModal = async (tipo, data = null, asignatura = null) => {
    if (tipo === 'gestionarGrupo') {
      setGrupoSeleccionado(data);
      if (data) { 
        const sortedAlumnos = Array.isArray(data.alumnos) ? sortAlumnosWithStatus(data.alumnos) : [];

        setNuevoGrupo({
          ...JSON.parse(JSON.stringify(data)),
          aula: data.aula || '',
          alumnos: sortedAlumnos
        }); 
      }
      else { setNuevoGrupo({ nombre: '', asesor: '', aula: '', alumnos: [] }); }
      setModalVisible('gestionarGrupo');
    } else if (tipo === 'asignar') {
      setGrupoSeleccionado(data);
      const asignacionesIniciales = {};
      // Agrupar asignaturas por profesor
      (data.profesoresAsignados || []).forEach(asig => {
        if (!asig || !asig.asignatura) return;
        const profId = getSafeId(asig.profesor);
        if (profId && profId !== 'null' && profId !== 'undefined' && !profId.includes('[object')) {
          if (!asignacionesIniciales[profId]) {
            asignacionesIniciales[profId] = [];
          }
          if (!asignacionesIniciales[profId].includes(asig.asignatura)) {
            asignacionesIniciales[profId].push(asig.asignatura);
          }
        }
      });
      setAsignaciones(asignacionesIniciales);
      setModalVisible('asignar');
    } else if (tipo === 'asistencia') {
      setGrupoSeleccionado(data);
      setAsignaturaActual(asignatura); // Guardar la asignatura actual

      // Validar que el usuario tenga asignada esa materia (doble check)
      // Validar que el usuario tenga asignada esa materia (doble check robusto)
      const misAsignaciones = data.profesoresAsignados.filter(asig => {
        const assignedId = getSafeId(asig.profesor);
        const userId = getSafeId(user);
        const idMatch = assignedId && userId && (assignedId === userId);

        const assignedEmail = asig.profesor?.email?.toLowerCase();
        const userEmail = user?.email?.toLowerCase();
        const emailMatch = assignedEmail && userEmail && (assignedEmail === userEmail);

        return idMatch || emailMatch;
      });

      const tieneAsignatura = misAsignaciones.some(a => a.asignatura === asignatura);

      if (!tieneAsignatura) {
        return showAlert("No tienes asignada esta materia para este grupo.", "danger");
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
        showAlert("Error al cargar datos de asistencia.", "danger");
      }
    } else if (tipo === 'editarAlumno') {
      setEditingAlumno(data);
      setAlumnoInput({
        nombre: data.nombre,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno || '',
        emailPadre: data.emailPadre || '',
        telefonoPadre: data.telefonoPadre || '',
        esNuevoIngreso: !!data.esNuevoIngreso,
        fechaIngreso: data.fechaIngreso || '',
        esBaja: !!data.esBaja,
        fechaBaja: data.fechaBaja || ''
      });
      setModalVisible('editarAlumno');
    } else if (tipo === 'importar') {
      setModalVisible('importar');
    }
    setHasChanges(false);
  };

  const cerrarModal = (force = false) => {
    if (hasChanges && !force) {
      setShowUnsavedWarning(true);
      return;
    }
    setModalVisible(null);
    setShowUnsavedWarning(false);
    setHasChanges(false);
    setGrupoSeleccionado(null);
    setNuevoGrupo({ nombre: '', asesor: '', alumnos: [] });
    setAlumnoInput({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      emailPadre: '',
      telefonoPadre: '',
      esNuevoIngreso: false,
      fechaIngreso: '',
      esBaja: false,
      fechaBaja: ''
    });
    setBimestreAbierto({});
    setAsignaciones({});
    setEditingAlumno(null);
    setSelectedAlumnoIndex(-1);
    setArchivoXLS(null);
    setNombreGrupoImport('');
    setAsignaturaActual(null);
  };

  // --- LÓGICA DE NAVEGACIÓN Y EDICIÓN INLINE ---
  const handleSelectAlumno = (index) => {
    if (index < 0 || index >= nuevoGrupo.alumnos.length) return;
    const alumno = nuevoGrupo.alumnos[index];
    setSelectedAlumnoIndex(index);
    setAlumnoInput({
      nombre: alumno.nombre,
      apellidoPaterno: alumno.apellidoPaterno,
      apellidoMaterno: alumno.apellidoMaterno || '',
      emailPadre: alumno.emailPadre || '',
      telefonoPadre: alumno.telefonoPadre || '',
      esNuevoIngreso: !!alumno.esNuevoIngreso,
      fechaIngreso: alumno.fechaIngreso || '',
      esBaja: !!alumno.esBaja,
      fechaBaja: alumno.fechaBaja || ''
    });
    setEditingAlumno(alumno);

    // Scroll into view
    if (alumnosListRef.current) {
      const listItems = alumnosListRef.current.querySelectorAll('li');
      if (listItems[index]) {
        listItems[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  const handleCancelarEdicion = () => {
    setEditingAlumno(null);
    setSelectedAlumnoIndex(-1);
    setAlumnoInput({
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      emailPadre: '',
      telefonoPadre: '',
      esNuevoIngreso: false,
      fechaIngreso: '',
      esBaja: false,
      fechaBaja: ''
    });
  };

  // --- FUNCIONES CRUD Y LÓGICA DE AUTO-SAVE GUIADO ---
  const getAxiosConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const hasAlumnoChanged = (input, original) => {
    if (!original) return true;
    const norm = (v) => String(v || '').trim();
    return (
      norm(input.nombre) !== norm(original.nombre) ||
      norm(input.apellidoPaterno) !== norm(original.apellidoPaterno) ||
      norm(input.apellidoMaterno) !== norm(original.apellidoMaterno) ||
      norm(input.emailPadre) !== norm(original.emailPadre) ||
      norm(input.telefonoPadre) !== norm(original.telefonoPadre) ||
      Boolean(input.esNuevoIngreso) !== Boolean(original.esNuevoIngreso) ||
      norm(input.fechaIngreso) !== norm(original.fechaIngreso) ||
      Boolean(input.esBaja) !== Boolean(original.esBaja) ||
      norm(input.fechaBaja) !== norm(original.fechaBaja)
    );
  };

  // Persistencia unificada en un solo paso hacia el backend con feedback visual por fila/celda
  const persistirGrupoEnBackend = async (
    grupoPayload,
    {
      targetRowKey = null,
      targetFieldKey = null,
      closeAfter = false,
      customSuccessMsg = 'Cambios guardados con éxito'
    } = {}
  ) => {
    if (!grupoSeleccionado?._id) return null;
    if (!grupoPayload.nombre || !grupoPayload.nombre.trim()) {
      showAlert('El nombre del grupo es obligatorio.', 'error');
      return null;
    }

    setIsSavingGrupo(true);
    if (targetRowKey) setTempRowStatus(targetRowKey, 'saving', 0);
    if (targetFieldKey) setTempFieldStatus(targetFieldKey, 'saving', 0);

    try {
      const response = await axios.put(
        `${API_URL}/grupos/${grupoSeleccionado._id}`,
        grupoPayload,
        getAxiosConfig()
      );
      const updatedGrupoData = response.data;
      if (updatedGrupoData && Array.isArray(updatedGrupoData.alumnos)) {
        updatedGrupoData.alumnos = sortAlumnosWithStatus(updatedGrupoData.alumnos);
      }

      setGrupos(prev => prev.map(g => (g._id === grupoSeleccionado._id ? updatedGrupoData : g)));
      setGrupoSeleccionado(updatedGrupoData);
      setNuevoGrupo(prev => ({
        ...prev,
        nombre: updatedGrupoData.nombre,
        asesor: updatedGrupoData.asesor || '',
        aula: updatedGrupoData.aula || '',
        alumnos: updatedGrupoData.alumnos || prev.alumnos
      }));

      // Si estábamos editando un alumno, sincronizar la referencia original para futuras comparaciones
      if (editingAlumno && updatedGrupoData?.alumnos) {
        const refreshedAlumno = updatedGrupoData.alumnos.find(
          a =>
            String(a._id) === String(editingAlumno._id) ||
            (a.nombre === alumnoInput.nombre.trim() &&
              a.apellidoPaterno === alumnoInput.apellidoPaterno.trim() &&
              (a.apellidoMaterno || '') === (alumnoInput.apellidoMaterno || '').trim())
        );
        if (refreshedAlumno) {
          setEditingAlumno(refreshedAlumno);
          if (targetRowKey && String(refreshedAlumno._id) !== String(targetRowKey)) {
            setTempRowStatus(refreshedAlumno._id, 'saved', 3000);
          }
        }
      }

      if (targetRowKey) setTempRowStatus(targetRowKey, 'saved', 3000);
      if (targetFieldKey) setTempFieldStatus(targetFieldKey, 'saved', 3000);

      setHasChanges(false);
      showAlert(customSuccessMsg, 'success');

      if (closeAfter) {
        cerrarModal(true);
      }
      return updatedGrupoData;
    } catch (error) {
      console.error('Error al guardar cambios del grupo:', error);
      if (targetRowKey) setTempRowStatus(targetRowKey, 'error', 3500);
      if (targetFieldKey) setTempFieldStatus(targetFieldKey, 'error', 3500);
      showAlert(error.response?.data?.error || error.message || 'Error al actualizar.', 'error');
      return null;
    } finally {
      setIsSavingGrupo(false);
    }
  };

  // Auto-save guiado al presionar Enter o perder foco (onBlur) en campos generales del grupo
  const handleGrupoFieldCommit = async (fieldName) => {
    if (!grupoSeleccionado?._id) {
      setTempFieldStatus(fieldName, '', 10);
      return;
    }
    const currentVal = String(nuevoGrupo[fieldName] || '').trim();
    const originalVal = String(grupoSeleccionado[fieldName] || '').trim();

    // Validar que solo se dispare si el valor realmente cambió respecto al original
    if (currentVal === originalVal) {
      setFieldSaveStatus(prev => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      return;
    }

    if (fieldName === 'nombre' && !currentVal) {
      showAlert('El nombre del grupo no puede quedar vacío.', 'error');
      setNuevoGrupo(prev => ({ ...prev, nombre: grupoSeleccionado.nombre }));
      return;
    }

    await persistirGrupoEnBackend(nuevoGrupo, {
      targetFieldKey: fieldName,
      customSuccessMsg: 'Cambios guardados con éxito'
    });
  };

  // Auto-save guiado en edición de alumno al perder el foco (onBlur) si hubo cambios reales
  const handleAlumnoFieldBlur = async () => {
    if (!editingAlumno) return;
    if (!alumnoInput.nombre.trim() || !alumnoInput.apellidoPaterno.trim()) return;
    if (!hasAlumnoChanged(alumnoInput, editingAlumno)) return;

    const alumnosActualizados = sortAlumnosWithStatus(
      nuevoGrupo.alumnos.map(a =>
        a._id === editingAlumno._id ? { ...a, ...alumnoInput } : a
      )
    );
    const nextGrupo = { ...nuevoGrupo, alumnos: alumnosActualizados };
    setNuevoGrupo(nextGrupo);
    setEditingAlumno({ ...editingAlumno, ...alumnoInput });

    if (grupoSeleccionado?._id) {
      await persistirGrupoEnBackend(nextGrupo, {
        targetRowKey: editingAlumno._id,
        customSuccessMsg: 'Cambios guardados con éxito'
      });
    } else {
      setTempRowStatus(editingAlumno._id, 'saved', 2500);
      setHasChanges(true);
    }
  };

  const handleAgregarOActualizarAlumno = async () => {
    if (!alumnoInput.nombre.trim() || !alumnoInput.apellidoPaterno.trim()) {
      return showAlert('Nombre y Apellido Paterno son obligatorios.', 'error');
    }

    if (editingAlumno) {
      // Validar si realmente hubo cambios respecto al alumno original
      if (!hasAlumnoChanged(alumnoInput, editingAlumno) && !hasChanges) {
        setTempRowStatus(editingAlumno._id, 'saved', 2000);
        return showAlert('Sin cambios pendientes en este alumno.');
      }

      const rowId = editingAlumno._id;
      const alumnosActualizados = sortAlumnosWithStatus(
        nuevoGrupo.alumnos.map(a => (a._id === rowId ? { ...a, ...alumnoInput } : a))
      );
      const nextGrupo = { ...nuevoGrupo, alumnos: alumnosActualizados };
      setNuevoGrupo(nextGrupo);
      setEditingAlumno({ ...editingAlumno, ...alumnoInput });

      if (grupoSeleccionado?._id) {
        // Guardado directo en 1 solo paso al backend
        await persistirGrupoEnBackend(nextGrupo, {
          targetRowKey: rowId,
          customSuccessMsg: 'Cambios guardados con éxito'
        });
      } else {
        setTempRowStatus(rowId, 'saved', 2500);
        setHasChanges(true);
        showAlert('Alumno actualizado en la lista.');
      }
    } else {
      // AGREGAR NUEVO ALUMNO
      const alumnoId = `new-${Date.now()}`;
      const nuevoAlumno = { _id: alumnoId, ...alumnoInput };
      const alumnosActualizados = sortAlumnosWithStatus([...nuevoGrupo.alumnos, nuevoAlumno]);
      const nextGrupo = { ...nuevoGrupo, alumnos: alumnosActualizados };
      setNuevoGrupo(nextGrupo);
      handleCancelarEdicion();

      if (grupoSeleccionado?._id) {
        await persistirGrupoEnBackend(nextGrupo, {
          targetRowKey: alumnoId,
          customSuccessMsg: 'Alumno agregado y cambios guardados con éxito'
        });
      } else {
        setTempRowStatus(alumnoId, 'saved', 2500);
        setHasChanges(true);
        showAlert('Alumno agregado a la lista.');
      }
    }
  };

  const handleUpdateAlumno = async () => {
    if (!editingAlumno) return;
    if (!alumnoInput.nombre.trim() || !alumnoInput.apellidoPaterno.trim()) {
      return showAlert('Nombre y Apellido Paterno son obligatorios.', 'error');
    }
    const rowId = editingAlumno._id;
    const alumnosActualizados = sortAlumnosWithStatus(
      nuevoGrupo.alumnos.map(a => (a._id === rowId ? { ...a, ...alumnoInput } : a))
    );
    const nextGrupo = { ...nuevoGrupo, alumnos: alumnosActualizados };
    setNuevoGrupo(nextGrupo);
    setModalVisible('gestionarGrupo');
    setEditingAlumno(null);

    if (grupoSeleccionado?._id) {
      await persistirGrupoEnBackend(nextGrupo, {
        targetRowKey: rowId,
        customSuccessMsg: 'Cambios guardados con éxito'
      });
    } else {
      setTempRowStatus(rowId, 'saved', 2500);
      setHasChanges(true);
      showAlert('Alumno actualizado correctamente.');
    }
  };

  const handleDeleteAlumno = (alumno) => {
    setAlumnoParaEliminar(alumno);
  };

  const confirmarEliminacionAlumno = async () => {
    if (!alumnoParaEliminar) return;
    const idEliminado = alumnoParaEliminar._id;
    const alumnosRestantes = nuevoGrupo.alumnos.filter(a => a._id !== idEliminado);
    const nextGrupo = { ...nuevoGrupo, alumnos: alumnosRestantes };
    setNuevoGrupo(nextGrupo);
    if (editingAlumno?._id === idEliminado) {
      handleCancelarEdicion();
    }
    setAlumnoParaEliminar(null);

    if (grupoSeleccionado?._id) {
      await persistirGrupoEnBackend(nextGrupo, {
        customSuccessMsg: 'Alumno eliminado y cambios guardados con éxito'
      });
    } else {
      setHasChanges(true);
      showAlert('Alumno eliminado de la lista.');
    }
  };

  // Autofocus inicial al abrir el modal (Solo una vez por apertura)
  useEffect(() => {
    if (modalVisible === 'gestionarGrupo') {
      const timer = setTimeout(() => {
        if (alumnoInputRefs.current[0]) {
          alumnoInputRefs.current[0].focus();
        }
      }, 300); // Un poco mas de delay para estabilidad
      return () => clearTimeout(timer);
    }
  }, [modalVisible]);

  // Listener de teclado para el modal
  useEffect(() => {
    if (modalVisible !== 'gestionarGrupo') return;

    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      
      // Manejo de compatibilidad para tagName
      const tagName = activeElement.tagName ? activeElement.tagName.toUpperCase() : '';
      const isInputFocused = tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';
      
      // 1. Si está en la columna izquierda (Grupo/Asesor), no interferir si está escribiendo
      // Usamos una verificación más básica para compatibilidad
      let parent = activeElement;
      while (parent && parent !== document.body) {
        if (parent.classList && parent.classList.contains('modal-column-left')) return;
        parent = parent.parentElement;
      }

      // 2. Si está en los inputs del alumno (Columna Centro)
      const inputIndex = alumnoInputRefs.current.indexOf(activeElement);
      if (inputIndex !== -1) {
        // PERMITIR Alt + Flecha para navegar la lista sin salir del input
        if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          const direction = e.key === 'ArrowDown' ? 1 : -1;
          const newIdx = (selectedAlumnoIndex + direction + nuevoGrupo.alumnos.length) % nuevoGrupo.alumnos.length;
          handleSelectAlumno(newIdx);
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextInput = alumnoInputRefs.current[inputIndex + 1];
          if (nextInput) nextInput.focus();
          else {
            // Ciclar al primero
            alumnoInputRefs.current[0].focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevInput = alumnoInputRefs.current[inputIndex - 1];
          if (prevInput) prevInput.focus();
          else {
            alumnoInputRefs.current[alumnoInputRefs.current.length - 1].focus();
          }
        }
        return; // Salir para no procesar navegación de lista
      }

      // 3. Navegación de lista (si no hay un input enfocado o si está enfocado el contenedor de la lista)
      if (!isInputFocused || activeElement.closest('.alumnos-list')) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = selectedAlumnoIndex + 1 >= nuevoGrupo.alumnos.length ? 0 : selectedAlumnoIndex + 1;
          handleSelectAlumno(nextIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = selectedAlumnoIndex - 1 < 0 ? nuevoGrupo.alumnos.length - 1 : selectedAlumnoIndex - 1;
          handleSelectAlumno(prevIndex);
        } else if (e.key === 'Escape') {
          handleCancelarEdicion();
          // Quitar foco de inputs si hay alguno
          if (isInputFocused) activeElement.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalVisible, selectedAlumnoIndex, nuevoGrupo.alumnos]);

  const handleGuardarGrupo = async () => {
    if (!nuevoGrupo.nombre.trim()) return showAlert("El nombre del grupo es requerido.", 'error');
    try {
      const response = await axios.post(`${API_URL}/grupos`, nuevoGrupo, getAxiosConfig());
      const nuevoGrupoData = response.data;
      if (nuevoGrupoData && Array.isArray(nuevoGrupoData.alumnos)) {
        nuevoGrupoData.alumnos.sort((a, b) => {
          const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', 'es', { sensitivity: 'base' });
          if (resP !== 0) return resP;
          const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', 'es', { sensitivity: 'base' });
          if (resM !== 0) return resM;
          return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
        });
      }
      setGrupos(prev => [...prev, nuevoGrupoData].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
      ));
      showAlert(`Grupo "${nuevoGrupo.nombre}" guardado.`);
      setHasChanges(false);
      cerrarModal(true);
    } catch (error) {
      console.error("Error al guardar grupo:", error);
      showAlert(error.response?.data?.error || error.message || 'Error al guardar.', 'error');
    }
  };

  const handleUpdateGrupo = async () => {
    if (!grupoSeleccionado) return;
    let payloadToSave = { ...nuevoGrupo };

    // Si hay un alumno en edición con cambios en los inputs, integrarlos automáticamente antes de guardar
    if (
      editingAlumno &&
      alumnoInput.nombre.trim() &&
      alumnoInput.apellidoPaterno.trim() &&
      hasAlumnoChanged(alumnoInput, editingAlumno)
    ) {
      payloadToSave.alumnos = sortAlumnosWithStatus(
        nuevoGrupo.alumnos.map(a =>
          a._id === editingAlumno._id ? { ...a, ...alumnoInput } : a
        )
      );
      setNuevoGrupo(payloadToSave);
    }

    await persistirGrupoEnBackend(payloadToSave, {
      closeAfter: true,
      customSuccessMsg: `Grupo "${payloadToSave.nombre}" actualizado con éxito.`
    });
  };

  const handleGuardarAsignacion = async () => {
    if (!grupoSeleccionado) return;

    // Aplanar el objeto de asignaciones a un array de objetos { profesor, asignatura }
    const asignacionesParaEnviar = [];
    Object.keys(asignaciones).forEach(profesorId => {
      if (!profesorId || profesorId === 'null' || profesorId === 'undefined' || profesorId.includes('[object')) return;
      const materias = asignaciones[profesorId];
      if (Array.isArray(materias)) {
        materias.forEach(materia => {
          if (materia && String(materia).trim().length > 0) {
            asignacionesParaEnviar.push({
              profesor: profesorId.trim(),
              asignatura: String(materia).trim()
            });
          }
        });
      }
    });

    try {
      const response = await axios.put(`${API_URL}/grupos/${grupoSeleccionado._id}/asignar-profesores`, { asignaciones: asignacionesParaEnviar }, getAxiosConfig());
      setGrupos(prev => prev.map(g => g._id === grupoSeleccionado._id ? response.data : g));
      setGrupoSeleccionado(response.data);
      setHasChanges(false);
      showAlert("Asignación guardada exitosamente.");
      cerrarModal(true);
    } catch (error) {
      console.error("Error al guardar asignación:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message;
      showAlert(`Error al guardar la asignación: ${errorMsg}`, 'error');
    }
  };

  const handleEliminarGrupo = (grupo) => setGrupoParaEliminar(grupo);

  const confirmarEliminacionGrupo = async () => {
    if (!grupoParaEliminar) return;
    try {
      await axios.delete(`${API_URL}/grupos/${grupoParaEliminar._id}`, getAxiosConfig());
      setGrupos(grupos.filter(g => g._id !== grupoParaEliminar._id));
      showAlert(`Grupo "${grupoParaEliminar.nombre}" eliminado.`);
    } catch (error) {
      showAlert(error.response?.data?.error || 'Error al eliminar.', 'error');
    } finally {
      setGrupoParaEliminar(null);
    }
  };

  const exportarXLS = (grupo) => {
    if (!grupo || !grupo.alumnos || grupo.alumnos.length === 0) return showAlert("Este grupo no tiene alumnos para exportar.", "danger");

    const alumnosOrdenados = sortAlumnosWithStatus(grupo.alumnos);

    const datosParaExportar = alumnosOrdenados.map((a, i) => ({
      'N°': i + 1,
      'Matrícula': a.matricula || '---',
      'Apellido Paterno': a.apellidoPaterno || '',
      'Apellido Materno': a.apellidoMaterno || '',
      'Nombre(s)': a.nombre || '',
      'Nombre Completo': `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.replace(/\s+/g, ' ').trim()
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');
    worksheet['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 35 }];
    XLSX.writeFile(workbook, `Lista_${grupo.nombre.replace(/ /g, '_')}.xlsx`);
  };

  // 🌟 FUNCIONES PARA OBTENER LISTA DE ALUMNOS Y MATRÍCULAS (MODAL, PDF, XLS, COPIAR) Y TRABAJO SOCIAL
  const abrirModalListaMatriculas = (grupo) => {
    if (!grupo) return;
    setModalTrabajoSocialGrupo(null);
    setModalListaMatriculasGrupo(grupo);
    setFiltroMatricula('');
    setCopiadoFeedback(false);
  };

  const abrirModalTrabajoSocial = (grupo) => {
    if (!grupo) return;
    setModalListaMatriculasGrupo(null);
    setModalTrabajoSocialGrupo(grupo);
  };

  const exportarListaMatriculasXLS = (grupo) => {
    if (!grupo || !grupo.alumnos || grupo.alumnos.length === 0) {
      showAlert("Este grupo no tiene alumnos registrados para exportar.", "danger");
      return;
    }

    try {
      const alumnosOrdenados = sortAlumnosWithStatus(grupo.alumnos);

      const datosParaExportar = alumnosOrdenados.map((a, i) => {
        const matricula = a.matricula || '---';
        const nombreCompleto = `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.replace(/\s+/g, ' ').trim();
        let estatus = 'Activo';
        if (a.esBaja) estatus = `Baja ${a.fechaBaja ? `(${a.fechaBaja})` : ''}`.trim();
        else if (a.esNuevoIngreso) estatus = `Nuevo Ingreso ${a.fechaIngreso ? `(${a.fechaIngreso})` : ''}`.trim();

        return {
          'N°': i + 1,
          'Matrícula': matricula,
          'Apellido Paterno': a.apellidoPaterno || '',
          'Apellido Materno': a.apellidoMaterno || '',
          'Nombre(s)': a.nombre || '',
          'Nombre Completo': nombreCompleto,
          'Estatus': estatus
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Matrículas');
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 35 },
        { wch: 18 }
      ];
      XLSX.writeFile(workbook, `Lista_Matriculas_${(grupo.nombre || 'Grupo').replace(/ /g, '_')}.xlsx`);
      showAlert("Archivo Excel de alumnos y matrículas descargado con éxito.", "success");
    } catch (err) {
      console.error("Error al exportar XLS de matrículas:", err);
      showAlert("Error al generar archivo Excel.", "danger");
    }
  };

  const exportarListaMatriculasPDF = (grupo) => {
    if (!grupo || !grupo.alumnos || grupo.alumnos.length === 0) {
      showAlert("Este grupo no tiene alumnos registrados para exportar.", "danger");
      return;
    }

    try {
      const doc = new jsPDF();
      const schoolName = schoolConfig?.name || 'Escuela Secundaria';
      const schoolLogo = schoolConfig?.config?.logoUrl || logoImage;
      const schoolDirector = schoolConfig?.directorName || localStorage.getItem('current_director_name') || '';

      const margin = 14;
      const pageWidth = doc.internal.pageSize.width;

      // Intentar agregar logo
      try {
        const img = new Image();
        img.src = schoolLogo;
        const logoWidth = 22;
        const logoHeight = 22;
        doc.addImage(img, 'PNG', pageWidth - margin - logoWidth, margin - 4, logoWidth, logoHeight);
      } catch (e) {
        // Logo opcional
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      let yPos = margin + 4;
      doc.text(schoolName, margin, yPos);

      yPos += 7;
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 150);
      doc.text(`LISTA DE ALUMNOS Y MATRÍCULAS`, margin, yPos);

      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(70, 80, 95);
      doc.text(`Grupo: ${grupo.nombre}   |   Aula: ${grupo.aula || 'S/A'}   |   Asesor: ${grupo.asesor || 'Sin asignar'}`, margin, yPos);

      yPos += 5;
      const fechaHoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Total de Alumnos: ${grupo.alumnos.length}   |   Fecha: ${fechaHoy}`, margin, yPos);

      yPos += 6;

      const alumnosOrdenados = sortAlumnosWithStatus(grupo.alumnos);

      const tableRows = alumnosOrdenados.map((a, index) => {
        const matricula = a.matricula || '---';
        const nombreCompleto = `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.replace(/\s+/g, ' ').trim();
        let estatus = 'Activo';
        if (a.esBaja) estatus = 'Baja';
        else if (a.esNuevoIngreso) estatus = 'Nuevo Ingreso';

        return [
          index + 1,
          matricula,
          nombreCompleto,
          estatus
        ];
      });

      autoTable(doc, {
        head: [['N°', 'Matrícula', 'Nombre Completo del Alumno', 'Estatus']],
        body: tableRows,
        startY: yPos,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 160, 160],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 10
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 38, halign: 'center', fontStyle: 'bold' },
          2: { halign: 'left' },
          3: { cellWidth: 30, halign: 'center' }
        },
        styles: {
          fontSize: 9,
          cellPadding: 3.5,
          valign: 'middle'
        },
        alternateRowStyles: {
          fillColor: [245, 248, 250]
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'Baja') {
              data.cell.styles.textColor = [220, 53, 69];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'Nuevo Ingreso') {
              data.cell.styles.textColor = [230, 126, 34];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      if (schoolDirector && user?.role !== 'profesor') {
        const finalY = doc.lastAutoTable.finalY + 15;
        if (finalY < doc.internal.pageSize.height - 25) {
          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text(`Director(a): ${schoolDirector}`, margin, finalY);
        }
      }

      doc.save(`Lista_Matriculas_${(grupo.nombre || 'Grupo').replace(/ /g, '_')}.pdf`);
      showAlert("PDF de alumnos y matrículas descargado con éxito.", "success");
    } catch (err) {
      console.error("Error al generar PDF de matrículas:", err);
      showAlert("Error al generar el documento PDF.", "danger");
    }
  };

  const copiarListaMatriculas = (alumnos, grupoNombre) => {
    if (!alumnos || alumnos.length === 0) return;
    const lineas = [
      `Lista de Alumnos y Matrículas - Grupo: ${grupoNombre || ''}`,
      `N°\tMatrícula\tNombre Completo\tEstatus`,
      ...alumnos.map((a, i) => {
        const mat = a.matricula || '---';
        const nom = `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.replace(/\s+/g, ' ').trim();
        const est = a.esBaja ? 'Baja' : (a.esNuevoIngreso ? 'Nuevo Ingreso' : 'Activo');
        return `${i + 1}\t${mat}\t${nom}\t${est}`;
      })
    ];
    navigator.clipboard.writeText(lineas.join('\n')).then(() => {
      setCopiadoFeedback(true);
      showAlert("Lista copiada al portapapeles. Lista para pegar en Excel o Word.", "success");
      setTimeout(() => setCopiadoFeedback(false), 2500);
    }).catch(() => {
      showAlert("No se pudo copiar automáticamente al portapapeles.", "danger");
    });
  };

  const triggerAutoSave = (newAsistenciaState) => {
    if (!grupoSeleccionado || !asignaturaActual) return;
    setAutoSavingStatus('Guardando...');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await axios.put(`${API_URL}/asistencia`, {
          grupoId: grupoSeleccionado._id,
          asignatura: asignaturaActual,
          registros: newAsistenciaState,
          diasPorBimestre
        }, getAxiosConfig());
        setAutoSavingStatus('Autoguardado ✅');
        setHasChanges(false);
        setTimeout(() => setAutoSavingStatus(''), 3000);
      } catch (err) {
        console.error("Auto-save error:", err);
        setAutoSavingStatus('Error al autoguardar ⚠️');
      }
    }, 700);
  };

  const handleMarcarAsistencia = (alumnoId, bimestre, diaIndex) => {
    const key = `${alumnoId}-b${bimestre}-d${diaIndex}`;
    const availableCodes = ['', ...attendanceStatuses.map(s => s.code)];
    const estadoActual = asistencia[key]?.estado || '';
    const currentIndex = availableCodes.indexOf(estadoActual);
    const siguienteIndex = (currentIndex + 1) % availableCodes.length;
    const nuevoEstado = availableCodes[siguienteIndex];
    const stConf = attendanceStatuses.find(s => s.code === nuevoEstado);
    setHasChanges(true);
    setAsistencia(prev => {
      const newState = { ...prev };
      if (nuevoEstado) {
        newState[key] = {
          estado: nuevoEstado,
          equivalent: stConf?.equivalent || (nuevoEstado === 'F' ? 'F' : 'P'),
          fecha: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        };
      } else {
        delete newState[key];
      }
      triggerAutoSave(newState);
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

      setHasChanges(false);
      showAlert("Asistencia guardada exitosamente.");
      cerrarModal(true);
    } catch (error) {
      showAlert("Error al guardar la asistencia.", 'error');
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
    let retardos = 0;
    const customCounts = {};

    attendanceStatuses.forEach(st => {
      if (!['P', 'F', 'J', 'R'].includes(st.code)) {
        customCounts[st.code] = 0;
      }
    });

    const diasDelBimestre = (diasData || diasPorBimestre)[bimestre] || DIAS_INICIALES;
    for (let i = 1; i <= diasDelBimestre; i++) {
      const key = `${alumnoId}-b${bimestre}-d${i}`;
      const registro = (asistenciaData || asistencia)[key];
      const est = registro?.estado;
      if (!est) continue;

      if (est === 'P') {
        presentes++;
      } else if (est === 'F') {
        faltas++;
      } else if (est === 'J') {
        justificados++;
        presentes++;
      } else if (est === 'R') {
        retardos++;
        presentes++;
      } else {
        if (customCounts[est] !== undefined) {
          customCounts[est]++;
        }
        const stConf = attendanceStatuses.find(s => s.code === est);
        const eq = stConf?.equivalent || 'P';
        if (eq === 'F') {
          faltas++;
        } else if (eq === 'J') {
          justificados++;
          presentes++;
        } else if (eq === 'R') {
          retardos++;
          presentes++;
        } else {
          presentes++;
        }
      }
    }
    return { presentes, faltas, justificados, retardos, customCounts };
  }, [asistencia, diasPorBimestre, attendanceStatuses]);

  const handleEditStatusInit = (st) => {
    setEditingStatusConfig(st);
    setNewStatusInput({
      code: st.code,
      label: st.label || '',
      color: st.color || '#9c27b0',
      equivalent: st.equivalent || (st.code === 'F' ? 'F' : 'P')
    });
  };

  const handleCancelEditStatus = () => {
    setEditingStatusConfig(null);
    setNewStatusInput({ code: '', label: '', color: '#9c27b0', equivalent: 'P' });
  };

  const handleAddOrUpdateCustomStatus = () => {
    const codeClean = (newStatusInput.code || '').trim().toUpperCase();
    const labelClean = (newStatusInput.label || '').trim();
    const equivalentClean = newStatusInput.equivalent || 'P';
    if (!codeClean) return showAlert('Ingresa una letra o código para el botón (ejemplo: O, Obs).', 'error');
    if (!labelClean) return showAlert('Ingresa una descripción o significado (ejemplo: Orquesta).', 'error');

    if (editingStatusConfig) {
      const updated = attendanceStatuses.map(s => {
        if (s.code === editingStatusConfig.code) {
          return {
            ...s,
            label: labelClean,
            color: newStatusInput.color || s.color,
            equivalent: equivalentClean
          };
        }
        return s;
      });
      setAttendanceStatuses(updated);
      try {
        localStorage.setItem('scholaris_custom_attendance_statuses', JSON.stringify(updated));
      } catch (e) {}
      setEditingStatusConfig(null);
      setNewStatusInput({ code: '', label: '', color: '#9c27b0', equivalent: 'P' });
      return showAlert(`Botón "${editingStatusConfig.code}" actualizado correctamente.`);
    }

    if (attendanceStatuses.some(s => s.code === codeClean)) {
      return showAlert(`El botón "${codeClean}" ya existe en la lista.`, 'error');
    }

    const updated = [
      ...attendanceStatuses,
      { code: codeClean, label: labelClean, color: newStatusInput.color || '#9c27b0', icon: '🎨', equivalent: equivalentClean }
    ];
    setAttendanceStatuses(updated);
    try {
      localStorage.setItem('scholaris_custom_attendance_statuses', JSON.stringify(updated));
    } catch (e) {}
    setNewStatusInput({ code: '', label: '', color: '#9c27b0', equivalent: 'P' });
    showAlert(`Botón "${codeClean}" (${labelClean}) agregado exitosamente.`);
  };

  const handleRemoveCustomStatus = (codeToRemove) => {
    if (['P', 'F', 'J', 'R'].includes(codeToRemove)) {
      return showAlert('Los botones base (P, F, J, R) no se pueden eliminar.', 'error');
    }
    const updated = attendanceStatuses.filter(s => s.code !== codeToRemove);
    setAttendanceStatuses(updated);
    try {
      localStorage.setItem('scholaris_custom_attendance_statuses', JSON.stringify(updated));
    } catch (e) {}
    showAlert(`Botón "${codeToRemove}" eliminado.`);
  };

  const handleResetStatuses = () => {
    setAttendanceStatuses(DEFAULT_ATTENDANCE_STATUSES);
    try {
      localStorage.removeItem('scholaris_custom_attendance_statuses');
    } catch (e) {}
    showAlert('Botones de asistencia restablecidos por defecto (P, F, J, R).');
  };

  const handleAddAsignatura = (profesorId, nuevaAsignatura) => {
    if (!nuevaAsignatura) return;

    setAsignaciones(prev => {
      const current = prev[profesorId] || [];
      if (current.includes(nuevaAsignatura)) {
        return prev;
      }
      return { ...prev, [profesorId]: [...current, nuevaAsignatura] };
    });
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const handleFileChange = (e) => {
    setArchivoXLS(e.target.files[0]);
  };

  const parseFullName = (fullNameStr) => {
    if (!fullNameStr || typeof fullNameStr !== 'string') {
      return { apellidoPaterno: '', apellidoMaterno: '', nombre: '' };
    }

    const cleanStr = fullNameStr.trim().replace(/\s+/g, ' ');
    if (!cleanStr) {
      return { apellidoPaterno: '', apellidoMaterno: '', nombre: '' };
    }

    const rawTokens = cleanStr.split(' ');
    const tokens = [];
    let i = 0;

    while (i < rawTokens.length) {
      const currentToken = rawTokens[i];
      const upperToken = currentToken.toUpperCase();

      if (i + 2 < rawTokens.length) {
        const next1 = rawTokens[i + 1].toUpperCase();
        if (upperToken === 'DE' && (next1 === 'LA' || next1 === 'LOS' || next1 === 'LAS')) {
          tokens.push(`${currentToken} ${rawTokens[i + 1]} ${rawTokens[i + 2]}`);
          i += 3;
          continue;
        }
      }

      if (i + 1 < rawTokens.length) {
        if (upperToken === 'DE' || upperToken === 'DEL' || upperToken === 'SAN' || upperToken === 'SANTA') {
          tokens.push(`${currentToken} ${rawTokens[i + 1]}`);
          i += 2;
          continue;
        }
      }

      tokens.push(currentToken);
      i++;
    }

    if (tokens.length === 1) {
      return { apellidoPaterno: tokens[0], apellidoMaterno: '', nombre: 'Sin nombre' };
    }
    if (tokens.length === 2) {
      return { apellidoPaterno: tokens[0], apellidoMaterno: '', nombre: tokens[1] };
    }
    if (tokens.length === 3) {
      return { apellidoPaterno: tokens[0], apellidoMaterno: tokens[1], nombre: tokens[2] };
    }

    const apellidoPaterno = tokens[0];
    const apellidoMaterno = tokens[1];
    const nombre = tokens.slice(2).join(' ');

    return { apellidoPaterno, apellidoMaterno, nombre };
  };

  const handleImportarAlumnos = () => {
    if (!nombreGrupoImport.trim()) {
      return showAlert('Por favor, ingresa un nombre para el grupo.', 'error');
    }
    if (!archivoXLS) {
      return showAlert('Por favor, selecciona un archivo XLS.', 'error');
    }

    const HEADER_KEYWORDS = [
      'escuela', 'secundaria', 'general', 'evaluación', 'evaluacion', 'trimestre',
      'ciclo', 'escolar', 'promedio', 'clases', 'programadas', 'impartidas',
      'asistencia', 'aprobados', 'reprobados', 'rasgos', 'conducta', 'inasistencias',
      'calificación', 'calificacion', 'apoyos', 'requeridos', 'nombre', 'n°', 'no.',
      'primer', 'segundo', 'tercer', 'periodo', 'bimestre', 'materia', 'profesor',
      'grupo', 'grado', 'docente', 'firma', 'observaciones', 'amado', 'nervo', 'total',
      'director', 'directora', 'subdirector', 'subdirectora', 'coordinador'
    ];

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const alumnosImportados = [];

        for (let r = 0; r < json.length; r++) {
          const row = json[r];
          if (!Array.isArray(row) || row.length === 0) continue;

          const cells = row.map(c => (c !== undefined && c !== null ? String(c).trim() : ''));
          const nonNullCells = cells.filter(c => c !== '');
          if (nonNullCells.length === 0) continue;

          const combinedRowStr = nonNullCells.join(' ').toLowerCase();

          // 1. OMITIR cualquier fila de encabezado escolar, títulos o estadísticas de la escuela
          const isHeaderOrMetadata = HEADER_KEYWORDS.some(kw => combinedRowStr.includes(kw));
          if (isHeaderOrMetadata) {
            continue;
          }

          let parsedStudent = null;

          // Extraer celdas de texto que correspondan a partes del nombre (omitiendo números de lista/calificaciones y palabras clave)
          const nameCols = nonNullCells.filter(c => {
            if (!c) return false;
            const cleanedNum = c.replace(',', '.');
            if (!isNaN(Number(cleanedNum))) return false;
            const lower = c.toLowerCase();
            if (['aprobado', 'reprobado', 'promedio', 'baja', 'ordinario', 'status', 'estatus', 'asistencia'].includes(lower)) return false;
            return true;
          });

          if (nameCols.length >= 3) {
            // Si el Excel viene dividido en casillas: Columna 1 = Apellido Paterno, Columna 2 = Apellido Materno, Columna 3+ = Nombre(s)
            parsedStudent = {
              apellidoPaterno: nameCols[0],
              apellidoMaterno: nameCols[1],
              nombre: nameCols.slice(2).join(' ')
            };
          } else if (nameCols.length === 2) {
            const parsedFirst = parseFullName(nameCols[0]);
            if (parsedFirst.apellidoMaterno) {
              parsedStudent = {
                apellidoPaterno: parsedFirst.apellidoPaterno,
                apellidoMaterno: parsedFirst.apellidoMaterno,
                nombre: nameCols[1]
              };
            } else {
              parsedStudent = {
                apellidoPaterno: nameCols[0],
                apellidoMaterno: '',
                nombre: nameCols[1]
              };
            }
          } else if (nameCols.length === 1) {
            // Si viene todo junto en una sola casilla
            parsedStudent = parseFullName(nameCols[0]);
          }

          if (parsedStudent && (parsedStudent.nombre || parsedStudent.apellidoPaterno)) {
            if (parsedStudent.apellidoPaterno && parsedStudent.apellidoPaterno.length > 1) {
              if (!parsedStudent.nombre) {
                parsedStudent.nombre = 'Sin nombre';
              }
              alumnosImportados.push(parsedStudent);
            }
          }
        }

        if (alumnosImportados.length === 0) {
          return showAlert('No se encontraron alumnos válidos en el archivo. Verifica que la lista contenga los nombres de los alumnos.', 'error');
        }

        const grupoParaGuardar = { nombre: nombreGrupoImport, alumnos: alumnosImportados };

        const response = await axios.post(`${API_URL}/grupos`, grupoParaGuardar, getAxiosConfig());
        const nuevoGrupoData = response.data;
        if (nuevoGrupoData && Array.isArray(nuevoGrupoData.alumnos)) {
          nuevoGrupoData.alumnos.sort((a, b) => {
            const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', 'es', { sensitivity: 'base' });
            if (resP !== 0) return resP;
            const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', 'es', { sensitivity: 'base' });
            if (resM !== 0) return resM;
            return (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' });
          });
        }
        setGrupos(prev => [...prev, nuevoGrupoData].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
        ));
        showAlert(`Grupo "${nombreGrupoImport}" importado exitosamente con ${alumnosImportados.length} alumnos.`);
        cerrarModal();
      } catch (error) {
        console.error("Error al importar archivo:", error);
        showAlert('Hubo un error al procesar el archivo.', 'error');
      }
    };
    reader.readAsBinaryString(archivoXLS);
  };



  const generarPDF = async (grupo, asignatura, brandingData = {}) => {
    if (!asignatura) {
      return showAlert("No se especificó la asignatura para el PDF.", "danger");
    }

    try {
      const res = await axios.get(`${API_URL}/asistencia?grupoId=${grupo._id}&asignatura=${asignatura}`, getAxiosConfig());
      const asistenciaData = res.data?.registros || {};
      const diasData = res.data?.diasPorBimestre || {};

      const doc = new jsPDF();
      const schoolName = schoolConfig?.name || 'Escuela Secundaria';
      const schoolLogo = brandingData.logoUrl || schoolConfig?.config?.logoUrl || logoImage;
      const schoolDirector = brandingData.directorName || schoolConfig?.directorName || '';

      // --- INICIO DE CAMBIOS PARA LOGO Y ESTILOS ---
      const margin = 14;
      const pageWidth = doc.internal.pageSize.width;

      if (user?.role !== 'profesor') {
        const img = new Image();
        img.src = schoolLogo;
        await img.decode().catch(() => { }); // Esperar a que la imagen se cargue

        const logoWidth = 25; // Ancho del logo en mm
        const logoHeight = (img.height * logoWidth) / img.width; // Calcular altura para mantener proporción
        doc.addImage(schoolLogo, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);
      }

      doc.setFontSize(12);

      // 1. Inicializar la posición Y
      let yPos = margin + 5;

      // 2. Primera línea: Escuela
      doc.text(schoolName, margin, yPos);

      // 3. Aumentar la posición Y para la siguiente línea (menos que 10 para evitar superposición con el logo)
      yPos += 7;

      // 4. Segunda línea: Reporte de Asistencia (ahora está en 'yPos')
      doc.text(`Reporte de Asistencia - Grupo: ${grupo.nombre}`, margin, yPos);

      // 5. Aumentar la posición Y para la siguiente línea
      yPos += 7; // Usar 7mm entre líneas para mantenerlas juntas

      // 6. Tercera línea: Asignatura (ahora está en 'yPos')
      doc.text(`Asignatura: ${asignatura}`, margin, yPos);

      // 7. Director(a)
      if (user?.role !== 'profesor') {
        yPos += 7;
        doc.text(`Director(a): ${schoolDirector || localStorage.getItem('current_director_name') || 'N/A'}`, margin, yPos);
      }

      // 8. AUMENTO CLAVE: Añadir un espacio adicional (e.g., 7mm) para que el texto NO toque la tabla.
      yPos += 7; // Espacio entre el texto de "Asignatura" y el inicio de la tabla

      const head = [
        [
          { content: 'Nombre Completo', rowSpan: 2, styles: { fillColor: [0, 203, 203] } },
          { content: 'Trimestre 1', colSpan: 2, styles: { fillColor: [0, 203, 203] } },
          { content: 'Trimestre 2', colSpan: 2, styles: { fillColor: [0, 203, 203] } },
          { content: 'Trimestre 3', colSpan: 2, styles: { fillColor: [0, 203, 203] } },
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
      const alumnosOrdenados = [...grupo.alumnos].sort((a, b) => {
        const resP = (a.apellidoPaterno || '').localeCompare(b.apellidoPaterno || '', undefined, { sensitivity: 'base' });
        if (resP !== 0) return resP;
        const resM = (a.apellidoMaterno || '').localeCompare(b.apellidoMaterno || '', undefined, { sensitivity: 'base' });
        if (resM !== 0) return resM;
        return (a.nombre || '').localeCompare(b.nombre || '', undefined, { sensitivity: 'base' });
      });

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
      showAlert("PDF generado exitosamente.");

    } catch (error) {
      console.error("Error al generar PDF:", error);
      showAlert("Error al cargar los datos de asistencia para el PDF.", "danger");
    }
  };




  if (error) {
    if (error === "SUSPENDED") {
      return (
        <div className="grupo-componente" style={{ padding: '50px', textAlign: 'center' }}>
          <div className="card shadow p-5 border-danger" style={{ maxWidth: '600px', margin: 'auto', backgroundColor: '#fff5f5' }}>
            <h2 className="text-danger" style={{ color: '#c53030' }}>Suscripción Suspendida</h2>
            <div style={{ fontSize: '1.2rem', margin: '20px 0', color: '#742a2a' }}>
              El acceso a la gestión de grupos ha sido pausado.
              Para continuar usando Scholaris, es necesario renovar la suscripción de la institución.
            </div>
            <button
              className="btn"
              style={{ backgroundColor: '#c53030', color: 'white', fontWeight: 'bold', padding: '12px 24px' }}
              onClick={() => window.location.href = '#pagar'}
            >
              RENOVAR AHORA
            </button>
            <p className="mt-4 small text-muted">Si acabas de realizar el pago, espera unos minutos a que se procese.</p>
          </div>
        </div>
      );
    }
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
      {loading && <LoadingOverlay message="Cargando grupos..." />}

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
      <ConfirmacionModal isOpen={!!grupoParaEliminar} onClose={() => setGrupoParaEliminar(null)} onConfirm={confirmarEliminacionGrupo} mensaje={`¿Seguro que deseas eliminar el grupo "${grupoParaEliminar?.nombre}"?`} />
      <ConfirmacionModal isOpen={!!alumnoParaEliminar} onClose={() => setAlumnoParaEliminar(null)} onConfirm={confirmarEliminacionAlumno} mensaje={`¿Seguro que deseas eliminar al alumno "${alumnoParaEliminar?.nombre}" de la lista?`} />
      <ConfirmacionModal isOpen={showUnsavedWarning} onClose={() => setShowUnsavedWarning(false)} onConfirm={() => cerrarModal(true)} mensaje="Tienes cambios sin guardar. ¿Estás seguro de que deseas salir?" />

      <div className="page-container">
        {user.role === 'admin' && (
          <div className="admin-view">
            <header className="main-header">
              <h1>Gestión de Grupos</h1>
              <div className="header-actions">
                <button className="btn btn-primary" onClick={() => abrirModal('gestionarGrupo')}>Crear Grupo</button>
                <button
                  className="btn btn-secondary"
                  style={{ background: 'linear-gradient(135deg, #00cbcb, #009999)', color: '#111', fontWeight: 'bold', border: 'none' }}
                  onClick={() => setIsPromoverModalOpen(true)}
                  title="Copiar o promover lista de alumnos entre grupos (ej. 1°A a 2°A)"
                >
                  📋 Paso de Grado (Promover)
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => abrirModal('importar')}>Importar Alumnos XLS</button>
                  <FaQuestionCircle
                    style={{ cursor: 'pointer', color: '#00CBCB', fontSize: '1.4rem' }}
                    onClick={() => setShowFormatGuide(true)}
                    title="Ver formato sugerido"
                  />
                </div>
              </div>
            </header>
            <h3 className="subtitulo">TODOS LOS GRUPOS EXISTENTES</h3>
            <div className="table-responsive-wrapper">
            <table className="grupos-table">
              <thead>
                <tr>
                  <th>Nombre del Grupo</th>
                  <th>Aula</th>
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
                    <td data-label="Aula">{grupo.aula || '---'}</td>
                    <td data-label="Asesor">{grupo.asesor || 'Sin Asignar'}</td>
                    <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                    <td data-label="Asignaciones">
                      {grupo.profesoresAsignados && grupo.profesoresAsignados.length > 0 ? (
                        <div className="teachers-collapsible-wrapper">
                          <button
                            type="button"
                            className="btn-toggle-teachers"
                            onClick={() => toggleTeachersExpand(grupo._id)}
                          >
                            {expandedTeachersGroups[grupo._id] 
                              ? `▲ Ocultar Profesores (${grupo.profesoresAsignados.length})` 
                              : `▼ Ver Profesores (${grupo.profesoresAsignados.length})`}
                          </button>
                          {expandedTeachersGroups[grupo._id] && (
                            <ul className="asignacion-lista animated-fade">
                              {[...grupo.profesoresAsignados]
                                .sort((a, b) => a.asignatura.localeCompare(b.asignatura))
                                .map((asig, index) => {
                                  const profName = asig.profesor
                                    ? `${asig.profesor.apellidoPaterno || ''} ${asig.profesor.apellidoMaterno || ''} ${asig.profesor.nombre || ''}`.replace(/\s+/g, ' ').trim()
                                    : 'Profesor Eliminado';
                                  return (
                                    <li key={index}>
                                      {profName}
                                      <span className="asignatura-text"> - {asig.asignatura}</span>
                                    </li>
                                  );
                                })}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.9rem', color: '#888' }}>Sin asignar</span>
                      )}
                    </td>
                    <td className="acciones-cell">
                      <button className="btn btn-primary" style={{ backgroundColor: '#00cbcb' }} onClick={() => { setCurrentGroupToAnalyze(grupo); setIsPerformanceModalOpen(true); }} title="Ver Rendimiento">📊</button>
                      <button className="btn btn-warning" onClick={() => abrirModal('gestionarGrupo', grupo)}>Editar</button>
                      <button className="btn btn-secondary" onClick={() => abrirModal('asignar', grupo)}>Asignar</button>
                      <button 
                        className="btn btn-info" 
                        style={{ backgroundColor: '#00cbcb', borderColor: '#00cbcb', color: '#111', fontWeight: 'bold' }} 
                        onClick={() => abrirModalListaMatriculas(grupo)}
                        title="Ver o descargar lista de alumnos y matrículas en PDF / XLS"
                      >
                        📋 Matrículas
                      </button>
                      <button 
                        className="btn btn-info" 
                        style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#111', fontWeight: 'bold' }} 
                        onClick={() => abrirModalTrabajoSocial(grupo)}
                        title="Abrir submódulo de Trabajo Social e historial disciplinario del grupo"
                      >
                        🤝 Trabajo Social
                      </button>
                      <button className="btn btn-export" onClick={() => exportarXLS(grupo)}>XLS</button>
                      <button className="btn btn-danger" onClick={() => handleEliminarGrupo(grupo)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
        {user.role === 'profesor' && (
          <div className="profesor-view">
            <header className="main-header"><h1>Mis Grupos Asignados</h1></header>
            <div className="table-responsive-wrapper">
            <table className="grupos-table">
              <thead>
                <tr>
                  <th>Nombre del Grupo</th>
                  <th>Aula</th>
                  <th>N° Alumnos</th>
                  <th>Mi Asignatura</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.flatMap(grupo => {
                  // Filtrar todas las asignaciones para este profesor
                  const misAsignaciones = grupo.profesoresAsignados.filter(asig => {
                    const assignedId = getSafeId(asig.profesor);
                    const currentUserId = getSafeId(user);
                    const idMatch = assignedId && currentUserId && (assignedId === currentUserId);

                    const assignedEmail = asig.profesor?.email?.toLowerCase();
                    const userEmail = user?.email?.toLowerCase();
                    const emailMatch = assignedEmail && userEmail && (assignedEmail === userEmail);

                    return idMatch || emailMatch;
                  });

                  // Retornar una fila por cada asignatura asignada
                  return misAsignaciones.map((asignacion, index) => (
                    <tr key={`${grupo._id}-${index}`}>
                      <td data-label="Grupo">{grupo.nombre}</td>
                      <td data-label="Aula">{grupo.aula || '---'}</td>
                      <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                      <td data-label="Mi Asignatura">{asignacion.asignatura}</td>
                      <td className="acciones-cell">
                        <button className="btn btn-primary" onClick={() => abrirModal('asistencia', grupo, asignacion.asignatura)}>Tomar Asistencia</button>
                        <button className="btn btn-export" onClick={() => {
                          if (user?.role === 'profesor') {
                            generarPDF(grupo, asignacion.asignatura, {});
                          } else {
                            setBrandingModal({
                              visible: true,
                              title: 'Reporte de Asistencia',
                              onConfirm: (brandingData) => generarPDF(grupo, asignacion.asignatura, brandingData)
                            });
                          }
                        }}>PDF</button>
                        <button 
                          className="btn btn-info" 
                          style={{ backgroundColor: '#00cbcb', borderColor: '#00cbcb', color: '#111', fontWeight: 'bold', marginLeft: '6px' }} 
                          onClick={() => abrirModalListaMatriculas(grupo)}
                          title="Obtener lista de alumnos y sus matrículas (PDF / XLS)"
                        >
                          📋 Lista y Matrículas
                        </button>
                        <button 
                          className="btn btn-info" 
                          style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#111', fontWeight: 'bold', marginLeft: '6px' }} 
                          onClick={() => abrirModalTrabajoSocial(grupo)}
                          title="Abrir submódulo de Trabajo Social e historial disciplinario del grupo"
                        >
                          🤝 Trabajo Social
                        </button>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
        {(modalVisible === 'gestionarGrupo') && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>
                <span>{grupoSeleccionado ? `Editar Grupo: ${grupoSeleccionado.nombre}` : 'Crear Nuevo Grupo'}</span>
                {grupoSeleccionado && (
                  <span className={`autosave-header-pill ${isSavingGrupo ? 'saving' : (hasChanges ? 'dirty' : 'saved')}`}>
                    {isSavingGrupo ? '⏳ Guardando...' : (hasChanges ? '✏️ Editando...' : '✓ Guardado automático activo')}
                  </span>
                )}
              </h2>
              <div className="modal-body-grid">
                {/* Columna 1: Información General */}
                <div className="modal-column-left">
                  <div className="form-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                      <span>Nombre del Grupo:</span>
                      {fieldSaveStatus.nombre === 'editing' && <span className="field-status-pill status-editing">Editando...</span>}
                      {fieldSaveStatus.nombre === 'saving' && <span className="field-status-pill status-saving">⏳ Guardando...</span>}
                      {fieldSaveStatus.nombre === 'saved' && <span className="field-status-pill status-saved">✓ Guardado</span>}
                    </label>
                    <input
                      type="text"
                      className={`input-autosave ${fieldSaveStatus.nombre ? `state-${fieldSaveStatus.nombre}` : ''}`}
                      value={nuevoGrupo.nombre}
                      onFocus={() => grupoSeleccionado && setTempFieldStatus('nombre', 'editing', 0)}
                      onChange={e => {
                        setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value });
                        setHasChanges(true);
                      }}
                      onBlur={() => handleGrupoFieldCommit('nombre')}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGrupoFieldCommit('nombre');
                        }
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                      <span>Asesor del Grupo:</span>
                      {fieldSaveStatus.asesor === 'editing' && <span className="field-status-pill status-editing">Editando...</span>}
                      {fieldSaveStatus.asesor === 'saving' && <span className="field-status-pill status-saving">⏳ Guardando...</span>}
                      {fieldSaveStatus.asesor === 'saved' && <span className="field-status-pill status-saved">✓ Guardado</span>}
                    </label>
                    <input
                      type="text"
                      className={`input-autosave ${fieldSaveStatus.asesor ? `state-${fieldSaveStatus.asesor}` : ''}`}
                      value={nuevoGrupo.asesor || ''}
                      onFocus={() => grupoSeleccionado && setTempFieldStatus('asesor', 'editing', 0)}
                      onChange={e => {
                        setNuevoGrupo({ ...nuevoGrupo, asesor: e.target.value });
                        setHasChanges(true);
                      }}
                      onBlur={() => handleGrupoFieldCommit('asesor')}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGrupoFieldCommit('asesor');
                        }
                      }}
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                      <span>Aula / Salón:</span>
                      {fieldSaveStatus.aula === 'editing' && <span className="field-status-pill status-editing">Editando...</span>}
                      {fieldSaveStatus.aula === 'saving' && <span className="field-status-pill status-saving">⏳ Guardando...</span>}
                      {fieldSaveStatus.aula === 'saved' && <span className="field-status-pill status-saved">✓ Guardado</span>}
                    </label>
                    <input
                      type="text"
                      className={`input-autosave ${fieldSaveStatus.aula ? `state-${fieldSaveStatus.aula}` : ''}`}
                      placeholder="Ej: Aula 10, Lab A..."
                      value={nuevoGrupo.aula || ''}
                      onFocus={() => grupoSeleccionado && setTempFieldStatus('aula', 'editing', 0)}
                      onChange={e => {
                        setNuevoGrupo({ ...nuevoGrupo, aula: e.target.value });
                        setHasChanges(true);
                      }}
                      onBlur={() => handleGrupoFieldCommit('aula')}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGrupoFieldCommit('aula');
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Columna 2: Formulario de Registro / Edición */}
                <div className="modal-column-center">
                  <div className={`alumno-form ${editingAlumno ? 'edit-mode' : ''} ${editingAlumno && rowSaveStatus[editingAlumno._id] ? `form-row-${rowSaveStatus[editingAlumno._id]}` : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <h4 className="form-subtitle" style={{ margin: 0, textAlign: 'left' }}>
                        {editingAlumno ? `Editando: ${editingAlumno.apellidoPaterno} ${editingAlumno.apellidoMaterno || ''} ${editingAlumno.nombre}`.replace(/\s+/g, ' ').trim() : 'Agregar Nuevo Alumno'}
                      </h4>
                      {editingAlumno && (
                        <span className={`row-status-badge status-${rowSaveStatus[editingAlumno._id] || (hasAlumnoChanged(alumnoInput, editingAlumno) ? 'editing' : 'idle')}`}>
                          {rowSaveStatus[editingAlumno._id] === 'saving'
                            ? '⏳ Guardando...'
                            : rowSaveStatus[editingAlumno._id] === 'saved'
                            ? '✓ Guardado'
                            : hasAlumnoChanged(alumnoInput, editingAlumno)
                            ? '✏️ Editando...'
                            : 'Seleccionado'}
                        </span>
                      )}
                    </div>
                    <div className="alumno-form-inputs">
                      <input 
                        ref={el => alumnoInputRefs.current[0] = el}
                        type="text" placeholder="Apellido Paterno" value={alumnoInput.apellidoPaterno} 
                        onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoPaterno: e.target.value })} 
                        onBlur={handleAlumnoFieldBlur}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()} 
                      />
                      <input 
                        ref={el => alumnoInputRefs.current[1] = el}
                        type="text" placeholder="Apellido Materno" value={alumnoInput.apellidoMaterno} 
                        onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoMaterno: e.target.value })} 
                        onBlur={handleAlumnoFieldBlur}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()} 
                      />
                      <input 
                        ref={el => alumnoInputRefs.current[2] = el}
                        type="text" placeholder="Nombre(s)" value={alumnoInput.nombre} 
                        onChange={(e) => setAlumnoInput({ ...alumnoInput, nombre: e.target.value })} 
                        onBlur={handleAlumnoFieldBlur}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()} 
                      />
                      <input 
                        ref={el => alumnoInputRefs.current[3] = el}
                        type="email" placeholder="Correo del Padre/Alumno" value={alumnoInput.emailPadre} 
                        onChange={(e) => setAlumnoInput({ ...alumnoInput, emailPadre: e.target.value })} 
                        onBlur={handleAlumnoFieldBlur}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()} 
                      />
                      <input 
                        ref={el => alumnoInputRefs.current[4] = el}
                        type="text" placeholder="Teléfono (Opcional)" value={alumnoInput.telefonoPadre || ''} 
                        onChange={(e) => setAlumnoInput({ ...alumnoInput, telefonoPadre: e.target.value })} 
                        onBlur={handleAlumnoFieldBlur}
                        onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()} 
                      />
                      
                      {/* Casilla y Fecha: Nuevo Ingreso */}
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <label className="checkbox-nuevo-ingreso-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#ffb703', fontWeight: 'bold' }}>
                          <input 
                            type="checkbox" 
                            checked={!!alumnoInput.esNuevoIngreso} 
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const today = new Date().toISOString().split('T')[0];
                              setAlumnoInput({
                                ...alumnoInput,
                                esNuevoIngreso: checked,
                                fechaIngreso: checked ? (alumnoInput.fechaIngreso || today) : ''
                              });
                            }} 
                            style={{ accentColor: '#ffb703', width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span>🌟 Alumno de Nuevo Ingreso (Ingresó a mitad de curso)</span>
                        </label>
                        {alumnoInput.esNuevoIngreso && (
                          <div style={{ marginTop: '6px', paddingLeft: '24px' }}>
                            <label style={{ fontSize: '0.78rem', color: '#ffb703', display: 'block', marginBottom: '3px' }}>Fecha de Ingreso:</label>
                            <input 
                              type="date" 
                              value={alumnoInput.fechaIngreso || ''} 
                              onChange={(e) => setAlumnoInput({ ...alumnoInput, fechaIngreso: e.target.value })} 
                              onBlur={handleAlumnoFieldBlur}
                              onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()}
                              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ffb703', backgroundColor: 'rgba(255,183,3,0.1)', color: '#fff' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Casilla y Fecha: Dado de Baja */}
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <label className="checkbox-baja-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#ff4d4d', fontWeight: 'bold' }}>
                          <input 
                            type="checkbox" 
                            checked={!!alumnoInput.esBaja} 
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const today = new Date().toISOString().split('T')[0];
                              setAlumnoInput({
                                ...alumnoInput,
                                esBaja: checked,
                                fechaBaja: checked ? (alumnoInput.fechaBaja || today) : ''
                              });
                            }} 
                            style={{ accentColor: '#ff4d4d', width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <span>🚫 Alumno Dado de Baja</span>
                        </label>
                        {alumnoInput.esBaja && (
                          <div style={{ marginTop: '6px', paddingLeft: '24px' }}>
                            <label style={{ fontSize: '0.78rem', color: '#ff4d4d', display: 'block', marginBottom: '3px' }}>Fecha de Baja:</label>
                            <input 
                              type="date" 
                              value={alumnoInput.fechaBaja || ''} 
                              onChange={(e) => setAlumnoInput({ ...alumnoInput, fechaBaja: e.target.value })} 
                              onBlur={handleAlumnoFieldBlur}
                              onKeyDown={e => e.key === 'Enter' && handleAgregarOActualizarAlumno()}
                              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ff4d4d', backgroundColor: 'rgba(255,77,77,0.1)', color: '#fff' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="alumno-form-actions alumno-form-actions-sticky" style={{ marginTop: '15px' }}>
                      <button className="btn btn-add" disabled={isSavingGrupo} onClick={handleAgregarOActualizarAlumno}>
                        {isSavingGrupo ? '⏳ Guardando...' : (editingAlumno ? (grupoSeleccionado ? '✓ Actualizar y Guardar' : 'Actualizar') : 'Agregar Alumno')}
                      </button>
                      {editingAlumno && (
                        <button className="btn btn-cancel" onClick={handleCancelarEdicion} style={{ padding: '8px' }}>Nuevo</button>
                      )}
                    </div>
                    {editingAlumno && <p className="key-hint">Auto-guardado con Enter o al cambiar de campo • ESC para cancelar</p>}
                  </div>
                </div>

                {/* Columna 3: Listado de Alumnos */}
                <div className="modal-column-right">
                  <div className="alumnos-list" ref={alumnosListRef} tabIndex={0}>
                    <div className="alumnos-count-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span>Alumnos en el grupo: {nuevoGrupo.alumnos.length}</span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            background: 'linear-gradient(135deg, #00cbcb, #009999)',
                            color: '#111',
                            fontWeight: 'bold',
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                          onClick={() => abrirModalListaMatriculas(nuevoGrupo)}
                          title="Ver o consultar lista de alumnos con sus matrículas"
                        >
                          📋 Lista y Matrículas
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            backgroundColor: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            padding: '3px 7px',
                            fontSize: '0.8rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                          onClick={() => exportarListaMatriculasPDF(nuevoGrupo)}
                          title="Descargar PDF con nombres y matrículas"
                        >
                          📄 PDF
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            backgroundColor: '#27ae60',
                            color: '#fff',
                            border: 'none',
                            padding: '3px 7px',
                            fontSize: '0.8rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                          onClick={() => exportarListaMatriculasXLS(nuevoGrupo)}
                          title="Descargar Excel con nombres y matrículas"
                        >
                          📊 XLS
                        </button>
                      </div>
                    </div>
                    <ul>
                      {nuevoGrupo.alumnos.map((a, index) => {
                        const isFirstNuevo = a.esNuevoIngreso && (index === 0 || !nuevoGrupo.alumnos[index - 1]?.esNuevoIngreso);
                        const rowSt = rowSaveStatus[a._id];
                        
                        return (
                          <React.Fragment key={a._id || index}>
                            {isFirstNuevo && (
                              <li className="divider-nuevo-ingreso-header" style={{
                                backgroundColor: 'rgba(255, 216, 102, 0.15)',
                                color: '#ffd866',
                                borderTop: '1px solid #ffd866',
                                borderBottom: '1px solid #ffd866',
                                padding: '6px 10px',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                                letterSpacing: '0.5px',
                                cursor: 'default',
                                marginTop: '8px',
                                marginBottom: '4px'
                              }}>
                                🌟 ALUMNOS DE NUEVO INGRESO (INGRESARON A MITAD DE CURSO)
                              </li>
                            )}
                            <li 
                              className={`${selectedAlumnoIndex === index ? 'selected' : ''} ${editingAlumno?._id === a._id ? 'editing' : ''} ${rowSt ? `row-state-${rowSt}` : ''}`}
                              onClick={() => handleSelectAlumno(index)}
                              style={{ 
                                cursor: 'pointer', 
                                background: a.esBaja ? 'rgba(255, 77, 77, 0.12)' : (a.esNuevoIngreso ? 'rgba(255, 216, 102, 0.08)' : undefined),
                                borderLeft: a.esBaja ? '4px solid #ff4d4d' : (a.esNuevoIngreso ? '4px solid #ffd866' : undefined)
                              }}
                            >
                              <span className="alumno-nombre-display" style={{ color: a.esBaja ? '#ff4d4d' : undefined }}>
                                <strong style={{ color: a.esBaja ? '#ff4d4d' : undefined }}>{a.matricula || '---'}</strong> - {`${index + 1}. ${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`}
                                {rowSt === 'saving' && (
                                  <span className="row-status-badge status-saving" style={{ marginLeft: '6px' }}>⏳ Guardando...</span>
                                )}
                                {rowSt === 'saved' && (
                                  <span className="row-status-badge status-saved" style={{ marginLeft: '6px' }}>✓ Guardado</span>
                                )}
                                {!rowSt && editingAlumno?._id === a._id && (
                                  <span className="row-status-badge status-editing" style={{ marginLeft: '6px' }}>✏️ Editando...</span>
                                )}
                                {a.esBaja ? (
                                  <span style={{
                                    backgroundColor: '#570000',
                                    color: '#ff4d4d',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 'bold',
                                    marginLeft: '6px',
                                    border: '1px solid #850404',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    🚫 Baja {a.fechaBaja ? `(${a.fechaBaja})` : ''}
                                  </span>
                                ) : (a.esNuevoIngreso && (
                                  <span style={{
                                    backgroundColor: '#574100',
                                    color: '#ffd866',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 'bold',
                                    marginLeft: '6px',
                                    border: '1px solid #856404',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    🌟 Nuevo {a.fechaIngreso ? `(${a.fechaIngreso})` : ''}
                                  </span>
                                ))}
                                <br />
                                <small style={{ color: a.esBaja ? '#ff9999' : '#666' }}>{a.emailPadre || 'Sin correo'} | {a.telefonoPadre || 'Sin tel'}</small>
                              </span>
                              <div className="alumno-actions">
                                <button className="btn-delete-alumno" onClick={(e) => { e.stopPropagation(); handleDeleteAlumno(a); }}><FaTrash /></button>
                              </div>
                            </li>
                          </React.Fragment>
                        );
                      })}
                    </ul>
                    <div className="list-hint">Tip: Usa las flechas ↑ ↓ para navegar</div>
                  </div>
                </div>
              </div>
              <div className="modal-actions modal-actions-sticky" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {nuevoGrupo.alumnos?.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        background: 'linear-gradient(135deg, #00cbcb, #008080)',
                        color: '#111',
                        fontWeight: 'bold',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px'
                      }}
                      onClick={() => abrirModalListaMatriculas(nuevoGrupo)}
                      title="Obtener lista de alumnos y sus matrículas en PDF o Excel"
                    >
                      📋 Obtener Lista de Matrículas (PDF / XLS)
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={isSavingGrupo} onClick={grupoSeleccionado ? handleUpdateGrupo : handleGuardarGrupo}>
                    {isSavingGrupo ? '⏳ Guardando...' : (grupoSeleccionado ? 'Guardar y Cerrar' : 'Guardar Grupo')}
                  </button>
                  <button className="btn btn-cancel" onClick={cerrarModal}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modalVisible === 'editarAlumno' && (
          <div className="modal-backdrop">
            <div className="modal-content modal-sm">
              <h2>Editar Alumno - {grupoSeleccionado?.nombre}</h2>
              <div className="alumno-form">
                <div className="alumno-form-inputs">
                  <input type="text" placeholder="Nombre(s)" value={alumnoInput.nombre} onChange={(e) => setAlumnoInput({ ...alumnoInput, nombre: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateAlumno()} />
                  <input type="text" placeholder="Apellido Paterno" value={alumnoInput.apellidoPaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoPaterno: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateAlumno()} />
                  <input type="text" placeholder="Apellido Materno" value={alumnoInput.apellidoMaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoMaterno: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateAlumno()} />
                  <input type="email" placeholder="Correo del Padre/Alumno" value={alumnoInput.emailPadre} onChange={(e) => setAlumnoInput({ ...alumnoInput, emailPadre: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateAlumno()} />
                  <input type="text" placeholder="Teléfono (Opcional)" value={alumnoInput.telefonoPadre || ''} onChange={(e) => setAlumnoInput({ ...alumnoInput, telefonoPadre: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleUpdateAlumno()} />
                  
                  {/* Casilla y Fecha: Nuevo Ingreso */}
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <label className="checkbox-nuevo-ingreso-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#ffb703', fontWeight: 'bold' }}>
                      <input 
                        type="checkbox" 
                        checked={!!alumnoInput.esNuevoIngreso} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const today = new Date().toISOString().split('T')[0];
                          setAlumnoInput({
                            ...alumnoInput,
                            esNuevoIngreso: checked,
                            fechaIngreso: checked ? (alumnoInput.fechaIngreso || today) : ''
                          });
                        }} 
                        style={{ accentColor: '#ffb703', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>🌟 Alumno de Nuevo Ingreso (Ingresó a mitad de curso)</span>
                    </label>
                    {alumnoInput.esNuevoIngreso && (
                      <div style={{ marginTop: '6px', paddingLeft: '24px' }}>
                        <label style={{ fontSize: '0.78rem', color: '#ffb703', display: 'block', marginBottom: '3px' }}>Fecha de Ingreso:</label>
                        <input 
                          type="date" 
                          value={alumnoInput.fechaIngreso || ''} 
                          onChange={(e) => setAlumnoInput({ ...alumnoInput, fechaIngreso: e.target.value })} 
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ffb703', backgroundColor: 'rgba(255,183,3,0.1)', color: '#fff' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Casilla y Fecha: Dado de Baja */}
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <label className="checkbox-baja-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', color: '#ff4d4d', fontWeight: 'bold' }}>
                      <input 
                        type="checkbox" 
                        checked={!!alumnoInput.esBaja} 
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const today = new Date().toISOString().split('T')[0];
                          setAlumnoInput({
                            ...alumnoInput,
                            esBaja: checked,
                            fechaBaja: checked ? (alumnoInput.fechaBaja || today) : ''
                          });
                        }} 
                        style={{ accentColor: '#ff4d4d', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>🚫 Alumno Dado de Baja</span>
                    </label>
                    {alumnoInput.esBaja && (
                      <div style={{ marginTop: '6px', paddingLeft: '24px' }}>
                        <label style={{ fontSize: '0.78rem', color: '#ff4d4d', display: 'block', marginBottom: '3px' }}>Fecha de Baja:</label>
                        <input 
                          type="date" 
                          value={alumnoInput.fechaBaja || ''} 
                          onChange={(e) => setAlumnoInput({ ...alumnoInput, fechaBaja: e.target.value })} 
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ff4d4d', backgroundColor: 'rgba(255,77,77,0.1)', color: '#fff' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-actions modal-actions-sticky">
                <button className="btn btn-primary" onClick={handleUpdateAlumno}>Actualizar y Guardar</button>
                <button className="btn btn-cancel" onClick={() => { setModalVisible('gestionarGrupo'); setEditingAlumno(null); }}>Volver</button>
              </div>
            </div>
          </div>
        )}

        {modalVisible === 'asignar' && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>Asignar Profesores: {grupoSeleccionado?.nombre}</h2>
              
              {/* BUSCADOR DE PROFESORES */}
              <div className="search-profesor-container" style={{ marginBottom: '15px' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar profesor por nombre o email..."
                  className="form-control"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                  value={searchTermProfesor}
                  onChange={(e) => setSearchTermProfesor(e.target.value)}
                />
              </div>

              <div className="profesores-list">
                {profesores
                  .filter(p => {
                    if (!searchTermProfesor) return true;
                    const term = searchTermProfesor.toLowerCase();
                    const fullP = `${p.nombre || ''} ${p.apellidoPaterno || ''} ${p.apellidoMaterno || ''}`.toLowerCase();
                    return fullP.includes(term) || p.email?.toLowerCase().includes(term);
                  })
                  .map((profesor, index) => {
                  const profId = getSafeId(profesor);
                  if (!profId) return null;

                  const nombreProfCompleto = `${profesor.apellidoPaterno || ''} ${profesor.apellidoMaterno || ''} ${profesor.nombre || ''}`.replace(/\s+/g, ' ').trim() || profesor.email || 'Sin Nombre';

                  return (
                    <div key={profId} className="asignacion-row-container">
                      <div className="profesor-header">
                        <strong>{nombreProfCompleto}</strong>
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
                            const val = e.target.value;
                            if (val) {
                              handleAddAsignatura(profId, val);
                              e.target.value = "";
                            }
                          }}
                          value=""
                        >
                          <option value="" disabled>Agregar asignatura...</option>
                          {(() => {
                            const dbAsigs = (materiasDb || []).map(m => (typeof m === 'object' ? m.nombre : m)).filter(Boolean);
                            
                            // Filtrar asignaturas del perfil del docente para que SOLO incluyan las registradas en esta escuela
                            const profAsigs = (profesor.asignaturas || []).filter(asig => 
                              dbAsigs.some(m => m.trim().toLowerCase() === String(asig).trim().toLowerCase())
                            );

                            // Si el docente tiene materias configuradas en su perfil que existen en la escuela, sugerimos únicamente esas.
                            // De lo contrario, se ofrecen todas las materias registradas en la escuela.
                            const candidateAsigs = profAsigs.length > 0 ? profAsigs : dbAsigs;

                            const allUnique = Array.from(new Set(candidateAsigs))
                              .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

                            const currentAssigned = asignaciones[profId] || [];
                            const available = allUnique.filter(asig => !currentAssigned.includes(asig));

                            if (allUnique.length === 0) {
                              return <option disabled>No hay materias registradas en esta escuela (Créalos en Inicio)</option>;
                            }

                            if (available.length === 0) {
                              return <option disabled>Todas las asignaturas ya están agregadas</option>;
                            }

                            return available.map(asig => (
                              <option key={asig} value={asig}>{asig}</option>
                            ));
                          })()}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {/* NUEVO: SECCIÓN DE ASIGNACIONES HUÉRFANAS */}
                {Object.keys(asignaciones).some(id => id && id !== '[object Object]' && !id.includes('[object') && !profesores.some(p => getSafeId(p) === id)) && (
                  <div className="orphaned-section" style={{ marginTop: '20px', borderTop: '1px dashed #666', paddingTop: '15px' }}>
                    <h4 style={{ color: '#e67e22', marginBottom: '10px', fontSize: '0.9rem' }}>
                      ⚠️ Asignaciones detectadas para IDs no listados (profesores externos o desactualizados):
                    </h4>
                    {Object.keys(asignaciones)
                      .filter(id => id && id !== '[object Object]' && !id.includes('[object') && !profesores.some(p => getSafeId(p) === id))
                      .map(id => (
                        <div key={id} className="asignacion-row-container orphaned" style={{ opacity: 0.8, backgroundColor: 'rgba(230, 126, 34, 0.05)' }}>
                           <div className="profesor-header">
                            <strong style={{ color: '#e67e22' }}>ID: {id}</strong>
                          </div>
                          <div className="asignaturas-asignadas">
                            {asignaciones[id].map((asig, idx) => (
                              <div key={idx} className="asignatura-tag" style={{ backgroundColor: '#555' }}>
                                {asig}
                                <button className="btn-remove-tag" onClick={() => handleRemoveAsignatura(id, asig)}><FaTimes /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
              <div className="modal-actions modal-actions-sticky">
                <button className="btn btn-primary" onClick={handleGuardarAsignacion}>Guardar Cambios</button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
        {modalVisible === 'asistencia' && (
          <div className="modal-backdrop">
            <div className="modal-content asistencia-modal-content grupo-componente">
              <h2>Toma de Asistencia: {grupoSeleccionado?.nombre} - {asignaturaActual}</h2>

              {/* Selector de Trimestre Global, Botón de Guardar y Botón Pincel 🖌️ */}
              <div className="bimestre-selector" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
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

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* BOTÓN GUARDAR ASISTENCIA (VISIBILIDAD Y AUTOGUARDADO SUPERIOR) */}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #00cbcb, #008080)',
                      color: '#111',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(0, 203, 203, 0.4)'
                    }}
                    onClick={guardarAsistencia}
                    title="Guardar asistencia manualmente"
                  >
                    💾 Guardar Asistencia {autoSavingStatus && <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(255,255,255,0.25)', color: '#000', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>{autoSavingStatus}</span>}
                  </button>

                  {/* BOTÓN PINCEL 🖌️ PARA PERSONALIZAR ESTADOS DE ASISTENCIA */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      background: 'linear-gradient(135deg, #8e44ad, #9c27b0)',
                      color: '#fff',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(156, 39, 176, 0.3)'
                    }}
                    onClick={() => setIsPincelModalOpen(true)}
                    title="Personalizar botones de asistencia (Agregar O de Orquesta, Obs, etc.)"
                  >
                    🖌️ Personalizar Estados
                  </button>

                  {/* BOTÓN VER / DESCARGAR MATRÍCULAS */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#fff',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
                    }}
                    onClick={() => abrirModalListaMatriculas(grupoSeleccionado)}
                    title="Ver o descargar lista de alumnos con sus matrículas"
                  >
                    📋 Lista y Matrículas
                  </button>

                  {/* BOTÓN SUBMÓDULO DE TRABAJO SOCIAL */}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#111',
                      fontWeight: 'bold',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'
                    }}
                    onClick={() => abrirModalTrabajoSocial(grupoSeleccionado)}
                    title="Abrir submódulo de Trabajo Social e historial disciplinario del grupo"
                  >
                    🤝 Trabajo Social
                  </button>
                </div>
              </div>

              {/* LEYENDA DE ESTADOS ACTIVOS Y TIP DE TOTALES */}
              <div className="asistencia-legend-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '12px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 'bold', color: '#00cbcb' }}>Botones activos:</span>
                  {attendanceStatuses.map(st => (
                    <span key={st.code} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: st.color,
                        color: '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {st.code}
                      </span>
                      <span>{st.label}</span>
                    </span>
                  ))}
                </div>
                <div style={{ color: '#ffd866', fontSize: '0.8rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💡 <span>Haz clic en <strong>"📊 Totales ▶"</strong> para desplegar u ocultar el desglose.</span>
                </div>
              </div>

              <div className="asistencia-grid">
                <div className="tabla-global-container" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  <table className="tabla-global">
                    <thead>
                      <tr>
                        <th className="num-col" style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}>#</th>
                        <th className="matricula-col" style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}>ID</th>
                        <th className="alumno-col" style={{ width: '250px', minWidth: '250px' }}>Alumno</th>
                        <th style={{ width: isTotalesExpanded ? '150px' : '110px', minWidth: isTotalesExpanded ? '150px' : '110px', textAlign: 'center', padding: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setIsTotalesExpanded(!isTotalesExpanded)}
                            style={{
                              background: isTotalesExpanded ? 'linear-gradient(135deg, #ff9800, #e67e22)' : 'linear-gradient(135deg, #00cbcb, #009999)',
                              color: '#0d1b2a',
                              border: 'none',
                              borderRadius: '20px',
                              padding: '5px 12px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              boxShadow: isTotalesExpanded ? '0 2px 8px rgba(230, 126, 34, 0.4)' : '0 2px 8px rgba(0, 203, 203, 0.4)',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap'
                            }}
                            title={isTotalesExpanded ? "Clic para contraer desglose de totales" : "Clic para desplegar desglose completo de totales"}
                          >
                            📊 Totales {isTotalesExpanded ? '▼' : '▶'}
                          </button>
                        </th>
                         {Array.from({ length: diasPorBimestre[bimestreActivo] || DIAS_INICIALES }).map((_, i) => (
                           <th key={i} style={{ width: '30px', minWidth: '30px', textAlign: 'center', fontSize: '0.8rem' }}>{i + 1}</th>
                         ))}
                         <th style={{ width: '40px', minWidth: '40px' }}>
                           <button className="btn-agregar-dias" onClick={() => agregarDias(bimestreActivo)} title="Agregar días">+5</button>
                         </th>
                       </tr>
                     </thead>
                     <tbody>
                       {(() => {
                         const sortedAlumnos = sortAlumnosWithStatus(grupoSeleccionado?.alumnos || []);
                         const totalDias = diasPorBimestre[bimestreActivo] || DIAS_INICIALES;
                         return sortedAlumnos.map((alumno, index) => {
                           const isFirstNuevo = alumno.esNuevoIngreso && (index === 0 || !sortedAlumnos[index - 1]?.esNuevoIngreso);
                           const totales = calcularTotales(alumno._id, bimestreActivo, asistencia, diasPorBimestre);
                           const isHighlighted = highlightedAlumnoId === alumno._id;
                           return (
                             <React.Fragment key={alumno._id}>
                               {isFirstNuevo && (
                                 <tr className="divider-nuevo-ingreso-row" style={{ backgroundColor: 'rgba(255, 216, 102, 0.18)', color: '#ffd866', fontWeight: 'bold' }}>
                                   <td colSpan={5 + totalDias} style={{ padding: '6px 12px', fontSize: '0.78rem', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                     🌟 ALUMNOS DE NUEVO INGRESO (INGRESARON A MITAD DE CURSO)
                                   </td>
                                 </tr>
                               )}
                               
                               <tr className={`${isHighlighted ? 'highlight-row' : ''} ${alumno.esBaja ? 'row-baja' : (alumno.esNuevoIngreso ? 'row-nuevo-ingreso' : '')}`} style={{ backgroundColor: alumno.esBaja ? 'rgba(255, 77, 77, 0.12)' : (alumno.esNuevoIngreso ? 'rgba(255, 216, 102, 0.08)' : undefined), color: alumno.esBaja ? '#ff4d4d' : undefined }}>
                                  <td className="num-col" style={{ textAlign: 'center', color: alumno.esBaja ? '#ff4d4d' : undefined, fontWeight: alumno.esBaja ? 'bold' : undefined }}>{index + 1}</td>
                                  <td className="matricula-col" style={{ textAlign: 'center', fontWeight: 'bold', color: alumno.esBaja ? '#ff4d4d' : undefined }}>{alumno.matricula || '---'}</td>
                                  <td className="alumno-col notranslate" translate="no" style={{ color: alumno.esBaja ? '#ff4d4d' : undefined, fontWeight: alumno.esBaja ? '600' : undefined }}>
                                   {alumno.apellidoPaterno} {alumno.apellidoMaterno || ''} {alumno.nombre}
                                   {alumno.esBaja ? (
                                     <span style={{
                                       backgroundColor: '#570000',
                                       color: '#ff4d4d',
                                       padding: '1px 5px',
                                       borderRadius: '4px',
                                       fontSize: '0.7rem',
                                       fontWeight: 'bold',
                                       marginLeft: '6px',
                                       border: '1px solid #850404'
                                     }}>
                                       🚫 Baja {alumno.fechaBaja ? `(${alumno.fechaBaja})` : ''}
                                     </span>
                                   ) : (alumno.esNuevoIngreso && (
                                     <span style={{
                                       backgroundColor: '#574100',
                                       color: '#ffd866',
                                       padding: '1px 5px',
                                       borderRadius: '4px',
                                       fontSize: '0.7rem',
                                       fontWeight: 'bold',
                                       marginLeft: '6px',
                                       border: '1px solid #856404'
                                     }}>
                                       🌟 Nuevo {alumno.fechaIngreso ? `(${alumno.fechaIngreso})` : ''}
                                     </span>
                                   ))}
                                 </td>
                                 <td style={{ textAlign: 'center', fontSize: '0.85rem', padding: '4px 6px' }}>
                                   {!isTotalesExpanded ? (
                                     <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                                       <span style={{ color: 'var(--success-color)' }} title={`Presentes / Asistencias: ${totales.presentes}`}>✅{totales.presentes}</span>
                                       <span style={{ color: 'var(--danger-color)' }} title={`Faltas / Inasistencias: ${totales.faltas}`}>❌{totales.faltas}</span>
                                     </div>
                                   ) : (
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                       <span style={{ color: 'var(--success-color)' }}>✅ {totales.presentes}</span>
                                       <span style={{ color: 'var(--danger-color)' }}>❌ {totales.faltas}</span>
                                       <span style={{ color: 'var(--warning-color)' }}>⚠️ {totales.justificados}</span>
                                       <span style={{ color: '#ff9800' }}>🕒 {totales.retardos}</span>
                                       {Object.entries(totales.customCounts || {}).map(([cCode, count]) => {
                                         const stConf = getStatusConfig(cCode);
                                         if (count === 0 && !stConf) return null;
                                         return (
                                           <span key={cCode} style={{ color: stConf?.color || '#9c27b0', fontWeight: 'bold' }}>
                                             {stConf?.icon || '🎨'} {cCode}: {count}
                                           </span>
                                         );
                                       })}
                                     </div>
                                   )}
                                 </td>
                                {Array.from({ length: totalDias }).map((_, diaIndex) => {
                                  const key = `${alumno._id}-b${bimestreActivo}-d${diaIndex + 1}`;
                                  const registro = asistencia[key];
                                  const stConf = getStatusConfig(registro?.estado);
                                  return (
                                    <td key={diaIndex} style={{ padding: '2px', textAlign: 'center' }}>
                                      <div
                                        className={`cuadrito ${stConf ? 'custom-active' : ''}`}
                                        style={{
                                          margin: '0 auto',
                                          backgroundColor: stConf ? stConf.color : undefined,
                                          color: '#ffffff',
                                          fontWeight: 'bold',
                                          border: stConf ? `1px solid ${stConf.color}` : undefined
                                        }}
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
                            </React.Fragment>
                          );
                        });
                      })()}
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
              <div className="modal-actions modal-actions-sticky">
                <button className="btn btn-primary" onClick={guardarAsistencia}>Guardar Asistencia</button>
                <button className="btn btn-cancel" onClick={cerrarModal}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PINCEL 🖌️ PERSONALIZAR ESTADOS DE ASISTENCIA */}
        {isPincelModalOpen && (
          <div className="modal-backdrop" style={{ zIndex: 2500 }}>
            <div className="modal-content modal-md" style={{ maxWidth: '550px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00cbcb' }}>
                🖌️ Personalizar Botones de Asistencia
              </h2>
              <p style={{ fontSize: '0.88rem', color: '#ccc', marginBottom: '15px' }}>
                Configura los botones personalizados que se alternarán al hacer clic en los cuadritos de asistencia (ejemplo: <strong>'O'</strong> para <strong>Orquesta</strong>, <strong>'Obs'</strong> para <strong>Observaciones</strong>).
              </p>

              {/* LISTA DE BOTONES ACTUALES */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#00cbcb', marginBottom: '8px' }}>Botones Configurados:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {attendanceStatuses.map(st => {
                    const isBase = ['P', 'F', 'J', 'R'].includes(st.code);
                    const eqMap = { P: 'Presente', F: 'Falta' };
                    return (
                      <div
                        key={st.code}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          border: `1px solid ${st.color}`
                        }}
                      >
                        <span style={{
                          backgroundColor: st.color,
                          color: '#fff',
                          fontWeight: 'bold',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85rem'
                        }}>
                          {st.code}
                        </span>
                        <span style={{ fontSize: '0.9rem' }}>{st.label}</span>
                        {!isBase && (
                          <span style={{ fontSize: '0.73rem', color: '#ffd866', backgroundColor: 'rgba(255, 216, 102, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                            (Gráfica: {eqMap[st.equivalent || 'P'] || 'Presente'})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditStatusInit(st)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#00cbcb',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '0 2px',
                            lineHeight: 1
                          }}
                          title="Editar color o descripción de este botón"
                        >
                          ✏️
                        </button>
                        {!isBase && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomStatus(st.code)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ff4d4d',
                              cursor: 'pointer',
                              fontSize: '1.1rem',
                              padding: '0 2px',
                              lineHeight: 1
                            }}
                            title="Eliminar botón personalizado"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FORMULARIO AGREGAR / EDITAR BOTÓN */}
              <div style={{ backgroundColor: 'rgba(0,0,0,0.25)', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#ffd866', marginBottom: '10px' }}>
                  {editingStatusConfig ? `✏️ Editar Botón: "${editingStatusConfig.code}"` : '+ Agregar Nuevo Botón Personalizado'}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>Letra / Código:</label>
                    <input
                      type="text"
                      placeholder="Ej: O, Obs"
                      maxLength={4}
                      disabled={!!editingStatusConfig}
                      value={newStatusInput.code}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, code: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #555', backgroundColor: editingStatusConfig ? '#333' : '#222', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>Significado / Descripción:</label>
                    <input
                      type="text"
                      placeholder="Ej: Orquesta, Taller..."
                      value={newStatusInput.label}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, label: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                    />
                  </div>
                </div>

                {/* SELECTOR DE EQUIVALENCIA EN REPORTES Y GRÁFICAS (ÚNICAMENTE PRESENTE O FALTA) */}
                {!['P', 'F', 'J', 'R'].includes(newStatusInput.code) && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>
                      Equivalencia para Gráficas / Reportes (¿Cómo contabilizar?):
                    </label>
                    <select
                      value={newStatusInput.equivalent || 'P'}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, equivalent: e.target.value })}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #555', backgroundColor: '#222', color: '#fff' }}
                    >
                      <option value="P">✅ Sumar como Presente (Asistencia cumplida)</option>
                      <option value="F">❌ Sumar como Falta (Inasistencia / No cumplió)</option>
                    </select>
                  </div>
                )}

                {/* SELECTOR DE COLOR PRESET */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '6px' }}>Color del Botón:</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {PRESET_STATUS_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewStatusInput({ ...newStatusInput, color: c })}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: c,
                          border: newStatusInput.color === c ? '3px solid #fff' : '1px solid #444',
                          cursor: 'pointer',
                          boxShadow: newStatusInput.color === c ? '0 0 8px ' + c : 'none'
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={newStatusInput.color}
                      onChange={(e) => setNewStatusInput({ ...newStatusInput, color: e.target.value })}
                      style={{ width: '32px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                      title="Elegir color personalizado"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, background: 'linear-gradient(135deg, #00cbcb, #009999)', color: '#111', fontWeight: 'bold' }}
                    onClick={handleAddOrUpdateCustomStatus}
                  >
                    {editingStatusConfig ? '💾 Guardar Cambios del Botón' : '+ Guardar Nuevo Botón'}
                  </button>
                  {editingStatusConfig && (
                    <button
                      type="button"
                      className="btn btn-cancel"
                      style={{ backgroundColor: '#666' }}
                      onClick={handleCancelEditStatus}
                    >
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-cancel"
                  style={{ backgroundColor: '#555', fontSize: '0.8rem' }}
                  onClick={handleResetStatuses}
                >
                  Restablecer por Defecto
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsPincelModalOpen(false)}
                >
                  Listo / Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
        {modalVisible === 'importar' && (
          <div className="modal-backdrop">
            <div className="modal-content modal-sm" style={{ position: 'relative' }}>
              <FaQuestionCircle
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  cursor: 'pointer',
                  color: '#00CBCB',
                  fontSize: '1.2rem'
                }}
                onClick={() => setShowFormatGuide(true)}
                title="Ver formato sugerido"
              />
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

        {showFormatGuide && (
          <div className="modal-backdrop" onClick={() => setShowFormatGuide(false)} style={{ zIndex: 4000 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h2 style={{ margin: 0 }}>Formato Sugerido para Importar</h2>
                <FaTimes style={{ cursor: 'pointer', fontSize: '1.5rem' }} onClick={() => setShowFormatGuide(false)} />
              </div>
              <p style={{ color: '#666', marginBottom: '20px' }}>
                Asegúrate de que tu archivo Excel contenga los nombres comenzando por Apellidos o en este orden:
                <br />
                <strong>N°, Apellido Paterno, Apellido Materno, Nombre(s)</strong> (o el nombre completo en una sola celda)
              </p>
              <img
                src={importFormatImg}
                alt="Formato sugerido"
                style={{ width: '100%', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
              />
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button className="btn btn-primary" onClick={() => setShowFormatGuide(false)}>Entendido</button>
              </div>
            </div>
          </div>
        )}

        {modalListaMatriculasGrupo && (() => {
          const todosAlumnos = sortAlumnosWithStatus(modalListaMatriculasGrupo.alumnos || []);
          const term = (filtroMatricula || '').toLowerCase().trim();
          const filtrados = term 
            ? todosAlumnos.filter(a => {
                const nombreCompleto = `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.toLowerCase();
                const mat = (a.matricula || '').toLowerCase();
                return nombreCompleto.includes(term) || mat.includes(term);
              })
            : todosAlumnos;

          const totalActivos = todosAlumnos.filter(a => !a.esBaja).length;
          const totalBajas = todosAlumnos.filter(a => a.esBaja).length;
          const totalNuevos = todosAlumnos.filter(a => a.esNuevoIngreso && !a.esBaja).length;

          return (
            <div className="modal-backdrop" onClick={() => setModalListaMatriculasGrupo(null)} style={{ zIndex: 3500 }}>
              <div 
                className="modal-content modal-matriculas-content" 
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}
              >
                {/* Modal Header with Tabs: Matrículas | Trabajo Social */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: '1px solid #00cbcb',
                          background: 'linear-gradient(135deg, #00cbcb, #009999)',
                          color: '#111',
                          fontWeight: '800',
                          fontSize: '0.88rem',
                          cursor: 'default'
                        }}
                      >
                        📋 Matrículas: {modalListaMatriculasGrupo.nombre}
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirModalTrabajoSocial(modalListaMatriculasGrupo)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#fbbf24',
                          fontWeight: '700',
                          fontSize: '0.88rem',
                          cursor: 'pointer'
                        }}
                        title="Cambiar a la pestaña de Trabajo Social de este grupo"
                      >
                        🤝 Trabajo Social
                      </button>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: '#aaa', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span><strong>Aula:</strong> {modalListaMatriculasGrupo.aula || 'S/A'}</span>
                      <span><strong>Asesor:</strong> {modalListaMatriculasGrupo.asesor || 'Sin asignar'}</span>
                      <span><strong>Total:</strong> {todosAlumnos.length} alumnos ({totalActivos} activos{totalBajas > 0 ? `, ${totalBajas} bajas` : ''}{totalNuevos > 0 ? `, ${totalNuevos} nuevo ingreso` : ''})</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    className="btn btn-cancel" 
                    style={{ padding: '6px 12px', fontSize: '1rem', minWidth: 'auto', borderRadius: '6px' }}
                    onClick={() => setModalListaMatriculasGrupo(null)}
                  >
                    ✕
                  </button>
                </div>

                {/* Toolbar: Search & Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Buscar por nombre o matrícula..."
                      value={filtroMatricula}
                      onChange={(e) => setFiltroMatricula(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '9px 14px', 
                        borderRadius: '8px', 
                        fontSize: '0.92rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ 
                        backgroundColor: '#27ae60', 
                        color: '#fff', 
                        border: 'none', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '0.86rem',
                        fontWeight: 'bold',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        boxShadow: '0 2px 6px rgba(39, 174, 96, 0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => exportarListaMatriculasXLS(modalListaMatriculasGrupo)}
                      title="Descargar archivo Excel con nombres y matrículas"
                    >
                      📊 Excel (XLS)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ 
                        backgroundColor: '#e74c3c', 
                        color: '#fff', 
                        border: 'none', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '0.86rem',
                        fontWeight: 'bold',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        boxShadow: '0 2px 6px rgba(231, 76, 60, 0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => exportarListaMatriculasPDF(modalListaMatriculasGrupo)}
                      title="Descargar documento PDF con nombres y matrículas"
                    >
                      📄 Descargar PDF
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ 
                        backgroundColor: copiadoFeedback ? '#2ecc71' : '#334155', 
                        color: '#fff', 
                        border: 'none', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '0.86rem',
                        fontWeight: 'bold',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onClick={() => copiarListaMatriculas(todosAlumnos, modalListaMatriculasGrupo.nombre)}
                      title="Copiar lista de nombres y matrículas al portapapeles"
                    >
                      {copiadoFeedback ? '✅ ¡Copiado!' : '📋 Copiar'}
                    </button>
                  </div>
                </div>

                {/* Table container */}
                <div style={{ flex: '1', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', maxHeight: '52vh' }}>
                  <table className="tabla-matriculas-modal" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '45px' }}>#</th>
                        <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '150px' }}>Matrícula</th>
                        <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb' }}>Nombre Completo del Alumno</th>
                        <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '130px' }}>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.length > 0 ? (
                        filtrados.map((a, idx) => {
                          const nombreCompleto = `${a.apellidoPaterno || ''} ${a.apellidoMaterno || ''} ${a.nombre || ''}`.replace(/\s+/g, ' ').trim();
                          const mat = a.matricula || '---';
                          return (
                            <tr key={a._id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: a.esBaja ? 'rgba(255,77,77,0.12)' : (a.esNuevoIngreso ? 'rgba(255,216,102,0.08)' : undefined) }}>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: a.esBaja ? '#ff4d4d' : '#888', padding: '10px' }}>{idx + 1}</td>
                              <td style={{ textAlign: 'center', padding: '10px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  backgroundColor: a.esBaja ? 'rgba(255, 77, 77, 0.15)' : 'rgba(0, 203, 203, 0.12)',
                                  color: a.esBaja ? '#ff4d4d' : '#00cbcb',
                                  border: a.esBaja ? '1px solid rgba(255, 77, 77, 0.4)' : '1px solid rgba(0, 203, 203, 0.35)',
                                  borderRadius: '5px',
                                  fontFamily: 'monospace',
                                  fontWeight: 'bold',
                                  fontSize: '0.95rem'
                                }}>
                                  {mat}
                                </span>
                              </td>
                              <td style={{ padding: '10px', fontWeight: '500', color: a.esBaja ? '#ff4d4d' : '#fff' }}>
                                {nombreCompleto}
                              </td>
                              <td style={{ textAlign: 'center', padding: '10px' }}>
                                {a.esBaja ? (
                                  <span style={{
                                    backgroundColor: 'rgba(255, 77, 77, 0.15)',
                                    color: '#ff4d4d',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(255, 77, 77, 0.3)'
                                  }}>
                                    🚫 Baja {a.fechaBaja ? `(${a.fechaBaja})` : ''}
                                  </span>
                                ) : a.esNuevoIngreso ? (
                                  <span style={{
                                    backgroundColor: 'rgba(255, 216, 102, 0.15)',
                                    color: '#ffd866',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(255, 216, 102, 0.3)'
                                  }}>
                                    🌟 Nuevo {a.fechaIngreso ? `(${a.fechaIngreso})` : ''}
                                  </span>
                                ) : (
                                  <span style={{
                                    backgroundColor: 'rgba(39, 174, 96, 0.15)',
                                    color: '#2ecc71',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    border: '1px solid rgba(39, 174, 96, 0.3)'
                                  }}>
                                    ✅ Activo
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
                            No se encontraron alumnos que coincidan con "{filtroMatricula}".
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#888' }}>
                    Mostrando {filtrados.length} de {todosAlumnos.length} alumnos
                  </span>
                  <button className="btn btn-cancel" onClick={() => setModalListaMatriculasGrupo(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {modalTrabajoSocialGrupo && (
          <TrabajoSocialModal
            grupo={modalTrabajoSocialGrupo}
            onClose={() => setModalTrabajoSocialGrupo(null)}
            onSwitchToMatriculas={(g) => abrirModalListaMatriculas(g)}
            onGrupoUpdated={(grupoActualizado) => {
              setModalTrabajoSocialGrupo(grupoActualizado);
              setGrupos(prev => prev.map(g => String(g._id) === String(grupoActualizado._id) ? grupoActualizado : g));
              if (grupoSeleccionado && String(grupoSeleccionado._id) === String(grupoActualizado._id)) {
                setGrupoSeleccionado(grupoActualizado);
              }
            }}
            schoolConfig={schoolConfig}
            defaultLogo={logoImage}
            showAlert={showAlert}
          />
        )}

        <GroupPerformanceModal 
          isOpen={isPerformanceModalOpen}
          onClose={() => setIsPerformanceModalOpen(false)}
          grupo={currentGroupToAnalyze}
          schoolConfig={schoolConfig}
        />

        <PromoverAlumnosModal
          isOpen={isPromoverModalOpen}
          onClose={() => setIsPromoverModalOpen(false)}
          grupos={grupos}
          onSuccess={() => {
            const token = localStorage.getItem('token');
            if (token) {
              axios.get(`${API_URL}/grupos`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => setGrupos(res.data))
                .catch(err => console.error(err));
            }
          }}
        />
      </div>
    </div>
  );

}

export default Grupo;