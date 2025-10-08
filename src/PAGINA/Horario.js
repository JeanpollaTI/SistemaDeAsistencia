import React, { useState, useEffect, useRef, useCallback } from "react";
// 1. CORRECCIÓN DE RUTA: Ajustamos la importación.
import apiClient from '../api/apiClient';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./Horario.css";

// Importa tus logos aquí (asegúrate de que las rutas sean correctas)
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
  const [pdfUrl, setPdfUrl] = useState(null); // Revertido a pdfUrl (aunque no se usa para visualización)
  const [alerta, setAlerta] = useState(null);
  // Añadido estado de carga y progreso
  const [isLoading, setIsLoading] = useState(false); 
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progress, setProgress] = useState(0); 
  const horarioTableRef = useRef(null); // Solo necesitamos esta ref

  const mostrarAlerta = useCallback((mensaje, tipo = "success") => {
    setAlerta({ mensaje, tipo });
    setTimeout(() => setAlerta(null), 3000);
  }, []);

  // Simulación de progreso al terminar la carga
  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      setTimeout(() => setProgress(0), 500);
    }
  }, [isLoading]);


  // ----------------------------------------------------
  // Carga Inicial y de Profesores
  // ----------------------------------------------------

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    apiClient.get("/auth/profesores", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (Array.isArray(res.data)) setProfesores(res.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingMessage("Cargando horario...");
    setIsLoading(true);
    setProgress(20);
    
    // NOTA: El frontend seguirá pidiendo imageUrl (o pdfUrl) aunque no lo usemos, solo para datos.
    apiClient.get(`/horario/${anio}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
        setProgress(75);
        if (res.data?.datos) setHorario(res.data.datos);
        if (res.data?.leyenda) setLeyenda(res.data.leyenda);
        if (res.data?.imageUrl) setPdfUrl(res.data.imageUrl); // Usamos imageUrl que viene del backend
    }).catch(error => {
        console.error("Error al cargar el horario:", error);
        mostrarAlerta("Error al cargar el horario ❌", "error");
        setProgress(100);
    }).finally(() => {
        setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 300);
    });
  }, [anio, mostrarAlerta]);


  const generarHorarioVacio = useCallback(() => {
    if (user.role !== "admin" || isLoading) return;
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
    setHorario(prev => {
      const profesorHorario = prev[profesor] || {};
      const clave = `${asignatura}-${dia}-${hora}`;
      const celdaExistente = profesorHorario[clave] || { text: "", color: "transparent" };
      return {
        ...prev,
        [profesor]: { ...profesorHorario, [clave]: { ...celdaExistente, text: value } }
      };
    });
  }, [user.role, isLoading]);

  const pintarHora = useCallback((profesor, asignatura, dia, hora) => {
    if (user.role !== "admin" || isLoading || (!mostrarPaleta && !modoBorrador)) return;
    const nuevoColor = modoBorrador ? "transparent" : colorSeleccionado;
    setHorario(prev => {
      const profesorHorario = prev[profesor] || {};
      const clave = `${asignatura}-${dia}-${hora}`;
      const celdaExistente = profesorHorario[clave] || { text: "", color: "transparent" };
      return {
        ...prev,
        [profesor]: { ...profesorHorario, [clave]: { ...celdaExistente, color: nuevoColor } }
      };
    });
    if (!modoBorrador && !leyenda[colorSeleccionado]) {
      setLeyenda(prev => ({ ...prev, [colorSeleccionado]: "" }));
    }
  }, [user.role, isLoading, mostrarPaleta, modoBorrador, colorSeleccionado, leyenda]);

  const handleLeyendaChange = (color, value) => {
    if (user.role !== "admin" || isLoading) return; // Solo admin puede cambiar leyenda
    setLeyenda(prev => ({ ...prev, [color]: value }));
  };

  const eliminarLeyenda = useCallback(color => {
    if (user.role !== "admin" || isLoading) return;
    setLeyenda(prev => {
      const copia = { ...prev };
      delete copia[color];
      return copia;
    });
    mostrarAlerta("Color eliminado de la leyenda ❌", "error");
  }, [isLoading, mostrarAlerta]);

  // Función genérica para obtener imagen en Base64
  const getBase64Image = imgPath => new Promise((resolve, reject) => {
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
  
  // ----------------------------------------------------
  // * FUNCIONES CRÍTICAS *
  // ----------------------------------------------------
  
  // Helper para generar el PDF (reutilizable)
  const generarPDFDocument = useCallback(async (returnBase64 = false) => {
    setProgress(10);
    const doc = new jsPDF("landscape");
    
    // Generación de logos y encabezado (se mantiene)
    const [logoAgsBase64, logoDerBase64] = await Promise.all([ getBase64Image(logoAgs), getBase64Image(logoDerecho) ]);
    doc.addImage(logoAgsBase64, "PNG", 10, 5, 40, 16);
    doc.addImage(logoDerBase64, "PNG", 260, 5, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ESCUELA SECUNDARIA GENERAL, No. 9", 148, 15, { align: "center" });
    doc.text("“AMADO NERVO”", 148, 22, { align: "center" });
    doc.text(`HORARIO GENERAL ${anio}`, 148, 29, { align: "center" });
    setProgress(30);

    // Captura de la tabla (html2canvas)
    const tablaElement = horarioTableRef.current;
    if (!tablaElement) { throw new Error("Tabla de horario no encontrada."); }
    const canvas = await html2canvas(tablaElement, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    
    const pdfWidth = doc.internal.pageSize.getWidth() - 20;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    doc.addImage(imgData, "PNG", 10, 35, pdfWidth, pdfHeight);
    
    // Lógica de Leyenda
    if (Object.keys(leyenda).length > 0) {
        let leyendaY = 35 + pdfHeight + 5;
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Leyenda:", 10, leyendaY);
        // ... (resto de lógica de leyenda) ...
    }
    
    setProgress(90);

    if (returnBase64) {
        return doc.output('datauristring').split(',')[1];
    } else {
        doc.save(`Horario_${anio}.pdf`);
    }
  }, [anio, leyenda, getBase64Image]);


  // 3. EXPORTAR PDF (Descarga local)
  const exportarPDF = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingMessage("Exportando PDF... por favor espera.");
    try {
        await generarPDFDocument(false);
        mostrarAlerta("PDF exportado correctamente 📄✅", "success");
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        mostrarAlerta("Hubo un error al generar el PDF ❌", "error");
    } finally {
        setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [isLoading, mostrarAlerta, generarPDFDocument]);


  // 4. NUEVO: ENVIAR POR CORREO
  const enviarHorarioPorCorreo = useCallback(async () => {
    if (user.role !== "admin" || isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsLoading(true);
    setLoadingMessage("Generando y enviando correos...");
    
    try {
        // --- 1. GENERAR EL PDF y obtener Base64 ---
        const pdfBase64 = await generarPDFDocument(true); // TRUE para obtener Base64
        setProgress(70);

        // --- 2. LLAMAR AL BACKEND PARA ENVIAR CORREOS ---
        const res = await apiClient.post("/horario/enviar-correo", {
            anio: anio,
            pdfData: pdfBase64, // El contenido PDF en Base64
            // Enviamos los datos del horario para que el backend sepa a quién buscar
            horarioData: horario 
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        setProgress(100);
        mostrarAlerta(res.data.msg || "Correos enviados a los profesores exitosamente ✅", "success");

    } catch (error) {
        console.error("Error al enviar correos:", error);
        mostrarAlerta(error.response?.data?.msg || "Error al enviar correos. Verifica el servidor ❌", "error");
    } finally {
        setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 500);
    }
  }, [user.role, anio, horario, isLoading, mostrarAlerta, generarPDFDocument]);


  const guardarHorario = async () => {
    if (user.role !== "admin" || isLoading) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append("anio", anio);
      formData.append("datos", JSON.stringify(horario));
      formData.append("leyenda", JSON.stringify(leyenda));

      // CAMBIO CRUCIAL: Usamos apiClient en lugar de axios
      const res = await apiClient.post("/horario", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      // El backend es exitoso, actualiza el estado de la URL (aunque no haya archivo)
      setPdfUrl(res.data.horario?.imageUrl || null); 
      mostrarAlerta("Horario guardado correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Error al guardar el horario ❌", "error");
    }
  };
  
  // ----------------------------------------------------
  // ELIMINACIÓN DE LÓGICA DE SUBIDA DE IMAGEN
  // ----------------------------------------------------
  
  // Eliminamos abrirExploradorImagen y handleArchivoChange 
  // ya que no se subirá ningún archivo manualmente.

  if (user.role !== "admin" && pdfUrl) {
    // Si hay una URL (imagen) de horario, mostramos la imagen. 
    // NOTA: Esto solo funciona si ya habías subido una imagen previamente.
    return ( 
      <div className="horario-viewer-full"> 
        <img 
          src={pdfUrl}
          alt={`Horario General ${anio}`}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '90vh' }}
          onError={(e) => { e.target.onerror = null; e.target.src = '/default-horario.png'; mostrarAlerta("Error al cargar la imagen del horario. ❌", "error"); }}
        /> 
      </div> 
    );
  }

  // ----------------------------------------------------

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
        {user.role === "admin" ? (
          <input type="text" value={anio} onChange={e => setAnio(e.target.value)} className="anio-input" disabled={isLoading} />
        ) : <h2>{anio}</h2>}
      </div>

      {user.role === "admin" && (
        <div className="admin-panel">
          <button className={`btn-add ${modoBorrador ? "activo" : ""}`} onClick={() => setModoBorrador(!modoBorrador)} disabled={isLoading}>🧹 Borrador</button>
          <button className="btn-add" onClick={() => setMostrarPaleta(!mostrarPaleta)} disabled={isLoading}>🖌 Pincel</button>
          {mostrarPaleta && (
            <div className="paleta-colores">
              {paletaColores.map(c => (
                <div key={c} className="color-cuadro" style={{ backgroundColor: c }} onClick={() => { setColorSeleccionado(c); setModoBorrador(false); }} />
              ))}
            </div>
          )}
          <button onClick={generarHorarioVacio} className="btn-add" disabled={isLoading}>Limpiar Horario</button>
          <button onClick={guardarHorario} className="btn-add" disabled={isLoading}>💾 Guardar horario</button>
          
          {/* BOTÓN DE ENVÍO DE CORREO */}
          <button onClick={enviarHorarioPorCorreo} className="btn-add" disabled={isLoading}>📧 Enviar a Profesores</button>
          
          <button onClick={exportarPDF} className="btn-add" disabled={isLoading}>📄 Exportar PDF (Local)</button>
          
          {/* ELIMINADO: Botón e input para subir archivos */}
          {/* <button onClick={abrirExploradorImagen} className="btn-add" disabled={isLoading}>⬆️ Subir Imagen Horario</button>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleArchivoChange} disabled={isLoading} /> */}
        </div>
      )}

      {user.role === "admin" && (
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
            {profesores.map(prof => (
              <tr key={prof._id}>
                <td>{prof.nombre}</td>
                <td>{(prof.asignaturas || ["General"]).join(", ")}</td>
                {dias.map(d => (
                  <td key={`${prof._id}-${d}`}>
                    <div className="horas-row-horizontal">
                      {horas.map(h => {
                        const cell = horario?.[prof.nombre]?.[`General-${d}-${h}`] || { text: "", color: "transparent" };
                        return (
                          <div key={`${d}-${h}`} className="hora-box-horizontal" style={{ backgroundColor: cell.color === "transparent" ? "#fff" : cell.color }}
                            onClick={() => pintarHora(prof.nombre, "General", d, h)}>
                            <div className="hora-num">{h}</div>
                            <input type="text" maxLength={4} value={cell.text} onChange={e => handleCellChange(prof.nombre, "General", d, h, e.target.value)} disabled={isLoading} />
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
      )}

      {user.role === "admin" && Object.keys(leyenda).length > 0 && (
        <div className="leyenda">
          <h3>Leyenda</h3>
          <div className="leyenda-colores">
            {Object.entries(leyenda).map(([color, significado]) => (
              <div key={color} className="leyenda-item">
                <div className="color-cuadro-leyenda" style={{ backgroundColor: color }} />
                <input type="text" placeholder="Significado" value={significado} onChange={e => handleLeyendaChange(color, e.target.value)} disabled={isLoading} />
                <button className="btn-add" onClick={() => eliminarLeyenda(color)} disabled={isLoading}>❌</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Horario;