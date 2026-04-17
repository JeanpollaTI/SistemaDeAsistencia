import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend 
} from 'recharts';
import { FaTimes, FaChartPie, FaUsers, FaGraduationCap } from 'react-icons/fa';
import axios from 'axios';
import './GroupPerformanceModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const GroupPerformanceModal = ({ isOpen, onClose, grupo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (!isOpen) return null;

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <header className="analytics-header">
          <div className="header-title">
            <FaChartPie className="title-icon" />
            <div>
              <h2>Rendimiento por Grupo</h2>
              <p>{grupo?.nombre} - {grupo?.asesor || 'Sin asesor'}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
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
