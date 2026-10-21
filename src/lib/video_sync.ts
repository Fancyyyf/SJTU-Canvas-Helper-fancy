/** Keep both camera controls usable while the primary camera is the clock. */
export function attachSynchronizedPlayback(primary: HTMLVideoElement, secondary: HTMLVideoElement): () => void {
  const programmaticSeeks = new WeakMap<HTMLVideoElement, { time: number; expires: number }>();
  let lastDriftCorrection = 0;

  const seekTo = (target: HTMLVideoElement, time: number, tolerance = 0.05) => {
    if (target.readyState < target.HAVE_METADATA || !Number.isFinite(time)) return;
    if (Math.abs(target.currentTime - time) <= tolerance) return;
    programmaticSeeks.set(target, { time, expires: Date.now() + 1000 });
    target.currentTime = time;
  };
  const isProgrammaticSeek = (source: HTMLVideoElement) => {
    const pending = programmaticSeeks.get(source);
    return Boolean(pending && pending.expires > Date.now() && Math.abs(source.currentTime - pending.time) <= 0.05);
  };
  const mirrorSeek = (source: HTMLVideoElement, target: HTMLVideoElement) => {
    if (!isProgrammaticSeek(source)) seekTo(target, source.currentTime);
  };
  const seekFinished = (source: HTMLVideoElement, target: HTMLVideoElement) => {
    if (isProgrammaticSeek(source)) {
      programmaticSeeks.delete(source);
      return;
    }
    programmaticSeeks.delete(source);
    seekTo(target, source.currentTime);
  };
  const mirrorPlay = (source: HTMLVideoElement, target: HTMLVideoElement) => {
    if (!source.paused && target.paused) void target.play().catch(() => {});
  };
  const mirrorPause = (source: HTMLVideoElement, target: HTMLVideoElement) => {
    if (source.paused && !target.paused) target.pause();
  };
  const mirrorRate = (source: HTMLVideoElement, target: HTMLVideoElement) => {
    if (target.playbackRate !== source.playbackRate) target.playbackRate = source.playbackRate;
  };
  const alignSecondary = () => {
    if (primary.readyState < primary.HAVE_METADATA || secondary.readyState < secondary.HAVE_METADATA) return;
    seekTo(secondary, primary.currentTime);
    mirrorRate(primary, secondary);
    if (primary.paused) secondary.pause();
    else mirrorPlay(primary, secondary);
  };
  const correctDrift = () => {
    const now = Date.now();
    if (now - lastDriftCorrection < 500 || primary.seeking || secondary.seeking) return;
    if (Math.abs(primary.currentTime - secondary.currentTime) > 0.4) {
      seekTo(secondary, primary.currentTime);
      lastDriftCorrection = now;
    }
  };

  const onPrimarySeeking = () => mirrorSeek(primary, secondary);
  const onSecondarySeeking = () => mirrorSeek(secondary, primary);
  const onPrimarySeeked = () => seekFinished(primary, secondary);
  const onSecondarySeeked = () => seekFinished(secondary, primary);
  const onPrimaryPlay = () => mirrorPlay(primary, secondary);
  const onSecondaryPlay = () => mirrorPlay(secondary, primary);
  const onPrimaryPause = () => mirrorPause(primary, secondary);
  const onSecondaryPause = () => mirrorPause(secondary, primary);
  const onPrimaryRate = () => mirrorRate(primary, secondary);
  const onSecondaryRate = () => mirrorRate(secondary, primary);

  primary.addEventListener("loadedmetadata", alignSecondary);
  secondary.addEventListener("loadedmetadata", alignSecondary);
  primary.addEventListener("seeking", onPrimarySeeking);
  secondary.addEventListener("seeking", onSecondarySeeking);
  primary.addEventListener("seeked", onPrimarySeeked);
  secondary.addEventListener("seeked", onSecondarySeeked);
  primary.addEventListener("play", onPrimaryPlay);
  secondary.addEventListener("play", onSecondaryPlay);
  primary.addEventListener("pause", onPrimaryPause);
  secondary.addEventListener("pause", onSecondaryPause);
  primary.addEventListener("ratechange", onPrimaryRate);
  secondary.addEventListener("ratechange", onSecondaryRate);
  primary.addEventListener("timeupdate", correctDrift);
  alignSecondary();

  return () => {
    primary.removeEventListener("loadedmetadata", alignSecondary);
    secondary.removeEventListener("loadedmetadata", alignSecondary);
    primary.removeEventListener("seeking", onPrimarySeeking);
    secondary.removeEventListener("seeking", onSecondarySeeking);
    primary.removeEventListener("seeked", onPrimarySeeked);
    secondary.removeEventListener("seeked", onSecondarySeeked);
    primary.removeEventListener("play", onPrimaryPlay);
    secondary.removeEventListener("play", onSecondaryPlay);
    primary.removeEventListener("pause", onPrimaryPause);
    secondary.removeEventListener("pause", onSecondaryPause);
    primary.removeEventListener("ratechange", onPrimaryRate);
    secondary.removeEventListener("ratechange", onSecondaryRate);
    primary.removeEventListener("timeupdate", correctDrift);
  };
}
