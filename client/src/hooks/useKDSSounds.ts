import { useCallback, useRef } from "react";

export function useKDSSounds() {
  const audioContext = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext.current;
  }, []);

  const playBeep = useCallback((frequency: number, duration: number) => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, [getAudioContext]);

  const novoPedido = useCallback(() => {
    // 3 bips curtos
    playBeep(800, 0.1);
    setTimeout(() => playBeep(800, 0.1), 150);
    setTimeout(() => playBeep(800, 0.1), 300);
  }, [playBeep]);

  const etapaConcluida = useCallback(() => {
    // 1 bip
    playBeep(600, 0.15);
  }, [playBeep]);

  const pizzaPronta = useCallback(() => {
    // 2 bips longos
    playBeep(1000, 0.3);
    setTimeout(() => playBeep(1000, 0.3), 400);
  }, [playBeep]);

  const atraso = useCallback(() => {
    // Bip contínuo
    playBeep(400, 0.5);
  }, [playBeep]);

  return {
    novoPedido,
    etapaConcluida,
    pizzaPronta,
    atraso,
  };
}
