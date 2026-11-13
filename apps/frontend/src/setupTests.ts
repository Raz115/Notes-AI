import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// Mock HTMLCanvasElement.prototype.getContext for jsdom
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === "2d") {
      return {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        measureText: () => ({ width: 0 }),
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// Polyfill PointerEvent for jsdom
if (typeof window !== "undefined" && !window.PointerEvent) {
  class MockPointerEvent extends MouseEvent {
    public pointerId: number;
    public pressure: number;
    public pointerType: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pressure = params.pressure ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
    }
  }
  window.PointerEvent = MockPointerEvent as unknown as typeof window.PointerEvent;
}
