
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Quote, Bell, Check, ChevronDown, ChevronUp, BookOpen, PencilLine } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Material } from '../types';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [readMaterials, setReadMaterials] = useState<string[]>([]);
  const [readExams, setReadExams] = useState<string[]>([]);
  const [showNotificationDetails, setShowNotificationDetails] = useState(false);

  const loadNotificationsData = async () => {
    try {
      const matList = await db.getMaterials();
      setMaterials(matList);

      const activeExams = await db.getAllActiveExams();
      setExams(activeExams);

      const readMats = JSON.parse(localStorage.getItem('pai_read_materials') || '[]');
      const readExs = JSON.parse(localStorage.getItem('pai_read_exams') || '[]');
      setReadMaterials(readMats);
      setReadExams(readExs);
    } catch (e) {
      console.error('Gagal memuat data notifikasi:', e);
    }
  };

  useEffect(() => {
    loadNotificationsData();

    // Listen to custom notification updates from other pages
    const handleUpdate = () => {
      loadNotificationsData();
    };
    window.addEventListener('pai_notifications_updated', handleUpdate);
    return () => {
      window.removeEventListener('pai_notifications_updated', handleUpdate);
    };
  }, []);

  const hasMaterials = (gradeVal: string) => {
    return materials.some(m => String(m.grade) === String(gradeVal));
  };

  const handleMarkAllAsRead = () => {
    try {
      const allMaterialIds = materials.map(m => m.id);
      const allExamIds = exams.map(e => e.id);
      
      localStorage.setItem('pai_read_materials', JSON.stringify(allMaterialIds));
      localStorage.setItem('pai_read_exams', JSON.stringify(allExamIds));
      
      setReadMaterials(allMaterialIds);
      setReadExams(allExamIds);
      
      window.dispatchEvent(new Event('pai_notifications_updated'));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadMats = materials.filter(m => !readMaterials.includes(m.id));
  const unreadExams = exams.filter(e => !readExams.includes(e.id));
  const unreadCount = unreadMats.length + unreadExams.length;

  const features = [
    { title: 'Kelas 7', desc: hasMaterials('7') ? '' : 'Materi dalam tahap pengembangan konten', color: 'bg-blue-500' },
    { title: 'Kelas 8', desc: hasMaterials('8') ? '' : 'Materi dalam tahap pengembangan konten', color: 'bg-emerald-500' },
    { title: 'Kelas 9', desc: hasMaterials('9') ? '' : 'Materi dalam tahap pengembangan konten', color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-4 md:space-y-6 animate-fadeIn pb-4 md:pb-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-[1.5rem] bg-emerald-700 text-white p-4 sm:p-6 md:p-8 shadow-lg shadow-emerald-200/50">
        <div className="relative z-10 md:w-3/4 space-y-2 sm:space-y-3">
          <h1 className="text-base sm:text-lg md:text-xl font-extrabold leading-tight tracking-tight">
            Cerdas Berilmu, Mulia Berakhlak
          </h1>
          <p className="text-emerald-50 text-xs sm:text-sm max-w-lg leading-relaxed opacity-90">
            Portal pembelajaran terpadu Pendidikan Agama Islam
          </p>
          <div className="pt-1.5 flex flex-wrap gap-2.5">
            <button 
              onClick={() => navigate('/materi')}
              className="bg-white text-emerald-700 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10.5px] sm:text-xs font-bold hover:bg-emerald-50 transition-all shadow-sm active:scale-95 relative overflow-visible"
            >
              Lihat Materi
              {unreadMats.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </button>
            <button 
              onClick={() => navigate('/nilai')}
              className="bg-emerald-600 text-white border border-emerald-500/50 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10.5px] sm:text-xs font-bold hover:bg-emerald-800 transition-all shadow-sm active:scale-95"
            >
              Cek Nilai Saya
            </button>
          </div>
        </div>
        
        <div className="absolute right-[-10%] top-[-10%] h-[120%] w-1/2 opacity-5 hidden lg:block pointer-events-none">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            <path fill="#FFFFFF" d="M44.7,-76.4C58.3,-69.2,70.1,-58.5,78.2,-45.5C86.4,-32.5,90.9,-17.3,90.1,-2.3C89.4,12.7,83.4,27.5,74.5,40.3C65.5,53.2,53.6,64.1,39.9,71.7C26.1,79.2,10.6,83.4,-4.1,80.5C-18.9,77.5,-32.8,67.5,-45.6,56.8C-58.4,46.1,-70.1,34.8,-76.1,21C-82.1,7.2,-82.3,-9.1,-77.8,-24.1C-73.3,-39.2,-64.1,-52.9,-51.6,-61.6C-39.2,-70.4,-23.5,-74.1,-8.1,-80.1C7.3,-86.1,23,-83.6,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
      </section>

      {/* Pusat Notifikasi Sederhana */}
      {unreadCount > 0 && (
        <section className="bg-amber-50/70 p-3 sm:p-4 rounded-2xl md:rounded-3xl border border-amber-200/50 flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="bg-amber-500 p-2 rounded-xl text-white mt-0.5 shrink-0 animate-pulse">
                <Bell size={16} />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-amber-900 uppercase tracking-wider">Pemberitahuan Baru</h2>
                <p className="text-[10px] sm:text-xs text-amber-700 font-medium mt-0.5 leading-relaxed">
                  Ada {unreadMats.length > 0 ? `${unreadMats.length} materi` : ''} 
                  {unreadMats.length > 0 && unreadExams.length > 0 ? ' dan ' : ''}
                  {unreadExams.length > 0 ? `${unreadExams.length} tugas/soal` : ''} baru yang belum kamu buka.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <button 
                onClick={() => setShowNotificationDetails(!showNotificationDetails)}
                className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-[9.5px] font-black hover:bg-slate-50 transition-all uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-xs"
              >
                {showNotificationDetails ? (
                  <>Sembunyikan <ChevronUp size={11} /></>
                ) : (
                  <>Lihat Detail <ChevronDown size={11} /></>
                )}
              </button>
              <button 
                onClick={handleMarkAllAsRead}
                className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-[9.5px] font-black hover:bg-emerald-700 transition-all uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-xs"
              >
                <Check size={11} strokeWidth={3} /> Tandai Dibaca
              </button>
            </div>
          </div>

          {showNotificationDetails && (
            <div className="mt-1 border-t border-amber-200/40 pt-2 space-y-1.5 animate-fadeIn max-h-[200px] overflow-y-auto">
              {unreadMats.map(m => (
                <div 
                  key={m.id} 
                  onClick={() => navigate('/materi')} 
                  className="flex items-center justify-between p-2 rounded-xl bg-white/75 hover:bg-white border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer text-[9.5px] font-bold text-slate-700 shadow-xs"
                >
                  <span className="flex items-center gap-1.5 truncate mr-2">
                    <BookOpen size={11} className="text-emerald-600 shrink-0" />
                    <span className="truncate">Materi: {m.title} (Kelas {m.grade})</span>
                  </span>
                  <span className="text-[7.5px] uppercase tracking-wider bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded-md shrink-0">Buka Materi</span>
                </div>
              ))}
              {unreadExams.map(e => (
                <div 
                  key={e.id} 
                  onClick={() => navigate('/kerjakan-tugas')} 
                  className="flex items-center justify-between p-2 rounded-xl bg-white/75 hover:bg-white border border-slate-100 hover:border-blue-200 transition-all cursor-pointer text-[9.5px] font-bold text-slate-700 shadow-xs"
                >
                  <span className="flex items-center gap-1.5 truncate mr-2">
                    <PencilLine size={11} className="text-blue-600 shrink-0" />
                    <span className="truncate">Ujian/Tugas: {e.title} (Kelas {e.grade})</span>
                  </span>
                  <span className="text-[7.5px] uppercase tracking-wider bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-md shrink-0">Mulai Kerjakan</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Stats/Grades - Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        {features.map((item, idx) => {
          const gradeVal = item.title.replace(/\D/g, '');
          
          const unreadMatsForGrade = materials.filter(m => String(m.grade) === String(gradeVal) && !readMaterials.includes(m.id));
          const unreadExamsForGrade = exams.filter(e => String(e.grade) === String(gradeVal) && !readExams.includes(e.id));
          const totalUnreadForGrade = unreadMatsForGrade.length + unreadExamsForGrade.length;

          return (
            <div 
              key={idx} 
              onClick={() => navigate('/materi', { state: { grade: gradeVal } })}
              className="bg-white p-3.5 sm:p-4 md:p-5 rounded-xl md:rounded-2xl shadow-xs border border-slate-100 hover:shadow-md transition-all duration-300 group cursor-pointer relative"
            >
              {totalUnreadForGrade > 0 && (
                <span className="absolute top-3 right-3 bg-red-500 text-white font-black text-[8px] h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {totalUnreadForGrade} BARU
                </span>
              )}

              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 ${item.color} rounded-lg md:rounded-xl mb-2 sm:mb-3 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform`}>
                <Users size={18} className="sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 mb-0.5">{item.title}</h3>
              {item.desc && <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed">{item.desc}</p>}
              <div className="mt-3 flex items-center gap-1.5 text-slate-300 font-bold text-[9.5px] uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                Lihat Materi <Calendar size={11} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Hadith Section - Positioned above footer */}
      <section className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl md:rounded-[1.8rem] border border-emerald-100 shadow-xs relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-3 opacity-[0.05] text-emerald-900 pointer-events-none group-hover:scale-110 transition-transform duration-500">
          <Quote size={60} className="md:w-20 md:h-20" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-1">
          <span className="text-emerald-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.1em] mb-0.5">
            Rasulullah SAW Bersabda:
          </span>
          <p className="text-slate-700 text-[10px] sm:text-xs md:text-sm font-medium leading-relaxed italic max-w-2xl">
            “Siapa yang menempuh jalan untuk mencari ilmu, maka Allah akan mudahkan baginya jalan menuju surga.”
          </p>
          <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] tracking-widest pt-0.5">
            (HR Muslim)
          </span>
        </div>
      </section>
    </div>
  );
};

export default Home;
