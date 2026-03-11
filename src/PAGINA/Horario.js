import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useNotification } from "../COMPONENTE/NotificationContext";
import LoadingOverlay from "../COMPONENTE/LoadingOverlay";
import "./Horario.css";

// --- IMPORTACIONES DE LOGOS LOCALES ---
// Se asume que estos archivos están en el mismo directorio o accesibles
import logoAgs from "./Ags.png";
import logoDerecho from "./Logoescuela.png";
import BrandingModal from "../COMPONENTE/BrandingModal";
// ------------------------------------

// --- CONSTANTES Y CONFIGURACIÓN ---
// Uso de process.env.REACT_APP_API_URL para compatibilidad con Vercel/Render
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const horas = [1, 2, 3, 4, 5, 6, 7];
const paletaColores = [
  "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3",
  "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722"
];


function Horario({ user }) {
  const { showAlert } = useNotification();
  const [profesores, setProfesores] = useState([]);
  const [horario, setHorario] = useState({});
  const [anio, setAnio] = useState("2025-2026");
  const [mostrarPaleta, setMostrarPaleta] = useState(false);
  const [colorSeleccionado, setColorSeleccionado] = useState("#f44336");
  const [leyenda, setLeyenda] = useState({});
  const [modoBorrador, setModoBorrador] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [schoolConfig, setSchoolConfig] = useState(null);
  const [brandingModal, setBrandingModal] = useState({ visible: false, onConfirm: null, title: '' });
  const horarioTableRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
    }
  }, [isLoading]);

  // --- Carga de profesores (Usando API_URL) ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchProf = async () => {
      setIsLoading(true);
      setLoadingMessage("Cargando información de profesores...");
      try {
        // Primero verificamos el perfil para que el middleware de auth cargue el school_id
        await axios.get(`${API_URL}/auth/mi-perfil`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const res = await axios.get(`${API_URL}/profesores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(res.data)) setProfesores(res.data);

        // Fetch School Config IF school_id is available
        const schoolId = user?.school_id || (await axios.get(`${API_URL}/auth/mi-perfil`, { headers: { Authorization: `Bearer ${token}` } })).data.school_id;
        if (schoolId) {
          const schoolRes = await axios.get(`${API_URL}/schools/${schoolId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setSchoolConfig(schoolRes.data);
        }
      } catch (err) {
        console.error("Error al cargar profesores en Horario:", err);
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    };

    fetchProf();
  }, []);

  // --- Carga de horario (Usando API_URL) ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchHorario = async () => {
      setLoadingMessage("Cargando horario...");
      setIsLoading(true);
      setProgress(20);
      try {
        // Aseguramos sesión sincronizada
        await axios.get(`${API_URL}/auth/mi-perfil`, { headers: { Authorization: `Bearer ${token}` } });

        const res = await axios.get(`${API_URL}/horario/${anio}`, { headers: { Authorization: `Bearer ${token}` } });
        setProgress(75);
        if (res.data?.datos) setHorario(res.data.datos);
        if (res.data?.leyenda) setLeyenda(res.data.leyenda);
      } catch (error) {
        console.error("Error al cargar el horario:", error);
        showAlert("Error al cargar el horario ❌", "danger");
        setProgress(100);
      } finally {
        setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 300);
      }
    };

    fetchHorario();
  }, [anio, showAlert]);

  const generarHorarioVacio = useCallback(() => {
    if (isLoading) return;
    if (!window.confirm("¿Estás seguro de que quieres limpiar todo el horario? Esta acción es irreversible.")) return;

    const nuevoHorario = {};
    profesores.forEach(prof => {
      nuevoHorario[prof.nombre] = {};
      dias.forEach(d => {
        horas.forEach(h => {
          nuevoHorario[prof.nombre][`General-${d}-${h}`] = { text: "", color: "transparent" };
        });
      });
    });
    setHorario(nuevoHorario);
    setLeyenda({});
    showAlert("Horario limpiado correctamente ✅", "success");
  }, [isLoading, profesores, showAlert]);

  const handleCellChange = useCallback((profesor, asignatura, dia, hora, value) => {
    if (user.role !== "admin" || isLoading) return;
    setHorario(prev => ({ ...prev, [profesor]: { ...(prev[profesor] || {}), [`${asignatura}-${dia}-${hora}`]: { ...((prev[profesor] || {})[`${asignatura}-${dia}-${hora}`] || { text: "", color: "transparent" }), text: value } } }));
  }, [user.role, isLoading]);

  const pintarHora = useCallback((profesor, asignatura, dia, hora) => {
    if (user.role !== "admin" || isLoading || (!mostrarPaleta && !modoBorrador)) return;
    const nuevoColor = modoBorrador ? "transparent" : colorSeleccionado;
    setHorario(prev => ({ ...prev, [profesor]: { ...(prev[profesor] || {}), [`${asignatura}-${dia}-${hora}`]: { ...((prev[profesor] || {})[`${asignatura}-${dia}-${hora}`] || { text: "", color: "transparent" }), color: nuevoColor } } }));
    if (!modoBorrador && !leyenda[colorSeleccionado]) { setLeyenda(prev => ({ ...prev, [colorSeleccionado]: "" })); }
  }, [user.role, isLoading, mostrarPaleta, modoBorrador, colorSeleccionado, leyenda]);

  const handleLeyendaChange = useCallback((color, value) => {
    if (isLoading) return;
    setLeyenda(prev => ({ ...prev, [color]: value }));
  }, [isLoading]);

  const eliminarLeyenda = useCallback(color => {
    if (isLoading) return;
    setLeyenda(prev => { const copia = { ...prev }; delete copia[color]; return copia; });
    showAlert("Color eliminado de la leyenda", "info");
  }, [isLoading, showAlert]);

  // --- Lógica de generación de PDF refactorizada (con logos locales) ---
  const generarContenidoPDF = async (doc, brandingData = {}) => {
    const schoolName = schoolConfig?.name || "ESCUELA SECUNDARIA GENERAL, No. 9";
    const schoolLogo = brandingData.logoUrl || schoolConfig?.config?.logoUrl || logoDerecho;
    const schoolDirector = brandingData.directorName || schoolConfig?.directorName || '';

    // USANDO LAS VARIABLES DE LOGO IMPORTADAS LOCALMENTE
    const imgLogoDer = new Image();
    imgLogoDer.src = schoolLogo;
    imgLogoDer.crossOrigin = "Anonymous";
    await imgLogoDer.decode().catch(() => { });

    const imgLogoAgs = new Image();
    imgLogoAgs.src = logoAgs;
    await imgLogoAgs.decode().catch(() => { });

    const logoDerWidth = 25;
    const logoDerHeight = (imgLogoDer.height * logoDerWidth) / imgLogoDer.width;

    doc.addImage(logoAgs, "PNG", 15, 8, 40, 16);
    doc.addImage(schoolLogo, "PNG", 255, 8, logoDerWidth, logoDerHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(schoolName, doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
    doc.setFontSize(11);
    // Solo mostrar "AMADO NERVO" si no está ya en el nombre dinámico (fallback logic)
    if (!schoolConfig?.name) {
      doc.text("“AMADO NERVO”", doc.internal.pageSize.getWidth() / 2, 22, { align: "center" });
    }
    doc.setFontSize(10);
    doc.text(`HORARIO GENERAL ${anio}`, doc.internal.pageSize.getWidth() / 2, (schoolConfig?.name ? 22 : 29), { align: "center" });

    // Director name in subtitle
    doc.setFontSize(9);
    doc.text(`Director(a): ${schoolDirector || "__________________________"}`, doc.internal.pageSize.getWidth() / 2, (schoolConfig?.name ? 28 : 35), { align: "center" });

    const tablaElement = horarioTableRef.current;
    if (!tablaElement) throw new Error("Tabla de horario no encontrada.");

    const canvas = await html2canvas(tablaElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      onclone: (clonedDocument) => {
        // Corrección de estilos para el PDF
        // 1. Nombres de Profesores (Primera columna)
        clonedDocument.querySelectorAll('.horario-table td:first-child').forEach(cell => {
          cell.style.whiteSpace = 'normal';
          cell.style.wordWrap = 'break-word';
          cell.style.maxWidth = '150px';
          cell.style.fontSize = '10px';
          cell.style.lineHeight = '1.2';
        });

        // 2. Celdas de Asignaturas
        clonedDocument.querySelectorAll('.asignaturas-cell').forEach(cell => {
          cell.style.maxWidth = '150px';
          cell.style.wordBreak = 'break-word';
          cell.style.whiteSpace = 'normal';
          cell.style.fontSize = '10px';
        });
        clonedDocument.querySelectorAll('.horas-row-horizontal').forEach(row => {
          row.style.justifyContent = 'space-around';
          row.style.display = 'flex';
          row.style.width = '100%';
        });
        // Reemplazar inputs con divs de valor para exportación limpia
        clonedDocument.querySelectorAll('.hora-box-horizontal').forEach(box => {
          const color = box.style.backgroundColor;
          const input = box.querySelector('input');
          const value = input ? input.value : '';
          box.style.backgroundColor = 'transparent';
          const valueDiv = clonedDocument.createElement('div');
          valueDiv.textContent = value;
          valueDiv.style.backgroundColor = color === 'transparent' ? '#fff' : color;

          valueDiv.style.cssText += `
                    width: 22px; height: 20px; text-align: center; font-size: 10px; 
                    border: 1px solid ${color === 'transparent' ? '#bbb' : 'grey'};
                    border-radius: 3px; padding: 0; box-sizing: border-box;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; color: black; text-shadow: none;
                `;
          if (input && input.parentNode) { input.parentNode.replaceChild(valueDiv, input); }
        });
      }
    });

    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = doc.internal.pageSize.getWidth() - 20;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Altura disponible en la primera página
    const pageHeight = doc.internal.pageSize.getHeight();
    const startY = 35;
    let heightLeft = pdfHeight;
    let position = startY;
    let pageCount = 1;

    // Primera página
    doc.addImage(imgData, "PNG", 10, position, pdfWidth, pdfHeight);
    heightLeft -= (pageHeight - startY);

    // Páginas adicionales
    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      doc.addPage();
      pageCount++;

      // Calcular posición para mostrar la siguiente sección
      // Ajuste manual para evitar duplicidad de filas (overlapCorrection)
      const overlapCorrection = 7;
      const alturaYaImpresa = (pageHeight - startY) + (pageHeight - 20) * (pageCount - 2) + overlapCorrection;
      doc.addImage(imgData, "PNG", 10, -alturaYaImpresa + 10, pdfWidth, pdfHeight);

      heightLeft -= (pageHeight - 20);
    }

    // Leyenda - Nueva página si es necesario
    let leyendaY = 0;
    if (pageCount > 1) {
      doc.addPage();
      leyendaY = 15;
    } else {
      leyendaY = 35 + pdfHeight + 10;
      if (leyendaY > pageHeight - 20) {
        doc.addPage();
        leyendaY = 15;
      }
    }

    if (Object.keys(leyenda).length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Leyenda:", 10, leyendaY);
      leyendaY += 7;
      Object.entries(leyenda).forEach(([color, desc]) => {
        if (leyendaY + 8 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); leyendaY = 15; }
        doc.setFillColor(color);
        doc.rect(10, leyendaY, 6, 6, "F");
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
        doc.text(desc || "Sin descripción", 18, leyendaY + 5);
        leyendaY += 8;
      });
    }
  };

  const exportarPDF = async (brandingData = {}) => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingMessage("Exportando PDF...");
    setProgress(10);
    try {
      const doc = new jsPDF("landscape");
      await generarContenidoPDF(doc, brandingData);
      setProgress(95);
      doc.save(`Horario_${anio}.pdf`);
      showAlert("PDF exportado correctamente 📄✅", "success");
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      showAlert("Hubo un error al generar el PDF ❌", "danger");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };



  // --- Función para GUARDAR horario (Unificada) ---
  const guardarHorario = useCallback(async () => {
    if (user.role !== "admin" || isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsLoading(true);
    setLoadingMessage("Guardando horario...");
    setProgress(10);
    try {
      // Usamos el formato JSON (código nuevo) ya que es más limpio y adecuado para una API REST
      const payload = { anio, datos: horario, leyenda };
      await axios.post(`${API_URL}/horario`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (e) => setProgress(Math.min(90, Math.round((e.loaded * 100) / (e.total || 1))))
      });
      setProgress(100);
      showAlert("Horario guardado correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar el horario ❌", "danger");
    } finally {
      setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [user.role, anio, horario, leyenda, isLoading, showAlert]);



  const handleArchivoChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file || isLoading) return;
    setIsLoading(true);
    setLoadingMessage("Subiendo PDF...");
    setProgress(10);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("anio", anio);
      const token = localStorage.getItem("token");
      // Uso de API_URL para Vercel/Render
      await axios.post(`${API_URL}/horario`, formData, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, onUploadProgress: (progressEvent) => { const percentCompleted = Math.min(90, Math.round((progressEvent.loaded * 100) / progressEvent.total)); setProgress(percentCompleted); } });
      setProgress(100);
      // Aquí deberías recargar o actualizar el estado si quieres mostrar el PDF
      showAlert("PDF subido correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      showAlert("Error al subir PDF ❌", "danger");
    } finally {
      e.target.value = null; // Limpiar input file
      setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [anio, isLoading, showAlert]);


  return (
    <div className="horario-page">
      {isLoading && <LoadingOverlay message={loadingMessage} />}

      {/* Estructura Header del código nuevo */}
      <header className="horario-header">
        <h1>Gestión de Horarios</h1>
        <div className="titulo-anio">
          {user.role === "admin" ? (
            <input type="text" value={anio} onChange={e => setAnio(e.target.value)} className="anio-input" disabled={isLoading} />
          ) : <h2>Ciclo Escolar: {anio}</h2>}
        </div>
      </header>

      {/* Panel de administración unificado */}
      {user.role === "admin" && (
        <div className="admin-panel">
          <button className={`btn-admin ${modoBorrador ? "activo" : ""}`} onClick={() => setModoBorrador(!modoBorrador)} disabled={isLoading}>🧹 Borrador</button>
          <button className="btn-admin" onClick={() => setMostrarPaleta(!mostrarPaleta)} disabled={isLoading}>🖌️ Pincel</button>
          {mostrarPaleta && (
            <div className="paleta-colores">
              {paletaColores.map(c => (<div key={c} className="color-cuadro" style={{ backgroundColor: c }} onClick={() => { setColorSeleccionado(c); setModoBorrador(false); }} />))}
            </div>
          )}
          <button onClick={generarHorarioVacio} className="btn-admin" disabled={isLoading}>🗑️ Limpiar</button>
          <button onClick={guardarHorario} className="btn-admin" disabled={isLoading}> 💾 Guardar</button>
          <button onClick={() => setBrandingModal({
            visible: true,
            title: 'Reporte de Horario',
            onConfirm: (brandingData) => exportarPDF(brandingData)
          })} className="btn-admin" disabled={isLoading}> 📄 Exportar PDF </button>


          <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: "none" }} onChange={handleArchivoChange} disabled={isLoading} />
        </div>
      )}

      <div className="horario-table-container">
        <table className="horario-table" ref={horarioTableRef}>
          <thead>
            <tr>
              <th>Profesor</th>
              <th>Asignaturas</th>
              {dias.map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {/* Ordenar profesores alfabéticamente para una vista más limpia */}
            {profesores.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(prof => (
              <tr key={prof._id}>
                <td>{prof.nombre}</td>
                {/* APLICAMOS LA CLASE DE CORRECCIÓN AQUÍ */}
                <td className="asignaturas-cell">{(prof.asignaturas || ["General"]).join(", ")}</td>
                {dias.map(d => (
                  <td key={`${prof._id}-${d}`}>
                    <div className="horas-row-horizontal">
                      {horas.map(h => {
                        // La clave usa 'General' como prefijo de asignatura, coherente con tu lógica
                        const cell = horario?.[prof.nombre]?.[`General-${d}-${h}`] || { text: "", color: "transparent" };
                        return (
                          <div key={`${d}-${h}`} className="hora-box-horizontal" style={{ backgroundColor: cell.color }} onClick={() => !isLoading && pintarHora(prof.nombre, "General", d, h)}>
                            <div className="hora-num">{h}</div>
                            {/* Limitamos el input a 7 caracteres para prevenir desbordamiento dentro de la caja */}
                            <input type="text" maxLength={7} value={cell.text} onChange={e => handleCellChange(prof.nombre, "General", d, h, e.target.value)} disabled={isLoading || user.role !== 'admin'} />
                          </div>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      {user.role === "admin" && Object.keys(leyenda).length > 0 && (
        <div className="leyenda">
          <h3>Leyenda</h3>
          <div className="leyenda-colores">
            {Object.entries(leyenda).map(([color, significado]) => (
              <div key={color} className="leyenda-item">
                <div className="color-cuadro-leyenda" style={{ backgroundColor: color }} />
                <input type="text" placeholder="Significado" value={significado} onChange={e => handleLeyendaChange(color, e.target.value)} disabled={isLoading} />
                <button className="btn-eliminar" onClick={() => eliminarLeyenda(color)} disabled={isLoading}>❌</button>
              </div>
            ))}
          </div>
          {brandingModal.visible && (
            <BrandingModal
              initialData={{
                directorName: schoolConfig?.directorName || localStorage.getItem('current_director_name') || '',
                logoUrl: schoolConfig?.config?.logoUrl || '',
                defaultLogo: logoDerecho
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
      )}
    </div>
  );
}

export default Horario;
