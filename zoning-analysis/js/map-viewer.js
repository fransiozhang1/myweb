(function (global) {
  "use strict";

  var CMAPS = {
    inferno: ["#000004", "#420a68", "#932667", "#dd513a", "#fca50a", "#fcffa4"],
    viridis: ["#440154", "#31688e", "#35b779", "#fde725"],
    plasma: ["#0d0887", "#7e03a8", "#cc4778", "#f89441", "#f0f921"],
    magma: ["#000004", "#3b0f70", "#8c2981", "#de4964", "#fca636", "#fcfdbf"],
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function colorFromCmap(cmap, t) {
    var pal = CMAPS[cmap] || CMAPS.inferno;
    t = Math.max(0, Math.min(1, t));
    var idx = t * (pal.length - 1);
    var i = Math.floor(idx);
    var f = idx - i;
    if (i >= pal.length - 1) return pal[pal.length - 1];
    var c1 = pal[i], c2 = pal[i + 1];
    function h(s) {
      return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    }
    var a = h(c1), b = h(c2);
    return "rgb(" + Math.round(lerp(a[0], b[0], f)) + "," + Math.round(lerp(a[1], b[1], f)) + "," + Math.round(lerp(a[2], b[2], f)) + ")";
  }

  function MapViewer(container, options) {
    this.container = container;
    this.opts = options || {};
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.dragging = false;
    this.lx = 0;
    this.ly = 0;
    this.data = null;
    this.baseImg = null;
    this.bbox = null;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "map-canvas";
    container.innerHTML = "";
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    var self = this;

    this.canvas.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      self.dragging = true;
      self.lx = e.clientX;
      self.ly = e.clientY;
    });
    window.addEventListener("mousemove", function (e) {
      if (!self.dragging) return;
      self.tx += e.clientX - self.lx;
      self.ty += e.clientY - self.ly;
      self.lx = e.clientX;
      self.ly = e.clientY;
      self.draw();
    });
    window.addEventListener("mouseup", function () {
      self.dragging = false;
    });
    this.canvas.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        var rect = self.canvas.getBoundingClientRect();
        var cx = e.clientX - rect.left;
        var cy = e.clientY - rect.top;
        var delta = e.deltaY < 0 ? 1.12 : 0.89;
        var ns = Math.min(10, Math.max(0.2, self.scale * delta));
        var ratio = ns / self.scale;
        self.tx = cx - ratio * (cx - self.tx);
        self.ty = cy - ratio * (cy - self.ty);
        self.scale = ns;
        self.draw();
      },
      { passive: false }
    );
  }

  MapViewer.prototype.worldToScreen = function (x, y) {
    var minx = this.bbox[0], miny = this.bbox[1], maxx = this.bbox[2], maxy = this.bbox[3];
    var pw = this.canvas.width;
    var ph = this.canvas.height;
    var sx = ((x - minx) / (maxx - minx)) * pw;
    var sy = ph - ((y - miny) / (maxy - miny)) * ph;
    return [sx * this.scale + this.tx, sy * this.scale + this.ty];
  };

  MapViewer.prototype.drawRing = function (rings, fill, alpha, stroke, strokeW) {
    var ctx = this.ctx;
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      if (!ring.length) continue;
      ctx.beginPath();
      var p0 = this.worldToScreen(ring[0][0], ring[0][1]);
      ctx.moveTo(p0[0], p0[1]);
      for (var i = 1; i < ring.length; i++) {
        var p = this.worldToScreen(ring[i][0], ring[i][1]);
        ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.globalAlpha = alpha || 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeW || 1;
        ctx.stroke();
      }
    }
  };

  MapViewer.prototype.draw = function () {
    if (!this.bbox) return;
    var ctx = this.ctx;
    var w = this.container.clientWidth;
    var h = this.container.clientHeight;
    if (w < 10 || h < 10) return;
    this.canvas.width = w;
    this.canvas.height = h;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    if (this.baseImg && this.baseImg.complete) {
      ctx.save();
      ctx.translate(this.tx, this.ty);
      ctx.scale(this.scale, this.scale);
      ctx.drawImage(this.baseImg, 0, 0, w, h);
      ctx.restore();
    }

    var d = this.data;
    if (!d) return;

    var layer = d.layer;
    if (layer && layer.features) {
      if (layer.type === "grid") {
        for (var i = 0; i < layer.features.length; i++) {
          var f = layer.features[i];
          var t = (f.v - layer.vmin) / (layer.vmax - layer.vmin);
          var col = colorFromCmap(layer.cmap, t);
          this.drawRing(f.rings, col, 0.82);
        }
      } else if (layer.type === "categorical") {
        for (var j = 0; j < layer.features.length; j++) {
          var cf = layer.features[j];
          this.drawRing(cf.rings, cf.color, 0.78);
        }
      } else if (layer.type === "highlight") {
        var zones = d.zones || [];
        for (var z = 0; z < zones.length; z++) {
          var zn = zones[z];
          var alpha = zn.id === layer.highlight ? 0.55 : 0.12;
          this.drawRing(zn.rings, zn.color, alpha, zn.id === layer.highlight ? "#fff" : zn.color, zn.id === layer.highlight ? 2 : 0.5);
        }
      }
    }

    var zones2 = d.zones || [];
    for (var k = 0; k < zones2.length; k++) {
      if (layer && layer.type === "highlight") continue;
      this.drawRing(zones2[k].rings, null, 0, zones2[k].color, 1.2);
    }

    if (d.redline && d.redline.length) {
      this.drawRing(d.redline, null, 0, "#E53935", 2);
    }

    var rails = d.rails || [];
    for (var ri = 0; ri < rails.length; ri++) {
      var ln = rails[ri];
      if (!ln.coords || ln.coords.length < 2) continue;
      ctx.beginPath();
      var s0 = this.worldToScreen(ln.coords[0][0], ln.coords[0][1]);
      ctx.moveTo(s0[0], s0[1]);
      for (var li = 1; li < ln.coords.length; li++) {
        var sp = this.worldToScreen(ln.coords[li][0], ln.coords[li][1]);
        ctx.lineTo(sp[0], sp[1]);
      }
      ctx.strokeStyle = ln.color || "#fff";
      ctx.lineWidth = (ln.width || 2) * this.scale;
      ctx.stroke();
    }

    var lines = d.lines || [];
    for (var li2 = 0; li2 < lines.length; li2++) {
      var l2 = lines[li2];
      if (!l2.coords || l2.coords.length < 2) continue;
      ctx.beginPath();
      var s1 = this.worldToScreen(l2.coords[0][0], l2.coords[0][1]);
      ctx.moveTo(s1[0], s1[1]);
      for (var lj = 1; lj < l2.coords.length; lj++) {
        var sp2 = this.worldToScreen(l2.coords[lj][0], l2.coords[lj][1]);
        ctx.lineTo(sp2[0], sp2[1]);
      }
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = l2.color || "#FFD54F";
      ctx.lineWidth = (l2.width || 1.2) * this.scale;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    var pts = d.points || [];
    for (var pi = 0; pi < pts.length; pi++) {
      var pt = pts[pi];
      var ps = this.worldToScreen(pt.xy[0], pt.xy[1]);
      ctx.beginPath();
      ctx.arc(ps[0], ps[1], (pt.size || 4) * this.scale, 0, Math.PI * 2);
      ctx.fillStyle = pt.color || "#FFB300";
      ctx.fill();
    }
  };

  MapViewer.prototype.fit = function () {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.draw();
  };

  MapViewer.prototype.reset = function () {
    this.fit();
  };

  MapViewer.prototype.zoomBy = function (factor) {
    var cx = this.canvas.width / 2;
    var cy = this.canvas.height / 2;
    var ns = Math.min(10, Math.max(0.2, this.scale * factor));
    var ratio = ns / this.scale;
    this.tx = cx - ratio * (cx - this.tx);
    this.ty = cy - ratio * (cy - this.ty);
    this.scale = ns;
    this.draw();
  };

  MapViewer.prototype.load = function (layerUrl) {
    var self = this;
    return fetch(layerUrl)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        self.data = data;
        self.bbox = data.bbox;
        if (data.base) {
          var img = new Image();
          img.onload = function () {
            self.baseImg = img;
            self.fit();
          };
          img.src = data.base;
        } else {
          self.fit();
        }
        return data;
      });
  };

  function ChartViewer(container, data) {
    this.container = container;
    this.data = data;
    this.layout = null;
    this.hoverIndex = -1;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "chart-canvas";
    this.tooltip = document.createElement("div");
    this.tooltip.className = "chart-tooltip";
    this.tooltip.style.display = "none";
    container.style.position = "relative";
    container.innerHTML = "";
    container.appendChild(this.canvas);
    container.appendChild(this.tooltip);
    this.ctx = this.canvas.getContext("2d");
    var self = this;
    this.canvas.addEventListener("mousemove", function (e) {
      self.onMouseMove(e);
    });
    this.canvas.addEventListener("mouseleave", function () {
      self.hideTooltip();
    });
    this.draw();
  }

  ChartViewer.prototype.hideTooltip = function () {
    this.hoverIndex = -1;
    this.tooltip.style.display = "none";
    this.draw();
  };

  ChartViewer.prototype.onMouseMove = function (e) {
    var L = this.layout;
    if (!L) return;
    var rect = this.canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (mx < L.pad.l || mx > L.w - L.pad.r || my < L.pad.t || my > L.h - L.pad.b) {
      this.hideTooltip();
      return;
    }
    var best = -1;
    var bestDist = Infinity;
    for (var i = 0; i < L.xs.length; i++) {
      var dist = Math.abs(L.X(L.xs[i]) - mx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (bestDist > 24) {
      this.hideTooltip();
      return;
    }
    this.hoverIndex = best;
    var lines = ["<strong>剖面列 " + L.xs[best] + "</strong>"];
    (this.data.series || []).forEach(
      function (s) {
        var arr = this.data.data[s.key] || [];
        if (arr[best] != null) {
          lines.push('<span style="color:' + s.color + '">' + esc(s.label) + "：</span>" + Number(arr[best]).toFixed(1));
        }
      }.bind(this)
    );
    this.tooltip.innerHTML = lines.join("<br>");
    this.tooltip.style.display = "block";
    this.tooltip.style.left = mx + 14 + "px";
    this.tooltip.style.top = my - 10 + "px";
    this.draw();
  };

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function drawWhenSized(viewer, drawFn) {
    var w = viewer.container.clientWidth;
    var h = viewer.container.clientHeight;
    if (w < 10 || h < 10) {
      viewer._sizeRetry = (viewer._sizeRetry || 0) + 1;
      if (viewer._sizeRetry < 24) {
        requestAnimationFrame(function () {
          drawFn.call(viewer);
        });
      }
      return false;
    }
    viewer._sizeRetry = 0;
    return true;
  }

  ChartViewer.prototype.draw = function () {
    var d = this.data;
    var canvas = this.canvas;
    var w = this.container.clientWidth;
    var h = this.container.clientHeight;
    if (!drawWhenSized(this, this.draw)) return;
    canvas.width = w;
    canvas.height = h;
    var ctx = this.ctx;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    if (!d || !d.x) return;

    var pad = { l: 48, r: 16, t: 24, b: 36 };
    var xs = d.x;
    var allY = [];
    (d.series || []).forEach(function (s) {
      var arr = d.data[s.key] || [];
      allY = allY.concat(arr);
    });
    var ymin = Math.min.apply(null, allY);
    var ymax = Math.max.apply(null, allY);
    if (ymax <= ymin) ymax = ymin + 1;
    var xmin = Math.min.apply(null, xs);
    var xmax = Math.max.apply(null, xs);
    if (xmax <= xmin) xmax = xmin + 1;

    function X(x) {
      return pad.l + ((x - xmin) / (xmax - xmin)) * (w - pad.l - pad.r);
    }
    function Y(y) {
      return pad.t + (1 - (y - ymin) / (ymax - ymin)) * (h - pad.t - pad.b);
    }

    this.layout = { pad: pad, w: w, h: h, xs: xs, X: X, Y: Y, ymin: ymin, ymax: ymax };

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();

    ctx.fillStyle = "#888";
    ctx.font = "11px SimHei, Microsoft YaHei, sans-serif";
    if (d.ylabel) ctx.fillText(d.ylabel, 4, pad.t + 10);
    if (d.xlabel) ctx.fillText(d.xlabel, w / 2 - 30, h - 6);

    (d.series || []).forEach(function (s) {
      var arr = d.data[s.key] || [];
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.dash ? 1.5 : 2;
      if (s.dash) ctx.setLineDash([5, 4]);
      for (var i = 0; i < xs.length && i < arr.length; i++) {
        var px = X(xs[i]);
        var py = Y(arr[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    if (this.hoverIndex >= 0 && this.hoverIndex < xs.length) {
      var hx = X(xs[this.hoverIndex]);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, h - pad.b);
      ctx.stroke();
      ctx.setLineDash([]);
      (d.series || []).forEach(
        function (s) {
          var arr = d.data[s.key] || [];
          if (arr[this.hoverIndex] == null) return;
          var px = hx;
          var py = Y(arr[this.hoverIndex]);
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1;
          ctx.stroke();
        }.bind(this)
      );
      ctx.restore();
    }
  };

  function colorFromRedScale(t) {
    t = Math.max(0, Math.min(1, t));
    var r = Math.round(28 + (229 - 28) * t);
    var g = Math.round(28 + (57 - 28) * t);
    var b = Math.round(28 + (53 - 28) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function MatrixViewer(container, data) {
    this.container = container;
    this.data = data;
    container.innerHTML = "";
    this.root = document.createElement("div");
    this.root.className = "matrix-view";
    container.appendChild(this.root);
    this.draw();
  }

  MatrixViewer.prototype.hideTooltip = function () {
    return;
  };

  MatrixViewer.prototype.onMouseMove = function (e) {
    return;
  };

  MatrixViewer.prototype.draw = function () {
    var d = this.data;
    if (!d || !d.values || !d.values.length) {
      this.root.innerHTML = "<div class=\"matrix-empty\">矩阵数据缺失</div>";
      return;
    }
    var n = d.values.length;
    var flat = [];
    d.values.forEach(function (row) {
      flat = flat.concat(row);
    });
    var vmin = Math.min.apply(null, flat);
    var vmax = Math.max.apply(null, flat);

    var colLabels = d.colLabels || [];
    var rowLabels = d.rowLabels || [];
    var html = "<div class=\"matrix-title\">" + esc(d.title || "功能适配矩阵") + "</div>";
    html += "<div class=\"matrix-grid\" style=\"grid-template-columns:minmax(92px,1.1fr) repeat(" + n + ", minmax(66px,1fr));\">";
    html += "<div class=\"matrix-corner\">功能类型</div>";
    for (var c = 0; c < n; c++) {
      html += "<div class=\"matrix-axis matrix-axis-col\">" + esc(colLabels[c] || ("列 " + (c + 1))) + "</div>";
    }
    for (var r = 0; r < n; r++) {
      html += "<div class=\"matrix-axis matrix-axis-row\">" + esc(rowLabels[r] || ("行 " + (r + 1))) + "</div>";
      for (c = 0; c < n; c++) {
        var v = d.values[r][c];
        var t = (v - vmin) / (vmax - vmin || 1);
        var bg = colorFromRedScale(t);
        var fg = t > 0.48 ? "#fff" : "#d4d4d4";
        var rowLabel = rowLabels[r] || ("行 " + (r + 1));
        var colLabel = colLabels[c] || ("列 " + (c + 1));
        html +=
          "<div class=\"matrix-cell\" style=\"--cell-bg:" + bg + ";--cell-fg:" + fg + "\" title=\"" +
          esc(rowLabel + " × " + colLabel + "：匹配度 " + Math.round(v)) +
          "\"><span>" + Math.round(v) + "</span></div>";
      }
    }
    html += "</div>";
    html += "<div class=\"matrix-legend\"><span>低适配</span><i></i><span>高适配</span></div>";
    this.root.innerHTML = html;
  };

  global.MapViewer = MapViewer;
  global.ChartViewer = ChartViewer;
  global.MatrixViewer = MatrixViewer;
})(window);
