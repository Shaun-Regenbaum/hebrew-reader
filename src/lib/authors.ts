const EN: Record<string, string> = {
  'יצחק ליבוש פרץ': 'I. L. Peretz',
  'חיים נחמן ביאליק': 'Bialik',
  'שלום עליכם': 'Sholem Aleichem',
  'מנדלי מוכר ספרים': 'Mendele',
  'אברהם מאפו': 'Abraham Mapu',
  'בנימין זאב הרצל': 'Theodor Herzl',
  'יצחק קצנלסון': 'Yitzhak Katznelson',
  'ישראל דושמן': 'Yisrael Dushman',
  'פניה ברגשטיין': 'Fania Bergstein',
  'וילהלם גרים; יעקב גרים': 'Brothers Grimm',
  'קרלו קולודי': 'Carlo Collodi',
  'דוד פרישמן': 'David Frishman',
};

/** The author as the English UI shows them; unknown names stay as they are. */
export function authorName(a: string | null): string {
  if (!a) return 'Hebrew Wikipedia';
  return EN[a.trim()] ?? a;
}
