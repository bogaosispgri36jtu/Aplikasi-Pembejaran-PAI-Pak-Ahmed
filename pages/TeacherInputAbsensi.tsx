import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Users, Calendar, CheckCircle2, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { db } from '../services/supabaseMock';
import { Student, GradeLevel } from '../types';
import Swal from 'sweetalert2';

const TeacherInputAbsensi: React.FC = () => {
  const navigate = useNavigate();
  const [grade, setGrade] = useState<GradeLevel>('7');
  const [semester, setSemester] = useState(''); // Default kosong "Pilih Semester"
  const [selectedKelas, setSelectedKelas] = useState('');
  const [availableKelas, setAvailableKelas] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>({});
  
  // State Tanggal Manual (Tabel Tanggal) - Default Kosong
  const [date, setDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  useEffect(() => {
    const checkExistingSilent = async () => {
      if (!selectedKelas || !date || !semester) {
        setAlreadyExists(false);
        return;
      }
      try {
        const records = await db.getAttendanceByKelas(selectedKelas, semester);
        const exists = records.some((rec: any) => 
          String(rec.date || '').trim() === String(date).trim() &&
          String(rec.kelas || '').trim().toLowerCase() === String(selectedKelas).trim().toLowerCase() &&
          (
            String(rec.semester || '').trim() === String(semester).trim() ||
            (semester === '1' && ['1', 'ganjil', 'semester 1', 'semester1'].includes(String(rec.semester || '').trim().toLowerCase())) ||
            (semester === '2' && ['2', 'genap', 'semester 2', 'semester2'].includes(String(rec.semester || '').trim().toLowerCase()))
          )
        );
        setAlreadyExists(exists);
      } catch (err) {
        console.error("Gagal memeriksa absensi ganda:", err);
      }
    };

    checkExistingSilent();
  }, [selectedKelas, date, semester]);

  useEffect(() => {
    db.getAvailableKelas(grade).then((data: string[]) => {
      setAvailableKelas(data);
      setSelectedKelas(data[0] || '');
    });
  }, [grade]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedKelas) { setStudents([]); return; }
      setLoading(true);
      try {
        const data = await db.getStudentsByKelas(selectedKelas);
        setStudents(data);
        const initial: Record<string, string> = {};
        data.forEach(s => { if (s.id) initial[s.id] = 'hadir'; });
        setAttendanceData(initial);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchStudents();
  }, [selectedKelas]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceData(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    // 1. Validasi Kolom Kosong
    if (!selectedKelas || !date || !semester) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'Perhatian', 
        text: 'Semua kolom (Semester, Kelas, dan Tanggal) wajib dipilih!', 
        confirmButtonColor: '#d97706',
        confirmButtonText: 'OK',
        heightAuto: false 
      });
      return;
    }

    if (students.length === 0) { 
      Swal.fire({ 
        icon: 'error', 
        title: 'Siswa Tidak Ada', 
        text: 'Pilih kelas yang memiliki data siswa.', 
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'OK',
        heightAuto: false 
      }); 
      return; 
    }

    // 2. Tampilkan Pop-up Informasi Saat Proses Pengecekan & Pengiriman
    setSaving(true);
    Swal.fire({
      title: 'Memeriksa & Mengirim Absensi...',
      html: `Sedang memproses data absensi <b>Kelas ${selectedKelas}</b> (Semester <b>${semester}</b>) tanggal <b>${date}</b>...`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    try {
      // 3. Cek apakah kombinasi kelas, semester, dan tanggal sudah ada (Absensi Ganda)
      const records = await db.getAttendanceByKelas(selectedKelas, semester);
      const exists = records.some((rec: any) => 
        String(rec.date || '').trim() === String(date).trim() &&
        String(rec.kelas || '').trim().toLowerCase() === String(selectedKelas).trim().toLowerCase() &&
        (
          String(rec.semester || '').trim() === String(semester).trim() ||
          (semester === '1' && ['1', 'ganjil', 'semester 1', 'semester1'].includes(String(rec.semester || '').trim().toLowerCase())) ||
          (semester === '2' && ['2', 'genap', 'semester 2', 'semester2'].includes(String(rec.semester || '').trim().toLowerCase()))
        )
      );

      // 4. Apabila GANDA: Tampilkan pesan error rincian bahwa absensi sudah diisi
      if (exists) {
        setAlreadyExists(true);
        Swal.fire({
          icon: 'error',
          title: 'Absensi Ganda Terdeteksi!',
          html: `
            <div class="text-left text-xs sm:text-sm space-y-2 text-slate-700">
              <p>Absensi untuk kombinasi berikut <b>sudah pernah terisi sebelumnya</b> di sistem:</p>
              <div class="p-3 bg-red-50 rounded-xl border border-red-200 text-red-900 font-semibold space-y-1">
                <p>• <b>Kelas:</b> ${selectedKelas}</p>
                <p>• <b>Semester:</b> Semester ${semester}</p>
                <p>• <b>Tanggal:</b> ${date}</p>
              </div>
              <p className="text-slate-500">Silakan ganti tanggal, kelas, atau semester jika ingin menginput data baru.</p>
            </div>
          `,
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'OK, Saya Mengerti',
          heightAuto: false 
        });
        return;
      }

      // 5. Apabila TIDAK GANDA: Langsung proses simpan/kirim data ke database
      const attendanceRecords = students.map(s => ({ 
        student_id: s.id!, 
        nis: s.nis,                      
        nama_siswa: s.namalengkap,       
        status: (attendanceData[s.id!] || 'hadir') as any, 
        date: date, 
        kelas: selectedKelas, 
        semester: String(semester) 
      }));
      
      await db.addAttendance(attendanceRecords);
      
      // Reset Semester & status ganda setelah berhasil
      setSemester('');
      setAlreadyExists(false);
      
      // 6. Tampilkan pesan konfirmasi sukses terkirim menggunakan SweetAlert2
      Swal.fire({ 
        icon: 'success', 
        title: 'Alhamdulillah! Berhasil Terkirim', 
        html: `Rekap absensi untuk <b>Kelas ${selectedKelas}</b> (Semester <b>${semester}</b>) tanggal <b>${date}</b> berhasil disimpan.`, 
        confirmButtonColor: '#059669',
        confirmButtonText: 'OK',
        timer: 3000, 
        heightAuto: false 
      });

    } catch (error: any) {
      console.error("Save Error:", error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Gagal Menyimpan', 
        text: 'Terjadi kesalahan sistem saat menyimpan data absensi.', 
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'OK',
        heightAuto: false 
      });
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-2 md:space-y-6 animate-fadeIn pb-20 px-1 md:px-0">
      <button 
        onClick={() => navigate('/guru')} 
        className="group flex items-center gap-2 text-slate-700 hover:text-emerald-700 transition-all text-xs font-black uppercase tracking-wider mb-4"
        id="btn-back-to-dashboard-utama"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        <span>DASHBOARD UTAMA</span>
      </button>
      <div className="bg-amber-600 text-white p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-lg">
        <h1 className="text-base md:text-2xl font-black leading-tight uppercase tracking-tighter">Input Absensi PAI</h1>
        <p className="text-amber-50 text-[9px] md:text-sm mt-0.5 opacity-90">Masukkan kehadiran harian siswa.</p>
      </div>

      <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm space-y-3 md:space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jenjang</label>
            <div className="flex gap-1">
              {(['7', '8', '9'] as const).map((g) => (
                <button key={g} onClick={() => setGrade(g)} className={`flex-1 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] font-black border transition-all ${grade === g ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>{g}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="">-- Pilih Semester --</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Kelas</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}><option value="">-- Kelas --</option>{availableKelas.map(k => <option key={k} value={k}>{k}</option>)}</select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full p-1.5 md:p-2 rounded-lg border border-slate-200 bg-white text-[9px] md:text-xs font-normal outline-none cursor-pointer focus:border-amber-500 text-slate-600 placeholder:text-slate-300" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                placeholder="pilih tanggal"
              />
            </div>
          </div>
        </div>

        {alreadyExists && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl flex items-start gap-2.5 text-[10px] md:text-xs animate-fadeIn shadow-sm">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-red-800 uppercase tracking-tight">Absensi Sudah Terisi!</p>
              <p className="text-red-600 font-medium leading-relaxed mt-0.5">
                Sistem mendeteksi bahwa absensi untuk <span className="font-bold">Kelas {selectedKelas}</span> (Semester <span className="font-bold">{semester}</span>) pada tanggal <span className="font-bold">{date}</span> sudah pernah diisi. Anda tidak dapat melakukan pengisian ganda untuk kombinasi tanggal, kelas, dan semester yang sama.
              </p>
            </div>
          </div>
        )}

        <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 p-2 md:p-3 border-b border-slate-100 flex justify-between items-center"><h3 className="text-[9px] md:text-xs font-bold text-slate-700 uppercase tracking-tight">Daftar Siswa {selectedKelas}</h3>{loading && <Loader2 size={12} className="animate-spin text-amber-600" />}</div>
          <div className="divide-y divide-slate-50 max-h-[620px] overflow-y-auto">
            {students.length > 0 ? students.map((s, idx) => (
              <div key={s.id || s.nis} className="py-1 px-2 md:py-1.5 md:px-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden"><div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 border">{idx + 1}</div><p className="text-[10px] md:text-xs font-normal text-slate-800 truncate uppercase">{s.namalengkap}</p></div>
                <div className="flex gap-1 shrink-0">{[{v:'hadir',l:'H',c:'bg-emerald-600'},{v:'sakit',l:'S',c:'bg-amber-500'},{v:'izin',l:'I',c:'bg-blue-600'},{v:'alfa',l:'A',c:'bg-red-600'}].map(o => (<button key={o.v} onClick={() => s.id && handleStatusChange(s.id, o.v)} className={`w-6 h-6 md:w-7 md:h-7 rounded-md text-[8px] md:text-[9px] font-bold border transition-all ${attendanceData[s.id!] === o.v ? `${o.c} text-white border-transparent shadow-sm scale-105` : 'bg-white text-slate-400 border-slate-100'}`}>{o.l}</button>))}</div>
              </div>
            )) : <div className="p-10 text-center"><AlertCircle className="mx-auto text-slate-200 mb-2" size={32} /><p className="text-slate-400 text-[9px] font-bold">Pilih Kelas untuk memulai absensi</p></div>}
          </div>
        </div>

        <button onClick={handleSave} disabled={students.length === 0 || saving || alreadyExists} className={`w-full py-3 md:py-4 rounded-xl font-black text-[10px] md:text-sm flex items-center justify-center gap-2 transition-all shadow-lg uppercase tracking-widest ${students.length > 0 && !saving && !alreadyExists ? 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95' : 'bg-slate-200 text-slate-400'}`}>{saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16} /> Simpan Absensi</>}</button>
      </div>
    </div>
  );
};

export default TeacherInputAbsensi;