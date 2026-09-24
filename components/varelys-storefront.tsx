'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { StorefrontSection } from '@/lib/types';
import type { StorefrontViewModel } from './storefront-sections';

export default function VarelysStorefront({
  view,
  className,
  style,
}: {
  view: StorefrontViewModel;
  sections: StorefrontSection[];
  className: string;
  style: CSSProperties;
}) {
  return (
    <div className={`${className} vp3-store`} style={style}>
      <header className="vp3-header vp3-simple-header">
        <a href="/" className="vp3-brand" aria-label={view.tenant.name}>
          <span className="vp3-brand-mark">
            <img src={view.logo} alt="" />
          </span>
          <span className="vp3-brand-copy">
            <strong>{view.tenant.name}</strong>
            <small>Perfume atelier</small>
          </span>
        </a>
        <span className="vp3-simple-header-note">Scroll to reveal</span>
      </header>

      <main>
        <VarelysScrollFilm />
      </main>
    </div>
  );
}

const SCROLL_FILM_SRC = '/brand/varelys-scroll-mist.mp4';

const productStory = [
  {
    at: 0.07,
    eyebrow: 'Noir 07',
    title: 'Warm amber, close to skin.',
    body: 'A polished amber perfume built around soft resin, clean woods and a quiet musk finish.',
  },
  {
    at: 0.32,
    eyebrow: 'The Spray',
    title: 'A fine mist with a gentle trail.',
    body: 'The atomizer releases a controlled cloud, so the scent opens evenly instead of arriving all at once.',
  },
  {
    at: 0.58,
    eyebrow: 'The Bottle',
    title: 'Weighted glass, clear edges.',
    body: 'The square bottle is designed to feel substantial in hand while keeping the amber liquid visible from every angle.',
  },
  {
    at: 0.93,
    eyebrow: 'The Drydown',
    title: 'Smooth, warm, lasting.',
    body: 'Noir 07 settles into polished woods and soft musk: refined enough for evening, easy enough for every day.',
  },
];

