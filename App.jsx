import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Constants ──
const PAIRS = ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","NZD/USD","USD/CHF","GBP/JPY","EUR/GBP","EUR/JPY","XAU/USD"];
const SESSIONS = ["London","New York","Asian","London/NY Overlap"];
const SETUPS = ["Structure Break","Trend Follow","Reversal","Liquidity Grab","Range","News Play"];
const TIMEFRAMES = ["H1","H4","Daily","Weekly"];
const EMOTIONS = ["😌 Calm","💪 Confident","😰 Anxious","😤 Revenge","😅 FOMO","🤔 Uncertain"];
const EXIT_QUALITY = ["✅ On Plan","😬 Too Early","😴 Too Late"];
const ADD_QUALITY = ["💯 Great timing","➖ OK","⏳ Should've waited","❌ Didn't add"];
const PATIENCE = ["⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function fmt(n) {
  if (!n && n !== 0) return "—";
  const v = parseFloat(n);
  if (isNaN(v)) return "—";
  return (v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(0);
}

// ── Stats helpers ──
function calcSharpe(returns) {
  if (returns.length < 2) return null;
  const avg = returns.reduce((a, r) => a + r, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, r) => a + Math.pow(r - avg, 2), 0) / returns.length);
  if (std === 0) return null;
  return ((avg / std) * Math.sqrt(252)).toFixed(2);
}

function calcProfitFactor(trades) {
  let gross_profit = 0, gross_loss = 0;
  trades.forEach(t => {
    const p = parseFloat(t.review?.pnlDollar) || 0;
    if (p > 0) gross_profit += p;
    else gross_loss += Math.abs(p);
  });
  if (gross_loss === 0) return gross_profit > 0 ? "∞" : "—";
  return (gross_profit / gross_loss).toFixed(2);
}

function buildEquityCurve(trades) {
  const closed = [...trades.filter(t => t.status === "closed" && t.review?.dateClosed)]
    .sort((a, b) => new Date(a.review.dateClosed) - new Date(b.review.dateClosed));
  let equity = 0;
  return closed.map((t, i) => {
    equity += parseFloat(t.review?.pnlDollar) || 0;
    return { name: `T${i + 1}`, equity: parseFloat(equity.toFixed(0)), pair: t.pair, date: t.review.dateClosed?.slice(0,10) };
  });
}

