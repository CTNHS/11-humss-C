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
    crush: { label: "A little crush", symbol: "♡", color: "#c7967b" },
    gratitude: { label: "Thankful", symbol: "✧", color: "#b9b18b" },
    unsent: { label: "Unsent", symbol: "↗", color: "#baa48f" },
    heartbreak: { label: "Heartache", symbol: "☾", color: "#be9f9b" },
    life: { label: "Just life", symbol: "☀", color: "#ccae76" },
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
  };
  const DEFAULT_THEME_BY_MOOD = {
    crush: "blush",
    gratitude: "matcha",
    unsent: "sky",
    heartbreak: "lilac",
    life: "cream",
  };
  const CHARACTER_STICKERS = {
    chiikawa: {
      label: "Chiikawa",
      src: "assets/chiikawa.jpg",
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    usagi: {
      label: "Usagi",
      src: "assets/usagi.webp",
      // Crop the lower text area while keeping the supplied art untouched.
      crop: { x: 0.08, y: 0.03, width: 0.84, height: 0.77 },
    },
    hachiware: {
      label: "Hachiware",
      src: "assets/hachiware.jpg",
      crop: { x: 0.06, y: 0.03, width: 0.88, height: 0.78 },
    },
  };
  const CHARACTER_ORDER = ["chiikawa", "usagi", "hachiware"];
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
      !Array.isArray(data.saved) ||
      !data.posts.every(isValidPost)
    ) {
      throw new Error("Invalid saved data");
    }
    const posts = data.posts.map((post) => ({
      id: post.id,
      to: post.to,
      mood: post.mood,
      message: post.message,
      createdAt: post.createdAt,
      song: normalizeSong(post.song),
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
    return {
      to: recipient.value,
      message: textarea.value,
      mood: $('input[name="mood"]:checked', form).value,
      song: selectedSong,
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
  async function renderSongs() {
    const query = $("#songSearch").value.trim();
    const list = $("#songList");
    const seq = ++songSearchSeq;
    if (query.length < 2) {
      songMessage(list, "Type a song or artist to search Spotify.");
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
      $(".custom-song").hidden = false;
      songMessage(
        list,
        error.message === "429"
          ? "Spotify is busy right now. Try again in a moment."
          : "Spotify search isn’t available right now. You can add a song below.",
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
  // Manual entry stays hidden unless Spotify search is unreachable.
  $(".custom-song").hidden = true;
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
    const card = node("article", "confession-card");
    card.dataset.id = note.id || "preview";
    card.classList.add(`mood-${note.mood || "life"}`);
    card.style.setProperty("--mood-accent", mood.color);

    const decor = node("div", "card-decor");
    decor.setAttribute("aria-hidden", "true");
    decor.innerHTML = `
      <span class="card-cloud cloud-one"></span>
      <span class="card-cloud cloud-two"></span>
      <span class="card-spark spark-one">✦</span>
      <span class="card-spark spark-two">♡</span>
      <span class="card-spark spark-three">✧</span>
    `;
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

    const header = node("div", "card-header");
    header.append(node("span", "mood-tag", `${mood.symbol} ${mood.label}`));
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
    if (note.song) {
      const song = normalizeSong(note.song);
      if (song) {
        const link = node("a", "card-song");
        link.href = songLink(song);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.setAttribute(
          "aria-label",
          `${song.url ? "Open" : "Find"} ${song.title} by ${song.artist} on Spotify (new tab)`,
        );
        const open = node("span", "song-open");
        open.append(
          node("span", "", song.url ? "Spotify" : "Find"),
          icon("arrow"),
        );
        link.append(...songParts(song), open);
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

      const downloadWrap = node("div", "card-download");
      const defaultTheme =
        DEFAULT_THEME_BY_MOOD[note.mood] || "cream";
      downloadWrap.dataset.theme = defaultTheme;
      const downloadToggle = actionButton(
        "download-toggle",
        note.id,
        "Choose a theme and download confession image",
        "download",
      );
      downloadToggle.setAttribute("aria-expanded", "false");

      const downloadMenu = node("div", "card-download-menu");
      downloadMenu.hidden = true;
      downloadMenu.append(
        node("p", "card-download-title", "CHOOSE A COLOR"),
        node(
          "p",
          "card-download-subtitle",
          "Preview a palette, then save your confession.",
        ),
      );

      const themeRow = node("div", "card-theme-swatches");
      Object.entries(EXPORT_THEMES).forEach(([themeName, theme]) => {
        const swatch = node("button", "card-theme-swatch");
        swatch.type = "button";
        swatch.dataset.action = "theme-select";
        swatch.dataset.id = note.id;
        swatch.dataset.theme = themeName;
        swatch.title = theme.label;
        swatch.setAttribute("aria-label", `Use ${theme.label} theme`);
        swatch.setAttribute(
          "aria-pressed",
          String(themeName === defaultTheme),
        );
        swatch.style.setProperty("--swatch", theme.soft);
        swatch.style.setProperty("--swatch-ring", theme.accent);
        swatch.append(node("span", "sr-only", theme.label));
        themeRow.append(swatch);
      });
      downloadMenu.append(themeRow);

      const formatRow = node("div", "card-download-formats");
      ["png", "jpg"].forEach((format) => {
        const option = node(
          "button",
          "card-download-option",
          `Save ${format.toUpperCase()}`,
        );
        option.type = "button";
        option.dataset.action = "download";
        option.dataset.id = note.id;
        option.dataset.format = format;
        option.setAttribute(
          "aria-label",
          `Save this confession as ${format.toUpperCase()} with the selected theme`,
        );
        formatRow.append(option);
      });
      downloadMenu.append(formatRow);
      downloadWrap.append(downloadToggle, downloadMenu);
      right.append(downloadWrap);

      setCardTheme(card, defaultTheme);

      if (!note.example)
        right.append(
          actionButton("delete", note.id, "Remove your confession", "trash"),
        );
      footer.append(left, right);
      card.append(footer);
    }
    return card;
  }
  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const paragraphs = String(text).split(/\n/);
    const lines = [];
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push("");
        return;
      }
      let line = "";
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth || !line) line = test;
        else {
          lines.push(line);
          line = word;
        }
      });
      if (line) lines.push(line);
      if (paragraphIndex < paragraphs.length - 1) lines.push("");
    });
    return lines;
  }

  function drawExportCloud(ctx, x, y, scale, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(x, y, 42 * scale, Math.PI, 0);
    ctx.arc(x + 48 * scale, y - 20 * scale, 55 * scale, Math.PI, 0);
    ctx.arc(x + 110 * scale, y, 45 * scale, Math.PI, 0);
    ctx.rect(x - 42 * scale, y, 197 * scale, 42 * scale);
    ctx.fill();
    ctx.restore();
  }

  function loadCanvasImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function drawExportCharacter(ctx, image, characterKey, x, y, size) {
    const config = CHARACTER_STICKERS[characterKey] || CHARACTER_STICKERS.chiikawa;
    const crop = config.crop;
    const sx = image.naturalWidth * crop.x;
    const sy = image.naturalHeight * crop.y;
    const sw = image.naturalWidth * crop.width;
    const sh = image.naturalHeight * crop.height;

    ctx.save();
    ctx.shadowColor = "rgba(55, 41, 31, .13)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    roundRectPath(ctx, x, y, size, size, 38);
    ctx.clip();
    ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.88)";
    ctx.lineWidth = 10;
    roundRectPath(ctx, x, y, size, size, 38);
    ctx.stroke();
    ctx.restore();
  }

  async function downloadConfessionImage(note, format = "png", themeName = null) {
    const mood = MOODS[note.mood] || MOODS.life;
    const resolvedTheme = themeName || DEFAULT_THEME_BY_MOOD[note.mood] || "cream";
    const theme = EXPORT_THEMES[resolvedTheme] || EXPORT_THEMES.cream;
    const characterKey = characterForNote(note);
    let characterImage = null;
    try {
      characterImage = await loadCanvasImage(CHARACTER_STICKERS[characterKey].src);
    } catch {
      characterImage = null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }

    ctx.fillStyle = format === "jpg" ? "#ffffff" : theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // soft background shapes
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawExportCloud(ctx, -35, 145, 1.2, "#ffffff");
    drawExportCloud(ctx, 815, 248, 0.95, "#ffffff");
    drawExportCloud(ctx, 735, 1218, 1.25, "#ffffff");

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = theme.soft;
    ctx.beginPath();
    ctx.arc(930, 95, 185, 0, Math.PI * 2);
    ctx.arc(95, 1175, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // main postcard
    ctx.save();
    ctx.shadowColor = "rgba(55, 41, 31, .12)";
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 18;
    roundRectPath(ctx, 90, 95, 900, 1160, 54);
    ctx.fillStyle = theme.panel;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, 90, 95, 900, 1160, 54);
    ctx.clip();
    const gradient = ctx.createLinearGradient(90, 95, 990, 1255);
    gradient.addColorStop(0, "rgba(255,255,255,.18)");
    gradient.addColorStop(1, theme.bg);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = gradient;
    ctx.fillRect(90, 95, 900, 1160);
    ctx.restore();

    ctx.fillStyle = theme.soft;
    roundRectPath(ctx, 90, 95, 900, 14, 7);
    ctx.fill();

    ctx.fillStyle = theme.ink;
    ctx.font = '600 32px "Poppins", sans-serif';
    ctx.fillText("ConfessMo.", 155, 175);

    // mood pill
    ctx.font = '600 20px "Poppins", sans-serif';
    const moodText = `${mood.symbol}  ${mood.label.toUpperCase()}`;
    const moodWidth = ctx.measureText(moodText).width + 48;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = theme.bg;
    roundRectPath(ctx, 155, 215, moodWidth, 48, 24);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.ink;
    ctx.fillText(moodText, 178, 247);

    ctx.fillStyle = theme.ink;
    ctx.globalAlpha = 0.62;
    ctx.font = '500 22px "Poppins", sans-serif';
    ctx.fillText(`To ${note.to || "whoever needs this"}`, 155, 327);
    ctx.globalAlpha = 1;

    // dynamically size the confession so long posts still fit.
    const maxMessageWidth = 770;
    const maxMessageHeight = note.song ? 600 : 700;
    let fontSize = 59;
    let lines = [];
    while (fontSize >= 28) {
      ctx.font = `500 ${fontSize}px "Cormorant Garamond", Georgia, serif`;
      lines = wrapCanvasText(ctx, note.message, maxMessageWidth);
      const lineHeight = fontSize * 1.18;
      if (lines.length * lineHeight <= maxMessageHeight) break;
      fontSize -= 3;
    }
    const lineHeight = fontSize * 1.18;
    ctx.fillStyle = theme.ink;
    let y = 420;
    lines.forEach((line) => {
      ctx.fillText(line, 155, y);
      y += lineHeight;
    });

    ctx.globalAlpha = 0.62;
    ctx.font = '500 20px "Poppins", sans-serif';
    ctx.fillText("— anonymously, with feeling.", 155, Math.min(1035, y + 55));
    ctx.globalAlpha = 1;

    if (note.song) {
      const song = normalizeSong(note.song);
      if (song) {
        const sy = 1060;
        ctx.fillStyle = theme.bg;
        roundRectPath(ctx, 150, sy, 560, 92, 22);
        ctx.fill();
        ctx.fillStyle = song.color || theme.soft;
        roundRectPath(ctx, 170, sy + 16, 60, 60, 14);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = '600 30px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = "center";
        ctx.fillText(song.title.slice(0, 1).toUpperCase(), 200, sy + 57);
        ctx.textAlign = "left";
        ctx.fillStyle = theme.ink;
        ctx.font = '600 18px "Poppins", sans-serif';
        ctx.fillText(song.title.slice(0, 34), 250, sy + 41);
        ctx.globalAlpha = 0.62;
        ctx.font = '500 15px "Poppins", sans-serif';
        ctx.fillText(song.artist.slice(0, 38), 250, sy + 66);
        ctx.globalAlpha = 1;
      }
    }

    if (characterImage)
      drawExportCharacter(ctx, characterImage, characterKey, 775, 1000, 160);
    ctx.fillStyle = theme.soft;
    ctx.font = '500 40px Georgia, serif';
    ctx.fillText("✦", 855, 900);
    ctx.fillText("♡", 760, 930);
    ctx.font = '500 27px Georgia, serif';
    ctx.fillText("✧", 910, 955);

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = theme.ink;
    ctx.font = '500 16px "Poppins", sans-serif';
    ctx.fillText("a little less unsaid.", 155, 1205);
    ctx.globalAlpha = 1;

    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const extension = format === "jpg" ? "jpg" : "png";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.94));
    if (!blob) throw new Error("Couldn’t create image");
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = `confessmo-${String(note.id || "confession").replace(/[^a-zA-Z0-9-]/g, "-")}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
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
    if (action === "download-toggle") {
      const wrap = button.closest(".card-download");
      const menu = $(".card-download-menu", wrap);
      const opening = menu.hidden;
      $$(".card-download-menu", grid).forEach((item) => (item.hidden = true));
      $$('[data-action="download-toggle"]', grid).forEach((item) =>
        item.setAttribute("aria-expanded", "false"),
      );
      menu.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      return;
    }
    if (action === "theme-select") {
      const themeName = button.dataset.theme;
      if (!Object.hasOwn(EXPORT_THEMES, themeName)) return;
      const card = button.closest(".confession-card");
      const wrap = button.closest(".card-download");
      if (wrap) wrap.dataset.theme = themeName;
      if (card) setCardTheme(card, themeName);
      return;
    }
    if (action === "download") {
      const note = [...state.posts, ...EXAMPLES].find((item) => item.id === id);
      if (!note) {
        toast("That confession couldn’t be prepared for download.", true);
        return;
      }
      const format = button.dataset.format === "jpg" ? "jpg" : "png";
      const wrap = button.closest(".card-download");
      const themeName =
        wrap?.dataset.theme || DEFAULT_THEME_BY_MOOD[note.mood] || "cream";
      button.disabled = true;
      downloadConfessionImage(note, format, themeName)
        .then(() =>
          toast(
            `Saved ${EXPORT_THEMES[themeName]?.label || "selected"} theme as ${format.toUpperCase()}.`,
          ),
        )
        .catch(() => toast("Couldn’t create the image. Try again.", true))
        .finally(() => {
          button.disabled = false;
          const menu = button.closest(".card-download-menu");
          if (menu) menu.hidden = true;
          const toggle = $("[data-action='download-toggle']", button.closest(".card-download"));
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        });
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
    closeDialog("confirmDialog");
    renderWall();
    $(`.wall-tabs [data-view="${view}"]`).focus({ preventScroll: true });
    toast("Your note was removed from this browser.");
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
    $("#previewContent").replaceChildren(makeCard(draft, true));
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
    const id = `note-${window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const note = { id, ...draft, createdAt: Date.now() };
    const saved = commit((next) => {
      if (next.posts.length >= 500) throw new Error("Post limit");
      next.posts.unshift(note);
    });
    if (saved) {
      burst(button, 12);
      form.reset();
      selectedSong = null;
      renderAttachedSong();
      updateCounter();
      draftDirty = false;
      try {
        localStorage.removeItem(KEYS.draft);
      } catch {
        /* The confirmed post remains saved. */
      }
      $("#draftStatus").textContent = "A little weight off your chest. ♡";
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
      const heart = node("span", "heart-particle", i % 2 ? "♡" : "♥");
      heart.setAttribute("aria-hidden", "true");
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