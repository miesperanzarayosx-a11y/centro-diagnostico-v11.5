import React, { useState, useEffect } from 'react';
import { FaFileInvoiceDollar, FaEye, FaPrint, FaSpinner, FaPlus, FaChartLine } from 'react-icons/fa';
import api from '../services/api';
import FacturaTermica from './FacturaTermica';

const Facturas = () => {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [facturaDetalle, setFacturaDetalle] = useState(null);
  const [citasPendientes, setCitasPendientes] = useState([]);
  const [showModalNueva, setShowModalNueva] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [facturaImprimir, setFacturaImprimir] = useState(null);
  const [turnoActivo, setTurnoActivo] = useState(null);

  useEffect(() => {
    fetchFacturas();
    fetchCitasPendientes();
    fetchTurnoActivo();

    const interval = setInterval(() => {
      fetchFacturas(true);
      fetchCitasPendientes(true);
    }, 20000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  const fetchTurnoActivo = async () => {
    try {
      const response = await api.getTurnoActivo();
      if (response && (response.data || response)) setTurnoActivo(response.data || response);
      else setTurnoActivo(null);
      setConnectionError(null);
    } catch (err) {
      console.error('Error cargando turno:', err);
      setTurnoActivo(null);
      if (err.isGatewayError || err.isNetworkError) {
        setConnectionError(err.message);
      }
    }
  };

  const abrirTurnoManual = async () => {
    try {
      setLoading(true);
      await api.abrirTurnoCaja();
      fetchTurnoActivo();
    } catch (err) {
      console.error('Error abriendo caja:', err);
    } finally {
      setLoading(false);
    }
  };

  const cerrarTurnoManual = async () => {
    if (!window.confirm('¿Desea cerrar la caja actual?')) return;
    try {
      setLoading(true);
      await api.cerrarTurnoCaja();
      setTurnoActivo(null);
    } catch (err) {
      console.error('Error cerrando caja:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacturas = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const response = await api.getFacturas(params);
      setFacturas(Array.isArray(response) ? response : []);
      setConnectionError(null);
    } catch (err) {
      console.error(err);
      if (!isSilent) setFacturas([]);
      if (err.isGatewayError || err.isNetworkError) {
        setConnectionError(err.message);
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchCitasPendientes = async (isSilent = false) => {
    try {
      const response = await api.getCitas({ pagado: false });
      const citas = Array.isArray(response) ? response : (response.data || []);
      setCitasPendientes(citas.filter(c => c.estado === 'completada' || c.estado === 'programada'));
    } catch (err) {
      console.error(err);
      if (err.isGatewayError || err.isNetworkError) {
        setConnectionError(err.message);
      }
    }
  };

  const verDetalle = async (factura) => {
    try {
      const response = await api.getFactura(factura._id || factura.id);
      setFacturaDetalle(response);
    } catch (err) {
      console.error(err);
    }
  };

  const imprimirFactura = async (factura) => {
    try {
      const response = await api.getFactura(factura._id || factura.id);
      const facturaCompleta = response;
      let pacienteData = facturaCompleta.paciente || facturaCompleta.datosCliente;

      if (typeof pacienteData === 'string') {
        try {
          const pacienteResponse = await api.getPaciente(pacienteData);
          pacienteData = pacienteResponse.data;
        } catch (e) {
          pacienteData = facturaCompleta.datosCliente || { nombre: 'N/A' };
        }
      }

      const estudios = (facturaCompleta.detalles || facturaCompleta.items || []).map(item => ({
        nombre: item.descripcion || item.nombre || 'Estudio',
        precio: item.precioUnitario || item.precio_unitario || item.precio || 0,
        cobertura: item.descuento || item.cobertura || 0
      }));

      setFacturaImprimir({
        factura: { ...facturaCompleta, numero: facturaCompleta.numero || facturaCompleta.numero_factura },
        paciente: pacienteData,
        estudios: estudios
      });
    } catch (err) {
      console.error('Error al cargar factura:', err);
    }
  };

  const crearFactura = async () => {
    if (!turnoActivo) { alert("Inicie el turno de caja."); return; }
    if (!citaSeleccionada) return;

    try {
      const items = citaSeleccionada.estudios?.map(e => ({
        descripcion: e.estudio?.nombre || 'Estudio',
        nombre: e.estudio?.nombre || 'Estudio',
        estudio: e.estudio?._id || e.estudio,
        cantidad: 1,
        precio: e.precio || 0,
        precioUnitario: e.precio || 0,
        cobertura: e.cobertura || 0,
        subtotal: e.precio || 0
      })) || [];

      const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);
      const cobertura = items.reduce((sum, i) => sum + (i.cobertura || 0), 0);
      const total = subtotal - cobertura;

      await api.createFactura({
        paciente: citaSeleccionada.paciente?._id || citaSeleccionada.paciente,
        cita: citaSeleccionada._id,
        items, subtotal, cobertura, total,
        montoPagado: total, metodoPago: 'efectivo', estado: 'pagada'
      });

      setShowModalNueva(false);
      setCitaSeleccionada(null);
      fetchFacturas();
      fetchCitasPendientes();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const calcularTotalHoy = () => {
    if (!turnoActivo) return 0;
    const inicioTurno = new Date(turnoActivo.fechaInicio).getTime();
    return facturas
      .filter(f => {
        if (f.estado === 'anulada') return false;
        const fTime = new Date(f.fecha_factura || f.createdAt).getTime();
        return fTime >= inicioTurno;
      })
      .reduce((sum, f) => sum + (f.total || 0), 0);
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
      <FaSpinner className="spin" style={{ fontSize: 32, color: '#2563eb' }} />
      <p style={{ color: '#64748b', fontWeight: 500 }}>Sincronizando caja fiscal...</p>
    </div>
  );

  if (facturaImprimir) {
    return (
      <FacturaTermica
        factura={facturaImprimir.factura}
        paciente={facturaImprimir.paciente}
        estudios={facturaImprimir.estudios}
        onClose={() => setFacturaImprimir(null)}
      />
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Connection Error Banner ── */}
      {connectionError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
          padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10
        }}>
          <span className="material-icons-round" style={{ color: '#ef4444', marginTop: 2 }}>cloud_off</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>Problema de conexion con el servidor</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{connectionError}</p>
            <button
              onClick={() => { setConnectionError(null); fetchFacturas(); fetchTurnoActivo(); }}
              style={{
                marginTop: 6, fontSize: 12, fontWeight: 500, color: '#b91c1c', background: 'none',
                border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0
              }}
            >
              Reintentar conexion
            </button>
          </div>
        </div>
      )}
      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 44, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(37, 99, 235, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <FaFileInvoiceDollar size={20} />
            </div>
            Gestión Fiscal
          </h1>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 16, fontWeight: 500 }}>Control de ingresos y comprobantes autorizados</p>
        </div>
        <button
          onClick={() => setShowModalNueva(true)}
          style={{
            padding: '14px 24px', borderRadius: 10,
            background: '#2563eb', color: 'white',
            border: 'none', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
          }}
        >
          <FaPlus /> FACTURACIÓN RÁPIDA
        </button>
      </div>

      {/* ── Stat Tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 44 }}>
        <div style={{ background: 'white', padding: 28, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Caja de Hoy</div>
            <button onClick={turnoActivo ? cerrarTurnoManual : abrirTurnoManual} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {turnoActivo ? 'CERRAR CAJA' : 'ABRIR CAJA'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: '#0f172a' }}>RD$ {calcularTotalHoy().toLocaleString()}</h2>
            <span style={{ fontSize: 12, color: turnoActivo ? '#10b981' : '#ef4444', fontWeight: 800 }}>
              {turnoActivo ? 'ACTIVA' : 'CERRADA'}
            </span>
          </div>
        </div>

        <div style={{ background: 'white', padding: 28, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 16 }}>Operaciones del Mes</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: '#0f172a' }}>RD$ {facturas.reduce((sum, f) => sum + (f.total || 0), 0).toLocaleString()}</h2>
            <div style={{ color: '#2563eb' }}><FaChartLine size={20} /></div>
          </div>
        </div>
      </div>

      {/* ── Tabla de Historial ── */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Registros Emitidos</h2>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', outline: 'none', fontSize: 13 }}>
            <option value="">Estados: Todos</option>
            <option value="pagada">Pagadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['COMPROBANTE', 'FECHA', 'PACIENTE', 'TOTAL RD$', 'ESTADO', 'ACCIONES'].map(h => (
                  <th key={h} style={{ padding: '16px 24px', textAlign: h === 'TOTAL RD$' ? 'right' : 'left', color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Sin transacciones registradas</td></tr>
              ) : (
                facturas.map(f => (
                  <tr key={f._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.1s' }} className="hover-row">
                    <td style={{ padding: '20px 24px', color: '#2563eb', fontWeight: 700, fontSize: 13 }}>#{f.numero || f.numero_factura}</td>
                    <td style={{ padding: '20px 24px', color: '#64748b', fontSize: 14 }}>{new Date(f.fecha_factura || f.createdAt).toLocaleDateString('es-DO')}</td>
                    <td style={{ padding: '20px 24px', color: '#1e293b', fontWeight: 600, fontSize: 14 }}>{f.datosCliente?.nombre || f.paciente?.nombre || 'Paciente'}</td>
                    <td style={{ padding: '20px 24px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: 15 }}>${(f.total || 0).toLocaleString()}</td>
                    <td style={{ padding: '20px 24px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        background: f.estado === 'pagada' ? '#ecfdf5' : '#fef2f2',
                        color: f.estado === 'pagada' ? '#10b981' : '#ef4444'
                      }}>{f.estado}</span>
                    </td>
                    <td style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => verDetalle(f)} style={{ background: '#f1f5f9', border: 'none', color: '#1e293b', width: 32, height: 32, borderRadius: 6, cursor: 'pointer' }}><FaEye size={12} /></button>
                        <button onClick={() => imprimirFactura(f)} style={{ background: '#eff6ff', border: 'none', color: '#2563eb', width: 32, height: 32, borderRadius: 6, cursor: 'pointer' }}><FaPrint size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modales ── */}
      {facturaDetalle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 500, padding: 32, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800 }}>Comprobante #{facturaDetalle.numero || facturaDetalle.numero_factura}</h3>
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ color: '#64748b' }}>Subtotal</span><span>${(facturaDetalle.subtotal || 0).toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><span style={{ color: '#ef4444' }}>Cobertura</span><span style={{ color: '#ef4444' }}>-${(facturaDetalle.cobertura || 0).toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 15 }}>
                <span style={{ fontWeight: 800 }}>TOTAL PAGADO</span>
                <span style={{ fontWeight: 900, color: '#2563eb', fontSize: 22 }}>${(facturaDetalle.total || 0).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setFacturaDetalle(null); imprimirFactura(facturaDetalle); }} style={{ flex: 1, padding: 12, borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}>REIMPRIMIR</button>
              <button onClick={() => setFacturaDetalle(null)} style={{ padding: 12, borderRadius: 8, background: '#f1f5f9', border: 'none', color: '#1e293b', fontWeight: 700, cursor: 'pointer' }}>CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {showModalNueva && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 500, padding: 32, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 800 }}>Admisiones Pendientes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 350, overflowY: 'auto', marginBottom: 24 }}>
              {citasPendientes.map(cita => (
                <div key={cita._id} onClick={() => setCitaSeleccionada(cita)} style={{
                  padding: 16, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${citaSeleccionada?._id === cita._id ? '#2563eb' : '#f1f5f9'}`,
                  background: citaSeleccionada?._id === cita._id ? '#eff6ff' : 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14 }}>{cita.paciente?.nombre} {cita.paciente?.apellido}</strong>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>${cita.total?.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>ESTUDIOS: {cita.estudios?.length || 0}</div>
                </div>
              ))}
              {citasPendientes.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>No hay registros por cobrar</p>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={crearFactura} disabled={!citaSeleccionada} style={{ flex: 1, padding: 14, borderRadius: 8, background: '#2563eb', color: 'white', border: 'none', fontWeight: 700, cursor: citaSeleccionada ? 'pointer' : 'not-allowed', opacity: citaSeleccionada ? 1 : 0.5 }}>COBRAR SERVICIOS</button>
              <button onClick={() => setShowModalNueva(false)} style={{ padding: 14, borderRadius: 8, background: '#f1f5f9', border: 'none', color: '#1e293b', fontWeight: 700, cursor: 'pointer' }}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Facturas;
