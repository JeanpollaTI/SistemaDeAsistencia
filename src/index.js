import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// BrowserRouter es el componente que habilita el enrutamiento en tu aplicación.
import { BrowserRouter } from 'react-router-dom';

// Encuentra el elemento 'root' en tu HTML, que es donde se montará toda la aplicación.
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza el componente principal <App /> dentro del enrutador y el modo estricto de React.
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