// ── CSS ──
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0a0c0f;--surface:#111418;--s2:#181c22;--border:#1f2530;--b2:#2a3240;
    --green:#00e5a0;--gdim:rgba(0,229,160,0.1);--red:#ff4d6a;--rdim:rgba(255,77,106,0.1);
    --gold:#f5c542;--ydim:rgba(245,197,66,0.1);--blue:#4d9fff;--bdim:rgba(77,159,255,0.1);
    --text:#e8edf5;--dim:#6b7a8f;--mid:#9ba8bc;
    --mono:'Space Mono',monospace;--sans:'Syne',sans-serif;
  }
  html,body,#root{height:100%;background:var(--bg);}
  body{color:var(--text);font-family:var(--sans);-webkit-tap-highlight-color:transparent;}

  /* LAYOUT */
  .app{display:flex;flex-direction:column;height:100dvh;overflow:hidden;}
  nav{background:var(--surface);border-bottom:1px solid var(--border);padding:0 16px;height:52px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .logo{font-family:var(--mono);font-size:11px;color:var(--green);letter-spacing:2px;}
  .logo span{color:var(--dim);}
  .nav-r{display:flex;gap:16px;}
  .ns{text-align:right;}
  .ns-l{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;}
  .ns-v{font-family:var(--mono);font-size:12px;margin-top:1px;}

  /* BOTTOM TABS */
  .btabs{display:flex;background:var(--surface);border-top:1px solid var(--border);flex-shrink:0;}
  .btab{flex:1;padding:10px 4px 12px;text-align:center;cursor:pointer;font-family:var(--mono);font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);border-top:2px solid transparent;transition:all .2s;}
  .btab.active{color:var(--green);border-top-color:var(--green);}
  .btab-icon{font-size:16px;display:block;margin-bottom:3px;}

  /* SCROLL AREA */
  .scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}
  .main{padding:16px;}

  /* SECTION LABEL */
  .slabel{font-family:var(--mono);font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:12px;display:flex;align-items:center;gap:10px;}
  .slabel::after{content:'';flex:1;height:1px;background:var(--border);}

  /* BUTTONS */
  .btn{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:10px 16px;cursor:pointer;border:none;transition:all .15s;display:inline-flex;align-items:center;gap:6px;}
  .btn-green{background:var(--green);color:#000;clip-path:polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%);}
  .btn-green:active{background:#00ffb3;}
  .btn-ghost{background:transparent;color:var(--dim);border:1px solid var(--b2);}
  .btn-blue{background:var(--bdim);color:var(--blue);border:1px solid rgba(77,159,255,.3);}
  .btn-red{background:var(--rdim);color:var(--red);border:1px solid rgba(255,77,106,.3);}
  .btn-sm{padding:6px 10px;font-size:8px;}
  .btn-full{width:100%;justify-content:center;margin-bottom:14px;}

  /* STAT GRID */
  .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);margin-bottom:16px;}
  .scard{background:var(--surface);padding:14px 12px;}
  .sc-l{font-family:var(--mono);font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:5px;}
  .sc-v{font-family:var(--mono);font-size:18px;font-weight:700;}
  .sc-s{font-family:var(--mono);font-size:8px;color:var(--dim);margin-top:2px;}

  /* TRADE CARD */
  .tcard{background:var(--surface);border:1px solid var(--border);margin-bottom:8px;}
  .tcard.open-t{border-color:rgba(0,229,160,.2);}
  .thead{display:flex;align-items:center;gap:10px;padding:12px;cursor:pointer;}
  .tog{width:22px;height:22px;border:1px solid var(--b2);background:var(--s2);color:var(--dim);font-family:var(--mono);font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
  .tog.exp{border-color:var(--green);color:var(--green);background:var(--gdim);}
  .t-info{flex:1;min-width:0;}
  .t-pair{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:1px;}
  .t-sub{font-family:var(--mono);font-size:9px;color:var(--dim);margin-top:2px;}
  .t-right{text-align:right;flex-shrink:0;}
  .dir{font-family:var(--mono);font-size:8px;font-weight:700;padding:2px 6px;letter-spacing:1px;}
  .dir.L{background:var(--gdim);color:var(--green);border:1px solid rgba(0,229,160,.3);}
  .dir.S{background:var(--rdim);color:var(--red);border:1px solid rgba(255,77,106,.3);}
  .sdot{width:5px;height:5px;border-radius:50%;background:var(--gold);box-shadow:0 0 6px var(--gold);animation:pulse 2s infinite;display:inline-block;margin-right:4px;}
  .sdot.closed{background:var(--dim);box-shadow:none;animation:none;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
  .pnlv{font-family:var(--mono);font-size:12px;font-weight:700;}
  .obadge{font-family:var(--mono);font-size:8px;padding:2px 6px;letter-spacing:1px;margin-top:3px;display:inline-block;}
  .obadge.W{background:var(--gdim);color:var(--green);border:1px solid rgba(0,229,160,.3);}
  .obadge.L{background:var(--rdim);color:var(--red);border:1px solid rgba(255,77,106,.3);}
  .obadge.O{background:var(--ydim);color:var(--gold);border:1px solid rgba(245,197,66,.3);}
  .obadge.B{background:var(--bdim);color:var(--blue);border:1px solid rgba(77,159,255,.3);}
  .pos{color:var(--green);} .neg{color:var(--red);} .neu{color:var(--dim);}

  /* DETAIL */
  .tdetail{border-top:1px solid var(--border);background:var(--bg);padding:14px;}
  .dtitle{font-family:var(--mono);font-size:7px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);margin-bottom:10px;margin-top:14px;}
  .dtitle:first-child{margin-top:0;}
  .frow{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
  .fl{font-family:var(--mono);font-size:9px;color:var(--dim);}
  .fv{font-family:var(--mono);font-size:9px;color:var(--text);text-align:right;}
  .thesis{font-size:10px;color:var(--mid);line-height:1.75;font-family:var(--mono);}
  .etag{font-family:var(--mono);font-size:9px;padding:2px 7px;background:var(--surface);border:1px solid var(--b2);color:var(--mid);display:inline-block;}
  .action-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}

  /* SCALE-INS */
  .sis{margin-top:14px;}
  .silabel{font-family:var(--mono);font-size:7px;letter-spacing:3px;text-transform:uppercase;color:var(--blue);margin-bottom:10px;display:flex;align-items:center;gap:8px;}
  .silabel::after{content:'';flex:1;height:1px;background:rgba(77,159,255,.2);}
  .sirow{background:var(--surface);border:1px solid var(--border);border-left:2px solid var(--blue);padding:10px 12px;margin-bottom:6px;}
  .si-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
  .sil{font-family:var(--mono);font-size:9px;color:var(--blue);font-weight:700;}
  .si-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .sif{font-family:var(--mono);font-size:9px;}
  .sif strong{display:block;font-size:7px;color:var(--dim);letter-spacing:1px;margin-bottom:2px;}
  .si-note{font-family:var(--mono);font-size:9px;color:var(--mid);margin-top:6px;padding-top:6px;border-top:1px solid var(--border);}

  .checklist{background:var(--s2);border:1px dashed var(--b2);padding:10px 12px;margin-bottom:8px;}
  .cl-title{font-family:var(--mono);font-size:7px;color:var(--blue);letter-spacing:2px;margin-bottom:8px;}
  .ci{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:9px;color:var(--dim);margin-bottom:5px;}
  .cbox{width:11px;height:11px;border:1px solid var(--b2);background:var(--surface);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:7px;}
  .cbox.ok{background:var(--gdim);border-color:var(--green);color:var(--green);}
  .add-si-btn{background:transparent;border:1px dashed var(--b2);color:var(--blue);font-family:var(--mono);font-size:9px;letter-spacing:2px;padding:10px;cursor:pointer;width:100%;text-align:center;transition:all .15s;}
  .add-si-btn:active{background:var(--bdim);}
  .empty-si{font-family:var(--mono);font-size:9px;color:var(--dim);padding:12px;background:var(--s2);border:1px solid var(--border);text-align:center;margin-bottom:8px;}

  /* CHECKINS */
  .ci-block{background:var(--s2);border:1px solid var(--border);padding:10px 12px;margin-bottom:6px;}
  .ci-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
  .ci-week{font-family:var(--mono);font-size:8px;color:var(--blue);letter-spacing:1px;}

  /* REVIEW */
  .rv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;}
  .rv-item{background:var(--s2);padding:8px 10px;border:1px solid var(--border);}
  .rv-l{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:1px;margin-bottom:3px;}
  .rv-v{font-family:var(--mono);font-size:9px;}

  /* MODAL */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:200;display:flex;align-items:flex-end;}
  .modal{background:var(--surface);border-top:1px solid var(--b2);width:100%;max-height:92dvh;overflow-y:auto;border-radius:12px 12px 0 0;}
  .mhead{background:var(--s2);border-bottom:1px solid var(--border);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;}
  .mtitle{font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--green);}
  .mbody{padding:16px;}
  .fgroup{margin-bottom:14px;}
  .flabel{font-family:var(--mono);font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:5px;display:block;}
  input,select,textarea{width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:12px;padding:10px 12px;outline:none;transition:border-color .2s;border-radius:0;-webkit-appearance:none;appearance:none;}
  input:focus,select:focus,textarea:focus{border-color:var(--green);}
  textarea{resize:none;min-height:80px;line-height:1.6;}
  .fgrid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .fgrid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
  .mfoot{padding:14px 16px;border-top:1px solid var(--border);display:flex;gap:10px;position:sticky;bottom:0;background:var(--surface);z-index:10;}

  /* CHART */
  .chart-wrap{background:var(--surface);border:1px solid var(--border);padding:16px;margin-bottom:16px;}
  .chart-title{font-family:var(--mono);font-size:8px;letter-spacing:2px;color:var(--dim);margin-bottom:12px;text-transform:uppercase;}
  .chart-metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border);margin-bottom:16px;}
  .cm{background:var(--surface);padding:12px;}
  .cm-l{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;}
  .cm-v{font-family:var(--mono);font-size:14px;font-weight:700;}
  .cm-s{font-family:var(--mono);font-size:8px;color:var(--dim);margin-top:2px;}

  /* PAIR TABLE */
  .ptable{background:var(--surface);border:1px solid var(--border);margin-bottom:16px;}
  .pth{display:grid;grid-template-columns:90px 50px 50px 70px;gap:0;background:var(--s2);padding:8px 12px;font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:2px;text-transform:uppercase;}
  .ptr{display:grid;grid-template-columns:90px 50px 50px 70px;gap:0;padding:10px 12px;border-top:1px solid var(--border);font-family:var(--mono);font-size:10px;align-items:center;}

  .no-data{text-align:center;padding:40px 20px;font-family:var(--mono);font-size:10px;color:var(--dim);}
  .divider{height:1px;background:var(--border);margin:20px 0;}

  /* WEEKLY */
  .wcard{background:var(--surface);border:1px solid var(--border);padding:16px;margin-bottom:10px;}
  .wstats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;}
  .ws{background:var(--s2);padding:10px;border:1px solid var(--border);}
  .ws-l{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:1px;margin-bottom:3px;}
  .ws-v{font-family:var(--mono);font-size:12px;}
