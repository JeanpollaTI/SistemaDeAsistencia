import React, { useState, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FaUserShield,
  FaPlus,
  FaEdit,
  FaTrash,
  FaFilePdf,
  FaFileExcel,
  FaSearch,
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaClipboardList,
  FaPrint
} from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TIPOS_FALTA = [
  'Indisciplina',
  'Reporte escolar',
  'Citatorio',
  'Falta de respeto',
  'Incumplimiento de acuerdos',
  'Retardo / Inasistencia reiterada',
  'Uso inadecuado de dispositivo móvil',
  'Conflicto entre pares',
  'Otro'
];

const ESTATUS_LIST = ['Pendiente', 'En seguimiento', 'Resuelto'];

const getStatusBadgeStyle = (estatus) => {
  switch (estatus) {
    case 'Resuelto':
      return {
        backgroundColor: 'rgba(39, 174, 96, 0.18)',
        color: '#2ecc71',
        border: '1px solid rgba(39, 174, 96, 0.45)',
        icon: '🟢'
      };
    case 'En seguimiento':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        icon: '🟡'
      };
    case 'Pendiente':
    default:
      return {
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.45)',
        icon: '🔴'
      };
  }
};

const getTipoBadgeStyle = (tipo = '') => {
  const lower = tipo.toLowerCase();
  if (lower.includes('citatorio')) {
    return {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      color: '#fca5a5',
      border: '1px solid rgba(239, 68, 68, 0.4)'
    };
  }
  if (lower.includes('indisciplina') || lower.includes('respeto') || lower.includes('conflicto')) {
    return {
      backgroundColor: 'rgba(249, 115, 22, 0.2)',
      color: '#fdba74',
      border: '1px solid rgba(249, 115, 22, 0.4)'
    };
  }
  return {
    backgroundColor: 'rgba(0, 203, 203, 0.15)',
    color: '#00cbcb',
    border: '1px solid rgba(0, 203, 203, 0.35)'
  };
};

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

const formatFullName = (a) =>
  `${a?.apellidoPaterno || ''} ${a?.apellidoMaterno || ''} ${a?.nombre || ''}`.replace(/\s+/g, ' ').trim();

