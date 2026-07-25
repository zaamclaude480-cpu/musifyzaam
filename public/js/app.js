(function () {
  'use strict';

  var LIBRARY_KEY = 'zaammusic_library_v1';
  var LIBRARY_KEY_OLD = 'frekuensi_library_v1';
  var RECENT_KEY = 'zaammusic_recent_v1';
  var PLAYLIST_KEY = 'zaammusic_playlists_v1';

  var ROUTES = { home: '/home', search: '/search', library: '/library', info: '/info' };

  var HEART_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 21s-7.2-4.7-9.8-9.1C.6 9 1.7 5.4 5 4.4c2-.6 4 0 5.4 1.7l1.6 2 1.6-2C15 4.4 17 3.8 19 4.4c3.3 1 4.4 4.6 2.8 7.5C19.2 16.3 12 21 12 21z"/></svg>';
  var NOTE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  var SEARCH_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>';
  var PLUS_SVG = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>';
  var TRASH_SVG = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 7h12v2H6zM9.5 10h1.4v8H9.5zm3.6 0h1.4v8h-1.4zM9 4h6l1 2H8z"/></svg>';

  var els = {
    tabs: document.querySelectorAll('.tab'),
    views: document.querySelectorAll('.view'),
    filterPills: document.getElementById('filterPills'),
    quickGrid: document.getElementById('quickGrid'),
    homeStatus: document.getElementById('homeStatus'),
    homeEyebrow: document.getElementById('homeEyebrow'),
    homeGrid: document.getElementById('homeGrid'),
    recentSection: document.getElementById('recentSection'),
    recentGrid: document.getElementById('recentGrid'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    searchStatus: document.getElementById('searchStatus'),
    searchGrid: document.getElementById('searchGrid'),
    libraryStatus: document.getElementById('libraryStatus'),
    libraryGrid: document.getElementById('libraryGrid'),
    playlistGrid: document.getElementById('playlistGrid'),
    viewPlaylist: document.getElementById('view-playlist'),
    plBack: document.getElementById('plBack'),
    plCoverBtn: document.getElementById('plCoverBtn'),
    plCoverImg: document.getElementById('plCoverImg'),
    plCoverPlaceholder: document.getElementById('plCoverPlaceholder'),
    plCoverInput: document.getElementById('plCoverInput'),
    plName: document.getElementById('plName'),
    plMeta: document.getElementById('plMeta'),
    plAddBtn: document.getElementById('plAddBtn'),
    plTracks: document.getElementById('plTracks'),
    createPlaylistModal: document.getElementById('createPlaylistModal'),
    createPlaylistClose: document.getElementById('createPlaylistClose'),
    createPlaylistInput: document.getElementById('createPlaylistInput'),
    createPlaylistSubmit: document.getElementById('createPlaylistSubmit'),
    addSongModal: document.getElementById('addSongModal'),
    addSongClose: document.getElementById('addSongClose'),
    addSongInput: document.getElementById('addSongInput'),
    addSongStatus: document.getElementById('addSongStatus'),
    addSongResults: document.getElementById('addSongResults'),
    meter: document.getElementById('meter'),
    reel: document.getElementById('reel'),
    npThumb: document.getElementById('npThumb'),
    npTitle: document.getElementById('npTitle'),
    npChannel: document.getElementById('npChannel'),
    saveBtn: document.getElementById('saveBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon')
  };

  var state = {
    homeLoaded: false,
    homeFilter: 'semua',
    topHitsVideos: [],
    current: null, // { id, title, channel, thumb }
    isPlaying: false,
    activeView: 'home',
    currentPlaylistId: null
  };

  // ---------------- Migrate old localStorage key (Frekuensi -> ZaamMusic) ----------------
  (function migrateLibrary() {
    try {
      if (!localStorage.getItem(LIBRARY_KEY) && localStorage.getItem(LIBRARY_KEY_OLD)) {
        localStorage.setItem(LIBRARY_KEY, localStorage.getItem(LIBRARY_KEY_OLD));
      }
    } catch (e) { /* ignore */ }
  })();

  // ---------------- View / tab routing ----------------
  function viewForPath(path) {
    var p = (path || '/').replace(/\/+$/, '') || '/home';
    for (var name in ROUTES) {
      if (ROUTES[name] === p) return name;
    }
    return 'home';
  }

  function showView(name, opts) {
    opts = opts || {};
    state.activeView = name;
    els.views.forEach(function (v) {
      v.classList.toggle('is-active', v.dataset.view === name);
    });
    els.tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.view === name);
    });
    if (!opts.skipHistory) {
      var path = ROUTES[name] || '/home';
      if (location.pathname !== path) {
        history.pushState({ view: name }, '', path);
      }
    }
    if (name === 'home') {
      renderQuickGrid();
      renderRecentSection();
      if (!state.homeLoaded) loadHome();
    }
    if (name === 'library') renderLibrary();
  }

  els.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      showView(tab.dataset.view);
    });
  });

  window.addEventListener('popstate', function () {
    showView(viewForPath(location.pathname), { skipHistory: true });
  });

  // ---------------- Library (localStorage) ----------------
  function getLibrary() {
    try {
      return JSON.parse(localStorage.getItem(LIBRARY_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function setLibrary(list) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  }

  function isSaved(id) {
    return getLibrary().some(function (t) { return t.id === id; });
  }

  function toggleSave(track) {
    var lib = getLibrary();
    var idx = lib.findIndex(function (t) { return t.id === track.id; });
    if (idx >= 0) {
      lib.splice(idx, 1);
    } else {
      lib.unshift(track);
    }
    setLibrary(lib);
    refreshSaveButtons(track.id);
    if (els.saveBtn.dataset.trackId === track.id) {
      els.saveBtn.classList.toggle('is-saved', isSaved(track.id));
    }
  }

  function refreshSaveButtons(id) {
    document.querySelectorAll('[data-id="' + id + '"]').forEach(function (btn) {
      if (btn.classList.contains('track-save') || btn.classList.contains('row-toggle')) {
        btn.classList.toggle('is-saved', isSaved(id));
        if (btn.classList.contains('row-toggle')) {
          btn.innerHTML = isSaved(id) ? CHECK_SVG : PLUS_SVG;
        }
      }
    });
  }

  // ---------------- Recently played (localStorage) ----------------
  function getRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function addRecent(track) {
    var list = getRecent().filter(function (t) { return t.id !== track.id; });
    list.unshift(track);
    if (list.length > 12) list.length = 12;
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  }

  // ---------------- Rendering helpers ----------------
  function formatViews(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'jt';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'rb';
    return String(n);
  }

  function trackFromVideo(video) {
    return {
      id: video.id,
      title: video.title,
      channel: video.author && video.author.name ? video.author.name : 'Unknown',
      thumb: video.thumbnails ? video.thumbnails.default : '',
      duration: video.duration || ''
    };
  }

  function trackToVideoShape(t) {
    return {
      id: t.id,
      title: t.title,
      duration: t.duration,
      views: 0,
      author: { name: t.channel },
      thumbnails: { default: t.thumb }
    };
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Grid-style cards (Home recommended/recent, Pustaka)
  function renderGrid(container, videos, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!videos || !videos.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = opts.emptyText || 'Tidak ada lagu untuk ditampilkan.';
      container.appendChild(empty);
      return;
    }

    videos.forEach(function (video, i) {
      var track = trackFromVideo(video);
      var card = document.createElement('div');
      card.className = 'track-card';
      card.setAttribute('role', 'listitem');
      card.dataset.trackId = track.id;

      var showIndex = opts.numbered ? '<span class="track-index">' + (i + 1) + '</span>' : '';

      card.innerHTML =
        '<div class="track-thumb">' +
          '<img src="' + track.thumb + '" alt="" loading="lazy">' +
          showIndex +
          '<span class="track-duration">' + (video.duration || '') + '</span>' +
        '</div>' +
        '<div class="track-info">' +
          '<div>' +
            '<div class="track-title">' + escapeHtml(track.title) + '</div>' +
            '<div class="track-channel">' + escapeHtml(track.channel) + ' &middot; ' + formatViews(video.views) + ' ditonton</div>' +
          '</div>' +
          '<button class="track-save' + (isSaved(track.id) ? ' is-saved' : '') + '" data-id="' + track.id + '" aria-label="Simpan ke pustaka" title="Simpan ke pustaka">' +
            HEART_SVG +
          '</button>' +
        '</div>';

      card.addEventListener('click', function (e) {
        if (e.target.closest('.track-save')) return;
        playTrack(track);
      });

      card.querySelector('.track-save').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSave(track);
        if (container === els.libraryGrid) renderLibrary();
      });

      container.appendChild(card);
    });
  }

  // List-row cards (Search)
  function renderRows(container, videos, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!videos || !videos.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = opts.emptyText || 'Tidak ada lagu untuk ditampilkan.';
      container.appendChild(empty);
      return;
    }

    videos.forEach(function (video) {
      var track = trackFromVideo(video);
      var row = document.createElement('div');
      row.className = 'row-card';
      row.setAttribute('role', 'listitem');
      row.dataset.trackId = track.id;

      var saved = isSaved(track.id);
      row.innerHTML =
        '<div class="row-thumb"><img src="' + track.thumb + '" alt="" loading="lazy"></div>' +
        '<div class="row-info">' +
          '<div class="row-title">' + escapeHtml(track.title) + '</div>' +
          '<div class="row-sub">Lagu &middot; ' + escapeHtml(track.channel) + '</div>' +
        '</div>' +
        '<button class="row-toggle' + (saved ? ' is-saved' : '') + '" data-id="' + track.id + '" aria-label="Simpan ke pustaka" title="Simpan ke pustaka">' +
          (saved ? CHECK_SVG : PLUS_SVG) +
        '</button>';

      row.addEventListener('click', function (e) {
        if (e.target.closest('.row-toggle')) return;
        playTrack(track);
      });

      row.querySelector('.row-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleSave(track);
      });

      container.appendChild(row);
    });
  }

  function renderLibrary() {
    renderPlaylistGrid();
    var lib = getLibrary();
    els.libraryStatus.textContent = lib.length
      ? lib.length + ' lagu tersimpan.'
      : 'Belum ada lagu tersimpan. Ketuk ikon hati pada sebuah lagu untuk menyimpannya.';
    renderGrid(els.libraryGrid, lib.map(trackToVideoShape), { emptyText: 'Pustaka masih kosong.' });
  }

  // ---------------- Home: quick access grid (square Spotify-style cards) ----------------
  function renderQuickGrid() {
    var recent = getRecent();
    var items = [{ type: 'liked' }];
    recent.slice(0, 5).forEach(function (t) { items.push({ type: 'track', track: t }); });
    if (items.length < 4) items.push({ type: 'search' });
    if (items.length < 4) items.push({ type: 'tophits' });

    els.quickGrid.innerHTML = '';
    items.forEach(function (item) {
      var el = document.createElement('div');
      el.className = 'sq-card';
      el.setAttribute('role', 'listitem');

      if (item.type === 'liked') {
        el.innerHTML = '<div class="sq-cover sq-cover--liked">' + HEART_SVG + '</div><div class="sq-label">Lagu yang Disukai</div>';
        el.addEventListener('click', function () { showView('library'); });
      } else if (item.type === 'track') {
        var t = item.track;
        el.innerHTML = '<div class="sq-cover"><img src="' + t.thumb + '" alt="" loading="lazy"></div><div class="sq-label">' + escapeHtml(t.title) + '</div>';
        el.addEventListener('click', function () { playTrack(t); });
      } else if (item.type === 'search') {
        el.innerHTML = '<div class="sq-cover sq-cover--muted">' + SEARCH_SVG + '</div><div class="sq-label">Cari Lagu</div>';
        el.addEventListener('click', function () { showView('search'); });
      } else if (item.type === 'tophits') {
        el.innerHTML = '<div class="sq-cover sq-cover--muted">' + NOTE_SVG + '</div><div class="sq-label">Top Hits</div>';
        el.addEventListener('click', function () {
          var target = document.querySelector('#view-home .home-section');
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
      }

      els.quickGrid.appendChild(el);
    });
  }

  // ---------------- Playlists (localStorage) ----------------
  function getPlaylists() {
    try {
      return JSON.parse(localStorage.getItem(PLAYLIST_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function setPlaylists(list) {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(list));
  }

  function findPlaylist(id) {
    return getPlaylists().find(function (p) { return p.id === id; });
  }

  function playlistHasTrack(id, trackId) {
    var pl = findPlaylist(id);
    return !!(pl && pl.tracks.some(function (t) { return t.id === trackId; }));
  }

  function createPlaylist(name) {
    var list = getPlaylists();
    var pl = { id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: name, cover: '', tracks: [] };
    list.unshift(pl);
    setPlaylists(list);
    return pl;
  }

  function updatePlaylistCover(id, dataUrl) {
    var list = getPlaylists();
    var pl = list.find(function (p) { return p.id === id; });
    if (!pl) return;
    pl.cover = dataUrl;
    setPlaylists(list);
  }

  function toggleTrackInPlaylist(id, track) {
    var list = getPlaylists();
    var pl = list.find(function (p) { return p.id === id; });
    if (!pl) return;
    var idx = pl.tracks.findIndex(function (t) { return t.id === track.id; });
    if (idx >= 0) pl.tracks.splice(idx, 1); else pl.tracks.unshift(track);
    setPlaylists(list);
  }

  function removeTrackFromPlaylist(id, trackId) {
    var list = getPlaylists();
    var pl = list.find(function (p) { return p.id === id; });
    if (!pl) return;
    pl.tracks = pl.tracks.filter(function (t) { return t.id !== trackId; });
    setPlaylists(list);
  }

  function renderPlaylistGrid() {
    if (!els.playlistGrid) return;
    var playlists = getPlaylists();
    els.playlistGrid.innerHTML = '';

    var createCard = document.createElement('div');
    createCard.className = 'sq-card sq-card--create';
    createCard.setAttribute('role', 'listitem');
    createCard.innerHTML = '<div class="sq-cover sq-cover--create">' + PLUS_SVG + '</div><div class="sq-label">Buat Playlist</div>';
    createCard.addEventListener('click', openCreatePlaylistModal);
    els.playlistGrid.appendChild(createCard);

    playlists.forEach(function (pl) {
      var card = document.createElement('div');
      card.className = 'sq-card';
      card.setAttribute('role', 'listitem');
      var coverHtml = pl.cover
        ? '<img src="' + pl.cover + '" alt="" loading="lazy">'
        : NOTE_SVG;
      card.innerHTML =
        '<div class="sq-cover' + (pl.cover ? '' : ' sq-cover--muted') + '">' + coverHtml + '</div>' +
        '<div class="sq-sub">' + pl.tracks.length + ' lagu</div>' +
        '<div class="sq-label">' + escapeHtml(pl.name) + '</div>';
      card.addEventListener('click', function () { openPlaylistDetail(pl.id); });
      els.playlistGrid.appendChild(card);
    });
  }

  // ---------------- Playlist detail view ----------------
  function openPlaylistDetail(id) {
    state.currentPlaylistId = id;
    renderPlaylistDetail();
    renderPlaylistTracks();
    els.viewPlaylist.classList.add('is-active');
  }

  function closePlaylistDetail() {
    els.viewPlaylist.classList.remove('is-active');
    state.currentPlaylistId = null;
  }

  function renderPlaylistDetail() {
    var pl = findPlaylist(state.currentPlaylistId);
    if (!pl) { closePlaylistDetail(); return; }
    els.plName.textContent = pl.name;
    els.plMeta.textContent = pl.tracks.length + ' lagu';
    if (pl.cover) {
      els.plCoverImg.src = pl.cover;
      els.plCoverImg.style.display = 'block';
      els.plCoverPlaceholder.style.display = 'none';
    } else {
      els.plCoverImg.style.display = 'none';
      els.plCoverPlaceholder.style.display = 'flex';
    }
  }

  function renderPlaylistTracks() {
    var pl = findPlaylist(state.currentPlaylistId);
    els.plTracks.innerHTML = '';
    if (!pl || !pl.tracks.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-hint';
      empty.textContent = 'Belum ada lagu di playlist ini. Ketuk "+ Tambah Lagu" untuk mulai menambahkan.';
      els.plTracks.appendChild(empty);
      return;
    }
    pl.tracks.forEach(function (track) {
      var row = document.createElement('div');
      row.className = 'row-card';
      row.setAttribute('role', 'listitem');
      row.dataset.trackId = track.id;
      row.innerHTML =
        '<div class="row-thumb"><img src="' + track.thumb + '" alt="" loading="lazy"></div>' +
        '<div class="row-info">' +
          '<div class="row-title">' + escapeHtml(track.title) + '</div>' +
          '<div class="row-sub">' + escapeHtml(track.channel) + '</div>' +
        '</div>' +
        '<button class="row-toggle" type="button" aria-label="Hapus dari playlist" title="Hapus dari playlist">' + TRASH_SVG + '</button>';

      row.addEventListener('click', function (e) {
        if (e.target.closest('.row-toggle')) return;
        playTrack(track);
      });
      row.querySelector('.row-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        removeTrackFromPlaylist(pl.id, track.id);
        renderPlaylistDetail();
        renderPlaylistTracks();
        renderPlaylistGrid();
      });
      els.plTracks.appendChild(row);
    });
  }

  els.plBack.addEventListener('click', closePlaylistDetail);
  els.plAddBtn.addEventListener('click', function () {
    if (state.currentPlaylistId) openAddSongModal(state.currentPlaylistId);
  });
  els.plCoverBtn.addEventListener('click', function () { els.plCoverInput.click(); });
  els.plCoverInput.addEventListener('change', function () {
    var file = els.plCoverInput.files && els.plCoverInput.files[0];
    els.plCoverInput.value = '';
    if (!file || !state.currentPlaylistId) return;
    readImageResizedSquare(file, 400, function (dataUrl) {
      updatePlaylistCover(state.currentPlaylistId, dataUrl);
      renderPlaylistDetail();
      renderPlaylistGrid();
    });
  });

  // Crops the picked photo to a centered square and downsizes it
  // before storing as a dataURL, so playlist covers stay small in
  // localStorage no matter what photo size the user picks.
  function readImageResizedSquare(file, size, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.width, img.height);
        var sx = (img.width - side) / 2;
        var sy = (img.height - side) / 2;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        cb(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------------- Create-playlist modal ----------------
  function openCreatePlaylistModal() {
    els.createPlaylistModal.hidden = false;
    els.createPlaylistInput.value = '';
    setTimeout(function () { els.createPlaylistInput.focus(); }, 50);
  }
  function closeCreatePlaylistModal() { els.createPlaylistModal.hidden = true; }

  function submitCreatePlaylist() {
    var name = els.createPlaylistInput.value.trim();
    if (!name) return;
    var pl = createPlaylist(name);
    closeCreatePlaylistModal();
    renderPlaylistGrid();
    openPlaylistDetail(pl.id);
  }

  els.createPlaylistClose.addEventListener('click', closeCreatePlaylistModal);
  els.createPlaylistModal.addEventListener('click', function (e) {
    if (e.target === els.createPlaylistModal) closeCreatePlaylistModal();
  });
  els.createPlaylistSubmit.addEventListener('click', submitCreatePlaylist);
  els.createPlaylistInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); submitCreatePlaylist(); }
  });

  // ---------------- Add-song modal ----------------
  var addSongState = { playlistId: null, debounce: null };

  function openAddSongModal(playlistId) {
    addSongState.playlistId = playlistId;
    els.addSongModal.hidden = false;
    els.addSongInput.value = '';
    els.addSongStatus.textContent = 'Ketik kata kunci untuk mencari lagu.';
    els.addSongResults.innerHTML = '';
    setTimeout(function () { els.addSongInput.focus(); }, 50);
  }
  function closeAddSongModal() { els.addSongModal.hidden = true; }

  els.addSongClose.addEventListener('click', closeAddSongModal);
  els.addSongModal.addEventListener('click', function (e) {
    if (e.target === els.addSongModal) closeAddSongModal();
  });

  els.addSongInput.addEventListener('input', function () {
    clearTimeout(addSongState.debounce);
    var val = els.addSongInput.value;
    if (!val.trim()) {
      els.addSongStatus.textContent = 'Ketik kata kunci untuk mencari lagu.';
      els.addSongResults.innerHTML = '';
      return;
    }
    addSongState.debounce = setTimeout(function () { doAddSongSearch(val); }, 450);
  });

  function doAddSongSearch(q) {
    els.addSongStatus.textContent = 'Mencari...';
    fetch('/api/search?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.status || !data.result || !data.result.length) {
          els.addSongStatus.textContent = data.message || 'Lagu tidak ditemukan.';
          els.addSongResults.innerHTML = '';
          return;
        }
        els.addSongStatus.textContent = data.totalResults + ' hasil ditemukan.';
        renderAddSongResults(data.result);
      })
      .catch(function () {
        els.addSongStatus.textContent = 'Terjadi kesalahan saat memuat data.';
      });
  }

  function renderAddSongResults(videos) {
    els.addSongResults.innerHTML = '';
    videos.forEach(function (video) {
      var track = trackFromVideo(video);
      var row = document.createElement('div');
      row.className = 'row-card';
      var already = playlistHasTrack(addSongState.playlistId, track.id);
      row.innerHTML =
        '<div class="row-thumb"><img src="' + track.thumb + '" alt="" loading="lazy"></div>' +
        '<div class="row-info">' +
          '<div class="row-title">' + escapeHtml(track.title) + '</div>' +
          '<div class="row-sub">' + escapeHtml(track.channel) + '</div>' +
        '</div>' +
        '<button class="row-toggle' + (already ? ' is-saved' : '') + '" type="button" aria-label="Tambah ke playlist" title="Tambah ke playlist">' +
          (already ? CHECK_SVG : PLUS_SVG) +
        '</button>';

      row.querySelector('.row-toggle').addEventListener('click', function (e) {
        e.stopPropagation();
        toggleTrackInPlaylist(addSongState.playlistId, track);
        var nowIn = playlistHasTrack(addSongState.playlistId, track.id);
        var btn = row.querySelector('.row-toggle');
        btn.classList.toggle('is-saved', nowIn);
        btn.innerHTML = nowIn ? CHECK_SVG : PLUS_SVG;
        renderPlaylistDetail();
        renderPlaylistTracks();
        renderPlaylistGrid();
      });

      els.addSongResults.appendChild(row);
    });
  }

  function renderRecentSection() {
    var recent = getRecent();
    if (!recent.length) {
      els.recentSection.hidden = true;
      return;
    }
    els.recentSection.hidden = false;
    renderGrid(els.recentGrid, recent.map(trackToVideoShape), { emptyText: '' });
  }

  // ---------------- Home: filter pills ----------------
  if (els.filterPills) {
    els.filterPills.querySelectorAll('.pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        els.filterPills.querySelectorAll('.pill').forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');
        state.homeFilter = pill.dataset.filter;
        applyHomeFilter();
      });
    });
  }

  function applyHomeFilter() {
    if (state.homeFilter === 'podcast') {
      els.homeEyebrow.textContent = 'belum ada siaran podcast';
      renderGrid(els.homeGrid, [], { emptyText: 'Belum ada konten podcast tersedia.' });
      return;
    }
    renderGrid(els.homeGrid, state.topHitsVideos, { numbered: true, emptyText: 'Tidak ada data top hits saat ini.' });
  }

  // ---------------- Data fetching ----------------
  function loadHome() {
    state.homeLoaded = true;
    els.homeStatus.textContent = 'Menyetel frekuensi...';
    fetch('/api/tophits')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.status || !data.result || !data.result.length) {
          state.topHitsVideos = [];
          els.homeStatus.textContent = data.message || 'Tidak ada data top hits saat ini.';
          els.homeEyebrow.textContent = 'sinyal terputus';
          applyHomeFilter();
          return;
        }
        state.topHitsVideos = data.result;
        els.homeStatus.textContent = '';
        els.homeEyebrow.textContent = data.cached
          ? 'siaran ter-cache, diperbarui tiap 1 jam'
          : 'siaran baru saja diperbarui';
        applyHomeFilter();
      })
      .catch(function () {
        state.topHitsVideos = [];
        els.homeStatus.textContent = 'Gagal memuat top hits. Coba muat ulang halaman.';
        els.homeEyebrow.textContent = 'sinyal terputus';
        applyHomeFilter();
      });
  }

  // ---------------- Search ----------------
  var searchDebounce = null;

  function doSearch(q) {
    q = (q || '').trim();
    if (!q) {
      els.searchStatus.textContent = 'Ketik kata kunci untuk mulai mencari.';
      els.searchGrid.innerHTML = '';
      return;
    }
    els.searchStatus.textContent = 'Mencari...';
    els.searchGrid.innerHTML = '';
    fetch('/api/search?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.status || !data.result || !data.result.length) {
          els.searchStatus.textContent = data.message || 'Lagu tidak ditemukan.';
          renderRows(els.searchGrid, []);
          return;
        }
        els.searchStatus.textContent = data.totalResults + ' hasil ditemukan.';
        renderRows(els.searchGrid, data.result);
      })
      .catch(function () {
        els.searchStatus.textContent = 'Terjadi kesalahan saat memuat data.';
      });
  }

  els.searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearTimeout(searchDebounce);
    doSearch(els.searchInput.value);
  });

  els.searchInput.addEventListener('input', function () {
    clearTimeout(searchDebounce);
    var val = els.searchInput.value;
    if (!val.trim()) {
      els.searchStatus.textContent = 'Ketik kata kunci untuk mulai mencari.';
      els.searchGrid.innerHTML = '';
      return;
    }
    searchDebounce = setTimeout(function () { doSearch(val); }, 450);
  });

  // ---------------- Audio-only playback ----------------
  // The YouTube iframe API player is mounted in a fully hidden,
  // zero-size container (#hiddenPlayer). Nothing about the video
  // track is ever surfaced in the UI — only audio, driven through
  // the visible controls in the "deck" bar below.
  var ytPlayer = null;
  var ytReady = false;
  var pendingTrack = null;

  window.onYouTubeIframeAPIReady = function () {
    var mount = document.createElement('div');
    mount.id = 'ytMount';
    document.getElementById('hiddenPlayer').appendChild(mount);

    ytPlayer = new YT.Player('ytMount', {
      height: '0',
      width: '0',
      playerVars: { autoplay: 1, controls: 0, disablekb: 1 },
      events: {
        onReady: function () {
          ytReady = true;
          if (pendingTrack) {
            var t = pendingTrack;
            pendingTrack = null;
            playTrack(t);
          }
        },
        onStateChange: onPlayerStateChange
      }
    });
  };

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      setPlayingUI(true);
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
      setPlayingUI(false);
    }
  }

  function setPlayingUI(playing) {
    state.isPlaying = playing;
    els.playIcon.style.display = playing ? 'none' : 'block';
    els.pauseIcon.style.display = playing ? 'block' : 'none';
    els.reel.classList.toggle('is-spinning', playing);
    els.meter.classList.toggle('is-live', playing);
  }

  function playTrack(track) {
    state.current = track;
    els.npTitle.textContent = track.title;
    els.npChannel.textContent = track.channel;
    els.npThumb.src = track.thumb;
    els.playPauseBtn.disabled = false;
    els.saveBtn.disabled = false;
    els.saveBtn.dataset.trackId = track.id;
    els.saveBtn.classList.toggle('is-saved', isSaved(track.id));

    document.querySelectorAll('.track-card, .row-card').forEach(function (c) {
      c.classList.toggle('is-playing', c.dataset.trackId === track.id);
    });

    addRecent(track);
    if (state.activeView === 'home') {
      renderQuickGrid();
      renderRecentSection();
    }

    if (!ytReady || !ytPlayer) {
      pendingTrack = track;
      return;
    }
    ytPlayer.loadVideoById(track.id);
  }

  els.playPauseBtn.addEventListener('click', function () {
    if (!ytPlayer || !state.current) return;
    if (state.isPlaying) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  });

  els.saveBtn.addEventListener('click', function () {
    if (!state.current) return;
    toggleSave(state.current);
  });

  // ---------------- Init ----------------
  var initialView = viewForPath(location.pathname);
  showView(initialView, { skipHistory: true });
  var canonicalPath = ROUTES[initialView] || '/home';
  if (location.pathname !== canonicalPath) {
    history.replaceState({ view: initialView }, '', canonicalPath);
  }
})();
