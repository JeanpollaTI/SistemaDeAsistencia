import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaClipboardCheck, FaGraduationCap, FaTimes, FaSearch } from 'react-icons/fa';
import './SearchBar.css';
import './SearchChoiceModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAlumno, setSelectedAlumno] = useState(null);
    const navigate = useNavigate();
    const searchRef = useRef(null);

    // Debounce de búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Cerrar resultados al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/grupos/global-search?q=${query}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResults(res.data);
            setIsOpen(true);
        } catch (err) {
            console.error("Error en búsqueda:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleResultClick = (alumno) => {
        setIsOpen(false);
        setQuery('');
        navigate(`/alumno/${alumno.id}`);
    };

    return (
        <div className="search-bar-container" ref={searchRef}>
            <div className="search-input-wrapper">
                <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar alumno, grupo, aula o materia..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query.length > 2 && setIsOpen(true)}
                    />
                    {loading && <div className="search-spinner"></div>}
                </div>

                {isOpen && results.length > 0 && (
                    <div className="search-results-dropdown">
                        {results.map((res) => (
                            <div
                                key={`${res.type}-${res.id}-${res.grupoId}`}
                                className="search-result-item"
                                onClick={() => handleResultClick(res)}
                            >
                                <div className="result-info">
                                    <span className="result-name">{res.nombre}</span>
                                    <span className="result-meta">
                                        {res.matricula && `${res.matricula} • `} {res.grupo} {res.aula && `(${res.aula})`}
                                    </span>
                                </div>
                                <div className="result-badge">{res.type}</div>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
};

export default SearchBar;
