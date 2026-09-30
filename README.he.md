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
- **`scheduled/` - סקריפטים מתוזמנים** ⭐ חדש!

### `tests/` - בדיקות יחידה

## התקנה והרצה

```bash
# התקנת חבילות
pnpm install

# הרצת בדיקות
pnpm test

# בדיקת קוד
pnpm run lint:test
```

## תכונות עיקריות

- ייבוא תוכן מויקיפדיה
- עיבוד ועדכון תבניות
- ניהול קטגוריות ותמונות
- מערכת לוגים מתקדמת
- **מערכת משימות מתוזמנות** 🆕

## אימות והגדרות תצורה 🆕

הלקוח `WikiClient` (`src/requests/Client.js`) תומך בשתי שיטות אימות:

- **BotPasswords** (ברירת מחדל) — הגדירו את משתני הסביבה `MC_USER` ו-`MC_PASSWORD`, או קראו ל-`client.login(userName, password)`.
- **OAuth 2.0 (צרכן owner-only / טוקן גישה אישי)** — צרו טוקן דרך
  [Special:OAuthConsumerRegistration](https://www.mediawiki.org/wiki/OAuth/Owner-only_consumers) באתר שלכם,
  ולאחר מכן ספקו אותו דרך משתנה הסביבה `MC_OAUTH_TOKEN` או דרך האפשרות `oauthToken` בבנאי.
  כאשר טוקן OAuth מוגדר, הלקוח שולח כותרת `Authorization` עם טוקן bearer בכל בקשה, ומדלג לגמרי על תהליך
  ההתחברות של BotPasswords. ניתן להשתמש ב-`client.setOAuthToken(token)` כדי להחליף את הטוקן בזמן ריצה.
  אם סופקו גם פרטי OAuth וגם פרטי BotPasswords, העדיפות היא ל-OAuth.

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

## רישיון

פרויקט זה נכתב על ידי moti of hamichlol.org.il
