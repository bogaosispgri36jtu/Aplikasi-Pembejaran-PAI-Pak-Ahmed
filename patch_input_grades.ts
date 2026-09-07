import fs from 'fs';

let content = fs.readFileSync('pages/TeacherInputGrades.tsx', 'utf8');

const replacement = `
  useEffect(() => {
    let isMounted = true;
    setIsPreviewLoading(true);
    
    const load = async () => {
      const allGrades = await db.getAllGrades();
      if (!isMounted) return;
      
      let filtered = [...allGrades];

      if (previewFilterKelas) {
        filtered = filtered.filter((g: any) => String(g.kelas || '').toUpperCase() === String(previewFilterKelas).toUpperCase());
      }
      if (previewFilterSemester) {
        filtered = filtered.filter((g: any) => String(g.semester) === String(previewFilterSemester));
      }

      filtered.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      setPreviewGrades(filtered);
      setIsPreviewLoading(false);
    };
    
    const timer = setTimeout(load, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [previewFilterKelas, previewFilterSemester, status]);
`;

content = content.replace(/useEffect\(\(\) => \{\n    setIsPreviewLoading\(true\);\n    const timer = setTimeout\(\(\) => \{\n      const allGrades = db\.getLocalTable<any>\('Nilai'\);\n      let filtered = \[\.\.\.allGrades\];[\s\S]*?\}, 250\);\n    return \(\) => clearTimeout\(timer\);\n  \}, \[previewFilterKelas, previewFilterSemester, status\]\);/, replacement.trim());

fs.writeFileSync('pages/TeacherInputGrades.tsx', content);
