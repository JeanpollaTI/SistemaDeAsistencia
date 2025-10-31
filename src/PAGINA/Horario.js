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
  const [horarioUrl, setHorarioUrl] = useState(null); // Cambiado de pdfHorario a horarioUrl
  const [alerta, setAlerta] = useState(null);
  // Añadido estado de carga y progreso
  const [isLoading, setIsLoading] = useState(false); 
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progress, setProgress] = useState(0); 
  const fileInputRef = useRef(null);
  const horarioTableRef = useRef(null);

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
  // * NUEVAS FUNCIONES Y EFECTOS *
  // ----------------------------------------------------

  // 1. Carga de Profesores (Usando apiClient)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    apiClient.get("/auth/profesores", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (Array.isArray(res.data)) setProfesores(res.data);
    }).catch(console.error);
  }, []);

  // 2. Carga Inicial del Horario (Usando apiClient)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingMessage("Cargando horario...");
    setIsLoading(true);
    setProgress(20);
    
    apiClient.get(`/horario/${anio}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
        setProgress(75);
        if (res.data?.datos) setHorario(res.data.datos);
        if (res.data?.leyenda) setLeyenda(res.data.leyenda);
        // CAMBIADO: Usamos imageUrl
        if (res.data?.imageUrl) setHorarioUrl(res.data.imageUrl); 
    }).catch(error => {
        console.error("Error al cargar el horario:", error);
        mostrarAlerta("Error al cargar el horario ❌", "error");
        setProgress(100);
    }).finally(() => {
        setTimeout(() => { setIsLoading(false); setLoadingMessage(""); }, 300);
    });
  }, [anio, mostrarAlerta]);
  // * FIN DE NUEVAS FUNCIONES Y EFECTOS *
  // ----------------------------------------------------


  const generarHorarioVacio = useCallback(() => {
    if (user.role !== "admin") return;
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
    if (user.role !== "admin") return;
    setHorario(prev => {
      const profesorHorario = prev[profesor] || {};
      const clave = `${asignatura}-${dia}-${hora}`;
      const celdaExistente = profesorHorario[clave] || { text: "", color: "transparent" };
      return {
        ...prev,
        [profesor]: { ...profesorHorario, [clave]: { ...celdaExistente, text: value } }
      };
    });
  }, [user.role]);

  const pintarHora = useCallback((profesor, asignatura, dia, hora) => {
    if (user.role !== "admin") return;
    if (!mostrarPaleta && !modoBorrador) return;
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
  }, [user.role, mostrarPaleta, modoBorrador, colorSeleccionado, leyenda]);

  const handleLeyendaChange = (color, value) => {
    if (user.role !== "admin") return; // Solo admin puede cambiar leyenda
    setLeyenda(prev => ({ ...prev, [color]: value }));
  };

  const eliminarLeyenda = color => {
    if (user.role !== "admin") return;
    setLeyenda(prev => {
      const copia = { ...prev };
      delete copia[color];
      return copia;
    });
    mostrarAlerta("Color eliminado de la leyenda ❌", "error");
  };

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

  const exportarPDF = async () => {
    if (user.role !== "admin") return;
    mostrarAlerta("Generando PDF, esto puede tomar un momento... ⏳", "info");
    
    // Lógica completa de exportación a PDF (se mantiene por si se quiere exportar el diseño)
    try {
        const doc = new jsPDF("landscape");
        const [logoAgsBase64, logoDerBase64] = await Promise.all([ getBase64Image(logoAgs), getBase64Image(logoDerecho) ]);

        // ... (resto de la lógica de encabezado y canvas) ...

        doc.addImage(logoAgsBase64, "PNG", 10, 5, 40, 16);
        doc.addImage(logoDerBase64, "PNG", 260, 5, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("ESCUELA SECUNDARIA GENERAL, No. 9", 148, 15, { align: "center" });
        doc.text("“AMADO NERVO”", 148, 22, { align: "center" });
        doc.text(`HORARIO GENERAL ${anio}`, 148, 29, { align: "center" });

        const tablaElement = document.querySelector(".horario-table");
        if (!tablaElement) {
             mostrarAlerta("Tabla de horario no encontrada para exportar ❌", "error");
             return;
        }
        
        // Uso de html2canvas 
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
            leyendaY += 5;
            Object.entries(leyenda).forEach(([color, desc]) => {
                doc.setFillColor(color);
                doc.rect(10, leyendaY, 6, 6, "F");
                doc.setTextColor(0);
                doc.text(desc || "", 18, leyendaY + 5);
                leyendaY += 8;
            });
        }

        doc.save(`Horario_${anio}.pdf`);
        mostrarAlerta("PDF exportado correctamente 📄✅", "success");
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        mostrarAlerta("Hubo un error al generar el PDF ❌", "error");
    }
  };

  const guardarHorario = async () => {
    if (user.role !== "admin") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append("anio", anio);
      formData.append("datos", JSON.stringify(horario));
      formData.append("leyenda", JSON.stringify(leyenda));
      // NOTA: No subimos ningún archivo aquí, solo los datos de la tabla.

      // CAMBIO CRUCIAL: Usamos apiClient en lugar de axios
      const res = await apiClient.post("/horario", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      // Si el backend es exitoso, actualiza la URL por si se subió una imagen antes
      setHorarioUrl(res.data.horario?.imageUrl || null); // CAMBIADO: pdfUrl a imageUrl
      mostrarAlerta("Horario guardado correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Error al guardar el horario ❌", "error");
    }
  };

  const abrirExploradorImagen = () => fileInputRef.current.click(); // Cambiado de PDF a Imagen

  const handleArchivoChange = async e => {
    const file = e.target.files[0];
    if (!file) return;

    // VALIDACIÓN CRÍTICA: Asegurar que es una imagen
    if (!file.type.startsWith('image/')) {
        return mostrarAlerta("Por favor, selecciona un archivo de imagen (PNG, JPG) ❌", "error");
    }

    const formData = new FormData();
    // CAMBIO CRÍTICO: El backend espera 'imagen' en lugar de 'pdf'
    formData.append("imagen", file); 
    formData.append("anio", anio);

    const token = localStorage.getItem("token");
    try {
      // CAMBIO CRUCIAL: Usamos apiClient en lugar de axios
      const res = await apiClient.post("/horario", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      
      // La URL de Cloudinary (imagen) se guarda y se usa para mostrar
      setHorarioUrl(res.data.horario?.imageUrl || null); // CAMBIADO: pdfUrl a imageUrl
      mostrarAlerta("Imagen de horario subida correctamente ✅", "success");
    } catch (err) {
      console.error(err);
      mostrarAlerta("Error al subir imagen ❌", "error");
    }
  };

  // ----------------------------------------------------
  // VISTA DE IMAGEN PARA USUARIOS NO-ADMIN
  if (user.role !== "admin" && horarioUrl) {
    // Si hay una URL de horario, mostramos la imagen directamente
    return ( 
      <div className="horario-viewer-full"> 
        <img 
          src={horarioUrl}
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
      {/* ... (Alerta y Titulo de Año se mantienen) ... */}
      {alerta && <div className={`alerta ${alerta.tipo}`}>{alerta.mensaje}</div>}

      <div className="titulo-anio">
        {user.role === "admin" ? (
          <input type="text" value={anio} onChange={e => setAnio(e.target.value)} className="anio-input" />
        ) : <h2>{anio}</h2>}
      </div>

      {user.role === "admin" && (
        <div className="admin-panel">
          <button className={`btn-add ${modoBorrador ? "activo" : ""}`} onClick={() => setModoBorrador(!modoBorrador)}>🧹 Borrador</button>
          <button className="btn-add" onClick={() => setMostrarPaleta(!mostrarPaleta)}>🖌 Pincel</button>
          {mostrarPaleta && (
            <div className="paleta-colores">
              {paletaColores.map(c => (
                <div key={c} className="color-cuadro" style={{ backgroundColor: c }} onClick={() => { setColorSeleccionado(c); setModoBorrador(false); }} />
              ))}
            </div>
          )}
          <button onClick={generarHorarioVacio} className="btn-add">Limpiar Horario</button>
          <button onClick={guardarHorario} className="btn-add">💾 Guardar horario</button>
          <button onClick={exportarPDF} className="btn-add">📄 Exportar PDF</button>
          <button onClick={abrirExploradorImagen} className="btn-add">⬆️ Subir Imagen Horario</button>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleArchivoChange} />
        </div>
      )}

      {user.role === "admin" && (
        <table className="horario-table">
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
                            <input type="text" maxLength={4} value={cell.text} onChange={e => handleCellChange(prof.nombre, "General", d, h, e.target.value)} />
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
      )}

      {user.role === "admin" && Object.keys(leyenda).length > 0 && (
        <div className="leyenda">
          <h3>Leyenda</h3>
          <div className="leyenda-colores">
            {Object.entries(leyenda).map(([color, significado]) => (
              <div key={color} className="leyenda-item">
                <div className="color-cuadro-leyenda" style={{ backgroundColor: color }} />
                <input type="text" placeholder="Significado" value={significado} onChange={e => handleLeyendaChange(color, e.target.value)} />
                <button className="btn-add" onClick={() => eliminarLeyenda(color)}>❌</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Horario;