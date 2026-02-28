import React, { useState, useEffect } from 'react';
import { FaUserPlus, FaSearch, FaTrash, FaSpinner, FaCheck, FaPrint, FaArrowRight, FaArrowLeft, FaIdCard, FaStethoscope, FaWallet } from 'react-icons/fa';
import api from '../services/api';
import FacturaTermica from './FacturaTermica';

const RegistroInteligente = () => {
  const [paso, setPaso] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [estudios, setEstudios] = useState([]);
  const [estudiosSeleccionados, setEstudiosSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [facturaGenerada, setFacturaGenerada] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descuento, setDescuento] = useState(0);
  const [montoPagado, setMontoPagado] = useState(0);
  const [mostrarFactura, setMostrarFactura] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [nuevoPaciente, setNuevoPaciente] = useState({
    nombre: '', apellido: '', cedula: '', esMenor: false,
    telefono: '', email: '', fechaNacimiento: '', sexo: 'M',
    nacionalidad: 'Dominicano', tipoSangre: '', seguroNombre: '', seguroNumeroAfiliado: ''
  });

  useEffect(() => { fetchEstudios(); }, []);

  const fetchEstudios = async () => {
    try {
      const response = await api.getEstudios();
      setEstudios(Array.isArray(response) ? response : []);
    } catch (err) { setEstudios([]); }
  };

  const buscarPaciente = async () => {
    if (!busqueda.trim()) return;
    try {
      setLoading(true);
      const response = await api.getPacientes({ search: busqueda });
      setPacientes(Array.isArray(response) ? response : []);
    } catch (err) { setPacientes([]); } finally { setLoading(false); }
  };

  const seleccionarPacienteExistente = (paciente) => {
    setPacienteSeleccionado(paciente);
    setPaso(2);
  };

  const crearPaciente = async () => {
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellido || (!nuevoPaciente.esMenor && !nuevoPaciente.cedula) || !nuevoPaciente.telefono || !nuevoPaciente.fechaNacimiento) {
      alert('Complete los campos obligatorios (*)');
      return;
    }
    try {
      setLoading(true);
      const pacienteData = {
        nombre: nuevoPaciente.nombre,
        apellido: nuevoPaciente.apellido,
        cedula: nuevoPaciente.cedula,
        esMenor: nuevoPaciente.esMenor,
        telefono: nuevoPaciente.telefono,
        email: nuevoPaciente.email,
        fechaNacimiento: nuevoPaciente.fechaNacimiento,
        sexo: nuevoPaciente.sexo,
        nacionalidad: nuevoPaciente.nacionalidad,
        tipoSangre: nuevoPaciente.tipoSangre,
        seguro: {
          nombre: nuevoPaciente.seguroNombre || '',
          numeroAfiliado: nuevoPaciente.seguroNumeroAfiliado || '',
          tipo: nuevoPaciente.seguroNombre ? 'ARS' : ''
        }
      };
      const response = await api.createPaciente(pacienteData);
      setPacienteSeleccionado(response.data || response);
      setPaso(2);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.mensaje || err.message));
    } finally { setLoading(false); }
  };

  const agregarEstudio = (estudio) => {
    if (!estudiosSeleccionados.find(e => (e._id || e.id) === (estudio._id || estudio.id))) {
      setEstudiosSeleccionados([...estudiosSeleccionados, { ...estudio, cantidad: 1, cobertura: 0 }]);
    }
  };

  const quitarEstudio = (id) => {
    setEstudiosSeleccionados(estudiosSeleccionados.filter(e => (e._id || e.id) !== id));
  };

  const actualizarCobertura = (id, cobertura) => {
    setEstudiosSeleccionados(estudiosSeleccionados.map(e =>
      (e._id || e.id) === id ? { ...e, cobertura: parseFloat(cobertura) || 0 } : e
    ));
  };

  const calcularSubtotal = () => estudiosSeleccionados.reduce((sum, e) => sum + ((e.precio || 0) * (e.cantidad || 1)), 0);
  const calcularCobertura = () => estudiosSeleccionados.reduce((sum, e) => sum + (e.cobertura || 0), 0);
  const calcularTotal = () => Math.max(0, calcularSubtotal() - calcularCobertura() - descuento);
  const finalizarRegistro = async () => {
    if (estudiosSeleccionados.length === 0) { alert('Agregue al menos un estudio'); return; }
    try {
      setLoading(true);
      const ahora = new Date();
      const citaData = {
        paciente: pacienteSeleccionado._id || pacienteSeleccionado.id,
        fecha: ahora.toISOString().split('T')[0],
        horaInicio: ahora.toTimeString().split(' ')[0].substring(0, 5),
        estudios: estudiosSeleccionados.map(e => ({ estudio: e._id || e.id, precio: e.precio || 0, descuento: e.cobertura || 0 })),
        subtotal: calcularSubtotal(),
        descuentoTotal: calcularCobertura() + descuento,
        total: calcularTotal(),
        metodoPago: metodoPago,
        pagado: montoPagado >= calcularTotal(),
        estado: 'completada'
      };
      const citaRes = await api.createCita(citaData);
      const cita = citaRes.orden || citaRes.data || citaRes;

      const facturaData = {
        paciente: pacienteSeleccionado._id || pacienteSeleccionado.id,
        cita: cita._id || cita.id,
        items: estudiosSeleccionados.map(e => ({ descripcion: e.nombre, estudio: e._id || e.id, cantidad: 1, precioUnitario: e.precio || 0, descuento: e.cobertura || 0, subtotal: (e.precio || 0) - (e.cobertura || 0) })),
        subtotal: calcularSubtotal(),
        descuento: descuento, total: calcularTotal(),
        montoPagado: montoPagado, metodoPago,
        estado: montoPagado >= calcularTotal() ? 'pagada' : 'emitida',
        datosCliente: { nombre: `${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellido}`, cedula: pacienteSeleccionado.cedula || '', telefono: pacienteSeleccionado.telefono || '' }
      };
      const factRes = await api.createFactura(facturaData);
      setFacturaGenerada({ ...factRes.data || factRes, montoPagado });
      setMostrarFactura(true);
    } catch (err) {
      alert('Error: ' + (err.response?.data?.mensaje || err.message));
    } finally { setLoading(false); }
  };

  const reiniciar = () => {
    setPaso(1); setBusqueda(''); setPacientes([]); setPacienteSeleccionado(null); setEstudiosSeleccionados([]);
    setFacturaGenerada(null); setMostrarFactura(false); setDescuento(0); setMontoPagado(0);
    setNuevoPaciente({ nombre: '', apellido: '', cedula: '', telefono: '', email: '', fechaNacimiento: '', sexo: 'M', nacionalidad: 'Dominicano', tipoSangre: '', seguroNombre: '', seguroNumeroAfiliado: '' });
  };

  if (mostrarFactura && facturaGenerada) return (
    <FacturaTermica factura={facturaGenerada} paciente={pacienteSeleccionado} estudios={estudiosSeleccionados} onClose={reiniciar} />
  );

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        .clinical-step { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .clinical-input { background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; color: #1e293b; width: 100%; outline: none; transition: all 0.2s; font-size: 14px; }
        .clinical-input:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08); }
        .clinical-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
      `}</style>

      {/* ── Encabezado ── */}
      <div style={{ marginBottom: 44 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'var(--color-dark)', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(37, 99, 235, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <FaUserPlus size={20} />
          </div>
          Registro de Paciente
        </h1>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 16, fontWeight: 500 }}>Gestión integrada de admisiones y servicios médicos</p>
      </div>

      {/* ── Stepper ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 44 }}>
        {[
          { step: 1, label: 'Identificación', icon: <FaIdCard /> },
          { step: 2, label: 'Servicios Médicos', icon: <FaStethoscope /> },
          { step: 3, label: 'Liquidación', icon: <FaWallet /> }
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '16px 20px', borderRadius: 10,
            background: paso === s.step ? '#eff6ff' : 'white',
            border: `1px solid ${paso === s.step ? '#bfdbfe' : '#e2e8f0'}`,
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: paso === s.step ? '0 4px 6px -1px rgba(37, 99, 235, 0.1)' : 'none'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, background: paso >= s.step ? '#2563eb' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: paso >= s.step ? 'white' : '#94a3b8', fontSize: 13
            }}>
              {paso > s.step ? <FaCheck /> : s.icon}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>PASO 0{s.step}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: paso >= s.step ? '#1e293b' : '#94a3b8' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PASO 1: PACIENTE ── */}
      {paso === 1 && (
        <div className="clinical-step" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 24px', color: 'var(--color-dark)', fontSize: 18, fontWeight: 800 }}>Búsqueda de Paciente</h3>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <input className="clinical-input" placeholder="Nombre completo o cédula"
                value={busqueda} onChange={e => setBusqueda(e.target.value)} onKeyPress={e => e.key === 'Enter' && buscarPaciente()} />
              <button onClick={buscarPaciente} style={{ width: 48, background: '#2563eb', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loading ? <FaSpinner className="spin" /> : <FaSearch />}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 350, overflowY: 'auto' }}>
              {pacientes.map(p => (
                <div key={p._id || p.id} onClick={() => seleccionarPacienteExistente(p)} style={{
                  padding: 16, borderRadius: 8, border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s'
                }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#1e293b', fontSize: 14 }}>{p.nombre} {p.apellido}</strong>
                    <FaArrowRight style={{ color: '#2563eb', fontSize: 12 }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{p.cedula} · {p.telefono}</div>
                </div>
              ))}
              {pacientes.length === 0 && !loading && busqueda && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 20 }}>No se encontraron pacientes</p>}
            </div>
          </div>

          <div style={{ background: 'white', padding: 32, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow)' }}>
            <h3 style={{ margin: '0 0 24px', color: 'var(--color-dark)', fontSize: 18, fontWeight: 800 }}>Nuevo Ingreso</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div><label className="clinical-label">Nombre *</label><input className="clinical-input" value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, nombre: e.target.value })} /></div>
              <div><label className="clinical-label">Apellido *</label><input className="clinical-input" value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente({ ...nuevoPaciente, apellido: e.target.value })} /></div>
              <div style={{ gridColumn: 'span 2' }}><label className="clinical-label">Cédula / ID *</label><input className="clinical-input" placeholder="000-0000000-0" value={nuevoPaciente.cedula} onChange={e => setNuevoPaciente({ ...nuevoPaciente, cedula: e.target.value })} /></div>
              <div><label className="clinical-label">Teléfono *</label><input className="clinical-input" placeholder="809-000-0000" value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })} /></div>
              <div><label className="clinical-label">F. Nacimiento</label><input type="date" className="clinical-input" value={nuevoPaciente.fechaNacimiento} onChange={e => setNuevoPaciente({ ...nuevoPaciente, fechaNacimiento: e.target.value })} /></div>
            </div>
            <button onClick={crearPaciente} style={{ width: '100%', marginTop: 28, padding: 16, background: '#2563eb', border: 'none', borderRadius: 10, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>CONTINUAR <FaArrowRight style={{ marginLeft: 8 }} /></button>
          </div>
        </div>
      )}

      {/* ── PASO 2: ESTUDIOS ── */}
      {paso === 2 && (
        <div className="clinical-step" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          <div style={{ background: 'white', padding: 32, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ margin: 0, color: 'var(--color-dark)', fontSize: 18, fontWeight: 800 }}>Catálogo de Servicios</h3>
              <input className="clinical-input" placeholder="Buscar estudio..." value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ width: 240 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12, maxHeight: 550, overflowY: 'auto', padding: '2px' }}>
              {estudios.filter(e => (e.nombre || '').toLowerCase().includes(filtroCategoria.toLowerCase())).map(e => (
                <div key={e._id || e.id} onClick={() => agregarEstudio(e)} style={{
                  padding: 16, borderRadius: 10, background: '#f8fafc', border: '1.5px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
                }} onMouseEnter={ev => { ev.currentTarget.style.borderColor = '#2563eb'; ev.currentTarget.style.background = '#eff6ff'; }}>
                  <div>
                    <div style={{ color: '#1e293b', fontWeight: 700, fontSize: 13 }}>{e.nombre}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>ID: {e.codigo || 'N/A'}</div>
                  </div>
                  <div style={{ color: '#2563eb', fontWeight: 800, fontSize: 14 }}>${(e.precio || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-lg)', height: 'fit-content', position: 'sticky', top: 20 }}>
            <h4 style={{ color: '#1e293b', margin: '0 0 20px', fontSize: 15, fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>Resumen de Orden</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, maxHeight: 300, overflowY: 'auto' }}>
              {estudiosSeleccionados.map(e => (
                <div key={e._id || e.id} style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#1e293b', fontWeight: 700, fontSize: 12 }}>{e.nombre}</span>
                    <button onClick={() => quitarEstudio(e._id || e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><FaTrash size={11} /></button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: 11 }}>RD$ {e.precio}</span>
                    <input className="clinical-input" type="number" placeholder="Cobertura" value={e.cobertura} onChange={ev => actualizarCobertura(e._id || e.id, ev.target.value)} style={{ width: 80, padding: '4px 8px', fontSize: 11 }} />
                  </div>
                </div>
              ))}
              {estudiosSeleccionados.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Seleccione estudios a realizar</p>}
            </div>
            <div style={{ borderTop: '2px solid #f8fafc', paddingTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'baseline' }}>
                <span style={{ color: '#64748b', fontWeight: 600, fontSize: 13 }}>Total Neto</span>
                <span style={{ color: '#1e293b', fontSize: 26, fontWeight: 800 }}>${calcularTotal().toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPaso(1)} style={{ padding: '12px 16px', borderRadius: 8, background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer' }}><FaArrowLeft /></button>
                <button onClick={() => setPaso(3)} disabled={estudiosSeleccionados.length === 0} style={{ flex: 1, padding: '12px', borderRadius: 8, background: '#2563eb', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer' }}>CONTINUAR <FaArrowRight style={{ marginLeft: 6 }} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3: PAGO ── */}
      {paso === 3 && (
        <div className="clinical-step" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ background: 'white', padding: 48, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 32px', color: '#0f172a', textAlign: 'center', fontSize: 22, fontWeight: 800 }}>Liquidación de Servicios</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 32 }}>
              <div style={{ background: '#f8fafc', padding: 32, borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><span style={{ color: '#64748b' }}>Subtotal</span><span style={{ color: '#1e293b', fontWeight: 600 }}>${calcularSubtotal().toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}><span style={{ color: '#ef4444' }}>Cobertura Seguro</span><span style={{ color: '#ef4444', fontWeight: 600 }}>-${(calcularCobertura() + descuento).toLocaleString()}</span></div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 18 }}>TOTAL A PAGAR</span>
                  <span style={{ fontSize: 32, fontWeight: 900, color: '#2563eb' }}>${calcularTotal().toLocaleString()}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div><label className="clinical-label">F. Pago</label><select className="clinical-input" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}><option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option></select></div>
                <div><label className="clinical-label">Recibido</label><input type="number" className="clinical-input" value={montoPagado} onChange={e => setMontoPagado(parseFloat(e.target.value) || 0)} style={{ fontWeight: 800 }} /></div>
              </div>

              <button onClick={finalizarRegistro} disabled={loading} style={{ width: '100%', padding: 18, background: '#2563eb', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)' }}>
                {loading ? <FaSpinner className="spin" /> : <><FaPrint /> PROCESAR Y EMITIR TICKET</>}
              </button>
              <button onClick={() => setPaso(2)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>VOLVER AL DETALLE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroInteligente;
