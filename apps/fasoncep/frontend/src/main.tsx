import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')!
const app = <React.StrictMode><App /></React.StrictMode>
if (window.location.pathname === '/' && root.querySelector('.landing-page') !== null) ReactDOM.hydrateRoot(root, app)
else ReactDOM.createRoot(root).render(app)