`;

// ── App ──
export default function App() {
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState("journal");
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null); // { type, tradeId?, week? }
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fx-journal-trades");
      if (saved) setTrades(JSON.parse(saved));
    } catch(e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem("fx-journal-trades", JSON.stringify(trades)); } catch(e) {}
  }, [trades, loaded]);

  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const addTrade = data => { setTrades(t => [...t, { ...data, id: genId(), scaleIns: [], checkins: [], review: null }]); setModal(null); };
  const addSI = (tradeId, data) => { setTrades(t => t.map(tr => tr.id === tradeId ? { ...tr, scaleIns: [...tr.scaleIns, { ...data, id: genId() }] } : tr)); setModal(null); };
  const deleteSI = (tradeId, siId) => setTrades(t => t.map(tr => tr.id === tradeId ? { ...tr, scaleIns: tr.scaleIns.filter(s => s.id !== siId) } : tr));
  const saveReview = (tradeId, data) => { setTrades(t => t.map(tr => tr.id === tradeId ? { ...tr, review: data, status: "closed" } : tr)); setModal(null); };
  const saveCheckin = (tradeId, week, text) => { setTrades(t => t.map(tr => tr.id === tradeId ? { ...tr, checkins: [...(tr.checkins||[]).filter(c=>c.week!==week), { week, text }] } : tr)); setModal(null); };
  const deleteTrade = id => { if (window.confirm("Delete this trade?")) setTrades(t => t.filter(tr => tr.id !== id)); };

  const closed = trades.filter(t => t.status === "closed");
  const open = trades.filter(t => t.status !== "closed");
  const wins = closed.filter(t => t.review?.outcome === "W");
  const totalPnl = closed.reduce((a, t) => a + (parseFloat(t.review?.pnlDollar) || 0), 0);
  const winRate = closed.length ? Math.round(wins.length / closed.length * 100) : 0;
  const avgHold = closed.length ? Math.round(closed.reduce((a, t) => {
    if (!t.review?.dateClosed || !t.dateOpened) return a;
    return a + Math.abs((new Date(t.review.dateClosed) - new Date(t.dateOpened)) / 86400000);
  }, 0) / closed.length) : 0;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav>
          <div className="logo">FX<span>//</span>SWING</div>
          <div className="nav-r">
            <div className="ns"><div className="ns-l">P&L</div><div className={`ns-v ${totalPnl>=0?"pos":"neg"}`}>{fmt(totalPnl)}</div></div>
            <div className="ns"><div className="ns-l">Win%</div><div className="ns-v pos">{winRate}%</div></div>
          </div>
        </nav>

        <div className="scroll">
          <div className="main">
            {tab === "journal" && <JournalTab trades={trades} open={open} closed={closed} expanded={expanded} toggle={toggle} setModal={setModal} deleteSI={deleteSI} deleteTrade={deleteTrade} />}
            {tab === "stats" && <StatsTab trades={trades} closed={closed} wins={wins} totalPnl={totalPnl} winRate={winRate} avgHold={avgHold} />}
            {tab === "weekly" && <WeeklyTab trades={trades} />}
          </div>
        </div>

        <div className="btabs">
          {[["journal","📋","Journal"],["stats","📊","Stats"],["weekly","📅","Weekly"]].map(([id,icon,label]) => (
            <div key={id} className={`btab ${tab===id?"active":""}`} onClick={() => setTab(id)}>
              <span className="btab-icon">{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>

      {modal?.type === "newTrade" && <NewTradeModal onSave={addTrade} onClose={() => setModal(null)} />}
      {modal?.type === "newSI" && <NewSIModal tradeId={modal.tradeId} trades={trades} onSave={addSI} onClose={() => setModal(null)} />}
      {modal?.type === "review" && <ReviewModal tradeId={modal.tradeId} trades={trades} onSave={saveReview} onClose={() => setModal(null)} />}
      {modal?.type === "checkin" && <CheckinModal tradeId={modal.tradeId} week={modal.week} trades={trades} onSave={saveCheckin} onClose={() => setModal(null)} />}
    </>
  );
}

// ── Journal Tab ──
function JournalTab({ trades, open, closed, expanded, toggle, setModal, deleteSI, deleteTrade }) {
  return (
    <>
      <button className="btn btn-green btn-full" onClick={() => setModal({ type: "newTrade" })}>+ New Trade</button>
      {trades.length === 0 && <div className="no-data">No trades yet — tap "+ New Trade" to start</div>}
      {open.length > 0 && <>
        <div className="slabel">Open ({open.length})</div>
        {open.map(t => <TradeCard key={t.id} trade={t} expanded={expanded[t.id]} onToggle={() => toggle(t.id)} setModal={setModal} deleteSI={deleteSI} deleteTrade={deleteTrade} />)}
      </>}
      {closed.length > 0 && <>
        <div className="divider" />
        <div className="slabel">Closed ({closed.length})</div>
        {closed.map(t => <TradeCard key={t.id} trade={t} expanded={expanded[t.id]} onToggle={() => toggle(t.id)} setModal={setModal} deleteSI={deleteSI} deleteTrade={deleteTrade} />)}
      </>}
    </>
  );
}

function TradeCard({ trade, expanded, onToggle, setModal, deleteSI, deleteTrade }) {
  const isClosed = trade.status === "closed";
  const totalPnl = (parseFloat(trade.review?.pnlDollar) || 0) + trade.scaleIns.reduce((a, s) => a + (parseFloat(s.pnlDollar) || 0), 0);
  const outcomeMap = { W: "WIN ✅", L: "LOSS ❌", B: "BE ➖", P: "PARTIAL 🔶" };

  return (
    <div className={`tcard ${!isClosed ? "open-t" : ""}`}>
      <div className="thead" onClick={onToggle}>
        <div className={`tog ${expanded ? "exp" : ""}`}>{expanded ? "−" : "+"}</div>
        <div className="t-info">
          <div className="t-pair">{trade.pair} <span className={`dir ${trade.direction}`}>{trade.direction === "L" ? "LONG" : "SHORT"}</span></div>
          <div className="t-sub">
            <span className={`sdot ${isClosed ? "closed" : ""}`} />
            {trade.dateOpened?.slice(0,10)} · {trade.scaleIns.length} add{trade.scaleIns.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="t-right">
          <div className={`pnlv ${isClosed ? (totalPnl >= 0 ? "pos" : "neg") : "neu"}`}>{isClosed ? fmt(totalPnl) : "OPEN"}</div>
          <div>{isClosed ? <span className={`obadge ${trade.review?.outcome||"B"}`}>{outcomeMap[trade.review?.outcome]||"—"}</span> : <span className="obadge O">LIVE</span>}</div>
        </div>
      </div>

      {expanded && (
        <div className="tdetail">
          {/* Trade info */}
          <div className="dtitle">Trade Details</div>
          <div className="frow"><span className="fl">ENTRY</span><span className="fv">{trade.entryPrice||"—"}</span></div>
          <div className="frow"><span className="fl">STOP LOSS</span><span className="fv" style={{color:"var(--red)"}}>{trade.stopLoss||"—"}</span></div>
          <div className="frow"><span className="fl">TAKE PROFIT</span><span className="fv" style={{color:"var(--green)"}}>{trade.takeProfit||"—"}</span></div>
          <div className="frow"><span className="fl">LOT SIZE</span><span className="fv">{trade.lotSize||"—"}</span></div>
          <div className="frow"><span className="fl">SETUP</span><span className="fv">{trade.setup||"—"}</span></div>
          <div className="frow"><span className="fl">TIMEFRAME</span><span className="fv">{trade.timeframe||"—"}</span></div>
          <div className="frow"><span className="fl">EMOTION</span><span className="etag">{trade.emotion||"—"}</span></div>

          {/* Thesis */}
          {trade.thesis && <>
            <div className="dtitle">Thesis</div>
            <div className="thesis">{trade.thesis}</div>
          </>}
          {trade.invalidation && <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--red)",marginTop:6}}>⚠ Invalidated if: {trade.invalidation}</div>}

          {/* Check-ins */}
          <div className="dtitle">Emotional Check-Ins</div>
          {[1,2,3].map(w => {
            const ci = trade.checkins?.find(c => c.week === w);
            return (
              <div key={w} className="ci-block">
                <div className="ci-head">
                  <span className="ci-week">WEEK {w}</span>
                  {!isClosed && <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type:"checkin", tradeId:trade.id, week:w })}>{ci?"Edit":"+ Log"}</button>}
                </div>
                {ci ? <div className="thesis" style={{fontSize:9}}>{ci.text}</div> : <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--dim)"}}>Not logged</div>}
              </div>
            );
          })}

          {/* Post-trade review */}
          {isClosed && trade.review && <>
            <div className="dtitle">Post-Trade Review</div>
            <div className="rv-grid">
              <div className="rv-item"><div className="rv-l">THESIS RIGHT?</div><div className="rv-v">{trade.review.thesisRight||"—"}</div></div>
              <div className="rv-item"><div className="rv-l">ADD TIMING</div><div className="rv-v">{trade.review.addQuality||"—"}</div></div>
              <div className="rv-item"><div className="rv-l">EXIT QUALITY</div><div className="rv-v">{trade.review.exitQuality||"—"}</div></div>
              <div className="rv-item"><div className="rv-l">PATIENCE</div><div className="rv-v">{trade.review.patience||"—"}</div></div>
              <div className="rv-item"><div className="rv-l">R:R</div><div className={`rv-v ${parseFloat(trade.review.rr)>0?"pos":""}`}>{trade.review.rr||"—"}R</div></div>
              <div className="rv-item"><div className="rv-l">HOLD TIME</div><div className="rv-v">{trade.review.dateClosed && trade.dateOpened ? Math.abs(Math.round((new Date(trade.review.dateClosed)-new Date(trade.dateOpened))/86400000))+"d" : "—"}</div></div>
            </div>
            {trade.review.lesson && <div style={{background:"var(--s2)",border:"1px solid var(--border)",padding:"10px 12px",marginTop:10}}><div style={{fontFamily:"var(--mono)",fontSize:7,color:"var(--gold)",letterSpacing:2,marginBottom:5}}>KEY LESSON</div><div className="thesis" style={{fontSize:9}}>{trade.review.lesson}</div></div>}
          </>}

          {/* Scale-ins */}
          <div className="sis">
            <div className="silabel">Scale-In Entries</div>
            {trade.scaleIns.length === 0 && <div className="empty-si">No scale-ins yet — waiting for +0.5% in your favor</div>}
            {trade.scaleIns.map((si, i) => (
              <div key={si.id} className="sirow">
                <div className="si-top">
                  <span className="sil">ADD #{i+1} · {si.date?.slice(0,10)||"—"}</span>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span className={parseFloat(si.pnlDollar)>=0?"pos":"neg"} style={{fontFamily:"var(--mono)",fontSize:10}}>{fmt(si.pnlDollar)}</span>
                    {<button className="btn btn-red btn-sm" onClick={() => deleteSI(trade.id, si.id)}>✕</button>}
                  </div>
                </div>
                <div className="si-grid">
                  <div className="sif"><strong>ENTRY</strong>{si.entryPrice||"—"}</div>
                  <div className="sif"><strong>SL</strong>{si.stopLoss||"—"}</div>
                  <div className="sif"><strong>LOT</strong>{si.lotSize||"—"}</div>
                </div>
                {si.note && <div className="si-note">{si.note}</div>}
              </div>
            ))}

            {!isClosed && trade.scaleIns.length < 3 && <>
              <div className="checklist">
                <div className="cl-title">PRE-ADD CHECKLIST — ADD #{trade.scaleIns.length+1}</div>
                <div className="ci"><div className="cbox ok">✓</div>+0.5% in my favor</div>
                <div className="ci"><div className="cbox ok">✓</div>Previous SL → breakeven</div>
                <div className="ci"><div className="cbox">  </div>New SL = previous entry</div>
                <div className="ci"><div className="cbox">  </div>Risking 0.5% on this add</div>
              </div>
              <button className="add-si-btn" onClick={() => setModal({ type:"newSI", tradeId:trade.id })}>+ ADD SCALE-IN</button>
            </>}
          </div>

          <div className="action-row">
            {!isClosed && <button className="btn btn-blue btn-sm" onClick={() => setModal({ type:"review", tradeId:trade.id })}>✅ Close Trade</button>}
            <button className="btn btn-red btn-sm" onClick={() => deleteTrade(trade.id)}>🗑 Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats Tab ──
function StatsTab({ trades, closed, wins, totalPnl, winRate, avgHold }) {
  const equityCurve = buildEquityCurve(trades);
  const returns = closed.map(t => parseFloat(t.review?.pnlDollar) || 0);
  const sharpe = calcSharpe(returns);
  const profitFactor = calcProfitFactor(closed);
  const avgWin = wins.length ? wins.reduce((a, t) => a + (parseFloat(t.review?.pnlDollar)||0), 0) / wins.length : 0;
  const losses = closed.filter(t => t.review?.outcome === "L");
  const avgLoss = losses.length ? losses.reduce((a, t) => a + (parseFloat(t.review?.pnlDollar)||0), 0) / losses.length : 0;
  const totalSI = trades.reduce((a, t) => a + t.scaleIns.length, 0);

  // By pair
  const byPair = {};
  closed.forEach(t => {
    if (!byPair[t.pair]) byPair[t.pair] = { trades:0, wins:0, pnl:0 };
    byPair[t.pair].trades++;
    if (t.review?.outcome === "W") byPair[t.pair].wins++;
    byPair[t.pair].pnl += parseFloat(t.review?.pnlDollar) || 0;
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{background:"var(--surface)",border:"1px solid var(--b2)",padding:"8px 10px",fontFamily:"var(--mono)",fontSize:9}}>
        <div style={{color:"var(--dim)"}}>{d.pair} · {d.date}</div>
        <div className={d.equity>=0?"pos":"neg"}>{fmt(d.equity)}</div>
      </div>
    );
  };

  return (
    <>
      {/* Key Metrics */}
      <div className="slabel">Key Metrics</div>
      <div className="sgrid">
        <div className="scard"><div className="sc-l">Total Trades</div><div className="sc-v neu">{trades.length}</div><div className="sc-s">{closed.length} closed</div></div>
        <div className="scard"><div className="sc-l">Win Rate</div><div className={`sc-v ${winRate>=50?"pos":"neg"}`}>{winRate}%</div><div className="sc-s">{wins.length}/{closed.length}</div></div>
        <div className="scard"><div className="sc-l">Total P&L</div><div className={`sc-v ${totalPnl>=0?"pos":"neg"}`}>{fmt(totalPnl)}</div><div className="sc-s">all closed</div></div>
        <div className="scard"><div className="sc-l">Avg Hold</div><div className="sc-v neu">{avgHold}d</div><div className="sc-s">per trade</div></div>
      </div>

      {/* Advanced Metrics */}
      <div className="slabel">Advanced Analytics</div>
      <div className="chart-metrics">
        <div className="cm">
          <div className="cm-l">Sharpe Ratio</div>
          <div className={`cm-v ${sharpe>=1?"pos":sharpe>=0?"neu":"neg"}`}>{sharpe ?? "—"}</div>
          <div className="cm-s">{sharpe>=2?"Excellent":sharpe>=1?"Good":sharpe>=0?"Fair":"Poor"}</div>
        </div>
        <div className="cm">
          <div className="cm-l">Profit Factor</div>
          <div className={`cm-v ${parseFloat(profitFactor)>=1.5?"pos":parseFloat(profitFactor)>=1?"neu":"neg"}`}>{profitFactor}</div>
          <div className="cm-s">{parseFloat(profitFactor)>=2?"Strong":parseFloat(profitFactor)>=1.5?"Good":parseFloat(profitFactor)>=1?"Breakeven":"Losing"}</div>
        </div>
        <div className="cm">
          <div className="cm-l">Avg R:R</div>
          <div className="cm-v neu">
            {closed.length ? (closed.reduce((a,t)=>a+(parseFloat(t.review?.rr)||0),0)/closed.length).toFixed(1) : "—"}R
          </div>
          <div className="cm-s">achieved</div>
        </div>
      </div>

      <div className="sgrid">
        <div className="scard"><div className="sc-l">Avg Win</div><div className="sc-v pos">{fmt(avgWin)}</div></div>
        <div className="scard"><div className="sc-l">Avg Loss</div><div className="sc-v neg">{fmt(avgLoss)}</div></div>
        <div className="scard"><div className="sc-l">Total Adds</div><div className="sc-v" style={{color:"var(--blue)"}}>{totalSI}</div><div className="sc-s">scale-ins logged</div></div>
        <div className="scard"><div className="sc-l">Avg Adds</div><div className="sc-v" style={{color:"var(--blue)"}}>{trades.length?(totalSI/trades.length).toFixed(1):0}</div><div className="sc-s">per trade</div></div>
      </div>

      {/* Equity Curve */}
      <div className="slabel">Equity Curve</div>
      <div className="chart-wrap">
        <div className="chart-title">Cumulative P&L ($)</div>
        {equityCurve.length < 2
          ? <div className="no-data" style={{padding:"24px 0"}}>Need 2+ closed trades to show curve</div>
          : <ResponsiveContainer width="100%" height={180}>
              <LineChart data={equityCurve}>
                <XAxis dataKey="name" tick={{fontFamily:"var(--mono)",fontSize:8,fill:"var(--dim)"}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontFamily:"var(--mono)",fontSize:8,fill:"var(--dim)"}} axisLine={false} tickLine={false} width={45} tickFormatter={v=>`$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="var(--border2)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="equity" stroke="var(--green)" strokeWidth={2} dot={{ r:3, fill:"var(--green)", strokeWidth:0 }} activeDot={{ r:5 }} />
              </LineChart>
            </ResponsiveContainer>
        }
      </div>

      {/* By Pair */}
      {Object.keys(byPair).length > 0 && <>
        <div className="slabel">By Pair</div>
        <div className="ptable">
          <div className="pth"><span>PAIR</span><span>TRADES</span><span>WIN%</span><span>P&L</span></div>
          {Object.entries(byPair).sort((a,b)=>b[1].pnl-a[1].pnl).map(([pair,d]) => (
            <div key={pair} className="ptr">
              <span style={{fontWeight:700}}>{pair}</span>
              <span style={{color:"var(--mid)"}}>{d.trades}</span>
              <span className={d.wins/d.trades>=.5?"pos":"neg"}>{Math.round(d.wins/d.trades*100)}%</span>
              <span className={d.pnl>=0?"pos":"neg"}>{fmt(d.pnl)}</span>
            </div>
          ))}
        </div>
      </>}

      {trades.length === 0 && <div className="no-data">No data yet — log trades in the Journal tab</div>}
    </>
  );
}

