import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Menu, X, ChevronRight, Plus, Trash2, Edit, 
  Settings, LayoutGrid, Package, Image as ImageIcon, Save, LogOut, 
  User, RefreshCw, Loader2, Database
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

// --- CẤU HÌNH FIREBASE (DÀNH CHO BẠN SỬA ĐỔI KHI CHẠY Ở MÁY CÁ NHÂN) ---
// Khi copy về VS Code, hãy bỏ comment và điền thông tin của bạn vào đây:
/*
const yourFirebaseConfig = {
  apiKey: "AIzaSyBM8pividJcQ4EgXQ3pIVdXqz_pyQB8rPA",
  authDomain: "meo-bakery-4c04f.firebaseapp.com",
  projectId: "meo-bakery-4c04f",
  storageBucket: "meo-bakery-4c04f.firebasestorage.app",
  messagingSenderId: "289466483676",
  appId: "1:289466483676:web:92f6abd8b8e1f9077c4519"
};
*/

// --- KHỞI TẠO FIREBASE (LOGIC CHẠY TRONG PREVIEW) ---
// Chúng tôi sử dụng biến môi trường để demo hoạt động ngay lập tức.
// Khi bạn chạy thật, hãy thay `firebaseConfig` bằng `yourFirebaseConfig` ở trên.
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {}; // Fallback empty object to prevent crash if config missing

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Sử dụng appId từ môi trường hoặc fallback
const appId = typeof __app_id !== 'undefined' ? __app_id : 'meo-bakery-demo';

// --- Dữ liệu mẫu (Dùng để khởi tạo DB nếu trống) ---
const INITIAL_CATEGORIES = [
  { name: 'Bánh Kem Sữa Tươi', slug: 'sua-tuoi' },
  { name: 'Bánh Kem Bắp', slug: 'kem-bap' },
  { name: 'Tiramisu & Mousse', slug: 'tiramisu' },
  { name: 'Bánh Mì & Pastry', slug: 'banh-mi' },
];

const INITIAL_PRODUCTS = [
  {
    name: 'Bánh Kem Bắp Hương Xưa',
    price: 350000,
    categoryName: 'Bánh Kem Bắp',
    image: 'https://images.unsplash.com/photo-1557925923-cd4c295951b0?auto=format&fit=crop&q=80&w=800',
    description: 'Cốt bánh bông lan mềm mịn kết hợp với sốt kem bắp thơm lừng.'
  },
  {
    name: 'Strawberry Shortcake',
    price: 420000,
    categoryName: 'Bánh Kem Sữa Tươi',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&q=80&w=800',
    description: 'Dâu tây tươi Đà Lạt cùng lớp kem sữa tươi ít ngọt.'
  },
  {
    name: 'Tiramisu Cổ Điển',
    price: 85000,
    categoryName: 'Tiramisu & Mousse',
    image: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&q=80&w=800',
    description: 'Hương vị cà phê Ý đậm đà quyện cùng phô mai Mascarpone.'
  }
];

