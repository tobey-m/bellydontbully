'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface CatData {
  id: number;
  name: string;
  location: string;
  lat: number;
  lng: number;
  bellyStatus: string;
  bellyText: string;
  details: string;
}

const initialCats: CatData[] = [
  {
    id: 1,
    name: 'เจ้าส้มสุดซ่า',
    location: 'หน้าคาเฟ่ Chiang Mai',
    lat: 18.7883,
    lng: 98.9853,
    bellyStatus: 'safe',
    bellyText: '🟢 Safe Zone: จกพุงได้สบาย ชอบให้เกา',
    details: 'แมวส้มตัวอ้วน ชอบนอนอาบแดดตอนเช้า'
  },
  {
    id: 2,
    name: 'พี่เสือสายโหด',
    location: 'ร้านสะดวกซื้อ',
    lat: 18.7900,
    lng: 98.9880,
    bellyStatus: 'danger',
    bellyText: '🔴 Danger Zone: ห้ามจับพุงเด็ดขาด! โดนยันแน่นอน',
    details: 'ชอบกินขนมแมวเลีย แต่อย่าทะลึ่งไปจับพุง'
  }
];

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [catIcon, setCatIcon] = useState<any>(null);
  const [cats, setCats] = useState<CatData[]>(initialCats);

  // State สำหรับฟอร์มเพิ่มแมว
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState('18.7890');
  const [lng, setLng] = useState('98.9860');
  const [bellyStatus, setBellyStatus] = useState('safe');
  const [details, setDetails] = useState('');

  useEffect(() => {
    import('leaflet/dist/leaflet.css');
    setIsClient(true);

    import('leaflet').then((L) => {
      const customIcon = L.divIcon({
        className: 'custom-cat-marker',
        html: `
          <div style="
            background-color: #ffedd5;
            border: 3px solid #f97316;
            border-radius: 50%;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
            cursor: pointer;
          ">
            🐱
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22],
      });
      setCatIcon(customIcon);
    });
  }, []);

  // ฟังก์ชันเพิ่มแมวตัวใหม่ลงในแผนที่
  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location) return;

    let bellyText = '🟢 Safe Zone: จกพุงได้สบาย ชอบให้เกา';
    if (bellyStatus === 'caution') {
      bellyText = '🟡 Caution Zone: จกได้นิดหน่อย เกิน 3 วิโดนยัน';
    } else if (bellyStatus === 'danger') {
      bellyText = '🔴 Danger Zone: ห้ามจับพุงเด็ดขาด! โดนยันแน่นอน';
    }

    const newCat: CatData = {
      id: Date.now(),
      name,
      location,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      bellyStatus,
      bellyText,
      details,
    };

    setCats([...cats, newCat]);
    // ล้างค่าฟอร์ม
    setName('');
    setLocation('');
    setDetails('');
    setShowForm(false);
  };

  return (
    <main className="min-h-screen bg-orange-50/50 flex flex-col justify-between p-3 sm:p-6">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full text-center my-2 sm:my-4">
        <h1 className="text-3xl sm:text-5xl font-black text-orange-600 mb-1 tracking-tight drop-shadow-sm">
          🐱 bellydontbully 🐾
        </h1>
        <p className="text-xs sm:text-base text-gray-600 font-medium px-2 mb-3">
          พิกัดทาสแมว — เช็กระดับความปลอดภัยก่อนจกพุงน้อง!
        </p>

        {/* ปุ่มเปิด/ปิด ฟอร์มเพิ่มพิกัดแมว */}
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-5 rounded-full shadow-md transition-all active:scale-95 text-sm sm:text-base"
        >
          {showForm ? '❌ ปิดฟอร์ม' : '➕ ปักหมุดแมวที่เจอ'}
        </button>
      </header>

      {/* ฟอร์มปักหมุดแมวตัวใหม่ */}
      {showForm && (
        <form
          onSubmit={handleAddCat}
          className="max-w-4xl mx-auto w-full bg-white p-4 sm:p-6 rounded-2xl shadow-lg border-2 border-orange-200 mb-4 transition-all"
        >
          <h2 className="text-lg font-bold text-gray-800 mb-3 text-center">📍 เพิ่มพิกัดน้องแมวตัวใหม่</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">ชื่อแมว / ฉายา</label>
              <input
                type="text"
                required
                placeholder="เช่น เจ้าส้ม, พี่ดำ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">สถานที่เจอ</label>
              <input
                type="text"
                required
                placeholder="เช่น หน้าร้านสะดวกซื้อ ซอย 5"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Latitude (ละติจูด)</label>
              <input
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Longitude (ลองจิจูด)</label>
              <input
                type="number"
                step="any"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">ระดับความปลอดภัยพุง (Belly Status)</label>
            <select
              value={bellyStatus}
              onChange={(e) => setBellyStatus(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500 bg-white"
            >
              <option value="safe">🟢 Safe Zone (จกพุงได้สบาย ชอบให้เกา)</option>
              <option value="caution">🟡 Caution Zone (จกได้นิดหน่อย ระวังโดนยัน)</option>
              <option value="danger">🔴 Danger Zone (ห้ามจับพุงเด็ดขาด! โดนแน่นอน)</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">รายละเอียดเพิ่มเติม</label>
            <textarea
              rows={2}
              placeholder="เช่น ชอบกินขนมแมวเลีย, ขนสีส้มลายสลิด"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-orange-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl shadow transition-all text-sm"
          >
            บันทึกพิกัดแมว 🐾
          </button>
        </form>
      )}

      {/* กรอบแผนที่ */}
      <div className="max-w-4xl mx-auto w-full h-[500px] sm:h-[600px] bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border-2 sm:border-4 border-orange-100 relative">
        {isClient ? (
          <MapContainer
            center={[18.7883, 98.9853]}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap France'
              url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            />

            {catIcon &&
              cats.map((cat) => (
                <Marker key={cat.id} position={[cat.lat, cat.lng]} icon={catIcon}>
                  <Popup>
                    <div className="p-1 max-w-[220px]">
                      <h3 className="font-bold text-base sm:text-lg text-gray-800">{cat.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 mb-2">📍 {cat.location}</p>
                      <div className="text-xs font-semibold p-2 rounded-xl bg-orange-50 mb-2 border border-orange-200">
                        {cat.bellyText}
                      </div>
                      <p className="text-xs text-gray-600">{cat.details}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 font-medium">
            กำลังโหลดแผนที่... 🐾
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center mt-3 sm:mt-4 text-xs text-gray-400">
        <p>📱 รองรับการใช้งานบน Android, iPhone และ iPad</p>
      </footer>
    </main>
  );
}