"use client";

import {
  defaultObjectSizing,
  emptyPixel,
  getShaderColorFromString,
  liquidMetalFragmentShader,
  ShaderFitOptions,
  ShaderMount,
} from "@paper-design/shaders";
import { Loader2, Sparkles } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A button with a live liquid-metal rim (a WebGL shader from @paper-design/shaders),
 * tinted to the app's violet. Each one runs its own WebGL context and browsers
 * allow only about 16 per page, so it is kept for a few main actions; every
 * other primary button gets the CSS look-alike (the `liquid-metal` utility in
 * globals.css) through the Button component.
 *
 * Adapted from the v0 "liquid metal button": sizes to its label or to its
 * container (fullWidth), works as a submit button, can be disabled or busy,
 * shows a focus ring, and stands still for people who prefer reduced motion.
 * Without WebGL the rim falls back to a static violet gradient.
 */
interface LiquidMetalButtonProps {
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  viewMode?: "text" | "icon";
  type?: "button" | "submit";
  disabled?: boolean;
  /** Shows a spinner, and busyLabel if given; the button is disabled meanwhile. */
  busy?: boolean;
  busyLabel?: string;
  /** Shown before the label (text mode) or instead of the sparkle (icon mode). */
  icon?: React.ReactNode;
  /** Take the full width of the container instead of sizing to the label. */
  fullWidth?: boolean;
  /** Height in px (default 46). */
  height?: number;
  className?: string;
  "aria-label"?: string;
}

const TINT = "#8b7cf6"; // the app's violet
const SPEED_IDLE = 0.6;
const SPEED_HOVER = 1;
const SPEED_CLICK = 2.4;

