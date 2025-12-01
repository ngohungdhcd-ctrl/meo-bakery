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
  Heart
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
  updateDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- CONFIGURATION ---
// Đã cập nhật đường dẫn trực tiếp cho Logo từ Google Drive của bạn
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

// Danh sách sản phẩm mẫu (Mock Data)
const SAMPLE_PRODUCTS = [
  { id: 1, name: "Bánh Kem Dâu Tây", price: "350.000", image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=500&q=80", tag: "Best Seller" },
  { id: 2, name: "Tiramisu Cổ Điển", price: "400.000", image: "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=500&q=80", tag: "Mới" },
  { id: 3, name: "Bánh Bắp Phô Mai", price: "320.000", image: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=500&q=80", tag: "Yêu thích" },
  { id: 4, name: "Chocolate Chảy", price: "450.000", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80", tag: null },
  { id: 5, name: "Bông Lan Trứng Muối", price: "280.000", image: "https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?auto=format&fit=crop&w=500&q=80", tag: "Hot" },
  { id: 6, name: "Macaron Tổng Hợp", price: "150.000", image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=500&q=80", tag: null },
  { id: 7, name: "Bánh Kem Bơ Hàn Quốc", price: "550.000", image: "https://images.unsplash.com/photo-1535254973040-607b474cb50d?auto=format&fit=crop&w=500&q=80", tag: "Cao cấp" },
  { id: 8, name: "Red Velvet", price: "380.000", image: "https://images.unsplash.com/photo-1586788680434-30d32443d858?auto=format&fit=crop&w=500&q=80", tag: null },
];

// --- HELPER COMPONENTS ---

const Logo = ({ className }) => (
  <div className={`flex items-center gap-3 font-bold text-2xl text-orange-600 ${className}`} style={{ fontFamily: 'Quicksand, sans-serif' }}>
    {SHOP_LOGO_URL ? (
      <img 
        src={SHOP_LOGO_URL} 
        alt="Logo" 
        className="h-12 w-auto object-contain" // Tăng kích thước logo lên một chút cho đẹp
        onError={(e) => {
          e.target.onerror = null; 
          e.target.style.display = 'none'; // Ẩn ảnh nếu lỗi và hiện text backup
        }}
      />
    ) : (
      <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-md">
        <Cake size={20} />
      </div>
    )}
    {/* Nếu logo lỗi, dòng text này vẫn sẽ hiển thị để đảm bảo thương hiệu */}
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
  const [usersList, setUsersList] = useState([]);
  const [orders, setOrders] = useState([]);
  
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

  useEffect(() => {
    if (!user) return;

    // Users Sync
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(list);
      
      const savedPhone = localStorage.getItem('bkm_phone');
      if (savedPhone) {
        const found = list.find(u => u.phone === savedPhone);
        if (found) {
          setAppUser(found);
          // Nếu đang ở màn login thì chuyển vào dashboard
          if (view === 'login') {
             setView('dashboard');
             if (found.role === ROLES.BAKER) setActiveTab('orders');
          }
        }
      }
    }, (err) => console.error("Sync Users Error", err));

    // Orders Sync
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(list);
    }, (err) => console.error("Sync Orders Error", err));

    return () => {
      unsubUsers();
      unsubOrders();
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
      if (e.code === 'resource-exhausted' || e.message.includes('longer than')) {
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
            
            {/* --- NAVBAR --- */}
            <header className="bg-white shadow-sm sticky top-0 z-40 px-4 md:px-8 h-20 flex justify-between items-center transition-all duration-300">
                <Logo />
                
                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8 text-gray-600 font-bold text-lg">
                    <button onClick={() => setView('landing')} className="hover:text-orange-600 transition-colors relative group">
                        Trang Chủ
                        <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-orange-600 transition-all group-hover:w-full"></span>
                    </button>
                    <a href="#products" className="hover:text-orange-600 transition-colors relative group">
                        Sản Phẩm
                        <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-orange-600 transition-all group-hover:w-full"></span>
                    </a>
                    <a href="#about" className="hover:text-orange-600 transition-colors relative group">
                        Về Chúng Tôi
                        <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-orange-600 transition-all group-hover:w-full"></span>
                    </a>
                </nav>

                {/* Staff Button */}
                <button 
                    onClick={goToDashboard}
                    className="hidden md:flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg shadow-orange-200 transform hover:-translate-y-0.5 transition-all"
                >
                    <Users size={18} />
                    <span>Dành Cho Nhân Viên</span>
                </button>

                {/* Mobile Menu Button */}
                <button className="md:hidden text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                    <Menu size={28} />
                </button>
            </header>

            {/* Mobile Nav Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-white p-6 animate-fade-in-up md:hidden flex flex-col">
                    <div className="flex justify-between items-center mb-8">
                        <Logo />
                        <button onClick={() => setMobileMenuOpen(false)}><X size={28} className="text-gray-500"/></button>
                    </div>
                    <div className="flex flex-col gap-6 text-xl font-bold text-gray-700">
                        <button onClick={() => { setView('landing'); setMobileMenuOpen(false); }} className="text-left">Trang Chủ</button>
                        <a href="#products" onClick={() => setMobileMenuOpen(false)}>Sản Phẩm</a>
                        <a href="#about" onClick={() => setMobileMenuOpen(false)}>Về Chúng Tôi</a>
                        <hr className="border-gray-100"/>
                        <button onClick={() => { goToDashboard(); setMobileMenuOpen(false); }} className="text-orange-600 flex items-center gap-2">
                            <Users size={20}/> Dành Cho Nhân Viên
                        </button>
                    </div>
                </div>
            )}

            {/* Banner Section */}
            <div className="bg-gradient-to-br from-orange-400 to-red-500 text-white py-16 md:py-24 px-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="relative z-10 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg leading-tight">
                        Hương Vị Ngọt Ngào <br/> Trao Gửi Yêu Thương
                    </h1>
                    <p className="text-lg md:text-xl opacity-90 mb-8 max-w-xl mx-auto font-medium">
                        Chuyên các loại bánh kem sinh nhật, sự kiện với nguyên liệu tươi ngon nhất, thiết kế độc đáo theo yêu cầu của bạn.
                    </p>
                    <a href="#products" className="inline-block bg-white text-orange-600 px-8 py-3 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-orange-50 transition-all transform hover:scale-105">
                        Xem Menu Ngay
                    </a>
                </div>
            </div>

            {/* Product Showcase */}
            <main id="products" className="flex-1 max-w-7xl mx-auto p-6 md:p-12 w-full">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Sản Phẩm Nổi Bật</h2>
                    <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {SAMPLE_PRODUCTS.map(product => (
                        <div key={product.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-orange-100 flex flex-col h-full">
                            <div className="relative pt-[100%] overflow-hidden bg-gray-100">
                                <img 
                                    src={product.image} 
                                    alt={product.name} 
                                    className="absolute top-0 left-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                {product.tag && (
                                    <span className="absolute top-3 left-3 bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                        {product.tag}
                                    </span>
                                )}
                                <button className="absolute bottom-3 right-3 bg-white text-orange-600 p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 hover:bg-orange-600 hover:text-white">
                                    <ShoppingCart size={20} />
                                </button>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-orange-600 transition-colors line-clamp-1">{product.name}</h3>
                                <p className="text-gray-500 text-sm mb-4 line-clamp-2">Bánh tươi mới mỗi ngày, trang trí theo yêu cầu riêng.</p>
                                <div className="mt-auto flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
                                    <span className="text-orange-600 font-extrabold text-lg">{product.price} đ</span>
                                    <span className="text-xs text-gray-400">Xem chi tiết</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* About Us Section */}
            <section id="about" className="bg-white py-16 px-6 border-t border-orange-100">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
                    <div className="flex-1 space-y-6">
                        <div className="inline-block bg-orange-100 text-orange-600 px-4 py-1 rounded-full text-sm font-bold mb-2">Câu chuyện của chúng tôi</div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-800">Tâm Huyết Trong Từng Chiếc Bánh</h2>
                        <p className="text-gray-600 leading-relaxed text-lg">
                            Tại BanhKemMeo, chúng tôi tin rằng mỗi chiếc bánh không chỉ là món ăn, mà là một tác phẩm nghệ thuật chứa đựng tình cảm. 
                            Với nguyên liệu thượng hạng và đội ngũ thợ bánh lành nghề, chúng tôi cam kết mang đến những chiếc bánh hoàn hảo nhất cho ngày vui của bạn.
                        </p>
                        <div className="grid grid-cols-2 gap-6 mt-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Check size={20}/></div>
                                <span className="font-medium text-gray-700">Nguyên liệu tươi sạch</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Check size={20}/></div>
                                <span className="font-medium text-gray-700">Không chất bảo quản</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Check size={20}/></div>
                                <span className="font-medium text-gray-700">Giao hàng đúng hẹn</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 p-3 rounded-full text-orange-600"><Check size={20}/></div>
                                <span className="font-medium text-gray-700">Thiết kế theo yêu cầu</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 relative">
                        <div className="absolute top-[-20px] left-[-20px] w-24 h-24 bg-orange-200 rounded-full opacity-50 blur-xl"></div>
                        <img 
                            src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80" 
                            alt="Making cake" 
                            className="rounded-2xl shadow-2xl relative z-10 w-full object-cover aspect-video"
                        />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12 px-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <div className="flex items-center gap-2 font-bold text-2xl text-white mb-4">
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white"><Cake size={18} /></div>
                            BanhKemMeo.vn
                        </div>
                        <p className="text-gray-400 mb-4">Nơi biến những ý tưởng ngọt ngào thành hiện thực.</p>
                        <div className="flex gap-4">
                            {/* Social Icons placeholder */}
                            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-600 transition cursor-pointer">F</div>
                            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-600 transition cursor-pointer">I</div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-4">Liên Hệ</h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3"><MapPin size={18} className="text-orange-500"/> 123 Đường Bánh Ngọt, TP.HCM</li>
                            <li className="flex items-center gap-3"><Phone size={18} className="text-orange-500"/> 0868.679.094</li>
                            <li className="flex items-center gap-3"><MessageCircle size={18} className="text-orange-500"/> hotro@banhkemmeo.vn</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg mb-4">Giờ Mở Cửa</h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3"><Clock size={18} className="text-orange-500"/> Thứ 2 - Thứ 6: 7:00 - 21:00</li>
                            <li className="flex items-center gap-3"><Clock size={18} className="text-orange-500"/> Thứ 7 - CN: 8:00 - 22:00</li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500">
                    © 2024 BanhKemMeo.vn. All rights reserved.
                </div>
            </footer>
        </div>
      );
  }

  // LOGIN / REGISTER / DASHBOARD VIEWS
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
             <button onClick={handleLogout} className="block w-full text-left py-3 text-red-500 mt-4 font-bold">Đăng xuất</button>
          </nav>
        </div>
      )}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'create-order' && <CreateOrderForm onSubmit={handleCreateOrder} />}
          {activeTab === 'orders' && <OrderList orders={orders} />}
          {activeTab === 'users' && <UserManagement users={usersList} currentUser={appUser} onUpdateRole={handleUpdateRole} />}
        </div>
      </main>
    </div>
  );
}

