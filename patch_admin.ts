import fs from 'fs';

let content = fs.readFileSync('pages/TeacherAdminManagement.tsx', 'utf8');

content = content.replace(
  /localStorage\.getItem\('google_apps_script_url'\) \|\| import\.meta\.env\.VITE_GOOGLE_APPS_SCRIPT_URL \|\| ''/,
  `'https://script.google.com/macros/s/AKfycbzD13Ew8LAodfPljzyU89hyDAYWVydrG84_Wi0qjkMiVYyAB1vUgdjZYu72HTgMJN__/exec'`
);

content = content.replace(
  /!!localStorage\.getItem\('google_apps_script_url'\) \|\| true/,
  `true`
);

fs.writeFileSync('pages/TeacherAdminManagement.tsx', content);
