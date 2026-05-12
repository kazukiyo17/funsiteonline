/**
 * 萌宠 MBTI — 分享图 Canvas（share.html）
 */
(function (global) {
  var SHARE_W = 1080;
  var SHARE_H = 1350;
  var SHARE_IMG_H = Math.round(SHARE_H * 0.6);
  var SHARE_SITE_LINE = "funsite.online";

  function touchPinchDistance(t0, t1) {
    var dx = t0.clientX - t1.clientX;
    var dy = t0.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampImagePan(iw, ih, slotW, slotH, zoom, panX, panY) {
    var z = Math.max(1, zoom || 1);
    if (!iw || !ih || iw < 1 || ih < 1) {
      return { panX: 0, panY: 0 };
    }
    var sCover = Math.max(slotW / iw, slotH / ih);
    var s = sCover * z;
    var dw = iw * s;
    var dh = ih * s;
    var x0 = (slotW - dw) / 2;
    var y0 = (slotH - dh) / 2;
    var minPanX = slotW - dw - x0;
    var maxPanX = -x0;
    var minPanY = slotH - dh - y0;
    var maxPanY = -y0;
    return {
      panX: Math.min(maxPanX, Math.max(minPanX, panX)),
      panY: Math.min(maxPanY, Math.max(minPanY, panY)),
    };
  }

  function pathTopRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
    ctx.closePath();
  }

  function pathFullRoundedRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
    ctx.lineTo(x + rr, y + h);
    ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + rr);
    ctx.arc(x + rr, y + rr, rr, Math.PI, -Math.PI / 2);
    ctx.closePath();
  }

  function collectRoundedRectTrailSamples(x, y, rw, rh, r, step) {
    var rr = Math.min(r, rw / 2, rh / 2);
    var pts = [];

    function pushLine(x0, y0, x1, y1) {
      var L = Math.hypot(x1 - x0, y1 - y0);
      var n = Math.floor(L / step);
      var tang = Math.atan2(y1 - y0, x1 - x0);
      for (var i = 1; i < n; i++) {
        var t = i / n;
        pts.push({
          x: x0 + (x1 - x0) * t,
          y: y0 + (y1 - y0) * t,
          tang: tang,
        });
      }
    }

    function pushArc(cx, cy, rad, a0, a1) {
      var arcLen = Math.abs(a1 - a0) * rad;
      var n = Math.max(2, Math.floor(arcLen / step));
      for (var i = 1; i < n; i++) {
        var t = i / n;
        var a = a0 + (a1 - a0) * t;
        pts.push({
          x: cx + rad * Math.cos(a),
          y: cy + rad * Math.sin(a),
          tang: a + Math.PI / 2,
        });
      }
    }

    pushLine(x + rr, y, x + rw - rr, y);
    pushArc(x + rw - rr, y + rr, rr, -Math.PI / 2, 0);
    pushLine(x + rw, y + rr, x + rw, y + rh - rr);
    pushArc(x + rw - rr, y + rh - rr, rr, 0, Math.PI / 2);
    pushLine(x + rw - rr, y + rh, x + rr, y + rh);
    pushArc(x + rr, y + rh - rr, rr, Math.PI / 2, Math.PI);
    pushLine(x, y + rh - rr, x, y + rr);
    pushArc(x + rr, y + rr, rr, Math.PI, -Math.PI / 2);

    return pts;
  }

  function drawSparkleTrail(ctx, w, h, inset, cornerR, step) {
    var rw = w - 2 * inset;
    var rh = h - 2 * inset;
    if (rw < 80 || rh < 80) return;

    var pts = collectRoundedRectTrailSamples(inset, inset, rw, rh, cornerR, step);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '40px Fredoka, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tang - Math.PI / 2 + (i % 5) * 0.22);
      ctx.shadowColor = "rgba(255, 255, 255, 0.95)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
      ctx.globalAlpha = 0.93;
      ctx.fillText("✨", 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawCuteShareBorder(ctx, w, h) {
    var outerInset = 8;
    var outerR = 44;
    var midInset = 18;
    var midR = 38;
    var innerInset = 28;
    var innerR = 32;
    ctx.save();
    ctx.lineJoin = "round";

    pathFullRoundedRect(ctx, outerInset, outerInset, w - 2 * outerInset, h - 2 * outerInset, outerR);
    ctx.strokeStyle = "#fbcfe8";
    ctx.lineWidth = 18;
    ctx.stroke();

    pathFullRoundedRect(ctx, midInset, midInset, w - 2 * midInset, h - 2 * midInset, midR);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    ctx.stroke();

    pathFullRoundedRect(ctx, innerInset, innerInset, w - 2 * innerInset, h - 2 * innerInset, innerR);
    ctx.strokeStyle = "#fb923c";
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = "butt";

    var dotR = 9;
    var corners = [
      [innerInset + innerR * 0.85, innerInset + innerR * 0.85],
      [w - innerInset - innerR * 0.85, innerInset + innerR * 0.85],
      [w - innerInset - innerR * 0.85, h - innerInset - innerR * 0.85],
      [innerInset + innerR * 0.85, h - innerInset - innerR * 0.85],
    ];
    for (var c = 0; c < corners.length; c++) {
      ctx.beginPath();
      ctx.arc(corners[c][0], corners[c][1], dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#fda4af";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    var sparkleInset = 22;
    var sparkleCornerR = 37;
    var sparkleStep = 248;
    drawSparkleTrail(ctx, w, h, sparkleInset, sparkleCornerR, sparkleStep);

    ctx.restore();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    if (!text) return [];
    text = String(text).trim();
    if (!text) return [];
    var lines = [];
    var rest = text;
    while (rest.length && lines.length < maxLines) {
      if (ctx.measureText(rest).width <= maxWidth) {
        lines.push(rest);
        break;
      }
      var low = 1;
      var high = rest.length;
      var fit = 1;
      while (low <= high) {
        var mid = (low + high) >> 1;
        if (ctx.measureText(rest.slice(0, mid)).width <= maxWidth) {
          fit = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      lines.push(rest.slice(0, fit));
      rest = rest.slice(fit).replace(/^\s+/, "");
    }
    if (rest.length && lines.length >= maxLines) {
      var last = lines[maxLines - 1];
      var ell = "…";
      while (last.length > 1 && ctx.measureText(last + ell).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + ell;
    }
    return lines;
  }

  function drawShareCard(canvas, userImg, petName, typeCode, typeNick, petEmoji, petLabel, imgTransform) {
    var ctx = canvas.getContext("2d");
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;

    var cx = SHARE_W / 2;
    var imgH = SHARE_IMG_H;
    var cornerR = 44;
    var iz = imgTransform && imgTransform.zoom != null ? imgTransform.zoom : 1;
    if (iz < 1) iz = 1;
    var ipx = imgTransform && imgTransform.panX != null ? imgTransform.panX : 0;
    var ipy = imgTransform && imgTransform.panY != null ? imgTransform.panY : 0;
    var displayName = (petName && petName.trim()) || "我家毛孩子";
    var nickMaxW = SHARE_W - 100;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    var bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
    bg.addColorStop(0, "#fff4e6");
    bg.addColorStop(0.55, "#ffffff");
    bg.addColorStop(1, "#fff7ed");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);

    ctx.save();
    pathTopRoundedRect(ctx, 0, 0, SHARE_W, imgH, cornerR);
    ctx.clip();
    if (userImg && userImg.complete && userImg.naturalWidth) {
      var iw = userImg.naturalWidth;
      var ih = userImg.naturalHeight;
      var sCover = Math.max(SHARE_W / iw, imgH / ih);
      var s = sCover * iz;
      var dw = iw * s;
      var dh = ih * s;
      var x0 = (SHARE_W - dw) / 2;
      var y0 = (imgH - dh) / 2;
      ctx.drawImage(userImg, x0 + ipx, y0 + ipy, dw, dh);
    } else {
      var ph = ctx.createLinearGradient(0, 0, 0, imgH);
      ph.addColorStop(0, "#ffedd5");
      ph.addColorStop(1, "#fdba74");
      ctx.fillStyle = ph;
      ctx.fillRect(0, 0, SHARE_W, imgH);
      var emojiPx = Math.min(220, Math.round(imgH * 0.22));
      ctx.font =
        emojiPx +
        'px Fredoka, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(petEmoji || "🐾", cx, imgH * 0.48);
    }
    ctx.restore();

    ctx.fillStyle = "#fffdfb";
    ctx.fillRect(0, imgH, SHARE_W, SHARE_H - imgH);
    ctx.strokeStyle = "rgba(234, 88, 12, 0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, imgH + 1);
    ctx.lineTo(SHARE_W - 40, imgH + 1);
    ctx.stroke();

    ctx.font = '600 42px Nunito, "PingFang SC", "Microsoft YaHei", sans-serif';
    var nickLines = wrapLines(ctx, typeNick, nickMaxW, 2);
    var gapName = 14;
    var hCode = 124;
    var gapCode = 16;
    var lineNick = 52;
    var gapBeforeSite = 24;
    var hSite = 38;
    var hName = 58;
    var stackH = hName + gapName + hCode + gapCode + nickLines.length * lineNick + gapBeforeSite + hSite;
    var zoneH = SHARE_H - imgH;
    var startY = imgH + Math.max(40, (zoneH - stackH) / 2);

    ctx.fillStyle = "#3f2e28";
    ctx.font = '700 62px Nunito, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(displayName, cx, startY);
    startY += hName + gapName;

    ctx.font = '600 118px Fredoka, "Segoe UI", sans-serif';
    ctx.fillStyle = "#ea580c";
    ctx.shadowColor = "rgba(251, 146, 60, 0.35)";
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillText(typeCode, cx, startY);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    startY += hCode + gapCode;

    ctx.font = '600 42px Nunito, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = "#5c4033";
    for (var i = 0; i < nickLines.length; i++) {
      ctx.fillText(nickLines[i], cx, startY);
      startY += lineNick;
    }
    startY += gapBeforeSite;

    ctx.font = '600 34px Nunito, "Segoe UI", sans-serif';
    ctx.fillStyle = "#c2410c";
    ctx.fillText(SHARE_SITE_LINE, cx, startY);

    drawCuteShareBorder(ctx, SHARE_W, SHARE_H);
  }

  function setupShareUI(meta) {
    var shareCanvas = document.getElementById("share-canvas");
    var sharePetName = document.getElementById("share-pet-name");
    var sharePhoto = document.getElementById("share-photo");
    var shareDownload = document.getElementById("share-download");
    var sharePreviewCard = document.getElementById("share-preview-card");
    var shareChangePhotoBtn = document.getElementById("share-change-photo");
    var shareUserImg = null;
    var previewHint = document.getElementById("share-preview-hint");
    var shareZoom = 1;
    var sharePanX = 0;
    var sharePanY = 0;
    var dragActive = false;
    var dragPointerId = null;
    var pinchActive = false;
    var pinchDist0 = 0;
    var pinchZoom0 = 1;

    if (!shareCanvas || !sharePetName || !sharePhoto || !shareDownload) return;

    function clearDragState() {
      dragActive = false;
      dragPointerId = null;
      shareCanvas.classList.remove("is-dragging");
      delete shareCanvas._panLastX;
      delete shareCanvas._panLastY;
    }

    function beginPinchFromTouches(touches) {
      if (!touches || touches.length < 2) return;
      var d = touchPinchDistance(touches[0], touches[1]);
      pinchDist0 = Math.max(28, d);
      pinchZoom0 = shareZoom;
      pinchActive = true;
      clearDragState();
    }

    function endPinchIfNeeded(touchCount) {
      if (touchCount < 2) {
        pinchActive = false;
      }
    }

    function imgTransform() {
      return { zoom: shareZoom, panX: sharePanX, panY: sharePanY };
    }

    function applyClamp() {
      if (!shareUserImg || !shareUserImg.naturalWidth) return;
      var cl = clampImagePan(
        shareUserImg.naturalWidth,
        shareUserImg.naturalHeight,
        SHARE_W,
        SHARE_IMG_H,
        shareZoom,
        sharePanX,
        sharePanY
      );
      sharePanX = cl.panX;
      sharePanY = cl.panY;
    }

    function resetImageTransform() {
      shareZoom = 1;
      sharePanX = 0;
      sharePanY = 0;
    }

    function syncPreviewHint() {
      if (!previewHint) return;
      previewHint.textContent = shareUserImg ? "拖拽移动 · 滚轮缩放 · 双指捏合" : "点击卡片上传照片";
    }

    function syncChrome() {
      syncPreviewHint();
      if (sharePreviewCard) {
        sharePreviewCard.classList.toggle("has-photo", !!shareUserImg);
      }
      var show = !!shareUserImg;
      if (shareChangePhotoBtn) shareChangePhotoBtn.hidden = !show;
      if (shareCanvas) {
        shareCanvas.classList.toggle("has-photo", show);
        shareCanvas.setAttribute(
          "aria-label",
          show
            ? "分享图预览，单指拖拽平移，鼠标滚轮缩放，触摸屏双指捏合缩放，更换照片请点右上角按钮"
            : "分享图预览，点击上传照片"
        );
      }
    }

    function redraw() {
      applyClamp();
      var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      return fontsReady.then(function () {
        drawShareCard(
          shareCanvas,
          shareUserImg,
          sharePetName.value,
          meta.typeCode,
          meta.typeNick,
          meta.petEmoji,
          meta.petLabel,
          imgTransform()
        );
      });
    }

    if (sharePreviewCard) {
      sharePreviewCard.addEventListener("click", function (e) {
        if (shareUserImg) return;
        if (shareChangePhotoBtn && e.target === shareChangePhotoBtn) return;
        sharePhoto.click();
      });
    }

    if (shareChangePhotoBtn) {
      shareChangePhotoBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        sharePhoto.click();
      });
    }

    sharePetName.addEventListener("input", function () {
      redraw();
    });

    shareCanvas.addEventListener(
      "touchstart",
      function (e) {
        if (!shareUserImg || e.touches.length !== 2) return;
        beginPinchFromTouches(e.touches);
      },
      { passive: true }
    );

    shareCanvas.addEventListener(
      "touchmove",
      function (e) {
        if (!shareUserImg || e.touches.length < 2) return;
        if (!pinchActive) beginPinchFromTouches(e.touches);
        e.preventDefault();
        var d = touchPinchDistance(e.touches[0], e.touches[1]);
        if (pinchDist0 < 1) return;
        var ratio = d / pinchDist0;
        var z = pinchZoom0 * ratio;
        shareZoom = Math.max(1, Math.min(4, z));
        applyClamp();
        redraw();
      },
      { passive: false }
    );

    shareCanvas.addEventListener("touchend", function (e) {
      endPinchIfNeeded(e.touches.length);
    });
    shareCanvas.addEventListener("touchcancel", function (e) {
      endPinchIfNeeded(e.touches.length);
    });

    shareCanvas.addEventListener(
      "wheel",
      function (e) {
        if (!shareUserImg) return;
        e.preventDefault();
        var step = e.deltaY > 0 ? -5 : 5;
        var next = Math.round(shareZoom * 100) + step;
        next = Math.max(100, Math.min(400, next));
        shareZoom = next / 100;
        applyClamp();
        redraw();
      },
      { passive: false }
    );

    shareCanvas.addEventListener("pointerdown", function (e) {
      if (!shareUserImg || e.button !== 0 || pinchActive) return;
      dragActive = true;
      dragPointerId = e.pointerId;
      shareCanvas.classList.add("is-dragging");
      try {
        shareCanvas.setPointerCapture(e.pointerId);
      } catch (err) {}
      shareCanvas._panLastX = e.clientX;
      shareCanvas._panLastY = e.clientY;
    });

    shareCanvas.addEventListener("pointermove", function (e) {
      if (pinchActive || !dragActive || e.pointerId !== dragPointerId || !shareUserImg) return;
      var lx = shareCanvas._panLastX;
      var ly = shareCanvas._panLastY;
      if (lx === undefined) return;
      var dx = e.clientX - lx;
      var dy = e.clientY - ly;
      shareCanvas._panLastX = e.clientX;
      shareCanvas._panLastY = e.clientY;
      var rect = shareCanvas.getBoundingClientRect();
      if (rect.width < 1) return;
      var scale = SHARE_W / rect.width;
      sharePanX += dx * scale;
      sharePanY += dy * scale;
      applyClamp();
      redraw();
    });

    function endPan(e) {
      if (!dragActive || (e && e.pointerId !== dragPointerId)) return;
      try {
        if (e) shareCanvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
      clearDragState();
    }

    shareCanvas.addEventListener("pointerup", endPan);
    shareCanvas.addEventListener("pointercancel", endPan);
    shareCanvas.addEventListener("lostpointercapture", endPan);

    sharePhoto.addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f || !/^image\//.test(f.type)) {
        shareUserImg = null;
        resetImageTransform();
        syncChrome();
        redraw();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var url = reader.result;
        var img = new Image();
        img.onload = function () {
          shareUserImg = img;
          resetImageTransform();
          syncChrome();
          redraw();
        };
        img.onerror = function () {
          shareUserImg = null;
          resetImageTransform();
          syncChrome();
          redraw();
        };
        img.src = url;
      };
      reader.readAsDataURL(f);
    });

    shareDownload.addEventListener("click", function () {
      redraw().then(function () {
        shareCanvas.toBlob(
          function (blob) {
            if (!blob) return;
            var nameBase = (sharePetName.value && sharePetName.value.trim()) || "my-pet";
            var safe = nameBase.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 40);
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = safe + "-mbti-share.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () {
              URL.revokeObjectURL(a.href);
            }, 4000);
          },
          "image/png",
          0.95
        );
      });
    });

    syncChrome();
    redraw();
  }

  global.petsmbtiSetupShareUI = setupShareUI;
})(typeof window !== "undefined" ? window : this);
