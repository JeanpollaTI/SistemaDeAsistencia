import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import {
  FaArrowLeft,
  FaSave,
  FaCalendarAlt,
  FaChartBar,
  FaTable,
  FaUserShield,
  FaUserPlus,
  FaCheckCircle,
  FaLock,
  FaFilePdf,
  FaFileExcel,
  FaChevronLeft,
  FaChevronRight,
  FaBolt,
  FaEraser,
  FaPaperclip,
  FaFileUpload,
  FaDownload,
  FaTimes,
  FaSpinner
} from 'react-icons/fa';
import apiClient from '../../api/apiClient';
import './Extensions.css';

export const GRUPOS_15 = [
  '1° A', '1° B', '1° C', '1° D', '1° E',
  '2° A', '2° B', '2° C', '2° D', '2° E',
  '3° A', '3° B', '3° C', '3° D', '3° E'
];

export const MESES_10 = [
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio'
];

// Mapa de las 40 semanas del ciclo escolar (4 semanas por cada uno de los 10 meses)
export const SEMANAS_40 = Array.from({ length: 40 }, (_, idx) => {
  const num = idx + 1;
  const mesIdx = Math.min(9, Math.floor(idx / 4));
  const semanaDelMes = (idx % 4) + 1;
  return {
    numero: num,
    label: `Semana ${num}`,
    mes: MESES_10[mesIdx],
    semanaDelMes
  };
});

const getBadgeColorByPct = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(Number(val))) {
    return { bg: 'rgba(255,255,255,0.05)', text: '#94a3b8', border: 'rgba(255,255,255,0.12)', bar: '#475569', label: 'Sin captura' };
  }
  const num = Number(val);
  if (num >= 90) {
    return { bg: 'rgba(34, 197, 94, 0.16)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.4)', bar: '#22c55e', label: 'Óptimo' };
  }
  if (num >= 75) {
    return { bg: 'rgba(0, 203, 203, 0.16)', text: '#00cbcb', border: 'rgba(0, 203, 203, 0.4)', bar: '#00cbcb', label: 'Bueno' };
  }
  if (num >= 60) {
    return { bg: 'rgba(245, 158, 11, 0.16)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)', bar: '#f59e0b', label: 'Regular' };
  }
  return { bg: 'rgba(239, 68, 68, 0.16)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)', bar: '#ef4444', label: 'Bajo' };
};

const formatTeacherName = (p) => {
  if (!p) return '';
  if (typeof p === 'string') return p;
  return `${p.nombre || ''} ${p.apellidoPaterno || ''} ${p.apellidoMaterno || ''}`.replace(/\s+/g, ' ').trim() || p.email || '';
};