// --- SUB COMPONENTS (UNCHANGED) ---
const SidebarItem = ({ icon, label, active, onClick, visible = true }) => {
  if (!visible) return null;
  return (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-700'}`}>{icon}<span>{label}</span></button>);
};

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024; 
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
};

const AIConsultantModal = ({ isOpen, onClose, onApply }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  if (!isOpen) return null;
  const handleConsult = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setResult(null);
    const systemPrompt = `Bạn là trợ lý ảo tiệm bánh BanhKemMeo. Gợi ý đơn hàng JSON. Output format: { "cakeType": "...", "requests": "...", "message": "..." }`;
    try {
      const fullPrompt = `${systemPrompt}\n\nYêu cầu: "${prompt}"`;
      const textResponse = await callGemini(fullPrompt);
      const jsonStr = textResponse.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(jsonStr));
    } catch (e) { alert("AI gặp lỗi hoặc chưa cấu hình Key."); console.error(e); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24}/></button>
        <div className="flex items-center gap-2 font-bold text-lg mb-4 text-orange-600"><Sparkles className="text-yellow-400" /> Trợ Lý Mèo AI</div>
        {!result ? (
            <>
              <p className="text-gray-600 mb-3 text-sm">Mô tả nhu cầu (VD: Sinh nhật bé trai 5 tuổi, thích siêu nhân)...</p>
              <textarea className="w-full border border-orange-200 rounded-xl p-3 h-28 focus:ring-2 focus:ring-orange-500 outline-none text-gray-700 bg-orange-50" value={prompt} onChange={e => setPrompt(e.target.value)} />
              <button onClick={handleConsult} disabled={loading || !prompt} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50">{loading ? <Loader className="animate-spin" /> : <Sparkles size={18} />} {loading ? 'Đang suy nghĩ...' : 'Hỏi Ý Kiến AI'}</button>
            </>
        ) : (
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100"><h3 className="font-bold text-orange-800 text-sm mb-2 uppercase">Gợi ý từ AI:</h3><div className="space-y-2 text-sm text-gray-700"><p><strong>Loại bánh:</strong> {result.cakeType}</p><p><strong>Chi tiết:</strong> {result.requests}</p><p><strong>Lời chúc:</strong> "{result.message}"</p></div></div>
              <div className="flex gap-3"><button onClick={() => setResult(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Thử lại</button><button onClick={() => { onApply(result); onClose(); }} className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">Áp dụng</button></div>
            </div>
        )}
      </div>
    </div>
  );
};

