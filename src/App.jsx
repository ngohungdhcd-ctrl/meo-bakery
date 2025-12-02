import React, { useState, useEffect } from 'react';
import { 
  Cake, Users, ClipboardList, LogOut, PlusCircle, Menu, X, 
  DollarSign, ShoppingCart, Loader, Copy, Check, AlertCircle, 
  Upload, Image as ImageIcon, Trash2, Home, Search, 
  MapPin, Phone, Clock, Settings, Edit, Save, List, Package, Store,
  Facebook, MessageCircle, Filter
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, setDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- CẤU HÌNH MẶC ĐỊNH ---
const DEFAULT_LOGO_URL = "https://drive.google.com/uc?export=view&id=1GTA2aVIhwVn6hHnhlLY2exJVVJYzZOov";
const DEFAULT_BANNER_URL = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=80";

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
                 firebaseConfigError = "Thiếu biến môi trường REACT_APP_FIREBASE_CONFIG!";
             }
        } catch(e) {}
    }
} catch (e) {
    firebaseConfigError = "Lỗi cú pháp JSON trong cấu hình Firebase.";
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    appId = 'default-app-id';
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- HẰNG SỐ & HELPER ---
const ROLES = { OWNER: 'owner', MANAGER: 'manager', SALES: 'sales', BAKER: 'baker', PENDING: 'pending' };
const ROLE_LABELS = { [ROLES.OWNER]: 'Chủ tiệm', [ROLES.MANAGER]: 'Quản lý', [ROLES.SALES]: 'Bán hàng', [ROLES.BAKER]: 'Thợ bánh', [ROLES.PENDING]: 'Chờ duyệt' };
const OWNER_PHONE = '0868679094';

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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

// --- COMPONENTS CHUNG ---
const Logo = ({ className, customUrl }) => (
  <div className={`flex items-center gap-2 font-bold text-2xl text-orange-600 ${className}`} style={{ fontFamily: 'Quicksand, sans-serif' }}>
    <img src={customUrl || DEFAULT_LOGO_URL} alt="Logo" className="h-10 w-auto object-contain" onError={(e) => {e.target.style.display='none'}} />
    <span className="tracking-tight">BanhKemMeo.vn</span>
  </div>
);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-3 animate-fade-in-down ${type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle size={20}/> : <Check size={20}/>} {typeof message === 'string' ? message : 'Thông báo'}
    </div>
  );
};

const ImagePreviewModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in-up" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={24}/></button>
      <img src={src} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
};

// --- COMPONENT QUẢN TRỊ (BACKEND) ---