// ── Weekly Tab ──
function WeeklyTab({ trades }) {
  const [note, setNote] = useState(() => { try { return localStorage.getItem("fx-weekly-note")||""; } catch(e){return "";} });

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10);
  })();

  const thisWeek = trades.filter(t => t.dateOpened >= weekStart);
  const closedW = thisWeek.filter(t=>t.status==="closed");
  const winsW = closedW.filter(t=>t.review?.outcome==="W");
  const pnlW = closedW.reduce((a,t)=>a+(parseFloat(t.review?.pnlDollar)||0),0);

  const save = () => { try { localStorage.setItem("fx-weekly-note", note); } catch(e){} alert("Saved!"); };

  return (
    <>
      <div className="slabel">Week of {weekStart}</div>
      <div className="wcard">
        <div className="wstats">
          <div className="ws"><div className="ws-l">OPENED</div><div className="ws-v neu">{thisWeek.length}</div></div>
          <div className="ws"><div className="ws-l">W/L</div><div className="ws-v">{winsW.length}/{closedW.length-winsW.length}</div></div>
          <div className="ws"><div className="ws-l">P&L</div><div className={`ws-v ${pnlW>=0?"pos":"neg"}`}>{fmt(pnlW)}</div></div>
        </div>
        <div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--dim)",letterSpacing:2,marginBottom:8}}>WEEKLY REFLECTION</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder={"Patience this week?\nAny early exits?\nScale-ins on time?\nKey lesson..."} style={{marginBottom:10}} />
        <button className="btn btn-green" onClick={save}>Save Reflection</button>
      </div>

      <div className="slabel">Sharpe &amp; Risk Reminder</div>
      <div style={{background:"var(--surface)",border:"1px solid var(--border)",padding:"14px"}}>
        <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--mid)",lineHeight:1.8}}>
          <div style={{color:"var(--gold)",marginBottom:6,letterSpacing:1}}>📐 YOUR SYSTEM RULES</div>
          Risk per entry: <span style={{color:"var(--green)"}}>0.5%</span><br/>
          Add when: <span style={{color:"var(--green)"}}>+0.5% in favor</span><br/>
          Move SL to BE on: <span style={{color:"var(--green)"}}>every add</span><br/>
          Max exposure: <span style={{color:"var(--green)"}}>1.5% (3 adds)</span><br/>
          Avg hold target: <span style={{color:"var(--green)"}}>2–4 weeks</span>
        </div>
      </div>
    </>
  );
}

