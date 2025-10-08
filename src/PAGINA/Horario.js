import React, { useState, useEffect, useRef, useCallback } from "react";
// 1. CORRECCIÓN DE RUTA: Apunta correctamente a la carpeta api/ (sube de PAGINA/ a src/ y entra a api/)
import apiClient from '../api/apiClient';
// 🛠 CORRECCIÓN: Se asume que jspdf y html2canvas están instalados y disponibles.
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
// 🛠 CORRECCIÓN: Se asume que el archivo CSS existe.
import "./Horario.css";

// 🛠 CORRECCIÓN: Se asume que las imágenes existen en la carpeta PAGINA/.
import logoAgs from "./Ags.png";
import logoDerecho from "./Logoescuela.png";


const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const horas = [1, 2, 3, 4, 5, 6, 7];
const paletaColores = [
  "#f44336", "#e91e63", "#9c27b0", "#673ab7",
  "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4",
  "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722"
];

function Horario({ user }) {
  const [profesores, setProfesores] = useState([]);
  const [horario, setHorario] = useState({});
  const [anio, setAnio] = useState("2025-2026");
  const [mostrarPaleta, setMostrarPaleta] = useState(false);
  const [colorSeleccionado, setColorSeleccionado] = useState("#f44336");
  const [leyenda, setLeyenda] = useState({});
  const [modoBorrador, setModoBorrador] = useState(false);
  const [pdfHorario, setPdfHorario] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const horarioTableRef = useRef(null);

  const mostrarAlerta = useCallback((mensaje, tipo = "success") => {
    setAlerta({ mensaje, tipo });
    setTimeout(() => setAlerta(null), 3000);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
    }
  }, [isLoading]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // CÓDIGO MÁS LIMPIO: Usando apiClient.
    apiClient.get("/auth/profesores", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (Array.isArray(res.data)) setProfesores(res.data);
    }).catch(console.error);
  }, []);

  // 🚨 Optimización: Nueva función para obtener horario y usarla en useEffect y en handleArchivoChange
  const fetchHorario = useCallback((currentAnio) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingMessage("Cargando horario...");
    setIsLoading(true);
    setProgress(20);

    apiClient.get(`/horario/${currentAnio}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      setProgress(75);
      if (res.data?.datos) setHorario(res.data.datos);
      if (res.data?.leyenda) setLeyenda(res.data.leyenda);
      setPdfHorario(res.data?.pdfUrl || null); 
    }).catch(error => {
      console.error("Error al cargar el horario:", error);
      mostrarAlerta("Error al cargar el horario ❌", "error");
      setProgress(100);
    }).finally(() => {
      setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 300);
    });
  }, [mostrarAlerta]);

  useEffect(() => {
    // Llama a la nueva función de carga cuando cambia el año
    const timer = setTimeout(() => {
      fetchHorario(anio);
    }, 400);
    return () => clearTimeout(timer);
  }, [anio, fetchHorario]);
  
  const generarHorarioVacio = useCallback(() => {
    if (isLoading) return;
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
    mostrarAlerta("Horario limpiado correctamente ✅", "success");
  }, [isLoading, profesores, mostrarAlerta]);

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
    mostrarAlerta("Color eliminado de la leyenda ❌", "error");
  }, [isLoading, mostrarAlerta]);
  
  const getBase64Image = (imgPath) => new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imgPath;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (error) => reject(error);
  });

  const exportarPDF = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingMessage("Exportando PDF... por favor espera.");
    setProgress(10);
    mostrarAlerta("Generando PDF, esto puede tomar un momento... ⏳", "info");
    try {
        const doc = new jsPDF("landscape");
        setProgress(20);
        // 🚨 NOTA: Las imágenes locales deben existir para que funcione la generación del PDF.
        const [logoAgsBase64, logoDerBase64] = await Promise.all([ getBase64Image(logoAgs), getBase64Image(logoDerecho) ]);
        doc.addImage(logoAgsBase64, "PNG", 15, 8, 40, 16);
        doc.addImage(logoDerBase64, "PNG", 255, 8, 25, 25);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("ESCUELA SECUNDARIA GENERAL, No. 9", doc.internal.pageSize.getWidth() / 2, 15, { align: "center" });
        doc.setFontSize(11);
        doc.text("“AMADO NERVO”", doc.internal.pageSize.getWidth() / 2, 22, { align: "center" });
        doc.setFontSize(10);
        doc.text(`HORARIO GENERAL ${anio}`, doc.internal.pageSize.getWidth() / 2, 29, { align: "center" });
        setProgress(40);
        const tablaElement = horarioTableRef.current;
        if (!tablaElement) { throw new Error("Tabla de horario no encontrada."); }
        const canvas = await html2canvas(tablaElement, { scale: 2, backgroundColor: "#ffffff", useCORS: true, onclone: (clonedDocument) => {
            
            clonedDocument.querySelectorAll('.horas-row-horizontal').forEach(row => {
                row.style.justifyContent = 'space-around';
                row.style.display = 'flex';
                row.style.width = '100%';
            });
            
            clonedDocument.querySelectorAll('.hora-box-horizontal').forEach(box => { 
                const color = box.style.backgroundColor; 
                const input = box.querySelector('input'); 
                const value = input ? input.value : ''; 
                box.style.backgroundColor = 'transparent'; 
                const valueDiv = clonedDocument.createElement('div'); 
                valueDiv.textContent = value;
                
                valueDiv.style.backgroundColor = color === 'transparent' ? '#fff' : color; 
                
                // --- AJUSTE FINAL DE TAMAÑO ---
                // Se reduce el tamaño de los cuadritos un poco más
                valueDiv.style.cssText += `
                    width: 22px; height: 20px; text-align: center; font-size: 10px; 
                    border: 1px solid ${color === 'transparent' ? '#bbb' : 'grey'};
                    border-radius: 3px; padding: 0; box-sizing: border-box;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; color: black;
                    text-shadow: none;
                `;
                if (input && input.parentNode) { input.parentNode.replaceChild(valueDiv, input); } }); 
            } 
        });
        setProgress(75);
        const imgData = canvas.toDataURL("image/png");
        const pdfWidth = doc.internal.pageSize.getWidth() - 20;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        doc.addImage(imgData, "PNG", 10, 35, pdfWidth, pdfHeight);
        let leyendaY = 35 + pdfHeight + 10;
        if (leyendaY > doc.internal.pageSize.getHeight() - 20 && Object.keys(leyenda).length > 0) { doc.addPage(); leyendaY = 15; }
        if (Object.keys(leyenda).length > 0) { doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Leyenda:", 10, leyendaY); leyendaY += 7; Object.entries(leyenda).forEach(([color, desc]) => { if (leyendaY + 8 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); leyendaY = 15; } doc.setFillColor(color); doc.rect(10, leyendaY, 6, 6, "F"); doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.text(desc || "", 18, leyendaY + 5); leyendaY += 8; }); }
        setProgress(95);
        doc.save(`Horario_${anio}.pdf`);
        mostrarAlerta("PDF exportado correctamente 📄✅", "success");
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        mostrarAlerta("Hubo un error al generar el PDF ❌", "error");
    } finally {
        setIsLoading(false);
        setLoadingMessage("");
    }
  }, [anio, leyenda, isLoading, mostrarAlerta]);
  
  const guardarHorario = useCallback(async () => {
    if (user.role !== "admin" || isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setIsLoading(true);
    setLoadingMessage("Guardando horario...");
    setProgress(10);
    try {
      // Usamos Content-Type: multipart/form-data porque potencialmente subiremos un PDF
      // En este caso, solo subimos JSON, pero mantenemos FormData
      const formData = new FormData();
      formData.append("anio", anio);
      formData.append("datos", JSON.stringify(horario));
      formData.append("leyenda", JSON.stringify(leyenda));
      
      const res = await apiClient.post("/horario", formData, { 
        headers: { 
          Authorization: `Bearer ${token}` 
          // NOTA: No necesitamos Content-Type aquí, FormData lo establece automáticamente
        }, 
        onUploadProgress: (progressEvent) => { 
          const percentCompleted = Math.min(90, Math.round((progressEvent.loaded * 100) / progressEvent.total)); 
          setProgress(percentCompleted); 
        } 
      });

      setProgress(100);
      setPdfHorario(res.data.horario?.pdfUrl || null);
      mostrarAlerta("Horario guardado correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Error al guardar el horario ❌", "error");
    } finally {
      setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [user.role, anio, horario, leyenda, isLoading, mostrarAlerta]);

  const abrirExploradorPDF = () => fileInputRef.current.click();

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
      
      // 5. CÓDIGO MÁS LIMPIO: Usando apiClient. 
      const res = await apiClient.post("/horario", formData, { 
        headers: { 
          Authorization: `Bearer ${token}`, 
          // NOTA: El Content-Type "multipart/form-data" no debe establecerse manualmente aquí, 
          // el navegador lo hace automáticamente y añade el boundary necesario. 
        }, 
        onUploadProgress: (progressEvent) => { 
          const percentCompleted = Math.min(90, Math.round((progressEvent.loaded * 100) / progressEvent.total)); 
          setProgress(percentCompleted); 
        } 
      });

      setProgress(100);
      // 🚨 CORRECCIÓN/OPTIMIZACIÓN: Llama a fetchHorario() para recargar todos los datos 
      // y asegurar que el estado pdfHorario se actualiza y la vista de Profesor se refresque.
      fetchHorario(anio);
      mostrarAlerta("PDF subido correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Error al subir PDF ❌", "error");
    } finally {
      setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [anio, isLoading, mostrarAlerta, fetchHorario]);

  if (user.role !== "admin" && pdfHorario) {
    // 6. CORRECCIÓN CLOUDINARY: pdfHorario AHORA ES UNA URL COMPLETA
    // Ya no necesitamos apiClient.defaults.baseURL porque Cloudinary devuelve la URL web completa.
    return ( 
      <div className="pdf-viewer-full"> 
        <embed 
          src={`${pdfHorario}#toolbar=0&navpanes=0&scrollbar=0`} 
          type="application/pdf" 
          width="100%" 
          height="100%" 
          style={{ border: "none", display: "block" }} 
        /> 
      </div> 
    );
  }

  return (
    <div className="horario-page">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <p className="loading-message">{loadingMessage || "Cargando..."}</p>
            <div className="progress-bar-custom">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}>
                <span className="progress-bar-text">{`${Math.round(progress)}%`}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {alerta && <div className={`alerta ${alerta.tipo}`}>{alerta.mensaje}</div>}
      <div className="titulo-anio">
        {user.role === "admin" ? ( <input type="text" value={anio} onChange={e => setAnio(e.target.value)} className="anio-input" disabled={isLoading} /> ) : <h2>{anio}</h2>}
      </div>
      {user.role === "admin" && ( <div className="admin-panel"> <button className={`btn-add ${modoBorrador ? "activo" : ""}`} onClick={() => setModoBorrador(!modoBorrador)} disabled={isLoading}>🧹 Borrador</button> <button className="btn-add" onClick={() => setMostrarPaleta(!mostrarPaleta)} disabled={isLoading}>🖌 Pincel</button> {mostrarPaleta && ( <div className="paleta-colores"> {paletaColores.map(c => ( <div key={c} className="color-cuadro" style={{ backgroundColor: c }} onClick={() => { setColorSeleccionado(c); setModoBorrador(false); }} /> ))} </div> )} <button onClick={generarHorarioVacio} className="btn-add" disabled={isLoading}>Limpiar Horario</button> <button onClick={guardarHorario} className="btn-add" disabled={isLoading}> 💾 Guardar horario </button> <button onClick={exportarPDF} className="btn-add" disabled={isLoading}> 📄 Exportar PDF </button> <button onClick={abrirExploradorPDF} className="btn-add" disabled={isLoading}> ⬆️ Subir PDF Horario </button> <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: "none" }} onChange={handleArchivoChange} disabled={isLoading} /> </div> )}
      <div className="horario-table-container"> <table className="horario-table" ref={horarioTableRef}> <thead> <tr> <th>Profesor</th> <th>Asignaturas</th> {dias.map(d => <th key={d}>{d}</th>)} </tr> </thead> <tbody> {profesores.map(prof => ( <tr key={prof._id}> <td>{prof.nombre}</td> <td>{(prof.asignaturas || ["General"]).join(", ")}</td> {dias.map(d => ( <td key={`${prof._id}-${d}`}> <div className="horas-row-horizontal"> {horas.map(h => { const cell = horario?.[prof.nombre]?.[`General-${d}-${h}`] || { text: "", color: "transparent" }; return ( <div key={`${d}-${h}`} className="hora-box-horizontal" style={{ backgroundColor: cell.color }} onClick={() => !isLoading && pintarHora(prof.nombre, "General", d, h)}> <div className="hora-num">{h}</div> <input type="text" maxLength={7} value={cell.text} onChange={e => handleCellChange(prof.nombre, "General", d, h, e.target.value)} disabled={isLoading} /> </div> ); })} </div> </td> ))} </tr> ))} </tbody> </table> </div>
      {user.role === "admin" && Object.keys(leyenda).length > 0 && ( <div className="leyenda"> <h3>Leyenda</h3> <div className="leyenda-colores"> {Object.entries(leyenda).map(([color, significado]) => ( <div key={color} className="leyenda-item"> <div className="color-cuadro-leyenda" style={{ backgroundColor: color }} /> <input type="text" placeholder="Significado" value={significado} onChange={e => handleLeyendaChange(color, e.target.value)} disabled={isLoading} /> <button className="btn-add" onClick={() => eliminarLeyenda(color)} disabled={isLoading}>❌</button> </div> ))} </div> </div> )}
    </div>
  );
}

export default Horario;
