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
 * 4. (Opsional) Jalankan fungsi 'setupDatabaseSchema' dari dropdown fungsi di bagian atas
 *    lalu klik 'Run' untuk otomatis membuat 15 sheet beserta header resminya sekaligus!
 * 5. Klik ikon Simpan (Disk) di kiri atas.
 * 6. Klik tombol 'Terapkan' (Deploy) -> 'Penerapan baru' (New deployment).
 * 7. Konfigurasi wajib:
 *    - Pilih Jenis: 'Aplikasi Web' (Web App)
 *    - Jalankan sebagai: 'Saya' (Execute as: Me)
 *    - Siapa yang memiliki akses: 'Siapa saja' (Who has access: Anyone)
 * 8. Klik 'Terapkan' (Deploy). Setujui izin akses jika diminta (klik Advanced -> Go to ... (unsafe)).
 * 9. Salin URL Aplikasi Web yang diberikan, lalu tempelkan ke Pengaturan Guru di aplikasi Anda.
 */

// Konfigurasi Resmi 15 Sheet dan Header Kolom
var SHEET_CONFIGS = {
  "data_siswa": ['id', 'nis', 'namalengkap', 'kelas', 'jeniskelamin'],
  "Nilai": ['id', 'student_id', 'subject_type', 'name_student', 'score', 'description', 'kelas', 'semester', 'created_at'],
  "nilai_rapot": ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'semester', 'sts', 'sas', 'sakit', 'izin', 'alpha', 'sikap', 'katrol', 'nilai_akhir', 'updated_at'],
  "kelola_nilai": ['id', 'student_id', 'nama_siswa', 'nis', 'kelas', 'semester', 'sts', 'sas', 'sakit', 'izin', 'alpha', 'sikap', 'katrol', 'nilai_akhir', 'updated_at'],
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
 * Helper Pintar untuk Menemukan atau Membuat Sheet dengan Menangani Alias Nama Sheet
 */
function getOrCreateSheet(ss, name) {
  if (!name) return null;
  
  // 1. Cek langsung dengan nama persis
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  // 2. Cek Alias Nama Sheet (misal: admin_users <-> admin user, kelola_nilai <-> nilai_rapot)
  if (name === 'admin_users' && ss.getSheetByName('admin user')) return ss.getSheetByName('admin user');
  if (name === 'admin user' && ss.getSheetByName('admin_users')) return ss.getSheetByName('admin_users');
  if (name === 'kelola_nilai' && ss.getSheetByName('nilai_rapot')) return ss.getSheetByName('nilai_rapot');
  if (name === 'nilai_rapot' && ss.getSheetByName('kelola_nilai')) return ss.getSheetByName('kelola_nilai');

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
 * Fungsi Manual Inisialisasi Seluruh 15 Sheet Beserta Header Kolom Resmi
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

    // Jika dipanggil dengan ?action=init atau ?action=setup
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

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = ss.getSpreadsheetTimeZone();
    var sheet = getOrCreateSheet(ss, sheetName);

    var values = [];
    if (sheet && sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) {
      values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    } else {
      // Jika sheet baru dibuat dan belum ada baris, sertakan header default jika ada
      if (SHEET_CONFIGS[sheetName]) {
        values = [SHEET_CONFIGS[sheetName]];
      }
    }

    // Konversi tipe Date ke format yang tepat menggunakan Timezone spreadsheet
    for (var i = 0; i < values.length; i++) {
      for (var j = 0; j < values[i].length; j++) {
        var val = values[i][j];
        if (val instanceof Date) {
          // Format menggunakan timezone spreadsheet untuk mencegah shift hari
          var formatted = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
          if (formatted.indexOf("T00:00:00") !== -1) {
            values[i][j] = formatted.split('T')[0]; // Hanya tanggal
          } else {
            values[i][j] = formatted; // Beserta waktu
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

    // BISA JUGA DI-TRIGGER VIA POST: action = init
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

    if (sheetName && values) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = getOrCreateSheet(ss, sheetName);

      if (!sheet) {
        throw new Error("Gagal membuka atau membuat sheet: " + sheetName);
      }

      // Bersihkan isi sel lama (tanpa merusak format)
      sheet.clearContents();

      // Tulis data baru jika array tidak kosong
      if (values.length > 0) {
        for (var r = 0; r < values.length; r++) {
          for (var c = 0; c < values[r].length; c++) {
            var val = values[r][c];

            if (val === null || val === undefined) {
              values[r][c] = "";
            } else if (typeof val === 'object') {
              // Jika data berupa objek/array (misal opsi soal/jawaban), ubah ke JSON string
              values[r][c] = JSON.stringify(val);
            } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
              // Tulis ISO string sebagai plain text agar Google Sheets & Apps Script tidak 
              // diam-diam mengubah zona waktunya (timezone shift bug)
              values[r][c] = "'" + val;
            } else if (values[0] && (values[0][c] === 'date' || values[0][c] === 'tanggal') && typeof val === 'string' && val) {
              // Jika kolom secara spesifik bernama 'date' atau 'tanggal'
              if (val.indexOf('T') !== -1) {
                values[r][c] = "'" + val.split('T')[0];
              } else if (val.indexOf(' ') !== -1 && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                values[r][c] = "'" + val.split(' ')[0];
              } else {
                values[r][c] = "'" + val; // Selalu amankan sebagai text
              }
            }

            // Batasi panjang karakter per sel agar tidak melebihi limit Google Sheets (50.000 karakter)
            var strVal = values[r][c].toString();
            if (strVal.length > 49000) {
              values[r][c] = strVal.substring(0, 48500) + "... [DIPOTONG KARENA BATAS SHEET]";
            }
          }
        }

        sheet.getRange(1, 1, values.length, values[0].length).setValues(values);

        // Format baris pertama (Header)
        sheet.getRange(1, 1, 1, values[0].length)
             .setFontWeight("bold")
             .setBackground("#f3f4f6");

        // Menyesuaikan lebar kolom secara otomatis
        sheet.autoResizeColumns(1, values[0].length);
      }

      result.success = true;
      result.rowsWritten = values.length;
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