// ── Modals ──
function NewTradeModal({ onSave, onClose }) {
  const [f, setF] = useState({ pair:"EUR/USD",direction:"L",dateOpened:new Date().toISOString().slice(0,10),entryPrice:"",stopLoss:"",takeProfit:"",lotSize:"",session:"London",setup:"Structure Break",timeframe:"Daily",emotion:"😌 Calm",thesis:"",invalidation:"",status:"open" });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mhead"><div className="mtitle">+ New Trade</div><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="fgrid2">
            <div className="fgroup"><label className="flabel">Pair</label><select value={f.pair} onChange={e=>s("pair",e.target.value)}>{PAIRS.map(p=><option key={p}>{p}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Direction</label><select value={f.direction} onChange={e=>s("direction",e.target.value)}><option value="L">Long 🟢</option><option value="S">Short 🔴</option></select></div>
          </div>
          <div className="fgrid3">
            <div className="fgroup"><label className="flabel">Entry</label><input value={f.entryPrice} onChange={e=>s("entryPrice",e.target.value)} placeholder="1.26840" /></div>
            <div className="fgroup"><label className="flabel">Stop Loss</label><input value={f.stopLoss} onChange={e=>s("stopLoss",e.target.value)} placeholder="1.25900" /></div>
            <div className="fgroup"><label className="flabel">Take Profit</label><input value={f.takeProfit} onChange={e=>s("takeProfit",e.target.value)} placeholder="1.29500" /></div>
          </div>
          <div className="fgrid2">
            <div className="fgroup"><label className="flabel">Lot Size</label><input value={f.lotSize} onChange={e=>s("lotSize",e.target.value)} placeholder="0.10" /></div>
            <div className="fgroup"><label className="flabel">Date</label><input type="date" value={f.dateOpened} onChange={e=>s("dateOpened",e.target.value)} /></div>
          </div>
          <div className="fgrid3">
            <div className="fgroup"><label className="flabel">Session</label><select value={f.session} onChange={e=>s("session",e.target.value)}>{SESSIONS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Setup</label><select value={f.setup} onChange={e=>s("setup",e.target.value)}>{SETUPS.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Timeframe</label><select value={f.timeframe} onChange={e=>s("timeframe",e.target.value)}>{TIMEFRAMES.map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="fgroup"><label className="flabel">Emotion at Entry</label><select value={f.emotion} onChange={e=>s("emotion",e.target.value)}>{EMOTIONS.map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="fgroup"><label className="flabel">Thesis</label><textarea value={f.thesis} onChange={e=>s("thesis",e.target.value)} placeholder="Why are you taking this trade? HTF context, key level, expected move..." /></div>
          <div className="fgroup"><label className="flabel">Invalidation</label><input value={f.invalidation} onChange={e=>s("invalidation",e.target.value)} placeholder="e.g. Daily close below 1.2590" /></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-green" style={{flex:2}} onClick={()=>f.entryPrice&&onSave(f)}>Log Trade</button>
        </div>
      </div>
    </div>
  );
}

function NewSIModal({ tradeId, trades, onSave, onClose }) {
  const trade = trades.find(t=>t.id===tradeId);
  const addNum = (trade?.scaleIns?.length||0)+1;
  const prevEntry = trade?.scaleIns?.length > 0 ? trade.scaleIns[trade.scaleIns.length-1].entryPrice : trade?.entryPrice;
  const [f, setF] = useState({ date:new Date().toISOString().slice(0,10),entryPrice:"",stopLoss:prevEntry||"",lotSize:"",pnlDollar:"",note:"" });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mhead"><div className="mtitle">➕ Add #{addNum} — {trade?.pair}</div><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div style={{background:"var(--bdim)",border:"1px solid rgba(77,159,255,.2)",padding:"8px 12px",marginBottom:14,fontFamily:"var(--mono)",fontSize:9,color:"var(--blue)"}}>
            Your SL for this add = {prevEntry||"—"} (previous entry)
          </div>
          <div className="fgrid2">
            <div className="fgroup"><label className="flabel">Date</label><input type="date" value={f.date} onChange={e=>s("date",e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Entry Price</label><input value={f.entryPrice} onChange={e=>s("entryPrice",e.target.value)} placeholder="1.27480" /></div>
          </div>
          <div className="fgrid3">
            <div className="fgroup"><label className="flabel">Stop Loss</label><input value={f.stopLoss} onChange={e=>s("stopLoss",e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Lot Size</label><input value={f.lotSize} onChange={e=>s("lotSize",e.target.value)} placeholder="0.10" /></div>
            <div className="fgroup"><label className="flabel">P&L $ (if closed)</label><input value={f.pnlDollar} onChange={e=>s("pnlDollar",e.target.value)} placeholder="+320" /></div>
          </div>
          <div className="fgroup"><label className="flabel">Why did you add?</label><textarea value={f.note} onChange={e=>s("note",e.target.value)} placeholder="+0.5% hit, moved main to BE, price broke structure..." /></div>
          <div className="checklist">
            <div className="cl-title">PRE-ADD CHECKLIST</div>
            <div className="ci"><div className="cbox ok">✓</div>+0.5% in my favor</div>
            <div className="ci"><div className="cbox ok">✓</div>Previous SL moved to breakeven</div>
            <div className="ci"><div className="cbox ok">✓</div>New SL = previous entry price</div>
            <div className="ci"><div className="cbox ok">✓</div>Risking 0.5% on this add</div>
          </div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-green" style={{flex:2}} onClick={()=>f.entryPrice&&onSave(tradeId,f)}>Log Scale-In</button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ tradeId, trades, onSave, onClose }) {
  const trade = trades.find(t=>t.id===tradeId);
  const [f, setF] = useState({ dateClosed:new Date().toISOString().slice(0,10),exitPrice:"",pnlDollar:"",pnlPips:"",rr:"",outcome:"W",exitQuality:"✅ On Plan",addQuality:"💯 Great timing",patience:"⭐⭐⭐",thesisRight:"Yes",emotionExit:"😌 Calm",lesson:"" });
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mhead"><div className="mtitle">✅ Close — {trade?.pair}</div><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div className="fgrid2">
            <div className="fgroup"><label className="flabel">Date Closed</label><input type="date" value={f.dateClosed} onChange={e=>s("dateClosed",e.target.value)} /></div>
            <div className="fgroup"><label className="flabel">Exit Price</label><input value={f.exitPrice} onChange={e=>s("exitPrice",e.target.value)} /></div>
          </div>
          <div className="fgrid3">
            <div className="fgroup"><label className="flabel">P&L ($)</label><input value={f.pnlDollar} onChange={e=>s("pnlDollar",e.target.value)} placeholder="+840" /></div>
            <div className="fgroup"><label className="flabel">P&L (pips)</label><input value={f.pnlPips} onChange={e=>s("pnlPips",e.target.value)} placeholder="+260" /></div>
            <div className="fgroup"><label className="flabel">R:R Achieved</label><input value={f.rr} onChange={e=>s("rr",e.target.value)} placeholder="3.2" /></div>
          </div>
          <div className="fgrid2">
            <div className="fgroup"><label className="flabel">Outcome</label><select value={f.outcome} onChange={e=>s("outcome",e.target.value)}><option value="W">Win ✅</option><option value="L">Loss ❌</option><option value="B">Breakeven ➖</option><option value="P">Partial 🔶</option></select></div>
            <div className="fgroup"><label className="flabel">Emotion at Exit</label><select value={f.emotionExit} onChange={e=>s("emotionExit",e.target.value)}>{EMOTIONS.map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="fgrid3">
            <div className="fgroup"><label className="flabel">Exit Quality</label><select value={f.exitQuality} onChange={e=>s("exitQuality",e.target.value)}>{EXIT_QUALITY.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Add-On Quality</label><select value={f.addQuality} onChange={e=>s("addQuality",e.target.value)}>{ADD_QUALITY.map(x=><option key={x}>{x}</option>)}</select></div>
            <div className="fgroup"><label className="flabel">Patience</label><select value={f.patience} onChange={e=>s("patience",e.target.value)}>{PATIENCE.map(x=><option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="fgroup"><label className="flabel">Thesis Right?</label><select value={f.thesisRight} onChange={e=>s("thesisRight",e.target.value)}><option>Yes</option><option>Partially</option><option>No</option></select></div>
          <div className="fgroup"><label className="flabel">Key Lesson</label><textarea value={f.lesson} onChange={e=>s("lesson",e.target.value)} placeholder="What will you do differently next time?" /></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-green" style={{flex:2}} onClick={()=>onSave(tradeId,f)}>Close Trade</button>
        </div>
      </div>
    </div>
  );
}

function CheckinModal({ tradeId, week, trades, onSave, onClose }) {
  const trade = trades.find(t=>t.id===tradeId);
  const existing = trade?.checkins?.find(c=>c.week===week);
  const [text, setText] = useState(existing?.text||"");
  return (
    <div className="overlay">
      <div className="modal">
        <div className="mhead"><div className="mtitle">🧠 Week {week} — {trade?.pair}</div><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <div className="mbody">
          <div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--dim)",marginBottom:12,lineHeight:1.8}}>How are you feeling? Urge to close early? Is your thesis still valid?</div>
          <div className="fgroup"><label className="flabel">Check-In</label><textarea value={text} onChange={e=>setText(e.target.value)} style={{minHeight:100}} placeholder="Price pulled back but thesis still valid. Staying patient..." /></div>
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-green" style={{flex:2}} onClick={()=>text&&onSave(tradeId,week,text)}>Save</button>
        </div>
      </div>
    </div>
  );
}
