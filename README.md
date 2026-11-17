# Makhs Barber Shop — ιστοσελίδα

Επαγγελματική ιστοσελίδα για το κουρείο **Makhs** (Παπάγου 92, Ζωγράφου) με splash intro, animations και **online κρατήσεις με αυτόματα email** σε πελάτη και ιδιοκτήτη.

- Στατικό site (HTML/CSS/JS). Δεν θέλει build και μπορεί να φιλοξενηθεί δωρεάν στο GitHub Pages.
- Κρατήσεις μέσω **Google Apps Script**: δωρεάν, τρέχει στον λογαριασμό Google του ιδιοκτήτη.

```
index.html              ← η σελίδα
assets/css/style.css    ← σχέδιο & εφέ
assets/js/config.js     ← ΤΙΜΕΣ, ΥΠΗΡΕΣΙΕΣ, ΩΡΑΡΙΟ, URL κρατήσεων
assets/js/main.js       ← splash, animations, γκαλερί
assets/js/booking.js    ← σύστημα κρατήσεων (frontend)
backend/Code.gs         ← backend κρατήσεων (Google Apps Script)
assets/img/shop/        ← πραγματικές φωτογραφίες του μαγαζιού (Google Maps)
assets/img/work/        ← ενδεικτικές φωτογραφίες κουρεμάτων (Unsplash)
```

## Τοπική προβολή

```bash
python3 -m http.server 8000
```
και άνοιγμα στο http://localhost:8000

## Πώς δουλεύουν οι κρατήσεις

1. Ο πελάτης διαλέγει υπηρεσία → μέρα → ώρα (βλέπει **μόνο ελεύθερες** ώρες μέσα στο ωράριο).
2. Συμπληρώνει όνομα, κινητό, email.
3. Αυτόματα:
   - η κράτηση γράφεται σε **Google Sheet**
   - ο **πελάτης** λαμβάνει email επιβεβαίωσης με αρχείο ημερολογίου (.ics) και link ακύρωσης
   - ο **ιδιοκτήτης** λαμβάνει email με τα στοιχεία, κουμπί κλήσης και WhatsApp
   - (προαιρετικά) μπαίνει στο **Google Calendar** του ιδιοκτήτη, οπότε του έρχεται ειδοποίηση και στο κινητό
4. Δεν γίνονται διπλοκρατήσεις (κλείδωμα στον server).

Μέχρι να συνδεθεί το backend, το site τρέχει σε **λειτουργία επίδειξης**: η κράτηση ολοκληρώνεται αλλά δεν στέλνεται πουθενά.

## Ενεργοποίηση κρατήσεων (≈10 λεπτά, μία φορά)

Γίνεται **με τον λογαριασμό Google του ιδιοκτήτη**, ώστε τα email να φεύγουν από το δικό του Gmail.

1. **Google Sheet**: στο https://sheets.new φτιάξτε ένα νέο φύλλο με όνομα π.χ. «Makhs Κρατήσεις».
2. Από το μενού **Επεκτάσεις → Apps Script**.
3. Σβήστε ό,τι υπάρχει και επικολλήστε όλο το `backend/Code.gs`.
4. Στην αρχή του αρχείου αλλάξτε το `OWNER_EMAIL: "owner@example.com"` στο email του ιδιοκτήτη.
5. ⚙️ **Ρυθμίσεις έργου**: ζώνη ώρας **(GMT+02:00) Athens**.
6. Επιλέξτε τη συνάρτηση `setup` και πατήστε **Run**. Εγκρίνετε τα δικαιώματα: Sheets, Gmail αποστολή, Calendar.
7. **Deploy → New deployment → Web app**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - **Deploy**, και αντιγράψτε το **Web app URL** (τελειώνει σε `/exec`).
8. Στο `assets/js/config.js` βάλτε το URL:
   ```js
   bookingApiUrl: "https://script.google.com/macros/s/XXXX/exec",
   ```
9. Commit & push. Από εκεί και πέρα οι κρατήσεις είναι live.

> Αν αλλάξετε τον κώδικα στο `Code.gs`, κάντε **Deploy → Manage deployments → Edit → New version** για να ισχύσει.
> Όριο Gmail: ~100 email/ημέρα (δωρεάν λογαριασμός), δηλαδή ~50 κρατήσεις τη μέρα. Με Google Workspace το όριο είναι 1.500.

## Αλλαγή τιμών / υπηρεσιών / ωραρίου

- `assets/js/config.js`: ό,τι φαίνεται στο site.
- `backend/Code.gs` → `SERVICES` και `HOURS`: ό,τι ελέγχει ο server. **Κρατήστε τα ίδια** (ίδια `id` και διάρκειες).

⚠️ Οι τιμές είναι **ενδεικτικές** και πρέπει να επιβεβαιωθούν με τον ιδιοκτήτη.

## Δημοσίευση στο GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `(root)` → Save.
Το site θα ανοίγει στο `https://<username>.github.io/barbershopMakis/`.

## Φωτογραφίες

- `assets/img/shop/`: από το προφίλ του κουρείου στο Google Maps.
- `assets/img/work/`: **ενδεικτικές** φωτογραφίες από το [Unsplash](https://unsplash.com/license) (ελεύθερες για εμπορική χρήση). Αντικαταστήστε τις με πραγματικές δουλειές του Μάκη κρατώντας τα ίδια ονόματα αρχείων. Αρκεί κάθετη φωτογραφία ~1100px πλάτος.
