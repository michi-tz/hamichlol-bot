# בוט המכלול

בוט לניהול ועדכון תוכן באתר המכלול.

עברית | **[English](README.he.md)**

## מבנה הפרויקט

### `src/` - קוד המקור הראשי
- `logger.js` - מערכת לוגים
- `import/` - כלים לייבוא תוכן
- `parser/` - מפרסי תוכן ויקי
- `requests/` - לקוחות HTTP ובקשות לשרתים
- `scripts/` - סקריפטים כלליים ועזרים

### `tests/` - בדיקות יחידה

## התקנה והרצה

```bash
# התקנת חבילות
npm install

# הרצת בדיקות
npm test

# בדיקת קוד
npm run lint:test
```

## הרצת הבדיקות (Jest)

הבדיקות נכתבות עם [Jest](https://jestjs.io/) (עם `babel-jest` לטרנספילציה של תחביר `import`/`export`) ונמצאות תחת התיקייה `tests/`, במבנה תואם לזה של `src/` (למשל `tests/requests/utils/cookie.test.js` בודק את `src/requests/utils/cookie.js`).

```bash
# הרצת כל הבדיקות עם דוח כיסוי קוד
npm test

# הרצת קובץ בדיקה בודד
npm test -- tests/requests/requests.test.js

# הרצה ללא דוח כיסוי (מהיר יותר)
npm test -- --no-coverage
```

הבדיקות מבודדות מהרשת ומהדיסק: קריאות HTTP (`node-fetch`) והלוגר (`src/logger.js`) מוחלפות (mock) כך שהרצת הבדיקות אינה תלויה בחיבור לאינטרנט ואינה כותבת קבצי לוג אמיתיים.


## תכונות עיקריות

- ייבוא תוכן מויקיפדיה
- עיבוד ועדכון תבניות
- ניהול קטגוריות ותמונות
- מערכת לוגים מתקדמת

## אימות והגדרות תצורה 🆕

הלקוח `WikiClient` (`src/requests/Client.js`) תומך בשתי שיטות אימות:

- **BotPasswords** (ברירת מחדל) — הגדירו את משתני הסביבה `MC_USER` ו-`MC_PASSWORD`, או קראו ל-`client.login(userName, password)`.
- **OAuth 2.0 (צרכן owner-only / טוקן גישה אישי)** — צרו טוקן דרך
  [Special:OAuthConsumerRegistration](https://www.mediawiki.org/wiki/OAuth/Owner-only_consumers) באתר שלכם,
  ולאחר מכן ספקו אותו דרך משתנה הסביבה `MC_OAUTH_TOKEN` או דרך האפשרות `oauthToken` בבנאי.
  כאשר טוקן OAuth מוגדר, הלקוח שולח כותרת `Authorization` עם טוקן bearer בכל בקשה, ומדלג לגמרי על תהליך
  ההתחברות של BotPasswords. ניתן להשתמש ב-`client.setOAuthToken(token)` כדי להחליף את הטוקן בזמן ריצה.
  שיטת האימות נקבעת לפי המקור בעל העדיפות הגבוהה ביותר (ראו להלן) שמספק פרטי הזדהות כלשהם, כך שלמשל
  `userName`/`password` שהועברו לבנאי גוברים על `MC_OAUTH_TOKEN` ממשתני הסביבה. אם אותו מקור מספק גם טוקן OAuth
  וגם פרטי BotPasswords, העדיפות היא ל-OAuth.

### קובץ תצורה

במקום (או בנוסף ל-) משתני סביבה, ניתן לשים את הגדרות הלקוח ופרטי ההזדהות בקובץ תצורה מסוג JSON.
כברירת מחדל, `WikiClient` מחפש קובץ `./hamichlol-bot.config.json` בתיקיית העבודה הנוכחית (רק אם הוא קיים);
ניתן להצביע לקובץ אחר דרך האפשרות `configPath` בבנאי או משתנה הסביבה `MC_CONFIG_PATH`.
ראו את `hamichlol-bot.config.example.json` לדוגמת פורמט.

סדר העדיפויות של ההגדרות (מהגבוה לנמוך): **אפשרויות מפורשות בבנאי > משתני סביבה > קובץ תצורה > ברירות מחדל מובנות.**

```json
{
  "wikiUrl": "https://www.hamichlol.org.il/w/api.php",
  "maxlag": 5,
  "maxRetries": 3,
  "withLogedIn": true,
  "userAgent": "hamichlol-bot",
  "auth": {
    "type": "oauth",
    "oauthToken": "..."
  }
}
```

`auth.type` יכול להיות `"oauth"` (עם `oauthToken`) או `"password"` (עם `userName` ו-`password`).
מכיוון שהקובץ עלול להכיל סודות, `hamichlol-bot.config.json` מוחרג מ-git — העתיקו את קובץ הדוגמה ומלאו בו את הערכים שלכם.

## מפרסר הוויקי (`src/parser/`) וסנכרון מהמקור

מפרסי קוד הוויקי שבתיקייה `src/parser/` מגיעים מפרויקט הקוד הפתוח
[wiki-bot](https://github.com/EladHeller/wiki-bot) (רישיון ISC). אין לערוך אותם ידנית: הם נוצרים
אוטומטית מקובצי ה-TypeScript של המקור (רק הטיפוסים מוסרים, שאר הקוד נשאר כמו שהוא) לפי ה-commit
הנעוץ בקובץ `src/parser/upstream.json`. קבצים שנוצרו מתחילים ב-`// GENERATED FILE`, והקבצים
המקומיים המעטים מתחילים ב-`// LOCAL FILE`. פרטים נוספים בקובץ `src/parser/CREDITS.md`.

```bash
# יצירה מחדש של src/parser מה-commit הנעוץ (לא אמורים להיווצר שינויים)
npm run sync:parser

# עדכון הנעיצה ל-commit האחרון במקור ויצירה מחדש
npm run sync:parser -- --latest

# או ל-SHA מלא / ענף / תגית מסוימים
npm run sync:parser -- --ref <sha>
```

תהליך GitHub Actions שבועי (`.github/workflows/sync-parser.yml`) מריץ את הסנכרון עם `--latest`
ופותח בקשת משיכה (pull request) כשיש שינויים במקור.

## רישיון

פרויקט זה נכתב על ידי moti of hamichlol.org.il