const ReflexionSerenaView = ({ user, embeddedTemplateId = null }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('CAPTURA'); // 'CAPTURA' | 'RESUMEN' | 'SABANA'
  const [cicloEscolar, setCicloEscolar] = useState('2025-2026');
  const [selectedSemana, setSelectedSemana] = useState(1);
  const [selectedMesSemana, setSelectedMesSemana] = useState('Septiembre');
  const [filtroMesResumen, setFiltroMesResumen] = useState('TODOS');
  const [filtroGrado, setFiltroGrado] = useState('TODOS');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [resumenMensual, setResumenMensual] = useState(null);
  const [profesores, setProfesores] = useState([]);
  const [capturistas, setCapturistas] = useState([]);
  const [templateId, setTemplateId] = useState(embeddedTemplateId);
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Estado local del formulario de los 15 grupos para la semana activa: { '1° A': '95', ... }
  const [formSemana, setFormSemana] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [rowSaveStatus, setRowSaveStatus] = useState({}); // { [grupo]: 'editing' | 'saving' | 'saved' | 'error' }
  const rowStatusTimersRef = useRef({});

  const setTempRowStatus = (grupoKey, status, clearAfterMs = 2800) => {
    if (!grupoKey) return;
    if (rowStatusTimersRef.current[grupoKey]) {
      clearTimeout(rowStatusTimersRef.current[grupoKey]);
    }
    setRowSaveStatus(prev => ({ ...prev, [grupoKey]: status }));
    if (clearAfterMs > 0) {
      rowStatusTimersRef.current[grupoKey] = setTimeout(() => {
        setRowSaveStatus(prev => {
          const next = { ...prev };
          delete next[grupoKey];
          return next;
        });
      }, clearAfterMs);
    }
  };

  // Modal de Gestión de Capturista de Reflexión Serena (Admin)
  const [isCapturistaModalOpen, setIsCapturistaModalOpen] = useState(false);
  const [capturistaModalTab, setCapturistaModalTab] = useState('ASIGNAR'); // 'ASIGNAR' | 'ALTA'
  const [selectedCapturistaIds, setSelectedCapturistaIds] = useState([]);
  const [savingCapturistas, setSavingCapturistas] = useState(false);
  const [nuevaCapturista, setNuevaCapturista] = useState({
    nombre: '',
    email: '',
    password: '',
    celular: ''
  });

  // Notificación interna (Toast)
  const [toast, setToast] = useState(null);
  const inputRefs = useRef([]);
  const fileInputRef = useRef(null);
  const exportContainerRef = useRef(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Cargar datos generales y resumen mensual
  const fetchAllData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [mainRes, resumenRes] = await Promise.all([
        apiClient.get(`/api/reflexion-serena?cicloEscolar=${encodeURIComponent(cicloEscolar)}`),
        apiClient.get(`/api/reflexion-serena/resumen-mensual?cicloEscolar=${encodeURIComponent(cicloEscolar)}`)
      ]);

      const regs = mainRes.data.registros || [];
      setRegistros(regs);
      setProfesores(mainRes.data.profesores || []);
      const capts = mainRes.data.capturistas || [];
      setCapturistas(capts);
      setSelectedCapturistaIds(capts.map(c => String(c._id)));
      setCanEdit(!!mainRes.data.canEdit);
      if (mainRes.data.templateId) setTemplateId(mainRes.data.templateId);
      setAttachedFiles(mainRes.data.attachedFiles || []);
      setResumenMensual(resumenRes.data);
    } catch (err) {
      console.error('Error al cargar Reflexión Serena:', err);
      showToast('Error al cargar datos de Reflexión Serena', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [cicloEscolar]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Poblar el formulario de los 15 grupos cada vez que cambia selectedSemana o los registros cargados
  useEffect(() => {
    const semInfo = SEMANAS_40.find(s => s.numero === Number(selectedSemana)) || SEMANAS_40[0];
    const regsDeSemana = registros.filter(r => Number(r.semana) === Number(selectedSemana));

    if (regsDeSemana.length > 0 && regsDeSemana[0].mes) {
      setSelectedMesSemana(regsDeSemana[0].mes);
    } else {
      setSelectedMesSemana(semInfo.mes);
    }

    const nuevoMapa = {};
    GRUPOS_15.forEach(g => {
      const found = regsDeSemana.find(r => r.grupo === g);
      nuevoMapa[g] = found && found.porcentaje !== undefined && found.porcentaje !== null
        ? String(found.porcentaje)
        : '';
    });

    setFormSemana(nuevoMapa);
    setHasUnsavedChanges(false);
  }, [selectedSemana, registros]);

  // Manejo de cambio de porcentaje para un grupo
  const handlePorcentajeChange = (grupo, rawValue) => {
    if (!canEdit) return;
    setTempRowStatus(grupo, 'editing', 0);
    if (rawValue === '') {
      setFormSemana(prev => ({ ...prev, [grupo]: '' }));
      setHasUnsavedChanges(true);
      return;
    }
    const num = Number(rawValue);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(100, num));
    setFormSemana(prev => ({ ...prev, [grupo]: String(clamped) }));
    setHasUnsavedChanges(true);
  };

  // Auto-save guiado por fila (onBlur / Enter) con validación de cambio real respecto al original
  const handleAutoSaveRow = async (grupo) => {
    if (!canEdit) return;
    const currentRaw = formSemana[grupo] ?? '';
    const originalRec = registros.find(
      r => r.grupo === grupo && Number(r.semana) === Number(selectedSemana)
    );
    const originalRaw =
      originalRec && originalRec.porcentaje !== undefined && originalRec.porcentaje !== null
        ? String(originalRec.porcentaje)
        : '';

    // Validar que solo se dispare si el valor realmente cambió respecto al original
    if (String(currentRaw).trim() === String(originalRaw).trim()) {
      setRowSaveStatus(prev => {
        const next = { ...prev };
        delete next[grupo];
        return next;
      });
      return;
    }

    setTempRowStatus(grupo, 'saving', 0);
    try {
      const pctPayload = currentRaw === '' || currentRaw === undefined ? null : Number(currentRaw);
      await apiClient.post('/api/reflexion-serena/bulk-semana', {
        semana: selectedSemana,
        mes: selectedMesSemana,
        cicloEscolar,
        capturas: [{ grupo, porcentaje: pctPayload }]
      });
      setTempRowStatus(grupo, 'saved', 3000);
      showToast(`Cambios guardados con éxito (${grupo}: ${pctPayload !== null ? `${pctPayload}%` : 'Sin captura'})`);
      await fetchAllData(true);
    } catch (err) {
      console.error('Error en auto-guardado de fila:', err);
      setTempRowStatus(grupo, 'error', 3500);
      showToast(err.response?.data?.msg || `Error al guardar ${grupo}`, 'error');
    }
  };

  // Llenado rápido para los 15 grupos
  const handleQuickFillAll = (valStr) => {
    if (!canEdit) return;
    const next = {};
    GRUPOS_15.forEach(g => {
      next[g] = valStr;
    });
    setFormSemana(next);
    setHasUnsavedChanges(true);
  };

  // Guardar captura semanal por lote (Bulk Update de los 15 grupos)
  const handleSaveSemanaBulk = async (e) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    try {
      const capturasPayload = GRUPOS_15.map(grupo => ({
        grupo,
        porcentaje: formSemana[grupo] === '' || formSemana[grupo] === undefined ? null : Number(formSemana[grupo])
      }));

      const res = await apiClient.post('/api/reflexion-serena/bulk-semana', {
        semana: selectedSemana,
        mes: selectedMesSemana,
        cicloEscolar,
        capturas: capturasPayload
      });

      showToast(res.data.msg || `Semana ${selectedSemana} guardada exitosamente.`);
      setHasUnsavedChanges(false);
      await fetchAllData(true);
    } catch (err) {
      console.error('Error al guardar semana:', err);
      showToast(err.response?.data?.msg || 'Error al guardar la captura semanal', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Guardar asignación de docentes Capturistas (Admin)
  const handleSaveCapturistas = async () => {
    setSavingCapturistas(true);
    try {
      const res = await apiClient.post('/api/reflexion-serena/capturistas', {
        teacherIds: selectedCapturistaIds
      });
      setCapturistas(res.data.capturistas || []);
      showToast('Permisos de Capturista de Reflexión Serena actualizados.');
      setIsCapturistaModalOpen(false);
      fetchAllData(true);
    } catch (err) {
      console.error('Error al actualizar capturistas:', err);
      showToast(err.response?.data?.msg || 'Error al actualizar permisos', 'error');
    } finally {
      setSavingCapturistas(false);
    }
  };

  // Dar de alta nueva docente con rol/permiso de Capturista de Reflexión Serena (Admin)
  const handleRegisterNuevaCapturista = async (e) => {
    e.preventDefault();
    if (!nuevaCapturista.nombre.trim() || !nuevaCapturista.email.trim() || !nuevaCapturista.password) {
      showToast('Completa nombre, correo y contraseña', 'error');
      return;
    }

    setSavingCapturistas(true);
    try {
      const res = await apiClient.post('/api/reflexion-serena/alta-capturista', nuevaCapturista);
      showToast(res.data.msg || 'Capturista registrada con éxito.');
      setNuevaCapturista({ nombre: '', email: '', password: '', celular: '' });
      setIsCapturistaModalOpen(false);
      await fetchAllData(true);
    } catch (err) {
      console.error('Error al dar de alta capturista:', err);
      showToast(err.response?.data?.msg || 'Error al registrar docente capturista', 'error');
    } finally {
      setSavingCapturistas(false);
    }
  };

  // Adjuntar archivo de referencia (si existe templateId)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const res = await apiClient.post(`/api/extensions/${templateId}/attach-file`, {
          name: file.name,
          base64: event.target.result,
          fileType: file.name.split('.').pop().toUpperCase()
        });
        setAttachedFiles(res.data.attachedFiles || []);
        showToast(`Archivo "${file.name}" adjuntado con éxito`);
      } catch (err) {
        showToast('Error al adjuntar archivo', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = async (idx) => {
    if (!templateId) return;
    try {
      const res = await apiClient.delete(`/api/extensions/${templateId}/attach-file/${idx}`);
      setAttachedFiles(res.data.attachedFiles || []);
      showToast('Archivo adjunto eliminado');
    } catch (err) {
      showToast('Error al eliminar archivo adjunto', 'error');
    }
  };

  // Estadísticas en tiempo real de la semana seleccionada
  const statsSemanaActual = useMemo(() => {
    const valores = GRUPOS_15
      .map(g => formSemana[g])
      .filter(v => v !== '' && v !== undefined && v !== null && !isNaN(Number(v)))
      .map(v => Number(v));

    const capturados = valores.length;
    const promedio = capturados > 0
      ? Math.round((valores.reduce((a, b) => a + b, 0) / capturados) * 10) / 10
      : 0;
    const alCien = valores.filter(v => v === 100).length;

    return { capturados, promedio, alCien };
  }, [formSemana]);

  // Mapa rápido de semanas que ya tienen captura en el ciclo escolar
  const semanasConCapturaSet = useMemo(() => {
    const set = new Set();
    registros.forEach(r => set.add(Number(r.semana)));
    return set;
  }, [registros]);

  // Filtrado de grupos por grado (Todos, 1°, 2°, 3°)
  const gruposVisibles = useMemo(() => {
    if (filtroGrado === 'TODOS') return GRUPOS_15;
    return GRUPOS_15.filter(g => g.startsWith(filtroGrado));
  }, [filtroGrado]);

  // Datos para el gráfico comparativo en la pestaña de Resumen Mensual
  const datosGraficoComparativo = useMemo(() => {
    if (!resumenMensual?.matrizGrupos) return [];
    return resumenMensual.matrizGrupos
      .filter(item => filtroGrado === 'TODOS' || item.grupo.startsWith(filtroGrado))
      .map(item => {
        let valor = null;
        if (filtroMesResumen === 'TODOS') {
          valor = item.promedioAnual;
        } else {
          valor = item.meses?.[filtroMesResumen]?.promedio ?? null;
        }
        return {
          grupo: item.grupo,
          valor: valor !== null && valor !== undefined ? Number(valor) : null
        };
      });
  }, [resumenMensual, filtroMesResumen, filtroGrado]);

  // =========================================================================
  // EXPORTACIONES (PDF, EXCEL, PNG)
  // =========================================================================
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen Mensual por Grupo
      const rowsMensual = (resumenMensual?.matrizGrupos || []).map((row, idx) => {
        const obj = {
          'N°': idx + 1,
          'Grupo': row.grupo
        };
        MESES_10.forEach(m => {
          obj[m] = row.meses?.[m]?.promedio !== undefined && row.meses?.[m]?.promedio !== null
            ? `${row.meses[m].promedio}%`
            : '---';
        });
        obj['Promedio Anual'] = row.promedioAnual !== null && row.promedioAnual !== undefined
          ? `${row.promedioAnual}%`
          : '---';
        obj['Semanas Evaluadas'] = row.totalSemanasCapturadas || 0;
        return obj;
      });

      const wsMensual = XLSX.utils.json_to_sheet(rowsMensual);
      XLSX.utils.book_append_sheet(wb, wsMensual, 'Promedios Mensuales');

      // Hoja 2: Sábana de las 40 Semanas
      const rowsSemanas = GRUPOS_15.map((g, idx) => {
        const obj = { 'N°': idx + 1, 'Grupo': g };
        SEMANAS_40.forEach(sem => {
          const rec = registros.find(r => r.grupo === g && Number(r.semana) === sem.numero);
          obj[`Sem ${sem.numero} (${sem.mes.slice(0, 3)})`] = rec ? `${rec.porcentaje}%` : '';
        });
        return obj;
      });

      const wsSemanas = XLSX.utils.json_to_sheet(rowsSemanas);
      XLSX.utils.book_append_sheet(wb, wsSemanas, '40 Semanas');

      XLSX.writeFile(wb, `Reflexion_Serena_${cicloEscolar}.xlsx`);
      showToast('Archivo Excel descargado exitosamente.');
    } catch (err) {
      console.error('Error al exportar Excel:', err);
      showToast('Error al exportar a Excel', 'error');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF('l', 'pt', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 32;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 68, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.text('REPORTE DE REFLEXIÓN SERENA — CUMPLIMIENTO POR GRUPO', margin, 30);

      doc.setFontSize(10);
      doc.setTextColor(0, 203, 203);
      doc.text(
        `Ciclo Escolar: ${cicloEscolar}   |   15 Grupos (1° A - 3° E)   |   Fecha: ${new Date().toLocaleDateString('es-MX')}`,
        margin,
        48
      );

      const head = [['Grupo', ...MESES_10.map(m => m.slice(0, 3).toUpperCase()), 'PROM. ANUAL', 'SEMANAS']];
      const body = (resumenMensual?.matrizGrupos || []).map(row => [
        row.grupo,
        ...MESES_10.map(m =>
          row.meses?.[m]?.promedio !== undefined && row.meses?.[m]?.promedio !== null
            ? `${row.meses[m].promedio}%`
            : '-'
        ),
        row.promedioAnual !== null && row.promedioAnual !== undefined ? `${row.promedioAnual}%` : '-',
        row.totalSemanasCapturadas || 0
      ]);

      // Agregar fila de Promedio Institucional por Mes
      if (resumenMensual?.promediosPorMes) {
        body.push([
          'PROM. PLANTEL',
          ...MESES_10.map(m =>
            resumenMensual.promediosPorMes[m] !== null && resumenMensual.promediosPorMes[m] !== undefined
              ? `${resumenMensual.promediosPorMes[m]}%`
              : '-'
          ),
          '-',
          '-'
        ]);
      }

      autoTable(doc, {
        startY: 84,
        head,
        body,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          halign: 'center',
          valign: 'middle'
        },
        headStyles: {
          fillColor: [0, 122, 122],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] },
          11: { fontStyle: 'bold', textColor: [0, 122, 122] }
        },
        margin: { left: margin, right: margin }
      });

      doc.save(`Reporte_Reflexion_Serena_${cicloEscolar}.pdf`);
      showToast('Reporte PDF descargado exitosamente.');
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      showToast('Error al generar el PDF', 'error');
    }
  };

  const handleExportPNG = async () => {
    try {
      if (!exportContainerRef.current) return;
      const canvas = await html2canvas(exportContainerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#131722'
      });
      const link = document.createElement('a');
      link.download = `Reflexion_Serena_${activeTab}_${cicloEscolar}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Imagen PNG descargada exitosamente.');
    } catch (err) {
      console.error('Error al exportar PNG:', err);
      showToast('Error al exportar imagen PNG', 'error');
    }
  };

  if (loading) {
    return (
      <div className="ext-loading-container">
        <FaSpinner className="ext-spinner" />
        <p>Cargando módulo de Reflexión Serena...</p>
      </div>
    );
  }

  const infoSemanaActual = SEMANAS_40.find(s => s.numero === Number(selectedSemana)) || SEMANAS_40[0];

  return (
    <div className="ext-spreadsheet-page" style={{ paddingBottom: '3rem' }}>
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`ext-inapp-toast toast-${toast.type}`}>
          <FaCheckCircle /> <span>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <div className="ext-sheet-header">
        <div className="ext-sheet-header-left">
          <button className="ext-btn-back" onClick={() => navigate('/extensiones')}>
            <FaArrowLeft /> Extensiones
          </button>
          <div>
            <h1 className="ext-sheet-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🧘‍♀️ REFLEXIÓN SERENA</span>
              <span style={{
                fontSize: '0.78rem',
                padding: '3px 10px',
                borderRadius: '20px',
                background: 'rgba(0, 203, 203, 0.15)',
                color: '#00cbcb',
                border: '1px solid rgba(0, 203, 203, 0.35)',
                fontWeight: '700'
              }}>
                Nivel Grupal • 15 Grupos (1° A - 3° E)
              </span>
            </h1>
            <p className="ext-sheet-subtitle">
              <span>Ciclo Escolar: <strong>{cicloEscolar}</strong> (40 Semanas • Septiembre a Junio)</span>
              <span> • Capturista(s) Asignada(s): <strong>
                {capturistas.length > 0
                  ? capturistas.map(formatTeacherName).join(', ')
                  : 'Solo Administración (Sin capturista asignada)'}
              </strong></span>
            </p>
          </div>
        </div>

        <div className="ext-sheet-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              type="button"
              className="ext-btn ext-btn-sm"
              onClick={() => setIsCapturistaModalOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#111',
                fontWeight: '800',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FaUserShield /> Capturista de Reflexión Serena
            </button>
          )}

          <button
            type="button"
            className="ext-btn ext-btn-sm ext-btn-secondary"
            onClick={handleExportPNG}
            title="Exportar vista actual como PNG"
          >
            📸 PNG
          </button>
          <button
            type="button"
            className="ext-btn ext-btn-sm ext-btn-secondary"
            onClick={handleExportPDF}
            title="Descargar Reporte Mensual en PDF"
          >
            <FaFilePdf className="text-red" /> Exportar PDF
          </button>
          <button
            type="button"
            className="ext-btn ext-btn-sm ext-btn-secondary"
            onClick={handleExportExcel}
            title="Descargar Concentrado Mensual y 40 Semanas en Excel"
          >
            <FaFileExcel className="text-green" /> Exportar Excel
          </button>

          {canEdit ? (
            <div className="ext-badge-status status-editable">
              <FaCheckCircle /> {isAdmin ? 'Modo Administrador' : 'Capturista Autorizada'}
            </div>
          ) : (
            <div className="ext-badge-status status-readonly">
              <FaLock /> Solo Lectura
            </div>
          )}
        </div>
      </div>

      {/* BARRA DE ARCHIVOS ADJUNTOS DE REFERENCIA (SI EXISTE PLANTILLA VINCULADA) */}
      {templateId && (
        <div className="ext-attachments-bar" style={{ marginBottom: '1rem' }}>
          <div className="ext-attachments-header">
            <div className="ext-attachments-title">
              <FaPaperclip /> <span>Formatos y Archivos de Referencia Adjuntos:</span>
            </div>
            {canEdit && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  className="ext-btn ext-btn-sm ext-btn-secondary"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  <FaFileUpload /> + Adjuntar Formato
                </button>
              </div>
            )}
          </div>
          {attachedFiles.length > 0 && (
            <div className="ext-attachments-list">
              {attachedFiles.map((att, idx) => (
                <div key={idx} className="ext-attachment-chip">
                  <FaFileExcel className="text-green" />
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="ext-attachment-name" download={att.name}>
                    {att.name} <FaDownload className="ext-icon-xs" />
                  </a>
                  {canEdit && (
                    <button type="button" className="ext-btn-remove-att" onClick={() => handleRemoveAttachment(idx)}>
                      <FaTimes />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NAVEGACIÓN PRINCIPAL DEL MÓDULO (3 VISTAS) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '1.2rem',
        background: '#161b26',
        padding: '10px 14px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('CAPTURA')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: activeTab === 'CAPTURA' ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
              background: activeTab === 'CAPTURA' ? 'linear-gradient(135deg, #00cbcb, #009999)' : '#1e2536',
              color: activeTab === 'CAPTURA' ? '#111' : '#cbd5e1'
            }}
          >
            <FaCalendarAlt /> 1. Captura Semanal por Grupo (Semanas 1 - 40)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RESUMEN')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: activeTab === 'RESUMEN' ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
              background: activeTab === 'RESUMEN' ? 'linear-gradient(135deg, #00cbcb, #009999)' : '#1e2536',
              color: activeTab === 'RESUMEN' ? '#111' : '#cbd5e1'
            }}
          >
            <FaChartBar /> 2. Resumen y Promedios Mensuales Automáticos
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SABANA')}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: activeTab === 'SABANA' ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
              background: activeTab === 'SABANA' ? 'linear-gradient(135deg, #00cbcb, #009999)' : '#1e2536',
              color: activeTab === 'SABANA' ? '#111' : '#cbd5e1'
            }}
          >
            <FaTable /> 3. Sábana Anual (40 Semanas)
          </button>
        </div>

        {/* Filtro rápido por grado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '600' }}>Filtrar Grado:</span>
          {['TODOS', '1°', '2°', '3°'].map(gr => (
            <button
              key={gr}
              type="button"
              onClick={() => setFiltroGrado(gr)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                border: filtroGrado === gr ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
                background: filtroGrado === gr ? 'rgba(0, 203, 203, 0.2)' : '#1e2536',
                color: filtroGrado === gr ? '#00cbcb' : '#94a3b8'
              }}
            >
              {gr === 'TODOS' ? '15 Grupos' : `${gr} Grado`}
            </button>
          ))}
        </div>
      </div>

      <div ref={exportContainerRef}>
        {/* ========================================================================= */}
        {/* PESTAÑA 1: CAPTURA SEMANAL RÁPIDA Y MASIVA POR LOTE (15 GRUPOS)           */}
        {/* ========================================================================= */}
        {activeTab === 'CAPTURA' && (
          <div style={{
            background: '#161b26',
            borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)'
          }}>
            {/* Selector de Semana (1 a 40) y Mes */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              paddingBottom: '16px',
              marginBottom: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedSemana(prev => Math.max(1, Number(prev) - 1))}
                  disabled={Number(selectedSemana) <= 1}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#1e2536',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: Number(selectedSemana) <= 1 ? 'not-allowed' : 'pointer',
                    opacity: Number(selectedSemana) <= 1 ? 0.4 : 1
                  }}
                  title="Semana Anterior"
                >
                  <FaChevronLeft />
                </button>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#00cbcb', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Seleccionar Semana (1 a 40)
                  </label>
                  <select
                    value={selectedSemana}
                    onChange={(e) => setSelectedSemana(Number(e.target.value))}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      color: '#fff',
                      border: '1.5px solid #00cbcb',
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      minWidth: '250px'
                    }}
                  >
                    {MESES_10.map(mesNombre => (
                      <optgroup key={mesNombre} label={`📅 ${mesNombre.toUpperCase()}`}>
                        {SEMANAS_40.filter(s => s.mes === mesNombre).map(s => (
                          <option key={s.numero} value={s.numero}>
                            {s.label} — {s.mes} (Sem. {s.semanaDelMes}) {semanasConCapturaSet.has(s.numero) ? '✓ Capturada' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSemana(prev => Math.min(40, Number(prev) + 1))}
                  disabled={Number(selectedSemana) >= 40}
                  style={{
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: '#1e2536',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    cursor: Number(selectedSemana) >= 40 ? 'not-allowed' : 'pointer',
                    opacity: Number(selectedSemana) >= 40 ? 0.4 : 1
                  }}
                  title="Siguiente Semana"
                >
                  <FaChevronRight />
                </button>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Mes de Cómputo
                  </label>
                  <select
                    value={selectedMesSemana}
                    disabled={!canEdit}
                    onChange={(e) => {
                      setSelectedMesSemana(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      fontSize: '0.9rem',
                      fontWeight: '700'
                    }}
                  >
                    {MESES_10.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resumen rápido de la semana seleccionada y botones de llenado masivo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{
                  background: '#0f172a',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 203, 203, 0.3)',
                  display: 'flex',
                  gap: '14px',
                  fontSize: '0.85rem'
                }}>
                  <span>Grupos capturados: <strong style={{ color: '#00cbcb' }}>{statsSemanaActual.capturados} / 15</strong></span>
                  <span>Promedio Semana {selectedSemana}: <strong style={{ color: '#4ade80' }}>{statsSemanaActual.promedio}%</strong></span>
                </div>

                {canEdit && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickFillAll('100')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.35)',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Asignar 100% a los 15 grupos"
                    >
                      <FaBolt /> 100% a Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickFillAll('')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                      title="Limpiar porcentajes de esta semana"
                    >
                      <FaEraser /> Limpiar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Píldoras rápidas de las 4 semanas del mes activo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>
                Semanas de {infoSemanaActual.mes}:
              </span>
              {SEMANAS_40.filter(s => s.mes === infoSemanaActual.mes).map(s => {
                const isSelected = s.numero === Number(selectedSemana);
                const isDone = semanasConCapturaSet.has(s.numero);
                return (
                  <button
                    key={s.numero}
                    type="button"
                    onClick={() => setSelectedSemana(s.numero)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #00cbcb' : '1px solid rgba(255,255,255,0.12)',
                      background: isSelected
                        ? 'rgba(0, 203, 203, 0.22)'
                        : (isDone ? 'rgba(34, 197, 94, 0.12)' : '#1e2536'),
                      color: isSelected ? '#00cbcb' : (isDone ? '#4ade80' : '#cbd5e1')
                    }}
                  >
                    {s.label} {isDone ? '✓' : ''}
                  </button>
                );
              })}
            </div>

            {/* Formulario / Tabla de Captura de los 15 Grupos */}
            <form onSubmit={handleSaveSemanaBulk}>
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#00cbcb', borderBottom: '2px solid #00cbcb' }}>
                      <th style={{ padding: '12px 14px', width: '55px', textAlign: 'center' }}>N°</th>
                      <th style={{ padding: '12px 14px', width: '140px' }}>GRUPO</th>
                      <th style={{ padding: '12px 14px', width: '130px' }}>GRADO</th>
                      <th style={{ padding: '12px 14px', width: '230px', textAlign: 'center' }}>
                        PORCENTAJE DE CUMPLIMIENTO (0 - 100%)
                      </th>
                      <th style={{ padding: '12px 14px' }}>NIVEL DE CUMPLIMIENTO SEMANAL</th>
                      <th style={{ padding: '12px 14px', width: '150px', textAlign: 'center' }}>
                        PROM. MENSUAL ({selectedMesSemana.toUpperCase()})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gruposVisibles.map((grupoNombre, idx) => {
                      const val = formSemana[grupoNombre] ?? '';
                      const numVal = val !== '' ? Number(val) : null;
                      const badge = getBadgeColorByPct(val);
                      const gradoStr = `${grupoNombre.charAt(0)}° de Secundaria`;
                      const rowSt = rowSaveStatus[grupoNombre];

                      const resumenGrupo = resumenMensual?.matrizGrupos?.find(m => m.grupo === grupoNombre);
                      const promMesActual = resumenGrupo?.meses?.[selectedMesSemana]?.promedio ?? null;

                      return (
                        <tr
                          key={grupoNombre}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            background:
                              rowSt === 'saved'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : rowSt === 'saving'
                                ? 'rgba(245, 158, 11, 0.1)'
                                : idx % 2 === 0
                                ? 'rgba(255,255,255,0.01)'
                                : 'rgba(255,255,255,0.03)',
                            transition: 'background 0.25s ease'
                          }}
                        >
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', fontWeight: '700' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '5px 12px',
                              borderRadius: '8px',
                              background: 'rgba(0, 203, 203, 0.14)',
                              color: '#00cbcb',
                              border: '1px solid rgba(0, 203, 203, 0.35)',
                              fontWeight: '800',
                              fontSize: '0.95rem'
                            }}>
                              {grupoNombre}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: '600', fontSize: '0.85rem' }}>
                            {gradoStr}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              <input
                                ref={el => (inputRefs.current[idx] = el)}
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                placeholder="0 - 100"
                                disabled={!canEdit}
                                value={val}
                                onFocus={() => canEdit && setTempRowStatus(grupoNombre, 'editing', 0)}
                                onChange={(e) => handlePorcentajeChange(grupoNombre, e.target.value)}
                                onBlur={() => handleAutoSaveRow(grupoNombre)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAutoSaveRow(grupoNombre);
                                    const nextInput = inputRefs.current[idx + 1];
                                    if (nextInput) nextInput.focus();
                                  } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const nextInput = inputRefs.current[idx + 1];
                                    if (nextInput) nextInput.focus();
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevInput = inputRefs.current[idx - 1];
                                    if (prevInput) prevInput.focus();
                                  }
                                }}
                                style={{
                                  width: '115px',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: '#0f172a',
                                  color: '#fff',
                                  border:
                                    rowSt === 'saved'
                                      ? '2px solid #22c55e'
                                      : rowSt === 'saving'
                                      ? '2px solid #f59e0b'
                                      : rowSt === 'editing'
                                      ? '2px solid #00cbcb'
                                      : `1.5px solid ${badge.border}`,
                                  boxShadow:
                                    rowSt === 'saved'
                                      ? '0 0 10px rgba(34, 197, 94, 0.35)'
                                      : rowSt === 'saving'
                                      ? '0 0 10px rgba(245, 158, 11, 0.35)'
                                      : 'none',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: '800',
                                  outline: 'none',
                                  transition: 'border 0.2s ease, box-shadow 0.2s ease'
                                }}
                              />
                              <span style={{ fontWeight: '800', color: '#94a3b8', fontSize: '1rem' }}>%</span>
                              {rowSt === 'editing' && (
                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#00cbcb', background: 'rgba(0,203,203,0.14)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(0,203,203,0.35)' }}>
                                  Editando...
                                </span>
                              )}
                              {rowSt === 'saving' && (
                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fbbf24', background: 'rgba(245,158,11,0.16)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.4)' }}>
                                  ⏳ Guardando...
                                </span>
                              )}
                              {rowSt === 'saved' && (
                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#4ade80', background: 'rgba(34,197,94,0.18)', padding: '2px 7px', borderRadius: '10px', border: '1px solid #22c55e' }}>
                                  ✓ Guardado
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                flex: 1,
                                height: '10px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '6px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${numVal !== null ? Math.min(100, Math.max(0, numVal)) : 0}%`,
                                  height: '100%',
                                  background: badge.bar,
                                  transition: 'width 0.25s ease'
                                }} />
                              </div>
                              <span style={{
                                minWidth: '88px',
                                textAlign: 'center',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`
                              }}>
                                {numVal !== null ? `${numVal}% • ${badge.label}` : 'Sin capturar'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: promMesActual !== null ? '#fbbf24' : '#64748b' }}>
                            {promMesActual !== null ? `${promMesActual}%` : '---'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra inferior fija/flotante (Sticky Bottom Bar) de guardado masivo */}
              {canEdit && (
                <div style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 50,
                  background: 'rgba(22, 27, 38, 0.96)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '18px',
                  padding: '14px 16px',
                  borderTop: '1px solid rgba(0, 203, 203, 0.25)',
                  borderRadius: '0 0 12px 12px',
                  boxShadow: '0 -8px 20px rgba(0, 0, 0, 0.45)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '0.85rem', color: hasUnsavedChanges ? '#fbbf24' : '#94a3b8' }}>
                    {hasUnsavedChanges
                      ? '⚠️ Tienes cambios en edición (presiona Enter o cambia de celda para auto-guardar, o usa el botón de lote).'
                      : '✓ Auto-guardado activo al presionar Enter o salir del campo (onBlur).'}
                  </span>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '12px 26px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #00cbcb, #009999)',
                      color: '#111',
                      border: 'none',
                      fontWeight: '800',
                      fontSize: '0.96rem',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 6px 20px rgba(0, 203, 203, 0.35)'
                    }}
                  >
                    <FaSave /> {saving ? 'Guardando Lote...' : `Guardar Captura de Semana ${selectedSemana} (${selectedMesSemana})`}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: RESUMEN Y PROMEDIOS MENSUALES AUTOMÁTICOS + GRÁFICO COMPARATIVO */}
        {/* ========================================================================= */}
        {activeTab === 'RESUMEN' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Controles del Resumen Mensual */}
            <div style={{
              background: '#161b26',
              borderRadius: '14px',
              padding: '16px 20px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#00cbcb', fontSize: '1.15rem' }}>
                  📊 Comportamiento Mensual y Promedios Automáticos por Grupo
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                  Cálculo automático mediante agregación a partir de las semanas capturadas en cada mes del ciclo escolar.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.84rem', color: '#cbd5e1', fontWeight: '600' }}>Mes a graficar:</label>
                <select
                  value={filtroMesResumen}
                  onChange={(e) => setFiltroMesResumen(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#00cbcb',
                    border: '1px solid #00cbcb',
                    fontWeight: '700',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="TODOS">📈 Promedio General del Ciclo (Septiembre - Junio)</option>
                  {MESES_10.map(m => (
                    <option key={m} value={m}>📅 Mes de {m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* GRÁFICO COMPARATIVO DE BARRAS DE LOS 15 GRUPOS */}
            <div style={{
              background: '#161b26',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  🏆 Gráfico Comparativo de Cumplimiento por Grupo — {filtroMesResumen === 'TODOS' ? 'Promedio Anual Acumulado' : `Mes de ${filtroMesResumen}`}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Escala: 0% a 100%</span>
              </h4>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))',
                gap: '10px',
                alignItems: 'end',
                height: '210px',
                padding: '20px 10px 10px 10px',
                background: '#0f172a',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                {datosGraficoComparativo.map(item => {
                  const pct = item.valor !== null ? Math.max(0, Math.min(100, item.valor)) : 0;
                  const badge = getBadgeColorByPct(item.valor);
                  return (
                    <div
                      key={item.grupo}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%'
                      }}
                    >
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: '800',
                        color: item.valor !== null ? badge.text : '#475569',
                        marginBottom: '6px'
                      }}>
                        {item.valor !== null ? `${item.valor}%` : '-'}
                      </span>
                      <div style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: '130px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px 6px 0 0',
                        display: 'flex',
                        alignItems: 'flex-end',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: '100%',
                          height: `${pct}%`,
                          background: badge.bar,
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.35s ease'
                        }} />
                      </div>
                      <span style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        color: '#cbd5e1'
                      }}>
                        {item.grupo}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TABLA COMPARATIVA DE PROMEDIOS MENSUALES (15 GRUPOS X 10 MESES) */}
            <div style={{
              background: '#161b26',
              borderRadius: '14px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.08)',
              overflowX: 'auto'
            }}>
              <h4 style={{ margin: '0 0 14px 0', color: '#00cbcb', fontSize: '1rem' }}>
                📋 Matriz de Promedios Mensuales por Grupo (Septiembre - Junio)
              </h4>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#00cbcb', borderBottom: '2px solid #00cbcb' }}>
                    <th style={{ padding: '10px', textAlign: 'left', minWidth: '90px' }}>GRUPO</th>
                    {MESES_10.map(m => (
                      <th key={m} style={{ padding: '10px', minWidth: '78px' }}>{m.slice(0, 3).toUpperCase()}</th>
                    ))}
                    <th style={{ padding: '10px', minWidth: '105px', background: 'rgba(0, 203, 203, 0.15)', color: '#fff' }}>
                      PROM. ANUAL
                    </th>
                    <th style={{ padding: '10px', minWidth: '90px', color: '#94a3b8' }}>
                      SEMANAS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(resumenMensual?.matrizGrupos || [])
                    .filter(row => filtroGrado === 'TODOS' || row.grupo.startsWith(filtroGrado))
                    .map((row, idx) => {
                      const anualBadge = getBadgeColorByPct(row.promedioAnual);
                      return (
                        <tr
                          key={row.grupo}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                          }}
                        >
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: '800', color: '#00cbcb' }}>
                            {row.grupo}
                          </td>
                          {MESES_10.map(m => {
                            const cell = row.meses?.[m];
                            const prom = cell?.promedio ?? null;
                            const b = getBadgeColorByPct(prom);
                            return (
                              <td key={m} style={{ padding: '8px' }}>
                                {prom !== null ? (
                                  <div
                                    title={`${m}: Promedio ${prom}% (${cell.semanasCapturadas} semana(s) evaluadas, Total: ${cell.total} pts)`}
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      background: b.bg,
                                      color: b.text,
                                      border: `1px solid ${b.border}`,
                                      fontWeight: '700',
                                      minWidth: '58px'
                                    }}
                                  >
                                    {prom}%
                                  </div>
                                ) : (
                                  <span style={{ color: '#475569' }}>---</span>
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: '10px', background: 'rgba(0, 203, 203, 0.05)', fontWeight: '800' }}>
                            {row.promedioAnual !== null ? (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: anualBadge.bg,
                                color: anualBadge.text,
                                border: `1px solid ${anualBadge.border}`
                              }}>
                                {row.promedioAnual}%
                              </span>
                            ) : (
                              <span style={{ color: '#475569' }}>---</span>
                            )}
                          </td>
                          <td style={{ padding: '10px', color: '#94a3b8', fontWeight: '700' }}>
                            {row.totalSemanasCapturadas} / 40
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                {/* Fila de Promedio Institucional por Mes */}
                {resumenMensual?.promediosPorMes && (
                  <tfoot>
                    <tr style={{ background: '#0f172a', borderTop: '2px solid #00cbcb', fontWeight: '800' }}>
                      <td style={{ padding: '12px 10px', textAlign: 'left', color: '#fbbf24' }}>
                        PROM. PLANTEL
                      </td>
                      {MESES_10.map(m => {
                        const pMes = resumenMensual.promediosPorMes[m];
                        return (
                          <td key={m} style={{ padding: '12px 8px', color: pMes !== null ? '#fbbf24' : '#475569' }}>
                            {pMes !== null && pMes !== undefined ? `${pMes}%` : '---'}
                          </td>
                        );
                      })}
                      <td colSpan={2} style={{ padding: '12px 10px', color: '#00cbcb' }}>
                        15 Grupos
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: SÁBANA ANUAL DE LAS 40 SEMANAS X 15 GRUPOS                     */}
        {/* ========================================================================= */}
        {activeTab === 'SABANA' && (
          <div style={{
            background: '#161b26',
            borderRadius: '14px',
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            overflowX: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ margin: 0, color: '#00cbcb', fontSize: '1rem' }}>
                  🗓️ Sábana General del Ciclo Escolar (Semanas 1 a 40 por Grupo)
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  Haz clic en el encabezado de cualquier semana para ir directamente a capturar o editar sus porcentajes.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#0f172a', color: '#00cbcb' }}>
                    <th rowSpan={2} style={{ padding: '8px 10px', position: 'sticky', left: 0, background: '#0f172a', zIndex: 10, borderRight: '2px solid #00cbcb', minWidth: '80px' }}>
                      GRUPO
                    </th>
                    {MESES_10.map(m => (
                      <th key={m} colSpan={4} style={{ padding: '6px', borderBottom: '1px solid rgba(0,203,203,0.3)', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
                        {m.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ background: '#1e293b', color: '#cbd5e1' }}>
                    {SEMANAS_40.map(s => (
                      <th
                        key={s.numero}
                        onClick={() => {
                          setSelectedSemana(s.numero);
                          setActiveTab('CAPTURA');
                        }}
                        style={{
                          padding: '6px 4px',
                          minWidth: '46px',
                          cursor: 'pointer',
                          borderRight: '1px solid rgba(255,255,255,0.06)',
                          background: Number(selectedSemana) === s.numero ? 'rgba(0, 203, 203, 0.25)' : undefined,
                          color: Number(selectedSemana) === s.numero ? '#00cbcb' : undefined
                        }}
                        title={`Ir a capturar ${s.label} (${s.mes})`}
                      >
                        S{s.numero}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gruposVisibles.map((gNombre, idx) => (
                    <tr key={gNombre} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? '#161b26' : '#1a202c' }}>
                      <td style={{
                        padding: '8px 10px',
                        fontWeight: '800',
                        color: '#00cbcb',
                        position: 'sticky',
                        left: 0,
                        background: idx % 2 === 0 ? '#161b26' : '#1a202c',
                        borderRight: '2px solid #00cbcb',
                        zIndex: 5
                      }}>
                        {gNombre}
                      </td>
                      {SEMANAS_40.map(s => {
                        const rec = registros.find(r => r.grupo === gNombre && Number(r.semana) === s.numero);
                        const val = rec?.porcentaje;
                        const b = getBadgeColorByPct(val);
                        return (
                          <td
                            key={s.numero}
                            onClick={() => {
                              setSelectedSemana(s.numero);
                              setActiveTab('CAPTURA');
                            }}
                            style={{
                              padding: '6px 4px',
                              borderRight: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              color: val !== undefined ? b.text : '#475569',
                              fontWeight: val !== undefined ? '700' : '400'
                            }}
                            title={`${gNombre} • Semana ${s.numero} (${s.mes}): ${val !== undefined ? `${val}%` : 'Sin captura'}`}
                          >
                            {val !== undefined ? `${val}%` : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE ADMINISTRACIÓN: ASIGNAR O DAR DE ALTA CAPTURISTA                 */}
      {/* ========================================================================= */}
      {isCapturistaModalOpen && isAdmin && (
        <div className="ext-modal-overlay" onClick={() => setIsCapturistaModalOpen(false)}>
          <div
            className="ext-modal-content ext-modal-compact"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '620px' }}
          >
            <div className="ext-modal-header">
              <h2>👩‍🏫 Rol: Capturista de Reflexión Serena</h2>
              <button className="ext-modal-close" onClick={() => setIsCapturistaModalOpen(false)}>
                <FaTimes />
              </button>
            </div>

            <div className="ext-modal-body">
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCapturistaModalTab('ASIGNAR')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: capturistaModalTab === 'ASIGNAR' ? '1px solid #00cbcb' : '1px solid rgba(255,255,255,0.1)',
                    background: capturistaModalTab === 'ASIGNAR' ? 'rgba(0, 203, 203, 0.2)' : '#1e2536',
                    color: capturistaModalTab === 'ASIGNAR' ? '#00cbcb' : '#cbd5e1'
                  }}
                >
                  <FaUserShield /> Asignar Docente Existente
                </button>
                <button
                  type="button"
                  onClick={() => setCapturistaModalTab('ALTA')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: capturistaModalTab === 'ALTA' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                    background: capturistaModalTab === 'ALTA' ? 'rgba(245, 158, 11, 0.2)' : '#1e2536',
                    color: capturistaModalTab === 'ALTA' ? '#fbbf24' : '#cbd5e1'
                  }}
                >
                  <FaUserPlus /> Dar de Alta Nueva Capturista
                </button>
              </div>

              {capturistaModalTab === 'ASIGNAR' ? (
                <>
                  <p style={{ fontSize: '0.86rem', color: '#94a3b8', marginBottom: '12px' }}>
                    Selecciona a la docente encargada (ej. <strong>Dorotea</strong>) que tendrá permiso exclusivo de captura y edición en el módulo de <strong>Reflexión Serena</strong> sin acceder a configuraciones críticas del sistema:
                  </p>

                  <div className="ext-teachers-grid" style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '16px' }}>
                    {profesores
                      .filter(p => p.role === 'profesor')
                      .map(p => {
                        const idStr = String(p._id);
                        const isChecked = selectedCapturistaIds.includes(idStr);
                        return (
                          <label
                            key={idStr}
                            className={`ext-teacher-chip ${isChecked ? 'selected' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedCapturistaIds(prev =>
                                  prev.includes(idStr)
                                    ? prev.filter(item => item !== idStr)
                                    : [...prev, idStr]
                                );
                              }}
                            />
                            <span>{formatTeacherName(p)} ({p.email})</span>
                          </label>
                        );
                      })}
                  </div>

                  <div className="ext-modal-footer">
                    <button
                      type="button"
                      className="ext-btn ext-btn-secondary"
                      onClick={() => setIsCapturistaModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="ext-btn ext-btn-primary"
                      disabled={savingCapturistas}
                      onClick={handleSaveCapturistas}
                    >
                      <FaSave /> {savingCapturistas ? 'Guardando...' : 'Guardar Permisos de Capturista'}
                    </button>
                  </div>
                </>
              ) : (
                <form onSubmit={handleRegisterNuevaCapturista}>
                  <p style={{ fontSize: '0.86rem', color: '#94a3b8', marginBottom: '12px' }}>
                    Registra directamente a una docente con el permiso activo de <strong>Capturista de Reflexión Serena</strong>:
                  </p>

                  <div className="ext-form-group">
                    <label>Nombre Completo de la Docente *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Dorotea..."
                      value={nuevaCapturista.nombre}
                      onChange={(e) => setNuevaCapturista({ ...nuevaCapturista, nombre: e.target.value })}
                    />
                  </div>

                  <div className="ext-form-group">
                    <label>Correo Electrónico de Acceso *</label>
                    <input
                      type="email"
                      required
                      placeholder="docente@escuela.edu.mx"
                      value={nuevaCapturista.email}
                      onChange={(e) => setNuevaCapturista({ ...nuevaCapturista, email: e.target.value })}
                    />
                  </div>

                  <div className="ext-form-group">
                    <label>Contraseña (mínimo 6 caracteres) *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Contraseña de acceso"
                      value={nuevaCapturista.password}
                      onChange={(e) => setNuevaCapturista({ ...nuevaCapturista, password: e.target.value })}
                    />
                  </div>

                  <div className="ext-form-group">
                    <label>Celular (Opcional)</label>
                    <input
                      type="text"
                      placeholder="10 dígitos"
                      value={nuevaCapturista.celular}
                      onChange={(e) => setNuevaCapturista({ ...nuevaCapturista, celular: e.target.value })}
                    />
                  </div>

                  <div className="ext-modal-footer">
                    <button
                      type="button"
                      className="ext-btn ext-btn-secondary"
                      onClick={() => setIsCapturistaModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="ext-btn ext-btn-primary"
                      disabled={savingCapturistas}
                    >
                      <FaUserPlus /> {savingCapturistas ? 'Registrando...' : 'Dar de Alta como Capturista'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReflexionSerenaView;
