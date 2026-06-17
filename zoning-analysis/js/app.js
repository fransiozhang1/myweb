(function () {
  "use strict";

  var pages = window.PAGES_DATA || [];
  var pageMap = {};
  var viewers = {};

  pages.forEach(function (p) {
    if (p && p.id) pageMap[p.id] = p;
  });

  function esc(s) {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statRow(stats) {
    if (!stats || !stats.length) return "";
    return (
      "<div class=\"stat-row\">" +
      stats
        .map(function (s) {
          return "<div class=\"stat-card\"><div class=\"label\">" + esc(s.label) + "</div><div class=\"value\">" + esc(s.value) + "</div></div>";
        })
        .join("") +
      "</div>"
    );
  }

  function summaryPanel(summary) {
    if (!summary) return "<div class=\"text-panel\"></div>";
    var metrics = (summary.metrics || [])
      .map(function (m) {
        return "<li>" + esc(m) + "</li>";
      })
      .join("");
    var conclusions = (summary.conclusions || [])
      .map(function (c) {
        return "<li>" + esc(c) + "</li>";
      })
      .join("");
    return (
      "<div class=\"text-panel\">" +
      (summary.purpose ? "<h3>分析要点</h3><p>" + esc(summary.purpose) + "</p>" : "") +
      (metrics ? "<h3>关键指标</h3><ul class=\"metric-list\">" + metrics + "</ul>" : "") +
      (conclusions ? "<h3>结论</h3><ul class=\"conclusion-list\">" + conclusions + "</ul>" : "") +
      "</div>"
    );
  }

  function compactHud(summary, stats, tabLabel) {
    var items = [];
    var metricSource =
      summary && summary.metrics && summary.metrics.length ? summary.metrics : null;
    if (metricSource) {
      metricSource.slice(0, 4).forEach(function (m) {
        var idx = m.search(/[:：]/);
        if (idx > 0) {
          items.push(
            "<div class=\"hud-kv\"><span class=\"hud-k\">" +
              esc(m.slice(0, idx).trim()) +
              "</span><span class=\"hud-v\">" +
              esc(m.slice(idx + 1).trim()) +
              "</span></div>"
          );
        } else {
          items.push("<div class=\"hud-line\">" + esc(m) + "</div>");
        }
      });
    } else if (stats && stats.length) {
      stats.slice(0, 4).forEach(function (s) {
        items.push(
          "<div class=\"hud-kv\"><span class=\"hud-k\">" +
            esc(s.label) +
            "</span><span class=\"hud-v\">" +
            esc(s.value) +
            "</span></div>"
        );
      });
    }
    var conc =
      summary && summary.conclusions && summary.conclusions[0]
        ? "<p class=\"hud-conc\">" + esc(summary.conclusions[0]) + "</p>"
        : "";
    return (
      "<div class=\"hud-title\">" +
      esc(tabLabel || "") +
      "</div><div class=\"hud-grid\">" +
      items.join("") +
      "</div>" +
      conc
    );
  }

  function immersiveViewerHtml(tab, viewId) {
    if (tab.mapLayer) {
      return (
        "<div class=\"viewer-box immersive-viewer map-mount\" id=\"viewer-" +
        esc(viewId) +
        "\" data-viewer-id=\"" +
        esc(viewId) +
        "\" data-viewer-type=\"map\" data-layer=\"" +
        esc(tab.mapLayer) +
        "\"></div>"
      );
    }
    if (tab.chartLayer) {
      return (
        "<div class=\"viewer-box immersive-viewer\" id=\"viewer-" +
        esc(viewId) +
        "\" data-viewer-id=\"" +
        esc(viewId) +
        "\" data-viewer-type=\"chart\" data-layer=\"" +
        esc(tab.chartLayer) +
        "\"></div>"
      );
    }
    if (tab.matrixLayer) {
      return (
        "<div class=\"viewer-box immersive-viewer\" id=\"viewer-" +
        esc(viewId) +
        "\" data-viewer-id=\"" +
        esc(viewId) +
        "\" data-viewer-type=\"matrix\" data-layer=\"" +
        esc(tab.matrixLayer) +
        "\"></div>"
      );
    }
    return imageViewer(viewId, tab.image, tab.label);
  }

  function viewerToolbar(id) {
    return (
      "<div class=\"viewer-toolbar\">" +
      "<button type=\"button\" data-vzoom-in=\"" + esc(id) + "\">放大 +</button>" +
      "<button type=\"button\" data-vzoom-out=\"" + esc(id) + "\">缩小 −</button>" +
      "<button type=\"button\" data-vzoom-reset=\"" + esc(id) + "\">重置</button>" +
      "<span class=\"hint\">拖拽平移 · 滚轮缩放</span></div>"
    );
  }

  function imageViewer(id, src, alt) {
    if (!src) return "<div class=\"viewer-box\"><span style=\"color:#666;padding:20px\">图像缺失</span></div>";
    return (
      viewerToolbar(id) +
      "<div class=\"viewer-box\" id=\"viewer-" + esc(id) + "\" data-viewer-id=\"" + esc(id) + "\" data-viewer-type=\"image\">" +
      "<img src=\"" + esc(src) + "\" alt=\"" + esc(alt || "") + "\" />" +
      "</div>"
    );
  }

  function multiImageViewer(id, images, alt) {
    if (!images || !images.length) return imageViewer(id, "", alt);
    if (images.length === 1) return imageViewer(id, images[0], alt);
    var inner = images
      .map(function (src, i) {
        return "<img src=\"" + esc(src) + "\" alt=\"" + esc(alt) + " " + (i + 1) + "\" />";
      })
      .join("");
    return (
      viewerToolbar(id) +
      "<div class=\"viewer-box\" id=\"viewer-" + esc(id) + "\" data-viewer-id=\"" + esc(id) + "\" data-viewer-type=\"stack\">" +
      "<div class=\"viewer-stack\">" + inner + "</div></div>"
    );
  }

  function mapViewer(id, layerKey) {
    return (
      viewerToolbar(id) +
      "<div class=\"viewer-box\" id=\"viewer-" + esc(id) + "\" data-viewer-id=\"" + esc(id) + "\" data-viewer-type=\"map\" data-layer=\"" + esc(layerKey) + "\"></div>"
    );
  }

  function chartViewer(id, layerKey) {
    return (
      "<div class=\"viewer-box\" id=\"viewer-" + esc(id) + "\" data-viewer-id=\"" + esc(id) + "\" data-viewer-type=\"chart\" data-layer=\"" + esc(layerKey) + "\"></div>"
    );
  }

  function matrixViewer(id, layerKey) {
    return (
      "<div class=\"viewer-box\" id=\"viewer-" + esc(id) + "\" data-viewer-id=\"" + esc(id) + "\" data-viewer-type=\"matrix\" data-layer=\"" + esc(layerKey) + "\"></div>"
    );
  }

  function tabContentHtml(tab, viewId) {
    if (tab.mapLayer) return mapViewer(viewId, tab.mapLayer);
    if (tab.chartLayer) return chartViewer(viewId, tab.chartLayer);
    if (tab.matrixLayer) return matrixViewer(viewId, tab.matrixLayer);
    if (tab.images) return multiImageViewer(viewId, tab.images, tab.label);
    return imageViewer(viewId, tab.image, tab.label);
  }

  function tabAccent(page) {
    if (page.group === "design-zoning") return "blue";
    return "red";
  }

  function sectionAccent(page) {
    return page.group === "design-zoning" ? "blue" : "red";
  }

  function setActive(section, selector, btn, accent) {
    section.querySelectorAll(selector).forEach(function (b) {
      b.classList.remove("active", "red", "blue");
    });
    btn.classList.add("active");
    if (accent) btn.classList.add(accent);
  }

  function renderIndex(p) {
    var cards = (p.links || [])
      .map(function (l) {
        return "<a class=\"index-card\" href=\"#" + esc(l.id) + "\"><div class=\"num\">" + esc(l.num) + "</div><div class=\"label\">" + esc(l.label) + "</div></a>";
      })
      .join("");
    return "<section class=\"section\" id=\"" + esc(p.id) + "\" data-nav data-accent=\"red\"><p class=\"sec-tag\">Index</p><h2 class=\"sec-title\">" + esc(p.title) + "</h2><div class=\"index-grid\">" + cards + "</div></section>";
  }

  function renderSinglePage(p) {
    var imgs = p.images || [];
    var viewId = p.id + "-view";
    var gridClass = "panel-grid left-img" + (p.group === "design-zoning" ? " zoning-text" : "");
    var accent = sectionAccent(p);
    return (
      "<section class=\"section\" id=\"" + esc(p.id) + "\" data-nav data-accent=\"" + accent + "\">" +
      "<p class=\"sec-tag\">" + esc(p.tag) + "</p>" +
      "<h2 class=\"sec-title\">" + esc(p.title) + "</h2>" +
      "<p class=\"sec-sub\">" + esc(p.subtitle) + "</p>" +
      statRow(p.stats) +
      "<div class=\"" + gridClass + "\" id=\"panel-" + esc(p.id) + "\">" +
      "<div class=\"panel-img\">" + multiImageViewer(viewId, imgs, p.title) + "</div>" +
      "<div class=\"panel-text\">" + summaryPanel(p.summary) + "</div>" +
      "</div></section>"
    );
  }

  function renderImmersivePage(p) {
    var tabs = p.tabs || [];
    var accent = tabAccent(p);
    var secAccent = sectionAccent(p);
    var first = tabs[0];
    var viewId = p.id + "-view";
    var tabBarClass = "tab-bar immersive-tabs" + (tabs.length <= 1 ? " single-tab" : "");
    var tabBar = tabs
      .map(function (t, i) {
        var cls = "tab-btn" + (i === 0 ? " active" + (accent ? " " + accent : "") : "");
        return (
          "<button type=\"button\" class=\"" +
          cls +
          "\" data-tab=\"" +
          esc(p.id) +
          "\" data-tab-id=\"" +
          esc(t.id) +
          "\">" +
          esc(t.label) +
          "</button>"
        );
      })
      .join("");
  return (
      "<section class=\"section section-immersive\" id=\"" +
      esc(p.id) +
      "\" data-nav data-page=\"" +
      esc(p.id) +
      "\" data-accent=\"" +
      secAccent +
      "\" data-layout=\"immersive-map\">" +
      "<div class=\"immersive-top\">" +
      "<div class=\"immersive-meta\"><span class=\"sec-tag\">" +
      esc(p.tag) +
      "</span><h2 class=\"sec-title\">" +
      esc(p.title) +
      "</h2></div>" +
      "<div class=\"" +
      tabBarClass +
      "\">" +
      tabBar +
      "</div></div>" +
      "<div class=\"immersive-stage\" id=\"panel-" +
      esc(p.id) +
      "\">" +
      "<div class=\"immersive-layer-tag\" id=\"layer-tag-" +
      esc(p.id) +
      "\">" +
      esc(first.label) +
      "</div>" +
      "<div class=\"immersive-viewer-wrap\">" +
      immersiveViewerHtml(first, viewId) +
      "</div>" +
      "<div class=\"immersive-hud\" id=\"hud-" +
      esc(p.id) +
      "\">" +
      compactHud(first.summary || p.summary, null, first.label) +
      "</div></div></section>"
    );
  }

  function renderTabPage(p) {
    var tabs = p.tabs || [];
    var accent = tabAccent(p);
    var secAccent = sectionAccent(p);
    var tabBar = tabs
      .map(function (t, i) {
        var cls = "tab-btn" + (i === 0 ? " active" + (accent ? " " + accent : "") : "");
        return "<button type=\"button\" class=\"" + cls + "\" data-tab=\"" + esc(p.id) + "\" data-tab-id=\"" + esc(t.id) + "\">" + esc(t.label) + "</button>";
      })
      .join("");
    var first = tabs[0];
    var viewId = p.id + "-view";
    var gridClass = "panel-grid left-img" + (p.group === "design-zoning" ? " zoning-text" : "");
    var textSummary = first.summary || p.summary;
    return (
      "<section class=\"section\" id=\"" + esc(p.id) + "\" data-nav data-page=\"" + esc(p.id) + "\" data-accent=\"" + secAccent + "\">" +
      "<p class=\"sec-tag\">" + esc(p.tag) + "</p>" +
      "<h2 class=\"sec-title\">" + esc(p.title) + "</h2>" +
      "<p class=\"sec-sub\">" + esc(p.subtitle) + "</p>" +
      statRow(p.stats) +
      (p.intro ? "<p class=\"intro-text\">" + esc(p.intro) + "</p>" : "") +
      "<div class=\"tab-bar\">" + tabBar + "</div>" +
      "<div class=\"" + gridClass + "\" id=\"panel-" + esc(p.id) + "\">" +
      "<div class=\"panel-img\">" + tabContentHtml(first, viewId) + "</div>" +
      "<div class=\"panel-text\">" + summaryPanel(textSummary) + "</div>" +
      "</div></section>"
    );
  }

  function initImageViewer(el, id) {
    var img = el.querySelector("img");
    var stack = el.querySelector(".viewer-stack");
    var target = stack || img;
    if (!target) return;

    var state = { scale: 1, tx: 0, ty: 0, dragging: false, lx: 0, ly: 0 };

    function apply() {
      target.style.transform = "translate(" + state.tx + "px," + state.ty + "px) scale(" + state.scale + ")";
      target.style.transformOrigin = "0 0";
    }

    function fit() {
      state.scale = 1;
      state.tx = 0;
      state.ty = 0;
      if (stack) {
        apply();
        return;
      }
      if (!img) return;
      var pw = el.clientWidth;
      var ph = el.clientHeight;
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      state.scale = Math.min(pw / iw, ph / ih) * 0.96;
      state.tx = (pw - iw * state.scale) / 2;
      state.ty = (ph - ih * state.scale) / 2;
      apply();
    }

    el.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      state.dragging = true;
      state.lx = e.clientX;
      state.ly = e.clientY;
    });
    window.addEventListener("mousemove", function (e) {
      if (!state.dragging) return;
      state.tx += e.clientX - state.lx;
      state.ty += e.clientY - state.ly;
      state.lx = e.clientX;
      state.ly = e.clientY;
      apply();
    });
    window.addEventListener("mouseup", function () {
      state.dragging = false;
    });
    el.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var rect = el.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        var delta = e.deltaY < 0 ? 1.12 : 0.89;
        var ns = Math.min(8, Math.max(0.2, state.scale * delta));
        var ratio = ns / state.scale;
        state.tx = cx - ratio * (cx - state.tx);
        state.ty = cy - ratio * (cy - state.ty);
        state.scale = ns;
        apply();
      },
      { passive: false }
    );

    if (img && !img.complete) img.onload = fit;
    else fit();

    viewers[id] = {
      zoom: function (f) {
        var cx = el.clientWidth / 2;
        var cy = el.clientHeight / 2;
        var ns = Math.min(8, Math.max(0.2, state.scale * f));
        var ratio = ns / state.scale;
        state.tx = cx - ratio * (cx - state.tx);
        state.ty = cy - ratio * (cy - state.ty);
        state.scale = ns;
        apply();
      },
      reset: fit,
    };
  }

  function isEmbedded() {
    return window.self !== window.top;
  }

  function getRequestedSectionId() {
    var fromHash = (location.hash || "").replace(/^#/, "");
    if (fromHash) return fromHash;
    try {
      var params = new URLSearchParams(location.search || "");
      return params.get("section") || "";
    } catch (e) {
      return "";
    }
  }

  function initMapViewer(el, id, layerKey) {
    destroyViewer(id);
    if (window.LeafletAnalysisMap) {
      viewers[id] = window.LeafletAnalysisMap.create(el, layerKey);
      scheduleViewerRefresh(el.closest(".immersive-stage") || el.parentElement || el);
      return;
    }
    if (!window.MapViewer) return;
    var mv = new window.MapViewer(el, {});
    viewers[id] = mv;
    mv.load("assets/map-data/" + layerKey + ".json").catch(function () {});
  }

  function destroyViewer(id) {
    var v = viewers[id];
    if (!v) {
      if (window.ImmersiveMap) window.ImmersiveMap.destroy(id);
      return;
    }
    if (v.map && v.map.remove) {
      try { v.map.remove(); } catch (e) {}
    }
    delete viewers[id];
    if (window.ImmersiveMap) window.ImmersiveMap.destroy(id);
  }

  function bridgeImmersiveViewer(id) {
    viewers[id] = {
      reset: function () {
        if (window.ImmersiveMap) window.ImmersiveMap.refresh(id);
      },
      zoomBy: function (factor) {
        var slot = window.ImmersiveMap && window.ImmersiveMap.get(id);
        if (slot && slot.handle && slot.handle.zoomBy) slot.handle.zoomBy(factor);
      },
    };
  }

  function mountImmersiveMap(el, id, layerKey) {
    if (!window.ImmersiveMap) {
      initMapViewer(el, id, layerKey);
      return;
    }
    bridgeImmersiveViewer(id);
    window.ImmersiveMap.mount(id, el, layerKey);
  }

  function refreshViewerEl(el) {
    var id = el.getAttribute("data-viewer-id");
    if (el.closest(".section-immersive") && el.getAttribute("data-viewer-type") === "map") {
      if (window.ImmersiveMap) window.ImmersiveMap.refresh(id);
      return;
    }
    var v = viewers[id];
    if (!v) return;
    if (v.draw) v.draw();
    if (v.map && v.map.invalidateSize) {
      v.map.invalidateSize(true);
      if (v.reset) v.reset();
    } else if (v.reset) {
      v.reset();
    }
  }

  function refreshViewersIn(root) {
    if (!root) return;
    root.querySelectorAll("[data-viewer-id]").forEach(refreshViewerEl);
  }

  function scheduleViewerRefresh(root) {
    if (!root) return;
    function run() {
      refreshViewersIn(root);
    }
    run();
    requestAnimationFrame(run);
    setTimeout(run, 60);
    setTimeout(run, 280);
    setTimeout(run, 800);
  }

  function scrollToHashOnLoad() {
    if (isEmbedded()) return;
    var id = getRequestedSectionId();
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "instant", block: "start" });
    scheduleViewerRefresh(el);
  }

  function observeImmersiveSections() {
    if (typeof IntersectionObserver === "undefined") return;
    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) scheduleViewerRefresh(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".section-immersive").forEach(function (s) {
      obs.observe(s);
    });
  }

  function initChartViewer(el, id, layerKey) {
    function bindResize(viewer, el) {
      if (!viewer || typeof ResizeObserver === "undefined") return;
      var ro = new ResizeObserver(function () {
        if (viewer.draw) viewer.draw();
      });
      ro.observe(el);
    }
    var embedded = window.MAP_LAYERS && window.MAP_LAYERS[layerKey];
    if (embedded && window.ChartViewer) {
      viewers[id] = new window.ChartViewer(el, embedded);
      bindResize(viewers[id], el);
      scheduleViewerRefresh(el.parentElement || el);
      return;
    }
    fetch("assets/map-data/" + layerKey + ".json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        viewers[id] = new window.ChartViewer(el, data);
        bindResize(viewers[id], el);
        scheduleViewerRefresh(el.parentElement || el);
      })
      .catch(function () {});
  }

  function initMatrixViewer(el, id, layerKey) {
    function bindResize(viewer, el) {
      if (!viewer || typeof ResizeObserver === "undefined") return;
      var ro = new ResizeObserver(function () {
        if (viewer.draw) viewer.draw();
      });
      ro.observe(el);
    }
    function attach(data) {
      if (!data || !data.values) return;
      viewers[id] = new window.MatrixViewer(el, data);
      bindResize(viewers[id], el);
      scheduleViewerRefresh(el.parentElement || el);
    }
    var embedded = window.MAP_LAYERS && window.MAP_LAYERS[layerKey];
    if (embedded && embedded.values && window.MatrixViewer) {
      attach(embedded);
      return;
    }
    fetch("assets/map-data/" + layerKey + ".json")
      .then(function (r) {
        return r.json();
      })
      .then(attach)
      .catch(function () {});
  }

  function initViewerIn(root) {
    var boxes = root.querySelectorAll("[data-viewer-id]");
    boxes.forEach(function (el) {
      var id = el.getAttribute("data-viewer-id");
      var type = el.getAttribute("data-viewer-type");
      var layer = el.getAttribute("data-layer");
      if (type === "map" && el.closest(".section-immersive")) {
        mountImmersiveMap(el, id, layer);
        return;
      }
      destroyViewer(id);
      if (type === "map") initMapViewer(el, id, layer);
      else if (type === "chart") initChartViewer(el, id, layer);
      else if (type === "matrix") initMatrixViewer(el, id, layer);
      else initImageViewer(el, id);
    });
  }

  function bootEmbeddedMaps() {
    if (!isEmbedded()) return;
    var target = getRequestedSectionId();
    var section = target ? document.getElementById(target) : null;
    if (!section) section = document.querySelector(".section");
    if (!section) return;

    document.querySelectorAll(".section").forEach(function (s) {
      var show = s === section;
      s.style.display = show ? "" : "none";
      if (show) {
        s.style.minHeight = "100vh";
        s.style.height = "100vh";
      }
    });

    if (section.dataset.zoningReady !== "1") {
      initViewerIn(section);
      section.dataset.zoningReady = "1";
    }
    scheduleViewerRefresh(section);
  }

  if (typeof window !== "undefined") {
    window.__zoningRefresh = bootEmbeddedMaps;
    window.__zoningReinitVisible = bootEmbeddedMaps;
    window.__zoningMapBoot = bootEmbeddedMaps;
    window.addEventListener("hashchange", function () {
      if (isEmbedded()) bootEmbeddedMaps();
    });
  }

  function switchImmersiveTab(pageId, tabId, btn) {
    var page = pageMap[pageId];
    if (!page || !page.tabs) return;
    var tab = null;
    page.tabs.forEach(function (t) {
      if (t.id === tabId) tab = t;
    });
    if (!tab) return;
    var section = document.getElementById(pageId);
    var stage = document.getElementById("panel-" + pageId);
    var hud = document.getElementById("hud-" + pageId);
    var layerTag = document.getElementById("layer-tag-" + pageId);
    if (!section || !stage) return;
    setActive(section, "[data-tab=\"" + pageId + "\"]", btn, tabAccent(page));
    var viewId = pageId + "-view";
    destroyViewer(viewId);
    var wrap = stage.querySelector(".immersive-viewer-wrap");
    if (wrap) wrap.innerHTML = immersiveViewerHtml(tab, viewId);
    if (hud) hud.innerHTML = compactHud(tab.summary || page.summary, null, tab.label);
    if (layerTag) layerTag.textContent = tab.label;
    if (tab.mapLayer) {
      var mapEl = stage.querySelector("[data-viewer-id=\"" + viewId + "\"]");
      if (mapEl) mountImmersiveMap(mapEl, viewId, tab.mapLayer);
    } else {
      initViewerIn(stage);
    }
    scheduleViewerRefresh(stage);
  }

  function switchTab(pageId, tabId, btn) {
    var page = pageMap[pageId];
    if (page && page.layout === "immersive-map") {
      switchImmersiveTab(pageId, tabId, btn);
      return;
    }
    var page = pageMap[pageId];
    if (!page || !page.tabs) return;
    var tab = null;
    page.tabs.forEach(function (t) {
      if (t.id === tabId) tab = t;
    });
    if (!tab) return;
    var section = document.getElementById(pageId);
    var panel = document.getElementById("panel-" + pageId);
    if (!section || !panel) return;
    setActive(section, "[data-tab=\"" + pageId + "\"]", btn, tabAccent(page));
    var viewId = pageId + "-view";
    destroyViewer(viewId);
    var gridClass = "panel-grid left-img" + (page.group === "design-zoning" ? " zoning-text" : "");
    var textSummary = tab.summary || page.summary;
    panel.innerHTML =
      "<div class=\"panel-img\">" + tabContentHtml(tab, viewId) + "</div>" +
      "<div class=\"panel-text\">" + summaryPanel(textSummary) + "</div>";
    initViewerIn(panel);
  }

  function bindGlobal() {
    document.addEventListener("click", function (e) {
      var tabBtn = e.target.closest("[data-tab-id][data-tab]");
      if (tabBtn) {
        e.preventDefault();
        switchTab(tabBtn.getAttribute("data-tab"), tabBtn.getAttribute("data-tab-id"), tabBtn);
        return;
      }
      var inBtn = e.target.closest("[data-vzoom-in]");
      if (inBtn) {
        e.preventDefault();
        var v = viewers[inBtn.getAttribute("data-vzoom-in")];
        if (v && v.zoom) v.zoom(1.25);
        else if (v && v.zoomBy) v.zoomBy(1.25);
        return;
      }
      var outBtn = e.target.closest("[data-vzoom-out]");
      if (outBtn) {
        e.preventDefault();
        var v2 = viewers[outBtn.getAttribute("data-vzoom-out")];
        if (v2 && v2.zoom) v2.zoom(0.8);
        else if (v2 && v2.zoomBy) v2.zoomBy(0.8);
        return;
      }
      var resetBtn = e.target.closest("[data-vzoom-reset]");
      if (resetBtn) {
        e.preventDefault();
        var v3 = viewers[resetBtn.getAttribute("data-vzoom-reset")];
        if (v3 && v3.reset) v3.reset();
      }
    });
  }

  function render() {
    var main = document.getElementById("main");
    var sideNav = document.getElementById("side-nav");
    var headerNav = document.getElementById("header-nav");
    if (!main) return;

    var html = "";
    pages.forEach(function (p) {
      if (p.type === "index") html += renderIndex(p);
      else if (p.layout === "single-left-image") html += renderSinglePage(p);
      else if (p.layout === "immersive-map" && p.tabs) html += renderImmersivePage(p);
      else if (p.tabs) html += renderTabPage(p);
    });
    main.innerHTML = html;

    var navSections = main.querySelectorAll("[data-nav]");
    if (sideNav) {
      sideNav.innerHTML = navSections
        .map(function (s) {
          return "<a href=\"#" + s.id + "\"></a>";
        })
        .join("");
    }
    if (headerNav) {
      var links = [
        { id: "index", label: "目录" },
        { id: "poi-cluster", label: "POI聚类" },
        { id: "poi-three-types", label: "三种POI" },
        { id: "poi-density", label: "密度分析" },
        { id: "zoning-logic", label: "分区逻辑" },
        { id: "zoning-verify", label: "分区印证" },
        { id: "zoning-matrix", label: "适配矩阵" },
      ];
      headerNav.innerHTML = links
        .map(function (l) {
          return "<a href=\"#" + l.id + "\">" + esc(l.label) + "</a>";
        })
        .join("");
    }

    if (!isEmbedded()) {
      initViewerIn(main);
      scheduleViewerRefresh(main);
    } else {
      bootEmbeddedMaps();
      window.addEventListener("load", bootEmbeddedMaps);
      [100, 400, 1000].forEach(function (ms) {
        setTimeout(bootEmbeddedMaps, ms);
      });
    }
    observeImmersiveSections();

    window.addEventListener("resize", function () {
      Object.keys(viewers).forEach(function (id) {
        var v = viewers[id];
        if (v && v.reset) v.reset();
        if (v && v.map && v.map.invalidateSize) v.map.invalidateSize();
      });
    });

    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var id = entry.target.id;
            var accent = entry.target.getAttribute("data-accent") || "red";
            if (sideNav) {
              sideNav.querySelectorAll("a").forEach(function (a) {
                var on = a.getAttribute("href") === "#" + id;
                a.classList.toggle("active", on);
                a.classList.toggle("blue", on && accent === "blue");
              });
            }
            if (headerNav) {
              headerNav.querySelectorAll("a").forEach(function (a) {
                var on = a.getAttribute("href") === "#" + id;
                a.classList.toggle("active", on);
                a.classList.toggle("blue", on && accent === "blue");
              });
            }
          });
        },
        { threshold: 0.35 }
      );
      navSections.forEach(function (s) {
        observer.observe(s);
      });
    }
    document.body.classList.add("app-ready");
    scrollToHashOnLoad();
  }

  function boot() {
    bindGlobal();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
