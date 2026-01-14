# MAX-MEDIA (DeadFrame)

A modern, cinematic portfolio site built with **Astro**, designed for film & photography work with an **indie horror / festival screener** aesthetic.

The site is fully content-managed via **Decap CMS**, deployed on **Cloudflare Pages**, and uses **Cloudflare R2** for media storage.

---

## ✨ Features

- ⚡ **Astro** static site (fast, SEO-friendly, minimal JS)
- 🎬 Film & photo collections with dynamic routes
- 🩸 Indie horror–inspired UI (film grain, restrained contrast, cinematic spacing)
- 🧑‍💼 **Decap CMS** admin for non-technical editing
- ☁️ **Cloudflare R2** for image uploads (no vendor lock-in)
- 📱 Fully responsive (mobile-first)
- 🔐 Admin-only upload + editing workflow

---

## 📁 Project Structure

```
.
├── functions/
│   └── api/
│       ├── upload.js
│       └── callback.js
├── public/
│   ├── admin/
│   │   ├── config.yml
│   │   └── r2-media-library.js
│   ├── favicon.svg
│   └── global.css
├── src/
│   ├── components/
│   ├── content/
│   │   ├── films/
│   │   ├── photos/
│   │   └── pages/
│   │       └── about.md
│   ├── layouts/
│   │   └── Base.astro
│   ├── pages/
│   │   ├── film/
│   │   ├── photo/
│   │   ├── about.astro
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── astro.config.mjs
└── README.md
```

---

## ✍️ Content Editing

The admin panel is available at `/admin` and allows editing of pages, films, photos, and media assets.

The About page is powered by `src/content/pages/about.md` and supports:
- Kicker
- Headline
- Bio
- Headshot (R2 upload)
- Social links (icon-based)
- Markdown body content

---

## 🚀 Local Development

```
npm install
npm run dev
```

Visit `http://localhost:4321`

---

## 🌐 Deployment

Designed for **Cloudflare Pages** with Functions and R2.

Build command:
```
npm run build
```

Output directory:
```
dist
```

---

## 🎨 Design Philosophy

Minimal UI, maximal atmosphere.
Built to feel like a director’s notebook — not a dashboard.

---

## 📄 License

Private / Portfolio use.
All media © their respective owners.
