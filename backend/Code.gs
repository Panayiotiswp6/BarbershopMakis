/**
 * MAKHS BARBER SHOP — booking backend (Google Apps Script)
 * ---------------------------------------------------------
 * Free, runs on the shop owner's Google account:
 *   • stores every booking in a Google Sheet
 *   • blocks double bookings (with a lock)
 *   • emails the CUSTOMER a confirmation (+ .ics calendar file + cancel link)
 *   • emails the OWNER a notification (with call / WhatsApp links)
 *   • optionally adds the appointment to the owner's Google Calendar
 *
 * Setup: see README.md → «Ενεργοποίηση κρατήσεων».
 */

/* ======================= CONFIG ======================= */
const CONFIG = {
  OWNER_EMAIL: "owner@example.com",          // ← το email του ιδιοκτήτη
  SHOP_NAME: "Makhs Barber Shop",
  SHOP_ADDRESS: "Παπάγου 92, Ζωγράφου 157 72",
  SHOP_PHONE: "210 775 9949",
  ADD_TO_CALENDAR: true,                     // βάζει το ραντεβού στο Google Calendar του ιδιοκτήτη
  DAYS_AHEAD: 30,
  MIN_LEAD_MINUTES: 60,
  SHEET_NAME: "Κρατήσεις",

  // id → [όνομα, λεπτά, τιμή]   (ίδια με assets/js/config.js)
  SERVICES: {
    haircut: ["Ανδρικό κούρεμα", 30, 11],
    fade:    ["Skin fade / σχέδια", 40, 13],
    combo:   ["Κούρεμα & γένια", 50, 16],
    beard:   ["Περιποίηση γενειάδας", 20, 7],
    shave:   ["Ξύρισμα με ζεστή πετσέτα", 30, 9],
    kids:    ["Παιδικό κούρεμα", 30, 10]
  },

  // 0 = Κυριακή … 6 = Σάββατο  (ίδιο με assets/js/config.js)
  HOURS: {
    0: [],
    1: [["09:00", "15:00"]],
    2: [["09:00", "14:00"], ["17:00", "21:00"]],
    3: [["09:00", "15:00"]],
    4: [["09:00", "14:00"], ["17:00", "21:00"]],
    5: [["09:00", "14:00"], ["17:00", "21:00"]],
    6: [["09:00", "15:00"]]
  }
};

const HEADERS = ["ID", "Δημιουργία", "Ημερομηνία", "Ώρα", "Λήξη", "Υπηρεσία", "Όνομα", "Τηλέφωνο", "Email", "Σημείωση", "Κατάσταση", "Token"];
const DAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const MONTHS_GEN = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];

/* ======================= HTTP ======================= */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === "availability") return json({ ok: true, date: p.date, busy: busyFor(p.date) });
    if (p.action === "cancel") return cancelPage(p.id, p.token);
    return json({ ok: true, service: CONFIG.SHOP_NAME });
  } catch (err) {
    return json({ ok: false, error: "server", message: String(err) });
  }
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: "bad_json" }); }
  if (data.website) return json({ ok: true, id: "OK" }); // honeypot → silently ignore bots
  if (data.action !== "book") return json({ ok: false, error: "bad_action" });

  const v = validate(data);
  if (v.error) return json({ ok: false, error: v.error, message: v.message });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json({ ok: false, error: "busy", message: "Δοκίμασε ξανά σε λίγα δευτερόλεπτα." });
  let booking;
  try {
    const overlap = busyFor(v.date).some(b => toMin(v.time) < toMin(b.end) && toMin(v.end) > toMin(b.start));
    if (overlap) return json({ ok: false, error: "slot_taken" });
    booking = {
      id: Utilities.getUuid().slice(0, 8).toUpperCase(),
      token: Utilities.getUuid().replace(/-/g, ""),
      created: new Date(),
      date: v.date, time: v.time, end: v.end,
      serviceId: v.serviceId, serviceName: v.service[0], price: v.service[2],
      name: v.name, phone: v.phone, email: v.email, notes: v.notes
    };
    sheet().appendRow([booking.id, booking.created, booking.date, booking.time, booking.end, booking.serviceName,
      booking.name, "'" + booking.phone, booking.email, booking.notes, "Ενεργό", booking.token]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  try { if (CONFIG.ADD_TO_CALENDAR) addToCalendar(booking); } catch (err) { console.error(err); }
  try { emailCustomer(booking); } catch (err) { console.error(err); }
  try { emailOwner(booking); } catch (err) { console.error(err); }
  return json({ ok: true, id: booking.id });
}

/* ======================= LOGIC ======================= */
function validate(d) {
  const service = CONFIG.SERVICES[d.service];
  if (!service) return { error: "bad_service", message: "Άγνωστη υπηρεσία." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "") || !/^\d{2}:\d{2}$/.test(d.time || "")) return { error: "bad_datetime", message: "Μη έγκυρη ημερομηνία/ώρα." };
  const name = String(d.name || "").trim().slice(0, 80);
  const phone = String(d.phone || "").trim().slice(0, 30);
  const email = String(d.email || "").trim().slice(0, 120);
  const notes = String(d.notes || "").trim().slice(0, 400);
  if (name.length < 3) return { error: "bad_name", message: "Συμπλήρωσε ονοματεπώνυμο." };
  if (!/^[+\d][\d\s-]{8,}$/.test(phone)) return { error: "bad_phone", message: "Μη έγκυρο τηλέφωνο." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "bad_email", message: "Μη έγκυρο email." };

  const start = dateAt(d.date, d.time);
  const now = new Date();
  if (start.getTime() < now.getTime() + CONFIG.MIN_LEAD_MINUTES * 60000) return { error: "too_soon", message: "Η ώρα αυτή δεν είναι πλέον διαθέσιμη." };
  if (start.getTime() > now.getTime() + (CONFIG.DAYS_AHEAD + 1) * 86400000) return { error: "too_far", message: "Πολύ μακρινή ημερομηνία." };

  const startM = toMin(d.time), endM = startM + service[1];
  const ranges = CONFIG.HOURS[start.getDay()] || [];
  if (!ranges.some(r => startM >= toMin(r[0]) && endM <= toMin(r[1]))) return { error: "closed", message: "Το κουρείο είναι κλειστό εκείνη την ώρα." };

  return { service, serviceId: d.service, date: d.date, time: d.time, end: toTime(endM), name, phone, email, notes };
}

