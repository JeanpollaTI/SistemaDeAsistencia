import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './Calificaciones.css';

import logoImage from './Logoescuela.png';

// --- Sortable Header Component ---
function SortableHeader({ id, children, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const style = {
    // 🌟 FIX: Apply transform ONLY when dragging to preserve sticky behavior
    transform: isDragging ? CSS.Translate.toString(transform) : undefined,
    transition,
    cursor: disabled ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    touchAction: 'none',
    backgroundColor: isDragging ? '#2c3e50' : undefined, // Color oscuro al arrastrar
    color: isDragging ? 'white' : undefined,
    zIndex: isDragging ? 100 : undefined,
    // 🌟 FIX: 'relative' overrides 'sticky' from CSS. Only use relative when dragging.
    position: isDragging ? 'relative' : undefined,
    // Removed fixed minWidth to allow CSS to control it better, or use auto. 
    // The CSS defines 35px for sub-columns (grades), but this is a main column.
    // Let's set it to 'auto' or match the table style unless dragging.
    minWidth: isDragging ? '105px' : 'auto',
    border: isDragging ? '2px dashed #f1c40f' : (disabled ? undefined : '1px solid #dfe6e9'),
    opacity: isDragging ? 0.9 : 1
  };

  return (
    <th ref={setNodeRef} style={style} {...attributes} {...listeners} colSpan="3">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {!disabled && <span style={{ fontSize: '1.2em', opacity: 0.5, cursor: 'grab' }}>⋮⋮</span>}
        <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
      </div>
    </th>
  );
}

// --- CAMBIO: URL de la API desde variables de entorno para Vercel ---
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// --- Componente de Notificación (Utilidad) ---
function Notificacion({ mensaje, tipo, onClose }) {
  useEffect(() => {
    if (mensaje) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [mensaje, onClose]);

  if (!mensaje) return null;

  return (
    <div className={`notificacion ${tipo}`}>
      {mensaje}
    </div>
  );
}

// --- Componente Principal de Calificaciones (Vista Admin) ---
function Calificaciones({ user }) {
  const [grupos, setGrupos] = useState([]);
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [calificaciones, setCalificaciones] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalPdf, setModalPdf] = useState({ visible: false, alumno: null });
  const [modalShare, setModalShare] = useState({ visible: false, alumno: null });
  const [modalDirector, setModalDirector] = useState(false); // Modal para asignar director global
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: '' });
  const [isEditing, setIsEditing] = useState(false); // Estado para controlar el modo edición
  const [savedDirectores, setSavedDirectores] = useState([]); // Estado para directores guardados
  // 🌟 NUEVO ESTADO: Modal para configurar el reporte de bajo rendimiento
  const [modalBajoRendimiento, setModalBajoRendimiento] = useState({
    visible: false,
    seleccion: [true, true, true] // Por defecto todos seleccionados
  });


  // --- DnD Sensors ---
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = materias.indexOf(active.id);
      const newIndex = materias.indexOf(over.id);
      const newOrder = arrayMove(materias, oldIndex, newIndex);

      setMaterias(newOrder);

      // Save new order to backend
      if (selectedGrupo) {
        try {
          // Enviar solo el orden de materias.
          // El backend ya fue corregido para no requerir 'alumnos'.
          await axios.put(`${API_URL}/grupos/${selectedGrupo._id}`, {
            ordenMaterias: newOrder
          }, getAxiosConfig());

          mostrarNotificacion("Orden guardado correctamente.");
        } catch (err) {
          console.error("Error al guardar el orden de materias:", err);
          mostrarNotificacion("Error al guardar el orden de las materias.", "error");
        }
      }
    }
  };

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ visible: true, mensaje, tipo });
  };

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchGrupos = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/grupos?populate=alumnos,profesoresAsignados`, getAxiosConfig());
      const sortedGrupos = res.data.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' })
      );
      setGrupos(sortedGrupos);
    } catch (err) {
      console.error("Error al cargar grupos:", err);
      setError("No se pudieron cargar los grupos. Intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrupos();
    // Cargar directores guardados y el director actual
    const saved = localStorage.getItem('saved_directores');
    if (saved) {
      setSavedDirectores(JSON.parse(saved));
    }
  }, []);

  const handleBackToGrupos = () => {
    setSelectedGrupo(null);
    fetchGrupos(); // Refrescar lista para asegurar orden actualizado
  };

  const handleSelectGrupo = async (grupo) => {
    setLoading(true);
    setSelectedGrupo(grupo);

    const alumnosOrdenados = [...grupo.alumnos].sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));
    setAlumnos(alumnosOrdenados);

    // Combinar asignaturas asignadas y orden guardado
    const materiasSet = new Set(grupo.profesoresAsignados.map(asig => asig.asignatura));
    if (grupo.ordenMaterias) {
      grupo.ordenMaterias.forEach(m => materiasSet.add(m));
    }
    const materiasAsignadas = [...materiasSet];

    // Si hay un orden guardado, ordenar las materias
    if (grupo.ordenMaterias && grupo.ordenMaterias.length > 0) {
      materiasAsignadas.sort((a, b) => {
        const indexA = grupo.ordenMaterias.indexOf(a);
        const indexB = grupo.ordenMaterias.indexOf(b);
        // If both found, sort by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // If only A found, A comes first? No, A comes first if indexA < indexB.
        // If A not found, put it at the end.
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return 0;
      });
    }

    setMaterias(materiasAsignadas);

    try {
      // --- CAMBIO: Usar API_URL ---
      const res = await axios.get(`${API_URL}/grupos/${grupo._id}/calificaciones-admin`, getAxiosConfig());
      setCalificaciones(res.data || {});
    } catch (err) {
      console.error("Error detallado al cargar calificaciones:", err.response || err);
      mostrarNotificacion("No se pudieron cargar las calificaciones consolidadas de este grupo.", "error");
      setCalificaciones({});
    } finally {
      setLoading(false);
    }
  };

  // Helper para "suelo" de calificación en 5
  // Si es null o 0 (sin calificar), se queda igual.
  // Si está entre 0.1 y 4.9, sube a 5.
  const clampGrade = (grade) => {
    if (typeof grade !== 'number') return null;
    if (grade > 0 && grade < 5) return 5;
    return grade;
  };

  const calcularPromedioBimestre = (alumnoId, bimestreIndex) => {
    const alumnoCal = calificaciones[alumnoId];
    if (!alumnoCal) return 0;
    let suma = 0;
    let count = 0;
    materias.forEach(materia => {
      // Usamos clampGrade antes de sumar
      const rawCal = alumnoCal[materia] && alumnoCal[materia][bimestreIndex];
      const cal = clampGrade(rawCal);

      if (typeof cal === 'number' && cal > 0) {
        suma += cal;
        count++;
      }
    });
    return count > 0 ? Math.round(suma / count) : 0;
  };

  const calcularPromedioFinal = (alumnoId) => {
    let sumaDePromedios = 0;
    let bimestresConCalificacion = 0;
    for (let i = 0; i < 3; i++) {
      // calcularPromedioBimestre ya devuelve un valor redondeado (y clamp implicitamente si sus inputs lo son, pero aseguramos)
      const promedioBim = calcularPromedioBimestre(alumnoId, i);
      if (promedioBim > 0) {
        sumaDePromedios += (promedioBim < 5 ? 5 : promedioBim);
        bimestresConCalificacion++;
      }
    }
    return bimestresConCalificacion > 0 ? Math.round(sumaDePromedios / bimestresConCalificacion) : 0;
  };


  // --- FUNCIÓN REUTILIZABLE PARA DIBUJAR UNA BOLETA EN UNA PÁGINA EXISTENTE ---
  const drawReportCard = async (doc, alumno, bimestresSeleccionados, datosFirmas = {}) => {
    let { nombreDirector = '', nombreDocente = '' } = datosFirmas;

    if (!nombreDirector) {
      nombreDirector = localStorage.getItem('current_director_name') || '';
    }
    if (!nombreDocente) {
      nombreDocente = selectedGrupo?.asesor || '';
    }

    const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;

    // Logo (Simulado o real si cargado previamente, para optimizar en loop)
    // Para simplificar en batch, idealmente cargar imagen una vez fuera. 
    // Pero jsPDF addImage maneja cache o base64 bien.
    const img = new Image();
    img.src = logoImage;
    // await img.decode(); // En batch puede ser lento, pero necesario para layout.
    // Hack: Asumimos que ya cargó o usamos dimensiones fijas si es posible.
    // Para asegurar sin await en cada uno, podríamos precargar, pero mantengamos await por seguridad visual.
    await img.decode().catch(() => { }); // Catch error si ya está decodificada o falla

    const logoWidth = 25, margin = 14;
    const logoHeight = (img.height * logoWidth) / img.width;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

    doc.setFontSize(12);
    let yPos = margin + 5;

    // 1. Escuela Secundaria
    doc.text('Escuela Secundaria No. 9 "Amado Nervo"', margin, yPos);
    yPos += 7;

    // 2. Boleta de Calificaciones
    doc.setFont(undefined, 'bold');
    doc.text('Boleta parcial de calificaciones', margin, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 7;

    // 3. Alumno
    doc.text(`Alumno: ${nombreCompleto}`, margin, yPos);
    yPos += 7;

    // 4. Grupo
    doc.text(`Grupo: ${selectedGrupo.nombre}`, margin, yPos);
    yPos += 5; // Espacio antes de tabla

    const tableHeaders = ['Materia'];
    if (bimestresSeleccionados[0]) tableHeaders.push("Trim. 1");
    if (bimestresSeleccionados[1]) tableHeaders.push("Trim. 2");
    if (bimestresSeleccionados[2]) tableHeaders.push("Trim. 3");

    const alumnoCal = calificaciones[alumno._id] || {};
    const tableBody = materias.map(materia => {
      const cals = alumnoCal[materia] || [null, null, null];
      const row = [materia];
      cals.forEach((cal, index) => {
        if (bimestresSeleccionados[index]) {
          const clampedCal = clampGrade(cal);
          row.push(clampedCal !== null ? clampedCal.toFixed(1) : '-');
        }
      });
      return row;
    });

    const promedioRow = ['PROMEDIO'];
    [0, 1, 2].forEach(index => {
      if (bimestresSeleccionados[index]) {
        const promedio = calcularPromedioBimestre(alumno._id, index);
        promedioRow.push(promedio > 0 ? promedio.toFixed(1) : 'N/A');
      }
    });
    tableBody.push(promedioRow);

    autoTable(doc, {
      startY: yPos,
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      styles: { halign: 'center', cellPadding: 2.5 },
      headStyles: { fillColor: [212, 175, 55], textColor: 255 },
      didDrawCell: (data) => {
        if (data.row.index === tableBody.length - 1) {
          doc.setFont(undefined, 'bold');
        }
      }
    });

    // --- SECCIÓN DE FIRMAS Y PIE DE PÁGINA ---
    let finalY = doc.lastAutoTable.finalY + 15;
    const availableWidth = pageWidth - (margin * 2);
    const halfWidth = availableWidth / 2 - 5;
    const rightColX = margin + halfWidth + 10;

    let ySignatures = finalY;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    // 1. Docente
    doc.text("Nombre y firma del asesor (a)", margin, ySignatures);
    ySignatures += 10;
    if (nombreDocente) {
      doc.setFont(undefined, 'bold');
      doc.text(nombreDocente.toUpperCase(), margin, ySignatures);
      doc.setFont(undefined, 'normal');
    }
    doc.line(margin, ySignatures + 1, margin + 80, ySignatures + 1);

    // 2. Director
    ySignatures += 25;
    doc.text("Nombre y firma del director (a)", margin, ySignatures);
    ySignatures += 10;
    if (nombreDirector) {
      doc.setFont(undefined, 'bold');
      doc.text(nombreDirector.toUpperCase(), margin, ySignatures);
      doc.setFont(undefined, 'normal');
    }
    doc.line(margin, ySignatures + 1, margin + 80, ySignatures + 1);

    // Tabla Firmas Padres (Derecha)
    autoTable(doc, {
      startY: finalY - 4,
      margin: { left: rightColX },
      tableWidth: halfWidth,
      head: [[{ content: 'FIRMA DE LA MADRE O PADRE DE FAMILIA O PERSONA TUTORA', colSpan: 3 }]],
      body: [
        ['1er periodo', '2º periodo', '3er periodo'],
        ['\n\n\n\n', '\n\n\n\n', '\n\n\n\n']
      ],
      theme: 'plain',
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center',
        valign: 'middle',
        fontSize: 7,
        cellPadding: 2
      },
      headStyles: {
        halign: 'center',
        fontStyle: 'bold',
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' }
      }
    });

    const footerY = pageHeight - 15;
    doc.setFontSize(10);
    const leyenda = "Sr. Padre de familia, esta calificación es el avance parcial del trimestre le solicitamos apoyar a su hij@, el propósito fundamental de este reporte es que suba su promedio de calificación al finalizar el trimestre en el que estamos, les solicitamos asistir a la secundaria a informarse sobre el avance académico de su hij@.";

    doc.setFont(undefined, 'italic');
    const splitLeyenda = doc.splitTextToSize(leyenda, pageWidth - (margin * 2));
    const leyendaY = footerY - 15;

    doc.setTextColor(100);
    doc.text(splitLeyenda, margin, leyendaY);
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');

    doc.text("LUGAR DE EXPEDICIÓN:     AGUASCALIENTES, AGUASCALIENTES", pageWidth / 2, footerY, { align: 'center' });
  };

  const generatePdfIndividual = async (alumno, bimestresSeleccionados, outputType = 'save', datosFirmas = {}) => {
    const doc = new jsPDF();
    await drawReportCard(doc, alumno, bimestresSeleccionados, datosFirmas);

    if (outputType === 'save') {
      const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;
      doc.save(`Boleta_${nombreCompleto.replace(/\s/g, '_')}.pdf`);
      setModalPdf({ visible: false, alumno: null });
    }
    return doc.output('datauristring');
  };

  // 🌟 NUEVA FUNCIÓN: Descargar todas las boletas en un solo PDF
  const generatePdfGrupal = async () => {
    if (!alumnos || alumnos.length === 0) {
      mostrarNotificacion("No hay alumnos en el grupo.", "error");
      return;
    }

    const doc = new jsPDF();
    let isFirstPage = true;

    // Mostramos loading o notificación...
    mostrarNotificacion("Generando PDF grupal, por favor espere...", "info");

    for (const alumno of alumnos) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;
      // Por defecto, incluimos los 3 trimestres en el reporte grupal
      await drawReportCard(doc, alumno, [true, true, true]);
    }

    const nombreGrupo = selectedGrupo.nombre.replace(/\s/g, '_');
    doc.save(`Boletas_Grupo_${nombreGrupo}.pdf`);
    mostrarNotificacion("PDF grupal descargado correctamente.");
  };

  // 🌟 NUEVA FUNCIÓN: Generar reporte de bajo rendimiento (Promedios <= 6)
  // 🌟 NUEVA FUNCIÓN: Generar reporte de bajo rendimiento (Promedios <= 6)
  // Acepta bimestresSeleccionados: array de booleans [T1, T2, T3]
  const generatePdfBajoRendimiento = async (bimestresSeleccionados = [true, true, true]) => {
    if (!alumnos || alumnos.length === 0) {
      mostrarNotificacion("No hay alumnos en el grupo.", "error");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // --- ENCABEZADO REPORTE ---
    doc.setFontSize(14); // Un poco más pequeño para el título largo
    doc.setFont(undefined, 'bold');
    // Título actualizado
    const titulo = "Registro de alumnos en riesgo de no alcanzar los procesos de desarrollo de aprendizaje";
    const splitTitulo = doc.splitTextToSize(titulo, pageWidth - 40); // Ajustar márgenes
    doc.text(splitTitulo, pageWidth / 2, 20, { align: 'center' });

    // Ajustar Y basado en líneas del título
    let currentY = 20 + (splitTitulo.length * 6);

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Grupo: ${selectedGrupo.nombre}`, 14, currentY + 10);
    // Fecha actual
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Fecha: ${fecha}`, pageWidth - 14, currentY + 10, { align: 'right' });

    currentY += 20; // Espacio para la tabla

    // Filtrar alumnos con al menos una materia <= 6 en cualquier trimestre
    const alumnosEnRiesgo = [];

    alumnos.forEach(alumno => {
      const materiasBajas = [];
      materias.forEach(materia => {
        [0, 1, 2].forEach(bim => {
          // Solo si el bimestre fue seleccionado
          if (bimestresSeleccionados[bim]) {
            const cal = calificaciones[alumno._id]?.[materia]?.[bim];
            // Solo si existe calificación y es <= 6
            if (cal !== undefined && cal !== null && cal <= 6) {
              materiasBajas.push(`${materia} (T${bim + 1}: ${cal})`);
            }
          }
        });
      });

      if (materiasBajas.length > 0) {
        alumnosEnRiesgo.push({
          nombre: `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`,
          detalles: materiasBajas.join('\n') // Formato vertical para mejor legibilidad
        });
      }
    });

    if (alumnosEnRiesgo.length === 0) {
      mostrarNotificacion("No se encontraron alumnos con calificaciones <= 6 en los trimestres seleccionados.", "info");
      return;
    }

    // Generar tabla
    const tableBody = alumnosEnRiesgo.map((item, index) => [
      index + 1,
      item.nombre,
      item.detalles
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Nombre del Alumno', 'Materias en rezago']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [231, 76, 60], textColor: 255, halign: 'center' }, // Rojo alerta
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { cellWidth: 'auto' } // El resto para los detalles
      }
    });

    // Pie de página
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.text("Este reporte incluye calificaciones reprobatorias (5) y mínimas aprobatorias (6).", 14, pageHeight - 10);

    doc.save(`Reporte_Riesgo_${selectedGrupo.nombre.replace(/\s/g, '_')}.pdf`);
    mostrarNotificacion(`Reporte generado: ${alumnosEnRiesgo.length} alumnos en riesgo.`);
    setModalBajoRendimiento({ ...modalBajoRendimiento, visible: false }); // Cerrar modal al terminar
  };

  const generatePdfConsolidado = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text(`Reporte de Calificaciones del Grupo: ${selectedGrupo.nombre}`, 14, 20);

    const head = [
      [{ content: 'Nombre del Alumno', rowSpan: 2 }],
      ...materias.map(materia => [{ content: materia, colSpan: 3 }]),
      [{ content: 'PROMEDIO TRIMESTRAL', colSpan: 3 }],
      [{ content: 'FINAL', rowSpan: 2 }]
    ];
    const subhead = [...materias.flatMap(() => ['T1', 'T2', 'T3']), 'T1', 'T2', 'T3'];
    head.push(subhead);

    const body = alumnos.map(alumno => {
      const row = [`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`];
      materias.forEach(materia => {
        [0, 1, 2].forEach(bim => {
          const cal = calificaciones[alumno._id]?.[materia]?.[bim];
          row.push(cal != null ? cal.toFixed(1) : '-');
        });
      });
      [0, 1, 2].forEach(bim => {
        const prom = calcularPromedioBimestre(alumno._id, bim);
        row.push(prom > 0 ? prom.toFixed(1) : '-');
      });
      const promFinal = calcularPromedioFinal(alumno._id);
      row.push(promFinal > 0 ? promFinal.toFixed(2) : '-');
      return row;
    });

    autoTable(doc, {
      startY: 30, head: head, body: body, theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
      styles: { fontSize: 8, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
    });

  };

  const handleSendPdf = async (platform, recipient, alumno) => {
    const pdfDataUri = await generatePdfIndividual(alumno, [true, true, true], 'data');
    const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;

    if (platform === 'whatsapp') {
      const mensaje = `Hola, te comparto la boleta de calificaciones de ${nombreCompleto}. Por favor, descárgala y adjúntala en la conversación.`;
      const url = `https://wa.me/${recipient}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');

      const link = document.createElement('a');
      link.href = pdfDataUri;
      link.download = `Boleta_${nombreCompleto.replace(/\s/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setModalShare({ visible: false, alumno: null });
  };



  if (loading && !selectedGrupo) return <div className="calificaciones-container">Cargando grupos...</div>;
  if (error) return <div className="calificaciones-container error-message">{error}</div>;

  return (
    <div className="calificaciones-container section">
      <Notificacion
        mensaje={notificacion.mensaje}
        tipo={notificacion.tipo}
        onClose={() => setNotificacion({ visible: false, mensaje: '', tipo: '' })}
      />

      {!selectedGrupo ? (
        <>
          <h1 className="calificaciones-title">Seleccionar Grupo</h1>
          <p className="calificaciones-subtitle">Elige un grupo para consultar las calificaciones de sus alumnos.</p>
          <div className="grupos-grid">
            {grupos.map(grupo => (
              <div key={grupo._id} className="grupo-card" onClick={() => handleSelectGrupo(grupo)}>
                <div className="grupo-card-icon">📚</div>
                <h2>{grupo.nombre}</h2>
                <p>{grupo.alumnos.length} Alumnos</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {modalPdf.visible && (
            <div className="modal-overlay" onClick={() => setModalPdf({ visible: false, alumno: null })}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Descargar Boleta de {`${modalPdf.alumno?.apellidoPaterno} ${modalPdf.alumno?.nombre}`}</h3>
                <p>Selecciona los trimestres que deseas incluir:</p>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const bimestresSeleccionados = [e.target.b1.checked, e.target.b2.checked, e.target.b3.checked];
                  if (!bimestresSeleccionados.some(b => b)) {
                    mostrarNotificacion("Debes seleccionar al menos un Trimestre.", "error");
                    return;
                  }
                  // Ya no leemos inputs del form, generatePdfIndividual usa localStorage/grupo
                  generatePdfIndividual(modalPdf.alumno, bimestresSeleccionados, 'save');
                }}>
                  <div className="checkbox-group">
                    <label><input type="checkbox" name="b1" defaultChecked /> Trimestre 1</label>
                    <label><input type="checkbox" name="b2" defaultChecked /> Trimestre 2</label>
                    <label><input type="checkbox" name="b3" defaultChecked /> Trimestre 3</label>
                  </div>

                  <div style={{ marginTop: '15px', color: '#ccc', fontSize: '0.9rem' }}>
                    <p><strong>Nota:</strong> Se usará el Director asignado globalmente y el Asesor del grupo.</p>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button type="submit" className="button">Descargar Boleta</button>
                    <button type="button" className="button-secondary" onClick={() => setModalPdf({ visible: false, alumno: null })}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {modalShare.visible && (
            <ModalShare
              alumno={modalShare.alumno}
              onClose={() => setModalShare({ visible: false, alumno: null })}
              onSend={handleSendPdf}
            />
          )}

          <div className="header-controls" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={handleBackToGrupos} className="back-button">&larr; Volver a Grupos</button>

            {/* 🌟 BOTÓN DIRECTOR GLOBAL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#2c3e50', padding: '8px 15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#aaa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Director Actual</span>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>
                  {localStorage.getItem('current_director_name') || 'No Asignado'}
                </span>
              </div>
              <button
                className="button-secondary"
                onClick={() => setModalDirector(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85rem',
                  backgroundColor: '#3498db',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#2980b9'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#3498db'}
              >
                Cambiar / Asignar
              </button>
            </div>
          </div>

          <div className="calificaciones-header">
            <h1 className="calificaciones-title">Calificaciones del Grupo {selectedGrupo.nombre}</h1>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>

              <button
                className="button"
                onClick={generatePdfGrupal}
                style={{ backgroundColor: '#8e44ad', color: 'white' }}
                title="Generar un solo PDF con todas las boletas del grupo"
              >
                📄 Descargar Todo el Grupo
              </button>

              <button
                className="button"
                onClick={() => setModalBajoRendimiento({ ...modalBajoRendimiento, visible: true })}
                style={{ backgroundColor: '#e74c3c', color: 'white' }}
                title="Generar lista de alumnos con calificaciones <= 6"
              >
                ⚠️ Reporte Baja Calif.
              </button>

              <button
                className="button"
                onClick={() => setIsEditing(!isEditing)}
                style={{ backgroundColor: isEditing ? '#27ae60' : '#f39c12' }}
              >
                {isEditing ? 'Terminar Edición' : 'Modificar Tabla'}
              </button>
            </div>
          </div>

          {modalDirector && (
            <div className="modal-overlay" onClick={() => setModalDirector(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3>Asignar Director(a)</h3>
                <p>Este nombre aparecerá en todas las boletas que generes.</p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  const nuevoDirector = e.target.directorGlobal.value;
                  if (nuevoDirector) {
                    localStorage.setItem('current_director_name', nuevoDirector);
                    if (!savedDirectores.includes(nuevoDirector)) {
                      const updated = [...savedDirectores, nuevoDirector];
                      setSavedDirectores(updated);
                      localStorage.setItem('saved_directores', JSON.stringify(updated));
                    }
                    mostrarNotificacion("Director asignado correctamente.");
                    setModalDirector(false);
                  }
                }}>
                  <div className="input-group">
                    <label>Nombre del Director(a):</label>
                    <input
                      list="directores-list-global"
                      name="directorGlobal"
                      defaultValue={localStorage.getItem('current_director_name') || ''}
                      placeholder="Escribe o selecciona..."
                      style={{ width: '100%', padding: '10px', marginTop: '5px' }}
                      autoFocus
                    />
                    <datalist id="directores-list-global">
                      {savedDirectores.map((dir, idx) => (
                        <option key={idx} value={dir} />
                      ))}
                    </datalist>
                  </div>
                  {/* ... Historial list simplified ... */}
                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button type="submit" className="button">Guardar</button>
                    <button type="button" className="button-secondary" onClick={() => setModalDirector(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 🌟 MODAL REPORTE BAJO RENDIMIENTO */}
          {modalBajoRendimiento.visible && (
            <div className="modal-overlay" onClick={() => setModalBajoRendimiento({ ...modalBajoRendimiento, visible: false })}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3>Generar Reporte de Riesgo</h3>
                <p>Selecciona los trimestres a evaluar:</p>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  generatePdfBajoRendimiento(modalBajoRendimiento.seleccion);
                }}>
                  <div className="checkbox-group" style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '20px 0' }}>
                    {[0, 1, 2].map(index => (
                      <label key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modalBajoRendimiento.seleccion[index]}
                          onChange={(e) => {
                            const newSeleccion = [...modalBajoRendimiento.seleccion];
                            newSeleccion[index] = e.target.checked;
                            setModalBajoRendimiento({ ...modalBajoRendimiento, seleccion: newSeleccion });
                          }}
                        />
                        Trimestre {index + 1}
                      </label>
                    ))}
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="button" style={{ backgroundColor: '#e74c3c', color: 'white' }}>
                      Generar PDF
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => setModalBajoRendimiento({ ...modalBajoRendimiento, visible: false })}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}




          {loading ? (
            <div className="loading-spinner">Cargando calificaciones...</div>
          ) : (
            <div className="table-wrapper">
              <table className="calificaciones-table">
                <thead>
                  <tr>
                    <th rowSpan="2" className="num-header">#</th>
                    <th rowSpan="2" className="nombre-header">Nombre del Alumno</th>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={materias}
                        strategy={horizontalListSortingStrategy}
                      >
                        {materias.map(materia => (
                          <SortableHeader key={materia} id={materia} disabled={!isEditing}>
                            {materia}
                          </SortableHeader>
                        ))}
                      </SortableContext>
                    </DndContext>
                    <th colSpan="3" className="promedio-header">PROMEDIO TRIMESTRAL</th>
                    <th rowSpan="2" className="promedio-header-final">FINAL</th>
                    <th rowSpan="2" className="actions-header">Acciones</th>
                  </tr>
                  <tr>
                    {materias.flatMap(materia => [<th key={`${materia}-b1`}>T1</th>, <th key={`${materia}-b2`}>T2</th>, <th key={`${materia}-b3`}>T3</th>])}
                    <th className="promedio-header">T1</th>
                    <th className="promedio-header">T2</th>
                    <th className="promedio-header">T3</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map(alumno => {
                    const promFinal = calcularPromedioFinal(alumno._id);
                    return (
                      <tr key={alumno._id}>
                        <td>{alumnos.indexOf(alumno) + 1}</td>
                        <td>{`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}</td>
                        {materias.map(materia => (
                          <React.Fragment key={`${alumno._id}-${materia}`}>
                            {[0, 1, 2].map(bimestreIndex => {
                              const rawCal = calificaciones[alumno._id]?.[materia]?.[bimestreIndex];
                              const cal = clampGrade(rawCal);
                              return (
                                <td key={`${materia}-b${bimestreIndex}`} className={typeof cal === 'number' ? (cal < 6 ? 'reprobado' : 'aprobado') : ''}>
                                  {cal != null ? cal.toFixed(1) : '-'}
                                </td>
                              )
                            })}
                          </React.Fragment>
                        ))}
                        {[0, 1, 2].map(bimestreIndex => {
                          const promedio = calcularPromedioBimestre(alumno._id, bimestreIndex);
                          return (
                            <td key={`prom-${bimestreIndex}`} className={`promedio-cell ${promedio > 0 && promedio < 6 ? 'reprobado' : 'aprobado'}`}>
                              <strong>{promedio > 0 ? promedio.toFixed(1) : '-'}</strong>
                            </td>
                          )
                        })}
                        <td className={`promedio-final-cell ${promFinal > 0 && promFinal < 6 ? 'reprobado' : 'aprobado'}`}>
                          <strong>{promFinal > 0 ? promFinal.toFixed(2) : '-'}</strong>
                        </td>
                        <td className="actions-cell">
                          <button onClick={() => setModalPdf({ visible: true, alumno })} title="Descargar Boleta Individual">📄</button>
                          <button onClick={() => setModalShare({ visible: true, alumno: alumno })} title="Compartir Boleta">🔗</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
          }
        </>
      )}
    </div >
  );
}

// --- Componente: Modal para Compartir ---
// --- Componente: Modal para Compartir ---
function ModalShare({ alumno, onClose, onSend }) {
  const [recipientPhone, setRecipientPhone] = useState('');

  const handleWhatsAppSubmit = (e) => {
    e.preventDefault();
    if (recipientPhone) {
      onSend('whatsapp', recipientPhone, alumno);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Enviar Boleta de {`${alumno.apellidoPaterno} ${alumno.nombre}`}</h3>

        <form onSubmit={handleWhatsAppSubmit} className="share-form">
          <label htmlFor="phone-input">Enviar a WhatsApp:</label>
          <div className="input-group">
            <input
              id="phone-input"
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="521234567890 (cód. país + número)"
              required
            />
            <button type="submit" className="button whatsapp">Enviar WhatsApp</button>
          </div>
        </form>

        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default Calificaciones;