const TrabajoSocialModal = ({
  grupo,
  onClose,
  onSwitchToMatriculas,
  onGrupoUpdated,
  schoolConfig,
  defaultLogo,
  showAlert
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [selectedAlumnoId, setSelectedAlumnoId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingIncidenciaId, setEditingIncidenciaId] = useState(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const [formIncidencia, setFormIncidencia] = useState({
    fecha: todayStr,
    tipo: 'Indisciplina',
    descripcion: '',
    acciones: '',
    estatus: 'Pendiente'
  });

  const todosAlumnos = useMemo(() => {
    if (!grupo) return [];
    return sortAlumnosWithStatus(grupo.alumnos || []);
  }, [grupo]);

  const selectedAlumno = useMemo(() => {
    if (!selectedAlumnoId) return null;
    return todosAlumnos.find(a => String(a._id) === String(selectedAlumnoId)) || null;
  }, [todosAlumnos, selectedAlumnoId]);

  // Estadísticas globales del grupo en Trabajo Social
  const statsGrupo = useMemo(() => {
    let totalIncidencias = 0;
    let pendientes = 0;
    let enSeguimiento = 0;
    let resueltos = 0;
    let alumnosConIncidencias = 0;

    todosAlumnos.forEach(a => {
      const incs = Array.isArray(a.incidencias) ? a.incidencias : [];
      if (incs.length > 0) alumnosConIncidencias++;
      incs.forEach(inc => {
        totalIncidencias++;
        if (inc.estatus === 'Resuelto') resueltos++;
        else if (inc.estatus === 'En seguimiento') enSeguimiento++;
        else pendientes++;
      });
    });

    return { totalIncidencias, pendientes, enSeguimiento, resueltos, alumnosConIncidencias };
  }, [todosAlumnos]);

  // Filtrado de alumnos
  const alumnosFiltrados = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return todosAlumnos.filter(a => {
      const nombre = formatFullName(a).toLowerCase();
      const mat = (a.matricula || '').toLowerCase();
      const matchesSearch = !term || nombre.includes(term) || mat.includes(term);
      if (!matchesSearch) return false;

      const incs = Array.isArray(a.incidencias) ? a.incidencias : [];
      if (statusFilter === 'CON_INCIDENCIAS') return incs.length > 0;
      if (statusFilter === 'PENDIENTE') return incs.some(i => (i.estatus || 'Pendiente') === 'Pendiente');
      if (statusFilter === 'SEGUIMIENTO') return incs.some(i => i.estatus === 'En seguimiento');
      if (statusFilter === 'RESUELTO') return incs.some(i => i.estatus === 'Resuelto');
      return true;
    });
  }, [todosAlumnos, searchTerm, statusFilter]);

  if (!grupo) return null;

  const resetForm = () => {
    setEditingIncidenciaId(null);
    setFormIncidencia({
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'Indisciplina',
      descripcion: '',
      acciones: '',
      estatus: 'Pendiente'
    });
  };

  const handleOpenAlumnoModal = (alumno) => {
    setSelectedAlumnoId(String(alumno._id));
    resetForm();
  };

  const handleStartEditIncidencia = (inc) => {
    setEditingIncidenciaId(String(inc._id));
    setFormIncidencia({
      fecha: inc.fecha || todayStr,
      tipo: inc.tipo || 'Reporte escolar',
      descripcion: inc.descripcion || '',
      acciones: inc.acciones || '',
      estatus: inc.estatus || 'Pendiente'
    });
  };

  const handleSaveIncidencia = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAlumno) return;

    if (!formIncidencia.fecha || !formIncidencia.tipo || !formIncidencia.descripcion.trim()) {
      if (showAlert) showAlert('Por favor completa la fecha, el motivo y la descripción detallada del reporte.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      let res;
      if (editingIncidenciaId) {
        res = await axios.put(
          `${API_URL}/grupos/${grupo._id}/alumnos/${selectedAlumno._id}/incidencias/${editingIncidenciaId}`,
          formIncidencia,
          { headers }
        );
      } else {
        res = await axios.post(
          `${API_URL}/grupos/${grupo._id}/alumnos/${selectedAlumno._id}/incidencias`,
          formIncidencia,
          { headers }
        );
      }

      if (res.data?.grupo && onGrupoUpdated) {
        onGrupoUpdated(res.data.grupo);
      }

      if (showAlert) {
        showAlert(
          editingIncidenciaId
            ? 'Incidencia actualizada correctamente.'
            : 'Incidencia registrada en el historial del alumno.',
          'success'
        );
      }
      resetForm();
    } catch (err) {
      console.error('Error al guardar incidencia:', err);
      if (showAlert) {
        showAlert(err.response?.data?.error || 'Error al guardar la incidencia disciplinaria.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (alumnoId, incidenciaId, nuevoEstatus) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(
        `${API_URL}/grupos/${grupo._id}/alumnos/${alumnoId}/incidencias/${incidenciaId}`,
        { estatus: nuevoEstatus },
        { headers }
      );
      if (res.data?.grupo && onGrupoUpdated) {
        onGrupoUpdated(res.data.grupo);
      }
      if (showAlert) showAlert(`Estatus actualizado a "${nuevoEstatus}".`, 'success');
    } catch (err) {
      console.error('Error al cambiar estatus:', err);
      if (showAlert) showAlert('No se pudo actualizar el estatus.', 'error');
    }
  };

  const handleDeleteIncidencia = async (alumnoId, incidenciaId) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro disciplinario?')) return;
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.delete(
        `${API_URL}/grupos/${grupo._id}/alumnos/${alumnoId}/incidencias/${incidenciaId}`,
        { headers }
      );
      if (res.data?.grupo && onGrupoUpdated) {
        onGrupoUpdated(res.data.grupo);
      }
      if (editingIncidenciaId === String(incidenciaId)) {
        resetForm();
      }
      if (showAlert) showAlert('Incidencia eliminada del historial.', 'success');
    } catch (err) {
      console.error('Error al eliminar incidencia:', err);
      if (showAlert) showAlert('Error al eliminar la incidencia.', 'error');
    }
  };

  // =========================================================================
  // EXPORTACIÓN E IMPRESIÓN DE REPORTES (PDF Y EXCEL) PARA TRABAJO SOCIAL
  // =========================================================================

  // 1. Reporte PDF Individual por Alumno (Expediente / Citatorio Imprimible)
  const exportarExpedienteAlumnoPDF = (alumno, singleIncidencia = null) => {
    try {
      const doc = new jsPDF('p', 'pt', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;

      const schoolName = schoolConfig?.name || 'INSTITUCIÓN EDUCATIVA';
      const subtitulo = singleIncidencia
        ? `REPORTE INDIVIDUAL / CITATORIO DE TRABAJO SOCIAL`
        : `EXPEDIENTE E HISTORIAL DISCIPLINARIO - TRABAJO SOCIAL`;

      // Encabezado Institucional
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 82, 'F');

      try {
        if (defaultLogo) {
          doc.addImage(defaultLogo, 'PNG', margin, 14, 52, 52);
        }
      } catch (e) {
        // continuar si no carga logo
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text(schoolName.toUpperCase(), margin + 65, 34);

      doc.setFontSize(10);
      doc.setTextColor(0, 203, 203);
      doc.text(subtitulo, margin + 65, 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 200, 200);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`, margin + 65, 67);

      // Ficha de Datos del Alumno
      let yPos = 102;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 66, 6, 6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`ALUMNO(A): ${formatFullName(alumno)}`, margin + 12, yPos + 20);
      doc.text(`MATRÍCULA: ${alumno.matricula || '---'}`, pageWidth - margin - 160, yPos + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Grupo: ${grupo.nombre}   |   Aula: ${grupo.aula || 'S/A'}   |   Asesor(a): ${grupo.asesor || 'Sin asignar'}`, margin + 12, yPos + 38);
      doc.text(
        `Contacto Padre/Tutor: ${alumno.telefonoPadre || 'Sin teléfono'}   |   Correo: ${alumno.emailPadre || 'Sin correo'}`,
        margin + 12,
        yPos + 54
      );

      yPos += 84;

      const incidenciasList = singleIncidencia
        ? [singleIncidencia]
        : [...(alumno.incidencias || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

      if (incidenciasList.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('El alumno no registra incidencias disciplinarias a la fecha.', margin, yPos + 15);
        yPos += 40;
      } else {
        const bodyRows = incidenciasList.map((inc, idx) => [
          idx + 1,
          inc.fecha || '---',
          inc.tipo || 'Reporte escolar',
          inc.descripcion || '---',
          inc.acciones || 'Sin acciones registradas',
          inc.estatus || 'Pendiente'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Fecha', 'Tipo de Falta / Motivo', 'Descripción Detallada del Reporte', 'Acciones Tomadas / Seguimiento', 'Estatus']],
          body: bodyRows,
          theme: 'grid',
          styles: {
            fontSize: 8.5,
            cellPadding: 6,
            valign: 'middle',
            overflow: 'linebreak',
            textColor: [30, 41, 59]
          },
          headStyles: {
            fillColor: [0, 122, 122],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 24, halign: 'center' },
            1: { cellWidth: 58, halign: 'center' },
            2: { cellWidth: 85, fontStyle: 'bold' },
            3: { cellWidth: 155 },
            4: { cellWidth: 145 },
            5: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = (doc.lastAutoTable?.finalY || yPos + 60) + 25;
      }

      // Bloque de compromisos y firmas para Trabajo Social
      if (yPos + 130 > pageHeight - 40) {
        doc.addPage();
        yPos = 50;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text('OBSERVACIONES / ACUERDOS COMPLEMENTARIOS EN ENTREVISTA:', margin, yPos);

      doc.setDrawColor(180, 180, 180);
      doc.line(margin, yPos + 18, pageWidth - margin, yPos + 18);
      doc.line(margin, yPos + 34, pageWidth - margin, yPos + 34);
      doc.line(margin, yPos + 50, pageWidth - margin, yPos + 50);

      const signY = yPos + 105;
      const colW = (pageWidth - margin * 2) / 3;

      doc.setDrawColor(51, 65, 85);
      // Firma 1: Trabajo Social / Dirección
      doc.line(margin + 10, signY, margin + colW - 10, signY);
      // Firma 2: Padre / Madre o Tutor
      doc.line(margin + colW + 10, signY, margin + colW * 2 - 10, signY);
      // Firma 3: Alumno(a)
      doc.line(margin + colW * 2 + 10, signY, pageWidth - margin - 10, signY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('ÁREA DE TRABAJO SOCIAL', margin + colW / 2, signY + 14, { align: 'center' });
      doc.text('NOMBRE Y FIRMA PADRE / TUTOR', margin + colW + colW / 2, signY + 14, { align: 'center' });
      doc.text('FIRMA DEL ALUMNO(A)', margin + colW * 2 + colW / 2, signY + 14, { align: 'center' });

      const safeName = formatFullName(alumno).replace(/\s+/g, '_');
      doc.save(`Trabajo_Social_${grupo.nombre}_${safeName}.pdf`);
      if (showAlert) showAlert('Reporte PDF del alumno generado con éxito.', 'success');
    } catch (err) {
      console.error('Error al generar PDF de alumno:', err);
      if (showAlert) showAlert('Error al generar el reporte PDF.', 'error');
    }
  };

  // 2. Reporte PDF General del Grupo (Concentrado de Trabajo Social)
  const exportarReporteGrupalPDF = () => {
    try {
      const doc = new jsPDF('l', 'pt', 'letter');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 36;
      const schoolName = schoolConfig?.name || 'INSTITUCIÓN EDUCATIVA';

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 74, 'F');

      try {
        if (defaultLogo) {
          doc.addImage(defaultLogo, 'PNG', margin, 12, 48, 48);
        }
      } catch (e) {}

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(schoolName.toUpperCase(), margin + 60, 30);

      doc.setFontSize(11);
      doc.setTextColor(0, 203, 203);
      doc.text(`REPORTE CONCENTRADO DE TRABAJO SOCIAL - GRUPO ${grupo.nombre}`, margin + 60, 47);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(210, 210, 210);
      doc.text(
        `Aula: ${grupo.aula || 'S/A'}  |  Asesor(a): ${grupo.asesor || 'Sin asignar'}  |  Incidencias: ${statsGrupo.totalIncidencias} (Pendientes: ${statsGrupo.pendientes}, En seguimiento: ${statsGrupo.enSeguimiento}, Resueltos: ${statsGrupo.resueltos})  |  Fecha: ${new Date().toLocaleDateString('es-MX')}`,
        margin + 60,
        63
      );

      // Construir filas de todas las incidencias del grupo
      const rows = [];
      todosAlumnos.forEach((alumno, idx) => {
        const incs = Array.isArray(alumno.incidencias) ? alumno.incidencias : [];
        if (incs.length > 0) {
          incs.forEach(inc => {
            rows.push([
              idx + 1,
              alumno.matricula || '---',
              formatFullName(alumno),
              inc.fecha || '---',
              inc.tipo || 'Reporte escolar',
              inc.descripcion || '---',
              inc.acciones || '---',
              inc.estatus || 'Pendiente'
            ]);
          });
        } else if (statusFilter === 'TODOS' && statsGrupo.totalIncidencias === 0) {
          rows.push([
            idx + 1,
            alumno.matricula || '---',
            formatFullName(alumno),
            '---',
            'Sin incidencias',
            'Sin reportes disciplinarios registrados',
            '---',
            'Sin incidencias'
          ]);
        }
      });

      autoTable(doc, {
        startY: 90,
        head: [['N°', 'Matrícula', 'Alumno', 'Fecha', 'Tipo / Motivo', 'Descripción del Reporte', 'Acciones Tomadas / Seguimiento', 'Estatus']],
        body: rows.length > 0 ? rows : [['-', '-', 'No hay incidencias registradas con el filtro actual', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: {
          fontSize: 8.2,
          cellPadding: 5,
          valign: 'middle',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [0, 122, 122],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 55, halign: 'center' },
          2: { cellWidth: 140, fontStyle: 'bold' },
          3: { cellWidth: 60, halign: 'center' },
          4: { cellWidth: 90 },
          5: { cellWidth: 165 },
          6: { cellWidth: 150 },
          7: { cellWidth: 68, halign: 'center', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });

      doc.save(`Reporte_Trabajo_Social_Grupo_${(grupo.nombre || 'Grupo').replace(/\s+/g, '_')}.pdf`);
      if (showAlert) showAlert('Reporte PDF grupal de Trabajo Social descargado con éxito.', 'success');
    } catch (err) {
      console.error('Error al generar PDF grupal de Trabajo Social:', err);
      if (showAlert) showAlert('Error al generar el PDF grupal.', 'error');
    }
  };

  // 3. Exportación a Excel (XLS) de Incidencias del Grupo
  const exportarReporteGrupalXLS = () => {
    try {
      const data = [];
      todosAlumnos.forEach((alumno, idx) => {
        const incs = Array.isArray(alumno.incidencias) ? alumno.incidencias : [];
        if (incs.length > 0) {
          incs.forEach(inc => {
            data.push({
              'N° Lista': idx + 1,
              'Grupo': grupo.nombre,
              'Matrícula': alumno.matricula || '---',
              'Nombre del Alumno': formatFullName(alumno),
              'Fecha de Incidencia': inc.fecha || '---',
              'Tipo de Falta / Motivo': inc.tipo || 'Reporte escolar',
              'Descripción Detallada': inc.descripcion || '',
              'Acciones Tomadas / Seguimiento': inc.acciones || '',
              'Estatus': inc.estatus || 'Pendiente',
              'Enterado Padre/Tutor': inc.enteradoPadre ? `Sí (${inc.fechaEnteradoPadre || ''})` : 'Pendiente',
              'Compromiso Padre/Tutor': inc.compromisoPadre || '',
              'Registrado Por': inc.registradoPor || '',
              'Teléfono Padre/Tutor': alumno.telefonoPadre || '',
              'Correo Padre/Tutor': alumno.emailPadre || ''
            });
          });
        } else {
          data.push({
            'N° Lista': idx + 1,
            'Grupo': grupo.nombre,
            'Matrícula': alumno.matricula || '---',
            'Nombre del Alumno': formatFullName(alumno),
            'Fecha de Incidencia': '---',
            'Tipo de Falta / Motivo': 'Sin incidencias',
            'Descripción Detallada': '',
            'Acciones Tomadas / Seguimiento': '',
            'Estatus': 'Sin reportes',
            'Enterado Padre/Tutor': '---',
            'Compromiso Padre/Tutor': '',
            'Registrado Por': '',
            'Teléfono Padre/Tutor': alumno.telefonoPadre || '',
            'Correo Padre/Tutor': alumno.emailPadre || ''
          });
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 10 },
        { wch: 14 },
        { wch: 34 },
        { wch: 16 },
        { wch: 24 },
        { wch: 42 },
        { wch: 38 },
        { wch: 16 },
        { wch: 22 },
        { wch: 18 },
        { wch: 26 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Trabajo Social');
      XLSX.writeFile(workbook, `Trabajo_Social_Grupo_${(grupo.nombre || 'Grupo').replace(/\s+/g, '_')}.xlsx`);
      if (showAlert) showAlert('Reporte Excel de Trabajo Social descargado con éxito.', 'success');
    } catch (err) {
      console.error('Error al exportar Excel de Trabajo Social:', err);
      if (showAlert) showAlert('Error al exportar a Excel.', 'error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 3500 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1080px',
          width: '96vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 26px',
          backgroundColor: '#131722',
          color: '#fff',
          border: '1px solid rgba(0, 203, 203, 0.3)',
          borderRadius: '14px'
        }}
      >
        {/* PESTAÑAS SUPERIORES: MATRÍCULAS | TRABAJO SOCIAL */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '14px',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onSwitchToMatriculas && (
              <button
                type="button"
                onClick={() => onSwitchToMatriculas(grupo)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 203, 203, 0.35)',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  color: '#aaa',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                📋 Matrículas
              </button>
            )}
            <button
              type="button"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #f59e0b',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#111',
                fontWeight: '800',
                fontSize: '0.9rem',
                cursor: 'default',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
            >
              🤝 Trabajo Social — Grupo {grupo.nombre}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-cancel"
            style={{ padding: '6px 12px', fontSize: '1rem', minWidth: 'auto', borderRadius: '6px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* VISTA 1: LISTA DE ALUMNOS DEL GRUPO Y RESUMEN DE TRABAJO SOCIAL */}
        {!selectedAlumno ? (
          <>
            {/* Resumen estadístico */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
              gap: '10px',
              marginBottom: '14px'
            }}>
              <div style={{ background: '#1c2230', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Matrícula del Grupo</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{todosAlumnos.length} <span style={{ fontSize: '0.8rem', color: '#00cbcb', fontWeight: '600' }}>alumnos</span></div>
              </div>
              <div style={{ background: '#1c2230', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Total Incidencias</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>{statsGrupo.totalIncidencias} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>({statsGrupo.alumnosConIncidencias} alumnos)</span></div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fca5a5', textTransform: 'uppercase', fontWeight: '700' }}>🔴 Pendientes</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#f87171', marginTop: '2px' }}>{statsGrupo.pendientes}</div>
              </div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: '#fde68a', textTransform: 'uppercase', fontWeight: '700' }}>🟡 En Seguimiento</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>{statsGrupo.enSeguimiento}</div>
              </div>
              <div style={{ background: 'rgba(39, 174, 96, 0.1)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(39, 174, 96, 0.3)' }}>
                <div style={{ fontSize: '0.75rem', color: '#86efac', textTransform: 'uppercase', fontWeight: '700' }}>🟢 Resueltos</div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#4ade80', marginTop: '2px' }}>{statsGrupo.resueltos}</div>
              </div>
            </div>

            {/* Barra de búsqueda, filtro por estatus y exportación grupal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px', flex: '1', minWidth: '280px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
                  <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#00cbcb' }} />
                  <input
                    type="text"
                    placeholder="Buscar alumno por nombre o matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      backgroundColor: '#1c2230',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#1c2230',
                    border: '1px solid rgba(0, 203, 203, 0.35)',
                    color: '#fff',
                    fontSize: '0.86rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="TODOS">Todos los alumnos ({todosAlumnos.length})</option>
                  <option value="CON_INCIDENCIAS">Con incidencias ({statsGrupo.alumnosConIncidencias})</option>
                  <option value="PENDIENTE">Con estatus Pendiente</option>
                  <option value="SEGUIMIENTO">Con estatus En seguimiento</option>
                  <option value="RESUELTO">Con estatus Resuelto</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={exportarReporteGrupalPDF}
                  style={{
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.84rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="Imprimir / Descargar Reporte Concentrado de Incidencias del Grupo en PDF"
                >
                  <FaFilePdf /> Reporte Grupal PDF
                </button>
                <button
                  type="button"
                  onClick={exportarReporteGrupalXLS}
                  style={{
                    backgroundColor: '#27ae60',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '0.84rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  title="Exportar concentrado de incidencias del grupo a Excel"
                >
                  <FaFileExcel /> Exportar Excel (XLS)
                </button>
              </div>
            </div>

            {/* Tabla de alumnos del grupo activo */}
            <div style={{
              flex: '1',
              overflowY: 'auto',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              maxHeight: '52vh'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1e293b', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '44px' }}>N°</th>
                    <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '110px' }}>Matrícula</th>
                    <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb' }}>Nombre del Alumno</th>
                    <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '230px' }}>Historial Disciplinario</th>
                    <th style={{ padding: '10px', color: '#00cbcb', borderBottom: '2px solid #00cbcb', textAlign: 'center', width: '250px' }}>Acciones Trabajo Social</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnosFiltrados.length > 0 ? (
                    alumnosFiltrados.map((alumno, idx) => {
                      const incs = Array.isArray(alumno.incidencias) ? alumno.incidencias : [];
                      const pCount = incs.filter(i => (i.estatus || 'Pendiente') === 'Pendiente').length;
                      const sCount = incs.filter(i => i.estatus === 'En seguimiento').length;
                      const rCount = incs.filter(i => i.estatus === 'Resuelto').length;

                      return (
                        <tr
                          key={alumno._id || idx}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            backgroundColor: alumno.esBaja
                              ? 'rgba(255,77,77,0.1)'
                              : (incs.length > 0 ? 'rgba(245, 158, 11, 0.04)' : undefined)
                          }}
                        >
                          <td style={{ textAlign: 'center', padding: '10px', fontWeight: 'bold', color: '#94a3b8' }}>{idx + 1}</td>
                          <td style={{ textAlign: 'center', padding: '10px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '5px',
                              backgroundColor: 'rgba(0, 203, 203, 0.12)',
                              color: '#00cbcb',
                              border: '1px solid rgba(0, 203, 203, 0.3)',
                              fontFamily: 'monospace',
                              fontWeight: '700'
                            }}>
                              {alumno.matricula || '---'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', fontWeight: '600', color: alumno.esBaja ? '#ff4d4d' : '#fff' }}>
                            <div>{formatFullName(alumno)}</div>
                            {alumno.telefonoPadre && (
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '400' }}>
                                📞 Tutor: {alumno.telefonoPadre}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px' }}>
                            {incs.length === 0 ? (
                              <span style={{
                                fontSize: '0.78rem',
                                color: '#64748b',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                background: 'rgba(255,255,255,0.04)'
                              }}>
                                Sin incidencias
                              </span>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {pCount > 0 && (
                                  <span style={{ ...getStatusBadgeStyle('Pendiente'), padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700' }}>
                                    🔴 {pCount} Pend.
                                  </span>
                                )}
                                {sCount > 0 && (
                                  <span style={{ ...getStatusBadgeStyle('En seguimiento'), padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700' }}>
                                    🟡 {sCount} Seg.
                                  </span>
                                )}
                                {rCount > 0 && (
                                  <span style={{ ...getStatusBadgeStyle('Resuelto'), padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '700' }}>
                                    🟢 {rCount} Res.
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenAlumnoModal(alumno)}
                                style={{
                                  background: 'linear-gradient(135deg, #00cbcb, #009999)',
                                  color: '#111',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <FaClipboardList /> {incs.length > 0 ? `Expediente (${incs.length})` : 'Capturar Reporte'}
                              </button>
                              <button
                                type="button"
                                onClick={() => exportarExpedienteAlumnoPDF(alumno)}
                                style={{
                                  backgroundColor: '#334155',
                                  color: '#fff',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Imprimir / Descargar Expediente PDF del Alumno"
                              >
                                <FaPrint /> PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '28px', color: '#94a3b8' }}>
                        No se encontraron alumnos con el criterio seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* VISTA 2: FORMULARIO E HISTORIAL DISCIPLINARIO DEL ALUMNO SELECCIONADO */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Barra superior del expediente del alumno */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#1c2230',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '14px',
              border: '1px solid rgba(0, 203, 203, 0.25)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setSelectedAlumnoId(null); resetForm(); }}
                  style={{
                    backgroundColor: '#334155',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FaArrowLeft /> Volver a Lista del Grupo
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#00cbcb' }}>
                    {formatFullName(selectedAlumno)}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Matrícula: <strong>{selectedAlumno.matricula || '---'}</strong> | Grupo: <strong>{grupo.nombre}</strong>
                    {selectedAlumno.telefonoPadre ? ` | 📞 Tutor: ${selectedAlumno.telefonoPadre}` : ''}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => exportarExpedienteAlumnoPDF(selectedAlumno)}
                style={{
                  backgroundColor: '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FaPrint /> Imprimir Expediente Disciplinario (PDF)
              </button>
            </div>

            {/* Grid 2 columnas: Formulario de Captura | Historial Disciplinario */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '16px',
              flex: 1,
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {/* Columna Izquierda: Formulario de Captura / Edición */}
              <form
                onSubmit={handleSaveIncidencia}
                style={{
                  background: '#1a202c',
                  padding: '16px',
                  borderRadius: '10px',
                  border: editingIncidenciaId ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignSelf: 'start'
                }}
              >
                <h4 style={{ margin: 0, color: editingIncidenciaId ? '#fbbf24' : '#00cbcb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingIncidenciaId ? <><FaEdit /> Editando Incidencia</> : <><FaPlus /> Registrar Nueva Incidencia</>}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Fecha de la incidencia *
                    </label>
                    <input
                      type="date"
                      required
                      value={formIncidencia.fecha}
                      onChange={(e) => setFormIncidencia({ ...formIncidencia, fecha: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#111827',
                        border: '1px solid rgba(255,255,255,0.18)',
                        color: '#fff',
                        fontSize: '0.86rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                      Estatus *
                    </label>
                    <select
                      value={formIncidencia.estatus}
                      onChange={(e) => setFormIncidencia({ ...formIncidencia, estatus: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#111827',
                        border: '1px solid rgba(0, 203, 203, 0.4)',
                        color: '#fff',
                        fontSize: '0.86rem'
                      }}
                    >
                      {ESTATUS_LIST.map(est => (
                        <option key={est} value={est}>{est}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Tipo de falta / Motivo *
                  </label>
                  <select
                    value={formIncidencia.tipo}
                    onChange={(e) => setFormIncidencia({ ...formIncidencia, tipo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#111827',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      fontSize: '0.86rem'
                    }}
                  >
                    {TIPOS_FALTA.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Descripción detallada del reporte *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe detalladamente los hechos o el motivo del reporte / citatorio..."
                    value={formIncidencia.descripcion}
                    onChange={(e) => setFormIncidencia({ ...formIncidencia, descripcion: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#111827',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      fontSize: '0.86rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px', fontWeight: '600' }}>
                    Acciones tomadas / Seguimiento
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Acuerdos con el alumno, entrevista con padres de familia, canalización o medidas formativas..."
                    value={formIncidencia.acciones}
                    onChange={(e) => setFormIncidencia({ ...formIncidencia, acciones: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#111827',
                      border: '1px solid rgba(255,255,255,0.18)',
                      color: '#fff',
                      fontSize: '0.86rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      background: 'linear-gradient(135deg, #00cbcb, #009999)',
                      color: '#111',
                      border: 'none',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    {saving ? 'Guardando...' : (editingIncidenciaId ? '💾 Actualizar Incidencia' : '💾 Guardar Incidencia')}
                  </button>
                  {editingIncidenciaId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      style={{
                        backgroundColor: '#475569',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontWeight: '600',
                        fontSize: '0.86rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              {/* Columna Derecha: Historial de Incidencias del Alumno */}
              <div style={{
                background: '#1a202c',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '55vh',
                overflowY: 'auto'
              }}>
                <h4 style={{ margin: 0, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📋 Historial Disciplinario del Alumno</span>
                  <span style={{ fontSize: '0.8rem', color: '#00cbcb' }}>
                    {(selectedAlumno.incidencias || []).length} registro(s)
                  </span>
                </h4>

                {(!selectedAlumno.incidencias || selectedAlumno.incidencias.length === 0) ? (
                  <div style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.1)'
                  }}>
                    Este alumno no cuenta con incidencias disciplinarias registradas.
                  </div>
                ) : (
                  [...selectedAlumno.incidencias]
                    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
                    .map((inc) => {
                      const statusStyle = getStatusBadgeStyle(inc.estatus);
                      const tipoStyle = getTipoBadgeStyle(inc.tipo);
                      return (
                        <div
                          key={inc._id}
                          style={{
                            background: '#111827',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderLeft: `4px solid ${statusStyle.color}`,
                            borderRadius: '8px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                ...tipoStyle,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                fontWeight: '700'
                              }}>
                                {inc.tipo}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>
                                📅 {inc.fecha}
                              </span>
                            </div>

                            {/* Selector directo de estatus */}
                            <select
                              value={inc.estatus || 'Pendiente'}
                              onChange={(e) => handleQuickStatusChange(selectedAlumno._id, inc._id, e.target.value)}
                              style={{
                                ...statusStyle,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.76rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              {ESTATUS_LIST.map(est => (
                                <option key={est} value={est} style={{ background: '#111827', color: '#fff' }}>
                                  {est}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ fontSize: '0.86rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                            <strong style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block' }}>Descripción del reporte:</strong>
                            {inc.descripcion}
                          </div>

                          {inc.acciones && (
                            <div style={{
                              fontSize: '0.83rem',
                              color: '#cbd5e1',
                              background: 'rgba(0, 203, 203, 0.06)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(0, 203, 203, 0.15)'
                            }}>
                              <strong style={{ color: '#00cbcb', fontSize: '0.76rem', display: 'block' }}>Acciones tomadas / Seguimiento:</strong>
                              {inc.acciones}
                            </div>
                          )}

                          {/* Estado de enterado del padre/tutor en Portal de Padres */}
                          <div style={{
                            fontSize: '0.8rem',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: inc.enteradoPadre ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.1)',
                            border: inc.enteradoPadre ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.3)',
                            color: inc.enteradoPadre ? '#6ee7b7' : '#fde68a'
                          }}>
                            {inc.enteradoPadre ? (
                              <>
                                <strong>✅ Padre/Tutor Enterado {inc.fechaEnteradoPadre ? `(${inc.fechaEnteradoPadre})` : ''}:</strong>
                                {inc.compromisoPadre && (
                                  <div style={{ color: '#e2e8f0', fontStyle: 'italic', marginTop: '2px' }}>
                                    "{inc.compromisoPadre}"
                                  </div>
                                )}
                              </>
                            ) : (
                              <span>⏳ Pendiente de confirmación de enterado por el padre/tutor en el Portal de Padres</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {inc.registradoPor ? `Registrado por: ${inc.registradoPor}` : ''}
                            </span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => exportarExpedienteAlumnoPDF(selectedAlumno, inc)}
                                style={{
                                  backgroundColor: '#334155',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                title="Imprimir este citatorio / reporte individual en PDF"
                              >
                                <FaPrint /> Imprimir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditIncidencia(inc)}
                                style={{
                                  backgroundColor: '#f59e0b',
                                  color: '#111',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FaEdit /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteIncidencia(selectedAlumno._id, inc._id)}
                                style={{
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '14px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Submódulo de Trabajo Social • Grupo {grupo.nombre}
          </span>
          <button className="btn btn-cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrabajoSocialModal;