function VarelysScrollFilm() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const storyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const targetTimeRef = useRef(0);
  const displayTimeRef = useRef(0);
  const durationRef = useRef(0);
  const progressRef = useRef(0);
  const pendingSeekTimeRef = useRef(0);
  const lastSeekTimeRef = useRef(-1);
  const seekingRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!section || !stage || !canvas || !video) return;

    let mounted = true;

    const updateStory = (progress: number) => {
      progressRef.current = progress;
      stage.style.setProperty('--film-progress', progress.toFixed(4));

      storyRefs.current.forEach((item, index) => {
        if (!item) return;
        const stop = productStory[index]?.at ?? 0;
        const distance = Math.abs(progress - stop);
        const rawOpacity = Math.max(0, 1 - distance / 0.19);
        const opacity = rawOpacity * rawOpacity * (3 - 2 * rawOpacity);
        const direction = progress >= stop ? -1 : 1;
        const lift = direction * (1 - opacity) * 18;

        item.style.opacity = opacity.toFixed(3);
        item.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) scale(${(0.985 + opacity * 0.015).toFixed(3)})`;
        item.style.visibility = opacity > 0.035 ? 'visible' : 'hidden';
      });
    };

    const setCanvasSize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const drawFrame = () => {
      const context = canvas.getContext('2d');
      if (!context || !video.videoWidth || !video.videoHeight) return;

      setCanvasSize();

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
      const drawWidth = videoWidth * scale;
      const drawHeight = videoHeight * scale;
      const drawX = (canvasWidth - drawWidth) / 2;
      const drawY = (canvasHeight - drawHeight) / 2;

      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = '#171613';
      context.fillRect(0, 0, canvasWidth, canvasHeight);
      context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    };

    const targetTimeFromScroll = () => {
      if (!durationRef.current || reducedMotionRef.current) {
        updateStory(1);
        return durationRef.current;
      }

      const scrollDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(
        1,
        Math.max(0, -section.getBoundingClientRect().top / scrollDistance),
      );
      updateStory(progress);
      return durationRef.current * progress;
    };

    const updateTargetTime = () => {
      targetTimeRef.current = targetTimeFromScroll();
    };

    const handleResize = () => {
      updateTargetTime();
      drawFrame();
    };

    const seekVideo = (time: number) => {
      if (!Number.isFinite(time)) return;
      const clampedTime = Math.min(durationRef.current, Math.max(0, time));
      if (
        seekingRef.current ||
        Math.abs(clampedTime - lastSeekTimeRef.current) < 0.012
      )
        return;

      if (Math.abs(video.currentTime - clampedTime) < 0.012) {
        lastSeekTimeRef.current = clampedTime;
        drawFrame();
        return;
      }

      seekingRef.current = true;
      lastSeekTimeRef.current = clampedTime;
      try {
        video.currentTime = clampedTime;
      } catch {
        video.currentTime = Math.max(0, durationRef.current - 0.04);
      }
      if (!video.seeking) window.requestAnimationFrame(flushPendingSeek);
    };

    const flushPendingSeek = () => {
      seekingRef.current = false;
      drawFrame();
      if (Math.abs(pendingSeekTimeRef.current - lastSeekTimeRef.current) >= 0.012) {
        seekVideo(pendingSeekTimeRef.current);
      }
    };

    const tick = () => {
      if (!mounted) return;

      updateTargetTime();
      const target = targetTimeRef.current;
      const current = displayTimeRef.current;
      const delta = target - current;
      const nearTimelineEdge =
        target < 0.045 || durationRef.current - target < 0.045;
      const next =
        Math.abs(delta) < 0.018 || nearTimelineEdge || reducedMotionRef.current
          ? target
          : current + delta * 0.28;

      displayTimeRef.current = next;
      pendingSeekTimeRef.current = next;
      seekVideo(next);
      if (!seekingRef.current) drawFrame();
      frameRef.current = window.requestAnimationFrame(tick);
    };

    const handleReady = () => {
      durationRef.current = Number.isFinite(video.duration) ? video.duration : 0;
      updateTargetTime();
      displayTimeRef.current = targetTimeRef.current;
      pendingSeekTimeRef.current = displayTimeRef.current;
      lastSeekTimeRef.current = -1;
      seekingRef.current = false;
      seekVideo(displayTimeRef.current);
      drawFrame();
      if (mounted) setReady(true);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
      if (motionQuery.matches && durationRef.current) {
        targetTimeRef.current = durationRef.current;
        displayTimeRef.current = durationRef.current;
        pendingSeekTimeRef.current = durationRef.current;
        lastSeekTimeRef.current = -1;
        seekingRef.current = false;
        updateStory(1);
        seekVideo(durationRef.current);
        drawFrame();
      } else {
        updateTargetTime();
      }
    };

    video.pause();
    video.preload = 'auto';
    video.addEventListener('loadedmetadata', handleReady);
    video.addEventListener('loadeddata', handleReady);
    video.addEventListener('seeked', flushPendingSeek);
    video.addEventListener('timeupdate', drawFrame);
    window.addEventListener('scroll', updateTargetTime, { passive: true });
    window.addEventListener('resize', handleResize);
    motionQuery.addEventListener('change', applyMotionPreference);

    applyMotionPreference();
    updateStory(reducedMotionRef.current ? 1 : 0);
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) handleReady();
    video.load();
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('loadeddata', handleReady);
      video.removeEventListener('seeked', flushPendingSeek);
      video.removeEventListener('timeupdate', drawFrame);
      window.removeEventListener('scroll', updateTargetTime);
      window.removeEventListener('resize', handleResize);
      motionQuery.removeEventListener('change', applyMotionPreference);
    };
  }, []);

  return (
    <section
      className={`vp3-scroll-film${ready ? ' is-ready' : ''}${reducedMotion ? ' is-reduced-motion' : ''}`}
      id="scent-film"
      ref={sectionRef}
      aria-label="Perfume bottle reveal"
    >
      <div className="vp3-scroll-film-sticky">
        <div className="vp3-scroll-film-stage" ref={stageRef}>
          <canvas
            className="vp3-scroll-film-canvas"
            ref={canvasRef}
            aria-label="A perfume bottle rotating through mist."
            role="img"
          />
          <video
            aria-hidden="true"
            className="vp3-scroll-film-video"
            muted
            playsInline
            preload="auto"
            ref={videoRef}
            src={SCROLL_FILM_SRC}
          />
          <div className="vp3-scroll-story" aria-live="polite">
            {productStory.map((item, index) => (
              <div
                className="vp3-scroll-story-card"
                key={item.eyebrow}
                ref={(node) => {
                  storyRefs.current[index] = node;
                }}
              >
                <span className="vp3-story-count">
                  {String(index + 1).padStart(2, '0')} / {String(productStory.length).padStart(2, '0')}
                </span>
                <span className="vp3-story-eyebrow">{item.eyebrow}</span>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
