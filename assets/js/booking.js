/* MAKHS BARBER SHOP — online booking
   Talks to the Google Apps Script backend (backend/Code.gs) when
   SITE_CONFIG.bookingApiUrl is set; otherwise runs in demo mode. */
(() => {
  const C = window.SITE_CONFIG;
  const API = (C.bookingApiUrl || "").trim();
  const DEMO = !API;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
  const MONTHS_GEN = ["Ιανουαρίου", "Φεβρουαρίου", "Μαρτίου", "Απριλίου", "Μαΐου", "Ιουνίου", "Ιουλίου", "Αυγούστου", "Σεπτεμβρίου", "Οκτωβρίου", "Νοεμβρίου", "Δεκεμβρίου"];
  const DAYS = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTime = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const prettyDate = d => `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;

  const state = { service: null, date: null, time: null, view: null, step: 1, reqId: 0 };
  const today = startOfDay(new Date());
  const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() + C.booking.daysAhead);
  state.view = new Date(today.getFullYear(), today.getMonth(), 1);

  if (DEMO) $("#demoNote").hidden = false;

  /* ---------- steps ---------- */
  function go(step) {
    state.step = step;
    $$(".pane").forEach(p => p.classList.toggle("is-active", +p.dataset.pane === step));
    $$(".steps li").forEach(li => {
      const s = +li.dataset.step;
      li.classList.toggle("is-active", s === step);
      li.classList.toggle("is-done", s < step);
    });
    if (step === 3) renderSummary();
  }
  $$("[data-back]").forEach(b => b.addEventListener("click", () => go(state.step - 1)));
  $$(".steps li").forEach(li => li.addEventListener("click", () => { if (+li.dataset.step < state.step && state.step < 4) go(+li.dataset.step); }));

  /* ---------- step 1: services ---------- */
  $("#svcPick").innerHTML = C.services.map(s => `
    <button type="button" class="svc-opt" data-id="${s.id}">
      <b>${s.name}</b><small><span>◷ ${s.duration}′</span><em>${s.price}€</em></small>
    </button>`).join("");
  function selectService(id) {
    const s = C.services.find(x => x.id === id); if (!s) return;
    state.service = s; state.time = null;
    $$(".svc-opt").forEach(b => b.classList.toggle("is-selected", b.dataset.id === id));
    if (!state.date) state.date = firstOpenDay();
    renderCal(); loadSlots();
    go(2);
  }
  $$(".svc-opt").forEach(b => b.addEventListener("click", () => selectService(b.dataset.id)));
  window.MakhsBooking = { selectService };

  /* ---------- step 2: calendar ---------- */
  const isOpenDay = d => (C.hours[d.getDay()] || []).length > 0;
  function firstOpenDay() {
    for (let d = new Date(today); d <= lastDay; d.setDate(d.getDate() + 1)) {
      if (isOpenDay(d) && daySlots(d, []).length) return new Date(d);
    }
    return null;
  }
  function renderCal() {
    const v = state.view, y = v.getFullYear(), m = v.getMonth();
    $("#calTitle").textContent = `${MONTHS[m]} ${y}`;
    $("#calPrev").disabled = y === today.getFullYear() && m === today.getMonth();
    $("#calNext").disabled = new Date(y, m + 1, 1) > lastDay;
    const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    const days = new Date(y, m + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < offset; i++) html += `<span class="day day--blank"></span>`;
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d);
      const ok = date >= today && date <= lastDay && isOpenDay(date) && !(+date === +today && daySlots(date, []).length === 0);
      const cls = ["day", +date === +today ? "is-today" : "", state.date && +date === +state.date ? "is-selected" : ""].join(" ");
      html += `<button type="button" class="${cls}" data-date="${ymd(date)}" ${ok ? "" : "disabled"}>${d}</button>`;
    }
    $("#calGrid").innerHTML = html;
    $$("#calGrid .day:not(:disabled)").forEach(b => b.addEventListener("click", () => {
      const [yy, mm, dd] = b.dataset.date.split("-").map(Number);
      state.date = new Date(yy, mm - 1, dd); state.time = null;
      renderCal(); loadSlots();
    }));
  }
  $("#calPrev").addEventListener("click", () => { state.view.setMonth(state.view.getMonth() - 1); renderCal(); });
  $("#calNext").addEventListener("click", () => { state.view.setMonth(state.view.getMonth() + 1); renderCal(); });

  /* slots for a date given busy intervals [{start,end}] */
  function daySlots(date, busy) {
    const dur = state.service ? state.service.duration : 30;
    const step = C.booking.slotStep;
    const now = new Date();
    const isToday = +startOfDay(date) === +today;
    const minStart = isToday ? now.getHours() * 60 + now.getMinutes() + C.booking.minLeadMinutes : -1;
    const busyM = busy.map(b => [toMin(b.start), toMin(b.end)]);
    const out = [];
    (C.hours[date.getDay()] || []).forEach(([a, b], ri) => {
      for (let t = toMin(a); t + dur <= toMin(b); t += step) {
        if (t < minStart) continue;
        if (busyM.some(([s, e]) => t < e && t + dur > s)) continue;
        out.push({ t: toTime(t), range: ri });
      }
    });
    return out;
  }

  async function fetchBusy(dateStr) {
    if (DEMO) {
      return demoStore().filter(b => b.date === dateStr).map(b => ({ start: b.time, end: b.end }));
    }
    const res = await fetch(`${API}?action=availability&date=${dateStr}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "availability");
    return data.busy || [];
  }

  async function loadSlots() {
    const grid = $("#slotsGrid");
    if (!state.date) { $("#slotsTitle").textContent = "Δεν υπάρχουν διαθέσιμες ημέρες"; grid.innerHTML = ""; return; }
    if (state.date.getMonth() !== state.view.getMonth()) { state.view = new Date(state.date.getFullYear(), state.date.getMonth(), 1); renderCal(); }
    $("#slotsTitle").textContent = prettyDate(state.date);
    grid.innerHTML = Array(8).fill('<div class="skeleton"></div>').join("");
    const id = ++state.reqId;
    let busy = [];
    try { busy = await fetchBusy(ymd(state.date)); }
    catch (e) {
      if (id !== state.reqId) return;
      grid.innerHTML = `<p class="muted small">Δεν ήταν δυνατή η φόρτωση των διαθέσιμων ωρών. Δοκίμασε ξανά ή κάλεσε στο <a href="tel:${C.shop.phoneIntl}" class="gold">${C.shop.phone}</a>.</p>`;
      return;
    }
    if (id !== state.reqId) return;
    const slots = daySlots(state.date, busy);
    if (!slots.length) { grid.innerHTML = `<p class="muted small">Δεν υπάρχουν ελεύθερες ώρες αυτή τη μέρα. Διάλεξε άλλη ημέρα.</p>`; return; }
    const ranges = C.hours[state.date.getDay()];
    let html = "", lastRange = -1;
    slots.forEach(s => {
      if (ranges.length > 1 && s.range !== lastRange) { html += `<span class="slots__label">${s.range === 0 ? "Πρωί" : "Απόγευμα"}</span>`; lastRange = s.range; }
      html += `<button type="button" class="slot" data-time="${s.t}">${s.t}</button>`;
    });
    grid.innerHTML = html;
    $$(".slot", grid).forEach(b => b.addEventListener("click", () => {
      state.time = b.dataset.time;
      $$(".slot", grid).forEach(x => x.classList.toggle("is-selected", x === b));
      setTimeout(() => go(3), 220);
    }));
  }

  /* ---------- step 3: details ---------- */
  function renderSummary() {
    const s = state.service;
    const end = toTime(toMin(state.time) + s.duration);
    $("#summary").innerHTML = `
      <div><small>Υπηρεσία</small><b>${s.name}</b></div>
      <div><small>Ημέρα</small><b>${prettyDate(state.date)}</b></div>
      <div><small>Ώρα</small><b>${state.time}–${end}</b></div>
      <div><small>Τιμή</small><b class="gold">${s.price}€</b></div>`;
    setTimeout(() => $("#fName").focus({ preventScroll: true }), 300);
  }

  const form = $("#bookingForm"), err = $("#formError"), btn = $("#submitBtn");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    err.textContent = "";
    $$(".field", form).forEach(f => f.classList.remove("is-invalid"));
    const v = Object.fromEntries(new FormData(form));
    const bad = [];
    if ((v.name || "").trim().length < 3) bad.push("fName");
    if (!/^[+\d][\d\s-]{8,}$/.test((v.phone || "").trim())) bad.push("fPhone");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v.email || "").trim())) bad.push("fEmail");
    if (bad.length) {
      bad.forEach(id => $("#" + id).parentElement.classList.add("is-invalid"));
      err.textContent = "Συμπλήρωσε σωστά όνομα, κινητό και email.";
      return;
    }
    const payload = {
      action: "book",
      service: state.service.id,
      date: ymd(state.date),
      time: state.time,
      name: v.name.trim(), phone: v.phone.trim(), email: v.email.trim(), notes: (v.notes || "").trim(),
      website: v.website || "" // honeypot
    };
    btn.disabled = true; btn.textContent = "Αποστολή…";
    try {
      const result = DEMO ? demoBook(payload) : await (await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight with Apps Script
        body: JSON.stringify(payload)
      })).json();
      if (!result.ok) {
        if (result.error === "slot_taken") {
          err.textContent = "Αυτή η ώρα μόλις κλείστηκε από άλλον πελάτη. Διάλεξε άλλη ώρα.";
          setTimeout(() => { go(2); loadSlots(); }, 1600);
        } else err.textContent = result.message || "Κάτι πήγε στραβά. Δοκίμασε ξανά ή κάλεσέ μας.";
        return;
      }
      done(payload);
    } catch (ex) {
      err.textContent = `Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά ή κάλεσε στο ${C.shop.phone}.`;
    } finally {
      btn.disabled = false; btn.textContent = "Επιβεβαίωση ραντεβού";
    }
  });

  function done(p) {
    const s = state.service, end = toTime(toMin(p.time) + s.duration);
    $("#doneText").innerHTML = DEMO
      ? `<b>${s.name}</b>, ${prettyDate(state.date)} στις <b>${p.time}</b>.<br>(Λειτουργία επίδειξης: όταν συνδεθεί το email του κουρείου, εδώ θα σταλεί αυτόματα επιβεβαίωση στο <b>${p.email}</b> και ειδοποίηση στον Μάκη.)`
      : `<b>${s.name}</b>, ${prettyDate(state.date)} στις <b>${p.time}</b>.<br>Στείλαμε επιβεβαίωση στο <b>${p.email}</b>. Τα λέμε σύντομα!`;
    const dt = t => p.date.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
    $("#gcalLink").href = "https://calendar.google.com/calendar/render?action=TEMPLATE"
      + `&text=${encodeURIComponent(`${s.name} · ${C.shop.fullName}`)}`
      + `&dates=${dt(p.time)}/${dt(end)}&ctz=Europe/Athens`
      + `&location=${encodeURIComponent(C.shop.address)}`
      + `&details=${encodeURIComponent(`Τηλ. ${C.shop.phone}`)}`;
    form.reset();
    go(4);
  }
  $("#newBooking").addEventListener("click", () => {
    state.service = null; state.time = null;
    $$(".svc-opt").forEach(b => b.classList.remove("is-selected"));
    go(1);
  });

  /* ---------- demo store ---------- */
  function demoStore() { try { return JSON.parse(localStorage.getItem("makhs-demo-bookings") || "[]"); } catch { return []; } }
  function demoBook(p) {
    const s = C.services.find(x => x.id === p.service);
    const end = toTime(toMin(p.time) + s.duration);
    const list = demoStore();
    if (list.some(b => b.date === p.date && toMin(p.time) < toMin(b.end) && toMin(end) > toMin(b.time))) return { ok: false, error: "slot_taken" };
    list.push({ date: p.date, time: p.time, end });
    try { localStorage.setItem("makhs-demo-bookings", JSON.stringify(list)); } catch {}
    return { ok: true, id: "DEMO" };
  }

  renderCal();
})();