function busyFor(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) throw new Error("bad date");
  const rows = sheet().getDataRange().getValues().slice(1);
  return rows
    .filter(r => cellDate(r[2]) === dateStr && r[10] !== "Ακυρώθηκε")
    .map(r => ({ start: cellTime(r[3]), end: cellTime(r[4]) }));
}

function cancelPage(id, token) {
  const sh = sheet();
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id && rows[i][11] === token) {
      if (rows[i][10] !== "Ακυρώθηκε") {
        sh.getRange(i + 1, 11).setValue("Ακυρώθηκε");
        const b = { id, date: cellDate(rows[i][2]), time: cellTime(rows[i][3]), serviceName: rows[i][5], name: rows[i][6], phone: String(rows[i][7]), email: rows[i][8] };
        try {
          MailApp.sendEmail({ to: CONFIG.OWNER_EMAIL, subject: `❌ Ακύρωση: ${b.name} · ${prettyDate(b.date)} ${b.time}`,
            htmlBody: mailShell(`<h2 style="margin:0 0 12px">Ακύρωση ραντεβού</h2><p>Ο/Η <b>${esc(b.name)}</b> ακύρωσε το ραντεβού:</p>${table(b)}`), name: CONFIG.SHOP_NAME });
          if (CONFIG.ADD_TO_CALENDAR) removeFromCalendar(id, b.date);
        } catch (err) { console.error(err); }
      }
      return HtmlService.createHtmlOutput(simplePage("Το ραντεβού ακυρώθηκε", "Ευχαριστούμε που μας ενημέρωσες. Μπορείς να κλείσεις νέο ραντεβού όποτε θέλεις."));
    }
  }
  return HtmlService.createHtmlOutput(simplePage("Δεν βρέθηκε", "Ο σύνδεσμος ακύρωσης δεν είναι έγκυρος."));
}

/* ======================= EMAIL ======================= */
function emailCustomer(b) {
  const cancelUrl = ScriptApp.getService().getUrl() + `?action=cancel&id=${b.id}&token=${b.token}`;
  const html = mailShell(`
    <h2 style="margin:0 0 6px;font-size:26px">Το ραντεβού σου επιβεβαιώθηκε ✂️</h2>
    <p style="color:#555;margin:0 0 20px">Γεια σου ${esc(b.name.split(" ")[0])}, σε περιμένουμε!</p>
    ${table(b)}
    <p style="margin:22px 0 6px">📍 <b>${CONFIG.SHOP_ADDRESS}</b><br>📞 ${CONFIG.SHOP_PHONE}</p>
    <p style="margin:22px 0 0;font-size:13px;color:#777">Δεν μπορείς να έρθεις; <a href="${cancelUrl}" style="color:#a8823a">Ακύρωσε το ραντεβού</a> ή κάλεσέ μας.</p>`);
  MailApp.sendEmail({
    to: b.email, replyTo: CONFIG.OWNER_EMAIL, name: CONFIG.SHOP_NAME,
    subject: `Επιβεβαίωση ραντεβού · ${prettyDate(b.date)} στις ${b.time}`,
    htmlBody: html, attachments: [ics(b)]
  });
}