export function LiquidMetalButton({
  label = "Get Started",
  onClick,
  viewMode = "text",
  type = "button",
  disabled = false,
  busy = false,
  busyLabel,
  icon,
  fullWidth = false,
  height = 46,
  className,
  "aria-label": ariaLabel,
}: LiquidMetalButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const shaderRef = useRef<HTMLDivElement>(null);
  const shaderMount = useRef<ShaderMount | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);
  const reducedMotion = useRef(false);

  const inactive = disabled || busy;
  const text = busy && busyLabel ? busyLabel : label;
  const width = viewMode === "icon" ? height : fullWidth ? "100%" : Math.max(142, Math.round(text.length * 8.2 + (icon || busy ? 76 : 52)));

  useEffect(() => {
    const styleId = "liquid-metal-button-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .liquid-metal-shader canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          border-radius: 9999px !important;
        }
        @keyframes liquid-metal-ripple {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    reducedMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!shaderRef.current) return;
    // The shader samples an image even when it draws a built-in shape: give it a blank pixel.
    const blank = new Image();
    blank.src = emptyPixel;
    try {
      shaderMount.current = new ShaderMount(
        shaderRef.current,
        liquidMetalFragmentShader,
        {
          u_colorBack: [0, 0, 0, 0],
          u_colorTint: getShaderColorFromString(TINT),
          u_image: blank,
          u_isImage: false,
          u_repetition: 4,
          u_softness: 0.5,
          u_shiftRed: 0.3,
          u_shiftBlue: 0.3,
          u_distortion: 0,
          u_contour: 0,
          u_angle: 45,
          u_shape: 1,
          u_fit: ShaderFitOptions.cover,
          u_scale: 8,
          u_rotation: defaultObjectSizing.rotation,
          u_originX: defaultObjectSizing.originX,
          u_originY: defaultObjectSizing.originY,
          u_offsetX: 0.1,
          u_offsetY: -0.1,
          u_worldWidth: defaultObjectSizing.worldWidth,
          u_worldHeight: defaultObjectSizing.worldHeight,
        },
        undefined,
        reducedMotion.current ? 0 : SPEED_IDLE,
      );
    } catch (error) {
      // No WebGL (old browser, too many contexts): the gradient underneath shows instead.
      console.warn("Liquid metal shader unavailable:", error);
    }
    return () => {
      shaderMount.current?.dispose();
      shaderMount.current = null;
    };
  }, []);

  const setSpeed = (speed: number) => {
    if (!reducedMotion.current) shaderMount.current?.setSpeed(speed);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSpeed(SPEED_CLICK);
    window.setTimeout(() => setSpeed(isHovered ? SPEED_HOVER : SPEED_IDLE), 300);
    if (buttonRef.current && !reducedMotion.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const ripple = { x: e.clientX - rect.left, y: e.clientY - rect.top, id: rippleId.current++ };
      setRipples((prev) => [...prev, ripple]);
      window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id)), 600);
    }
    onClick?.(e);
  };

  const press = isPressed ? "translateY(1px) scale(0.98)" : "translateY(0) scale(1)";
  const layer: React.CSSProperties = { position: "absolute", inset: 0, transition: "transform 0.15s ease" };

  return (
    <div
      className={cn("relative inline-block align-middle", fullWidth && "block w-full", inactive && "opacity-60", className)}
      style={{ width, height }}
    >
      {/* Rim: the shader over a violet gradient (the fallback). */}
      <div
        style={{
          ...layer,
          transform: press,
          borderRadius: 9999,
          background: "linear-gradient(120deg, #7dd3fc 0%, #a78bfa 45%, #f0abfc 100%)",
          boxShadow: isPressed
            ? "0 0 0 1px rgb(76 61 160 / 0.5), 0 1px 2px rgb(0 0 0 / 0.3)"
            : isHovered
              ? "0 0 0 1px rgb(76 61 160 / 0.4), 0 12px 18px -6px rgb(124 108 240 / 0.45), 0 4px 6px rgb(0 0 0 / 0.12)"
              : "0 0 0 1px rgb(76 61 160 / 0.3), 0 10px 16px -8px rgb(124 108 240 / 0.4), 0 2px 5px rgb(0 0 0 / 0.12)",
        }}
      >
        <div
          ref={shaderRef}
          className="liquid-metal-shader"
          style={{ position: "relative", width: "100%", height: "100%", borderRadius: 9999, overflow: "hidden" }}
        />
      </div>

      {/* Face: a deep violet pill inside the rim. */}
      <div style={{ ...layer, inset: 2, transform: press, zIndex: 1 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            background: "linear-gradient(180deg, #3a2f7d 0%, #1d1748 100%)",
            boxShadow: isPressed
              ? "inset 0 2px 4px rgb(0 0 0 / 0.45)"
              : "inset 0 1px 0 rgb(255 255 255 / 0.18)",
          }}
        />
      </div>

      {/* Label */}
      <div
        style={{
          ...layer,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "0 18px",
          pointerEvents: "none",
          color: "#f5f3ff",
          fontSize: height >= 46 ? 15 : 14,
          fontWeight: 600,
          textShadow: "0 1px 2px rgb(0 0 0 / 0.5)",
          whiteSpace: "nowrap",
          transform: press,
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : viewMode === "icon" ? (
          (icon ?? <Sparkles size={16} aria-hidden />)
        ) : (
          icon
        )}
        {viewMode === "text" ? <span className="truncate">{text}</span> : null}
      </div>

      <button
        ref={buttonRef}
        type={type}
        disabled={inactive}
        onClick={handleClick}
        onMouseEnter={() => {
          setIsHovered(true);
          setSpeed(SPEED_HOVER);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
          setSpeed(SPEED_IDLE);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        aria-label={ariaLabel ?? (viewMode === "icon" ? label : undefined)}
        aria-busy={busy || undefined}
        className="absolute inset-0 z-[3] cursor-pointer overflow-hidden rounded-full border-0 bg-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed"
      >
        {viewMode === "text" ? <span className="sr-only">{text}</span> : null}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            aria-hidden
            style={{
              position: "absolute",
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgb(255 255 255 / 0.45) 0%, rgb(255 255 255 / 0) 70%)",
              pointerEvents: "none",
              animation: "liquid-metal-ripple 0.6s ease-out",
            }}
          />
        ))}
      </button>
    </div>
  );
}
