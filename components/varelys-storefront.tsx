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

function VarelysScrollFilm() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const targetTimeRef = useRef(0);
  const displayTimeRef = useRef(0);
  const durationRef = useRef(0);
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
      if (!durationRef.current || reducedMotionRef.current) return durationRef.current;

      const scrollDistance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(
        1,
        Math.max(0, -section.getBoundingClientRect().top / scrollDistance),
      );
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
        </div>
      </div>
    </section>
  );
}
