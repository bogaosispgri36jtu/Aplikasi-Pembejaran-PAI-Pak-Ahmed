import fs from 'fs';

let content = fs.readFileSync('services/supabaseMock.ts', 'utf8');

const syncSingleTableMethod = `
  async syncSingleTableFromGoogleSheets(tableName: string, accessToken?: string): Promise<void> {
    try {
      const appsScriptUrl = await this.getAppsScriptUrl();
      const cfg = TABS_CONFIG.find(c => c.name === tableName);
      if (!cfg) return;

      let isSynced = false;

      if (appsScriptUrl) {
        try {
          const res = await fetch(\`\${appsScriptUrl}?sheet=\${encodeURIComponent(cfg.name)}\`, { method: 'GET' });
          if (res.ok) {
            const json = await res.json();
            const rows: any[][] = json.values || [];
            if (rows.length > 1) {
              const headers = rows[0];
              const items: any[] = [];
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length === 0 || !row[0]) continue;
                const obj: any = {};
                headers.forEach((header, colIdx) => {
                  let cellVal = row[colIdx];
                  if (cellVal === undefined || cellVal === null) cellVal = '';
                  
                  if (typeof cellVal === 'string' && (cellVal.startsWith('[') || cellVal.startsWith('{'))) {
                    try {
                      cellVal = JSON.parse(cellVal);
                    } catch (_) {}
                  }
                  const canonicalKey = this.getCanonicalHeader(header, cfg.headers);
                  if (canonicalKey) {
                    if (canonicalKey === 'date' || canonicalKey === 'tanggal') {
                      cellVal = formatDateOnly(cellVal);
                    }
                    obj[canonicalKey] = cellVal;
                  }
                });
                items.push(obj);
              }
              if (items.length > 0) {
                this.setLocalTable(cfg.name, items);
                isSynced = true;
              }
            }
          }
        } catch (e) {
          console.debug(\`Gagal fetch \${tableName} via Apps Script, mencoba jalur OAuth/GViz...\`, e);
        }
      }

      const spreadsheetId = await this.getSpreadsheetId();
      if (!isSynced && spreadsheetId) {
          const publicRes = await fetch(\`https://docs.google.com/spreadsheets/d/\${spreadsheetId}/gviz/tq?tqx=out:json&sheet=\${encodeURIComponent(cfg.name)}\`);
          if (publicRes.ok) {
            const txt = await publicRes.text();
            const match = txt.match(/google\\.visualization\\.Query\\.setResponse\\(([\\s\\S]*?)\\);/);
            if (match) {
              const json = JSON.parse(match[1]);
              if (json.table && json.table.rows) {
                const cols = json.table.cols || [];
                const headers = cols.map((c: any) => c.label || '').filter(Boolean);
                const activeHeaders = headers.length > 0 ? headers : cfg.headers;

                const items: any[] = [];
                json.table.rows.forEach((row: any) => {
                  const obj: any = {};
                  if (row.c) {
                    row.c.forEach((cell: any, idx: number) => {
                      const key = activeHeaders[idx];
                      if (key) {
                        let val = cell ? cell.v : null;
                        if (val === null || val === undefined) val = '';
                        
                        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
                          try {
                            val = JSON.parse(val);
                          } catch (_) {}
                        }
                        const canonicalKey = this.getCanonicalHeader(key, cfg.headers);
                        if (canonicalKey) {
                          if (canonicalKey === 'date' || canonicalKey === 'tanggal') {
                             val = formatDateOnly(val);
                          }
                          obj[canonicalKey] = val;
                        }
                      }
                    });
                  }
                  items.push(obj);
                });
                if (items.length > 0) {
                  this.setLocalTable(cfg.name, items);
                }
              }
            }
          }
      }
    } catch (e) {
       console.error(\`Gagal syncSingleTableFromGoogleSheets untuk \${tableName}:\`, e);
    }
  }
`;

const updatedSubmitExam = `
  async submitExamResult(result: Omit<ExamResult, 'id' | 'submitted_at'>): Promise<ExamResult> {
    
    // 1. Tarik data terbaru dari Spreadsheet ke lokal agar tidak tertimpa/hilang
    await this.syncSingleTableFromGoogleSheets('hasil_ujian');

    const list = this.getLocalTable<ExamResult>('hasil_ujian');
    
    // Safety check: prevent duplicate submissions of the same exam by the same NIS
    const cleanNis = result.student_nis.toString().trim().toLowerCase();
    const cleanExamId = result.exam_id.toString().trim().toLowerCase();
    const existing = list.find(r => {
      const rNis = r.student_nis ? r.student_nis.toString().trim().toLowerCase() : '';
      const rExamId = r.exam_id ? r.exam_id.toString().trim().toLowerCase() : '';
      return rNis === cleanNis && rExamId === cleanExamId;
    });

    if (existing) {
      console.warn("Safety Check: duplicate submission detected for NIS", cleanNis, "and exam", cleanExamId);
      return existing;
    }

    const id = 'res_' + Math.random().toString(36).substr(2, 9);
    const newResult = {
      ...result,
      id,
      submitted_at: new Date().toISOString()
    } as ExamResult;
    list.push(newResult);
    this.setLocalTable('hasil_ujian', list);
    
    // 2. Sinkronkan semua data hasil_ujian (termasuk yang lama + yang baru) ke Spreadsheet
    this.syncTableToGoogleSheets('hasil_ujian').catch(err => {
      console.warn("Background sync error for hasil_ujian:", err);
    });

    return newResult;
  }
`;

if (!content.includes('syncSingleTableFromGoogleSheets')) {
    content = content.replace(/async syncFromGoogleSheets\(/, syncSingleTableMethod + '\n\n  async syncFromGoogleSheets(');
    content = content.replace(/async submitExamResult\([\\s\\S]*?return newResult;\n  }/, updatedSubmitExam.trim());
    fs.writeFileSync('services/supabaseMock.ts', content);
}
