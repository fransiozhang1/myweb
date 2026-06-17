/**
 * Immersive map mount — waits for real pixel dimensions before creating Leaflet.
 */
(function (global) {
  "use strict";

  var slots = {};

  function isEmbed() {
    return document.body.classList.contains("embed");
  }

  function stageHeight(el) {
    var stage = el && el.closest ? el.closest(".immersive-stage") : null;
    if (stage && stage.clientHeight >= 120) return stage.clientHeight;
    return Math.max(320, window.innerHeight - (isEmbed() ? 48 : 96));
  }

  function applyMountSize(el) {
    var stage = el.closest(".immersive-stage");
    var w = stage && stage.clientWidth >= 80 ? stage.clientWidth : el.parentElement ? el.parentElement.clientWidth : window.innerWidth;
    var h = stageHeight(el);
    if (w < 80) w = Math.max(320, window.innerWidth - 16);
    el.style.boxSizing = "border-box";
    el.style.width = "100%";
    el.style.maxWidth = "100%";
    el.style.height = h + "px";
    el.style.minHeight = h + "px";
    return el.clientWidth >= 80 && el.clientHeight >= 80;
  }

  function destroySlot(id) {
    var slot = slots[id];
    if (!slot) return;
    if (slot.waitRo) {
      slot.waitRo.disconnect();
      slot.waitRo = null;
    }
    if (slot.resizeRo) {
      slot.resizeRo.disconnect();
      slot.resizeRo = null;
    }
    if (slot.handle) {
      if (slot.handle.destroy) slot.handle.destroy();
      else if (slot.handle.map && slot.handle.map.remove) slot.handle.map.remove();
      slot.handle = null;
    }
    if (slot.el) slot.el.innerHTML = "";
    delete slots[id];
  }

  function bindResize(slot) {
    if (typeof ResizeObserver === "undefined" || !slot.el) return;
    if (slot.resizeRo) slot.resizeRo.disconnect();
    slot.resizeRo = new ResizeObserver(function () {
      applyMountSize(slot.el);
      if (slot.handle && slot.handle.reset) slot.handle.reset();
      else if (slot.handle && slot.handle.map && slot.handle.map.invalidateSize) {
        slot.handle.map.invalidateSize(true);
      }
    });
    slot.resizeRo.observe(slot.el);
    var stage = slot.el.closest(".immersive-stage");
    if (stage) slot.resizeRo.observe(stage);
  }

  function createMap(slot) {
    if (!slot.el || !slot.layerKey || !global.LeafletAnalysisMap) return false;
    applyMountSize(slot.el);
    if (slot.el.clientWidth < 80 || slot.el.clientHeight < 80) return false;

    if (slot.handle) {
      if (slot.handle.destroy) slot.handle.destroy();
      else if (slot.handle.map && slot.handle.map.remove) slot.handle.map.remove();
      slot.handle = null;
    }
    slot.el.innerHTML = "";

    slot.handle = global.LeafletAnalysisMap.create(slot.el, slot.layerKey);
    bindResize(slot);
    return !!(slot.handle && slot.handle.map);
  }

  function mountWhenReady(slot) {
    if (createMap(slot)) {
      if (slot.waitRo) {
        slot.waitRo.disconnect();
        slot.waitRo = null;
      }
      return;
    }

    if (slot.waitRo) return;

    function attempt() {
      if (createMap(slot) && slot.waitRo) {
        slot.waitRo.disconnect();
        slot.waitRo = null;
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      slot.waitRo = new ResizeObserver(attempt);
      slot.waitRo.observe(slot.el);
      var stage = slot.el.closest(".immersive-stage");
      if (stage) slot.waitRo.observe(stage);
      if (slot.el.parentElement) slot.waitRo.observe(slot.el.parentElement);
    }

    [0, 50, 120, 300, 600, 1200, 2000].forEach(function (ms) {
      setTimeout(attempt, ms);
    });
    window.addEventListener("load", attempt, { once: true });
  }

  function mountMap(viewId, container, layerKey) {
    if (!container || !layerKey) return null;
    destroySlot(viewId);
    var slot = { id: viewId, el: container, layerKey: layerKey, handle: null, waitRo: null, resizeRo: null };
    slots[viewId] = slot;
    mountWhenReady(slot);
    return slot;
  }

  function refresh(viewId) {
    var slot = slots[viewId];
    if (!slot) return;
    if (slot.handle && slot.handle.reset) {
      applyMountSize(slot.el);
      slot.handle.reset();
    } else if (slot.layerKey) {
      mountWhenReady(slot);
    }
  }

  function refreshVisibleSection() {
    var target = (location.hash || "").replace(/^#/, "");
    if (!target) return;
    refresh(target + "-view");
    var slot = slots[target + "-view"];
    if (!slot || !slot.handle) {
      var section = document.getElementById(target);
      if (!section) return;
      var el = section.querySelector(".immersive-viewer[data-viewer-type=\"map\"]");
      if (el) {
        var layer = el.getAttribute("data-layer");
        if (layer) mountMap(target + "-view", el, layer);
      }
    }
  }

  function bootEmbed() {
    if (global.self === global.top) return;
    var target = (location.hash || "").replace(/^#/, "");
    if (!target) return;

    document.querySelectorAll(".section").forEach(function (section) {
      var show = section.id === target;
      section.style.display = show ? "" : "none";
      if (show) {
        section.style.minHeight = "100vh";
        section.style.height = "100vh";
      }
    });

    var section = document.getElementById(target);
    if (!section) return;
    var viewId = target + "-view";
    var el = section.querySelector(".immersive-viewer[data-viewer-type=\"map\"]");
    if (!el) return;
    var layer = el.getAttribute("data-layer");
    if (!layer) return;

    function runMount() {
      applyMountSize(el);
      var slot = slots[viewId];
      if (slot && slot.handle && slot.handle.map) {
        slot.handle.reset();
        return;
      }
      mountMap(viewId, el, layer);
    }

    runMount();
    requestAnimationFrame(function () {
      requestAnimationFrame(runMount);
    });
    [120, 400, 900, 1800].forEach(function (ms) {
      setTimeout(runMount, ms);
    });
  }

  global.ImmersiveMap = {
    mount: mountMap,
    destroy: destroySlot,
    refresh: refresh,
    bootEmbed: bootEmbed,
    refreshVisible: refreshVisibleSection,
    get: function (id) {
      return slots[id] || null;
    },
  };

  global.__zoningMapBoot = bootEmbed;
  global.__zoningReinitVisible = bootEmbed;
  global.__zoningRefresh = refreshVisibleSection;
})(window);
