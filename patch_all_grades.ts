import fs from 'fs';

let content = fs.readFileSync('services/supabaseMock.ts', 'utf8');

const newMethod = `
  async getAllGrades(): Promise<any[]> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    
    // INTEGRASI: Ambil dari hasil_ujian (Kerjakan Tugas)
    const examResults = this.getLocalTable<any>('hasil_ujian');
    const allExams = this.getLocalTable<any>('ujian');
    const students = this.getLocalTable<any>('data_siswa');
    
    const mappedExams: any[] = examResults.map(r => {
       const examDef = allExams.find(ex => ex.id === r.exam_id);
       let subjectType = 'harian';
       if (examDef && examDef.category) {
           const cat = examDef.category.toLowerCase();
           if (cat.includes('uts') || cat.includes('pts')) subjectType = 'uts';
           else if (cat.includes('uas') || cat.includes('pas')) subjectType = 'uas';
       }
       const student = students.find((s: any) => s.nis === r.student_nis) || { namalengkap: r.student_name, nis: r.student_nis, id: r.student_nis };
       
       return {
         id: r.id,
         student_id: student.id,
         name_student: r.student_name,
         subject_type: subjectType,
         score: r.score,
         description: examDef ? examDef.title : 'Ujian',
         kelas: r.student_class,
         semester: String(r.semester || '1'),
         created_at: r.submitted_at || new Date().toISOString(),
         data_siswa: student
       };
    });

    const result = list.map((g: any) => ({
      ...g,
      data_siswa: students.find((s: any) => s.id === g.student_id) || { namalengkap: g.name_student || 'Siswa', nis: '-' }
    }));

    return [...result, ...mappedExams];
  }
`;

if (!content.includes('async getAllGrades()')) {
    content = content.replace(/async getGradesByKelas\(/, newMethod + '\n\n  async getGradesByKelas(');
    fs.writeFileSync('services/supabaseMock.ts', content);
}
