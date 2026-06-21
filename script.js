(function () {
  function setupBibtexCopy() {
    var button = document.querySelector("[data-copy-bibtex]");
    var code = document.getElementById("bibtex-code");
    var toast = document.querySelector(".toast");

    if (!button || !code || !toast) {
      return;
    }

    function showToast(message) {
      toast.textContent = message;
      toast.hidden = false;
      window.clearTimeout(showToast.timer);
      showToast.timer = window.setTimeout(function () {
        toast.hidden = true;
      }, 1800);
    }

    button.addEventListener("click", function () {
      var text = code.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast("BibTeX copied");
        }).catch(function () {
          showToast("Copy failed");
        });
        return;
      }

      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        showToast("BibTeX copied");
      } catch (error) {
        showToast("Copy failed");
      }
      document.body.removeChild(textarea);
    });
  }

  function setupSynchronizedVideos() {
    var groups = Array.prototype.slice.call(document.querySelectorAll(".video-grid"));

    groups.forEach(function (group) {
      var videos = Array.prototype.slice.call(group.querySelectorAll("video"));
      var leader = videos[0];
      var internalEventUntil = new Map();

      if (videos.length < 2) {
        return;
      }

      function now() {
        return window.performance && window.performance.now ? window.performance.now() : Date.now();
      }

      function markInternal(video, duration) {
        internalEventUntil.set(video, now() + (duration || 500));
      }

      function isInternal(video) {
        return now() < (internalEventUntil.get(video) || 0);
      }

      function targetTimeFor(video, time) {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          return time % video.duration;
        }
        return time;
      }

      function setPlaybackRate(video, rate) {
        if (Math.abs(video.playbackRate - rate) < 0.005) {
          return;
        }
        markInternal(video);
        video.playbackRate = rate;
      }

      function seekTo(video, time) {
        var targetTime = targetTimeFor(video, time);
        markInternal(video, 700);
        try {
          video.currentTime = targetTime;
        } catch (error) {}
      }

      function safePlay(video) {
        markInternal(video);
        var promise = video.play();
        if (promise && typeof promise.catch === "function") {
          promise.catch(function () {});
        }
      }

      function safePause(video) {
        if (video.paused) {
          return;
        }
        markInternal(video);
        video.pause();
      }

      function syncPlaybackState(source) {
        videos.forEach(function (video) {
          if (source.paused) {
            safePause(video);
          } else if (video.paused) {
            safePlay(video);
          }
        });
      }

      function hardSyncTo(source, syncPlayback) {
        if (!source) {
          return;
        }

        videos.forEach(function (video) {
          setPlaybackRate(video, source.playbackRate);
          if (video !== source) {
            seekTo(video, source.currentTime || 0);
          }
        });

        if (syncPlayback) {
          syncPlaybackState(source);
        }
      }

      function driftCorrect() {
        if (!leader) {
          return;
        }

        var baseRate = leader.playbackRate || 1;
        var leaderTime = leader.currentTime || 0;

        videos.forEach(function (video) {
          var targetTime;
          var diff;
          var rate;

          if (video === leader) {
            setPlaybackRate(video, baseRate);
            return;
          }

          targetTime = targetTimeFor(video, leaderTime);
          diff = video.currentTime - targetTime;

          if (leader.paused) {
            setPlaybackRate(video, baseRate);
            if (Math.abs(diff) > 0.04) {
              seekTo(video, leaderTime);
            }
            return;
          }

          if (Math.abs(diff) > 0.35) {
            seekTo(video, leaderTime);
            setPlaybackRate(video, baseRate);
            return;
          }

          if (Math.abs(diff) > 0.06) {
            rate = diff > 0 ? baseRate - 0.08 : baseRate + 0.08;
            setPlaybackRate(video, Math.max(0.75, Math.min(1.25, rate)));
          } else {
            setPlaybackRate(video, baseRate);
          }
        });
      }

      videos.forEach(function (video) {
        video.muted = true;
        video.loop = true;
        video.preload = "auto";

        video.addEventListener("play", function () {
          if (isInternal(video)) {
            return;
          }
          leader = video;
          hardSyncTo(video, true);
        });

        video.addEventListener("pause", function () {
          if (isInternal(video)) {
            return;
          }
          leader = video;
          hardSyncTo(video, true);
        });

        video.addEventListener("seeked", function () {
          if (isInternal(video)) {
            return;
          }
          leader = video;
          hardSyncTo(video, true);
        });

        video.addEventListener("ratechange", function () {
          if (isInternal(video)) {
            return;
          }
          leader = video;
          hardSyncTo(video, false);
        });
      });

      window.setInterval(function () {
        driftCorrect();
      }, 250);

      window.setTimeout(function () {
        videos.forEach(function (video) {
          markInternal(video);
        });
        videos.forEach(function (video) {
          safePlay(video);
        });
        hardSyncTo(leader, true);
      }, 300);
    });
  }

  setupBibtexCopy();
  setupSynchronizedVideos();
}());