const DEFAULT_SETTINGS = {
  shopName: 'Tiệm Bánh Hạnh Phúc',
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/992/992717.png',
  bannerUrl: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&q=80&w=1600',
  phone: '0909 123 456',
  address: '123 Đường Ngọt Ngào, Quận 1, TP.HCM'
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// --- Component Chính ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  // Data State (Từ Firestore)
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // ID category
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Khởi tạo Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. Lắng nghe dữ liệu từ Firestore (Realtime)
  useEffect(() => {
    if (!user) return;

    // Listen Settings
    const unsubSettings = onSnapshot(
      doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      },
      (error) => console.error("Settings error:", error)
    );

    // Listen Categories
    const unsubCategories = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'categories'),
      (snapshot) => {
        const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort manually since we can't use complex queries easily
        cats.sort((a, b) => a.name.localeCompare(b.name));
        setCategories(cats);
        if (cats.length > 0 && !selectedCategory) {
          setSelectedCategory(cats[0].id);
        }
      },
      (error) => console.error("Categories error:", error)
    );

    // Listen Products
    const unsubProducts = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'products'),
      (snapshot) => {
        const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(prods);
        setIsLoading(false);
      },
      (error) => console.error("Products error:", error)
    );

    return () => {
      unsubSettings();
      unsubCategories();
      unsubProducts();
    };
  }, [user, selectedCategory]);

  // --- Logic Admin (Firestore Write) ---
  
  const handleAddProduct = async (newProduct) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), newProduct);
    } catch (e) { alert('Lỗi thêm sản phẩm: ' + e.message); }
  };

  const handleUpdateProduct = async (id, updatedData) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id), updatedData);
    } catch (e) { alert('Lỗi cập nhật: ' + e.message); }
  };

  const handleDeleteProduct = async (id) => {
    if (!user) return;
    if(confirm('Xóa sản phẩm này khỏi cơ sở dữ liệu?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'products', id));
      } catch (e) { alert('Lỗi xóa: ' + e.message); }
    }
  };

  const handleAddCategory = async (name) => {
    if (!user) return;
    const newCat = {
      name,
      slug: name.toLowerCase().replace(/ /g, '-')
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), newCat);
  };

  const handleDeleteCategory = async (id) => {
    if (!user) return;
    if(confirm('Xóa danh mục? Sản phẩm thuộc danh mục này sẽ bị ẩn.')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id));
      // Nếu đang chọn danh mục vừa xóa, reset về cái đầu tiên
      if (selectedCategory === id && categories.length > 1) {
        setSelectedCategory(categories.find(c => c.id !== id)?.id);
      }
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), newSettings);
  };

  // --- Hàm Seed Data (Chỉ dùng khi DB trống) ---
  const seedData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Settings
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), DEFAULT_SETTINGS);
      
      // 2. Categories
      const catMap = {}; // name -> id
      for (const cat of INITIAL_CATEGORIES) {
        const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), cat);
        catMap[cat.name] = ref.id;
      }

      // 3. Products
      for (const prod of INITIAL_PRODUCTS) {
        // Map product to newly created category ID
        const catId = catMap[prod.categoryName];
        const { categoryName, ...prodData } = prod;
        if (catId) {
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'products'), {
            ...prodData,
            category: catId
          });
        }
      }
      alert("Đã khởi tạo dữ liệu mẫu thành công!");
    } catch (e) {
      console.error(e);
      alert("Lỗi khởi tạo: " + e.message);
    }
    setIsLoading(false);
  };

  // --- Render ---

  if (isAdminMode) {
    return (
      <AdminDashboard 
        products={products}
        categories={categories}
        settings={settings}
        onExitAdmin={() => setIsAdminMode(false)}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onUpdateSettings={handleUpdateSettings}
        onSeedData={seedData}
        hasData={categories.length > 0 || products.length > 0}
      />
    );
  }

  // Loading Screen
  if (isLoading && products.length === 0 && categories.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white text-rose-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="text-gray-500">Đang tải dữ liệu từ cửa hàng...</p>
        <button onClick={() => setIsAdminMode(true)} className="mt-8 text-sm text-blue-500 underline">
          Vào trang quản trị để tạo dữ liệu nếu lần đầu chạy
        </button>
      </div>
    );
  }

  // Storefront UI
  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-gray-800">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={settings.logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
            <span className="text-xl font-bold tracking-tight text-rose-600 hidden sm:block">
              {settings.shopName}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-gray-600">
            <a href="#" className="hover:text-rose-600 transition">Trang chủ</a>
            <a href="#" className="hover:text-rose-600 transition">Sản phẩm</a>
            <a href="#" className="hover:text-rose-600 transition">Giới thiệu</a>
            <a href="#" className="hover:text-rose-600 transition">Liên hệ</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 hover:bg-gray-100 rounded-full transition">
              <ShoppingBag className="w-6 h-6 text-gray-700" />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {cart.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setIsAdminMode(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600"
              title="Vào trang quản trị"
            >
              <User className="w-6 h-6" />
            </button>
            <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t px-4 py-4 space-y-3 shadow-lg">
            <a href="#" className="block py-2 text-gray-700">Trang chủ</a>
            <a href="#" className="block py-2 text-gray-700">Sản phẩm</a>
            <a href="#" className="block py-2 text-gray-700">Liên hệ</a>
          </div>
        )}
      </nav>

      {/* Hero Banner */}
      <div className="relative h-[400px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-black/30 z-10"></div>
        <img 
          src={settings.bannerUrl || DEFAULT_SETTINGS.bannerUrl} 
          alt="Banner" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            Hương Vị Ngọt Ngào
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl drop-shadow-md">
            Chúng tôi mang đến những chiếc bánh tươi ngon nhất mỗi ngày.
          </p>
          <button className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-full font-semibold transition shadow-lg transform hover:-translate-y-1">
            Đặt Hàng Ngay
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-12">
        {/* Category Filter */}
        <div className="flex flex-col items-center mb-12">
          <h2 className="text-3xl font-bold mb-8 text-gray-800">Thực Đơn Của Chúng Tôi</h2>
          {categories.length === 0 ? (
            <div className="text-gray-400 italic">Đang tải danh mục...</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                    selectedCategory === cat.id
                      ? 'bg-rose-600 text-white shadow-md scale-105'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-rose-300 hover:text-rose-500'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {products
            .filter(p => !selectedCategory || p.category === selectedCategory)
            .map((product) => (
            <div key={product.id} className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={product.image} 
                  onError={(e) => e.target.src = 'https://placehold.co/400x300?text=No+Image'}
                  alt={product.name}
                  className="w-full h-full object-cover transform group-hover:scale-110 transition duration-700"
                />
                <button 
                  onClick={() => setCart([...cart, product])}
                  className="absolute bottom-4 right-4 bg-white text-rose-600 p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-rose-600 hover:text-white"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-gray-800 mb-1">{product.name}</h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">{product.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-rose-600 font-bold text-lg">
                    {formatCurrency(product.price)}
                  </span>
                  <button className="text-xs text-gray-400 hover:text-rose-600 underline">
                    Chi tiết
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {products.length > 0 && products.filter(p => !selectedCategory || p.category === selectedCategory).length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500 text-lg">Chưa có sản phẩm nào trong danh mục này.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">{settings.shopName}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ngọt ngào hương vị yêu thương.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-4">Liên Hệ</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li>Địa chỉ: {settings.address}</li>
              <li>Hotline: {settings.phone}</li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-xs">
          © 2024 {settings.shopName}. Powered by Firebase.
        </div>
      </footer>
    </div>
  );
}

// --- Admin Components ---
function AdminDashboard({ 
  products, categories, settings, hasData,
  onExitAdmin, onAddProduct, onUpdateProduct, onDeleteProduct,
  onAddCategory, onDeleteCategory, onUpdateSettings, onSeedData
}) {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0">
        <div className="p-6 flex items-center gap-2 border-b border-slate-700">
          <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center font-bold">A</div>
          <span className="font-bold text-lg">Quản Trị</span>
        </div>
        <nav className="p-4 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
          <SidebarItem 
            icon={<Package size={20} />} 
            label="Sản phẩm" 
            isActive={activeTab === 'products'} 
            onClick={() => setActiveTab('products')} 
          />
          <SidebarItem 
            icon={<LayoutGrid size={20} />} 
            label="Danh mục" 
            isActive={activeTab === 'categories'} 
            onClick={() => setActiveTab('categories')} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Cài đặt chung" 
            isActive={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>
        <div className="mt-auto p-4 border-t border-slate-700">
          <button 
            onClick={onExitAdmin}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition w-full p-2"
          >
            <LogOut size={20} />
            <span>Thoát Admin</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {activeTab === 'products' ? 'Quản Lý Sản Phẩm' : 
               activeTab === 'categories' ? 'Quản Lý Danh Mục' : 'Cài Đặt Cửa Hàng'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">Dữ liệu được lưu trữ an toàn trên Firebase.</p>
          </div>
          
          {/* Nút khẩn cấp để tạo dữ liệu nếu DB trống */}
          {!hasData && (
             <button onClick={onSeedData} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
               <Database size={16} /> Khởi tạo Dữ liệu Mẫu
             </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
          {activeTab === 'products' && (
            <ProductManager 
              products={products} 
              categories={categories}
              onAdd={onAddProduct}
              onUpdate={onUpdateProduct}
              onDelete={onDeleteProduct}
            />
          )}
          {activeTab === 'categories' && (
            <CategoryManager 
              categories={categories}
              onAdd={onAddCategory}
              onDelete={onDeleteCategory}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsManager 
              settings={settings}
              onUpdate={onUpdateSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-lg transition-colors whitespace-nowrap ${
        isActive ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ProductManager({ products, categories, onAdd, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '', price: '', category: '', image: '', description: ''
  });

  // Auto-select first category if available
  useEffect(() => {
    if (categories.length > 0 && !formData.category) {
      setFormData(prev => ({ ...prev, category: categories[0].id }));
    }
  }, [categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const productData = { ...formData, price: Number(formData.price) };

    if (isEditing) {
      onUpdate(isEditing, productData);
      setIsEditing(null);
    } else {
      onAdd(productData);
    }
    setFormData({ name: '', price: '', category: categories[0]?.id || '', image: '', description: '' });
  };

  const startEdit = (product) => {
    setIsEditing(product.id);
    setFormData(product);
  };

  if (categories.length === 0) {
    return <div className="text-center p-10 text-slate-500">Vui lòng tạo ít nhất 1 danh mục trước khi thêm sản phẩm.</div>;
  }

  return (
    <div>
      <div className="bg-slate-50 p-6 rounded-xl mb-8 border border-slate-200">
        <h3 className="font-bold text-lg mb-4 text-slate-700">{isEditing ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-slate-600 mb-1">Tên sản phẩm</label>
            <input required type="text" className="w-full p-2 border border-gray-300 rounded" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Giá (VNĐ)</label>
            <input required type="number" className="w-full p-2 border border-gray-300 rounded" 
              value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Danh mục</label>
            <select className="w-full p-2 border border-gray-300 rounded" 
              value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-600 mb-1">Link Ảnh (URL)</label>
            <input required type="text" className="w-full p-2 border border-gray-300 rounded" 
              value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} />
          </div>
          <div className="col-span-2 flex gap-2 justify-end mt-2">
             {isEditing && <button type="button" onClick={() => setIsEditing(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">Hủy</button>}
             <button type="submit" className="bg-rose-600 text-white px-6 py-2 rounded hover:bg-rose-700">{isEditing ? 'Lưu' : 'Thêm'}</button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm border-b">
              <th className="p-4">Ảnh</th>
              <th className="p-4">Tên</th>
              <th className="p-4">Giá</th>
              <th className="p-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id}>
                <td className="p-4"><img src={p.image} className="w-12 h-12 object-cover rounded" /></td>
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4 text-rose-600">{formatCurrency(p.price)}</td>
                <td className="p-4 text-right flex justify-end gap-2">
                  <button onClick={() => startEdit(p)} className="p-2 text-blue-600 bg-blue-50 rounded"><Edit size={16}/></button>
                  <button onClick={() => onDelete(p.id)} className="p-2 text-red-600 bg-red-50 rounded"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryManager({ categories, onAdd, onDelete }) {
  const [newCat, setNewCat] = useState('');
  return (
    <div className="max-w-2xl">
      <div className="flex gap-4 mb-8">
        <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Tên danh mục mới..." className="flex-1 p-3 border border-gray-300 rounded" />
        <button onClick={() => { if(newCat) { onAdd(newCat); setNewCat(''); }}} className="bg-rose-600 text-white px-6 rounded">Thêm</button>
      </div>
      <div className="space-y-3">
        {categories.map(c => (
          <div key={c.id} className="flex justify-between p-4 bg-slate-50 rounded border border-slate-200">
            <span className="font-medium">{c.name}</span>
            <button onClick={() => onDelete(c.id)} className="text-red-500 p-2"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsManager({ settings, onUpdate }) {
  const handleChange = (e) => onUpdate({ ...settings, [e.target.name]: e.target.value });
  return (
    <div className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-2">
        <label className="block text-sm font-bold text-slate-700 mb-2">Tên Cửa Hàng</label>
        <input type="text" name="shopName" value={settings.shopName || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-bold text-slate-700 mb-2">Logo URL</label>
        <input type="text" name="logoUrl" value={settings.logoUrl || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded" />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-bold text-slate-700 mb-2">Banner URL</label>
        <input type="text" name="bannerUrl" value={settings.bannerUrl || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded" />
      </div>
    </div>
  );
}
