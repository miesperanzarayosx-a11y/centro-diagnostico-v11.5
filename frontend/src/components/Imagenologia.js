/**
 * Imagenologia.js
 * Módulo de imagenología con visor DICOM (Cornerstone.js)
 *
 * Roles:
 *  - admin / medico  → pueden ver Y editar el reporte
 *  - laboratorio / recepcion → solo pueden ver (modo solo lectura)
 *
 * Plantillas de la doctora:
 *  - Presets de texto guardados en localStorage (clave: "imgPlantillasDoctora")
 *  - La doctora puede crear, editar, eliminar y aplicar sus propias plantillas
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaXRay, FaUpload, FaSave, FaCheck, FaSpinner,
  FaEye, FaArrowLeft, FaPrint, FaPlus, FaTrash, FaPencilAlt,
} from 'react-icons/fa';
import api from '../services/api';
import DicomViewer from './DicomViewer';

/* ─── Plantillas de tipo de estudio (campos dinámicos) ──────── */
const TIPO_PLANTILLAS = [
  { id: 'general', label: 'General', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'torax', label: 'Tórax / Rx Tórax', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'columna', label: 'Columna', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'extremidades', label: 'Extremidades', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'abdomen', label: 'Abdomen', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
  { id: 'mamografia', label: 'Mamografía', campos: ['tecnica', 'hallazgos', 'impresion', 'birads', 'recomendaciones'] },
  { id: 'personalizada', label: 'Personalizada', campos: ['tecnica', 'hallazgos', 'impresion', 'recomendaciones'] },
];

const CAMPO_LABELS = {
  tecnica: 'Técnica Utilizada',
  hallazgos: 'Hallazgos',
  impresion: 'Impresión Diagnóstica',
  birads: 'Categoría BIRADS',
  recomendaciones: 'Recomendaciones',
};

const ESTADO_COLORES = {
  pendiente: { bg: '#fff3cd', color: '#856404' },
  en_proceso: { bg: '#cce5ff', color: '#004085' },
  completado: { bg: '#d4edda', color: '#155724' },
};

/* ─── Helper: obtener rol del usuario actual ─────────────────── */
function getRol() {
  try {
    const uStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    const u = JSON.parse(uStr || '{}');
    return u.role || u.rol || 'recepcion';
  } catch { return 'recepcion'; }
}
function puedeEditar() {
  const r = getRol(); return r === 'admin' || r === 'medico';
}

/* ─── Plantillas guardables (localStorage) ──────────────────── */
const LS_KEY = 'imgPlantillasDoctora';
function cargarPlantillasGuardadas() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function guardarPlantillasLS(lista) {
  localStorage.setItem(LS_KEY, JSON.stringify(lista));
}

/* ═══════════════════ COMPONENTE PRINCIPAL ══════════════════════ */
const Imagenologia = () => {
  const [vista, setVista] = useState('lista');
  const [estudios, setEstudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [estudioActual, setEstudioActual] = useState(null);
  const [imagenes, setImagenes] = useState([]);

  // Reporte
  const [reporte, setReporte] = useState({});
  const [tipoPlantilla, setTipoPlantilla] = useState('general');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  // Plantillas guardadas de la doctora
  const [plantillasDoctora, setPlantillasDoctora] = useState(cargarPlantillasGuardadas);
  const [mostrarGestorPlantillas, setMostrarGestorPlantillas] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState(null); // {nombre, reporte}
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState('');
  const [mostrarSoloVisor, setMostrarSoloVisor] = useState(false); // Ocultar panel de reporte
  const [imagenesParaImprimir, setImagenesParaImprimir] = useState([]); // Cola de imágenes para imprimir (1 o 2)
  const [ajustes, setAjustes] = useState(null); // WW/WC inicial del WS

  const fileInputRef = useRef(null);
  const guardadoTimeoutRef = useRef(null); // Para debounce del auto-guardado
  const canEdit = puedeEditar();
  const rol = getRol();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargarEstudios(); }, [filtroEstado]);

  /* ─── Persistir plantillas doctora ──────────────────────────── */
  useEffect(() => { guardarPlantillasLS(plantillasDoctora); }, [plantillasDoctora]);

  const cargarEstudios = async () => {
    setLoading(true);
    try {
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const resp = await api.getImagenologiaLista(params);
      setEstudios(Array.isArray(resp) ? resp : (resp?.resultados || resp?.data || []));
    } catch { setEstudios([]); }
    finally { setLoading(false); }
  };

  const abrirVisor = async (estudio) => {
    setEstudioActual(estudio);
    setVista('visor');
    setReporte({});
    setImagenes([]);
    setMostrarSoloVisor(false);
    setImagenesParaImprimir([]);
    setAjustes(null); // Nuevo estado
    try {
      const ws = await api.getImagenologiaWorkspace(estudio._id || estudio.id);
      const data = ws?.data || ws || {};
      if (data.reporte) setReporte(data.reporte);
      if (data.plantilla) setTipoPlantilla(data.plantilla);
      if (data.visor && data.visor.ajustes) setAjustes(data.visor.ajustes);
      const imgs = data.visor?.imagenes || data.imagenes || estudio.imagenes || [];
      setImagenes(imgs);
    } catch {
      setImagenes(estudio.imagenes || []);
    }
  };

  const handleSubirImagenes = async (e) => {
    const files = e.target.files;
    if (!files.length || !estudioActual) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('imagenes', f));
      const resp = await fetch(`/api/imagenologia/upload/${estudioActual._id || estudioActual.id}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || sessionStorage.getItem('token')) },
        body: formData,
      });
      const data = await resp.json();
      const nuevas = data.data || data.imagenes || [];
      setImagenes(prev => [...prev, ...nuevas]);
    } catch (err) { alert('Error al subir: ' + err.message); }
    finally { setSubiendo(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const guardarReporte = async (reporteOpcional = null, ajustesOpcionales = null) => {
    if (!estudioActual || !canEdit) return;
    setGuardando(true);
    try {
      const payload = {
        reporte: reporteOpcional || reporte,
        plantilla: tipoPlantilla
      };
      if (ajustesOpcionales) payload.ajustes = ajustesOpcionales;
      await api.updateImagenologiaWorkspace(estudioActual._id || estudioActual.id, payload);
      if (!ajustesOpcionales) alert('Reporte guardado correctamente'); // Solo avisar si fue guardado manual
    } catch (err) { if (!ajustesOpcionales) alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  const handleCambioAjustesVisor = useCallback((nuevosAjustes) => {
    setAjustes(nuevosAjustes);
    // Auto-guardado silencioso con Debounce (evitar spam al arrastrar WW/WL/Zoom)
    if (canEdit && estudioActual) {
      if (guardadoTimeoutRef.current) clearTimeout(guardadoTimeoutRef.current);
      guardadoTimeoutRef.current = setTimeout(() => {
        guardarReporte(reporte, nuevosAjustes);
      }, 1500); // Guardar 1.5s después de dejar de mover
    }
  }, [canEdit, estudioActual, reporte]); // eslint-disable-line

  const finalizarReporte = async () => {
    if (!estudioActual || !canEdit) return;
    if (!window.confirm('¿Finalizar y marcar como completado?')) return;
    setGuardando(true);
    try {
      await api.updateImagenologiaWorkspace(estudioActual._id || estudioActual.id, { reporte, plantilla: tipoPlantilla });
      await api.finalizarReporteImagenologia(estudioActual._id || estudioActual.id);
      alert('Reporte finalizado');
      setVista('lista');
      cargarEstudios();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setGuardando(false); }
  };

  /* ─── Plantillas guardadas de la doctora ───────────────────── */
  const guardarComoPlantilla = () => {
    const nombre = nombreNuevaPlantilla.trim() || `Plantilla ${plantillasDoctora.length + 1}`;
    const nueva = { id: Date.now().toString(), nombre, tipoPlantilla, reporte: { ...reporte } };
    setPlantillasDoctora(prev => [...prev, nueva]);
    setNombreNuevaPlantilla('');
    alert(`Plantilla "${nombre}" guardada`);
  };

  const aplicarPlantillaGuardada = (pt) => {
    setReporte({ ...pt.reporte });
    setTipoPlantilla(pt.tipoPlantilla || 'general');
  };

  const eliminarPlantillaGuardada = (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    setPlantillasDoctora(prev => prev.filter(p => p.id !== id));
  };

  const actualizarPlantillaGuardada = () => {
    if (!plantillaEditando) return;
    setPlantillasDoctora(prev => prev.map(p =>
      p.id === plantillaEditando.id
        ? { ...p, nombre: plantillaEditando.nombre, reporte: plantillaEditando.reporte, tipoPlantilla: plantillaEditando.tipoPlantilla }
        : p
    ));
    setPlantillaEditando(null);
    alert('Plantilla actualizada');
  };

  /* ─── Capturar imagen para imprimir ────────────────────────── */
  const agregarImagenAImprimir = () => {
    if (window.__capturarVisorDicomActivo) {
      const durl = window.__capturarVisorDicomActivo();
      if (durl) {
        setImagenesParaImprimir(prev => {
          const arr = [...prev, durl];
          if (arr.length > 2) return arr.slice(arr.length - 2); // Mantener máx 2
          return arr;
        });
        alert('Imagen capturada para imprimir. Ya van ' + (imagenesParaImprimir.length + 1) + '. Vaya a "Imprimir Imagen"');
      } else {
        alert('Espere a que cargue la imagen');
      }
    }
  };

  const limpiarImpresion = () => setImagenesParaImprimir([]);

  const imprimirImagenesSola = async () => {
    if (imagenesParaImprimir.length === 0) {
      alert("Capture al menos una imagen presionando el botón 📸 primero");
      return;
    }
    let empresa = {};
    try { const r = await fetch('/api/configuracion/empresa'); empresa = await r.json(); } catch { }
    const paciente = estudioActual?.paciente || {};
    const estudio = estudioActual?.estudio || {};
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Impresión de Imagen</title>
      <style>
      @page{size:A4;margin:10mm}body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;color:#333}
      .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #1a3a5c;padding-bottom:5px;margin-bottom:10px}
      .hdr h3{margin:0;color:#1a3a5c;font-size:14px} .hdr p{margin:0;font-size:10px;color:#666}
      .img-container{text-align:center;margin-bottom:15px;height:45vh;display:flex;align-items:center;justify-content:center;background:#000;border-radius:4px;overflow:hidden}
      .img-container img{max-width:100%;max-height:100%;object-fit:contain}
      @media print{.np{display:none}}
      </style></head><body>
      <div class="np" style="text-align:center;padding:10px;background:#f0f0f0;margin-bottom:15px">
        <button onclick="window.print()" style="padding:10px 20px;font-size:16px;cursor:pointer">🖨️ Imprimir</button>
      </div>
      <div class="hdr">
        <div><h3>${esc(empresa.nombre || 'Centro Diagnóstico')}</h3><p>Estudio: ${esc(estudio.nombre)}</p></div>
        <div style="text-align:right"><h3>Paciente: ${esc(paciente.nombre)} ${esc(paciente.apellido)}</h3><p>Cód: ${estudioActual?.codigo || ''} · ${new Date().toLocaleDateString('es-DO')}</p></div>
      </div>
      ${imagenesParaImprimir.map(img => `<div class="img-container"><img src="${img}" /></div>`).join('')}
      </body></html>`;

    const w = window.open('', 'ImprimirImagen', 'width=850,height=1100');
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 800);
  };

  /* ─── Imprimir reporte (solo texto) ────────────────────────── */
  const imprimirReporte = async () => {
    let empresa = {};
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('/api/configuracion/', { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      empresa = d.configuracion || d || {};
    } catch { }
    const paciente = estudioActual?.paciente || {};
    const estudio = estudioActual?.estudio || {};
    const fechaEstudio = new Date(estudioActual?.createdAt || new Date()).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tpl = TIPO_PLANTILLAS.find(p => p.id === tipoPlantilla) || TIPO_PLANTILLAS[0];

    // Calculate age from patient birthdate
    let edad = '';
    if (paciente.fechaNacimiento) {
      const birth = new Date(paciente.fechaNacimiento);
      const now = new Date();
      edad = Math.floor((now - birth) / (365.25 * 24 * 60 * 60 * 1000)) + ' ANOS';
    }

    // Build report sections
    const camposHtml = tpl.campos.map(c => {
      const v = reporte[c] || ''; if (!v) return '';
      const label = CAMPO_LABELS[c] || c;
      return `<div style="margin-bottom:18px">
        <p style="margin:0 0 4px;font-weight:700;text-decoration:underline;font-size:13px;color:#000">${esc(label)}:</p>
        <p style="margin:0;line-height:1.8;white-space:pre-wrap;font-size:12px;color:#000;text-align:justify">${esc(v)}</p>
      </div>`;
    }).join('');

    // Get doctor info
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const doctorName = user.nombre || 'Medico Informante';
    const doctorTitle = user.especialidad || 'MEDICO RADIOLOGO';

    // Get doctor signature from empresa config
    const firmaImg = empresa.firma_medico || empresa.firma_doctora || '';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte Imagenologia</title>
    <style>
      @page { size: A4; margin: 15mm 20mm; }
      body { font-family: 'Times New Roman', Times, serif; font-size: 12px; color: #000; margin: 0; padding: 20px 40px; }
      .logo-container { text-align: center; margin-bottom: 10px; }
      .logo-container img { max-height: 120px; object-fit: contain; }
      .dept-title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 2px; margin: 15px 0 25px; border-bottom: 1px solid #000; padding-bottom: 10px; }
      .patient-info { margin-bottom: 20px; font-size: 12px; line-height: 1.8; }
      .patient-info strong { font-weight: 700; }
      .study-title { font-size: 13px; font-weight: 700; margin: 20px 0 15px; text-transform: uppercase; }
      .report-body { margin: 10px 0 30px; }
      .firma-section { margin-top: 60px; }
      .firma-img { max-height: 80px; object-fit: contain; }
      .firma-name { font-weight: 700; font-size: 12px; margin: 5px 0 0; }
      .firma-title { font-size: 11px; color: #333; }
      .np { text-align: center; padding: 20px; }
      @media print { .np { display: none; } }
    </style></head><body>

    <!-- Logo centered -->
    <div class="logo-container">
      ${empresa.logo_resultados
        ? `<img src="${esc(empresa.logo_resultados)}" onerror="this.style.display='none'" />`
        : empresa.logo
          ? `<img src="${esc(empresa.logo)}" onerror="this.style.display='none'" />`
          : `<div style="font-size:24px;font-weight:700;color:#1a3a5c">${esc(empresa.nombre || 'Centro Diagnostico')}</div>`
      }
    </div>

    <!-- Department title -->
    <div class="dept-title">DEPARTAMENTO DE IMAGENES MEDICAS</div>

    <!-- Patient info -->
    <div class="patient-info">
      <strong>NOMBRE: ${esc(paciente.nombre || '')} ${esc(paciente.apellido || '')}</strong><br/>
      <strong>FECHA: ${fechaEstudio}</strong><br/>
      ${edad ? `<strong>EDAD: ${esc(edad)}</strong><br/>` : ''}
      ${paciente.cedula ? `<strong>CEDULA: ${esc(paciente.cedula)}</strong><br/>` : ''}
    </div>

    <!-- Study type -->
    <div class="study-title">${esc((estudio.nombre || 'ESTUDIO DE IMAGEN').toUpperCase())}</div>

    <!-- Report content -->
    <div class="report-body">
      ${camposHtml || '<p style="color:#888;font-style:italic">Sin reporte completado</p>'}
    </div>

    <!-- Doctor signature -->
    <div class="firma-section">
      ${firmaImg ? `<img class="firma-img" src="${esc(firmaImg)}" onerror="this.style.display='none'" style="background:transparent" />` : '<div style="height:60px"></div>'}
      <p class="firma-name">DRA.${esc(doctorName.toUpperCase())}</p>
      <p class="firma-title">${esc(doctorTitle.toUpperCase())}</p>
    </div>

    <div class="np"><button onclick="window.print()" style="padding:14px 35px;background:#1a3a5c;color:white;border:none;border-radius:10px;cursor:pointer;font-size:15px;font-weight:bold">Imprimir Reporte</button></div>
    </body></html>`;
    const w = window.open('', 'Reporte', 'width=850,height=1100');
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  /* ══════════════════ VISTA LISTA ════════════════════════════════ */
  if (vista === 'lista') {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#1a3a5c' }}>
            <FaXRay style={{ color: '#87CEEB' }} /> Imagenología
            <span style={{ fontSize: 13, background: '#e8f4fd', color: '#1565c0', padding: '3px 10px', borderRadius: 12, fontWeight: 600, marginLeft: 6 }}>
              {rol.charAt(0).toUpperCase() + rol.slice(1)}
            </span>
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'pendiente', 'en_proceso', 'completado'].map(e => (
              <button key={e} onClick={() => setFiltroEstado(e)} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold',
                background: filtroEstado === e ? '#1a3a5c' : '#f0f0f0',
                color: filtroEstado === e ? 'white' : '#333', fontSize: 13,
              }}>{e === '' ? 'Todos' : e.replace('_', ' ')}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><FaSpinner className="spin" style={{ fontSize: 40, color: '#87CEEB' }} /></div>
        ) : estudios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 15 }}>
            <FaXRay style={{ fontSize: 60, color: '#ddd', marginBottom: 16 }} />
            <p style={{ color: '#999', fontSize: 17 }}>No hay estudios {filtroEstado ? `"${filtroEstado}"` : ''}</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {['Código', 'Paciente', 'Estudio', 'Imágenes', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '13px 14px', textAlign: ['Imágenes', 'Estado', 'Acciones'].includes(h) ? 'center' : 'left', color: '#666', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estudios.map(e => {
                  const est = ESTADO_COLORES[e.estado] || ESTADO_COLORES.pendiente;
                  return (
                    <tr key={e._id || e.id} style={{ borderBottom: '1px solid #f0f0f0' }} onMouseEnter={ev => ev.currentTarget.style.background = '#fafbfc'} onMouseLeave={ev => ev.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, color: '#1a3a5c', fontWeight: 700 }}>{e.codigo || e._id?.slice(-6).toUpperCase()}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{e.paciente?.nombre} {e.paciente?.apellido}</td>
                      <td style={{ padding: '12px 14px', color: '#555' }}>{e.estudio?.nombre || 'Estudio de imagen'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ background: '#e8f4fd', color: '#1565c0', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{(e.imagenes || []).length}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: est.bg, color: est.color }}> {(e.estado || 'pendiente').replace('_', ' ')} </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#888', fontSize: 13 }}>{new Date(e.createdAt || e.fecha).toLocaleDateString('es-DO')}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button onClick={() => abrirVisor(e)} style={{ padding: '8px 16px', background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                          <FaEye /> {canEdit ? 'Abrir Visor' : 'Ver Imágenes'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════ VISTA VISOR ════════════════════════════════ */

  // handleCambioAjustesVisor fue movido arriba para que acceda al ref del timeout

  const tipoActual = TIPO_PLANTILLAS.find(p => p.id === tipoPlantilla) || TIPO_PLANTILLAS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', background: '#0d1520', overflow: 'hidden', borderRadius: 12 }}>

      {/* ── Header ── */}
      <div style={{ background: '#111d2c', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setVista('lista'); cargarEstudios(); }}
            style={{ padding: '7px 13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <FaArrowLeft /> Volver
          </button>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{estudioActual?.paciente?.nombre} {estudioActual?.paciente?.apellido}</div>
            <div style={{ color: '#82b1ff', fontSize: 12 }}>{estudioActual?.estudio?.nombre || 'Estudio de imagen'} &nbsp;·&nbsp; Cód: {estudioActual?.codigo || estudioActual?._id?.slice(-6).toUpperCase()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setMostrarSoloVisor(!mostrarSoloVisor)} style={{ padding: '7px 13px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, marginRight: 15 }}>
            {mostrarSoloVisor ? '👁 Mostrar Reporte' : '👁 Ocultar Reporte'}
          </button>
          {/* Solo médico/admin puede subir */}
          {canEdit && (
            <label style={{ padding: '7px 13px', background: '#1565c0', color: 'white', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13 }}>
              {subiendo ? <FaSpinner className="spin" /> : <FaUpload />}
              {subiendo ? 'Subiendo…' : 'Subir DICOM'}
              <input ref={fileInputRef} type="file" accept=".dcm,.DCM,image/*" multiple style={{ display: 'none' }} onChange={handleSubirImagenes} />
            </label>
          )}

          {/* Controles de Impresión Separados */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3, gap: 3 }}>
            <button onClick={agregarImagenAImprimir} style={{ padding: '4px 9px', background: '#3949ab', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }} title="Capturar imagen actual para imprimir">
              📸 Capturar Imagen ({imagenesParaImprimir.length}/2)
            </button>
            {imagenesParaImprimir.length > 0 && (
              <>
                <button onClick={limpiarImpresion} style={{ padding: '4px 9px', background: '#e53935', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }} title="Limpiar imágenes">🗑</button>
                <button onClick={imprimirImagenesSola} style={{ padding: '4px 9px', background: '#1e88e5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                  🖨️ Imprimir Imagen
                </button>
              </>
            )}
          </div>

          <button onClick={imprimirReporte} style={{ padding: '7px 13px', background: '#6a1b9a', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13, marginLeft: 15 }}>
            <FaPrint /> Imprimir Reporte
          </button>

          {canEdit && (
            <>
              <button onClick={() => guardarReporte()} disabled={guardando} style={{ padding: '7px 13px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13 }}>
                {guardando ? <FaSpinner className="spin" /> : <FaSave />} Guardar
              </button>
              <button onClick={finalizarReporte} disabled={guardando} style={{ padding: '7px 13px', background: '#e65100', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13 }}>
                <FaCheck /> Finalizar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Visor DICOM */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <DicomViewer
            imagenes={imagenes}
            ajustesIniciales={ajustes || {}}
            onCambioAjustes={handleCambioAjustesVisor}
            estiloContenedor={{ borderRadius: 0 }}
          />
        </div>

        {/* ── Panel derecho: Reporte médico ── */}
        {!mostrarSoloVisor && (
          <div style={{ width: 310, flexShrink: 0, background: '#f7f9fc', borderLeft: '1px solid #dde3ee', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header panel */}
            <div style={{ background: '#1a3a5c', color: 'white', padding: '11px 14px', fontWeight: 700, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span>📋 Reporte Médico</span>
              {canEdit && (
                <button onClick={() => setMostrarGestorPlantillas(g => !g)}
                  title="Gestionar plantillas de la doctora"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                  📁 Mis Plantillas
                </button>
              )}
            </div>

            {/* ── Modal gestor de plantillas ── */}
            {mostrarGestorPlantillas && canEdit && (
              <div style={{ background: '#fff', borderBottom: '2px solid #e0e6ef', padding: 12, flexShrink: 0, maxHeight: 320, overflowY: 'auto' }}>
                <div style={{ fontWeight: 700, color: '#1a3a5c', fontSize: 13, marginBottom: 8 }}>📁 Plantillas de la Doctora</div>

                {/* Lista de plantillas guardadas */}
                {plantillasDoctora.length === 0 ? (
                  <p style={{ color: '#aaa', fontSize: 12, margin: '0 0 8px' }}>Sin plantillas guardadas aún.</p>
                ) : plantillasDoctora.map(pt => (
                  <div key={pt.id} style={{ background: '#f0f8ff', border: '1px solid #b3d4f5', borderRadius: 8, padding: '8px 10px', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {plantillaEditando?.id === pt.id ? (
                      <>
                        <input value={plantillaEditando.nombre} onChange={e => setPlantillaEditando(p => ({ ...p, nombre: e.target.value }))}
                          style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #b3d4f5', fontSize: 12 }} />
                        <button onClick={actualizarPlantillaGuardada} style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>✓</button>
                        <button onClick={() => setPlantillaEditando(null)} style={{ background: '#e0e0e0', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: '#1a3a5c' }}>{pt.nombre}</span>
                        <span style={{ fontSize: 10, color: '#888', marginRight: 4 }}>{(TIPO_PLANTILLAS.find(t => t.id === pt.tipoPlantilla) || {}).label}</span>
                        <button onClick={() => aplicarPlantillaGuardada(pt)} title="Aplicar" style={{ background: '#1565c0', color: 'white', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>Aplicar</button>
                        <button onClick={() => setPlantillaEditando({ ...pt })} title="Editar nombre" style={{ background: '#f0f0f0', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', fontSize: 12 }}><FaPencilAlt /></button>
                        <button onClick={() => eliminarPlantillaGuardada(pt.id)} title="Eliminar" style={{ background: '#ffebee', color: '#e53935', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', fontSize: 12 }}><FaTrash /></button>
                      </>
                    )}
                  </div>
                ))}

                {/* Guardar reporte actual como plantilla */}
                <div style={{ borderTop: '1px solid #e0e6ef', paddingTop: 8, display: 'flex', gap: 6 }}>
                  <input value={nombreNuevaPlantilla} onChange={e => setNombreNuevaPlantilla(e.target.value)}
                    placeholder="Nombre de la nueva plantilla…"
                    style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid #b3d4f5', fontSize: 12 }} />
                  <button onClick={guardarComoPlantilla} style={{ background: '#1a3a5c', color: 'white', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FaPlus /> Guardar
                  </button>
                </div>
                <p style={{ fontSize: 10, color: '#aaa', margin: '4px 0 0' }}>Guarda el reporte actual como plantilla reutilizable</p>
              </div>
            )}

            {/* ── Formulario del reporte ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 13 }}>

              {/* Aviso solo lectura */}
              {!canEdit && (
                <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#e65100', display: 'flex', alignItems: 'center', gap: 6 }}>
                  👁 Modo solo lectura — solo la doctora puede editar el reporte
                </div>
              )}

              {/* Selector tipo de estudio */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>Tipo de Estudio</label>
                <select value={tipoPlantilla} onChange={e => setTipoPlantilla(e.target.value)} disabled={!canEdit}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e6ef', fontSize: 13, background: canEdit ? 'white' : '#f5f5f5', color: '#333' }}>
                  {TIPO_PLANTILLAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>

              {/* Plantillas rápidas de la doctora (aplicar sin abrir gestor) */}
              {canEdit && plantillasDoctora.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 5 }}>Aplicar Plantilla Rápida</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {plantillasDoctora.map(pt => (
                      <button key={pt.id} onClick={() => aplicarPlantillaGuardada(pt)} style={{ padding: '5px 10px', background: '#e8f4fd', border: '1px solid #90caf9', color: '#1565c0', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        {pt.nombre}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos dinámicos de la plantilla */}
              {tipoActual.campos.map(campo => (
                <div key={campo} style={{ marginBottom: 11 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: 4 }}>
                    {CAMPO_LABELS[campo] || campo}
                  </label>
                  {campo === 'birads' ? (
                    <select value={reporte[campo] || ''} onChange={e => canEdit && setReporte(p => ({ ...p, [campo]: e.target.value }))} disabled={!canEdit}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e6ef', fontSize: 13, background: canEdit ? 'white' : '#f5f5f5' }}>
                      <option value="">Seleccionar BIRADS</option>
                      {['0', '1', '2', '3', '4A', '4B', '4C', '5', '6'].map(b => <option key={b} value={b}>BIRADS {b}</option>)}
                    </select>
                  ) : (
                    <textarea
                      value={reporte[campo] || ''}
                      onChange={e => canEdit && setReporte(p => ({ ...p, [campo]: e.target.value }))}
                      readOnly={!canEdit}
                      placeholder={canEdit ? `${CAMPO_LABELS[campo]}…` : '(sin información)'}
                      rows={campo === 'hallazgos' ? 5 : 3}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e0e6ef', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5, background: canEdit ? 'white' : '#f5f5f5', cursor: canEdit ? 'text' : 'default' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Botones inferiores — solo si puede editar */}
            {canEdit && (
              <div style={{ padding: 11, borderTop: '1px solid #e0e6ef', display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
                <button onClick={() => guardarReporte()} disabled={guardando} style={{ padding: '10px', background: '#1565c0', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}>
                  {guardando ? <FaSpinner className="spin" /> : <FaSave />} Guardar Borrador
                </button>
                <button onClick={finalizarReporte} disabled={guardando} style={{ padding: '10px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13 }}>
                  <FaCheck /> Finalizar y Completar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Imagenologia;
