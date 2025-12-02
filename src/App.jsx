import React, { useState, useEffect } from 'react';
import { 
  Cake, Users, ClipboardList, LogOut, PlusCircle, Menu, X, 
  DollarSign, ShoppingCart, Loader, Copy, Check, AlertCircle, 
  Upload, Image as ImageIcon, Trash2, Home as HomeIcon, Search, 
  MapPin, Phone, Clock, Settings, Edit, Save, List, Package, Store,
  Facebook, MessageCircle // Icon cho MXH
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, setDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- CẤU HÌNH ---
// Logo mặc định từ Google Drive của bạn
const DEFAULT_LOGO_URL = "https://drive.google.com/uc?export=view&id=1GTA2aVIhwVn6hHnhlLY2exJVVJYzZOov";

const DEFAULT_FIREBASE_CONFIG = {
 apiKey: "AIzaSyBM8pividJcQ4EgXQ3pIVdXqz_pyQB8rPA",
  authDomain: "meo-bakery-4c04f.firebaseapp.com",
  projectId: "meo-bakery-4c04f",
  storageBucket: "meo-bakery-4c04f.firebasestorage.app",
  messagingSenderId: "289466483676",
  appId: "1:289466483676:web:92f6abd8b8e1f9077c4519"
};

// --- KHỞI TẠO FIREBASE ---
let firebaseConfig;
let appId;
let firebaseConfigError = null;

try {
    let envConfigJson = null;
    try { envConfigJson = process.env.REACT_APP_FIREBASE_CONFIG; } catch (e) {}

    if (envConfigJson) {
        firebaseConfig = JSON.parse(envConfigJson);
        appId = firebaseConfig.appId.split(':').pop() || 'default-app-id'; 
    } else if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        firebaseConfig = JSON.parse(__firebase_config);
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    } else {
        firebaseConfig = DEFAULT_FIREBASE_CONFIG;
        appId = 'default-app-id';
        try {
             if (process.env.NODE_ENV === 'production') {
                 firebaseConfigError = "Thiếu biến môi trường REACT_APP_FIREBASE_CONFIG trên Vercel!";
             }
        } catch(e) {}
    }
} catch (e) {
    firebaseConfigError = "Lỗi cú pháp JSON trong REACT_APP_FIREBASE_CONFIG.";
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    appId = 'default-app-id';
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- HẰNG SỐ & HÀM HỖ TRỢ ---
const ROLES = { OWNER: 'owner', MANAGER: 'manager', SALES: 'sales', BAKER: 'baker', PENDING: 'pending' };
const ROLE_LABELS = { [ROLES.OWNER]: 'Chủ tiệm', [ROLES.MANAGER]: 'Quản lý', [ROLES.SALES]: 'Bán hàng', [ROLES.BAKER]: 'Thợ bánh', [ROLES.PENDING]: 'Chờ duyệt' };
const OWNER_PHONE = '0868679094';

// Hàm nén ảnh (Giữ lại để tối ưu dung lượng lưu trữ)
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; 
        let width = img.width; let height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

// --- CÁC COMPONENT NHỎ ---
const Logo = ({ className, customUrl }) => (
  <div className={`flex items-center gap-3 font-bold text-2xl text-orange-600 ${className}`} style={{ fontFamily: 'Quicksand, sans-serif' }}>
    <img src={customUrl || DEFAULT_LOGO_URL} alt="Logo" className="h-12 w-auto object-contain" onError={(e) => {e.target.style.display='none'}} />
    <span className="tracking-tight">BanhKemMeo.vn</span>
  </div>
);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  const msg = typeof message === 'string' ? message : 'Thao tác thành công';
  return (
    <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white font-medium flex items-center gap-3 animate-fade-in-down ${type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle size={20}/> : <Check size={20}/>} {msg}
    </div>
  );
};

const ImagePreviewModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in-up" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full"><X size={32} /></button>
      <img src={src} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
};

