import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Calificaciones.css'; 
import logoImage from './Logoescuela.png'; 

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
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: '' });

  const mostrarNotificacion = (mensaje, tipo = 'exito') => {
    setNotificacion({ visible: true, mensaje, tipo });
  };

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        const res = await axios.get('http://localhost:5000/grupos?populate=alumnos,profesoresAsignados', getAxiosConfig());
        setGrupos(res.data);
      } catch (err) {
        console.error("Error al cargar grupos:", err);
        setError("No se pudieron cargar los grupos. Intenta de nuevo más tarde.");
      } finally {
        setLoading(false);
      }
    };
    fetchGrupos();
  }, []);

  const handleSelectGrupo = async (grupo) => {
    setLoading(true);
    setSelectedGrupo(grupo);

    const alumnosOrdenados = [...grupo.alumnos].sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno));
    setAlumnos(alumnosOrdenados);

    const materiasAsignadas = [...new Set(grupo.profesoresAsignados.map(asig => asig.asignatura))];
    setMaterias(materiasAsignadas);

    try {
      const res = await axios.get(`http://localhost:5000/grupos/${grupo._id}/calificaciones-admin`, getAxiosConfig());
      setCalificaciones(res.data || {});
    } catch (err) {
      console.error("Error detallado al cargar calificaciones:", err.response || err);
      mostrarNotificacion("No se pudieron cargar las calificaciones consolidadas de este grupo.", "error");
      setCalificaciones({});
    } finally {
      setLoading(false);
    }
  };

  const calcularPromedioBimestre = (alumnoId, bimestreIndex) => {
    const alumnoCal = calificaciones[alumnoId];
    if (!alumnoCal) return 0;
    let suma = 0;
    let count = 0;
    materias.forEach(materia => {
      if (alumnoCal[materia] && typeof alumnoCal[materia][bimestreIndex] === 'number') {
        suma += alumnoCal[materia][bimestreIndex];
        count++;
      }
    });
    return count > 0 ? (suma / count) : 0;
  };
  
  const calcularPromedioFinal = (alumnoId) => {
    let sumaDePromedios = 0;
    let bimestresConCalificacion = 0;
    for (let i = 0; i < 3; i++) {
      const promedioBim = calcularPromedioBimestre(alumnoId, i);
      if (promedioBim > 0) {
        sumaDePromedios += promedioBim;
        bimestresConCalificacion++;
      }
    }
    return bimestresConCalificacion > 0 ? (sumaDePromedios / bimestresConCalificacion) : 0;
  };

  const generatePdfIndividual = async (alumno, bimestresSeleccionados, outputType = 'save') => {
    const doc = new jsPDF();
    const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;
    
    const img = new Image();
    img.src = logoImage;
    await img.decode();
    const logoWidth = 25, margin = 14;
    const logoHeight = (img.height * logoWidth) / img.width;
    const pageWidth = doc.internal.pageSize.width;
    doc.addImage(logoImage, 'PNG', pageWidth - margin - logoWidth, margin - 5, logoWidth, logoHeight);

    doc.setFontSize(18);
    doc.text('Boleta de Calificaciones', margin, margin + 5);
    doc.setFontSize(12);
    doc.text(`Alumno: ${nombreCompleto}`, margin, margin + 15);
    doc.text(`Grupo: ${selectedGrupo.nombre}`, margin, margin + 21);

    const tableHeaders = ['Materia'];
    if (bimestresSeleccionados[0]) tableHeaders.push("Bim. 1");
    if (bimestresSeleccionados[1]) tableHeaders.push("Bim. 2");
    if (bimestresSeleccionados[2]) tableHeaders.push("Bim. 3");

    const alumnoCal = calificaciones[alumno._id] || {};
    const tableBody = materias.map(materia => {
      const cals = alumnoCal[materia] || [null, null, null];
      const row = [materia];
      cals.forEach((cal, index) => {
        if (bimestresSeleccionados[index]) row.push(cal !== null ? cal.toFixed(1) : '-');
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
      startY: margin + 30,
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
        [{ content: 'PROMEDIO BIMESTRAL', colSpan: 3 }],
        [{ content: 'FINAL', rowSpan: 2 }]
    ];
    const subhead = [...materias.flatMap(() => ['B1', 'B2', 'B3']), 'B1', 'B2', 'B3'];
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
    doc.save(`Reporte_Consolidado_${selectedGrupo.nombre.replace(/\s/g, '_')}.pdf`);
  };

  const handleSendPdf = async (platform, recipient, alumno) => {
    const pdfDataUri = await generatePdfIndividual(alumno, [true, true, true], 'data');
    const nombreCompleto = `${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`;

    if (platform === 'email') {
        try {
            const base64Pdf = pdfDataUri.split(',')[1];

            const payload = {
                to: recipient,
                subject: `Boleta de Calificaciones de ${nombreCompleto}`,
                body: `Estimado/a, <br><br>Adjunto encontrará la boleta de calificaciones de <strong>${nombreCompleto}</strong>.<br><br>Saludos cordiales,<br>Administración Escolar`,
                pdfData: base64Pdf 
            };
            
            await axios.post('http://localhost:5000/api/enviar-boleta', payload, getAxiosConfig());
            mostrarNotificacion(`Boleta enviada a ${recipient} exitosamente.`, 'exito');
        
        } catch (error) {
            console.error("Error al enviar correo:", error);
            mostrarNotificacion("Error al enviar el correo. Revisa el backend.", "error");
        }

    } else if (platform === 'whatsapp') {
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
                 <p>Selecciona los bimestres que deseas incluir:</p>
                 <form onSubmit={(e) => {
                   e.preventDefault();
                   const bimestresSeleccionados = [e.target.b1.checked, e.target.b2.checked, e.target.b3.checked];
                   if (!bimestresSeleccionados.some(b => b)) {
                     mostrarNotificacion("Debes seleccionar al menos un bimestre.", "error");
                     return;
                   }
                   generatePdfIndividual(modalPdf.alumno, bimestresSeleccionados, 'save');
                 }}>
                   <div className="checkbox-group">
                     <label><input type="checkbox" name="b1" defaultChecked /> Bimestre 1</label>
                     <label><input type="checkbox" name="b2" defaultChecked /> Bimestre 2</label>
                     <label><input type="checkbox" name="b3" defaultChecked /> Bimestre 3</label>
                   </div>
                   <div className="modal-actions">
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
          
          <div className="header-controls">
            <button onClick={() => setSelectedGrupo(null)} className="back-button">&larr; Volver a Grupos</button>
           
          </div>

          <div className="calificaciones-header">
            <h1 className="calificaciones-title">Calificaciones del Grupo {selectedGrupo.nombre}</h1>
          </div>
          
          {loading ? <p>Cargando calificaciones...</p> : (
            <div className="table-wrapper">
              <table className="calificaciones-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Nombre del Alumno</th>
                    {materias.map(materia => <th key={materia} colSpan="3">{materia}</th>)}
                    <th colSpan="3" className="promedio-header">PROMEDIO BIMESTRAL</th>
                    <th rowSpan="2" className="promedio-header-final">FINAL</th>
                    <th rowSpan="2">Acciones</th>
                  </tr>
                  <tr>
                    {materias.flatMap(materia => [<th key={`${materia}-b1`}>B1</th>, <th key={`${materia}-b2`}>B2</th>, <th key={`${materia}-b3`}>B3</th>])}
                    <th className="promedio-header">B1</th>
                    <th className="promedio-header">B2</th>
                    <th className="promedio-header">B3</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map(alumno => {
                    const promFinal = calcularPromedioFinal(alumno._id);
                    return (
                      <tr key={alumno._id}>
                        <td>{`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}</td>
                        {materias.map(materia => (
                          <React.Fragment key={`${alumno._id}-${materia}`}>
                            {[0, 1, 2].map(bimestreIndex => {
                              const cal = calificaciones[alumno._id]?.[materia]?.[bimestreIndex];
                              return (
                                <td key={bimestreIndex} className={typeof cal === 'number' ? (cal < 6 ? 'reprobado' : 'aprobado') : ''}>
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

// --- NUEVO COMPONENTE: Modal para Compartir ---
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
                            placeholder="1234567890 (número)"
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

