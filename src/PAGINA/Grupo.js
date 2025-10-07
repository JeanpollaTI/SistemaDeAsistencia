import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { FaTrash, FaPencilAlt } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Grupo.css';
import Notificacion from './Notificacion';
import ConfirmacionModal from './ConfirmacionModal';
import logoImage from './Logoescuela.png'; // Asegúrate que esta ruta sea correcta

// --- CONSTANTES DE CONFIGURACIÓN ---
const NUM_BIMESTRES = 3;
const DIAS_INICIALES = 30;

function Grupo({ user }) {
  // --- ESTADOS ---
  const [grupos, setGrupos] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(null);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [nuevoGrupo, setNuevoGrupo] = useState({ nombre: '', alumnos: [] });
  const [alumnoInput, setAlumnoInput] = useState({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
  const [asistencia, setAsistencia] = useState({});
  const [diasPorBimestre, setDiasPorBimestre] = useState({});
  const [bimestreAbierto, setBimestreAbierto] = useState({});
  const [asignaciones, setAsignaciones] = useState({});
  const [editingAlumno, setEditingAlumno] = useState(null);
  const [notificacion, setNotificacion] = useState({ visible: false, mensaje: '', tipo: '' });
  const [grupoParaEliminar, setGrupoParaEliminar] = useState(null);
  const [alumnoParaEliminar, setAlumnoParaEliminar] = useState(null);
  const [archivoXLS, setArchivoXLS] = useState(null);
  const [nombreGrupoImport, setNombreGrupoImport] = useState('');

  // --- LÓGICA DE CARGA DE DATOS ---
  useEffect(() => {
    if (!user) { setLoading(false); setError("Información de usuario no disponible."); return; }
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setError("No autorizado. Por favor, inicia sesión."); setLoading(false); return; }
      const axiosConfig = { headers: { Authorization: `Bearer ${token}` } };
      try {
        if (user.role === 'admin') {
          const [gruposRes, profesoresRes] = await Promise.all([
            axios.get('/grupos', axiosConfig),
            axios.get('/profesores', axiosConfig)
          ]);
          setGrupos(gruposRes.data);
          setProfesores(profesoresRes.data);
        } else if (user.role === 'profesor') {
          const gruposRes = await axios.get('/grupos/mis-grupos', axiosConfig);
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

  // --- LÓGICA DE MODALES Y NOTIFICACIONES ---
  const mostrarNotificacion = (mensaje, tipo = 'success') => {
    setNotificacion({ visible: true, mensaje, tipo });
  };

  const abrirModal = async (tipo, data = null) => {
    if (tipo === 'gestionarGrupo') {
      setGrupoSeleccionado(data);
      if (data) { setNuevoGrupo(structuredClone(data)); }
      else { setNuevoGrupo({ nombre: '', alumnos: [] }); }
      setModalVisible('gestionarGrupo');
    } else if (tipo === 'asignar') {
      setGrupoSeleccionado(data);
      const asignacionesIniciales = {};
      data.profesoresAsignados.forEach(asig => {
        if (asig.profesor?._id) {
          asignacionesIniciales[asig.profesor._id] = asig.asignatura;
        }
      });
      setAsignaciones(asignacionesIniciales);
      setModalVisible('asignar');
    } else if (tipo === 'asistencia') {
      setGrupoSeleccionado(data);
      const miAsignacion = data.profesoresAsignados.find(asig => asig.profesor?._id === user.id);
      if (!miAsignacion) {
        return mostrarNotificacion("No tienes una asignatura asignada para este grupo.", "error");
      }
      try {
        const res = await axios.get(`/asistencia?grupoId=${data._id}&asignatura=${miAsignacion.asignatura}`, getAxiosConfig());
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
        setAlumnoInput({ nombre: data.nombre, apellidoPaterno: data.apellidoPaterno, apellidoMaterno: data.apellidoMaterno || '' });
        setModalVisible('editarAlumno');
    } else if (tipo === 'importar') {
        setModalVisible('importar');
    }
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
    setAlumnoInput({ nombre: '', apellidoPaterno: '', apellidoMaterno: '' });
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
    if(!alumnoParaEliminar) return;
    setNuevoGrupo(prev => ({ ...prev, alumnos: prev.alumnos.filter(a => a._id !== alumnoParaEliminar._id) }));
    setAlumnoParaEliminar(null);
    mostrarNotificacion("Alumno eliminado de la lista.");
  };

  const handleGuardarGrupo = async () => {
    if (!nuevoGrupo.nombre.trim()) return mostrarNotificacion("El nombre del grupo es requerido.", 'error');
    try {
      const response = await axios.post('/grupos', nuevoGrupo, getAxiosConfig());
      setGrupos(prev => [...prev, response.data]);
      mostrarNotificacion(`Grupo "${nuevoGrupo.nombre}" guardado.`);
      cerrarModal();
    } catch (error) {
      mostrarNotificacion(error.response?.data?.error || 'Error al guardar.', 'error');
    }
  };

  const handleUpdateGrupo = async () => {
    if (!grupoSeleccionado) return;
    try {
      const response = await axios.put(`/grupos/${grupoSeleccionado._id}`, nuevoGrupo, getAxiosConfig());
      setGrupos(prev => prev.map(g => g._id === grupoSeleccionado._id ? response.data : g));
      mostrarNotificacion(`Grupo "${nuevoGrupo.nombre}" actualizado.`);
      cerrarModal();
    } catch (error) {
      mostrarNotificacion(error.response?.data?.error || 'Error al actualizar.', 'error');
    }
  };
  
  const handleGuardarAsignacion = async () => {
    if (!grupoSeleccionado) return;
    const asignacionesParaEnviar = Object.keys(asignaciones).map(profesorId => ({
      profesor: profesorId,
      asignatura: asignaciones[profesorId]
    }));
    try {
      const response = await axios.put(`/grupos/${grupoSeleccionado._id}/asignar-profesores`, { asignaciones: asignacionesParaEnviar }, getAxiosConfig());
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
      await axios.delete(`/grupos/${grupoParaEliminar._id}`, getAxiosConfig());
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
    const estados = ['', 'P', 'F'];
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
    if (!grupoSeleccionado) return;
    const miAsignacion = grupoSeleccionado.profesoresAsignados.find(asig => asig.profesor?._id === user.id);
    if (!miAsignacion) return mostrarNotificacion("Error: no se encontró tu asignatura para este grupo.", 'error');
    try {
      await axios.put(`/asistencia`, { 
        grupoId: grupoSeleccionado._id,
        asignatura: miAsignacion.asignatura,
        registros: asistencia, 
        diasPorBimestre 
      }, getAxiosConfig());
      
      mostrarNotificacion("Asistencia guardada exitosamente.");
      cerrarModal();
    } catch (error) {
      mostrarNotificacion("Error al guardar la asistencia.", 'error');
    }
  };
  
  const handleToggleBimestre = (alumnoId, bimIndex) => {
    setBimestreAbierto(prev => ({ [alumnoId]: prev[alumnoId] === bimIndex ? null : bimIndex }));
  };

  const calcularTotales = useMemo(() => (alumnoId, bimestre, asistenciaData, diasData) => {
    let presentes = 0;
    let faltas = 0;
    const diasDelBimestre = (diasData || diasPorBimestre)[bimestre] || DIAS_INICIALES;
    for (let i = 1; i <= diasDelBimestre; i++) {
        const key = `${alumnoId}-b${bimestre}-d${i}`;
        if ((asistenciaData || asistencia)[key]?.estado === 'P') presentes++;
        if ((asistenciaData || asistencia)[key]?.estado === 'F') faltas++;
    }
    return { presentes, faltas };
  }, [asistencia, diasPorBimestre]);

  const handleAsignacionChange = (profesorId, asignatura) => {
    setAsignaciones(prev => {
      const nuevas = { ...prev };
      if (asignatura) { nuevas[profesorId] = asignatura; }
      else { delete nuevas[profesorId]; }
      return nuevas;
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
            
            const response = await axios.post('/grupos', grupoParaGuardar, getAxiosConfig());
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
    
  const generarPDF = async (grupo) => {
    const miAsignacion = grupo.profesoresAsignados.find(
      asig => asig.profesor?._id === user.id
    );

    if (!miAsignacion) {
        console.error("No se encontró una asignación para el usuario actual en este grupo.", { userId: user.id, asignaciones: grupo.profesoresAsignados });
        return mostrarNotificacion(
            "No tienes una asignatura asignada para este grupo. No se puede generar el PDF.", 
            "error"
        );
    }

    try {
        const res = await axios.get(`/asistencia?grupoId=${grupo._id}&asignatura=${miAsignacion.asignatura}`, getAxiosConfig());
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

        doc.text(`Reporte de Asistencia - Grupo: ${grupo.nombre}`, margin, margin + 5);
        doc.text(`Asignatura: ${miAsignacion.asignatura}`, margin, margin + 12);
        
        const head = [
            [
                { content: 'Nombre Completo', rowSpan: 2, styles: { fillColor: [212, 175, 55] } },
                { content: 'Bimestre 1', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
                { content: 'Bimestre 2', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
                { content: 'Bimestre 3', colSpan: 2, styles: { fillColor: [212, 175, 55] } },
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
            startY: margin + 25,
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

        doc.save(`Asistencia_${grupo.nombre.replace(/ /g, '_')}.pdf`);
        mostrarNotificacion("PDF generado exitosamente.");

    } catch (error) {
        console.error("Error al generar PDF:", error);
        mostrarNotificacion("Error al cargar los datos de asistencia para el PDF.", "error");
    }
  };

  // --- INICIO DE CAMBIO ---
  if (loading) return (
    <div className="grupo-componente" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <p className="loading-message">Cargando...</p>
    </div>
  );
  // --- FIN DE CAMBIO ---
  
  if (error) return <div className="grupo-componente"><p className="error-message">{error}</p></div>;
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
                  <th>N° Alumnos</th>
                  <th>Profesores y Asignaturas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => (
                  <tr key={grupo._id}>
                    <td data-label="Grupo">{grupo.nombre}</td>
                    <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                    <td data-label="Asignaciones">
                      {grupo.profesoresAsignados && grupo.profesoresAsignados.length > 0
                        ? <ul className="asignacion-lista">
                            {grupo.profesoresAsignados.map((asig, index) => (
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
                {grupos.map(grupo => {
                  const miAsignacion = grupo.profesoresAsignados.find(asig => asig.profesor?._id === user.id);
                  const miAsignatura = miAsignacion ? miAsignacion.asignatura : 'N/A';
                  return (
                    <tr key={grupo._id}>
                      <td data-label="Grupo">{grupo.nombre}</td>
                      <td data-label="Alumnos">{grupo.alumnos?.length || 0}</td>
                      <td data-label="Mi Asignatura">{miAsignatura}</td>
                      <td className="acciones-cell">
                        <button className="btn btn-primary" onClick={() => abrirModal('asistencia', grupo)}>Tomar Asistencia</button>
                        <button className="btn btn-export" onClick={() => generarPDF(grupo)}>PDF</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(modalVisible === 'gestionarGrupo') && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>{grupoSeleccionado ? 'Editar Grupo' : 'Crear Nuevo Grupo'}</h2>
              <input type="text" placeholder="Nombre del Grupo (Ej: 1A)" value={nuevoGrupo.nombre} onChange={(e) => setNuevoGrupo({ ...nuevoGrupo, nombre: e.target.value })}/>
              <div className="alumno-form">
                <h4 className="form-subtitle">Agregar Nuevo Alumno</h4>
                <div className="alumno-form-inputs">
                  <input type="text" placeholder="Nombre(s)" value={alumnoInput.nombre} onChange={(e) => setAlumnoInput({ ...alumnoInput, nombre: e.target.value })} />
                  <input type="text" placeholder="Apellido Paterno" value={alumnoInput.apellidoPaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoPaterno: e.target.value })} />
                  <input type="text" placeholder="Apellido Materno" value={alumnoInput.apellidoMaterno} onChange={(e) => setAlumnoInput({ ...alumnoInput, apellidoMaterno: e.target.value })} />
                </div>
                <div className="alumno-form-actions">
                  <button className="btn btn-add" onClick={handleAgregarAlumno}>Agregar Alumno</button>
                </div>
              </div>
              <div className="alumnos-list">
                <h5>Alumnos en el grupo: {nuevoGrupo.alumnos.length}</h5>
                <ul>
                  {nuevoGrupo.alumnos.map(a => (
                    <li key={a._id}>
                      <span className="alumno-nombre-display">{`${a.apellidoPaterno} ${a.apellidoMaterno || ''} ${a.nombre}`}</span>
                      <div className="alumno-actions">
                        <button className="btn-edit-alumno" onClick={() => abrirModal('editarAlumno', a)}><FaPencilAlt /></button>
                        <button className="btn-delete-alumno" onClick={() => handleDeleteAlumno(a)}><FaTrash /></button>
                      </div>
                    </li>
                  ))}
                </ul>
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
                {profesores.map(profesor => (
                  <div key={profesor._id} className="asignacion-row">
                    <div className="profesor-checkbox">
                      <input type="checkbox" id={`prof-${profesor._id}`} checked={!!asignaciones[profesor._id]} onChange={(e) => { if (!e.target.checked) { handleAsignacionChange(profesor._id, null); } else { handleAsignacionChange(profesor._id, asignaciones[profesor._id] || profesor.asignaturas[0] || ''); }}}/>
                      <label htmlFor={`prof-${profesor._id}`}>{profesor.nombre}</label>
                    </div>
                    {!!asignaciones[profesor._id] && (
                      <select className="asignatura-select" value={asignaciones[profesor._id] || ''} onChange={(e) => handleAsignacionChange(profesor._id, e.target.value)}>
                        <option value="" disabled>Selecciona...</option>
                        {profesor.asignaturas.map(asig => (<option key={asig} value={asig}>{asig}</option>))}
                      </select>
                    )}
                  </div>
                ))}
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
              <h2>Toma de Asistencia: {grupoSeleccionado?.nombre}</h2>
              <div className="asistencia-grid">
                <div className="asistencia-body">
                  {grupoSeleccionado?.alumnos.sort((a, b) => a.apellidoPaterno.localeCompare(b.apellidoPaterno)).map(alumno => {
                    const bimestreActual = bimestreAbierto[alumno._id];
                    const totales = bimestreActual ? calcularTotales(alumno._id, bimestreActual, asistencia, diasPorBimestre) : null;
                    return (
                      <React.Fragment key={alumno._id}>
                        <div className="asistencia-row">
                          <div className="alumno-nombre">{`${alumno.apellidoPaterno} ${alumno.apellidoMaterno || ''} ${alumno.nombre}`}</div>
                          <div className="bimestres-container">
                            {Array.from({ length: NUM_BIMESTRES }).map((_, bimIndex) => (
                              <div key={bimIndex} className={`bimestre-header-btn ${bimestreAbierto[alumno._id] === (bimIndex + 1) ? 'activo' : ''}`} onClick={() => handleToggleBimestre(alumno._id, bimIndex + 1)}>
                                Bim. {bimIndex + 1}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className={`bimestre-desplegable ${bimestreAbierto[alumno._id] ? 'desplegado' : ''}`}>
                          {bimestreActual && (
                            <>
                              <div className="asistencia-totales">
                                <span>Totales del Bimestre:</span>
                                <span className="total-presentes">✅ Asistencias: {totales.presentes}</span>
                                <span className="total-faltas">❌ Faltas: {totales.faltas}</span>
                              </div>
                              <div className="cuadritos-grid">
                                {Array.from({ length: diasPorBimestre[bimestreActual] || DIAS_INICIALES }).map((_, diaIndex) => {
                                  const key = `${alumno._id}-b${bimestreActual}-d${diaIndex + 1}`;
                                  const registro = asistencia[key];
                                  return (
                                    <div
                                      key={diaIndex}
                                      className={`cuadrito estado-${registro?.estado.toLowerCase() || ''}`}
                                      title={registro?.fecha ? `Fecha: ${registro.fecha}` : `Día ${diaIndex + 1}`}
                                      onClick={() => handleMarcarAsistencia(alumno._id, bimestreActual, diaIndex + 1)}
                                    >
                                      {registro?.estado || ''}
                                    </div>
                                  );
                                })}
                                <button className="btn-agregar-dias" onClick={() => agregarDias(bimestreActual)}>
                                  +5
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
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
