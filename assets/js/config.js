/* ============================================================
   MAKHS BARBER SHOP — ρυθμίσεις ιστοσελίδας
   Αλλάξτε εδώ τιμές, υπηρεσίες, ωράριο και σύνδεση κρατήσεων.
   ============================================================ */
window.SITE_CONFIG = {
  shop: {
    name: "Makhs",
    fullName: "Makhs Barber Shop",
    barber: "Μάκης",
    address: "Παπάγου 92, Ζωγράφου 157 72",
    phone: "210 775 9949",
    phoneIntl: "+302107759949",
    facebook: "https://www.facebook.com/",          // TODO: βάλτε το ακριβές link της σελίδας
    googleMaps: "https://maps.app.goo.gl/zYNihV4hXrfXu4hx6",
    googleReviews: "https://maps.app.goo.gl/zYNihV4hXrfXu4hx6",
    rating: 5.0,
    reviews: 140,
    mapEmbedQuery: "Makhs, Παπάγου 92, Ζωγράφου 157 72"
  },

  /* URL του Google Apps Script (δείτε README → «Ενεργοποίηση κρατήσεων»).
     Όσο είναι κενό, οι κρατήσεις τρέχουν σε DEMO λειτουργία (αποθηκεύονται μόνο στον browser). */
  bookingApiUrl: "https://script.google.com/macros/s/AKfycbzcvxLF0GD2xp6uVc08Pw9QmZZSQll5SyOK17pcowMcf7dmCKlKPExJ92Sa_l-d-nA/exec",

  /* Υπηρεσίες — ΟΙ ΤΙΜΕΣ ΕΙΝΑΙ ΕΝΔΕΙΚΤΙΚΕΣ, επιβεβαιώστε με τον ιδιοκτήτη.
     Το id και η διάρκεια πρέπει να ταιριάζουν με το backend/Code.gs */
  services: [
    { id: "haircut",   name: "Ανδρικό κούρεμα",      price: 11, duration: 30, desc: "Κούρεμα με ψαλίδι ή μηχανή, λούσιμο και styling, προσαρμοσμένο στο πρόσωπό σου." },
    { id: "fade",      name: "Skin fade / σχέδια",   price: 13, duration: 40, desc: "Καθαρό fade μέχρι το δέρμα, λεπτομερές blending και σχέδια με ξυράφι." },
    { id: "combo",     name: "Κούρεμα & γένια",      price: 16, duration: 50, desc: "Το πλήρες πακέτο: κούρεμα, σχήμα γενειάδας και ζεστή πετσέτα." },
    { id: "beard",     name: "Περιποίηση γενειάδας", price: 7,  duration: 20, desc: "Σχήμα, γραμμές με ξυράφι, λάδι και balm για γενειάδα που κάθεται τέλεια." },
    { id: "shave",     name: "Ξύρισμα με ζεστή πετσέτα", price: 9, duration: 30, desc: "Παραδοσιακό ξύρισμα με ξυράφι, ζεστή πετσέτα και after-shave." },
    { id: "kids",      name: "Παιδικό κούρεμα",      price: 10, duration: 30, desc: "Για παιδιά έως 12 ετών, με υπομονή και χαμόγελο." }
  ],

  /* Ωράριο (0 = Κυριακή … 6 = Σάββατο). Από Google Maps. */
  hours: {
    0: [],
    1: [["09:00", "15:00"]],
    2: [["09:00", "14:00"], ["17:00", "21:00"]],
    3: [["09:00", "15:00"]],
    4: [["09:00", "14:00"], ["17:00", "21:00"]],
    5: [["09:00", "14:00"], ["17:00", "21:00"]],
    6: [["09:00", "15:00"]]
  },

  booking: {
    slotStep: 15,          // λεπτά ανάμεσα στις διαθέσιμες ώρες
    daysAhead: 30,         // πόσες μέρες μπροστά επιτρέπονται κρατήσεις
    minLeadMinutes: 60     // ελάχιστος χρόνος πριν το ραντεβού
  }
};
