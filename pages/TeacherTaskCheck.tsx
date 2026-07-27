import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Filter, ExternalLink, Image as ImageIcon, Link as LinkIcon, Trash2, Loader2, Calendar, FileText, ArrowLeft, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { TaskSubmission, GradeLevel } from '../types';
import Swal from 'sweetalert2';
import { verifySecurityToken } from '../utils/security';
import { firestore } from '../services/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const TeacherTaskCheck: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // --- STATE TABS & DATA ---
  const [activeTab, setActiveTab] = useState<'tasks' | 'exams'>('tasks');

  // Check URL query param / location state for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab') || location.state?.tab;
    if (tabParam === 'online' || tabParam === 'exams') {
      setActiveTab('exams');
    } else if (tabParam === 'tasks' || tabParam === 'upload') {
      setActiveTab('tasks');
    }
  }, [searchParams, location.state]);
  const [loading, setLoading] = useState(true);
  
  const [tasks, setTasks] = useState<TaskSubmission[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  
  // --- STATE FILTER ---
  const [filterGrade, setFilterGrade] = useState<GradeLevel | 'all'>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all'); // Sekarang untuk KEDUA Tab
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  // --- STATE NILAI (SUDAH / BELUM) ---
  const [gradedStatusMap, setGradedStatusMap] = useState<Record<string, 'sudah' | 'belum'>>(() => {
    try {
      const saved = localStorage.getItem('teacher_task_graded_status');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Sync real-time dari Firestore agar otomatis tersimpan dan sama di semua device (HP, Tablet, Laptop)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const docRef = doc(firestore, 'teacher_settings', 'task_graded_status');
      unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const remoteData = snapshot.data() as Record<string, 'sudah' | 'belum'>;
          if (remoteData) {
            setGradedStatusMap((prev) => {
              const merged = { ...prev, ...remoteData };
              try {
                localStorage.setItem('teacher_task_graded_status', JSON.stringify(merged));
              } catch (err) {
                console.error(err);
              }
              return merged;
            });
          }
        }
      }, (err) => {
        console.warn('Firestore task_graded_status onSnapshot warning:', err);
      });
    } catch (e) {
      console.warn('Gagal menginisialisasi listener Firestore task_graded_status:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleToggleGraded = async (id: string, status: 'sudah' | 'belum') => {
    // 1. Update state lokal & localStorage terlebih dahulu untuk respon UI instan
    setGradedStatusMap((prev) => {
      const updated = { ...prev, [id]: status };
      try {
        localStorage.setItem('teacher_task_graded_status', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 2. Simpan secara otomatis ke Firestore agar tersinkronisasi antar-perangkat (Laptop <-> Tablet <-> HP)
    try {
      const docRef = doc(firestore, 'teacher_settings', 'task_graded_status');
      await setDoc(docRef, { [id]: status }, { merge: true });
    } catch (e) {
      console.error('Gagal menyimpan status centang nilai ke Firestore:', e);
    }
  };

  // Load Data saat Tab atau Filter berubah
  useEffect(() => {
    loadClasses();
    if (activeTab === 'tasks') {
      loadTasks();
    } else {
      loadExamResults();
    }
  }, [activeTab, filterGrade, filterSemester]); // Trigger saat filter berubah

  const loadClasses = async () => {
    // Reset kelas ke 'all' saat jenjang berubah (kecuali initial load)
    if (filterClass !== 'all' && !filterClass.startsWith(filterGrade === 'all' ? '' : filterGrade)) {
         setFilterClass('all');
    }
    
    if (filterGrade === 'all') {
      setAvailableClasses([]);
    } else {
      const classes = await db.getAvailableKelas(filterGrade);
      setAvailableClasses(classes);
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    const data = await db.getTaskSubmissions(filterGrade === 'all' ? undefined : filterGrade);
    setTasks(data);
    setLoading(false);
  };

  const loadExamResults = async () => {
      setLoading(true);
      const gradeParam = filterGrade === 'all' ? undefined : filterGrade;
      const semParam = filterSemester === 'all' ? undefined : filterSemester;
      
      const data = await db.getExamResults(gradeParam, semParam);
      setExamResults(data);
      setLoading(false);
  };

  // --- HELPER FUNCTION: Hitung Durasi Pengerjaan Riil ---
  const calculateRealDuration = (start?: string, end?: string) => {
    if (!start || !end) return '-';
    
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    
    // Hitung selisih dalam menit
    const diffMs = endTime - startTime;
    const diffMins = Math.floor(diffMs / 60000); // 60000 ms = 1 menit
    
    // Jika kurang dari 1 menit, tampilkan detik (opsional) atau bulatkan ke 1 menit
    if (diffMins < 1) return '< 1 Menit';
    
    return `${diffMins} Menit`;
  };

  // --- ACTIONS: TASKS ---
  const viewContent = async (task: TaskSubmission) => {
    if (task.submission_type === 'link') {
      window.open(task.content1, '_blank');
    } else {
      const dateStr = new Date(task.created_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric'
      });

      const rawUrls = [task.content1, task.content2, task.content3, task.content4, task.content5].filter(Boolean) as string[];
      const urls = rawUrls.map(url => {
        if (url && !url.startsWith('data:') && !url.startsWith('http')) {
          return `data:image/jpeg;base64,${url}`;
        }
        return url;
      });

      const imagesHtml = urls.map((url, i) => `
        <div class="mb-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-100/70 p-3 shadow-sm">
          <div class="flex items-center justify-between mb-2 px-1 flex-wrap gap-2">
            <span class="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
              FOTO TUGAS KE-${i + 1} DARI ${urls.length}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
                💡 Sentuh / arahkan kursor ke foto untuk Auto-Zoom
              </span>
              <button 
                type="button" 
                class="open-full-img-btn px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                data-url="${url}"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                <span>Perbesar / Tab Baru</span>
              </button>
            </div>
          </div>
          <div class="img-zoom-box relative bg-slate-900/5 rounded-xl border border-slate-200 p-2 flex justify-center items-center overflow-hidden max-h-[70vh] cursor-zoom-in select-none">
            <img 
              src="${url}" 
              class="task-img-preview w-auto h-auto max-w-full max-h-[680px] object-contain rounded-lg shadow-md transition-transform duration-200 ease-out" 
              alt="Foto Tugas ${i + 1}"
              style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; transform-origin: center center;"
              data-url="${url}"
              title="Arahkan kursor / sentuh foto untuk zoom otomatis. Klik foto / tombol untuk buka di tab baru."
            />
          </div>
        </div>
      `).join('');

      // Cek apakah nilai sudah diinput
      let alreadyGraded = false;
      try {
        const students = await db.getStudentsByKelas(task.kelas);
        const targetStudent = students.find(s => s.namalengkap.toLowerCase().trim() === task.student_name.toLowerCase().trim());
        if (targetStudent) {
          const grades = db.getLocalTable<any>('Nilai');
          alreadyGraded = grades.some(g => 
            g.student_id === targetStudent.id &&
            g.kelas === task.kelas &&
            g.description?.toLowerCase().trim() === task.task_name?.toLowerCase().trim()
          );
        }
      } catch (e) {
        console.error("Gagal memeriksa status nilai:", e);
      }

      const openImageInNewTab = (imgUrl: string) => {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Foto Tugas - ${task.student_name} (${task.kelas})</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { margin: 0; background-color: #0f172a; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; box-sizing: border-box; font-family: sans-serif; }
                  .header { color: #f8fafc; margin-bottom: 15px; text-align: center; }
                  .header h2 { margin: 0 0 5px 0; font-size: 18px; }
                  .header p { margin: 0; color: #94a3b8; font-size: 13px; }
                  img { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border: 1px solid #334155; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>${task.task_name}</h2>
                  <p>Siswa: <strong>${task.student_name} (${task.kelas})</strong> | Tanggal: ${dateStr}</p>
                </div>
                <img src="${imgUrl}" alt="Foto Tugas Siswa" />
              </body>
            </html>
          `);
        }
      };

      const result = await Swal.fire({
        title: `Tugas: ${task.task_name}`,
        width: 'min(96%, 1000px)',
        html: `
          <div class="text-xs text-slate-600 font-medium mb-4 text-center bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-2xl">
            Siswa: <span class="font-bold text-slate-800 text-sm">${task.student_name}</span> (${task.kelas}) &nbsp;•&nbsp; Tanggal Kirim: <span class="font-bold text-slate-700">${dateStr}</span>
          </div>
          <div class="space-y-4 max-h-[72vh] overflow-y-auto scrollbar-thin px-1 text-slate-700">
            ${imagesHtml}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: alreadyGraded ? 'NILAI SUDAH DIINPUT' : 'INPUT NILAI',
        cancelButtonText: 'TUTUP',
        confirmButtonColor: alreadyGraded ? '#64748b' : '#059669', // Abu-abu jika sudah dinilai, hijau jika belum
        cancelButtonColor: '#dc2626',
        reverseButtons: true,
        customClass: { popup: 'rounded-3xl max-w-5xl shadow-2xl' },
        heightAuto: false,
        didOpen: () => {
          // Event listeners untuk tombol perbesar
          const btns = document.querySelectorAll('.open-full-img-btn');
          btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const url = (btn as HTMLElement).dataset.url;
              if (url) openImageInNewTab(url);
            });
          });

          // Setup auto-zoom saat kursor digeser atau foto disentuh
          const boxes = document.querySelectorAll('.img-zoom-box');
          boxes.forEach(box => {
            const img = box.querySelector('.task-img-preview') as HTMLImageElement | null;
            if (!img) return;

            let touchMoved = false;

            const updateZoom = (clientX: number, clientY: number, scale = 2.2) => {
              const rect = img.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return;
              const xPercent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
              const yPercent = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
              img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
              img.style.transform = `scale(${scale})`;
            };

            const resetZoom = () => {
              img.style.transform = 'scale(1)';
              img.style.transformOrigin = 'center center';
            };

            // Mouse events (Desktop)
            box.addEventListener('mouseenter', (e: Event) => {
              const me = e as MouseEvent;
              updateZoom(me.clientX, me.clientY);
            });

            box.addEventListener('mousemove', (e: Event) => {
              const me = e as MouseEvent;
              updateZoom(me.clientX, me.clientY);
            });

            box.addEventListener('mouseleave', () => {
              resetZoom();
            });

            // Touch events (Mobile/Tablet)
            box.addEventListener('touchstart', (e: Event) => {
              const te = e as TouchEvent;
              if (te.touches && te.touches[0]) {
                touchMoved = false;
                updateZoom(te.touches[0].clientX, te.touches[0].clientY, 2.0);
              }
            }, { passive: true });

            box.addEventListener('touchmove', (e: Event) => {
              const te = e as TouchEvent;
              if (te.touches && te.touches[0]) {
                touchMoved = true;
                updateZoom(te.touches[0].clientX, te.touches[0].clientY, 2.0);
              }
            }, { passive: true });

            box.addEventListener('touchend', () => {
              setTimeout(() => {
                resetZoom();
              }, 250);
            });

            box.addEventListener('touchcancel', () => {
              resetZoom();
            });

            // Klik foto untuk buka di tab baru (jika tidak sedang menggeser sentuhan)
            img.addEventListener('click', () => {
              if (touchMoved) return;
              const url = img.dataset.url;
              if (url) openImageInNewTab(url);
            });
          });
        }
      });

      if (result.isConfirmed) {
         if (alreadyGraded) {
           Swal.fire({
             icon: 'info',
             title: 'Sudah Dinilai',
             text: 'Tugas ini sudah memiliki nilai di database agar guru tidak menginput ganda.',
             confirmButtonColor: '#64748b',
             heightAuto: false
           });
           return;
         }

         navigate('/guru/nilai', {
             state: {
                 prefill: {
                     student_name: task.student_name,
                     kelas: task.kelas,
                     task_name: task.task_name,
                     date: task.created_at
                 }
             }
         });
      }
    }
  };

  // --- ACTIONS: DELETE TASK (NEW FEATURE) ---
  const handleDeleteTask = async (task: TaskSubmission) => {
      // 1. Konfirmasi Awal
      const confirm = await Swal.fire({
          title: 'Hapus Tugas?',
          text: `Anda akan menghapus tugas "${task.task_name}" milik ${task.student_name}.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Ya, Hapus',
          cancelButtonText: 'Batal',
          heightAuto: false
      });

      if (!confirm.isConfirmed) return;

      // 2. Layer Keamanan Ganda (Token)
      const token = await verifySecurityToken('Masukkan Token ID Server PAI');

      if (token === "PAI_ADMIN_GURU") {
          Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
          try {
              await db.deleteTaskSubmission(task.id);
              await loadTasks(); // Reload data
              Swal.close();
              setTimeout(() => {
                  Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false, heightAuto: false});
              }, 150);
          } catch (e) {
              Swal.close();
              setTimeout(() => {
                  Swal.fire({icon: 'error', title: 'Gagal', text: 'Gagal menghapus data.', heightAuto: false});
              }, 150);
          }
      } else if (token !== undefined) {
          Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
      }
  };

  // --- ACTIONS: EXAMS ---
  const handleDeleteResult = async (id: string, name: string) => {
      // 1. Konfirmasi Awal
      const confirm = await Swal.fire({
          title: 'Hapus Hasil Ujian?',
          text: `Menghapus data hasil ujian milik ${name}. Siswa dapat mengerjakan ulang setelah dihapus.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Ya, Hapus',
          cancelButtonText: 'Batal',
          heightAuto: false
      });

      if (!confirm.isConfirmed) return;

      // 2. Layer Keamanan Ganda (Token)
      const token = await verifySecurityToken('Masukkan Token ID Server PAI');

      if (token === "PAI_ADMIN_GURU") {
          Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
          try {
              await db.deleteExamResult(id);
              await loadExamResults();
              Swal.close();
              setTimeout(() => {
                  Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false, heightAuto: false});
              }, 150);
          } catch (e) {
              Swal.close();
              setTimeout(() => {
                  Swal.fire({icon: 'error', title: 'Gagal', text: 'Gagal menghapus hasil ujian.', heightAuto: false});
              }, 150);
          }
      } else if (token !== undefined) {
          Swal.fire({ icon: 'error', title: 'Token Salah', text: 'Penghapusan dibatalkan.', heightAuto: false });
      }
  };

  // Filter Lokal untuk Kelas & Semester (Tugas Upload)
  const getFilteredData = () => {
    let data: any[] = activeTab === 'tasks' ? tasks : examResults;

    // 1. Filter Kelas
    if (filterClass !== 'all') {
        if (activeTab === 'tasks') {
            data = data.filter((t: TaskSubmission) => t.kelas === filterClass);
        } else {
            data = data.filter((r: any) => r.student_class === filterClass);
        }
    }

    // 2. Filter Semester untuk TUGAS UPLOAD (Client Side Logic berdasarkan Tanggal)
    if (activeTab === 'tasks' && filterSemester !== 'all') {
        data = data.filter((t: TaskSubmission) => {
            const date = new Date(t.created_at);
            const month = date.getMonth() + 1; // 1-12
            
            if (filterSemester === '1') {
                return month >= 7 && month <= 12; // Juli - Desember
            } else {
                return month >= 1 && month <= 6;  // Januari - Juni
            }
        });
    }

    // 3. LOGIKA SORTING DINAMIS (SESUAI PERMINTAAN)
    
    if (filterClass === 'all') {
        // JIKA FILTER = SEMUA JENJANG / SEMUA KELAS
        // Urutkan berdasarkan WAKTU (Terakhir Kirim / Selesai) -> Terbaru di Atas
        data.sort((a, b) => {
            const dateA = activeTab === 'tasks' 
                ? new Date(a.created_at).getTime() 
                : new Date(a.submitted_at).getTime();
            
            const dateB = activeTab === 'tasks' 
                ? new Date(b.created_at).getTime() 
                : new Date(b.submitted_at).getTime();

            return dateB - dateA; // Descending (Newest first)
        });
    } else {
        // JIKA FILTER = KELAS TERTENTU (Spesifik)
        // Urutkan berdasarkan ABJAD NAMA (A-Z)
        data.sort((a, b) => {
            const nameA = (a.student_name || '').toLowerCase();
            const nameB = (b.student_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    return data;
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-3 md:space-y-6 animate-fadeIn pb-20">
      <button 
        onClick={() => navigate('/guru')} 
        className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-2"
        id="btn-back-to-dashboard-utama"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        <span>DASHBOARD UTAMA</span>
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight leading-tight">Monitoring Siswa</h1>
            <p className="text-slate-400 text-[10px] md:text-sm font-medium">Cek pengumpulan tugas harian dan hasil tugas online.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2">
          {/* TABS SWITCHER */}
          <div className="bg-slate-100 p-1 rounded-xl flex">
              <button 
                  onClick={() => setActiveTab('tasks')}
                  className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'tasks' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <FileText size={14} /> Tugas Upload
              </button>
              <button 
                  onClick={() => setActiveTab('exams')}
                  className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'exams' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <CheckCircle2 size={14} /> Tugas Online
              </button>
          </div>
        </div>
      </div>
      
      {/* FILTER AREA */}
      <div className="flex flex-col md:flex-row gap-2 overflow-x-auto pb-2 md:pb-0">
          {/* 1. Filter Jenjang */}
          <div className="flex gap-1.5 shrink-0">
            {(['all', '7', '8', '9'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setFilterGrade(g)}
                className={`px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all whitespace-nowrap border ${
                  filterGrade === g 
                  ? (activeTab === 'tasks' ? 'bg-purple-600 text-white border-purple-600' : 'bg-emerald-600 text-white border-emerald-600') 
                  : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {g === 'all' ? 'Semua Jenjang' : `Kelas ${g}`}
              </button>
            ))}
          </div>

          {/* 2. Filter Nama Kelas */}
          {filterGrade !== 'all' && (
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all shrink-0"
            >
              <option value="all">Semua Kelas {filterGrade}</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          )}

          {/* 3. Filter Semester (SEKARANG MUNCUL UNTUK KEDUA TAB) */}
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="px-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all shrink-0"
          >
            <option value="all">Semua Semester</option>
            <option value="1">Semester 1 (Ganjil)</option>
            <option value="2">Semester 2 (Genap)</option>
          </select>
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 overflow-hidden shadow-sm min-h-[300px]">
        {loading ? (
          <div className="p-10 md:p-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className={`animate-spin ${activeTab === 'tasks' ? 'text-purple-600' : 'text-emerald-600'}`} size={24} />
            <p className="text-slate-400 text-[9px] md:text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
          </div>
        ) : filteredData.length > 0 ? (
          /* REVISI SCROLLBAR & MAX-HEIGHT UNTUK KEDUA TABEL (KIRA-KIRA 10 BARIS = 550px) */
          <div className="max-h-[550px] overflow-y-auto scrollbar-thin relative">
            {activeTab === 'tasks' ? (
                /* ================= TABEL TUGAS UPLOAD ================= */
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">NO</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Judul</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipe</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">NILAI</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((task: TaskSubmission, index: number) => {
                      const isSudah = gradedStatusMap[task.id] === 'sudah';
                      return (
                        <tr 
                          key={task.id} 
                          className={`transition-colors border-b ${
                            isSudah 
                              ? 'bg-red-100/90 text-red-950 border-red-200 hover:bg-red-200/80' 
                              : 'hover:bg-slate-50/50 border-slate-50'
                          }`}
                        >
                          <td className={`px-4 py-3 text-center align-middle font-bold text-[10px] md:text-xs ${isSudah ? 'text-red-900' : 'text-slate-500'}`}>
                              {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className={`font-bold text-[11px] md:text-sm leading-tight ${isSudah ? 'text-red-950' : 'text-slate-800'}`}>{task.student_name}</span>
                              <span className={`text-[8px] md:text-[10px] uppercase font-black tracking-tighter ${isSudah ? 'text-red-700' : 'text-slate-400'}`}>Kelas {task.kelas}</span>
                              {/* Mobile Task Name */}
                              <span className={`md:hidden text-[9px] mt-1 truncate max-w-[120px] ${isSudah ? 'text-red-900 font-medium' : 'text-slate-500'}`}>{task.task_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-sm font-medium truncate max-w-[150px] inline-block ${isSudah ? 'text-red-950' : 'text-slate-600'}`}>{task.task_name}</span>
                          </td>
                          <td className="px-4 py-3">
                            {task.submission_type === 'link' ? (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[8px] md:text-[10px] font-black border border-blue-100">
                                <LinkIcon size={10} /> Link
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-purple-50 text-purple-600 text-[8px] md:text-[10px] font-black border border-purple-100">
                                <ImageIcon size={10} /> Foto
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                              <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] md:text-xs font-bold cursor-pointer transition-all select-none ${
                                isSudah
                                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={isSudah}
                                  onChange={() => handleToggleGraded(task.id, 'sudah')}
                                  className="w-3.5 h-3.5 accent-red-600 cursor-pointer rounded"
                                />
                                <span>Sudah</span>
                              </label>

                              <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] md:text-xs font-bold cursor-pointer transition-all select-none ${
                                !isSudah
                                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={!isSudah}
                                  onChange={() => handleToggleGraded(task.id, 'belum')}
                                  className="w-3.5 h-3.5 accent-slate-600 cursor-pointer rounded"
                                />
                                <span>Belum</span>
                              </label>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            {/* REVISI AKSI: TAMBAH TOMBOL HAPUS */}
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => viewContent(task)}
                                  className="bg-slate-900 text-white px-2.5 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-bold hover:bg-purple-600 transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                  {task.submission_type === 'link' ? <ExternalLink size={10} /> : <Search size={10} />}
                                  <span className="hidden md:inline">Lihat Konten</span>
                                  <span className="md:hidden">Cek</span>
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteTask(task)}
                                  className="bg-red-50 text-red-500 p-2 md:p-2.5 rounded-lg md:rounded-xl hover:bg-red-600 hover:text-white transition-all active:scale-95 border border-red-100"
                                  title="Hapus Tugas"
                                >
                                  <Trash2 size={14} className="md:w-3.5 md:h-3.5" />
                                </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            ) : (
                /* ================= TABEL HASIL UJIAN ================= */
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">NO</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Nama Tugas</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Skor</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">NILAI</th>
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((res: any, index: number) => {
                      const isSudah = gradedStatusMap[res.id] === 'sudah';
                      return (
                        <tr 
                          key={res.id} 
                          className={`transition-colors border-b ${
                            isSudah 
                              ? 'bg-red-100/90 text-red-950 border-red-200 hover:bg-red-200/80' 
                              : 'hover:bg-slate-50/50 border-slate-50'
                          }`}
                        >
                          <td className={`px-4 py-3 text-center align-middle font-bold text-[10px] md:text-xs ${isSudah ? 'text-red-900' : 'text-slate-500'}`}>
                              {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className={`font-bold text-[11px] md:text-sm leading-tight ${isSudah ? 'text-red-950' : 'text-slate-800'}`}>{res.student_name}</span>
                              <span className={`text-[8px] md:text-[10px] uppercase font-black tracking-tighter ${isSudah ? 'text-red-800' : 'text-slate-400'}`}>Kelas {res.student_class}</span>
                              
                              {/* REVISI: INFO TAMBAHAN KHUSUS MOBILE (DI BAWAH KELAS) */}
                              <div className="block md:hidden mt-1.5 pt-1.5 border-t border-slate-100">
                                 <span className={`text-[10px] font-bold block leading-tight ${isSudah ? 'text-red-900' : 'text-slate-700'}`}>{res.ujian?.title || '-'}</span>
                                 <span className={`text-[9px] font-bold uppercase ${isSudah ? 'text-red-800' : 'text-emerald-600'}`}>{res.ujian?.category} • Sem {res.semester}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-sm font-medium ${isSudah ? 'text-red-950' : 'text-slate-600'}`}>{res.ujian?.title || '-'}</span>
                            <span className={`block text-[10px] uppercase font-bold ${isSudah ? 'text-red-800' : 'text-slate-400'}`}>{res.ujian?.category} • Sem {res.semester}</span>
                          </td>
                          <td className="px-4 py-3 text-center align-top md:align-middle">
                             <span className={`inline-block w-8 py-1 rounded-lg font-black text-[10px] md:text-xs ${res.score >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                {res.score}
                             </span>
                          </td>
                          <td className="px-4 py-3 align-top md:align-middle">
                             <div className={`flex flex-col text-[10px] md:text-xs ${isSudah ? 'text-red-900' : 'text-slate-500'}`}>
                                <span className="font-bold">{new Date(res.submitted_at).toLocaleDateString('id-ID')}</span>
                                <span className="flex items-center gap-1 text-[9px]"><Clock size={10}/> {new Date(res.submitted_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB</span>
                                {/* REVISI: MENAMPILKAN LAMA PENGERJAAN RIIL */}
                                <span className={`text-[9px] font-bold mt-1 block ${isSudah ? 'text-red-800' : 'text-emerald-600'}`}>
                                    Pengerjaan: {calculateRealDuration(res.started_at, res.submitted_at)}
                                </span>
                                
                                {/* BARU: MENAMPILKAN INDIKATOR PELANGGARAN JIKA ADA */}
                                {res.violation_count > 0 && (
                                    <span className="text-[9px] text-red-600 font-bold mt-1 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 w-fit flex items-center gap-1">
                                       <ShieldAlert size={10} />
                                       Pelanggaran: {res.violation_count}x
                                    </span>
                                )}
                             </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                              <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] md:text-xs font-bold cursor-pointer transition-all select-none ${
                                isSudah
                                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={isSudah}
                                  onChange={() => handleToggleGraded(res.id, 'sudah')}
                                  className="w-3.5 h-3.5 accent-red-600 cursor-pointer rounded"
                                />
                                <span>Sudah</span>
                              </label>

                              <label className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] md:text-xs font-bold cursor-pointer transition-all select-none ${
                                !isSudah
                                  ? 'bg-slate-200 text-slate-800 border-slate-300'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={!isSudah}
                                  onChange={() => handleToggleGraded(res.id, 'belum')}
                                  className="w-3.5 h-3.5 accent-slate-600 cursor-pointer rounded"
                                />
                                <span>Belum</span>
                              </label>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-top md:align-middle">
                            <button
                              onClick={() => handleDeleteResult(res.id, res.student_name)}
                              className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-600 hover:text-white transition-all active:scale-95"
                              title="Hapus Hasil (Siswa bisa ujian ulang)"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            )}
          </div>
        ) : (
          <div className="p-10 md:p-20 text-center space-y-3">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              {activeTab === 'tasks' ? <FileText className="w-6 h-6 md:w-8 md:h-8" /> : <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />}
            </div>
            <div>
              <p className="text-slate-800 font-bold text-xs md:text-sm">Belum ada data</p>
              <p className="text-slate-400 text-[10px] md:text-xs">
                {filterClass !== 'all' ? `Tidak ada data dari kelas ${filterClass}.` : (activeTab === 'tasks' ? 'Tugas yang dikumpulkan siswa akan muncul di sini.' : 'Hasil ujian siswa akan muncul di sini.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherTaskCheck;