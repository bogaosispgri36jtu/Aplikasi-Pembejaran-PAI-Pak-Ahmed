export const getTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('pai_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  }
  return 'light';
};

export const setTheme = (theme: 'light' | 'dark') => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pai_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

export const initTheme = () => {
  const current = getTheme();
  setTheme(current);
};