const SidebarItem = ({ icon, label, active, onClick, visible = true }) => {
  if (!visible) return null;
  return (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-700'}`}>{icon}<span>{label}</span></button>);
};

// --- CÁC MÀN HÌNH CHỨC NĂNG (DÀNH CHO NHÂN VIÊN) ---

const SettingsPanel = ({ categories, products, settings, onAddCategory, onDeleteCategory, onSaveProduct, onDeleteProduct, onSaveSettings }) => {
  const [newCat, setNewCat] = useState("");
  const [prodForm, setProdForm] = useState({ id: null, name: "", price: "", category: "", image: null, tag: "" });
  const [isEditing, setIsEditing] = useState(false);
  // Mặc định các link liên hệ rỗng
  const [shopSettings, setShopSettings] = useState({ logoUrl: DEFAULT_LOGO_URL, shopName: "BanhKemMeo.vn", hotline: "0868679094", zaloLink: "", fbLink: "" });

  useEffect(() => { if (settings) setShopSettings(prev => ({ ...prev, ...settings })); }, [settings]);
  const handleProductImage = async (e) => { if(e.target.files[0]) setProdForm({...prodForm, image: await compressImage(e.target.files[0])}); };
  const submitProduct = (e) => { e.preventDefault(); onSaveProduct(prodForm); setProdForm({ id: null, name: "", price: "", category: "", image: null, tag: "" }); setIsEditing(false); };
  
  return (
    <div className="space-y-8 pb-10">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Store className="text-orange-500"/> Cài Đặt Cửa Hàng & Liên Hệ</h2>
        <form onSubmit={(e)=>{e.preventDefault(); onSaveSettings(shopSettings)}} className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div><label className="text-sm font-medium text-gray-600">Tên Tiệm</label><input className="w-full p-2 border rounded-lg" value={shopSettings.shopName||""} onChange={e=>setShopSettings({...shopSettings, shopName: e.target.value})} /></div>
           <div><label className="text-sm font-medium text-gray-600">Link Logo (URL)</label><input className="w-full p-2 border rounded-lg" value={shopSettings.logoUrl||""} onChange={e=>setShopSettings({...shopSettings, logoUrl: e.target.value})} /></div>
           <div><label className="text-sm font-medium text-gray-600">Hotline</label><input className="w-full p-2 border rounded-lg" value={shopSettings.hotline||""} onChange={e=>setShopSettings({...shopSettings, hotline: e.target.value})} /></div>
           <div><label className="text-sm font-medium text-gray-600">Link Zalo (https://zalo.me/...)</label><input className="w-full p-2 border rounded-lg" placeholder="https://zalo.me/0868679094" value={shopSettings.zaloLink||""} onChange={e=>setShopSettings({...shopSettings, zaloLink: e.target.value})} /></div>
           <div><label className="text-sm font-medium text-gray-600">Link Facebook</label><input className="w-full p-2 border rounded-lg" placeholder="https://facebook.com/..." value={shopSettings.fbLink||""} onChange={e=>setShopSettings({...shopSettings, fbLink: e.target.value})} /></div>
           <div className="md:col-span-2"><button type="submit" className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold w-full hover:bg-orange-700"><Save size={18} className="inline mr-2"/> Lưu Cấu Hình</button></div>
        </form>
      </div>
      
      {/* Phần Quản lý Danh mục & Sản phẩm giữ nguyên logic cũ */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><List className="text-blue-500"/> Quản Lý Danh Mục</h2>
        <div className="flex gap-2 mb-4"><input className="flex-1 p-2 border rounded-lg" placeholder="Tên danh mục..." value={newCat} onChange={e=>setNewCat(e.target.value)}/><button onClick={()=>{onAddCategory(newCat);setNewCat("")}} className="bg-blue-500 text-white px-4 py-2 rounded-lg">Thêm</button></div>
        <div className="flex flex-wrap gap-2">{categories.map(c=><span key={c.id} className="bg-gray-100 border px-3 py-1 rounded-lg flex items-center gap-2 text-sm">{c.name} <button onClick={()=>onDeleteCategory(c.id)} className="text-red-500"><X size={14}/></button></span>)}</div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100" id="product-form">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Package/> Quản Lý Sản Phẩm</h2>
        <form onSubmit={submitProduct} className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-6 rounded-xl border ${isEditing?'bg-yellow-50 border-yellow-200':'bg-gray-50'}`}>
          <div className="md:col-span-2 font-bold flex justify-between"><span>{isEditing?'Sửa món':'Thêm món'}</span>{isEditing&&<button type="button" onClick={()=>{setIsEditing(false);setProdForm({id:null,name:"",price:"",category:"",image:null,tag:""})}} className="text-red-500 text-sm">Hủy</button>}</div>
          <input required className="p-2 border rounded" placeholder="Tên bánh" value={prodForm.name} onChange={e=>setProdForm({...prodForm, name: e.target.value})}/>
          <input required type="number" className="p-2 border rounded" placeholder="Giá" value={prodForm.price} onChange={e=>setProdForm({...prodForm, price: e.target.value})}/>
          <select className="p-2 border rounded" value={prodForm.category} onChange={e=>setProdForm({...prodForm, category: e.target.value})}><option value="">-- Danh mục --</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
          <input className="p-2 border rounded" placeholder="Tag (Hot...)" value={prodForm.tag} onChange={e=>setProdForm({...prodForm, tag: e.target.value})}/>
          <div className="md:col-span-2 flex items-center gap-4"><input type="file" accept="image/*" onChange={handleProductImage} />{prodForm.image && <img src={prodForm.image} className="h-12 w-12 rounded border"/>}</div>
          <button type="submit" className={`md:col-span-2 py-3 rounded-lg font-bold text-white ${isEditing?'bg-yellow-500':'bg-green-600'}`}>{isEditing?'Cập Nhật':'Thêm Mới'}</button>
        </form>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{products.map(p=><div key={p.id} className="border rounded-lg p-3 relative group"><img src={p.image||"https://via.placeholder.com/150"} className="w-full h-32 object-cover rounded mb-2"/><h4 className="font-bold truncate">{p.name}</h4><p className="text-orange-600 font-bold">{Number(p.price).toLocaleString()}đ</p><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2"><button onClick={()=>{setProdForm(p);setIsEditing(true);document.getElementById('product-form').scrollIntoView()}} className="bg-white p-2 rounded-full text-blue-600"><Edit size={18}/></button><button onClick={()=>onDeleteProduct(p.id)} className="bg-white p-2 rounded-full text-red-600"><Trash2 size={18}/></button></div></div>)}</div>
      </div>
    </div>
  );
};

const CreateOrderForm = ({ categories=[], onSubmit }) => {
  const [form, setForm] = useState({ customerName:'', phone:'', address:'', pickupTime:'', cakeType:'', requests:'', message:'', total:0, deposit:0 });
  const [images, setImages] = useState([]);
  const handleImageChange = async (e) => { const files=Array.from(e.target.files); if(files.length+images.length>5) return alert("Max 5 ảnh"); setImages([...images, ...await Promise.all(files.map(compressImage))]); };
  const handleSubmit = (e) => { e.preventDefault(); onSubmit({...form, remaining: form.total-form.deposit, sampleImages: images}); setForm({customerName:'',phone:'',address:'',pickupTime:'',cakeType:'',requests:'',message:'',total:0,deposit:0}); setImages([]); };
  const inputClass = "w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500";
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden relative">
      <div className="bg-orange-500 p-4 px-6 text-white font-bold text-xl flex items-center gap-2"><PlusCircle/> Tạo Đơn Mới</div>
      <form onSubmit={handleSubmit} className="p-6 grid md:grid-cols-2 gap-6">
         <div className="space-y-4">
           <h3 className="font-bold border-b pb-2">Khách Hàng</h3>
           <input required className={inputClass} placeholder="Tên khách" value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} />
           <input required className={inputClass} placeholder="SĐT" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
           <input className={inputClass} placeholder="Địa chỉ" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} />
           <input required type="datetime-local" className={inputClass} value={form.pickupTime} onChange={e=>setForm({...form, pickupTime: e.target.value})} />
         </div>
         <div className="space-y-4">
           <h3 className="font-bold border-b pb-2">Chi Tiết</h3>
           <select required className={inputClass} value={form.cakeType} onChange={e=>setForm({...form, cakeType: e.target.value})}><option value="">-- Loại bánh --</option>{categories.length>0?categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>):<option value="Khác">Khác</option>}</select>
           <textarea className={`${inputClass} h-20`} placeholder="Yêu cầu" value={form.requests} onChange={e=>setForm({...form, requests: e.target.value})} />
           <input className={inputClass} placeholder="Lời chúc" value={form.message} onChange={e=>setForm({...form, message: e.target.value})} />
         </div>
         <div className="md:col-span-2 mt-4">
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50"><Upload className="mb-2 text-gray-400"/><span className="text-sm text-gray-500">Tải ảnh mẫu (Max 5)</span><input type="file" hidden multiple accept="image/*" onChange={handleImageChange}/></label>
            {images.length>0 && <div className="flex gap-2 mt-4">{images.map((img,i)=><div key={i} className="relative w-20 h-20"><img src={img} className="w-full h-full object-cover rounded"/><button type="button" onClick={()=>setImages(images.filter((_,x)=>x!==i))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-full"><X size={12}/></button></div>)}</div>}
         </div>
         <div className="md:col-span-2 bg-orange-50 p-4 rounded-lg grid grid-cols-3 gap-4">
            <div><label className="text-sm font-bold">Tổng</label><input type="number" required className={inputClass} value={form.total} onChange={e=>setForm({...form, total: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-bold">Cọc</label><input type="number" className={inputClass} value={form.deposit} onChange={e=>setForm({...form, deposit: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-bold">Còn</label><div className="p-3 font-bold text-red-600 text-lg">{Number(form.total-form.deposit).toLocaleString()} đ</div></div>
         </div>
         <button type="submit" className="md:col-span-2 bg-orange-600 text-white py-3 rounded-lg font-bold shadow-lg">Tạo Đơn Ngay</button>
      </form>
    </div>
  );
};

const OrderList = ({ orders }) => {
  const [viewImg, setViewImg] = useState(null);
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Đơn Hàng</h2><span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold">{orders.length} đơn</span></div>
      {orders.length===0 ? <div className="text-center py-20 text-gray-400">Chưa có đơn hàng.</div> : 
      <div className="grid gap-4">{orders.map(o=>(
        <div key={o.id} className="bg-white p-5 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between gap-4">
           <div className="flex-1">
              <div className="flex gap-2 mb-2 items-center"><span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold">{o.cakeType}</span><span className="text-sm text-gray-400">#{o.orderId}</span></div>
              <h3 className="font-bold text-lg">{o.customerName} - {o.phone}</h3>
              <p className="text-sm text-gray-600">🕒 Lấy: {new Date(o.pickupTime).toLocaleString('vi-VN')}</p>
              <p className="text-sm text-gray-600">📍 {o.address}</p>
              {o.sampleImages?.length>0 && <div className="flex gap-2 mt-2">{o.sampleImages.map((img,i)=><img key={i} src={img} className="w-16 h-16 object-cover rounded border cursor-pointer" onClick={()=>setViewImg(img)}/>)}</div>}
              {o.message && <p className="text-sm text-orange-600 italic mt-1">"{o.message}"</p>}
           </div>
           <div className="text-right min-w-[120px]">
              <p className="text-xs text-gray-500">Tổng tiền</p><p className="font-bold text-lg">{Number(o.total).toLocaleString()}đ</p>
              <p className="text-xs text-gray-500 mt-2">Còn lại</p><p className="font-bold text-red-600 text-xl">{Number(o.total-o.deposit).toLocaleString()}đ</p>
              <div className="text-xs text-gray-400 mt-2">{o.createdBy}</div>
           </div>
        </div>
      ))}</div>}
      {viewImg && <ImagePreviewModal src={viewImg} onClose={()=>setViewImg(null)}/>}
    </div>
  );
};

const UserManagement = ({ users, currentUser, onUpdate }) => (
  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
    <div className="p-6 border-b font-bold text-xl flex gap-2"><Users/> Nhân Sự</div>
    <table className="w-full text-left">
      <thead className="bg-gray-50 text-gray-600 text-sm uppercase"><tr><th className="p-4">Tên</th><th className="p-4">SĐT</th><th className="p-4">Vai Trò</th>{currentUser?.role===ROLES.OWNER&&<th className="p-4 text-right">Sửa</th>}</tr></thead>
      <tbody>{users.map(u=><tr key={u.phone} className="border-t"><td className="p-4 font-medium">{u.name}</td><td className="p-4 text-gray-600">{u.phone}</td><td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold uppercase">{ROLE_LABELS[u.role]}</span></td>{currentUser?.role===ROLES.OWNER&&<td className="p-4 text-right">{u.phone!==OWNER_PHONE&&<select className="border rounded p-1 text-sm" value={u.role} onChange={e=>onUpdate(u.phone,e.target.value)}><option value={ROLES.PENDING}>Chờ duyệt</option><option value={ROLES.SALES}>Bán hàng</option><option value={ROLES.BAKER}>Thợ bánh</option><option value={ROLES.MANAGER}>Quản lý</option></select>}</td>}</tr>)}</tbody>
    </table>
  </div>
);

const AuthScreen = ({ type, onSwitch, onSubmit }) => {
  const [f, setF] = useState({name:'',phone:'',password:''});
  return (
    <div className="w-full"><form onSubmit={e=>{e.preventDefault();onSubmit(f.name,f.phone,f.password)}} className="space-y-4">{type==='register'&&<input required className="w-full p-3 border rounded" placeholder="Họ Tên" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>}<input required className="w-full p-3 border rounded" placeholder="SĐT" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/><input required type="password" className="w-full p-3 border rounded" placeholder="Mật khẩu" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded">{type==='login'?'Đăng Nhập':'Đăng Ký'}</button></form><button onClick={onSwitch} className="w-full mt-4 text-sm text-orange-600 hover:underline">{type==='login'?'Chưa có tài khoản? Đăng ký':'Đã có tài khoản? Đăng nhập'}</button></div>
  );
};

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null); const [appUser, setAppUser] = useState(null);
  const [usersList, setUsersList] = useState([]); const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]); const [categories, setCategories] = useState([]);
  const [shopSettings, setShopSettings] = useState({ logoUrl: DEFAULT_LOGO_URL, shopName: "BanhKemMeo.vn", hotline: "0868679094" });
  
  const [view, setView] = useState('landing'); const [tab, setTab] = useState('create-order'); 
  const [menuOpen, setMenuOpen] = useState(false); const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  if (firebaseConfigError) return <div className="h-screen flex items-center justify-center text-red-500 font-bold">{firebaseConfigError}</div>;

  // AUTH & DATA SYNC
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);
      } catch (e) { console.error("Auth Err:", e); }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    // Luôn tải dữ liệu
    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), d => { if(d.exists()) setShopSettings(prev=>({...prev, ...d.data()})) });
    const unsubProducts = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), s => setProducts(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsubCategories = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), s => setCategories(s.docs.map(d=>({id:d.id,...d.data()}))));

    let unsubUsers=()=>{}, unsubOrders=()=>{};
    if(user) {
        unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), s => {
            const list = s.docs.map(d=>({id: d.id, ...d.data()})); setUsersList(list);
            const saved = localStorage.getItem('bkm_phone'); 
            if(saved){ const u = list.find(x=>x.phone===saved); if(u){ setAppUser(u); if(view==='login') setView('dashboard'); } }
        });
        unsubOrders = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), s => setOrders(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
    }
    return () => { unsubSettings(); unsubProducts(); unsubCategories(); unsubUsers(); unsubOrders(); };
  }, [user, view]);

  const handleLogin = (phone, pass) => { const u = usersList.find(x=>x.phone===phone); if(u && u.password===pass) { setAppUser(u); localStorage.setItem('bkm_phone', phone); setView('dashboard'); setToast({message:`Chào ${u.name}`}); } else setToast({message:'Sai thông tin',type:'error'}); };
  const handleRegister = async (name, phone, pass) => { if(usersList.find(x=>x.phone===phone)) return setToast({message:'SĐT tồn tại',type:'error'}); try { await setDoc(doc(db,'artifacts',appId,'public','data','users',phone),{name,phone,password:pass,role:phone===OWNER_PHONE?ROLES.OWNER:ROLES.PENDING,createdAt:new Date().toISOString()}); setToast({message:'Đăng ký thành công'}); setView('login'); } catch(e){ setToast({message:'Lỗi ĐK',type:'error'}); } };

  const handleLogout = () => { setAppUser(null); localStorage.removeItem('bkm_phone'); setView('landing'); };

  const handleCreateOrder = async (orderData) => {
    try {
      const newOrder = { ...orderData, createdBy: appUser.name, createdAt: new Date().toISOString(), status: 'new', orderId: Date.now().toString().slice(-6) };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
      showToast('Tạo đơn thành công!');
      setTab('orders');
    } catch (e) { showToast('Lỗi: ' + e.message, 'error'); }
  };

  const handleUpdateRole = async (phone, newRole) => {
    try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', phone), { role: newRole }); showToast('Cập nhật quyền thành công'); } catch (e) { showToast('Lỗi cập nhật', 'error'); }
  };

  // SETTINGS ACTIONS
  const handleAddCategory = async (name) => { try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name }); showToast('Thêm danh mục OK'); } catch (e) { showToast('Lỗi', 'error'); } };
  const handleDeleteCategory = async (id) => { if(!window.confirm("Xóa?")) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id)); showToast('Đã xóa'); } catch (e) { showToast('Lỗi', 'error'); } };
  const handleSaveProduct = async (prodData) => { try { if (prodData.id) { const { id, ...data } = prodData; await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id), data); showToast('Cập nhật thành công'); } else { const { id, ...data } = prodData; await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), data); showToast('Thêm mới thành công'); } } catch (e) { showToast('Lỗi lưu', 'error'); } };
  const handleDeleteProduct = async (id) => { if(!window.confirm("Xóa sản phẩm?")) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id)); showToast('Đã xóa'); } catch (e) { showToast('Lỗi xóa', 'error'); } };
  const handleSaveSettings = async (newSettings) => { try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), newSettings); showToast('Đã lưu cấu hình!'); } catch (e) { showToast('Lỗi lưu', 'error'); } };

  const goToDashboard = () => { if (appUser) setView('dashboard'); else setView('login'); };

  if (view === 'loading') return <div className="h-screen flex items-center justify-center text-orange-500 font-sans"><Loader className="animate-spin" size={40}/></div>;

  // LANDING PAGE
  if (view === 'landing') return (
     <div className="min-h-screen bg-orange-50/30 font-sans flex flex-col" style={{fontFamily:'Quicksand'}}>
        {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
        <header className="bg-white sticky top-0 z-40 px-6 h-20 flex justify-between items-center shadow-sm">
            <Logo customUrl={shopSettings.logoUrl}/>
            <nav className="hidden md:flex gap-8 font-bold text-gray-600">
                <button onClick={()=>setView('landing')} className="hover:text-orange-600">Trang Chủ</button>
                <a href="#products" className="hover:text-orange-600">Sản Phẩm</a>
                <a href="#contact" className="hover:text-orange-600">Liên Hệ</a>
            </nav>
            <button onClick={()=>appUser?setView('dashboard'):setView('login')} className="hidden md:flex gap-2 bg-orange-500 text-white px-5 py-2 rounded-full font-bold shadow hover:bg-orange-600 transition"><Users size={18}/> Nhân Viên</button>
            <button className="md:hidden text-orange-600" onClick={()=>setMenuOpen(!menuOpen)}><Menu/></button>
        </header>
        {menuOpen && <div className="fixed inset-0 z-50 bg-white p-6 md:hidden flex flex-col gap-6 text-xl font-bold text-gray-700 animate-fade-in-up"><div className="flex justify-between"><Logo customUrl={shopSettings.logoUrl}/><button onClick={()=>setMenuOpen(false)}><X/></button></div><button onClick={()=>{setView('landing');setMenuOpen(false)}}>Trang Chủ</button><a href="#products" onClick={()=>setMenuOpen(false)}>Sản Phẩm</a><a href="#contact" onClick={()=>setMenuOpen(false)}>Liên Hệ</a><button onClick={()=>{if(appUser)setView('dashboard');else setView('login');setMenuOpen(false)}} className="text-orange-600 flex gap-2 items-center"><Users/> Dành Cho Nhân Viên</button></div>}
        
        <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white py-24 px-6 text-center relative overflow-hidden">
           <div className="relative z-10">
               <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-md leading-tight">Hương Vị Ngọt Ngào <br/> Trao Gửi Yêu Thương</h1>
               <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">Chào mừng đến với {shopSettings.shopName}</p>
               <a href="#products" className="bg-white text-orange-600 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-all inline-block">Xem Menu Ngay</a>
           </div>
        </div>

        <main id="products" className="max-w-7xl mx-auto p-6 py-16 w-full flex-1">
           <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Sản Phẩm Nổi Bật</h2>
           <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full mb-10"></div>
           {products.length===0 ? <div className="text-center py-20 text-gray-400">Cửa hàng đang cập nhật sản phẩm...</div> : 
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
               {products.map(p => (
                 <div key={p.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all overflow-hidden group border border-orange-100 flex flex-col h-full">
                    <div className="relative pt-[100%] bg-gray-100">
                      <img src={p.image||"https://via.placeholder.com/300?text=No+Image"} className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name}/>
                      {p.tag && <span className="absolute top-3 left-3 bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">{p.tag}</span>}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">{p.name}</h3>
                      <div className="mt-auto flex justify-between items-center border-t border-dashed border-gray-200 pt-3">
                         <span className="text-orange-600 font-extrabold text-xl">{Number(p.price).toLocaleString()} đ</span>
                         {shopSettings.zaloLink && <a href={shopSettings.zaloLink} target="_blank" rel="noreferrer" className="bg-blue-100 text-blue-600 p-2 rounded-full hover:bg-blue-600 hover:text-white transition-colors"><MessageCircle size={20}/></a>}
                      </div>
                    </div>
                 </div>
               ))}
             </div>
           }
        </main>

        <footer id="contact" className="bg-gray-900 text-gray-300 py-16 px-6">
           <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
              <div><Logo className="text-white mb-4" customUrl={shopSettings.logoUrl}/><p className="opacity-75 leading-relaxed">Chúng tôi cam kết mang đến những chiếc bánh kem tươi ngon nhất cho mọi dịp đặc biệt của bạn.</p></div>
              <div><h3 className="text-white font-bold text-lg mb-6 border-l-4 border-orange-500 pl-3">Liên Hệ</h3><ul className="space-y-4"><li className="flex items-center gap-3"><Phone className="text-orange-500"/> {shopSettings.hotline}</li><li className="flex items-center gap-3"><MapPin className="text-orange-500"/> 123 Đường Bánh Ngọt, TP.HCM</li></ul></div>
              <div><h3 className="text-white font-bold text-lg mb-6 border-l-4 border-orange-500 pl-3">Kết Nối</h3><div className="flex gap-4">{shopSettings.fbLink && <a href={shopSettings.fbLink} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90"><Facebook size={18}/> Facebook</a>}{shopSettings.zaloLink && <a href={shopSettings.zaloLink} target="_blank" rel="noreferrer" className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90"><MessageCircle size={18}/> Zalo</a>}</div></div>
           </div>
           <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-500">© 2024 {shopSettings.shopName}. All rights reserved.</div>
        </footer>
     </div>
  );

  if (view === 'login' || view === 'register') return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4 relative font-sans" style={{fontFamily:'Quicksand'}}>
       <button onClick={()=>setView('landing')} className="absolute top-6 left-6 bg-white px-4 py-2 rounded-full shadow text-gray-600 font-bold flex gap-2 hover:text-orange-600 transition"><HomeIcon size={18}/> Trang Chủ</button>
       {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
       <div className="bg-white w-full max-w-md p-10 rounded-3xl shadow-2xl border border-orange-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
          <Logo className="justify-center mb-6" customUrl={shopSettings.logoUrl}/><h2 className="text-2xl font-bold mb-6 text-gray-800">{view==='login'?'Đăng Nhập':'Đăng Ký'}</h2>
          <AuthScreen type={view} onSwitch={()=>setView(view==='login'?'register':'login')} onSubmit={view==='login'?handleLogin:handleRegister} />
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 flex font-sans" style={{fontFamily:'Quicksand'}}>
       {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
       <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0 z-20 shadow-sm">
          <div className="p-6 border-b cursor-pointer" onClick={()=>setView('landing')}><Logo customUrl={shopSettings.logoUrl}/></div>
          <nav className="flex-1 p-4 space-y-2">
             <SidebarItem icon={<PlusCircle/>} label="Tạo Đơn" active={tab==='create-order'} onClick={()=>setTab('create-order')} visible={appUser?.role!==ROLES.BAKER}/>
             <SidebarItem icon={<ClipboardList/>} label="Đơn Hàng" active={tab==='orders'} onClick={()=>setTab('orders')}/>
             <SidebarItem icon={<Users/>} label="Nhân Sự" active={tab==='users'} onClick={()=>setTab('users')} visible={appUser?.role===ROLES.OWNER||appUser?.role===ROLES.MANAGER}/>
             <SidebarItem icon={<Settings/>} label="Cài Đặt" active={tab==='settings'} onClick={()=>setTab('settings')} visible={appUser?.role===ROLES.OWNER}/>
          </nav>
          <div className="p-4 border-t bg-orange-50"><div className="font-bold text-orange-700 mb-2">{appUser?.name}</div><button onClick={()=>{setAppUser(null);localStorage.removeItem('bkm_phone');setView('landing')}} className="text-red-500 text-sm flex gap-2 items-center hover:underline"><LogOut size={14}/> Đăng xuất</button></div>
       </aside>
       
       <div className="md:hidden fixed top-0 w-full bg-white shadow-sm z-20 p-4 flex justify-between items-center">
          <Logo customUrl={shopSettings.logoUrl}/><button onClick={()=>setMenuOpen(!menuOpen)} className="text-orange-600"><Menu/></button>
       </div>
       {menuOpen && <div className="md:hidden fixed inset-0 z-30 bg-white pt-20 px-6 flex flex-col gap-4 text-lg font-bold text-gray-700 animate-fade-in-up">
           <button onClick={()=>setMenuOpen(false)} className="absolute top-4 right-4"><X/></button>
           <button onClick={()=>{setView('landing');setMenuOpen(false)}} className="text-left border-b pb-2">Về Trang Chủ</button>
           {appUser?.role!==ROLES.BAKER && <button onClick={()=>{setTab('create-order');setMenuOpen(false)}} className="text-left border-b pb-2">Tạo Đơn</button>}
           <button onClick={()=>{setTab('orders');setMenuOpen(false)}} className="text-left border-b pb-2">Đơn Hàng</button>
           <button onClick={()=>{setAppUser(null);localStorage.removeItem('bkm_phone');setView('landing')}} className="text-red-500 mt-4">Đăng Xuất</button>
       </div>}

       <main className="flex-1 p-4 md:p-8 overflow-y-auto mt-16 md:mt-0">
          <div className="max-w-6xl mx-auto">
             {tab==='create-order' && <CreateOrderForm categories={categories} onSubmit={handleCreateOrder} />}
             {tab==='orders' && <OrderList orders={orders} />}
             {tab==='users' && <UserManagement users={usersList} currentUser={appUser} onUpdate={handleUpdateRole} />}
             {tab==='settings' && <SettingsPanel categories={categories} products={products} settings={shopSettings} onAddCategory={async(n)=>{try{await addDoc(collection(db,'artifacts',appId,'public','data','categories'),{name:n});showToast('Thêm danh mục OK');}catch(e){showToast('Lỗi','error')}}} onDeleteCategory={async(id)=>{if(window.confirm('Xóa?'))try{await deleteDoc(doc(db,'artifacts',appId,'public','data','categories',id));showToast('Đã xóa');}catch(e){showToast('Lỗi','error')}}} onSaveProduct={async(p)=>{try{if(p.id){const{id,...d}=p;await updateDoc(doc(db,'artifacts',appId,'public','data','products',id),d);showToast('Sửa OK');}else{const{id,...d}=p;await addDoc(collection(db,'artifacts',appId,'public','data','products'),d);showToast('Thêm OK');}}catch(e){showToast('Lỗi lưu SP','error')}}} onDeleteProduct={async(id)=>{if(window.confirm('Xóa SP?'))try{await deleteDoc(doc(db,'artifacts',appId,'public','data','products',id));showToast('Đã xóa');}catch(e){showToast('Lỗi','error')}}} onSaveSettings={async(s)=>{try{await setDoc(doc(db,'artifacts',appId,'public','data','settings','general'),s);showToast('Lưu cấu hình OK');}catch(e){showToast('Lỗi','error')}}} />}
          </div>
       </main>
    </div>
  );
}
