(function () {
  const DEFAULTS = {
    api_base: "/api/r2",
    public_base: "", // REQUIRED in config.yml (https://assets.deadframe.media)
    prefix: "uploads/",
    page_size: 60,
    images_only: true,
    max_bytes: 25 * 1024 * 1024, // 25MB
  };

  // --- Decap/GitHub auth (tuck API behind Decap login) ---
  function getDecapGithubToken() {
    const keys = ["decap-cms-user", "netlify-cms-user"];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const obj = JSON.parse(raw);

        const token =
          obj?.token?.access_token ||
          obj?.token ||
          obj?.access_token ||
          obj?.data?.token;

        if (typeof token === "string" && token.length > 20) return token;
      } catch {}
    }
    return "";
  }

  async function apiJsonAuthed(url, opts = {}) {
    const token = getDecapGithubToken();
    if (!token)
      throw new Error("Not logged into Decap. Open /admin and log in, then retry.");

    const headers = Object.assign({}, opts.headers || {}, {
      Authorization: `Bearer ${token}`,
    });

    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
    }
    return res.json();
  }

  // --- UI helpers ---
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function")
        n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach((c) =>
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    );
    return n;
  }

  function joinUrl(base, key) {
    return base.replace(/\/+$/, "") + "/" + key.replace(/^\/+/, "");
  }

  function sanitizeName(name) {
    return String(name || "file")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("Failed to read file"));
      r.readAsDataURL(file);
    });
  }

  function getGlobalR2Config() {
    try {
      const ml = window.CMS?.getConfig?.("media_library");
      const cfg =
        ml?.config || // plain object
        ml?.get?.("config") || // Immutable-ish
        {};
      return cfg;
    } catch {
      return {};
    }
  }

  async function init({ options = {}, handleInsert } = {}) {
    const globalCfg = getGlobalR2Config();
    const optionCfg = options?.config || {};
    const cfg = Object.assign({}, DEFAULTS, globalCfg, optionCfg, options || {});

    // If Decap passes nested config but we merged options afterward, ensure top-level wins
    if (!cfg.public_base && cfg.config?.public_base) cfg.public_base = cfg.config.public_base;
    if (!cfg.api_base && cfg.config?.api_base) cfg.api_base = cfg.config.api_base;
    if (!cfg.prefix && cfg.config?.prefix) cfg.prefix = cfg.config.prefix;

    if (!cfg.public_base) {
      throw new Error(
        "R2 media library requires config.public_base in config.yml (e.g. https://assets.deadframe.media)"
      );
    }

    // --- UI shell ---
    const overlay = el("div", {
      style: {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.72)",
        zIndex: "99999",
        display: "none",
      },
    });

    const panel = el("div", {
      style: {
        width: "min(1100px, 96vw)",
        height: "min(720px, 92vh)",
        margin: "4vh auto",
        background: "#0b0f14",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
      },
    });

    const header = el("div", {
      style: {
        padding: "12px 14px",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
      },
    });

    const title = el("div", { style: { color: "#e5e7eb", fontWeight: "650" } }, ["Media (R2)"]);
    const spacer = el("div", { style: { flex: "1" } });

    const search = el("input", {
      type: "search",
      placeholder: "Search keys…",
      style: {
        width: "min(360px, 40vw)",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0f172a",
        color: "#e5e7eb",
        outline: "none",
      },
    });

    const closeBtn = el(
      "button",
      {
        style: {
          padding: "10px 12px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "transparent",
          color: "#e5e7eb",
          cursor: "pointer",
        },
        onclick: () => hide(),
      },
      ["Close"]
    );

    header.appendChild(title);
    header.appendChild(spacer);
    header.appendChild(search);
    header.appendChild(closeBtn);

    const body = el("div", { style: { display: "flex", flex: "1", minHeight: "0" } });

    const left = el("div", {
      style: {
        width: "320px",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        padding: "14px",
        color: "#e5e7eb",
      },
    });

    const uploadLabel = el("div", { style: { fontWeight: "650", marginBottom: "10px" } }, ["Upload"]);
    const fileInput = el("input", { type: "file", multiple: true, style: { width: "100%" } });

    const prefixRow = el("div", { style: { marginTop: "12px" } }, [
      el("div", { style: { fontSize: "12px", opacity: "0.8", marginBottom: "6px" } }, ["Prefix (folder)"]),
    ]);

    const prefixInput = el("input", {
      value: cfg.prefix,
      style: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0f172a",
        color: "#e5e7eb",
        outline: "none",
      },
    });
    prefixRow.appendChild(prefixInput);

    const uploadBtn = el(
      "button",
      {
        style: {
          marginTop: "12px",
          width: "100%",
          padding: "10px 12px",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#111827",
          color: "#e5e7eb",
          cursor: "pointer",
        },
        onclick: async () => {
          const files = Array.from(fileInput.files || []);
          if (!files.length) return;

          uploadBtn.textContent = "Uploading…";
          uploadBtn.disabled = true;

          try {
            const prefix = (prefixInput.value || cfg.prefix || "").replace(/^\/+/, "");

            for (const f of files) {
              if (cfg.images_only && !(f.type || "").startsWith("image/")) {
                throw new Error(`Only images allowed (blocked: ${f.name})`);
              }
              if (cfg.max_bytes && f.size > cfg.max_bytes) {
                throw new Error(
                  `File too large: ${f.name} (${Math.round(f.size / 1024 / 1024)}MB)`
                );
              }

              const safeName = sanitizeName(f.name);
              const yyyyMm = new Date().toISOString().slice(0, 7);
              const key = `${prefix.replace(/\/?$/, "/")}${yyyyMm}/${Date.now()}-${safeName}`;

              const dataUrl = await fileToDataUrl(f);

              const out = await apiJsonAuthed(`${cfg.api_base}/upload`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  key,
                  contentType: f.type || "application/octet-stream",
                  dataUrl,
                }),
              });

              const insertedUrl = out?.publicUrl || joinUrl(cfg.public_base, key);

              // ✅ Always insert a single string (prevents Astro nested arrays)
              handleInsert(insertedUrl);

              // If Decap opened the picker in "single" mode, close after first insert.
              if (!allowMultiple) {
                hide();
                return;
              }
            }

            await loadFirstPage();
          } finally {
            uploadBtn.textContent = "Upload to R2";
            uploadBtn.disabled = false;
            fileInput.value = "";
          }
        },
      },
      ["Upload to R2"]
    );

    const hint = el(
      "div",
      { style: { marginTop: "12px", fontSize: "12px", opacity: "0.75", lineHeight: "1.4" } },
      [
        "Uploads go to R2 via your site API. URLs are generated from ",
        el("code", {}, ["public_base"]),
        " + key.",
      ]
    );

    left.appendChild(uploadLabel);
    left.appendChild(fileInput);
    left.appendChild(prefixRow);
    left.appendChild(prefixInput);
    left.appendChild(uploadBtn);
    left.appendChild(hint);

    const right = el("div", { style: { flex: "1", padding: "14px", overflow: "auto" } });

    const grid = el("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "12px",
      },
    });

    const footer = el("div", {
      style: {
        padding: "12px 14px",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        color: "#e5e7eb",
      },
    });

    function btnStyle() {
      return {
        padding: "10px 12px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "transparent",
        color: "#e5e7eb",
        cursor: "pointer",
      };
    }

    const prevBtn = el("button", { style: btnStyle(), onclick: () => loadPrev() }, ["Prev"]);
    const nextBtn = el("button", { style: btnStyle(), onclick: () => loadNext() }, ["Next"]);

    const insertBtn = el(
      "button",
      {
        style: Object.assign(btnStyle(), { background: "#111827" }),
        onclick: () => {
          if (!selected.length) return;

          const urls = selected.map((k) => joinUrl(cfg.public_base, k));

          // ✅ Critical: never pass [singleUrl] to Decap (causes nested arrays in list widgets).
          // If multiple are selected, insert them one-at-a-time.
          if (!allowMultiple) {
            handleInsert(urls[0]);
          } else {
            for (const u of urls) handleInsert(u);
          }

          hide();
        },
      },
      ["Insert"]
    );

    const delBtn = el(
      "button",
      {
        style: Object.assign(btnStyle(), { background: "transparent" }),
        onclick: async () => {
          if (!selected.length) return;
          if (!confirm(`Delete ${selected.length} file(s) from R2?`)) return;

          for (const key of selected) {
            await apiJsonAuthed(`${cfg.api_base}/delete`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ key }),
            });
          }

          selected = [];
          syncButtons();
          await loadFirstPage();
        },
      },
      ["Delete"]
    );

    const status = el("div", { style: { marginLeft: "auto", fontSize: "12px", opacity: "0.8" } }, [""]);

    footer.appendChild(prevBtn);
    footer.appendChild(nextBtn);
    footer.appendChild(insertBtn);
    footer.appendChild(delBtn);
    footer.appendChild(status);

    right.appendChild(grid);

    body.appendChild(left);
    body.appendChild(right);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // --- state ---
    let allowMultiple = true;
    let cursorStack = [];
    let cursor = null;
    let selected = [];

    function syncButtons() {
      insertBtn.disabled = selected.length === 0;
      delBtn.disabled = selected.length === 0;
    }

    async function loadPage(newCursor) {
      const q = search.value.trim();
      const prefix = prefixInput.value || cfg.prefix;

      status.textContent = "Loading…";
      grid.innerHTML = "";

      const params = new URLSearchParams();
      params.set("prefix", prefix);
      params.set("limit", String(cfg.page_size));
      if (q) params.set("q", q);
      if (newCursor) params.set("cursor", newCursor);

      const out = await apiJsonAuthed(`${cfg.api_base}/list?${params.toString()}`, { method: "GET" });
      cursor = out.cursor;
      status.textContent = `${out.objects.length} item(s)`;

      for (const obj of out.objects) {
        const key = obj.key;
        const url = joinUrl(cfg.public_base, key);

        const card = el("button", {
          style: {
            textAlign: "left",
            borderRadius: "14px",
            border: selected.includes(key)
              ? "2px solid rgba(255,255,255,0.55)"
              : "1px solid rgba(255,255,255,0.12)",
            background: "#0f172a",
            padding: "10px",
            color: "#e5e7eb",
            cursor: "pointer",
          },
          onclick: () => {
            if (!allowMultiple) selected = [];
            if (selected.includes(key)) selected = selected.filter((k) => k !== key);
            else selected.push(key);
            syncButtons();
            loadPageVisualOnly(out.objects);
          },
        });

        const isImg = /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(key);
        const thumb = isImg
          ? el("img", {
              src: url,
              style: { width: "100%", height: "110px", objectFit: "cover", borderRadius: "10px", display: "block" },
            })
          : el(
              "div",
              {
                style: {
                  width: "100%",
                  height: "110px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  opacity: "0.85",
                },
              },
              ["FILE"]
            );

        const meta = el("div", { style: { marginTop: "8px", fontSize: "12px", opacity: "0.85" } }, [
          key.replace(prefix, ""),
        ]);

        card.appendChild(thumb);
        card.appendChild(meta);
        grid.appendChild(card);
      }

      syncButtons();
    }

    function loadPageVisualOnly(objects) {
      Array.from(grid.children).forEach((child, i) => {
        const key = objects[i]?.key;
        if (!key) return;
        child.style.border = selected.includes(key)
          ? "2px solid rgba(255,255,255,0.55)"
          : "1px solid rgba(255,255,255,0.12)";
      });
    }

    async function loadFirstPage() {
      cursorStack = [];
      cursor = null;
      await loadPage(null);
    }

    async function loadNext() {
      if (!cursor) return;
      cursorStack.push(cursor);
      await loadPage(cursor);
    }

    async function loadPrev() {
      if (cursorStack.length <= 1) {
        cursorStack = [];
        await loadPage(null);
        return;
      }
      cursorStack.pop();
      const prevCursor = cursorStack[cursorStack.length - 1] || null;
      await loadPage(prevCursor);
    }

    let searchTimer = null;
    search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadFirstPage(), 250);
    });

    function show({ allowMultiple: am } = {}) {
      allowMultiple = am !== false;
      selected = [];
      syncButtons();
      overlay.style.display = "block";
      return loadFirstPage();
    }

    function hide() {
      overlay.style.display = "none";
    }

    return { show, hide, enableStandalone: () => true };
  }

  const r2MediaLibrary = { name: "r2", init };

  function tryRegister() {
    if (window.CMS && typeof window.CMS.registerMediaLibrary === "function") {
      window.CMS.registerMediaLibrary(r2MediaLibrary);
      return true;
    }
    return false;
  }

  if (!tryRegister()) {
    const t = setInterval(() => {
      if (tryRegister()) clearInterval(t);
    }, 50);
    setTimeout(() => clearInterval(t), 10000);
  }
})();
