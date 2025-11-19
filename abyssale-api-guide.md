דוקומנטציה: שילוב REST API של Abyssale במערכת SaaS ליצירת גרפיקות מבצעים
מבוא
מערכת ה-SaaS שלנו מאפשרת לבעלי חנויות קמעונאיות (סופרמרקטים, חנויות מזון וכו') להעלות טמפלטים מעוצבים (מ-AI/PSD), להגדיר אלמנטים דינמיים (שם מוצר, מחיר, תמונה, צבעים), ולייצר המונית גרפיקות מבצעים (שלטים, פוסטרים, PDF להדפסה). Abyssale מספק את המנוע הטכני דרך REST API פשוט וחזק, עם תמיכה ב-asynchronous generation (עבודה ברקע) ו-webhooks (הודעות אוטומטיות).
פרטים כלליים על ה-API

Base URL: https://api.abyssale.com
פורמט נתונים: JSON בכל הבקשות/תגובות. חובה להוסיף header: Content-Type: application/json.
אימות (Authentication): API Key ב-header: x-api-key: YOUR_API_KEY.
איך לקבל: הרשם ב-Abyssale (חשבון Admin), עבור ל-Settings > API Keys > Create new API Key. שמור אותו בסוד (הוא כמו סיסמה).
תמיכה ב-White-Label: כן, דרך Enterprise plan – הלקוחות לא רואים את Abyssale, רק את המותג שלך.

מגבלות שיעור (Rate Limits): 5 בקשות לשנייה. תלוי בתוכנית (Trial: 30 בקשות; Pro: אלפי).
שגיאות נפוצות: 400 (נתונים שגויים), 401 (API Key שגוי), 429 (חרגת מגבלה), 500 (שגיאת שרת). תמיד בדוק status בתגובה.
Webhooks: הודעות POST אוטומטיות כשהג'נריישן מוכן (למשל, ל-ZIP). הגדר URL callback בבקשה.
עלויות: רק ג'נריישנים מוצלחים נספרים (כ-0.01-0.05$ לגרפיקה, תלוי ווליום).
תמיכה בפורמטים: העלאת AI/PSD דרך UI; ייצוא ל-PNG, JPG, PDF (יחיד/רב-עמודי), GIF, Video, HTML5.

זרימה מרכזית במערכת שלנו

העלאת טמפלט: משתמש מעלה AI/PSD דרך UI של Abyssale (או duplication מ-template קיים via API).
הגדרת דינמיות: ב-UI של Abyssale (או overrides בבקשת generation).
יצירה המונית: שלח רשימת נתונים (CSV/JSON) ל-bulk generation.
ייצוא: קבל ZIP עם כל הגרפיקות + webhook להודעה.
ניהול: שמור ID של designs/projects במסד הנתונים שלנו.


1. ניהול אימות ומפתחות (Authentication)
כל קריאה חייבת header: x-api-key. אין OAuth – פשוט ומהיר.
צעדים ראשונים

הרשם ב-https://www.abyssale.com (חשבון חינם להתחלה).
עבור ל-https://app.abyssale.com/settings/api-keys.
לחץ "Create new API key" – קבל string ארוך (שמור במשתנה סביבה, כמו process.env.ABYSSALE_API_KEY).
בדוק: שלח GET /designs – אם 200 OK, עובד.

דוגמה HTTP (Curl):
textcurl -X GET https://api.abyssale.com/designs \
  -H "x-api-key: YOUR_API_KEY"

2. ניהול תבניות (Designs & Templates)
Designs הם הטמפלטים – כוללים formats (גדלים, כמו A4 לשלט) ואלמנטים (layers: text, image, shape). העלאה ישירה של AI/PSD לא זמינה via API – השתמש ב-UI של Abyssale להעלאה/עריכה, ואז גש via API.
יצירת/העלאת טמפלט חדש

דרך UI:
עבור ל-https://app.abyssale.com/templates/new.
העלה AI/PSD – Abyssale ממיר אוטומטית ל-layers דינמיים (סמן text/image כ-dynamic).
שמור כ-Design – קבל ID.

דרך API (Duplication מ-template קיים): השתמש ב-Workspace Templates להעתקה אסינכרונית.

POST /workspace-templates/{companyTemplateId}/use – העתק טמפלט לפרויקט

תיאור: יוצר עותק של טמפלט משותף (מ-library של Abyssale) לפרויקט שלך. אסינכרוני – קבל ID ו-poll status.
פרמטרים:
Path: companyTemplateId (UUID, חובה) – ID של טמפלט מוכן (קח מ-https://app.abyssale.com/templates/library).
Body (JSON):JSON{
  "project_id": "d59adee9-4867-11f0-96f2-0a00d9eb8f78",  // חובה: ID של פרויקט (צור קודם via POST /projects)
  "name": "טמפלט מבצעים סופרמרקט"  // אופציונלי
}

Headers: x-api-key, Content-Type: application/json.
תגובה (200 OK):JSON{
  "duplication_request_id": "40c32a4e-4869-11f0-96f2-0a00d9eb8f78"
}
שגיאות: 404 אם ID לא קיים.

GET /design-duplication-requests/{duplicateRequestId} – בדוק סטטוס העתקה

תיאור: Poll עד שסטטוס "COMPLETED".
פרמטרים: Path: duplicateRequestId (UUID, חובה).
Headers: x-api-key.
תגובה:JSON{
  "request_id": "40c32a4e-4869-11f0-96f2-0a00d9eb8f78",
  "status": "COMPLETED",  // PENDING / COMPLETED / FAILED
  "designs": [ { "id": "new-design-uuid" } ]  // ID החדש!
}

רשימת טמפלטים
GET /designs – קבל כל ה-designs

תיאור: רשום את כל הטמפלטים שלך.
פרמטרים Query:
category_id (UUID): סנן קטגוריה.
type (enum): "static" (תמונה סטטית), "animated" (וידאו), "printer" (PDF להדפסה).

Headers: x-api-key.
תגובה: Array של אובייקטים עם ID, name, created_at.

GET /designs/{designId} – פרטי טמפלט

תיאור: קבל layers, formats, variables.
פרמטרים Path: designId (UUID).
תגובה: JSON מלא עם elements (למשל, {"headline": {"type": "text", "default": "מבצע!"}}).

GET /designs/{designId}/formats/{formatSpecifier} – פרטי format ספציפי

תיאור: גודל, preview URL, variables דינמיים.
פרמטרים Path: designId, formatSpecifier (שם format, כמו "A4").


3. הגדרת אלמנטים דינמיים (Dynamic Elements)
אלמנטים הם layers בטמפלט: text (שם מוצר), image (תמונת מוצר), color (רקע), visibility (הסתר/הצג לוגו). הגדר ב-UI, override ב-generation.

סוגי אלמנטים:
Text: payload (טקסט), font_size, color.
Image: url (קישור תמונה), crop/resize.
Color: hex (#FF0000).
Visibility: true/false להסתרה.

בקשת override (ב-body של generation):JSON"elements": {
  "product_name": { "payload": "חלב 1%" },
  "price": { "payload": "₪4.99", "color": "#FF0000" },
  "product_image": { "url": "https://example.com/milk.jpg" },
  "logo": { "visible": false }
}


4. יצירת גרפיקות (Generation)
החלק המרכזי: יצר תמונה/וידאו/גרפיקה אחת או המונית, עם overrides.
יצירה בודדת (סינכרונית)
POST /banner-builder/{designId}/generate – יצר תמונה יחידה

תיאור: מיידי, מתאים לבדיקות.
פרמטרים Path: designId (UUID).
Body:JSON{
  "elements": { /* overrides */ },
  "template_format_name": "facebook-post",  // אופציונלי
  "file_compression_level": 80  // 1-100, אופציונלי
}
Headers: x-api-key, Content-Type: application/json.
תגובה (200 OK):JSON{
  "url": "https://cdn.abyssale.com/generated-image.jpg",
  "width": 1200,
  "height": 628
}

יצירה המונית (אסינכרונית)
POST /banner-builder/{designId}/generate – יצר multi-format (bulk)

תיאור: יצר מאות גרפיקות (כל אחת עם overrides שונים). אסינכרוני – קבל ID ו-webhook.
פרמטרים Path: designId.
Body:JSON{
  "elements": { /* overrides ליחידה אחת, או array לbulk */ },
  "template_format_names": ["A4", "instagram"],  // array, ריק = כל formats
  "callback_url": "https://your-saas.com/webhook/abyssale"  // webhook
}
תגובה:JSON{
  "generation_request_id": "06399fcd-0c21-47da-bd9b-1e653e0453e8"
}
Bulk מרובה: שלח array של "elements" – כל פריט = גרפיקה אחת (עד 1000).

POST /designs/{designId}/generate – יצר PDF רב-עמודי

תיאור: למבצעים מרובים (דף לכל מוצר).
Body:JSON{
  "pages": { /* overrides לכל דף */ },
  "callback_url": "..."
}
תגובה: ID, webhook עם PDF URL.

Webhooks ל-generation

סוגים:
newImage: תמונה חדשה מוכנה.JSON{
  "id": "uuid",
  "file": { "url": "..." },
  "design": { ... }
}
newBannerBatch: bulk מוכן.JSON{
  "id": "uuid",
  "banners": [ { "url": "..." } ],
  "errors": [ ]  // אם יש כשלונות
}

טיפ: במערכת שלנו, webhook שומר URLs ב-DB ומעדכן את המשתמש.


5. ייצוא גרפיקות (Exports)
ייצא הכל ל-ZIP להורדה.
POST /async/banners/export – יצר ZIP

תיאור: אסינכרוני, למאות קבצים.
Body:JSON{
  "ids": ["banner-uuid-1", "banner-uuid-2"],  // array של ID מ-generation
  "callback_url": "https://your-saas.com/webhook/export"
}
Headers: x-api-key, Content-Type: application/json.
תגובה:JSON{
  "export_id": "64238d01-d402-474b-8c2d-fbc957e9d290"
}

Webhook ל-export

סוג: NewBannerBatch (כמו generation, אבל עם "archive_url" ל-ZIP).
תגובה:JSON{
  "export_id": "uuid",
  "archive_url": "https://cdn.abyssale.com/export.zip",
  "generated_at": 1234567890
}
טיפ: ZIP תקף 7 ימים – הורד ושמור ב-S3 שלך.


6. ניהול פרויקטים (Projects)
קבץ טמפלטים ל"קמפיינים" (למשל, "מבצעי קיץ").
POST /projects – צור פרויקט חדש

Body:JSON{
  "name": "מבצעי חלב 2025"
}
תגובה:JSON{
  "id": "cb2c4add-4867-11f0-96f2-0a00d9eb8f78",
  "name": "..."
}

GET /projects – רשום פרויקטים

תגובה: Array עם ID, name.


7. פונטים ותוספות (Fonts & Annexes)
GET /fonts – רשום פונטים (כולל עברית/Google Fonts)

תגובה: Array של {name, family, variants}.
טיפ: השתמש ב-UI להעלאת פונטים מותאמים.


8. תמונות דינמיות (Dynamic Images)
POST /designs/{designId}/dynamic-image-url – צור URL דינמי

תיאור: URL שמשנה תוכן via query params (למשל, ?text=מבצע&color=red).
Body:JSON{
  "enable_rate_limit": false,
  "enable_production_mode": true  // production = ללא test watermark
}
תגובה: { "dynamic_url": "https://dynamic.abyssale.com/..." }.
שימוש: אידיאלי לשיתוף מהיר במערכת (ללא API call בכל שינוי).