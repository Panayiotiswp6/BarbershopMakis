/* MAKHS BARBER SHOP — UI, effects */
(() => {
  const C = window.SITE_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const euro = n => `${n}€`;

  /* ---------- SPLASH ---------- */
  const splash = $("#splash");
  let splashDone = false;
  const CUT_MS = 450, OPEN_MS = 800;
  function reveal() {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
  }
  function openSplash() {
    if (splashDone) return; splashDone = true;
    if (reduced) { reveal(); splash.classList.add("is-gone"); return; }
    // cut exactly through the middle of the letters
    const w = $(".splash__word", splash).getBoundingClientRect();
    if (w.height) splash.style.setProperty("--cut", `${((w.top + w.height * 0.52) / splash.offsetHeight * 100).toFixed(2)}%`);
    splash.classList.add("is-cutting");
    setTimeout(() => {
      // the blade has cut the logo: give each half its own copy so the logo leaves WITH the screen
      const content = $(".splash__content", splash), h = splash.offsetHeight;
      ["top", "bottom"].forEach(side => {
        const ghost = document.createElement("div");
        ghost.className = `splash__ghost splash__ghost--${side}`;
        ghost.style.height = h + "px";
        const copy = content.cloneNode(true);
        copy.classList.add("splash__content--ghost");
        ghost.appendChild(copy);
        $(`.splash__half--${side}`, splash).appendChild(ghost);
      });
      splash.classList.add("is-open");
      reveal();
    }, CUT_MS);
    setTimeout(() => splash.classList.add("is-gone"), CUT_MS + OPEN_MS + 50);
  }
  const seen = (() => { try { return sessionStorage.getItem("makhs-splash"); } catch { return null; } })();
  const splashDelay = reduced ? 0 : (seen ? 450 : 1250);
  try { sessionStorage.setItem("makhs-splash", "1"); } catch {}
  // open as soon as fonts + hero image are ready (don't wait for the map iframe)
  const heroImg = document.querySelector(".hero__media img");
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    heroImg && !heroImg.complete ? new Promise(r => { heroImg.onload = heroImg.onerror = r; }) : Promise.resolve()
  ]).then(() => setTimeout(openSplash, splashDelay));
  setTimeout(openSplash, 3500); // safety net on slow connections
  $(".splash__skip").addEventListener("click", openSplash);
  splash.addEventListener("click", openSplash);

  /* ---------- NAV ---------- */
  const nav = $("#nav"), burger = $("#burger"), mbar = $(".mbar");
  let lastY = 0, inBooking = false;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > lastY && y > 500 && !nav.classList.contains("is-open"));
    mbar && mbar.classList.toggle("is-visible", y > innerHeight * 0.7 && !inBooking);
    lastY = y;
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // the sticky "book" bar is pointless (and covers the form) while the visitor is already booking
  if ("IntersectionObserver" in window) new IntersectionObserver(en => { inBooking = en[0].isIntersecting; onScroll(); }, { rootMargin: "-30% 0px -30% 0px" }).observe($("#booking"));
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  $$("#navLinks a").forEach(a => a.addEventListener("click", () => {
    nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); document.body.style.overflow = "";
  }));

  /* ---------- CONTENT FROM CONFIG ---------- */
  $("#heroPrices").innerHTML = C.services.map(s => `<li><span>${s.name}</span><b>${euro(s.price)}</b></li>`).join("");
  $("#servicesGrid").innerHTML = C.services.map((s, i) => `
    <article class="svc reveal" style="--d:${(i % 3) * 0.08}s">
      <span class="svc__num">${String(i + 1).padStart(2, "0")}</span>
      <div class="svc__top"><h3>${s.name}</h3><span class="svc__price">${euro(s.price)}</span></div>
      <span class="svc__dur">◷ ${s.duration} λεπτά</span>
      <p>${s.desc}</p>
      <button class="svc__book" type="button" data-book="${s.id}">Κλείσε <span>→</span></button>
    </article>`).join("");
  $$("[data-book]").forEach(b => b.addEventListener("click", () => {
    window.MakhsBooking && window.MakhsBooking.selectService(b.dataset.book);
    $("#booking").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }));
  $("#year").textContent = new Date().getFullYear();
  if (C.shop.facebook) $("#fbLink").href = C.shop.facebook;

  /* hours + open now */
  const dayNames = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
  const now = new Date(), today = now.getDay();
  $("#hoursTable").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const h = C.hours[d];
    const txt = h.length ? h.map(([a, b]) => `${a}–${b}`).join(" · ") : "Κλειστά";
    return `<tr class="${d === today ? "is-today" : ""}"><td>${dayNames[d]}</td><td>${txt}</td></tr>`;
  }).join("");
  const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const nowM = now.getHours() * 60 + now.getMinutes();
  const openRange = (C.hours[today] || []).find(([a, b]) => nowM >= mins(a) && nowM < mins(b));
  const openEl = $("#openNow");
  if (openRange) { openEl.textContent = `Ανοιχτά τώρα · έως ${openRange[1]}`; openEl.classList.add("is-open"); }
  else {
    let next = null;
    for (let i = 0; i < 8 && !next; i++) {
      const d = (today + i) % 7;
      const r = (C.hours[d] || []).find(([a]) => i > 0 || mins(a) > nowM);
      if (r) next = { d, i, t: r[0] };
    }
    openEl.textContent = next ? `Κλειστά · ανοίγει ${next.i === 0 ? "σήμερα" : next.i === 1 ? "αύριο" : dayNames[next.d]} ${next.t}` : "Κλειστά";
    openEl.classList.add("is-closed");
  }

  /* ---------- REVEAL ON SCROLL ---------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }), { threshold: 0.14, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el, i) => {
    if (!el.style.getPropertyValue("--d") && el.parentElement.classList.contains("gallery")) el.style.setProperty("--d", `${(i % 4) * 0.07}s`);
    io.observe(el);
  });

  /* counters */
  const cio = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, dec = +(el.dataset.decimals || 0), suf = el.dataset.suffix || "";
    const t0 = performance.now(), dur = reduced ? 1 : 1600;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), v = end * (1 - Math.pow(1 - p, 4));
      el.textContent = v.toFixed(dec).replace(".", ",") + (p === 1 ? suf : "");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step); cio.unobserve(el);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach(el => cio.observe(el));

  /* ---------- PARALLAX ---------- */
  const par = $$("[data-parallax]");
  if (!reduced && par.length) {
    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        par.forEach(el => { if (scrollY < innerHeight * 1.2) el.style.transform = `translate3d(0, ${scrollY * el.dataset.parallax}px, 0)`; });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- TILT ---------- */
  if (!reduced && matchMedia("(hover: hover)").matches) {
    $$("[data-tilt]").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
      });
      el.addEventListener("mouseleave", () => el.style.transform = "");
    });
    /* magnetic buttons */
    $$(".magnetic").forEach(el => {
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .3}px)`;
      });
      el.addEventListener("mouseleave", () => el.style.transform = "");
    });
  }

  /* ---------- LIGHTBOX ---------- */
  const lb = $("#lightbox"), lbImg = $("img", lb), figs = $$(".g img");
  let idx = 0;
  const show = i => { idx = (i + figs.length) % figs.length; lbImg.src = figs[idx].src; lbImg.alt = figs[idx].alt; };
  figs.forEach((img, i) => img.parentElement.addEventListener("click", () => { show(i); lb.hidden = false; document.body.style.overflow = "hidden"; }));
  const close = () => { lb.hidden = true; document.body.style.overflow = ""; };
  $(".lightbox__close").addEventListener("click", close);
  $(".lightbox__prev").addEventListener("click", e => { e.stopPropagation(); show(idx - 1); });
  $(".lightbox__next").addEventListener("click", e => { e.stopPropagation(); show(idx + 1); });
  lb.addEventListener("click", e => { if (e.target === lb) close(); });
  addEventListener("keydown", e => {
    if (lb.hidden) return;
    if (e.key === "Escape") close(); if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1);
  });
})();