function emailOwner(b) {
  const intl = b.phone.replace(/[^\d+]/g, "").replace(/^(?!\+)(?:00)?/, m => m === "" ? "+30" : "+");
  const html = mailShell(`
    <h2 style="margin:0 0 14px;font-size:24px">Νέο ραντεβού 💈</h2>
    ${table(b)}
    <p style="margin:18px 0 4px"><b>Πελάτης:</b> ${esc(b.name)}<br>
    <b>Τηλ:</b> <a href="tel:${intl}">${esc(b.phone)}</a> · <a href="https://wa.me/${intl.replace("+", "")}">WhatsApp</a><br>
    <b>Email:</b> <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>
    ${b.notes ? `<p style="background:#f6f1e6;padding:12px 14px;border-radius:6px"><b>Σημείωση:</b> ${esc(b.notes)}</p>` : ""}
    <p style="font-size:12px;color:#888">Κωδικός κράτησης: ${b.id}</p>`);
  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL, replyTo: b.email, name: "Κρατήσεις Website",
    subject: `💈 Νέο ραντεβού: ${b.name} · ${prettyDate(b.date)} ${b.time}`,
    htmlBody: html
  });
}

function table(b) {
  const row = (k, v) => `<tr><td style="padding:8px 0;color:#777;width:110px">${k}</td><td style="padding:8px 0;font-weight:600">${v}</td></tr>`;
  return `<table style="border-collapse:collapse;width:100%;border-top:1px solid #eee;border-bottom:1px solid #eee">
    ${row("Υπηρεσία", esc(b.serviceName))}${row("Ημέρα", prettyDate(b.date))}${row("Ώρα", b.time + (b.end ? "–" + b.end : ""))}${b.price ? row("Τιμή", b.price + "€") : ""}</table>`;
}

function mailShell(inner) {
  return `<div style="background:#f3f2ee;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;color:#151515">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
      <div style="background:#0b0b0c;color:#fff;padding:22px 28px;font-size:26px;font-weight:900;letter-spacing:3px">MAKHS
        <span style="display:block;font-size:10px;letter-spacing:5px;color:#c9a45c;font-weight:600">BARBER SHOP</span></div>
      <div style="padding:28px">${inner}</div>
    </div></div>`;
}

function ics(b) {
  const f = t => b.date.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Makhs//Booking//EL", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${b.id}@makhs`, `DTSTAMP:${Utilities.formatDate(new Date(), "UTC", "yyyyMMdd'T'HHmmss'Z'")}`,
    `DTSTART;TZID=Europe/Athens:${f(b.time)}`, `DTEND;TZID=Europe/Athens:${f(b.end)}`,
    `SUMMARY:${b.serviceName} · ${CONFIG.SHOP_NAME}`, `LOCATION:${CONFIG.SHOP_ADDRESS}`,
    `DESCRIPTION:Τηλ. ${CONFIG.SHOP_PHONE}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Ραντεβού στο κουρείο", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  return Utilities.newBlob(body, "text/calendar", "rantevou.ics");
}

/* ======================= CALENDAR ======================= */
function addToCalendar(b) {
  const ev = CalendarApp.getDefaultCalendar().createEvent(
    `💈 ${b.name} · ${b.serviceName}`, dateAt(b.date, b.time), dateAt(b.date, b.end),
    { description: `Τηλ: ${b.phone}\nEmail: ${b.email}${b.notes ? "\nΣημείωση: " + b.notes : ""}\nID: ${b.id}`, location: CONFIG.SHOP_ADDRESS });
  ev.setTag("makhsId", b.id);
}
function removeFromCalendar(id, dateStr) {
  const day = dateAt(dateStr, "00:00"), next = new Date(day.getTime() + 86400000);
  CalendarApp.getDefaultCalendar().getEvents(day, next).forEach(ev => { if (ev.getTag("makhsId") === id) ev.deleteEvent(); });
}

/* ======================= HELPERS ======================= */
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#0b0b0c").setFontColor("#c9a45c");
    sh.getRange("C:E").setNumberFormat("@"); // keep dates/times as plain text
  }
  return sh;
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function toMin(t) { const p = String(t).split(":"); return +p[0] * 60 + +p[1]; }
function toTime(m) { return ("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2); }
function dateAt(dateStr, time) { const d = dateStr.split("-").map(Number), t = time.split(":").map(Number); return new Date(d[0], d[1] - 1, d[2], t[0], t[1]); } // script timezone = Europe/Athens
function cellDate(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(v); }
function cellTime(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm") : String(v); }
function prettyDate(s) { const d = dateAt(s, "12:00"); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function simplePage(title, text) {
  return `<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:Helvetica,Arial;background:#0b0b0c;color:#fff;min-height:100vh;display:grid;place-items:center;text-align:center;padding:20px">
  <div><div style="font-size:34px;font-weight:900;letter-spacing:4px">MAKHS</div><h1 style="color:#c9a45c">${title}</h1><p style="color:#aaa">${text}</p></div></div>`;
}

/** Run once from the editor to grant permissions and create the sheet. */
function setup() {
  sheet();
  if (CONFIG.ADD_TO_CALENDAR) CalendarApp.getDefaultCalendar();
  MailApp.getRemainingDailyQuota();
  Logger.log("OK — sheet ready. Now Deploy → New deployment → Web app.");
}
