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
  const [pdfStyle, setPdfStyle] = useState('dark');
  const [appTheme, setAppTheme] = useState('dark');
  const modalRef = useRef(null);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setAppTheme(currentTheme);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
          setAppTheme(newTheme);
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

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
      const captureBg = pdfStyle === 'dark' ? '#191d28' : '#ffffff';
      
      const canvas = await html2canvas(modalElement, {
        scale: 2,
        backgroundColor: captureBg,
        useCORS: true,
        onclone: (clonedDocument) => {
          // Hide action buttons in the cloned document so they don't appear in the PDF
          const actions = clonedDocument.querySelector('.header-actions');
          if (actions) {
            actions.style.display = 'none';
          }

          // Hide style selector in the cloned document
          const styleSelector = clonedDocument.querySelector('.pdf-style-selector-container');
          if (styleSelector) {
            styleSelector.style.display = 'none';
          }
          
          // Make sure the entire modal is rendered fully and not cut off by max-height / scroll restrictions
          const clonedOverlay = clonedDocument.querySelector('.analytics-overlay');
          if (clonedOverlay) {
            clonedOverlay.style.height = 'auto';
            clonedOverlay.style.minHeight = '100%';
            clonedOverlay.style.overflow = 'visible';
            clonedOverlay.style.display = 'block';
            clonedOverlay.style.padding = '0';
            clonedOverlay.style.background = 'transparent';
          }
          
          const clonedModal = clonedDocument.querySelector('.analytics-modal');
          if (clonedModal) {
            clonedModal.style.maxHeight = 'none';
            clonedModal.style.height = 'auto';
            clonedModal.style.overflow = 'visible';
            clonedModal.style.boxShadow = 'none';
            clonedModal.style.border = 'none';
            clonedModal.style.position = 'relative';
            clonedModal.style.width = '900px'; // Force fixed width for printing so it lays out consistently
          }

          // Fix responsive chart sizes in the clone so Recharts renders them at full size
          const clonedWrappers = clonedDocument.querySelectorAll('.chart-wrapper');
          clonedWrappers.forEach(wrapper => {
            wrapper.style.width = '400px';
            wrapper.style.height = '250px';
            wrapper.style.display = 'block';
          });

          const clonedRechartsWrappers = clonedDocument.querySelectorAll('.recharts-wrapper');
          clonedRechartsWrappers.forEach(rw => {
            rw.style.width = '400px';
            rw.style.height = '250px';
          });
          
          const clonedSvgs = clonedDocument.querySelectorAll('.recharts-wrapper svg');
          clonedSvgs.forEach(svg => {
            svg.setAttribute('width', '400');
            svg.setAttribute('height', '250');
            svg.style.width = '400px';
            svg.style.height = '250px';
          });
          
          // Apply dynamic PDF Style Overrides
          if (pdfStyle === 'light') {
            if (clonedModal) {
              clonedModal.style.background = '#ffffff';
              clonedModal.style.color = '#334155';
            }
            
            const header = clonedDocument.querySelector('.analytics-header');
            if (header) {
              header.style.background = '#f8fafc';
              header.style.borderBottom = '1px solid #e2e8f0';
              header.style.color = '#0f172a';
            }
            
            const titleH2 = clonedDocument.querySelector('.header-title h2');
            if (titleH2) titleH2.style.color = '#0f172a';
            
            const titleP = clonedDocument.querySelector('.header-title p');
            if (titleP) titleP.style.color = '#64748b';
            
            clonedDocument.querySelectorAll('.stat-card').forEach(card => {
              card.style.background = '#f8fafc';
              card.style.border = '1px solid #e2e8f0';
            });
            
            clonedDocument.querySelectorAll('.stat-value').forEach(v => {
              v.style.color = '#0f172a';
            });
            
            clonedDocument.querySelectorAll('.stat-label').forEach(l => {
              l.style.color = '#64748b';
            });
            
            clonedDocument.querySelectorAll('.chart-container').forEach(c => {
              c.style.background = '#ffffff';
              c.style.border = '1px solid #e2e8f0';
            });
            
            clonedDocument.querySelectorAll('.chart-container h3').forEach(h3 => {
              h3.style.color = '#0f172a';
            });
            
            clonedDocument.querySelectorAll('.recharts-wrapper svg text').forEach(t => {
              t.setAttribute('fill', '#334155');
              t.style.fill = '#334155';
            });
            
            clonedDocument.querySelectorAll('.recharts-legend-item-text').forEach(leg => {
              leg.style.color = '#334155';
            });
          } else if (pdfStyle === 'excel') {
            if (clonedModal) {
              clonedModal.style.background = '#ffffff';
              clonedModal.style.color = '#000000';
              clonedModal.style.borderRadius = '0px';
            }
            
            const header = clonedDocument.querySelector('.analytics-header');
            if (header) {
              header.style.background = '#107c41'; // Excel green
              header.style.borderBottom = '2px solid #0b5930';
              header.style.color = '#ffffff';
              header.style.borderRadius = '0px';
            }
            
            const titleIcon = clonedDocument.querySelector('.title-icon');
            if (titleIcon) titleIcon.style.color = '#ffffff';
            
            const titleH2 = clonedDocument.querySelector('.header-title h2');
            if (titleH2) titleH2.style.color = '#ffffff';
            
            const titleP = clonedDocument.querySelector('.header-title p');
            if (titleP) titleP.style.color = '#e2f0d9';
            
            clonedDocument.querySelectorAll('.stat-card').forEach(card => {
              card.style.background = '#ffffff';
              card.style.border = '2px solid #d9d9d9';
              card.style.borderRadius = '0px';
              card.style.boxShadow = 'none';
            });
            
            clonedDocument.querySelectorAll('.stat-value').forEach(v => {
              v.style.color = '#107c41';
            });
            
            clonedDocument.querySelectorAll('.stat-label').forEach(l => {
              l.style.color = '#595959';
            });
            
            clonedDocument.querySelectorAll('.chart-container').forEach(c => {
              c.style.background = '#ffffff';
              c.style.border = '1px solid #d9d9d9';
              c.style.borderRadius = '0px';
              c.style.boxShadow = 'none';
            });
            
            clonedDocument.querySelectorAll('.chart-container h3').forEach(h3 => {
              h3.style.color = '#000000';
              h3.style.background = '#f2f2f2';
              h3.style.padding = '8px';
              h3.style.borderBottom = '1px solid #d9d9d9';
              h3.style.fontSize = '0.95rem';
              h3.style.fontWeight = 'bold';
            });
            
            clonedDocument.querySelectorAll('.recharts-wrapper svg text').forEach(t => {
              t.setAttribute('fill', '#000000');
              t.style.fill = '#000000';
            });
            
            clonedDocument.querySelectorAll('.recharts-legend-item-text').forEach(leg => {
              leg.style.color = '#000000';
            });
          } else {
            // Dark style fallback
            if (clonedModal) {
              clonedModal.style.background = '#191d28';
              clonedModal.style.color = '#ffffff';
            }
            
            const header = clonedDocument.querySelector('.analytics-header');
            if (header) {
              header.style.background = '#1e222d';
              header.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
              header.style.color = '#ffffff';
            }
            
            const titleH2 = clonedDocument.querySelector('.header-title h2');
            if (titleH2) titleH2.style.color = '#ffffff';
            
            const titleP = clonedDocument.querySelector('.header-title p');
            if (titleP) titleP.style.color = '#94a3b8';
            
            clonedDocument.querySelectorAll('.stat-card').forEach(card => {
              card.style.background = 'rgba(255, 255, 255, 0.03)';
              card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
            });
            
            clonedDocument.querySelectorAll('.stat-value').forEach(v => {
              v.style.color = '#ffffff';
            });
            
            clonedDocument.querySelectorAll('.stat-label').forEach(l => {
              l.style.color = '#94a3b8';
            });
            
            clonedDocument.querySelectorAll('.chart-container').forEach(c => {
              c.style.background = 'rgba(255, 255, 255, 0.02)';
              c.style.border = '1px solid rgba(255, 255, 255, 0.05)';
            });
            
            clonedDocument.querySelectorAll('.chart-container h3').forEach(h3 => {
              h3.style.color = '#e2e8f0';
            });
            
            clonedDocument.querySelectorAll('.recharts-wrapper svg text').forEach(t => {
              t.setAttribute('fill', '#ffffff');
              t.style.fill = '#ffffff';
            });
            
            clonedDocument.querySelectorAll('.recharts-legend-item-text').forEach(leg => {
              leg.style.color = '#e9e9e9';
            });
          }
          
          // Add school header if available
          if (schoolConfig?.name) {
            const headerTitle = clonedDocument.querySelector('.header-title');
            if (headerTitle) {
              const schoolHeader = clonedDocument.createElement('div');
              schoolHeader.style.color = pdfStyle === 'excel' ? '#ffffff' : '#00cbcb';
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
              {/* Selector de diseño del PDF */}
              <div className="pdf-style-selector-container">
                <span className="selector-label">Diseño de Exportación PDF:</span>
                <div className="style-options">
                  <button 
                    type="button"
                    className={`style-opt-btn ${pdfStyle === 'dark' ? 'active' : ''}`}
                    onClick={() => setPdfStyle('dark')}
                  >
                    Oscuro
                  </button>
                  <button 
                    type="button"
                    className={`style-opt-btn ${pdfStyle === 'light' ? 'active' : ''}`}
                    onClick={() => setPdfStyle('light')}
                  >
                    Claro
                  </button>
                  <button 
                    type="button"
                    className={`style-opt-btn ${pdfStyle === 'excel' ? 'active' : ''}`}
                    onClick={() => setPdfStyle('excel')}
                  >
                    Excel
                  </button>
                </div>
              </div>

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
                          contentStyle={{ 
                            background: appTheme === 'dark' ? 'rgba(23, 23, 35, 0.9)' : 'rgba(255, 255, 255, 0.95)', 
                            border: appTheme === 'dark' ? 'none' : '1px solid #ddd', 
                            borderRadius: '8px', 
                            color: appTheme === 'dark' ? '#fff' : '#333' 
                          }}
                        />
                        <Legend formatter={(value) => <span style={{ color: appTheme === 'dark' ? '#E9E9E9' : '#333333' }}>{value}</span>} />
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
                          contentStyle={{ 
                            background: appTheme === 'dark' ? 'rgba(23, 23, 35, 0.9)' : 'rgba(255, 255, 255, 0.95)', 
                            border: appTheme === 'dark' ? 'none' : '1px solid #ddd', 
                            borderRadius: '8px', 
                            color: appTheme === 'dark' ? '#fff' : '#333' 
                          }}
                        />
                        <Legend formatter={(value) => <span style={{ color: appTheme === 'dark' ? '#E9E9E9' : '#333333' }}>{value}</span>} />
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