const SidebarItem = ({ icon, label, active, onClick, visible = true }) => {
  if (!visible) return null;
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium mb-1 ${
        active ? 'bg-orange-600 text-white shadow-md' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'
      }`}
    >
      {icon} <span>{label}</span>
    </button>
  );
};

const ProductManager = ({ products, categories, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", price: "", category: "", image: null, tag: "" });
  const fileInputRef = useRef(null);

  const handleEdit = (prod) => { setForm(prod); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleCancel = () => { setForm({ id: null, name: "", price: "", category: "", image: null, tag: "" }); setIsEditing(false); if(fileInputRef.current) fileInputRef.current.value = ""; };
  
  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (file) setForm({...form, image: await compressImage(file)});
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
             {isEditing ? <Edit className="text-blue-500"/> : <PlusCircle className="text-green-500"/>} 
             {isEditing ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); onSave(form); handleCancel(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div><label className="text-sm font-medium text-gray-600">Tên bánh</label><input required className="w-full p-2 border rounded-lg" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="VD: Bánh kem dâu"/></div>
             <div><label className="text-sm font-medium text-gray-600">Giá bán</label><input required type="number" className="w-full p-2 border rounded-lg" value={form.price} onChange={e=>setForm({...form, price: e.target.value})} placeholder="VD: 350000"/></div>
             <div><label className="text-sm font-medium text-gray-600">Danh mục</label><select required className="w-full p-2 border rounded-lg" value={form.category} onChange={e=>setForm({...form, category: e.target.value})}><option value="">-- Chọn danh mục --</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
             <div><label className="text-sm font-medium text-gray-600">Tag (Mới, Hot...)</label><input className="w-full p-2 border rounded-lg" value={form.tag} onChange={e=>setForm({...form, tag: e.target.value})} placeholder="VD: Bán chạy"/></div>
             <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-600 block mb-2">Hình ảnh</label>
                <div className="flex items-center gap-4">
                   <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"/>
                   {form.image && <img src={form.image} className="h-16 w-16 object-cover rounded border" alt="Preview"/>}
                </div>
             </div>
             <div className="md:col-span-2 flex gap-2">
                <button type="submit" className={`flex-1 py-2 rounded-lg font-bold text-white ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>{isEditing ? 'Cập Nhật' : 'Thêm Mới'}</button>
                {isEditing && <button type="button" onClick={handleCancel} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>}
             </div>
          </form>
       </div>

       <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 font-bold text-gray-700">Danh Sách Sản Phẩm ({products.length})</div>
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-600 uppercase"><tr><th className="p-3">Ảnh</th><th className="p-3">Tên</th><th className="p-3">Giá</th><th className="p-3">Danh mục</th><th className="p-3 text-right">Hành động</th></tr></thead>
                <tbody className="divide-y">
                   {products.map(p => (
                      <tr key={p.id} className="hover:bg-orange-50/50">
                         <td className="p-3"><img src={p.image || "https://via.placeholder.com/50"} className="w-10 h-10 rounded object-cover border" alt=""/></td>
                         <td className="p-3 font-medium">{p.name} {p.tag && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{p.tag}</span>}</td>
                         <td className="p-3 text-orange-600 font-bold">{Number(p.price).toLocaleString()}</td>
                         <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{p.category}</span></td>
                         <td className="p-3 text-right">
                            <button onClick={()=>handleEdit(p)} className="text-blue-600 hover:text-blue-800 mr-3"><Edit size={16}/></button>
                            <button onClick={()=>{if(window.confirm('Xóa sản phẩm này?')) onDelete(p.id)}} className="text-red-600 hover:text-red-800"><Trash2 size={16}/></button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};

const SettingsManager = ({ categories, settings, onAddCat, onDeleteCat, onSaveSettings }) => {
   const [catName, setCatName] = useState("");
   const [shopConfig, setShopConfig] = useState(settings);

   useEffect(() => { if(settings) setShopConfig(settings); }, [settings]);

   return (
     <div className="grid md:grid-cols-2 gap-6">
        {/* Cấu hình Cửa hàng */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800"><Store size={20}/> Thông Tin Cửa Hàng</h3>
           <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500 uppercase">Tên cửa hàng</label><input className="w-full p-2 border rounded mt-1" value={shopConfig.shopName||""} onChange={e=>setShopConfig({...shopConfig, shopName: e.target.value})}/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Logo URL</label><input className="w-full p-2 border rounded mt-1" value={shopConfig.logoUrl||""} onChange={e=>setShopConfig({...shopConfig, logoUrl: e.target.value})}/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Hotline</label><input className="w-full p-2 border rounded mt-1" value={shopConfig.hotline||""} onChange={e=>setShopConfig({...shopConfig, hotline: e.target.value})}/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Zalo Link</label><input className="w-full p-2 border rounded mt-1" value={shopConfig.zaloLink||""} onChange={e=>setShopConfig({...shopConfig, zaloLink: e.target.value})}/></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Facebook Link</label><input className="w-full p-2 border rounded mt-1" value={shopConfig.fbLink||""} onChange={e=>setShopConfig({...shopConfig, fbLink: e.target.value})}/></div>
              <button onClick={()=>onSaveSettings(shopConfig)} className="w-full bg-orange-600 text-white py-2 rounded font-bold hover:bg-orange-700 mt-2">Lưu Thay Đổi</button>
           </div>
        </div>

        {/* Quản lý Danh mục */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800"><List size={20}/> Danh Mục Sản Phẩm</h3>
           <div className="flex gap-2 mb-4">
              <input className="flex-1 p-2 border rounded" placeholder="Tên danh mục mới..." value={catName} onChange={e=>setCatName(e.target.value)}/>
              <button onClick={()=>{if(catName){onAddCat(catName); setCatName("")}}} className="bg-blue-600 text-white px-4 rounded font-bold hover:bg-blue-700">Thêm</button>
           </div>
           <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {categories.map(cat => (
                 <div key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                    <span className="font-medium">{cat.name}</span>
                    <button onClick={()=>{if(window.confirm("Xóa danh mục này?")) onDeleteCat(cat.id)}} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={16}/></button>
                 </div>
              ))}
              {categories.length === 0 && <p className="text-gray-400 text-center text-sm italic">Chưa có danh mục nào.</p>}
           </div>
        </div>
     </div>
   );
};

const CreateOrderForm = ({ categories, onSubmit }) => {
  const [form, setForm] = useState({ customerName:'', phone:'', address:'', pickupTime:'', cakeType:'', requests:'', message:'', total:0, deposit:0 });
  const [images, setImages] = useState([]);
  const handleImage = async (e) => { const files=Array.from(e.target.files); if(files.length+images.length>5) return alert("Max 5 ảnh"); setImages([...images, ...await Promise.all(files.map(compressImage))]); };
  const handleSubmit = (e) => { e.preventDefault(); onSubmit({...form, remaining: form.total-form.deposit, sampleImages: images}); setForm({customerName:'',phone:'',address:'',pickupTime:'',cakeType:'',requests:'',message:'',total:0,deposit:0}); setImages([]); };
  const inputClass = "w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500";
  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
      <div className="bg-orange-600 p-4 text-white font-bold text-lg flex items-center gap-2"><PlusCircle/> Tạo Đơn Mới</div>
      <form onSubmit={handleSubmit} className="p-6 grid md:grid-cols-2 gap-6">
         <div className="space-y-4">
           <h4 className="font-bold text-gray-700 border-b pb-2">Thông tin khách</h4>
           <input required className={inputClass} placeholder="Tên khách hàng" value={form.customerName} onChange={e=>setForm({...form, customerName: e.target.value})} />
           <input required className={inputClass} placeholder="Số điện thoại" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
           <input className={inputClass} placeholder="Địa chỉ giao hàng" value={form.address} onChange={e=>setForm({...form, address: e.target.value})} />
           <input required type="datetime-local" className={inputClass} value={form.pickupTime} onChange={e=>setForm({...form, pickupTime: e.target.value})} />
         </div>
         <div className="space-y-4">
           <h4 className="font-bold text-gray-700 border-b pb-2">Chi tiết bánh</h4>
           <select required className={inputClass} value={form.cakeType} onChange={e=>setForm({...form, cakeType: e.target.value})}>
             <option value="">-- Chọn loại bánh --</option>
             {categories.length > 0 ? categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>) : <option value="Khác">Khác</option>}
           </select>
           <textarea className={`${inputClass} h-24`} placeholder="Yêu cầu chi tiết (size, cốt bánh, vị...)" value={form.requests} onChange={e=>setForm({...form, requests: e.target.value})} />
           <input className={inputClass} placeholder="Lời chúc ghi trên bánh" value={form.message} onChange={e=>setForm({...form, message: e.target.value})} />
         </div>
         <div className="md:col-span-2">
            <label className="block font-bold text-gray-700 mb-2">Ảnh mẫu (Max 5)</label>
            <div className="flex items-center gap-4">
                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="text-gray-400"/><span className="text-xs text-gray-500 mt-1">Thêm ảnh</span>
                    <input type="file" hidden multiple accept="image/*" onChange={handleImage}/>
                </label>
                <div className="flex gap-2 overflow-x-auto">{images.map((img,i)=><div key={i} className="relative w-24 h-24 group"><img src={img} className="w-full h-full object-cover rounded-lg border"/><button type="button" onClick={()=>setImages(images.filter((_,x)=>x!==i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow opacity-0 group-hover:opacity-100"><X size={12}/></button></div>)}</div>
            </div>
         </div>
         <div className="md:col-span-2 bg-orange-50 p-4 rounded-lg grid grid-cols-3 gap-4 border border-orange-100">
            <div><label className="text-sm font-bold text-gray-600">Tổng tiền</label><input type="number" required className="w-full p-2 border rounded font-bold" value={form.total} onChange={e=>setForm({...form, total: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-bold text-gray-600">Đã cọc</label><input type="number" className="w-full p-2 border rounded text-blue-600" value={form.deposit} onChange={e=>setForm({...form, deposit: Number(e.target.value)})} /></div>
            <div><label className="text-sm font-bold text-gray-600">Còn lại</label><div className="p-2 text-xl font-extrabold text-red-600">{Number(form.total-form.deposit).toLocaleString()} đ</div></div>
         </div>
         <button type="submit" className="md:col-span-2 bg-orange-600 text-white py-3 rounded-lg font-bold shadow hover:bg-orange-700 transition">Lưu Đơn Hàng</button>
      </form>
    </div>
  );
};

const OrderList = ({ orders }) => {
  const [viewImg, setViewImg] = useState(null);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Danh Sách Đơn Hàng ({orders.length})</h2>
      {orders.length===0 ? <div className="text-center py-10 text-gray-400 italic">Chưa có đơn hàng nào.</div> : 
      <div className="grid gap-4">
         {orders.map(o => (
            <div key={o.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-orange-200 transition relative overflow-hidden">
               <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
               <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center gap-2">
                        <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded uppercase">{o.cakeType}</span>
                        <span className="text-gray-400 text-xs">#{o.orderId}</span>
                        <span className="text-gray-400 text-xs ml-auto md:hidden">{new Date(o.createdAt).toLocaleDateString()}</span>
                     </div>
                     <div className="font-bold text-lg text-gray-800">{o.customerName} <span className="font-normal text-gray-500 text-sm">- {o.phone}</span></div>
                     <div className="text-sm text-gray-600 flex items-center gap-2"><Clock size={14}/> Lấy bánh: <strong>{new Date(o.pickupTime).toLocaleString('vi-VN')}</strong></div>
                     <div className="text-sm text-gray-600 flex items-center gap-2"><MapPin size={14}/> {o.address || 'Tại tiệm'}</div>
                     {o.requests && <div className="bg-gray-50 p-2 rounded text-sm text-gray-700 mt-2">📝 {o.requests}</div>}
                     {o.message && <div className="text-orange-600 text-sm italic">Lời chúc: "{o.message}"</div>}
                     {o.sampleImages?.length > 0 && <div className="flex gap-2 mt-2">{o.sampleImages.map((src, i) => <img key={i} src={src} className="w-12 h-12 rounded border object-cover cursor-pointer hover:opacity-80" onClick={()=>setViewImg(src)} alt=""/>)}</div>}
                  </div>
                  <div className="flex flex-col items-end justify-between min-w-[140px] border-t md:border-t-0 md:border-l md:pl-4 pt-4 md:pt-0 border-dashed border-gray-200">
                     <div className="text-right w-full">
                        <div className="flex justify-between md:block"><span className="text-gray-500 text-xs">Tổng:</span> <span className="font-bold">{Number(o.total).toLocaleString()}</span></div>
                        <div className="flex justify-between md:block"><span className="text-gray-500 text-xs">Cọc:</span> <span className="text-blue-600">{Number(o.deposit).toLocaleString()}</span></div>
                        <div className="flex justify-between md:block mt-2 pt-2 border-t border-dashed"><span className="text-gray-500 text-xs font-bold">CÒN:</span> <span className="text-red-600 font-extrabold text-lg">{Number(o.total-o.deposit).toLocaleString()}</span></div>
                     </div>
                     <div className="text-xs text-gray-300 mt-2">Tạo bởi: {o.createdBy}</div>
                  </div>
               </div>
            </div>
         ))}
      </div>}
      {viewImg && <ImagePreviewModal src={viewImg} onClose={()=>setViewImg(null)}/>}
    </div>
  );
};

// --- TRANG CHỦ (LANDING PAGE) ---
const LandingPage = ({ products, categories, shopSettings, onGoToAdmin }) => {
  const [filter, setFilter] = useState("ALL");
  
  // Lọc sản phẩm theo danh mục
  const filteredProducts = filter === "ALL" 
      ? products 
      : products.filter(p => p.category === filter);

  return (
    <div className="min-h-screen bg-orange-50/30 font-sans" style={{ fontFamily: 'Quicksand, sans-serif' }}>
        {/* Header */}
        <header className="bg-white sticky top-0 z-40 px-4 md:px-8 h-20 flex justify-between items-center shadow-sm">
            <Logo customUrl={shopSettings.logoUrl}/>
            <div className="hidden md:flex gap-6 font-bold text-gray-600 text-sm">
                <a href="#home" className="hover:text-orange-600">TRANG CHỦ</a>
                <a href="#menu" className="hover:text-orange-600">THỰC ĐƠN</a>
                <a href="#contact" className="hover:text-orange-600">LIÊN HỆ</a>
            </div>
            <button onClick={onGoToAdmin} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-700 transition">
                <Users size={16}/> Dành cho nhân viên
            </button>
        </header>

        {/* Hero Banner */}
        <div id="home" className="relative bg-gradient-to-r from-orange-500 to-red-500 text-white py-20 px-6 text-center">
            <div className="max-w-3xl mx-auto relative z-10">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-md">Bánh Kem Ngon Mỗi Ngày</h1>
                <p className="text-lg opacity-90 mb-8">Chào mừng bạn đến với {shopSettings.shopName}. Chúng tôi mang đến những chiếc bánh ngọt ngào nhất cho sự kiện của bạn.</p>
                <a href="#menu" className="bg-white text-orange-600 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition inline-block">Xem Menu Ngay</a>
            </div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>

        {/* Menu Section */}
        <main id="menu" className="max-w-7xl mx-auto p-6 py-16">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-gray-800">Thực Đơn Của Chúng Tôi</h2>
                <div className="w-20 h-1 bg-orange-500 mx-auto mt-2 rounded-full"></div>
            </div>

            {/* Category Filter Bar */}
            <div className="flex gap-3 overflow-x-auto pb-4 mb-8 justify-start md:justify-center scrollbar-hide">
                <button 
                    onClick={() => setFilter("ALL")} 
                    className={`px-5 py-2 rounded-full whitespace-nowrap font-bold transition ${filter === "ALL" ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50'}`}
                >
                    Tất cả
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat.id}
                        onClick={() => setFilter(cat.name)} 
                        className={`px-5 py-2 rounded-full whitespace-nowrap font-bold transition ${filter === cat.name ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-orange-50'}`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Product Grid */}
            {filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-gray-400">Hiện chưa có bánh trong danh mục này.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredProducts.map(p => (
                        <div key={p.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition overflow-hidden group border border-orange-50 flex flex-col h-full">
                            <div className="relative pt-[100%] bg-gray-100">
                                <img src={p.image || "https://via.placeholder.com/300?text=No+Image"} className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-105 transition duration-500" alt={p.name}/>
                                {p.tag && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow">{p.tag}</span>}
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-bold text-gray-800 mb-1 line-clamp-2 group-hover:text-orange-600 transition">{p.name}</h3>
                                <div className="mt-auto pt-3 border-t border-dashed border-gray-100 flex justify-between items-center">
                                    <span className="text-orange-600 font-extrabold text-lg">{Number(p.price).toLocaleString()} đ</span>
                                    <button className="bg-orange-50 text-orange-600 p-2 rounded-full hover:bg-orange-600 hover:text-white transition"><ShoppingCart size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>

        {/* Footer / Contact */}
        <footer id="contact" className="bg-gray-900 text-gray-300 py-12">
            <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-10">
                <div>
                    <Logo className="text-white mb-4" customUrl={shopSettings.logoUrl}/>
                    <p className="text-sm opacity-70">Thơm ngon trong từng lớp bánh. Đặt hàng ngay hôm nay để nhận ưu đãi.</p>
                </div>
                <div>
                    <h4 className="text-white font-bold mb-4">Liên Hệ</h4>
                    <ul className="space-y-3 text-sm">
                        <li className="flex items-center gap-2"><Phone size={16} className="text-orange-500"/> {shopSettings.hotline}</li>
                        <li className="flex items-center gap-2"><MapPin size={16} className="text-orange-500"/> 123 Đường Bánh Ngọt, TP.HCM</li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-white font-bold mb-4">Kết Nối</h4>
                    <div className="flex gap-3">
                        {shopSettings.zaloLink && <a href={shopSettings.zaloLink} target="_blank" rel="noreferrer" className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2"><MessageCircle size={16}/> Zalo</a>}
                        {shopSettings.fbLink && <a href={shopSettings.fbLink} target="_blank" rel="noreferrer" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2"><Facebook size={16}/> Facebook</a>}
                    </div>
                </div>
            </div>
            <div className="text-center text-xs text-gray-600 mt-10 pt-6 border-t border-gray-800">© 2024 {shopSettings.shopName}. All rights reserved.</div>
        </footer>
    </div>
  );
};

// --- APP MAIN ---
export default function App() {
  const [user, setUser] = useState(null); 
  const [appUser, setAppUser] = useState(null); 
  const [usersList, setUsersList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shopSettings, setShopSettings] = useState({ logoUrl: DEFAULT_LOGO_URL, shopName: "BanhKemMeo.vn", hotline: "0868679094" });
  
  const [view, setView] = useState('landing'); // landing, login, dashboard
  const [activeTab, setActiveTab] = useState('create-order'); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  // Inject Font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Auth Init
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
        else await signInAnonymously(auth);
      } catch (e) { console.error("Auth Err:", e); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Data Sync
  useEffect(() => {
    // Public Data Sync (For Landing Page)
    const unsub1 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), d => { if(d.exists()) setShopSettings(prev=>({...prev, ...d.data()})) });
    const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'products'), s => setProducts(s.docs.map(d=>({id:d.id,...d.data()}))));
    const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), s => setCategories(s.docs.map(d=>({id:d.id,...d.data()}))));

    // Private Data Sync (For Staff/Owner)
    let unsub4=()=>{}, unsub5=()=>{};
    if(user) {
        unsub4 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), s => {
            const list = s.docs.map(d=>({id:d.id,...d.data()})); setUsersList(list);
            const saved = localStorage.getItem('bkm_phone'); 
            if(saved){ const u = list.find(x=>x.phone===saved); if(u){ setAppUser(u); if(view==='login') setView('dashboard'); } }
        });
        unsub5 = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), s => setOrders(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))));
    }
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [user, view]);

  // Handlers
  const handleLogin = (phone, password) => {
    const u = usersList.find(x=>x.phone===phone);
    if (u && u.password===password) { setAppUser(u); localStorage.setItem('bkm_phone', phone); setView('dashboard'); showToast(`Xin chào ${u.name}`); }
    else showToast('Sai thông tin', 'error');
  };

  const handleLogout = () => { setAppUser(null); localStorage.removeItem('bkm_phone'); setView('landing'); };

  if (firebaseConfigError) return <div className="h-screen flex items-center justify-center text-red-500 font-bold px-4 text-center">{firebaseConfigError}</div>;
  if (view === 'loading') return <div className="h-screen flex items-center justify-center"><Loader className="animate-spin text-orange-500"/></div>;

  // VIEW: LANDING PAGE
  if (view === 'landing') return (
    <>
      {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
      <LandingPage 
        products={products} 
        categories={categories} 
        shopSettings={shopSettings} 
        onGoToAdmin={() => {
          if(appUser) setView('dashboard');
          else setView('login');
        }} 
      />
    </>
  );

  // VIEW: LOGIN
  if (view === 'login') return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4 font-sans" style={{fontFamily:'Quicksand'}}>
        <button onClick={()=>setView('landing')} className="absolute top-6 left-6 bg-white px-4 py-2 rounded-full shadow text-gray-600 font-bold flex gap-2 hover:text-orange-600 transition"><HomeIcon size={18}/> Về Trang Chủ</button>
        {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
        <div className="bg-white w-full max-w-md p-10 rounded-3xl shadow-2xl border border-orange-100 text-center">
            <Logo className="justify-center mb-6" customUrl={shopSettings.logoUrl}/>
            <h2 className="text-xl font-bold mb-6 text-gray-800">Đăng Nhập Nhân Viên</h2>
            <div className="space-y-4 text-left">
                <div><label className="text-sm font-bold text-gray-500">SĐT</label><input id="login-phone" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="09..." /></div>
                <div><label className="text-sm font-bold text-gray-500">Mật khẩu</label><input id="login-pass" type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" placeholder="••••" /></div>
                <button onClick={()=>{
                    const p = document.getElementById('login-phone').value;
                    const pw = document.getElementById('login-pass').value;
                    handleLogin(p, pw);
                }} className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700">Vào Hệ Thống</button>
            </div>
            <div className="mt-4 text-xs text-gray-400">*Chưa có tài khoản? Liên hệ chủ tiệm.</div>
        </div>
      </div>
  );

  // VIEW: DASHBOARD (Admin Panel)
  return (
    <div className="min-h-screen bg-orange-50 text-gray-800 flex flex-col md:flex-row font-sans" style={{fontFamily:'Quicksand'}}>
       {toast && <Toast {...toast} onClose={()=>setToast(null)}/>}
       
       {/* Sidebar */}
       <aside className="hidden md:flex flex-col w-64 bg-white border-r h-screen sticky top-0 z-20 shadow-sm">
          <div className="p-6 border-b cursor-pointer" onClick={()=>setView('landing')}><Logo customUrl={shopSettings.logoUrl}/></div>
          <nav className="flex-1 p-4 space-y-2">
             <SidebarItem icon={<PlusCircle/>} label="Tạo Đơn" active={activeTab==='create-order'} onClick={()=>setActiveTab('create-order')} visible={appUser?.role!==ROLES.BAKER}/>
             <SidebarItem icon={<ClipboardList/>} label="Đơn Hàng" active={activeTab==='orders'} onClick={()=>setActiveTab('orders')}/>
             <SidebarItem icon={<Users/>} label="Nhân Sự" active={activeTab==='users'} onClick={()=>setActiveTab('users')} visible={appUser?.role===ROLES.OWNER||appUser?.role===ROLES.MANAGER}/>
             <SidebarItem icon={<Settings/>} label="Cài Đặt Web" active={activeTab==='settings'} onClick={()=>setActiveTab('settings')} visible={appUser?.role===ROLES.OWNER}/>
          </nav>
          <div className="p-4 border-t bg-orange-50"><div className="font-bold text-orange-700 mb-2">{appUser?.name}</div><button onClick={handleLogout} className="text-red-500 text-sm flex gap-2 items-center hover:underline"><LogOut size={14}/> Đăng xuất</button></div>
       </aside>

       {/* Mobile Header */}
       <div className="md:hidden fixed top-0 w-full bg-white shadow-sm z-20 p-4 flex justify-between items-center">
          <Logo customUrl={shopSettings.logoUrl}/><button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="text-orange-600"><Menu/></button>
       </div>
       {mobileMenuOpen && <div className="md:hidden fixed inset-0 z-30 bg-white pt-20 px-6 flex flex-col gap-4 text-lg font-bold text-gray-700 animate-fade-in-up">
           <button onClick={()=>setMobileMenuOpen(false)} className="absolute top-4 right-4"><X/></button>
           <button onClick={()=>{setView('landing');setMobileMenuOpen(false)}} className="text-left border-b pb-2">Về Trang Chủ</button>
           {appUser?.role!==ROLES.BAKER && <button onClick={()=>{setActiveTab('create-order');setMobileMenuOpen(false)}} className="text-left border-b pb-2">Tạo Đơn</button>}
           <button onClick={()=>{setActiveTab('orders');setMobileMenuOpen(false)}} className="text-left border-b pb-2">Đơn Hàng</button>
           {appUser?.role===ROLES.OWNER && <button onClick={()=>{setActiveTab('settings');setMobileMenuOpen(false)}} className="text-left border-b pb-2">Cài Đặt Web</button>}
           <button onClick={handleLogout} className="text-red-500 mt-4">Đăng Xuất</button>
       </div>}

       <main className="flex-1 p-4 md:p-8 overflow-y-auto mt-16 md:mt-0">
          <div className="max-w-6xl mx-auto">
             {activeTab==='create-order' && <CreateOrderForm categories={categories} onSubmit={async(d)=>{try{await addDoc(collection(db,'artifacts',appId,'public','data','orders'),{...d,createdBy:appUser.name,createdAt:new Date().toISOString(),status:'new',orderId:Date.now().toString().slice(-6)});showToast('Tạo đơn thành công!');setActiveTab('orders');}catch(e){showToast('Lỗi tạo đơn','error')}}} />}
             {activeTab==='orders' && <OrderList orders={orders} />}
             {activeTab==='users' && <div className="bg-white rounded-xl shadow border p-6"><h2 className="font-bold text-xl mb-4">Quản Lý Nhân Sự</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 uppercase"><tr><th className="p-3">Tên</th><th className="p-3">SĐT</th><th className="p-3">Vai Trò</th>{appUser.role===ROLES.OWNER&&<th className="p-3 text-right">Sửa</th>}</tr></thead><tbody>{usersList.map(u=><tr key={u.phone} className="border-t"><td className="p-3 font-bold">{u.name}</td><td className="p-3 text-gray-600">{u.phone}</td><td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded">{ROLE_LABELS[u.role]}</span></td>{appUser.role===ROLES.OWNER&&<td className="p-3 text-right">{u.phone!==OWNER_PHONE&&<select className="border p-1 rounded" value={u.role} onChange={e=>{updateDoc(doc(db,'artifacts',appId,'public','data','users',u.phone),{role:e.target.value});showToast('Đã cập nhật')}}><option value={ROLES.SALES}>Bán hàng</option><option value={ROLES.BAKER}>Thợ bánh</option><option value={ROLES.MANAGER}>Quản lý</option></select>}</td>}</tr>)}</tbody></table></div><div className="mt-4 text-sm text-gray-500">* Để thêm nhân viên: Hãy dùng trang Đăng Ký bên ngoài, sau đó vào đây cấp quyền.</div></div>}
             {activeTab==='settings' && <SettingsPanel categories={categories} products={products} settings={shopSettings} 
                onAddCategory={async(n)=>{try{await addDoc(collection(db,'artifacts',appId,'public','data','categories'),{name:n});showToast('Thêm danh mục OK');}catch(e){showToast('Lỗi','error')}}} 
                onDeleteCategory={async(id)=>{if(window.confirm('Xóa?'))try{await deleteDoc(doc(db,'artifacts',appId,'public','data','categories',id));showToast('Đã xóa');}catch(e){showToast('Lỗi','error')}}} 
                onSaveProduct={async(p)=>{try{if(p.id){const{id,...d}=p;await updateDoc(doc(db,'artifacts',appId,'public','data','products',id),d);showToast('Sửa OK');}else{const{id,...d}=p;await addDoc(collection(db,'artifacts',appId,'public','data','products'),d);showToast('Thêm OK');}}catch(e){showToast('Lỗi lưu SP','error')}}} 
                onDeleteProduct={async(id)=>{if(window.confirm('Xóa SP?'))try{await deleteDoc(doc(db,'artifacts',appId,'public','data','products',id));showToast('Đã xóa');}catch(e){showToast('Lỗi','error')}}} 
                onSaveSettings={async(s)=>{try{await setDoc(doc(db,'artifacts',appId,'public','data','settings','general'),s);showToast('Lưu cấu hình OK');}catch(e){showToast('Lỗi','error')}}} 
             />}
          </div>
       </main>
    </div>
  );
}
