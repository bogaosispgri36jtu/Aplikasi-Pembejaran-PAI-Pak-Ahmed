/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - SINKRONISASI LENGKAP PORTAL PAI & BUDI PEKERTI
 * ID SPREADSHEET: 1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c
 * =========================================================================
 * 
 * Petunjuk Penggunaan & Pemasangan:
 * 1. Buka Google Spreadsheet Anda (ID: 1G_iMlKROJmq0UPb1Angg4IphW7BxVcron8yBEla7p2c).
 * 2. Klik menu 'Ekstensi' -> 'Apps Script'.
 * 3. Hapus seluruh kode lama di editor Apps Script, lalu tempelkan seluruh kode ini.
 * 4. Klik ikon Simpan (Disk) di kiri atas.
 * 5. Klik tombol 'Terapkan' (Deploy) -> 'Penerapan baru' (New deployment) atau 'Kelola penerapan' -> 'Versi baru'.
 * 6. Konfigurasi wajib:
 *    - Pilih Jenis: 'Aplikasi Web' (Web App)
 *    - Jalankan sebagai: 'Saya' (Execute as: Me)
 *    - Siapa yang memiliki akses: 'Siapa saja' (Who has access: Anyone)
 * 7. Klik 'Terapkan' (Deploy). Setujui izin akses jika diminta.
 * 8. Salin URL Aplikasi Web yang diberikan, lalu pastikan tersimpan di Pengaturan Guru aplikasi Anda.
 */

// Konfigurasi Resmi Sheet dan Header Kolom
// Format Kolom nilai_rapot sesuai urutan ledger:
// id | student_id | nama_siswa | nis | kelas | semester | nilai_TP1 | nilai_TP2 | nilai_TP ... | rata2_nilaiharian | sts | sas | sakit | izin | alpha | sikap | rata2_nilaikeseluruhan | katrol | nilai_akhir | updated_at
var SHEET_CONFIGS = {
  "data_siswa": ['id', 'nis', 'namalengkap', 'kelas', 'jeniskelamin'],
  "Nilai": ['id', 'student_id', 'subject_type', 'name_student', 'score', 'description', 'kelas', 'semester', 'created_at'],
  "nilai_rapot": ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'semester', 'nilai_TP1', 'nilai_TP2', 'nilai_TP3', 'nilai_TP4', 'rata2_nilaiharian', 'sts', 'sas', 'sakit', 'izin', 'alpha', 'sikap', 'rata2_nilaikeseluruhan', 'katrol', 'nilai_akhir', 'updated_at'],
  "ujian": ['id', 'title', 'grade', 'category', 'semester', 'duration', 'deadline', 'is_random', 'status', 'created_at', 'tp_id', 'assessment_id'],
  "hasil_ujian": ['id', 'exam_id', 'student_nis', 'student_name', 'student_class', 'semester', 'answers', 'score', 'violation_count', 'started_at', 'submitted_at'],
  "tujuan_pembelajaran": ['id', 'code', 'name', 'description', 'subject', 'grade', 'semester'],
  "asesmen_tp": ['id', 'tpId', 'name', 'type'],
  "JurnalHarian": ['id', 'tanggal', 'kelas', 'jam_mengajar', 'deskripsi', 'created_at'],
  "kehadiran": ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'date', 'status', 'semester'],
  "data_TugasSiswa": ['id', 'nisn', 'student_name', 'kelas', 'task_name', 'submission_type', 'content1', 'content2', 'content3', 'created_at'],
  "materi_belajar": ['id', 'title', 'description', 'grade', 'category', 'content_url', 'thumbnail', 'semester', 'kelas', 'tp_id', 'text_content'],
  "kunjungan": ['id', 'nis', 'nama', 'kelas', 'halaman', 'timestamp', 'device', 'browser', 'duration'],
  "bank_soal": ['id', 'exam_id', 'type', 'text', 'image_url', 'options', 'correct_answer'],
  "admin_users": ['id', 'username', 'fullname', 'password', 'role', 'created_at'],
  "admin user": ['id', 'username', 'fullname', 'password', 'role', 'created_at']
};

/**
 * Helper Pintar untuk Menemukan atau Membuat Sheet
 */
