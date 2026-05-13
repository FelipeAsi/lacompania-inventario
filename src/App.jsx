import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
// Reemplaza con tus valores de Supabase → Project Settings → API
const SUPABASE_URL  = "https://hvkswkpuphhiskxqrrke.supabase.co/rest/v1/";
const SUPABASE_ANON = "sb_publishable__5xZzZslfmIu9I-jcmAuXA_D_Uv-0y6";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const TURNOS      = ["Mañana", "Tarde"];
const TIPOS_MERMA_POR = ["Vencimiento", "Cocción fallida", "Devuelto", "Comida personal"];
const fmt = (n) => new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 }).format(n);
const hoy = () => new Date().toISOString().split("T")[0];

// ─── CREDENCIALES (Supabase Auth) ─────────────────────────────────────────────
// Estas cuentas deben crearse en Supabase → Authentication → Users
// admin@lacompania.cl   / admin123   → user_metadata: { rol: "admin",   nombre: "Administrador"   }
// cocina@lacompania.cl  / cocina123  → user_metadata: { rol: "usuario",  nombre: "Usuario Cocina"  }

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [u,setU]=useState(""); const [p,setP]=useState("");
  const [err,setErr]=useState(""); const [show,setShow]=useState(false);
  const [cargando,setCargando]=useState(false);

  const go = async () => {
    if (!u||!p) return;
    setCargando(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: u.trim(), password: p });
    setCargando(false);
    if (error) { setErr("Usuario o contraseña incorrectos."); setTimeout(()=>setErr(""),3000); return; }
    const meta = data.user.user_metadata;
    onLogin({ uid: data.user.id, email: data.user.email, rol: meta.rol||"usuario", nombre: meta.nombre||data.user.email });
  };

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'IBM Plex Mono',monospace"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0}.inp{background:#0a0a0f;border:1px solid #2a2018;color:#e8e0d4;font-family:'IBM Plex Mono',monospace;font-size:13px;padding:10px 14px;width:100%;outline:none;transition:border-color .2s}.inp:focus{border-color:#c8833a}.lbl{font-size:10px;letter-spacing:2px;color:#6a5a4a;text-transform:uppercase;display:block;margin-bottom:6px}`}</style>
      <div style={{width:360,padding:40,background:"#0d0b09",border:"1px solid #2a2018"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:5,color:"#c8833a"}}>LA COMPAÑIA</div>
          <div style={{fontSize:10,letterSpacing:3,color:"#3a2a1a",textTransform:"uppercase",marginTop:4}}>Control de Inventario</div>
        </div>
        <div style={{display:"grid",gap:16}}>
          <div><label className="lbl">Email</label><input className="inp" value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="usuario@lacompania.cl" autoComplete="off"/></div>
          <div><label className="lbl">Contraseña</label>
            <div style={{position:"relative"}}>
              <input className="inp" type={show?"text":"password"} value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="••••••••"/>
              <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6a5a4a",cursor:"pointer",fontSize:11}}>{show?"ocultar":"ver"}</button>
            </div>
          </div>
          {err&&<div style={{background:"#2a0a0a",border:"1px solid #ef444440",color:"#ef9999",padding:"8px 12px",fontSize:11}}>⚠ {err}</div>}
          <button onClick={go} disabled={cargando} style={{background:cargando?"#5a4020":"#c8833a",color:"#0a0a0f",border:"none",padding:12,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,letterSpacing:2,fontWeight:600,textTransform:"uppercase",cursor:cargando?"not-allowed":"pointer",marginTop:4}}>
            {cargando?"Ingresando...":"Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sesion,setSesion]=useState(null);
  const [iniciando,setIniciando]=useState(true);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if (data.session) {
        const meta=data.session.user.user_metadata;
        setSesion({uid:data.session.user.id,email:data.session.user.email,rol:meta.rol||"usuario",nombre:meta.nombre||data.session.user.email});
      }
      setIniciando(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      if (!session) setSesion(null);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const logout = async () => { await supabase.auth.signOut(); setSesion(null); };

  if (iniciando) return <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",color:"#4a3a2a",fontFamily:"monospace",fontSize:12,letterSpacing:2}}>CARGANDO...</div>;
  if (!sesion) return <Login onLogin={setSesion}/>;
  return <Sistema sesion={sesion} onLogout={logout}/>;
}

// ─── HOOK SUPABASE ────────────────────────────────────────────────────────────
function useQuery(tabla, orderBy="nombre") {
  const [data,setData]=useState([]);
  const [cargando,setCargando]=useState(true);

  const cargar = useCallback(async()=>{
    setCargando(true);
    const q = supabase.from(tabla).select("*");
    if (orderBy) q.order(orderBy,{ascending:true});
    const {data:rows}=await q;
    setData(rows||[]);
    setCargando(false);
  },[tabla,orderBy]);

  useEffect(()=>{cargar();},[cargar]);
  return {data,cargando,recargar:cargar};
}

// ─── SISTEMA ──────────────────────────────────────────────────────────────────
function Sistema({ sesion, onLogout }) {
  const esAdmin = sesion.rol==="admin";

  const {data:mp,        recargar:reMP}   = useQuery("productos","nombre");
  const {data:porción,   recargar:rePor}  = useQuery("porciones","nombre");
  const {data:movMP,     recargar:reMMP}  = useQuery("movimientos_mp","created_at");
  const {data:movPor,    recargar:reMPor} = useQuery("movimientos_por","created_at");
  const {data:responsables, recargar:reResp} = useQuery("responsables","nombre");
  const {data:catMP,     recargar:reCatMP}  = useQuery("categorias_mp","nombre");
  const {data:catPor,    recargar:reCatPor} = useQuery("categorias_por","nombre");

  const [vista,setVista]=useState(esAdmin?"movimientos":"mp");
  const [alerta,setAlerta]=useState(null);
  const [guardando,setGuardando]=useState(false);
  const [stockMenu,setStockMenu]=useState(false);

  // Modales
  const [modalMP,setModalMP]=useState(false);
  const [modalPor,setModalPor]=useState(false);
  const [modalEditMP,setModalEditMP]=useState(null);
  const [modalEditPor,setModalEditPor]=useState(null);
  const [modalNewMP,setModalNewMP]=useState(false);
  const [modalNewPor,setModalNewPor]=useState(false);
  const [modalResp,setModalResp]=useState(false);
  const [editRespId,setEditRespId]=useState(null);
  const [editRespVal,setEditRespVal]=useState("");
  const [nuevoResp,setNuevoResp]=useState("");
  const [nuevaCatMP,setNuevaCatMP]=useState("");
  const [nuevaCatPor,setNuevaCatPor]=useState("");
  const [informe,setInforme]=useState("resumen");
  const [ifDesde,setIfDesde]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().split("T")[0]);
  const [ifHasta,setIfHasta]=useState(hoy());
  const [ifStock,setIfStock]=useState("todos");

  const emptyFMP  = {tipo:"entrada",nombre:"",cantidad:"",turno:"Mañana",responsable:"",motivo:"",fecha:hoy()};
  const emptyFPor = {tipo:"proceso",nombre:"",cantidad:"",turno:"Mañana",responsable:"",mpUsada:"",cantMP:"",rendimiento:"",mermaKg:"",motivoMerma:"",motivo:"",fecha:hoy()};
  const emptyPMP  = {nombre:"",categoria:"",unidad:"kg",stock:"",minimo:"",precio:""};
  const emptyPPor = {nombre:"",categoria:"",unidad:"unid",stock:"",minimo:"",costoUnit:"",mpOrigen:""};

  const [fMP,setFMP]=useState(emptyFMP);
  const [fPor,setFPor]=useState(emptyFPor);
  const [pMP,setPMP]=useState(emptyPMP);
  const [pPor,setPPor]=useState(emptyPPor);

  const mostrar=(msg,tipo="ok")=>{setAlerta({tipo,msg});setTimeout(()=>setAlerta(null),4000);};

  // Computed
  const stockBajoMP  = mp.filter(p=>p.stock<=p.minimo);
  const stockBajoPor = porción.filter(p=>p.stock<=p.minimo);

  // ── Registrar mov Producto ──────────────────────────────────────────────────
  const registrarMovMP = async () => {
    if (!fMP.nombre||!fMP.cantidad||!fMP.responsable){mostrar("Completa todos los campos obligatorios.","error");return;}
    setGuardando(true);
    const prod = mp.find(p=>p.nombre===fMP.nombre);
    const cant = parseFloat(fMP.cantidad);
    const nuevoStock = fMP.tipo==="entrada" ? prod.stock+cant : Math.max(0,prod.stock-cant);

    await supabase.from("movimientos_mp").insert({
      fecha:fMP.fecha, tipo:fMP.tipo, nombre:fMP.nombre,
      cantidad:cant, unidad:prod.unidad, turno:fMP.turno,
      responsable:fMP.responsable, motivo:fMP.motivo,
      valor:cant*(prod.precio||0)
    });
    await supabase.from("productos").update({stock:nuevoStock}).eq("nombre",fMP.nombre);
    await Promise.all([reMP(),reMMP()]);
    mostrar("Movimiento de producto registrado.");
    setFMP(emptyFMP); setModalMP(false);
    setGuardando(false);
  };

  // ── Registrar mov Porción ───────────────────────────────────────────────────
  const registrarMovPor = async () => {
    if (!fPor.nombre||!fPor.cantidad||!fPor.responsable){mostrar("Completa todos los campos obligatorios.","error");return;}
    setGuardando(true);
    const por  = porción.find(p=>p.nombre===fPor.nombre);
    const cant = parseFloat(fPor.cantidad);
    const mermaKg = parseFloat(fPor.mermaKg)||0;

    if (fPor.tipo==="proceso") {
      if (!fPor.mpUsada||!fPor.cantMP){mostrar("Indica el producto utilizado y su cantidad.","error");setGuardando(false);return;}
      const cantMPn = parseFloat(fPor.cantMP);
      const mpP = mp.find(p=>p.nombre===fPor.mpUsada);
      if (!mpP||mpP.stock<cantMPn){mostrar(`Stock insuficiente de ${fPor.mpUsada}.`,"error");setGuardando(false);return;}

      // Descontar MP
      await supabase.from("productos").update({stock:Math.max(0,mpP.stock-cantMPn)}).eq("nombre",fPor.mpUsada);
      // Sumar porciones
      await supabase.from("porciones").update({stock:por.stock+cant}).eq("nombre",fPor.nombre);
      // Mov proceso
      await supabase.from("movimientos_por").insert({
        fecha:fPor.fecha, tipo:"proceso", nombre:fPor.nombre,
        cantidad:cant, unidad:por.unidad, turno:fPor.turno,
        responsable:fPor.responsable, mp_usada:fPor.mpUsada,
        cant_mp:cantMPn, rendimiento:fPor.rendimiento,
        valor:cant*(por.costo_unit||0)
      });
      // Merma si aplica
      if (mermaKg>0) {
        await supabase.from("movimientos_por").insert({
          fecha:fPor.fecha, tipo:"merma", nombre:fPor.mpUsada,
          cantidad:mermaKg, unidad:mpP.unidad, turno:fPor.turno,
          responsable:fPor.responsable, motivo:fPor.motivoMerma||"Merma de proceso",
          valor:mermaKg*(mpP.precio||0)
        });
      }
      mostrar(`Proceso registrado: ${cant} porciones${mermaKg>0?` + ${mermaKg} ${mpP.unidad} merma`:""}.`);
    } else {
      await supabase.from("porciones").update({stock:Math.max(0,por.stock-cant)}).eq("nombre",fPor.nombre);
      await supabase.from("movimientos_por").insert({
        fecha:fPor.fecha, tipo:fPor.tipo, nombre:fPor.nombre,
        cantidad:cant, unidad:por.unidad, turno:fPor.turno,
        responsable:fPor.responsable, motivo:fPor.motivo||"",
        valor:cant*(por.costo_unit||0)
      });
      mostrar("Movimiento de porción registrado.");
    }
    await Promise.all([reMP(),rePor(),reMPor()]);
    setFPor(emptyFPor); setModalPor(false);
    setGuardando(false);
  };

  // ── CRUD Producto ───────────────────────────────────────────────────────────
  const guardarProdMP = async (esEditar) => {
    if (!pMP.nombre||!pMP.precio){mostrar("Nombre y precio son obligatorios.","error");return;}
    setGuardando(true);
    if (esEditar) {
      await supabase.from("productos").update({categoria:pMP.categoria,unidad:pMP.unidad,stock:parseFloat(pMP.stock||0),minimo:parseFloat(pMP.minimo||0),precio:parseFloat(pMP.precio)}).eq("id",esEditar);
      mostrar("Producto actualizado."); setModalEditMP(null);
    } else {
      await supabase.from("productos").insert({nombre:pMP.nombre,categoria:pMP.categoria,unidad:pMP.unidad,stock:parseFloat(pMP.stock||0),minimo:parseFloat(pMP.minimo||0),precio:parseFloat(pMP.precio)});
      mostrar("Producto agregado."); setModalNewMP(false);
    }
    await reMP(); setGuardando(false);
  };

  // ── CRUD Porción ────────────────────────────────────────────────────────────
  const guardarProdPor = async (esEditar) => {
    if (!pPor.nombre||!pPor.costoUnit){mostrar("Nombre y costo son obligatorios.","error");return;}
    setGuardando(true);
    if (esEditar) {
      await supabase.from("porciones").update({categoria:pPor.categoria,unidad:pPor.unidad,stock:parseFloat(pPor.stock||0),minimo:parseFloat(pPor.minimo||0),costo_unit:parseFloat(pPor.costoUnit),mp_origen:pPor.mpOrigen||""}).eq("id",esEditar);
      mostrar("Porción actualizada."); setModalEditPor(null);
    } else {
      await supabase.from("porciones").insert({nombre:pPor.nombre,categoria:pPor.categoria,unidad:pPor.unidad,stock:parseFloat(pPor.stock||0),minimo:parseFloat(pPor.minimo||0),costo_unit:parseFloat(pPor.costoUnit),mp_origen:pPor.mpOrigen||""});
      mostrar("Porción agregada."); setModalNewPor(false);
    }
    await rePor(); setGuardando(false);
  };

  const tabs = esAdmin
    ?[["movimientos","Movimientos"],["mp","Producto"],["porciones","Porción"],["responsables","Responsables"],["categorias","Categorías"],["informes","Informes"]]
    :[["mp","Producto"],["porciones","Porción"]];

  const tcMP  = {entrada:"#22c55e",salida:"#3b82f6",merma:"#ef4444"};
  const tcPor = {proceso:"#a78bfa",venta:"#3b82f6",merma:"#ef4444"};

  return (
    <div style={{minHeight:"100vh",background:"#0a0a0f",color:"#e8e0d4",fontFamily:"'IBM Plex Mono',monospace"}} onClick={()=>stockMenu&&setStockMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0a0f}::-webkit-scrollbar-thumb{background:#3a2a1a;border-radius:2px}
        .tab{cursor:pointer;padding:8px 15px;border:1px solid #2a2018;background:transparent;color:#8a7a6a;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:2px;transition:all .2s;text-transform:uppercase}
        .tab:hover{background:#1a140e;color:#e8e0d4}
        .tab.act-mp{background:#c8833a;border-color:#c8833a;color:#0a0a0f;font-weight:600}
        .tab.act-por{background:#7c3aed;border-color:#7c3aed;color:#fff;font-weight:600}
        .card{background:#12100e;border:1px solid #2a2018;padding:20px}
        .btn{cursor:pointer;border:none;font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:2px;padding:10px 18px;text-transform:uppercase;transition:all .2s}
        .bmp{background:#c8833a;color:#0a0a0f;font-weight:600}.bmp:hover{background:#e09040}
        .bpor{background:#7c3aed;color:#fff;font-weight:600}.bpor:hover{background:#6d28d9}
        .bgh{background:transparent;border:1px solid #3a2a1a;color:#8a7a6a}.bgh:hover{border-color:#c8833a;color:#c8833a}
        .inp{background:#0a0a0f;border:1px solid #2a2018;color:#e8e0d4;font-family:'IBM Plex Mono',monospace;font-size:12px;padding:8px 12px;width:100%;outline:none;transition:border-color .2s}
        .inp:focus{border-color:#c8833a} select.inp option{background:#12100e}
        .badge{display:inline-block;padding:2px 8px;font-size:10px;letter-spacing:1.5px;font-weight:600;text-transform:uppercase}
        .rh:hover{background:#1a140e!important}
        .sv{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:2px;line-height:1}
        .alerta{position:fixed;bottom:24px;right:24px;padding:14px 22px;font-size:12px;letter-spacing:1px;z-index:999;animation:fi .3s}
        @keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .mbg{position:fixed;inset:0;background:#000000cc;z-index:100;display:flex;align-items:center;justify-content:center}
        .modal{background:#12100e;border:1px solid #3a2a1a;padding:28px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto}
        .lbl{font-size:10px;letter-spacing:2px;color:#8a7a6a;text-transform:uppercase;display:block;margin-bottom:5px}
        .div{border:none;border-top:1px solid #1a140e;margin:16px 0}
        .ppro{background:#3a1a0080;border:1px solid #c8833a40;color:#c8833a;padding:2px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;display:inline-block}
        .ppor{background:#2d1a5080;border:1px solid #a78bfa40;color:#a78bfa;padding:2px 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;display:inline-block}
        th{padding:10px 12px;text-align:left;font-size:9px;letter-spacing:2px;color:#6a5a4a;font-weight:600;text-transform:uppercase}
        td{padding:8px 12px}
        .spin{display:inline-block;animation:spin 1s linear infinite}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* HEADER */}
      <div style={{borderBottom:"1px solid #2a2018",padding:"13px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d0b09"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:12}}>
          <span style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:4,color:"#c8833a"}}>LA COMPAÑIA</span>
          <span style={{fontSize:9,letterSpacing:3,color:"#4a3a2a",textTransform:"uppercase"}}>Control de Inventario</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {guardando&&<span style={{fontSize:10,color:"#6a5a4a",letterSpacing:1}}>Guardando<span className="spin"> ◌</span></span>}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:"#e8e0d4"}}>{sesion.nombre}</div>
            <div style={{fontSize:9,letterSpacing:2,color:esAdmin?"#c8833a":"#6a8a6a",textTransform:"uppercase"}}>{esAdmin?"● Admin":"● Usuario"}</div>
          </div>
          <button className="btn bgh" style={{padding:"6px 12px",fontSize:10}} onClick={onLogout}>Salir</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{padding:"14px 24px 0",display:"flex",gap:3,borderBottom:"1px solid #1a140e",flexWrap:"wrap",alignItems:"center"}}>
        {tabs.map(([k,v])=>{
          const active=vista===k;
          const cls=active?(k==="porciones"?"tab act-por":"tab act-mp"):"tab";
          return <button key={k} className={cls} onClick={()=>setVista(k)}>{v}</button>;
        })}
        <div style={{flex:1}}/>
        <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
          <button className="btn bmp" style={{padding:"7px 16px",fontSize:10,display:"flex",alignItems:"center",gap:8}} onClick={()=>setStockMenu(v=>!v)}>
            + Stock <span style={{fontSize:9,opacity:0.7,display:"inline-block",transform:stockMenu?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}>▼</span>
          </button>
          {stockMenu&&(
            <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",background:"#12100e",border:"1px solid #2a2018",zIndex:50,minWidth:170,boxShadow:"0 8px 24px #00000080"}}>
              <button onClick={()=>{setFMP(emptyFMP);setModalMP(true);setStockMenu(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 16px",background:"transparent",border:"none",borderBottom:"1px solid #1a140e",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#e8e0d4",textAlign:"left"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1a140e"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span className="ppro" style={{fontSize:8}}>PRO</span> Producto
              </button>
              <button onClick={()=>{setFPor(emptyFPor);setModalPor(true);setStockMenu(false);}} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"11px 16px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,color:"#e8e0d4",textAlign:"left"}}
                onMouseEnter={e=>e.currentTarget.style.background="#1a140e"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <span className="ppor" style={{fontSize:8}}>POR</span> Porción
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:"22px 24px"}}>

        {/* ═══ PRODUCTO */}
        {vista==="mp"&&(
          <div>
            {stockBajoMP.length>0&&<div style={{background:"#2a0a0a",border:"1px solid #ef444440",padding:"10px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}><span style={{color:"#ef4444"}}>⚠</span><span style={{fontSize:11,color:"#ef9999",letterSpacing:1}}>STOCK BAJO MÍNIMO: {stockBajoMP.map(s=>s.nombre).join(", ")}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span className="ppro">PRO</span><span style={{fontSize:10,color:"#6a5a4a",letterSpacing:1}}>{mp.length} productos</span></div>
              {esAdmin&&<button className="btn bmp" style={{padding:"6px 14px",fontSize:10}} onClick={()=>{setPMP({...emptyPMP,categoria:catMP[0]?.nombre||""});setModalNewMP(true);}}>+ Nuevo Producto</button>}
            </div>
            <div className="card" style={{padding:0,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{borderBottom:"1px solid #2a2018"}}>{["Nombre","Categoría","Stock","Mín.","Unidad",...(esAdmin?["Precio","Valor"]:[]),"Estado",...(esAdmin?[""]:[])].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>{[...mp].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map((p,i)=>{
                  const bajo=p.stock<=p.minimo;
                  return <tr key={p.id} className="rh" style={{background:i%2===0?"transparent":"#0d0b09",borderBottom:"1px solid #14120f"}}>
                    <td style={{fontWeight:500}}>{p.nombre}</td>
                    <td style={{color:"#6a5a4a"}}>{p.categoria}</td>
                    <td style={{color:bajo?"#ef4444":"#22c55e",fontWeight:600}}>{p.stock}</td>
                    <td style={{color:"#6a5a4a"}}>{p.minimo}</td>
                    <td style={{color:"#8a7a6a"}}>{p.unidad}</td>
                    {esAdmin&&<td>{fmt(p.precio)}</td>}
                    {esAdmin&&<td style={{color:"#c8833a"}}>{fmt(p.stock*p.precio)}</td>}
                    <td><span className="badge" style={{background:bajo?"#3b0a0a80":"#05260a80",color:bajo?"#ef4444":"#22c55e",border:`1px solid ${bajo?"#ef444430":"#22c55e30"}`}}>{bajo?"BAJO MÍN.":"OK"}</span></td>
                    {esAdmin&&<td style={{whiteSpace:"nowrap"}}>
                      <button className="btn bgh" style={{padding:"4px 9px",fontSize:10,marginRight:4}} onClick={()=>{setPMP({nombre:p.nombre,categoria:p.categoria,unidad:p.unidad,stock:p.stock,minimo:p.minimo,precio:p.precio});setModalEditMP(p.id);}}>Editar</button>
                      <button className="btn" style={{padding:"4px 9px",fontSize:10,background:"transparent",border:"1px solid #3b0a0a",color:"#ef4444",cursor:"pointer"}} onClick={async()=>{await supabase.from("productos").delete().eq("id",p.id);reMP();mostrar("Producto eliminado.");}}>✕</button>
                    </td>}
                  </tr>;
                })}</tbody>
                {esAdmin&&<tfoot><tr style={{borderTop:"1px solid #2a2018"}}>
                  <td colSpan={5} style={{color:"#6a5a4a",fontSize:9,letterSpacing:2,textTransform:"uppercase"}}>Valor total en bodega</td>
                  <td colSpan={2} style={{color:"#c8833a",fontFamily:"'Bebas Neue'",fontSize:18}}>{fmt(mp.reduce((a,b)=>a+b.stock*b.precio,0))}</td>
                  <td colSpan={2}/>
                </tr></tfoot>}
              </table>
            </div>
          </div>
        )}

        {/* ═══ PORCIÓN */}
        {vista==="porciones"&&(
          <div>
            {stockBajoPor.length>0&&<div style={{background:"#1a0a2a",border:"1px solid #a78bfa40",padding:"10px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}><span style={{color:"#a78bfa"}}>⚠</span><span style={{fontSize:11,color:"#c4b5fd",letterSpacing:1}}>PORCIONES BAJO MÍNIMO: {stockBajoPor.map(s=>s.nombre).join(", ")}</span></div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span className="ppor">POR</span><span style={{fontSize:10,color:"#6a5a4a",letterSpacing:1}}>{porción.length} ítems</span></div>
              {esAdmin&&<button className="btn bpor" style={{padding:"6px 14px",fontSize:10}} onClick={()=>{setPPor({...emptyPPor,categoria:catPor[0]?.nombre||""});setModalNewPor(true);}}>+ Nueva Porción</button>}
            </div>
            <div className="card" style={{padding:0,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{borderBottom:"1px solid #2a2018"}}>{["Nombre","Categoría","Stock","Mín.","Unidad","Origen",...(esAdmin?["Costo","Valor"]:[]),"Estado",...(esAdmin?[""]:[])].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>{[...porción].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map((p,i)=>{
                  const bajo=p.stock<=p.minimo;
                  return <tr key={p.id} className="rh" style={{background:i%2===0?"transparent":"#0d0b09",borderBottom:"1px solid #14120f"}}>
                    <td style={{fontWeight:500}}>{p.nombre}</td>
                    <td style={{color:"#6a5a4a"}}>{p.categoria}</td>
                    <td style={{color:bajo?"#ef4444":"#a78bfa",fontWeight:600}}>{p.stock}</td>
                    <td style={{color:"#6a5a4a"}}>{p.minimo}</td>
                    <td style={{color:"#8a7a6a"}}>{p.unidad}</td>
                    <td style={{color:"#c8833a",fontSize:10}}>{p.mp_origen||"—"}</td>
                    {esAdmin&&<td>{fmt(p.costo_unit)}</td>}
                    {esAdmin&&<td style={{color:"#a78bfa"}}>{fmt(p.stock*p.costo_unit)}</td>}
                    <td><span className="badge" style={{background:bajo?"#3b0a0a80":"#1a0a3080",color:bajo?"#ef4444":"#a78bfa",border:`1px solid ${bajo?"#ef444430":"#a78bfa30"}`}}>{bajo?"BAJO MÍN.":"OK"}</span></td>
                    {esAdmin&&<td style={{whiteSpace:"nowrap"}}>
                      <button className="btn bgh" style={{padding:"4px 9px",fontSize:10,marginRight:4}} onClick={()=>{setPPor({nombre:p.nombre,categoria:p.categoria,unidad:p.unidad,stock:p.stock,minimo:p.minimo,costoUnit:p.costo_unit,mpOrigen:p.mp_origen||""});setModalEditPor(p.id);}}>Editar</button>
                      <button className="btn" style={{padding:"4px 9px",fontSize:10,background:"transparent",border:"1px solid #3b0a0a",color:"#ef4444",cursor:"pointer"}} onClick={async()=>{await supabase.from("porciones").delete().eq("id",p.id);rePor();mostrar("Porción eliminada.");}}>✕</button>
                    </td>}
                  </tr>;
                })}</tbody>
                {esAdmin&&<tfoot><tr style={{borderTop:"1px solid #2a2018"}}>
                  <td colSpan={6} style={{color:"#6a5a4a",fontSize:9,letterSpacing:2,textTransform:"uppercase"}}>Valor total porciones</td>
                  <td colSpan={2} style={{color:"#a78bfa",fontFamily:"'Bebas Neue'",fontSize:18}}>{fmt(porción.reduce((a,b)=>a+b.stock*b.costo_unit,0))}</td>
                  <td colSpan={2}/>
                </tr></tfoot>}
              </table>
            </div>
          </div>
        )}

        {/* ═══ MOVIMIENTOS */}
        {vista==="movimientos"&&esAdmin&&(
          <div style={{display:"grid",gap:22}}>
            {[{title:"Movimientos Producto",pill:"PRO",data:[...movMP].reverse(),tc:tcMP,cols:["Fecha","Tipo","Producto","Cant.","Turno","Responsable","Motivo","Valor"]},
              {title:"Movimientos Porción",  pill:"POR",data:[...movPor].reverse(),tc:tcPor,cols:["Fecha","Tipo","Porción","Cant.","Prod. Usado","Cant. Prod.","Rendimiento","Turno","Responsable","Valor"]}
            ].map(sec=>(
              <div key={sec.title}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}>
                  <span className={sec.pill==="PRO"?"ppro":"ppor"}>{sec.pill}</span>
                  <span style={{fontSize:9,letterSpacing:2,color:"#6a5a4a",textTransform:"uppercase"}}>{sec.title} — {sec.data.length} registros</span>
                </div>
                <div className="card" style={{padding:0,overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{borderBottom:"1px solid #2a2018"}}>{sec.cols.map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{sec.data.map((m,i)=>(
                      <tr key={m.id} className="rh" style={{background:i%2===0?"transparent":"#0d0b09",borderBottom:"1px solid #14120f"}}>
                        <td style={{color:"#6a5a4a"}}>{m.fecha}</td>
                        <td><span className="badge" style={{background:`${sec.tc[m.tipo]||"#888"}20`,color:sec.tc[m.tipo]||"#888",border:`1px solid ${sec.tc[m.tipo]||"#888"}30`}}>{m.tipo.toUpperCase()}</span></td>
                        <td style={{fontWeight:500}}>{m.nombre}</td>
                        <td>{m.cantidad} {m.unidad}</td>
                        {sec.pill==="POR"&&<><td style={{color:"#c8833a",fontSize:10}}>{m.mp_usada||"—"}</td><td style={{color:"#6a5a4a"}}>{m.cant_mp>0?m.cant_mp:"—"}</td><td style={{color:"#4a3a2a",fontSize:10}}>{m.rendimiento||"—"}</td></>}
                        {sec.pill==="PRO"&&<td style={{color:"#6a5a4a"}}>{m.motivo}</td>}
                        <td style={{color:"#8a7a6a"}}>{m.turno}</td>
                        <td>{m.responsable}</td>
                        <td style={{color:m.tipo==="merma"?"#ef4444":m.tipo==="entrada"||m.tipo==="proceso"?"#22c55e":"#3b82f6",textAlign:"right"}}>{fmt(m.valor)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ RESPONSABLES */}
        {vista==="responsables"&&esAdmin&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13}}>
              <span style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",textTransform:"uppercase"}}>{responsables.length} responsable(s)</span>
              <button className="btn bmp" style={{padding:"6px 14px",fontSize:10}} onClick={()=>{setNuevoResp("");setModalResp(true);}}>+ Nuevo Responsable</button>
            </div>
            <div className="card" style={{padding:0}}>
              {[...responsables].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map((r,i,arr)=>(
                <div key={r.id} className="rh" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px",borderBottom:i<arr.length-1?"1px solid #14120f":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:30,height:30,background:"#1a140e",border:"1px solid #2a2018",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue'",fontSize:15,color:"#c8833a"}}>{r.nombre.charAt(0).toUpperCase()}</div>
                    {editRespId===r.id
                      ?<input className="inp" style={{width:200}} value={editRespVal} onChange={e=>setEditRespVal(e.target.value)} autoFocus onKeyDown={async e=>{if(e.key==="Enter"){await supabase.from("responsables").update({nombre:editRespVal.trim()}).eq("id",r.id);reResp();mostrar("Responsable actualizado.");setEditRespId(null);}if(e.key==="Escape")setEditRespId(null);}}/>
                      :<span style={{fontSize:13}}>{r.nombre}</span>
                    }
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {editRespId===r.id
                      ?<button className="btn bmp" style={{padding:"4px 10px",fontSize:10}} onClick={async()=>{await supabase.from("responsables").update({nombre:editRespVal.trim()}).eq("id",r.id);reResp();mostrar("Responsable actualizado.");setEditRespId(null);}}>Guardar</button>
                      :<button className="btn bgh" style={{padding:"4px 9px",fontSize:10}} onClick={()=>{setEditRespId(r.id);setEditRespVal(r.nombre);}}>Editar</button>
                    }
                    <button className="btn" style={{padding:"4px 9px",fontSize:10,background:"transparent",border:"1px solid #3b0a0a",color:"#ef4444",cursor:"pointer"}} onClick={async()=>{await supabase.from("responsables").delete().eq("id",r.id);reResp();mostrar("Responsable eliminado.");}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ CATEGORÍAS */}
        {vista==="categorias"&&esAdmin&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {[{label:"Categorías de Producto",pill:"PRO",data:catMP,nuevaVal:nuevaCatMP,setNueva:setNuevaCatMP,tabla:"categorias_mp",recargar:reCatMP,enUsoFn:(c)=>mp.some(p=>p.categoria===c.nombre),btnCls:"bmp"},
              {label:"Categorías de Porción", pill:"POR",data:catPor,nuevaVal:nuevaCatPor,setNueva:setNuevaCatPor,tabla:"categorias_por",recargar:reCatPor,enUsoFn:(c)=>porción.some(p=>p.categoria===c.nombre),btnCls:"bpor"}
            ].map(sec=>(
              <div key={sec.label}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:13}}>
                  <span className={sec.pill==="PRO"?"ppro":"ppor"}>{sec.pill}</span>
                  <span style={{fontSize:9,letterSpacing:2,color:"#6a5a4a",textTransform:"uppercase"}}>{sec.label} — {sec.data.length}</span>
                </div>
                <div className="card" style={{padding:0,marginBottom:12}}>
                  {[...sec.data].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es")).map((c,i,arr)=>(
                    <div key={c.id} className="rh" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",borderBottom:i<arr.length-1?"1px solid #14120f":"none"}}>
                      <span style={{fontSize:12}}>{c.nombre}</span>
                      <button className="btn" style={{padding:"3px 9px",fontSize:10,background:"transparent",border:"1px solid #3b0a0a",color:"#ef4444",cursor:"pointer"}}
                        onClick={async()=>{
                          if(sec.enUsoFn(c)){mostrar(`"${c.nombre}" está en uso y no puede eliminarse.`,"error");return;}
                          await supabase.from(sec.tabla).delete().eq("id",c.id);
                          sec.recargar(); mostrar("Categoría eliminada.");
                        }}>✕</button>
                    </div>
                  ))}
                  {sec.data.length===0&&<div style={{padding:16,color:"#4a3a2a",fontSize:11}}>Sin categorías.</div>}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <input className="inp" value={sec.nuevaVal} onChange={e=>sec.setNueva(e.target.value)} placeholder="Nueva categoría..."
                    onKeyDown={async e=>{if(e.key==="Enter"){const v=sec.nuevaVal.trim();if(!v){mostrar("Ingresa un nombre.","error");return;}await supabase.from(sec.tabla).insert({nombre:v});sec.recargar();sec.setNueva("");mostrar("Categoría agregada.");}}}
                    style={{flex:1}}/>
                  <button className={`btn ${sec.btnCls}`} style={{padding:"0 16px",fontSize:10}}
                    onClick={async()=>{const v=sec.nuevaVal.trim();if(!v){mostrar("Ingresa un nombre.","error");return;}await supabase.from(sec.tabla).insert({nombre:v});sec.recargar();sec.setNueva("");mostrar("Categoría agregada.");}}>
                    + Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ INFORMES */}
        {vista==="informes"&&esAdmin&&(()=>{
          const mmpF=movMP.filter(m=>m.fecha>=ifDesde&&m.fecha<=ifHasta);
          const mporF=movPor.filter(m=>m.fecha>=ifDesde&&m.fecha<=ifHasta);
          const entradasMP=mmpF.filter(m=>m.tipo==="entrada").reduce((a,b)=>a+b.valor,0);
          const mermasMP=mmpF.filter(m=>m.tipo==="merma").reduce((a,b)=>a+b.valor,0);
          const ventasPor=mporF.filter(m=>m.tipo==="venta").reduce((a,b)=>a+b.valor,0);
          const mermasPor=mporF.filter(m=>m.tipo==="merma").reduce((a,b)=>a+b.valor,0);
          const procesados=mporF.filter(m=>m.tipo==="proceso");
          const mpConsumida=procesados.reduce((a,b)=>a+(b.cant_mp||0)*(mp.find(p=>p.nombre===b.mp_usada)?.precio||0),0);
          const allMov=(ifStock==="todos"?[...mmpF.map(m=>({...m,capa:"PRO"})),...mporF.map(m=>({...m,capa:"POR"}))]
            :ifStock==="mp"?mmpF.map(m=>({...m,capa:"PRO"})):mporF.map(m=>({...m,capa:"POR"}))).sort((a,b)=>b.fecha.localeCompare(a.fecha));
          const tcAll={...tcMP,...tcPor};
          return (
            <div>
              <div className="card" style={{marginBottom:18,padding:"14px 18px"}}>
                <div style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",marginBottom:11,textTransform:"uppercase"}}>Filtros</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:11}}>
                  <div><label className="lbl">Desde</label><input className="inp" type="date" value={ifDesde} onChange={e=>setIfDesde(e.target.value)}/></div>
                  <div><label className="lbl">Hasta</label><input className="inp" type="date" value={ifHasta} onChange={e=>setIfHasta(e.target.value)}/></div>
                  <div><label className="lbl">Vista</label>
                    <select className="inp" value={ifStock} onChange={e=>setIfStock(e.target.value)}>
                      <option value="todos">Todos</option><option value="mp">Solo Producto</option><option value="por">Solo Porción</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:3,marginBottom:18,flexWrap:"wrap"}}>
                {[["resumen","Resumen"],["rendimiento","Rendimiento"],["mermas","Mermas"],["movimientos","Movimientos"]].map(([k,v])=>(
                  <button key={k} className={`tab${informe===k?" act-mp":""}`} onClick={()=>setInforme(k)}>{v}</button>
                ))}
              </div>
              {informe==="resumen"&&(
                <div style={{display:"grid",gap:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:11}}>
                    {[{label:"Compras Prod.",val:fmt(entradasMP),color:"#c8833a",pill:"PRO"},{label:"Ventas Porción",val:fmt(ventasPor),color:"#a78bfa",pill:"POR"},{label:"Mermas Prod.",val:fmt(mermasMP),color:"#ef4444",pill:"PRO"},{label:"Mermas Porción",val:fmt(mermasPor),color:"#ef4444",pill:"POR"}].map(s=>(
                      <div key={s.label} className="card" style={{borderLeft:`2px solid ${s.color}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                          <div style={{fontSize:9,letterSpacing:2,color:"#6a5a4a",textTransform:"uppercase"}}>{s.label}</div>
                          <span className={s.pill==="PRO"?"ppro":"ppor"}>{s.pill}</span>
                        </div>
                        <div className="sv" style={{color:s.color,fontSize:22}}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                    <div className="card">
                      <div style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",marginBottom:12,textTransform:"uppercase"}}>% Merma Prod. sobre compras</div>
                      <div style={{fontFamily:"'Bebas Neue'",fontSize:38,color:entradasMP>0&&(mermasMP/entradasMP)>0.1?"#ef4444":"#c8833a"}}>{entradasMP>0?((mermasMP/entradasMP)*100).toFixed(1):"0.0"}%</div>
                      <div style={{fontSize:10,color:"#4a3a2a",marginTop:4}}>Referencia aceptable: &lt; 10%</div>
                    </div>
                    <div className="card">
                      <div style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",marginBottom:12,textTransform:"uppercase"}}>Inventario consolidado hoy</div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,fontSize:11}}><span>Bodega Prod.</span><span style={{color:"#c8833a"}}>{fmt(mp.reduce((a,b)=>a+b.stock*b.precio,0))}</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><span>Porciones listas</span><span style={{color:"#a78bfa"}}>{fmt(porción.reduce((a,b)=>a+b.stock*b.costo_unit,0))}</span></div>
                      <hr className="div"/>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600}}><span>Total</span><span>{fmt(mp.reduce((a,b)=>a+b.stock*b.precio,0)+porción.reduce((a,b)=>a+b.stock*b.costo_unit,0))}</span></div>
                    </div>
                  </div>
                </div>
              )}
              {informe==="rendimiento"&&(
                <div className="card" style={{padding:0,overflowX:"auto"}}>
                  <div style={{padding:"14px 16px",borderBottom:"1px solid #1a140e"}}><span style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",textTransform:"uppercase"}}>Procesos de porcionado — Prod. consumido: <span style={{color:"#c8833a"}}>{fmt(mpConsumida)}</span></span></div>
                  {procesados.length===0?<div style={{padding:22,color:"#4a3a2a",fontSize:11}}>Sin procesos en el período.</div>
                  :<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{borderBottom:"1px solid #2a2018"}}>{["Fecha","Porción obtenida","Cant.","Prod. utilizado","Cant. Prod.","Rendimiento","Responsable"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{procesados.map((m,i)=>(
                      <tr key={m.id} className="rh" style={{background:i%2===0?"transparent":"#0d0b09",borderBottom:"1px solid #14120f"}}>
                        <td style={{color:"#6a5a4a"}}>{m.fecha}</td><td style={{color:"#a78bfa"}}>{m.nombre}</td><td>{m.cantidad} {m.unidad}</td>
                        <td style={{color:"#c8833a"}}>{m.mp_usada||"—"}</td><td>{m.cant_mp>0?m.cant_mp:"—"}</td>
                        <td style={{color:"#4a3a2a",fontSize:10}}>{m.rendimiento||"—"}</td><td>{m.responsable}</td>
                      </tr>
                    ))}</tbody>
                  </table>}
                </div>
              )}
              {informe==="mermas"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {[{title:"Mermas Producto",pill:"PRO",data:mmpF.filter(m=>m.tipo==="merma")},{title:"Mermas Porción",pill:"POR",data:mporF.filter(m=>m.tipo==="merma")}].map(sec=>(
                    <div key={sec.title} className="card" style={{padding:0}}>
                      <div style={{padding:"12px 16px",borderBottom:"1px solid #1a140e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:9,letterSpacing:2,color:"#8a7a6a",textTransform:"uppercase"}}>{sec.title}</span>
                        <span className={sec.pill==="PRO"?"ppro":"ppor"}>{sec.pill}</span>
                      </div>
                      {sec.data.length===0?<div style={{padding:18,color:"#4a3a2a",fontSize:11}}>Sin mermas en el período.</div>
                      :sec.data.map(m=>(
                        <div key={m.id} className="rh" style={{padding:"9px 16px",borderBottom:"1px solid #0d0b09"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,fontWeight:500}}>{m.nombre}</span><span style={{color:"#ef4444",fontSize:11}}>{fmt(m.valor)}</span></div>
                          <div style={{fontSize:9,color:"#4a3a2a",letterSpacing:1}}>{m.fecha} · {m.turno} · {m.responsable} · {m.motivo}</div>
                        </div>
                      ))}
                      <div style={{padding:"9px 16px",borderTop:"1px solid #1a140e",display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:9,color:"#6a5a4a",letterSpacing:2,textTransform:"uppercase"}}>Total</span>
                        <span style={{color:"#ef4444",fontFamily:"'Bebas Neue'",fontSize:18}}>{fmt(sec.data.reduce((a,b)=>a+b.valor,0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {informe==="movimientos"&&(
                <div className="card" style={{padding:0,overflowX:"auto"}}>
                  {allMov.length===0?<div style={{padding:22,textAlign:"center",color:"#4a3a2a",fontSize:11}}>Sin movimientos en el rango.</div>
                  :<table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead><tr style={{borderBottom:"1px solid #2a2018"}}>{["Fecha","Stock","Tipo","Producto","Cant.","Turno","Responsable","Valor"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{allMov.map((m,i)=>(
                      <tr key={`${m.capa}-${m.id}`} className="rh" style={{background:i%2===0?"transparent":"#0d0b09",borderBottom:"1px solid #14120f"}}>
                        <td style={{color:"#6a5a4a"}}>{m.fecha}</td>
                        <td><span className={m.capa==="PRO"?"ppro":"ppor"}>{m.capa}</span></td>
                        <td><span className="badge" style={{background:`${tcAll[m.tipo]||"#888"}20`,color:tcAll[m.tipo]||"#888",border:`1px solid ${tcAll[m.tipo]||"#888"}30`}}>{m.tipo.toUpperCase()}</span></td>
                        <td>{m.nombre}</td><td>{m.cantidad} {m.unidad}</td>
                        <td style={{color:"#8a7a6a"}}>{m.turno}</td><td>{m.responsable}</td>
                        <td style={{color:m.tipo==="merma"?"#ef4444":"#e8e0d4",textAlign:"right"}}>{fmt(m.valor)}</td>
                      </tr>
                    ))}</tbody>
                  </table>}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ════ MODAL MOV PRODUCTO */}
      {modalMP&&(
        <div className="mbg" onClick={e=>e.target===e.currentTarget&&setModalMP(false)}>
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,color:"#c8833a"}}>MOVIMIENTO</span><span className="ppro">Producto</span></div>
              <button className="btn bgh" style={{padding:"4px 10px"}} onClick={()=>setModalMP(false)}>✕</button>
            </div>
            <div style={{display:"grid",gap:13}}>
              <div><label className="lbl">Tipo *</label>
                <select className="inp" value={fMP.tipo} onChange={e=>setFMP({...fMP,tipo:e.target.value})}>
                  <option value="entrada">Entrada</option><option value="salida">Salida</option><option value="merma">Merma</option>
                </select>
              </div>
              <div><label className="lbl">Producto *</label>
                <select className="inp" value={fMP.nombre} onChange={e=>setFMP({...fMP,nombre:e.target.value})}>
                  <option value="">Selecciona...</option>{mp.map(p=><option key={p.id} value={p.nombre}>{p.nombre} — Stock: {p.stock} {p.unidad}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Cantidad *</label><input className="inp" type="number" min="0" step="0.01" value={fMP.cantidad} onChange={e=>setFMP({...fMP,cantidad:e.target.value})} placeholder="0.0"/></div>
                <div><label className="lbl">Fecha</label><input className="inp" type="date" value={fMP.fecha} onChange={e=>setFMP({...fMP,fecha:e.target.value})}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Turno</label><select className="inp" value={fMP.turno} onChange={e=>setFMP({...fMP,turno:e.target.value})}>{TURNOS.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="lbl">Responsable *</label>
                  <select className="inp" value={fMP.responsable} onChange={e=>setFMP({...fMP,responsable:e.target.value})}>
                    <option value="">Selecciona...</option>{responsables.map(r=><option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="lbl">Motivo</label>
                {fMP.tipo==="merma"
                  ?<select className="inp" value={fMP.motivo} onChange={e=>setFMP({...fMP,motivo:e.target.value})}><option value="">Selecciona...</option>{TIPOS_MERMA_POR.map(m=><option key={m}>{m}</option>)}</select>
                  :<input className="inp" value={fMP.motivo} onChange={e=>setFMP({...fMP,motivo:e.target.value})} placeholder="Descripción..."/>
                }
              </div>
              <hr className="div"/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn bgh" onClick={()=>setModalMP(false)}>Cancelar</button>
                <button className="btn bmp" onClick={registrarMovMP} disabled={guardando}>{guardando?"Guardando...":"Registrar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL MOV PORCIÓN */}
      {modalPor&&(
        <div className="mbg" onClick={e=>e.target===e.currentTarget&&setModalPor(false)}>
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,color:"#a78bfa"}}>MOVIMIENTO</span><span className="ppor">Porción</span></div>
              <button className="btn bgh" style={{padding:"4px 10px"}} onClick={()=>setModalPor(false)}>✕</button>
            </div>
            <div style={{display:"grid",gap:13}}>
              <div><label className="lbl">Tipo *</label>
                <select className="inp" value={fPor.tipo} onChange={e=>setFPor({...fPor,tipo:e.target.value,mpUsada:"",cantMP:""})}>
                  <option value="proceso">Proceso</option><option value="venta">Venta</option><option value="merma">Merma</option>
                </select>
              </div>
              <div><label className="lbl">Porción *</label>
                <select className="inp" value={fPor.nombre} onChange={e=>setFPor({...fPor,nombre:e.target.value})}>
                  <option value="">Selecciona...</option>{porción.map(p=><option key={p.id} value={p.nombre}>{p.nombre} — Stock: {p.stock} {p.unidad}</option>)}
                </select>
              </div>
              {fPor.tipo==="proceso"&&(
                <div style={{display:"grid",gap:11}}>
                  <div style={{background:"#0d0b09",border:"1px solid #c8833a30",padding:"13px",display:"grid",gap:11}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#c8833a",textTransform:"uppercase"}}>① Producto consumido</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                      <div><label className="lbl">Prod. utilizado *</label>
                        <select className="inp" value={fPor.mpUsada} onChange={e=>setFPor({...fPor,mpUsada:e.target.value})}>
                          <option value="">Selecciona...</option>{mp.map(p=><option key={p.id} value={p.nombre}>{p.nombre} (Stock: {p.stock} {p.unidad})</option>)}
                        </select>
                      </div>
                      <div><label className="lbl">Cantidad prod. usada *</label><input className="inp" type="number" min="0" step="0.01" value={fPor.cantMP} onChange={e=>setFPor({...fPor,cantMP:e.target.value})} placeholder="0.0"/></div>
                    </div>
                    {fPor.mpUsada&&fPor.cantMP&&(()=>{
                      const mpP=mp.find(p=>p.nombre===fPor.mpUsada);
                      const usado=parseFloat(fPor.cantMP)||0;
                      const restante=(mpP.stock-usado).toFixed(2);
                      return <div style={{background:"#12100e",border:"1px solid #2a2018",padding:"9px 12px",fontSize:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>PROD. DISPONIBLE</div><div style={{color:"#c8833a"}}>{mpP.stock} {mpP.unidad}</div></div>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>A DESCONTAR</div><div style={{color:"#ef4444"}}>−{usado} {mpP.unidad}</div></div>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>STOCK RESTANTE</div><div style={{color:parseFloat(restante)<0?"#ef4444":"#22c55e"}}>{restante} {mpP.unidad}</div></div>
                      </div>;
                    })()}
                  </div>
                  <div style={{background:"#0d0b09",border:"1px solid #ef444430",padding:"13px",display:"grid",gap:11}}>
                    <div style={{fontSize:9,letterSpacing:2,color:"#ef9999",textTransform:"uppercase"}}>② Merma del proceso (opcional)</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                      <div><label className="lbl">Cantidad de merma</label><input className="inp" type="number" min="0" step="0.01" value={fPor.mermaKg} onChange={e=>setFPor({...fPor,mermaKg:e.target.value})} placeholder="0.0"/></div>
                      <div><label className="lbl">Motivo merma</label>
                        <select className="inp" value={fPor.motivoMerma} onChange={e=>setFPor({...fPor,motivoMerma:e.target.value})}>
                          <option value="">Sin motivo</option>{TIPOS_MERMA_POR.map(m=><option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    {fPor.cantMP&&fPor.cantidad&&(()=>{
                      const mpP=mp.find(p=>p.nombre===fPor.mpUsada);
                      const total=parseFloat(fPor.cantMP)||0;
                      const mermaV=parseFloat(fPor.mermaKg)||0;
                      return <div style={{background:"#12100e",border:"1px solid #2a2018",padding:"9px 12px",fontSize:10,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>PROD. TOTAL USADO</div><div style={{color:"#c8833a"}}>{total} {mpP?.unidad||""}</div></div>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>MERMA DECLARADA</div><div style={{color:"#ef4444"}}>{mermaV} {mpP?.unidad||""}</div></div>
                        <div><div style={{color:"#4a3a2a",fontSize:9,letterSpacing:1,marginBottom:2}}>PROD. → PORCIÓN</div><div style={{color:"#a78bfa"}}>{(total-mermaV).toFixed(2)} {mpP?.unidad||""}</div></div>
                      </div>;
                    })()}
                  </div>
                  <div><label className="lbl">Nota de rendimiento</label><input className="inp" value={fPor.rendimiento} onChange={e=>setFPor({...fPor,rendimiento:e.target.value})} placeholder="Ej: 1 kg lomo → 4 filetes de 200g + 200g merma"/></div>
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Porciones *</label><input className="inp" type="number" min="0" step="1" value={fPor.cantidad} onChange={e=>setFPor({...fPor,cantidad:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Fecha</label><input className="inp" type="date" value={fPor.fecha} onChange={e=>setFPor({...fPor,fecha:e.target.value})}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Turno</label><select className="inp" value={fPor.turno} onChange={e=>setFPor({...fPor,turno:e.target.value})}>{TURNOS.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="lbl">Responsable *</label>
                  <select className="inp" value={fPor.responsable} onChange={e=>setFPor({...fPor,responsable:e.target.value})}>
                    <option value="">Selecciona...</option>{responsables.map(r=><option key={r.id} value={r.nombre}>{r.nombre}</option>)}
                  </select>
                </div>
              </div>
              {fPor.tipo==="merma"&&<div><label className="lbl">Motivo</label>
                <select className="inp" value={fPor.motivo} onChange={e=>setFPor({...fPor,motivo:e.target.value})}>
                  <option value="">Selecciona...</option>{TIPOS_MERMA_POR.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>}
              <hr className="div"/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn bgh" onClick={()=>setModalPor(false)}>Cancelar</button>
                <button className="btn bpor" onClick={registrarMovPor} disabled={guardando}>{guardando?"Guardando...":"Registrar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ CRUD PRODUCTO */}
      {(modalNewMP||modalEditMP)&&(
        <div className="mbg" onClick={e=>e.target===e.currentTarget&&(setModalNewMP(false),setModalEditMP(null))}>
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,color:"#c8833a"}}>{modalEditMP?"EDITAR":"NUEVO"} PRODUCTO</span>
              <button className="btn bgh" style={{padding:"4px 10px"}} onClick={()=>{setModalNewMP(false);setModalEditMP(null);}}>✕</button>
            </div>
            <div style={{display:"grid",gap:13}}>
              <div><label className="lbl">Nombre *</label><input className="inp" value={pMP.nombre} onChange={e=>setPMP({...pMP,nombre:e.target.value})} placeholder="Nombre del producto" disabled={!!modalEditMP} style={{opacity:modalEditMP?0.6:1}}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Categoría</label><select className="inp" value={pMP.categoria} onChange={e=>setPMP({...pMP,categoria:e.target.value})}>{catMP.map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                <div><label className="lbl">Unidad</label><select className="inp" value={pMP.unidad} onChange={e=>setPMP({...pMP,unidad:e.target.value})}>{["kg","g","L","ml","unid","btl","caja","sobre"].map(u=><option key={u}>{u}</option>)}</select></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:11}}>
                <div><label className="lbl">Stock inicial</label><input className="inp" type="number" min="0" step="0.01" value={pMP.stock} onChange={e=>setPMP({...pMP,stock:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Stock mínimo</label><input className="inp" type="number" min="0" step="0.01" value={pMP.minimo} onChange={e=>setPMP({...pMP,minimo:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Precio (CLP) *</label><input className="inp" type="number" min="0" value={pMP.precio} onChange={e=>setPMP({...pMP,precio:e.target.value})} placeholder="0"/></div>
              </div>
              {pMP.stock&&pMP.precio&&<div style={{background:"#0d0b09",border:"1px solid #2a2018",padding:"9px 13px",fontSize:11}}><span style={{color:"#6a5a4a",letterSpacing:1}}>VALOR BODEGA: </span><span style={{color:"#c8833a",fontFamily:"'Bebas Neue'",fontSize:15}}>{fmt(parseFloat(pMP.stock||0)*parseFloat(pMP.precio||0))}</span></div>}
              <hr className="div"/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn bgh" onClick={()=>{setModalNewMP(false);setModalEditMP(null);}}>Cancelar</button>
                <button className="btn bmp" onClick={()=>guardarProdMP(modalEditMP)} disabled={guardando}>{modalEditMP?"Guardar cambios":"Agregar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ CRUD PORCIÓN */}
      {(modalNewPor||modalEditPor)&&(
        <div className="mbg" onClick={e=>e.target===e.currentTarget&&(setModalNewPor(false),setModalEditPor(null))}>
          <div className="modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,color:"#a78bfa"}}>{modalEditPor?"EDITAR":"NUEVA"} PORCIÓN</span>
              <button className="btn bgh" style={{padding:"4px 10px"}} onClick={()=>{setModalNewPor(false);setModalEditPor(null);}}>✕</button>
            </div>
            <div style={{display:"grid",gap:13}}>
              <div><label className="lbl">Nombre *</label><input className="inp" value={pPor.nombre} onChange={e=>setPPor({...pPor,nombre:e.target.value})} placeholder="Nombre de la porción" disabled={!!modalEditPor} style={{opacity:modalEditPor?0.6:1}}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
                <div><label className="lbl">Categoría</label><select className="inp" value={pPor.categoria} onChange={e=>setPPor({...pPor,categoria:e.target.value})}>{catPor.map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}</select></div>
                <div><label className="lbl">Unidad</label><select className="inp" value={pPor.unidad} onChange={e=>setPPor({...pPor,unidad:e.target.value})}>{["unid","porción","cc","g"].map(u=><option key={u}>{u}</option>)}</select></div>
              </div>
              <div><label className="lbl">Origen (referencia)</label>
                <select className="inp" value={pPor.mpOrigen} onChange={e=>setPPor({...pPor,mpOrigen:e.target.value})}>
                  <option value="">Sin asociar</option>{mp.map(p=><option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:11}}>
                <div><label className="lbl">Stock inicial</label><input className="inp" type="number" min="0" value={pPor.stock} onChange={e=>setPPor({...pPor,stock:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Stock mínimo</label><input className="inp" type="number" min="0" value={pPor.minimo} onChange={e=>setPPor({...pPor,minimo:e.target.value})} placeholder="0"/></div>
                <div><label className="lbl">Costo unit. (CLP) *</label><input className="inp" type="number" min="0" value={pPor.costoUnit} onChange={e=>setPPor({...pPor,costoUnit:e.target.value})} placeholder="0"/></div>
              </div>
              <hr className="div"/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn bgh" onClick={()=>{setModalNewPor(false);setModalEditPor(null);}}>Cancelar</button>
                <button className="btn bpor" onClick={()=>guardarProdPor(modalEditPor)} disabled={guardando}>{modalEditPor?"Guardar cambios":"Agregar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL RESPONSABLE */}
      {modalResp&&(
        <div className="mbg" onClick={e=>e.target===e.currentTarget&&setModalResp(false)}>
          <div className="modal" style={{width:360}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <span style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,color:"#c8833a"}}>NUEVO RESPONSABLE</span>
              <button className="btn bgh" style={{padding:"4px 10px"}} onClick={()=>setModalResp(false)}>✕</button>
            </div>
            <div style={{display:"grid",gap:13}}>
              <div><label className="lbl">Nombre *</label><input className="inp" value={nuevoResp} onChange={e=>setNuevoResp(e.target.value)} placeholder="Nombre del responsable" autoFocus
                onKeyDown={async e=>{if(e.key==="Enter"){const v=nuevoResp.trim();if(!v)return;await supabase.from("responsables").insert({nombre:v});reResp();mostrar("Responsable agregado.");setModalResp(false);}}}/></div>
              <hr className="div"/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button className="btn bgh" onClick={()=>setModalResp(false)}>Cancelar</button>
                <button className="btn bmp" onClick={async()=>{const v=nuevoResp.trim();if(!v)return;await supabase.from("responsables").insert({nombre:v});reResp();mostrar("Responsable agregado.");setModalResp(false);}}>Agregar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {alerta&&<div className="alerta" style={{background:alerta.tipo==="ok"?"#052e16":"#2a0a0a",border:`1px solid ${alerta.tipo==="ok"?"#22c55e40":"#ef444440"}`,color:alerta.tipo==="ok"?"#22c55e":"#ef4444"}}>{alerta.tipo==="ok"?"✓":"⚠"} {alerta.msg}</div>}
    </div>
  );
}
