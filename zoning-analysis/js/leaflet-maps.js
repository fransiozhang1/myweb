(function (global) {
  "use strict";

  var DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  var ATTR = "&copy; OpenStreetMap &copy; CARTO";
  var CMAPS = {
    inferno: ["#000004", "#420a68", "#932667", "#dd513a", "#fca50a", "#fcffa4"],
    viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
    plasma: ["#0d0887", "#7e03a8", "#cc4778", "#f89441", "#f0f921"],
    heat: ["#1a1a1a", "#2a3a5a", "#4488ff", "#e53935"],
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function tooltipOpts() {
    return {
      sticky: true,
      direction: "top",
      className: "map-tooltip",
      opacity: 0.96,
    };
  }

  function formatGridValue(v, st) {
    var n = typeof v === "number" ? v : parseFloat(v);
    if (isNaN(n)) return String(v);
    var dec = st && st.valueDecimals != null ? st.valueDecimals : 1;
    return n.toFixed(dec);
  }

  function poiTooltipHtml(p) {
    p = p || {};
    var name = p.name && p.name !== "nan" && p.name !== "None" ? p.name : "";
    var cat = p.cat && p.cat !== "nan" && p.cat !== "None" ? p.cat : "";
    var type = p.type && p.type !== "nan" && p.type !== "None" ? p.type : "";
    var title = name || cat || "POI 点";
    var html = "<strong>" + esc(title) + "</strong>";
    if (name && cat) html += '<br><span class="map-tooltip-sub">类别：' + esc(cat) + "</span>";
    if (type && type !== cat) html += '<br><span class="map-tooltip-sub">类型：' + esc(type) + "</span>";
    return html;
  }

  function bindHoverHighlight(layer, baseStyle, hoverStyle) {
    layer.on("mouseover", function () {
      this.setStyle(hoverStyle);
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        this.bringToFront();
      }
    });
    layer.on("mouseout", function () {
      this.setStyle(baseStyle);
    });
  }

  function colorFromCmap(cmap, t) {
    var pal = CMAPS[cmap] || CMAPS.heat;
    t = Math.max(0, Math.min(1, t));
    var idx = t * (pal.length - 1);
    var i = Math.floor(idx);
    var f = idx - i;
    if (i >= pal.length - 1) return pal[pal.length - 1];
    function h(s) {
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    }
    var a = h(pal[i]), b = h(pal[i + 1]);
    return (
      "rgb(" +
      Math.round(lerp(a[0], b[0], f)) +
      "," +
      Math.round(lerp(a[1], b[1], f)) +
      "," +
      Math.round(lerp(a[2], b[2], f)) +
      ")"
    );
  }

  function pickCmap(st) {
    if (st.type === "grid") return st.cmap === "inferno" || st.cmap === "plasma" ? "heat" : st.cmap;
    return st.cmap || "heat";
  }

  function ensureLeafletWrap(container) {
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "leaflet-wrap";
    var h = container.clientHeight;
    var w = container.clientWidth;
    if (h < 80) h = Math.max(320, window.innerHeight - 48);
    if (w < 80) w = container.parentElement ? container.parentElement.clientWidth : window.innerWidth;
    wrap.style.width = w + "px";
    wrap.style.height = h + "px";
    wrap.style.minHeight = h + "px";
    container.appendChild(wrap);
    return wrap;
  }

  function darkMap(el) {
    var base = global.MAP_BASE || {};
    var center = base.center || [31.2492, 121.4595];
    var zoom = base.zoom || 15;
    var map = L.map(el, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    L.tileLayer(DARK, { maxZoom: 19, attribution: ATTR }).addTo(map);
    L.control.zoom({ position: "bottomright", zoomInTitle: "放大", zoomOutTitle: "缩小" }).addTo(map);
    return map;
  }

  function addRails(map, data) {
    if (!data.rails) return;
    L.geoJSON(data.rails, {
      style: { color: "#cccccc", weight: 2.2, opacity: 0.85 },
    }).addTo(map);
  }

  function addRedline(map, data) {
    if (!data.redline) return;
    L.geoJSON(data.redline, {
      style: { color: "#e53935", weight: 2.5, dashArray: "6 4", fill: false, opacity: 0.95 },
      onEachFeature: function (_f, layer) {
        layer.bindTooltip("规划红线", tooltipOpts());
      },
    }).addTo(map);
  }

  function addZones(map, data, highlight) {
    if (!data.zones) return;
    L.geoJSON(data.zones, {
      style: function (f) {
        var id = f.properties && f.properties.zone_id;
        var isHi = highlight && id === highlight;
        return {
          color: isHi ? "#ffffff" : "#888888",
          weight: isHi ? 2.5 : 1,
          fillColor: isHi ? f.properties.color || "#4488ff" : "#000000",
          fillOpacity: isHi ? 0.35 : 0.05,
        };
      },
      onEachFeature: function (f, layer) {
        var p = f.properties || {};
        if (!p.zone_label) return;
        var html = "<strong>" + esc(p.zone_label) + "</strong>";
        if (p.zone_id) html += '<br><span class="map-tooltip-sub">分区：' + esc(p.zone_id) + "</span>";
        layer.bindTooltip(html, tooltipOpts());
        if (!highlight) {
          bindHoverHighlight(layer, { weight: 1, fillOpacity: 0.05 }, { weight: 2, fillOpacity: 0.18, color: "#ffffff" });
        }
      },
    }).addTo(map);
  }

  function addAnalysisLayer(map, data) {
    if (!data.geojson || !data.layerStyle) return null;
    var st = data.layerStyle;
    var cmap = pickCmap(st);
    var title = data.title || "指标";
    function featureStyle(f) {
      var p = f.properties || {};
      if (st.type === "grid") {
        var t = (p.v - st.vmin) / (st.vmax - st.vmin || 1);
        return {
          color: "rgba(255,255,255,0.08)",
          weight: 0.3,
          fillColor: colorFromCmap(cmap, t),
          fillOpacity: 0.88,
        };
      }
      if (st.type === "categorical") {
        return {
          color: "rgba(255,255,255,0.15)",
          weight: 0.4,
          fillColor: p.color || "#888",
          fillOpacity: 0.82,
        };
      }
      return { fillOpacity: 0.5 };
    }
    return L.geoJSON(data.geojson, {
      style: featureStyle,
      onEachFeature: function (f, layer) {
        var p = f.properties || {};
        var base = featureStyle(f);
        var hover = Object.assign({}, base, {
          weight: (base.weight || 0.4) + 1.2,
          fillOpacity: Math.min(1, (base.fillOpacity || 0.8) + 0.12),
          color: "rgba(255,255,255,0.55)",
        });
        bindHoverHighlight(layer, base, hover);

        if (st.type === "grid") {
          layer.bindTooltip(
            "<strong>" + esc(title) + "</strong><br>" + esc(formatGridValue(p.v, st)),
            tooltipOpts()
          );
        } else if (st.type === "categorical") {
          var html = "";
          if (p.label) html += "<strong>" + esc(p.label) + "</strong>";
          if (p.v) {
            html += (html ? "<br>" : "") + '<span class="map-tooltip-sub">' + esc(p.v) + "</span>";
          }
          if (!html) html = esc(p.v || "分类单元");
          layer.bindTooltip(html, tooltipOpts());
        }
      },
    }).addTo(map);
  }

  function addPoints(map, data) {
    if (!data.points) return;
    L.geoJSON(data.points, {
      pointToLayer: function (f, latlng) {
        var p = f.properties || {};
        var c = p.color || "#e53935";
        var size = p.size || 5;
        var marker = L.circleMarker(latlng, {
          radius: Math.max(size, 5),
          color: "#ffffff",
          weight: 0.8,
          fillColor: c,
          fillOpacity: 0.92,
        });
        marker.bindTooltip(poiTooltipHtml(p), tooltipOpts());
        marker.on("mouseover", function () {
          this.setRadius(Math.max(size, 5) + 3);
          this.setStyle({ weight: 2, fillOpacity: 1 });
        });
        marker.on("mouseout", function () {
          this.setRadius(Math.max(size, 5));
          this.setStyle({ weight: 0.8, fillOpacity: 0.92 });
        });
        return marker;
      },
    }).addTo(map);
  }

  function addLines(map, data) {
    if (!data.lines) return;
    L.geoJSON(data.lines, {
      style: function (f) {
        return {
          color: (f.properties && f.properties.color) || "#4488ff",
          weight: (f.properties && f.properties.weight) || 1.5,
          dashArray: "6 4",
          opacity: 0.9,
        };
      },
      onEachFeature: function (_f, layer) {
        layer.bindTooltip("站点缓冲圈", tooltipOpts());
        layer.on("mouseover", function () {
          this.setStyle({ weight: 2.5, opacity: 1 });
        });
        layer.on("mouseout", function () {
          this.setStyle({ weight: 1.2, opacity: 0.9 });
        });
      },
    }).addTo(map);
  }

  function addLegend(map, data) {
    var st = data.layerStyle;
    if (!st || st.type !== "grid") return;
    var cmap = pickCmap(st);
    var legend = L.control({ position: "bottomleft" });
    legend.onAdd = function () {
      var div = L.DomUtil.create("div", "map-legend");
      div.style.cssText =
        "background:rgba(10,10,10,0.88);border:1px solid #444;padding:8px 10px;font:11px SimHei,sans-serif;color:#ddd;line-height:1.4";
      var title = data.title || "密度";
      var html =
        '<div style="margin-bottom:6px;color:#fff;font-weight:700">' +
        title +
        "</div>";
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:10px;color:#888">低</span>';
      html +=
        '<div style="flex:1;height:10px;width:100px;background:linear-gradient(to right,' +
        CMAPS[cmap].join(",") +
        ')"></div>';
      html += '<span style="font-size:10px;color:#888">高</span>';
      html += "</div>";
      html +=
        '<div style="margin-top:4px;font-size:10px;color:#888">' +
        Math.round(st.vmin) +
        " – " +
        Math.round(st.vmax) +
        "</div>";
      html += '<div style="margin-top:4px;font-size:10px;color:#666">悬停格网查看数值</div>';
      div.innerHTML = html;
      return div;
    };
    legend.addTo(map);
  }

  function fitMap(map, data) {
    if (data.bounds) {
      map.fitBounds(data.bounds, { padding: [14, 14] });
    }
  }

  function refreshMap(map, data) {
    if (!map) return;
    map.invalidateSize(true);
    fitMap(map, data);
  }

  function createAnalysisMap(container, layerKey) {
    var data = (global.MAP_LAYERS && global.MAP_LAYERS[layerKey]) || null;
    if (!data) {
      container.innerHTML = "<p style='color:#888;padding:16px'>图层数据缺失</p>";
      return { reset: function () {}, zoomBy: function () {}, destroy: function () {} };
    }

    var wrap = ensureLeafletWrap(container);
    var map = darkMap(wrap);
    addRails(map, data);

    var highlight = data.layerStyle && data.layerStyle.type === "highlight" ? data.layerStyle.highlight : null;
    if (highlight) {
      addZones(map, data, highlight);
      addPoints(map, data);
      addLines(map, data);
      addRedline(map, data);
    } else {
      addZones(map, data, null);
      addAnalysisLayer(map, data);
      addRedline(map, data);
      addLegend(map, data);
    }

    function pulse() {
      refreshMap(map, data);
    }

    map.whenReady(pulse);
    pulse();
    requestAnimationFrame(pulse);
    setTimeout(pulse, 100);
    setTimeout(pulse, 400);

    return {
      map: map,
      data: data,
      reset: function () {
        refreshMap(map, data);
      },
      zoomBy: function (factor) {
        var z = map.getZoom();
        map.setZoom(Math.min(19, Math.max(12, z + (factor > 1 ? 1 : -1))));
      },
      destroy: function () {
        try {
          map.remove();
        } catch (e) {}
      },
    };
  }

  global.LeafletAnalysisMap = { create: createAnalysisMap };
})(window);
