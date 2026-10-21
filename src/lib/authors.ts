const EN: Record<string, string> = {
  'יצחק ליבוש פרץ': 'I. L. Peretz',
  'חיים נחמן ביאליק': 'Bialik',
  'שלום עליכם': 'Sholem Aleichem',
  'מנדלי מוכר ספרים': 'Mendele',
  'אברהם מאפו': 'Abraham Mapu',
  'בנימין זאב הרצל': 'Theodor Herzl',
};

/** The author as the English UI shows them; unknown names stay as they are. */
export function authorName(a: string | null): string {
  if (!a) return 'Hebrew Wikipedia';
  return EN[a.trim()] ?? a;
}