const GenerateZaloModal = ({ order, onClose }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const generate = async () => {
      const prompt = `Viết tin nhắn Zalo xác nhận đơn hàng bánh kem:\nKhách: ${order.customerName}\nLoại: ${order.cakeType}\nLấy: ${new Date(order.pickupTime).toLocaleString('vi-VN')}\nTiền: ${order.total}\nCọc: ${order.deposit}\nCòn: ${order.total - order.deposit}`;
      const res = await callGemini(prompt);
      setMessage(res); setLoading(false);
    };
    generate();
  }, [order]);
  const copyToClipboard = () => { navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400"><X size={24}/></button>
        <div className="flex items-center gap-2 font-bold mb-4 text-blue-600"><MessageCircle size={20} /> Soạn Tin Nhắn Zalo</div>
        {loading ? <div className="py-8 text-center text-gray-500"><Loader className="animate-spin inline mr-2"/>AI đang viết...</div> : <><textarea className="w-full h-40 p-3 border rounded-lg text-sm mb-4" value={message} onChange={(e) => setMessage(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Đóng</button><button onClick={copyToClipboard} className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${copied ? 'bg-green-600' : 'bg-blue-600'}`}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Đã Copy' : 'Copy Tin'}</button></div></>}
      </div>
    </div>
  );
};

const AuthScreen = ({ type, onSwitch, onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const handleSubmit = (e) => { e.preventDefault(); if (type === 'login') onSubmit(formData.phone, formData.password); else onSubmit(formData.name, formData.phone, formData.password); };
  return (<div className="w-full"><form onSubmit={handleSubmit} className="space-y-4">{type === 'register' && <div><label className="block text-sm font-medium mb-1">Họ Tên</label><input required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/></div>}<div><label className="block text-sm font-medium mb-1">Số Điện Thoại</label><input required type="tel" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}/></div><div><label className="block text-sm font-medium mb-1">Mật Khẩu</label><input required type="password" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}/></div><button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition">{type === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</button></form><div className="mt-6 text-center"><button onClick={onSwitch} className="text-orange-600 hover:underline text-sm">{type === 'login' ? 'Đăng ký tài khoản mới' : 'Đã có tài khoản? Đăng nhập'}</button></div></div>);
};

const CreateOrderForm = ({ onSubmit }) => {
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
          <div className="space-y-4"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Chi Tiết Bánh</h3><div><label className="text-sm font-medium">Loại bánh</label><select required className={inputClass} value={form.cakeType} onChange={e => setForm({...form, cakeType: e.target.value})}><option value="">-- Chọn --</option><option value="Bánh Kem Sữa Tươi">Bánh Kem Sữa Tươi</option><option value="Bánh Mousse">Bánh Mousse</option><option value="Bánh Tiramisu">Bánh Tiramisu</option><option value="Bánh Bắp">Bánh Bắp</option><option value="Bánh Bông Lan Trứng Muối">Bánh Bông Lan Trứng Muối</option><option value="Khác">Khác</option></select></div><div><label className="text-sm font-medium">Yêu cầu</label><textarea className={`${inputClass} h-20`} value={form.requests} onChange={e => setForm({...form, requests: e.target.value})} /></div><div><label className="text-sm font-medium">Lời chúc</label><input className={inputClass} value={form.message} onChange={e => setForm({...form, message: e.target.value})} /></div></div>
        </div>
        <div className="mt-6"><h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><ImageIcon size={20}/> Ảnh Mẫu (Max 5)</h3><div className="flex items-center justify-center w-full"><label className="flex flex-col items-center justify-center w-full h-32 border-2 border-orange-300 border-dashed rounded-lg cursor-pointer bg-orange-50 hover:bg-orange-100 transition"><div className="flex flex-col items-center justify-center pt-5 pb-6"><Upload className="w-8 h-8 mb-2 text-orange-500" /><p className="text-sm text-gray-500 font-semibold">Tải ảnh lên</p></div><input type="file" className="hidden" multiple accept="image/*" onChange={handleImageChange} /></label></div>{images.length > 0 && <div className="grid grid-cols-5 gap-4 mt-4">{images.map((img, i) => <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border"><img src={img} className="w-full h-full object-cover" /><button type="button" onClick={() => {setImages(prev => prev.filter((_, idx) => idx !== i))}} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button></div>)}</div>}</div>
        <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-200"><h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18}/> Thanh Toán</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div><label className="text-sm font-bold">Tổng tiền</label><input required type="number" className={`${inputClass} font-bold text-lg`} value={form.total} onChange={e => setForm({...form, total: Number(e.target.value)})} /></div><div><label className="text-sm font-bold">Đặt cọc</label><input type="number" className={`${inputClass} text-blue-600`} value={form.deposit} onChange={e => setForm({...form, deposit: Number(e.target.value)})} /></div><div><label className="text-sm font-bold">Còn lại</label><div className="w-full p-3 bg-white border border-gray-300 rounded-lg text-red-600 font-bold text-lg">{remaining.toLocaleString()} đ</div></div></div></div>
        <div className="mt-8 flex justify-end"><button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold py-3 px-10 rounded-lg shadow-lg transition flex items-center gap-2"><ClipboardList/> Tạo Đơn Ngay</button></div>
      </form>
      <AIConsultantModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} onApply={handleAiApply} />
    </div>
  );
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