function getOrCreateSheet(ss, name) {
  if (!name) return null;
  
  // Jika ada panggilan usang ke kelola_nilai, alihkan otomatis ke nilai_rapot
  if (name === 'kelola_nilai') {
    name = 'nilai_rapot';
  }

  // 1. Cek langsung dengan nama persis
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  // 2. Cek Alias Khusus (admin_users <-> admin user)
  if (name === 'admin_users' && ss.getSheetByName('admin user')) return ss.getSheetByName('admin user');
  if (name === 'admin user' && ss.getSheetByName('admin_users')) return ss.getSheetByName('admin_users');

  // 3. Jika belum ada di spreadsheet, buat sheet baru
  sheet = ss.insertSheet(name);

  // Jika ada header standar terdaftar, tuliskan ke baris 1
  var headers = SHEET_CONFIGS[name];
  if (headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

/**
 * Helper untuk Menulis Baris Nilai ke Sheet dengan Aman & Rapi
 */
function writeValuesToSheet(sheet, values) {
  if (!sheet || !values || values.length === 0) return;

  sheet.clearContents();

  var processedValues = [];
  for (var r = 0; r < values.length; r++) {
    var row = [];
    for (var c = 0; c < values[r].length; c++) {
      var val = values[r][c];

      if (val === null || val === undefined) {
        row.push("");
      } else if (typeof val === 'object') {
        row.push(JSON.stringify(val));
      } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        // Tulis ISO string sebagai plain text agar Google Sheets tidak menggeser zona waktu
        row.push("'" + val);
      } else if (values[0] && (values[0][c] === 'date' || values[0][c] === 'tanggal') && typeof val === 'string' && val) {
        if (val.indexOf('T') !== -1) {
          row.push("'" + val.split('T')[0]);
        } else if (val.indexOf(' ') !== -1 && /^\d{4}-\d{2}-\d{2}/.test(val)) {
          row.push("'" + val.split(' ')[0]);
        } else {
          row.push("'" + val);
        }
      } else {
        var strVal = String(val);
        if (strVal.length > 49000) {
          row.push(strVal.substring(0, 48500) + "... [DIPOTONG KARENA BATAS SHEET]");
        } else {
          row.push(val);
        }
      }
    }
    processedValues.push(row);
  }

  if (processedValues.length > 0 && processedValues[0].length > 0) {
    sheet.getRange(1, 1, processedValues.length, processedValues[0].length).setValues(processedValues);

    sheet.getRange(1, 1, 1, processedValues[0].length)
         .setFontWeight("bold")
         .setBackground("#f3f4f6");

    sheet.autoResizeColumns(1, processedValues[0].length);
  }
}

/**
 * Fungsi Manual Inisialisasi Seluruh Sheet Beserta Header Kolom Resmi
 */
function setupDatabaseSchema() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var created = [];

  for (var key in SHEET_CONFIGS) {
    var headers = SHEET_CONFIGS[key];
    var sheet = getOrCreateSheet(ss, key);
    if (sheet) {
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
        sheet.autoResizeColumns(1, headers.length);
      }
      created.push(key);
    }
  }

  return "Berhasil memeriksa dan menginisialisasi sheet: " + created.join(", ");
}

/**
 * Menerima Permintaan GET dari Web App
 */
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action;

    if (action === 'init' || action === 'setup') {
      var msg = setupDatabaseSchema();
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, message: msg })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = params.sheet;
    if (!sheetName) {
      return ContentService.createTextOutput(
        JSON.stringify({ error: "Parameter 'sheet' wajib diisi!" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (sheetName === 'kelola_nilai') {
      sheetName = 'nilai_rapot';
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    var sheet = getOrCreateSheet(ss, sheetName);

    var values = [];
    if (sheet && sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    }

    if (values.length === 0 && SHEET_CONFIGS[sheetName]) {
      values = [SHEET_CONFIGS[sheetName]];
    }

    for (var i = 0; i < values.length; i++) {
      for (var j = 0; j < values[i].length; j++) {
        var val = values[i][j];
        if (val instanceof Date) {
          var formatted = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
          if (formatted.indexOf("T00:00:00") !== -1) {
            values[i][j] = formatted.split('T')[0];
          } else {
            values[i][j] = formatted;
          }
        } else if (val === null || val === undefined) {
          values[i][j] = "";
        }
      }
    }

    return ContentService.createTextOutput(
      JSON.stringify({ values: values })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menerima Permintaan POST dari Web App (Penyimpanan & Sinkronisasi)
 */
function doPost(e) {
  var result = { success: false };
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Data kiriman POST kosong atau tidak valid.");
    }

    var postData = JSON.parse(e.postData.contents);

    if (postData.action === 'init' || postData.action === 'setup') {
      var initMsg = setupDatabaseSchema();
      result.success = true;
      result.message = initMsg;
      return ContentService.createTextOutput(
        JSON.stringify(result)
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var sheetName = postData.sheet;
    var values = postData.values;
    var targetClass = postData.kelas;

    if (sheetName === 'kelola_nilai') {
      sheetName = 'nilai_rapot';
    }

    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = getOrCreateSheet(ss, sheetName);

      if (!sheet) {
        throw new Error("Gagal membuka atau membuat sheet: " + sheetName);
      }

      // Tulis baris nilai ke spreadsheet
      writeValuesToSheet(sheet, values);

      result.success = true;
      result.rowsWritten = values.length;
      result.sheetUpdated = sheetName;
      if (targetClass) {
        result.kelas = targetClass;
      }
    } else {
      result.error = "Parameter 'sheet' atau 'values' wajib diisi.";
    }
  } catch (err) {
    result.error = err.toString();
  }

  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Menangani Pre-flight Request CORS
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
