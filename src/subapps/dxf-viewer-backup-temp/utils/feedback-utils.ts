/**
 * FEEDBACK UTILITIES
 * Παρέχει ηχητικό και haptic feedback για καλύτερη UX
 */

import { createFeedbackMessage } from './shared/feedback-message-utils';

// Ηχητικά effects για διάφορες ενέργειες
export class SoundFeedback {
  private static audioContext: AudioContext | null = null;
  
  private static getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }
  
  // Snap sound effect
  static playSnapSound(): void {
    this.playSound([800, 1200], [0.1, 0.1], 0.1);
  }
  
  // Input confirmation sound
  static playConfirmSound(): void {
    this.playSound([600, 800], [0.05, 0.15], 0.15);
  }
  
  // Error sound
  static playErrorSound(): void {
    this.playSound([300, 250], [0.08, 0.3], 0.3);
  }
  
  // Shared sound creation method - eliminates duplicates
  private static playSound(
    frequencies: number[],
    gains: number[],
    duration: number
  ): void {
    try {
      const ctx = this.getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (frequencies.length >= 2) {
        oscillator.frequency.setValueAtTime(frequencies[0], ctx.currentTime);
        oscillator.frequency.setValueAtTime(frequencies[1], ctx.currentTime + duration * 0.5);
      } else {
        oscillator.frequency.setValueAtTime(frequencies[0], ctx.currentTime);
      }
      
      gainNode.gain.setValueAtTime(gains[0], ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
      console.debug('Audio not available');
    }
  }
}

// Haptic feedback utilities
export class HapticFeedback {
  // Ελαφρό vibration για snap
  static snapFeedback(): void {
    if (navigator.vibrate) {
      navigator.vibrate([10]);
    }
  }
  
  // Επιβεβαίωση ενέργειας
  static confirmFeedback(): void {
    if (navigator.vibrate) {
      navigator.vibrate([20, 10, 20]);
    }
  }
  
  // Error feedback
  static errorFeedback(): void {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  }
}

// Ενοποιημένο feedback system
export class CADFeedback {
  // Snap feedback
  static onSnap(): void {
    SoundFeedback.playSnapSound();
    HapticFeedback.snapFeedback();
  }
  
  // Dynamic input confirmation
  static onInputConfirm(): void {
    SoundFeedback.playConfirmSound();
    HapticFeedback.confirmFeedback();
  }
  
  // Error feedback
  static onError(): void {
    SoundFeedback.playErrorSound();
    HapticFeedback.errorFeedback();
  }
}