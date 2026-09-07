import fs from 'fs';

let content = fs.readFileSync('services/supabaseMock.ts', 'utf8');

const replacement = `
  async getGradesByKelas(kelas: string, semester?: string): Promise<any[]> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    let filtered = list.filter(g => g.kelas === kelas);

    if (semester) {
      const s = semester.toLowerCase();
      if (s === '1' || s === 'ganjil') {
        filtered = filtered.filter((g: any) => ['1', 'ganjil', 'semester 1'].includes(String(g.semester || '').toLowerCase()));
      } else if (s === '2' || s === 'genap') {
        filtered = filtered.filter((g: any) => ['2', 'genap', 'semester 2'].includes(String(g.semester || '').toLowerCase()));
      } else {
        filtered = filtered.filter((g: any) => String(g.semester || '').toLowerCase() === s);
      }
    }

    // INTEGRASI: Ambil dari hasil_ujian (Kerjakan Tugas)
    const examResults = this.getLocalTable<any>('hasil_ujian');
    const allExams = this.getLocalTable<any>('ujian');
    const students = await this.getStudentsByKelas(kelas);
    
    let examFiltered = examResults.filter(e => e.student_class === kelas);
    
    if (semester) {
      const s = semester.toLowerCase();
      if (s === '1' || s === 'ganjil') {
        examFiltered = examFiltered.filter((g: any) => ['1', 'ganjil', 'semester 1'].includes(String(g.semester || '').toLowerCase()));
      } else if (s === '2' || s === 'genap') {
        examFiltered = examFiltered.filter((g: any) => ['2', 'genap', 'semester 2'].includes(String(g.semester || '').toLowerCase()));
      } else {
        examFiltered = examFiltered.filter((g: any) => String(g.semester || '').toLowerCase() === s);
      }
    }

    const mappedExams: any[] = examFiltered.map(r => {
       const examDef = allExams.find(ex => ex.id === r.exam_id);
       let subjectType = 'harian';
       if (examDef && examDef.category) {
           const cat = examDef.category.toLowerCase();
           if (cat.includes('uts') || cat.includes('pts')) subjectType = 'uts';
           else if (cat.includes('uas') || cat.includes('pas')) subjectType = 'uas';
       }
       const student = students.find(s => s.nis === r.student_nis) || { namalengkap: r.student_name, nis: r.student_nis, id: r.student_nis };
       
       return {
         id: r.id,
         student_id: student.id,
         name_student: r.student_name,
         subject_type: subjectType,
         score: r.score,
         description: examDef ? (examDef.assessment_id || examDef.title) : 'Ujian',
         kelas: r.student_class,
         semester: String(r.semester || '1'),
         created_at: r.submitted_at || new Date().toISOString(),
         data_siswa: student
       };
    });

    const result = filtered.map((g: any) => ({
      ...g,
      data_siswa: students.find(s => s.id === g.student_id) || { namalengkap: g.name_student || 'Siswa', nis: '-' }
    }));

    const combined = [...result, ...mappedExams];
    
    console.log(\`[supabaseMock] getGradesByKelas: Berhasil mengambil \${combined.length} record (termasuk \${mappedExams.length} dari ujian).\`);
    return combined;
  }
`;

content = content.replace(/async getGradesByKelas\([\s\S]*?return combined;\n  }/, replacement.trim());
fs.writeFileSync('services/supabaseMock.ts', content);
