
import React from 'react';
import { Mail, Instagram, Phone, MapPin, GraduationCap, Award, User } from 'lucide-react';

const PublicProfile: React.FC = () => {
  const profileImageUrl = "https://lh3.googleusercontent.com/d/1LGJEfepqREAQq7-E4wNU3cH1UR8DG1rP";

  const education = [
    { title: "Sertifikasi Guru", school: "UIN Syarif Hidayatullah - Jakarta", year: "2025" },
    { title: "Sarjana Pendidikan", school: "Universitas Muhammadiyah Tangerang", year: "2020" },
    { title: "SMA", school: "Ponpes Babus Salam - Tangerang", year: "2009" },
    { title: "SMP", school: "Ponpes Babus Salam - Tangerang", year: "2006" },
    { title: "SDN Karet 3", school: "Tangerang", year: "2003" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-fadeIn px-1 md:px-0">
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        <div className="p-4 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-3.5 md:gap-5 pb-4 md:pb-6 border-b border-slate-50">
            <div className="relative group shrink-0">
              <img 
                src={profileImageUrl} 
                alt="Ahmad Nawasyi"
                className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl border-2 md:border-3 border-slate-50 shadow-md object-cover bg-slate-100"
              />
              <div className="absolute -bottom-1 -right-1 md:-bottom-1.5 md:-right-1.5 bg-emerald-600 text-white p-1 md:p-1.5 rounded-lg shadow-md border-2 border-white">
                <Award size={13} className="md:w-3.5 md:h-3.5" />
              </div>
            </div>
            
            <div className="flex-1 w-full flex flex-col items-center md:items-start text-center md:text-left space-y-1">
              <div>
                <h1 className="text-base sm:text-xl md:text-2xl font-bold text-slate-800 leading-tight">Ahmad Nawasyi, S.Pd</h1>
                <p className="text-emerald-600 font-semibold text-[11px] sm:text-xs md:text-sm mt-0.5">Guru Pendidikan Agama Islam & Budi Pekerti</p>
              </div>
              
              <div className="flex gap-1.5 pt-1">
                <button className="p-1.5 md:p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Instagram size={13} className="md:w-3.5 md:h-3.5" />
                </button>
                <button className="p-1.5 md:p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Mail size={13} className="md:w-3.5 md:h-3.5" />
                </button>
                <button className="p-1.5 md:p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100">
                  <Phone size={13} className="md:w-3.5 md:h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-6">
            <div className="md:col-span-2 space-y-4 md:space-y-6">
              <section>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <User size={13} className="text-emerald-600" /> Profil Singkat
                </h2>
                <div className="p-3.5 md:p-4 rounded-xl md:rounded-2xl bg-emerald-50/30 border border-emerald-100/50">
                  <p className="text-slate-600 text-[11px] sm:text-xs md:text-sm leading-relaxed italic">
                    "Assalamualaikum Warahmatullahi Wabarakatuh. saya adalah pengampu mata pelajaran PAI & Budi Pekerti. yang saat ini 
                    bertugas pada satuan pendidikan SMP PGRI Jatiuwung Kota Tangerang."
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xs sm:text-sm md:text-base font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <GraduationCap size={13} className="text-emerald-600" /> Riwayat Pendidikan
                </h2>
                <div className="space-y-2.5 md:space-y-3">
                  {education.map((edu, index) => (
                    <div key={index} className="flex gap-2.5 items-start group">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform"></div>
                      <div className="flex-1 border-l border-slate-100 pl-2.5 md:pl-4 pb-1">
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm md:text-base leading-tight">{edu.title}</h4>
                        <p className="text-slate-500 text-[10px] sm:text-xs mt-0.5">{edu.school}</p>
                        <div className="inline-block mt-1 bg-emerald-100/40 text-emerald-700 px-2 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold">
                          Lulus Tahun {edu.year}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-3.5 md:space-y-5">
              <div className="bg-slate-50 p-3.5 md:p-4 rounded-xl md:rounded-2xl border border-slate-100">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">Kontak</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[10.5px] sm:text-xs">
                    <MapPin className="text-emerald-600 shrink-0 mt-0.5" size={12} />
                    <span className="text-slate-600">Kp. Teriti Sepatan Kab. Tangerang</span>
                  </li>
                  <li className="flex items-center gap-2 text-[10.5px] sm:text-xs">
                    <Mail className="text-emerald-600 shrink-0" size={12} />
                    <span className="text-slate-600 truncate">ahmadnawasyi36@gmail.com</span>
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-600 p-3.5 md:p-4 rounded-xl md:rounded-2xl text-white shadow-md shadow-emerald-200/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award size={13} />
                  <h3 className="font-bold text-[8.5px] uppercase tracking-wider">Visi</h3>
                </div>
                <p className="text-emerald-50 text-[10.5px] sm:text-xs leading-relaxed">
                  Membentuk karakter siswa yang berakhlak karimah melalui teladan dan ilmu.
                </p>
              </div>
              <div className="bg-emerald-600 p-3.5 md:p-4 rounded-xl md:rounded-2xl text-white shadow-md shadow-emerald-200/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award size={13} />
                  <h3 className="font-bold text-[8.5px] uppercase tracking-wider">Misi</h3>
                </div>
                <p className="text-emerald-50 text-[10.5px] sm:text-xs leading-relaxed">
                  Membimbing generasi muda untuk memiliki kecerdasan intelektual sekaligus keluhuran budi pekerti.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;