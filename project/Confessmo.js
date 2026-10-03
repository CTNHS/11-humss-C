/*
 * ConfessMo — static browser edition.
 * No credentials, framework, build step, or account required.
 * Posts/reactions/drafts persist on this browser only. See README.md for scope.
 * User content is always inserted with textContent, never interpreted as HTML.
 */
(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];
  const KEYS = {
    state: "confessmo.wall.v2",
    draft: "confessmo.draft.v2",
    motion: "confessmo.motion.v2",
  };
  const MOODS = {
    crush: { label: "A little crush", icon: "heart", color: "#c7967b" },
    gratitude: { label: "Thankful", icon: "spark", color: "#b9b18b" },
    unsent: { label: "Unsent", icon: "up-right", color: "#baa48f" },
    heartbreak: { label: "Heartache", icon: "crescent", color: "#be9f9b" },
    life: { label: "Just life", icon: "sun", color: "#ccae76" },
  };

  // Card/export-only palettes. These do not change the rest of the website.
  const EXPORT_THEMES = {
    blush: {
      label: "Blush",
      bg: "#F9E8EE",
      panel: "#FFFBFD",
      ink: "#553A45",
      soft: "#F0B8C9",
      accent: "#D98FA8",
      tint: "#F5DDE6",
    },
    peach: {
      label: "Peach",
      bg: "#FCE9DC",
      panel: "#FFF9F4",
      ink: "#5A4034",
      soft: "#F2B991",
      accent: "#DF9468",
      tint: "#F8DCC9",
    },
    sky: {
      label: "Sky",
      bg: "#E8F2FB",
      panel: "#FBFDFF",
      ink: "#344A5F",
      soft: "#B9D7EE",
      accent: "#7FAED1",
      tint: "#D9EAF7",
    },
    matcha: {
      label: "Matcha",
      bg: "#EEF6DF",
      panel: "#FCFFF7",
      ink: "#43513A",
      soft: "#CFE1A6",
      accent: "#9EBB72",
      tint: "#E3F0C9",
    },
    lilac: {
      label: "Lilac",
      bg: "#F0EAF8",
      panel: "#FDFBFF",
      ink: "#4D405B",
      soft: "#D4C2E6",
      accent: "#AC8FC9",
      tint: "#E8DDF3",
    },
    cream: {
      label: "Cream",
      bg: "#F8F0E1",
      panel: "#FFFCF6",
      ink: "#514334",
      soft: "#E8CEA1",
      accent: "#C79C68",
      tint: "#F3E5CA",
    },
    champagne: {
      label: "Champagne",
      bg: "#F6EDD8",
      panel: "#FFFBF2",
      ink: "#4F4130",
      soft: "#E6D3A8",
      accent: "#B8935A",
      tint: "#F1E4C4",
    },
    pearl: {
      label: "Pearl",
      bg: "#EEECF3",
      panel: "#FDFDFF",
      ink: "#43404F",
      soft: "#DAD6E6",
      accent: "#9A93B5",
      tint: "#E6E3EF",
    },
    rosegold: {
      label: "Rose gold",
      bg: "#F8E7E1",
      panel: "#FFFAF8",
      ink: "#58403B",
      soft: "#E3A99B",
      accent: "#C98577",
      tint: "#F3D5CC",
    },
  };
  const DEFAULT_THEME_BY_MOOD = {
    crush: "blush",
    gratitude: "matcha",
    unsent: "sky",
    heartbreak: "lilac",
    life: "cream",
  };
  const asset = (key, path) => (window.CONFESSMO_ASSETS && window.CONFESSMO_ASSETS[key]) || path;
  const CHARACTER_STICKERS = {
    chiikawa: {
      label: "Chiikawa",
      src: asset("chiikawa", "assets/chiikawa.jpg"),
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    usagi: {
      label: "Usagi",
      src: asset("usagi", "assets/usagi.webp"),
      // Crop the lower text area while keeping the supplied art untouched.
      crop: { x: 0.08, y: 0.03, width: 0.84, height: 0.77 },
    },
    hachiware: {
      label: "Hachiware",
      src: asset("hachiware", "assets/hachiware.jpg"),
      crop: { x: 0.06, y: 0.03, width: 0.88, height: 0.78 },
    },
  };
  const CHARACTER_ORDER = ["chiikawa", "usagi", "hachiware"];
  const CARD_DESIGNS = ["classic", "polaroid", "kawaii", "vinyl", "midnight", "editorial", "glass", "silk", "maison", "velvet"];
  const DESIGN_LABELS = { classic: "Letterpress", polaroid: "Gallery", kawaii: "Cloud Couture", vinyl: "Record Atelier", midnight: "Nocturne", editorial: "Editorial", glass: "Glass House", silk: "Silk", maison: "Maison Gold", velvet: "Velvet Rouge" };
  const MUSIC_STYLES = ["vinyl", "box", "text", "none"];
  const MEDIA_DB_NAME = "confessmo-media-v1";
  const MEDIA_STORE = "photos";
  const MAX_SOURCE_PHOTO_BYTES = 4 * 1024 * 1024;
  let selectedPhotoBlob = null;
  let selectedPhotoUrl = "";
  // Curated suggestions, not live Spotify search results. No lyrics or album art are copied.
  const SONGS = [
    { title: "Pasilyo", artist: "SunKissed Lola", color: "#b8997f" },
    { title: "Tingin", artist: "Cup of Joe, Janine Teñoso", color: "#8f9981" },
    { title: "Bawat Piyesa", artist: "Munimuni", color: "#a29078" },
    { title: "About You", artist: "The 1975", color: "#8c8882" },
    { title: "Leaves", artist: "Ben&Ben", color: "#9ca58a" },
    { title: "Araw-Araw", artist: "Ben&Ben", color: "#c5a573" },
    { title: "Sparks", artist: "Coldplay", color: "#a89a8f" },
    { title: "Sining", artist: "Dionela, Jay R", color: "#b88c78" },
  ].map((song) => ({ ...song, url: "" }));
  const EXAMPLES = [
    {
      id: "example-1",
      to: "my favorite notification",
      mood: "crush",
      message:
        "You made me feel like i was worth loving, Only to become the reason I started believing I wasn't.",
      song: SONGS[0],
    },
    {
      id: "example-2",
      to: "the friend who stayed",
      mood: "gratitude",
      message:
        "You never needed the whole story to sit beside me. Thank you for making quiet feel less lonely.",
      song: SONGS[4],
    },
    {
      id: "example-3",
      to: "a version of us",
      mood: "unsent",
      message:
        "I still have things to tell you. These days, I tell them to the sky instead.",
      song: SONGS[3],
    },
    {
      id: "example-4",
      to: "my future self",
      mood: "life",
      message:
        "Sana proud ka sa atin. Kahit mabagal, kahit hindi sigurado, tinuloy pa rin natin.",
      song: null,
    },
    {
      id: "example-5",
      to: "someone I’m learning to miss",
      mood: "heartbreak",
      message:
        "Some days, moving on is a big brave thing. Today, it was just not checking my phone.",
      song: SONGS[2],
    },
    {
      id: "example-6",
      to: "the person across the room",
      mood: "crush",
      message:
        "You probably didn’t notice. But that ordinary Tuesday became my favorite part of the week.",
      song: SONGS[1],
    },
  ].map((note, index) => ({ ...note, example: true, createdAt: 6 - index }));
  const form = $("#confessionForm");
  const textarea = $("#confessionText");
  const recipient = $("#recipient");
  const grid = $("#confessionGrid");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let state = emptyState();
  let selectedSong = null;
  let view = "all";
  let moodFilter = "all";
  let paused = false;
  let sending = false;
  let draftDirty = false;
  let draftTimer;
  let toastTimer;
  let searchTimer;
  let pendingDelete = null;

  function emptyState() {
    return { version: 2, posts: [], hearts: [], saved: [] };
  }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#i-${name}`);
    svg.append(use);
    return svg;
  }

  let mediaDbPromise = null;
  function openMediaDb() {
    if (mediaDbPromise) return mediaDbPromise;
    mediaDbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(MEDIA_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE))
          db.createObjectStore(MEDIA_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          mediaDbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("Media storage unavailable"));
    });
    mediaDbPromise.catch(() => {
      mediaDbPromise = null;
    });
    return mediaDbPromise;
  }

  async function mediaStorePut(id, blob) {
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        reject(tx.error || new Error("Photo could not be stored"));
      };
    });
  }

  async function mediaStoreGet(id) {
    try {
      const db = await openMediaDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readonly");
        const request = tx.objectStore(MEDIA_STORE).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async function mediaStoreDelete(id) {
    try {
      const db = await openMediaDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, "readwrite");
        tx.objectStore(MEDIA_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      /* A missing photo store should never block deleting a confession. */
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Image compression failed"))),
        type,
        quality,
      ),
    );
  }

  function loadLocalImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("That image could not be opened"));
      };
      image.src = url;
    });
  }

  async function compressPhoto(file) {
    if (!file || !file.type.startsWith("image/"))
      throw new Error("Choose an image file.");
    if (file.size > MAX_SOURCE_PHOTO_BYTES)
      throw new Error("Please choose a photo that is 4 MB or smaller.");

    const image = await loadLocalImage(file);
    const maxSide = 1440;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    let width = Math.max(1, Math.round(image.naturalWidth * ratio));
    let height = Math.max(1, Math.round(image.naturalHeight * ratio));
    let quality = 0.82;
    let blob = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Photo compression is unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob.size <= 700 * 1024 || attempt === 3) break;
      quality = Math.max(0.62, quality - 0.08);
      width = Math.round(width * 0.88);
      height = Math.round(height * 0.88);
    }
    return blob;
  }

  function clearSelectedPhoto() {
    selectedPhotoBlob = null;
    if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
    selectedPhotoUrl = "";
    $("#confessionPhoto").value = "";
    $("#photoPreviewBox").hidden = true;
    $("#photoPreviewImage").removeAttribute("src");
    $("#photoStatus").textContent =
      "The original file is not saved. A smaller JPEG copy is created in your browser.";
  }

  function updatePhotoPreview(blob, originalName = "Photo") {
    if (selectedPhotoUrl) URL.revokeObjectURL(selectedPhotoUrl);
    selectedPhotoUrl = URL.createObjectURL(blob);
    $("#photoPreviewImage").src = selectedPhotoUrl;
    $("#photoPreviewName").textContent = originalName;
    $("#photoPreviewSize").textContent =
      `${Math.max(1, Math.round(blob.size / 1024)).toLocaleString()} KB compressed`;
    $("#photoPreviewBox").hidden = false;
    $("#photoStatus").textContent =
      "Ready. Only the compressed copy will be stored with this browser-only post.";
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer);
    $("#toastText").textContent = message;
    $("#toast").classList.toggle("error", error);
    $("#toast").classList.add("show");
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("show"),
      error ? 6000 : 3600,
    );
  }
  function validTrackUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      const match = url.pathname.match(
        /^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/,
      );
      if (
        url.protocol !== "https:" ||
        url.hostname !== "open.spotify.com" ||
        url.port ||
        url.username ||
        url.password ||
        !match
      )
        return null;
      return `https://open.spotify.com/track/${match[1]}`;
    } catch {
      return null;
    }
  }
  function validCoverUrl(value) {
    if (typeof value !== "string" || value.length > 300) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        url.hostname === "i.scdn.co" &&
        !url.port &&
        !url.username &&
        !url.password
        ? url.href
        : "";
    } catch {
      return "";
    }
  }
  function normalizeSong(song) {
    if (
      !song ||
      typeof song.title !== "string" ||
      typeof song.artist !== "string"
    )
      return null;
    const title = song.title.trim().slice(0, 80);
    const artist = song.artist.trim().slice(0, 80);
    if (!title || !artist) return null;
    const trackId = /^[A-Za-z0-9]{22}$/.test(song.id || "") ? song.id : "";
    const url = trackId
      ? `https://open.spotify.com/track/${trackId}`
      : validTrackUrl(typeof song.url === "string" ? song.url : "") || "";
    return {
      title,
      artist,
      id: trackId || (url ? url.slice(-22) : ""),
      image: validCoverUrl(song.image),
      url,
      color: /^#[a-fA-F0-9]{6}$/.test(song.color || "")
        ? song.color
        : "#a8896d",
    };
  }
  function songLink(song) {
    return (
      validTrackUrl(song.url) ||
      `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`
    );
  }
  function isValidPost(note) {
    return (
      note &&
      typeof note.id === "string" &&
      /^note-[a-zA-Z0-9-]+$/.test(note.id) &&
      typeof note.message === "string" &&
      note.message.trim().length >= 10 &&
      note.message.length <= 1000 &&
      typeof note.to === "string" &&
      note.to.length <= 40 &&
      Object.hasOwn(MOODS, note.mood) &&
      (note.design === undefined || CARD_DESIGNS.includes(note.design)) &&
      (note.musicStyle === undefined || MUSIC_STYLES.includes(note.musicStyle)) &&
      (note.theme === undefined || Object.hasOwn(EXPORT_THEMES, note.theme)) &&
      (note.hasPhoto === undefined || typeof note.hasPhoto === "boolean") &&
      typeof note.createdAt === "number" &&
      Number.isFinite(new Date(note.createdAt).getTime()) &&
      note.createdAt > 0
    );
  }
  function readState() {
    const raw = localStorage.getItem(KEYS.state);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (
      !data ||
      data.version !== 2 ||
      !Array.isArray(data.posts) ||
      !Array.isArray(data.hearts) ||
      !Array.isArray(data.saved)
    ) {
      throw new Error("Invalid saved data");
    }
    // One damaged post must never lock the whole app: keep a backup, skip only the bad ones.
    const goodPosts = data.posts.filter(isValidPost);
    if (goodPosts.length !== data.posts.length) {
      try {
        if (!localStorage.getItem(`${KEYS.state}.backup`)) localStorage.setItem(`${KEYS.state}.backup`, raw);
      } catch {
        /* backup is best-effort */
      }
    }
    const posts = goodPosts.map((post) => ({
      id: post.id,
      to: post.to,
      mood: post.mood,
      message: post.message,
      createdAt: post.createdAt,
      song: normalizeSong(post.song),
      design: CARD_DESIGNS.includes(post.design) ? post.design : "classic",
      musicStyle: MUSIC_STYLES.includes(post.musicStyle) ? post.musicStyle : "box",
      theme: Object.hasOwn(EXPORT_THEMES, post.theme)
        ? post.theme
        : DEFAULT_THEME_BY_MOOD[post.mood] || "cream",
      hasPhoto: post.hasPhoto === true,
    }));
    const ids = new Set([...posts, ...EXAMPLES].map((post) => post.id));
    return {
      version: 2,
      posts,
      hearts: [...new Set(data.hearts.filter((id) => ids.has(id)))],
      saved: [...new Set(data.saved.filter((id) => ids.has(id)))],
    };
  }
  function commit(change) {
    try {
      // Re-read before every mutation so a second tab's latest save is retained.
      const next = readState();
      change(next);
      localStorage.setItem(KEYS.state, JSON.stringify(next));
      state = next;
      return true;
    } catch (error) {
      toast(
        error.message === "Post limit"
          ? "Your wall is full. Download your posts and remove a few to make room."
          : "Couldn’t save in this browser. Your words are still in the form. Check browser storage and try again.",
        true,
      );
      return false;
    }
  }
  function getDraft() {
    const mood = $('input[name="mood"]:checked', form).value;
    return {
      to: recipient.value,
      message: textarea.value,
      mood,
      song: selectedSong,
      design: $('input[name="cardDesign"]:checked', form)?.value || "classic",
      musicStyle: $('input[name="musicStyle"]:checked', form)?.value || "box",
      theme:
        $('input[name="cardTheme"]:checked', form)?.value ||
        DEFAULT_THEME_BY_MOOD[mood] ||
        "cream",
    };
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    if (!draftDirty || sending) return;
    try {
      const draft = getDraft();
      if (draft.message || draft.to || draft.song) {
        localStorage.setItem(KEYS.draft, JSON.stringify(draft));
        $("#draftStatus").textContent = "Draft saved on this browser.";
      } else {
        localStorage.removeItem(KEYS.draft);
        $("#draftStatus").textContent = "Make yourself at home.";
      }
      draftDirty = false;
    } catch {
      $("#draftStatus").textContent = "Draft couldn’t be saved here.";
    }
  }
  function scheduleDraft() {
    draftDirty = true;
    clearTimeout(draftTimer);
    $("#draftStatus").textContent = "Saving your draft…";
    draftTimer = setTimeout(saveDraft, 350);
  }
  function updateCounter() {
    const count = textarea.value.length;
    $("#counter").textContent = `${count.toLocaleString()} / 1,000`;
    $("#counter").classList.toggle("near-limit", count >= 900);
    $("#characterProgress").style.width = `${Math.min(100, count / 10)}%`;
    if (!$("#messageError").hidden && count >= 10 && count <= 1000)
      setMessageError("");
  }
  function setMessageError(message) {
    $("#messageError").textContent = message;
    $("#messageError").hidden = !message;
    textarea.setAttribute("aria-invalid", String(Boolean(message)));
    $(".message-field").classList.toggle("has-error", Boolean(message));
  }
  function validateDraft() {
    const draft = getDraft();
    if (draft.message.trim().length < 10) {
      setMessageError(
        "Give your confession a little more room — at least 10 characters.",
      );
      textarea.focus();
      return null;
    }
    if (draft.message.length > 1000) {
      setMessageError("Keep your confession within 1,000 characters.");
      textarea.focus();
      return null;
    }
    if (draft.to.length > 40) {
      setMessageError("Keep the recipient name within 40 characters.");
      recipient.focus();
      return null;
    }
    setMessageError("");
    return { ...draft, to: draft.to.trim(), message: draft.message.trim() };
  }
  function openDialog(id) {
    const dialog = document.getElementById(id);
    dialog.showModal();
    document.body.classList.add("dialog-open");
  }
  function closeDialog(id) {
    document.getElementById(id).close();
  }
  $$(".dialog").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      if (!$("dialog[open]")) document.body.classList.remove("dialog-open");
      if (dialog.id === "confirmDialog") pendingDelete = null;
    });
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      if (
        event.target === dialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      )
        dialog.close();
    });
  });
  $$("[data-close]").forEach((button) =>
    button.addEventListener("click", () => closeDialog(button.dataset.close)),
  );

  function songParts(song) {
    const cover = node(
      "span",
      "song-cover",
      song.title.slice(0, 1).toUpperCase(),
    );
    cover.style.backgroundColor = song.color;
    if (song.image) {
      cover.textContent = "";
      cover.style.backgroundImage = `url("${song.image}")`;
      cover.style.backgroundSize = "cover";
      cover.style.backgroundPosition = "center";
    }
    cover.setAttribute("aria-hidden", "true");
    const info = node("span", "song-info");
    info.append(node("strong", "", song.title), node("span", "", song.artist));
    return [cover, info];
  }
  function embedToggle(song) {
    const wrap = node("div", "card-embed");
    const button = node("button", "card-embed-toggle");
    const label = node("span", "", "Play here");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute(
      "aria-label",
      `Play ${song.title} by ${song.artist} with the Spotify player`,
    );
    button.append(icon("music"), label);
    button.addEventListener("click", () => {
      const frame = $("iframe", wrap);
      if (frame) {
        frame.remove();
        button.setAttribute("aria-expanded", "false");
        label.textContent = "Play here";
        return;
      }
      const player = document.createElement("iframe");
      player.src = `https://open.spotify.com/embed/track/${song.id}`;
      player.title = `Spotify player: ${song.title} by ${song.artist}`;
      player.loading = "lazy";
      player.allow = "encrypted-media";
      wrap.append(player);
      button.setAttribute("aria-expanded", "true");
      label.textContent = "Hide player";
    });
    wrap.append(button);
    return wrap;
  }
  function renderAttachedSong() {
    const box = $("#attachedSong");
    box.replaceChildren();
    box.hidden = !selectedSong;
    $("#addSongButton").hidden = Boolean(selectedSong);
    if (!selectedSong) return;
    const change = node("button", "icon-button");
    change.type = "button";
    change.setAttribute("aria-label", "Change attached song");
    change.append(icon("music"));
    change.addEventListener("click", openSongPicker);
    const remove = node("button", "icon-button");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove attached song");
    remove.append(icon("close"));
    remove.addEventListener("click", () => {
      selectedSong = null;
      renderAttachedSong();
      scheduleDraft();
      $("#addSongButton").focus();
    });
    box.append(...songParts(selectedSong), change, remove);
  }
  function attachSong(song) {
    selectedSong = normalizeSong(song);
    renderAttachedSong();
    scheduleDraft();
    closeDialog("songDialog");
    $("#attachedSong button").focus();
    toast("A soundtrack for your words. Song attached.");
  }
  let songSearchTimer;
  let songSearchSeq = 0;
  function songMessage(list, text) {
    list.replaceChildren(node("p", "song-empty", text));
  }
  function renderSuggestions(list, query, intro) {
    const q = query.toLowerCase();
    const pool = SONGS.filter((song) => !q || `${song.title} ${song.artist}`.toLowerCase().includes(q));
    list.replaceChildren(node("p", "song-empty", pool.length ? intro : "No match in our picks. Add your song below."));
    pool.forEach((raw) => {
      const song = normalizeSong(raw);
      if (!song) return;
      const button = node("button", "song-choice");
      button.type = "button";
      button.setAttribute("aria-label", `Attach ${song.title} by ${song.artist}`);
      button.append(...songParts(song), icon("arrow"));
      button.addEventListener("click", () => attachSong(song));
      list.append(button);
    });
  }
  async function renderSongs() {
    const query = $("#songSearch").value.trim();
    const list = $("#songList");
    const seq = ++songSearchSeq;
    if (query.length < 2) {
      renderSuggestions(list, "", "Popular picks — or search Spotify above.");
      return;
    }
    songMessage(list, "Searching Spotify…");
    let songs;
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("bad response");
      songs = data.map(normalizeSong).filter((song) => song && song.id);
    } catch (error) {
      if (seq !== songSearchSeq) return;
      renderSuggestions(
        list,
        query,
        error.message === "429"
          ? "Spotify is busy right now. Here are some picks, or add your own below."
          : "Live Spotify search isn’t available here. Here are some picks, or add your own below.",
      );
      return;
    }
    if (seq !== songSearchSeq) return;
    list.replaceChildren();
    if (!songs.length) {
      songMessage(list, "No songs found on Spotify. Try another search.");
      return;
    }
    songs.forEach((song) => {
      const button = node("button", "song-choice");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Attach ${song.title} by ${song.artist}`,
      );
      button.append(...songParts(song), icon("arrow"));
      button.addEventListener("click", () => attachSong(song));
      list.append(button);
    });
  }
  function openSongPicker() {
    $("#songSearch").value = "";
    $("#songError").hidden = true;
    renderSongs();
    openDialog("songDialog");
    $("#songSearch").focus();
  }
  $("#addSongButton").addEventListener("click", openSongPicker);
  $(".custom-song").hidden = false;
  $("#songSearch").addEventListener("input", () => {
    clearTimeout(songSearchTimer);
    songSearchTimer = setTimeout(renderSongs, 350);
  });
  $("#customSongForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#songTitle").value.trim();
    const artist = $("#songArtist").value.trim();
    const url = validTrackUrl($("#songUrl").value.trim());
    let error = "";
    let target = $("#songTitle");
    if (!title || title.length > 80)
      error = "Add a song title of 1–80 characters.";
    else if (!artist || artist.length > 80) {
      error = "Add an artist name of 1–80 characters.";
      target = $("#songArtist");
    } else if (url === null) {
      error = "Use a full Spotify track link, or leave the link empty.";
      target = $("#songUrl");
    }
    $("#songError").textContent = error;
    $("#songError").hidden = !error;
    if (error) {
      target.focus();
      return;
    }
    attachSong({ title, artist, url, color: "#a8896d" });
    event.target.reset();
  });

  function dateLabel(timestamp) {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(timestamp);
  }
  function actionButton(action, id, label, symbol, pressed) {
    const button = node("button", "reaction-button");
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = id;
    button.setAttribute("aria-label", label);
    if (pressed !== undefined)
      button.setAttribute("aria-pressed", String(pressed));
    button.append(icon(symbol));
    return button;
  }

  function characterForNote(note) {
    const source = String(note?.id || note?.message || "confessmo");
    let hash = 0;
    for (let i = 0; i < source.length; i += 1)
      hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    return CHARACTER_ORDER[hash % CHARACTER_ORDER.length];
  }

  function setCardTheme(card, themeName) {
    const theme = EXPORT_THEMES[themeName] || EXPORT_THEMES.cream;
    card.dataset.exportTheme = themeName;
    card.style.setProperty("--card-tint", theme.tint);
    card.style.setProperty("--card-ink", theme.ink);
    card.style.setProperty("--mood-accent", theme.accent);
    const swatches = $$(".card-theme-swatch", card);
    swatches.forEach((swatch) =>
      swatch.setAttribute("aria-pressed", String(swatch.dataset.theme === themeName)),
    );
  }
  function makeCard(note, preview = false) {
    const mood = MOODS[note.mood] || MOODS.life;
    const design = CARD_DESIGNS.includes(note.design) ? note.design : "classic";
    const musicStyle = MUSIC_STYLES.includes(note.musicStyle) ? note.musicStyle : "box";
    const chosenTheme =
      Object.hasOwn(EXPORT_THEMES, note.theme)
        ? note.theme
        : DEFAULT_THEME_BY_MOOD[note.mood] || "cream";
    const card = node("article", "confession-card");
    card.dataset.id = note.id || "preview";
    card.dataset.design = design;
    card.dataset.musicStyle = musicStyle;
    card.classList.add(`mood-${note.mood || "life"}`, `design-${design}`);
    card.style.setProperty("--mood-accent", mood.color);

    const decor = node("div", "card-decor");
    decor.setAttribute("aria-hidden", "true");
    decor.append(
      node("span", "card-cloud cloud-one"),
      node("span", "card-cloud cloud-two"),
    );
    const sparkOne = icon("spark");
    sparkOne.classList.add("card-spark", "spark-one");
    const sparkTwo = icon("heart");
    sparkTwo.classList.add("card-spark", "spark-two");
    const sparkThree = icon("spark");
    sparkThree.classList.add("card-spark", "spark-three");
    decor.append(sparkOne, sparkTwo, sparkThree);

    const characterKey = characterForNote(note);
    const character = CHARACTER_STICKERS[characterKey];
    const sticker = node("span", `card-character character-${characterKey}`);
    const stickerImage = node("img", "card-character-image");
    stickerImage.src = character.src;
    stickerImage.alt = "";
    stickerImage.loading = "lazy";
    stickerImage.decoding = "async";
    sticker.append(stickerImage);
    decor.append(sticker);
    card.append(decor);

    // Premium finish layer: paper grain, foil frame, ornaments. Each design styles these in CSS.
    const luxe = node("div", "card-luxe");
    luxe.setAttribute("aria-hidden", "true");
    luxe.append(
      node("i", "lx-grain"),
      node("i", "lx-frame"),
      node("i", "lx-corner lx-tl"),
      node("i", "lx-corner lx-tr"),
      node("i", "lx-corner lx-bl"),
      node("i", "lx-corner lx-br"),
    );
    if (design === "editorial" || design === "polaroid") {
      let h = 0;
      const seed = String(note.id || note.message || "x");
      for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      luxe.append(
        node("span", "lx-plate", design === "editorial" ? `VOL. 01 — Nº ${(h % 900) + 100}` : "THE GALLERY"),
      );
    }
    card.append(luxe);
    setCardTheme(card, chosenTheme);

    const header = node("div", "card-header");
    const moodTag = node("span", "mood-tag");
    const moodIcon = icon(mood.icon);
    moodIcon.classList.add("mood-tag-icon");
    moodTag.append(moodIcon, document.createTextNode(mood.label));
    header.append(moodTag);
    if (note.example) header.append(node("span", "card-example", "EXAMPLE"));
    else if (preview) header.append(node("span", "card-example", "PREVIEW"));
    else {
      const time = node("time", "card-date", dateLabel(note.createdAt));
      time.dateTime = new Date(note.createdAt).toISOString();
      header.append(time);
    }
    card.append(
      header,
      node("p", "card-recipient", `To ${note.to || "whoever needs this"}`),
    );

    if (note.hasPhoto || note._photoBlob) {
      const photoFrame = node("div", "card-photo");
      const photoImage = node("img", "card-photo-image");
      photoImage.alt = "Photo attached to this confession";
      photoImage.decoding = "async";
      photoFrame.append(photoImage);
      card.append(photoFrame);
      const useBlob = async () => {
        const blob = note._photoBlob || (note.id ? await mediaStoreGet(note.id) : null);
        if (!blob) {
          photoFrame.remove();
          return;
        }
        const url = URL.createObjectURL(blob);
        photoImage.onload = () => URL.revokeObjectURL(url);
        photoImage.onerror = () => {
          URL.revokeObjectURL(url);
          photoFrame.remove();
        };
        photoImage.src = url;
      };
      useBlob();
    }

    const message = node("p", "card-message", note.message);
    card.append(message);
    if (!preview) {
      const expand = actionButton(
        "expand",
        note.id,
        "Read full confession",
        "eye",
      );
      expand.className = "read-more";
      expand.replaceChildren(document.createTextNode("Read the rest"));
      expand.hidden = true;
      expand.setAttribute("aria-expanded", "false");
      card.append(expand);
    }
    card.append(node("p", "card-signature", "— anonymously, with feeling."));
    if (note.song && musicStyle !== "none") {
      const song = normalizeSong(note.song);
      if (song) {
        const link = node(
          "a",
          musicStyle === "text"
            ? "card-song-text"
            : `card-song card-song-${musicStyle}`,
        );
        link.href = songLink(song);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          `${song.url ? "Open" : "Find"} ${song.title} by ${song.artist} on Spotify (new tab)`,
        );

        if (musicStyle === "vinyl") {
          const disc = node("span", "mini-vinyl");
          disc.append(node("i", "mini-vinyl-label", song.title.slice(0, 1).toUpperCase()));
          const info = node("span", "song-info");
          info.append(
            node("strong", "", song.title),
            node("span", "", song.artist),
          );
          link.append(disc, info, icon("arrow"));
        } else if (musicStyle === "text") {
          const musicIcon = icon("music");
          const textWrap = node("span", "song-text-copy");
          textWrap.append(
            node("strong", "", song.title),
            node("span", "", ` — ${song.artist}`),
          );
          link.append(musicIcon, textWrap, icon("arrow"));
        } else {
          const open = node("span", "song-open");
          open.append(
            node("span", "", song.url ? "Spotify" : "Find"),
            icon("arrow"),
          );
          link.append(...songParts(song), open);
        }
        card.append(link);
        if (song.id && !preview) card.append(embedToggle(song));
      }
    }
    if (!preview) {
      const footer = node("div", "card-footer");
      const left = node("div", "card-actions");
      const loved = state.hearts.includes(note.id);
      const liked = actionButton(
        "heart",
        note.id,
        loved ? "Remove heart" : "Send a heart",
        "heart",
        loved,
      );
      liked.append(node("span", "heart-count", loved ? "1" : "0"));
      left.append(liked);
      if (!note.example)
        left.append(node("span", "card-local", "ONLY ON THIS BROWSER"));
      const right = node("div", "card-actions");
      const saved = state.saved.includes(note.id);
      right.append(
        actionButton(
          "save",
          note.id,
          saved ? "Remove bookmark" : "Bookmark confession",
          "bookmark",
          saved,
        ),
      );

      right.append(
        actionButton(
          "open-studio",
          note.id,
          "Save as Story, post or animated video",
          "download",
        ),
      );

      if (!note.example)
        right.append(
          actionButton("delete", note.id, "Remove your confession", "trash"),
        );
      footer.append(left, right);
      card.append(footer);
    }
    return card;
  }
  let pendingId = null;
  function getPendingId() {
    if (!pendingId)
      pendingId = `note-${window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    return pendingId;
  }
  function updateReadMore() {
    $$(".confession-card", grid).forEach((card) => {
      const message = $(".card-message", card);
      const expand = $(".read-more", card);
      if (!expand || message.classList.contains("expanded")) return;
      expand.hidden = message.scrollHeight <= message.clientHeight + 2;
    });
  }
  function renderWall() {
    const query = $("#wallSearch").value.trim().toLocaleLowerCase();
    let notes = [...state.posts, ...EXAMPLES].filter((note) => {
      if (view === "mine" && note.example) return false;
      if (view === "saved" && !state.saved.includes(note.id)) return false;
      if (moodFilter !== "all" && note.mood !== moodFilter) return false;
      const text = `${note.to} ${note.message} ${MOODS[note.mood].label} ${note.song?.title || ""} ${note.song?.artist || ""}`;
      return !query || text.toLocaleLowerCase().includes(query);
    });
    const sort = $("#sortOrder").value;
    notes.sort((a, b) => {
      if (sort === "popular") {
        const difference =
          Number(state.hearts.includes(b.id)) -
          Number(state.hearts.includes(a.id));
        if (difference) return difference;
      }
      return sort === "oldest"
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt;
    });
    const fragment = document.createDocumentFragment();
    notes.forEach((note, index) => {
      const card = makeCard(note);
      card.style.setProperty("--card-index", Math.min(index, 8));
      fragment.append(card);
    });
    grid.replaceChildren(fragment);
    $("#emptyState").hidden = notes.length > 0;
    $("#myCount").textContent = String(state.posts.length);
    const examples = notes.filter((note) => note.example).length;
    const own = notes.length - examples;
    $("#feedStatus").textContent =
      `Your notes: ${own}${examples ? ` · ${examples} labeled examples for inspiration` : ""} · Hearts and bookmarks stay here.`;
    const filtered = Boolean(query) || moodFilter !== "all";
    $("#emptyTitle").textContent = filtered
      ? "No notes found, just yet."
      : view === "saved"
        ? "Keep the words that stay with you."
        : "A little room for your words.";
    $("#emptyDescription").textContent = filtered
      ? "Try another word or feeling."
      : view === "saved"
        ? "Tap the bookmark on a confession to find it here later."
        : "Your first confession can start right here.";
    $("#emptyAction").textContent = filtered
      ? "Clear filters"
      : view === "saved"
        ? "Explore the wall"
        : "Write a confession";
    $$(".wall-tabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    $$("#moodFilters button").forEach((button) => {
      button.classList.toggle("active", button.dataset.mood === moodFilter);
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mood === moodFilter),
      );
    });
    requestAnimationFrame(updateReadMore);
  }
  function resetFilters() {
    moodFilter = "all";
    $("#wallSearch").value = "";
    $("#sortOrder").value = "newest";
  }
  $$(".wall-tabs button").forEach((button) =>
    button.addEventListener("click", () => {
      view = button.dataset.view;
      renderWall();
    }),
  );
  $$("#moodFilters button").forEach((button) =>
    button.addEventListener("click", () => {
      moodFilter = button.dataset.mood;
      renderWall();
    }),
  );
  $("#wallSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderWall, 160);
  });
  $("#sortOrder").addEventListener("change", renderWall);
  $("#emptyAction").addEventListener("click", () => {
    if ($("#wallSearch").value.trim() || moodFilter !== "all") {
      resetFilters();
      renderWall();
    } else if (view === "saved") {
      view = "all";
      renderWall();
    } else {
      $("#compose").scrollIntoView({
        behavior: motionOff() ? "instant" : "smooth",
      });
      textarea.focus({ preventScroll: true });
    }
  });
  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === "open-studio") {
      const note = [...state.posts, ...EXAMPLES].find((item) => item.id === id);
      if (!note || !window.ConfessMoStudio) {
        toast("That confession couldn’t be prepared for download.", true);
        return;
      }
      window.ConfessMoStudio.open(note);
      return;
    }
    if (action === "expand") {
      const message = $(".card-message", button.closest("article"));
      const expanded = message.classList.toggle("expanded");
      button.setAttribute("aria-expanded", String(expanded));
      button.setAttribute(
        "aria-label",
        expanded ? "Collapse confession" : "Read full confession",
      );
      button.textContent = expanded ? "A little less" : "Read the rest";
      return;
    }
    if (action === "delete") {
      pendingDelete = id;
      openDialog("confirmDialog");
      return;
    }
    const key = action === "heart" ? "hearts" : "saved";
    let active = false;
    if (
      !commit((next) => {
        active = !next[key].includes(id);
        next[key] = active
          ? [...next[key], id]
          : next[key].filter((value) => value !== id);
      })
    )
      return;
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      action === "heart"
        ? active
          ? "Remove heart"
          : "Send a heart"
        : active
          ? "Remove bookmark"
          : "Bookmark confession",
    );
    if (action === "heart") {
      $(".heart-count", button).textContent = active ? "1" : "0";
      button.classList.remove("heart-pop");
      requestAnimationFrame(() => button.classList.add("heart-pop"));
      if (active) burst(button, 7);
    } else toast(active ? "Saved to your bookmarks." : "Bookmark removed.");
    if (
      (action === "save" && view === "saved") ||
      $("#sortOrder").value === "popular"
    ) {
      renderWall();
      const replacement = $$("[data-action]", grid).find(
        (item) => item.dataset.id === id && item.dataset.action === action,
      );
      (replacement || $(`.wall-tabs [data-view="${view}"]`)).focus({
        preventScroll: true,
      });
    }
  });
  $("#confirmDelete").addEventListener("click", () => {
    const id = pendingDelete;
    if (!id) return;
    if (
      !commit((next) => {
        next.posts = next.posts.filter((note) => note.id !== id);
        next.hearts = next.hearts.filter((value) => value !== id);
        next.saved = next.saved.filter((value) => value !== id);
      })
    )
      return;
    mediaStoreDelete(id);
    closeDialog("confirmDialog");
    renderWall();
    $(`.wall-tabs [data-view="${view}"]`).focus({ preventScroll: true });
    toast("Your note was removed from this browser.");
  });

  $("#confessionPhoto").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    $("#photoStatus").textContent = "Compressing photo…";
    try {
      const compressed = await compressPhoto(file);
      selectedPhotoBlob = compressed;
      updatePhotoPreview(compressed, file.name);
      scheduleDraft();
    } catch (error) {
      clearSelectedPhoto();
      $("#photoStatus").textContent = error.message || "That photo could not be prepared.";
      toast(error.message || "That photo could not be prepared.", true);
    }
  });
  $("#removePhotoButton").addEventListener("click", () => {
    clearSelectedPhoto();
    scheduleDraft();
  });

  form.addEventListener("input", () => {
    updateCounter();
    scheduleDraft();
  });
  form.addEventListener("change", scheduleDraft);
  $$("[data-prompt]").forEach((button) =>
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt;
      if (textarea.value.trim()) {
        toast(
          "Your draft is here. Clear it first if you’d like a fresh opening line.",
        );
        textarea.focus();
        return;
      }
      textarea.value = prompt;
      $(`input[name="mood"][value="${button.dataset.mood}"]`, form).checked =
        true;
      updateCounter();
      scheduleDraft();
      textarea.focus();
      textarea.setSelectionRange(prompt.length, prompt.length);
    }),
  );
  $("#previewButton").addEventListener("click", () => {
    const draft = validateDraft();
    if (!draft) return;
    $("#previewContent").replaceChildren(
      makeCard({ id: getPendingId(), ...draft, hasPhoto: Boolean(selectedPhotoBlob), _photoBlob: selectedPhotoBlob }, true),
    );
    openDialog("previewDialog");
  });
  $("#publishPreview").addEventListener("click", () => {
    closeDialog("previewDialog");
    form.requestSubmit();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const draft = validateDraft();
    if (!draft) return;
    sending = true;
    clearTimeout(draftTimer);
    const button = $("#sendButton");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    $("span", button).textContent = "Saving…";
    form.inert = true;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const id = getPendingId();
    pendingId = null;
    let hasPhoto = Boolean(selectedPhotoBlob);
    if (selectedPhotoBlob) {
      try {
        await mediaStorePut(id, selectedPhotoBlob);
      } catch {
        hasPhoto = false;
        toast("Your confession will be posted without the photo because browser photo storage is unavailable.", true);
      }
    }
    const note = { id, ...draft, hasPhoto, createdAt: Date.now() };
    const saved = commit((next) => {
      if (next.posts.length >= 500) throw new Error("Post limit");
      next.posts.unshift(note);
    });
    if (!saved && hasPhoto) mediaStoreDelete(id);
    if (saved) {
      burst(button, 12);
      form.reset();
      selectedSong = null;
      renderAttachedSong();
      clearSelectedPhoto();
      updateCounter();
      draftDirty = false;
      try {
        localStorage.removeItem(KEYS.draft);
      } catch {
        /* The confirmed post remains saved. */
      }
      $("#draftStatus").textContent = "A little weight off your chest.";
      view = "mine";
      resetFilters();
      renderWall();
      toast("Your confession is saved to your wall on this browser.");
    } else {
      draftDirty = true;
      $("#draftStatus").textContent = "Not posted. Your words are still here.";
    }
    sending = false;
    form.inert = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    $("span", button).textContent = "Post confession";
    if (saved) {
      $("#confessions").scrollIntoView({
        behavior: motionOff() ? "instant" : "smooth",
      });
      $("#wallTitle").setAttribute("tabindex", "-1");
      $("#wallTitle").focus({ preventScroll: true });
    }
  });
  $("#exportButton").addEventListener("click", () => {
    try {
      state = readState();
    } catch {
      toast("Saved posts couldn’t be read. Nothing was changed.", true);
      return;
    }
    if (!state.posts.length) {
      toast("Write a confession first, then download your posts here.");
      return;
    }
    const payload = {
      app: "ConfessMo",
      version: 2,
      exportedAt: new Date().toISOString(),
      posts: state.posts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = `confessmo-my-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast("Your notes are ready to keep.");
  });

  // Motion, navigation, and lightweight effects.
  function motionOff() {
    return paused || reducedMotion.matches;
  }
  function applyMotionPreference() {
    const off = motionOff();
    document.documentElement.classList.toggle("motion-paused", off);
    $("#motionToggle").setAttribute("aria-pressed", String(off));
    const label = reducedMotion.matches
      ? "Animations paused by device preference"
      : paused
        ? "Resume decorative animations"
        : "Pause decorative animations";
    $("#motionToggle").setAttribute("aria-label", label);
    $("#motionToggle").title = label;
  }
  $("#motionToggle").addEventListener("click", () => {
    if (reducedMotion.matches) {
      toast("Animations follow your device’s reduced-motion preference.");
      return;
    }
    paused = !paused;
    try {
      localStorage.setItem(KEYS.motion, JSON.stringify(paused));
    } catch {
      /* Still works for this visit. */
    }
    applyMotionPreference();
    toast(
      paused
        ? "A quieter moment. Animations paused."
        : "A little movement, again.",
    );
  });
  reducedMotion.addEventListener("change", applyMotionPreference);
  function burst(target, count) {
    if (motionOff()) return;
    const rect = target.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const heart = node("span", "heart-particle");
      heart.setAttribute("aria-hidden", "true");
      const heartIcon = icon("heart");
      if (i % 2 === 0) heart.classList.add("filled");
      heart.append(heartIcon);
      heart.style.left = `${rect.left + rect.width / 2}px`;
      heart.style.top = `${rect.top + rect.height / 2}px`;
      heart.style.fontSize = `${12 + Math.random() * 12}px`;
      heart.style.setProperty("--dx", `${(Math.random() - 0.5) * 170}px`);
      heart.style.setProperty("--dy", `${-30 - Math.random() * 100}px`);
      heart.style.setProperty("--turn", `${(Math.random() - 0.5) * 70}deg`);
      document.body.append(heart);
      setTimeout(() => heart.remove(), 950);
    }
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".button");
    if (!button || button.disabled || motionOff()) return;
    const rect = button.getBoundingClientRect();
    const ripple = node("span", "button-ripple");
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${event.detail ? event.clientX - rect.left : rect.width / 2}px`;
    ripple.style.top = `${event.detail ? event.clientY - rect.top : rect.height / 2}px`;
    button.append(ripple);
    setTimeout(() => ripple.remove(), 650);
  });
  const menuButton = $("#menuButton");
  const menu = $("#mobileMenu");
  function closeMenu() {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
  }
  menuButton.addEventListener("click", () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  $$("a", menu).forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target))
      closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu();
      menuButton.focus();
    }
  });
  let scrollPending = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $("#readingProgress").style.width =
      `${max > 0 ? Math.max(0, Math.min(100, (scrollY / max) * 100)) : 0}%`;
    scrollPending = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollPending) {
        scrollPending = true;
        requestAnimationFrame(updateProgress);
      }
    },
    { passive: true },
  );
  let resizeTimer;
  window.addEventListener(
    "resize",
    () => {
      if (innerWidth > 700) closeMenu();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        updateReadMore();
        updateProgress();
      }, 100);
    },
    { passive: true },
  );
  window.addEventListener("pagehide", saveDraft);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveDraft();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEYS.state) {
      try {
        state = readState();
        renderWall();
      } catch {
        toast(
          "A saved-data change couldn’t be loaded. Nothing was overwritten.",
          true,
        );
      }
    }
    if (event.key === KEYS.motion) {
      paused = event.newValue === "true";
      applyMotionPreference();
    }
  });

  // Restore only this app's own keys; never overwrite unreadable saved data.
  try {
    state = readState();
  } catch {
    toast(
      "Browser storage is unavailable or unreadable. Your existing data has not been changed.",
      true,
    );
  }
  try {
    paused = localStorage.getItem(KEYS.motion) === "true";
    const draft = JSON.parse(localStorage.getItem(KEYS.draft) || "null");
    if (draft && typeof draft.message === "string") {
      textarea.value = draft.message.slice(0, 1000);
      recipient.value =
        typeof draft.to === "string" ? draft.to.slice(0, 40) : "";
      if (Object.hasOwn(MOODS, draft.mood))
        $(`input[name="mood"][value="${draft.mood}"]`, form).checked = true;
      if (CARD_DESIGNS.includes(draft.design)) {
        const designInput = $(`input[name="cardDesign"][value="${draft.design}"]`, form);
        if (designInput) designInput.checked = true;
      }
      if (MUSIC_STYLES.includes(draft.musicStyle)) {
        const musicInput = $(`input[name="musicStyle"][value="${draft.musicStyle}"]`, form);
        if (musicInput) musicInput.checked = true;
      }
      if (Object.hasOwn(EXPORT_THEMES, draft.theme)) {
        const themeInput = $(`input[name="cardTheme"][value="${draft.theme}"]`, form);
        if (themeInput) themeInput.checked = true;
      }
      selectedSong = normalizeSong(draft.song);
      $("#draftStatus").textContent = "Welcome back. Your draft is here.";
    }
  } catch {
    $("#draftStatus").textContent = "Draft storage is unavailable.";
  }
  applyMotionPreference();
  updateCounter();
  renderAttachedSong();
  renderWall();
  updateProgress();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateReadMore).catch(() => {});
  if (window.ConfessMoStudio)
    window.ConfessMoStudio.init({
      themes: EXPORT_THEMES,
      moods: MOODS,
      defaultThemeByMood: DEFAULT_THEME_BY_MOOD,
      characters: CHARACTER_STICKERS,
      characterFor: characterForNote,
      normalizeSong,
      getPhoto: mediaStoreGet,
      loadBlobImage: loadLocalImage,
      openDialog,
      closeDialog,
      toast,
    });
  if ("IntersectionObserver" in window && !motionOff()) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );
    $$(".reveal").forEach((el, index) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("will-reveal");
        el.style.transitionDelay = `${Math.min(index % 3, 2) * 65}ms`;
        observer.observe(el);
      }
    });
  }
})();
