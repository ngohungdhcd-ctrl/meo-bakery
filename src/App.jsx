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
  AlertCircle
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

// --- FIREBASE SETUP ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- GEMINI API UTILS ---
const apiKey = ""; 

const callGemini = async (prompt) => {
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
    return "Đã xảy ra lỗi kết nối với Trợ lý AI.";
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

// --- COMPONENTS ---

const Logo = ({ className }) => (
  <div className={`flex items-center gap-2 font-bold text-2xl text-orange-600 ${className}`}>
    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white">
      <Cake size={24} />
    </div>
    <span>BanhKemMeo.vn</span>
  </div>
);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-xl text-white font-medium flex items-center gap-2 animate-fade-in-down ${type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
      {type === 'error' ? <AlertCircle size={20}/> : <Check size={20}/>}
      {message}
    </div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [user, setFirebaseUser] = useState(null); // Auth user
  const [appUser, setAppUser] = useState(null); // DB User profile
  const [usersList, setUsersList] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const [view, setView] = useState('loading'); 
  const [activeTab, setActiveTab] = useState('create-order'); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  // 1. Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      if (!u) setView('login'); 
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data (Real-time)
  useEffect(() => {
    if (!user) return;

    // Listen to Users
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubUsers = onSnapshot(usersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(list);
      
      // Check if current logged in phone exists in DB locally to keep session state
      const savedPhone = localStorage.getItem('bkm_phone');
      if (savedPhone) {
        const found = list.find(u => u.phone === savedPhone);
        if (found) {
          setAppUser(found);
          setView('dashboard');
           if (found.role === ROLES.BAKER) setActiveTab('orders');
        } else {
          setView('login');
        }
      } else {
        setView('login');
      }
    }, (err) => console.error("Users sync error", err));

    // Listen to Orders (Ordered by newest)
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    // Note: Simple query, sorting in memory to avoid index requirement errors in this environment
    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(list);
    }, (err) => console.error("Orders sync error", err));

    return () => {
      unsubUsers();
      unsubOrders();
    };
  }, [user]);

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
      name,
      phone,
      password, // In real app, hash this!
      role: isOwner ? ROLES.OWNER : ROLES.PENDING,
      createdAt: new Date().toISOString()
    };

    try {
      // Use phone as Doc ID for uniqueness
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
    setView('login');
  };

  const handleCreateOrder = async (orderData) => {
    try {
      const newOrder = {
        ...orderData,
        createdBy: appUser.name,
        createdAt: new Date().toISOString(),
        status: 'new',
        orderId: Date.now().toString().slice(-6) // Simple short ID
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), newOrder);
      showToast('Tạo đơn thành công!');
      setActiveTab('orders');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi tạo đơn', 'error');
    }
  };

  const handleUpdateRole = async (phone, newRole) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', phone), {
        role: newRole
      });
      showToast('Đã cập nhật quyền hạn');
    } catch (e) {
      showToast('Lỗi cập nhật', 'error');
    }
  };

  // --- RENDER ---

  if (view === 'loading') return <div className="h-screen flex items-center justify-center text-orange-500"><Loader className="animate-spin" size={40}/></div>;

  if (view === 'login') {
    return (
      <>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <AuthScreen type="login" onSwitch={() => setView('register')} onSubmit={handleLogin} />
      </>
    );
  }

  if (view === 'register') {
    return (
      <>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        <AuthScreen type="register" onSwitch={() => setView('login')} onSubmit={handleRegister} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-800 flex flex-col md:flex-row">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-orange-100 h-screen sticky top-0 shadow-sm">
        <div className="p-6 border-b border-orange-100">
          <Logo />
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<PlusCircle size={20}/>} 
            label="Tạo Đơn Bánh" 
            active={activeTab === 'create-order'} 
            onClick={() => setActiveTab('create-order')}
            visible={appUser?.role !== ROLES.BAKER} 
          />
          <SidebarItem 
            icon={<ClipboardList size={20}/>} 
            label="Danh Sách Đơn" 
            active={activeTab === 'orders'} 
            onClick={() => setActiveTab('orders')} 
          />
          <SidebarItem 
            icon={<Users size={20}/>} 
            label="Nhân Sự & Phân Quyền" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')}
            visible={appUser?.role === ROLES.OWNER || appUser?.role === ROLES.MANAGER}
          />
        </nav>

        <div className="p-4 border-t border-orange-100 bg-orange-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 font-bold">
              {appUser?.name?.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium truncate">{appUser?.name}</p>
              <p className="text-xs text-gray-500 uppercase">{ROLE_LABELS[appUser?.role]}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-medium w-full p-2 rounded hover:bg-red-50 transition-colors"
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <Logo className="text-lg" />
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-orange-600">
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-10 bg-white pt-20 px-6">
          <nav className="space-y-4 text-lg">
             {appUser?.role !== ROLES.BAKER && (
                <button onClick={() => { setActiveTab('create-order'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 border-b">Tạo Đơn Bánh</button>
             )}
             <button onClick={() => { setActiveTab('orders'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 border-b">Danh Sách Đơn</button>
             {(appUser?.role === ROLES.OWNER || appUser?.role === ROLES.MANAGER) && (
                <button onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 border-b">Quản Lý Nhân Sự</button>
             )}
             <button onClick={handleLogout} className="block w-full text-left py-2 text-red-500 mt-4">Đăng xuất</button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'create-order' && <CreateOrderForm onSubmit={handleCreateOrder} />}
          {activeTab === 'orders' && <OrderList orders={orders} />}
          {activeTab === 'users' && <UserManagement users={usersList} currentUser={appUser} onUpdateRole={handleUpdateRole} />}
        </div>
      </main>
    </div>
  );
}

// --- SUB COMPONENTS (UNCHANGED LOGIC, JUST PROPS) ---

const SidebarItem = ({ icon, label, active, onClick, visible = true }) => {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
        active 
        ? 'bg-orange-500 text-white shadow-md' 
        : 'text-gray-600 hover:bg-orange-100'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
};

// --- GEMINI POWERED MODAL (UNCHANGED) ---
const AIConsultantModal = ({ isOpen, onClose, onApply }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleConsult = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);

    const systemPrompt = `
      Bạn là một trợ lý ảo am hiểu về bánh kem tại tiệm "Bánh Kem Mèo".
      Người dùng sẽ mô tả nhu cầu (dịp lễ, người nhận, sở thích).
      Hãy gợi ý một đơn hàng phù hợp dưới định dạng JSON thuần túy (không có markdown).
      Các loại bánh có sẵn: "Bánh Kem Sữa Tươi", "Bánh Mousse", "Bánh Tiramisu", "Bánh Bắp", "Bánh Bông Lan Trứng Muối", "Khác".
      
      JSON output format:
      {
        "cakeType": "Một trong các loại trên",
        "requests": "Mô tả chi tiết cốt bánh, trang trí, độ ngọt dựa trên yêu cầu",
        "message": "Một lời chúc ngắn gọn, ý nghĩa để ghi lên bánh"
      }
    `;

    try {
      const fullPrompt = `${systemPrompt}\n\nYêu cầu của khách: "${prompt}"`;
      const textResponse = await callGemini(fullPrompt);
      const jsonStr = textResponse.replace(/```json|```/g, '').trim();
      const parsedData = JSON.parse(jsonStr);
      setResult(parsedData);
    } catch (e) {
      alert("AI không hiểu yêu cầu hoặc có lỗi.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="text-yellow-300" /> Trợ Lý Mèo AI
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
        </div>
        
        <div className="p-6">
          {!result ? (
            <>
              <p className="text-gray-600 mb-4 text-sm">
                Nhập thông tin khách hàng (VD: "Sinh nhật mẹ, thích màu tím, ít ngọt" hoặc "Kỷ niệm ngày cưới, sang trọng"). AI sẽ gợi ý mẫu bánh và lời chúc.
              </p>
              <textarea 
                className="w-full border border-purple-200 rounded-xl p-3 h-28 focus:ring-2 focus:ring-purple-500 outline-none text-gray-700 bg-purple-50"
                placeholder="VD: Bạn tôi thất tình, cần một cái bánh để an ủi, hài hước một chút..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
              <button 
                onClick={handleConsult}
                disabled={loading || !prompt}
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loading ? <Loader className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? 'Đang suy nghĩ...' : 'Hỏi Ý Kiến AI'}
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 text-sm mb-2 uppercase">Gợi ý từ AI:</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Loại bánh:</strong> {result.cakeType}</p>
                  <p><strong>Chi tiết:</strong> {result.requests}</p>
                  <p><strong>Lời chúc:</strong> "{result.message}"</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setResult(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Thử lại
                </button>
                <button 
                  onClick={() => { onApply(result); onClose(); }}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Áp dụng vào đơn
                </button>
              </div>
            </div>
          )}
        </div>
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
      const prompt = `
        Hãy viết một tin nhắn xác nhận đơn hàng lịch sự, chuyên nghiệp và thân thiện để gửi qua Zalo cho khách hàng.
        Tên tiệm: Bánh Kem Mèo.
        Thông tin đơn:
        - Khách: ${order.customerName}
        - Loại: ${order.cakeType}
        - Lấy lúc: ${new Date(order.pickupTime).toLocaleString('vi-VN')}
        - Tổng tiền: ${order.total.toLocaleString()} đ
        - Đã cọc: ${order.deposit.toLocaleString()} đ
        - Còn lại: ${(order.total - order.deposit).toLocaleString()} đ
        - Địa chỉ: ${order.address || 'Tại tiệm'}
        - Lời chúc: ${order.message}
        
        Cuối thư nhắc khách kiểm tra lại thông tin và cảm ơn.
      `;
      const res = await callGemini(prompt);
      setMessage(res);
      setLoading(false);
    };
    generate();
  }, [order]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl animate-fade-in-up">
        <div className="bg-blue-600 p-4 rounded-t-xl text-white flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold">
            <MessageCircle size={20} /> Soạn Tin Nhắn Zalo
          </div>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 gap-2">
              <Loader className="animate-spin text-blue-600" size={32} />
              <p>AI đang viết tin nhắn...</p>
            </div>
          ) : (
            <>
              <textarea 
                className="w-full h-48 p-3 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Đóng</button>
                <button 
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-white transition ${copied ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {copied ? <Check size={18}/> : <Copy size={18}/>}
                  {copied ? 'Đã Copy!' : 'Copy Tin Nhắn'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const AuthScreen = ({ type, onSwitch, onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'login') onSubmit(formData.phone, formData.password);
    else onSubmit(formData.name, formData.phone, formData.password);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-orange-100">
        <div className="text-center mb-8">
          <Logo className="justify-center mb-2" />
          <h2 className="text-gray-500 text-sm">Hệ thống quản lý tiệm bánh</h2>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {type === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {type === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên</label>
              <input 
                required 
                type="text" 
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
                placeholder="Nhập họ tên..."
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số Điện Thoại</label>
            <input 
              required 
              type="tel" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              placeholder="VD: 0868679094"
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật Khẩu</label>
            <input 
              required 
              type="password" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              placeholder="••••••"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg shadow-lg transition transform active:scale-95">
            {type === 'login' ? 'Vào Hệ Thống' : 'Đăng Ký Ngay'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={onSwitch} className="text-orange-600 hover:underline text-sm font-medium">
            {type === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
          </button>
          {type === 'login' && (
            <p className="mt-4 text-xs text-gray-400">
              *Demo: Nhập SĐT 0868679094 để thử quyền Owner
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const CreateOrderForm = ({ onSubmit }) => {
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    pickupTime: '',
    cakeType: '',
    requests: '',
    message: '',
    total: 0,
    deposit: 0
  });
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const remaining = form.total - form.deposit;
  const inputClass = "w-full p-3 border border-gray-300 rounded-lg outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";

  const handleAiApply = (aiData) => {
    setForm(prev => ({
      ...prev,
      cakeType: aiData.cakeType || prev.cakeType,
      requests: aiData.requests || prev.requests,
      message: aiData.message || prev.message
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({...form, remaining});
    setForm({
      customerName: '', phone: '', address: '', pickupTime: '', 
      cakeType: '', requests: '', message: '', total: 0, deposit: 0
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden relative">
      <div className="bg-orange-500 p-4 px-6 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <PlusCircle size={24}/> Tạo Đơn Bánh Mới
        </h2>
        <button 
          onClick={() => setAiModalOpen(true)}
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 backdrop-blur-sm transition border border-white/40"
        >
          <Sparkles size={16} className="text-yellow-300"/> Trợ Lý Mèo AI
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Thông Tin Khách Hàng</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Tên khách hàng</label>
              <input required type="text" className={inputClass} value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} placeholder="Nguyễn Văn A" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Số điện thoại</label>
              <input required type="tel" className={inputClass} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="09xxxx..." />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Địa chỉ giao hàng</label>
              <input type="text" className={inputClass} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Để trống nếu lấy tại tiệm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Thời gian lấy bánh</label>
              <input required type="datetime-local" className={inputClass} value={form.pickupTime} onChange={e => setForm({...form, pickupTime: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4 flex justify-between">
              Chi Tiết Bánh
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Loại bánh</label>
              <select required className={inputClass} value={form.cakeType} onChange={e => setForm({...form, cakeType: e.target.value})}>
                <option value="">-- Chọn loại bánh --</option>
                <option value="Bánh Kem Sữa Tươi">Bánh Kem Sữa Tươi</option>
                <option value="Bánh Mousse">Bánh Mousse</option>
                <option value="Bánh Tiramisu">Bánh Tiramisu</option>
                <option value="Bánh Bắp">Bánh Bắp</option>
                <option value="Bánh Bông Lan Trứng Muối">Bánh Bông Lan Trứng Muối</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Yêu cầu của khách (Size, cốt bánh...)</label>
              <textarea className={`${inputClass} h-20`} value={form.requests} onChange={e => setForm({...form, requests: e.target.value})} placeholder="VD: Size 20cm, cốt vani, ít ngọt..." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Lời chúc ghi trên bánh</label>
              <input type="text" className={inputClass} value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="VD: Happy Birthday Mẹ Yêu" />
            </div>
          </div>
        </div>

        <div className="mt-8 bg-orange-50 p-6 rounded-xl border border-orange-200">
           <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18}/> Thanh Toán</h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tổng tiền (VNĐ)</label>
                <input required type="number" className={`${inputClass} font-bold text-lg`} value={form.total} onChange={e => setForm({...form, total: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Đặt cọc (VNĐ)</label>
                <input type="number" className={`${inputClass} text-blue-600`} value={form.deposit} onChange={e => setForm({...form, deposit: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Còn lại (VNĐ)</label>
                <div className="w-full p-3 bg-white border border-gray-300 rounded-lg text-red-600 font-bold text-lg">
                  {remaining.toLocaleString()} đ
                </div>
              </div>
           </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold py-3 px-10 rounded-lg shadow-lg transition flex items-center gap-2">
            <ClipboardList/> Tạo Đơn Ngay
          </button>
        </div>
      </form>
      
      <AIConsultantModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} onApply={handleAiApply} />
    </div>
  );
};

const OrderList = ({ orders }) => {
  const [selectedOrderForZalo, setSelectedOrderForZalo] = useState(null);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Danh Sách Đơn Hàng</h2>
        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">Tổng: {orders.length} đơn</span>
       </div>

       {orders.length === 0 ? (
         <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
           <ShoppingCart className="mx-auto text-gray-300 mb-4" size={48} />
           <p className="text-gray-500">Chưa có đơn hàng nào.</p>
         </div>
       ) : (
         <div className="grid gap-4">
           {orders.map(order => (
             <div key={order.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-orange-300 transition-colors relative group">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-2">
                       <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold uppercase">{order.cakeType}</span>
                       <span className="text-gray-400 text-sm">#{order.orderId || 'NEW'}</span>
                       <span className="text-gray-400 text-xs ml-auto md:ml-2">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                     </div>
                     <h3 className="text-lg font-bold text-gray-800">{order.customerName} - {order.phone}</h3>
                     <p className="text-gray-600 text-sm mt-1">🕒 Lấy bánh: {new Date(order.pickupTime).toLocaleString('vi-VN')}</p>
                     <p className="text-gray-600 text-sm">📍 {order.address || 'Lấy tại tiệm'}</p>
                     
                     {order.requests && (
                       <div className="mt-3 bg-gray-50 p-3 rounded text-sm text-gray-700">
                         <strong>Yêu cầu:</strong> {order.requests}
                       </div>
                     )}
                     {order.message && (
                        <div className="mt-2 text-sm text-orange-600 italic">
                          "Lời chúc: {order.message}"
                        </div>
                     )}
                     
                     <div className="mt-4 flex gap-2">
                        <button 
                          onClick={() => setSelectedOrderForZalo(order)}
                          className="text-blue-600 text-sm font-medium hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center gap-2 transition"
                        >
                          <Sparkles size={14} className="text-yellow-500"/> Soạn tin Zalo
                        </button>
                        <div className="ml-auto md:hidden font-medium text-sm text-gray-500 flex items-center">
                           Người tạo: {order.createdBy}
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex flex-col items-end min-w-[150px] border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                     <div className="text-right">
                       <p className="text-xs text-gray-500">Tổng tiền</p>
                       <p className="font-bold text-lg">{order.total.toLocaleString()} đ</p>
                     </div>
                     <div className="text-right mt-2">
                       <p className="text-xs text-gray-500">Đã cọc</p>
                       <p className="font-medium text-blue-600">{order.deposit.toLocaleString()} đ</p>
                     </div>
                     <div className="text-right mt-2 pt-2 border-t border-dashed w-full">
                       <p className="text-xs text-gray-500">Còn lại</p>
                       <p className="font-bold text-red-600 text-xl">{(order.total - order.deposit).toLocaleString()} đ</p>
                     </div>
                     <div className="mt-auto hidden md:block text-xs text-gray-400">
                        Tạo bởi: {order.createdBy}
                     </div>
                  </div>
                </div>
             </div>
           ))}
         </div>
       )}
       
       {selectedOrderForZalo && (
         <GenerateZaloModal order={selectedOrderForZalo} onClose={() => setSelectedOrderForZalo(null)} />
       )}
    </div>
  );
};

const UserManagement = ({ users, currentUser, onUpdateRole }) => {
  const isOwner = currentUser?.role === ROLES.OWNER;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Users size={24}/> Quản Lý Nhân Sự
        </h2>
        {!isOwner && <span className="text-sm text-orange-600 bg-orange-100 px-3 py-1 rounded-full">Chế độ xem</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase">
              <th className="p-4">Họ Tên</th>
              <th className="p-4">Số Điện Thoại</th>
              <th className="p-4">Vai Trò</th>
              {isOwner && <th className="p-4 text-right">Hành Động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user, idx) => (
              <tr key={idx} className="hover:bg-orange-50 transition-colors">
                <td className="p-4 font-medium">{user.name}</td>
                <td className="p-4 text-gray-600">{user.phone}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                    ${user.role === ROLES.OWNER ? 'bg-purple-100 text-purple-700' : ''}
                    ${user.role === ROLES.MANAGER ? 'bg-blue-100 text-blue-700' : ''}
                    ${user.role === ROLES.SALES ? 'bg-green-100 text-green-700' : ''}
                    ${user.role === ROLES.BAKER ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${user.role === ROLES.PENDING ? 'bg-gray-200 text-gray-600' : ''}
                  `}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </td>
                {isOwner && (
                  <td className="p-4 text-right">
                    {user.phone !== OWNER_PHONE && (
                      <select 
                        className="bg-white border border-gray-300 text-sm rounded p-1 outline-none focus:border-orange-500"
                        value={user.role}
                        onChange={(e) => onUpdateRole(user.phone, e.target.value)}
                      >
                         <option value={ROLES.PENDING}>Chờ duyệt</option>
                         <option value={ROLES.MANAGER}>Quản lý</option>
                         <option value={ROLES.SALES}>Bán hàng</option>
                         <option value={ROLES.BAKER}>Thợ bánh</option>
                      </select>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
