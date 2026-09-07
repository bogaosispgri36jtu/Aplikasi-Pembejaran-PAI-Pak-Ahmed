import fs from 'fs';

let content = fs.readFileSync('services/supabaseMock.ts', 'utf8');

const replacement = `
  async getGradesByStudent(studentId: string, studentNis?: string): Promise<GradeRecord[]> {
    const list = this.getLocalTable<GradeRecord>('Nilai');
    const targetId = String(studentId || '').trim();
    const targetNis = String(studentNis || '').trim();

    const filtered = list.filter(g => {
      const sId = String(g.student_id || '').trim();
      return (targetId && sId === targetId) || (targetNis && sId === targetNis);
    });

    // INTEGRASI: Ambil dari hasil_ujian (Kerjakan Tugas)
    const examResults = this.getLocalTable<any>('hasil_ujian');
    const allExams = this.getLocalTable<any>('ujian');
    
    const studentExams = examResults.filter(e => targetNis && String(e.student_nis || '').trim() === targetNis);
    const mappedExams: GradeRecord[] = studentExams.map(r => {
       const examDef = allExams.find(ex => ex.id === r.exam_id);
       let subjectType = 'harian';
       if (examDef && examDef.category) {
           const cat = examDef.category.toLowerCase();
           if (cat.includes('uts') || cat.includes('pts')) subjectType = 'uts';
           else if (cat.includes('uas') || cat.includes('pas')) subjectType = 'uas';
       }
       return {
         id: r.id,
         student_id: targetId || targetNis,
         name_student: r.student_name,
         subject_type: subjectType as any,
         score: r.score,
         description: examDef ? examDef.title : 'Ujian',
         kelas: r.student_class,
         semester: String(r.semester || '1'),
         created_at: r.submitted_at || new Date().toISOString()
       };
    });

    const combined = [...filtered, ...mappedExams].sort((a, b) => b.created_at.localeCompare(a.created_at));

    console.log(\`[supabaseMock] getGradesByStudent: Diambil \${combined.length} record (termasuk \${mappedExams.length} dari ujian).\`);

    return combined;
  }
`;

content = content.replace(/async getGradesByStudent\([\s\S]*?return filtered;\n  }/, replacement.trim());
fs.writeFileSync('services/supabaseMock.ts', content);
