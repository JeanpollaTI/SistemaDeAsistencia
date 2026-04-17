import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaUser, FaUsers, FaArrowRight } from 'react-icons/fa';
import apiClient from '../api/apiClient';
import './SearchBar.css';

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 2) {
                setResults([]);
                setShowDropdown(false);
                return;
            }

            setLoading(true);
            try {
                const res = await apiClient.get(`/api/grupos/global-search?q=${encodeURIComponent(query)}`);
                setResults(res.data);
                setShowDropdown(true);
            } catch (err) {
                console.error("Error search:", err);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result) => {
        setQuery('');
        setShowDropdown(false);
        navigate(`/alumno/${result.id}`);
    };

    return (
        <div className="search-bar-container" ref={dropdownRef}>
            <div className={`search-input-wrapper ${showDropdown ? 'active' : ''}`}>
                <FaSearch className="search-icon" />
                <input
                    type="text"
                    placeholder="Buscar alumno o grupo (ej: Javier 3A)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setShowDropdown(true)}
                />
                {loading && <div className="search-spinner"></div>}
            </div>

            {showDropdown && (
                <div className="search-dropdown glass">
                    {results.length > 0 ? (
                        results.map((res) => (
                            <div key={res.id} className="search-result-item" onClick={() => handleSelect(res)}>
                                <div className="res-icon-box">
                                    <FaUser className="res-icon" />
                                </div>
                                <div className="res-info">
                                    <span className="res-name">{res.nombre}</span>
                                    <div className="res-meta">
                                        <span className="res-group">
                                            <FaUsers /> {res.grupo}
                                        </span>
                                        <span className="res-matricula">ID: {res.matricula}</span>
                                    </div>
                                </div>
                                <FaArrowRight className="res-arrow" />
                            </div>
                        ))
                    ) : (
                        <div className="search-no-results">
                            No se encontraron coincidencias para "{query}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchBar;
