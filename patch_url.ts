import fs from 'fs';

let content = fs.readFileSync('services/supabaseMock.ts', 'utf8');

const replacement = `
  async getAppsScriptUrl(): Promise<string | null> {
    return 'https://script.google.com/macros/s/AKfycbzD13Ew8LAodfPljzyU89hyDAYWVydrG84_Wi0qjkMiVYyAB1vUgdjZYu72HTgMJN__/exec';
  }
`;

content = content.replace(/async getAppsScriptUrl\(\): Promise<string \| null> \{[\s\S]*?\}/, replacement.trim());
fs.writeFileSync('services/supabaseMock.ts', content);
