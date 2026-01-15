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
    transform: CSS.Translate.toString(transform),
    transition,
    cursor: disabled ? 'default' : (isDragging ? 'grabbing' : 'grab'),
    touchAction: 'none',
    backgroundColor: isDragging ? '#2c3e50' : undefined, // Color oscuro al arrastrar
    color: isDragging ? 'white' : undefined,
    zIndex: isDragging ? 100 : undefined,
    position: 'relative',
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
      setGrupos(res.data);
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

  const generatePdfIndividual = async (alumno, bimestresSeleccionados, outputType = 'save', datosFirmas = {}) => {
    // Si no vienen datosFirmas (ej: uso directo), intentamos sacar del localStorage o del grupo
    let { nombreDirector = '', nombreDocente = '' } = datosFirmas;

    if (!nombreDirector) {
      // Intentar leer el director global "current" (si implementamos esa lógica) o el último usado
      // Para simplificar, usamos el último seleccionado en el modal global o localStorage
      nombreDirector = localStorage.getItem('current_director_name') || '';
    }
    if (!nombreDocente) {
      // Usar el asesor del grupo
      nombreDocente = selectedGrupo?.asesor || '';
    }
    const doc = new jsPDF();
    const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;

    const img = new Image();
    img.src = logoImage;
    await img.decode();
    const logoWidth = 25, margin = 14;
    const logoHeight = (img.height * logoWidth) / img.width;
    const pageWidth = doc.internal.pageSize.width;
    doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

    doc.setFontSize(12);

    // --- AJUSTES DE POSICIÓN Y ESPACIADO ---
    let yPos = margin + 5;

    // 1. Escuela Secundaria
    doc.text('Escuela Secundaria No. 9 "Amado Nervo"', margin, yPos);

    // Incremento para la siguiente línea (e.g., 7mm)
    yPos += 7;

    // 2. Boleta de Calificaciones
    doc.setFont(undefined, 'bold'); // Poner el título en negrita para resaltarlo
    doc.text('Boleta de Calificaciones', margin, yPos);
    doc.setFont(undefined, 'normal'); // Volver a normal

    // Incremento
    yPos += 7;

    // 3. Alumno
    doc.text(`Alumno: ${nombreCompleto}`, margin, yPos);

    // Incremento
    yPos += 7;

    // 4. Grupo
    doc.text(`Grupo: ${selectedGrupo.nombre}`, margin, yPos);

    // 5. Espacio de separación antes de la tabla
    yPos += 5; // Espacio extra de 5mm antes de la tabla
    // --- FIN AJUSTES DE POSICIÓN ---

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
          // APLICAR CLAMPGRADE TAMBIÉN AL PDF
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
      // *** USAR LA POSICIÓN Y CALCULADA Y CORREGIDA ***
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

    // --- SECCIÓN DE FIRMAS Y PIE DE PÁGINA (LAYOUT DIVIDIDO) ---
    // Usamos finalY de la última tabla dibujada
    let finalY = doc.lastAutoTable.finalY + 15; // Espacio de separación (15mm)

    // pageWidth y margin ya están definidos al inicio de la función
    const availableWidth = pageWidth - (margin * 2);
    const halfWidth = availableWidth / 2 - 5; // Ancho de columna (menos un pequeño gap)
    const rightColX = margin + halfWidth + 10; // Posición X para columna derecha (más gap)

    // --- COLUMNA IZQUIERDA: Docente y Director (Apilados) ---
    let ySignatures = finalY;

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    // 1. Docente (Ahora Asesor)
    doc.text("Nombre y firma del asesor (a)", margin, ySignatures);
    ySignatures += 10; // Espacio para firma
    // Nombre (si existe)
    if (nombreDocente) {
      doc.setFont(undefined, 'bold');
      doc.text(nombreDocente.toUpperCase(), margin, ySignatures);
      doc.setFont(undefined, 'normal');
    }
    // Línea de firma
    doc.line(margin, ySignatures + 1, margin + 80, ySignatures + 1); // Línea de 80mm

    // 2. Director (Más abajo)
    ySignatures += 25; // Separación vertical entre firmas
    doc.text("Nombre y firma del director (a)", margin, ySignatures);
    ySignatures += 10;
    if (nombreDirector) {
      doc.setFont(undefined, 'bold');
      doc.text(nombreDirector.toUpperCase(), margin, ySignatures);
      doc.setFont(undefined, 'normal');
    }
    doc.line(margin, ySignatures + 1, margin + 80, ySignatures + 1);


    // --- COLUMNA DERECHA: Tabla de Firmas de Padres ---
    // Usamos autoTable pero lo posicionamos a la derecha
    autoTable(doc, {
      startY: finalY - 4, // Alineado un poco más arriba para compensar header
      margin: { left: rightColX }, // IMPORTANTE: Margen izquierdo para empujar la tabla
      tableWidth: halfWidth, // Ancho restringido a la mitad
      head: [[{ content: 'FIRMA DE LA MADRE O PADRE DE FAMILIA O PERSONA TUTORA', colSpan: 3 }]],
      body: [
        ['1er periodo', '2º periodo', '3er periodo'],
        ['\n\n\n\n', '\n\n\n\n', '\n\n\n\n'] // Espacio vertical para firmar
      ],
      theme: 'plain',
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center', // Centrado dentro de las celdas
        valign: 'middle',
        fontSize: 7, // Letra un poco más pequeña para que quepa
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
        0: { cellWidth: 'auto' }, // Distribución automática
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' }
      }
    });


    // 3. Lugar de Expedición (Al final, centrado)
    // Calculamos una posición Y segura, o usamos el final de la página menos margen
    const pageHeight = doc.internal.pageSize.height;
    const footerY = pageHeight - 15;

    doc.setFontSize(8);
    doc.text("LUGAR DE EXPEDICIÓN:     AGUASCALIENTES, AGUASCALIENTES", pageWidth / 2, footerY, { align: 'center' });

    if (outputType === 'save') {
      doc.save(`Boleta_${nombreCompleto.replace(/\s/g, '_')}.pdf`);
      setModalPdf({ visible: false, alumno: null });
    }

    return doc.output('datauristring');
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
            <button
              className="button"
              onClick={() => setIsEditing(!isEditing)}
              style={{ marginLeft: '20px', backgroundColor: isEditing ? '#27ae60' : '#f39c12' }}
            >
              {isEditing ? 'Terminar Edición' : 'Modificar Tabla'}
            </button>
          </div>

          {/* 🌟 MODAL ASIGNAR DIRECTOR GLOBAL */}
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

                    // Guardar en historial
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

                  {/* Lista de directores guardados con opción de eliminar */}
                  <div style={{ marginTop: '15px' }}>
                    <p style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '5px' }}>Historial:</p>
                    <ul style={{ listStyle: 'none', padding: 0, maxHeight: '100px', overflowY: 'auto', border: '1px solid #444', borderRadius: '4px' }}>
                      {savedDirectores.map((dir, idx) => (
                        <li key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '5px 10px',
                          borderBottom: '1px solid #555',
                          backgroundColor: '#2c3e50'
                        }}>
                          <span
                            style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'white' }}
                            onClick={() => {
                              // Al hacer click en el nombre, lo ponemos en el input (via state o DOM, aquí DOM para simpleza si input tiene id)
                              const input = document.querySelector('input[name="directorGlobal"]');
                              if (input) input.value = dir;
                            }}
                          >
                            {dir}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = savedDirectores.filter(d => d !== dir);
                              setSavedDirectores(updated);
                              localStorage.setItem('saved_directores', JSON.stringify(updated));
                              // Si eliminamos el actual, limpiamos también
                              if (localStorage.getItem('current_director_name') === dir) {
                                localStorage.removeItem('current_director_name');
                              }
                            }}
                            style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }}
                            title="Eliminar del historial"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button type="submit" className="button">Guardar</button>
                    <button type="button" className="button-secondary" onClick={() => setModalDirector(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? <p>Cargando calificaciones...</p> : (
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
          )}
        </>
      )}
    </div>
  );
}

// --- Componente: Modal para Compartir ---
function ModalShare({ alumno, onClose, onSend }) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (recipientEmail) {
      onSend('email', recipientEmail, alumno);
    }
  };

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

        <form onSubmit={handleEmailSubmit} className="share-form">
          <label htmlFor="email-input">Enviar por Correo Electrónico:</label>
          <div className="input-group">
            <input
              id="email-input"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              required
            />
            <button type="submit" className="button">Enviar Email</button>
          </div>
        </form>

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