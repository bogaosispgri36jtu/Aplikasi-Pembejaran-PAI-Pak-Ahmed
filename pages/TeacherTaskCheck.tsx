import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Filter, ExternalLink, Image as ImageIcon, Link as LinkIcon, Trash2, Loader2, Calendar, FileText, ArrowLeft, CheckCircle2, Clock, ShieldAlert, Download } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { TaskSubmission, GradeLevel } from '../types';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTeacherSignatureDataUrl, formatGoogleDriveImageUrl } from '../utils/signatureData';
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
  const [searchQuery, setSearchQuery] = useState('');
  
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  // --- STATE KARTU "DATA LAPORAN TUGAS ONLINE" ---
  const [allStudentsList, setAllStudentsList] = useState<any[]>([]);
  const [reportClassFilter, setReportClassFilter] = useState<string>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'sudah' | 'belum'>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Sinkronisasi data siswa lokal untuk laporan tugas online
  useEffect(() => {
    const students = db.getLocalTable<any>('data_siswa') || [];
    setAllStudentsList(students);
  }, [activeTab]);

  // Sinkronisasi filter kelas jika filter utama berubah
  useEffect(() => {
    if (filterClass !== 'all') {
      setReportClassFilter(filterClass);
    }
  }, [filterClass]);

  // Daftar kelas unik untuk filter laporan tugas online
  const availableReportClasses = React.useMemo(() => {
    const classes = Array.from(new Set(allStudentsList.map((s: any) => s.kelas).filter(Boolean)));
    return classes.sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
  }, [allStudentsList]);

  // --- STATE SELECTION UNTUK BATCH DELETE ---
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

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
  const handleToggleSelectAll = (filteredTasks: TaskSubmission[]) => {
    if (selectedTasks.length === filteredTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredTasks.map(t => t.id));
    }
  };

  const handleToggleSelectTask = (id: string) => {
    if (selectedTasks.includes(id)) {
      setSelectedTasks(prev => prev.filter(tId => tId !== id));
    } else {
      setSelectedTasks(prev => [...prev, id]);
    }
  };

  const handleDeleteSelectedTasks = async () => {
      if (selectedTasks.length === 0) return;
      const confirm = await Swal.fire({
          title: 'Hapus Tugas Terpilih?',
          text: `Anda akan menghapus ${selectedTasks.length} tugas yang dipilih.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'Ya, Hapus Semua',
          cancelButtonText: 'Batal',
          heightAuto: false
      });

      if (!confirm.isConfirmed) return;

      const token = await verifySecurityToken('Masukkan Token ID Server PAI');

      if (token === "PAI_ADMIN_GURU") {
          Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading(), heightAuto: false });
          try {
              await db.deleteMultipleTaskSubmissions(selectedTasks);
              setSelectedTasks([]);
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
      } else if (token !== null) {
          Swal.fire({icon: 'error', title: 'Akses Ditolak', text: 'Token salah.', heightAuto: false});
      }
  };

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

    // 3. Filter Pencarian Nama Siswa
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        data = data.filter((item: any) => {
            const name = (item.student_name || '').toLowerCase();
            return name.includes(query);
        });
    }

    // 4. LOGIKA SORTING DINAMIS (SESUAI PERMINTAAN)
    
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

  // Export Laporan Excel untuk mengecek siswa yang belum mengerjakan tugas-tugas online (Sheet per kelas)
  const handleExportBelumTugasOnlineExcel = async () => {
    const allStudents = db.getLocalTable<any>('data_siswa');
    if (!allStudents || allStudents.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Data Siswa Kosong',
        text: 'Tidak ada data siswa yang ditemukan.',
        confirmButtonColor: '#059669',
        heightAuto: false
      });
      return;
    }

    const allExams = await db.getExams();
    if (!allExams || allExams.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Tugas Online Kosong',
        text: 'Belum ada tugas online / bank soal yang dibuat pada sistem.',
        confirmButtonColor: '#059669',
        heightAuto: false
      });
      return;
    }

    const allResults = db.getLocalTable<any>('hasil_ujian');

    // Filter daftar kelas target
    let targetClasses: string[] = [];
    if (filterClass !== 'all') {
      targetClasses = [filterClass];
    } else if (filterGrade !== 'all') {
      if (availableClasses.length > 0) {
        targetClasses = availableClasses;
      } else {
        const matching = Array.from(new Set(
          allStudents
            .filter((s: any) => String(s.kelas || '').startsWith(filterGrade))
            .map((s: any) => s.kelas)
            .filter(Boolean)
        )) as string[];
        targetClasses = matching;
      }
    } else {
      const uniqueClasses = Array.from(new Set(allStudents.map((s: any) => s.kelas).filter(Boolean)));
      uniqueClasses.sort((a: any, b: any) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
      targetClasses = uniqueClasses as string[];
    }

    if (targetClasses.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Kelas Tidak Ditemukan',
        text: 'Tidak ada kelas yang sesuai dengan filter yang dipilih.',
        confirmButtonColor: '#059669',
        heightAuto: false
      });
      return;
    }

    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const getSafeSheetName = (rawName: string) => {
      let clean = rawName.replace(/[\\/?*[\]:]/g, '_').trim();
      if (clean.length > 28) clean = clean.substring(0, 28);
      let finalName = clean;
      let counter = 1;
      while (usedSheetNames.has(finalName.toLowerCase())) {
        finalName = `${clean}_${counter}`;
        counter++;
      }
      usedSheetNames.add(finalName.toLowerCase());
      return finalName;
    };

    const rekapGlobalRows: any[] = [];
    const daftarSemuaSiswaBelumOnline: any[] = [];

    for (const cls of targetClasses) {
      const classStudents = allStudents.filter((s: any) => String(s.kelas || '').toUpperCase() === String(cls).toUpperCase());
      if (classStudents.length === 0) continue;
      classStudents.sort((a: any, b: any) => (a.namalengkap || '').localeCompare(b.namalengkap || ''));

      // Deteksi jenjang kelas (7, 8, atau 9)
      const gradeDigit = String(cls).includes('7') ? '7' : String(cls).includes('8') ? '8' : String(cls).includes('9') ? '9' : '7';

      // Cari tugas online / ujian yang ditujukan untuk jenjang ini
      let classExams = allExams.filter((ex: any) => String(ex.grade) === gradeDigit);
      if (filterSemester !== 'all') {
        classExams = classExams.filter((ex: any) => String(ex.semester) === String(filterSemester));
      }

      classExams.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));

      const totalOnlineTasksCount = classExams.length;

      let siswaTuntasCount = 0;
      let siswaBelumCount = 0;

      const classSheetRows: any[] = [];

      classStudents.forEach((student: any, idx: number) => {
        const sNis = String(student.nis || '').trim();
        const sName = (student.namalengkap || '').toLowerCase().trim();

        // Cari hasil ujian siswa ini
        const studentResults = allResults.filter((r: any) => {
          const rNis = String(r.student_nis || '').trim();
          const rName = String(r.student_name || '').toLowerCase().trim();
          return (sNis && rNis === sNis) || (rName && rName === sName);
        });

        let completedCount = 0;
        const uncompletedOnlineTasks: string[] = [];
        const taskScoresMap: Record<string, string | number> = {};

        classExams.forEach(ex => {
          const catLabel = ex.category ? ex.category.toUpperCase() : 'ONLINE';
          const colHeader = `[${catLabel}] ${ex.title}`;
          const matchedResult = studentResults.find((r: any) => String(r.exam_id) === String(ex.id));

          if (matchedResult && matchedResult.score !== undefined && matchedResult.score !== null) {
            taskScoresMap[colHeader] = Number(matchedResult.score);
            completedCount++;
          } else {
            taskScoresMap[colHeader] = 'BELUM';
            uncompletedOnlineTasks.push(colHeader);
          }
        });

        const pendingCount = totalOnlineTasksCount > 0 ? (totalOnlineTasksCount - completedCount) : 0;
        const isTuntas = totalOnlineTasksCount > 0 ? (pendingCount === 0) : true;

        if (isTuntas) {
          siswaTuntasCount++;
        } else {
          siswaBelumCount++;
          daftarSemuaSiswaBelumOnline.push({
            'NO': daftarSemuaSiswaBelumOnline.length + 1,
            'KELAS': cls,
            'NIS': student.nis || '-',
            'NAMA SISWA': student.namalengkap,
            'TOTAL TUGAS ONLINE': totalOnlineTasksCount,
            'SUDAH DIKERJAKAN': completedCount,
            'BELUM DIKERJAKAN': pendingCount,
            'RINCIAN TUGAS ONLINE BELUM DIKERJAKAN': uncompletedOnlineTasks.join(', ') || '-',
            'STATUS': 'BELUM TUNTAS'
          });
        }

        const rowObj: any = {
          'NO': idx + 1,
          'NIS': student.nis || '-',
          'NAMA SISWA': student.namalengkap,
          'KELAS': cls,
          'STATUS PENGERJAAN': isTuntas ? 'TUNTAS SEMUA' : 'BELUM TUNTAS',
          'TOTAL TUGAS ONLINE': totalOnlineTasksCount,
          'SUDAH DIKERJAKAN': completedCount,
          'BELUM DIKERJAKAN': pendingCount,
          'RINCIAN TUGAS ONLINE BELUM DIKERJAKAN': uncompletedOnlineTasks.join(', ') || '-'
        };

        classExams.forEach(ex => {
          const catLabel = ex.category ? ex.category.toUpperCase() : 'ONLINE';
          const colHeader = `[${catLabel}] ${ex.title}`;
          rowObj[colHeader] = taskScoresMap[colHeader];
        });

        classSheetRows.push(rowObj);
      });

      rekapGlobalRows.push({
        'NO': rekapGlobalRows.length + 1,
        'KELAS': cls,
        'TOTAL SISWA': classStudents.length,
        'SISWA TUNTAS': siswaTuntasCount,
        'SISWA BELUM MENGERJAKAN': siswaBelumCount,
        'TOTAL TUGAS ONLINE': totalOnlineTasksCount,
        'PERSENTASE KETUNTASAN': classStudents.length > 0 ? `${Math.round((siswaTuntasCount / classStudents.length) * 100)}%` : '0%'
      });

      // Tambahkan baris rekapitulasi di bagian bawah sheet kelas
      classSheetRows.push({});
      classSheetRows.push({
        'NO': '',
        'NIS': 'RINGKASAN',
        'NAMA SISWA': `TOTAL SISWA: ${classStudents.length} | SISWA TUNTAS: ${siswaTuntasCount} | SISWA BELUM SELESAI: ${siswaBelumCount}`,
        'KELAS': cls,
        'STATUS PENGERJAAN': `KETUNTASAN: ${classStudents.length > 0 ? Math.round((siswaTuntasCount / classStudents.length) * 100) : 0}%`,
        'TOTAL TUGAS ONLINE': totalOnlineTasksCount,
        'SUDAH DIKERJAKAN': siswaTuntasCount,
        'BELUM DIKERJAKAN': siswaBelumCount
      });

      const wsClass = XLSX.utils.json_to_sheet(classSheetRows);

      const colWidths: any[] = [
        { wch: 6 },  // NO
        { wch: 14 }, // NIS
        { wch: 28 }, // NAMA SISWA
        { wch: 10 }, // KELAS
        { wch: 18 }, // STATUS
        { wch: 20 }, // TOTAL TUGAS ONLINE
        { wch: 18 }, // SUDAH
        { wch: 18 }, // BELUM
        { wch: 45 }  // RINCIAN BELUM
      ];
      classExams.forEach(() => {
        colWidths.push({ wch: 24 });
      });
      wsClass['!cols'] = colWidths;

      const safeSheetName = getSafeSheetName(`Kelas ${cls}`);
      XLSX.utils.book_append_sheet(workbook, wsClass, safeSheetName);
    }

    if (daftarSemuaSiswaBelumOnline.length > 0) {
      const wsSummary = XLSX.utils.json_to_sheet(daftarSemuaSiswaBelumOnline);
      wsSummary['!cols'] = [
        { wch: 6 },  // NO
        { wch: 10 }, // KELAS
        { wch: 14 }, // NIS
        { wch: 28 }, // NAMA SISWA
        { wch: 20 }, // TOTAL TUGAS ONLINE
        { wch: 18 }, // SUDAH
        { wch: 18 }, // BELUM
        { wch: 50 }, // RINCIAN BELUM
        { wch: 16 }  // STATUS
      ];
      workbook.SheetNames.unshift('REKAP_BELUM_TUGAS_ONLINE');
      workbook.Sheets['REKAP_BELUM_TUGAS_ONLINE'] = wsSummary;
    } else {
      const wsSummary = XLSX.utils.json_to_sheet(rekapGlobalRows);
      wsSummary['!cols'] = [
        { wch: 6 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 24 },
        { wch: 20 },
        { wch: 22 }
      ];
      workbook.SheetNames.unshift('RINGKASAN_KELAS');
      workbook.Sheets['RINGKASAN_KELAS'] = wsSummary;
    }

    const clsLabel = filterClass !== 'all' ? `Kelas_${filterClass}` : filterGrade !== 'all' ? `Jenjang_${filterGrade}` : 'Semua_Kelas';
    const semLabel = filterSemester !== 'all' ? `Sem_${filterSemester}` : 'Semua_Sem';
    const filename = `Laporan_Siswa_Belum_Tugas_Online_${clsLabel}_${semLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, filename);

    Swal.fire({
      icon: 'success',
      title: 'Laporan Excel Berhasil Diunduh!',
      html: `
        <div class="text-left text-xs space-y-2">
          <p>Laporan monitoring tugas online siswa berhasil diunduh dalam file Excel.</p>
          <div class="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-emerald-900 font-semibold space-y-1">
            <p>✓ Dilengkapi sheet terpisah per kelas (misal: Kelas 7A, 7B, dst).</p>
            <p>✓ Dilengkapi sheet <b>REKAP_BELUM_TUGAS_ONLINE</b> untuk mengecek cepat seluruh siswa yang belum mengerjakan tugas online.</p>
            <p>✓ Kolom tugas online mencantumkan skor ujian yang didapat atau <b>BELUM</b>.</p>
          </div>
          <p class="text-slate-400 text-[10px]">File: ${filename}</p>
        </div>
      `,
      confirmButtonColor: '#059669',
      heightAuto: false
    });
  };

  // --- LOGIKA DATA UNTUK KARTU "DATA LAPORAN TUGAS ONLINE" ---
  // Pencocokan otomatis siswa data_siswa dengan sheet hasil_ujian berdasarkan Nama dan NIS
  const { onlineReportData, onlineReportStats } = React.useMemo(() => {
    if (!allStudentsList || allStudentsList.length === 0) {
      return { onlineReportData: [], onlineReportStats: { total: 0, sudah: 0, belum: 0, percentage: 0 } };
    }
    const allResults = db.getLocalTable<any>('hasil_ujian') || [];

    // Filter per kelas yang dipilih
    let classFilteredStudents = allStudentsList;
    if (reportClassFilter !== 'all') {
      classFilteredStudents = classFilteredStudents.filter(
        (s: any) => String(s.kelas || '').trim().toLowerCase() === reportClassFilter.trim().toLowerCase()
      );
    }

    // Urutkan alfabetis Nama Siswa (A-Z)
    classFilteredStudents = [...classFilteredStudents].sort((a: any, b: any) =>
      (a.namalengkap || '').localeCompare(b.namalengkap || '')
    );

    let totalSudahInClass = 0;

    const mapped = classFilteredStudents.map((student: any) => {
      const sNis = String(student.nis || '').trim().toLowerCase();
      const sName = String(student.namalengkap || '').trim().toLowerCase();
      const sClass = String(student.kelas || '').trim().toLowerCase();

      // Logika pencocokan pada sheet hasil_ujian berdasarkan Nama dan NIS
      const matchedResults = allResults.filter((r: any) => {
        const rNis = String(r.student_nis || '').trim().toLowerCase();
        const rName = String(r.student_name || '').trim().toLowerCase();
        const rClass = String(r.student_class || '').trim().toLowerCase();

        const nisMatch = Boolean(sNis && rNis && sNis === rNis);
        const nameMatch = Boolean(sName && rName && (sName === rName || rName.includes(sName) || sName.includes(rName)));

        if (nisMatch) return true;
        if (nameMatch) {
          if (!rClass || !sClass || rClass === sClass) return true;
        }
        return false;
      });

      const isSudah = matchedResults.length > 0;
      if (isSudah) totalSudahInClass++;

      const completedTasksTitles = matchedResults.map((r: any) => r.ujian?.title || r.title || 'Tugas Online').filter(Boolean);

      return {
        id: student.id || student.nis,
        nis: student.nis || '-',
        nama_siswa: student.namalengkap || '-',
        kelas: student.kelas || '-',
        isSudah,
        completedCount: matchedResults.length,
        completedTasksTitles
      };
    });

    const totalStudentsInClass = classFilteredStudents.length;
    const totalBelumInClass = totalStudentsInClass - totalSudahInClass;
    const percentage = totalStudentsInClass > 0 ? Math.round((totalSudahInClass / totalStudentsInClass) * 100) : 0;

    // Filter tambahan untuk tampilan tabel (Status & Cari Siswa)
    const filteredRows = mapped.filter((item: any) => {
      if (reportStatusFilter === 'sudah' && !item.isSudah) return false;
      if (reportStatusFilter === 'belum' && item.isSudah) return false;
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.trim().toLowerCase();
        const matchName = item.nama_siswa.toLowerCase().includes(q);
        const matchNis = item.nis.toLowerCase().includes(q);
        const matchClass = item.kelas.toLowerCase().includes(q);
        if (!matchName && !matchNis && !matchClass) return false;
      }
      return true;
    });

    return {
      onlineReportData: filteredRows,
      onlineReportStats: {
        total: totalStudentsInClass,
        sudah: totalSudahInClass,
        belum: totalBelumInClass,
        percentage
      }
    };
  }, [allStudentsList, reportClassFilter, reportStatusFilter, reportSearchQuery, examResults]);

  // Atur / ubah link gambar TTD (Mendukung link Google Drive atau Upload file gambar langsung)
  const handleConfigureSignatureLink = async () => {
    const currentUrl = localStorage.getItem('teacher_signature_url') || '';
    const isDataUrl = currentUrl.startsWith('data:image/');
    
    await Swal.fire({
      title: 'Pengaturan Gambar TTD Guru',
      html: `
        <div class="text-left space-y-3.5 text-xs text-slate-700">
          <p class="text-slate-600 leading-relaxed">
            Tempel link gambar tanda tangan dari <b>Google Drive</b> atau upload file gambar langsung (PNG / JPG).
          </p>

          <div class="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
            <label class="block font-bold text-emerald-900 mb-1">
              Pilihan 1: Upload File Gambar TTD (Direkomendasikan)
            </label>
            <input 
              id="swal-sig-file" 
              type="file" 
              accept="image/png, image/jpeg, image/jpg, image/webp" 
              class="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
            />
          </div>

          <div class="relative flex py-0.5 items-center">
            <div class="flex-grow border-t border-slate-200"></div>
            <span class="flex-shrink mx-2 text-slate-400 text-[10px] font-black uppercase">ATAU</span>
            <div class="flex-grow border-t border-slate-200"></div>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label class="block font-bold text-slate-800 mb-1">
              Pilihan 2: Tempel Link Gambar Google Drive
            </label>
            <input 
              id="swal-sig-url" 
              type="text" 
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 font-mono text-slate-800 bg-white" 
              placeholder="https://drive.google.com/file/d/.../view" 
              value="${isDataUrl ? '' : currentUrl}" 
            />
            <p class="text-[10px] text-slate-500 mt-1">
              *Jika menggunakan link Google Drive, pastikan izin file diset ke <b>"Siapa saja yang memiliki link (Anyone with the link)"</b>. Sistem akan otomatis mengonversi ke link gambar langsung.
            </p>
          </div>

          <div id="swal-sig-preview-box" class="p-2.5 bg-slate-100/70 rounded-xl border border-slate-200 text-center ${currentUrl ? '' : 'hidden'}">
            <span class="text-[10px] font-bold text-slate-500 block mb-1">Preview Tanda Tangan:</span>
            <img id="swal-sig-preview-img" src="${currentUrl}" class="max-h-16 mx-auto object-contain bg-white p-1 rounded-lg border border-slate-200 shadow-2xs" alt="Preview TTD" />
          </div>
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Simpan TTD',
      denyButtonText: 'Gunakan TTD Bawaan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#059669',
      denyButtonColor: '#64748b',
      heightAuto: false,
      didOpen: () => {
        const fileInput = document.getElementById('swal-sig-file') as HTMLInputElement;
        const urlInput = document.getElementById('swal-sig-url') as HTMLInputElement;
        const previewBox = document.getElementById('swal-sig-preview-box');
        const previewImg = document.getElementById('swal-sig-preview-img') as HTMLImageElement;

        if (fileInput) {
          fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const res = e.target?.result as string;
                if (previewImg && previewBox) {
                  previewImg.src = res;
                  previewBox.classList.remove('hidden');
                }
              };
              reader.readAsDataURL(file);
            }
          });
        }

        if (urlInput) {
          urlInput.addEventListener('input', () => {
            const val = urlInput.value.trim();
            if (val) {
              const direct = formatGoogleDriveImageUrl(val);
              if (previewImg && previewBox) {
                previewImg.src = direct;
                previewBox.classList.remove('hidden');
              }
            }
          });
        }
      },
      preConfirm: async () => {
        const fileInput = document.getElementById('swal-sig-file') as HTMLInputElement;
        const urlInput = document.getElementById('swal-sig-url') as HTMLInputElement;

        if (fileInput?.files && fileInput.files[0]) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({ value: e.target?.result as string });
            };
            reader.readAsDataURL(fileInput.files[0]);
          });
        }

        const urlVal = urlInput?.value?.trim();
        if (urlVal) {
          const direct = formatGoogleDriveImageUrl(urlVal);
          return { value: direct };
        }

        return null;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value && (result.value as any).value) {
          localStorage.setItem('teacher_signature_url', (result.value as any).value);
          Swal.fire({
            icon: 'success',
            title: 'Gambar TTD Tersimpan!',
            text: 'Tanda tangan Anda kini aktif dan akan otomatis muncul pada laporan PDF.',
            timer: 2000,
            showConfirmButton: false,
            heightAuto: false
          });
        }
      } else if (result.isDenied) {
        localStorage.removeItem('teacher_signature_url');
        Swal.fire({
          icon: 'info',
          title: 'TTD Resmi Aktif',
          text: 'Tanda tangan resmi otomatis Ahmad Nawasyi, S.Pd kembali digunakan.',
          timer: 2000,
          showConfirmButton: false,
          heightAuto: false
        });
      }
    });
  };

  // Export Laporan PDF (Dirancang profesional, padat & pas 1 kelas dalam 1 lembar)
  const handleExportReportPDF = async () => {
    try {
      if (onlineReportData.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Data Laporan Kosong',
          text: 'Tidak ada data siswa untuk diekspor ke PDF.',
          confirmButtonColor: '#059669',
          heightAuto: false
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header Judul PDF Kompak & Rapi
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('DATA LAPORAN TUGAS ONLINE', pageWidth / 2, 12, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('PENDIDIKAN AGAMA ISLAM DAN BUDI PEKERTI', pageWidth / 2, 16.5, { align: 'center' });

      // Garis pemisah tipis elegan
      doc.setLineWidth(0.2);
      doc.setDrawColor(203, 213, 225);
      doc.line(12, 23.5, pageWidth - 12, 23.5);

      const currentDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Tanggal Cetak: ${currentDate}`, 12, 27);
      doc.text(`Total: ${onlineReportStats.total} Siswa | Sudah: ${onlineReportStats.sudah} | Belum: ${onlineReportStats.belum} (${onlineReportStats.percentage}%)`, pageWidth - 12, 27, { align: 'right' });

      // Urutan header resmi: NO | NIS | NAMA | KELAS | RINCIAN TUGAS ONLINE | STATUS
      const head = [['NO', 'NIS', 'NAMA', 'KELAS', 'RINCIAN TUGAS ONLINE', 'STATUS']];
      
      const body = onlineReportData.map((item, idx) => [
        idx + 1,
        item.nis || '-',
        item.nama_siswa,
        item.kelas || '-',
        'Tugas Online',
        item.isSudah ? 'SUDAH MENGERJAKAN' : 'BELUM MENGERJAKAN'
      ]);

      const totalRows = onlineReportData.length;

      // Hitung skala baris & padding dinamis agar tidak terlalu rapet (sesak), tidak acak-acakan,
      // proporsional seperti dokumen resmi sekolah, dan PASTI muat dalam 1 halaman utuh
      let bodyFontSize = 7.6;
      let headFontSize = 8.0;
      let cellPadV = 1.75;
      let minRowHeight = 5.4;

      if (totalRows > 37) {
        bodyFontSize = 6.8;
        headFontSize = 7.2;
        cellPadV = 0.95;
        minRowHeight = 4.2;
      } else if (totalRows > 31) {
        bodyFontSize = 7.2;
        headFontSize = 7.5;
        cellPadV = 1.3;
        minRowHeight = 4.8;
      } else if (totalRows > 24) {
        // Rentang kelas standar (seperti Kelas 8.B = 29 siswa di screenshot)
        bodyFontSize = 7.6;
        headFontSize = 8.0;
        cellPadV = 1.7;
        minRowHeight = 5.3;
      } else {
        // Kelas dengan siswa lebih sedikit (< 25)
        bodyFontSize = 8.0;
        headFontSize = 8.5;
        cellPadV = 2.2;
        minRowHeight = 6.0;
      }

      // Tabel dipadatkan secara proporsional agar 1 kelas pas dalam 1 lembar
      autoTable(doc, {
        head: head,
        body: body,
        startY: 29.5,
        margin: { left: 12, right: 12, top: 10, bottom: 8 },
        theme: 'grid',
        styles: {
          cellPadding: { top: cellPadV, bottom: cellPadV, left: 1.8, right: 1.8 },
          fontSize: bodyFontSize,
          minCellHeight: minRowHeight,
          valign: 'middle',
          lineColor: [226, 232, 240],
          lineWidth: 0.15
        },
        headStyles: {
          fillColor: [5, 150, 105],
          textColor: [255, 255, 255],
          fontSize: headFontSize,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: cellPadV + 0.6, bottom: cellPadV + 0.6, left: 1.8, right: 1.8 }
        },
        bodyStyles: {
          fontSize: bodyFontSize,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },  // NO
          1: { halign: 'center', cellWidth: 24 },  // NIS
          2: { halign: 'left', cellWidth: 64 },    // NAMA
          3: { halign: 'center', cellWidth: 16 },  // KELAS
          4: { halign: 'center', cellWidth: 36 },  // RINCIAN TUGAS ONLINE
          5: { halign: 'center', cellWidth: 36 }   // STATUS
        },
        didParseCell: function (data: any) {
          if (data.section === 'body' && data.column.index === 5) {
            if (data.cell.raw === 'SUDAH MENGERJAKAN') {
              data.cell.styles.textColor = [5, 150, 105];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // Kolom Tanda Tangan (TTD) diletakkan langsung di bawah tabel secara proporsional
      let finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 5.5 : 45;
      
      // Jika halaman pertama tersisa sangat sedikit (< 28mm), baru buat halaman berikutnya
      if (finalY + 28 > pageHeight - 8) {
        doc.addPage();
        finalY = 16;
      }

      const signX = pageWidth - 58;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(30, 41, 59);
      doc.text(`Tangerang, ${currentDate}`, signX, finalY, { align: 'left' });
      doc.text('Guru Mata Pelajaran PAI,', signX, finalY + 3.8, { align: 'left' });

      // Gambar TTD Otomatis (Dari Google Drive / File Gambar / TTD Resmi)
      try {
        const sigImg = await getTeacherSignatureDataUrl();
        if (sigImg) {
          doc.addImage(sigImg, 'PNG', signX - 2, finalY + 4.8, 34, 15.5);
        }
      } catch (err) {
        console.warn('Gagal memuat gambar TTD:', err);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text('Ahmad Nawasyi, S.Pd', signX, finalY + 22.5, { align: 'left' });
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.25);
      doc.line(signX, finalY + 23.5, signX + 38, finalY + 23.5);

      const safeClass = reportClassFilter === 'all' ? 'Semua_Kelas' : `Kelas_${reportClassFilter}`;
      const filename = `Laporan_Tugas_Online_${safeClass}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

      Swal.fire({
        icon: 'success',
        title: 'Laporan PDF Berhasil Diunduh!',
        text: `File ${filename} berhasil disimpan.`,
        timer: 2000,
        showConfirmButton: false,
        heightAuto: false
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuat PDF',
        text: err.message || 'Terjadi kesalahan saat mengekspor laporan PDF.',
        heightAuto: false
      });
    }
  };

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
      <div className="flex flex-col md:flex-row flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0">
          {/* 0. Search by Name */}
          <div className="relative shrink-0 flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all placeholder:font-medium placeholder:normal-case"
            />
          </div>

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
                <div className="relative">
                  {selectedTasks.length > 0 && (
                    <div className="sticky top-0 z-20 bg-red-50 border-b border-red-100 p-2 md:p-3 flex justify-between items-center shadow-sm">
                      <span className="text-red-600 font-bold text-[10px] md:text-sm">
                        {selectedTasks.length} tugas terpilih
                      </span>
                      <button
                        onClick={handleDeleteSelectedTasks}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                      >
                        <Trash2 size={14} /> Hapus Terpilih
                      </button>
                    </div>
                  )}
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 cursor-pointer rounded accent-slate-600"
                            checked={filteredData.length > 0 && selectedTasks.length === filteredData.length}
                            onChange={() => handleToggleSelectAll(filteredData as TaskSubmission[])}
                          />
                        </th>
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
                        const isSelected = selectedTasks.includes(task.id);
                        return (
                          <tr 
                            key={task.id} 
                            className={`transition-colors border-b ${
                              isSelected
                                ? 'bg-red-50 border-red-100'
                                : isSudah 
                                ? 'bg-red-100/90 text-red-950 border-red-200 hover:bg-red-200/80' 
                                : 'hover:bg-slate-50/50 border-slate-50'
                            }`}
                          >
                            <td className="px-4 py-3 text-center align-middle">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 cursor-pointer rounded accent-red-600"
                                checked={isSelected}
                                onChange={() => handleToggleSelectTask(task.id)}
                              />
                            </td>
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
              </div>
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
                      <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((res: any, index: number) => {
                      return (
                        <tr 
                          key={res.id} 
                          className="transition-colors border-b hover:bg-slate-50/50 border-slate-50"
                        >
                          <td className="px-4 py-3 text-center align-middle font-bold text-[10px] md:text-xs text-slate-500">
                              {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-[11px] md:text-sm leading-tight text-slate-800">{res.student_name}</span>
                              <span className="text-[8px] md:text-[10px] uppercase font-black tracking-tighter text-slate-400">Kelas {res.student_class}</span>
                              
                              {/* REVISI: INFO TAMBAHAN KHUSUS MOBILE (DI BAWAH KELAS) */}
                              <div className="block md:hidden mt-1.5 pt-1.5 border-t border-slate-100">
                                 <span className="text-[10px] font-bold block leading-tight text-slate-700">{res.ujian?.title || '-'}</span>
                                 <span className="text-[9px] font-bold uppercase text-emerald-600">{res.ujian?.category} • Sem {res.semester}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm font-medium text-slate-600">{res.ujian?.title || '-'}</span>
                            <span className="block text-[10px] uppercase font-bold text-slate-400">{res.ujian?.category} • Sem {res.semester}</span>
                          </td>
                          <td className="px-4 py-3 text-center align-top md:align-middle">
                             <span className={`inline-block w-8 py-1 rounded-lg font-black text-[10px] md:text-xs ${res.score >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                {res.score}
                             </span>
                          </td>
                          <td className="px-4 py-3 align-top md:align-middle">
                             <div className="flex flex-col text-[10px] md:text-xs text-slate-500">
                                <span className="font-bold">{new Date(res.submitted_at).toLocaleDateString('id-ID')}</span>
                                <span className="flex items-center gap-1 text-[9px]"><Clock size={10}/> {new Date(res.submitted_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB</span>
                                {/* REVISI: MENAMPILKAN LAMA PENGERJAAN RIIL */}
                                <span className="text-[9px] font-bold mt-1 block text-emerald-600">
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

      {/* ======================================================== */}
      {/* KARTU BARU: DATA LAPORAN TUGAS ONLINE */}
      {/* ======================================================== */}
      {activeTab === 'exams' && (
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-100 p-4 md:p-6 shadow-sm space-y-5 mt-4 md:mt-6">
          {/* Header Kartu & Tombol Laporan (Dipindahkan ke Sini & Format PDF & JSON) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">
                  DATA LAPORAN TUGAS ONLINE
                </h2>
                <p className="text-slate-400 text-[10px] md:text-xs font-medium">
                  Status otomatis pengerjaan tugas online siswa berdasarkan pencocokan data pada sheet <span className="font-bold text-slate-600">hasil_ujian</span> (Nama &amp; NIS).
                </p>
              </div>
            </div>

            {/* Tombol Laporan Belum Tugas Online di Atas Kartu (Format PDF) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportReportPDF}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                title="Unduh Laporan Belum Tugas Online dalam format PDF"
              >
                <FileText size={14} />
                <span>Laporan Belum Tugas Online (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleConfigureSignatureLink}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-xl text-[10px] md:text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 shrink-0 cursor-pointer"
                title="Atur atau upload file / link gambar TTD (Google Drive / PNG)"
              >
                <ImageIcon size={14} />
                <span>Link / Upload TTD</span>
              </button>
            </div>
          </div>

          {/* Statistik Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3">
            <div className="bg-slate-50 p-3 md:p-3.5 rounded-xl md:rounded-2xl border border-slate-100">
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Siswa</span>
              <span className="text-base md:text-xl font-black text-slate-800 mt-0.5 block">{onlineReportStats.total} Siswa</span>
            </div>
            <div className="bg-emerald-50/70 p-3 md:p-3.5 rounded-xl md:rounded-2xl border border-emerald-100/80">
              <span className="text-[9px] md:text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Sudah Mengerjakan</span>
              <span className="text-base md:text-xl font-black text-emerald-700 mt-0.5 block">{onlineReportStats.sudah} Siswa</span>
            </div>
            <div className="bg-red-50/70 p-3 md:p-3.5 rounded-xl md:rounded-2xl border border-red-100/80">
              <span className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase tracking-wider block">Belum Mengerjakan</span>
              <span className="text-base md:text-xl font-black text-red-600 mt-0.5 block">{onlineReportStats.belum} Siswa</span>
            </div>
            <div className="bg-blue-50/70 p-3 md:p-3.5 rounded-xl md:rounded-2xl border border-blue-100/80">
              <span className="text-[9px] md:text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Ketuntasan Kelas</span>
              <span className="text-base md:text-xl font-black text-blue-700 mt-0.5 block">{onlineReportStats.percentage}%</span>
            </div>
          </div>

          {/* Filter Bar (Filter Kelas & Pencarian Siswa) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Kelas */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Filter Kelas:</span>
                <select
                  value={reportClassFilter}
                  onChange={(e) => setReportClassFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="all">Semua Kelas</option>
                  {availableReportClasses.map((cls) => (
                    <option key={cls} value={cls}>Kelas {cls}</option>
                  ))}
                </select>
              </div>

              {/* Filter Status */}
              <select
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="sudah">Hanya Sudah</option>
                <option value="belum">Hanya Belum</option>
              </select>
            </div>

            {/* Pencarian Nama Siswa */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Cari nama / NIS siswa..."
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold border border-slate-200 bg-white text-slate-700 outline-none focus:border-emerald-500 transition-all placeholder:font-medium"
              />
            </div>
          </div>

          {/* Tabel List: Header NO | NAMA SISWA (Kelas) | Sudah atau Belum */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-xs">
                  <tr>
                    <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-14">
                      NO
                    </th>
                    <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      NAMA SISWA (Kelas)
                    </th>
                    <th className="px-4 py-3 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center md:text-left">
                      Sudah atau Belum
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {onlineReportData.length > 0 ? (
                    onlineReportData.map((item: any, idx: number) => {
                      return (
                        <tr
                          key={item.id || idx}
                          className={`transition-colors border-b ${
                            item.isSudah
                              ? 'hover:bg-emerald-50/40 bg-white'
                              : 'hover:bg-red-50/40 bg-red-50/20'
                          }`}
                        >
                          <td className="px-4 py-3 text-center align-middle font-bold text-[10px] md:text-xs text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-col">
                              <span className="font-bold text-[11px] md:text-sm text-slate-800 leading-tight">
                                {item.nama_siswa}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                  Kelas {item.kelas}
                                </span>
                                <span className="text-[9px] md:text-[10px] font-medium text-slate-400">
                                  NIS: {item.nis}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2.5">
                              {/* Centang box otomatis */}
                              <input
                                type="checkbox"
                                checked={item.isSudah}
                                readOnly
                                className={`w-4 h-4 rounded cursor-default ${
                                  item.isSudah ? 'accent-emerald-600' : 'accent-slate-400 opacity-40'
                                }`}
                              />
                              {item.isSudah ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                  <span>Sudah Mengerjakan {item.completedCount > 0 ? `(${item.completedCount} Tugas)` : ''}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                                  <span className="text-xs font-black">✕</span>
                                  <span>Belum Mengerjakan</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-slate-400 text-xs">
                        Tidak ada data siswa yang cocok dengan filter yang dipilih.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTaskCheck;