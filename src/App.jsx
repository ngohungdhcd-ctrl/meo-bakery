import React, { useState, useEffect, useRef } from 'react';
import { 
  Cake, 
  Users, 
  ClipboardList, 
  LogOut, 
  PlusCircle, 
  Menu, 
  X, 
  DollarSign,
  ShoppingCart,
  Sparkles,
  MessageCircle,
  Loader,
  Copy,
  Check,
  AlertCircle,
  Upload, 
  Image as ImageIcon, 
  Trash2,
  Home as HomeIcon,
  Search,
  ArrowRight,
  MapPin,
  Phone,
  Clock,
  Heart,
  Settings,     // Icon Cài đặt
  Edit,         // Icon Sửa
  Save,         // Icon Lưu
  List,         // Icon Danh sách
  Package       // Icon Sản phẩm
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- CONFIGURATION ---
const SHOP_LOGO_URL = "https://drive.google.com/uc?export=view&id=1GTA2aVIhwVn6hHnhlLY2exJVVJYzZOov"; 

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBM8pividJcQ4EgXQ3pIVdXqz_pyQB8rPA",
  authDomain: "meo-bakery-4c04f.firebaseapp.com",
  projectId: "meo-bakery-4c04f",
  storageBucket: "meo-bakery-4c04f.firebasestorage.app",
  messagingSenderId: "289466483676",
  appId: "1:289466483676:web:92f6abd8b8e1f9077c4519"
};

// --- FIREBASE INIT ---
let firebaseConfig;
let appId;
let firebaseConfigError = null;

try {
    let envConfigJson = null;
    try {
        envConfigJson = process.env.REACT_APP_FIREBASE_CONFIG;
    } catch (e) {}

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
                 firebaseConfigError = "Cấu hình Firebase (REACT_APP_FIREBASE_CONFIG) chưa được thiết lập trên Vercel!";
             }
        } catch(e) {}
    }
} catch (e) {
    firebaseConfigError = "Lỗi cú pháp JSON trong biến REACT_APP_FIREBASE_CONFIG.";
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
    appId = 'default-app-id';
    console.error("Firebase Config Parsing Error:", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const db = getFirestore(app);

// --- GEMINI API UTILS ---
let apiKey = "";
try {
  apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";
} catch (e) {
  console.warn("Đang chạy trong môi trường không hỗ trợ process.env (Preview)");
}

const callGemini = async (prompt) => {
  if (!apiKey) {
    console.error("Thiếu API Key Gemini!");
    throw new Error("Chưa cấu hình API Key (REACT_APP_GEMINI_API_KEY) hoặc chưa Redeploy trên Vercel.");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, AI đang bận.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error; 
  }
};

// --- CONSTANTS ---
const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  SALES: 'sales',
  BAKER: 'baker',
  PENDING: 'pending'
};

const ROLE_LABELS = {
  [ROLES.OWNER]: 'Chủ tiệm',
  [ROLES.MANAGER]: 'Quản lý',
  [ROLES.SALES]: 'Bán hàng',
  [ROLES.BAKER]: 'Thợ bánh',
  [ROLES.PENDING]: 'Chờ duyệt'
};

const OWNER_PHONE = '0868679094';

// --- HELPER FUNCTIONS ---

// Hàm nén ảnh client-side để giảm dung lượng
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Giảm xuống 800px để tối ưu storage
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Nén thành JPEG chất lượng 70%
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
  });
};

// --- HELPER COMPONENTS ---

const Logo = ({ className }) => (
  <div className={`flex items-center gap-3 font-bold text-2xl text-orange-600 ${className}`} style={{ fontFamily: 'Quicksand, sans-serif' }}>
    {SHOP_LOGO_URL ? (
      <img 
        src={SHOP_LOGO_URL} 
        alt="Logo" 
        className="h-12 w-auto object-contain" 
        onError={(e) => {
          e.target.onerror = null; 
          e.target.style.display = 'none'; 
        }}
      />
    ) : (
      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-md">
        <Cake size={20} />
      </div>
    )}
    <span className="tracking-tight">BanhKemMeo.vn</span>
  </div>
);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-xl text-white font-medium flex items-center gap-3 animate-fade-in-down ${type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle size={20}/> : <Check size={20}/>}
      {message}
    </div>
  );
};

const ImagePreviewModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in-up" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-white/10 rounded-full transition">
        <X size={32} />
      </button>
      <img 
        src={src} 
        alt="Preview" 
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
        onClick={(e) => e.stopPropagation()} 
      />
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [user, setFirebaseUser] = useState(null); 
  const [appUser, setAppUser] = useState(null); 
  
  // Data States
  const [usersList, setUsersList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [view, setView] = useState('landing'); // landing, login, register, dashboard
  const [activeTab, setActiveTab] = useState('create-order'); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  // Inject Font Quicksand
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // --- FIREBASE LOGIC ---
  if (firebaseConfigError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 font-sans">
        <div className="bg-white border-4 border-red-500 p-8 rounded-xl shadow-2xl max-w-lg text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-4">LỖI CẤU HÌNH</h1>
          <p className="text-gray-700 font-medium mb-6">{firebaseConfigError}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data
  useEffect(() => {
    // Luôn fetch Products và Categories (cho cả khách và nhân viên)
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', 'products');
    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(list);
    });

    const categoriesRef = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    const unsubCategories = onSnapshot(categoriesRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(list);
    });

    if (!user) return () => { unsubProducts(); unsubCategories(); };

    // Users Sync (Authenticated)
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(list);
      
      const savedPhone = localStorage.getItem('bkm_phone');
      if (savedPhone) {
        const found = list.find(u => u.phone === savedPhone);
        if (found) {
          setAppUser(found);
          if (view === 'login') {
             setView('dashboard');
             if (found.role === ROLES.BAKER) setActiveTab('orders');
          }
        }
      }
    });

    // Orders Sync (Authenticated)
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(list);
    });

    return () => {
      unsubUsers();
      unsubOrders();
      unsubProducts();
      unsubCategories();
    };
  }, [user, view]);

  // --- ACTIONS ---
  const handleLogin = (phone, password) => {
    const targetUser = usersList.find(u => u.phone === phone);
    if (targetUser && targetUser.password === password) {
      setAppUser(targetUser);
      localStorage.setItem('bkm_phone', phone);
      setView('dashboard');
      if (targetUser.role === ROLES.BAKER) setActiveTab('orders');
      else setActiveTab('create-order');
      showToast(`Xin chào ${targetUser.name}!`);
    } else {
      showToast('Sai số điện thoại hoặc mật khẩu!', 'error');
    }
  };

  const handleRegister = async (name, phone, password) => {
    if (usersList.find(u => u.phone === phone)) {
      showToast('Số điện thoại này đã được đăng ký!', 'error');
      return;
    }
    const isOwner = phone === OWNER_PHONE;
    const newUser = {
      name, phone, password, 
      role: isOwner ? ROLES.OWNER : ROLES.PENDING,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', phone), newUser);
      showToast('Đăng ký thành công! Hãy đăng nhập.');
      setView('login');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi đăng ký', 'error');
    }
  };

  const handleLogout = () => {
    setAppUser(null);
    localStorage.removeItem('bkm_phone');
    setView('landing'); 
  };

  const handleCreateOrder = async (orderData) => {
    try {
      const newOrder = {
        ...orderData,
        createdBy: appUser.name,
        createdAt: new Date().toISOString(),
        status: 'new',
        orderId: Date.now().toString().slice(-6)
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
      showToast('Tạo đơn thành công!');
      setActiveTab('orders');
    } catch (e) {
      console.error(e);
      if (e.code === 'resource-exhausted') {
        showToast('Lỗi: Tổng dung lượng ảnh quá lớn! Vui lòng giảm số lượng ảnh.', 'error');
      } else {
        showToast('Lỗi: ' + e.message, 'error');
      }
    }
  };

  const handleUpdateRole = async (phone, newRole) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', phone), { role: newRole });
      showToast('Đã cập nhật quyền hạn');
    } catch (e) {
      showToast('Lỗi cập nhật', 'error');
    }
  };

  // --- SETTINGS ACTIONS (CATEGORY & PRODUCT) ---
  const handleAddCategory = async (name) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), { name });
      showToast('Thêm danh mục thành công!');
    } catch (e) { showToast('Lỗi thêm danh mục', 'error'); }
  };

  const handleDeleteCategory = async (id) => {
    if(!window.confirm("Xóa danh mục này?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id));
      showToast('Đã xóa danh mục');
    } catch (e) { showToast('Lỗi xóa danh mục', 'error'); }
  };

  const handleAddProduct = async (productData) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), productData);
      showToast('Thêm sản phẩm thành công!');
    } catch (e) { showToast('Lỗi thêm sản phẩm (Ảnh quá lớn?)', 'error'); }
  };

  const handleDeleteProduct = async (id) => {
    if(!window.confirm("Xóa sản phẩm này?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
      showToast('Đã xóa sản phẩm');
    } catch (e) { showToast('Lỗi xóa sản phẩm', 'error'); }
  };

  const goToDashboard = () => {
      if (appUser) setView('dashboard');
      else setView('login');
  };

  // --- VIEWS ---

  if (view === 'loading') return <div className="h-screen flex items-center justify-center text-orange-500 font-sans"><Loader className="animate-spin" size={40}/></div>;

  // LANDING PAGE VIEW
  if (view === 'landing') {
      return (
        <div className="min-h-screen bg-orange-50/30 font-sans flex flex-col" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}
            
            {/* Navbar */}
            <header className="bg-white shadow-sm sticky top-0 z-40 px-4 md:px-8 h-20 flex justify-between items-center transition-all duration-300">
                <Logo />
                <nav className="hidden md:flex items-center gap-8 text-gray-600 font-bold text-lg">
                    <button onClick={() => setView('landing')} className="hover:text-orange-600 transition-colors">Trang Chủ</button>
                    <a href="#products" className="hover:text-orange-600 transition-colors">Sản Phẩm</a>
                    <a href="#about" className="hover:text-orange-600 transition-colors">Về Chúng Tôi</a>
                </nav>
                <button onClick={goToDashboard} className="hidden md:flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg transform hover:-translate-y-0.5 transition-all">
                    <Users size={18} /><span>Dành Cho Nhân Viên</span>
                </button>
                <button className="md:hidden text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}><Menu size={28} /></button>
            </header>

            {/* Mobile Nav Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-white p-6 animate-fade-in-up md:hidden flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <Logo />
                        <button onClick={() => setMobileMenuOpen(false)}><X size={28} className="text-gray-500"/></button>
                    </div>
                    <div className="flex flex-col gap-6 text-xl font-bold text-gray-700">
                        <button onClick={() => { setView('landing'); setMobileMenuOpen(false); }}>Trang Chủ</button>
                        <a href="#products" onClick={() => setMobileMenuOpen(false)}>Sản Phẩm</a>
                        <button onClick={() => { goToDashboard(); setMobileMenuOpen(false); }} className="text-orange-600 flex items-center gap-2"><Users size={20}/> Dành Cho Nhân Viên</button>
                    </div>
                </div>
            )}

            {/* Banner */}
            <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white py-16 md:py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg leading-tight">Hương Vị Ngọt Ngào <br/> Trao Gửi Yêu Thương</h1>
                    <p className="text-lg md:text-xl opacity-90 mb-8 max-w-xl mx-auto font-medium">Chuyên các loại bánh kem sinh nhật, sự kiện với nguyên liệu tươi ngon nhất, thiết kế độc đáo theo yêu cầu của bạn.</p>
                    <a href="#products" className="inline-block bg-white text-orange-600 px-8 py-3 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-orange-50 transition-all transform hover:scale-105">Xem Menu Ngay</a>
                </div>
            </div>

            {/* Product Showcase (Dynamic from Firestore) */}
            <main id="products" className="flex-1 max-w-7xl mx-auto p-6 md:p-12 w-full">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Sản Phẩm Nổi Bật</h2>
                    <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full"></div>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Chưa có sản phẩm nào được trưng bày.</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {products.map(product => (
                            <div key={product.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-orange-100 flex flex-col h-full">
                                <div className="relative pt-[100%] overflow-hidden bg-gray-100">
                                    <img 
                                        src={product.image || "https://via.placeholder.com/300?text=No+Image"} 
                                        alt={product.name} 
                                        className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    {product.tag && (
                                        <span className="absolute top-3 left-3 bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">{product.tag}</span>
                                    )}
                                </div>
                                <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-orange-600 transition-colors line-clamp-1">{product.name}</h3>
                                    <div className="mt-auto flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
                                        <span className="text-orange-600 font-extrabold text-lg">{Number(product.price).toLocaleString()} đ</span>
                                        <button className="bg-orange-100 text-orange-600 p-2 rounded-full hover:bg-orange-600 hover:text-white transition-colors"><ShoppingCart size={18} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            
            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <div className="flex items-center gap-2 font-bold text-2xl text-white mb-4"><div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white"><Cake size={18} /></div>BanhKemMeo.vn</div>
                        <p className="text-gray-400 mb-4">Nơi biến những ý tưởng ngọt ngào thành hiện thực.</p>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-4">Liên Hệ</h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3"><MapPin size={18} className="text-orange-500"/> 123 Đường Bánh Ngọt, TP.HCM</li>
                            <li className="flex items-center gap-3"><Phone size={18} className="text-orange-500"/> 0868.679.094</li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500">© 2024 BanhKemMeo.vn. All rights reserved.</div>
            </footer>
        </div>
      );
  }

  // LOGIN / REGISTER
  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4 relative font-sans" style={{ fontFamily: 'Quicksand, sans-serif' }}>
        <button onClick={() => setView('landing')} className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 hover:text-orange-600 font-medium transition bg-white px-4 py-2 rounded-full shadow-sm">
            <HomeIcon size={20}/> Về Trang Chủ
        </button>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <div className="bg-white w-full max-w-md p-8 md:p-10 rounded-3xl shadow-2xl border border-orange-100">
            <div className="text-center mb-8"><Logo className="justify-center mb-2" /><h2 className="text-gray-500 text-sm">Hệ thống quản lý nội bộ</h2></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">{view === 'login' ? 'Đăng Nhập Nhân Viên' : 'Đăng Ký Tài Khoản'}</h1>
            {view === 'login' ? <AuthScreen type="login" onSwitch={() => setView('register')} onSubmit={handleLogin} /> : <AuthScreen type="register" onSwitch={() => setView('login')} onSubmit={handleRegister} />}
        </div>
      </div>
    );
  }

  // DASHBOARD LAYOUT
  return (
    <div className="min-h-screen bg-orange-50 text-gray-800 flex flex-col md:flex-row font-sans" style={{ fontFamily: 'Quicksand, sans-serif' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-orange-100 h-screen sticky top-0 shadow-sm z-20">
        <div className="p-6 border-b border-orange-100 cursor-pointer" onClick={() => setView('landing')}><Logo /></div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<PlusCircle size={20}/>} label="Tạo Đơn Bánh" active={activeTab === 'create-order'} onClick={() => setActiveTab('create-order')} visible={appUser?.role !== ROLES.BAKER} />
          <SidebarItem icon={<ClipboardList size={20}/>} label="Danh Sách Đơn" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <SidebarItem icon={<Users size={20}/>} label="Nhân Sự" active={activeTab === 'users'} onClick={() => setActiveTab('users')} visible={appUser?.role === ROLES.OWNER || appUser?.role === ROLES.MANAGER} />
          <SidebarItem icon={<Settings size={20}/>} label="Cài Đặt SP" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} visible={appUser?.role === ROLES.OWNER} />
        </nav>
        <div className="p-4 border-t border-orange-100 bg-orange-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold">{appUser?.name?.charAt(0)}</div>
            <div className="overflow-hidden"><p className="font-medium truncate">{appUser?.name}</p><p className="text-xs text-gray-500 uppercase">{ROLE_LABELS[appUser?.role]}</p></div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium w-full p-2 rounded-lg hover:bg-red-50 transition-colors"><LogOut size={16} /> Thoát</button>
        </div>
      </aside>
      {/* Mobile Header Dashboard */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <Logo />
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-orange-600"><Menu /></button>
      </div>
      {/* Mobile Menu Dashboard */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-white pt-20 px-6 animate-fade-in-up">
          <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 text-gray-500"><X size={24}/></button>
          <nav className="space-y-4 text-lg">
             <button onClick={() => { setView('landing'); setMobileMenuOpen(false); }} className="block w-full text-left py-3 border-b border-orange-100 font-medium text-gray-500">Về Trang Chủ</button>
             {appUser?.role !== ROLES.BAKER && <button onClick={() => { setActiveTab('create-order'); setMobileMenuOpen(false); }} className="block w-full text-left py-3 border-b border-orange-100 font-medium">Tạo Đơn Bánh</button>}
             <button onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }} className="block w-full text-left py-3 border-b border-orange-100 font-medium">Danh Sách Đơn</button>
             {(appUser?.role === ROLES.OWNER || appUser?.role === ROLES.MANAGER) && <button onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }} className="block w-full text-left py-3 border-b border-orange-100 font-medium">Quản Lý Nhân Sự</button>}
             {appUser?.role === ROLES.OWNER && <button onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} className="block w-full text-left py-3 border-b border-orange-100 font-medium">Cài Đặt SP</button>}
             <button onClick={handleLogout} className="block w-full text-left py-3 text-red-500 mt-4 font-bold">Đăng xuất</button>
          </nav>
        </div>
      )}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'create-order' && <CreateOrderForm categories={categories} onSubmit={handleCreateOrder} />}
          {activeTab === 'orders' && <OrderList orders={orders} />}
          {activeTab === 'users' && <UserManagement users={usersList} currentUser={appUser} onUpdateRole={handleUpdateRole} />}
          {activeTab === 'settings' && <SettingsPanel categories={categories} products={products} onAddCategory={handleAddCategory} onDeleteCategory={handleDeleteCategory} onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct} />}
        </div>
      </main>
    </div>
  );
}

// --- SUB COMPONENTS (UNCHANGED - except CreateOrderForm update) ---

const SidebarItem = ({ icon, label, active, onClick, visible = true }) => {
  if (!visible) return null;
  return (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-700'}`}>{icon}<span>{label}</span></button>);
};

// Settings Panel for Owner
const SettingsPanel = ({ categories, products, onAddCategory, onDeleteCategory, onAddProduct, onDeleteProduct }) => {
  const [newCat, setNewCat] = useState("");
  const [newProd, setNewProd] = useState({ name: "", price: "", category: "", image: null, tag: "" });

  const handleProductImage = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImage(file);
      setNewProd({...newProd, image: compressed});
    }
  };

  const submitProduct = (e) => {
    e.preventDefault();
    onAddProduct(newProd);
    setNewProd({ name: "", price: "", category: "", image: null, tag: "" });
  };

  return (
    <div className="space-y-8">
      {/* Quản lý Danh mục */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><List/> Quản Lý Danh Mục</h2>
        <div className="flex gap-2 mb-4">
          <input className="flex-1 p-2 border rounded-lg" placeholder="Tên danh mục mới..." value={newCat} onChange={e => setNewCat(e.target.value)}/>
          <button onClick={() => {onAddCategory(newCat); setNewCat("");}} className="bg-orange-500 text-white px-4 py-2 rounded-lg">Thêm</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <span key={cat.id} className="bg-gray-100 px-3 py-1 rounded-full flex items-center gap-2 text-sm">
              {cat.name} <button onClick={() => onDeleteCategory(cat.id)} className="text-red-500 hover:text-red-700"><X size={14}/></button>
            </span>
          ))}
        </div>
      </div>

      {/* Quản lý Sản phẩm */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><Package/> Quản Lý Sản Phẩm (Trưng bày)</h2>
        <form onSubmit={submitProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
          <input required className="p-2 border rounded" placeholder="Tên bánh" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})}/>
          <input required type="number" className="p-2 border rounded" placeholder="Giá bán (VNĐ)" value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})}/>
          <select className="p-2 border rounded" value={newProd.category} onChange={e => setNewProd({...newProd, category: e.target.value})}>
            <option value="">-- Chọn Danh Mục --</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <input className="p-2 border rounded" placeholder="Tag (VD: Hot, Mới)" value={newProd.tag} onChange={e => setNewProd({...newProd, tag: e.target.value})}/>
          <div className="md:col-span-2">
             <label className="block text-sm font-medium mb-1">Ảnh sản phẩm</label>
             <input type="file" accept="image/*" onChange={handleProductImage} />
          </div>
          <button type="submit" className="md:col-span-2 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700">Lưu Sản Phẩm</button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(prod => (
            <div key={prod.id} className="border rounded-lg p-3 relative group">
              <img src={prod.image || "https://via.placeholder.com/150"} className="w-full h-32 object-cover rounded mb-2" alt={prod.name}/>
              <h4 className="font-bold truncate">{prod.name}</h4>
              <p className="text-orange-600 font-bold">{Number(prod.price).toLocaleString()} đ</p>
              <span className="text-xs bg-gray-200 px-2 py-1 rounded">{prod.category || "Khác"}</span>
              <button onClick={() => onDeleteProduct(prod.id)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CreateOrderForm = ({ categories = [], onSubmit }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', address: '', pickupTime: '', cakeType: '', requests: '', message: '', total: 0, deposit: 0 });
  const [images, setImages] = useState([]); 
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const remaining = form.total - form.deposit;
  const inputClass = "w-full p-3 border border-gray-300 rounded-lg outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";
  const handleAiApply = (aiData) => { setForm(prev => ({ ...prev, cakeType: aiData.cakeType || prev.cakeType, requests: aiData.requests || prev.requests, message: aiData.message || prev.message })); };
  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) return alert("Tối đa 5 ảnh!");
    try { const compressed = await Promise.all(files.map(file => compressImage(file))); setImages(prev => [...prev, ...compressed]); } catch (error) { alert("Lỗi ảnh."); }
  };
  const handleSubmit = (e) => { e.preventDefault(); onSubmit({...form, remaining, sampleImages: images}); setForm({ customerName: '', phone: '', address: '', pickupTime: '', cakeType: '', requests: '', message: '', total: 0, deposit: 0 }); setImages([]); };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden relative">
      <div className="bg-orange-500 p-4 px-6 flex justify-between items-center"><h2 className="text-xl font-bold text-white flex items-center gap-2"><PlusCircle size={24}/> Tạo Đơn Mới</h2><button onClick={() => setAiModalOpen(true)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 backdrop-blur-sm transition border border-white/40"><Sparkles size={16} className="text-yellow-300"/> Trợ Lý Mèo AI</button></div>
      <form onSubmit={handleSubmit} className="p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Khách Hàng</h3><div><label className="text-sm font-medium">Tên khách</label><input required className={inputClass} value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} /></div><div><label className="text-sm font-medium">SĐT</label><input required className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div><div className="md:col-span-2"><label className="text-sm font-medium">Địa chỉ</label><input className={inputClass} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div><div><label className="text-sm font-medium">Giờ lấy</label><input required type="datetime-local" className={inputClass} value={form.pickupTime} onChange={e => setForm({...form, pickupTime: e.target.value})} /></div></div>
          <div className="space-y-4"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Chi Tiết Bánh</h3><div><label className="text-sm font-medium">Loại bánh</label><select required className={inputClass} value={form.cakeType} onChange={e => setForm({...form, cakeType: e.target.value})}><option value="">-- Chọn --</option>
            {/* Sử dụng danh mục động từ Firebase nếu có, nếu không dùng list cứng */}
            {categories && categories.length > 0 ? categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>) : (
                <>
                <option value="Bánh Kem Sữa Tươi">Bánh Kem Sữa Tươi</option><option value="Bánh Mousse">Bánh Mousse</option><option value="Bánh Tiramisu">Bánh Tiramisu</option><option value="Bánh Bắp">Bánh Bắp</option><option value="Bánh Bông Lan Trứng Muối">Bánh Bông Lan Trứng Muối</option><option value="Khác">Khác</option>
                </>
            )}
          </select></div><div><label className="text-sm font-medium">Yêu cầu</label><textarea className={`${inputClass} h-20`} value={form.requests} onChange={e => setForm({...form, requests: e.target.value})} /></div><div><label className="text-sm font-medium">Lời chúc</label><input className={inputClass} value={form.message} onChange={e => setForm({...form, message: e.target.value})} /></div></div>
        </div>
        <div className="mt-6"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><ImageIcon size={20}/> Ảnh Mẫu (Max 5)</h3><div className="flex items-center justify-center w-full"><label className="flex flex-col items-center justify-center w-full h-32 border-2 border-orange-300 border-dashed rounded-lg cursor-pointer bg-orange-50 hover:bg-orange-100 transition"><div className="flex flex-col items-center justify-center pt-5 pb-6"><Upload className="w-8 h-8 mb-2 text-orange-500" /><p className="text-sm text-gray-500 font-semibold">Tải ảnh lên</p></div><input type="file" className="hidden" multiple accept="image/*" onChange={handleImageChange} /></label></div>{images.length > 0 && <div className="grid grid-cols-5 gap-4 mt-4">{images.map((img, i) => <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border"><img src={img} className="w-full h-full object-cover" /><button type="button" onClick={() => {setImages(prev => prev.filter((_, idx) => idx !== i))}} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></div>)}</div>}</div>
        <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-200"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18}/> Thanh Toán</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="text-sm font-bold">Tổng tiền</label><input required type="number" className={`${inputClass} font-bold text-lg`} value={form.total} onChange={e => setForm({...form, total: Number(e.target.value)})} /></div><div><label className="text-sm font-bold">Đặt cọc</label><input type="number" className={`${inputClass} text-blue-600`} value={form.deposit} onChange={e => setForm({...form, deposit: Number(e.target.value)})} /></div><div><label className="text-sm font-bold">Còn lại</label><div className="w-full p-3 bg-white border border-gray-300 rounded-lg text-red-600 font-bold text-lg">{remaining.toLocaleString()} đ</div></div></div></div>
        <div className="mt-8 flex justify-end"><button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold py-3 px-10 rounded-lg shadow-lg transition flex items-center gap-2"><ClipboardList/> Tạo Đơn Ngay</button></div>
      </form>
      <AIConsultantModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} onApply={handleAiApply} />
    </div>
  );
};

const AuthScreen = ({ type, onSwitch, onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const handleSubmit = (e) => { e.preventDefault(); if (type === 'login') onSubmit(formData.phone, formData.password); else onSubmit(formData.name, formData.phone, formData.password); };
  return (<div className="w-full"><form onSubmit={handleSubmit} className="space-y-4">{type === 'register' && <div><label className="block text-sm font-medium mb-1">Họ Tên</label><input required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>}<div><label className="block text-sm font-medium mb-1">Số Điện Thoại</label><input required type="tel" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/></div><div><label className="block text-sm font-medium mb-1">Mật Khẩu</label><input required type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div><button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition">{type === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</button></form><div className="mt-6 text-center"><button onClick={onSwitch} className="text-orange-600 hover:underline text-sm">{type === 'login' ? 'Đăng ký tài khoản mới' : 'Đã có tài khoản? Đăng nhập'}</button></div></div>);
};

const OrderList = ({ orders }) => {
  const [selectedOrderForZalo, setSelectedOrderForZalo] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Danh Sách Đơn Hàng</h2><span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">Tổng: {orders.length} đơn</span></div>
       {orders.length === 0 ? <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300"><ShoppingCart className="mx-auto text-gray-300 mb-4" size={48} /><p className="text-gray-500">Chưa có đơn hàng nào.</p></div> : 
         <div className="grid gap-4">{orders.map(order => (
             <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-orange-300 transition-colors relative group">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-2"><span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold uppercase">{order.cakeType}</span><span className="text-gray-400 text-sm">#{order.orderId || 'NEW'}</span><span className="text-gray-400 text-xs ml-auto md:ml-2">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span></div>
                     <h3 className="text-lg font-bold text-gray-800">{order.customerName} - {order.phone}</h3>
                     <p className="text-gray-600 text-sm mt-1">🕒 Lấy: {new Date(order.pickupTime).toLocaleString('vi-VN')}</p>
                     <p className="text-gray-600 text-sm">📍 {order.address || 'Tại tiệm'}</p>
                     {order.sampleImages && order.sampleImages.length > 0 && <div className="flex gap-2 mt-3 overflow-x-auto pb-2">{order.sampleImages.map((img, idx) => <img key={idx} src={img} className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80" onClick={() => setViewImage(img)} />)}</div>}
                     {order.requests && <div className="mt-3 bg-gray-50 p-3 rounded text-sm"><strong>Yêu cầu:</strong> {order.requests}</div>}
                     <div className="mt-4 flex gap-2"><button onClick={() => setSelectedOrderForZalo(order)} className="text-blue-600 text-sm font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-2 transition"><Sparkles size={14}/> Zalo</button><div className="ml-auto md:hidden text-sm text-gray-500">Tạo bởi: {order.createdBy}</div></div>
                  </div>
                  <div className="flex flex-col items-end min-w-[150px] border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                     <div className="text-right"><p className="text-xs text-gray-500">Tổng</p><p className="font-bold text-lg">{order.total.toLocaleString()} đ</p></div>
                     <div className="text-right mt-2"><p className="text-xs text-gray-500">Cọc</p><p className="font-medium text-blue-600">{order.deposit.toLocaleString()} đ</p></div>
                     <div className="text-right mt-2 pt-2 border-t border-dashed w-full"><p className="text-xs text-gray-500">Còn lại</p><p className="font-bold text-red-600 text-xl">{(order.total - order.deposit).toLocaleString()} đ</p></div>
                     <div className="mt-auto hidden md:block text-xs text-gray-400">Tạo bởi: {order.createdBy}</div>
                  </div>
                </div>
             </div>
           ))}</div>}
       {selectedOrderForZalo && <GenerateZaloModal order={selectedOrderForZalo} onClose={() => setSelectedOrderForZalo(null)} />}
       {viewImage && <ImagePreviewModal src={viewImage} onClose={() => setViewImage(null)} />}
    </div>
  );
};

const UserManagement = ({ users, currentUser, onUpdateRole }) => {
  const isOwner = currentUser?.role === ROLES.OWNER;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Users size={24}/> Quản Lý Nhân Sự</h2>{!isOwner && <span className="text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-full">Chế độ xem</span>}</div>
      <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="bg-gray-100 text-gray-600 text-sm uppercase"><th className="p-4">Họ Tên</th><th className="p-4">SĐT</th><th className="p-4">Vai Trò</th>{isOwner && <th className="p-4 text-right">Hành Động</th>}</tr></thead><tbody className="divide-y divide-gray-100">{users.map((user, idx) => (<tr key={idx} className="hover:bg-orange-50 transition-colors"><td className="p-4 font-medium">{user.name}</td><td className="p-4 text-gray-600">{user.phone}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${user.role === ROLES.OWNER ? 'bg-purple-100 text-purple-700' : ''} ${user.role === ROLES.MANAGER ? 'bg-blue-100 text-blue-700' : ''} ${user.role === ROLES.SALES ? 'bg-green-100 text-green-700' : ''} ${user.role === ROLES.BAKER ? 'bg-yellow-100 text-yellow-700' : ''} ${user.role === ROLES.PENDING ? 'bg-gray-200 text-gray-600' : ''}`}>{ROLE_LABELS[user.role]}</span></td>{isOwner && (<td className="p-4 text-right">{user.phone !== OWNER_PHONE && (<select className="bg-white border border-gray-300 text-sm rounded p-1 outline-none focus:border-orange-500" value={user.role} onChange={(e) => onUpdateRole(user.phone, e.target.value)}><option value={ROLES.PENDING}>Chờ duyệt</option><option value={ROLES.MANAGER}>Quản lý</option><option value={ROLES.SALES}>Bán hàng</option><option value={ROLES.BAKER}>Thợ bánh</option></select>)}</td>)}</tr>))}</tbody></table></div>
    </div>
  );
};
