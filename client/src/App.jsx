import { useEffect, useState } from "react";
import { Bot, Boxes, CreditCard, LayoutDashboard, MessageCircle, Package, RefreshCw, Send, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
const money = n => `$${Number(n || 0).toFixed(2)}`;

export default function App() {
  const [tab, setTab] = useState("Overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ products: 0, paidOrders: 0, pendingOrders: 0, revenue: 0 });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([{ role: "assistant", text: "Welcome to PayPilot AI. Ask me about products in the store catalogue." }]);
  const [form, setForm] = useState({ name: "", category: "General", description: "", price: "", stock: "10" });
  const [cart, setCart] = useState({});

  async function refresh() {
    setLoading(true);
    try {
      const [p, o, a] = await Promise.all([api("/api/products"), api("/api/orders"), api("/api/analytics")]);
      setProducts(p); setOrders(o); setStats(a);
    } catch (e) { setNotice(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function addProduct(e) {
    e.preventDefault(); setNotice("");
    try {
      await api("/api/products", { method: "POST", body: JSON.stringify({ ...form, price: Number(form.price), stock: Number(form.stock) }) });
      setForm({ name: "", category: "General", description: "", price: "", stock: "10" });
      setNotice("Product added."); refresh();
    } catch (e) { setNotice(e.message); }
  }
  async function askAI(e) {
    e.preventDefault(); if (!message.trim()) return;
    const question = message; setMessage(""); setChat(c => [...c, { role: "user", text: question }]);
    try {
      const data = await api("/api/ai/chat", { method: "POST", body: JSON.stringify({ message: question }) });
      setChat(c => [...c, { role: "assistant", text: data.reply }]);
    } catch (e) { setChat(c => [...c, { role: "assistant", text: e.message }]); }
  }
  async function checkout(productId) {
    try {
      const data = await api("/api/paypal/create-order", { method: "POST", body: JSON.stringify({ items: [{ productId, quantity: Number(cart[productId] || 1) }] }) });
      setNotice(`PayPal Sandbox order created: ${data.paypalOrderId}. Complete approval using the PayPal checkout flow before capture.`);
    } catch (e) { setNotice(e.message); }
  }

  const nav = [
    ["Overview", LayoutDashboard], ["AI Assistant", Bot], ["Products", Package], ["Orders", ShoppingBag], ["Payments", CreditCard], ["Analytics", TrendingUp]
  ];
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark"><Sparkles size={21}/></div><div><b>PayPilot AI</b><small>SMART COMMERCE</small></div></div>
      <div className="navlabel">WORKSPACE</div>
      {nav.map(([name, Icon]) => <button key={name} className={`navitem ${tab === name ? "active" : ""}`} onClick={() => setTab(name)}><Icon size={18}/>{name}</button>)}
      <div className="sidebottom"><div className="statusdot"/> Sandbox-ready starter <small>Build smarter. Sell better.</small></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="eyebrow">YOUR COMMERCE COMMAND CENTER</span><h1>{tab}</h1></div><button className="refresh" onClick={refresh}><RefreshCw size={16}/>{loading ? "Loading" : "Refresh"}</button></header>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {tab === "Overview" && <>
        <section className="hero"><div><span className="pill"><Sparkles size={13}/> AI-POWERED COMMERCE</span><h2>Run your store.<br/><em>Think smarter.</em></h2><p>One workspace for products, orders, customer conversations and payment workflows.</p><button className="primary" onClick={() => setTab("AI Assistant")}>Talk to your AI assistant <Send size={15}/></button></div><div className="heroart"><div className="orb"><Bot size={70}/></div><div className="orbit o1"/><div className="orbit o2"/><span className="float f1">✦ Smart insights</span><span className="float f2">↗ Store growth</span></div></section>
        <div className="stats">
          <Stat icon={Boxes} label="Active products" value={stats.products}/>
          <Stat icon={ShoppingBag} label="Paid orders" value={stats.paidOrders}/>
          <Stat icon={CreditCard} label="Pending orders" value={stats.pendingOrders}/>
          <Stat icon={TrendingUp} label="Verified revenue" value={money(stats.revenue)}/>
        </div>
        <section className="panel"><div className="panelhead"><div><h3>Recent orders</h3><p>Your latest store activity</p></div><button className="textbtn" onClick={() => setTab("Orders")}>View all →</button></div><OrdersTable orders={orders.slice(0,5)}/></section>
      </>}
      {tab === "AI Assistant" && <section className="panel chatpanel"><div className="panelhead"><div><h3><Bot size={19}/> PayPilot Assistant</h3><p>Product questions and catalogue guidance</p></div><span className="live">● ONLINE</span></div><div className="chatlog">{chat.map((m,i)=><div key={i} className={`bubble ${m.role}`}><span>{m.role === "assistant" ? "PAYPILOT AI" : "YOU"}</span>{m.text}</div>)}</div><form className="chatform" onSubmit={askAI}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask about products, categories or prices…"/><button className="primary" aria-label="Send"><Send size={17}/></button></form><small className="muted">AI responses can be inaccurate. Confirm product and order details in the dashboard.</small></section>}
      {tab === "Products" && <div className="columns"><section className="panel"><div className="panelhead"><div><h3>Product catalogue</h3><p>{products.length} products</p></div></div><div className="productlist">{products.map(p=><div className="product" key={p._id}><div className="producticon"><Package/></div><div className="grow"><b>{p.name}</b><small>{p.category} · Stock {p.stock}</small></div><strong>{money(p.price)}</strong><input className="qty" type="number" min="1" max="20" value={cart[p._id] || 1} onChange={e=>setCart(c=>({...c,[p._id]:e.target.value}))}/><button className="smallbtn" onClick={()=>checkout(p._id)}>Sandbox checkout</button></div>)}</div></section>
        <section className="panel"><h3>Add a product</h3><p className="muted">Create a catalogue item</p><form className="stack" onSubmit={addProduct}><input required placeholder="Product name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input placeholder="Category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><input required type="number" min="0" step="0.01" placeholder="Price (USD)" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><input required type="number" min="0" step="1" placeholder="Stock" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/><button className="primary">Add product</button></form></section></div>}
      {tab === "Orders" && <section className="panel"><div className="panelhead"><div><h3>Order management</h3><p>Payment status is updated only after server verification.</p></div></div><OrdersTable orders={orders}/></section>}
      {tab === "Payments" && <section className="panel"><div className="panelhead"><div><h3>PayPal Sandbox</h3><p>Development payment environment</p></div><span className="pill">SANDBOX</span></div><div className="paymentnote"><CreditCard size={30}/><div><b>Test payment workflow</b><p>Add products, then choose Sandbox checkout from the Products page. This starter creates a PayPal order on the server. A production checkout approval button and webhook verification should be added before launch.</p></div></div><p className="muted">Never enter real payment credentials into a development demo.</p></section>}
      {tab === "Analytics" && <section className="panel"><div className="panelhead"><div><h3>Business snapshot</h3><p>Calculated from saved database records</p></div></div><div className="stats analytic"><Stat icon={TrendingUp} label="Verified revenue" value={money(stats.revenue)}/><Stat icon={ShoppingBag} label="Paid orders" value={stats.paidOrders}/><Stat icon={CreditCard} label="Awaiting payment" value={stats.pendingOrders}/><Stat icon={Package} label="Active products" value={stats.products}/></div><p className="muted">Forecasting and deeper trend analysis are future enhancements, not included in this starter.</p></section>}
      <footer>PAYPILOT AI <span>·</span> Build Smarter. Sell Better. Grow Faster.</footer>
    </main>
  </div>;
}
function Stat({icon:Icon,label,value}) { return <div className="stat"><div className="staticon"><Icon size={19}/></div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function OrdersTable({orders}) { return <div className="tablewrap"><table><thead><tr><th>ORDER</th><th>DATE</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>{orders.map(o=><tr key={o._id}><td>#{o._id.slice(-7).toUpperCase()}</td><td>{new Date(o.createdAt).toLocaleDateString()}</td><td>{money(o.total)}</td><td><span className={`badge ${o.status.toLowerCase()}`}>{o.status}</span></td></tr>)}{!orders.length&&<tr><td colSpan="4" className="empty">No orders yet.</td></tr>}</tbody></table></div>; }
