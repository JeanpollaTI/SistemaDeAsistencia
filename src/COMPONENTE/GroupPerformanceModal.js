import React, { useState, useEffect, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { FaTimes, FaChartPie, FaUsers, FaGraduationCap, FaFilePdf } from 'react-icons/fa';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './GroupPerformanceModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GroupPerformanceModal = ({ isOpen, onClose, grupo, schoolConfig }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen && grupo?._id) {
      fetchAnalytics();
    }
  }, [isOpen, grupo]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/grupos/${grupo._id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error("Error al cargar analíticas:", err);
      setError("No se pudieron cargar las estadísticas del grupo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!modalRef.current) return;
    setDownloading(true);
    try {
      const modalElement = modalRef.current;
      
      const canvas = await html2canvas(modalElement, {
        scale: 2,
        backgroundColor: '#1e1e2d', // Solid dark color matching the theme background
        useCORS: true,
        onclone: (clonedDocument) => {
          // Hide action buttons in the cloned document so they don't appear in the PDF
          const actions = clonedDocument.querySelector('.header-actions');
          if (actions) {
            actions.style.display = 'none';
          }
          
          // Add school header if available
          if (schoolConfig?.name) {
            const headerTitle = clonedDocument.querySelector('.header-title');
            if (headerTitle) {
              const schoolHeader = clonedDocument.createElement('div');
              schoolHeader.style.color = '#00cbcb';
              schoolHeader.style.fontSize = '0.9rem';
              schoolHeader.style.fontWeight = 'bold';
              schoolHeader.style.textTransform = 'uppercase';
              schoolHeader.style.marginBottom = '4px';
              schoolHeader.style.letterSpacing = '1px';
              schoolHeader.innerText = schoolConfig.name;
              headerTitle.insertBefore(schoolHeader, headerTitle.firstChild);
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = doc.internal.pageSize.getWidth() - 20; // 10mm margins on both sides
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pageHeight = doc.internal.pageSize.getHeight() - 20; // 10mm margins on top/bottom
      
      let finalWidth = pdfWidth;
      let finalHeight = pdfHeight;
      
      // If the rendered height exceeds the A4 landscape page height, scale it down to fit
      if (pdfHeight > pageHeight) {
        finalHeight = pageHeight;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const xOffset = (doc.internal.pageSize.getWidth() - finalWidth) / 2;
      const yOffset = (doc.internal.pageSize.getHeight() - finalHeight) / 2;

      doc.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      
      // Save the PDF
      const groupName = grupo?.nombre?.replace(/\s+/g, '_') || 'grupo';
      doc.save(`Rendimiento_Grupo_${groupName}.pdf`);
    } catch (err) {
      console.error("Error al exportar PDF:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div ref={modalRef} className="analytics-modal" onClick={e => e.stopPropagation()}>
        <header className="analytics-header">
          <div className="header-title">
            <FaChartPie className="title-icon" />
            <div>
              <h2>Rendimiento por Grupo</h2>
              <p>{grupo?.nombre} - {grupo?.asesor || 'Sin asesor'}</p>
            </div>
          </div>
          <div className="header-actions">
            {!loading && !error && data && (
              <button 
                className="download-pdf-btn" 
                onClick={handleDownloadPDF}
                disabled={downloading}
                title="Descargar reporte en PDF"
              >
                {downloading ? (
                  <>
                    <div className="spinner-mini"></div> Generando...
                  </>
                ) : (
                  <>
                    <FaFilePdf /> Descargar PDF
                  </>
                )}
              </button>
            )}
            <button className="close-btn" onClick={onClose} title="Cerrar"><FaTimes /></button>
          </div>
        </header>

        <div className="analytics-content">
          {loading ? (
            <div className="analytics-loading">
              <div className="spinner"></div>
              <p>Generando analíticas...</p>
            </div>
          ) : error ? (
            <div className="analytics-error">
              <p>{error}</p>
              <button onClick={fetchAnalytics} className="retry-btn">Reintentar</button>
            </div>
          ) : (
            <>
              <div className="stats-summary">
                <div className="stat-card">
                  <FaUsers className="stat-icon attendance" />
                  <div className="stat-info">
                    <span className="stat-value">{data.summary.attendanceRate}%</span>
                    <span className="stat-label">Asistencia General</span>
                  </div>
                </div>
                <div className="stat-card">
                  <FaGraduationCap className="stat-icon performance" />
                  <div className="stat-info">
                    <span className="stat-value">{data.summary.totalStudentsEvaluated}</span>
                    <span className="stat-label">Alumnos Evaluados</span>
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-container">
                  <h3>Rendimiento de Asistencia</h3>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={data.attendanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {data.attendanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: 'rgba(23, 23, 35, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-container">
                  <h3>Rendimiento de Calificaciones</h3>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={data.performanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {data.performanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ background: 'rgba(23, 23, 35, 0.9)', border: 'none', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupPerformanceModal;
